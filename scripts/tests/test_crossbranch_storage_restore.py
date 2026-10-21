"""Offline dry tests for branch-only Storage API recovery; never contact Supabase."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from restore_test_storage_branches import (
    BUCKET_PUBLIC, EXPECTED_BYTES, recover, safe_path,
)


def image(size):
    return bytes([255, 216]) + bytes(size - 2)


class MockBranch:
    def __init__(self, populated=False):
        self.files = {bucket: {} for bucket in BUCKET_PUBLIC}
        self.config = {bucket: {"public": pub} for bucket, pub in BUCKET_PUBLIC.items()}
        self.uploads = 0
        if populated:
            for bucket, size in EXPECTED_BYTES.items():
                self.files[bucket]["synthetic-owner/" + bucket + ".jpg"] = image(size)

    def bucket_config(self, bucket):
        return self.config[bucket]

    def list_keys(self, bucket):
        return sorted(self.files[bucket])

    def download(self, bucket, key):
        return self.files[bucket][key]

    def upload(self, bucket, key, data):
        if key in self.files[bucket]:
            raise RuntimeError("Refusing overwrite")
        self.uploads += 1
        self.files[bucket][key] = data


class IsolatedStorageRecoveryTests(unittest.TestCase):
    def test_two_objects_restore_with_exact_content_and_counts(self):
        source, target = MockBranch(True), MockBranch()
        expected = {bucket: dict(source.files[bucket]) for bucket in BUCKET_PUBLIC}
        count, total = recover(source, target)
        self.assertEqual(count, 2)
        self.assertEqual(total, sum(EXPECTED_BYTES.values()))
        self.assertEqual(target.uploads, 2)
        self.assertEqual(target.files, expected)
        self.assertEqual(source.files, expected)
        self.assertEqual(source.uploads, 0)

    def test_nonempty_target_fails_before_writing(self):
        source, target = MockBranch(True), MockBranch()
        target.files["concierge-uploads"]["different-file.jpg"] = b"occupied"
        with self.assertRaisesRegex(RuntimeError, "not empty"):
            recover(source, target)
        self.assertEqual(target.uploads, 0)

    def test_bucket_privacy_mismatch_blocks_restore(self):
        source, target = MockBranch(True), MockBranch()
        target.config["concierge-sensitive"] = {"public": True}
        with self.assertRaisesRegex(RuntimeError, "privacy"):
            recover(source, target)
        self.assertEqual(target.uploads, 0)

    def test_changed_source_bytes_fail_closed(self):
        source, target = MockBranch(True), MockBranch()
        source.files["concierge-sensitive"]["synthetic-owner/concierge-sensitive.jpg"] = image(100)
        with self.assertRaisesRegex(RuntimeError, "Unexpected source"):
            recover(source, target)
        self.assertEqual(target.uploads, 0)

    def test_unsafe_keys_are_rejected(self):
        for key in ["", "/absolute", "x/../y", "x//y", "x/./y", "x\\y"]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                safe_path(key)


if __name__ == "__main__":
    unittest.main()
