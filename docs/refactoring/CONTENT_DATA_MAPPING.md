# Content Service Data Mapping

## Scope

Legacy apps:

- `grammar`
- `phonetics`
- `dictionary`
- `songs`
- `language`

Non-content dependencies:

- `portal.models.MetaMixin`
- `portal.models.MaterialLanguageMixin`

`LessonProgressMixin` only adds behavior, no stored fields.

## Model Mapping

### Language (`language.models.Language`)

Target: `Language`

Fields:

- `code` → `code`
- `machine_name` → `machineName`
- `name` → `name`
- `icon` (ImageField) → `iconPath` (string)
- `order` → `order`
- `speaker` → `speaker`

Notes:

- `icon` is stored as a relative path (Django `ImageField`); API should expose `iconUrl` derived from this path.
- `ANDROID_URLS`, `IOS_URLS`, `SUPPORT`, and computed properties are derived, not stored.

### GrammarCourse (`grammar.models.GrammarCourse`)

Target: `GrammarCourse`

Fields:

- `title` → `title`
- `language_id` → `languageId` (1:1)
- `material_language` (MaterialLanguageMixin) → `materialLanguage`
- `meta_keywords` (MetaMixin, TextField) → `metaKeywords` (Text)
- `meta_description` (MetaMixin, TextField) → `metaDescription` (Text)

### GrammarLesson (`grammar.models.GrammarLesson`)

Target: `GrammarLesson`

Fields:

- `title` → `title`
- `course_id` → `courseId`
- `template` → `template`
- `alias` → `alias`
- `url` (SlugField) → `url`
- `section` → `section`
- `teaser` (TextField) → `teaser` (Text)
- `order` → `order`
- `meta_keywords` (TextField) → `metaKeywords` (Text)
- `meta_description` (TextField) → `metaDescription` (Text)

Notes:

- `exercises` and `exercises_count` are derived from filesystem templates and not stored in DB.

### PhoneticsCourse (`phonetics.models.PhoneticsCourse`)

Target: `PhoneticsCourse`

Fields:

- `title` → `title`
- `language_id` → `languageId` (1:1)
- `material_language` → `materialLanguage`
- `meta_keywords` (TextField) → `metaKeywords` (Text)
- `meta_description` (TextField) → `metaDescription` (Text)

### PhoneticsLesson (`phonetics.models.PhoneticsLesson`)

Target: `PhoneticsLesson`

Fields:

- `title` → `title`
- `course_id` → `courseId`
- `order` → `order`
- `meta_keywords` (TextField) → `metaKeywords` (Text)
- `meta_description` (TextField) → `metaDescription` (Text)

### SongsCourse (`songs.models.SongsCourse`)

Target: `SongsCourse`

Fields:

- `title` → `title`
- `language_id` → `languageId` (1:1)
- `material_language` → `materialLanguage`

### SongsLesson (`songs.models.SongsLesson`)

Target: `SongsLesson`

Fields:

- `title` → `title`
- `course_id` → `courseId`
- `order` → `order`

### Word (`dictionary.models.Word`)

Target: `Word`

Fields:

- `word` → `word`
- `transcription` → `transcription`
- `translation` (TextField) → `translation` (Text)
- `language_id` → `languageId`

Constraints:

- Unique: `(word, languageId, translation)`

### WordTheme (`dictionary.models.WordTheme`)

Target: `WordTheme`

Fields:

- `name` → `name`
- `module_class` (blank=True, default empty string) → `moduleClass` (String, default "")
- `order` → `order`

### WordThemeRelation (`dictionary.models.WordThemeRelation`)

Target: `WordThemeRelation`

Fields:

- `word_id` → `wordId`
- `theme_id` → `themeId`
- `order` → `order`

Constraints:

- Unique: `(wordId, themeId, order)`

## Relationships

- `GrammarCourse.languageId` → `Language.id` (one-to-one)
- `GrammarLesson.courseId` → `GrammarCourse.id` (one-to-many)
- `PhoneticsCourse.languageId` → `Language.id` (one-to-one)
- `PhoneticsLesson.courseId` → `PhoneticsCourse.id` (one-to-many)
- `SongsCourse.languageId` → `Language.id` (one-to-one)
- `SongsLesson.courseId` → `SongsCourse.id` (one-to-many)
- `Word.languageId` → `Language.id` (many-to-one)
- `WordThemeRelation.wordId` → `Word.id` (many-to-one)
- `WordThemeRelation.themeId` → `WordTheme.id` (many-to-one)

## Migration Strategy

1. Export legacy tables for the listed models.
2. Insert `Language` first, then course tables, then lesson tables.
3. Insert `Word` and `WordTheme`, then `WordThemeRelation`.
4. Validate counts and unique constraints.
5. Verify ordering fields (`order`) match legacy behavior.
