# Course Service API Contract (design freeze — TASK-35)

**Service:** `speakasap-course-service` (port **4205** per `docs/infrastructure/PORT_ALLOCATION.md`; process `PORT` from `.env`). **Base path:** `/api/v1`. **Health:** `GET /health` — `{ "status": "ok" }` (no prefix).

**Legacy sources (this wave):** Django apps **`products`** (`Category`, `Product`, `PartPaymentCollection`, `PartPaymentOption`, M2M `products_product_part_payments`) and **`offers`** (`Offer`, `ExtraLessonsOffer`). ROADMAP §3.1 groups installment/part-payment under **“pricing”**; there is no separate `pricing` app — those rows live under **`products_*`**.

**Out of scope:** `speakasap-education-service`, `course_materials`, orders/payments execution, `marathon` products, financial **writable** billing catalog (Phase 4). **Financial read** of category/product metadata for reporting is **in scope** in §11 (TASK-60 addendum). **Education consumer:** may call this service later using **`legacyProductId`** / **`offerUuid`** from this contract; no synchronous coupling in Wave 2.

**Auth:** **JWT from auth-microservice** on every `/api/v1/**` route. Header: `Authorization: Bearer <access_token>`. Validation: **`POST {AUTH_SERVICE_URL}/auth/validate`** with `{ "token": "<access_token>" }` (consumer-only). Wave 2 read APIs do not require a special staff claim unless product later adds one; until then, **any valid JWT** may call list/detail (tighten in a follow-up task if needed).

**Logging:** ISO timestamps and `duration_ms` on request completion (middleware), remote logging via `LOGGING_SERVICE_URL`.

---

## Pagination

| Query param | Type | Default | Max |
|-------------|------|---------|-----|
| `page` | integer ≥ 1 | `1` | — |
| `limit` | integer ≥ 1 | `DEFAULT_PAGE_SIZE` | **30** (`MAX_PAGE_SIZE`) |

**List body:**

```json
{
  "items": [],
  "page": 1,
  "limit": 24,
  "total": 0,
  "nextPage": null,
  "prevPage": null
}
```

---

## Error format

Same as user/content services (`HttpExceptionFilter`):

```json
{
  "error": {
    "code": "BAD_REQUEST | NOT_FOUND | UNAUTHORIZED | FORBIDDEN | CONFLICT | INTERNAL_ERROR",
    "message": "Human-readable message",
    "details": {}
  }
}
```

---

## 1. Categories (`products.Category`)

### `GET /api/v1/categories`

**Auth:** required.

**Query:** `page`, `limit`.

**Item (`CategorySummary`):**

| Field | Type | Notes |
|-------|------|-------|
| `id` | number | Legacy `Category.id` |
| `title` | string | |
| `productForOffers` | boolean | `Category.product_for_offers` |

---

## 2. Products (`products.Product` base row)

### `GET /api/v1/products`

**Auth:** required.

**Query:** `page`, `limit`, optional `categoryId` (integer), optional `includeTrashed` (`true`/`false`, default `false`).

**Item (`ProductSummary`):**

| Field | Type | Notes |
|-------|------|-------|
| `id` | number | Legacy integer PK |
| `title` | string | |
| `enTitle` | string | |
| `price` | number | Integer minor units (same as legacy `IntegerField`) |
| `languageId` | number \| null | Legacy `language_id` |
| `categoryId` | number | |
| `label` | string \| null | Product label |
| `materialLanguage` | string | 2-char code |
| `trashed` | boolean | |

### `GET /api/v1/products/:id`

**Auth:** required. **404** if missing.

**Response (`ProductDetail`):** `ProductSummary` plus:

| Field | Type | Notes |
|-------|------|-------|
| `tags` | string \| null | |
| `androidId` | string \| null | |
| `partPaymentCollectionIds` | number[] | From M2M `products_product_part_payments` |

---

## 3. Part payment (“pricing”) collections

### `GET /api/v1/part-payment-collections/:id`

**Auth:** required. **404** if missing.

**Response:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | number | `PartPaymentCollection.id` |
| `title` | string | |
| `comment` | string | |
| `options` | array | Each: `{ "id", "price", "day", "openSteps" }` from `PartPaymentOption` |

---

## 4. Offers (`offers.Offer`, `offers.ExtraLessonsOffer`)

### `GET /api/v1/offers`

**Auth:** required.

**Query:** `page`, `limit`, optional `studentId` (integer filter).

**Item (`OfferSummary`):**

| Field | Type | Notes |
|-------|------|-------|
| `uuid` | string (UUID) | Primary key (`Offer.uuid`) |
| `studentId` | number | Legacy `students.Student` id (opaque FK in course DB) |
| `teacherId` | number \| null | Legacy teacher id |
| `offererId` | number \| null | Legacy `auth_user.id` |
| `courseProductId` | number \| null | `Product` id |
| `orderId` | number \| null | Legacy order id (no `orders` table in course DB) |
| `created` | string (ISO 8601) | |
| `opened` | string (ISO 8601) \| null | |
| `state` | string | **`opened`** if `opened` is set; else **`created`**. (`paid` requires legacy `orders` join — out of scope Wave 2.) |

### `GET /api/v1/offers/:uuid`

**Auth:** required. **404** if missing.

**Response (`OfferDetail`):** `OfferSummary` plus optional nested:

| Field | Type | Notes |
|-------|------|-------|
| `extraLessons` | object \| null | If present: `{ "id", "productId", "lessons", "lessonsNative", "comment" }` |

---

## Write endpoints

**None in Wave 2** — catalog read-only mirror of legacy until cutover and staff workflows are defined.

---

## Limits

- All list endpoints: **≤ 30** items per response (`MAX_PAGE_SIZE`).
- No batch writes in Wave 2.

---

## 11. Financial consumer (TASK-60 addendum)

**Ownership:** `products.Category` and `products.Product` remain **authoritative** in speakasap-course-service. **speakasap-financial-service** uses them only as **read** metadata for revenue-by-category aggregates (`FINANCIAL_API_CONTRACT.md`).

**Auth:** `X-Internal-Token` with value accepted by course-service internal policy (same token family as other internal calls once named in `.env.example`).

### `GET /api/v1/internal/financial/products-metadata`

**Purpose:** Resolve **`legacyProductId` → `{ legacyCategoryId, title, enTitle }`** in batches for financial aggregation workers.

**Query:** `ids` — comma-separated list of integer `Product.id`, **maximum 30** values per request (align `MAX_PAGE_SIZE`).

**Response:**

```json
{
  "items": [
    {
      "legacyProductId": 1,
      "legacyCategoryId": 3,
      "title": "…",
      "enTitle": "…"
    }
  ],
  "notFoundIds": [999]
}
```

**Errors:** `401`/`403` for bad/missing token; `400` if `ids` empty or >30 ids.

**Note:** Until implemented, financial-service may **backfill** category mapping from a one-time legacy DB export in TASK-62 and keep **`CategoryAxisSnapshot`** in financial DB synchronized periodically via paginated **`GET /api/v1/products`** (staff JWT or internal) — validator must record temporary deviation.
