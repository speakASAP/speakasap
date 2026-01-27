# Content Data Migration Validation Report

## Validation Summary

**Date:** [Date of validation]
**Validator:** [Name/Agent]
**Status:** [Passed/Failed/Partial]

## Record Count Comparison

| Table | Legacy Count | New Count | Match | Notes |
|-------|--------------|-----------|-------|-------|
| Language | [Number] | [Number] | [Yes/No] | [Notes] |
| GrammarCourse | [Number] | [Number] | [Yes/No] | [Notes] |
| GrammarLesson | [Number] | [Number] | [Yes/No] | [Notes] |
| PhoneticsCourse | [Number] | [Number] | [Yes/No] | [Notes] |
| PhoneticsLesson | [Number] | [Number] | [Yes/No] | [Notes] |
| SongsCourse | [Number] | [Number] | [Yes/No] | [Notes] |
| SongsLesson | [Number] | [Number] | [Yes/No] | [Notes] |
| Word | [Number] | [Number] | [Yes/No] | [Notes] |
| WordTheme | [Number] | [Number] | [Yes/No] | [Notes] |
| WordThemeRelation | [Number] | [Number] | [Yes/No] | [Notes] |

## Sample Record Validation

### Language Sample

**Legacy Record (ID: [ID]):**
```json
{
  "code": "[code]",
  "machine_name": "[machine_name]",
  "name": "[name]",
  "icon": "[icon_path]",
  "order": [order],
  "speaker": "[speaker]"
}
```

**New Record (ID: [ID]):**
```json
{
  "code": "[code]",
  "machineName": "[machineName]",
  "name": "[name]",
  "iconPath": "[iconPath]",
  "order": [order],
  "speaker": "[speaker]"
}
```

**Validation:** [Passed/Failed]
**Notes:** [Any discrepancies]

### GrammarCourse Sample

[Similar format for GrammarCourse]

### GrammarLesson Sample

[Similar format for GrammarLesson]

[Continue for other models...]

## Relationship Validation

### Language → GrammarCourse
- Expected: One-to-one relationship
- Validated: [Yes/No]
- Issues: [Any issues found]

### GrammarCourse → GrammarLesson
- Expected: One-to-many relationship
- Validated: [Yes/No]
- Issues: [Any issues found]

### Language → PhoneticsCourse
- Expected: One-to-one relationship
- Validated: [Yes/No]
- Issues: [Any issues found]

### PhoneticsCourse → PhoneticsLesson
- Expected: One-to-many relationship
- Validated: [Yes/No]
- Issues: [Any issues found]

### Language → SongsCourse
- Expected: One-to-one relationship
- Validated: [Yes/No]
- Issues: [Any issues found]

### SongsCourse → SongsLesson
- Expected: One-to-many relationship
- Validated: [Yes/No]
- Issues: [Any issues found]

### Language → Word
- Expected: One-to-many relationship
- Validated: [Yes/No]
- Issues: [Any issues found]

### Word → WordThemeRelation
- Expected: One-to-many relationship
- Validated: [Yes/No]
- Issues: [Any issues found]

### WordTheme → WordThemeRelation
- Expected: One-to-many relationship
- Validated: [Yes/No]
- Issues: [Any issues found]

## Data Integrity Checks

### Unique Constraints

- **Language.code:** [Validated/Issues]
- **Word (word, languageId, translation):** [Validated/Issues]
- **WordThemeRelation (wordId, themeId, order):** [Validated/Issues]

### Foreign Key Constraints

- All foreign keys validated: [Yes/No]
- Issues: [Any issues found]

### Null Values

- Required fields checked: [Yes/No]
- Issues: [Any issues found]

## API Endpoint Testing

### Languages Endpoint
```bash
curl http://localhost:4201/api/v1/languages
```
**Status:** [200 OK/Error]
**Response Count:** [Number]
**Validation:** [Passed/Failed]

### Grammar Endpoint
```bash
curl http://localhost:4201/api/v1/grammar
```
**Status:** [200 OK/Error]
**Response Count:** [Number]
**Validation:** [Passed/Failed]

[Continue for other endpoints...]

## Discrepancies Found

[List any discrepancies between legacy and new data]

## Recommendations

[Any recommendations for fixing issues or improving migration]

## Conclusion

[Overall validation status and summary]
