# Track 0 — Foundation (Wave 1, BLOCKING)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Give the speakasap repo a test runner, publish the drill contracts as a single source of truth, and route the new API prefixes.

**Why this blocks everything:** the speakasap repo currently has **no jest, no ts-jest, no `@nestjs/testing`, no `test` script and zero `.spec.ts` files in any of its 12 services**. Without this track, every TDD step in every other track is impossible to execute.

**Read first:** [`00-MASTER.md`](00-MASTER.md) — Global Constraints and the Contracts section.

---

### Task 0.1: Test infrastructure for the whole speakasap repo

This is repo-wide, not drilling-specific. The four services this feature touches
need it to function; the other eight need it so the repo has one way to run
tests, and so the next feature does not repeat this task.

**Current state, measured 2026-07-29:** 12 packages, **every one with zero test
dependencies**, zero `.spec.ts` files, no `test` script, no `typecheck` script,
and **no root `package.json`** — so there is no repo-wide command either.

**Files:**
- Create: `speakasap/jest.config.base.js`
- Create: `speakasap/<service>/jest.config.js` × 11 NestJS services
- Create: `speakasap/frontend/vitest.config.ts`, `speakasap/frontend/vitest.setup.ts`
- Create: `speakasap/package.json` (root — scripts only, `private: true`, no dependencies)
- Modify: 12 × `package.json` (scripts + devDependencies)
- Test: `speakasap/education-service/src/sanity.spec.ts` (temporary, deleted in step 7)

The 11 NestJS services: `api-gateway`, `assessment-service`,
`certification-service`, `content-service`, `course-service`,
`education-service`, `financial-service`, `notification-service`,
`payment-service`, `salary-service`, `user-service`. Plus `frontend` (Next.js,
Vitest — see step 4).

**Interfaces:**
- Consumes: nothing
- Produces:
  - `npm test` and `npm run typecheck` in each of the 12 packages
  - `npm test` and `npm run typecheck` at the repo root, fanning out to all 12
  - Every later task in every track depends on these commands existing.

**Note for Track E:** frontend Vitest setup moves here. Track E task E.1 becomes
a no-op — check whether this task has landed before doing it.

- [ ] **Step 1: Add the dev dependencies to all 11 NestJS services**

```bash
cd /home/ssf/Documents/Github/speakasap
for s in api-gateway assessment-service certification-service content-service \
         course-service education-service financial-service notification-service \
         payment-service salary-service user-service; do
  echo "== $s"
  rtk npm --prefix "$s" install --save-dev \
    jest@^29.7.0 ts-jest@^29.1.2 @types/jest@^29.5.12 @nestjs/testing@^10.3.10
done
```

This takes several minutes. Some services may have peer-dependency warnings
against their pinned NestJS version — warnings are fine, a hard `ERESOLVE`
failure is not. Record any service that fails and continue with the rest; a
service that cannot take the dependency is reported, not forced.

- [ ] **Step 2: Create the shared base config**

`speakasap/jest.config.base.js`:

```js
/** Shared jest config for every NestJS service in this repo.
 *  Services extend it so the settings live in one place. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['**/*.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '\\.module\\.ts$', 'main\\.ts$'],
};
```

- [ ] **Step 3: Create the per-service jest config**

Identical in all 11. Write to `<service>/jest.config.js`:

```js
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['**/*.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '\\.module\\.ts$', 'main\\.ts$'],
};
```

```js
const base = require('../jest.config.base');
module.exports = { ...base };
```

- [ ] **Step 4: Set up the frontend with Vitest**

Next.js 15 + App Router: Vitest reads `next.config.ts` module resolution and the
existing `tsconfig.json` paths without a Babel transform step, which Jest would
need configured by hand.

```bash
cd /home/ssf/Documents/Github/speakasap/frontend
rtk npm install --save-dev vitest@^2 @vitejs/plugin-react@^4 jsdom@^25 \
  @testing-library/react@^16 @testing-library/user-event@^14 @testing-library/jest-dom@^6
```

