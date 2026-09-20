#!/bin/bash
# Create /e/* and /o/* CloudFront cache behaviors that run the OG Lambda@Edge
# (mytabs-og-tags-edge:<version>) on VIEWER-REQUEST.
#
# WHY VIEWER-REQUEST (not origin-response)
#   keeptabs.app/e/* is served via CloudFront Custom Error Responses
#   (S3 404 -> /index.html, 200). origin-response Lambda@Edge does NOT run on
#   custom-error-page responses, so it never fired. A viewer-request function
#   runs before the origin and returns its own response for crawlers.
#
# CACHING
#   The function returns its own response for crawlers and passes humans through
#   untouched. To keep a crawler response from being cached and later served to
#   a human (or vice versa) we key these two behaviors on User-Agent. This is
#   scoped to /e/* and /o/* only, so the rest of the site's cache is untouched.
#
# IDEMPOTENT: re-running reuses the cache policy and replaces the behaviors.
#
# USAGE
#   ./associate-cloudfront.sh <lambda-version>     # e.g. ./associate-cloudfront.sh 1
#   ./associate-cloudfront.sh --dry-run <version>  # print the patched config, change nothing
#
set -euo pipefail

REGION="us-east-1"
CLOUDFRONT_ID="E1WB9UQAAX3TCW"
FN_NAME="mytabs-og-tags-edge"
POLICY_NAME="og-tags-ua-cache"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STATE_FILE="$SCRIPT_DIR/.deploy-state.json"

GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok(){ echo -e "${GREEN}[OK]${NC} $1"; }; info(){ echo -e "${CYAN}[INFO]${NC} $1"; }; err(){ echo -e "${RED}[ERROR]${NC} $1"; }

DRY_RUN=false
if [ "${1:-}" == "--dry-run" ]; then DRY_RUN=true; shift; fi
VERSION="${1:-}"
[ -z "$VERSION" ] && { err "Usage: ./associate-cloudfront.sh [--dry-run] <lambda-version>"; exit 1; }

ACCOUNT=$(aws sts get-caller-identity --query Account --output text --region "$REGION")
FN_ARN="arn:aws:lambda:${REGION}:${ACCOUNT}:function:${FN_NAME}:${VERSION}"
info "Lambda@Edge ARN: $FN_ARN"

