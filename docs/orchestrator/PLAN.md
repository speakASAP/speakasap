# SpeakASAP — Orchestrator Execution Plan

**Status:** Phase 1 active (pending onboarding)  
**SPEC:** [SPEC.md](./SPEC.md)

---

## Phase 1 — Course Content Automation

**Goal:** Ensure all published courses have high-quality, SEO-optimised descriptions.

| Task | Type | Status |
|------|------|--------|
| T1 | Audit existing course descriptions for quality gaps | generate_course_description | pending |
| T2 | Generate improved descriptions for top 20 courses | generate_course_description | pending |
| T3 | Review generated content for factual accuracy | review_course_content | pending |

**Completion criteria:** ≥ 90% of active courses have AI-reviewed descriptions.

---

## Phase 2 — Student Retention

**Goal:** Reduce 30-day dropout rate by 15% through personalised feedback.

| Task | Type | Status |
|------|------|--------|
| T4 | Identify at-risk students (low engagement last 14 days) | analyse_retention_risk | pending |
| T5 | Send personalised re-engagement feedback to flagged students | generate_assessment_feedback | pending |

**Completion criteria:** At-risk students contacted; dropout metric checked at 30 days.

---

## Phase 3 — Analytics & Reporting

**Goal:** Establish baseline metrics for platform-level AI impact measurement.

| Task | Type | Status |
|------|------|--------|
| T6 | Generate weekly completion rate report (courses + certifications) | generate_course_description | pending |
| T7 | Send monthly AI usage + cost summary to operator | generate_completion_email | pending |

**Completion criteria:** Reports generated for ≥ 4 consecutive weeks.

---

## Notes

- All tasks use `cheap` tier only (SPEC constraint).
- Human must review Phase 2 output before student emails are sent (validation gate).
- Phase 3 unlocks after Phase 2 completion metric confirmed.
