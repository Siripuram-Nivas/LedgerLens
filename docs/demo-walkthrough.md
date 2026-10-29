# Demo walkthrough

This walkthrough proves the local event, idempotency, reconciliation, settlement, refund, and realtime flows. It does **not** prove live Razorpay connectivity, bank settlement, authentication, or production readiness.

## Before you start

```bash
npm install
npm run dev
```

- Client: <http://localhost:5173>
- API health: <http://localhost:4000/api/v1/health>
- Default store: `server/data/ledgerlens-demo.db` (SQLite, file-backed)
- No `.env`, provider account, or credentials are required.

First start seeds the demo dataset if the demo payment collection is empty. Later starts keep existing data. To return to the fixture set at any time:

```bash
npm run reset-demo
```

or use **Demo lab → Reset demo data** with the exact phrase `RESET DEMO DATA`.

> All demo records are tagged `source=demo` and `environment=demo`. Reset deletes only `environment=demo` documents; sandbox/live records are untouched. Demo events are marked `SIMULATED`, not `VERIFIED`. No provider API is called.

## Seeded fixture inventory

The seed is deterministic in structure, with timestamps relative to the seed time:

| Collection | Count | Purpose |
| --- | --- | --- |
| Orders | 22 | Expected amounts, including one order with no payment |
| Payments | 24 | All five payment statuses, multiple attempts, multi-currency |
| Events | 25 | One per payment plus a second distinct capture event for one payment |
| Event deliveries | 26 | Includes one duplicate delivery |
| Settlements | 9 | Settled, pending, and failed batches |
| Refunds | 3 | Completed, requested, and failed |
| Reconciliation runs | 1 | Seed run |
| Open exceptions | 6 | One of each exception type |

Fixture examples:

- `TXN-DEMO-0001` — paid, settled, matched; its event has a duplicate delivery.
- `TXN-DEMO-0009` — paid amount below the order total → amount mismatch.
- `TXN-DEMO-0010` — paid with no order → missing order.
- `TXN-DEMO-0014` — USD payment against an INR order → currency mismatch.
- `TXN-DEMO-0019` — two distinct capture events → duplicate event.
- `TXN-DEMO-0023` and `TXN-DEMO-0024` — two captures of one order → duplicate payment.
- `ORD-DEMO-1011` — order with no payment → missing payment.
- `SET-DEMO-0003` — pending settlement.
- `SET-DEMO-0005` — failed settlement despite captured payment.
- `REF-DEMO-0001` — completed partial refund.
- `REF-DEMO-0002` — requested refund.
- `REF-DEMO-0003` — failed refund.

## Five-minute path

### 1. Overview

Open **Overview**.

Check:

- **Transactions**, **Value captured**, **Open exceptions**, and **Settlement pending** cards.
- The range selector (24h / 7 days / 30 days). The default is 7 days.
- **Value captured** is the sum of `PAID` payment amounts. If more than one currency is present, the hint lists each currency separately. The card never adds INR and USD together.
- **Settlement position** is based on recorded batches, not payment capture.
- **Newest exceptions** links to the reconciliation workspace.
- **Latest reconciliation run** shows counts from the seed or your latest run.

Click **Run reconciliation**. Expect a toast such as:

```text
Reconciliation RUN-... completed
24 payments evaluated · 0 new · 0 updated · 0 auto-cleared.
```

The exact counts depend on the current data. A re-run does not duplicate the six fixture exceptions.

### 2. Transactions

Open **Transactions**.

- Filter by payment status, settlement status, reconciliation status, or refund status.
- Search by transaction reference, order reference, customer, or provider payment id.
- Open `TXN-DEMO-0001` with:

```text
http://localhost:5173/transactions?transaction=TXN-DEMO-0001
```

The drawer shows the four independent dimensions:

```text
Payment          PAID
Settlement       SETTLED
Reconciliation   MATCHED
Refund           NONE
```

Also inspect:

- order comparison and amount/currency equality;
- event summaries and duplicate delivery count;
- linked settlements and refunds;
- related attempts for the same order;
- sanitized metadata and redacted fields;
- insights, including settlement state.

Try a filter that should return no rows, then use **Reset filters**. The filter state is preserved in the URL while a drawer opens/closes.

### 3. Payment success

Go to **Demo lab** and run **Payment success**.

Expected:

- a new transaction `TXN-DEMO-...` with a fresh order;
- payment `PAID`;
- settlement `NOT_STARTED` (capture does not create a settlement);
- reconciliation `MATCHED` after the post-event run;
- refund `NONE`;
- event processing `PROCESSED`, signature `SIMULATED`, applied once.

