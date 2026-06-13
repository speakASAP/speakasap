import type { Metadata } from 'next';
import Link from 'next/link';
import { getSevenDescription, getSevenLessonPageData, getSevenPdfHref, getSevenPromoDescription, SevenLessonSummary } from '@/lib/seven';
import { SevenReadingIndicator } from '@/app/components/seven-reading-indicator';
import { SevenAppPromo } from '@/app/components/seven-app-promo';

type PageProps = {
  params: Promise<{ languageCode: string; order: string }>;
};

function neighbor(lessons: SevenLessonSummary[], order: number, direction: -1 | 1): SevenLessonSummary | null {
  const sorted = [...lessons].sort((left, right) => left.order - right.order || left.id - right.id);
  const index = sorted.findIndex((lesson) => lesson.order === order);
  if (index < 0) {
    return null;
  }
  return sorted[index + direction] ?? null;
}


export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { languageCode, order } = await params;
  const data = await getSevenLessonPageData(languageCode, order);
  const lesson = data.lesson;
  if (!lesson) {
    return {
      title: 'Урок курса',
      description: getSevenDescription(null),
    };
  }

  const title = `${lesson.prefix} — ${lesson.title}. Языковая школа Елены Шипиловой`;
  const description = getSevenDescription(lesson.metaDescription ?? data.course?.metaDescription);
  return {
    title,
    description,
    keywords: lesson.metaKeywords ? [lesson.metaKeywords] : undefined,
    openGraph: {
      title,
      description,
      type: 'article',
    },
  };
}

export default async function SevenLessonPage({ params }: PageProps) {
  const { languageCode, order } = await params;
  const data = await getSevenLessonPageData(languageCode, order);
  const numericOrder = Number(order);
  const lesson = data.lesson;
  const previous = lesson?.previousLesson ?? (Number.isFinite(numericOrder) ? neighbor(data.lessons, numericOrder, -1) : null);
  const next = lesson?.nextLesson ?? (Number.isFinite(numericOrder) ? neighbor(data.lessons, numericOrder, 1) : null);
  const pdfHref = lesson?.pdfHref ?? (lesson && Number.isFinite(numericOrder) ? getSevenPdfHref(languageCode, numericOrder) : null);

  return (
    <main className="seven-page seven-page--lesson">
      <SevenReadingIndicator />
      <section className="seven-shell seven-shell--narrow">
        {lesson ? (
          <>
            <nav className="seven-lesson-nav" aria-label="Навигация по урокам">
              <Link href={`/${languageCode}/seven`}>Все уроки</Link>
              <span aria-hidden="true">/</span>
              <span>{lesson.prefix}</span>
            </nav>

            <article className="seven-card">
              <div className="hyphenate" lang="ru">
                <div className="lesson__content lesson__content--seven">
                  <header className="seven-lesson-heading">
                    <h1>{lesson.prefix}</h1>
                    <p>{lesson.title}</p>
                  </header>
                  <div className="lesson-wrapper" dangerouslySetInnerHTML={{ __html: lesson.bodyHtml }} />
                </div>
              </div>
            </article>

            {pdfHref ? (
              <div className="download-pdf">
                <a className="seven-button button-download-pdf" href={pdfHref}>
                  Скачать PDF
                </a>
              </div>
            ) : null}

            {lesson.exercises.length > 0 ? (
              <section className="seven-card seven-exercises" id="exercises">
                <h2>Упражнения</h2>
                {lesson.exercises.map((exercise, index) => (
                  <details className="exercises__block" key={exercise.id} open={index === 0}>
                    <summary className="exercises__title">Упражнение №{exercise.order}</summary>
                    <div className="exercises__body" dangerouslySetInnerHTML={{ __html: exercise.exerciseHtml }} />
                    {exercise.answerHtml ? (
                      <details className="exercises__answer">
                        <summary>Правильные ответы</summary>
                        <div dangerouslySetInnerHTML={{ __html: exercise.answerHtml }} />
                      </details>
                    ) : null}
                    <div className="exercises__count">
                      {index + 1} из {lesson.exercises.length}
                    </div>
                  </details>
                ))}
              </section>
            ) : null}

            {data.course ? (
              <>
                <section className="seven-course-promo">
                  <h2>{data.course.title}</h2>
                  <p>{getSevenPromoDescription(data.course)}</p>
                </section>
                <SevenAppPromo course={data.course} />
              </>
            ) : null}

            <div className="seven-bottom-nav">
              {previous ? (
                <Link className="seven-button" href={`/${languageCode}/seven/${previous.order}`}>
                  Предыдущий
                </Link>
              ) : (
                <span />
              )}
              {next ? (
                <Link className="seven-button seven-button--orange" href={`/${languageCode}/seven/${next.order}`}>
                  Следующий
                </Link>
              ) : (
                <Link className="seven-button seven-button--orange" href={`/${languageCode}/seven`}>
                  Все уроки
                </Link>
              )}
            </div>
          </>
        ) : (
          <section className="seven-empty" aria-live="polite">
            <h1>Урок курса</h1>
            <p>{data.error ?? 'Материалы урока пока недоступны.'}</p>
            <Link className="seven-button seven-button--orange" href={`/${languageCode}/seven`}>
              Все уроки
            </Link>
          </section>
        )}
      </section>
    </main>
  );
}
