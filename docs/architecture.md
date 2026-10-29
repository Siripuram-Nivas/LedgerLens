# Architecture and data flow

LedgerLens is a local/demo payment reconciliation prototype. The browser renders a React client, the Express API owns every financial transition, and a single document-store adapter persists the result. Realtime messages only tell the browser what to re-read; they never carry a financial mutation from the client.

> **Boundary:** there is no authentication, no live payment credentials, and no proven bank/provider settlement feed. The demo provider uses the same server-side event and reconciliation code paths as the Razorpay adapter, but publishes simulated events. See [../README.md](../README.md) for the scope statement.

## Runtime topology

```text
┌─────────────────────────────┐
│ Browser (React 19 + Vite)   │
│  React Query + Socket.IO    │
└──────────────┬──────────────┘
               │ REST /api/v1 (JSON)
               │ Socket.IO /realtime (notifications)
┌──────────────▼──────────────┐
│ Express 5 API               │
│  routes → services → repo   │
│  webhook raw-body router    │
└──────────────┬──────────────┘
               │ DocStore interface
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌──────▼─────────┐
│ SQLite      │  │ MongoDB        │
│ (default)   │  │ (optional)     │
│ file-backed │  │ Mongoose       │
└─────────────┘  └────────────────┘
```

- **Development:** `npm run dev` starts the API with `tsx watch` on port 4000 and Vite on port 5173. Vite proxies `/api` and `/socket.io` to the API.
- **Built local run:** `npm run build && npm start` makes Express serve `client/dist` and the API on port 4000. Client-side routes fall back to `index.html`; `/api/*` and `/socket.io/*` are excluded from the SPA fallback.
- **Persistence:** one `DocStore` interface has a SQLite adapter (default, file-backed) and a Mongoose adapter. The engine is reported by `/health` and `/meta`; there is no silent fallback from MongoDB to SQLite.

## Startup sequence

1. `server/src/config.ts` loads `.env` files and validates environment variables with Zod. `PERSISTENCE=mongodb` without `MONGODB_URI` aborts startup.
2. `createServices()` constructs the store, repository, realtime bus, and domain services.
3. If `DEMO_MODE=true`, `DEMO_SEED=true`, and the demo payment collection is empty, `SeedService.seedIfEmpty()` seeds the fixture set and runs reconciliation.
4. `createApp()` mounts security headers, CORS, request logging, rate limiting, the raw-body webhook router, JSON parsing, API routes, and optional static client hosting.
5. `setupRealtime()` attaches Socket.IO to the same HTTP server and authenticates clients to the single configured environment.
6. `server.listen()` starts the API. Shutdown closes Socket.IO, the HTTP server, and the store.

The API serves one environment per process. `appEnvironment` is `demo` when `DEMO_MODE=true`; otherwise it is `RAZORPAY_ENVIRONMENT` (`sandbox` or `live`).

## Request flow

```text
HTTP request
  → request logger (X-Request-Id)
  → rate limiter
  → route + Zod validation
  → domain service
  → LedgerRepository
  → DocStore adapter (SQLite or MongoDB)
  → { data } / { data, meta } response
```

- **Read routes** validate query parameters, call a read service, and return a list envelope or a detail object.
- **Write routes** parse and validate JSON, call a service, publish realtime notifications, and append audit records where applicable.
- **Errors** are normalized by the central error handler to `{ error: { code, message, details?, requestId? } }`. Stack traces and secrets are not returned to clients.
- **Money** is always an integer amount in minor units. Domain constructors reject non-integer, non-positive, or above-maximum amounts.
- **Dates** are ISO strings stored and compared in UTC. Inclusive `from`/`to` filters apply to `createdAt` for list endpoints.

## Main write flows

### Demo scenario

