#!/bin/bash
# Restart a raffle: remove the winner + selection details and reopen it to Draft.
#
# What this does (for the target raffle experience):
#   1. Resets every winning entry back to a valid entry (status=valid, drops wonAt).
#   2. Deletes the DRAWING# selection/audit record (seed, winners, shuffled list).
#   3. Reopens the ExperienceInstances record to Draft:
#        state      -> Draft
#        drawState  -> OPEN   (required, or the lifecycle guard blocks reopen)
#        activeDrawId / lastDrawId -> null
#        removes the _startLogged / _endLogged window flags
#
# Safe by default: runs a DRY RUN and prints the planned changes. Pass --apply
# to actually write. Nothing is deleted or mutated without --apply.
#
# Usage:
#   ./restart-raffle.sh                 # dry run against the default raffle
#   ./restart-raffle.sh --apply         # perform the reset
#   ./restart-raffle.sh --apply --yes   # perform the reset, skip the prompt
#   ENV=uat ./restart-raffle.sh --apply # target a different table suffix
#
# Requires: awscli v2, python3 (both already used by other scripts in this repo).

set -euo pipefail

# ── Target raffle ────────────────────────────────────────────────────────────
# ENG-SSSL-7F3Z
EXPERIENCE_ID="47230858-55ce-4ed9-b7cb-7c7197e09633"
EVENT_ID="256884f6-96c0-4cd9-aa47-ec6ea0fda4d4"
RAFFLE_CODE="ENG-SSSL-7F3Z"

# ── Environment / config ─────────────────────────────────────────────────────
AWS_REGION="${AWS_REGION:-us-east-1}"
ENV="${ENV:-dev}"
INSTANCES_TABLE="ExperienceInstances_${ENV}"
PARTICIPATIONS_TABLE="Participations_${ENV}"

EXPERIENCE_PK="EXPERIENCE#${EXPERIENCE_ID}"
INSTANCE_PK="EVENT#${EVENT_ID}"
INSTANCE_SK="INSTANCE#${EXPERIENCE_ID}"

# ── Flags ────────────────────────────────────────────────────────────────────
APPLY=false
ASSUME_YES=false
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=true ;;
    --yes|-y) ASSUME_YES=true ;;
    -h|--help)
      sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

# ── Colors / logging ─────────────────────────────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'
YELLOW='\033[1;33m'; MAGENTA='\033[0;35m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }
info() { echo -e "${CYAN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
step() { echo -e "\n${MAGENTA}[Step $1]${NC} $2"; }

aws_ddb() { aws dynamodb "$@" --region "$AWS_REGION" --output json; }

echo -e "${MAGENTA}=== Restart raffle ${RAFFLE_CODE} ===${NC}"
info "Environment : ${ENV}"
info "Instances   : ${INSTANCES_TABLE}"
info "Participations: ${PARTICIPATIONS_TABLE}"
info "Experience  : ${EXPERIENCE_ID}"
if [ "$APPLY" = true ]; then
  warn "Mode: APPLY (changes WILL be written)"
else
  info "Mode: DRY RUN (no changes will be written; pass --apply to execute)"
fi

# ── Step 1: Load the instance and sanity-check it exists ─────────────────────
step 1 "Reading current raffle state"
INSTANCE_JSON="$(aws_ddb get-item \
  --table-name "$INSTANCES_TABLE" \
  --key "{\"PK\":{\"S\":\"${INSTANCE_PK}\"},\"SK\":{\"S\":\"${INSTANCE_SK}\"}}")"

if [ "$(echo "$INSTANCE_JSON" | python3 -c 'import sys,json;print(len(json.load(sys.stdin).get("Item",{})))')" = "0" ]; then
  err "Experience instance not found: ${INSTANCE_PK} / ${INSTANCE_SK}"
  exit 1
fi

CUR_STATE="$(echo "$INSTANCE_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["Item"].get("state",{}).get("S","(none)"))')"
CUR_DRAWSTATE="$(echo "$INSTANCE_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["Item"].get("drawState",{}).get("S","(none)"))')"
info "Current lifecycle state : ${CUR_STATE}"
info "Current drawState       : ${CUR_DRAWSTATE}"

