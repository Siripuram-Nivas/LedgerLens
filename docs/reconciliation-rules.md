# Reconciliation rules

The engine is deterministic, order-level, and explainable. It compares expected orders with captured payments, stores evidence for every exception, and never changes settlement or refund state.

Source of truth: `server/src/services/reconciliationService.ts`. The same summary is exposed at `GET /api/v1/meta` under `reconciliationRules`.

## Scope

`POST /api/v1/reconciliation/run` accepts:

- `{ "scope": "all" }` (default) — every payment and order in the current environment.
- `{ "scope": "payment", "transactionRef": "TXN-..." }` — the selected payment, its order, and all sibling payment attempts for that order, so order-level totals remain correct.

A payment-scoped run still writes a normal run record (`scope: "payment:<transactionRef>"`) and publishes the same completion event. A payment-refresh after webhook processing uses this scoped path.

## Evaluation order

For each run:

1. **Create the run** with status `RUNNING` and zeroed counts.
2. **Load scope** (payments/orders for the environment, or the payment plus its order/siblings).
3. **Mark failed/cancelled attempts** `NOT_APPLICABLE` and skip monetary checks.
4. **Check missing orders**: a non-terminal payment with no linked order → `MISSING_ORDER`.
5. **Leave non-captured attempts pending**: a `PENDING`/`PROCESSING` payment with an order → `PENDING_RECONCILIATION`.
6. **Check missing payments**: an order with zero payment attempts → `MISSING_PAYMENT` exception.
7. **Group captured attempts by order** and compare them as a single expected-vs-observed total.
8. **Check currency**: any captured payment whose currency differs from the order → `CURRENCY_MISMATCH` for all captured attempts on the order.
9. **Compare totals in minor units**:
   - observed > expected and more than one captured payment → `DUPLICATE_PAYMENT`;
   - observed > expected with one captured payment → `AMOUNT_MISMATCH`;
   - observed < expected → `AMOUNT_MISMATCH`;
   - observed == expected → `MATCHED`.
10. **Check distinct capture events** for matched payments: more than one applied, processed `payment.captured` event key → `DUPLICATE_EVENT`.
11. **Persist payment statuses** that changed.
12. **Create/update exceptions by fingerprint**.
13. **Auto-clear active exceptions** that were evaluated in this scope and are no longer present.
14. **Finish the run** with counts, append an audit record, and publish `reconciliation.completed`.

## Rule table

| Rule | Payment dimension | Exception type | Severity | Key evidence |
| --- | --- | --- | --- | --- |
| Payment failed/cancelled | `NOT_APPLICABLE` | none | — | No captured funds |
| Payment has no order | `MISSING_ORDER` | `MISSING_ORDER` | `HIGH` | Observed payment amount/currency, provider payment ID |
| Order has no payment attempt | (no payment row) | `MISSING_PAYMENT` | `MEDIUM` | Expected order amount/currency/customer |
| Non-captured attempt with order | `PENDING_RECONCILIATION` | none | — | Attempt is pending/processing |
| Captured currency differs | `CURRENCY_MISMATCH` | `CURRENCY_MISMATCH` | `HIGH` | Expected/observed currency plus related payments |
| Captured total above order, multiple captures | `DUPLICATE_PAYMENT` | `DUPLICATE_PAYMENT` | `HIGH` | Expected/observed totals, difference, related payments |
| Captured total above order, one capture | `AMOUNT_MISMATCH` | `AMOUNT_MISMATCH` | `HIGH` | Expected/observed totals, difference |
| Captured total below order | `AMOUNT_MISMATCH` | `AMOUNT_MISMATCH` | `HIGH` | Shortfall amount |
| Captured total equals order | `MATCHED` | none | — | Amount/currency equality |
| Matched but multiple distinct capture event keys | `DUPLICATE_EVENT` | `DUPLICATE_EVENT` | `LOW` | Event keys, order/payment evidence |

`MISSING_PAYMENT` is an exception-level state because there is no payment document on which to store a reconciliation status.

## Exact comparisons

- Amounts are compared as **integer minor units**. There is no floating-point money arithmetic.
- Currency must match exactly (uppercase ISO-4217 code) before amounts are comparable.
- Captured means `status === "PAID"`. `PENDING`, `PROCESSING`, `FAILED`, and `CANCELLED` attempts do not contribute captured value.
- Multiple `PAID` attempts under one order are summed. Split captures that exactly equal the order total are `MATCHED`.
- More than one `PAID` attempt is `DUPLICATE_PAYMENT` only when the total **exceeds** the order total. Two captures that fall short are `AMOUNT_MISMATCH`.
- A single over-capture is `AMOUNT_MISMATCH`, not `DUPLICATE_PAYMENT`, because there is no second capture.
- Provider payment IDs are never merged by amount alone. Matching uses the stable order reference.

