# LedgerLens

Real-time payment reconciliation for orders, captured payments, provider events, settlement batches and refunds. LedgerLens keeps each financial dimension separate: a payment can be **PAID** while it is **NOT_STARTED** for settlement and **MATCHED** for reconciliation. Each state is derived from its own evidence.

> **Scope:** this repository is a local/demo prototype. It ships without authentication and without payment credentials. The demo pipeline uses the real event, idempotency and reconciliation code paths, but it publishes simulated events. It does not prove that a live Razorpay integration, bank settlement, authentication or production infrastructure is configured.

## Quick start

Requirements: Node.js **20.19+** and npm.

```bash
npm install
npm run dev
```

- Client: <http://localhost:5173>
- API: <http://localhost:4000/api/v1/health>
- Realtime: Socket.IO namespace `/realtime` on the API server
- Persistence: SQLite file at `server/data/ledgerlens-demo.db` by default
- The first start seeds demo data if the SQLite store is empty

No `.env` file is required for the demo. Copy `.env.example` to `.env` only when you need to change ports, persistence or provider settings.

### Production-style local build

```bash
npm run build
npm start
```

The Express server serves the built client from `client/dist` when it exists, so the built app is available at <http://localhost:4000>. The same server exposes the API and Socket.IO.

### Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run API (tsx watch) and Vite client together |
| `npm run build` | Type-check and build server and client |
| `npm start` | Run the built server, which also serves the client build |
| `npm test` | Run server Vitest suites, then client Vitest/RTL suites |
| `npm run test:server` | Server reconciliation, API, webhook and demo tests |
| `npm run test:client` | Client component/realtime tests |
| `npm run typecheck` | TypeScript checks for both workspaces |
| `npm run reset-demo` | Delete only `environment=demo` records and reseed fixtures |

## Five-minute demo

1. Open **Overview**. Check the range presets, currency-grouped captured value, pending settlement position and the latest reconciliation run.
2. Open **Transactions**. Filter by payment, settlement, reconciliation and refund status. Open a transaction with the URL query parameter `?transaction=TXN-DEMO-0001` (or click a row) and inspect the four independent status dimensions, event history and linked records.
3. Run **Payment success** in **Demo lab**. The new payment appears without a socket refresh; the realtime event also produces a toast. Settlement is not inferred.
4. Run **Amount mismatch** and **Missing order**. Open **Reconciliation**, then open an exception. The drawer shows expected vs observed amounts, evidence, a suggested action and the audit trail.
5. Assign or resolve an exception. The resolution does not rewrite financial records and is preserved across reconciliation re-runs.
6. Run **Duplicate webhook**. Open **Event log** and the event drawer: both delivery records are retained, but the financial effect was applied once.
7. Run **Settlement pending**, then **Settlement confirmed**. The batch moves from **PENDING** to **SETTLED**; payment capture does not change.
8. Run **Refund requested**, open **Refunds**, and use the demo-only advancement action. A request is not a completed refund.
9. Type `RESET DEMO DATA` in **Demo lab → Reset demo data**. The confirmation dialog deletes only demo-tagged records and reseeds the fixtures.

See [docs/demo-walkthrough.md](docs/demo-walkthrough.md) for the detailed path and expected evidence.

## What is implemented

- **Transactions:** paginated/searchable list with independent payment, settlement, reconciliation and refund filters; a detail view with order comparison, event summaries, exceptions, settlements, refunds, related attempts, metadata redaction and payment-scoped reconciliation.
- **Reconciliation:** deterministic matching with explainable exceptions and stored evidence; amount/currency mismatch, missing order, missing payment, duplicate payment and duplicate distinct-event detection; idempotent re-runs; assignment and resolution workflows; append-only audit records; run history.
- **Event log:** every event and every delivery, including duplicate deliveries and rejected signatures; processing stages; sanitized payload summaries; links to the resulting payment/order.
- **Settlements:** recorded batches with gross, recorded fees and net; batch status is independent from payment capture. These are demo fixtures, not bank records.
- **Refunds:** request/processing/partial/completed/failed lifecycle, timeline and demo-only advancement. No refund is inferred from a payment status.
- **Demo lab:** ten deterministic scenarios, pending-settlement summary, explicit reset isolation and confirmation.
- **Settings:** runtime configuration, persistence engine, realtime fallback, webhook readiness, status model, reconciliation rules, limits and health.
- **Realtime:** Socket.IO notifications invalidate read models; the browser never mutates financial state. A 15-second polling fallback runs only while the socket is disconnected.
- **Persistence:** one generic document-store interface with a file-backed SQLite adapter (default) and an optional MongoDB/Mongoose adapter. The configured engine is reported by `/meta` and `/health`; there is no silent fallback.

