# Notification data migration log (TASK-52)

Append-only log written when running:

`cd notification-service && npm run migrate:notification-data -- --dry-run --write-docs`

(or `--load --write-docs` after a real load).

Each run appends a JSON block with legacy counts, skip counts, and dry-run vs load flag. **Do not** paste secrets or full connection strings here.

---

## Run 2026-04-18T22:07:15.913Z

```json
{
  "dryRun": true,
  "counts": {
    "groups": 37,
    "templates": 117,
    "templateGroupLinks": 14,
    "groupManagerLinks": 37,
    "letters": 7725,
    "lettersOrphanTemplate": 0,
    "commonEmail": 126494,
    "templatePrefs": 166962,
    "templatePrefsOrphan": 0,
    "inApp": 8998
  },
  "skipped": {
    "lettersMissingTemplate": 0,
    "prefsMissingTemplate": 0,
    "missingTemplateFiles": 2
  }
}
```

## Run 2026-04-18T22:19:23.734Z

```json
{
  "dryRun": false,
  "counts": {
    "groups": 37,
    "templates": 117,
    "templateGroupLinks": 14,
    "groupManagerLinks": 37,
    "letters": 7725,
    "lettersOrphanTemplate": 0,
    "commonEmail": 126494,
    "templatePrefs": 166962,
    "templatePrefsOrphan": 0,
    "inApp": 8998
  },
  "skipped": {
    "lettersMissingTemplate": 0,
    "prefsMissingTemplate": 0,
    "missingTemplateFiles": 2
  }
}
```
