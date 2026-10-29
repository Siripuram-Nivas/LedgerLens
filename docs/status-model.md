# Status model

LedgerLens keeps four financial dimensions independent: **payment**, **settlement**, **reconciliation**, and **refund**. A value in one dimension is never copied into another to make the UI look consistent.

Example from the demo dataset:

```text
Payment TXN-DEMO-0003
  payment          PAID
  settlement       PENDING
  reconciliation   MATCHED
  refund           NONE
```

Captured money (`PAID`) can exist while the merchant has not been recorded as settled. A matching order/payment pair can still have a settlement failure. A refund request does not reduce captured revenue until a refund is actually completed.

Amounts are integer minor units (`149900` = ₹1,499.00). Currency is a three-letter ISO code. Amounts in different currencies are never added together.

## Payment dimension

Values: `PENDING`, `PROCESSING`, `PAID`, `FAILED`, `CANCELLED`.

| Value | Meaning | Captured funds? |
| --- | --- | --- |
| `PENDING` | Payment attempt exists; provider outcome is not final. | No |
| `PROCESSING` | Provider accepted/authorized or is still processing. | Not yet |
| `PAID` | A trusted capture event was applied. | Yes |
| `FAILED` | The attempt failed. | No |
| `CANCELLED` | The attempt was cancelled. | No |

### Event mapping

| Event type | Payment status |
| --- | --- |
| `payment.pending` | `PENDING` |
| `payment.authorized` | `PROCESSING` |
| `payment.captured` | `PAID` |
| `payment.failed` | `FAILED` |
| `payment.cancelled` | `CANCELLED` |

Other event types are retained for audit but do not change payment status.

### Transition rules

- A payment starts with the status supplied when it is created (seed/demo/provider import).
- A later processed event updates the status if its provider timestamp is **not older** than `payment.lastEventAt`.
- An older event is stored and marked unapplied; it does not change payment state.
- **`PAID` never regresses.** A newer event that would set `PENDING`, `PROCESSING`, `FAILED`, or `CANCELLED` is retained for audit but not applied.
- A non-`PAID` attempt can move to any mapped status through a newer event. This permits a provider correction or a late capture on the same attempt.
- Entering `FAILED` or `CANCELLED` sets settlement to `NOT_APPLICABLE` and reconciliation to `NOT_APPLICABLE` until a later event/reconciliation run changes them.
- Event application never infers settlement or refund state.

## Settlement dimension (on the payment)

Values: `NOT_APPLICABLE`, `NOT_STARTED`, `PENDING`, `SETTLED`, `FAILED`, `UNKNOWN`.

| Value | Meaning |
| --- | --- |
| `NOT_APPLICABLE` | The attempt failed/was cancelled; no captured funds can settle. |
| `NOT_STARTED` | Captured or in-flight payment with no settlement record referencing it. |
| `PENDING` | A recorded settlement batch references the payment but is not confirmed. |
| `SETTLED` | A recorded batch is confirmed as settled. |
| `FAILED` | A settlement batch referencing the payment failed. |
| `UNKNOWN` | Settlement state cannot be mapped from available records. |

Rules:

- New non-terminal payments start at `NOT_STARTED`; failed/cancelled payments start at `NOT_APPLICABLE`.
- A pending settlement batch explicitly sets the referenced payments to `PENDING`.
- Settlement confirmation explicitly sets the referenced payments to `SETTLED`.
- Payment capture never changes settlement by itself.
- A settlement failure does not change payment capture.
- Settlement values are recorded from a settlement batch or demo fixture; LedgerLens does not derive them from payment success.

## Settlement record dimension

Values: `PENDING`, `SETTLED`, `FAILED`, `UNKNOWN`.

| Value | Meaning |
| --- | --- |
| `PENDING` | Batch recorded, not confirmed. Fees/net may be `null`. |
| `SETTLED` | Batch confirmed. Gross, fees, and net are recorded when available. |
| `FAILED` | Batch failed. Capture is unchanged. |
| `UNKNOWN` | Provider batch status cannot be mapped. |

