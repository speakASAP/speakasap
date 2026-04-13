# Payment data migration log (TASK-47 / P4-OD)

Append-only log of ETL runs. Each run is appended when `payment-service` migration is executed with `--write-docs`, or paste JSON lines from stdout below.

**Script:** `cd payment-service && npm run migrate:payment-data -- --dry-run --write-docs` (dry) or `--load --write-docs` (apply).

**Env:** `PAYMENT_LEGACY_DATABASE_URL` (read-only legacy), `PAYMENT_DATABASE_URL` (target). Credentials must never be committed; use `speakasap/.env` only.

**Idempotency:** Deterministic UUIDv5 for `orders.id` / `payment_attempts.id` / `invoices.id`; `createMany` with `skipDuplicates: true` on PK/unique keys. Safe rerun.

**Excluded from load:** `orders_androidpayment` rows (obsolete per roadmap). Counts appear in JSON `paymentsSkippedAndroid`.

**Not migrated (no Prisma models / out of scope):** `orders_transaction` (counts only), `orders_failedpayment` (audit enum preserved in mapping doc only), `Subscription` rows (no legacy billing table in portal).

---

## Runs

## Run 2026-04-13T19:30:53.579Z

```json
{
  "dryRun": true,
  "stats": {
    "orders": 31644,
    "payments": 43626,
    "paymentsAndroid": 0,
    "transactions": 37071,
    "failedPayments": 808,
    "discountTemplates": 8691,
    "discountOrders": 2277,
    "discountM2mRows": 5102,
    "orphanPayments": 0,
    "ordersMissingUser": 0,
    "subscriptionLikeTables": [],
    "paymentSubtypeTables": [
      "orders_externalpayment",
      "orders_innerpayment",
      "orders_webpaypayment"
    ]
  },
  "ordersSkippedNoUser": 0,
  "transform": {
    "orders": 31644,
    "paymentAttempts": 43626,
    "paymentsSkippedAndroid": 0,
    "paymentsSkippedMissingOrder": 0
  }
}
```

## Run 2026-04-13T19:37:38.395Z

```json
{
  "dryRun": true,
  "stats": {
    "orders": 31644,
    "payments": 43626,
    "paymentsAndroid": 0,
    "transactions": 37071,
    "failedPayments": 808,
    "discountTemplates": 8691,
    "discountOrders": 2277,
    "discountM2mRows": 5102,
    "orphanPayments": 0,
    "ordersMissingUser": 0,
    "subscriptionLikeTables": [],
    "paymentSubtypeTables": [
      "orders_externalpayment",
      "orders_innerpayment",
      "orders_webpaypayment"
    ]
  },
  "ordersSkippedNoUser": 0,
  "transform": {
    "orders": 31644,
    "paymentAttempts": 43626,
    "paymentsSkippedAndroid": 0,
    "paymentsSkippedMissingOrder": 0
  }
}
```

## Run 2026-04-13T19:43:57.706Z

```json
{
  "dryRun": false,
  "stats": {
    "orders": 31644,
    "payments": 43626,
    "paymentsAndroid": 0,
    "transactions": 37071,
    "failedPayments": 808,
    "discountTemplates": 8691,
    "discountOrders": 2277,
    "discountM2mRows": 5102,
    "orphanPayments": 0,
    "ordersMissingUser": 0,
    "subscriptionLikeTables": [],
    "paymentSubtypeTables": [
      "orders_externalpayment",
      "orders_innerpayment",
      "orders_webpaypayment"
    ]
  },
  "ordersSkippedNoUser": 0,
  "transform": {
    "orders": 31644,
    "paymentAttempts": 43626,
    "paymentsSkippedAndroid": 0,
    "paymentsSkippedMissingOrder": 0
  }
}
```