`frontend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    include: ['{app,lib}/**/*.test.{ts,tsx}'],
  },
  resolve: { alias: { '@': resolve(__dirname, '.') } },
});
```

`frontend/vitest.setup.ts` is one line:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Add the scripts to all 12 `package.json` files**

In each of the 11 NestJS services, add to `"scripts"`:

```json
"test": "jest --passWithNoTests",
"test:watch": "jest --watch",
"typecheck": "./node_modules/.bin/tsc --noEmit -p tsconfig.json"
```

In `frontend/package.json`:

```json
"test": "vitest run --passWithNoTests",
"test:watch": "vitest",
"typecheck": "./node_modules/.bin/tsc --noEmit -p tsconfig.json"
```

`--passWithNoTests` is required: both runners exit 1 when they find no test
files, and eight of these packages will have none for a while. It is passed as
a **CLI flag rather than a config key** so it stays visible in `package.json`.

It is also a false-green risk — the same class of problem as `npx tsc`. Once a
package has tests, a broken config that discovers zero suites would report
green. Step 6's `run-all.sh` therefore reports zero-suite packages explicitly,
so the empty state is visible rather than silent.

The `typecheck` script invokes the compiler **by path** so nobody is tempted to
run `npx tsc`, which silently runs the unrelated registry package `tsc@2.0.4`
and prints "This is not the tsc command you are looking for" — which rtk parses
as "No errors found", exactly like a real pass.

- [ ] **Step 6: Create the root `package.json`**

The repo has none, which is why there has never been a repo-wide typecheck.
Scripts only — no dependencies, no workspaces (the services install
independently and adding workspaces would rewrite every lockfile).

`speakasap/package.json`:

```json
{
  "name": "speakasap",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "test": "bash scripts/run-all.sh test",
    "typecheck": "bash scripts/run-all.sh typecheck"
  }
}
```

`speakasap/scripts/run-all.sh`:

```bash
#!/usr/bin/env bash
# Run one npm script across every package that defines it.
# Continues past failures and reports a summary, so one broken service
# does not hide the state of the other eleven.
set -uo pipefail

SCRIPT="${1:?usage: run-all.sh <npm-script>}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PACKAGES=(api-gateway assessment-service certification-service content-service
          course-service education-service financial-service notification-service
          payment-service salary-service user-service frontend)

failed=()
no_tests=()
for p in "${PACKAGES[@]}"; do
  [[ -f "$ROOT/$p/package.json" ]] || continue
  if ! node -e "process.exit(require('$ROOT/$p/package.json').scripts?.['$SCRIPT']?0:1)"; then
    echo "SKIP  $p (no '$SCRIPT' script)"
    continue
  fi
  echo "=== $p: npm run $SCRIPT"
  out="$(npm --prefix "$ROOT/$p" run "$SCRIPT" --silent 2>&1)"
  status=$?
  echo "$out"
  if [[ $status -eq 0 ]]; then
    if grep -qE "No tests found|No test files found" <<<"$out"; then
      echo "PASS  $p (0 suites)"
      no_tests+=("$p")
    else
      echo "PASS  $p"
    fi
  else
    echo "FAIL  $p"
    failed+=("$p")
  fi
done

echo
echo "--- summary: ${#failed[@]} failed"
for f in "${failed[@]}"; do echo "  FAIL $f"; done
echo "--- packages with zero test suites: ${#no_tests[@]}"
for n in "${no_tests[@]}"; do echo "  EMPTY $n"; done
[[ ${#failed[@]} -eq 0 ]]
```

The zero-suite report exists because `--passWithNoTests` would otherwise hide a
package whose tests stopped being discovered. Zero suites never fails the
command — it is the correct state for a package with no tests yet — but it is
always visible in the summary.

