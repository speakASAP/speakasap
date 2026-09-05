# Track J — Legacy Portal Entry Points (Wave 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Put drilling where teachers and students already work — the student dashboard, the teacher dashboard, and the lesson page — until those pages are retired.

**Service:** `speakasap-portal` · **Depends on:** Tracks I, B2

**Read first:** [`00-MASTER.md`](00-MASTER.md) (contract C8), spec §13.

**You own:** `speakasap-portal/cabinet/templates/**`, `cabinet/student/views/**`, `cabinet/teacher/views/**`, `cabinet/drills_client.py`.

**Constraints specific to this track:**
- Django templates and one client module. **No models, no migrations, no React 15, no Webpack 2, no supervisord changes.**
- Every block **fails soft**. A drilling outage must never 500 a dashboard or a lesson page.
- Mark every added block with `{# DRILLING: transitional — delete at legacy sunset #}` so the removal is mechanical later.
- `ssh speakasap` is **read only**. Run tests there; never write files, restart services, or deploy over ssh. Deployment is the orchestrator's job in Track K.

---

### Task J.1: Fail-soft API client

**Files:**
- Create: `speakasap-portal/cabinet/drills_client.py`
- Test: `speakasap-portal/cabinet/tests/test_drills_client.py`

**Interfaces:**
- Produces:
  - `get_student_assignments(student_id) -> dict` — shape `InternalStudentAssignmentsResponse`, or a safe empty dict
  - `get_teacher_summary(teacher_id) -> dict` — shape `InternalTeacherAssignmentsResponse`, or a safe empty dict
  - `get_lesson_assignments(lesson_uuid) -> dict`
  - `platform_link(user, path) -> str` — builds `{PLATFORM_URL}{path}?sso=…`

- [ ] **Step 1: Write the failing test**

```python
import responses
from django.test import TestCase, override_settings
from cabinet.drills_client import (
    get_student_assignments, get_teacher_summary, platform_link)

BASE = 'http://education:4205'

@override_settings(EDUCATION_SERVICE_URL=BASE, DRILLS_CLIENT_TIMEOUT=2)
class DrillsClientTests(TestCase):

    @responses.activate
    def test_returns_parsed_payload_on_success(self):
        responses.add(responses.GET,
            '%s/api/v1/internal/drill-assignments/by-student/42' % BASE,
            json={'outstanding': [{'uuid': 'a-1'}], 'completedRecent': [],
                  'selfDrillingAllowed': False}, status=200)
        result = get_student_assignments(42)
        self.assertEqual(len(result['outstanding']), 1)
        self.assertFalse(result['selfDrillingAllowed'])

    @responses.activate
    def test_returns_safe_empty_on_500_rather_than_raising(self):
        responses.add(responses.GET,
            '%s/api/v1/internal/drill-assignments/by-student/42' % BASE, status=500)
        result = get_student_assignments(42)
        self.assertEqual(result['outstanding'], [])
        self.assertTrue(result['unavailable'])

    @responses.activate
    def test_returns_safe_empty_on_timeout(self):
        responses.add(responses.GET,
            '%s/api/v1/internal/drill-assignments/by-student/42' % BASE,
            body=Exception('timeout'))
        result = get_student_assignments(42)
        self.assertEqual(result['outstanding'], [])
        self.assertTrue(result['unavailable'])

    @responses.activate
    def test_defaults_self_drilling_to_false_when_unavailable(self):
        responses.add(responses.GET,
            '%s/api/v1/internal/drill-assignments/by-student/42' % BASE, status=503)
        self.assertFalse(get_student_assignments(42)['selfDrillingAllowed'])

    def test_returns_safe_empty_when_the_url_is_not_configured(self):
        with override_settings(EDUCATION_SERVICE_URL=''):
            self.assertTrue(get_student_assignments(42)['unavailable'])

    @responses.activate
    def test_teacher_summary_zeroes_counts_when_unavailable(self):
        responses.add(responses.GET,
            '%s/api/v1/internal/drill-assignments/by-teacher/7' % BASE, status=500)
        s = get_teacher_summary(7)
        self.assertEqual(s['awaitingReview'], 0)
        self.assertEqual(s['reviewQueue'], [])
```

Test 4 is the important default: when the service is down, self-drilling is
**not** offered. Defaulting to `True` would show a button that 409s.

- [ ] **Step 2: Run, confirm failure**

```bash
ssh speakasap 'cd speakasap-portal && python manage.py test cabinet.tests.test_drills_client'
```

- [ ] **Step 3: Implement**

`platform_link` calls `get_platform_bearer_token(user, 'speakasap-platform')`
from Track I and appends `?sso=…&next=…`. If the token is `None`, return the
bare platform URL without `sso` — the user then signs in normally rather than
seeing a broken link.

- [ ] **Step 4: Run, confirm PASS (6 passed). Commit**

---

### Task J.2: Student dashboard block

**Files:**
- Modify: `speakasap-portal/cabinet/templates/student/<dashboard template>` (find it first)
- Modify: `speakasap-portal/cabinet/student/views/` (the dashboard view)
- Create: `speakasap-portal/cabinet/templates/student/_drilling_block.html`
- Test: `speakasap-portal/cabinet/tests/test_student_drilling_block.py`

- [ ] **Step 1: Locate the real dashboard view and template**

