'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DrillTopicDTO } from '@/lib/drills/contracts';
import {
  DrillApiError,
  generateAssignments,
  listTeacherStudents,
  listTopics,
} from '@/lib/drills/teacher/api';
import { GenerationProgress } from '@/lib/drills/teacher/GenerationProgress';
import {
  WizardWho,
  type WizardGroup,
  type WizardStudent,
  type WizardWhoValue,
} from '@/lib/drills/teacher/WizardWho';
import { WizardWhat, type WizardWhatValue } from '@/lib/drills/teacher/WizardWhat';

type Step = 'who' | 'what' | 'how' | 'generating';

/**
 * The teacher's "assign a drill" wizard: who it is for, what it is about, and whether to
 * generate something new or reuse a set from the library.
 *
 * State lives here rather than in the URL because a half-filled wizard is not something
 * to link to or restore — the teacher either finishes it or starts again.
 */
/**
 * `useSearchParams` opts the tree into client-side rendering, which Next requires to sit
 * behind a Suspense boundary — without it the production build fails on prerender even
 * though every unit test passes.
 */
export default function NewAssignmentPage() {
  return (
    <Suspense fallback={<WizardFallback />}>
      <NewAssignmentWizard />
    </Suspense>
  );
}

function WizardFallback() {
  return (
    <main className="min-h-full bg-zinc-50 px-4 py-8 dark:bg-zinc-950 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-40 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </main>
  );
}

function NewAssignmentWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Arriving from a portal lesson page: /teacher/assignments/new?lessonUuid=…&studentId=…
  //
  // Both were previously ignored, so a teacher who clicked "create drilling assignment"
  // for one student landed on an empty picker and had to find them again among 656
  // names. WizardWho drops an id that is not on the roster.
  const initialStudentIds = useMemo(() => {
    const raw = Number(searchParams.get('studentId'));
    return Number.isInteger(raw) && raw > 0 ? [raw] : [];
  }, [searchParams]);
  const initialLessonUuid = searchParams.get('lessonUuid');
  // The wizard does not fetch a lesson list, so there is no title to look up. A short
  // prefix is enough for the teacher to recognise that the lesson came with them.
  const initialLessonTitle = initialLessonUuid
    ? `Lesson from the portal (${initialLessonUuid.slice(0, 8)}…)`
    : null;

  const [step, setStep] = useState<Step>('who');
  const [who, setWho] = useState<WizardWhoValue | null>(null);
  const [what, setWhat] = useState<WizardWhatValue | null>(null);
  const [topics, setTopics] = useState<DrillTopicDTO[]>([]);
  const [students, setStudents] = useState<WizardStudent[]>([]);
  const [groups, setGroups] = useState<WizardGroup[]>([]);
  const [assignmentUuid, setAssignmentUuid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The taxonomy is fetched once for the whole wizard. A failure is not fatal: the topic
  // picker still lets the teacher type a topic, which is the path a new topic takes
  // anyway.
  useEffect(() => {
    let cancelled = false;
    listTopics('de', 'ru')
      .then((list) => {
        if (!cancelled) {
          setTopics(list);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTopics([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The roster IS fatal, unlike the taxonomy: a wizard with no students to pick from
  // cannot produce an assignment, so the failure is surfaced rather than absorbed.
  useEffect(() => {
    let cancelled = false;
    listTeacherStudents()
      .then((roster) => {
        if (cancelled) {
          return;
        }
        setStudents(
          roster.students.map((student) => ({
            id: student.id,
            // Names are resolved from auth-microservice by education-service. The id
            // fallback still covers a student with no auth mapping, and the case where
            // auth is unreachable and the roster degrades to ids rather than failing.
            name: student.name || `Student ${student.id}`,
          })),
        );
        setGroups(
          roster.groups.map((group) => ({
            id: group.uuid,
            name: group.name,
            studentIds: group.studentIds,
          })),
        );
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof DrillApiError ? e.message : 'Could not load your students');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const generate = useCallback(async () => {
    if (!who || !what) {
      return;
    }
    setError(null);
    setStep('generating');
    try {
      const result = await generateAssignments({
        studentIds: who.studentIds,
        lessonUuid: who.lessonUuid,
        languageCode: 'de',
        materialLanguage: 'ru',
        topicSlugs: what.topics.map((t) => t.slug),
        instructions: what.instructions,
        count: what.count,
      });
      setAssignmentUuid(result.assignmentUuids[0] ?? null);
    } catch (e) {
      setError(e instanceof DrillApiError ? e.message : 'Could not start generation');
      setStep('how');
    }
  }, [who, what]);

  const onReady = useCallback(() => {
    if (assignmentUuid) {
      router.push(`/teacher/assignments/${assignmentUuid}/review`);
    }
  }, [assignmentUuid, router]);

  const stepLabels: { key: Step; label: string }[] = [
    { key: 'who', label: 'Who' },
    { key: 'what', label: 'What' },
    { key: 'how', label: 'How' },
  ];
  const currentIndex = stepLabels.findIndex((s) => s.key === step);

  return (
    <main className="min-h-full bg-zinc-50 px-4 py-8 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">New drilling assignment</h1>
          <ol className="mt-3 flex flex-wrap gap-2 text-xs">
            {stepLabels.map((s, i) => (
              <li
                key={s.key}
                aria-current={s.key === step ? 'step' : undefined}
                className={`rounded-full px-3 py-1 ${
                  i === currentIndex || step === 'generating'
                    ? 'bg-sky-600 text-white'
                    : i < currentIndex
                      ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200'
                      : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                }`}
              >
                {i + 1}. {s.label}
              </li>
            ))}
          </ol>
        </header>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            {error}
          </p>
        ) : null}

        {step === 'who' ? (
          students.length === 0 && !error ? (
            // Loading skeleton: the roster is one call away and a bare page reads as broken.
            <div className="space-y-2" aria-busy="true" aria-label="Loading your students">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800"
                />
              ))}
            </div>
          ) : (
            <WizardWho
              students={students}
              groups={groups}
              initialStudentIds={initialStudentIds}
              initialLessonUuid={initialLessonUuid}
              initialLessonTitle={initialLessonTitle}
              onNext={(value) => {
                setWho(value);
                setStep('what');
              }}
            />
          )
        ) : null}

        {step === 'what' ? (
          <WizardWhat
            topics={topics}
            onNext={(value) => {
              setWhat(value);
              setStep('how');
            }}
          />
        ) : null}

        {step === 'how' ? (
          <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">How should it be built?</h2>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="flex-1 rounded-md bg-sky-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                onClick={generate}
              >
                Generate new
                <span className="mt-0.5 block text-xs font-normal opacity-90">
                  The AI writes sentences for this topic
                </span>
              </button>
              <button
                type="button"
                className="flex-1 rounded-md border border-zinc-300 px-4 py-3 text-sm font-medium transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-zinc-700 dark:hover:bg-zinc-800"
                onClick={() => router.push('/teacher/assignments/library')}
              >
                Pick from library
                <span className="mt-0.5 block text-xs font-normal text-zinc-500">
                  Reuse a set you or a colleague approved
                </span>
              </button>
            </div>
          </section>
        ) : null}

        {step === 'generating' && assignmentUuid ? (
          <GenerationProgress
            assignmentUuid={assignmentUuid}
            onReady={onReady}
            onRetry={generate}
          />
        ) : null}
      </div>
    </main>
  );
}
