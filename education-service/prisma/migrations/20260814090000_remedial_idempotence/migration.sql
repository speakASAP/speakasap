-- At most one LIVE remedial set per gap. The idempotence check in
-- RemedialService.createForGap is a read-then-write with no lock between the two, so two
-- rapid clicks could both pass it. This makes the second one fail at the database instead
-- of quietly spending a second model call and handing the student a duplicate drill.
--
-- COMPLETED and CANCELLED are excluded on purpose: a revoked or finished drill must leave
-- the gap open to be attempted again.
--
-- Partial index rather than a plain unique: a gap legitimately accumulates many terminal
-- remedial rows over time.
--
-- remedial_part is in the key because a split gap creates one row per part, all sharing
-- one source_analysis_uuid. COALESCE because a single-part gap stores NULL there, and
-- NULLs do not collide in a unique index.
CREATE UNIQUE INDEX "drill_assignment_live_remedial_per_gap"
  ON "drill_assignment" ("source_analysis_uuid", COALESCE("remedial_part", 0))
  WHERE "source_analysis_uuid" IS NOT NULL
    AND "status" IN ('GENERATING', 'PENDING_REVIEW', 'ASSIGNED', 'IN_PROGRESS');