```text
POST /api/v1/demo/scenarios
  → require DEMO_MODE
  → create demo order/payment (source=demo, environment=demo)
  → build a NormalizedLedgerEvent (signatureStatus=SIMULATED)
  → EventService.process()
       → insert event by stable eventKey
       → record delivery
       → apply financial effect once
       → run payment-scoped reconciliation
       → update event processing result
  → append scenario audit
  → publish realtime events
```

The demo path does not call Razorpay. Settlement confirmation and refund advancement are separate explicit demo actions; capture never implies either.

### Razorpay webhook

```text
POST /api/v1/webhooks/razorpay
  → raw body parser (before express.json)
  → refuse 503 unless PAYMENT_PROVIDER=razorpay and secret configured
  → verify HMAC-SHA256 over raw bytes, timing-safe compare
  → invalid signature: record rejected delivery, return 401
  → parse JSON and normalize a small whitelist of fields
  → EventService.process()
  → return processed/duplicate + eventKey + transactionRef
```

The idempotency key is `X-Razorpay-Event-Id`, then the body event `id`, then a deterministic provider composite key. PII/card fields are excluded from the stored payload summary.

### Reconciliation run

```text
POST /api/v1/reconciliation/run
  → create RUNNING run
  → load all payments/orders in the environment, or one payment plus
    its order and sibling attempts for a payment-scoped run
  → derive payment reconciliation statuses and exception drafts
  → create/update exception documents by fingerprint
  → auto-clear active exceptions that are no longer present in scope
  → finish run with counts
  → append audit
  → publish reconciliation.completed
```

Re-runs update active exceptions in place and never reopen an operator resolution. The detailed rule order is in [reconciliation-rules.md](reconciliation-rules.md).

### Operator resolution

```text
POST /api/v1/reconciliation/exceptions/:ref/assign
  → OPEN becomes UNDER_REVIEW, assignee stored
  → audit exception.assigned
  → publish exception.updated

POST /api/v1/reconciliation/exceptions/:ref/resolve
  → validate resolution type and note (8+ characters)
  → store decision, note, resolvedAt
  → audit exception.resolved
  → publish exception.updated and reconciliation.completed
```

Resolving an exception records a decision. It does not edit the order, payment, settlement, or refund evidence.

### Demo refund advancement

```text
POST /api/v1/refunds/:ref/advance-demo
  → require DEMO_MODE and environment=demo
  → require refund.source=demo
  → REQUESTED → PROCESSING → REFUNDED
  → append timeline entry, refresh payment.refundStatus, audit
  → publish refund.updated and transaction.updated
```

A refund is never advanced automatically by a payment status change.

## Domain collections

| Collection | Purpose | Important uniqueness |
| --- | --- | --- |
| `orders` | Expected order amount/currency and customer reference | `orderRef` |
| `payments` | Payment attempt plus four independent status dimensions | `transactionRef`, `(provider, providerPaymentId)` |
| `events` | One canonical record per idempotency/event key | `eventKey` |
| `event_deliveries` | Every delivery attempt, including duplicates and rejected signatures | none (append-only) |
| `exceptions` | Explainable reconciliation discrepancy with evidence and resolution | `fingerprint` |
| `runs` | Reconciliation run history and counts | none (`runRef` lookup) |
| `settlements` | Recorded batch status, gross/fees/net, payment references | `settlementRef` |
| `refunds` | Refund record, timeline, and provider reference | `refundRef` |
| `audits` | Append-only operator/system action history | none |

Indexes are declared once in `server/src/db/store.ts` and created by both adapters. The SQLite adapter stores each document as JSON in an `id`/`doc` table and indexes `json_extract(doc, '$.field')` expressions. The Mongo adapter uses strict-false Mongoose schemas and mirrors the same index list.

## Status independence

`Payment` carries four dimensions:

- `status` — payment capture lifecycle.
- `settlementStatus` — whether a recorded settlement batch covers the payment.
- `reconciliationStatus` — whether the captured amount/currency agrees with the order.
- `refundStatus` — derived from refund records, not from payment status.

