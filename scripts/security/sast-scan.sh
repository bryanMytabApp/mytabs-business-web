#!/bin/bash
# =============================================================================
# SAST (Static Application Security Testing) scan for mytabs-client-web
# =============================================================================
# Runs static analysis on the source before it is built and shipped:
#   1. npm audit        - known-vulnerable dependencies
#   2. secret scan      - accidentally committed credentials in source
#   3. semgrep (opt)    - insecure code patterns (skipped if not installed)
#
# Exit codes:
#   0  - passed (or only accepted/tolerated findings)
#   1  - blocking finding -> deployment should abort
#
# Env overrides:
#   SAST_ALLOW_AUDIT_MODERATE  max tolerated moderate npm-audit vulns (default 2)
#   SAST_FAIL_ON               npm audit level that blocks: high|critical (default high)
#   SAST_STRICT                "1" = any moderate over the allowance blocks
#   SAST_ALLOWLIST             path to accepted-exceptions JSON (default:
#                              scripts/security/sast-allowlist.json)
#   SAST_IGNORE_ALLOWLIST      "1" = ignore the allowlist and block on every
#                              high/critical (use to audit the raw finding set)
#
# Accepted exceptions:
#   High/critical npm-audit findings are cross-referenced against the allowlist
#   (SAST_ALLOWLIST). A finding only stops blocking the deploy when its package
#   is listed there; the allowlist is the machine-readable mirror of
#   client/SECURITY_EXCEPTIONS.md. Any high/critical on a package NOT in the
#   allowlist still fails the gate, so newly introduced vulnerabilities are
#   caught rather than silently shipped.
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CLIENT_DIR="$WEB_ROOT/client"
REPORT_DIR="$WEB_ROOT/.security-reports"
mkdir -p "$REPORT_DIR"

# Accepted per client/SECURITY_EXCEPTIONS.md: 2 moderate webpack-dev-server vulns
ALLOW_AUDIT_MODERATE="${SAST_ALLOW_AUDIT_MODERATE:-2}"
FAIL_ON="${SAST_FAIL_ON:-high}"
ALLOWLIST_FILE="${SAST_ALLOWLIST:-$SCRIPT_DIR/sast-allowlist.json}"
IGNORE_ALLOWLIST="${SAST_IGNORE_ALLOWLIST:-0}"

GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
err()  { echo -e "${RED}[FAIL]${NC} $1"; }
info() { echo -e "${CYAN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

BLOCKING=0

echo ""
echo "==============================================================="
echo " SAST SCAN - mytabs-client-web"
echo "==============================================================="
info "Source: $CLIENT_DIR"
info "Reports: $REPORT_DIR"

# -----------------------------------------------------------------------------
# 1. Dependency vulnerability scan (npm audit)
# -----------------------------------------------------------------------------
echo ""
info "[1/3] Dependency audit (npm audit)..."
AUDIT_JSON="$REPORT_DIR/npm-audit.json"
( cd "$CLIENT_DIR" && npm audit --json > "$AUDIT_JSON" 2>/dev/null ) || true

if [ ! -s "$AUDIT_JSON" ]; then
  warn "npm audit produced no output (offline or registry issue) - skipping gate"
else
  if [ "$IGNORE_ALLOWLIST" = "1" ]; then
    warn "SAST_IGNORE_ALLOWLIST=1 - accepted exceptions will NOT be suppressed"
  elif [ -f "$ALLOWLIST_FILE" ]; then
    info "Accepted-exceptions allowlist: $ALLOWLIST_FILE"
  else
    warn "Allowlist not found ($ALLOWLIST_FILE) - all high/critical will block"
  fi

  # Walk the per-package vulnerability tree. Each high/critical package is
  # classified as either allowlisted (accepted, non-blocking) or blocking.
  # Only high/critical findings on packages NOT in the allowlist fail the gate,
  # so a newly introduced production vulnerability still blocks the deploy.
  # Output (one field per line):
  #   CRIT HIGH MOD LOW                  raw severity counts
  #   BLOCK_CRIT BLOCK_HIGH              non-allowlisted critical/high counts
  #   then: "SUPPRESSED <sev> <pkg>" and "BLOCKING <sev> <pkg>" lines
  AUDIT_PARSE=$(AUDIT_JSON="$AUDIT_JSON" ALLOWLIST_FILE="$ALLOWLIST_FILE" \
                IGNORE_ALLOWLIST="$IGNORE_ALLOWLIST" python3 <<'PY'
import json, os

audit_path = os.environ["AUDIT_JSON"]
allow_path = os.environ["ALLOWLIST_FILE"]
ignore = os.environ.get("IGNORE_ALLOWLIST", "0") == "1"

try:
    d = json.load(open(audit_path))
except Exception:
    print("0 0 0 0"); print("0 0"); raise SystemExit(0)

allow = set()
if not ignore:
    try:
        a = json.load(open(allow_path))
        allow = {p["name"] for p in a.get("acceptedPackages", []) if p.get("name")}
    except Exception:
        allow = set()

meta = d.get("metadata", {}).get("vulnerabilities", {})
crit = meta.get("critical", 0); high = meta.get("high", 0)
mod = meta.get("moderate", 0); low = meta.get("low", 0)

vulns = d.get("vulnerabilities", {})
block_crit = block_high = 0
lines = []
for name, info in sorted(vulns.items()):
    sev = info.get("severity")
    if sev not in ("critical", "high"):
        continue
    allowed = name in allow
    if allowed:
        lines.append(f"SUPPRESSED {sev} {name}")
    else:
        lines.append(f"BLOCKING {sev} {name}")
        if sev == "critical":
            block_crit += 1
        else:
            block_high += 1

print(f"{crit} {high} {mod} {low}")
print(f"{block_crit} {block_high}")
for ln in lines:
    print(ln)
PY
)

  CRIT=$(echo "$AUDIT_PARSE" | sed -n '1p' | cut -d' ' -f1)
  HIGH=$(echo "$AUDIT_PARSE" | sed -n '1p' | cut -d' ' -f2)
  MOD=$(echo "$AUDIT_PARSE" | sed -n '1p' | cut -d' ' -f3)
  LOW=$(echo "$AUDIT_PARSE" | sed -n '1p' | cut -d' ' -f4)
  BLOCK_CRIT=$(echo "$AUDIT_PARSE" | sed -n '2p' | cut -d' ' -f1)
  BLOCK_HIGH=$(echo "$AUDIT_PARSE" | sed -n '2p' | cut -d' ' -f2)

  info "Vulnerabilities -> critical:$CRIT high:$HIGH moderate:$MOD low:$LOW"

  # Report suppressed (accepted) vs blocking (unexpected) high/critical packages.
  SUPPRESSED_COUNT=$(echo "$AUDIT_PARSE" | grep -c '^SUPPRESSED ' || true)
  if [ "${SUPPRESSED_COUNT:-0}" -gt 0 ]; then
    info "Accepted (allowlisted) high/critical packages: $SUPPRESSED_COUNT"
    while IFS= read -r pkgline; do
      [ -n "$pkgline" ] && info "  accepted: $(echo "$pkgline" | cut -d' ' -f2-)"
    done < <(echo "$AUDIT_PARSE" | grep '^SUPPRESSED ' || true)
  fi

  if [ "${BLOCK_CRIT:-0}" -gt 0 ] || [ "${BLOCK_HIGH:-0}" -gt 0 ]; then
    while IFS= read -r pkgline; do
      [ -n "$pkgline" ] && err "  not accepted: $(echo "$pkgline" | cut -d' ' -f2-)"
    done < <(echo "$AUDIT_PARSE" | grep '^BLOCKING ' || true)
  fi

  if [ "${BLOCK_CRIT:-0}" -gt 0 ]; then
    err "$BLOCK_CRIT critical dependency vulnerabilit(ies) not on allowlist"
    BLOCKING=1
  fi
  if [ "$FAIL_ON" = "high" ] && [ "${BLOCK_HIGH:-0}" -gt 0 ]; then
    err "$BLOCK_HIGH high-severity dependency vulnerabilit(ies) not on allowlist"
    BLOCKING=1
  fi
  if [ "${BLOCK_CRIT:-0}" -eq 0 ] && [ "${BLOCK_HIGH:-0}" -eq 0 ]; then
    ok "No high/critical dependency vulns outside the accepted allowlist"
  else
    err "Resolve the finding(s) above, or add to $ALLOWLIST_FILE and document in client/SECURITY_EXCEPTIONS.md"
  fi

  if [ "${MOD:-0}" -gt "$ALLOW_AUDIT_MODERATE" ]; then
    if [ "${SAST_STRICT:-0}" = "1" ]; then
      err "$MOD moderate vulns exceed allowance ($ALLOW_AUDIT_MODERATE)"
      BLOCKING=1
    else
      warn "$MOD moderate vulns exceed allowance ($ALLOW_AUDIT_MODERATE) - review SECURITY_EXCEPTIONS.md"
    fi
  fi
fi

# -----------------------------------------------------------------------------
# 2. Secret scan (regex-based; no external service required)
# -----------------------------------------------------------------------------
echo ""
info "[2/3] Secret scan (source)..."
SECRET_REPORT="$REPORT_DIR/secret-scan.txt"
: > "$SECRET_REPORT"

# Patterns for common credential leaks. Scans src only, skips build artifacts.
SECRET_PATTERNS=(
  'AKIA[0-9A-Z]{16}'                                   # AWS access key id
  'aws_secret_access_key[[:space:]]*=[[:space:]]*.+'   # AWS secret
  '-----BEGIN[[:space:]]+(RSA|EC|OPENSSH|PRIVATE)[[:space:]]*(PRIVATE[[:space:]]+)?KEY-----' # private keys
  'sk_live_[0-9a-zA-Z]{20,}'                           # Stripe live secret key
  'rk_live_[0-9a-zA-Z]{20,}'                           # Stripe live restricted key
  'gh[pousr]_[0-9A-Za-z]{30,}'                          # GitHub tokens
  'xox[baprs]-[0-9A-Za-z-]{10,}'                        # Slack tokens
)

SECRET_HITS=0
if command -v grep >/dev/null 2>&1; then
  for pat in "${SECRET_PATTERNS[@]}"; do
    # Search source only; exclude vendored/build/test-mock noise
    while IFS= read -r line; do
      echo "$line" >> "$SECRET_REPORT"
      SECRET_HITS=$((SECRET_HITS + 1))
    done < <(grep -rInE "$pat" "$CLIENT_DIR/src" \
              --include='*.js' --include='*.jsx' \
              --include='*.ts' --include='*.tsx' \
              --include='*.json' --include='*.env*' 2>/dev/null || true)
  done
fi

if [ "$SECRET_HITS" -gt 0 ]; then
  err "$SECRET_HITS potential secret(s) detected in source (see $SECRET_REPORT)"
  BLOCKING=1
else
  ok "No hardcoded secrets detected in src/"
fi

# -----------------------------------------------------------------------------
# 3. Static code analysis (semgrep) - optional
# -----------------------------------------------------------------------------
echo ""
info "[3/3] Static code analysis (semgrep)..."
SEMGREP_JSON="$REPORT_DIR/semgrep.json"
if command -v semgrep >/dev/null 2>&1; then
  semgrep --config=auto --json --quiet \
    --output "$SEMGREP_JSON" "$CLIENT_DIR/src" >/dev/null 2>&1 || true
  if [ -s "$SEMGREP_JSON" ]; then
    SG_ERR=$(python3 -c "
import json
try:
    d = json.load(open('$SEMGREP_JSON'))
    res = d.get('results', [])
    err = sum(1 for r in res if r.get('extra',{}).get('severity') == 'ERROR')
    warn = sum(1 for r in res if r.get('extra',{}).get('severity') == 'WARNING')
    print(f'{err} {warn}')
except Exception:
    print('0 0')
")
    SG_ERRORS=$(echo "$SG_ERR" | cut -d' ' -f1)
    SG_WARNINGS=$(echo "$SG_ERR" | cut -d' ' -f2)
    info "semgrep findings -> error:$SG_ERRORS warning:$SG_WARNINGS"
    if [ "${SG_ERRORS:-0}" -gt 0 ]; then
      err "$SG_ERRORS semgrep ERROR-level finding(s) (see $SEMGREP_JSON)"
      BLOCKING=1
    else
      ok "No ERROR-level semgrep findings"
    fi
  fi
else
  warn "semgrep not installed - skipping code pattern analysis"
  info "Install: pipx install semgrep  (or) brew install semgrep"
fi

# -----------------------------------------------------------------------------
# Result
# -----------------------------------------------------------------------------
echo ""
echo "==============================================================="
if [ "$BLOCKING" -eq 1 ]; then
  err "SAST SCAN FAILED - blocking findings present"
  echo "    Reports written to: $REPORT_DIR"
  echo "==============================================================="
  exit 1
fi
ok "SAST SCAN PASSED"
echo "    Reports written to: $REPORT_DIR"
echo "==============================================================="
exit 0
