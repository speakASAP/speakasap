#!/usr/bin/env python3
"""
Dry-run first inventory/reconciliation for legacy speakasap-portal `seven` content.

This script intentionally defaults to no writes. The first supported target is a
JSON report that inventories legacy SevenCourse/SevenLesson fixture rows,
lesson/exercise/answer templates, implicit media references, and optional target
content-service conflicts. Apply mode is write-gated and requires explicit owner approval evidence. It
generates rollback SQL before writing and refuses to run when dry-run blocking
issues are present.

Env:
  SEVEN_LEGACY_ROOT       path to speakasap-portal checkout
                          default: /home/ssf/Documents/Github/speakasap-portal
  CONTENT_TARGET_DATABASE_URL, CONTENT_DATABASE_URL, DATABASE_URL, or TARGET_DATABASE_URL
                          optional content-service Postgres URL for target counts

Examples:
  content-service/scripts/migrate-seven-from-legacy.py --json-report /tmp/seven-dry-run.json
  content-service/scripts/migrate-seven-from-legacy.py --check-target --json-report /tmp/seven-dry-run.json
  content-service/scripts/migrate-seven-from-legacy.py --apply --include-languages --confirm-write --approval-note 'owner approval ...' --rollback-plan /tmp/seven-rollback.sql --json-report /tmp/seven-apply.json
"""
from __future__ import annotations

import argparse
import ast
import html
import json
import os
import re
import shlex
import sys
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import psycopg2  # type: ignore
    from psycopg2.extras import Json  # type: ignore
except ImportError:  # optional; only needed with --check-target or --apply
    psycopg2 = None
    Json = None  # type: ignore

try:
    import yaml  # type: ignore
except ImportError:  # optional; only needed for the legacy language fixture
    yaml = None  # type: ignore

LEGACY_ROOT_DEFAULT = Path('/home/ssf/Documents/Github/speakasap-portal')
MIGRATION_BATCH = 'seven-content-legacy-20260613'
MEDIA_REF_RE = re.compile(r"(?:(?:/media/)|(?:\{%\s*get_media_prefix\s*%\})|(?:MEDIA_URL)|(?:media/))([^'\"\s)>}]+)")
HTML_MEDIA_ATTR_RE = re.compile(r"(?:src|href|data-src|data-src-ogg)=['\"](/media/[^'\"]+)['\"]")
YOUTUBE_DATA_RE = re.compile(r"data-video-id=['\"]([^'\"]+)['\"]")
DJANGO_TAG_RE = re.compile(r"\{%\s*([A-Za-z_][\w]*)")
DJANGO_VAR_RE = re.compile(r"{{\s*([^}|\s]+)")
TAG_EXPR_RE = re.compile(r"\{%\s*([A-Za-z_][\w]*)(.*?)%\}", re.DOTALL)
EXERCISE_FILE_RE = re.compile(r"lesson(\d+)ex(\d+)\.html$")

LANGUAGE_GENITIVE_BY_CODE = {
    'en': 'английского',
    'de': 'немецкого',
    'fr': 'французского',
    'es': 'испанского',
    'it': 'итальянского',
    'pt': 'португальского',
    'pl': 'польского',
    'po': 'польского',
    'cz': 'чешского',
    'cs': 'чешского',
    'nl': 'голландского',
    'sv': 'шведского',
    'se': 'шведского',
    'no': 'норвежского',
    'da': 'датского',
    'dk': 'датского',
    'fi': 'финского',
    'sk': 'словацкого',
    'ru': 'русского',
    'tr': 'турецкого',
    'el': 'греческого',
    'gr': 'греческого',
    'cn': 'китайского',
    'zh': 'китайского',
    'jp': 'японского',
    'ja': 'японского',
}


def exercise_file_sort_key(path: Path) -> tuple[int, int, str]:
    match = EXERCISE_FILE_RE.match(path.name)
    if not match:
        return (10**9, 10**9, path.name)
    return (int(match.group(1)), int(match.group(2)), path.name)


@dataclass(frozen=True)
class LegacyLanguage:
    pk: int
    code: str
    machine_name: str
    name: str
    icon_path: str
    order: int
    speaker: str


@dataclass(frozen=True)
class SevenCourse:
    legacy_id: int
    title: str
    material_language: str
    language_id: int
    android_package: str | None
    materials_changed: str
    meta_keywords: str | None
    meta_description: str | None


@dataclass(frozen=True)
class SevenLesson:
    legacy_id: int
    course_id: int
    title: str
    template: str
    order: int
    prefix: str | None
    meta_keywords: str | None
    meta_description: str | None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_text(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def field_map(obj: ET.Element) -> dict[str, str | None]:
    out: dict[str, str | None] = {}
    for field in obj.findall('field'):
        name = field.attrib['name']
        out[name] = field.text.strip() if field.text else ''
    return out


def parse_seven_fixture(path: Path) -> tuple[list[SevenCourse], list[SevenLesson]]:
    root = ET.parse(path).getroot()
    courses: list[SevenCourse] = []
    lessons: list[SevenLesson] = []
    for obj in root.findall('object'):
        model = obj.attrib.get('model')
        pk = int(obj.attrib['pk'])
        fields = field_map(obj)
        if model == 'seven.sevencourse':
            courses.append(
                SevenCourse(
                    legacy_id=pk,
                    title=fields.get('title') or '',
                    material_language=fields.get('material_language') or 'ru',
                    language_id=int(fields.get('language') or 0),
                    android_package=fields.get('android_package') or None,
                    materials_changed=(fields.get('materials_changed') or '1970-01-01')[:10],
                    meta_keywords=fields.get('meta_keywords') or None,
                    meta_description=fields.get('meta_description') or None,
                ),
            )
        elif model == 'seven.sevenlesson':
            lessons.append(
                SevenLesson(
                    legacy_id=pk,
                    course_id=int(fields.get('course') or 0),
                    title=fields.get('title') or '',
                    template=fields.get('template') or '',
                    order=int(fields.get('order') or 0),
                    prefix=fields.get('prefix') or None,
                    meta_keywords=fields.get('meta_keywords') or None,
                    meta_description=fields.get('meta_description') or None,
                ),
            )
    return courses, lessons


def parse_language_app_urls(legacy_root: Path) -> dict[str, dict[str, str]]:
    model_path = legacy_root / 'language' / 'models.py'
    if not model_path.exists():
        return {'android': {}, 'ios': {}}
    tree = ast.parse(read_text(model_path))
    app_urls: dict[str, dict[str, str]] = {'android': {}, 'ios': {}}
    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef) or node.name != 'Language':
            continue
        for item in node.body:
            if not isinstance(item, ast.Assign):
                continue
            names = [target.id for target in item.targets if isinstance(target, ast.Name)]
            if 'ANDROID_URLS' in names and isinstance(item.value, ast.Dict):
                app_urls['android'] = {str(ast.literal_eval(key)): str(ast.literal_eval(value)) for key, value in zip(item.value.keys, item.value.values) if key is not None}
            if 'IOS_URLS' in names and isinstance(item.value, ast.Dict):
                app_urls['ios'] = {str(ast.literal_eval(key)): str(ast.literal_eval(value)) for key, value in zip(item.value.keys, item.value.values) if key is not None}
    return app_urls


