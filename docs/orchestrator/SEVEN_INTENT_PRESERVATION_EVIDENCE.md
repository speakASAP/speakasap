# Seven-Lesson Course Intent Preservation Evidence

## Goal

Migrate only the legacy speakasap-portal seven-lesson course frontend/content into the new SpeakASAP platform, move its data into the new server/database, and preserve learner-visible typography and text style.

Excluded until separately approved:

- final tests and certification flows from seven_test;
- paid course/product ownership changes;
- private learner progress/access changes;
- object storage copy/mutation;
- production deployment or public route cutover;
- legacy route retirement.

## Legacy Evidence

Repository evidence used for the seven-course slice:

- seven/models.py
- seven/urls.py
- seven/api_views.py
- portal/fixtures/seven.xml
- seven/templates/seven/*
- speakasap_site/templates/site/seven/base.html
- speakasap_site/templates/site/seven/index.html
- speakasap_site/static/css/speakasap.css
- speakasap_site/static/css/site.css
- speakasap_site/static/scss/_seven.scss

The legacy fixture contains 19 courses and 136 lesson rows, with known non-seven edge cases for English, German, and Chinese. The importer must preserve these rows instead of truncating the data to exactly seven rows per language.

## Style Preservation

The frontend migration preserves the legacy learner-visible reading treatment:

- PT Mono for headings and legacy seven text accents;
- Open Sans for general readable text;
- dark gray body text around #424242;
- desktop lesson text around 16px / 30px;
- blue h1, yellow h2, justified lesson body, hyphenation, and compact table text;
- legacy .lesson__content--seven spacing and reading-focused layout.

Browser typography QA is still required after real deployed data is available.

## Target Ownership

- content-service owns public seven-course content, lessons, exercises, PDF hrefs, and media references.
- api-gateway owns public routing and the anonymous GET /api/v1/seven... exception.
- frontend owns presentation and calls the gateway only.
- course-service remains owner for paid products/offers.
- education-service remains owner for private progress/access.
- Assessment/certification remains separate later scope.


## Worker / Sub-Agent Evidence

Goal-driven development used bounded read-only worker investigations while the master orchestrator kept final planning, implementation, integration, evidence, and approval-gate responsibility.

- Anscombe investigated the legacy `speakasap-portal` seven slice in read-only mode with no edits. Evidence covered legacy seven templates/routes/styles/data source, including `seven/models.py`, `seven/urls.py`, `seven/api_views.py`, `portal/fixtures/seven.xml`, `speakasap_site/static/css/speakasap.css`, and the inventory of `143 lesson HTML templates`, exercise templates, answer templates, audio/PDF/media risks, and text-style requirements.
- McClintock investigated the new SpeakASAP frontend/content architecture in read-only mode with no edits. Evidence covered the gateway-only client, service ownership split where content-service owns public content, missing SevenCourse/SevenLesson schema/API/frontend surface, and recommended disjoint implementation slices for data contract, importer, content API, frontend UI, visual parity, and deploy verification.
- Huygens performed read-only frontend/API/gateway runtime contract validation with no DB writes and no deploys. Evidence covered `tsc --noEmit`, frontend/API/gateway route coherence, the media/PDF contract risk, the need to ensure gateway changes are deployed, partial API failures, and smoke-check hardening.

Worker boundaries: all worker investigations were read-only, made no edits, ran no DB writes, ran no deploys, and did not approve runtime gates. The master orchestrator remains responsible for final integration, verification, approval boundaries, and owner-facing status.

## Implemented No-Write Work

Prepared code and documents without schema apply, data apply, media mutation, deployment, or legacy retirement:

- content-service Prisma seven models and migration SQL;
- content-service public seven API module;
- gateway route and anonymous GET exception for seven content;
- frontend routes /<languageCode>/seven and /<languageCode>/seven/<order>;
- legacy font assets and seven typography CSS;
- write-gated seven importer with dry-run default, rollback SQL, HTML safety checks, media inventory, language seed readiness, and explicit apply flags;
- media availability checker, media copy manifest generator, asset contract checker, and deployment smoke checker, deployment readiness checker;
- approval packets for schema, data, media, and deployment gates.
- canonical runtime approval sequence runbook for schema -> data -> media -> deploy -> visual QA -> runtime evidence.
- gated schema-only operator script `scripts/apply-seven-schema-approved.sh` for the next approved action, including a schema-only operator execution report.
- gated seven data apply operator script `scripts/apply-seven-data-approved.sh` for the post-schema approved action, including rollback and execution-report gates.
- gated public media copy operator script `scripts/copy-seven-media-approved.sh` for the later media approval gate.
- gated scoped deployment operator script `scripts/deploy-seven-approved.sh` for the final deploy/smoke gate.

## Current Evidence

No-write reports and checks captured so far:

- /tmp/speakasap-seven-dry-run-v20.json: writes=false, no blocking issues, payload counts 19 languages, 19 courses, 136 lessons, 429 exercises, HTML safety ok, and media refs audio=1076, pdf=136, video=133.
- /tmp/speakasap-seven-assets-contract-v2.json: asset contract ok for v20 refs, including 1076 audio refs, 136 PDF refs, and 133 video refs.
- /tmp/speakasap-seven-schema-migration-plan-v10.json: schema migration plan ok with expected tables, indexes, foreign keys, Prisma models, no destructive statements, safe direct Prisma execution contract, and fresh approval-packet evidence references to next-gate v1 and no-write suite v19.
- /tmp/speakasap-seven-data-apply-contract-v10.json: data apply/rollback contract ok with write gates, rollback scope, language include handling, idempotent upserts, v20 counts, and a clean scoped data approval packet verified.
- /tmp/speakasap-seven-media-check-legacy-source-v2.json: https://speakasap.com has 1212/1212 internal refs available after the `ml='fr'` audio fix; all PDFs and audio refs are available.
- /tmp/speakasap-seven-media-copy-manifest-v3.json: 1212 available media copy candidates and 0 missing refs.
- /tmp/speakasap-seven-media-approval-contract-v2.json: media approval packet/evidence contract ok with current v20/v3 counts, source `https://speakasap.com`, target asset host `https://assets.alfares.cz`, and no embedded STATUS sections.
- /tmp/speakasap-seven-deployment-smoke-current-v3.json: expected pre-deploy failure; health 200, seven APIs 401, pages/media 404.
- /tmp/speakasap-seven-deployment-readiness-v3.json: deployment readiness ok with `writes=false`, scoped approval readiness true, root deploy excluded as too broad, and cutover still false until schema/data/media/deploy gates complete.
- /tmp/speakasap-seven-gateway-contract-v1.json: gateway public access contract ok with `/api/v1/seven` routed to content-service, anonymous access limited to GET, non-GET protected by bearer auth, and frontend using gateway seven endpoints.
- /tmp/speakasap-seven-content-api-contract-v1.json: content API contract ok with read-only seven endpoints, frontend-compatible response fields, `ASSETS_BASE_URL` media rewrite, and no mutating seven controller decorators.
- /tmp/speakasap-seven-frontend-route-contract-v1.json: frontend route contract ok with gateway-backed course/lesson data loading, lesson cards, legacy content wrapper, PDF/exercises/navigation/app promo/reading indicator, SEO metadata, and error fallback states.
- /tmp/speakasap-seven-apply-readiness-v14.json: schema approval readiness ok with approval-packet consistency, hardened schema execution contract, clean data apply contract gate, post-schema reconciliation gate, media source/approval contract gate, frontend route contract gate, content API contract gate, gateway contract gate, and deployment readiness gate enforced; data apply, production smoke, and cutover not ready.
- /tmp/speakasap-seven-goal-completion-audit-v9.json: completion audit reports `complete=false`; explicit frontend/content/gateway/data/media/deployment readiness contracts pass, and remaining missing gates are runtime evidence chain completion, schema reconciliation, data readiness, deployed smoke, post-deploy visual QA, and cutover readiness.
- /tmp/speakasap-seven-no-write-suite-v17.json: reproducible no-write suite ok after the schema approval-packet freshness check with `writes=false`, `network=false`, `database=false`, `deployment=false`; it regenerates local contract/readiness/completion reports and confirms completion remains false only because runtime gates are pending.
- /tmp/speakasap-seven-approval-sequence-v1.json: runtime approval sequence contract ok with schema -> data -> media -> deploy -> visual QA -> runtime evidence ordering, separate approval packets/operators, and no inferred runtime approval.
- /tmp/speakasap-seven-next-gate-v1.json: no-write next-gate preflight ok with `nextGate=schema`, `nextGateRequestable=true`, and later gates blocked until prior evidence exists.
- /tmp/speakasap-seven-no-write-suite-v19.json: reproducible no-write suite ok with approval-sequence and next-gate checkers included; `writes=false`, `network=false`, `database=false`, `deployment=false`, `complete=false` until runtime evidence exists.
- /tmp/speakasap-seven-intent-commit-readiness-v1.json: intent-preservation and commit-readiness evidence ok with legacy evidence, ownership, typography, approval boundaries, rollback, and required commit-message block verified.
- /tmp/speakasap-seven-no-write-suite-v21.json: reproducible no-write suite ok with intent/commit readiness included; `writes=false`, `network=false`, `database=false`, `deployment=false`, `complete=false` until runtime evidence exists.
- /tmp/speakasap-seven-worker-evidence-v1.json: worker/sub-agent evidence ok with Anscombe, McClintock, and Huygens read-only findings and master-orchestrator responsibility recorded.
- /tmp/speakasap-seven-no-write-suite-v22.json: reproducible no-write suite ok with worker-evidence checker included; `writes=false`, `network=false`, `database=false`, `deployment=false`, `complete=false` until runtime evidence exists.
- /tmp/speakasap-seven-schema-apply-execution-v1.json: schema execution report ok with `writes=true`, `schemaReady=true`, `dataReady=false`, and later data/media/deploy/legacy-retirement approvals false.
- /tmp/speakasap-seven-post-schema-reconciliation-v1.json: post-schema no-write reconciliation ok with `schemaReady=true`, `dataReady=false`, and missing 19 Language codes requiring the data gate with `--include-languages`.
- /tmp/speakasap-seven-content-apply-execution-v1.json: seven public content data apply execution ok with `writes=true`, rollback plan recorded, media/deploy/legacy-retirement approvals false.
- /tmp/speakasap-seven-content-post-apply-v1.json: post-data no-write reconciliation ok with planned matches `19/136/429` and no blocking issues.
- /tmp/speakasap-seven-runtime-evidence-after-data-v1.json: runtime evidence chain ok/complete=false with schema and data execution gates satisfied; remaining gates are media, deploy, smoke, and visual QA.
- /tmp/speakasap-seven-no-write-suite-after-data-v2.json: no-write suite ok after schema/data gates; next gate is media and requestable.
- /tmp/speakasap-seven-post-schema-reconciliation-fresh-v1.json: current pre-schema target correctly fails post-schema acceptance while preserving planned counts.
- /tmp/speakasap-seven-typography-contract-v2.json: frontend typography preservation contract ok with font files, CSS declarations, and route markers verified.
- /tmp/speakasap-seven-visual-qa-contract-v1.json: post-deploy visual QA script contract ok for desktop/mobile course+lesson rendered checks, screenshots, console health, framework overlay absence, legacy typography, and layout collapse checks.
- /tmp/speakasap-seven-runtime-evidence-v1.json: final runtime evidence-chain auditor ok as no-write contract and complete=false until schema/data/media/deploy/visual execution artifacts exist.
- /tmp/speakasap-seven-operator-refusal-v1.json: schema/data/media/deployment operators all refuse without `--execute` with code 2 and no external-action output.

Build/compile evidence:

- 2026-06-13 consolidated validation: content-service/api-gateway/frontend builds passed together; Python compile and schema/data/typography/readiness reports passed; `git diff --check` passed.
- 2026-06-13 approval sequence validation: `scripts/check-seven-approval-sequence.py` and no-write suite v18 passed without DB/network/deployment actions.
- 2026-06-13 next-gate preflight validation: `scripts/check-seven-next-gate.py` and no-write suite v19 passed without DB/network/deployment actions.
- 2026-06-13 intent/commit readiness validation: `scripts/check-seven-intent-commit-readiness.py` and no-write suite v21 passed without DB/network/deployment actions.
- 2026-06-13 worker evidence validation: `scripts/check-seven-worker-evidence.py` and no-write suite v22 passed without DB/network/deployment actions.
- cd content-service && npm run build passed.
- cd api-gateway && npm run build passed.
- cd frontend && npm run build passed.
- python3 -m py_compile passed for seven migration/readiness/media/smoke/typography scripts, including the approval-consistency readiness checker.

## Approval Status

Approved and executed so far:

- no-write investigation, code preparation, dry-run reports, and documentation updates;
- content-service schema migration against the Kubernetes content database;
- seven content data apply;
- media download/copy/object mutation for public seven audio/PDF files copied to the isolated assets host.

Not approved for the next chunk:

- image build/push, Kubernetes deployment, or rollout;
- data/media rollback;
- legacy route retirement;
- destructive rollback/cleanup.

The next required owner approval is scoped deploy-only:

~~~text
Approved to deploy only the seven-course content-service, api-gateway, and frontend changes to Kubernetes after schema/data/media gates are complete, then run the seven deployment smoke and browser typography QA. Do not restart unrelated SpeakASAP services and do not run data/media rollback or legacy route retirement.
~~~

## Rollback Plan

Before data apply, the importer must generate rollback SQL with --rollback-plan and save the apply report under /tmp.

Before deployment, keep legacy portal as fallback/reference and record the previous image/manifests. Deployment must be scoped to the touched services and verified with API, page, media, and browser checks.

Media copy rollback must be defined before any object mutation; v20 media source evidence has no unresolved internal refs, but copy/routing still requires explicit approval.

## Required Commit Message Block

~~~text
Intent:
- Migrate the legacy seven-lesson course frontend/content slice while preserving learner-visible typography and course continuity.

Legacy evidence:
- seven models, URLs, templates, fixture XML, CSS/SCSS, media reports, and dry-run reports.

Ownership:
- content-service owns public seven data; api-gateway owns routing/auth exception; frontend owns presentation.

Verification:
- content/api/frontend builds, Python compile checks, dry-run v20, asset contract v2, schema plan v10, data apply contract v10, media approval contract v2, frontend route contract v1, content API contract v1, gateway contract v1, deployment readiness v3, deployment smoke baseline v3, apply readiness v14, goal completion audit v9, approval sequence v1, next-gate preflight v1, intent/commit readiness v1, worker evidence v1, no-write suite v22.

Approval:
- Schema/data/media approved and executed; deploy, data/media rollback, destructive cleanup, and legacy-retirement approval not used in this chunk.

Rollback:
- Importer rollback SQL required before apply; legacy portal remains fallback; deployment/media rollback remains gated.
~~~