# ── 1. Ensure the User-Agent cache policy exists; capture its Id ─────────────
POLICY_ID=$(aws cloudfront list-cache-policies --type custom --region "$REGION" --output json \
  | python3 -c "import sys,json; 
items=json.load(sys.stdin).get('CachePolicyList',{}).get('Items',[]) or []
print(next((i['CachePolicy']['Id'] for i in items if i['CachePolicy']['CachePolicyConfig']['Name']=='$POLICY_NAME'),''))")

if [ -z "$POLICY_ID" ]; then
  info "Creating cache policy '$POLICY_NAME' (keys on User-Agent, gzip+brotli on)..."
  POLICY_CFG=$(mktemp)
  cat > "$POLICY_CFG" <<'JSON'
{
  "Name": "og-tags-ua-cache",
  "Comment": "Keys /e/* and /o/* on User-Agent so crawler OG HTML and human SPA shell cache separately.",
  "DefaultTTL": 300, "MaxTTL": 3600, "MinTTL": 0,
  "ParametersInCacheKeyAndForwardedToOrigin": {
    "EnableAcceptEncodingGzip": true,
    "EnableAcceptEncodingBrotli": true,
    "HeadersConfig": { "HeaderBehavior": "whitelist", "Headers": { "Quantity": 1, "Items": ["User-Agent"] } },
    "CookiesConfig": { "CookieBehavior": "none" },
    "QueryStringsConfig": { "QueryStringBehavior": "none" }
  }
}
JSON
  if [ "$DRY_RUN" == "true" ]; then
    info "[dry-run] would create cache policy from:"; cat "$POLICY_CFG"; POLICY_ID="<new-policy-id>"
  else
    POLICY_ID=$(aws cloudfront create-cache-policy --cache-policy-config "file://$POLICY_CFG" \
      --region "$REGION" --query 'CachePolicy.Id' --output text)
    ok "Created cache policy: $POLICY_ID"
  fi
  rm -f "$POLICY_CFG"
else
  ok "Reusing cache policy '$POLICY_NAME': $POLICY_ID"
fi

# ── 2. Patch the distribution: add/replace /e/* and /o/* behaviors ───────────
TMP_CFG=$(mktemp); TMP_PATCH=$(mktemp)
trap 'rm -f "$TMP_CFG" "$TMP_PATCH"' EXIT
aws cloudfront get-distribution-config --id "$CLOUDFRONT_ID" --region "$REGION" --output json > "$TMP_CFG"
ETAG=$(python3 -c "import json;print(json.load(open('$TMP_CFG'))['ETag'])")

FN_ARN="$FN_ARN" POLICY_ID="$POLICY_ID" python3 - "$TMP_CFG" "$TMP_PATCH" "$STATE_FILE" <<'PY'
import json, os, sys
cfg_path, patch_path, state_path = sys.argv[1], sys.argv[2], sys.argv[3]
arn, policy_id = os.environ["FN_ARN"], os.environ["POLICY_ID"]
d = json.load(open(cfg_path)); cfg = d["DistributionConfig"]
dc = cfg["DefaultCacheBehavior"]
origin = dc["TargetOriginId"]

def behavior(path):
    return {
        "PathPattern": path,
        "TargetOriginId": origin,
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {"Quantity": 2, "Items": ["HEAD", "GET"],
                            "CachedMethods": {"Quantity": 2, "Items": ["HEAD", "GET"]}},
        "Compress": True,
        "SmoothStreaming": False,
        "FieldLevelEncryptionId": "",
        "CachePolicyId": policy_id,
        "LambdaFunctionAssociations": {"Quantity": 1, "Items": [
            {"LambdaFunctionARN": arn, "EventType": "viewer-request", "IncludeBody": False}]},
        "FunctionAssociations": {"Quantity": 0},
        "TrustedSigners": {"Enabled": False, "Quantity": 0},
        "TrustedKeyGroups": {"Enabled": False, "Quantity": 0},
    }

cb = cfg.get("CacheBehaviors", {"Quantity": 0, "Items": []})
items = [b for b in (cb.get("Items", []) or []) if b.get("PathPattern") not in ("/e/*", "/o/*")]
# Record prior association state for rollback (empty here since none existed).
prev = {b["PathPattern"]: b for b in (cb.get("Items", []) or []) if b.get("PathPattern") in ("/e/*", "/o/*")}
items = [behavior("/e/*"), behavior("/o/*")] + items
cfg["CacheBehaviors"] = {"Quantity": len(items), "Items": items}

json.dump(cfg, open(patch_path, "w"))
json.dump({"created_behaviors": ["/e/*", "/o/*"], "associated": arn,
           "cache_policy": policy_id, "prior": list(prev.keys())}, open(state_path, "w"), indent=2)
print("Patched: /e/* and /o/* -> policy %s + %s (viewer-request)" % (policy_id, arn))
PY

if [ "$DRY_RUN" == "true" ]; then
  info "[dry-run] Patched DistributionConfig for /e/* and /o/* (NOT applied):"
  python3 -c "import json; c=json.load(open('$TMP_PATCH')); print(json.dumps([b for b in c['CacheBehaviors']['Items'] if b['PathPattern'] in ('/e/*','/o/*')], indent=2))"
  info "[dry-run] Nothing was changed. ETag would be: $ETAG"
  exit 0
fi

info "Applying to CloudFront (ETag $ETAG)..."
aws cloudfront update-distribution --id "$CLOUDFRONT_ID" --region "$REGION" \
  --distribution-config "file://$TMP_PATCH" --if-match "$ETAG" --output json > /dev/null
ok "Applied. CloudFront is deploying (~5-15 min)."
echo ""
info "Verify when deployed:"
echo "  curl -A 'facebookexternalhit/1.1' https://keeptabs.app/e/<code> | grep -o 'og:[a-z]*'   # should list og tags"
echo "  curl -A 'Mozilla/5.0 (iPhone)'   https://keeptabs.app/e/<code> | grep -c 'og:'          # should be 0"
info "Rollback: ./deploy.sh --rollback   (removes the /e/* and /o/* behaviors, returning them to the default behavior)"
