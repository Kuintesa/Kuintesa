#!/usr/bin/env python3
"""Prepare Petal.app from the checksum-verified official Apple Silicon runtime.

Build on Linux or macOS. The final bundle must be signed after this script runs.
No Apple Developer credentials are embedded or required for an ad-hoc signature.
"""
import argparse
import hashlib
from pathlib import Path
import plistlib
import shutil
import stat
import zipfile

VERSION = "45.0.0"
ARCHIVE = f"electron-v{VERSION}-darwin-arm64.zip"
SHA256 = "896c3a50b148e89a158dca08a6996a022ddf39b23aac871e107f5b4087f8caa9"
ROOT = Path(__file__).resolve().parent.parent


def extract_runtime(archive, destination):
    with zipfile.ZipFile(archive) as source:
        for entry in source.infolist():
            target = destination / entry.filename
            # Never let an archive escape the staging directory.
            if not target.resolve().is_relative_to(destination.resolve()):
                raise ValueError(f"Unsafe archive path: {entry.filename}")
            mode = entry.external_attr >> 16
            if entry.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            elif stat.S_ISLNK(mode):
                target.parent.mkdir(parents=True, exist_ok=True)
                target.symlink_to(source.read(entry).decode())
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with source.open(entry) as reader, target.open("wb") as writer:
                    shutil.copyfileobj(reader, writer)
                if mode:
                    target.chmod(stat.S_IMODE(mode))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("staging", type=Path)
    args = parser.parse_args()
    digest = hashlib.file_digest(args.archive.open("rb"), "sha256").hexdigest()
    if digest != SHA256:
        raise SystemExit(f"Checksum mismatch for {ARCHIVE}; refusing to use it.")
    args.staging.mkdir(parents=True, exist_ok=True)
    bundle = args.staging / "Petal.app"
    if bundle.exists() or (args.staging / "Electron.app").exists():
        raise SystemExit("Staging already has an application; use an empty staging directory.")
    extract_runtime(args.archive, args.staging)
    (args.staging / "Electron.app").rename(bundle)
    resources = bundle / "Contents" / "Resources"
    licenses = resources / "licenses"
    licenses.mkdir(exist_ok=True)
    for name in ["LICENSE", "LICENSES.chromium.html", "version"]:
        if (args.staging / name).is_file():
            shutil.move(str(args.staging / name), str(licenses / name))
    (resources / "default_app.asar").unlink(missing_ok=True)
    application = resources / "app"
    shutil.copytree(ROOT / "desktop", application)
    web = application / "web"
    web.mkdir()
    for name in ["index.html", "styles.css", "calculator.js", "app.js"]:
        shutil.copy2(ROOT / name, web / name)
    plist_path = bundle / "Contents" / "Info.plist"
    with plist_path.open("rb") as reader:
        info = plistlib.load(reader)
    info.update({
        "CFBundleName": "Petal",
        "CFBundleDisplayName": "Petal",
        "CFBundleIdentifier": "app.petal.calculator",
        "CFBundleShortVersionString": "1.0.0",
        "CFBundleVersion": "1.0.0",
        "CFBundleIconFile": "petal.icns",
        "LSApplicationCategoryType": "public.app-category.utilities",
        "NSHumanReadableCopyright": "Petal · Pequeñas cosas, bien hechas.",
    })
    # Do not advertise Electron's default URL protocol or document associations.
    for key in ["CFBundleURLTypes", "CFBundleDocumentTypes"]:
        info.pop(key, None)
    with plist_path.open("wb") as writer:
        plistlib.dump(info, writer)
    shutil.copy2(ROOT / "desktop" / "petal.icns", resources / "petal.icns")
    (args.staging / "Applications").symlink_to("/Applications")
    shutil.copy2(ROOT / "desktop" / "Instalar Petal.txt", args.staging / "Instalar Petal.txt")
    print(f"Prepared {bundle}; sign the bundle before creating the disk image.")


if __name__ == "__main__":
    main()
