# API reference

Base path: `/api/v1`. The API is a local/demo prototype with **no authentication or authorization**. Do not expose it with real financial data.

- JSON responses: `{ "data": ... }`.
- Paginated lists: `{ "data": [...], "meta": { "page", "limit", "total", "totalPages" } }`.
- Exception lists additionally include `meta.counts` (`open`, `underReview`, `resolved`).
- Errors: `{ "error": { "code", "message", "details?", "requestId?" } }`.
- Every response carries `X-Request-Id`; an incoming `X-Request-Id` (≤100 chars) is reused.
- Money fields are integer minor units. Currency fields are uppercase three-letter codes.
- Dates are ISO strings. List `from`/`to` filters are inclusive and apply to `createdAt`.
- Lookup endpoints accept the public reference or the internal `id` unless noted.

## Endpoint summary

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | API/store health and runtime summary |
| `GET` | `/meta` | Status model, rules, limits, persistence, webhook readiness |
| `GET` | `/dashboard/summary` | Range-scoped dashboard metrics |
| `GET` | `/transactions` | Paginated/searchable payments |
| `GET` | `/transactions/:reference` | Payment detail with linked records |
| `GET` | `/reconciliation/exceptions` | Paginated exceptions plus status counts |
| `GET` | `/reconciliation/exceptions/:reference` | Exception evidence and audits |
| `POST` | `/reconciliation/exceptions/:reference/assign` | Assign an exception for review |
| `POST` | `/reconciliation/exceptions/:reference/resolve` | Record a resolution decision |
| `POST` | `/reconciliation/run` | Run all or one payment's reconciliation |
| `GET` | `/reconciliation/runs` | Latest 20 runs |
| `GET` | `/settlements` | Paginated settlement batches |
| `GET` | `/settlements/:reference` | Batch plus referenced payments |
| `GET` | `/refunds` | Paginated refunds |
| `GET` | `/refunds/:reference` | Refund, linked records, audits |
| `POST` | `/refunds/:reference/advance-demo` | Demo-only refund transition |
| `GET` | `/events` | Paginated event log |
| `GET` | `/events/:reference` | Event, deliveries, stages, links |
| `GET` | `/demo/status` | Demo availability and pending settlements |
| `POST` | `/demo/scenarios` | Run one deterministic demo scenario |
| `POST` | `/demo/reset` | Delete only `environment=demo` and reseed |
| `POST` | `/webhooks/razorpay` | Signed provider webhook (disabled unless configured) |

