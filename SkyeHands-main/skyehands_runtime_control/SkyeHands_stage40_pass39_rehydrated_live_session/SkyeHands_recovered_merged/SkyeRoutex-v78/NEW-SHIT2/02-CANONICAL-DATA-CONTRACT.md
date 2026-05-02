# 02 — CANONICAL DATA CONTRACT

This is the no-Frankenstein contract for the existing AE FLOW + Routex stack.

## Shared keys already present in the codebase
### AE FLOW
- `kx.app.bridge`
- `kx.command.feed`
- `kx.workspace.id`
- `skye_routex_ae_queue_v1`
- `skye_ae_route_activity_v1`

### Routex
- `skye_routex_ae_queue_v1`
- `skye_ae_route_activity_v1`
- `skye_route_dispatch_vault_v1`
- `skye_routex_doc_vault_v1`
- `skye_routex_followup_tasks_v1`
- `skye_routex_inventory_catalog_v1`
- `skye_routex_local_reminders_v1`
- `skye_routex_route_templates_v1`
- `skye_routex_saved_views_v1`
- `skye_routex_territory_zones_v1`
- `skye_routex_vehicle_profiles_v1`

## Canonical client identity
Every routed account or independent stop must resolve to this identity shape:

```json
{
  "clientKey": "string",
  "clientMode": "linked_account | independent_stop",
  "sourceApp": "aeflow | routex",
  "accountId": "string|null",
  "businessName": "string",
  "contactName": "string",
  "businessEmail": "string",
  "phone": "string",
  "territories": ["string"],
  "routeReadiness": "route_ready | needs_patch | fallback_only | not_ready"
}
```

## Canonical location quality shape
Anything location-based must carry this:

```json
{
  "locationMode": "exact_address | partial_address | territory_fallback | manual_stop_text",
  "street": "string",
  "unit": "string",
  "city": "string",
  "state": "string",
  "zip": "string",
  "serviceArea": "string",
  "routeHint": "string",
  "locationNote": "string",
  "displayLabel": "string"
}
```

## Canonical stop outcome shape
Stop outcomes must stop being loose text. Use one source of truth:

```json
{
  "outcomeCode": "arrived | delivered | no_answer | rescheduled | wrong_address | gate_locked | site_closed | followup_needed | not_qualified | cancelled",
  "outcomeNote": "string",
  "requiresProof": true,
  "requiresFollowupTask": false,
  "countsAsAttempt": true,
  "countsAsSuccess": false,
  "countsAsDelivery": false
}
```

## Canonical quick action result contract
Every quick action in either app must write an event with this minimum shape:

```json
{
  "id": "string",
  "eventType": "quick_action",
  "actionCode": "string",
  "clientKey": "string",
  "routeId": "string|null",
  "stopId": "string|null",
  "createdAt": "ISO string",
  "uiMessage": "string",
  "exportImpact": true,
  "undoSupported": true
}
```

## Canonical export bundle contents
Every export lane that touches field state must know which of these it includes:
- route summary
- stop rows
- economics rows
- task rows
- doc vault rows
- signature rows
- service summary rows
- route pack metadata
- location quality status
- account linkage metadata

## Canonical restore rules
Restore must handle four record states:
1. fresh record
2. legacy record missing new fields
3. import duplicate with same id
4. import near-duplicate with different id but same route/date/name

Legacy upgrade rule:
- never break old records for missing new fields
- hydrate missing fields with safe defaults on read
- never claim a lane is complete unless legacy hydration is defined
