# Dashboard metrics

The Overview page reads `GET /api/v1/dashboard/summary`. The response is defined by `server/src/services/dashboardService.ts`; the UI does not compute financial totals on the client.

All money values are integer minor units. The API returns both a display-oriented primary value and a per-currency breakdown. **Per-currency arrays are authoritative; primary fields are a convenience for the headline card.**

## Range resolution

| `range` | Window | Trend bucket |
| --- | --- | --- |
| `24h` | Last 24 hours from "now" | Hour |
| `7d` | Last 7 days | Day |
| `30d` | Last 30 days | Day |
| `custom` | `from` required, optional `to` | Hour when span ≤ 48 h, otherwise day |

Rules:

- `to` defaults to now and may not be more than 5 minutes in the future.
- `custom` requires `from`; `from` must be before `to`; the span is limited to 366 days.
- All filtering and bucketing is UTC.
- Empty trend buckets are filled with zeroes. The filler is capped defensively at 400 points.
- Invoice/list `from`/`to` filters are inclusive and apply to `createdAt`. The dashboard follows the same range convention.

## Metric definitions

| Metric | Definition | Range applied? |
| --- | --- | --- |
| `totalTransactions` | Count of payment rows created in range | Yes |
| `successfulPayments` | Payments with `status=PAID` | Yes |
| `pendingPayments` | Payments with `PENDING` **or** `PROCESSING` | Yes |
| `failedPayments` | Payments with `FAILED` | Yes |
| `cancelledPayments` | Payments with `CANCELLED` | Yes |
| `valueProcessedMinor` | Sum of `amountMinor` for `PAID` payments in the primary currency | Yes |
| `valueProcessedCurrency` | Primary currency for captured value | — |
| `valueByCurrency` | `[{ currency, amountMinor }]` for `PAID` payments | Yes |
| `openExceptions` | Count of `OPEN` + `UNDER_REVIEW` exceptions | **No** — all ages in environment |
| `pendingReconciliation` | Payments with `reconciliationStatus=PENDING_RECONCILIATION` | Yes |
| `settlementPending` | Count of settlement batches with `status=PENDING` | Yes (batch `createdAt`) |
| `settlementPendingPayments` | Payments with `settlementStatus=PENDING` | Yes (payment `createdAt`) |
| `settlementPendingGrossMinor` | Sum of `grossMinor` for `PENDING` batches in primary pending currency | Yes (batch `createdAt`) |
| `settlementPendingCurrency` | Primary currency for pending settlement gross | — |
| `settlementPendingGrossByCurrency` | Pending gross grouped by batch currency | Yes |
| `settledSettlements` | Count of settlement batches with `status=SETTLED` | Yes (batch `createdAt`) |
| `settledGrossMinor` | Sum of `grossMinor` for `SETTLED` batches in primary settled currency | Yes |
| `settledFeesMinor` | Sum of `feesMinor` for `SETTLED` batches | Yes |
| `settledNetMinor` | Sum of `netMinor` for `SETTLED` batches | Yes |
| `settlementCurrency` | Primary currency for settled gross | — |
| `settledGrossByCurrency` | Settled gross grouped by batch currency | Yes |
| `settledFeesByCurrency` | Settled fees grouped by batch currency | Yes |
| `settledNetByCurrency` | Settled net grouped by batch currency | Yes |

`openExceptions` intentionally ignores the range: an old unresolved exception is still operationally open. The UI copy states this.

## Primary currency selection

For each grouped money metric:

1. Use `INR` when an INR group exists.
2. Otherwise use the first group. Group results are ordered by descending total in both stores, so this is the highest-value currency.
3. If there are no rows, use `INR` for the primary code and `0` for the amount.

Payment value and settlement value choose their primary currency independently. The UI displays:

- **Value captured** — `valueProcessedMinor` / `valueProcessedCurrency`; the hint lists every currency when `valueByCurrency.length > 1`.
- **Settlement pending** — `settlementPendingGrossMinor` / `settlementPendingCurrency`.

**No FX conversion is performed.** Never add `amountMinor` values from different currencies. Use the `*ByCurrency` arrays for cross-currency reporting.

## Distributions

`statusDistribution` always contains all five payment statuses in fixed order, including zero counts, for payments created in range.

`settlementDistribution` contains all six settlement states from the **payment dimension** for payments created in range:

```text
NOT_APPLICABLE, NOT_STARTED, PENDING, SETTLED, FAILED, UNKNOWN
```

It is not a count of settlement batches. Batch counts are in `settlementPending` and `settledSettlements`.

## Trend

`trend` is payment-attempt activity, not captured-only activity. Each bucket contains:

| Field | Meaning |
| --- | --- |
| `bucket` | UTC hour (`YYYY-MM-DDTHH:00:00.000Z`) or UTC day (`YYYY-MM-DD`) |
| `count` | Payment attempts created in the bucket |
| `value` | Sum of **all** attempt amounts in the bucket, regardless of status |
| `successCount` | Attempts with `status=PAID` |

The chart labels the value series "attempt value" for this reason. It is not the same as `valueProcessedMinor`, which filters to `PAID`.

## Recent panels

These lists are not range-filtered; they are the latest rows in the current environment:

| Field | Limit |
| --- | --- |
| `recentTransactions` | 6 payments, newest first |
| `recentExceptions` | 5 active exceptions, newest first |
| `recentEvents` | 6 events, newest first |
| `recentSettlements` | 4 batches, newest first |
| `recentRefunds` | 3 refunds, newest first |
| `latestRun` | 1 latest reconciliation run |

`latestRun` includes run status, scope, trigger, timestamps, and all counts. See [reconciliation-rules.md](reconciliation-rules.md#run-counts).

## Scope notes in the response

`scopeNotes` makes the semantics explicit:

- `transactionMetrics` — payments created in the resolved UTC window.
- `valueProcessed` — captured (`PAID`) amounts, minor units.
- `openExceptions` — all `OPEN`/`UNDER_REVIEW` exceptions in the environment, regardless of age.
- `settlementMetrics` — recorded batches created in the window; settlement is never inferred.
- `simulated` — `true` when the environment is `demo`.

## Example

```bash
curl "http://localhost:4000/api/v1/dashboard/summary?range=7d"
```

```json
{
  "data": {
    "range": {
      "preset": "7d",
      "from": "2026-10-22T00:00:00.000Z",
      "to": "2026-10-29T00:00:00.000Z",
      "granularity": "day",
      "label": "Last 7 days"
    },
    "metrics": {
      "totalTransactions": 12,
      "successfulPayments": 9,
      "pendingPayments": 2,
      "failedPayments": 1,
      "valueProcessedMinor": 1599200,
      "valueProcessedCurrency": "INR",
      "valueByCurrency": [
        { "currency": "INR", "amountMinor": 1599200 }
      ],
      "openExceptions": 6,
      "settlementPending": 1,
      "settlementPendingPayments": 1,
      "settlementPendingGrossMinor": 249900,
      "settlementPendingCurrency": "INR",
      "settlementPendingGrossByCurrency": [
        { "currency": "INR", "amountMinor": 249900 }
      ]
    },
    "scopeNotes": {
      "transactionMetrics": "Payments created between ... and ... (UTC).",
      "valueProcessed": "Sum of captured (PAID) payment amounts in the selected range, minor units.",
      "openExceptions": "All OPEN or UNDER_REVIEW exceptions in this environment, regardless of age.",
      "settlementMetrics": "Recorded settlement batches created in the selected range. No settlement is inferred from payment success.",
      "simulated": true
    }
  }
}
```

The numbers above are illustrative, not a live fixture guarantee; fixture counts change after demo scenarios and reset.