Make it executable: `rtk chmod +x /home/ssf/Documents/Github/speakasap/scripts/run-all.sh`

- [ ] **Step 7: Write a sanity test that must fail**

Create `speakasap/education-service/src/sanity.spec.ts`:

```ts
describe('jest wiring', () => {
  it('runs TypeScript and reports real failures', () => {
    const sum = (a: number, b: number): number => a + b;
    expect(sum(2, 2)).toBe(5);
  });
});
```

- [ ] **Step 8: Run both sanity tests and confirm they FAIL**

```bash
rtk npm --prefix /home/ssf/Documents/Github/speakasap/education-service test
rtk npm --prefix /home/ssf/Documents/Github/speakasap/frontend test
```

Expected in each: `1 failed`, with `Expected: 5 / Received: 4`.

This step is not ceremony. It is the only proof that each runner executes
TypeScript and reports failures rather than exiting 0 on an empty match — the
exact failure mode that makes a fresh test setup worthless.

For the frontend, create the matching temporary file
`frontend/lib/sanity.test.ts`:

```ts
describe('vitest wiring', () => {
  it('runs TypeScript and reports real failures', () => {
    const sum = (a: number, b: number): number => a + b;
    expect(sum(2, 2)).toBe(5);
  });
});
```

- [ ] **Step 9: Fix both assertions, confirm PASS, then delete both files**

Change `toBe(5)` to `toBe(4)` in each, rerun — expect `1 passed` in both. Then:

```bash
rtk rm /home/ssf/Documents/Github/speakasap/education-service/src/sanity.spec.ts
rtk rm /home/ssf/Documents/Github/speakasap/frontend/lib/sanity.test.ts
```

- [ ] **Step 10: Run the repo-wide commands**

```bash
cd /home/ssf/Documents/Github/speakasap
rtk npm test
rtk npm run typecheck
```

`npm test` across 12 packages with no test files reports every package as
`PASS (0 suites)` and lists all 12 under "packages with zero test suites". That
is the correct empty state, and it is visible rather than silent.

`npm run typecheck` is the interesting one: **this repo has never been
typechecked as a whole.** Expect pre-existing errors in services untouched by
this feature.

**Record every failure in the status file and fix none of them.** Fixing
pre-existing type errors in eight services this feature does not touch is a
separate piece of work, would collide with other tracks, and would bury the
drilling changes in unrelated diffs. The value delivered here is that the errors
are now *visible and countable* for the first time.

- [ ] **Step 11: Commit**

```bash
cd /home/ssf/Documents/Github/speakasap
rtk git add package.json scripts/run-all.sh jest.config.base.js \
  api-gateway assessment-service certification-service content-service \
  course-service education-service financial-service notification-service \
  payment-service salary-service user-service frontend
rtk git commit -m "chore: give the speakasap repo a test runner

The repo had none: 12 packages, zero test dependencies, zero spec files,
no test or typecheck script, and no root package.json.

Every NestJS service now has jest+ts-jest extending one shared base
config; the frontend has vitest+testing-library; all 12 have a typecheck
script that invokes the local compiler by path rather than via npx, which
silently runs the wrong package and reports a false pass. A root
package.json fans both commands out across the repo.

Both runners were verified with a deliberately failing test before use.
Pre-existing typecheck failures in untouched services are reported, not
fixed — that is separate work.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 0.2: Contracts source of truth and sync script

**Files:**
- Create: `speakasap/shared/contracts/drills.contracts.ts`
- Create: `speakasap/shared/scripts/sync-drill-contracts.sh`
- Create: `speakasap/shared/contracts/drills.contracts.sha256`
- Create: `speakasap/content-service/src/drills/contracts.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `src/drills/contracts.ts` in content-service, education-service, notification-service; `src/teacher-assistant/contracts.ts` in ai-microservice; `lib/drills/contracts.ts` in frontend. **Every other track imports its types from its own vendored copy.**

- [ ] **Step 1: Write the contracts file**

