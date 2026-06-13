import type { Metadata } from 'next';
import Link from 'next/link';
import { getSevenCoursePageData, getSevenDescription, getSevenPromoDescription } from '@/lib/seven';
import { SevenAppPromo } from '@/app/components/seven-app-promo';

type PageProps = {
  params: Promise<{ languageCode: string }>;
};


export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { languageCode } = await params;
  const data = await getSevenCoursePageData(languageCode);
  const course = data.course;
  if (!course) {
    return {
      title: 'Курс за 7 уроков',
      description: getSevenDescription(null),
    };
  }

  const description = getSevenDescription(course.metaDescription);
  return {
    title: `${course.title}. Языковая школа Елены Шипиловой`,
    description,
    keywords: course.metaKeywords ? [course.title, course.metaKeywords] : [course.title],
    openGraph: {
      title: `${course.title}. Языковая школа Елены Шипиловой`,
      description,
      type: 'website',
    },
  };
}

export default async function SevenCoursePage({ params }: PageProps) {
  const { languageCode } = await params;
  const data = await getSevenCoursePageData(languageCode);

  return (
    <main className="seven-page">
      <section className="seven-shell">
        {data.course ? (
          <>
            <header className="seven-course-header">
              <h1>{data.course.title}</h1>
              <p>{getSevenPromoDescription(data.course)}</p>
            </header>

            <SevenAppPromo course={data.course} />

            <div className="seven-lessons-grid" aria-label="Уроки курса">
              {data.lessons.map((lesson) => (
                <article className="seven-lesson-card" key={lesson.id}>
                  <h2>{lesson.prefix}</h2>
                  <p>{lesson.title}</p>
                  <Link className="seven-button seven-button--orange" href={`/${languageCode}/seven/${lesson.order}`}>
                    Открыть
                  </Link>
                </article>
              ))}
            </div>
          </>
        ) : (
          <section className="seven-empty" aria-live="polite">
            <h1>Курс за 7 уроков</h1>
            <p>{data.error ?? 'Материалы курса пока недоступны.'}</p>
          </section>
        )}
      </section>
    </main>
  );
}
