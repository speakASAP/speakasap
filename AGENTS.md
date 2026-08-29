# Repository Agent Instructions

Shared rules live here:

- Codex profile: `/home/ssf/.codex/AGENTS.md`
- Cross-agent standard: `/home/ssf/.ai-agent-standards/CROSS_AGENT_AUTOMATION_STANDARD.md`
- Repository operations: `AGENT_OPERATIONS.md`

Read those first, then follow the repository-specific notes below and the current planning/status files.


## Repository-Specific Notes

# Agents: speakasap

SpeakASAP is being refactored from the legacy Django portal into the new Alpharis/SpeakASAP microservice platform. AI/Codex sessions must follow the SpeakASAP orchestrator pack before planning or implementing work.

## Mandatory Reading Order

1. `BUSINESS.md`
2. `SYSTEM.md`
3. `docs/orchestrator/MASTER_PROMPT.md`
4. `docs/orchestrator/IMPLEMENTATION_ORCHESTRATOR.md`
5. `docs/orchestrator/INTENT.md`
6. `docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md`
7. `docs/orchestrator/GOALS.md`
8. `docs/orchestrator/PLAN.md`
9. `docs/orchestrator/IMPLEMENTATION_STATE.md`
10. `docs/orchestrator/STATE.json`
11. `docs/orchestrator/STATUS.md`
12. `TASKS.md`
13. `STATE.json`

## Knowledge Retrieval

Use `docs-rag-microservice` for bounded discovery when it is healthy, then
verify deployment, security, database, integration and public-contract facts
against the cited Git source. Git remains authoritative.

Authority and fallback rules:
`/home/ssf/Documents/Github/shared/docs/DOCUMENTATION_AUTHORITY.md`.

Do not generate tokens in documentation or assume an unconfident/failed RAG
response means that source documentation does not exist.

## Repositories

| Repo | Role |
|------|------|
| **speakasap** (this repo) | NestJS/Next.js microservice monorepo for the new SpeakASAP platform |
| **speakasap-portal** | Legacy Django 1.11 / Python 3.4 portal; behavior reference during migration |

## Deployment

All new SpeakASAP services run on Kubernetes (`statex-apps` namespace). Manifests live in `speakasap/k8s/`.
Secrets: Vault -> ESO -> K8s Secrets. See `../shared/docs/VAULT.md`.
Deploy service changes with `kubectl rollout restart deployment/<svc> -n statex-apps` or rebuild image + apply manifests according to the service-specific deploy process.

## Remote Git Permission

The owner permits AI/Codex sessions to create git commits on the remote `alfares` server only inside `/home/ssf/Documents/Github/speakasap`. This permission does not apply to other remote folders or repositories, and migration commit messages must still include the intent/evidence/verification/approval/rollback block required by `docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md`.

## Coordinator Config

```yaml
model_tier: cheap
cycle_interval_minutes: 120
max_tasks_per_cycle: 8
```

## Master Orchestrator Model

SpeakASAP uses the Goalkeeper-style master-agent model:

- One master orchestrator owns goal selection, planning, task splitting, worker coordination, validation, state updates, and owner reports.
- Continuation is state-driven, not chat-driven. Use `docs/orchestrator/IMPLEMENTATION_STATE.md`, `docs/orchestrator/STATE.json`, root `STATE.json`, `docs/orchestrator/GOALS.md`, and `docs/orchestrator/PLAN.md` to choose the next action.
- Worker agents may be used only for bounded read-only investigation, disjoint implementation, validation, or merge review. The master orchestrator remains responsible for final integration and evidence.
- Do not ask the owner which goal is next unless state is contradictory or a true approval/scope decision is required.

## Intent Preservation Rule

Every plan, goal, implementation chunk, migration script, contract, and deployment must preserve SpeakASAP's original intent: online language education with private student data, course/lesson continuity, assessments, certifications, payments, notifications, and teacher/student workflows. The refactor must move behavior deliberately from `speakasap-portal` into the new platform without silently changing product behavior or ownership boundaries.

Before committing migration work, complete `docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md`: record context, legacy evidence, ownership, dry-run/reconciliation evidence, verification, approval status, rollback plan, and the required commit-message evidence block.

## Goalkeeper-Style Communication

For owner-facing updates, state the current goal, what was changed or verified, what evidence exists, and end with a clear sentence beginning: `The next step is`.

## Active Agents
<!-- Coordinator-maintained -->
None.