def parse_language_fixture(path: Path) -> dict[int, LegacyLanguage]:
    if yaml is None:
        raise RuntimeError('PyYAML is required to parse the legacy language fixture safely')
    records = yaml.safe_load(read_text(path)) or []
    languages: dict[int, LegacyLanguage] = {}
    for record in records:
        if record.get('model') != 'language.language':
            continue
        fields = record.get('fields') or {}
        pk = int(record['pk'])
        code = str(fields.get('code') or '').strip()
        machine_name = str(fields.get('machine_name') or '').strip()
        if not code or not machine_name:
            continue
        languages[pk] = LegacyLanguage(
            pk=pk,
            code=code,
            machine_name=machine_name,
            name=str(fields.get('name') or code),
            icon_path=str(fields.get('icon') or f'languages/{code}.png'),
            order=int(fields.get('order') or 100),
            speaker=str(fields.get('speaker') or 'носитель'),
        )
    return languages

def template_roots(legacy_root: Path) -> dict[str, Path]:
    return {
        'seven_templates': legacy_root / 'seven' / 'templates' / 'seven',
        'site_seven_templates': legacy_root / 'speakasap_site' / 'templates' / 'site' / 'seven',
        'media': legacy_root / 'media',
        'static': legacy_root / 'speakasap_site' / 'static',
    }


def media_refs_from_html(*sources: str | None) -> list[str]:
    refs: set[str] = set()
    for source in sources:
        if not source:
            continue
        for ref in MEDIA_REF_RE.findall(source):
            refs.add('/media/' + ref.lstrip('/'))
        for ref in HTML_MEDIA_ATTR_RE.findall(source):
            refs.add(ref)
        for video_id in YOUTUBE_DATA_RE.findall(source):
            refs.add('https://www.youtube.com/watch?v=' + video_id)
    return sorted(refs)


def classify_media_ref(ref: str) -> str:
    lower = ref.lower()
    if 'youtube.com' in lower or 'youtu.be' in lower:
        return 'video'
    if lower.endswith(('.mp3', '.ogg', '.wav')) or '/audio/' in lower:
        return 'audio'
    if lower.endswith('.pdf') or '/pdf/' in lower:
        return 'pdf'
    if lower.endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg')):
        return 'image'
    return 'media'


def media_prefix(ref: str) -> str:
    if ref.startswith('/media/'):
        parts = ref.strip('/').split('/')
        return '/'.join(parts[:3]) if len(parts) >= 3 else '/'.join(parts)
    if ref.startswith('https://www.youtube.com/'):
        return 'youtube'
    return 'external' if '://' in ref else 'other'


INLINE_EVENT_RE = re.compile(r"\son[a-zA-Z]+\s*=")
JAVASCRIPT_URL_RE = re.compile(r"javascript\s*:", re.IGNORECASE)


def html_issue_counts(source: str | None) -> dict[str, int]:
    value = source or ''
    return {
        'djangoBlocks': len(re.findall(r'{%|%}|{{|}}', value)),
        'scriptTags': len(re.findall(r'<\s*/?\s*script\b', value, flags=re.IGNORECASE)),
        'formTags': len(re.findall(r'<\s*/?\s*form\b', value, flags=re.IGNORECASE)),
        'inlineEventHandlers': len(INLINE_EVENT_RE.findall(value)),
        'javascriptUrls': len(JAVASCRIPT_URL_RE.findall(value)),
    }


def summarize_html_safety(lesson_rows: list[dict[str, Any]], exercise_rows: list[dict[str, Any]], sample_limit: int) -> dict[str, Any]:
    totals: Counter[str] = Counter()
    samples: list[dict[str, Any]] = []

    def add_sample(kind: str, row: dict[str, Any], field: str, counts: dict[str, int]) -> None:
        if len(samples) >= sample_limit:
            return
        samples.append({
            'kind': kind,
            'field': field,
            'legacyId': row.get('legacyId'),
            'legacyKey': row.get('legacyKey'),
            'languageCode': row.get('languageCode'),
            'order': row.get('order'),
            'template': row.get('template') or row.get('exerciseTemplate'),
            'counts': {k: v for k, v in counts.items() if v},
        })

    for row in lesson_rows:
        counts = html_issue_counts(row.get('bodyHtml'))
        totals.update(counts)
        if any(counts.values()):
            add_sample('lesson', row, 'bodyHtml', counts)
    for row in exercise_rows:
        exercise_counts = html_issue_counts(row.get('exerciseHtml'))
        totals.update(exercise_counts)
        if any(exercise_counts.values()):
            add_sample('exercise', row, 'exerciseHtml', exercise_counts)
        answer_counts = html_issue_counts(row.get('answerHtml'))
        totals.update(answer_counts)
        if any(answer_counts.values()):
            add_sample('answer', row, 'answerHtml', answer_counts)

    issue_keys = ['djangoBlocks', 'scriptTags', 'formTags', 'inlineEventHandlers', 'javascriptUrls']
    return {
        'checkedHtmlFragments': len(lesson_rows) + len(exercise_rows) + sum(1 for row in exercise_rows if row.get('answerHtml')),
        'issueCounts': {key: int(totals.get(key, 0)) for key in issue_keys},
        'samples': samples,
        'ok': all(int(totals.get(key, 0)) == 0 for key in issue_keys),
    }