The demo seed uses `SETTLED`, `PENDING`, and `FAILED` batches. Demo confirmation computes fees at 2% of gross and labels `feesSource=SIMULATED_FIXTURE`. No bank deposit is claimed.

## Reconciliation dimension (on the payment)

Values: `MATCHED`, `PENDING_RECONCILIATION`, `MISSING_ORDER`, `MISSING_PAYMENT`, `AMOUNT_MISMATCH`, `CURRENCY_MISMATCH`, `DUPLICATE_EVENT`, `DUPLICATE_PAYMENT`, `UNDER_REVIEW`, `NOT_APPLICABLE`.

| Value | Set when | Explanation |
| --- | --- | --- |
| `MATCHED` | Captured total and currency equal the order total/currency. | No active discrepancy. |
| `PENDING_RECONCILIATION` | Attempt is `PENDING` or `PROCESSING`, or was just changed by an event and awaits a run. | Outcome is not final. |
| `MISSING_ORDER` | A non-terminal payment has no linked order. | Financial record has no expected side. |
| `MISSING_PAYMENT` | An order has no payment attempt. | Exception-level state; there is no payment row to store this value on. |
| `AMOUNT_MISMATCH` | Captured total differs from the order total. | Shortfall or single-capture excess. |
| `CURRENCY_MISMATCH` | A captured payment currency differs from the order currency. | Amounts are not comparable without FX. |
| `DUPLICATE_EVENT` | A matched payment has more than one distinct applied `payment.captured` event key. | Distinct event IDs, not repeated deliveries of one ID. |
| `DUPLICATE_PAYMENT` | Two or more captured payments total more than the order total. | Multiple captures are never merged silently. |
| `UNDER_REVIEW` | Defined for operator review. | The current engine does not derive it; assigning an exception changes the **exception** status, not the payment dimension. |
| `NOT_APPLICABLE` | Attempt is `FAILED` or `CANCELLED`. | No captured funds to reconcile. |

### Documented extensions

The requested model used the reconciliation states above except `NOT_APPLICABLE`, which LedgerLens adds because a failed/cancelled attempt with no captured money should not be called pending or matched. `DUPLICATE_PAYMENT` is also an explicit extension: when multiple captures exceed the order total, the engine raises a distinct exception instead of reporting a generic amount mismatch.

### Reconciliation transition rules

- Every run recomputes the dimension for evaluated payments.
- `FAILED`/`CANCELLED` take precedence and become `NOT_APPLICABLE`.
- `MISSING_ORDER` is assigned before amount comparison.
- Non-captured attempts with an order stay `PENDING_RECONCILIATION` until capture or terminal failure.
- Captured attempts are evaluated at order level so split captures and multiple attempts are compared together.
- A currency mismatch takes precedence over amount mismatch.
- A captured total **equal** to the order total is `MATCHED`, even when it is made of multiple captures.
- A captured total **above** the order total is `DUPLICATE_PAYMENT` when more than one payment is captured, otherwise `AMOUNT_MISMATCH`.
- A captured total **below** the order total is `AMOUNT_MISMATCH`.
- `DUPLICATE_EVENT` is checked only after the amount/currency comparison succeeds; it changes a `MATCHED` payment to `DUPLICATE_EVENT`.
- Re-running reconciliation does not reopen a resolved exception. See [reconciliation-rules.md](reconciliation-rules.md).

## Refund dimension (on the payment)

Values: `NONE`, `REQUESTED`, `PROCESSING`, `PARTIALLY_REFUNDED`, `REFUNDED`, `FAILED`.

The payment-level value is **derived from refund records** by `LedgerRepository.deriveRefundStatus()`:

1. No refund records → `NONE`.
2. Sum refund records with status `REFUNDED` or `PARTIALLY_REFUNDED`:
   - total ≥ payment amount → `REFUNDED`;
   - total > 0 and < payment amount → `PARTIALLY_REFUNDED`.
