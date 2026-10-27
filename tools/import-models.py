#!/usr/bin/env python3
"""Install already-exported GLB models in the dashboard's private library.

Usage:
  python3 tools/import-models.py --source ~/exports --dest ~/coa-server/assets/models

Input files MUST be valid .glb models named after numeric CoA item display IDs.
Archives (.MPQ), original models (.M2), and BLP textures are not GLB files.
"""
import argparse
import os
from pathlib import Path
import shutil
import struct

def valid_glb(path):
    with path.open("rb") as fh:
        h = fh.read(12)
    return len(h) == 12 and h[:4] == b"glTF" and struct.unpack("<I", h[4:8])[0] == 2 and struct.unpack("<I", h[8:12])[0] == path.stat().st_size

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", type=Path, required=True)
    p.add_argument("--dest", type=Path, required=True)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    if not args.source.is_dir():
        p.error("source must be an existing directory of exported GLB files")
    if args.source.resolve() == args.dest.resolve():
        p.error("source and destination must be different")
    items = sorted(args.source.rglob("*.glb"))
    good = bad = 0
    for source in items:
        if not source.stem.isdecimal() or int(source.stem) <= 0 or int(source.stem) > 4294967295 or not valid_glb(source):
            print("SKIP (invalid name or GLB header):", source)
            bad += 1
            continue
        target = args.dest / (str(int(source.stem)) + ".glb")
        if not args.dry_run:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
        good += 1
        print(("CHECK" if args.dry_run else "IMPORTED"), source.name)
    print(f"{good} models {'validated' if args.dry_run else 'imported'}, {bad} skipped.")
    if not items:
        print("No GLB files found. Export client models to GLB first.")

if __name__ == "__main__":
    main()
