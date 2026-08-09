# Lesson API — Single Source of Truth Implementation Plan

> **STATUS 2026-08-09 (updated mid-execution).** Tasks 1-9 are implemented and
> committed; Tasks 10-11 are not started. Checkboxes below are NOT maintained —
> `TASKS.md` in the repo root is the authoritative state. Read it first.
>
> - Tasks 1-4 (portal): committed in speakasap-portal, **not deployed** (owner-run).
> - Tasks 5-8: committed in speakasap (`4cb8a8a`, `985c223`, `7375f19`).
> - Task 9: done in `7cdebb3` **except internal-salary**, which still reads the
>   frozen lesson table and feeds teacher payouts. See TASKS.md.
> - Task 10 is destructive and remains gated behind Task 11.
>
> Corrections found while executing:
> - Task 7's sketched constructor `new TeacherRosterService(auth, lessons)` omitted
>   prisma, which the service still took at the time. It takes exactly those two now,
>   because `listForTeacher` was deleted (Task 9 step 2, option b).
> - Task 8 assumed `lesson-records.service.spec.ts` existed with a `buildService`
>   helper. Neither existed; both were written.
> - `PortalLesson.start` is an ISO string while the storage key builders took `Date`.
>   `datePrefix` now accepts both and raises on an unparseable value.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop copying lesson data between databases — education-service reads and writes lessons through a new portal HTTP API, so lessons created after 2026-06-26 (and all future lessons) work for drills and lesson-records.

**Architecture:** speakasap-portal (legacy Django, sole owner of lesson data) gains a small internal REST API guarded by the existing `x-internal-token` convention. education-service drops its six copied Django tables and its cross-database foreign keys, replacing `prisma.lesson`/`prisma.group`/`prisma.studentCourse` reads with a `LessonClient` HTTP call. No data is copied between databases and no service is granted access to another service's database.

**Tech Stack:** Django 1.11.2 / Python 3.4 / Django REST Framework (portal, legacy — do NOT upgrade) · NestJS 10 / Prisma 5 / TypeScript / Jest (education-service)

## Global Constraints

- **NO SILENT FAILURES.** Every failure raises or logs at error level with full context. An empty result must never stand in for a failure. This is the bug that hid the frozen table for six weeks — `listForLesson` returned `{students: []}` with only a `logger.warn`.
- **No cross-service database access.** education-service must never connect to `portal_db`. Integration is HTTP only.
- **No data copied between databases.** portal_db is the single source of truth for lessons.
- Portal stack is frozen: Django 1.11.2, Python 3.4, DRF as already vendored. Do not upgrade anything.
- Portal code must stay isolated in one deletable module — it is scheduled for sunset after migration to speakasap.
- **Never run `prisma migrate dev`** against any database. Use `migrate diff` offline, then `migrate deploy`.
- Portal production deploys are manual by the owner. Subagents must never deploy, never SSH-write to the speakasap server, and never scp.
- `ssh speakasap` is READ ONLY.
- Internal auth header is **`x-internal-token`** matched against `PORTAL_INBOUND_API_TOKEN` — NOT auth-microservice's `x-internal-service-token`. This mix-up cost a day on 2026-08-03.
- Prefix shell commands with `rtk`. Use `rg -E` (it is a GNU grep shim).
- Drill data is disposable: 6 test assignments, student id 3 / teacher id 182 only. No backfill or data migration is required for drill tables.

## Context: what is broken and why

`speakasap_education_db` contains six tables copied from the portal's Django database by a one-shot ETL (`education-service/scripts/migrate-education-from-legacy.py`), last run ~2026-06-26. There is no recurring sync. Django is the only writer of the real data.

Two features read the frozen copy and break for any lesson after that date:

| Call site | Current behavior on missing lesson |
|---|---|
| `education-service/src/drills/teacher/roster.service.ts:55` `listForLesson` | Returns empty roster, logs `warn` only — teacher sees no students, cannot create a drill |
| `education-service/src/lesson-records/lesson-records.service.ts:415` `loadLessonAndRecord` | Throws `NotFoundException('Lesson not found')` |

`lesson-records` also **writes** lessons (`lesson-records.service.ts:195`, `tx.lesson.update` for `recommendation`/`toManager`), so the API must cover that write.

**FK = foreign key.** `DrillAssignment.lessonUuid` currently has a real FK to `Lesson` (`prisma/schema.prisma:180`). Postgres cannot enforce a foreign key across two databases, so once lessons live only in portal_db these columns must become plain UUIDs. The precedent already in this schema is `DrillAssignmentItem.sourceItemId`, deliberately left bare because it points at content-service's database.

## File Structure

**speakasap-portal (new, isolated for sunset):**
- `education/internal_api/__init__.py` — empty package marker
- `education/internal_api/auth.py` — `InternalTokenPermission`, validates `x-internal-token`
- `education/internal_api/serializers.py` — `LessonSerializer`, `RosterSerializer`, `LessonWriteSerializer`
- `education/internal_api/views.py` — `LessonDetailView`, `LessonRosterView`
- `education/internal_api/urls.py` — route table
- `education/internal_api/tests/test_auth.py` — token guard tests
- `education/internal_api/tests/test_views.py` — endpoint tests
- `rest/urls.py:50` — one line added to mount the module

**education-service (alfares):**
- `src/lesson-client/lesson-client.service.ts` — HTTP client, raises on failure
- `src/lesson-client/lesson-client.types.ts` — `PortalLesson`, `PortalRoster` types
- `src/lesson-client/lesson-client.module.ts` — DI module
- `src/lesson-client/lesson-client.service.spec.ts` — client tests
- `src/drills/teacher/roster.service.ts` — replace prisma reads
- `src/lesson-records/lesson-records.service.ts` — replace prisma reads/writes
- `prisma/schema.prisma` — drop 6 legacy models, drop 2 FKs
- `prisma/migrations/<ts>_drop_legacy_lesson_tables/migration.sql` — generated offline

---

### Task 1: Portal internal-token permission guard

**Files:**
- Create: `education/internal_api/__init__.py`
- Create: `education/internal_api/auth.py`
- Test: `education/internal_api/tests/__init__.py`, `education/internal_api/tests/test_auth.py`

**Interfaces:**
- Consumes: `django.conf.settings.PORTAL_INBOUND_API_TOKEN`
- Produces: `InternalTokenPermission` — a DRF `BasePermission` subclass with `has_permission(self, request, view) -> bool`

- [ ] **Step 1: Write the failing test**

```python
# education/internal_api/tests/test_auth.py
# -*- coding: utf-8 -*-
from django.test import TestCase, RequestFactory
from django.test.utils import override_settings

from education.internal_api.auth import InternalTokenPermission


@override_settings(PORTAL_INBOUND_API_TOKEN='secret-token')
class InternalTokenPermissionTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.permission = InternalTokenPermission()

    def request_with(self, token=None):
        headers = {}
        if token is not None:
            headers['HTTP_X_INTERNAL_TOKEN'] = token
        return self.factory.get('/api/v1/internal/lessons/x/', **headers)

    def test_correct_token_is_allowed(self):
        allowed = self.permission.has_permission(self.request_with('secret-token'), None)
        self.assertTrue(allowed)

    def test_wrong_token_is_denied(self):
        allowed = self.permission.has_permission(self.request_with('nope'), None)
        self.assertFalse(allowed)

    def test_missing_header_is_denied(self):
        self.assertFalse(self.permission.has_permission(self.request_with(), None))

    @override_settings(PORTAL_INBOUND_API_TOKEN='')
    def test_unconfigured_token_denies_everything(self):
        """An unset token must never mean 'allow all'."""
        self.assertFalse(self.permission.has_permission(self.request_with(''), None))
        self.assertFalse(self.permission.has_permission(self.request_with('anything'), None))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk python manage.py test education.internal_api.tests.test_auth -v 2`