```bash
rtk rg -n "class .*Dashboard|def dashboard" /home/ssf/Documents/Github/speakasap-portal/cabinet/student/views/
rtk rg --files -g '*.html' /home/ssf/Documents/Github/speakasap-portal/cabinet/templates/student/ | head -20
```

Record what you found in the status file. Do not guess the filename.

- [ ] **Step 2: Write the failing test**

```python
class StudentDrillingBlockTests(TestCase):

    def test_shows_a_card_per_outstanding_assignment(self):
        with patch('cabinet.drills_client.get_student_assignments') as m:
            m.return_value = {'outstanding': [
                {'uuid': 'a-1', 'title': 'Предлоги', 'itemCount': 50,
                 'blanksCorrect': 18, 'blanksTotal': 50, 'dueAt': None,
                 'resourceLinks': []}],
                'completedRecent': [], 'selfDrillingAllowed': False, 'unavailable': False}
            response = self.client.get(self.dashboard_url)
        self.assertContains(response, 'Предлоги')
        self.assertContains(response, '18')

    def test_links_to_the_platform_runner_with_an_sso_token(self):
        # ... asserts href contains /learner/practice/a-1 and 'sso='

    def test_offers_self_practice_only_when_allowed(self):
        # allowed=True  -> link present
        # allowed=False -> link absent, explanatory text present

    def test_renders_a_quiet_notice_and_HTTP_200_when_the_service_is_down(self):
        with patch('cabinet.drills_client.get_student_assignments') as m:
            m.return_value = {'outstanding': [], 'completedRecent': [],
                              'selfDrillingAllowed': False, 'unavailable': True}
            response = self.client.get(self.dashboard_url)
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'Traceback')

    def test_shows_nothing_at_all_when_there_is_no_work_and_no_outage(self):
        # empty state must not render an empty bordered box
```

- [ ] **Step 3: Implement `_drilling_block.html` and include it. Run, confirm PASS**

The self-practice link is gated on `selfDrillingAllowed` — the same flag the
server uses for the 409. Never compute the gate in the template.

- [ ] **Step 4: Commit**

---

### Task J.3: Teacher dashboard block

**Files:**
- Create: `speakasap-portal/cabinet/templates/teacher/_drilling_block.html`
- Modify: the teacher dashboard view and template
- Test: `speakasap-portal/cabinet/tests/test_teacher_drilling_block.py`

- [ ] **Step 1: Write the failing test**

Assert:
- counts render for awaiting review / assigned / completed this week
- "Create drilling assignment" links to `/teacher/assignments/new` with `sso=`
- "Review pending" is badged with the count and links to the platform review queue
- **no score, percentage or accuracy text appears anywhere in the rendered block**
- an outage renders 200 with zeroed counts and a quiet notice

- [ ] **Step 2: Implement, run, confirm PASS. Commit**

---

### Task J.4: Lesson page panel — both views

The placement that matters most: this is where a teacher decides what a student
should practise next.

**Files:**
- Create: `speakasap-portal/cabinet/templates/teacher/_lesson_drilling_panel.html`
- Create: `speakasap-portal/cabinet/templates/student/_lesson_drilling_panel.html`
- Modify: the lesson detail views (teacher and student)
- Test: `speakasap-portal/cabinet/tests/test_lesson_drilling_panel.py`

- [ ] **Step 1: Locate the lesson views**

```bash
rtk rg -n "lesson" /home/ssf/Documents/Github/speakasap-portal/cabinet/teacher/views/ | head -20
rtk rg -n "lesson" /home/ssf/Documents/Github/speakasap-portal/cabinet/student/views/ | head -20
```

- [ ] **Step 2: Write the failing test**

```python
class LessonDrillingPanelTests(TestCase):

    def test_teacher_view_lists_assignments_for_this_lesson_per_student(self):
        # asserts each student name and assignment status appears

    def test_teacher_view_create_button_prefills_lesson_and_student(self):
        # asserts href contains lessonUuid=<uuid> and studentId=<id>

    def test_teacher_view_shows_no_score(self):
        response = self._render_teacher_lesson()
        self.assertNotContains(response, '%')
        for word in ['accuracy', 'score', 'точность', 'балл']:
            self.assertNotContains(response, word)

    def test_student_view_lists_only_their_own_assignments(self):
        # a second student's assignment must not appear

    def test_student_view_links_into_the_runner(self):
        # asserts /learner/practice/ appears in an href

    def test_both_views_return_200_when_the_service_is_down(self):
        # patched to unavailable -> 200, no traceback, quiet notice
```

Test 4 is an authorization test, not a cosmetic one: a student must never see
another student's assignments on a shared lesson page.

- [ ] **Step 3: Implement both panels. Run, confirm PASS. Commit**

```bash
cd /home/ssf/Documents/Github/speakasap-portal
rtk git add cabinet/
rtk git commit -m "feat(portal): drilling entry points on dashboards and the lesson page

Transitional blocks, marked for deletion at sunset. All fail soft: a
drilling outage renders a quiet notice, never a 500. Self-practice is
gated on the server's own flag so the portal and platform cannot disagree.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Track J completion checklist

- [ ] `python manage.py test cabinet` green (run read-only over ssh, output pasted)
- [ ] Every block renders 200 with the service patched unavailable
- [ ] No-score assertions pass in the teacher dashboard and lesson panel
- [ ] Student lesson panel shows only that student's work — tested
- [ ] Every added block carries the `DRILLING: transitional` marker
- [ ] Status file at `status/track-j.md`, naming the exact view and template files modified
