#!/usr/bin/env python3
"""Apply an ad-hoc signature with Apple's codesign, signing nested code first."""
import argparse
from pathlib import Path
import subprocess
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("bundle", type=Path)
args = parser.parse_args()
if sys.platform != "darwin":
    raise SystemExit("Native signing requires macOS.")
bundle = args.bundle.resolve()
if bundle.suffix != ".app" or not (bundle / "Contents/Info.plist").is_file():
    raise SystemExit("Provide the prepared Petal.app bundle.")
entitlements = Path(__file__).resolve().parent.parent / "desktop/entitlements.plist"
magics = {bytes.fromhex(value) for value in (
    "cffaedfe", "cefaedfe", "feedfacf", "feedface", "cafebabe", "bebafeca",
)}
signable = []
for item in bundle.rglob("*"):
    if item.is_symlink():
        continue
    if item.is_dir() and item.suffix in {".app", ".framework"}:
        signable.append(item)
    elif item.is_file():
        with item.open("rb") as reader:
            if reader.read(4) in magics:
                signable.append(item)
signable.sort(key=lambda item: len(item.parts), reverse=True)
signable.append(bundle)
for item in signable:
    command = ["codesign", "--force", "--sign", "-", "--timestamp=none"]
    if item.is_dir() and item.suffix == ".app":
        command += ["--entitlements", str(entitlements)]
    subprocess.run(command + [str(item)], check=True)
subprocess.run(["codesign", "--verify", "--deep", "--strict", "--verbose=2", str(bundle)], check=True)
print("Native ad-hoc signature verified. This is not Apple notarization.")
