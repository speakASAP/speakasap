# Track K — Rollout (Wave 6, orchestrating session only)

> **For agentic workers:** This track is **not** for subagents. Subagents must not deploy. The orchestrating session runs every step here, one at a time.

**Goal:** Get it into production in an order where each step is verifiable and reversible.

**Depends on:** every other track reporting COMPLETE.

**Read first:** [`00-MASTER.md`](00-MASTER.md), spec §16, `shared/docs/DEPLOY_STANDARD.md`.

---

## Constraints that govern this whole track

- **Deploys are serialized ecosystem-wide.** One node, one containerd. `shared/scripts/deploy.sh` takes the lock automatically; everything else goes through `shared/scripts/with-deploy-lock.sh <command>`. Parallel deploys produce `name is reserved` errors and ~20-minute stuck rollouts.
- **Wait for rollouts with `shared/scripts/wait-for-rollout.sh`**, never `kubectl rollout status` and never hand-rolled jsonpath. Both produce false greens: `rollout status` returns the `progressDeadlineExceeded` error immediately on every later call, and `readyReplicas == 1` is satisfied by the *old* pod mid-rollout.
- **Never copy files to production.** Everything goes through commit → push → `deploy.sh`.
- **`ssh speakasap` is read only.** The portal deploy runs on that server through its own `./scripts/deploy.sh`, not by copying files.

---

### Task K.1: Apply migrations

Five migrations exist, created but unapplied: content-service ×3 (bank,
vocabulary, sets), education-service ×2 (assignments, notifiedAt).

- [ ] **Step 1: Back up the two databases first**

```bash
rtk /home/ssf/Documents/Github/shared/scripts/with-deploy-lock.sh \
  /home/ssf/Documents/Github/backups-microservice/scripts/backup-db.sh speakasap_content
rtk /home/ssf/Documents/Github/shared/scripts/with-deploy-lock.sh \
  /home/ssf/Documents/Github/backups-microservice/scripts/backup-db.sh speakasap_education
```

If those script paths do not exist, take a `pg_dump` through the postgres MCP
server's pod rather than skipping this step. Do not apply migrations without a
backup you have seen succeed.

- [ ] **Step 2: Review every migration's SQL before applying**

```bash
rtk cat /home/ssf/Documents/Github/speakasap/content-service/prisma/migrations/*/migration.sql
rtk cat /home/ssf/Documents/Github/speakasap/education-service/prisma/migrations/*/migration.sql
```

Confirm: only `CREATE TABLE`, `CREATE INDEX`, and the one `ALTER TABLE … ADD
COLUMN notifiedAt`. **Any `DROP` is a stop condition** — report it and halt.

- [ ] **Step 3: Apply, one service at a time**

```bash
cd /home/ssf/Documents/Github/speakasap/content-service && rtk npm run prisma:migrate:deploy
cd /home/ssf/Documents/Github/speakasap/education-service && rtk npm run prisma:migrate:deploy
```

- [ ] **Step 4: Verify the tables exist**

Use `postgres_query` (read-only) against `speakasap_content` and
`speakasap_education`:

```sql
SELECT tablename FROM pg_tables WHERE tablename LIKE 'drill%' ORDER BY tablename;
```

Expected in content: `drill_course_vocabulary`, `drill_item`,
`drill_item_revision`, `drill_set`, `drill_set_item`, `drill_set_rating`,
`drill_topic`. In education: `drill_assignment`, `drill_assignment_batch`,
`drill_assignment_item`, `drill_attempt`.

---

### Task K.2: Run the data migrations

- [ ] **Step 1: Grammar bank, dry run first, then apply**

```bash
cd /home/ssf/Documents/Github/speakasap/content-service
rtk npx ts-node scripts/import-grammar-bank.ts /home/ssf/Documents/Github/speakasap-portal --dry-run | tail -20
rtk npx ts-node scripts/import-grammar-bank.ts /home/ssf/Documents/Github/speakasap-portal | tail -20
```

- [ ] **Step 2: Prove idempotence — run it a second time**

```bash
rtk npx ts-node scripts/import-grammar-bank.ts /home/ssf/Documents/Github/speakasap-portal | tail -5
```

Expected: `itemsInserted: 0`, everything counted as duplicate. If the second run
inserts anything, the hash is unstable — stop, and do not run the seven importer
until it is fixed.

- [ ] **Step 3: Course-material bank, same pattern**

- [ ] **Step 4: Build the vocabulary baseline**

```bash
rtk npx ts-node scripts/build-course-vocabulary.ts | tail -40
```

Record the coverage table. **Name every course with fewer than 50 words at
lesson 5** — generation for those courses will over-trigger regeneration, and
the teacher should know which before they hit it.

- [ ] **Step 5: Sanity-check the imported data**

```sql
SELECT "sourceType", COUNT(*) FROM drill_item GROUP BY 1;
SELECT COUNT(*) FROM drill_item WHERE jsonb_array_length(blanks) = 0;  -- must be 0
SELECT COUNT(DISTINCT hash) = COUNT(*) AS hashes_unique FROM drill_item;  -- must be true
```

---

### Task K.3: Deploy services, one at a time

