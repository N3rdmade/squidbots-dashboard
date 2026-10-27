#!/usr/bin/env python3
"""Download official WotLK viewer assets to a private directory, without committing game assets.

The upstream project distributes its assets separately:
https://github.com/WarhoopAll/wotlk-model-viewer/releases/tag/data
Only archive formats ZIP and TAR can be extracted automatically.
"""
from pathlib import Path
from urllib.request import Request, urlopen
import argparse, json, shutil, tempfile, zipfile, tarfile, os

URL="https://api.github.com/repos/WarhoopAll/wotlk-model-viewer/releases/tags/data"
def fetch(url):
    with urlopen(Request(url,headers={"User-Agent":"squidbots-coa-model-viewer",
                                      "Accept":"application/vnd.github+json"}),timeout=90) as r:
        return r.read()

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--dest",type=Path,default=Path.home()/"coa-server/assets/wotlk-model-data")
    p.add_argument("--list",action="store_true",help="Only list release download assets")
    args=p.parse_args()
    release=json.loads(fetch(URL))
    assets=release.get("assets",[])
    print("Upstream assets:")
    for asset in assets: print(" -",asset["name"],asset["size"]//1048576,"MiB")
    if args.list:return
    archives=[a for a in assets if a["name"].lower().endswith((".zip",".tar.gz",".tgz",".tar"))]
    if not archives: raise SystemExit("No automatically extractable asset archive in upstream release.")
    dest=args.dest.expanduser().resolve()
    dest.mkdir(parents=True,exist_ok=True)
    for asset in archives:
        name=asset["name"]
        print("Downloading",name,flush=True)
        with tempfile.TemporaryDirectory() as td:
            local=Path(td)/name
            with urlopen(Request(asset["browser_download_url"],headers={"User-Agent":"squidbots-coa-model-viewer"}),timeout=120) as r,local.open("wb") as out:
                shutil.copyfileobj(r,out)
            def safe(member):
                target=(dest/member).resolve()
                if not target.is_relative_to(dest):raise RuntimeError("Unsafe asset archive path")
            if zipfile.is_zipfile(local):
                with zipfile.ZipFile(local) as z:
                    for info in z.infolist():
                        safe(info.filename)
                        if info.is_dir():continue
                        if (info.external_attr >> 16) & 0o170000 == 0o120000:raise RuntimeError("Symlinks disallowed")
                    z.extractall(dest)
            elif tarfile.is_tarfile(local):
                with tarfile.open(local) as t:
                    for info in t.getmembers():
                        safe(info.name)
                        if not (info.isfile() or info.isdir()):raise RuntimeError("Unsafe tar member")
                    t.extractall(dest,filter="data")
    print("Extracted to",dest)
    print("Required viewer script:",dest/"viewer/viewer.min.js")
    if not (dest/"viewer/viewer.min.js").is_file():
        print("WARNING: viewer.min.js not at expected path. Check actual release directory layout.")
if __name__=="__main__":main()