The new row appears without a manual refresh because the server publishes realtime events. A toast also confirms the scenario. Use the **Transaction** link in **Last scenario result**.

### 4. Amount mismatch and missing order

Run **Amount mismatch**:

```text
Order             INR 1,499.00
Captured payment  INR 1,299.00
Difference        INR   200.00
```

Open the returned **Exception** link. The drawer shows:

- type `AMOUNT_MISMATCH`, severity `HIGH`, status `OPEN`;
- expected vs observed amounts and currency;
- order and payment evidence;
- explanation and suggested action;
- audit trail.

Run **Missing order**. Its payment has no order; the exception is `MISSING_ORDER` (`HIGH`).

Assign the exception to an operator. The status becomes `UNDER_REVIEW` and an audit entry is added. Resolve it with a note of at least 8 characters. Resolution records the decision and does **not** change the payment amount or order.

Run reconciliation again. The resolved exception stays resolved; the engine does not reopen it.

### 5. Duplicate webhook

Run **Duplicate webhook**. Then open the returned **Event** link or **Event log**.

Expected:

- one event row, processed once;
- `duplicateDeliveryCount = 1`;
- two delivery records: `ACCEPTED` then `DUPLICATE`;
- second delivery note explains that financial effects applied once;
- payment remains `PAID`;
- no second payment or second captured amount.

Use **Duplicates only** on the Event log to see events with duplicate deliveries. This is different from `DUPLICATE_EVENT`, which requires two distinct event IDs for one payment.

### 6. Settlement pending → confirmed

Run **Settlement pending**.

Expected:

- payment `PAID`;
- a new settlement batch with status `PENDING`;
- `feesMinor = null`, `netMinor = null`;
- payment settlement dimension `PENDING`;
- reconciliation still `MATCHED`;
- no claim that funds reached a bank account.

Run **Settlement confirmed**.

Expected:

- newest pending demo batch becomes `SETTLED`;
- payment settlement dimension becomes `SETTLED`;
- payment capture does not change;
- fees are 2% of gross, rounded, with `feesSource = SIMULATED_FIXTURE`;
- net = gross − fees.

Open the returned **Settlement** link to see the batch and referenced payments.

If no pending demo settlement exists, the API returns `409 NO_PENDING_SETTLEMENT`. Run **Settlement pending** first.

### 7. Refund requested → completed

Run **Refund requested**.

Expected:

- payment remains `PAID`;
- refund record status `REQUESTED` for part of the payment (default `109950` of `219900` minor units);
- payment refund dimension `REQUESTED`;
- no reduction of captured revenue.

Open **Refunds** via the result link. Use the demo-only advancement action:

```text
REQUESTED → PROCESSING → REFUNDED
```

After the second advancement:

- refund record is `REFUNDED`;
- payment refund dimension is `PARTIALLY_REFUNDED` (because the refund covers part of the payment);
- payment status is still `PAID`;
- timeline has request, processing, and completion entries;
- a third advancement returns `409 INVALID_REFUND_TRANSITION`.

The advancement is explicit. No payment status change completes a refund automatically.

### 8. Event log evidence

Open **Event log**.

- Search by event key, provider event id, payment/order/transaction reference, or type.
- Filter by processing status or event type.
- Toggle **Duplicates only**.
- Open an event to see the five-stage timeline: received, signature, persisted, processed, reconciliation.
- Inspect delivery outcomes, linked payment/order, and sanitized payload summary.

Demo signatures are `SIMULATED`. A Razorpay webhook that fails HMAC verification would be recorded as `INVALID` / `REJECTED_SIGNATURE` and would never apply the payload.

### 9. Reset

In **Demo lab → Reset demo data**:

1. Type `RESET DEMO DATA` exactly.
2. The reset button remains disabled until the phrase matches.
3. Confirm in the dialog.

Expected:

- only `environment=demo` records are deleted;
- fixtures are reseeded immediately;
- the page returns to 24 transactions, 6 open exceptions, 9 settlements, 3 refunds, 25 events;
- the demo seed and reconciliation audit entries are recreated;
- a realtime `demo.reset` notification invalidates cached views.

Use **API-only reset**:

```bash
curl -X POST http://localhost:4000/api/v1/demo/reset \
  -H "Content-Type: application/json" \
  -d '{"confirm":"RESET DEMO DATA"}'
```