3. Else, any `PROCESSING` record → `PROCESSING`.
4. Else, any `REQUESTED` record → `REQUESTED`.
5. Else, any `FAILED` record → `FAILED`.
6. Otherwise → `NONE`.

A refund request never reduces captured revenue. The payment remains `PAID` while `refundStatus` is `REQUESTED`, `PROCESSING`, `PARTIALLY_REFUNDED`, or `REFUNDED`.

## Refund record dimension

Values: `REQUESTED`, `PROCESSING`, `PARTIALLY_REFUNDED`, `REFUNDED`, `FAILED`.

| Value | Meaning |
| --- | --- |
| `REQUESTED` | Request recorded; no completion. |
| `PROCESSING` | Provider processing simulated/recorded; not complete. |
| `PARTIALLY_REFUNDED` | A completed refund covers only part of the payment (supported as a record state; the demo flow reaches this at the payment level after a partial refund is completed). |
| `REFUNDED` | The refund is complete. |
| `FAILED` | The refund did not complete. |

Demo transition only:

```text
REQUESTED → PROCESSING → REFUNDED
```

Each transition requires an explicit `POST /api/v1/refunds/:reference/advance-demo`. Further advancement returns `409 INVALID_REFUND_TRANSITION`. A completed refund is terminal for incoming provider events. No refund is inferred from a payment status.

## Exception status dimension

Values: `OPEN`, `UNDER_REVIEW`, `RESOLVED`.

| Value | Meaning |
| --- | --- |
| `OPEN` | Newly detected and not assigned. |
| `UNDER_REVIEW` | Assigned to an operator. |
| `RESOLVED` | A decision and note were recorded. |

Resolution types: `EVIDENCE_VERIFIED`, `FALSE_POSITIVE`, `ADJUSTED_EXTERNALLY`, `ACCEPTED_AS_IS`, plus the system-only `AUTO_CLEARED` when a discrepancy disappears on a later run.

Resolving an exception does not alter financial records. Re-runs update active exceptions in place and preserve resolutions.

## Event and delivery dimensions

Event processing: `RECEIVED`, `PROCESSED`, `FAILED`.

Delivery outcome: `ACCEPTED`, `DUPLICATE`, `REPROCESSED`, `REJECTED_SIGNATURE`, `INVALID`.

Signature status: `VERIFIED`, `SIMULATED`, `INVALID`, `NOT_AVAILABLE`.

- A first accepted delivery is `ACCEPTED`.
- A repeated delivery of an existing event key is `DUPLICATE`; the financial effect is not repeated.
- A retry of a previously `FAILED` event is `REPROCESSED`; it may apply once if processing succeeds.
- An invalid Razorpay signature records a synthetic failed event plus a `REJECTED_SIGNATURE` delivery. The payload is not parsed or applied.
- Demo events are `SIMULATED`; they are never labeled `VERIFIED`.

## Reconciliation run dimension

Run status: `RUNNING`, `COMPLETED`, `FAILED`.

Each run stores counts for payments/orders evaluated, matched, pending, not applicable, exceptions created/updated/auto-resolved, and duplicate events detected. A failed run stores a truncated error message and is visible in run history.

## Invariants

1. A settlement status is never inferred from `payment.status`.
2. A refund status is never inferred from `payment.status`.
3. A failed/cancelled payment has no captured funds; settlement and reconciliation are `NOT_APPLICABLE`.
4. `PAID` cannot regress through an event.
5. Duplicate delivery of one event key applies at most one financial effect.
6. Distinct capture event IDs for one payment are a reviewable duplicate-event exception.
7. More than one captured payment over an order total is `DUPLICATE_PAYMENT`, not a silent merge.
8. Amounts are compared only in integer minor units and only within the same currency.
9. Operator resolutions are preserved across reconciliation re-runs.
10. Demo records are isolated as `environment=demo`; demo reset never deletes sandbox/live records.
