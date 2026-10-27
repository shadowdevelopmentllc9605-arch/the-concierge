#!/usr/bin/env python3
"""Encrypt a read-only PostgreSQL logical backup without writing plaintext to disk.

Requires DATABASE_BACKUP_URL (dedicated least-privilege backup role) and AGE_RECIPIENT.
Never put a private age identity or production password in source control.
"""
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

EXPECTED_HOSTS = {"db.jtnyqzxlipekwtoyvcmb.supabase.co", "aws-1-us-west-2.pooler.supabase.com"}

def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: backup_database.py OUTPUT.age")
    target = Path(sys.argv[1])
    if target.exists():
        raise SystemExit("Refusing to overwrite an existing backup")
    url = os.environ.get("DATABASE_BACKUP_URL", "")
    recipient = os.environ.get("AGE_RECIPIENT", "")
    parsed = urlparse(url)
    if (parsed.scheme not in ("postgres", "postgresql") or parsed.hostname not in EXPECTED_HOSTS
            or parsed.port not in (None, 5432) or parsed.path != "/postgres"
            or not parsed.username or not parsed.password or parsed.fragment):
        raise SystemExit("DATABASE_BACKUP_URL must use the approved production database endpoint")
    if parsed.hostname.endswith(".pooler.supabase.com"):
        if not parsed.username.endswith(".jtnyqzxlipekwtoyvcmb"):
            raise SystemExit("Pooler username must target the approved production project")
    elif parsed.username.endswith(".jtnyqzxlipekwtoyvcmb"):
        raise SystemExit("Pooler username is invalid for the direct database endpoint")
    if not recipient.startswith("age1") or any(c.isspace() for c in recipient):
        raise SystemExit("AGE_RECIPIENT must be a public age recipient")
    target.parent.mkdir(parents=True, exist_ok=True)
    # -Fc includes schema and data, supports pg_restore, and is not a Storage backup.
    # A read-only role must be configured separately; this script never writes to Postgres.
    dump = subprocess.Popen(["pg_dump", "--dbname", url, "--format=custom", "--no-owner",
                             "--no-acl", "--file=-"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        encrypt = subprocess.Popen(["age", "-r", recipient, "-o", str(target)],
                                   stdin=dump.stdout, stderr=subprocess.PIPE)
        dump.stdout.close()
        _, encrypt_error = encrypt.communicate()
        _, dump_error = dump.communicate()
        if dump.returncode or encrypt.returncode or not target.exists() or target.stat().st_size < 100:
            raise RuntimeError("Database dump/encryption failed; no backup was published")
        with target.open("rb") as stream:
            if not stream.read(25).startswith(b"age-encryption.org/v1"):
                raise RuntimeError("Encrypted database archive header invalid")
        print("Encrypted PostgreSQL logical backup created; isolated restore verification still required.")
    except BaseException:
        target.unlink(missing_ok=True)
        raise

if __name__ == "__main__":
    main()
