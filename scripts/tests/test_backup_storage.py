"""Offline safety tests for the Phase One encrypted backup builder (no secrets or network)."""
import io
import json
import shutil
import subprocess
import os
from pathlib import Path
import stat
import sys
import tarfile
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import backup_storage as backup
import verify_storage_archive as verifier


class SyntheticStorage:
    files = {
        "concierge-sensitive": {"owner-1/private.jpg": b"private-photo-bits"},
        "concierge-uploads": {"owner-2/public.jpg": b"public-photo-bits"},
    }

    def list_keys(self, bucket):
        return list(self.files[bucket])

    def download(self, bucket, key):
        return self.files[bucket][key]


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.encoder = self.root / "fake-age"
        self.encoder.write_text(
            "#!/usr/bin/env python3\n"
            "import sys\n"
            "from pathlib import Path\n"
            "dest = Path(sys.argv[sys.argv.index('-o') + 1])\n"
            "dest.write_bytes(b'age-encryption.org/v1\\n' + sys.stdin.buffer.read())\n"
        )
        self.encoder.chmod(self.encoder.stat().st_mode | stat.S_IXUSR)
        self.out = self.root / "test.tar.gz.age"

    def test_archive_contains_both_buckets_and_sha256_manifest(self):
        stats = backup.build_archive(
            SyntheticStorage(), "age1testpublickey", self.out, encoder=str(self.encoder)
        )
        self.assertEqual(stats["objects"], 2)
        self.assertTrue(self.out.read_bytes().startswith(b"age-encryption.org/v1\n"))
        with tarfile.open(fileobj=io.BytesIO(self.out.read_bytes()[len(b"age-encryption.org/v1\n"):]), mode="r:gz") as archive:
            items = archive.getnames()
            self.assertEqual(len(items), 3)
            self.assertIn("objects/concierge-sensitive/owner-1/private.jpg", items)
            self.assertIn("objects/concierge-uploads/owner-2/public.jpg", items)
            manifest = json.load(archive.extractfile("manifest.json"))
            self.assertEqual(manifest["object_count"], 2)
            self.assertEqual(manifest["total_bytes"], len(b"private-photo-bits") + len(b"public-photo-bits"))
            for item in manifest["files"]:
                data = archive.extractfile(f"objects/{item['bucket']}/{item['key']}").read()
                self.assertEqual(item["sha256"], __import__("hashlib").sha256(data).hexdigest())
        count, total = verifier.verify(io.BytesIO(self.out.read_bytes()[len(b"age-encryption.org/v1\n"):]))
        self.assertEqual(count, 2)
        self.assertEqual(total, stats["bytes"])

    def test_real_age_encryption_and_decryption_recovery(self):
        # This test uses newly generated, disposable keys and synthetic bytes only.
        # Unlike the fake encoder tests, it proves the REAL age ciphertext decrypts
        # into a valid archive whose independent SHA-256 verifier passes.
        age = shutil.which("age")
        keygen = shutil.which("age-keygen")
        self.assertIsNotNone(age, "Install age for real backup recovery CI")
        self.assertIsNotNone(keygen, "Install age-keygen for real backup recovery CI")
        identity = self.root / "disposable-test-identity.txt"
        subprocess.run([keygen, "-o", str(identity)], check=True, capture_output=True)
        recipient = subprocess.run(
            [keygen, "-y", str(identity)],
            check=True, capture_output=True, text=True,
        ).stdout.strip()
        result = backup.build_archive(
            SyntheticStorage(), recipient, self.out, encoder=age,
        )
        ciphertext = self.out.read_bytes()
        self.assertTrue(ciphertext.startswith(b"age-encryption.org/v1"))
        self.assertNotIn(b"private-photo-bits", ciphertext)
        self.assertNotIn(b"public-photo-bits", ciphertext)

        recovered = subprocess.run(
            [age, "--decrypt", "--identity", str(identity), str(self.out)],
            check=True, capture_output=True,
        ).stdout
        self.assertTrue(recovered.startswith(b"\\x1f\\x8b"))
        count, total = verifier.verify(io.BytesIO(recovered))
        self.assertEqual(count, 2)
        self.assertEqual(total, result["bytes"])

        # Wrong independently generated identity must not decrypt the archive.
        wrong_identity = self.root / "wrong-identity.txt"
        subprocess.run([keygen, "-o", str(wrong_identity)], check=True, capture_output=True)
        wrong = subprocess.run(
            [age, "--decrypt", "--identity", str(wrong_identity), str(self.out)],
            capture_output=True,
        )
        self.assertNotEqual(wrong.returncode, 0)
        self.assertEqual(wrong.stdout, b"")

    def test_invalid_public_key_cannot_produce_an_archive(self):
        with self.assertRaisesRegex(ValueError, "public recipient"):
            backup.build_archive(SyntheticStorage(), "AGE-SECRET-KEY-1secret", self.out, encoder=str(self.encoder))
        self.assertFalse(self.out.exists())

    def test_refuses_to_overwrite_previous_snapshot(self):
        self.out.write_bytes(b"KEEP")
        with self.assertRaises(FileExistsError):
            backup.build_archive(SyntheticStorage(), "age1testpublickey", self.out, encoder=str(self.encoder))
        self.assertEqual(self.out.read_bytes(), b"KEEP")

    def test_excess_total_bytes_fails_closed_and_removes_partial(self):
        old = backup.MAX_TOTAL_BYTES
        try:
            backup.MAX_TOTAL_BYTES = 1
            with self.assertRaisesRegex(RuntimeError, "safety cap"):
                backup.build_archive(SyntheticStorage(), "age1testpublickey", self.out, encoder=str(self.encoder))
            self.assertFalse(self.out.exists())
        finally:
            backup.MAX_TOTAL_BYTES = old

    def test_disallows_unsafe_path_names(self):
        for path in ("/root.jpg", "../x", "foo/../bar", "foo//x", "foo/./bar", ""):
            with self.subTest(path=path):
                with self.assertRaises(ValueError):
                    backup.validate_key(path)

    def test_rejects_legacy_and_browser_keys_for_backup_access(self):
        production = f"https://{backup.EXPECTED_REF}.supabase.co"
        for key in ("eyJhbGciOiJIUzI1NiJ9", "sb_publishable_public123", ""):
            with self.subTest(key=key[:5]):
                with self.assertRaisesRegex(ValueError, "approved production"):
                    backup.StorageReader(production, key)
        admin = backup.StorageReader(production, "sb_secret_test_only")
        self.assertEqual(admin.key, "sb_secret_test_only")

    def test_storage_client_cannot_point_at_wrong_project(self):
        with self.assertRaisesRegex(ValueError, "approved production"):
            backup.StorageReader("https://wrong.supabase.co", "fake-secret")
        with self.assertRaisesRegex(ValueError, "approved production"):
            backup.StorageReader(f"https://{backup.EXPECTED_REF}.supabase.co", "")


if __name__ == "__main__":
    unittest.main()
