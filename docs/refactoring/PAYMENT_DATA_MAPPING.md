# Legacy → speakasap-payment-service data mapping (TASK-45)

**Sources verified:** `speakasap-portal/orders/models.py`, `orders/paypal/models.py`, `orders/invoice/models.py`, `speakasap-portal/discount/models.py`.  
**Clarification:** `ROADMAP.md` lists a `subscription` Django app; **no `subscription` package** was found under `speakasap-portal` in this workspace. Treat **subscription** as a **new** aggregate in `speakasap_payment_db` until legacy tables are confirmed (TASK-47 dry-run). Email marketing “subscriptions” live under `delivery.UserDelivery` — **out of scope** for payment wave unless explicitly reopened.

---

## Enum normalization

### Order payment state

| Legacy signal | Target `Order.status` |
|---------------|------------------------|
| `Order.paid == True` | `paid` |
| `Order.paid == False`, not trashed, `till_date` null or future | `awaiting_payment` |
| `Order.paid == False`, `till_date` set and <= today | `expired` |
| Trashed order (`TrashMixin`) | `canceled` (or exclude from active queries) |
| New API-only row before checkout | `draft` |

### Payment method / provider type

| Legacy `Payment` subclass / field | Target `PaymentAttempt.method` (example) | payments-ms `paymentMethod` |
|-----------------------------------|------------------------------------------|------------------------------|
| `PaypalPayment` | `paypal` | Provider enum as returned by ms |
| `WebpayPayment` / `CSPayment` | `webpay` / `card` | `WEBPAY` / card |
| `InnerPayment` | `inner` | `INNER` |
| `InvoicePayment` | `invoice` | `INVOICE` |
| `ExternalPayment` (microservice bridge) | `external` | As stored by ms |

### Discount type

| Legacy `DiscountTemplate.discount_type` | Target |
|----------------------------------------|--------|
| `percent` | `PERCENT` |
| `fixed` | `FIXED` |

### Failed payment state

| Legacy `FailedPayment.state` | Target audit / mirror |
|------------------------------|-------------------------|
| `new`, `obsolete`, `notified` | Preserve as `FailedPaymentState` enum on audit row or JSON metadata |

---

## Table mapping (conceptual Prisma / SQL)

### `Order` ← `orders_order`

| Legacy column | Target field | Notes |
|---------------|--------------|-------|
| `id` | `legacyOrderId` or `id` (if preserving pk in migration) | TASK-47 chooses stable id: recommend new UUID `id` + `legacyId` int unique |
| `user_id` | `userId` | FK logical to user-service |
| `price` | `priceMinor` | Integer EUR minor units consistent with legacy (whole euros today) |
| `title` | `title` | |
| `comment` | `comment` | |
| `paid` | `paid` + drives `status` | |
| `sticky` | `sticky` | |
| `discountable` | `discountable` | |
| `deletable` | `deletable` | |
| `created` | `createdAt` | |
| `product_id` | `productId` | Nullable |
| `additional` | `additional` | Text JSON string → JSON column |
| `data` | `data` | JSONB |
| `till_date` | `tillDate` | Date |
| Trash flags | `trashedAt` / `deletedAt` | Align TrashMixin columns |

### `PaymentAttempt` ← `orders_payment` (+ subclasses)

| Legacy column | Target field | Notes |
|---------------|--------------|-------|
| `id` | `legacyPaymentId` | |
| `order_id` | `orderId` | |
| `amount` | `amountMinor` | |
| `paid` (datetime) | `paidAt` | |
| `uuid` | `publicUuid` | Unique, used in legacy URLs |
| `payment_id`, `url` (PayPal) | `providerPayload` JSON or columns | |
| Invoice `number`, `ruble`, `received`, `actual_amount` | `InvoiceDetail` table or JSON | |

### `Transaction` ← `orders_transaction`

| Legacy | Target | Notes |
|--------|--------|-------|
| `user_id` | `userId` | Could remain in payment-db for ledger or move to financial-service later; ROADMAP assigns orders to payment-service |
| `amount`, `comment`, `order_id`, `is_income`, `external` | Same shape | `financial-service` split is later; for Phase 4 keep in payment-db if needed for inner balance |

### `DiscountTemplate` ← `discount_discounttemplate`

| Legacy | Target | Notes |
|--------|--------|-------|
| `code` (PK) | `code` | Uppercased preserved |
| `single_user`, `enabled`, `discount`, `discount_type`, `valid_till`, `comment`, `permanent`, `course_discount` | Same | |
| M2M `products` | `DiscountProduct` join table | Store `productId` list |

### `DiscountOrder` ← `discount_discountorder`

| Legacy | Target | Notes |
|--------|--------|-------|
| `order_id` | `orderId` | One-to-one |
| `discount_template_id` | `discountTemplateCode` | FK to template `code` |

### `Subscription` (new)

| Purpose | Target | Notes |
|---------|--------|-------|
| Recurring billing agreement | `Subscription` | `userId`, `status` (`active`/`canceled`/`past_due`), `currentPeriodEnd`, `paymentsMicroserviceCustomerId?`, `orderId?` — **fill after** legacy source confirmed |

### `UserDelivery` / `delivery` app

| | |
|-|-|
| **No migration in payment-service** | Marketing lists; not course billing. |

---

## Webhook / provider reference mapping

| payments-ms `paymentId` | Stored on `PaymentAttempt.providerPaymentId` |
|---------------------------|-----------------------------------------------|
| `orderId` passed to ms | Our `Order.id` or `publicUuid` — **must be decided once** in TASK-46 (recommend internal `orderId` string) |

---

## Indices (minimum)

- `Order(userId, createdAt DESC)`
- `PaymentAttempt(orderId)`
- `PaymentAttempt(publicUuid)` unique
- `DiscountTemplate(code)` PK
- `DiscountOrder(orderId)` unique
- Webhook idempotency: unique `(eventId)` or `(provider, paymentId, status, occurredAt)`

---

## Addendum: subscription ownership (frozen decision)

- **Payment-service** owns: subscription **billing** state, renewal invoices/charges, linkage to payments-ms.
- **Education-service** owns: entitlements, course access, lesson scheduling.
- Coupling: asynchronous **events** (`order.paid`, future `subscription.renewed`); no synchronous “can access course?” call from payment to education DB.

---

## TASK-47 migration checklist (inputs to ETL)

1. Row counts: `orders_order`, `orders_payment`, subclasses, `orders_transaction`, `discount_*`.
2. Orphans: payments without orders; orders without users.
3. Duplicate PayPal/WebPay rows per order policy (latest wins vs merge).
4. Confirm whether `subscription` tables exist in production DB under a different schema name.
