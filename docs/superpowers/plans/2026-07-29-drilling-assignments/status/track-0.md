# Track 0 — Foundation

**State:** COMPLETE
**Branch:** feat/drilling-assignments
**Commits:** 0076878..ef894c6 (speakasap) · a9298913 (ai-microservice, contracts vendor)

## Contract changes
None beyond the initial publication. C1–C9 are as specified in `00-MASTER.md`;
the reviewer compared all nine blocks field-by-field against the source and
found no discrepancies. **Wave 2 may code against them as written.**

## Verification run (controller, on the final tree)

```
$ rtk npm test                     # repo root, all 12 packages
--- summary: 0 failed
--- packages with zero test suites: 9
  assessment-service certification-service course-service financial-service
  notification-service payment-service salary-service user-service frontend

$ per-package counts for the 3 packages that have suites
api-gateway        Tests: 4 passed, 4 total
content-service    Tests: 1 passed, 1 total
education-service  Tests: 3 passed, 3 total

$ ./shared/scripts/sync-drill-contracts.sh --check
exit 0 — all five vendored copies match the source
```

`rtk npm run typecheck` (repo root): **7 pre-existing errors in 3 packages**,
none introduced by this track and none fixed, per controller ruling —
certification-service ×5 (TS6059), notification-service ×1 (TS6059),
salary-service ×1 (TS2349).

## Deferred to the orchestrator
- **ESO sync of the new Vault key.** `SPEAKASAP_PLATFORM_JWT_SECRET` was written
  to `secret/prod/speakasap-portal` and `secret/prod/speakasap` (same value,
  `kv patch` so existing keys survived) but has **not** been force-synced to K8s
  or rolled out. Track I/K must do that before the SSO handoff works in prod.
- No deploys were performed. No migrations exist yet.

## What Wave 2 needs to know

1. **`npm test` and `npm run typecheck` now exist in all 12 packages** and at the
   repo root. `test` carries `--passWithNoTests`, so **a green exit proves
   nothing on its own** — always check the test count. `scripts/run-all.sh`
   lists zero-suite packages separately for this reason.

2. **Import contracts from your service's vendored copy**, never redeclare:
   - content-service, education-service, notification-service → `src/drills/contracts.ts`
   - frontend → `lib/drills/contracts.ts`
   - ai-microservice → `src/teacher-assistant/contracts.ts`
   Changing a contract means editing `shared/contracts/drills.contracts.ts`,
   re-running `shared/scripts/sync-drill-contracts.sh`, and announcing it —
   it invalidates other tracks' in-flight work. The drift test in
   content-service (`src/drills/contracts.spec.ts`) fails if a copy diverges.

3. **The gateway resolver is FIRST-MATCH-WINS over a hand-ordered array**, not
   computed longest-prefix, and reads `process.env` at call time. Its header
   comment used to claim otherwise and has been corrected. Tracks adding routes
   (B2, F, J) must order new entries most-specific-first by hand; a broader
   prefix above a narrower one silently shadows it. The real export is
   `resolveUpstreamBaseUrl(pathname: string): string | null`.

4. **`notification-service` has a pre-existing TS6059 typecheck error**
   (`scripts/migrate-notification-data.ts`, outside rootDir). Track G works in
   this service and will see it. It is not yours to fix; do not let it mask a
   real error you introduce — check the error list, not just the exit code.

5. **Env vars declared**, in `.env.example`: `AI_SERVICE_URL` (single
   declaration, shared with the translation feature), `DRILL_GENERATION_MODEL_TIER`,
   `DRILL_GENERATION_TIMEOUT_SECONDS`, `SPEAKASAP_PLATFORM_JWT_SECRET` (empty),
   `SPEAKASAP_PLATFORM_URL`. Only the first two are in education-service's
   `REQUIRED_ENV`; the rest are consumed by unbuilt tracks and would block boot
   if made required now. Add them to a required list in the track that reads them.

## Deferred minors
None outstanding. Both were fixed in the final fix wave (`ef894c6`):
`--check` is now genuinely read-only and distinguishes a MISSING target from a
DRIFTed one. The `run-all.sh` string-match remains, triaged as acceptable —
it can only lose the zero-suite *visibility*, never turn a real failure green.

## Added by the final review (`ef894c6`)
- **`DRILL_GENERATION_MODEL_TIER` was missing from the education-service
  ConfigMap** while being boot-required. Deploying this branch would have
  crash-looped the pod. Fixed, and `DRILL_GENERATION_TIMEOUT_SECONDS` added
  pre-emptively for Track D.
- **`validate-env.k8s.spec.ts`** now fails if a var is added to `REQUIRED_ENV`
  without appearing in the ConfigMap or the Secret allow-list. **Adding an env
  var to `REQUIRED_ENV` is not complete until the K8s manifest is updated too** —
  this test enforces that for education-service; other services have no such
  test yet.
- **Pairwise route-shadowing invariant test** in the gateway: no route entry may
  be a strict prefix of a later one. Tracks B2/F/J adding routes will be caught
  by it rather than by a 404 in production.
- `SPEAKASAP_PLATFORM_URL` is deliberately NOT in any ConfigMap yet — no consumer
  exists. Whichever track adds the first consumer must add the manifest key.
  `SPEAKASAP_PLATFORM_JWT_SECRET` must never appear in a ConfigMap; it is
  Vault/ESO only.

## Plan defects found and corrected during execution
1. Task 0.1 mandated `"test": "jest"` while claiming the empty state would pass;
   both runners exit 1 with no test files. Fixed with `--passWithNoTests` plus
   zero-suite reporting (plan commit 3e7c261).
2. Task 0.3's example test targeted `resolveUpstream`, which does not exist, with
   the wrong return type. Corrected at dispatch.
3. The spec and two plan files described the gateway as longest-prefix-wins.
   Corrected in commit e6c7c19.
4. `shared/scripts/vault-secret.sh`, referenced by task 0.4 step 3, does not
   exist. Reassigned to the controller.
