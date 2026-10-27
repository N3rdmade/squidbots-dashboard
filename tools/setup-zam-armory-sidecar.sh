#!/usr/bin/env bash
# Sidecar test: the upstream AzerothCore Armory provides its actual 3D model viewer.
# Does not modify worldserver, authserver, or SquidBots.
set -euo pipefail
ROOT="${HOME}/coa-server/tools/azerothcore-armory-zam"
CREDS="${HOME}/.config/coa/mysql.cnf"
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "Node.js and npm are required on the server. Not changing system packages."; exit 2
fi
if [ ! -r "$CREDS" ]; then echo "Missing private mysql credentials: $CREDS"; exit 2; fi
if [ ! -d "$ROOT/.git" ]; then
  git clone --depth 1 https://github.com/r-o-b-o-t-o/azerothcore-armory.git "$ROOT"
fi
cd "$ROOT"
python3 - "$CREDS" "$ROOT/config.json" <<'PY'
import configparser, json, os, pathlib, sys
cfg = configparser.ConfigParser(interpolation=None)
cfg.read(sys.argv[1])
c = cfg["client"] if cfg.has_section("client") else cfg["mysql"]
host=c.get("host", "127.0.0.1")
user=c.get("user")
password=c.get("password")
port=int(c.get("port", "3306"))
if not user or password is None:
    raise SystemExit("MySQL credentials file needs user and password; not writing config.")
data={
  "aowowUrl":"https://wowgaming.altervista.org/aowow",
  "websiteUrl":"http://localhost:48733",
  "websiteName":"CoA Armory (test)",
  "websiteRoot":"",
  "iframeMode":{"enabled":False,"url":"http://localhost:48733"},
  "loadDbcs":True,"hideGameMasters":False,"transmogModule":False,
  "useZamCdn":True,
  "realms":[{"name":"CoA","realmId":1,"authDatabase":"acore_auth",
    "charactersDatabase":{"host":host,"port":port,"user":user,"password":password,"database":"acore_characters"}}],
  "worldDatabase":{"host":host,"port":port,"user":user,"password":password,"database":"acore_world"},
  "dbQueryTimeout":10000
}
out=pathlib.Path(sys.argv[2])
fd=os.open(str(out),os.O_CREAT|os.O_WRONLY|os.O_TRUNC,0o600)
with os.fdopen(fd,"w") as f: json.dump(data,f,indent=2)
out.chmod(0o600)
print("Private runtime configuration created; no credentials committed to GitHub.")
PY
npm ci
npm run build
echo "=== Testing viewer data ==="
echo "The upstream armory requires its DBC/model data bundle (npm run fetchdata)."
echo "If CDN metadata is unavailable, see upstream issue #51 before attempting large downloads."
echo "To fetch bundle manually: cd '$ROOT' && npm run fetchdata"
echo "To launch test: cd '$ROOT' && npm start"
echo "Use Windows SSH port forwarding: ssh -N -L 48733:127.0.0.1:48733 hellhorde@192.168.1.134"