Settlement batches and refund records have their own status fields. This separation is deliberate: a payment can be `PAID` / `NOT_STARTED` / `MATCHED` / `NONE`, or `FAILED` / `NOT_APPLICABLE` / `NOT_APPLICABLE` / `NONE`. See [status-model.md](status-model.md).

## Realtime contract

- Socket.IO namespace: `/realtime`; path: `/socket.io`.
- Handshake auth/query must include the current environment or the namespace rejects it with `ENVIRONMENT_MISMATCH`.
- Server event: `ledger:event` with `{ id, type, environment, occurredAt, data }`.
- Ready event: `ledger:ready` with environment, transport, demo mode, server time.
- `RealtimeBus` types: `transaction.updated`, `event.processed`, `reconciliation.completed`, `exception.updated`, `settlement.updated`, `refund.updated`, `demo.reset`, `demo.scenario`.
- The client deduplicates by event `id`, invalidates the relevant React Query caches, and shows a toast for selected event types.
- The client may only emit `ledger:ping`. Financial mutations are REST/server-side operations.
- If the socket is disconnected, the client invalidates ledger queries every 15 seconds. Polling stops while connected.

## Environment and demo isolation

- One process serves exactly one environment. The socket room is `environment:<env>`.
- Demo records are tagged `source=demo` and `environment=demo`.
- Demo reset deletes every collection row with `environment=demo` only, then reseeds fixtures. It requires the exact phrase `RESET DEMO DATA` and refuses when `DEMO_MODE=false`.
- Sandbox/live records are not deleted by demo reset. The integration test creates a sandbox payment and verifies it survives reset.
- Settings and `/meta` report the absence of authentication and the webhook readiness state.

## Security posture

Implemented:

- Helmet headers and a restrictive CSP for the built client.
- CORS allowlist from `CLIENT_URL`/`CORS_ORIGINS`.
- Zod validation on query/body inputs.
- Rate limits (global API and a stricter demo-action limit).
- Raw-body HMAC verification with timing-safe comparison.
- Metadata redaction for card/contact/secret-like keys.
- Structured errors without stack traces.
- No browser-side financial mutation path.

Not implemented:

- Authentication, authorization, roles, or per-operator identity.
- CSRF tokens (there are no cookie-authenticated sessions).
- Encryption at rest, key rotation, audit immutability, or multi-tenant isolation.
- Live provider connectivity, webhook replay protection beyond event-key idempotency, or production deployment hardening.

Treat this repository as a reviewable local prototype, not a production payments system.

## Code map

| Area | Path |
| --- | --- |
| Config and startup | `server/src/config.ts`, `server/src/index.ts` |
| App middleware/static hosting | `server/src/app.ts` |
| Store contract/indexes | `server/src/db/store.ts` |
| SQLite / Mongo adapters | `server/src/db/sqlite.ts`, `server/src/db/mongo.ts` |
| Repository | `server/src/repositories/ledgerRepository.ts` |
| Event pipeline | `server/src/services/eventService.ts` |
| Reconciliation engine | `server/src/services/reconciliationService.ts` |
| Demo seed/scenarios | `server/src/services/seedService.ts`, `server/src/services/demoService.ts` |
| Dashboard aggregation | `server/src/services/dashboardService.ts` |
| Razorpay adapter | `server/src/providers/razorpay.ts`, `server/src/routes/webhooks.ts` |
| REST routes | `server/src/routes/*.ts` |
| Realtime | `server/src/realtime/bus.ts`, `server/src/realtime/socket.ts` |
| Client API/query layer | `client/src/lib/api.ts`, `client/src/lib/queries.ts`, `client/src/lib/queryClient.ts` |
| Client realtime | `client/src/components/providers/RealtimeProvider.tsx` |
| Client pages | `client/src/pages/*.tsx` |
| Tests | `server/tests/*.test.ts`, `client/src/test/*.test.tsx` |
