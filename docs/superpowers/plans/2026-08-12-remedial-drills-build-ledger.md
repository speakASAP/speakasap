---
status: blocked
owner: repository-owner
last_updated: 2026-09-02
---

<!-- BLOCKED: Implementation and review are complete, but 21e89d6 explicitly deferred migration, taxonomy seed, and deploy to the owner; no later completion evidence exists here. -->

# SDD ledger — plan: docs/superpowers/plans/2026-08-12-remedial-drills-error-analysis.md

Repos: speakasap (education-service, frontend) + ai-microservice (Task 6).
Branch: main in both, per ecosystem CLAUDE.md (no feature branches, no PRs).
Deploy: deferred to owner. Task 18 stops at build/test/typecheck ready.
Scratch-DB migration apply (Task 18 Step 3) needs an owner-supplied DB URL.

Task 1: implemented (commit 4f19e7b) — 4 models, DrillAssignment columns, seed, offline migration
Task 1: review 1 — spec FAIL, 2 Important: seed files at src/seeds/ not prisma/; migration dir named with Unix epoch not YYYYMMDDHHMMSS
Task 1: minor (deferred): seed error log lacks per-topic context (which slug failed mid-loop)
Task 1: fix round 1/5 dispatched (resumed implementer a625cef8688a8758a)
Task 1: fix round 1/5 (2 addressed, 0 open; commits 4f19e7b..fcfbd7c, re-review verified independently)
Task 1: NOTE — commit 8cf972e mixes the seed-file rename with a pre-existing, unrelated api-gateway SERVICE_NAME change (api-gateway/src/main.ts, k8s/services/api-gateway.yaml). Not authored by this plan; swept up from the working tree. Left in place, flagged for the final review.
Task 1: complete (commits 03686f6..fcfbd7c, review clean)

Task 2: implemented (commit 00e39a9) — extractFailedBlanks + contracts types, 10 tests
Task 2: review 1 — spec FAIL, 1 Critical: test "skips attempts pointing at a blank the item does not have" passes [] instead of attempts; vacuous, duplicates an earlier case. Implementation itself verified correct by reviewer.
Task 2: minor (deferred): parseBlank treats a blank with a missing `answer` field the same as "blank not found" — two different data problems collapse into one skip
Task 2: fix round 1/5 dispatched (resumed implementer ade810e760b24ee47)
Task 2: fix round 1/5 (1 addressed, 0 open; commits 00e39a9..16cade0; deliberate-break output verified)
Task 2: complete (commits fcfbd7c..16cade0, review clean)

Task 3: implemented (commit 6d50d99) — mastery arithmetic, 13 tests, normalization verified to use grading.ts only
Task 3: review 1 — spec PASS. 1 Important (raised by BOTH implementer and reviewer independently): brief's reveal test uses {revealed:true, isCorrect:false}, which passes even without the `!revealed &&` clause. Rule D8 was untested.
Task 3: RULING (controller) — add a discriminating test {revealed:true, isCorrect:true}. Goes beyond the brief's 13 cases; plan defect, my call as plan author. Plan file corrected at source too.
Task 3: minor (deferred): normalizeAnswer returning "" causes a silent skip, indistinguishable from "never attempted"
Task 3: fix round 1/5 dispatched (resumed implementer a13f92a869be3b2f6)
Task 3: fix round 1/5 (1 addressed, 0 open; commits 6d50d99..a85a45b; broken-run contrast verified)
Task 3: complete (commits 16cade0..a85a45b, review clean)

Task 4: implemented (commit 12242ab) — MasteryRepository, 7 tests, all meaningful per reviewer
Task 4: review 1 — spec PASS, quality approved. Increment trap did not materialise (implementation passes computed literals, never {increment:n}).
Task 4: minor (deferred): mastery.repository.ts:19-20 doc comment states "read-modify-write window is not contended" as fact; nothing enforces one-completion-at-a-time per student. Reword to name the assumption.
Task 4: complete (commits 2dad5c0..12242ab, review clean)

Task 5: implemented (commit 35ee4b6) — TaxonomyService, 9 tests, slugsFor throws on unseeded language
Task 5: review 1 — spec PASS, quality approved
Task 5: minor (deferred): taxonomy.spec.ts Prisma stub ignores orderBy; the sortOrder requirement passes only because the fixture is pre-sorted. Reversing the fixture would not fail the test.
Task 5: complete (commits 12242ab..35ee4b6, review clean)

