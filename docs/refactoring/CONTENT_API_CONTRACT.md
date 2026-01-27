# Content Service API Contract

## Overview

Read-only Content Service for legacy content apps: `grammar`, `phonetics`, `dictionary`, `songs`, `language`.
All endpoints are `GET` only. Pagination max is 30 items per request.

## Base URL

- `GET /health` (excluded from `/api/v1` prefix)
- `GET /api/v1/*`

## Pagination

Query params:

- `page` (integer, default from `DEFAULT_PAGE_SIZE` handling)
- `limit` (integer, max `MAX_PAGE_SIZE` = 30)

Response shape:

```json
{
  "items": [],
  "page": 1,
  "limit": 24,
  "total": 120,
  "nextPage": 2,
  "prevPage": null
}
```

## Error Response

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "details": {}
  }
}
```

## Endpoints

### Grammar

#### `GET /api/v1/grammar`

List grammar lessons.

Query params:

- `languageCode` (string, `Language.code`)
- `materialLanguage` (string, `GrammarCourse.material_language`)
- `courseId` (int)
- `section` (string)
- `q` (string, search in title)
- `order` (string, `asc|desc` on `order`)

Response item:

```json
{
  "id": 1,
  "title": "Present Simple",
  "courseId": 2,
  "template": "present_simple",
  "alias": "present-simple",
  "url": "present-simple",
  "section": "Basics",
  "teaser": "Short introduction",
  "order": 1,
  "metaKeywords": null,
  "metaDescription": null
}
```

#### `GET /api/v1/grammar/:id`

Returns a single grammar lesson (same shape as list item).

#### `GET /api/v1/grammar/courses`

List grammar courses.

Query params:

- `languageCode`
- `materialLanguage`

Response item:

```json
{
  "id": 2,
  "title": "English Grammar",
  "languageId": 1,
  "materialLanguage": "ru",
  "metaKeywords": null,
  "metaDescription": null
}
```

### Phonetics

#### `GET /api/v1/phonetics`

List phonetics lessons.

Query params:

- `languageCode`
- `materialLanguage`
- `courseId`
- `order` (`asc|desc`)

Response item:

```json
{
  "id": 10,
  "title": "Vowels",
  "courseId": 5,
  "order": 1,
  "metaKeywords": null,
  "metaDescription": null
}
```

#### `GET /api/v1/phonetics/:id`

Returns a single phonetics lesson (same shape as list item).

#### `GET /api/v1/phonetics/courses`

List phonetics courses.

Query params:

- `languageCode`
- `materialLanguage`

Response item:

```json
{
  "id": 5,
  "title": "English Phonetics",
  "languageId": 1,
  "materialLanguage": "ru",
  "metaKeywords": null,
  "metaDescription": null
}
```

### Dictionary

#### `GET /api/v1/dictionary`

Search dictionary entries.

Query params:

- `languageCode`
- `themeId`
- `q` (search in `word` and `translation`)
- `order` (`asc|desc` on `word`)

Response item:

```json
{
  "id": 101,
  "word": "apple",
  "transcription": "[ˈæp.əl]",
  "translation": "яблоко",
  "languageId": 1
}
```

#### `GET /api/v1/dictionary/:id`

Returns a single dictionary entry (same shape as list item).

#### `GET /api/v1/dictionary/themes`

List dictionary themes.

Query params:

- `q` (search in name)
- `order` (`asc|desc` on `order`)

Response item:

```json
{
  "id": 20,
  "name": "Food",
  "moduleClass": "food",
  "order": 1
}
```

#### `GET /api/v1/dictionary/themes/:id`

Returns a single dictionary theme (same shape as list item).

### Songs

#### `GET /api/v1/songs`

List song lessons.

Query params:

- `languageCode`
- `materialLanguage`
- `courseId`
- `order` (`asc|desc`)

Response item:

```json
{
  "id": 50,
  "title": "Song 1",
  "courseId": 7,
  "order": 1
}
```

#### `GET /api/v1/songs/:id`

Returns a single song lesson (same shape as list item).

#### `GET /api/v1/songs/courses`

List songs courses.

Query params:

- `languageCode`
- `materialLanguage`

Response item:

```json
{
  "id": 7,
  "title": "English Songs",
  "languageId": 1,
  "materialLanguage": "ru"
}
```

### Languages

#### `GET /api/v1/languages`

List languages.

Query params:

- `q` (search in name)
- `order` (`asc|desc` on `order` or `name`)

Response item:

```json
{
  "id": 1,
  "code": "en",
  "machineName": "english",
  "name": "Английский",
  "iconUrl": "https://.../languages/en.png",
  "order": 1,
  "speaker": "носитель"
}
```

Notes:

- `iconUrl` is derived from the stored icon path.

#### `GET /api/v1/languages/:code`

Returns a single language (same shape as list item).