Expected: FAIL — `ImportError: No module named 'education.internal_api'`

- [ ] **Step 3: Write minimal implementation**

```python
# education/internal_api/__init__.py
```

```python
# education/internal_api/auth.py
# -*- coding: utf-8 -*-
"""
Internal-token guard for the education internal API.

DRILLING/LESSON-API: transitional — delete at legacy sunset.

Uses ``x-internal-token`` matched against ``PORTAL_INBOUND_API_TOKEN``, the api-gateway
convention that education-service's own ``InternalTokenGuard`` already speaks. This is
NOT auth-microservice's ``x-internal-service-token``/``INTERNAL_SERVICE_TOKEN``; sending
the wrong header produces a 401 that reads like a bad token.
"""
from django.conf import settings
from rest_framework.permissions import BasePermission

from utils.logger import CentralizedLogger

logger = CentralizedLogger(__name__)

HEADER = 'HTTP_X_INTERNAL_TOKEN'


class InternalTokenPermission(BasePermission):
    """Allow only callers presenting the shared internal token."""

    message = 'Invalid or missing internal token.'

    def has_permission(self, request, view):
        expected = getattr(settings, 'PORTAL_INBOUND_API_TOKEN', '') or ''
        if not expected:
            # Fails CLOSED. An unconfigured token must never mean "allow everyone".
            logger.error('internal api - PORTAL_INBOUND_API_TOKEN is not configured; denying')
            return False

        presented = request.META.get(HEADER, '') or ''
        if not presented:
            logger.warning('internal api - request without x-internal-token',
                           path=request.path)
            return False

        # constant_time_compare guards against timing attacks on the shared secret.
        from django.utils.crypto import constant_time_compare
        if not constant_time_compare(presented, expected):
            logger.warning('internal api - x-internal-token mismatch', path=request.path)
            return False

        return True
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk python manage.py test education.internal_api.tests.test_auth -v 2`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add education/internal_api/__init__.py education/internal_api/auth.py education/internal_api/tests/
git commit -m "feat(internal-api): add internal token permission guard"
```

---

### Task 2: Portal lesson serializers

**Files:**
- Create: `education/internal_api/serializers.py`
- Test: `education/internal_api/tests/test_serializers.py`

**Interfaces:**
- Consumes: `education.models.Lesson`, `education.models.StudentCourse`, `education.models.Group`
- Produces:
  - `LessonSerializer` — emits `{uuid, order, teacher_id, start, is_finished, student_course_uuid, module_class, needs_teacher, recommendation, to_manager}`
  - `LessonWriteSerializer` — accepts `{recommendation?, to_manager?}`, both optional strings
  - `RosterSerializer` — emits `{lesson_uuid, teacher_id, groups: [{uuid, name, student_ids}], student_ids}`

Field names are **snake_case** matching Django. The TypeScript client maps them to camelCase — do not pre-camelize here.

- [ ] **Step 1: Write the failing test**

```python
# education/internal_api/tests/test_serializers.py
# -*- coding: utf-8 -*-
from django.test import TestCase

from education.internal_api.serializers import LessonWriteSerializer


class LessonWriteSerializerTests(TestCase):
    def test_accepts_both_fields(self):
        s = LessonWriteSerializer(data={'recommendation': 'do it', 'to_manager': 'note'})
        self.assertTrue(s.is_valid(), s.errors)
        self.assertEqual(s.validated_data['recommendation'], 'do it')
        self.assertEqual(s.validated_data['to_manager'], 'note')

    def test_both_fields_optional(self):
        s = LessonWriteSerializer(data={})
        self.assertTrue(s.is_valid(), s.errors)

    def test_blank_string_allowed(self):
        """Clearing a recommendation is a legitimate edit, not a validation error."""
        s = LessonWriteSerializer(data={'recommendation': ''})
        self.assertTrue(s.is_valid(), s.errors)

    def test_rejects_non_string(self):
        s = LessonWriteSerializer(data={'recommendation': {'a': 1}})
        self.assertFalse(s.is_valid())
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk python manage.py test education.internal_api.tests.test_serializers -v 2`
Expected: FAIL — `ImportError: cannot import name 'LessonWriteSerializer'`

- [ ] **Step 3: Write minimal implementation**

```python
# education/internal_api/serializers.py
# -*- coding: utf-8 -*-
"""
Serializers for the education internal API.

LESSON-API: transitional — delete at legacy sunset.

Field names stay snake_case, matching the Django models. The education-service client
maps to camelCase on its side; pre-camelizing here would put the mapping in two places.
"""
from rest_framework import serializers

from education.models import Lesson


class LessonSerializer(serializers.ModelSerializer):
    """One lesson, with the fields education-service actually consumes."""

    teacher_id = serializers.IntegerField(source='teacher_id', read_only=True)
    student_course_uuid = serializers.CharField(source='student_course_id', read_only=True)

    class Meta:
        model = Lesson
        fields = (
            'uuid', 'order', 'teacher_id', 'start', 'is_finished',
            'student_course_uuid', 'module_class', 'needs_teacher',
            'recommendation', 'to_manager',
        )
        read_only_fields = fields


class LessonWriteSerializer(serializers.Serializer):
    """The only two lesson fields education-service is permitted to write."""

    recommendation = serializers.CharField(required=False, allow_blank=True)
    to_manager = serializers.CharField(required=False, allow_blank=True)


class GroupRosterSerializer(serializers.Serializer):
    uuid = serializers.CharField()
    name = serializers.CharField()
    student_ids = serializers.ListField(child=serializers.IntegerField())


class RosterSerializer(serializers.Serializer):
    """The students attached to a lesson, via its student course and group."""

    lesson_uuid = serializers.CharField()
    teacher_id = serializers.IntegerField(allow_null=True)
    groups = GroupRosterSerializer(many=True)
    student_ids = serializers.ListField(child=serializers.IntegerField())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk python manage.py test education.internal_api.tests.test_serializers -v 2`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add education/internal_api/serializers.py education/internal_api/tests/test_serializers.py
git commit -m "feat(internal-api): add lesson serializers"
```

---

### Task 3: Portal lesson detail + roster endpoints

**Files:**
- Create: `education/internal_api/views.py`
- Create: `education/internal_api/urls.py`
- Modify: `rest/urls.py:50`
- Test: `education/internal_api/tests/test_views.py`

