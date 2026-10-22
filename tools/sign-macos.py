#!/usr/bin/env python3
"""Apply a development ad-hoc signature using rcodesign 0.29.0.

Usage: python3 tools/sign-macos.py /path/to/rcodesign /path/to/Petal.app
This does not create an Apple Developer ID signature or notarization ticket.
"""
import argparse
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("rcodesign", type=Path)
parser.add_argument("bundle", type=Path)
args = parser.parse_args()
bundle = args.bundle.resolve()
if bundle.suffix != ".app" or not (bundle / "Contents/Info.plist").is_file():
    raise SystemExit("Provide the prepared Petal.app bundle.")
entitlements = Path(__file__).resolve().parent.parent / "desktop/entitlements.plist"
command = [str(args.rcodesign.resolve()), "sign", "--entitlements-xml-file", str(entitlements)]
for helper in sorted(bundle.rglob("*.app")):
    if not helper.is_symlink():
        command.extend(["--entitlements-xml-file", f"{helper.relative_to(bundle)}:{entitlements}"])
command.append(str(bundle))
subprocess.run(command, check=True)
subprocess.run([
    "python3", str(Path(__file__).with_name("verify-macos.py")), str(bundle)
], check=True)
print("Signed with a development ad-hoc signature; Apple notarization remains separate.")
