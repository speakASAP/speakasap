# Course data validation (TASK-37)

Run against **`speakasap_course_db`** after ETL.

## 1. Row counts vs legacy (manual)

Compare `COUNT(*)` on each mirrored table between **source** and **target** (should match after full import).

```sql
-- Target (speakasap_course_db)
SELECT 'products_category' AS t, COUNT(*) FROM products_category
UNION ALL SELECT 'products_product', COUNT(*) FROM products_product
UNION ALL SELECT 'offers_offer', COUNT(*) FROM offers_offer;
```

## 2. Referential integrity (target)

```sql
-- Products with missing category (expect 0 rows)
SELECT p.id FROM products_product p
LEFT JOIN products_category c ON c.id = p.category_id
WHERE c.id IS NULL;

-- Offers with bad course_product_id (expect 0 rows)
SELECT o.uuid FROM offers_offer o
WHERE o.course_product_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM products_product p WHERE p.id = o.course_product_id);

-- M2M dangling (expect 0 rows)
SELECT * FROM products_product_part_payments m
WHERE NOT EXISTS (SELECT 1 FROM products_product p WHERE p.id = m.product_id)
   OR NOT EXISTS (SELECT 1 FROM products_partpaymentcollection c WHERE c.id = m.partpaymentcollection_id);
```

## 3. Sign-off

| Check | Pass |
|-------|------|
| Counts aligned (± documented skips) | [ ] |
| FK queries return 0 bad rows | [ ] |
| `npm run build` in `course-service/` | [ ] |