**Interfaces:**
- Consumes: `InternalTokenPermission` (Task 1); `LessonSerializer`, `LessonWriteSerializer`, `RosterSerializer` (Task 2)
- Produces three routes mounted under `/api/v1/internal/`:
  - `GET  /api/v1/internal/lessons/<uuid>/` → 200 `LessonSerializer` | 404 | 401
  - `PATCH /api/v1/internal/lessons/<uuid>/` → 200 `LessonSerializer` | 400 | 404 | 401
  - `GET  /api/v1/internal/lessons/<uuid>/roster/` → 200 `RosterSerializer` | 404 | 401

`404` means the lesson genuinely does not exist. It must be distinguishable from a transport failure — the client treats them differently.

- [ ] **Step 1: Write the failing test**

```python
# education/internal_api/tests/test_views.py
# -*- coding: utf-8 -*-
import json
import uuid as uuid_lib

from django.core.urlresolvers import reverse
from django.test import TestCase
from django.test.utils import override_settings

from education.models import Lesson

HEADERS = {'HTTP_X_INTERNAL_TOKEN': 'secret-token'}


@override_settings(PORTAL_INBOUND_API_TOKEN='secret-token')
class LessonDetailViewTests(TestCase):
    def test_unknown_lesson_is_404_not_empty_200(self):
        """A missing lesson must be an explicit 404 the client can distinguish."""
        url = '/api/v1/internal/lessons/%s/' % uuid_lib.uuid4()
        response = self.client.get(url, **HEADERS)
        self.assertEqual(response.status_code, 404)

    def test_requires_token(self):
        url = '/api/v1/internal/lessons/%s/' % uuid_lib.uuid4()
        response = self.client.get(url)
        self.assertIn(response.status_code, (401, 403))

    def test_roster_requires_token(self):
        url = '/api/v1/internal/lessons/%s/roster/' % uuid_lib.uuid4()
        response = self.client.get(url)
        self.assertIn(response.status_code, (401, 403))

    def test_patch_rejects_unknown_field(self):
        """Only recommendation/to_manager are writable; anything else is ignored."""
        url = '/api/v1/internal/lessons/%s/' % uuid_lib.uuid4()
        response = self.client.patch(
            url, data=json.dumps({'teacher_id': 999}),
            content_type='application/json', **HEADERS)
        # 404 because the lesson does not exist — but crucially not a 500.
        self.assertEqual(response.status_code, 404)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk python manage.py test education.internal_api.tests.test_views -v 2`
Expected: FAIL — 404 routing error / `ImportError`, because the URLs are not mounted yet

- [ ] **Step 3: Write minimal implementation**

```python
# education/internal_api/views.py
# -*- coding: utf-8 -*-
"""
Read/write endpoints over lesson data for education-service.

LESSON-API: transitional — delete at legacy sunset.

The portal is the single source of truth for lessons. education-service holds no lesson
tables and reaches them only through here, so this module is the whole seam between the
legacy portal and the new platform.
"""
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from education.models import Lesson
from education.internal_api.auth import InternalTokenPermission
from education.internal_api.serializers import (
    LessonSerializer, LessonWriteSerializer, RosterSerializer,
)
from utils.logger import CentralizedLogger

logger = CentralizedLogger(__name__)


class LessonDetailView(APIView):
    """GET and PATCH a single lesson."""

    permission_classes = (InternalTokenPermission,)
    authentication_classes = ()

    def get(self, request, lesson_uuid):
        lesson = get_object_or_404(Lesson, uuid=lesson_uuid)
        return Response(LessonSerializer(lesson).data)

    def patch(self, request, lesson_uuid):
        lesson = get_object_or_404(Lesson, uuid=lesson_uuid)
        serializer = LessonWriteSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            logger.warning('internal api - lesson patch rejected',
                           lesson_uuid=str(lesson_uuid), errors=serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        updated = []
        for field in ('recommendation', 'to_manager'):
            if field in serializer.validated_data:
                setattr(lesson, field, serializer.validated_data[field])
                updated.append(field)

        if updated:
            lesson.save(update_fields=updated)
            logger.info('internal api - lesson updated',
                        lesson_uuid=str(lesson_uuid), fields=','.join(updated))

        return Response(LessonSerializer(lesson).data)


class LessonRosterView(APIView):
    """The students attached to a lesson, through its student course and group."""

    permission_classes = (InternalTokenPermission,)
    authentication_classes = ()

    def get(self, request, lesson_uuid):
        lesson = get_object_or_404(
            Lesson.objects.select_related('student_course__group'), uuid=lesson_uuid)

        group = getattr(lesson.student_course, 'group', None)
        groups = []
        student_ids = []
        if group is not None:
            ids = list(
                group.students.values_list('id', flat=True).order_by('id'))
            groups.append({
                'uuid': str(group.uuid),
                'name': group.title or '',
                'student_ids': ids,
            })
            student_ids = ids

        payload = {
            'lesson_uuid': str(lesson.uuid),
            'teacher_id': lesson.teacher_id,
            'groups': groups,
            'student_ids': student_ids,
        }
        return Response(RosterSerializer(payload).data)
```

```python
# education/internal_api/urls.py
# -*- coding: utf-8 -*-
"""
LESSON-API: transitional — delete at legacy sunset.
Deleting this file and its one include in rest/urls.py removes the whole seam.
"""
from django.conf.urls import url

from education.internal_api.views import LessonDetailView, LessonRosterView

UUID_RE = r'(?P<lesson_uuid>[0-9a-fA-F-]{36})'

urlpatterns = [
    url(r'^lessons/%s/$' % UUID_RE, LessonDetailView.as_view(), name='internal-lesson-detail'),
    url(r'^lessons/%s/roster/$' % UUID_RE, LessonRosterView.as_view(), name='internal-lesson-roster'),
]
```

Then add exactly one line to `rest/urls.py`, after the `demo` include at line 50:

```python
    # LESSON-API: transitional — delete at legacy sunset.
    url(r'^internal/', include('education.internal_api.urls')),
```

**Verify the mount path.** `rest/urls.py` is included under some prefix by `speakasap_site/urls.py`. Run `rtk rg -nE "include\('rest\.urls'\)" speakasap_site/urls.py` and confirm the resulting full path is `/api/v1/internal/lessons/...`. If the prefix differs, record the real base path here and use it in Task 5's `PORTAL_API_URL` — do not guess.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk python manage.py test education.internal_api -v 2`
Expected: PASS — all tests across the three test modules

- [ ] **Step 5: Commit**

```bash
git add education/internal_api/views.py education/internal_api/urls.py education/internal_api/tests/test_views.py rest/urls.py
git commit -m "feat(internal-api): expose lesson detail and roster endpoints"
```

---

### Task 4: Portal settings for the internal token

**Files:**
- Modify: `portal/settings.py` (near the existing `DRILLS_*` block at lines 83-93)
- Modify: `.env.example`
- Test: `education/internal_api/tests/test_settings.py`

**Interfaces:**
- Produces: `settings.PORTAL_INBOUND_API_TOKEN`, read from the `PORTAL_INBOUND_API_TOKEN` env var, defaulting to `''`

- [ ] **Step 1: Write the failing test**

```python
# education/internal_api/tests/test_settings.py
# -*- coding: utf-8 -*-
from django.conf import settings
from django.test import TestCase


class InternalTokenSettingTests(TestCase):
    def test_setting_exists(self):
        """Absent means the guard fails closed; it must still be defined."""
        self.assertTrue(hasattr(settings, 'PORTAL_INBOUND_API_TOKEN'))

    def test_setting_is_a_string(self):
        self.assertIsInstance(settings.PORTAL_INBOUND_API_TOKEN, str)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk python manage.py test education.internal_api.tests.test_settings -v 2`
