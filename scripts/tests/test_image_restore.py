"""Verify actual synthetic PNG *file bytes* survive age encryption and isolated restore.

This test uses disposable encryption keys, in-memory test images and a fresh
temporary restore directory. It never connects to Supabase, Google Drive or Stripe.
It is NOT a live cross-project Storage API restore certificate.
"""
from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tarfile
import tempfile
import unittest
import zlib

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import backup_storage as backup
import verify_storage_archive as verifier


def png_image(rgb: tuple[int, int, int]) -> bytes:
    """Create a valid, distinguishable 2x2 RGB PNG without third-party modules."""
    def chunk(kind: bytes, data: bytes) -> bytes:
        checksum = zlib.crc32(kind + data) & 0xffffffff
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", checksum)

    scanlines = b"".join(b"\x00" + bytes(rgb) * 2 for _ in range(2))
    header = struct.pack(">IIBBBBB", 2, 2, 8, 2, 0, 0, 0)
    return (bytes([137, 80, 78, 71, 13, 10, 26, 10])
            + chunk(b"IHDR", header)
            + chunk(b"IDAT", zlib.compress(scanlines))
            + chunk(b"IEND", b""))


class ImagesOnlyStorage:
    def __init__(self):
        self.files = {
            "concierge-sensitive": {
                "synthetic-shopper/private-test.png": png_image((41, 122, 206))
            },
            "concierge-uploads": {
                "synthetic-retailer/public-test.png": png_image((231, 84, 33))
            },
        }

    def list_keys(self, bucket):
        return list(self.files[bucket])

    def download(self, bucket, key):
        return self.files[bucket][key]


class IsolatedImageRecoveryTests(unittest.TestCase):
    def test_two_real_png_files_restore_with_exact_sha256(self):
        age = shutil.which("age")
        keygen = shutil.which("age-keygen")
        self.assertIsNotNone(age, "Real age CLI is required")
        self.assertIsNotNone(keygen, "Real age-keygen is required")
        storage = ImagesOnlyStorage()
        with tempfile.TemporaryDirectory(prefix="concierge-isolated-recovery-") as td:
            root = Path(td)
            identity = root / "disposable-identity.txt"
            subprocess.run([keygen, "-o", str(identity)], check=True, capture_output=True)
            recipient = subprocess.run(
                [keygen, "-y", str(identity)],
                check=True, capture_output=True, text=True,
            ).stdout.strip()
            encrypted = root / "synthetic-image-backup.tar.gz.age"
            metrics = backup.build_archive(storage, recipient, encrypted, encoder=age)
            self.assertEqual(metrics["objects"], 2)
            ciphertext = encrypted.read_bytes()
            for bucket in storage.files:
                for data in storage.files[bucket].values():
                    self.assertNotIn(data, ciphertext)

            plaintext = subprocess.run(
                [age, "--decrypt", "--identity", str(identity), str(encrypted)],
                check=True, capture_output=True,
            ).stdout
            verified_count, verified_size = verifier.verify(io.BytesIO(plaintext))
            self.assertEqual(verified_count, 2)
            self.assertEqual(verified_size, metrics["bytes"])

            # Restore to a NEW, isolated filesystem path, never the live Storage API.
            restored_root = root / "recovery-target"
            restored_root.mkdir(mode=0o700)
            with tarfile.open(fileobj=io.BytesIO(plaintext), mode="r:gz") as archive:
                manifest = json.load(archive.extractfile("manifest.json"))
                self.assertEqual(manifest["object_count"], 2)
                for entry in manifest["files"]:
                    bucket = entry["bucket"]
                    key = backup.validate_key(entry["key"])
                    self.assertIn(bucket, backup.BUCKETS)
                    member = archive.extractfile("objects/" + bucket + "/" + key)
                    self.assertIsNotNone(member)
                    restored_bytes = member.read()
                    dest = restored_root / bucket / key
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    with dest.open("xb") as fp:
                        fp.write(restored_bytes)
                    self.assertEqual(dest.read_bytes(), storage.files[bucket][key])
                    self.assertEqual(len(restored_bytes), entry["size"])
                    self.assertEqual(hashlib.sha256(restored_bytes).hexdigest(), entry["sha256"])
                    self.assertTrue(restored_bytes.startswith(bytes([137, 80, 78, 71, 13, 10, 26, 10])))
            self.assertEqual(
                len(list(restored_root.rglob("*.png"))), 2,
                "Both independent image files must exist in the isolated target",
            )


if __name__ == "__main__":
    unittest.main()
