# Notification data migration log (TASK-52)

Append-only log written when running:

`cd notification-service && npm run migrate:notification-data -- --dry-run --write-docs`

(or `--load --write-docs` after a real load).

Each run appends a JSON block with legacy counts, skip counts, and dry-run vs load flag. **Do not** paste secrets or full connection strings here.

---