Expected: FAIL — `AssertionError: False is not true` (setting undefined)

- [ ] **Step 3: Write minimal implementation**

In `portal/settings.py`, directly below the existing `DRILLS_CLIENT_TIMEOUT` line (~line 93):

```python
# LESSON-API: transitional — delete at legacy sunset.
# Shared secret for the education internal API. Empty means the guard denies every
# request — the endpoints fail closed rather than opening up when misconfigured.
_mod.PORTAL_INBOUND_API_TOKEN = getattr(_mod, 'PORTAL_INBOUND_API_TOKEN', None) or os.getenv('PORTAL_INBOUND_API_TOKEN', '')
```

Add to `.env.example`:

```
# Shared secret for the education internal API consumed by education-service.
# INBOUND only. NOT the same as DRILLS_INTERNAL_TOKEN (outbound). Empty disables.
PORTAL_INBOUND_API_TOKEN=
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk python manage.py test education.internal_api -v 2`
Expected: PASS — all internal_api tests

- [ ] **Step 5: Commit**

```bash
git add portal/settings.py .env.example education/internal_api/tests/test_settings.py
git commit -m "feat(internal-api): read PORTAL_INBOUND_API_TOKEN from environment"
```

**STOP — portal work is complete.** Do not deploy. The owner deploys the portal manually. Record in `TASKS.md` that the portal API is ready and that education-service tasks below require it to be live in production before their integration verification (Task 10) can run.

---

### Task 5: education-service lesson client types

**Files:**
- Create: `education-service/src/lesson-client/lesson-client.types.ts`
- Test: covered by Task 6's spec (types alone have no runtime behavior)

**Interfaces:**
- Produces:
  - `PortalLesson` — `{uuid, order, teacherId, start, isFinished, studentCourseUuid, moduleClass, needsTeacher, recommendation, toManager}`
  - `PortalRosterGroup` — `{uuid, name, studentIds}`
  - `PortalRoster` — `{lessonUuid, teacherId, groups, studentIds}`
  - `LessonNotFoundError`, `LessonServiceUnavailableError`

Two distinct error classes is the point of this task: "the lesson does not exist" and "I could not reach the portal" must never collapse into one condition, and neither may be represented by an empty result.

- [ ] **Step 1: Write the implementation** (types + errors, no test cycle of their own)

```typescript
// education-service/src/lesson-client/lesson-client.types.ts

/** One lesson, as served by the portal's internal API. Camelized from snake_case. */
export interface PortalLesson {
  uuid: string;
  order: number;
  teacherId: number | null;
  /** ISO-8601, or null for an unscheduled lesson. */
  start: string | null;
  isFinished: boolean;
  studentCourseUuid: string;
  moduleClass: string;
  needsTeacher: boolean;
  recommendation: string;
  toManager: string;
}

export interface PortalRosterGroup {
  uuid: string;
  name: string;
  studentIds: number[];
}

export interface PortalRoster {
  lessonUuid: string;
  teacherId: number | null;
  groups: PortalRosterGroup[];
  studentIds: number[];
}

/**
 * The portal answered, definitively, that this lesson does not exist.
 *
 * Distinct from LessonServiceUnavailableError on purpose: this one is a real 404 about
 * a real question, and a caller may legitimately turn it into its own 404. Never
 * represent it as an empty roster — that is the bug that hid a frozen lesson table for
 * six weeks.
 */
export class LessonNotFoundError extends Error {
  constructor(public readonly lessonUuid: string) {
    super(`Lesson ${lessonUuid} does not exist in the portal`);
    this.name = 'LessonNotFoundError';
  }
}

/**
 * The portal could not be reached, or answered with something unusable.
 *
 * ALWAYS raised, never swallowed. A drill roster that silently empties itself because
 * the portal was down is indistinguishable, to a teacher, from a student list that is
 * genuinely empty.
 */
export class LessonServiceUnavailableError extends Error {
  constructor(
    public readonly lessonUuid: string,
    public readonly reason: string,
  ) {
    super(`Portal lesson lookup failed for ${lessonUuid}: ${reason}`);
    this.name = 'LessonServiceUnavailableError';
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd education-service && ./node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add education-service/src/lesson-client/lesson-client.types.ts
git commit -m "feat(lesson-client): add portal lesson types and error classes"
```

---

### Task 6: education-service lesson client

**Files:**
- Create: `education-service/src/lesson-client/lesson-client.service.ts`
- Create: `education-service/src/lesson-client/lesson-client.module.ts`
- Test: `education-service/src/lesson-client/lesson-client.service.spec.ts`

**Interfaces:**
- Consumes: `PortalLesson`, `PortalRoster`, `LessonNotFoundError`, `LessonServiceUnavailableError` (Task 5)
- Produces: `LessonClientService` with
  - `getLesson(lessonUuid: string): Promise<PortalLesson>`
  - `getRoster(lessonUuid: string): Promise<PortalRoster>`
  - `updateLesson(lessonUuid: string, patch: {recommendation?: string; toManager?: string}): Promise<PortalLesson>`
- Produces: `LessonClientModule` exporting `LessonClientService`
- Env: `PORTAL_API_URL`, `PORTAL_INBOUND_API_TOKEN`, `PORTAL_CLIENT_TIMEOUT_MS` (default `5000`)

- [ ] **Step 1: Write the failing test**

```typescript
// education-service/src/lesson-client/lesson-client.service.spec.ts
import { LessonClientService } from './lesson-client.service';
import { LessonNotFoundError, LessonServiceUnavailableError } from './lesson-client.types';

const LESSON = 'f249c6e4-e6ef-451d-a1b0-c4fb0a3b4477';

function serviceWith(fetchImpl: jest.Mock): LessonClientService {
  const service = new LessonClientService();
  (service as unknown as { fetchFn: typeof fetch }).fetchFn =
    fetchImpl as unknown as typeof fetch;
  (service as unknown as { baseUrl: string }).baseUrl = 'http://portal.test';
  (service as unknown as { token: string }).token = 'secret-token';
  return service;
}

describe('LessonClientService', () => {
  it('camelizes a lesson payload', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        uuid: LESSON, order: 3, teacher_id: 182, start: '2026-08-12T17:00:00+02:00',
        is_finished: false, student_course_uuid: '43c00027-cf75-4d60-8775-da38dea408a1',
        module_class: 'Module3T', needs_teacher: false,
        recommendation: 'r', to_manager: 'm',
      }),
    });
    const lesson = await serviceWith(fetchFn).getLesson(LESSON);
    expect(lesson.teacherId).toBe(182);
    expect(lesson.studentCourseUuid).toBe('43c00027-cf75-4d60-8775-da38dea408a1');
    expect(lesson.moduleClass).toBe('Module3T');
  });

  it('sends the x-internal-token header', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ uuid: LESSON, order: 1, teacher_id: null, start: null,
        is_finished: false, student_course_uuid: 'c', module_class: '',
        needs_teacher: false, recommendation: '', to_manager: '' }),
    });
    await serviceWith(fetchFn).getLesson(LESSON);
    const headers = fetchFn.mock.calls[0][1].headers;
    expect(headers['x-internal-token']).toBe('secret-token');
  });

  it('raises LessonNotFoundError on 404', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 404, text: async () => '' });
    await expect(serviceWith(fetchFn).getLesson(LESSON))
      .rejects.toBeInstanceOf(LessonNotFoundError);
  });

  it('raises LessonServiceUnavailableError on 500', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
    await expect(serviceWith(fetchFn).getLesson(LESSON))
      .rejects.toBeInstanceOf(LessonServiceUnavailableError);
  });

  it('raises LessonServiceUnavailableError when the transport throws', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(serviceWith(fetchFn).getLesson(LESSON))
      .rejects.toBeInstanceOf(LessonServiceUnavailableError);
  });

  it('NEVER returns an empty roster in place of an error', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(serviceWith(fetchFn).getRoster(LESSON)).rejects.toThrow();
  });

  it('raises when the base url is unconfigured', async () => {
    const service = new LessonClientService();
    (service as unknown as { baseUrl: string }).baseUrl = '';
    (service as unknown as { token: string }).token = 't';
    await expect(service.getLesson(LESSON))
      .rejects.toBeInstanceOf(LessonServiceUnavailableError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd education-service && npx jest src/lesson-client --silent`