# ── Step 2: Discover winning entries ─────────────────────────────────────────
step 2 "Finding winning entries (status=winner)"
WINNER_SKS="$(aws_ddb query \
  --table-name "$PARTICIPATIONS_TABLE" \
  --key-condition-expression "PK = :pk AND begins_with(SK, :sk)" \
  --filter-expression "#s = :winner" \
  --expression-attribute-names '{"#s":"status"}' \
  --expression-attribute-values "{\":pk\":{\"S\":\"${EXPERIENCE_PK}\"},\":sk\":{\"S\":\"ENTRY#\"},\":winner\":{\"S\":\"winner\"}}" \
  --projection-expression "SK, entryCode, firstName, lastName" \
  | python3 -c '
import sys, json
d = json.load(sys.stdin)
for it in d.get("Items", []):
    sk = it["SK"]["S"]
    code = it.get("entryCode", {}).get("S", "?")
    fn = it.get("firstName", {}).get("S", "")
    ln = it.get("lastName", {}).get("S", "")
    print(f"{sk}\t{code}\t{fn} {ln}")
')"

if [ -z "$WINNER_SKS" ]; then
  warn "No entries with status=winner found. (Winner reset will be skipped.)"
else
  echo "$WINNER_SKS" | while IFS=$'\t' read -r sk code name; do
    info "  winner: ${code}  ${name}  (${sk})"
  done
fi

# ── Step 3: Discover selection/drawing audit records ─────────────────────────
step 3 "Finding selection/drawing records (DRAWING#)"
DRAWING_SKS="$(aws_ddb query \
  --table-name "$PARTICIPATIONS_TABLE" \
  --key-condition-expression "PK = :pk AND begins_with(SK, :sk)" \
  --expression-attribute-values "{\":pk\":{\"S\":\"${EXPERIENCE_PK}\"},\":sk\":{\"S\":\"DRAWING#\"}}" \
  --projection-expression "SK" \
  | python3 -c 'import sys,json;[print(i["SK"]["S"]) for i in json.load(sys.stdin).get("Items",[])]')"

if [ -z "$DRAWING_SKS" ]; then
  warn "No DRAWING# selection records found. (Selection delete will be skipped.)"
else
  while IFS= read -r sk; do info "  selection record: ${sk}"; done <<< "$DRAWING_SKS"
fi

# ── Plan summary ─────────────────────────────────────────────────────────────
step 4 "Planned changes"
echo "  - Reset each winning entry: status -> valid, REMOVE wonAt"
echo "  - Delete each DRAWING# selection record"
echo "  - Instance ${INSTANCE_SK}:"
echo "      state -> Draft, drawState -> OPEN"
echo "      activeDrawId -> null, lastDrawId -> null"
echo "      REMOVE _startLogged, _endLogged"

if [ "$APPLY" != true ]; then
  echo
  ok "Dry run complete. Re-run with --apply to perform the reset."
  exit 0
fi

# ── Confirmation ─────────────────────────────────────────────────────────────
if [ "$ASSUME_YES" != true ]; then
  echo
  read -r -p "$(echo -e "${YELLOW}Apply these changes to ${RAFFLE_CODE} (${ENV})? [y/N] ${NC}")" reply
  case "$reply" in
    y|Y|yes|YES) ;;
    *) err "Aborted. No changes written."; exit 1 ;;
  esac
fi

# ── Step 5: Reset winning entries ────────────────────────────────────────────
step 5 "Resetting winning entries"
if [ -n "$WINNER_SKS" ]; then
  echo "$WINNER_SKS" | while IFS=$'\t' read -r sk code name; do
    aws_ddb update-item \
      --table-name "$PARTICIPATIONS_TABLE" \
      --key "{\"PK\":{\"S\":\"${EXPERIENCE_PK}\"},\"SK\":{\"S\":\"${sk}\"}}" \
      --update-expression "SET #s = :valid REMOVE wonAt" \
      --expression-attribute-names '{"#s":"status"}' \
      --expression-attribute-values '{":valid":{"S":"valid"}}' >/dev/null
    ok "  reset ${code} (${name})"
  done
