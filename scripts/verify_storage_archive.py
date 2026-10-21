#!/usr/bin/env python3
"""Verify a decrypted Concierge Storage backup TAR.GZ stream without extracting files.

Use on a trusted computer AFTER downloading an encrypted backup from Google Drive:
  age --decrypt --identity /path/to/privately-stored-age-key.txt backup.tar.gz.age \
    | python3 scripts/verify_storage_archive.py

Never run this command using a decryption key stored in GitHub or in the same Drive.
"""
from __future__ import annotations
import hashlib
import json
import sys
import tarfile

BUCKETS = {"concierge-sensitive", "concierge-uploads"}
MANIFEST_MAX = 4 * 1024 * 1024
OBJECT_MAX = 15 * 1024 * 1024


def verify(fileobj):
    manifest = None
    seen = {}
    with tarfile.open(fileobj=fileobj, mode="r|gz") as tar:
        for item in tar:
            if not item.isfile() or item.size < 0:
                raise ValueError("Unexpected TAR entry type or length")
            if item.name == "manifest.json":
                if manifest is not None or item.size > MANIFEST_MAX:
                    raise ValueError("Duplicate or oversized manifest")
                data = tar.extractfile(item).read()
                manifest = json.loads(data)
                continue
            if manifest is not None:
                raise ValueError("Manifest must be the last TAR entry")
            if not item.name.startswith("objects/") or item.size > OBJECT_MAX:
                raise ValueError("Unsafe or oversized archive object")
            _, bucket, *parts = item.name.split("/")
            if bucket not in BUCKETS or not parts or any(p in ("", ".", "..") for p in parts):
                raise ValueError("Unexpected object path")
            if item.name in seen:
                raise ValueError("Duplicate object path")
            sha = hashlib.sha256()
            size = 0
            file = tar.extractfile(item)
            while True:
                chunk = file.read(1024 * 1024)
                if not chunk:
                    break
                sha.update(chunk)
                size += len(chunk)
                if size > OBJECT_MAX:
                    raise ValueError("Oversized object contents")
            if size != item.size:
                raise ValueError("Object size mismatch")
            seen[item.name] = (size, sha.hexdigest())

    if not manifest or manifest.get("format") != "concierge-storage-snapshot-v1":
        raise ValueError("Missing or invalid manifest")
    if manifest.get("project_ref") != "jtnyqzxlipekwtoyvcmb":
        raise ValueError("Backup belongs to a different Supabase project")
    entries = manifest.get("files")
    if not isinstance(entries, list) or len(entries) != len(seen):
        raise ValueError("Manifest object count mismatch")
    if manifest.get("object_count") != len(entries):
        raise ValueError("Manifest count metadata mismatch")
    counted = set()
    total = 0
    for entry in entries:
        name = "objects/" + str(entry["bucket"]) + "/" + str(entry["key"])
        if name in counted or name not in seen:
            raise ValueError("Missing or duplicate manifest object")
        counted.add(name)
        size, digest = seen[name]
        if size != entry["size"] or digest != entry["sha256"]:
            raise ValueError("Object SHA-256 or size mismatch")
        total += size
    if total != manifest.get("total_bytes"):
        raise ValueError("Manifest byte count mismatch")
    return len(entries), total


if __name__ == "__main__":
    try:
        count, total = verify(sys.stdin.buffer)
        print(f"VERIFIED: {count} original Storage objects and all SHA-256 hashes, {total} bytes.")
    except Exception as exc:
        print(f"VERIFY FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