Expected: FAIL — `Cannot find module './lesson-client.service'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// education-service/src/lesson-client/lesson-client.service.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  LessonNotFoundError,
  LessonServiceUnavailableError,
  PortalLesson,
  PortalRoster,
} from './lesson-client.types';

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * The portal is the single source of truth for lessons. This service holds no lesson
 * tables; every lesson read and the two permitted lesson writes go through here.
 *
 * Deliberately NOT fail-soft. `cabinet/drills_client.py` on the portal side is fail-soft
 * because a drilling outage must not break an unrelated dashboard. Here the lesson IS
 * the request — a roster or a recording with no lesson behind it is meaningless, and
 * returning an empty one hid a frozen lesson table for six weeks. Every failure raises.
 */
@Injectable()
export class LessonClientService {
  private readonly logger = new Logger(LessonClientService.name);
  private readonly baseUrl = (process.env.PORTAL_API_URL || '').replace(/\/$/, '');
  private readonly token = process.env.PORTAL_INBOUND_API_TOKEN || '';
  private readonly timeoutMs = Number(process.env.PORTAL_CLIENT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  private readonly fetchFn: typeof fetch = fetch;

  async getLesson(lessonUuid: string): Promise<PortalLesson> {
    const body = await this.request(lessonUuid, `/lessons/${encodeURIComponent(lessonUuid)}/`);
    return this.toLesson(body);
  }

  async getRoster(lessonUuid: string): Promise<PortalRoster> {
    const body = await this.request(
      lessonUuid, `/lessons/${encodeURIComponent(lessonUuid)}/roster/`);
    return {
      lessonUuid: String(body.lesson_uuid),
      teacherId: body.teacher_id === null || body.teacher_id === undefined
        ? null : Number(body.teacher_id),
      groups: (Array.isArray(body.groups) ? body.groups : []).map((g: Record<string, unknown>) => ({
        uuid: String(g.uuid),
        name: String(g.name ?? ''),
        studentIds: (Array.isArray(g.student_ids) ? g.student_ids : []).map(Number),
      })),
      studentIds: (Array.isArray(body.student_ids) ? body.student_ids : []).map(Number),
    };
  }

  async updateLesson(
    lessonUuid: string,
    patch: { recommendation?: string; toManager?: string },
  ): Promise<PortalLesson> {
    const payload: Record<string, string> = {};
    if (patch.recommendation !== undefined) payload.recommendation = patch.recommendation;
    if (patch.toManager !== undefined) payload.to_manager = patch.toManager;

    const body = await this.request(
      lessonUuid, `/lessons/${encodeURIComponent(lessonUuid)}/`, 'PATCH', payload);
    return this.toLesson(body);
  }

  /** Single exit point for every call, so no failure mode can skip the error handling. */
  private async request(
    lessonUuid: string,
    path: string,
    method: 'GET' | 'PATCH' = 'GET',
    payload?: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    if (!this.baseUrl || !this.token) {
      // Misconfiguration is a failure, not a reason to degrade quietly.
      this.logger.error('PORTAL_API_URL/PORTAL_INBOUND_API_TOKEN not configured');
      throw new LessonServiceUnavailableError(
        lessonUuid, 'PORTAL_API_URL/PORTAL_INBOUND_API_TOKEN not configured');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchFn(this.baseUrl + path, {
        method,
        headers: {
          'x-internal-token': this.token,
          'x-service-name': 'education-service',
          'content-type': 'application/json',
        },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Portal lesson request failed: ${method} ${path} lesson=${lessonUuid} reason=${reason}`);
      throw new LessonServiceUnavailableError(lessonUuid, reason);
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 404) {
      this.logger.warn(`Portal reports lesson ${lessonUuid} does not exist`);
      throw new LessonNotFoundError(lessonUuid);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error(
        `Portal lesson request non-ok: ${method} ${path} lesson=${lessonUuid} ` +
        `status=${response.status} body=${text.slice(0, 500)}`);
      throw new LessonServiceUnavailableError(lessonUuid, `HTTP ${response.status}`);
    }

    try {
      return (await response.json()) as Record<string, unknown>;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Portal lesson response was not JSON: lesson=${lessonUuid} reason=${reason}`);
      throw new LessonServiceUnavailableError(lessonUuid, `unparseable response: ${reason}`);
    }
  }

  private toLesson(body: Record<string, unknown>): PortalLesson {
    return {
      uuid: String(body.uuid),
      order: Number(body.order ?? 0),
      teacherId: body.teacher_id === null || body.teacher_id === undefined
        ? null : Number(body.teacher_id),
      start: (body.start as string | null) ?? null,
      isFinished: Boolean(body.is_finished),
      studentCourseUuid: String(body.student_course_uuid),
      moduleClass: String(body.module_class ?? ''),
      needsTeacher: Boolean(body.needs_teacher),
      recommendation: String(body.recommendation ?? ''),
      toManager: String(body.to_manager ?? ''),
    };
  }
}
```

```typescript
// education-service/src/lesson-client/lesson-client.module.ts
import { Module } from '@nestjs/common';
import { LessonClientService } from './lesson-client.service';

@Module({
  providers: [LessonClientService],
  exports: [LessonClientService],
})
export class LessonClientModule {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd education-service && npx jest src/lesson-client --silent`
Expected: PASS — 7 tests

- [ ] **Step 5: Verify the tests fail when they should**

Temporarily change the `404` branch to `return {} as Record<string, unknown>;` and re-run. The `raises LessonNotFoundError on 404` test MUST fail. Revert the change. A green check that never ran is worse than a red one.

- [ ] **Step 6: Commit**

```bash
git add education-service/src/lesson-client/
git commit -m "feat(lesson-client): add portal lesson HTTP client"
```

---

### Task 7: Point the drill roster at the portal

**Files:**
- Modify: `education-service/src/drills/teacher/roster.service.ts:51-120`
- Modify: `education-service/src/drills/drills.module.ts` (import `LessonClientModule`)
- Test: `education-service/src/drills/teacher/roster.service.spec.ts`

**Interfaces:**
- Consumes: `LessonClientService.getRoster` (Task 6)
- Produces: `listForLesson` keeps its existing signature — `(lessonUuid: string, query?: DrillTeacherRosterQuery) => Promise<DrillTeacherRosterResponse & {teacherId: number | null}>`

`DrillTeacherRosterResponse` is `{students: DrillTeacherStudentDTO[]; groups: {uuid: string; name: string; studentIds: number[]}[]; total: number; hasMore: boolean}` (`src/drills/contracts.ts:446`).

**Behavior change — this is the fix.** `listForLesson` currently returns an empty roster and logs a warning when the lesson is missing. It must now propagate the error. `listForTeacher` keeps its existing prisma-free path only if it does not touch lesson tables — it does (`roster.service.ts:73`), so it must also move to the portal, or be restricted to lesson-scoped use. Implement lesson-scoped first; see Task 9 for `listForTeacher`.

- [ ] **Step 1: Write the failing test**

```typescript
// education-service/src/drills/teacher/roster.service.spec.ts (add to the existing file)
import { LessonNotFoundError, LessonServiceUnavailableError } from '../../lesson-client/lesson-client.types';

describe('TeacherRosterService.listForLesson via portal', () => {
  const LESSON = 'f249c6e4-e6ef-451d-a1b0-c4fb0a3b4477';

  function build(getRoster: jest.Mock, resolveNames: jest.Mock = jest.fn().mockResolvedValue(new Map())) {
    const auth = { resolveNames } as never;
    const lessons = { getRoster } as never;
    return new TeacherRosterService(auth, lessons);
  }

  it('returns the roster the portal reports', async () => {
    const getRoster = jest.fn().mockResolvedValue({
      lessonUuid: LESSON, teacherId: 182,
      groups: [{ uuid: 'g1', name: 'Group A', studentIds: [3, 7] }],
      studentIds: [3, 7],
    });
    const result = await build(getRoster).listForLesson(LESSON);
    expect(result.teacherId).toBe(182);
    expect(result.total).toBe(2);
    expect(result.groups[0].name).toBe('Group A');
  });

  it('PROPAGATES a missing lesson instead of returning an empty roster', async () => {
    const getRoster = jest.fn().mockRejectedValue(new LessonNotFoundError(LESSON));
    await expect(build(getRoster).listForLesson(LESSON))
      .rejects.toBeInstanceOf(LessonNotFoundError);
  });

  it('PROPAGATES a portal outage instead of returning an empty roster', async () => {
    const getRoster = jest.fn().mockRejectedValue(
      new LessonServiceUnavailableError(LESSON, 'ECONNREFUSED'));
    await expect(build(getRoster).listForLesson(LESSON))
      .rejects.toBeInstanceOf(LessonServiceUnavailableError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd education-service && npx jest src/drills/teacher/roster.service --silent`
Expected: FAIL — constructor arity mismatch / `getRoster is not a function`

- [ ] **Step 3: Write minimal implementation**

Replace the constructor and `listForLesson` in `roster.service.ts`:

```typescript
  constructor(
    private readonly auth: AuthClientService,
    private readonly lessons: LessonClientService,
  ) {}

  /**
   * The roster of one lesson, as reported by the portal.
   *
   * The portal owns lessons; this service holds no lesson tables. `Lesson.teacherId` is
   * the legacy Teacher profile pk (182 for the user whose auth id resolves to 3), and
   * the portal is the only place that mapping exists — so the lesson naming its own
   * teacher and students is what sidesteps the id-space mismatch.
   *
   * Raises rather than returning an empty roster. A teacher shown "no students" cannot
   * tell a genuinely empty group from a broken lookup, and that ambiguity hid a frozen
   * lesson table for six weeks.
   */
  async listForLesson(
    lessonUuid: string,
    query: DrillTeacherRosterQuery = {},
  ): Promise<DrillTeacherRosterResponse & { teacherId: number | null }> {
    const roster = await this.lessons.getRoster(lessonUuid);
    const page = await this.pageStudents(roster.studentIds, query);
    return {
      ...page,
      groups: roster.groups.map((g) => ({
        uuid: g.uuid,
        name: g.name,
        studentIds: g.studentIds,
      })),
      teacherId: roster.teacherId,
    };
  }

  /**
   * Names, search and paging over a set of student ids.
   *
   * Names come from auth-microservice; this service stores only integers. Resolved for
   * the whole set before filtering because `search` matches the NAME, which is not known
   * here until fetched — paging first would search only the current window.
   */
  private async pageStudents(
    studentIds: number[],
    query: DrillTeacherRosterQuery,
  ): Promise<DrillTeacherRosterResponse> {
    const ids = [...studentIds].sort((a, b) => a - b);
    if (ids.length === 0) {
      return { students: [], groups: [], total: 0, hasMore: false };
    }

    const names = await this.auth.resolveNames(ids);
    let students = ids.map((id) => ({
      studentId: id,
      name: names.get(id) || `Student ${id}`,
    }));

    if (query.search) {
      const needle = query.search.toLowerCase();
      students = students.filter((s) => s.name.toLowerCase().includes(needle));
    }

    const total = students.length;
    const limit = Math.min(
      query.limit === undefined ? DEFAULT_ROSTER_LIMIT : Math.max(1, query.limit),
      MAX_ROSTER_LIMIT,
    );
    const offset = Math.max(0, query.offset ?? 0);
    const window = students.slice(offset, offset + limit);

    return {
      students: window,
      groups: [],
      total,
      hasMore: offset + window.length < total,
    };
  }
```

Add the import and remove the now-unused `PrismaService` import if nothing else in the file uses it:

```typescript
import { LessonClientService } from '../../lesson-client/lesson-client.service';
```

In `drills.module.ts`, add `LessonClientModule` to `imports`.

**Note:** `pageStudents` returns `groups: []`; `listForLesson` overwrites it with the portal's groups. Keep that ordering — spreading `page` first and setting `groups` after is what makes it correct.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd education-service && npx jest src/drills --silent`
Expected: PASS — including the three new tests. Pre-existing tests that asserted the empty-roster fallback will fail; those assertions encoded the bug and must be updated to expect a raised error.

- [ ] **Step 5: Typecheck**

Run: `cd education-service && ./node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add education-service/src/drills/
git commit -m "fix(drills): read lesson roster from portal, raise instead of empty roster"
```

---

### Task 8: Point lesson-records at the portal

**Files:**
- Modify: `education-service/src/lesson-records/lesson-records.service.ts:189-265, 407-441`
- Modify: `education-service/src/lesson-records/lesson-records.module.ts`
- Test: `education-service/src/lesson-records/lesson-records.service.spec.ts`

**Interfaces:**
- Consumes: `LessonClientService.getLesson`, `LessonClientService.updateLesson`, `LessonClientService.getRoster` (Task 6)
- Produces: `loadLessonAndRecord(lessonUuid)` returns `{lesson: PortalLesson; record: LessonRecord | null; roster: PortalRoster}`

`assertDomainAccess` (line 432) reads `lesson.teacherId`, `lesson.studentAccesses` and `lesson.studentCourse.group.groupStudents`. `teacherId` comes from `PortalLesson`; the student lists come from `PortalRoster.studentIds`.

**Paid-access caveat.** Line 440 distinguishes `hasAnyAccess` from `hasPaidAccess` using `education_studentaccess.is_paid`, which the roster endpoint does not carry. Extend the portal roster response with `paid_student_ids` (mirroring `student_ids`) and `PortalRoster.paidStudentIds`, then map `hasPaidAccess` to it. Add the field to `RosterSerializer` in Task 2's file and to the view in Task 3's file before starting this task — do not approximate paid access with `student_ids`, as that would grant playback to unpaid students.

- [ ] **Step 1: Write the failing test**

```typescript
// education-service/src/lesson-records/lesson-records.service.spec.ts (add)
import { LessonNotFoundError } from '../lesson-client/lesson-client.types';

describe('LessonRecordsService lesson sourcing', () => {
  const LESSON = 'f249c6e4-e6ef-451d-a1b0-c4fb0a3b4477';

  it('propagates LessonNotFoundError from the portal', async () => {
    const lessons = {
      getLesson: jest.fn().mockRejectedValue(new LessonNotFoundError(LESSON)),
      getRoster: jest.fn(),
    };
    const service = buildService({ lessons });
    await expect(service.loadLessonAndRecord(LESSON))
      .rejects.toBeInstanceOf(LessonNotFoundError);
  });

  it('writes recommendation through the portal, not the local database', async () => {
    const updateLesson = jest.fn().mockResolvedValue({ uuid: LESSON, recommendation: 'new' });
    const lessons = {
      getLesson: jest.fn().mockResolvedValue({ uuid: LESSON, teacherId: 182, recommendation: 'old', toManager: '' }),
      getRoster: jest.fn().mockResolvedValue({ lessonUuid: LESSON, teacherId: 182, groups: [], studentIds: [3], paidStudentIds: [3] }),
      updateLesson,
    };
    const service = buildService({ lessons });
    await service.saveRecommendation(LESSON, { recommendation: 'new' });
    expect(updateLesson).toHaveBeenCalledWith(LESSON, { recommendation: 'new' });
  });
});
```

`buildService` is a helper in the existing spec file; extend it to accept a `lessons` stub. If it does not exist, write it to construct `LessonRecordsService` with stubbed prisma/storage/lessons dependencies.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd education-service && npx jest src/lesson-records --silent`
Expected: FAIL — `loadLessonAndRecord` still calls `prisma.lesson.findUnique`

- [ ] **Step 3: Write minimal implementation**

Replace `loadLessonAndRecord`:

```typescript
  /**
   * The lesson (from the portal, the single source of truth) and its local record row.
   *
   * The record lives here; the lesson does not. A missing lesson raises rather than
   * yielding a null the callers would have to remember to check.
   */
  private async loadLessonAndRecord(lessonUuid: string) {
    const [lesson, roster] = await Promise.all([
      this.lessons.getLesson(lessonUuid),
      this.lessons.getRoster(lessonUuid),
    ]);
    const record = await this.prisma.lessonRecord.findUnique({
      where: { lessonUuid: lesson.uuid },
    });
    return { lesson, record, roster };
  }
```

Update `assertDomainAccess` to take `roster` and read access from it:

```typescript
    const hasAnyAccess = roster.studentIds.includes(studentId);
    const hasPaidAccess = roster.paidStudentIds.includes(studentId);
```

Replace the `tx.lesson.update` block (line 195) — the lesson write now goes to the portal, outside the local transaction, because it is no longer a local row:

```typescript
    // The lesson lives in the portal, so this write cannot join the local transaction.
    // Ordered first on purpose: if the portal rejects it, we raise before touching the
    // local record and leave nothing half-written.
    if (typeof body.recommendation === 'string' || typeof body.toManager === 'string') {
      await this.lessons.updateLesson(lesson.uuid, {
        recommendation: typeof body.recommendation === 'string' ? body.recommendation : undefined,
        toManager: typeof body.toManager === 'string' ? body.toManager : undefined,
      });
    }
```

Add `LessonClientModule` to `lesson-records.module.ts` imports and inject `LessonClientService`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd education-service && npx jest src/lesson-records --silent`
Expected: PASS

- [ ] **Step 5: Typecheck**

Run: `cd education-service && ./node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add education-service/src/lesson-records/
git commit -m "fix(lesson-records): source lessons from portal instead of copied tables"
```

---

### Task 9: Move remaining lesson readers off the copied tables

**Files:**
- Modify: `education-service/src/drills/teacher/roster.service.ts` (`listForTeacher`, line 73)
- Modify: `education-service/src/internal-salary/internal-salary.service.ts:72`
- Modify: `education-service/src/lessons/lessons.service.ts`, `src/groups/groups.service.ts`, `src/student-courses/student-courses.service.ts`, `src/homeworks/homeworks.service.ts`

**Interfaces:**
- Consumes: `LessonClientService` (Task 6)

These modules read the same frozen tables and are serving stale data today. They are not part of the reported breakage, so they are handled after drills and lesson-records work.

- [ ] **Step 1: Inventory what each caller needs**

Run: `rtk rg -nE 'prisma\.(lesson|studentCourse|studentAccess|homework|group)' education-service/src --include='*.ts' | rg -vE 'spec|lessonRecord'`

For each hit, record in this plan file which portal endpoint satisfies it. If a caller needs a query the portal API does not expose (for example `internal-salary` aggregating lessons by teacher across a date range), add that endpoint to `education/internal_api/` following Task 3's pattern, with its own tests, rather than reinstating a database read.

- [ ] **Step 2: Decide `listForTeacher`**

`listForTeacher` (roster.service.ts:73) queries `lesson.findMany({where: {teacherId}})` — a cross-lesson query with no portal endpoint yet. Either:
- (a) add `GET /api/v1/internal/teachers/<id>/roster/` to the portal, or
- (b) confirm every caller passes `lessonUuid` and delete `listForTeacher`.

`drills.controller.ts:145` calls it when `lessonUuid` is absent. Check whether the teacher UI ever omits `lessonUuid`; if it always sends one, prefer (b) — deleting code beats adding an endpoint before sunset.

- [ ] **Step 3: Implement the chosen path for each module, with tests**

Follow the Task 7 pattern exactly: failing test asserting the error propagates, then the portal call, then typecheck, then commit per module.

- [ ] **Step 4: Verify no prisma lesson reads remain**

Run: `rtk rg -nE 'prisma\.(lesson|studentCourse|studentAccess|homework|group)\.' education-service/src --include='*.ts' | rg -vE 'spec|lessonRecord'`
Expected: no output. `prisma.lessonRecord` and `prisma.lessonRecordPart` legitimately remain — those tables are owned by this service.

- [ ] **Step 5: Commit**

```bash
git add education-service/src/
git commit -m "refactor(education): move remaining lesson readers to portal API"
```

---

### Task 10: Drop the FKs, the legacy models, and the copied tables

**Files:**
- Modify: `education-service/prisma/schema.prisma`
- Create: `education-service/prisma/migrations/<timestamp>_drop_legacy_lesson_tables/migration.sql`
- Delete: `education-service/scripts/migrate-education-from-legacy.py`

**Interfaces:**
- Produces: `DrillAssignment.lessonUuid` and `DrillAssignment.studentCourseUuid` as plain `String?` UUID columns with no relation

**This task performs destructive production changes. Do not run it until Tasks 1-9 are merged, the portal API is deployed by the owner, and Task 11's verification has passed against production.**

- [ ] **Step 1: Edit the schema**

Remove these six models entirely: `Lesson`, `StudentCourse`, `StudentAccess`, `Group`, `GroupStudent`, `Homework`. Keep `LessonRecord` and `LessonRecordPart` — this service owns those.

In `DrillAssignment`, delete the relation lines and keep the plain columns:

```prisma
  // Cross-database references. The lesson and its student course live in the portal's
  // database (the single source of truth), so Postgres cannot enforce a foreign key
  // here — the same reason DrillAssignmentItem.sourceItemId is bare. Existence is
  // checked by LessonClientService at write time, which raises when the portal denies
  // the lesson. Do not "restore" these FKs.
  lessonUuid        String? @map("lesson_uuid") @db.Uuid
  studentCourseUuid String? @map("student_course_uuid") @db.Uuid
```

Delete the `lesson` and `studentCourse` relation fields. Keep the `batch` relation — `DrillAssignmentBatch` is in this database.

Also remove `drillAssignments DrillAssignment[]` back-relations from the deleted models (they vanish with the models) and `studentAccesses`/`homeworks`/`lessonRecord` relations that pointed at `Lesson`. `LessonRecord.lessonUuid` becomes a bare column too, for the same reason.

- [ ] **Step 2: Generate the migration OFFLINE**

Never `prisma migrate dev`. Run:

```bash
cd education-service
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > /tmp/claude-1000/drop-legacy.sql
```

Inspect `/tmp/claude-1000/drop-legacy.sql`. It must contain only: `ALTER TABLE ... DROP CONSTRAINT` for the drill FKs, and `DROP TABLE` for the six legacy tables. If it contains `ALTER COLUMN "updated" DROP DEFAULT`, strip that line — it is known drift documented at `schema.prisma:116`.

- [ ] **Step 3: Dry-run against a scratch database**

Offline-generated migrations are unexecuted code. Take a schema-only dump, load it into a scratch database, apply the migration there, and confirm it succeeds before it goes anywhere near production.

```bash
kubectl exec -n statex-apps deploy/db-server-postgres -- \
  pg_dump -s -U dbadmin speakasap_education_db > /tmp/claude-1000/edu-schema.sql
```

Create `speakasap_education_scratch`, load the dump, apply the migration, confirm exit 0.

- [ ] **Step 4: Recreate the drill tables clean**

Drill data is disposable — 6 test assignments belonging to student id 3 / teacher id 182. Confirm this is still true immediately before running:

```sql
SELECT count(*), count(DISTINCT student_id), count(DISTINCT teacher_id) FROM drill_assignment;
```

Expected: `6 | 1 | 1`. **If the counts differ, STOP and ask the owner** — real student data may have arrived since 2026-08-09.

- [ ] **Step 5: Apply to production**

```bash
cd education-service && npm run prisma:migrate:deploy
```

- [ ] **Step 6: Delete the ETL script**

```bash
git rm education-service/scripts/migrate-education-from-legacy.py
```

- [ ] **Step 7: Commit**

```bash
git add education-service/prisma/
git commit -m "refactor(education): drop copied lesson tables and cross-database FKs"
```

---

### Task 11: Verify against the real broken lesson

**Files:** none — this is verification.

The originally reported lesson is `f249c6e4-e6ef-451d-a1b0-c4fb0a3b4477` (student 215116, start 2026-08-12, teacher_id 182, student_course `43c00027-cf75-4d60-8775-da38dea408a1`). It exists in portal_db and did not exist in `speakasap_education_db` — that is the whole bug.

- [ ] **Step 1: Confirm the portal serves it**

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "x-internal-token: $PORTAL_INBOUND_API_TOKEN" \
  https://speakasap.com/api/v1/internal/lessons/f249c6e4-e6ef-451d-a1b0-c4fb0a3b4477/
```

Expected: `200`. A `401` means the token does not match; a `404` means the mount path from Task 3 Step 3 is wrong.

- [ ] **Step 2: Confirm the roster is non-empty**

```bash
curl -s -H "x-internal-token: $PORTAL_INBOUND_API_TOKEN" \
  https://speakasap.com/api/v1/internal/lessons/f249c6e4-e6ef-451d-a1b0-c4fb0a3b4477/roster/
```

Expected: `teacher_id: 182` and a non-empty `student_ids`.

- [ ] **Step 3: Reproduce the original failing scenario in the browser**

Open `https://speakasap.com/teacher/students/215116/lessons/f249c6e4-e6ef-451d-a1b0-c4fb0a3b4477/`, start the drill wizard, and confirm the student picker lists students. This is the exact scenario the owner reported; a passing unit test is not a substitute.

- [ ] **Step 4: Confirm a future lesson works**

Pick any lesson with `start > now()` from portal_db and repeat Step 3. The original complaint was specifically that future lessons must work.

- [ ] **Step 5: Confirm lesson-records works for a post-June lesson**

Open the teacher record view for a lesson created after 2026-06-26 and confirm it loads instead of `Lesson not found`.

- [ ] **Step 6: Confirm failures are loud**

Temporarily set `PORTAL_API_URL` to an unreachable host, restart the pod, and confirm the drill wizard surfaces an explicit error rather than an empty student list. Restore the setting afterwards. This verifies the fix for the actual root-cause class, not just this instance.

- [ ] **Step 7: Record the outcome**

Update `TASKS.md` and `STATE.json` with what was verified and what remains.

---

## Self-Review

**Spec coverage:**
- No cross-service DB access → Tasks 5-9 replace every lesson DB read with HTTP; Task 10 removes the tables.
- No data copying → Task 10 deletes the ETL and the copied tables.
- Minimal legacy change → Tasks 1-4 add one isolated, deletable module plus one line in `rest/urls.py`.
- Drills + lesson-records together → Tasks 7 and 8.
- Drill data disposable → Task 10 Step 4 recreates clean, with a guard if counts changed.
- No silent failures → Task 5 defines two distinct error classes; Tasks 6-8 raise; Task 11 Step 6 verifies loudness.
- FK removal → Task 10 Step 1, with the reasoning recorded in the schema comment.

**Known gaps, deliberately left to the executor:**
- Task 9 Step 1-2 requires an inventory decision that depends on reading the current callers; the plan specifies the method and the constraint (add an endpoint, never a DB read) rather than pre-guessing the endpoints.
- Task 3 Step 3 requires confirming the real URL prefix rather than assuming `/api/v1/`.
- Task 8 requires adding `paid_student_ids` to the Task 2/3 serializer and view; called out explicitly because approximating it would grant unpaid playback.

**Type consistency:** `PortalLesson`/`PortalRoster`/`PortalRosterGroup` and the two error classes are defined in Task 5 and used under the same names in Tasks 6, 7, 8. `DrillTeacherRosterResponse` matches `contracts.ts:446`. `paidStudentIds` is introduced in Task 8 and must be added to Task 5's `PortalRoster` at that time.
