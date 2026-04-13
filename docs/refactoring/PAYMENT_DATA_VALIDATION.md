# Payment data migration validation (TASK-47 / P4-OD)

Use after `npm run migrate:payment-data -- --dry-run` and again after `--load`.

## Enum and status normalization (legacy → payment-service)

### `Order.status`

| Legacy condition | Target |
|------------------|--------|
| `orders_order.trashed` | `canceled` |
| `paid = true` | `paid` |
| `paid = false`, `till_date` null or future date | `awaiting_payment` |
| `paid = false`, `till_date` ≤ today (date only) | `expired` |
| New rows created only in new API | `draft` (not used by this ETL) |

`trashedAt` on target: set to `orders_order.created` when `trashed` is true (legacy has no removed timestamp).

### `PaymentAttempt.method`

| Legacy source | Target `method` |
|---------------|-----------------|
| `orders_paypalpayment` | `paypal` |
| `orders_webpaypayment` | `webpay` |
| `orders_cspayment` | `card` |
| `orders_innerpayment` | `inner` |
| `orders_invoicepayment` | `invoice` |
| `orders_externalpayment.provider` | same string (`paypal`, `webpay`, …) |
| `orders_androidpayment` | **not loaded** (counted in dry-run) |
| No subclass row | `legacy_unknown` |

### `PaymentAttempt.status`

| Rule | Target |
|------|--------|
| `orders_externalpayment.status` present | Lowercased provider status (e.g. `completed`, `pending`) |
| Else `orders_payment.paid` non-null | `completed` |
| Else | `pending` |

### `DiscountTemplate.discountType`

| Legacy `discount_type` | Target |
|------------------------|--------|
| `percent` | `PERCENT` |
| `fixed` | `FIXED` |

### `FailedPayment.state` (legacy audit only)

Legacy values `new`, `obsolete`, `notified` are **not** copied into payment DB in Phase 4; see `PAYMENT_DATA_MAPPING.md`. Compare row counts via dry-run JSON (`failedPayments`).

---

## Orphans and integrity checks

Run on **legacy** (read-only):

```sql
-- Payments pointing at missing orders
SELECT COUNT(*) FROM orders_payment p
WHERE NOT EXISTS (SELECT 1 FROM orders_order o WHERE o.id = p.order_id);

-- Orders without user (skipped by ETL)
SELECT COUNT(*) FROM orders_order WHERE user_id IS NULL;
```

Run on **target** after load:

```sql
SELECT COUNT(*) FROM payment_attempts pa
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = pa.order_id);

SELECT COUNT(*) FROM discount_orders d
WHERE NOT EXISTS (SELECT 1 FROM discount_templates t WHERE t.code = d.discount_template_code);
```

Expect zero orphan `payment_attempts` if legacy was consistent (ETL skips payments whose order was skipped).

---

## Rollback (target DB only)

**Warning:** destroys migrated payment-service data. Take a DB snapshot before first `--load`.

```sql
BEGIN;
TRUNCATE TABLE
  webhook_events,
  idempotency_records,
  invoices,
  payment_attempts,
  discount_orders,
  subscriptions,
  orders,
  discount_products,
  discount_templates
RESTART IDENTITY CASCADE;
COMMIT;
```

Re-run `--load` after truncate if needed; idempotent inserts repopulate.

---

## Validator checklist (P4-OD)

- [x] Dry-run JSON: `orphanPayments` / `ordersMissingUser` reviewed.
- [x] `subscriptionLikeTables` in dry-run matches expectation (portal may have unrelated `subscription*` names).
- [x] Row counts: legacy `orders` ≈ target `orders` (minus orders with null `user_id`). _(Dry-run + `--load` 2026-04-13: `stats.orders` / `transform.orders` 31644, `ordersMissingUser` 0; target `SELECT count(*) FROM orders` = 31644 after load.)_
- [x] `paymentsSkippedAndroid` accepted by product owner. _(This run: 0 skipped; confirm policy if a future DB has Android rows.)_
- [x] Spot-check 5 paid orders: `status`, `price_minor`, `payment_attempts.method` / `paid_at`. _(Pre-load 2026-04-13: `--dry-run --spot-check` → `spot_check_pre_load` (legacy ids 38, 49, 252, 364, 503). Post-load: `--verify-post-load` → `spot_check_target_paid_orders` first five `paid` rows show `status` `paid`, `priceMinor` 9 / 150 / 50 / 950 / 250, `method`/`paid_at` consistent with `payment_attempts` (mix of `webpay` and `legacy_unknown` where subtype tables are missing on legacy).)_
- [x] Spot-check 3 discount templates + 1 `discount_orders` row. _(Pre-load: `ANNAGR10`, `B2DISCOU`, `BOOK10DS` + `TR831038` sample in `spot_check_pre_load`. Post-load: `--verify-post-load` → `spot_check_target_discounts` templates `10DISC4E`, `10NY2016`, `14DISC17`; sample `discount_order` `3MPXKEYT` on order `00092bfd-…`, `orderPriceMinor` 621.)_

**Dry-run 2026-04-13:** Logged `legacy_payment_subtables_missing` for this legacy DB: `orders_paypalpayment`, `orders_invoicepayment`, `orders_cspayment`, `orders_androidpayment` absent; ETL used `orders_externalpayment`, `orders_innerpayment`, `orders_webpaypayment` only.