else
  info "  nothing to reset"
fi

# ── Step 6: Delete selection/drawing records ─────────────────────────────────
step 6 "Deleting selection records"
if [ -n "$DRAWING_SKS" ]; then
  while IFS= read -r sk; do
    aws_ddb delete-item \
      --table-name "$PARTICIPATIONS_TABLE" \
      --key "{\"PK\":{\"S\":\"${EXPERIENCE_PK}\"},\"SK\":{\"S\":\"${sk}\"}}" >/dev/null
    ok "  deleted ${sk}"
  done <<< "$DRAWING_SKS"
else
  info "  nothing to delete"
fi

# ── Step 7: Reopen the instance to Draft ─────────────────────────────────────
step 7 "Reopening instance to Draft (drawState=OPEN)"
aws_ddb update-item \
  --table-name "$INSTANCES_TABLE" \
  --key "{\"PK\":{\"S\":\"${INSTANCE_PK}\"},\"SK\":{\"S\":\"${INSTANCE_SK}\"}}" \
  --update-expression "SET #st = :draft, drawState = :open, activeDrawId = :null, lastDrawId = :null REMOVE #sl, #el, winnerAnnouncedAt" \
  --expression-attribute-names '{"#st":"state","#sl":"_startLogged","#el":"_endLogged"}' \
  --expression-attribute-values '{":draft":{"S":"Draft"},":open":{"S":"OPEN"},":null":{"NULL":true}}' >/dev/null
ok "  instance set to Draft / OPEN"

# ── Step 8: Verify ───────────────────────────────────────────────────────────
step 8 "Verifying"
VERIFY_JSON="$(aws_ddb get-item \
  --table-name "$INSTANCES_TABLE" \
  --key "{\"PK\":{\"S\":\"${INSTANCE_PK}\"},\"SK\":{\"S\":\"${INSTANCE_SK}\"}}" \
  --projection-expression "#st, drawState" \
  --expression-attribute-names '{"#st":"state"}')"
NEW_STATE="$(echo "$VERIFY_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["Item"].get("state",{}).get("S","(none)"))')"
NEW_DRAWSTATE="$(echo "$VERIFY_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["Item"].get("drawState",{}).get("S","(none)"))')"

REMAINING_WINNERS="$(aws_ddb query \
  --table-name "$PARTICIPATIONS_TABLE" \
  --key-condition-expression "PK = :pk AND begins_with(SK, :sk)" \
  --filter-expression "#s = :winner" \
  --expression-attribute-names '{"#s":"status"}' \
  --expression-attribute-values "{\":pk\":{\"S\":\"${EXPERIENCE_PK}\"},\":sk\":{\"S\":\"ENTRY#\"},\":winner\":{\"S\":\"winner\"}}" \
  --select COUNT | python3 -c 'import sys,json;print(json.load(sys.stdin)["Count"])')"

REMAINING_DRAWINGS="$(aws_ddb query \
  --table-name "$PARTICIPATIONS_TABLE" \
  --key-condition-expression "PK = :pk AND begins_with(SK, :sk)" \
  --expression-attribute-values "{\":pk\":{\"S\":\"${EXPERIENCE_PK}\"},\":sk\":{\"S\":\"DRAWING#\"}}" \
  --select COUNT | python3 -c 'import sys,json;print(json.load(sys.stdin)["Count"])')"

info "  state=${NEW_STATE}  drawState=${NEW_DRAWSTATE}"
info "  remaining winner entries=${REMAINING_WINNERS}  remaining selection records=${REMAINING_DRAWINGS}"

if [ "$NEW_STATE" = "Draft" ] && [ "$NEW_DRAWSTATE" = "OPEN" ] && [ "$REMAINING_WINNERS" = "0" ] && [ "$REMAINING_DRAWINGS" = "0" ]; then
  echo
  ok "Raffle ${RAFFLE_CODE} restarted: winners cleared, selection removed, reopened to Draft."
else
  echo
  err "Verification did not match the expected final state. Review the values above."
  exit 1
fi
