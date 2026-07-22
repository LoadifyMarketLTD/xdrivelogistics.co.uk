#!/usr/bin/env python3
"""Build an isolated, deterministic migration set for clean staging bootstrap.

The production migration directory is never modified. Files are copied into a
temporary Supabase project with unique timestamp versions. A leading UTF-8 BOM
is removed only from the temporary copy so historical migrations can be replayed
safely without changing production history.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

EXCLUDED_MIGRATIONS = {
    "068_targeted_data_repair_current_accounts.sql": (
        "Production-data repair tied to named XDrive accounts and duplicate-company consolidation"
    ),
    "20260721221000_reconcile_confirmed_current_accounts.sql": (
        "Environment-specific reconciliation tied to confirmed live account identities that are intentionally absent from disposable staging"
    ),
}

VERSION_RE = re.compile(r"^(?P<version>\d+?)_(?P<name>.+\.sql)$")
BASE_TIMESTAMP = datetime(2000, 1, 1, tzinfo=timezone.utc)
UTF8_BOM = b"\xef\xbb\xbf"


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--destination", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source = args.source.resolve()
    destination = args.destination.resolve()
    manifest_path = args.manifest.resolve()

    if not source.is_dir():
        raise SystemExit(f"Migration source directory does not exist: {source}")

    migration_files = sorted(source.glob("*.sql"), key=lambda path: path.name)
    if not migration_files:
        raise SystemExit(f"No SQL migrations found in {source}")

    unknown_exclusions = EXCLUDED_MIGRATIONS.keys() - {path.name for path in migration_files}
    if unknown_exclusions:
        raise SystemExit(
            "Expected excluded migration(s) missing from source: "
            + ", ".join(sorted(unknown_exclusions))
        )

    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True, exist_ok=True)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)

    entries: list[dict[str, object]] = []
    excluded: list[dict[str, str]] = []
    staged_versions: set[str] = set()
    bom_normalized: list[str] = []

    sequence = 0
    for source_path in migration_files:
        match = VERSION_RE.match(source_path.name)
        if not match:
            raise SystemExit(f"Unexpected migration filename format: {source_path.name}")

        source_bytes = source_path.read_bytes()
        source_hash = sha256_bytes(source_bytes)

        if source_path.name in EXCLUDED_MIGRATIONS:
            excluded.append(
                {
                    "source": source_path.name,
                    "reason": EXCLUDED_MIGRATIONS[source_path.name],
                    "sha256": source_hash,
                }
            )
            continue

        staged_version = (BASE_TIMESTAMP + timedelta(seconds=sequence)).strftime("%Y%m%d%H%M%S")
        sequence += 1
        if staged_version in staged_versions:
            raise SystemExit(f"Generated duplicate staging version: {staged_version}")
        staged_versions.add(staged_version)

        destination_name = f"{staged_version}_{source_path.name}"
        destination_path = destination / destination_name

        had_bom = source_bytes.startswith(UTF8_BOM)
        staged_bytes = source_bytes[len(UTF8_BOM) :] if had_bom else source_bytes
        destination_path.write_bytes(staged_bytes)

        if destination_path.read_bytes().startswith(UTF8_BOM):
            raise SystemExit(f"UTF-8 BOM remains in prepared migration: {source_path.name}")

        staged_hash = sha256(destination_path)
        if had_bom:
            bom_normalized.append(source_path.name)

        entries.append(
            {
                "order": len(entries) + 1,
                "source": source_path.name,
                "source_version": match.group("version"),
                "staged": destination_name,
                "staged_version": staged_version,
                "source_sha256": source_hash,
                "staged_sha256": staged_hash,
                "bom_stripped": had_bom,
            }
        )

    manifest = {
        "schema": 2,
        "source_directory": str(source),
        "destination_directory": str(destination),
        "included_count": len(entries),
        "excluded_count": len(excluded),
        "excluded": excluded,
        "bom_normalized_count": len(bom_normalized),
        "bom_normalized": bom_normalized,
        "migrations": entries,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print(f"Prepared {len(entries)} migrations for isolated staging bootstrap validation.")
    for item in excluded:
        print(f"Excluded {item['source']}: {item['reason']}")
    if bom_normalized:
        print("Normalized UTF-8 BOM in temporary copies:")
        for name in bom_normalized:
            print(f"- {name}")
    else:
        print("No UTF-8 BOM normalization was required.")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