Wrong casing or a missing phrase returns `400 CONFIRMATION_REQUIRED`. When `DEMO_MODE=false`, reset and scenarios return `403 DEMO_DISABLED`.

## Scenario outcomes

| Scenario | What it creates | Expected payment | Settlement | Reconciliation | Refund |
| --- | --- | --- | --- | --- | --- |
| `payment_success` | Order + captured payment | `PAID` | `NOT_STARTED` | `MATCHED` | `NONE` |
| `payment_processing` | Order + authorized payment | `PROCESSING` | `NOT_STARTED` | `PENDING_RECONCILIATION` | `NONE` |
| `payment_pending` | Order + pending payment | `PENDING` | `NOT_STARTED` | `PENDING_RECONCILIATION` | `NONE` |
| `payment_failed` | Order + failed attempt | `FAILED` | `NOT_APPLICABLE` | `NOT_APPLICABLE` | `NONE` |
| `duplicate_webhook` | Paid payment + same event twice | `PAID` | `NOT_STARTED` | `MATCHED` | `NONE` |
| `amount_mismatch` | Order 149900 + payment 129900 (default) | `PAID` | `NOT_STARTED` | `AMOUNT_MISMATCH` | `NONE` |
| `missing_order` | Paid payment without an order | `PAID` | `NOT_STARTED` | `MISSING_ORDER` | `NONE` |
| `settlement_pending` | Paid payment + pending batch | `PAID` | `PENDING` | `MATCHED` | `NONE` |
| `settlement_confirmed` | Confirms newest pending batch | unchanged | `SETTLED` | unchanged | unchanged |
| `refund` | Paid payment + partial refund request | `PAID` | `NOT_STARTED` | `MATCHED` | `REQUESTED` |

`settlement_confirmed` changes settlement only. `refund` changes refund only after an explicit advancement.

## API-only verification

```bash
# Health and configuration
curl http://localhost:4000/api/v1/health
curl http://localhost:4000/api/v1/meta

# Fixture detail
curl "http://localhost:4000/api/v1/transactions?status=PAID&limit=3"
curl http://localhost:4000/api/v1/transactions/TXN-DEMO-0001

# Exception workspace
curl "http://localhost:4000/api/v1/reconciliation/exceptions?status=OPEN"
curl -X POST http://localhost:4000/api/v1/reconciliation/run \
  -H "Content-Type: application/json" \
  -d '{"scope":"all"}'

# Demo scenario
curl -X POST http://localhost:4000/api/v1/demo/scenarios \
  -H "Content-Type: application/json" \
  -d '{"scenario":"payment_success"}'

# Reset and reseed
curl -X POST http://localhost:4000/api/v1/demo/reset \
  -H "Content-Type: application/json" \
  -d '{"confirm":"RESET DEMO DATA"}'
```

The run response is `{ data: { run, statuses, openExceptionCount } }`. Scenario responses include the new references, which can be fed to the detail endpoints.

## Troubleshooting

| Symptom | Cause / action |
| --- | --- |
| Empty UI on first load | Confirm the API is on port 4000 and Vite is running; check `/api/v1/health`. |
| Scenarios unavailable | `DEMO_MODE=false`; set it to `true` and restart. |
| Reset button disabled | The phrase is not exactly `RESET DEMO DATA`. |
| Reset seems to do nothing | Existing demo fixtures were deleted and reseeded with new timestamps; counts should match the fixture inventory. |
| `NO_PENDING_SETTLEMENT` | Run **Settlement pending** before **Settlement confirmed**, or check pending demo batches in Demo lab. |
| Refund cannot advance | It is already `REFUNDED` or `FAILED`; only `REQUESTED`/`PROCESSING` advance. |
| `NOT_A_MISMATCH` | A custom `amountMinor` equal to the default order total `149900` was supplied. |
| Stale view after an action | Socket may be disconnected; the client falls back to 15-second query invalidation. Check the connection badge. |
| Data from earlier runs appears | `DEMO_SEED=true` seeds only when the demo store is empty. Use reset to return to fixtures. |

## What not to claim from this demo

- No Razorpay API call, live webhook, or signature from Razorpay was used.
- Demo signature state is `SIMULATED`; it is not verification of a real provider event.
- Settlement fees, expected dates, and deposits are fixtures, not bank records.
- Refund completion is a local demo transition, not a provider refund.
- There is no authentication, authorization, or production hardening.
- SQLite is a local single-node store; MongoDB is optional and was not load-tested here.