Realtime is not an HTTP endpoint: Socket.IO namespace `/realtime`, path `/socket.io`, event `ledger:event`. See [architecture.md](architecture.md#realtime-contract).

## Health

```http
GET /api/v1/health
```

```json
{
  "data": {
    "status": "ok",
    "version": "1.0.0",
    "uptimeSeconds": 42,
    "dbLatencyMs": 1,
    "persistence": "sqlite",
    "demoMode": true,
    "environment": "demo",
    "provider": "demo",
    "realtime": "socket.io",
    "timestamp": "2026-10-29T12:00:00.000Z"
  }
}
```

If the store ping fails, the endpoint returns `503 DATABASE_UNAVAILABLE`.

## Meta

```http
GET /api/v1/meta
```

Returns `data` with:

- `name`, `tagline`, `version`, `timestamp`;
- `environment`, `demoMode`, `provider`, `razorpayEnvironment`;
- `persistence`, `persistenceLabel`;
- `accessControl: "none"` and an explicit warning;
- `realtime` (transport, namespace, path, fallback);
- `webhook` (endpoint, provider/secret readiness, signature and idempotency descriptions);
- `demo` (enabled, scenario names, reset phrase, isolation note);
- `statusModel` (payment, settlement, reconciliation, refund);
- `reconciliationRules` (string list);
- `limits` (pagination max, body limit, rate-limit window/max).

No secret values are returned.

## Dashboard

```http
GET /api/v1/dashboard/summary?range=7d
GET /api/v1/dashboard/summary?range=custom&from=2026-10-01T00:00:00.000Z&to=2026-10-15T00:00:00.000Z
```

| Query | Values | Default |
| --- | --- | --- |
| `range` | `24h`, `7d`, `30d`, `custom` | `7d` |
| `from` | ISO date/timestamp; required for `custom` | — |
| `to` | ISO date/timestamp | now |

Custom ranges are limited to 366 days, must have `from < to`, and may not end more than 5 minutes in the future. Invalid ranges return `400 INVALID_RANGE`.

Response: `data` with `range`, `generatedAt`, `metrics`, `statusDistribution`, `settlementDistribution`, `trend`, `recentTransactions`, `recentExceptions`, `recentEvents`, `recentSettlements`, `recentRefunds`, `latestRun`, and `scopeNotes`. Metric formulas and currency rules are in [metrics.md](metrics.md).

## Transactions

### List

```http
GET /api/v1/transactions?page=1&limit=20&status=PAID&reconciliationStatus=AMOUNT_MISMATCH&q=TXN-DEMO
```

| Query | Values / limit | Default |
| --- | --- | --- |
| `page` | integer 1–100000 | `1` |
| `limit` | integer 1–100 | `20` |
| `q` | string ≤120 chars | — |
| `status` | `PENDING`, `PROCESSING`, `PAID`, `FAILED`, `CANCELLED` | — |
| `settlementStatus` | `NOT_APPLICABLE`, `NOT_STARTED`, `PENDING`, `SETTLED`, `FAILED`, `UNKNOWN` | — |
| `reconciliationStatus` | any reconciliation status | — |
| `refundStatus` | `NONE`, `REQUESTED`, `PROCESSING`, `PARTIALLY_REFUNDED`, `REFUNDED`, `FAILED` | — |
| `from`, `to` | ISO; inclusive `createdAt` range | — |
| `sortBy` | `createdAt`, `updatedAt`, `amount`, `status` | `createdAt` |
| `sortDir` | `asc`, `desc` | `desc` |

Search fields: `transactionRef`, `orderRef`, `customerRef`, `providerPaymentId`, `id`.

```json
{
  "data": [
    {
      "transactionRef": "TXN-DEMO-0001",
      "orderRef": "ORD-DEMO-1001",
      "amountMinor": 149900,
      "currency": "INR",
      "status": "PAID",
      "settlementStatus": "SETTLED",
      "reconciliationStatus": "MATCHED",
      "refundStatus": "NONE",
      "source": "demo",
      "environment": "demo"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### Detail

```http
GET /api/v1/transactions/TXN-DEMO-0001
```

`data` contains:

| Field | Content |
| --- | --- |
| `payment` | Full payment document, including all four dimensions |
| `order` | Linked order or `null` |
| `orderComparison` | Expected/observed amounts and currencies, match flags, summary |
| `events` | Event summaries with processing/signature/duplicate state |
| `exceptions` | All exceptions for the payment |
| `refunds` | Refund records for the provider payment |
| `settlements` | Batches referencing the provider payment |
| `relatedPayments` | Other attempts for the same order |
| `metadata` | Sanitized payment metadata |
| `metadataRedacted` | Keys removed because they looked like card/contact/secret data |
| `insights` | Explainable status hints with severity, detail, and optional action |

`404 NOT_FOUND` if the payment is missing or belongs to another environment.

## Reconciliation exceptions

### List

```http
GET /api/v1/reconciliation/exceptions?status=OPEN&type=AMOUNT_MISMATCH&sortBy=amountDifference
```

| Query | Values / limit | Default |
| --- | --- | --- |
| `page`, `limit` | same pagination limits | `1`, `20` |
| `q` | ≤120 chars | — |
| `type` | `MISSING_ORDER`, `MISSING_PAYMENT`, `AMOUNT_MISMATCH`, `CURRENCY_MISMATCH`, `DUPLICATE_EVENT`, `DUPLICATE_PAYMENT` | — |
| `status` | `OPEN`, `UNDER_REVIEW`, `RESOLVED` | — |
| `from`, `to` | ISO; inclusive `createdAt` | — |
| `sortBy` | `amountDifference`, `createdAt`, `lastDetectedAt` | `createdAt` |
| `sortDir` | `asc`, `desc` | `desc` |

Search fields: `exceptionRef`, `transactionRef`, `orderRef`, `paymentRef`, `explanation`.

`meta.counts` is the environment-wide status count and is **not** narrowed by the filters:

```json
{
  "data": [ /* exceptions */ ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 2,
    "totalPages": 1,
    "counts": { "open": 4, "underReview": 2, "resolved": 1 }
  }
}
```

### Detail

```http
GET /api/v1/reconciliation/exceptions/EXC-...
```

`data`: `exception`, `audits`, `payment`, `order`, `resolutionTypes`. Evidence is stored on the exception and does not change when linked records later update, except when a reconciliation run refreshes an active exception.

### Assign

```http
POST /api/v1/reconciliation/exceptions/EXC-.../assign
Content-Type: application/json

{ "assignedTo": "operator@ledgerlens.local", "note": "Checking provider capture" }
```

| Field | Rule |
| --- | --- |
| `assignedTo` | string, 2–80 chars, required |
| `note` | string ≤300 chars, optional |

Sets status to `UNDER_REVIEW`, stores the assignee, appends an audit record, and publishes `exception.updated`. Returns the detail object. A resolved exception returns `409 EXCEPTION_RESOLVED`.

### Resolve

```http
POST /api/v1/reconciliation/exceptions/EXC-.../resolve
Content-Type: application/json

{
  "resolutionType": "EVIDENCE_VERIFIED",
  "note": "Provider report confirms the captured amount was intentional."
}
```

| Field | Rule |
| --- | --- |
| `resolutionType` | `EVIDENCE_VERIFIED`, `FALSE_POSITIVE`, `ADJUSTED_EXTERNALLY`, `ACCEPTED_AS_IS` |
| `note` | string, 8–1000 chars, required |

Stores the decision and note, sets `resolvedAt`, appends an audit record, and publishes `exception.updated` plus `reconciliation.completed`. It does **not** rewrite financial records. Re-resolving returns `409 EXCEPTION_RESOLVED`.

### Run reconciliation

```http
POST /api/v1/reconciliation/run
Content-Type: application/json

{ "scope": "all" }
```

```json
{ "scope": "payment", "transactionRef": "TXN-DEMO-0001" }
```

| Field | Rule |
| --- | --- |
| `scope` | `all` or `payment`; default `all` |
| `transactionRef` | required for `scope=payment`, 1–120 chars |

The response wraps the run result:

```json
{
  "data": {
    "run": {
      "runRef": "RUN-...",
      "status": "COMPLETED",
      "scope": "all",
      "counts": {
        "paymentsEvaluated": 24,
        "ordersEvaluated": 22,
        "matched": 14,
        "pending": 2,
        "notApplicable": 2,
        "exceptionsCreated": 0,
        "exceptionsUpdated": 6,
        "exceptionsAutoResolved": 0,
        "duplicateEventsDetected": 1
      }
    },
    "statuses": { "MATCHED": 14, "PENDING_RECONCILIATION": 2, "NOT_APPLICABLE": 2 },
    "openExceptionCount": 6
  }
}
```

Counts in this example are illustrative; use the returned values. The client unwraps `data.run` for toasts and links.

### Runs

```http
GET /api/v1/reconciliation/runs
```

Returns the latest 20 runs in the current environment as `data: []` (newest first). Run counts are defined in [reconciliation-rules.md](reconciliation-rules.md#run-counts).

## Settlements

```http
GET /api/v1/settlements?page=1&limit=20&status=PENDING&q=SET-DEMO
```

| Query | Values / limit | Default |
| --- | --- | --- |
| `page`, `limit` | standard pagination | `1`, `20` |
| `q` | ≤120 chars | — |
| `status` | `PENDING`, `SETTLED`, `FAILED`, `UNKNOWN` | — |
| `from`, `to` | ISO; inclusive `createdAt` | — |

Search fields: `settlementRef`, `providerSettlementRef`, `notes`.

```http
GET /api/v1/settlements/SET-DEMO-0003
```

`data`: `settlement`, `payments` (referenced payment documents that still exist), `simulated` (`source === "demo"`).

A settlement has `grossMinor`, `feesMinor`, `netMinor`, `currency`, `expectedAt`, `settledAt`, `feesSource`, `notes`, `paymentRefs`, and `transactionRefs`. Fees/net may be `null` for pending batches. Demo values are `SIMULATED_FIXTURE`, not bank records.

## Refunds

```http
GET /api/v1/refunds?page=1&limit=20&status=REQUESTED
```

| Query | Values / limit | Default |
| --- | --- | --- |
| `page`, `limit` | standard pagination | `1`, `20` |
| `q` | ≤120 chars | — |
| `status` | `REQUESTED`, `PROCESSING`, `PARTIALLY_REFUNDED`, `REFUNDED`, `FAILED` | — |
| `from`, `to` | ISO; inclusive `createdAt` | — |

Search fields: `refundRef`, `paymentRef`, `transactionRef`, `orderRef`, `reason`.

```http
GET /api/v1/refunds/REF-DEMO-0002
```

`data`: `refund`, `payment`, `order`, `audits`, `canAdvance` (requested/processing only), `simulationOnly` (`source === "demo"`).

### Advance demo refund

```http
POST /api/v1/refunds/REF-.../advance-demo
Content-Type: application/json

{}
```

Only available when `DEMO_MODE=true`, the environment is `demo`, and the refund source is `demo`.

```text
REQUESTED → PROCESSING → REFUNDED
```

Each call performs one transition and returns the updated refund. Invalid state → `409 INVALID_REFUND_TRANSITION`. Demo disabled → `403 DEMO_ONLY`. A non-demo refund → `409 REAL_REFUND_LOCKED`.

## Events

```http
GET /api/v1/events?page=1&limit=20&processingStatus=PROCESSED&duplicateOnly=true
```

| Query | Values / limit | Default |
| --- | --- | --- |
| `page`, `limit` | standard pagination | `1`, `20` |
| `q` | ≤120 chars | — |
| `processingStatus` | `RECEIVED`, `PROCESSED`, `FAILED` | — |
| `type` | event type string ≤100 chars (exact match) | — |
| `duplicateOnly` | `true` or `false`; true means `duplicateDeliveryCount ≥ 1` | — |
| `from`, `to` | ISO; inclusive `createdAt` | — |

Search fields: `eventKey`, `providerEventId`, `paymentRef`, `orderRef`, `transactionRef`, `type`.

```http
GET /api/v1/events/evt_DEMO_SEED_0019
```

The lookup tries the internal `id` first, then `eventKey`. Event keys are clickable in the UI and are the preferred reference.

`data`: `event`, `deliveries`, `transaction`, `order`, `stages`.

- `deliveries` includes `ACCEPTED`, `DUPLICATE`, `REPROCESSED`, `REJECTED_SIGNATURE`, and `INVALID` outcomes.
- `stages` is a five-step timeline: received, signature, persisted, processed, reconciliation.
- `signatureStatus` distinguishes `VERIFIED`, `SIMULATED`, `INVALID`, and `NOT_AVAILABLE`.

## Demo

### Status

```http
GET /api/v1/demo/status
```

When enabled:

```json
{
  "data": {
    "enabled": true,
    "scenarios": ["payment_success", "payment_processing", "payment_pending", "payment_failed", "duplicate_webhook", "amount_mismatch", "missing_order", "settlement_pending", "settlement_confirmed", "refund"],
    "resetConfirmation": "RESET DEMO DATA",
    "pendingSettlements": {
      "count": 1,
      "settlements": [{ "settlementRef": "SET-...", "grossMinor": 249900, "currency": "INR" }]
    },
    "isolation": "Demo records use source=demo and environment=demo. Reset removes only those records."
  }
}
```

When disabled: `{ "enabled": false, "scenarios": [], "resetConfirmation": null }`.

### Run scenario

```http
POST /api/v1/demo/scenarios
Content-Type: application/json

{ "scenario": "amount_mismatch", "amountMinor": 129900, "note": "optional" }
```

| Field | Rule |
| --- | --- |
| `scenario` | one of the 10 names above, required |
| `amountMinor` | positive integer ≤10,000,000,000,000, optional |
| `note` | string ≤200 chars, optional |

Returns `201` with scenario-specific fields. Common fields include `scenario`, `message`, `transactionRef`, `eventKey`, and `eventResult`; some scenarios add `exceptionRef`, `settlementRef`, `settlementStatus`, `refundRef`, or `refundStatus`. See [demo-walkthrough.md](demo-walkthrough.md).

Demo disabled → `403 DEMO_DISABLED`. Invalid amount equality for `amount_mismatch` → `400 NOT_A_MISMATCH`. Invalid refund amount → `400 INVALID_REFUND_AMOUNT`. `settlement_confirmed` without a pending batch → `409 NO_PENDING_SETTLEMENT`.

### Reset

```http
POST /api/v1/demo/reset
Content-Type: application/json

{ "confirm": "RESET DEMO DATA" }
```

The phrase is case-sensitive. Wrong/missing phrase → `400 CONFIRMATION_REQUIRED`. Demo disabled → `403 DEMO_DISABLED`.

```json
{
  "data": {
    "deleted": {
      "orders": 22,
      "payments": 24,
      "events": 25,
      "event_deliveries": 26,
      "exceptions": 6,
      "runs": 1,
      "settlements": 9,
      "refunds": 3,
      "audits": 2
    },
    "reseeded": true,
    "message": "Demo dataset reset. Only records tagged environment=demo were removed."
  }
}
```

Deleted counts vary with prior scenarios. Only documents with `environment=demo` are deleted; sandbox/live records survive. The fixture set is reseeded immediately.

## Razorpay webhook

```http
POST /api/v1/webhooks/razorpay
Content-Type: application/json
X-Razorpay-Signature: <hex HMAC-SHA256>
X-Razorpay-Event-Id: evt_...
```

Requirements:

- `PAYMENT_PROVIDER=razorpay`.
- `RAZORPAY_WEBHOOK_SECRET` configured.
- Raw body is signed; the endpoint mounts a raw parser before JSON middleware.
- Signature comparison is timing-safe.
- Payload limit: 200 KB.

Responses:

| Situation | Status | Body |
| --- | --- | --- |
| Applied | `200` | `{ data: { status: "processed", eventKey, transactionRef, applied, reconciliationRunRef } }` |
| Duplicate event key | `200` | `{ data: { status: "duplicate", eventKey, transactionRef, applied: false, reconciliationRunRef: null } }` |
| Provider/secret missing | `503` | `PROVIDER_DISABLED` or `WEBHOOK_NOT_CONFIGURED` |
| Bad signature | `401` | `INVALID_SIGNATURE`; a rejected delivery/event is recorded |
| Malformed JSON | `400` | `INVALID_JSON` |
| Missing event type | `400` | `INVALID_EVENT` |
| Processing failed after persistence | `422` | `EVENT_PROCESSING_FAILED`; event remains retryable |

Idempotency key preference: `X-Razorpay-Event-Id` → body `id` → deterministic composite of provider event type/payment/refund/status/timestamp. Repeated deliveries are retained; financial effects are not repeated.

## Error codes

| Code | Typical status | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Zod validation failed; `details` has field issues |
| `INVALID_RANGE` | 400 | Invalid dashboard/list date range |
| `INVALID_JSON` | 400 | Malformed JSON body or webhook |
| `INVALID_EVENT` | 400 / 422 | Missing/invalid event data |
| `INVALID_AMOUNT` | 400 | Non-positive, non-integer, or too-large amount |
| `INVALID_CURRENCY` | 400 | Currency is not a three-letter code |
| `INVALID_SIGNATURE` | 401 | Webhook HMAC mismatch |
| `DEMO_DISABLED` | 403 | Demo action while `DEMO_MODE=false` |
| `DEMO_ONLY` | 403 | Demo-only refund action outside demo mode |
| `CORS_ORIGIN_DENIED` | 403 | Origin not in the allowlist |
| `NOT_FOUND` | 404 | Route or record not found |
| `CONFIRMATION_REQUIRED` | 400 | Exact demo reset phrase missing |
| `EXCEPTION_RESOLVED` | 409 | Reassigning/re-resolving a resolved exception |
| `NO_PENDING_SETTLEMENT` | 409 | Settlement confirmation without a pending demo batch |
| `INVALID_REFUND_TRANSITION` | 409 | Refund cannot advance from its current state |
| `REAL_REFUND_LOCKED` | 409 | Demo action targeted a non-demo refund |
| `NOT_A_MISMATCH` | 400 | Amount-mismatch scenario amount equals the order |
| `INVALID_REFUND_AMOUNT` | 400 | Demo refund amount outside the payment amount |
| `EVENT_PROCESSING_FAILED` | 422 | Event stored but not applied; safe to retry |
| `RATE_LIMITED` | 429 | Global or demo rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Unexpected server error; no stack trace returned |
| `DATABASE_UNAVAILABLE` | 503 | Health check could not reach the store |
| `PROVIDER_DISABLED` / `WEBHOOK_NOT_CONFIGURED` | 503 | Webhook adapter not enabled/configured |

Validation failures include field-level `details`. Unknown routes return `404 NOT_FOUND` under `/api`.

## Limits

| Limit | Default |
| --- | --- |
| Page size | 1–100 |
| Page number | 1–100,000 |
| Search term | 120 chars |
| JSON body | `100kb` (`JSON_BODY_LIMIT`) |
| Webhook raw body | `200kb` |
| Global rate limit | 300 requests / 60 s (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`) |
| Demo actions | 60 requests / 60 s |

## Client note

The browser uses `client/src/lib/api.ts`. `POST /reconciliation/run` returns `{ run, statuses, openExceptionCount }`; the client unwraps `run` for success messages. All other detail endpoints return the `data` object directly. The UI never mutates financial state through Socket.IO.