def summarize_migration_media_refs(lesson_rows: list[dict[str, Any]], exercise_rows: list[dict[str, Any]]) -> dict[str, Any]:
    lesson_refs = [ref for row in lesson_rows for ref in row['metadata'].get('mediaRefs', [])]
    exercise_refs = [
        ref
        for row in exercise_rows
        for ref in row['metadata'].get('exercise', {}).get('mediaRefs', []) + row['metadata'].get('answer', {}).get('mediaRefs', [])
    ]
    planned_pdf_refs = [f"/media/pdf/{row['languageCode']}/lesson{row['order']}.pdf" for row in lesson_rows]
    unique_refs = sorted(set(lesson_refs) | set(exercise_refs) | set(planned_pdf_refs))
    kind_counts = Counter(classify_media_ref(ref) for ref in unique_refs)
    prefix_counts = Counter(media_prefix(ref) for ref in unique_refs)
    return {
        'lessonRowsWithRefs': sum(1 for row in lesson_rows if row['metadata'].get('mediaRefs')),
        'exerciseRowsWithRefs': sum(
            1
            for row in exercise_rows
            if row['metadata'].get('exercise', {}).get('mediaRefs') or row['metadata'].get('answer', {}).get('mediaRefs')
        ),
        'plannedPdfRefs': len(planned_pdf_refs),
        'uniqueRefs': len(unique_refs),
        'uniqueRefsByKind': dict(sorted(kind_counts.items())),
        'uniqueRefsByPrefix': dict(prefix_counts.most_common(25)),
        'sample': unique_refs[:50],
        'refs': unique_refs,
    }


