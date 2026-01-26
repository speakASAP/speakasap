# Marathon Data Mapping (Legacy → New)

## Purpose

Define the mapping between legacy marathon models and the new `marathon` product schema for migration and validation.

## Mapping

### Marathon → marathons

Legacy: `marathon/models.py` (Marathon)

- `language_id` → `language_code` (or FK to shared languages)
- `title` → `title`
- `folder` → `slug`
- `rules_template` → `rules_template`
- `active` → `is_active`
- `landing_video` → `landing_video_url`
- `vip_since` → `vip_gate_date`
- `discount_till` → `discount_ends_at`
- `image` → `cover_image_url`

### Step → marathon_steps

Legacy: `Step`

- `marathon_id` → `marathon_id`
- `title` → `title`
- `penalize` → `is_penalized`
- `order` → `sequence`
- `form_class` → `form_key`
- `sn_link` → `social_link`
- `trial` → `is_trial_step`

### Marathoner → marathon_participants

Legacy: `Marathoner`

- `user_id` → `user_id`
- `marathon_id` → `marathon_id`
- `is_free` → `is_free`
- `vip_required` → `vip_gate_required`
- `payment_reported` → `payment_reported`
- `days` → `bonus_days_left`
- `can_use_penalty` → `can_use_penalty`
- `active` → `is_active`
- `report_hour` → `daily_report_time`
- `has_warning` → `has_warning`
- `created` → `created_at`
- `finish_date` → `finished_at`

### Answer → step_submissions

Legacy: `Answer`

- `marathoner_id` → `participant_id`
- `step_id` → `step_id`
- `start` → `start_at`
- `stop` → `end_at`
- `completed` → `is_completed`
- `checked` → `is_checked`
- `rating` → `rating`
- `value` → `payload_json` (JSONB)

### PenaltyReport → penalty_reports

Legacy: `PenaltyReport`

- `marathoner_id` → `participant_id`
- `completed` → `completed`
- `complete_time` → `complete_time`
- `value` → `value`

### Winner → marathon_winners

Legacy: `Winner`

- `user_id` → `user_id`
- `gold` → `gold_count`
- `silver` → `silver_count`
- `bronze` → `bronze_count`

### MarathonProduct → marathon_products

Legacy: `MarathonProduct` (from `products`)

- `marathon_id` → `marathon_id`
- `price`, `currency`, `title` → same
- `ACADEMIC_HOURS` → `total_hours` (default 50)

### MarathonGift → marathon_gifts

Legacy: `MarathonGift`

- `marathon_id` → `marathon_id`
- `code` → `code`
- `created` → `created_at`
- `used` → `used_at`
- `user_id` → `redeemed_by_user_id`

## Migration Strategy

Preferred: dual-write + backfill.

1. Backfill from legacy (read-only, batch with limit <= 30).
2. Dual-write period with legacy as source of truth.
3. Read switch to new `marathon` for read-only endpoints.
4. Write switch for registrations and submissions.

Fallback: short write freeze + batch migration + cutover.

## Validation Checklist

- Row counts match per entity and per marathon.
- Referential integrity: participant → marathon, submission → participant/step.
- Data integrity: JSON payloads parse correctly.
- Time fields consistent with legacy timezone.
- Winner counts align with legacy aggregates.

## Rollback

- Route back to legacy via shim.
- Keep new data for re-validation; no destructive steps.
