import { getSevenAppLinks, type SevenCourse } from '@/lib/seven';

type SevenAppPromoProps = {
  course: SevenCourse;
};

export function SevenAppPromo({ course }: SevenAppPromoProps) {
  const { androidUrl, iosUrl } = getSevenAppLinks(course);

  if (!androidUrl && !iosUrl) {
    return null;
  }

  return (
    <section className="seven-app-promo" aria-label="Мобильное приложение курса">
      <div className="seven-app-promo__content">
        <h2>Полная версия курса «{course.title}» в бесплатных приложениях для iOS и Android</h2>
        <ul>
          <li>Видео-материалы с объяснениями уроков</li>
          <li>Упражнения к каждому уроку для закрепления материала</li>
          <li>Аудио-материалы к урокам и упражнениям</li>
          <li>Все материалы, кроме видео, доступны без интернета</li>
        </ul>
        <div className="seven-app-promo__actions">
          {androidUrl ? (
            <a className="seven-button seven-button--green" href={androidUrl} target="_blank" rel="noreferrer">
              Google Play
            </a>
          ) : null}
          {iosUrl ? (
            <a className="seven-button" href={iosUrl} target="_blank" rel="noreferrer">
              App Store
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