Order matters: producers before consumers, so nothing calls an endpoint that
does not exist yet.

- [ ] **Step 1: auth-microservice** (new provisioning endpoint, no consumers yet)

```bash
cd /home/ssf/Documents/Github/auth-microservice && rtk ./scripts/deploy.sh
rtk /home/ssf/Documents/Github/shared/scripts/wait-for-rollout.sh -n statex-apps auth-microservice
```

- [ ] **Step 2: ai-microservice** (agents, no consumers yet)
- [ ] **Step 3: content-service** (bank, vocabulary, library)
- [ ] **Step 4: education-service** (assignments, orchestration, runner)
- [ ] **Step 5: notification-service**
- [ ] **Step 6: api-gateway** (routes — after every upstream exists)
- [ ] **Step 7: frontend**

After each: `wait-for-rollout.sh`, then `curl` the service's `/health` from
inside the cluster. Do not start the next deploy until the previous one is
converged.

- [ ] **Step 8: speakasap-portal, last**

```bash
ssh speakasap 'cd speakasap-portal && ./scripts/deploy.sh'
```

The portal links into the platform, so it ships only once the platform answers.

---

### Task K.4: Reproduce the whole flow in a browser

Not a smoke test — the actual user journey, end to end, in a real browser via
Playwright MCP. A green CI suite is not evidence that a teacher can assign a drill.

- [ ] **Step 1: Teacher creates an assignment**

Log in as a test teacher on the legacy portal → open a lesson → click "Create
drilling assignment" → confirm the SSO handoff lands you signed in on
`/teacher/assignments/new` with the lesson and student prefilled.

- [ ] **Step 2: Generation runs visibly**

Request 10 preposition items for a German student. Confirm the progress view
shows named phases and a running count, and that items appear as they arrive.

- [ ] **Step 3: Review shows validation**

Confirm flagged items sort first with their issue text, that **Approve** is
disabled while a FAIL is open, and that it enables after override or
regeneration. Confirm **no score appears anywhere on the page**.

- [ ] **Step 4: Student receives and completes it**

Check the student's legacy dashboard shows the card. Follow it into the runner.
Type a wrong answer — confirm red, still editable. Type the right answer —
confirm it becomes bold green text inline and focus advances. Complete the set.

- [ ] **Step 5: Prove the answer is not in the browser**

With the runner open, in devtools:

```js
JSON.stringify(performance.getEntriesByType('resource').map(r => r.name))
// then inspect the /runner response body in the Network tab
```

Confirm the response contains no `answer` or `alternatives` key. **This is the
single most important verification in this task.** If an answer is present,
stop and roll back the frontend.

- [ ] **Step 6: Notifications arrive**

Confirm the student got the assign email and the teacher got the completion
email. Read the teacher's email and confirm it contains **no percentage and no
accuracy wording**.

- [ ] **Step 7: Self-drilling gate**

With an assignment outstanding, confirm the student's self-practice section is
locked. Complete the assignment, reload, confirm it unlocks. Then call
`POST /api/v1/drill-assignments/self` directly with a fresh outstanding
assignment and confirm the server returns 409 with `ASSIGNMENT_OUTSTANDING` —
the UI being right does not prove the server is.

---

### Task K.5: Post-rollout checks

- [ ] **Step 1: Watch logs for 15 minutes**

```bash
rtk kubectl logs -n statex-apps -l app=speakasap-education --since=15m | rtk rg -i "error|exception"
rtk kubectl logs -n statex-apps -l app=speakasap-content --since=15m | rtk rg -i "error|exception"
rtk kubectl logs -n statex-apps -l app=ai-microservice --since=15m | rtk rg -i "error|exception"
```

- [ ] **Step 2: Confirm no assignment is stuck**

```sql
SELECT status, COUNT(*) FROM drill_assignment GROUP BY 1;
SELECT COUNT(*) FROM drill_assignment
 WHERE status = 'GENERATING' AND created_at < NOW() - INTERVAL '10 minutes';
```

The second must be 0; if not, the stale sweep is not firing.

- [ ] **Step 3: Update the docs**

- `speakasap/SYSTEM.md` — add drilling to the integrations table
- `speakasap/TASKS.md` — mark the feature shipped, note anything deferred
- `shared/ECOSYSTEM_MAP.md` — note the new ai-microservice teacher-assistant endpoints

- [ ] **Step 4: Write the final status file**

`status/track-k.md` with: migrations applied, import totals, vocabulary coverage
per course, deploy order and timings, browser reproduction results, and the
answer-leak check outcome quoted verbatim.

---

## Rollback

If step K.4 fails at any point:

1. **Frontend only** — `kubectl set image` back to the previous tag. Nothing else depends on it.
2. **A backend service** — same, but redeploy the gateway last so routes never point at a version that has gone away.
3. **Data** — the migrations are additive; there is nothing to undo. The imported bank rows are inert until a teacher generates a set. Leave them.
4. **The portal** — revert the template commit and redeploy. The blocks fail soft, so a partial revert is not dangerous.

Do not roll back the database. Every migration in this feature is additive by
construction, and the verification in K.1 step 2 exists to keep it that way.
