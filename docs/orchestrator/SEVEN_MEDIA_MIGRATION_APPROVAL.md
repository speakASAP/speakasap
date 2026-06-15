# Seven Media Migration Approval Packet

Date: 2026-06-13
Status: draft approval packet; no media copy, object mutation, deployment, or route change has run.

## Request

Approve a later controlled media migration for the public seven-course assets referenced by the migrated lessons:

- `1076` audio refs under `/media/audio/<language>/...`.
- `136` planned PDF refs under `/media/pdf/<language>/lesson<order>.pdf`.
- `133` external YouTube video refs extracted from legacy `{% video %}` tags.

This is separate from schema apply and content data apply. It must not include private learner records, paid-product changes, final test/assessment migration, destructive cleanup, or legacy route retirement.

## Current Evidence

- `/tmp/speakasap-seven-dry-run-v20.json`: `writes=false`, payload `languages=19`, `courses=19`, `lessons=136`, `exercises=429`, and media refs `audio=1076`, `pdf=136`, `video=133`, with `1212` internal `/media` refs.
- Legacy checkout path `/home/ssf/Documents/Github/speakasap-portal/media` does not exist in this checkout, so source media files must be located from production storage, backup, or another authoritative legacy media path before any copy approval.
- New production route checks currently fail for sample media:
  - `/tmp/speakasap-seven-media-check-sample-v18.json`: `https://speakasap.alfares.cz` sample `6/6` missing with HTTP `404`.
  - `/tmp/speakasap-seven-media-check-assets-sample-v18.json`: `https://assets.alfares.cz` sample `6/6` missing with HTTP `404`.
- Current ingress sends `/media/...` on `speakasap.alfares.cz` to the Next frontend catch-all, which returns a Next `404` unless a media route/rewrite/service is added.


## Source Candidate Evidence

Read-only HEAD checks against the legacy production domain show `https://speakasap.com` is a viable source candidate for most public seven media:

- `/tmp/speakasap-seven-media-check-legacy-source-v2.json`: checked `1212` internal `/media` refs from the v20 report; all `1212` returned HTTP `200`.
- Coverage by kind: all `136/136` PDF refs are available; all `1076/1076` audio refs are available.
- Previous v1 missing refs were caused by rendering legacy `fr/russian` audio tags as `/media/audio/ru/...`; v20 honors `ml='fr'`, so the source refs are `/media/audio/fr/...` and no missing audio refs remain.
- Direct read-only samples succeeded for `https://speakasap.com/media/audio/en/lesson1.mp3`, `https://speakasap.com/media/pdf/en/lesson1.pdf`, `https://speakasap.com/media/audio/cn/lesson1.mp3`, and the `fr/russian` audio alternatives recorded in `/tmp/speakasap-seven-ru-audio-source-alternatives-v1.json`.
- Read-only filesystem checks did not find matching samples under `/home/ssf/Documents/Github`, `/srv`, `/mnt`, `/opt`, or `/var/www` on `alfares`; legacy `speakasap-portal/media` is still absent in the checkout.


## Copy Manifest Evidence

The no-write manifest generator prepared copy-review artifacts from the legacy source availability report:

- `/tmp/speakasap-seven-media-copy-manifest-v3.json`: `1212` available copy candidates and `0` excluded missing refs.
- `/tmp/speakasap-seven-media-copy-manifest-v3.csv`: available copy candidates with source URL, target key, content type, and content length.
- `/tmp/speakasap-seven-media-missing-v3.csv`: unresolved missing refs; currently expected to contain only the CSV header because v3 has `0` missing refs.
- Available candidate size from source headers: audio `3,229,902,938` bytes; PDF `11,240,877` bytes.

These artifacts are evidence only. They do not download files and do not approve copy/routing.

## Proposed No-Write Verification Command

After source files are located and before any copy, regenerate the media inventory:

