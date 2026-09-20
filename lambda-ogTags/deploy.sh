#!/bin/bash
# Deploy the Open Graph Lambda@Edge for keeptabs.app.
#
# WHAT THIS DOES
#   1. Creates (or updates) the Lambda function `mytabs-og-tags-edge` in us-east-1.
#   2. Publishes a numbered version (Lambda@Edge cannot use $LATEST).
#   3. Prints the versioned ARN. The CloudFront association is intentionally a
#      SEPARATE, reviewed step handled by associate-cloudfront.sh (viewer-request
#      on the /e/* and /o/* behaviors) so the code deploy and the distribution
#      change are decoupled and each can be reviewed.
#
# REQUIREMENTS (Lambda@Edge specifics)
#   - Region MUST be us-east-1.
#   - Execution role trust policy MUST allow lambda.amazonaws.com AND
#     edgelambda.amazonaws.com.
#   - No env vars (Lambda@Edge forbids them); everything is hardcoded/public.
#
# USAGE
#   ./deploy.sh                 # create/update + publish a new version (no CF change)
#   ./deploy.sh --rollback      # remove the OG /e/* and /o/* behaviors from CloudFront
#
# To make a published version LIVE, use the dedicated, reviewed script:
#   ./associate-cloudfront.sh <version>     (viewer-request; see that file)
#
set -euo pipefail

REGION="us-east-1"
FN_NAME="mytabs-og-tags-edge"
ROLE_NAME="mytabs-og-tags-edge-role"
CLOUDFRONT_ID="E1WB9UQAAX3TCW"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STATE_FILE="$SCRIPT_DIR/.deploy-state.json"

GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }
info() { echo -e "${CYAN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# ── Rollback: remove the OG /e/* and /o/* behaviors from CloudFront ──────────
# For this (viewer-request) design the behaviors were created fresh by
# associate-cloudfront.sh, so rolling back means removing them entirely — which
# returns /e/* and /o/* to being served by the DefaultCacheBehavior (the exact
# pre-fix state).
if [ "${1:-}" == "--rollback" ]; then
  warn "Removing the OG /e/* and /o/* cache behaviors from CloudFront $CLOUDFRONT_ID."
  TMP_CFG=$(mktemp); TMP_PATCH=$(mktemp)
  trap 'rm -f "$TMP_CFG" "$TMP_PATCH"' EXIT
  aws cloudfront get-distribution-config --id "$CLOUDFRONT_ID" --region "$REGION" --output json > "$TMP_CFG"
  ETAG=$(python3 -c "import json;print(json.load(open('$TMP_CFG'))['ETag'])")

  python3 - "$TMP_CFG" "$TMP_PATCH" <<'PY'
import json, sys
d = json.load(open(sys.argv[1])); cfg = d["DistributionConfig"]
cb = cfg.get("CacheBehaviors", {"Quantity": 0, "Items": []})
items = [b for b in (cb.get("Items", []) or []) if b.get("PathPattern") not in ("/e/*", "/o/*")]
cfg["CacheBehaviors"] = {"Quantity": len(items), "Items": items}
json.dump(cfg, open(sys.argv[2], "w"))
print("Behaviors after rollback:", [b.get("PathPattern") for b in items] or "(none)")
PY

  aws cloudfront update-distribution --id "$CLOUDFRONT_ID" --region "$REGION" \
    --distribution-config "file://$TMP_PATCH" --if-match "$ETAG" --output json > /dev/null
  ok "Rollback submitted. CloudFront is redeploying (~5-15 min)."
  exit 0
fi

# ── Create/update the function and publish a version ─────────────────────────
info "Packaging function..."
ZIP="$SCRIPT_DIR/function.zip"
rm -f "$ZIP"
( cd "$SCRIPT_DIR" && zip -q "$ZIP" index.js )
ok "Packaged index.js"

ACCOUNT=$(aws sts get-caller-identity --query Account --output text --region "$REGION")
ROLE_ARN="arn:aws:iam::${ACCOUNT}:role/${ROLE_NAME}"

# Ensure the execution role exists with the Lambda@Edge trust policy.
if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  info "Creating execution role $ROLE_NAME (trusts lambda + edgelambda)..."
  TRUST=$(mktemp)
  cat > "$TRUST" <<'JSON'
{ "Version": "2012-10-17", "Statement": [
  { "Effect": "Allow",
    "Principal": { "Service": ["lambda.amazonaws.com", "edgelambda.amazonaws.com"] },
    "Action": "sts:AssumeRole" } ] }
JSON
  aws iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document "file://$TRUST" --output json > /dev/null
  aws iam attach-role-policy --role-name "$ROLE_NAME" \
    --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" > /dev/null
  rm -f "$TRUST"
  info "Waiting for role to propagate..."; sleep 12
  ok "Role created: $ROLE_ARN"
else
  ok "Role exists: $ROLE_ARN"
fi

if aws lambda get-function --function-name "$FN_NAME" --region "$REGION" >/dev/null 2>&1; then
  info "Updating function code..."
  aws lambda update-function-code --function-name "$FN_NAME" --region "$REGION" \
    --zip-file "fileb://$ZIP" --output json > /dev/null
  aws lambda wait function-updated --function-name "$FN_NAME" --region "$REGION"
else
  info "Creating function..."
  aws lambda create-function --function-name "$FN_NAME" --region "$REGION" \
    --runtime nodejs18.x --handler index.handler --role "$ROLE_ARN" \
    --timeout 5 --memory-size 128 --zip-file "fileb://$ZIP" --output json > /dev/null
  aws lambda wait function-active --function-name "$FN_NAME" --region "$REGION"
fi
ok "Function code deployed"

info "Publishing a numbered version..."
VERSION=$(aws lambda publish-version --function-name "$FN_NAME" --region "$REGION" \
  --query 'Version' --output text)
FN_ARN="arn:aws:lambda:${REGION}:${ACCOUNT}:function:${FN_NAME}:${VERSION}"
ok "Published version $VERSION"
echo ""
echo -e "${GREEN}===================================================================${NC}"
ok "CODE DEPLOYED. Versioned ARN:"
echo "  $FN_ARN"
echo ""
info "To make it live on CloudFront (SEPARATE, reviewed step):"
echo "  ./associate-cloudfront.sh $VERSION"
echo -e "${GREEN}===================================================================${NC}"
