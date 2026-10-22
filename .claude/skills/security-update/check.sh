#!/usr/bin/env bash
# Read-only security check for the IPAM app: Node base image, npm packages,
# the published image (Trivy) and the other images/actions around it.
# Nothing is installed on the host; npm and Trivy run in containers.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
IMAGE="ghcr.io/owt30818/ipm:latest"
TRIVY="aquasec/trivy:0.75.0"
CACHE="${TRIVY_CACHE:-${TMPDIR:-/tmp}/ipm-trivy-cache}"
cd "$REPO" || exit 1

section() { printf '\n== %s ==\n' "$1"; }

# --- 1. Node.js -------------------------------------------------------------
section "Node.js (Dockerfile)"
PINNED=$(grep -m1 -oE '^FROM node:[^ ]+' Dockerfile | cut -d: -f2)
CUR=$(echo "$PINNED" | grep -oE '^[0-9]+\.[0-9]+\.[0-9]+')
MAJOR=${CUR%%.*}
echo "pinned: node:$PINNED"
curl -fsS https://nodejs.org/dist/index.json | python3 -c '
import sys, json
cur, major = sys.argv[1], sys.argv[2]
key = lambda v: tuple(int(x) for x in v.lstrip("v").split("."))
rel = [r for r in json.load(sys.stdin) if r["version"].startswith("v%s." % major)]
newer = [r for r in rel if key(r["version"]) > key(cur)]
if not newer:
    print("latest %s.x: v%s (up to date)" % (major, cur))
for r in sorted(newer, key=lambda r: key(r["version"])):
    print("newer: %s  %s  %s" % (r["version"], r["date"], "SECURITY" if r["security"] else ""))
lts = [r for r in rel if r["lts"]]
if lts: print("line: %s LTS \"%s\"" % (major, lts[0]["lts"]))
' "$CUR" "$MAJOR" || echo "could not read nodejs.org/dist/index.json"
echo "EOL schedule: https://github.com/nodejs/Release#release-schedule"
echo "advisories:   https://nodejs.org/en/blog/vulnerability/"

# --- 2. npm -----------------------------------------------------------------
section "npm audit / outdated (package-lock.json)"
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$REPO":/src:ro "node:$PINNED" sh -c '
cp /src/package.json /src/package-lock.json /tmp && cd /tmp
npm audit --package-lock-only --json 2>/dev/null > all.json
npm audit --package-lock-only --omit=dev --json 2>/dev/null > prod.json
node -e "
const all = require(\"/tmp/all.json\"), prod = require(\"/tmp/prod.json\");
const m = all.metadata.vulnerabilities, p = prod.metadata.vulnerabilities;
console.log(\"all:  \" + m.total + \" (critical \" + m.critical + \", high \" + m.high + \", moderate \" + m.moderate + \", low \" + m.low + \")\");
console.log(\"deps: \" + p.total + \" (critical \" + p.critical + \", high \" + p.high + \", moderate \" + p.moderate + \", low \" + p.low + \")\");
for (const [name, v] of Object.entries(all.vulnerabilities)) {
  const ids = v.via.filter(x => typeof x === \"object\").map(x => x.url.split(\"/\").pop());
  const fix = v.fixAvailable === true ? \"npm audit fix\"
    : v.fixAvailable ? v.fixAvailable.name + \"@\" + v.fixAvailable.version + (v.fixAvailable.isSemVerMajor ? \" (MAJOR)\" : \"\")
    : \"no fix\";
  console.log(\"  \" + v.severity.padEnd(9) + name.padEnd(28) + (prod.vulnerabilities[name] ? \"deps \" : \"dev  \") + fix + (ids.length ? \"  \" + ids.join(\" \") : \"\"));
}"
echo
npm outdated --package-lock-only --json 2>/dev/null > outdated.json
node -e "
const lock = require(\"/tmp/package-lock.json\").packages, out = require(\"/tmp/outdated.json\");
const rows = Object.entries(out).map(([n, o]) => [n, lock[\"node_modules/\" + n]?.version, o.wanted, o.latest])
  .filter(([, cur, w, l]) => cur !== w || w !== l);
console.log(\"outdated (locked -> in range / latest; latest is often a major):\");
for (const [n, cur, w, l] of rows)
  console.log(\"  \" + n.padEnd(30) + String(cur).padEnd(10) + (cur !== w ? \"-> \" + w : \"   \" + \" \".repeat(w.length)).padEnd(14) + (w !== l ? \"latest \" + l : \"\"));
if (!rows.length) console.log(\"  none\");"
' 2>&1 | grep -v '^npm notice'

# --- 3. Published image -----------------------------------------------------
section "Trivy: $IMAGE (HIGH/CRITICAL, fixable)"
mkdir -p "$CACHE"
docker run --rm -u "$(id -u):$(id -g)" -v "$CACHE":/cache "$TRIVY" --cache-dir /cache \
  image --quiet --image-src remote --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed \
  --format json "$IMAGE" 2>/dev/null | python3 -c '
import sys, json
d = json.load(sys.stdin)
os_ = d.get("Metadata", {}).get("OS", {})
print("os: %s %s" % (os_.get("Family"), os_.get("Name")))
found = 0
for r in d.get("Results", []):
    for v in r.get("Vulnerabilities") or []:
        found += 1
        path = v.get("PkgPath") or r["Target"]
        where = "image npm" if "lib/node_modules/npm/" in path else "app" if path.startswith("app/") else "os" if r.get("Class") == "os-pkgs" else path
        print("  %-9s %-10s %-24s %-10s -> %-14s %s" % (v["Severity"], where, v["PkgName"], v["InstalledVersion"],
              v.get("FixedVersion", "")[:14], v["VulnerabilityID"]))
if not found: print("  none")
' || echo "Trivy scan failed (image not pullable or Trivy DB download failed)"

# --- 4. Around the app ------------------------------------------------------
section "Other images and actions (check release notes by hand)"
for f in truenas-compose.yml "$HOME/ipam-db-backup/docker-compose.yml" "$HOME/ipam-db-backup/compose.yml"; do
  [ -f "$f" ] && grep -hoE 'image:\s*\S+' "$f" | sed "s|image:\s*|  $(basename "$(dirname "$f")")/$(basename "$f"): |"
done
grep -hoE 'uses:\s*\S+' .github/workflows/*.yml | sed 's/uses:\s*/  action: /' | sort -u
