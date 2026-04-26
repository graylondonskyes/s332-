#!/usr/bin/env bash
set -euo pipefail
BRIDGE_HOST="${SKYEQUANTA_BRIDGE_HOST:-127.0.0.1}"
BRIDGE_PORT="${SKYEQUANTA_BRIDGE_PORT:-3020}"
BRIDGE_URL="${SKYEQUANTA_BRIDGE_URL:-http://${BRIDGE_HOST}:${BRIDGE_PORT}}"
ADMIN_TOKEN="${SKYEQUANTA_ADMIN_TOKEN:-stage9-admin-token}"
WORKSPACE_ID="${SKYEQUANTA_SMOKE_WORKSPACE_ID:-smoke-lifecycle-$$}"
WORKSPACE_NAME="${SKYEQUANTA_SMOKE_WORKSPACE_NAME:-Smoke Lifecycle Workspace}"
TENANT_ID="${SKYEQUANTA_SMOKE_TENANT_ID:-stage9-smoke}"
CURL_ARGS=(--connect-timeout 5 --max-time 20 -fsS)
auth_header(){ printf 'Authorization: Bearer %s' "$ADMIN_TOKEN"; }
json_header(){ printf 'Content-Type: application/json'; }
build_json(){ python3 - "$@" <<'PY'
import json,sys
payload={}
for argument in sys.argv[1:]:
    key,value=argument.split('=',1)
    payload[key]=value
print(json.dumps(payload,separators=(',',':')))
PY
}
cleanup(){
  curl "${CURL_ARGS[@]}" -X POST -H "$(auth_header)" -H "$(json_header)" --data '{}' "${BRIDGE_URL}/api/workspaces/${WORKSPACE_ID}/stop" >/dev/null 2>&1 || true
  curl "${CURL_ARGS[@]}" -X DELETE -H "$(auth_header)" "${BRIDGE_URL}/api/workspaces/${WORKSPACE_ID}" >/dev/null 2>&1 || true
}
trap cleanup EXIT
post_json(){ local url="$1"; local body="$2"; curl "${CURL_ARGS[@]}" -X POST -H "$(auth_header)" -H "$(json_header)" --data "$body" "$url"; }
get_json(){ local url="$1"; curl "${CURL_ARGS[@]}" -H "$(auth_header)" "$url"; }
expect_json(){ local json="$1"; local expression="$2"; python3 -c 'import json,sys; expr=sys.argv[1]; payload=json.load(sys.stdin); ok=eval(expr,{"__builtins__":{}},{"payload":payload}); raise SystemExit(0 if ok else 1)' "$expression" <<<"$json"; }
wait_for_json(){ local url="$1"; local expression="$2"; local attempts="${3:-60}"; local sleep_seconds="${4:-1}"; local output=""; for _ in $(seq 1 "$attempts"); do if output="$(get_json "$url" 2>/dev/null)"; then if expect_json "$output" "$expression"; then printf '%s' "$output"; return 0; fi; fi; sleep "$sleep_seconds"; done; echo "Timed out waiting for ${url}" >&2; return 1; }
echo "Checking bridge status at ${BRIDGE_URL}/api/status"
status_json="$(curl "${CURL_ARGS[@]}" "${BRIDGE_URL}/api/status")"
expect_json "$status_json" "payload.get('productName') and payload.get('companyName')"
echo "Checking public product identity endpoint"
identity_json="$(curl "${CURL_ARGS[@]}" "${BRIDGE_URL}/api/product/identity")"
expect_json "$identity_json" "payload.get('ok') is True and payload.get('identity', {}).get('routeTemplates', {}).get('workspaceForwardedPort') == '/w/:workspaceId/p/:port'"
echo "Creating workspace ${WORKSPACE_ID}"
create_payload="$(build_json "id=${WORKSPACE_ID}" "name=${WORKSPACE_NAME}" "tenantId=${TENANT_ID}")"
create_json="$(post_json "${BRIDGE_URL}/api/workspaces" "$create_payload")"
expect_json "$create_json" "payload.get('ok') is True and payload.get('workspace', {}).get('id') == '${WORKSPACE_ID}'"
echo "Starting workspace ${WORKSPACE_ID}"
start_json="$(post_json "${BRIDGE_URL}/api/workspaces/${WORKSPACE_ID}/start" '{}')"
expect_json "$start_json" "payload.get('ok') is True"
echo "Waiting for running workspace state"
running_json="$(wait_for_json "${BRIDGE_URL}/api/workspaces/${WORKSPACE_ID}" "payload.get('ok') is True and payload.get('workspace', {}).get('status') == 'running'")"
expect_json "$running_json" "payload.get('workspace', {}).get('status') == 'running'"
echo "Reading workspace runtime contract"
runtime_json="$(wait_for_json "${BRIDGE_URL}/api/workspaces/${WORKSPACE_ID}/runtime" "payload.get('ok') is True and payload.get('workspace', {}).get('id') == '${WORKSPACE_ID}'")"
expect_json "$runtime_json" "payload.get('runtime') and payload.get('state')"
echo "Stopping workspace ${WORKSPACE_ID}"
stop_json="$(post_json "${BRIDGE_URL}/api/workspaces/${WORKSPACE_ID}/stop" '{}')"
expect_json "$stop_json" "payload.get('ok') is True"
echo "Waiting for stopped workspace state"
stopped_json="$(wait_for_json "${BRIDGE_URL}/api/workspaces/${WORKSPACE_ID}" "payload.get('ok') is True and payload.get('workspace', {}).get('status') == 'stopped'")"
expect_json "$stopped_json" "payload.get('workspace', {}).get('status') == 'stopped'"
echo "Deleting workspace ${WORKSPACE_ID}"
delete_json="$(curl "${CURL_ARGS[@]}" -X DELETE -H "$(auth_header)" "${BRIDGE_URL}/api/workspaces/${WORKSPACE_ID}")"
expect_json "$delete_json" "payload.get('ok') is True and payload.get('deleted') is True"
echo "Workspace lifecycle smoke test passed for ${WORKSPACE_ID}."
