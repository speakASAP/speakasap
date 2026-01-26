# Marathon API Contract (Draft v1)

## Scope

Standalone `marathon` product API for legacy integration. This contract mirrors current legacy behavior while enabling clean cutover.

## Base

- Base path: `/api/v1`
- Pagination: `page` (>=1), `limit` (1–30, default 24)
- Response shape: `{ items, page, limit, total, nextPage, prevPage }`

## Errors

JSON error shape:
`{ code, message, details?, traceId? }`

Codes:

- `validation_error` (400)
- `unauthorized` (401)
- `forbidden` (403)
- `not_found` (404)
- `conflict` (409)
- `invalid_state` (422)
- `rate_limit` (429)
- `internal_error` (500)

## Public Endpoints

- `GET /marathons`
  - Filters: `languageCode?`, `active?`
  - Returns `MarathonSummary[]`
- `GET /marathons/{marathonId}`
- `GET /marathons/by-language/{languageCode}`
- `GET /marathons/languages`
- `GET /reviews`
- `GET /winners`
- `GET /winners/{winnerId}`
- `GET /answers/random?stepId&excludeMarathonerId?`

## Authenticated Endpoints

- `POST /registrations`
  - Body: `{ email, phone, name, password?, languageCode }`
  - Returns: `{ marathonerId, redirectUrl }`
- `GET /me/marathons`
- `GET /me/marathons/{marathonerId}`
- `POST /marathons/{marathonId}/join`
- `POST /marathoners/{marathonerId}/report-time`
  - Body: `{ hour }`
- `PATCH /answers/{answerId}`
  - Body: `{ key, value }`
- `POST /answers/{answerId}/submit`
- `PATCH /penalties/{penaltyId}`
- `POST /penalties/{penaltyId}/submit`
- `POST /marathoners/{marathonerId}/restart`
- `DELETE /marathoners/{marathonerId}`
- `POST /gifts/activate`
  - Body: `{ code }`
  - Returns: `{ success, marathonerId?, redirectUrl?, note? }`
- `GET /marathons/{marathonId}/payment-url`

## Entity Shapes (Draft)

### MarathonSummary

- `id`
- `languageCode`
- `title`
- `slug`
- `active`
- `coverImageUrl`
- `landingVideoUrl`
- `price`
- `currency`
- `isDiscounted`
- `discountEndsAt`

### MarathonDetail

- `id`, `languageCode`, `title`, `slug`, `rulesTemplate`
- `stepsCount`, `steps[]`
- `vipGateDate`, `discountEndsAt`, `coverImageUrl`, `landingVideoUrl`

### Marathoner

- `id`, `userId`, `marathonId`
- `status` (`trial|free|vip`)
- `reportTime`, `bonusDaysLeft`, `canUsePenalty`
- `active`, `createdAt`, `finishedAt`
- `currentStep`, `needsPayment`

### Step

- `id`, `marathonId`, `title`, `sequence`
- `isPenalized`, `isTrialStep`, `formKey`, `socialLink`

### Answer

- `id`, `marathonerId`, `stepId`
- `startAt`, `endAt`, `isCompleted`, `isChecked`
- `rating`, `payloadJson`

### PenaltyReport

- `id`, `marathonerId`
- `completed`, `completeTime`, `value`

### Winner

- `id`, `userId`, `goldCount`, `silverCount`, `bronzeCount`
- `reviews[]` (detail only)

## Env Keys

- `PORT`
- `PUBLIC_BASE_URL`
- `DATABASE_URL`
- `REDIS_URL`
- `AUTH_SERVICE_URL`
- `PAYMENTS_SERVICE_URL`
- `NOTIFICATIONS_SERVICE_URL`
- `LOGGING_SERVICE_URL` (required)
- `MAX_PAGE_SIZE=30`
- `DEFAULT_PAGE_SIZE=24`

## Notes

- Contract mirrors legacy routes in `speakasap-portal/marathon/api_urls.py`.
- All config is env-driven; no hardcoded values.