def file_info(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {'exists': False, 'path': str(path)}
    try:
        text = read_text(path)
    except UnicodeDecodeError:
        text = ''
    return {
        'exists': True,
        'path': str(path),
        'bytes': path.stat().st_size,
        'django_tags': sorted(set(DJANGO_TAG_RE.findall(text))),
        'django_variables': sorted(set(DJANGO_VAR_RE.findall(text)))[:50],
        'media_refs': sorted(set(MEDIA_REF_RE.findall(text))),
    }


def course_template_dir(roots: dict[str, Path], language: LegacyLanguage, material_language: str) -> Path:
    preferred = roots['seven_templates'] / material_language / language.machine_name
    if preferred.exists():
        return preferred
    return roots['seven_templates'] / language.machine_name


def inventory_templates(
    courses: list[SevenCourse],
    lessons: list[SevenLesson],
    languages: dict[int, LegacyLanguage],
    legacy_root: Path,
    sample_limit: int,
) -> dict[str, Any]:
    roots = template_roots(legacy_root)
    lessons_by_course: dict[int, list[SevenLesson]] = defaultdict(list)
    for lesson in lessons:
        lessons_by_course[lesson.course_id].append(lesson)

    course_reports: list[dict[str, Any]] = []
    missing_lessons: list[dict[str, Any]] = []
    missing_languages: list[int] = []
    all_media_refs: Counter[str] = Counter()
    all_django_tags: Counter[str] = Counter()
    lesson_template_count = 0
    exercise_template_count = 0
    answer_template_count = 0

    for course in courses:
        language = languages.get(course.language_id)
        if not language:
            missing_languages.append(course.language_id)
            course_reports.append({
                'legacyCourseId': course.legacy_id,
                'title': course.title,
                'languageId': course.language_id,
                'languageMissing': True,
            })
            continue

        base_dir = course_template_dir(roots, language, course.material_language)
        lesson_dir = base_dir / 'lessons'
        exercise_dir = base_dir / 'exercises'
        answer_dir = base_dir / 'answers'
        course_lessons = sorted(lessons_by_course.get(course.legacy_id, []), key=lambda item: (item.order, item.legacy_id))
        order_counts = Counter(lesson.order for lesson in course_lessons)
        course_media_refs: Counter[str] = Counter()
        course_tags: Counter[str] = Counter()
        lesson_samples: list[dict[str, Any]] = []
        missing_for_course: list[dict[str, Any]] = []

        exercise_files = sorted(exercise_dir.glob('lesson*ex*.html'), key=exercise_file_sort_key) if exercise_dir.exists() else []
        answer_files = sorted(answer_dir.glob('lesson*ans*.html')) if answer_dir.exists() else []
        exercise_template_count += len(exercise_files)
        answer_template_count += len(answer_files)

        for lesson in course_lessons:
            lesson_path = lesson_dir / f'{lesson.template}.html'
            info = file_info(lesson_path)
            if info['exists']:
                lesson_template_count += 1
            else:
                missing_for_course.append({'legacyLessonId': lesson.legacy_id, 'path': str(lesson_path)})
                missing_lessons.append({'legacyCourseId': course.legacy_id, 'legacyLessonId': lesson.legacy_id, 'path': str(lesson_path)})
            for ref in info.get('media_refs', []):
                course_media_refs[ref] += 1
                all_media_refs[ref] += 1
            for tag in info.get('django_tags', []):
                course_tags[tag] += 1
                all_django_tags[tag] += 1
            if len(lesson_samples) < sample_limit:
                lesson_samples.append({
                    'legacyLessonId': lesson.legacy_id,
                    'order': lesson.order,
                    'title': lesson.title,
                    'prefix': lesson.prefix,
                    'template': lesson.template,
                    'lessonTemplate': info,
                    'exerciseTemplates': [str(p) for p in sorted(exercise_dir.glob(f'lesson{lesson.order}ex*.html'), key=exercise_file_sort_key)] if exercise_dir.exists() else [],
                    'answerTemplates': [str(p) for p in sorted(answer_dir.glob(f'lesson{lesson.order}ans*.html'))] if answer_dir.exists() else [],
                })

        course_reports.append({
            'legacyCourseId': course.legacy_id,
            'title': course.title,
            'languageId': course.language_id,
            'languageCode': language.code,
            'machineName': language.machine_name,
            'materialLanguage': course.material_language,
            'androidPackage': course.android_package,
            'materialsChanged': course.materials_changed,
            'templateBase': str(base_dir),
            'lessonRows': len(course_lessons),
            'lessonOrders': sorted(order_counts.keys()),
            'duplicateLessonOrders': {str(k): v for k, v in order_counts.items() if v > 1},
            'exerciseTemplateFiles': len(exercise_files),
            'answerTemplateFiles': len(answer_files),
            'missingLessonTemplates': missing_for_course[:sample_limit],
            'djangoTags': dict(course_tags.most_common()),
            'mediaRefsSample': [item for item, _ in course_media_refs.most_common(sample_limit)],
            'lessonSamples': lesson_samples,
        })

    return {
        'roots': {name: {'path': str(path), 'exists': path.exists()} for name, path in roots.items()},
        'sourceTemplateCounts': {
            'lessonRowsWithExistingTemplate': lesson_template_count,
            'exerciseHtmlFiles': exercise_template_count,
            'answerHtmlFiles': answer_template_count,
        },
        'missingLanguageIds': sorted(set(missing_languages)),
        'missingLessonTemplates': {
            'count': len(missing_lessons),
            'sample': missing_lessons[:sample_limit],
        },
        'djangoTags': dict(all_django_tags.most_common()),
        'mediaRefs': {
            'count': len(all_media_refs),
            'sample': [item for item, _ in all_media_refs.most_common(sample_limit)],
        },
        'courses': course_reports,
    }


def template_text(path: Path) -> str:
    return read_text(path) if path.exists() else ''


def tag_args(raw: str) -> list[str]:
    try:
        return shlex.split(raw.strip())
    except ValueError:
        return []


def resolve_token(token: str, lesson: SevenLesson, language: LegacyLanguage) -> str:
    if token == 'lesson.title':
        return lesson.title
    if token == 'lesson.order':
        return str(lesson.order)
    if token == 'language.code':
        return language.code
    return token


def tag_kwarg(args: list[str], name: str) -> str | None:
    prefix = name + '='
    for arg in args:
        if arg.startswith(prefix):
            return arg[len(prefix):].strip('\"\'')
    return None


def render_audio_tag(args: list[str], lesson: SevenLesson, language: LegacyLanguage) -> str:
    if not args:
        return ''
    filename = resolve_token(args[0], lesson, language)
    title = resolve_token(args[2] if len(args) > 2 and '=' not in args[2] else args[1] if len(args) > 1 else 'Прослушайте аудио урок', lesson, language)
    audio_language_code = tag_kwarg(args, 'ml') or language.code
    src_mp3 = f'/media/audio/{audio_language_code}/{filename}.mp3'
    src_ogg = f'/media/audio/{audio_language_code}/{filename}.ogg'
    return (
        '<p class="audio-block">'
        f'<a class="js-download-audio mdl-button mdl-js-button mdl-button--fab audio-block__button mdl-button--mini-fab" href="{html.escape(src_mp3)}">'
        '<i class="material-icons">&#xE2C0;</i></a>'
        f'<button class="mdl-button mdl-js-button mdl-button--fab js-play-audio audio-block__button mdl-button--mini-fab" data-src="{html.escape(src_mp3)}" data-src-ogg="{html.escape(src_ogg)}">'
        '<i class="material-icons">&#xE037;</i></button>'
        f'<span class="audio-block__title">{html.escape(title)}</span>'
        '</p>'
    )


def render_video_tag(args: list[str], lesson: SevenLesson, language: LegacyLanguage) -> str:
    if not args:
        return ''
    code = resolve_token(args[0], lesson, language)
    title = resolve_token(args[1] if len(args) > 1 else 'Посмотрите видео', lesson, language)
    escaped_code = html.escape(code)
    return (
        f'<div class="youtube-video-container" data-video-id="{escaped_code}">'
        '<div class="youtube-video-preview">'
        f'<img src="//img.youtube.com/vi/{escaped_code}/0.jpg" alt="{html.escape(title)}" loading="lazy">'
        '<button type="button" class="youtube-play-button" aria-label="Play video">'
        '<svg viewBox="0 0 68 48" width="68" height="48" aria-hidden="true">'
        '<path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-.13,27.1-1.55c2.93-.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z" fill="#f00"></path>'
        '<path d="M45,24 27,14 27,34" fill="#fff"></path>'
        '</svg></button></div></div>'
    )


def render_url_tag(args: list[str], lesson: SevenLesson, language: LegacyLanguage) -> str:
    if not args:
        return '#'
    name = args[0]
    if name == 'seven_lesson' and len(args) >= 3:
        code = resolve_token(args[1], lesson, language)
        order = resolve_token(args[2], lesson, language)
        return f'/{code}/seven/{order}/'
    if name == 'grammar_lesson' and len(args) >= 3:
        code = resolve_token(args[1], lesson, language)
        alias = resolve_token(args[2], lesson, language)
        return f'/{code}/grammar/{alias}/'
    if name == 'login':
        return '/login'
    return '#'


def render_legacy_html(source: str, lesson: SevenLesson, language: LegacyLanguage) -> tuple[str, dict[str, Any]]:
    tags_seen: Counter[str] = Counter()
    unresolved: Counter[str] = Counter()

    def replace_tag(match: re.Match[str]) -> str:
        name = match.group(1)
        raw = match.group(2)
        tags_seen[name] += 1
        args = tag_args(raw)
        if name == 'load':
            return ''
        if name == 'title':
            return f'<h1>{html.escape(lesson.title)}</h1>'
        if name == 'audio':
            return render_audio_tag(args, lesson, language)
        if name == 'video':
            return render_video_tag(args, lesson, language)
        if name == 'url':
            return render_url_tag(args, lesson, language)
        if name in {'hg', 'endhg'}:
            return ''
        unresolved[name] += 1
        return ''

    rendered = TAG_EXPR_RE.sub(replace_tag, source)
    rendered = rendered.replace('{{ lesson.title }}', html.escape(lesson.title))
    rendered = rendered.replace('{{ lesson.order }}', str(lesson.order))
    rendered = rendered.replace('{{ language.code }}', html.escape(language.code))
    rendered = re.sub(r'{{\s*[^}]+}}', '', rendered)
    return rendered, {
        'renderer': 'static-seven-template-v1',
        'djangoTagsSeen': dict(tags_seen),
        'unresolvedDjangoTags': dict(unresolved),
        'mediaRefs': media_refs_from_html(source, rendered),
    }


def build_migration_payload(
    courses: list[SevenCourse],
    lessons: list[SevenLesson],
    languages: dict[int, LegacyLanguage],
    legacy_root: Path,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    roots = template_roots(legacy_root)
    lessons_by_course: dict[int, list[SevenLesson]] = defaultdict(list)
    for lesson in lessons:
        lessons_by_course[lesson.course_id].append(lesson)
    app_urls = parse_language_app_urls(legacy_root)

    language_rows_by_code: dict[str, dict[str, Any]] = {}
    course_rows: list[dict[str, Any]] = []
    lesson_rows: list[dict[str, Any]] = []
    exercise_rows: list[dict[str, Any]] = []
    payload_warnings: list[dict[str, Any]] = []

    for course in courses:
        language = languages.get(course.language_id)
        if not language:
            payload_warnings.append({'code': 'SKIP_COURSE_MISSING_LANGUAGE', 'legacyCourseId': course.legacy_id})
            continue
        language_rows_by_code[language.code] = {
            'legacyId': language.pk,
            'code': language.code,
            'machineName': language.machine_name,
            'name': language.name,
            'iconPath': language.icon_path,
            'order': language.order,
            'speaker': language.speaker,
            'metadata': {'migrationBatch': MIGRATION_BATCH, 'legacyLanguageId': language.pk},
        }
        base_dir = course_template_dir(roots, language, course.material_language)
        lesson_dir = base_dir / 'lessons'
        exercise_dir = base_dir / 'exercises'
        answer_dir = base_dir / 'answers'
        course_rows.append({
            'legacyId': course.legacy_id,
            'title': course.title,
            'materialLanguage': course.material_language,
            'languageCode': language.code,
            'appPackage': course.android_package,
            'materialsChanged': course.materials_changed,
            'metaKeywords': course.meta_keywords,
            'metaDescription': course.meta_description,
            'metadata': {
                'legacyLanguageId': course.language_id,
                'legacyMachineName': language.machine_name,
                'legacyLanguageCaseGent': LANGUAGE_GENITIVE_BY_CODE.get(language.code),
                'legacyAndroidUrl': app_urls['android'].get(language.code),
                'legacyIosUrl': app_urls['ios'].get(language.code),
                'legacyTemplateBase': str(base_dir),
                'migrationBatch': MIGRATION_BATCH,
            },
        })
        for lesson in sorted(lessons_by_course.get(course.legacy_id, []), key=lambda item: (item.order, item.legacy_id)):
            lesson_path = lesson_dir / f'{lesson.template}.html'
            body_html, render_meta = render_legacy_html(template_text(lesson_path), lesson, language)
            lesson_rows.append({
                'legacyId': lesson.legacy_id,
                'legacyCourseId': course.legacy_id,
                'languageCode': language.code,
                'title': lesson.title,
                'order': lesson.order,
                'prefix': lesson.prefix,
                'template': lesson.template,
                'bodyHtml': body_html,
                'metaKeywords': lesson.meta_keywords,
                'metaDescription': lesson.meta_description,
                'metadata': {
                    **render_meta,
                    'legacyTemplatePath': str(lesson_path),
                    'legacyCourseId': course.legacy_id,
                    'migrationBatch': MIGRATION_BATCH,
                },
            })
            exercise_files = sorted(exercise_dir.glob(f'lesson{lesson.order}ex*.html'), key=exercise_file_sort_key) if exercise_dir.exists() else []
            for index, exercise_path in enumerate(exercise_files, start=1):
                answer_path = answer_dir / exercise_path.name.replace('ex', 'ans') if answer_dir.exists() else None
                exercise_html, exercise_meta = render_legacy_html(template_text(exercise_path), lesson, language)
                answer_html = None
                answer_meta: dict[str, Any] = {}
                if answer_path and answer_path.exists():
                    answer_html, answer_meta = render_legacy_html(template_text(answer_path), lesson, language)
                exercise_rows.append({
                    'legacyKey': f'{course.legacy_id}:{lesson.legacy_id}:{index}:{exercise_path.name}',
                    'legacyLessonId': lesson.legacy_id,
                    'order': index,
                    'title': f'Упражнение №{index}',
                    'exerciseTemplate': exercise_path.name,
                    'answerTemplate': answer_path.name if answer_path and answer_path.exists() else None,
                    'exerciseHtml': exercise_html,
                    'answerHtml': answer_html,
                    'metadata': {
                        'exercise': exercise_meta,
                        'answer': answer_meta,
                        'legacyExercisePath': str(exercise_path),
                        'legacyAnswerPath': str(answer_path) if answer_path else None,
                        'migrationBatch': MIGRATION_BATCH,
                    },
                })
    language_rows = [language_rows_by_code[code] for code in sorted(language_rows_by_code)]
    return language_rows, course_rows, lesson_rows, exercise_rows, payload_warnings

def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def write_rollback_sql(
    path: str,
    language_rows: list[dict[str, Any]],
    course_rows: list[dict[str, Any]],
    lesson_rows: list[dict[str, Any]],
    exercise_rows: list[dict[str, Any]],
    approval_note: str,
    include_languages: bool,
) -> None:
    language_codes = ', '.join(sql_literal(row['code']) for row in language_rows) or 'NULL'
    course_ids = ', '.join(str(row['legacyId']) for row in course_rows) or 'NULL'
    lesson_ids = ', '.join(str(row['legacyId']) for row in lesson_rows) or 'NULL'
    exercise_keys = ', '.join(sql_literal(row['legacyKey']) for row in exercise_rows) or 'NULL'
    sql = f"""-- Rollback for SpeakASAP seven content migration.
-- Generated: {now_iso()}
-- Approval note: {approval_note}
-- Migration batch: {MIGRATION_BATCH}
BEGIN;
DELETE FROM "SevenExercise" WHERE "legacyKey" IN ({exercise_keys});
DELETE FROM "SevenLesson" WHERE "legacyId" IN ({lesson_ids});
DELETE FROM "SevenCourse" WHERE "legacyId" IN ({course_ids});
{('DELETE FROM "Language" l WHERE l."code" IN (' + language_codes + ') AND NOT EXISTS (SELECT 1 FROM "SevenCourse" sc WHERE sc."languageId" = l."id") AND NOT EXISTS (SELECT 1 FROM "GrammarCourse" gc WHERE gc."languageId" = l."id") AND NOT EXISTS (SELECT 1 FROM "PhoneticsCourse" pc WHERE pc."languageId" = l."id") AND NOT EXISTS (SELECT 1 FROM "SongsCourse" soc WHERE soc."languageId" = l."id") AND NOT EXISTS (SELECT 1 FROM "Word" w WHERE w."languageId" = l."id");') if include_languages else '-- Language rows were not included in this apply; rollback leaves Language unchanged.'}
COMMIT;
"""
    Path(path).write_text(sql, encoding='utf-8')


def execute_apply(
    conn,
    language_rows: list[dict[str, Any]],
    course_rows: list[dict[str, Any]],
    lesson_rows: list[dict[str, Any]],
    exercise_rows: list[dict[str, Any]],
    include_languages: bool,
) -> dict[str, int]:
    if Json is None:
        raise RuntimeError('psycopg2 Json helper is unavailable')
    cur = conn.cursor()
    course_target_ids: dict[int, int] = {}
    lesson_target_ids: dict[int, int] = {}
    languages_upserted = 0
    courses_upserted = 0
    lessons_upserted = 0
    exercises_upserted = 0

    if include_languages:
        for row in language_rows:
            cur.execute(
                """
                INSERT INTO "Language" ("code", "machineName", "name", "iconPath", "order", "speaker")
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT ("code") DO UPDATE SET
                  "machineName" = EXCLUDED."machineName",
                  "name" = EXCLUDED."name",
                  "iconPath" = EXCLUDED."iconPath",
                  "order" = EXCLUDED."order",
                  "speaker" = EXCLUDED."speaker"
                """,
                (row['code'], row['machineName'], row['name'], row['iconPath'], row['order'], row['speaker']),
            )
            languages_upserted += 1

    for row in course_rows:
        cur.execute('SELECT "id" FROM "Language" WHERE "code" = %s', (row['languageCode'],))
        lang = cur.fetchone()
        if not lang:
            raise RuntimeError(f'target Language.code={row["languageCode"]!r} is missing')
        language_id = int(lang[0])
        cur.execute(
            """
            INSERT INTO "SevenCourse" (
              "legacyId", "title", "materialLanguage", "metaKeywords", "metaDescription",
              "languageId", "appPackage", "materialsChanged", "metadata"
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::date, %s)
            ON CONFLICT ("legacyId") DO UPDATE SET
              "title" = EXCLUDED."title",
              "materialLanguage" = EXCLUDED."materialLanguage",
              "metaKeywords" = EXCLUDED."metaKeywords",
              "metaDescription" = EXCLUDED."metaDescription",
              "languageId" = EXCLUDED."languageId",
              "appPackage" = EXCLUDED."appPackage",
              "materialsChanged" = EXCLUDED."materialsChanged",
              "metadata" = EXCLUDED."metadata"
            RETURNING "id"
            """,
            (row['legacyId'], row['title'], row['materialLanguage'], row['metaKeywords'], row['metaDescription'], language_id, row['appPackage'], row['materialsChanged'], Json(row['metadata'])),
        )
        course_target_ids[int(row['legacyId'])] = int(cur.fetchone()[0])
        courses_upserted += 1

    for row in lesson_rows:
        course_id = course_target_ids.get(int(row['legacyCourseId']))
        if not course_id:
            raise RuntimeError(f'target SevenCourse for legacyId={row["legacyCourseId"]} was not imported')
        cur.execute(
            """
            INSERT INTO "SevenLesson" (
              "legacyId", "title", "courseId", "order", "prefix", "template", "bodyHtml",
              "metaKeywords", "metaDescription", "metadata"
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT ("legacyId") DO UPDATE SET
              "title" = EXCLUDED."title",
              "courseId" = EXCLUDED."courseId",
              "order" = EXCLUDED."order",
              "prefix" = EXCLUDED."prefix",
              "template" = EXCLUDED."template",
              "bodyHtml" = EXCLUDED."bodyHtml",
              "metaKeywords" = EXCLUDED."metaKeywords",
              "metaDescription" = EXCLUDED."metaDescription",
              "metadata" = EXCLUDED."metadata"
            RETURNING "id"
            """,
            (row['legacyId'], row['title'], course_id, row['order'], row['prefix'], row['template'], row['bodyHtml'], row['metaKeywords'], row['metaDescription'], Json(row['metadata'])),
        )
        lesson_target_ids[int(row['legacyId'])] = int(cur.fetchone()[0])
        lessons_upserted += 1

    for row in exercise_rows:
        lesson_id = lesson_target_ids.get(int(row['legacyLessonId']))
        if not lesson_id:
            raise RuntimeError(f'target SevenLesson for legacyId={row["legacyLessonId"]} was not imported')
        cur.execute(
            """
            INSERT INTO "SevenExercise" (
              "lessonId", "order", "title", "legacyKey", "exerciseTemplate", "answerTemplate",
              "exerciseHtml", "answerHtml", "metadata"
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT ("legacyKey") DO UPDATE SET
              "lessonId" = EXCLUDED."lessonId",
              "order" = EXCLUDED."order",
              "title" = EXCLUDED."title",
              "exerciseTemplate" = EXCLUDED."exerciseTemplate",
              "answerTemplate" = EXCLUDED."answerTemplate",
              "exerciseHtml" = EXCLUDED."exerciseHtml",
              "answerHtml" = EXCLUDED."answerHtml",
              "metadata" = EXCLUDED."metadata"
            """,
            (lesson_id, row['order'], row['title'], row['legacyKey'], row['exerciseTemplate'], row['answerTemplate'], row['exerciseHtml'], row['answerHtml'], Json(row['metadata'])),
        )
        exercises_upserted += 1
    cur.close()
    return {
        'languagesUpserted': languages_upserted,
        'coursesUpserted': courses_upserted,
        'lessonsUpserted': lessons_upserted,
        'exercisesUpserted': exercises_upserted,
    }


def connect_target(url: str):
    if psycopg2 is None:
        raise RuntimeError('psycopg2 is not installed; target checks require psycopg2')
    return psycopg2.connect(url, connect_timeout=30)


def target_url() -> str:
    return (
        os.environ.get('CONTENT_TARGET_DATABASE_URL')
        or os.environ.get('CONTENT_DATABASE_URL')
        or os.environ.get('DATABASE_URL')
        or os.environ.get('TARGET_DATABASE_URL', '')
    )


def planned_ids(rows: list[dict[str, Any]], key: str, limit: int | None = None) -> list[Any]:
    values = [row[key] for row in rows]
    return values[:limit] if limit else values


def fetch_existing_count(cur, sql: str, params: tuple[Any, ...]) -> dict[str, Any]:
    try:
        cur.execute(sql, params)
        return {'ok': True, 'count': int(cur.fetchone()[0])}
    except Exception as exc:
        return {'ok': False, 'error': str(exc)}


def fetch_existing_sample(cur, sql: str, params: tuple[Any, ...], limit: int) -> dict[str, Any]:
    try:
        cur.execute(sql, params)
        columns = [desc[0] for desc in cur.description]
        return {'ok': True, 'rows': [dict(zip(columns, row)) for row in cur.fetchall()[:limit]]}
    except Exception as exc:
        return {'ok': False, 'error': str(exc)}


def target_report(
    limit: int,
    language_rows: list[dict[str, Any]] | None = None,
    course_rows: list[dict[str, Any]] | None = None,
    lesson_rows: list[dict[str, Any]] | None = None,
    exercise_rows: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    url = target_url()
    if not url:
        return {'checked': False, 'reason': 'CONTENT_TARGET_DATABASE_URL/CONTENT_DATABASE_URL/DATABASE_URL/TARGET_DATABASE_URL is not set'}
    if psycopg2 is None:
        return {'checked': False, 'reason': 'psycopg2 is not installed'}
    try:
        conn = connect_target(url)
    except Exception as exc:  # noqa: BLE001 - report, do not fail dry-run
        return {'checked': False, 'reason': f'target connection failed: {exc}'}
    try:
        cur = conn.cursor()
        tables = ['SevenCourse', 'SevenLesson', 'SevenExercise']
        counts: dict[str, Any] = {}
        table_errors: dict[str, str] = {}
        for table in tables:
            try:
                cur.execute(f'SELECT COUNT(*) FROM "{table}"')
                counts[table] = int(cur.fetchone()[0])
            except Exception as exc:  # table may not exist before migration
                conn.rollback()
                counts[table] = f'ERROR: {exc}'
                table_errors[table] = str(exc)

        planned_course_ids = planned_ids(course_rows or [], 'legacyId')
        planned_lesson_ids = planned_ids(lesson_rows or [], 'legacyId')
        planned_exercise_keys = planned_ids(exercise_rows or [], 'legacyKey')
        planned_language_codes = sorted({row['code'] for row in language_rows or []} or {row['languageCode'] for row in course_rows or []})
        existing_samples: dict[str, Any] = {}
        planned_matches: dict[str, Any] = {
            'plannedCourseLegacyIds': len(planned_course_ids),
            'plannedLessonLegacyIds': len(planned_lesson_ids),
            'plannedExerciseLegacyKeys': len(planned_exercise_keys),
        }
        language_readiness: dict[str, Any] = {
            'plannedLanguageCodes': planned_language_codes,
            'plannedLanguageCodesCount': len(planned_language_codes),
        }
        if planned_language_codes:
            language_sample = fetch_existing_sample(
                cur,
                'SELECT "id", "code", "name" FROM "Language" WHERE "code" = ANY(%s) ORDER BY "code" LIMIT %s',
                (planned_language_codes, max(limit, len(planned_language_codes))),
                max(limit, len(planned_language_codes)),
            )
            language_readiness['sample'] = language_sample
            if language_sample['ok']:
                existing_codes = sorted(row['code'] for row in language_sample['rows'])
                language_readiness['existingLanguageCodes'] = existing_codes
                language_readiness['existingLanguageCodesCount'] = len(existing_codes)
                language_readiness['missingLanguageCodes'] = [code for code in planned_language_codes if code not in existing_codes]
            else:
                language_readiness['error'] = language_sample['error']
                language_readiness['missingLanguageCodes'] = planned_language_codes

        if planned_course_ids and 'SevenCourse' not in table_errors:
            count = fetch_existing_count(
                cur,
                'SELECT COUNT(*) FROM "SevenCourse" WHERE "legacyId" = ANY(%s)',
                (planned_course_ids,),
            )
            if count['ok']:
                planned_matches['existingCourseLegacyIds'] = count['count']
            else:
                planned_matches['existingCourseLegacyIdsError'] = count['error']
            sample = fetch_existing_sample(
                cur,
                'SELECT "id", "legacyId", "title", "languageId", "materialLanguage" FROM "SevenCourse" WHERE "legacyId" = ANY(%s) ORDER BY "legacyId" LIMIT %s',
                (planned_course_ids, limit),
                limit,
            )
            existing_samples['SevenCourse.plannedLegacyIds'] = sample
        elif 'SevenCourse' not in table_errors:
            existing_samples['SevenCourse.plannedLegacyIds'] = {'ok': True, 'rows': []}

        if planned_lesson_ids and 'SevenLesson' not in table_errors:
            count = fetch_existing_count(
                cur,
                'SELECT COUNT(*) FROM "SevenLesson" WHERE "legacyId" = ANY(%s)',
                (planned_lesson_ids,),
            )
            if count['ok']:
                planned_matches['existingLessonLegacyIds'] = count['count']
            else:
                planned_matches['existingLessonLegacyIdsError'] = count['error']
            sample = fetch_existing_sample(
                cur,
                'SELECT "id", "legacyId", "courseId", "order", "title" FROM "SevenLesson" WHERE "legacyId" = ANY(%s) ORDER BY "legacyId" LIMIT %s',
                (planned_lesson_ids, limit),
                limit,
            )
            existing_samples['SevenLesson.plannedLegacyIds'] = sample
        elif 'SevenLesson' not in table_errors:
            existing_samples['SevenLesson.plannedLegacyIds'] = {'ok': True, 'rows': []}

        if planned_exercise_keys and 'SevenExercise' not in table_errors:
            count = fetch_existing_count(
                cur,
                'SELECT COUNT(*) FROM "SevenExercise" WHERE "legacyKey" = ANY(%s)',
                (planned_exercise_keys,),
            )
            if count['ok']:
                planned_matches['existingExerciseLegacyKeys'] = count['count']
            else:
                planned_matches['existingExerciseLegacyKeysError'] = count['error']
            sample = fetch_existing_sample(
                cur,
                'SELECT "id", "legacyKey", "lessonId", "order", "exerciseTemplate", "answerTemplate" FROM "SevenExercise" WHERE "legacyKey" = ANY(%s) ORDER BY "legacyKey" LIMIT %s',
                (planned_exercise_keys, limit),
                limit,
            )
            existing_samples['SevenExercise.plannedLegacyKeys'] = sample
        elif 'SevenExercise' not in table_errors:
            existing_samples['SevenExercise.plannedLegacyKeys'] = {'ok': True, 'rows': []}

        return {
            'checked': True,
            'counts': counts,
            'tableErrors': table_errors,
            'plannedMatches': planned_matches,
            'languageReadiness': language_readiness,
            'existingSamples': existing_samples,
        }
    finally:
        conn.close()

def build_report(args: argparse.Namespace) -> dict[str, Any]:
    legacy_root = Path(args.legacy_root).resolve()
    fixture = legacy_root / 'portal' / 'fixtures' / 'seven.xml'
    languages_fixture = legacy_root / 'portal' / 'fixtures' / 'languages.yaml'
    courses, lessons = parse_seven_fixture(fixture)
    languages = parse_language_fixture(languages_fixture)
    lessons_by_course = Counter(lesson.course_id for lesson in lessons)
    language_codes = {course.language_id: languages[course.language_id].code for course in courses if course.language_id in languages}

    language_rows, course_rows, lesson_rows, exercise_rows, payload_warnings = build_migration_payload(courses, lessons, languages, legacy_root)

    report: dict[str, Any] = {
        'generatedAt': now_iso(),
        'mode': 'dry-run',
        'writes': False,
        'applySupported': True,
        'migrationPayloadCounts': {
            'languages': len(language_rows),
            'courses': len(course_rows),
            'lessons': len(lesson_rows),
            'exercises': len(exercise_rows),
        },
        'migrationMediaRefs': summarize_migration_media_refs(lesson_rows, exercise_rows),
        'htmlSafety': summarize_html_safety(lesson_rows, exercise_rows, args.limit),
        'legacyRoot': str(legacy_root),
        'legacyEvidence': {
            'sevenFixture': str(fixture),
            'languagesFixture': str(languages_fixture),
        },
        'sourceCounts': {
            'sevenCourses': len(courses),
            'sevenLessons': len(lessons),
            'languagesMapped': len(languages),
        },
        'sourceSamples': {
            'courses': [course.__dict__ for course in courses[: args.limit]],
            'lessons': [lesson.__dict__ for lesson in lessons[: args.limit]],
            'languageRows': language_rows[: args.limit],
        },
        'courseLessonCounts': {str(course_id): count for course_id, count in sorted(lessons_by_course.items())},
        'languageCodesByLegacyId': {str(k): v for k, v in sorted(language_codes.items())},
        'legacyAppUrls': {
            'android': len(parse_language_app_urls(legacy_root)['android']),
            'ios': len(parse_language_app_urls(legacy_root)['ios']),
            'courseRowsWithAndroidUrl': sum(1 for row in course_rows if row['metadata'].get('legacyAndroidUrl')),
            'courseRowsWithIosUrl': sum(1 for row in course_rows if row['metadata'].get('legacyIosUrl')),
        },
        'templateInventory': inventory_templates(courses, lessons, languages, legacy_root, args.limit),
        'target': target_report(args.limit, language_rows, course_rows, lesson_rows, exercise_rows) if args.check_target else {'checked': False, 'reason': '--check-target not requested'},
        'blockingIssues': [],
        'warnings': payload_warnings,
    }

    missing_languages = report['templateInventory']['missingLanguageIds']
    missing_lessons = report['templateInventory']['missingLessonTemplates']['count']
    if missing_languages:
        report['blockingIssues'].append({'code': 'MISSING_LANGUAGE_MAPPING', 'languageIds': missing_languages})
    if missing_lessons:
        report['blockingIssues'].append({'code': 'MISSING_LESSON_TEMPLATES', 'count': missing_lessons})
    if not report['htmlSafety']['ok']:
        report['blockingIssues'].append({
            'code': 'RENDERED_HTML_SAFETY_ISSUES',
            'issueCounts': report['htmlSafety']['issueCounts'],
            'sample': report['htmlSafety']['samples'][: args.limit],
        })
    if args.check_target and report['target'].get('languageReadiness', {}).get('error'):
        report['blockingIssues'].append({
            'code': 'TARGET_LANGUAGE_TABLE_UNAVAILABLE',
            'error': report['target']['languageReadiness']['error'],
        })
    elif args.check_target and report['target'].get('languageReadiness', {}).get('missingLanguageCodes'):
        missing_codes = report['target']['languageReadiness']['missingLanguageCodes']
        issue = {'code': 'TARGET_LANGUAGE_CODES_MISSING', 'languageCodes': missing_codes}
        if args.include_languages:
            report['warnings'].append({**issue, 'resolution': '--include-languages would seed/update these Language rows during approved apply'})
        else:
            report['blockingIssues'].append(issue)
    if not report['templateInventory']['roots']['media']['exists']:
        report['warnings'].append({'code': 'MEDIA_ROOT_NOT_IN_CHECKOUT', 'path': report['templateInventory']['roots']['media']['path']})
    for course in report['templateInventory']['courses']:
        if course.get('duplicateLessonOrders'):
            report['warnings'].append({
                'code': 'DUPLICATE_LESSON_ORDER_FOR_COURSE',
                'legacyCourseId': course['legacyCourseId'],
                'languageCode': course.get('languageCode'),
                'duplicateLessonOrders': course['duplicateLessonOrders'],
            })
        if course.get('lessonRows') != 7:
            report['warnings'].append({
                'code': 'COURSE_LESSON_ROW_COUNT_NOT_SEVEN',
                'legacyCourseId': course['legacyCourseId'],
                'languageCode': course.get('languageCode'),
                'lessonRows': course.get('lessonRows'),
            })
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Dry-run inventory for legacy seven course migration')
    parser.add_argument('--legacy-root', default=os.environ.get('SEVEN_LEGACY_ROOT', str(LEGACY_ROOT_DEFAULT)))
    parser.add_argument('--dry-run', action='store_true', default=True, help='default mode; no writes')
    parser.add_argument('--apply', action='store_true', help='execute write-gated import; requires --confirm-write, --approval-note, and --rollback-plan')
    parser.add_argument('--confirm-write', action='store_true', help='required with --apply')
    parser.add_argument('--approval-note', help='owner approval evidence; required with --apply')
    parser.add_argument('--rollback-plan', help='rollback SQL path generated before --apply writes; required with --apply')
    parser.add_argument('--include-languages', action='store_true', help='with approved --apply, seed/update legacy Language rows required by seven courses before importing seven rows')
    parser.add_argument('--check-target', action='store_true', help='include read-only target table counts/conflicts')
    parser.add_argument('--json-report', help='write JSON report to path; use - for stdout only')
    parser.add_argument('--limit', type=int, default=25, help='sample limit per report bucket')
    return parser.parse_args()


def write_report(report: dict[str, Any], path: str | None) -> None:
    payload = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True)
    if path and path != '-':
        Path(path).write_text(payload + '\n', encoding='utf-8')
        print(f'wrote report to {path}')
    else:
        print(payload)


def main() -> int:
    args = parse_args()
    report = build_report(args)
    if args.apply:
        if not args.confirm_write:
            print('ERROR: --apply requires --confirm-write', file=sys.stderr)
            return 2
        if not args.approval_note:
            print('ERROR: --apply requires --approval-note', file=sys.stderr)
            return 2
        if not args.rollback_plan:
            print('ERROR: --apply requires --rollback-plan', file=sys.stderr)
            return 2
        if report['blockingIssues']:
            write_report(report, args.json_report)
            print('ERROR: --apply refused because dry-run blocking issues exist', file=sys.stderr)
            return 2
        url = target_url()
        if not url:
            print('ERROR: --apply requires CONTENT_TARGET_DATABASE_URL/CONTENT_DATABASE_URL/DATABASE_URL/TARGET_DATABASE_URL', file=sys.stderr)
            return 2
        if psycopg2 is None:
            print('ERROR: --apply requires psycopg2', file=sys.stderr)
            return 2
        legacy_root = Path(args.legacy_root).resolve()
        courses, lessons = parse_seven_fixture(legacy_root / 'portal' / 'fixtures' / 'seven.xml')
        languages = parse_language_fixture(legacy_root / 'portal' / 'fixtures' / 'languages.yaml')
        language_rows, course_rows, lesson_rows, exercise_rows, payload_warnings = build_migration_payload(courses, lessons, languages, legacy_root)
        write_rollback_sql(args.rollback_plan, language_rows, course_rows, lesson_rows, exercise_rows, args.approval_note, args.include_languages)
        conn = connect_target(url)
        try:
            result = execute_apply(conn, language_rows, course_rows, lesson_rows, exercise_rows, args.include_languages)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
        report['mode'] = 'apply'
        report['writes'] = True
        report['approvalNote'] = args.approval_note
        report['rollbackPlan'] = args.rollback_plan
        report['applyResult'] = result
        report['warnings'].extend(payload_warnings)
        write_report(report, args.json_report)
        return 0

    write_report(report, args.json_report)
    return 1 if report['blockingIssues'] else 0


if __name__ == '__main__':
    sys.exit(main())
