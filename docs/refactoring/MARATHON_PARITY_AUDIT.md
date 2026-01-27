# Marathon Parity Audit Report

**Date:** 2026-01-26  
**Agent:** AGENT07 (Marathon Parity Audit)  
**Scope:** `marathon` repo vs `MARATHON_PARITY_CHECKLIST.md`.

---

## 1. Endpoint Existence & Params

| Checklist item | Implementation | Status |
| -------------- | -------------- | ------ |
| `GET /api/v1/winners` (list) | `winners.controller.ts` `@Get()`, `page` & `limit` query | ✅ |
| `GET /api/v1/winners/:winnerId` (detail) | `winners.controller.ts` `@Get(':winnerId')` | ✅ |
| `GET /api/v1/answers/random?stepId=&excludeMarathonerId=` | `answers.controller.ts` `@Get('random')` | ✅ |
| `GET /api/v1/me/marathons` (list) | `me.controller.ts` `@Get()` | ✅ |
| `GET /api/v1/me/marathons/:marathonerId` (detail) | `me.controller.ts` `@Get(':marathonerId')` | ✅ |
| `GET /api/v1/marathons/languages` | `marathons.controller.ts` `@Get('languages')` | ✅ |
| `GET /api/v1/reviews` | `reviews.controller.ts` `@Get()` | ✅ |
| `POST /api/v1/registrations` | `registrations.controller.ts` `@Post()` | ✅ |

Base path `api/v1` and `health` exclusion: `main.ts` (line 14).

---

## 2. Winners

| Rule | Location | Status |
| ---- | -------- | ------ |
| Pagination `limit`; default 24 | `winners.controller.ts` L19: `limit ? parseInt(limit, 10) : 24` | ✅ |
| Limit max 30 | `winners.service.ts` `MAX_PAGE_SIZE = 30`, `Math.min(..., MAX_PAGE_SIZE)` | ✅ |
| Order gold desc, silver desc, bronze desc | `winners.service.ts` `medalOrder` | ✅ |
| Filter: only medal > 0 | `winners.service.ts` `medalFilter` (OR gold/silver/bronze gt 0) | ✅ |
| Detail: same filter (no medal → null) | `winners.service.ts` `getById` checks `hasMedal` | ✅ |
| List shape: id, name, gold, silver, bronze, avatar | `WinnerSummary` in `winners.service.ts` | ✅ |
| Detail shape: + reviews (marathon, state, completed, review, thanks) | `WinnerDetail`, `MarathonReview` | ✅ |
| Detail 404 when not found | `winners.controller.ts` L27-29: throws `NotFoundException` | ✅ |

---

## 3. Random Report (`/answers/random`)

| Rule | Location | Status |
| ---- | -------- | ------ |
| Only completed answers | `answers.service.ts` `where: { isCompleted: true }` | ✅ |
| Exclude marathoner when provided | `excludeMarathonerId` → `participantId: { not }` | ✅ |
| 404 when no match | `answers.controller.ts` `NotFoundException('No random answer found')` | ✅ |
| Shape: marathoner { name }, report, complete_time | `RandomAnswer` in `answers.service.ts` | ✅ |

---

## 4. My Marathons

| Rule | Location | Status |
| ---- | -------- | ------ |
| Auth required | `me.controller.ts` `@UseGuards(AuthGuard)` | ✅ |
| List & detail | `@Get()`, `@Get(':marathonerId')` | ✅ |
| Shape: title, type, needs_payment, registered, id, bonus_total, bonus_left, can_change_report_time, report_time, current_step, answers | `MyMarathon` in `me.service.ts` | ✅ |
| Answer: id, title, start, stop, state, is_late, block_reason | `Answer` in `me.service.ts` | ✅ |
| Detail 404 when not found | `me.controller.ts` L24-26: throws `NotFoundException` | ✅ |

---

## 5. Languages

| Rule | Location | Status |
| ---- | -------- | ------ |
| Shape: id, code, small_icon, payment_url, name, full_name, url | `MarathonLanguage` in `marathons.service.ts`, `listLanguages()` | ✅ |
| Public | No guard on `marathons` controller | ✅ |

---

## 6. Reviews

| Rule | Location | Status |
| ---- | -------- | ------ |
| Static list; shape name, photo, text | `reviews.service.ts` `REVIEWS`, `Review` type | ✅ |
| Public | No guard on `reviews` controller | ✅ |

---

## 7. Registration

| Rule | Location | Status |
| ---- | -------- | ------ |
| Anonymous only | No auth guard on `registrations` controller | ✅ |
| Creates marathoner | `registrations.service.ts` `prisma.marathonParticipant.create` | ✅ |
| Returns marathonerId, redirectUrl | `RegistrationResponse` | ✅ |
| Redirect to marathon URL | `registrations.service.ts` L61-62: `${base}/marathon/${marathon.languageCode}` | ✅ |

---

## 8. Auth / Access

| Rule | Status |
| ---- | ------ |
| `me` endpoints require auth | ✅ `AuthGuard` |
| Winners, reviews, random report public | ✅ No guards |
| Register anonymous only | ✅ No guard |

---

## 9. Pagination Envelope

| Item | Status |
| ---- | ------ |
| Winners list returns `{ items, page, limit, total, nextPage, prevPage }` | ✅ `WinnersPaginated` |
| Legacy DRF uses `{ count, next, previous, results }` | ⚠️ **Different** |

**Note:** Shim returns new-service response as-is. If legacy frontend expects DRF pagination shape, it may break. Checklist defines item shape and `limit`; envelope match is not required. Worth validating in UI.

---

## 10. Risky Assumptions

1. **Winners `name` / `avatar`:** Resolved via `AUTH_SERVICE_URL` + `/api/users/{userId}`. If that endpoint is missing or differs, we fall back to `Участник #${userId}` and `avatar: ''`.
2. **Winner reviews:** Depend on `formKey: 'Step11Form3'` and `q14` / `q15` in `payloadJson`. Legacy-specific; remains correct only if new data follows same structure.
3. **Language metadata:** `LANGUAGE_METADATA` covers common codes; others use `code.toUpperCase()` for name/full_name and `small_icon: ''`.

---

## 11. GO / NO-GO for Parity Readiness

**GO**, with minor caveats.

**Summary:** All checklist endpoints exist. Request params, response shapes (winners, random report, my marathons, languages, reviews), pagination, ordering, and filters match. Auth and access rules are correct.

**Caveats:**

- **Redirect URL:** Registration uses generic `FRONTEND_URL` for `redirectUrl`; confirm it matches expected marathon redirect behavior.
- **Pagination envelope:** New service uses `{ items, page, limit, total, nextPage, prevPage }`; legacy DRF uses `{ results, count, next, previous }`. Validate in UI if frontend relies on DRF shape.

---

## 12. References

- Checklist: `speakasap/docs/refactoring/MARATHON_PARITY_CHECKLIST.md`
- Contract: `speakasap/docs/refactoring/MARATHON_API_CONTRACT.md`
- Marathon app: `marathon/src` (controllers, services).