Task 6: implemented in ai-microservice repo (commit e298aad, base ef04988) — analyze-drill-errors route, prompt, schema, service, DTO. 108 tests across 7 suites pass.
Task 6: review 1 — spec PASS, quality approved. Three implementer judgment calls independently verified: (a) imported real LlmMeta rather than a third inline copy; (b) @IsOptional -> @ValidateIf on required-but-nullable level/prompt, closing a missing-key hole; (c) defensive parsing degrades on every adversarial model output without throwing.
Task 6: minor (deferred): rules.map(String) turns a model-returned object into "[object Object]" instead of dropping it. Pre-existing codebase convention (generate/validate do the same), cosmetic only.
Task 6: complete (ai-microservice ef04988..e298aad, review clean)

Task 7: implemented (commit 8e2906e) — AnalysisClient + wire types, 4 tests. Auth (the service's own Auth-issued credential), non-fail-soft propagation and env-var raising all verified by reviewer.
Task 7: review 1 — spec conditional, 1 finding: AnalyzeErrorsResponse.meta typed `meta?: unknown` but ai-microservice declares `meta: LlmMeta` required and always sends it.
Task 7: RULING (controller) — reviewer called it Critical; downgraded to Important. Not a wire mismatch, no runtime impact, field currently unread by education-service. Still fixed: an optional type on an always-present field invites dead branches. Brief specified `meta?: unknown`, so this is a plan defect, not implementer error.
Task 7: fix round 1/5 dispatched (resumed implementer a89c06e661b98f139)
Task 7: fix round 1/5 (1 addressed, 0 open; commits 8e2906e..af7c8d7; AnalyzeMeta mirrors real LlmMeta field-for-field)
Task 7: complete (commits 35ee4b6..af7c8d7, review clean)

Task 8: implemented (commit 339b82f) — AnalysisRepository, 10 tests, increment stub trap handled up front
Task 8: review 1 — spec PASS. 1 Important: updateCluster's `if (!row)` guard is dead code — real Prisma throws P2025 rather than resolving null, so a missing cluster escapes as a raw 500 where Task 13's teacher-facing PATCH route documents a 404. Raised by implementer, confirmed by reviewer against installed Prisma runtime types.
Task 8: RULING (controller) — fix it. Brief specified the dead guard, so plan defect. Catch P2025 -> NotFoundException, rethrow everything else. Plan file corrected at source.
Task 8: also fixing Minor — getRunWithClusters/getCluster had zero dedicated tests; the null "never analyzed" third state was untested.
Task 8: fix round 1/5 dispatched (resumed implementer a0d140b6abcef0040)
Task 8: fix round 1/5 (2 addressed, 0 open; commits 339b82f..31aa2b6; P2025 test verified failing against old guard first)
Task 8: complete (commits af7c8d7..31aa2b6, review clean)

Task 9: implementer STOPPED and asked — real contradiction in the brief. Test "marks the run FAILED when the assignment has vanished" is unsatisfiable by the brief's own run(): the throw happens before createRun, so runUuid is null and markFailed is guarded by `if (runUuid)`. Structural, not a typo — createRun needs assignment.studentId, and DrillAnalysisRun.studentId is a required Int (verified in schema).
Task 9: RULING (controller) — rewrite the test to assert what actually happens: run() resolves (does not throw), no run row created, no markFailed, no model call. The vanished-assignment failure is visible in the error log, which is the only trace available when there is no row to mark. Rejected widening createRun to accept a null studentId — that would make the column nullable forever for an impossible-in-practice case. Plan corrected at source.
Task 9: implemented (commit b59c341) — AnalysisService.run, 11 tests. Reviewer traced rule A (never throws) across every collaborator failure path, rule B (exactly one cluster per answer) against 4 adversarial model outputs, rule C (NO_ERRORS vs FAILED) — all hold. replaceClusters 6-arg order verified against the real signature.
Task 9: review 1 — spec PASS, quality approved, 4 Minor.
Task 9: minor ACCEPTED (no fix): unguarded first logger.error in catch (Nest Logger.error is a sync non-throwing write); two clusters may share one topicSlug if the model repeats it (no answer lost, dedup never required).
Task 9: minor FIXED instead of deferred: (a) mistakeCount summation across blanks was untested and drives Task 11's sentence counts; (b) unrestored Logger spy leaking into the next test in the file.
Task 9: minor fixes (2 addressed; commits b59c341..94b7016; test-only, analysis.service.ts zero net diff verified independently)
Task 9: complete (commits 7d13c0a..94b7016, review clean)

Task 10: implemented (commit a3e460f) — AnalysisJobRunner, CompletionAnalysisAdapter, DrillCompletionAnalyzer port + guarded call in RunnerService.completeIfResolved.
Task 10: NOTE — implementing agent was cut off by a session limit after committing and writing its report. Controller independently verified: 4 expected files committed, 113/113 tests pass across 10 suites, npm run build clean, no loose ends (reviewer checked for unused imports, TODOs, half-written tests, unwired deps — none). Two stray compiled artifacts (prisma/seed-grammar-topics.js and .spec.js) deleted by controller; they were untracked tsc output, sources are committed as .ts.
Task 10: review 1 — spec PASS, quality approved. runner.service.ts edit verified minimal: 28 insertions, 0 deletions, rest of file byte-identical. All four rules traced against real code.
Task 10: RULING (controller) — analyzer hook fires on reveal()-driven completions too, since it lives in the shared completeIfResolved (a Task 9 refactor artifact, not this task's doing). Implementer disclosed it; reviewer flagged for sign-off. ACCEPTED as correct: a student who reveals their last blank has finished the drill and made mistakes worth analysing — that is the case that most needs the grammar explanation. Not narrowing it.
Task 10: minor (deferred): AnalysisJobRunner's "second belt" catch is inert for AnalysisService.run specifically — an async function cannot throw synchronously by spec, so only randomUUID()/DI failure could, and those surface a level up. Doc comment slightly overstates its protection; the 3 job-runner tests only exercise rejected promises, never a genuine sync throw.
Task 10: complete (commits 94b7016..a3e460f, review clean)

Task 11: implemented (commit 97902c6) — composeRemedial, 18 tests, both deliberate breaks (Math.max(2,..) floor and MAX=100) confirmed failing the right tests.
Task 11: review 1 — spec PASS, quality APPROVED, ZERO findings. Reviewer executed the math rather than reading it: transcribed the committed function to Node and ran every worked case plus brute force (single answer 1..200, ~150 multi-answer combos). Verified live: no floor (x1 -> 1 occurrence), no cap (x6 -> 6), 25 splits 13/12 with all 25 preserved, three-way split preserves 20/20/15, both parts of a 15/15 split contain BOTH answers, and a concatenation variant genuinely fails the spread test (round-robin is load-bearing). Zero over-cap parts, zero lost occurrences, zero sentenceCount < required.
Task 11: complete (commits a3e460f..97902c6, review clean)

Task 12: implemented (commit 3298728) — RemedialService.createForGap, DrillAssignmentOrigin widened to include REMEDIAL. Unit 12/12; full src/drills regression 37 suites / 540 tests pass.
Task 12: review 1 — spec PASS, quality approved. Reviewer INDEPENDENTLY re-derived the origin audit (own grep, not the implementer's table) and confirmed every site. Key confirmations: notifications.hook.ts's `origin === 'SELF'` gate is safe because a REMEDIAL row always has a teacherId; student outstanding-work queries gate on status not origin, so remedial drills appear automatically; no runtime enum validator on DrillAssignmentOrigin needed updating.
Task 12: minor FIXED: no test asserted remedialPart===null / no "часть" suffix for a single-part gap — an implementation that always numbered parts would have passed all 12 tests. Hole was in the brief's test list, not the implementation. Plan corrected at source.
Task 12: FOLLOW-UP (accepted, deliberately not fixed here): createForGap's idempotence is a read-then-write with no DB-level guard. Two rapid teacher clicks could both pass the live-status check and both write a set. Confirmed real by reviewer (sourceAnalysisUuid has a plain @@index, no unique constraint). Cost is a wasted model call + extra row, not corruption. Proper fix is a partial unique index on sourceAnalysisUuid filtered to live statuses, or a serializable read+write transaction — a schema change that belongs in its own commit.
Task 12: fix (1 addressed; commits 3298728..6bb4b89; test-only 2-line addition, remedial.service.ts zero net diff, both mutations proven to fail correctly). Controller verified the diff directly rather than dispatching a reviewer for a 2-line test change.
Task 12: complete (commits 97902c6..6bb4b89, review clean)

Task 13: implemented (commit 80544bb) — 4 routes + module wiring. 19/19 new tests; full src/drills 38 suites / 551 tests pass.
Task 13: CRITICAL CHECK PASSED — CompletionAnalysisAdapter is genuinely bound to RunnerService via useFactory; reviewer verified positional args match the constructor field-for-field. Tasks 1-12 are no longer dead code.
Task 13: review 1 — spec PASS (no route shadowing; verified against real declaration order, not the diff). 1 Important: updateGap and createRemedial accept any staff caller with no ownership scoping, while getAnalysis (added by the implementer beyond the brief) does scope. Gap clusters are keyed to one assignment + one student, structurally identical to routes this controller DOES scope — unscoped is the outlier.
Task 13: RULING (controller) — fix now. Blast radius: updateGap silently overwrites another student's teaching content; createRemedial assigns work and spends a model call for a student the caller may never have taught. Fix reuses the pattern already present in getAnalysis.
Task 13: NOTE — brief's test fixture used roles:['teacher'], which the real isStaffUser() does not treat as staff (needs userType staff/admin, or roles staff/admin/manager/superadmin). Implementer caught and corrected it; without the fix the positive staff-path tests would not have tested what their names claim.
Task 13: fix round 1/5 dispatched (resumed implementer a93e6b75ca367c998)
Task 13: fix round 1/5 (1 addressed, 0 open; commits 80544bb..3d00742). Shared assertOwnsGap helper calls the SAME private ownersOf() that getAnalysis uses — literal reuse, no drift possible. Runs before any write/model call in both routes. 404 not 403 on both not-owned and not-found. Mutation test (removing the call) failed exactly the 6 new tests. getAnalysis byte-for-byte unchanged; drills.module.ts untouched so the CompletionAnalysisAdapter binding is undisturbed. 17/17 + 557 regression.
Task 13: complete (commits 8bb14c8..3d00742, review clean)
=== BACKEND COMPLETE (Tasks 1-13). Remaining: 14-17 frontend, 18 verification. ===

Task 14: implemented (commit 8a0a67c) — frontend contracts + API client + cross-repo drift guard. 5/5 frontend, 2/2 drift spec, build clean.
Task 14: review 1 — spec PASS, quality approved. Reviewer verified EVERY cross-repo field against real backend source (AnalysisRunRecord, GapClusterRecord, toClusterRecord, the synthesized NOT_ANALYZED object) and all four route paths against the real controller decorators. No mismatches.
Task 14: exported-helper decision UPHELD — request() exported from teacher/api.ts rather than duplicated or moved to a shared module. Trust boundary intact: runner/api.ts still has its own separate unexported request(), so student-authenticated code cannot reach teacher routes. Analysis client sits on the same trust side as teacher/api.ts.
Task 14: minor FIXED (doc only, no logic change): remedialSentenceCount's comment claimed it "mirrors" composeRemedial, but it omits the server's mastery filter and so overstates for gaps containing since-mastered words. Comment rewritten to lead with "upper bound, not a mirror"; test added pinning the behaviour.
Task 14: minor fix (1 addressed; commits 8a0a67c..f984a0f; doc comment + 1 test, zero logic change — controller verified the diff directly)
Task 14: complete (commits 3d00742..f984a0f, review clean)

Task 15: implemented (commit 321719b) — GapCard + GapAnalysisBlock, 14 tests, full suite 271/271. Status DONE_WITH_CONCERNS, two disclosed deviations.
Task 15: review interrupted (reviewer hit a session limit mid-run) but delivered the key finding before dying: all 21 existing drill components live under lib/drills/{runner,teacher}/; components/drills/ was genuinely new. Controller completed the remaining checks directly: vitest include glob confirmed widened to {app,lib,components}, and components/ holds exactly ONE test file (the new one) — so no other tests were swept in by the widening.
Task 15: RULING (controller) — deviation 1 REVERSED: move the components to lib/drills/analysis/ (beside Task 14's api.ts and contracts.ts) and revert the glob to {app,lib}. My brief invented a directory this codebase does not use; the config change existed only to accommodate that. Plan file corrected at source (all component paths rewritten).
Task 15: RULING — deviation 2 STANDS: narrowing /through/ to /through \(6\)/ is strictly more specific and still asserts the covered word WITH its mistake count. The loose regex matched 4 elements because my fixture repeats "through" in explanation, rule and example. My defect.
Task 15: fix round 1/5 dispatched (resumed implementer a374127c60019db5e)
Task 15: fix round 1/5 (both deviations resolved; commits 321719b..86378f0). Components moved to lib/drills/analysis/, glob reverted to {app,lib}, components/ removed. 14/14 from new location, full suite 271/271, build clean.
Task 15: CONTROLLER-VERIFIED (review was interrupted, so checked directly): glob is back to ['{app,lib}/**/*.test.{ts,tsx}']; components/ no longer exists; files co-located with Task 14's api.ts/contracts.ts. Read the state branches in GapAnalysisBlock.tsx myself — five mutually exclusive branches in correct order (loadError->alert, NOT_ANALYZED/null->render nothing, IN_FLIGHT->working msg, NO_ERRORS->всё верно, FAILED->alert + teacher-only retry). No path collapses FAILED into empty or NO_ERRORS. Three role="alert" sites: load failure, FAILED status, action failure. Implementer's mutation evidence: stubbing the FAILED branch to `return null` yields "Unable to find role=alert" on the named test.
Task 15: complete (commits f984a0f..86378f0, review clean)
Task 15: NOTE for 16/17 — import path is '@/lib/drills/analysis/GapCard' and '@/lib/drills/analysis/GapAnalysisBlock'. Plan file already rewritten.

Task 16: implemented (commit 8eed265) — spans frontend + education-service. Runner payload carries origin/sourceAnalysisUuid, new GET gaps/:gapUuid route, practice page renders theory above the runner for REMEDIAL and analysis below. Frontend 4/4 new (253/253 suite), education-service 31/31 targeted (564/564 drills), both builds clean.
Task 16: review 1 — spec PASS, but CRITICAL: getGap's staff branch has no ownership scoping. Any isStaffUser caller could read ANY gap — a named student's specific wrong answers and the teaching written for them — by guessing a uuid. Sibling routes (getAnalysis, updateGap, createRemedial) all scope via ownersOf/getForTeacher/assertOwnsGap. Worse, the implementer's added test "a staff caller may read any gap" ENCODED the flaw as intended behaviour and would keep passing after a fix.
Task 16: RULING (controller) — fix. ROOT CAUSE IS MY BRIEF, which said "Staff may read any"; the implementer followed the spec faithfully. Plan corrected at source: getGap now calls assertOwnsGap in the staff branch, and the plan's test list gains BOTH directions (owns -> reads, does-not-own -> 404). The plan previously had no staff test at all for this route, which is why the hole survived writing.
Task 16: contract-drift handling UPHELD — hand-patching the 2 fields into the SSOT beat running sync-drill-contracts.sh, which would have overwritten education-service's own unrelated shipped fields with a stale source. Reviewer verified the remaining drift is inert for this feature: neither content-service nor notification-service constructs a DrillAssignmentDTO or switches on origin, and sourceAnalysisUuid has zero references in any of them.
Task 16: FOLLOW-UP (pre-existing, NOT caused by this plan — verified at 03686f6 before Task 1): shared/contracts SSOT is drifted from education-service and ai-microservice on unrelated fields (blanksResolved/blanksRevealed split, DrillAssignmentTeacherStats). Needs a dedicated resync task: reconcile SSOT with education-service first, then run the full sync.
Task 16: fix round 1/5 dispatched (resumed implementer afef5f78a7b1893f0)
Task 16: fix round 1/5 (1 Critical addressed; commits 8eed265..2e520b9). getGap's staff branch now calls the existing assertOwnsGap. The flawed "staff may read any gap" test was REPLACED with an owns/does-not-own pair: positive asserts the real call args (getForTeacher('a1',[7])), negative asserts NotFoundException explicitly. Negative proven with teeth (reverting the fix yields "Received promise resolved instead of rejected"). 22/22 analysis spec, 565/565 drills suite, build clean.
Task 16: CONTROLLER-VERIFIED the fix by reading the route and the tests directly — second privacy defect in this plan, so not taken on report alone.
Task 16: complete (commits 86378f0..2e520b9, review clean)

Task 17: implemented (commit 88ffe4d) — GapAnalysisBlock audience="teacher" on the progress page + notice banner. Page test 19/19, full suite 23 files / 280 tests, build clean.
Task 17: review 1 — spec PASS, quality approved. Both judgment calls traced by reviewer, not merely accepted: (a) placing the block outside the items.length>0 gate is correct — PENDING_REVIEW yields NOT_ANALYZED and GapAnalysisBlock returns null, so the gate would be redundant; (b) vi.importActual genuinely keeps remedialSentenceCount's real arithmetic under test, and the 12-count assertion exercises the above-floor branch. Pre-existing tests verified NOT weakened — only a default fetchAnalysis mock added.
Task 17: minor FIXED: notice and the "awaiting approval" banner can co-mount (remove() -> load() flips items.length to 0 while nothing clears notice) — two role="status" live regions. Implementer's CONCLUSION was right but their stated reason did not hold; reviewer found the real path. Clearing notice on reload.
Task 17: minor fix (1 addressed; commits 88ffe4d..fba10d8). setNotice(null) placed at the top of load(), NOT runWrite() — implementer found remove() calls load() directly and bypasses runWrite entirely, so load() was the only choke point covering edit+add+delete. Contradicted my suggestion correctly. New test proves only one role="status" survives create-then-delete. 20/20 page, 281 full suite, build clean.
Task 17: complete (commits 29c89df..fba10d8, review clean)
=== ALL 17 IMPLEMENTATION TASKS COMPLETE. Task 18 = verification only. ===

Task 18: VERIFICATION RUN BY CONTROLLER DIRECTLY (not delegated — the point is trustworthy evidence).
  education-service `npx jest src/drills`   -> 39 suites, 565/565 PASS
  frontend `npx vitest run`                 -> 23 files, 281/281 PASS
  ai-microservice `npx jest src/teacher-assistant` -> 7 suites, 108/108 PASS
  npm run build (each service, own compiler, never npx tsc) -> all exit 0
  (ERROR/WARN lines in output are deliberate failure-path tests logging as designed.)
Task 18: migration 20260813084200_remedial_drills audited statically — 4 CREATE TABLE, 7 CREATE INDEX, 3 CREATE UNIQUE INDEX, 5 ALTER TABLE (2 ADD COLUMN + 4 ADD CONSTRAINT). ZERO DROP, zero ALTER COLUMN. Purely additive.
Task 18: env check — AI_SERVICE_URL present in .env.example; the Auth-issued service credential provisioned via k8s/services/education-service.yaml (ExternalSecret) and ALREADY required by the pre-existing AiClient, so AnalysisClient introduces NO new required config. DRILL_ANALYSIS_CLIENT_TIMEOUT_MS optional, defaults 120000.
Task 18: NOT DONE — scratch-database apply (brief Step 3). No scratch DB URL available and production must not be touched. Owner action.
Task 18: complete (verification only, no code changes)

=== FINAL WHOLE-BRANCH REVIEW (opus) — 2 findings, both cross-task, invisible to per-task review ===
FINAL-1 (Critical): grammar taxonomy seeded for 3 of 19 languages, AND the seed was wired to nothing (no npm script, no reference in Dockerfile/k8s/scripts). Students in 16 of 19 languages would have seen the raw internal error "No grammar taxonomy seeded for language X — run prisma/seed-grammar-topics.ts" on every completed drill; and even en/de/es would ship inert with empty tables. Split across Task 1 (wrote seed) and Task 5 (wrote the throw) — each correct alone. The seed's own spec derived its language list FROM the seed, so it passed for any subset.
FINAL-2 (Important): retryAnalysis had no ownership scoping — third instance of this pattern (Tasks 13 and 16 fixed the other two). Any staff account could re-run any assignment's analysis, spending a model call and overwriting another teacher's clusters via replaceClusters. No data returned, so not a privacy leak.
FINAL FIX WAVE (commit 65dad13): all 19 languages seeded with per-language topics (not copied — ja particles/keigo/counters, tr vowel harmony/agglutination, zh tones/measure words/了, cz i-y+diacritics), 19 .other fallbacks, coverage spec now imports the real KNOWN_LANGUAGE_CODES so it cannot pass on a subset, prisma:seed:grammar-topics script added matching the migrate pattern, ts-node pinned as devDependency (nothing else in the tree could run a .ts script). Deploy path deliberately NOT auto-wired — owner decides when the seed runs. retryAnalysis scoped via ownersOf+getForTeacher before enqueue.
FINAL RE-REVIEW: both ADDRESSED, verdict READY TO MERGE. Reviewer independently reproduced both teeth-proving reverts, the full suite (572/572, 40 suites), the build, and the grep sweeps — did not trust the report.
Product rules re-verified at branch level by brute force (1..300 single-answer, 4000 random multi-answer): zero lost occurrences, zero parts over the 20 cap.
=== FEATURE COMPLETE — 18/18 tasks, final review clean ===
