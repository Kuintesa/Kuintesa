#!/usr/bin/env python3
"""Create and validate a real HFS+ / compressed UDIF image on Linux.

Usage: python3 tools/create-dmg.py TOOL_DIR STAGING OUTPUT.dmg

TOOL_DIR must contain newfs_hfs, hfsplus, and dmg. Tool sources:
  newfs_hfs: Apple's diskdev_cmds, Linux port (hfsprogs 540.1.linux3),
    https://deb.debian.org/debian/pool/main/h/hfsprogs/
  hfsplus/dmg: https://github.com/planetbeing/libdmg-hfsplus
    tested at 7ac55ec64c96f7800d9818ce64c79670e7f02b67 (GPL-3.0).

The old addall importer follows symlinks and loses executable permissions.
Import each entry explicitly instead, preserving framework links and whether
files are executable. Permissions are normalized to readable 0644/0755 so a
mounted installer never depends on the build machine's owner IDs.

Validation decompresses the resulting UDIF, compares its entire raw image,
then checks catalog entries, sizes, permissions, and each regular file's hash.
Symbolic links are checked for catalog type and encoded target length; their
bytes are also covered by the whole-image roundtrip checksum. Mounting and
running the app on macOS remain separate checks requiring an actual Mac.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit(__doc__.split("\n\n")[1])
    tool_dir, staging, output = map(lambda value: Path(value).resolve(), sys.argv[1:])
    if not staging.is_dir():
        raise SystemExit(f"Staging directory does not exist: {staging}")
    if output.suffix.lower() != ".dmg" or output.is_relative_to(staging):
        raise SystemExit("Output must be a .dmg file outside the staging directory.")
    tools = {name: tool_dir / name for name in ("newfs_hfs", "hfsplus", "dmg")}
    for name, path in tools.items():
        if not path.is_file() or not os.access(path, os.X_OK):
            raise SystemExit(f"Missing executable tool: {name} ({path})")

    def command(name: str, *args: object) -> str:
        result = subprocess.run(
            [str(tools[name]), *map(str, args)], capture_output=True, text=True
        )
        text = result.stdout + result.stderr
        # Several legacy CLI error paths mistakenly return zero; inspect their
        # explicit error messages as well as preserving genuine nonzero exits.
        if result.returncode or re.search(
            r"(?im)^error:|^no such file or directory|^not enough arguments", text
        ):
            raise RuntimeError(f"{name} {args}: exit {result.returncode}\n{text}")
        return result.stdout

    entries = []

    def collect(directory: Path, prefix: str = "") -> None:
        for source in sorted(directory.iterdir()):
            destination = f"{prefix}/{source.name}"
            mode = source.lstat().st_mode
            if stat.S_ISLNK(mode):
                target = os.readlink(source)
                entries.append((source, destination, "link", 0, len(os.fsencode(target))))
            elif stat.S_ISDIR(mode):
                entries.append((source, destination, "directory", 0o755, 0))
                collect(source, destination)
            elif stat.S_ISREG(mode):
                permission = 0o755 if mode & 0o111 else 0o644
                entries.append((source, destination, "file", permission, source.stat().st_size))
            else:
                raise RuntimeError(f"Unsupported filesystem entry: {source}")

    collect(staging)
    if not entries:
        raise SystemExit("The staging directory is empty.")
    output.parent.mkdir(parents=True, exist_ok=True)
    total_bytes = sum(entry[4] for entry in entries)
    mib = 1024 * 1024
    # Allocate filesystem metadata and 25% spare capacity, rounding up to 16 MiB.
    image_bytes = max(64 * mib, math.ceil((total_bytes * 1.25 + 32 * mib) / (16 * mib)) * 16 * mib)
    if shutil.disk_usage(output.parent).free < 3 * image_bytes:
        raise SystemExit("Insufficient disk space for image creation and roundtrip validation.")

    with tempfile.TemporaryDirectory(prefix=".petal-dmg-", dir=output.parent) as temp:
        work = Path(temp)
        image = work / "Petal.hfs"
        with image.open("wb") as stream:
            stream.truncate(image_bytes)
        command("newfs_hfs", "-v", "Petal", image)
        for source, destination, kind, permission, _ in entries:
            if kind == "link":
                command("hfsplus", image, "symlink", destination, os.readlink(source))
            elif kind == "directory":
                command("hfsplus", image, "mkdir", destination)
                command("hfsplus", image, "chmod", f"{permission:o}", destination)
            else:
                command("hfsplus", image, "add", source, destination)
                command("hfsplus", image, "chmod", f"{permission:o}", destination)

        candidate = work / "Petal.dmg"
        command("dmg", "dmg", image, candidate)
        with candidate.open("rb") as stream:
            stream.seek(-512, 2)
            if stream.read(4) != b"koly":
                raise RuntimeError("Output is missing the Apple UDIF trailer.")
        roundtrip = work / "roundtrip.hfs"
        command("dmg", "iso", candidate, roundtrip)
        raw_hash = digest(image)
        if digest(roundtrip) != raw_hash:
            raise RuntimeError("DMG decompression did not reproduce the original filesystem image.")

        # Catalog listings inspect links themselves, rather than following them.
        listings = {}
        listing_pattern = re.compile(
            r"^([0-7]{6})\s+\d+\s+\d+\s+(\d+)\s+\d+/\s*\d+/\d+\s+\d+:\d+\s(.+)$",
            re.MULTILINE,
        )
        for _, destination, _, _, _ in entries:
            parent = str(Path(destination).parent)
            if parent not in listings:
                listing = command("hfsplus", roundtrip, "ls", parent)
                listings[parent] = {
                    match[3]: (int(match[1], 8), int(match[2]))
                    for match in listing_pattern.finditer(listing)
                }
        extracted = work / "verify-file"
        verified_files = 0
        for source, destination, kind, permission, size in entries:
            parent = str(Path(destination).parent)
            record = listings[parent].get(Path(destination).name)
            if not record:
                raise RuntimeError(f"Missing HFS+ catalog entry: {destination}")
            mode, stored_size = record
            expected_type = {"file": stat.S_IFREG, "directory": stat.S_IFDIR, "link": stat.S_IFLNK}[kind]
            if stat.S_IFMT(mode) != expected_type:
                raise RuntimeError(f"Wrong filesystem type: {destination}")
            if kind != "link" and stat.S_IMODE(mode) != permission:
                raise RuntimeError(f"Incorrect permissions: {destination}")
            if kind != "directory" and stored_size != size:
                raise RuntimeError(f"Incorrect file or symlink size: {destination}")
            if kind == "file":
                extracted.unlink(missing_ok=True)
                command("hfsplus", roundtrip, "extract", destination, extracted)
                if not extracted.is_file() or digest(extracted) != digest(source):
                    raise RuntimeError(f"Content checksum mismatch: {destination}")
                verified_files += 1

        os.replace(candidate, output)
    checksum = digest(output)
    output.with_suffix(output.suffix + ".sha256").write_text(
        f"{checksum}  {output.name}\n", encoding="utf-8"
    )
    report = {
        "format": "Apple UDIF, compressed HFS+",
        "output": output.name,
        "bytes": output.stat().st_size,
        "sha256": checksum,
        "raw_image_sha256": raw_hash,
        "verified_files": verified_files,
        "verified_directories": sum(entry[2] == "directory" for entry in entries),
        "verified_symlinks": sum(entry[2] == "link" for entry in entries),
        "roundtrip_image_identical": True,
        "macos_mount_and_launch_tested": False,
    }
    output.with_suffix(output.suffix + ".validation.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