Create `speakasap/shared/contracts/drills.contracts.ts` containing, verbatim and
in order, contract blocks **C1 through C9** from [`00-MASTER.md`](00-MASTER.md).
Prepend this header:

```ts
/**
 * Drill contracts — SINGLE SOURCE OF TRUTH.
 *
 * Do not edit the vendored copies in services. Edit this file, then run
 *   speakasap/shared/scripts/sync-drill-contracts.sh
 * A contract change invalidates in-flight work in other tracks: announce it.
 *
 * Spec: docs/superpowers/specs/2026-07-29-drilling-assignments-design.md
 */
```

- [ ] **Step 2: Write the sync script**

Create `speakasap/shared/scripts/sync-drill-contracts.sh`:

```bash
#!/usr/bin/env bash
# Vendor the drill contracts into every consumer. Idempotent.
# --check exits non-zero when any copy has drifted from the source.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="$ROOT/shared/contracts/drills.contracts.ts"
GITHUB="$(cd "$ROOT/.." && pwd)"

TARGETS=(
  "$ROOT/content-service/src/drills/contracts.ts"
  "$ROOT/education-service/src/drills/contracts.ts"
  "$ROOT/notification-service/src/drills/contracts.ts"
  "$ROOT/frontend/lib/drills/contracts.ts"
  "$GITHUB/ai-microservice/src/teacher-assistant/contracts.ts"
)

CHECK_ONLY=0
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1

fail=0
for t in "${TARGETS[@]}"; do
  mkdir -p "$(dirname "$t")"
  if [[ $CHECK_ONLY -eq 1 ]]; then
    if ! diff -q "$SRC" "$t" >/dev/null 2>&1; then
      echo "DRIFT: $t differs from $SRC"
      fail=1
    fi
  else
    cp "$SRC" "$t"
    echo "synced -> $t"
  fi
done

sha256sum "$SRC" | awk '{print $1}' > "$ROOT/shared/contracts/drills.contracts.sha256"
exit $fail
```

- [ ] **Step 3: Make it executable and run it**

```bash
rtk chmod +x /home/ssf/Documents/Github/speakasap/shared/scripts/sync-drill-contracts.sh
rtk /home/ssf/Documents/Github/speakasap/shared/scripts/sync-drill-contracts.sh
```

Expected: five `synced -> …` lines.

- [ ] **Step 4: Write the drift test**

Create `speakasap/content-service/src/drills/contracts.spec.ts`:

```ts
import { execFileSync } from 'child_process';
import { join } from 'path';

describe('drill contracts', () => {
  it('vendored copies match the source of truth', () => {
    const script = join(__dirname, '../../../shared/scripts/sync-drill-contracts.sh');
    expect(() => execFileSync(script, ['--check'], { encoding: 'utf8' })).not.toThrow();
  });
});
```

- [ ] **Step 5: Prove the test catches drift**

```bash
cd /home/ssf/Documents/Github/speakasap
echo "// drift" >> content-service/src/drills/contracts.ts
rtk npm --prefix content-service test -- contracts.spec
```

Expected: FAIL, with `DRIFT:` naming the content-service copy.

Now restore and rerun:

```bash
rtk ./shared/scripts/sync-drill-contracts.sh
rtk npm --prefix content-service test -- contracts.spec
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /home/ssf/Documents/Github/speakasap
rtk git add shared/contracts shared/scripts/sync-drill-contracts.sh \
  content-service/src/drills education-service/src/drills \
  notification-service/src/drills frontend/lib/drills
rtk git commit -m "feat: publish drill contracts with a sync script and drift test

Single source of truth in shared/contracts, vendored into five consumers.
The drift test was proven by introducing drift and watching it fail.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
cd /home/ssf/Documents/Github/ai-microservice
rtk git add src/teacher-assistant/contracts.ts
rtk git commit -m "feat: vendor drill contracts from speakasap/shared

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 0.3: Gateway routes

**Files:**
- Modify: `speakasap/api-gateway/src/proxy/upstream-resolve.ts`
- Test: `speakasap/api-gateway/src/proxy/upstream-resolve.spec.ts` (create)

**Interfaces:**
- Consumes: nothing
- Produces: `/api/v1/drill-*` and `/api/v1/course-vocabulary` reachable through the gateway. Tracks E, F and J all call through these prefixes.

**Critical ordering detail:** the existing table is longest-prefix-wins and
already contains `{ prefix: '/api/v1/internal', envKey: 'USER_SERVICE_URL' }`.
`/api/v1/internal/drill-assignments` **must be inserted above it**, or every
internal drill call silently routes to user-service and 404s.

- [ ] **Step 1: Write the failing test**

Create `speakasap/api-gateway/src/proxy/upstream-resolve.spec.ts`:

```ts
import { resolveUpstream } from './upstream-resolve';

