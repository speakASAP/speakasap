#!/usr/bin/env python3
"""No-write static contract checker for seven frontend routes and data loading."""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


COURSE_PAGE = Path("frontend/app/[languageCode]/seven/page.tsx")
LESSON_PAGE = Path("frontend/app/[languageCode]/seven/[order]/page.tsx")
CLIENT = Path("frontend/lib/seven.ts")
APP_PROMO = Path("frontend/app/components/seven-app-promo.tsx")
READING_INDICATOR = Path("frontend/app/components/seven-reading-indicator.tsx")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def has_all(text: str, snippets: list[str]) -> bool:
    return all(snippet in text for snippet in snippets)


def main() -> int:
    parser = argparse.ArgumentParser(description="Check seven frontend route contract without running frontend")
    parser.add_argument("--json-report", help="write JSON report to path; use - for stdout")
    args = parser.parse_args()

    course = read(COURSE_PAGE)
    lesson = read(LESSON_PAGE)
    client = read(CLIENT)
    promo = read(APP_PROMO)
    indicator = read(READING_INDICATOR)
    assertions = {
        "filesExist": all(path.exists() for path in [COURSE_PAGE, LESSON_PAGE, CLIENT, APP_PROMO, READING_INDICATOR]),
        "courseLoadsGatewayData": "getSevenCoursePageData(languageCode)" in course and "data.course" in course and "data.lessons.map" in course,
        "courseRendersLessonsAndPromo": has_all(
            course,
            [
                'className="seven-page"',
                'className="seven-course-header"',
                'className="seven-lessons-grid"',
                'className="seven-lesson-card"',
                '<SevenAppPromo course={data.course}',
                'href={`/${languageCode}/seven/${lesson.order}`}',
            ],
        ),
        "courseHasErrorFallback": "seven-empty" in course and "Материалы курса пока недоступны" in course,
        "courseMetadataUsesMigratedSeo": "generateMetadata" in course and "course.metaDescription" in course and "course.metaKeywords" in course,
        "lessonLoadsGatewayData": "getSevenLessonPageData(languageCode, order)" in lesson and "data.lesson" in lesson,
        "lessonRendersLegacyContentWrapper": has_all(
            lesson,
            [
                'className="seven-page seven-page--lesson"',
                '<SevenReadingIndicator',
                'className="hyphenate"',
                'className="lesson__content lesson__content--seven"',
                'className="lesson-wrapper"',
                "dangerouslySetInnerHTML={{ __html: lesson.bodyHtml }}",
            ],
        ),
        "lessonRendersPdfExercisesAndAnswers": has_all(
            lesson,
            [
                "const pdfHref = lesson?.pdfHref",
                "getSevenPdfHref(languageCode, numericOrder)",
                'className="seven-button button-download-pdf"',
                "lesson.exercises.length > 0",
                "exercise.exerciseHtml",
                "exercise.answerHtml",
                "Правильные ответы",
            ],
        ),
        "lessonRendersNavigationAndPromo": has_all(
            lesson,
            [
                "lesson?.previousLesson",
                "lesson?.nextLesson",
                "function neighbor(",
                "Предыдущий",
                "Следующий",
                "Все уроки",
                '<SevenAppPromo course={data.course}',
                "getSevenPromoDescription(data.course)",
            ],
        ),
        "lessonHasErrorFallback": "seven-empty" in lesson and "Материалы урока пока недоступны" in lesson,
        "lessonMetadataUsesMigratedSeo": "generateMetadata" in lesson and "lesson.metaDescription" in lesson and "lesson.metaKeywords" in lesson,
        "clientUsesNoStoreGatewayFetch": "getGatewayBaseUrl" in client and "cache: 'no-store'" in client,
        "clientUsesSevenGatewayEndpoints": has_all(
            client,
            [
                "`/api/v1/seven/courses/${code}`",
                "`/api/v1/seven/courses/${code}/lessons`",
                "`/api/v1/seven/courses/${code}/lessons/${lessonOrder}`",
            ],
        ),
        "clientHasLegacyCopyHelpers": has_all(
            client,
            [
                "legacyLanguageCaseGent",
                "LANGUAGE_GENITIVE_BY_CODE",
                "Pre-Intermediate",
                "A1",
                "legacyAndroidUrl",
                "legacyIosUrl",
            ],
        ),
        "promoRendersLegacyAppMessaging": has_all(
            promo,
            [
                "Полная версия курса",
                "Видео-материалы",
                "Упражнения к каждому уроку",
                "Аудио-материалы",
                "Google Play",
                "App Store",
            ],
        ),
        "readingIndicatorTracksLessonWrapper": has_all(
            indicator,
            [
                '"use client"',
                'document.querySelector<HTMLElement>(".lesson-wrapper")',
                'window.addEventListener("scroll"',
                'window.addEventListener("resize"',
                'className="seven-reading-indicator"',
            ],
        ),
    }
    report: dict[str, Any] = {
        "generatedAt": now_iso(),
        "writes": False,
        "files": {
            "coursePage": str(COURSE_PAGE),
            "lessonPage": str(LESSON_PAGE),
            "client": str(CLIENT),
            "appPromo": str(APP_PROMO),
            "readingIndicator": str(READING_INDICATOR),
        },
        "assertions": assertions,
        "approvalBoundary": {
            "frontendDeployStillRequiresOwnerApproval": True,
            "dataApplyApproved": False,
            "mediaCopyApproved": False,
            "legacyRetirementApproved": False,
        },
        "ok": all(assertions.values()),
    }
    payload = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True)
    if args.json_report and args.json_report != "-":
        Path(args.json_report).write_text(payload + "\n", encoding="utf-8")
        print(f"wrote report to {args.json_report}")
    else:
        print(payload)
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
