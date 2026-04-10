# Content Service — Legacy Django → Prisma Data Mapping

**Legacy:** `speakasap-portal` repository (local e.g. `/Users/.../speakasap-portal`; production on **speakasap** server). **Target schema:** `speakasap/content-service/prisma/schema.prisma` (this monorepo on **alfares**). Migration script: `content-service/scripts/migrate-content-data.py` — copy to legacy host for export (`README_MIGRATION.md`).

## 1. Legacy model inventory

### 1.1 `language.Language`

| Django field | Type | Notes |
|--------------|------|--------|
| `code` | CharField(2) | Unique business key |
| `machine_name` | CharField(255) | Template / URL segment |
| `name` | CharField(255) | Russian label |
| `icon` | ImageField | File on disk → migrated to `iconPath` string |
| `order` | Int | |
| `speaker` | CharField | Default “носитель” |

**Not stored in content DB (by design):** `ANDROID_URLS`, `IOS_URLS`, `SUPPORT`, `CZ_GENT`, pymorphy/Morpher behavior — portal-only or future user/product services.

### 1.2 `grammar`

| Model | Django fields | Mixins |
|--------|----------------|--------|
| `GrammarCourse` | `title`, `language` OneToOne | `MaterialLanguageMixin` (`material_language`), `MetaMixin` (`meta_keywords`, `meta_description`) |
| `GrammarLesson` | `title`, `course` FK, `template`, `alias`, `url`, `section`, `teaser`, `order` | `MetaMixin` |

**Out of scope for rows:** `Exercise` class — filesystem templates under `grammar/templates/`, not DB. TASK-13+ may serve HTML/static via storage/CDN separately.

**Progress:** `LessonProgressMixin` adds **methods only** (no columns on grammar tables).

### 1.3 `phonetics`

| Model | Fields | Mixins |
|--------|--------|--------|
| `PhoneticsCourse` | `title`, `language` OneToOne | MaterialLanguage, Meta |
| `PhoneticsLesson` | `title`, `course` FK, `order` | Meta |

Template path is derived: `phonetics/{material_language}/{lang}/{order}.html` — not a DB column.

### 1.4 `songs`

| Model | Fields | Mixins |
|--------|--------|--------|
| `SongsCourse` | `title`, `language` OneToOne | MaterialLanguage only |
| `SongsLesson` | `title`, `course` FK, `order` | (no Meta in legacy model) |

Template: `songs/{lang}/{order}.html`.

### 1.5 `dictionary`

| Model | Constraints |
|--------|-------------|
| `Word` | `word`, `transcription`, `translation`, `language` FK; **unique_together** (`word`, `language`, `translation`) |
| `WordTheme` | `name`, `module_class`, `order` |
| `WordThemeRelation` | `word`, `theme`, `order`; **unique_together** (`word`, `theme`, `order`) |

---

## 2. Prisma models (target)

| Prisma model | Legacy source |
|--------------|----------------|
| `Language` | `language.Language` |
| `GrammarCourse` | `grammar.GrammarCourse` |
| `GrammarLesson` | `grammar.GrammarLesson` |
| `PhoneticsCourse` | `phonetics.PhoneticsCourse` |
| `PhoneticsLesson` | `phonetics.PhoneticsLesson` |
| `SongsCourse` | `songs.SongsCourse` |
| `SongsLesson` | `songs.SongsLesson` |
| `Word` | `dictionary.Word` |
| `WordTheme` | `dictionary.WordTheme` |
| `WordThemeRelation` | `dictionary.WordThemeRelation` |

---

## 3. Field mapping (legacy → Prisma)

| Legacy | Prisma | Transform |
|--------|--------|-----------|
| `Language.code` | `Language.code` | Direct |
| `Language.machine_name` | `Language.machineName` | camelCase |
| `Language.name` | `Language.name` | Direct |
| `Language.icon` (file) | `Language.iconPath` | Migration: store relative path or key agreed in TASK-14 |
| `Language.order` | `Language.order` | Direct |
| `Language.speaker` | `Language.speaker` | Direct |
| `GrammarCourse.material_language` | `GrammarCourse.materialLanguage` | Direct |
| `GrammarCourse.meta_*` | `GrammarCourse.metaKeywords` / `metaDescription` | Direct |
| `GrammarLesson.*` | `GrammarLesson.*` | Same names (camelCase in Prisma) |
| `PhoneticsCourse` / `PhoneticsLesson` | Same pattern | |
| `SongsCourse` / `SongsLesson` | Prisma has no meta on lessons (matches legacy `SongsLesson` without MetaMixin) | |
| `Word.module_class` on theme | `WordTheme.moduleClass` | |
| `WordThemeRelation` | `WordThemeRelation` with `@@unique([wordId, themeId, order])` | Equivalent to legacy |

---

## 4. Relationships

- Legacy **OneToOne** `GrammarCourse.language` → Prisma `GrammarCourse.languageId` **unique** FK → `Language`; optional back-relation `grammarCourse`.
- Same for `PhoneticsCourse`, `SongsCourse`.
- `GrammarLesson.courseId` → `GrammarCourse.id` (1:N).
- `Word.languageId` → `Language`; `Word.themes` via `WordThemeRelation`.
- `WordTheme.words` via `WordThemeRelation`.

---

## 5. Indexes (performance)

As in `schema.prisma`:

- `Language`: `order`, `name`
- `GrammarLesson`: `[courseId, order]`
- `PhoneticsLesson`: `[courseId, order]`
- `SongsLesson`: `[courseId, order]`
- `Word`: `word`, unique composite `[word, languageId, translation]`
- `WordTheme`: `order`, `name`
- `WordThemeRelation`: `[themeId, order]`, unique `[wordId, themeId, order]`

---

## 6. Migration strategy (TASK-14)

1. **Freeze** legacy content writes during cutover window (or accept delta sync).
2. **Order:** `Language` first → courses → lessons → `WordTheme` → `Word` → `WordThemeRelation` (FK order).
3. **IDs:** Prefer **new serial IDs** in Postgres with a side mapping table `{legacy_table, legacy_pk, new_id}` if URLs must stay stable; or preserve numeric PKs if dump/import allows (simpler for `GET /:id`).
4. **Icons:** Export files to object storage or static CDN; persist path in `iconPath`.
5. **Templates:** Not in this schema; migrate static files separately and point frontends to asset URLs.
6. **Validation:** Row counts per table legacy vs new; spot-check FK integrity; unique constraints on `Word` and `WordThemeRelation`.

---

## 7. Out of scope (content DB)

- User lesson progress (`flow.LessonProgress`) → education / user domain, not read-only content API.
- Django `Exercise` dynamic imports → not migrated as relational data.
