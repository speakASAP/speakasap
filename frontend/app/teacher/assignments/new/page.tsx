'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DrillTopicDTO } from '@/lib/drills/contracts';
import { DrillApiError, generateAssignments, listTopics } from '@/lib/drills/teacher/api';
import { GenerationProgress } from '@/lib/drills/teacher/GenerationProgress';
import { WizardWho, type WizardWhoValue } from '@/lib/drills/teacher/WizardWho';
import { WizardWhat, type WizardWhatValue } from '@/lib/drills/teacher/WizardWhat';

type Step = 'who' | 'what' | 'how' | 'generating';

/**
 * The teacher's "assign a drill" wizard: who it is for, what it is about, and whether to
 * generate something new or reuse a set from the library.
 *
 * State lives here rather than in the URL because a half-filled wizard is not something
 * to link to or restore — the teacher either finishes it or starts again.
 */
export default function NewAssignmentPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('who');
  const [who, setWho] = useState<WizardWhoValue | null>(null);
  const [what, setWhat] = useState<WizardWhatValue | null>(null);
  const [topics, setTopics] = useState<DrillTopicDTO[]>([]);
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

  return (
    <main>
      <h1>New drilling assignment</h1>
      {error ? <p role="alert">{error}</p> : null}

      {step === 'who' ? (
        <WizardWho
          students={[]}
          onNext={(value) => {
            setWho(value);
            setStep('what');
          }}
        />
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
        <section>
          <h2>How should it be built?</h2>
          <button type="button" onClick={generate}>
            Generate new
          </button>
          <button type="button" onClick={() => router.push('/teacher/assignments/library')}>
            Pick from library
          </button>
        </section>
      ) : null}

      {step === 'generating' && assignmentUuid ? (
        <GenerationProgress
          assignmentUuid={assignmentUuid}
          onReady={onReady}
          onRetry={generate}
        />
      ) : null}
    </main>
  );
}
