# Agents: speakasap

## Repositories and production hosts

| Repo | Role | Typical host | Deploy |
|------|------|--------------|--------|
| **speakasap** (this monorepo speakasap.alfares.cz) | NestJS content-service, nginx templates, course-materials, Docker compose |
| **speakasap-portal** (speakasap.com) | Legacy Django 1.11, legacy Postgres and Python 3.4 `ssh speakasap` → `cd speakasap-portal` → `git pull` |

Content migration script `content-service/scripts/migrate-content-data.py` lives **only** in **speakasap**. Copy it to `speakasap-portal` on the legacy server when running `--export-dir` there (`README_MIGRATION.md`).

## Coordinator Config

```yaml
model_tier: cheap
cycle_interval_minutes: 120
max_tasks_per_cycle: 8
```

## Worker Pool Config

```yaml
max_concurrent_workers: 3
default_model_tier: free
allowed_mcp_servers: [filesystem, postgres]
```

## Active Agents
<!-- Coordinator-maintained -->
None — awaiting business-orchestrator Phase 1 deployment.