## Status model

The four status dimensions are intentionally independent:

| Dimension | Values |
| --- | --- |
| Payment | `PENDING`, `PROCESSING`, `PAID`, `FAILED`, `CANCELLED` |
| Settlement | `NOT_APPLICABLE`, `NOT_STARTED`, `PENDING`, `SETTLED`, `FAILED`, `UNKNOWN` |
| Reconciliation | `MATCHED`, `PENDING_RECONCILIATION`, `MISSING_ORDER`, `MISSING_PAYMENT`, `AMOUNT_MISMATCH`, `CURRENCY_MISMATCH`, `DUPLICATE_EVENT`, `DUPLICATE_PAYMENT`, `UNDER_REVIEW`, `NOT_APPLICABLE` |
| Refund | `NONE`, `REQUESTED`, `PROCESSING`, `PARTIALLY_REFUNDED`, `REFUNDED`, `FAILED` |

`NOT_APPLICABLE` is a documented reconciliation extension for failed or cancelled attempts with no captured funds. `DUPLICATE_PAYMENT` is a documented extension for multiple captured payments against one order. Full definitions and transition rules are in [docs/status-model.md](docs/status-model.md).

Amounts are stored as **integer minor units** (for example `149900` = ₹1,499.00). Aggregates are grouped by currency and are never summed across currencies.

## Reconciliation rules

The engine matches payments to orders by stable order reference, compares captured amounts and currencies in minor units, groups attempts by order, and records evidence with every exception. Re-runs update existing active exceptions in place; they do not duplicate them and do not reopen operator resolutions.

See [docs/reconciliation-rules.md](docs/reconciliation-rules.md) for the rule table and matching flow.

## Webhook processing

`POST /api/v1/webhooks/razorpay` exists, but it is **disabled by default**:

- If `PAYMENT_PROVIDER` is not `razorpay` or `RAZORPAY_WEBHOOK_SECRET` is missing, the endpoint returns **503**. It never skips verification.
- When enabled, it verifies the HMAC-SHA256 signature over the **raw request body** with a timing-safe comparison.
- The idempotency key is `X-Razorpay-Event-Id`, then the body event id, then a deterministic provider composite key.
- Repeated deliveries are retained in the event log without repeating the financial effect.
- Invalid signatures are rejected and recorded as an audit delivery; the payload is not parsed or applied.
- Card data, contact details and secrets are stripped from the stored payload summary.

The demo provider does not call Razorpay. Demo signatures are marked `SIMULATED`, not `VERIFIED`.

## Persistence

| Engine | When | Notes |
| --- | --- | --- |
| SQLite (`PERSISTENCE=sqlite`, default) | Local demo | `better-sqlite3`, file-backed. Data survives restart. Not in-memory. |
| MongoDB (`PERSISTENCE=mongodb`) | Optional | Mongoose. `MONGODB_URI` is required; startup fails if it cannot be reached. |

The default path is relative to the server workspace when launched through npm: `server/data/ledgerlens-demo.db`. Tests use an in-memory SQLite store.

## Repository layout

```text
ledgerlens/
├─ client/                    React 19 + Vite + TypeScript + Tailwind
│  ├─ src/lib/                API client, query hooks, formatting, status metadata
│  ├─ src/components/         UI primitives, layout, drawers, providers
│  ├─ src/pages/              Overview, transactions, reconciliation, settlements,
│  │                          refunds, event log, demo lab, settings
│  └─ src/test/               Vitest + Testing Library suites
├─ server/                    Express 5 + TypeScript (CommonJS build)
│  ├─ src/db/                 DocStore interface, SQLite and Mongoose adapters
│  ├─ src/repositories/       LedgerRepository over the document store
│  ├─ src/services/           Event, reconciliation, demo, dashboard, refund services
│  ├─ src/providers/          Razorpay signature verification and normalization
│  ├─ src/realtime/           Socket.IO bus and environment-scoped rooms
│  ├─ src/routes/             REST API and Zod validation
│  └─ tests/                  Server integration/domain tests
└─ docs/                      Status model, reconciliation rules, metrics, API, demo
```

## API

