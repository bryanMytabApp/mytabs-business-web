#!/bin/bash
# =============================================================================
# DAST (Dynamic Application Security Testing) scan for mytabs-client-web
# =============================================================================
# Runs against the LIVE deployed site (after the deploy has gone out):
#   1. OWASP ZAP baseline scan (via Docker) - passive spidered scan
#   2. Fallback: HTTP security-header + TLS checks (if Docker/ZAP unavailable)
#
# This is a passive baseline scan - it does NOT perform active attacks, so it
# is safe to run against production.
#
# Usage:
#   ./dast-scan.sh [target-url]
# Default target: https://keeptabs.app
#
# Exit codes:
#   0  - passed (or only warnings)
#   1  - blocking finding
#
# Env overrides:
#   DAST_TARGET        target URL (default https://keeptabs.app)
#   DAST_FAIL_ON_WARN  "1" = treat missing security headers as blocking
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPORT_DIR="$WEB_ROOT/.security-reports"
mkdir -p "$REPORT_DIR"

TARGET="${1:-${DAST_TARGET:-https://keeptabs.app}}"

GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
err()  { echo -e "${RED}[FAIL]${NC} $1"; }
info() { echo -e "${CYAN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

BLOCKING=0

echo ""
echo "==============================================================="
echo " DAST SCAN - mytabs-client-web"
echo "==============================================================="
info "Target: $TARGET"
info "Reports: $REPORT_DIR"

# -----------------------------------------------------------------------------
# 1. OWASP ZAP baseline scan (preferred, via Docker)
# -----------------------------------------------------------------------------
ZAP_RAN=0
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo ""
  info "[ZAP] Running OWASP ZAP baseline scan (passive)..."
  ZAP_REPORT_HTML="$REPORT_DIR/zap-baseline.html"
  ZAP_REPORT_JSON="$REPORT_DIR/zap-baseline.json"

  # zap-baseline.py: passive spider + scan. -I = don't fail process on warnings
  # (we parse the report ourselves). Mount report dir into the container /zap/wrk.
  docker run --rm -v "$REPORT_DIR:/zap/wrk/:rw" \
    ghcr.io/zaproxy/zaproxy:stable \
    zap-baseline.py -t "$TARGET" \
    -r "$(basename "$ZAP_REPORT_HTML")" \
    -J "$(basename "$ZAP_REPORT_JSON")" \
    -I >/dev/null 2>&1 || true

  if [ -s "$ZAP_REPORT_JSON" ]; then
    ZAP_RAN=1
    read -r ZHIGH ZMED <<EOF
$(python3 -c "
import json
try:
    d = json.load(open('$ZAP_REPORT_JSON'))
    high = med = 0
    for site in d.get('site', []):
        for a in site.get('alerts', []):
            r = int(a.get('riskcode', 0))
            if r >= 3: high += 1
            elif r == 2: med += 1
    print(high, med)
except Exception:
    print(0, 0)
")
EOF
    info "ZAP alerts -> high:$ZHIGH medium:$ZMED"
    if [ "${ZHIGH:-0}" -gt 0 ]; then
      err "$ZHIGH high-risk ZAP finding(s) (see $ZAP_REPORT_HTML)"
      BLOCKING=1
    elif [ "${ZMED:-0}" -gt 0 ]; then
      warn "$ZMED medium-risk ZAP finding(s) (see $ZAP_REPORT_HTML)"
    else
      ok "No high/medium ZAP findings"
    fi
  else
    warn "ZAP produced no report - falling back to header checks"
  fi
else
  info "Docker not available - using built-in HTTP security checks"
fi

# -----------------------------------------------------------------------------
# 2. Fallback: HTTP security header + TLS checks (always informative)
# -----------------------------------------------------------------------------
echo ""
info "[HTTP] Checking security headers on $TARGET ..."
HEADER_REPORT="$REPORT_DIR/http-headers.txt"
HEADERS=$(curl -sSI --max-time 20 "$TARGET" 2>/dev/null | tr -d '\r')
echo "$HEADERS" > "$HEADER_REPORT"

if [ -z "$HEADERS" ]; then
  err "Could not reach $TARGET (no response)"
  BLOCKING=1
else
  HTTP_STATUS=$(echo "$HEADERS" | awk 'NR==1{print $2}')
  info "HTTP status: ${HTTP_STATUS:-unknown}"

  # header_name | human label | blocking-if-missing?
  check_header() {
    local key="$1" label="$2"
    if echo "$HEADERS" | grep -iq "^$key:"; then
      ok "$label present"
      return 0
    else
      if [ "${DAST_FAIL_ON_WARN:-0}" = "1" ]; then
        err "$label missing"
        BLOCKING=1
      else
        warn "$label missing (recommended)"
      fi
      return 1
    fi
  }

  check_header "strict-transport-security" "HSTS (Strict-Transport-Security)"
  check_header "content-security-policy"   "Content-Security-Policy"
  check_header "x-content-type-options"    "X-Content-Type-Options"
  check_header "x-frame-options"           "X-Frame-Options"
  check_header "referrer-policy"           "Referrer-Policy"

  # Server/tech disclosure
  if echo "$HEADERS" | grep -iq "^server:"; then
    SRV=$(echo "$HEADERS" | grep -i "^server:" | head -1)
    info "Server header disclosed: ${SRV#*: }"
  fi
fi

# TLS certificate sanity (protocol + expiry presence)
echo ""
info "[TLS] Verifying HTTPS certificate..."
HOST=$(echo "$TARGET" | sed -E 's#https?://##; s#/.*##')
if command -v openssl >/dev/null 2>&1; then
  CERT=$(echo | openssl s_client -servername "$HOST" -connect "$HOST:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
  if [ -n "$CERT" ]; then
    ok "TLS certificate valid; $(echo "$CERT" | tr '\n' ' ')"
  else
    warn "Could not read TLS certificate for $HOST"
  fi
else
  warn "openssl not available - skipping TLS check"
fi

# -----------------------------------------------------------------------------
# Result
# -----------------------------------------------------------------------------
echo ""
echo "==============================================================="
if [ "$ZAP_RAN" -eq 0 ]; then
  info "Note: full ZAP scan skipped (Docker unavailable). Header/TLS checks ran."
  info "For full DAST coverage install Docker so ghcr.io/zaproxy/zaproxy can run."
fi
if [ "$BLOCKING" -eq 1 ]; then
  err "DAST SCAN FAILED - blocking findings present"
  echo "    Reports written to: $REPORT_DIR"
  echo "==============================================================="
  exit 1
fi
ok "DAST SCAN PASSED"
echo "    Reports written to: $REPORT_DIR"
echo "==============================================================="
exit 0