## Exception fingerprints and idempotency

Fingerprints are stable per environment and discrepancy:

```text
<environment>:MISSING_ORDER:<providerPaymentId>
<environment>:MISSING_PAYMENT:<orderRef>
<environment>:CURRENCY_MISMATCH:<orderRef>
<environment>:AMOUNT_MISMATCH:<orderRef>
<environment>:DUPLICATE_PAYMENT:<orderRef>
<environment>:DUPLICATE_EVENT:<providerPaymentId>
```

The fingerprint is unique in the store.

- First detection creates an `OPEN` exception with `timesSeen: 1`, `firstDetectedAt`, `lastDetectedAt`, and the current `runId`.
- A later run that still sees the same discrepancy updates the **active** exception in place: `lastDetectedAt`, `timesSeen`, evidence, explanation, suggested action, severity, and amounts. It does not create a duplicate.
- A `RESOLVED` exception is not reopened or edited by a later run. The operator decision is preserved.
- Auto-clear only applies to active exceptions whose `transactionRef` or `orderRef` was evaluated in the run. It sets `RESOLVED`, `resolutionType: AUTO_CLEARED`, a run-specific note, and `resolvedAt`.
- Active exceptions outside the evaluated scope are left untouched. A payment-scoped run therefore does not clear unrelated order/exception records.

This makes re-runs safe and keeps a readable history without duplicating the same problem.

## Evidence model

Every exception stores:

- `expectedAmountMinor` / `observedAmountMinor` / `differenceMinor`;
- `expectedCurrency` / `observedCurrency`;
- an `evidence` object with the order, the payment, related order payments, and (for duplicate events) event keys;
- a human-readable `explanation` with formatted amounts;
- a `suggestedAction` describing the next verification step;
- `firstDetectedAt` / `lastDetectedAt` / `timesSeen`;
- assignment and resolution fields;
- environment and source.

The UI shows this evidence in the exception drawer. Suggested actions are guidance, not automatic corrections.

## Example: amount mismatch

Demo scenario `amount_mismatch`:

```text
Order             INR 1,499.00 (149900 minor)
Captured payment  INR 1,299.00 (129900 minor)
Difference        INR   200.00 (20000 minor)
Payment status    AMOUNT_MISMATCH
Exception         AMOUNT_MISMATCH / HIGH / OPEN
```

The exception contains both records. Resolving it records a decision but does not edit either amount.

## Example: duplicate payment

Demo fixture `ORD-DEMO-1023` has two `PAID` attempts of `499900` minor each:

```text
Order total       499900
Captured total    999800
Difference        499900
Payment status    DUPLICATE_PAYMENT (both attempts)
Exception         DUPLICATE_PAYMENT / HIGH / OPEN
```

## Duplicate delivery vs duplicate event

These are deliberately different:

- **Repeated delivery of the same event key** — one `PaymentEvent` row, multiple `EventDelivery` rows. The second delivery is `DUPLICATE`, `applied=false`, and the event's `duplicateDeliveryCount` increments. No exception is created.
- **Distinct capture event IDs for the same payment** — two `PaymentEvent` rows. Both are retained and processed; the matched payment becomes `DUPLICATE_EVENT` with a `LOW` severity exception listing the event keys.

## Run counts

Each run stores:

| Count | Meaning |
| --- | --- |
| `paymentsEvaluated` | Payment rows loaded in scope |
| `ordersEvaluated` | Order rows loaded in scope |
| `matched` | Payments assigned `MATCHED` |
| `pending` | Payments assigned `PENDING_RECONCILIATION` |
| `notApplicable` | Payments assigned `NOT_APPLICABLE` |
| `exceptionsCreated` | New fingerprints inserted |
| `exceptionsUpdated` | Active existing fingerprints refreshed |
| `exceptionsAutoResolved` | Active exceptions cleared because the discrepancy disappeared |
| `duplicateEventsDetected` | `DUPLICATE_EVENT` drafts in the run |

A run failure marks the run `FAILED` with a short error and does not pretend the pass succeeded.

## What the engine does not do

- It does not infer settlement from payment capture.
- It does not create or advance refunds.
- It does not calculate fees, net settlement, or bank deposits.
- It does not convert currencies or compare across currencies.
- It does not fuzzy-match payments by amount or customer name.
- It does not rewrite orders, payments, settlements, or refunds when an exception is resolved.
- It does not run on a schedule. Runs happen on demand, after processed events, and after demo seeding/actions.