describe('resolveUpstream — drill routes', () => {
  beforeEach(() => {
    process.env.EDUCATION_SERVICE_URL = 'http://education:4205';
    process.env.CONTENT_SERVICE_URL = 'http://content:4201';
    process.env.USER_SERVICE_URL = 'http://user:4206';
  });

  it('routes drill assignments to education-service', () => {
    expect(resolveUpstream('/api/v1/drill-assignments/mine')).toBe('http://education:4205');
  });

  it('routes drill sets, items, topics and vocabulary to content-service', () => {
    expect(resolveUpstream('/api/v1/drill-sets')).toBe('http://content:4201');
    expect(resolveUpstream('/api/v1/drill-items/search')).toBe('http://content:4201');
    expect(resolveUpstream('/api/v1/drill-topics')).toBe('http://content:4201');
    expect(resolveUpstream('/api/v1/course-vocabulary')).toBe('http://content:4201');
  });

  it('routes internal drill assignments to education, NOT user-service', () => {
    expect(resolveUpstream('/api/v1/internal/drill-assignments/by-student/42'))
      .toBe('http://education:4205');
  });

  it('leaves other internal routes on user-service', () => {
    expect(resolveUpstream('/api/v1/internal/anything-else')).toBe('http://user:4206');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
rtk npm --prefix /home/ssf/Documents/Github/speakasap/api-gateway test -- upstream-resolve
```

Expected: FAIL. If `resolveUpstream` is not the exported name, read
`upstream-resolve.ts` and adjust the import in the test to the real export —
do not rename the production function.

- [ ] **Step 3: Add the routes**

In `upstream-resolve.ts`, insert into the `ROUTES` array. Place the internal
entry **immediately before** the existing `/api/v1/internal` line, and the rest
anywhere in the `/api/v1/*` block:

```ts
  { prefix: '/api/v1/internal/drill-assignments', envKey: 'EDUCATION_SERVICE_URL' },
  // ... existing '/api/v1/internal' -> USER_SERVICE_URL must come AFTER the line above

  { prefix: '/api/v1/drill-assignments', envKey: 'EDUCATION_SERVICE_URL' },
  { prefix: '/api/v1/drill-sets', envKey: 'CONTENT_SERVICE_URL' },
  { prefix: '/api/v1/drill-items', envKey: 'CONTENT_SERVICE_URL' },
  { prefix: '/api/v1/drill-topics', envKey: 'CONTENT_SERVICE_URL' },
  { prefix: '/api/v1/course-vocabulary', envKey: 'CONTENT_SERVICE_URL' },
```

- [ ] **Step 4: Run the tests, confirm PASS**

```bash
rtk npm --prefix /home/ssf/Documents/Github/speakasap/api-gateway test -- upstream-resolve
```

Expected: 4 passed.

- [ ] **Step 5: Prove the ordering test is real**

Temporarily move the `/api/v1/internal/drill-assignments` line *below* the
`/api/v1/internal` line, rerun, and confirm the third test fails with
`http://user:4206`. Restore the correct order and rerun. This is the one bug
this task exists to prevent; verify the test catches it.

- [ ] **Step 6: Typecheck and commit**

```bash
cd /home/ssf/Documents/Github/speakasap
rtk npm --prefix api-gateway run typecheck
rtk git add api-gateway/src/proxy
rtk git commit -m "feat(gateway): route drill and vocabulary prefixes

/api/v1/internal/drill-assignments is placed above /api/v1/internal so
longest-prefix matching sends it to education-service rather than
user-service. The ordering test was verified by reversing the order and
watching it fail.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 0.4: Environment variables and Vault keys

**Files:**
- Modify: `speakasap/.env.example`
- Modify: `speakasap/education-service/src/shared/validate-env.ts`
- Modify: `speakasap/content-service/src/shared/validate-env.ts`

**Interfaces:**
- Consumes: nothing
- Produces: the env names Tracks C, D and I read.

- [ ] **Step 1: Add to `speakasap/.env.example`**

```bash
# --- Drilling assignments ---
# ai-microservice base URL, used by education-service for generation and validation
AI_SERVICE_URL=http://ai-microservice:3380
# Model tier for drill generation and validation. 'smart' = best available.
DRILL_GENERATION_MODEL_TIER=smart
# Seconds before a GENERATING set is swept to CANCELLED
DRILL_GENERATION_TIMEOUT_SECONDS=600
# Shared secret for legacy portal -> platform SSO (Vault: secret/prod/speakasap-portal)
SPEAKASAP_PLATFORM_JWT_SECRET=
# Public base URL used in emails and legacy portal links
SPEAKASAP_PLATFORM_URL=https://speakasap.alfares.cz
```

- [ ] **Step 2: Add the required-var assertions**

In `education-service/src/shared/validate-env.ts`, add `AI_SERVICE_URL` and
`DRILL_GENERATION_MODEL_TIER` to the required list, following whatever pattern
the file already uses. Read the file before editing; match its existing style
rather than introducing a new one.

- [ ] **Step 3: Write the secrets to Vault**

```bash
rtk /home/ssf/Documents/Github/shared/scripts/vault-secret.sh \
  speakasap-portal set SPEAKASAP_PLATFORM_JWT_SECRET="$(openssl rand -hex 32)"
```

Do **not** print the value. If the helper script does not exist under that
name, use the `/vault-secret` skill instead.

- [ ] **Step 4: Verify env validation fails without the vars**

```bash
cd /home/ssf/Documents/Github/speakasap/education-service
rtk env -u AI_SERVICE_URL node -e "require('./dist/shared/validate-env')" 2>&1 | head -3
```

Expected: an error naming `AI_SERVICE_URL`. If the service is not built, run
`rtk npm --prefix . run build` first.

- [ ] **Step 5: Commit**

```bash
cd /home/ssf/Documents/Github/speakasap
rtk git add .env.example education-service/src/shared/validate-env.ts \
  content-service/src/shared/validate-env.ts
rtk git commit -m "chore: declare drilling env vars and validate them at boot

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Track 0 completion checklist

- [ ] `rtk npm test` runs from the repo root and reaches all 12 packages
- [ ] `rtk npm run typecheck` runs from the repo root; **pre-existing failures are recorded, not fixed**
- [ ] Both runners verified with a deliberately failing test (jest and vitest)
- [ ] `shared/scripts/sync-drill-contracts.sh --check` exits 0
- [ ] The drift test fails when drift is introduced
- [ ] The gateway ordering test fails when the order is reversed
- [ ] Status file written to `status/track-0.md` with pasted command output, including the full list of services with pre-existing type errors

**Announce to the orchestrator before Wave 2 starts.** Tracks A, B, C and H all
assume `src/drills/contracts.ts` exists and `npm test` works; Tracks E and F
assume the frontend Vitest config exists.