All app routes are under `/api/v1`. Responses use `{ "data": ... }`; lists use `{ "data": [...], "meta": { "page", "limit", "total", "totalPages" } }`. Errors use `{ "error": { "code", "message", "details?", "requestId?" } }`.

Start with [docs/api.md](docs/api.md). `/meta` reports the status model, reconciliation rules, limits, persistence, realtime details and webhook readiness. `/health` reports API/store health and latency.

## Tests and verification

The repository includes:

- **Server:** 26 passing Vitest/Supertest tests across reconciliation, API contract, CORS origin handling, webhook signature/idempotency and demo isolation.
- **Client:** 16 passing Vitest/Testing Library tests across status badges, navigation, transaction filter/loading/error/empty states, event drawer evidence and realtime event dedupe.

Last verified in this workspace:

```text
npm run typecheck   # server and client pass
npm test            # server 26 passed, client 16 passed
npm run build       # server compile and client production build pass
```

The UI was also exercised in a browser against the SQLite demo store: all list views, transaction/exception/event drawers, transaction filters, a demo scenario run, realtime toasts and the reset confirmation flow.

## Configuration

Copy `.env.example` to `.env` and adjust only what you need.

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `4000` | API/HTTP port |
| `CLIENT_URL` | `http://localhost:5173` | CORS origin and dev client URL |
| `CORS_ORIGINS` | unset | Comma-separated extra origins; same-origin requests are always allowed |
| `PERSISTENCE` | `sqlite` | `sqlite` or `mongodb` |
| `SQLITE_PATH` | `./data/ledgerlens-demo.db` | Relative to the server workspace |
| `MONGODB_URI` | unset | Required for `mongodb`; no silent fallback |
| `DEMO_MODE` | `true` | Enables demo scenarios and tags records as demo |
| `DEMO_SEED` | `true` | Seeds fixtures when the demo store is empty |
| `PAYMENT_PROVIDER` | `demo` | `demo` or `razorpay` |
| `RAZORPAY_KEY_ID` | unset | Not used by the demo provider |
| `RAZORPAY_KEY_SECRET` | unset | Not used by the demo provider |
| `RAZORPAY_WEBHOOK_SECRET` | unset | Required for the real webhook; absent → 503 |
| `RAZORPAY_ENVIRONMENT` | `sandbox` | Environment tag for real webhook records |
| `LOG_LEVEL` | `info` | pino level |
| `JSON_BODY_LIMIT` | `100kb` | JSON body limit (webhook raw limit is 200kb) |
| `RATE_LIMIT_WINDOW_MS` | `60000` | API rate-limit window |
| `RATE_LIMIT_MAX` | `300` | API requests per window |
| `TRUST_PROXY` | `0` | Express `trust proxy` setting |

Never commit real credentials. The repository ignores `.env` and the default SQLite database.

## Demo isolation and reset

- Demo records are tagged `source=demo` and `environment=demo`.
- The reset endpoint requires the exact phrase `RESET DEMO DATA`.
- Reset deletes only documents with `environment=demo`, then reseeds the fixture set.
- It cannot run when `DEMO_MODE=false`.
- The fixture set is designed to exercise all six exception types, duplicate delivery and duplicate distinct-event cases.

## Limitations

- **No authentication or authorization.** Every API route is open on its host. Do not expose this instance with real financial data.
- **No live payment integration is proven.** Razorpay normalization and signature verification are implemented and tested with local HMAC fixtures, but no credentials, live webhook delivery, bank settlement or real refund execution are configured.
- **Settlement and fee values are fixtures.** They are labeled as simulated; there is no bank or provider settlement feed.
- **The demo provider is not a payment processor.** It creates deterministic local records through the same event/reconciliation pipeline.
- **No background job scheduler.** Reconciliation runs on demand and after processed events. The realtime fallback is client polling.
- **SQLite is a local single-node store.** The MongoDB adapter is optional and has not been load-tested here.
- **No exchange-rate conversion.** Multi-currency metrics are shown per currency.
- **Prototype access control for operator actions.** Assign/resolve actors are a fixed local operator string because there is no login.
- **Bundle/latency targets are not benchmarked.** The client is route-split, but no production performance claim is made.

## Documentation

- [Architecture and data flow](docs/architecture.md)
- [Status model](docs/status-model.md)
- [Reconciliation rules](docs/reconciliation-rules.md)
- [Dashboard metrics](docs/metrics.md)
- [API reference](docs/api.md)
- [Demo walkthrough](docs/demo-walkthrough.md)
