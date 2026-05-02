# ValleyVerified v2 API Contract

All write operations require `Authorization: Bearer <SkyGate token>`.

## `GET /.netlify/functions/valley-jobs`

Query:

- `status`: `posted`, `claimed`, `in_progress`, `fulfilled`, `cancelled`, or `all`.

Returns:

- `{ ok, jobs }`

## `POST /.netlify/functions/valley-jobs`

Creates company demand.

Required:

- `company`
- `title`

Optional:

- `type`: `restaurant_shift`, `open_house`, `courier_run`, `field_service`, `event_staffing`, `general`
- `location`
- `rate_cents`
- `slots`
- `startsAt`
- `description`
- `contactName`
- `contactEmail`
- `contactPhone`

Emits:

- `valleyverified.job.posted`

Routes to:

- `jobping.board`
- `ae-flow.dispatch`
- `skye-routex.procurement`

## `GET /.netlify/functions/valley-contractors`

Query:

- `status`: `pending`, `verified`, `suspended`, or `all`.

Returns:

- `{ ok, contractors }`

## `POST /.netlify/functions/valley-contractors`

Onboards or updates a contractor.

Required:

- `name`
- `email`

Optional:

- `phone`
- `company`
- `serviceArea`
- `skills`
- `status`
- `verification`

Emits:

- `valleyverified.contractor.onboarded`

Routes to:

- `ae-contractor-network.review`
- `contractor-income-verification`
- `skye-routex.vendor-profile`

## `POST /.netlify/functions/valley-claims`

Claims an open job for a contractor.

Required:

- `job_id`
- `contractor_id` or `contractor_email`

Creates:

- claim record
- fulfillment record

Emits:

- `valleyverified.job.claimed`

Routes to:

- `jobping.message.contractor`
- `ae-flow.follow_up`
- `skye-routex.work_order`

## `GET /.netlify/functions/valley-fulfillment`

Returns:

- `{ ok, fulfillments, events }`

## `POST /.netlify/functions/valley-fulfillment`

Updates fulfillment closeout.

Required:

- `fulfillment_id` or `job_id`

Optional:

- `status`
- `procurement_status`
- `payment_status`
- `notes`

Emits:

- `valleyverified.fulfillment.updated`

Routes to:

- `skye-routex.payment`
- `ae-flow.closeout`
- `jobping.customer_update`