```bash
cd /home/ssf/Documents/Github/speakasap
content-service/scripts/migrate-seven-from-legacy.py --json-report /tmp/speakasap-seven-dry-run-media-precopy-v1.json
```

Check availability against the intended public base URL:

```bash
content-service/scripts/check-seven-media-availability.py --input-report /tmp/speakasap-seven-dry-run-media-precopy-v1.json --base-url https://assets.alfares.cz --json-report /tmp/speakasap-seven-media-precopy-v1.json
```

Expected before copy: missing refs on `https://assets.alfares.cz` are allowed and should be recorded. Source availability must still be checked against `https://speakasap.com` before any copy approval.

## Approved Copy Scope When Requested

A future explicit approval may allow only these public seven-course media objects. The approved action should use the gated operator:

```bash
cd /home/ssf/Documents/Github/speakasap
SEVEN_MEDIA_APPROVAL_TEXT='Approved to copy and route only public seven-course `/media/audio/...` and `/media/pdf/...` assets identified by `/tmp/speakasap-seven-media-copy-manifest-v3.json` from `https://speakasap.com` to the asset host serving `https://assets.alfares.cz/media/...`. No private media, unrelated media, destructive cleanup, final test migration, paid-product change, or legacy route retirement is approved.' \
MEDIA_COPY_MANIFEST=/tmp/speakasap-seven-media-copy-manifest-v3.json \
MEDIA_TARGET_ROOT=/absolute/path/served/by/assets-host \
  scripts/copy-seven-media-approved.sh --execute
```

The operator refuses to run without `--execute`, exact `SEVEN_MEDIA_APPROVAL_TEXT`, a manifest with `writes=false`, `availableRefs=1212`, `missingRefs=0`, and an existing `MEDIA_TARGET_ROOT`. It writes `/tmp/speakasap-seven-media-copy-execution-v1.json` and then runs the post-copy availability checker against `https://assets.alfares.cz`.

A future explicit approval may allow only these public seven-course media objects:

- Relative refs beginning `/media/audio/` or `/media/pdf/` from `/tmp/speakasap-seven-media-copy-manifest-v3.json` where `ok=true`, sourced from `https://speakasap.com`.
- Public route or asset-host configuration needed to serve those exact paths.
- No private recordings, no user uploads, no unrelated media folders, no deletion.

The preferred target is a stable public asset path that preserves legacy `/media/...` URLs, either by routing `/media` to the asset service or by making the frontend/content response use a proven public asset base URL. The chosen path must be verified before deploy/cutover.

## Required Post-Copy Verification

Run all-ref availability checks:

```bash
content-service/scripts/check-seven-media-availability.py --input-report /tmp/speakasap-seven-dry-run-media-precopy-v1.json --base-url https://assets.alfares.cz --json-report /tmp/speakasap-seven-media-postcopy-v1.json
```

Expected post-copy result:

- `writes=false` in the checker report.
- `checked` covers all internal `/media` refs from the report.
- `missing=0` for copied `/media/audio/...` and `/media/pdf/...` refs on `https://assets.alfares.cz`; any future unresolved refs must have documented legacy-source absence and a frontend fallback decision.
- External YouTube refs are not copied; they are verified separately only if `--include-external` is used.

## Rollback Boundary

Rollback depends on the selected target:

- If objects are uploaded to object storage, rollback must remove only the newly uploaded seven-course keys from the generated media key list after owner approval.
- If ingress/service routing is changed, rollback is the previous ingress/service manifest or previous frontend/content image digest.
- Do not delete any legacy production media.

## Required Approval Wording

Use explicit wording like:

> Approved to copy and route only public seven-course `/media/audio/...` and `/media/pdf/...` assets identified by `/tmp/speakasap-seven-media-copy-manifest-v3.json` from `https://speakasap.com` to the asset host serving `https://assets.alfares.cz/media/...`. No private media, unrelated media, destructive cleanup, final test migration, paid-product change, or legacy route retirement is approved.

Without that explicit approval and a located source media path, do not copy media or change `/media` routing.
