#!/usr/bin/env python3
"""Stream Supabase Storage objects into an age-encrypted, independently restorable archive.

No plaintext archive is written to disk. The decryption identity is NEVER loaded on
the runner. The archive contains the object bytes and a SHA-256 manifest.
Run only from the protected manual GitHub Actions workflow after credentials are set.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import tarfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BUCKETS = ("concierge-sensitive", "concierge-uploads")
EXPECTED_REF = "jtnyqzxlipekwtoyvcmb"
MAX_SINGLE_BYTES = 15 * 1024 * 1024
MAX_TOTAL_BYTES = 512 * 1024 * 1024
MAX_OBJECTS = 20000
PAGE_SIZE = 1000
SAFE_COMPONENT = re.compile(r"^[^/\\\\.][^/\\\\]*$")


def validate_key(key: str) -> str:
    if not key or key.startswith("/") or "\\\\" in key or "\\x00" in key:
        raise ValueError("Object has an unsafe key")
    if any(component in ("", ".", "..") for component in key.split("/")):
        raise ValueError("Object has unsafe folder segments")
    return key


class StorageReader:
    def __init__(self, url: str, key: str):
        required = f"https://{EXPECTED_REF}.supabase.co"
        if url.rstrip("/") != required or not key:
            raise ValueError("Only the approved production Storage project is permitted")
        self.url = required
        self.key = key

    def _request(self, path: str, payload: dict | None = None) -> bytes:
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        headers = {"apikey": self.key, "Authorization": "Bearer " + self.key}
        if body is not None:
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(
            self.url + "/storage/v1/" + path,
            data=body,
            headers=headers,
            method="POST" if body is not None else "GET",
        )
        for attempt in range(3):
            try:
                with urllib.request.urlopen(request, timeout=60) as response:
                    result = response.read(MAX_SINGLE_BYTES + 1 if body is None else 2 * 1024 * 1024)
                    if body is None and len(result) > MAX_SINGLE_BYTES:
                        raise RuntimeError("Object exceeds 15 MiB safety cap")
                    return result
            except urllib.error.HTTPError as ex:
                if ex.code not in (429, 500, 502, 503, 504) or attempt == 2:
                    raise RuntimeError(f"Storage API HTTP {ex.code}") from None
                time.sleep(2 ** attempt)
        raise RuntimeError("Storage API request failed")

    def list_keys(self, bucket: str) -> list[str]:
        if bucket not in BUCKETS:
            raise ValueError("Unapproved bucket")
        prefixes = [""]
        visited = set()
        keys = []
        while prefixes:
            prefix = prefixes.pop()
            if prefix in visited:
                continue
            visited.add(prefix)
            offset = 0
            while True:
                api = "object/list/" + urllib.parse.quote(bucket, safe="")
                page = json.loads(self._request(api, {
                    "prefix": prefix,
                    "limit": PAGE_SIZE,
                    "offset": offset,
                    "sortBy": {"column": "name", "order": "asc"},
                }))
                if not isinstance(page, list):
                    raise RuntimeError("Unexpected Storage listing format")
                for obj in page:
                    name = obj.get("name")
                    if not isinstance(name, str) or not name:
                        raise RuntimeError("Unexpected object name")
                    path = validate_key(prefix + name)
                    if obj.get("id") is None and obj.get("metadata") is None:
                        prefixes.append(path + "/")
                    else:
                        keys.append(path)
                        if len(keys) > MAX_OBJECTS:
                            raise RuntimeError("Object limit exceeded; switch to an incremental backup system")
                if len(page) < PAGE_SIZE:
                    break
                offset += len(page)
        if len(set(keys)) != len(keys):
            raise RuntimeError("Duplicate Storage object key")
        return sorted(keys)

    def download(self, bucket: str, key: str) -> bytes:
        if bucket not in BUCKETS:
            raise ValueError("Unapproved bucket")
        path = "object/" + urllib.parse.quote(bucket, safe="") + "/" + urllib.parse.quote(validate_key(key), safe="/")
        return self._request(path)


def add_bytes(archive: tarfile.TarFile, name: str, contents: bytes):
    item = tarfile.TarInfo(name)
    item.size = len(contents)
    item.mode = 0o600
    item.mtime = 0
    item.uid = item.gid = 0
    archive.addfile(item, io.BytesIO(contents))


def build_archive(storage, recipient: str, outfile: Path, *, encoder="age") -> dict:
    if not recipient.startswith("age1") or any(c.isspace() for c in recipient):
        raise ValueError("An age X25519 public recipient is required; never use the private identity")
    if outfile.exists():
        raise FileExistsError("Refusing to overwrite a previous archive")
    outfile.parent.mkdir(parents=True, exist_ok=True)
    proc = subprocess.Popen(
        [encoder, "-r", recipient, "-o", str(outfile)],
        stdin=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    manifest = {
        "format": "concierge-storage-snapshot-v1",
        "project_ref": EXPECTED_REF,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "buckets": list(BUCKETS),
        "files": [],
    }
    total = 0
    try:
        assert proc.stdin is not None
        with tarfile.open(fileobj=proc.stdin, mode="w|gz", format=tarfile.PAX_FORMAT) as archive:
            for bucket in BUCKETS:
                for key in storage.list_keys(bucket):
                    contents = storage.download(bucket, key)
                    total += len(contents)
                    if total > MAX_TOTAL_BYTES:
                        raise RuntimeError("512 MiB snapshot safety cap exceeded; no partial backup will be published")
                    add_bytes(archive, f"objects/{bucket}/{key}", contents)
                    manifest["files"].append({
                        "bucket": bucket,
                        "key": key,
                        "size": len(contents),
                        "sha256": hashlib.sha256(contents).hexdigest(),
                    })
            manifest["object_count"] = len(manifest["files"])
            manifest["total_bytes"] = total
            add_bytes(archive, "manifest.json", json.dumps(manifest, sort_keys=True).encode("utf-8"))
        proc.stdin.close()
        result = proc.wait(timeout=120)
        if result != 0:
            raise RuntimeError("age encryption process failed")
        if not outfile.exists() or outfile.stat().st_size < 100:
            raise RuntimeError("Encrypted archive was not created")
        with outfile.open("rb") as f:
            if not f.read(25).startswith(b"age-encryption.org/v1"):
                raise RuntimeError("Output does not have an age encryption header")
        return {"objects": manifest["object_count"], "bytes": total, "ciphertext_bytes": outfile.stat().st_size}
    except BaseException:
        if proc.stdin and not proc.stdin.closed:
            proc.stdin.close()
        if proc.poll() is None:
            proc.kill()
        proc.wait()
        outfile.unlink(missing_ok=True)
        raise
    finally:
        if proc.stderr:
            proc.stderr.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    reader = StorageReader(
        os.environ.get("SUPABASE_URL", ""),
        os.environ.get("SUPABASE_BACKUP_SERVICE_KEY", ""),
    )
    recipient = os.environ.get("AGE_RECIPIENT", "")
    result = build_archive(reader, recipient, args.output)
    # No user IDs, file names, credentials, or unencrypted metadata in job logs.
    print(f"Encrypted snapshot created: {result['objects']} files, {result['bytes']} source bytes")
    print(f"Encrypted archive: {result['ciphertext_bytes']} bytes")
    if result["objects"] == 0:
        print("NOTE: The production Storage buckets are empty; this tests backup plumbing only.")


if __name__ == "__main__":
    main()
