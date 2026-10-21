#!/usr/bin/env python3
"""One-time fail-closed recovery of TWO synthetic test JPEGs between Supabase branches.

SOURCE project: phase1-e2e-20261016 (never written)
TARGET project: phase1-storage-restore-isolated-20261021 (only destination written)

Only run with separate, dedicated branch-specific sb_secret_ credentials inside
the protected, manual-only GitHub Actions environment. This is a Storage API
byte recovery test, not a Postgres database restore or a user-session RLS test.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

SOURCE_REF = "cbqxcbvjezehxowarkoq"
TARGET_REF = "eszpxvgsmsjptagoyxzu"
BUCKET_PUBLIC = {"concierge-sensitive": False, "concierge-uploads": True}
EXPECTED_BYTES = {"concierge-sensitive": 3220962, "concierge-uploads": 2405178}
MAX_SINGLE = 8 * 1024 * 1024
MAX_TOTAL = 12 * 1024 * 1024
PAGE_SIZE = 1000


def safe_path(key):
    if not isinstance(key, str) or not key or key.startswith("/") or "\\" in key or "\x00" in key:
        raise ValueError("Unsafe Storage object key")
    if any(part in ("", ".", "..") for part in key.split("/")):
        raise ValueError("Unsafe Storage path segment")
    return key


class StorageAPI:
    def __init__(self, project_ref, secret):
        if project_ref not in (SOURCE_REF, TARGET_REF):
            raise ValueError("Unapproved Supabase project")
        if not secret or not secret.startswith("sb_secret_"):
            raise ValueError("Branch-specific privileged key was not configured")
        self.base = "https://" + project_ref + ".supabase.co/storage/v1/"
        self.secret = secret

    def request(self, method, path, body=None, mime=None):
        headers = {"apikey": self.secret}
        if mime:
            headers["Content-Type"] = mime
        req = urllib.request.Request(
            self.base + path, data=body, headers=headers, method=method
        )
        try:
            with urllib.request.urlopen(req, timeout=70) as response:
                data = response.read(MAX_SINGLE + 1)
                if len(data) > MAX_SINGLE:
                    raise RuntimeError("Object or API response exceeds allowed byte cap")
                return data
        except urllib.error.HTTPError as exc:
            # Never print response bodies: they may contain object identifiers.
            raise RuntimeError("Storage request returned HTTP " + str(exc.code)) from None

    def bucket_config(self, bucket):
        data = self.request("GET", "bucket/" + urllib.parse.quote(bucket, safe=""))
        return json.loads(data)

    def list_keys(self, bucket):
        prefixes, visited, keys = [""], set(), []
        while prefixes:
            prefix = prefixes.pop()
            if prefix in visited:
                continue
            visited.add(prefix)
            offset = 0
            while True:
                payload = json.dumps({
                    "prefix": prefix, "limit": PAGE_SIZE, "offset": offset,
                    "sortBy": {"column": "name", "order": "asc"}
                }).encode()
                path = "object/list/" + urllib.parse.quote(bucket, safe="")
                page = json.loads(self.request("POST", path, payload, "application/json"))
                if not isinstance(page, list):
                    raise RuntimeError("Invalid Storage listing")
                for item in page:
                    key = safe_path(prefix + item.get("name", ""))
                    if item.get("id") is None and item.get("metadata") is None:
                        prefixes.append(key + "/")
                    else:
                        keys.append(key)
                    if len(keys) > 4:
                        raise RuntimeError("Too many objects; recovery is limited to synthetic tests")
                if len(page) < PAGE_SIZE:
                    break
                offset += len(page)
        if len(set(keys)) != len(keys):
            raise RuntimeError("Duplicate object listing")
        return sorted(keys)

    def download(self, bucket, key):
        path = "object/" + urllib.parse.quote(bucket, safe="") + "/" + urllib.parse.quote(safe_path(key), safe="/")
        return self.request("GET", path)

    def upload(self, bucket, key, data):
        # No upsert/overwrite. The target must be empty before any uploads.
        path = "object/" + urllib.parse.quote(bucket, safe="") + "/" + urllib.parse.quote(safe_path(key), safe="/")
        return self.request("POST", path, data, "image/jpeg")


def recover(source, target):
    if source is target:
        raise ValueError("Source and target must be separate")
    records = []
    for bucket, is_public in BUCKET_PUBLIC.items():
        conf = target.bucket_config(bucket)
        if conf.get("public") is not is_public:
            raise RuntimeError("Recovery bucket privacy setting mismatch")
        if target.list_keys(bucket):
            raise RuntimeError("Recovery target is not empty; refusing to overwrite")
        keys = source.list_keys(bucket)
        if len(keys) != 1:
            raise RuntimeError("Source does not contain exactly one synthetic test image per bucket")
        key = keys[0]
        original = source.download(bucket, key)
        if (len(original) != EXPECTED_BYTES[bucket]
                or len(original) > MAX_SINGLE
                or original[:2] != bytes([255, 216])):
            raise RuntimeError("Unexpected source test-image size or type")
        records.append((bucket, key, original, hashlib.sha256(original).hexdigest()))
    if sum(len(item[2]) for item in records) > MAX_TOTAL:
        raise RuntimeError("Total test size cap exceeded")

    for bucket, key, data, digest in records:
        target.upload(bucket, key, data)
        recovered = target.download(bucket, key)
        if len(recovered) != len(data) or hashlib.sha256(recovered).hexdigest() != digest:
            raise RuntimeError("Restored object checksum mismatch")
    for bucket, _, _, _ in records:
        if len(target.list_keys(bucket)) != 1:
            raise RuntimeError("Recovered object inventory does not match")
    return len(records), sum(len(rec[2]) for rec in records)


def main():
    src_key = os.environ.get("PHASE1_SOURCE_BRANCH_SECRET", "")
    target_key = os.environ.get("PHASE1_RECOVERY_BRANCH_SECRET", "")
    if not src_key or not target_key or src_key == target_key:
        raise RuntimeError("Two different protected branch-specific keys are required")
    src = StorageAPI(SOURCE_REF, src_key)
    dst = StorageAPI(TARGET_REF, target_key)
    count, size = recover(src, dst)
    print(f"PASS: {count} isolated Storage objects restored with matching SHA-256 hashes; {size} bytes.")
    print("Source was read-only; target branch was modified; user-account RLS and image rendering remain separate gates.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("RECOVERY FAIL: " + str(exc), file=sys.stderr)
        sys.exit(1)
