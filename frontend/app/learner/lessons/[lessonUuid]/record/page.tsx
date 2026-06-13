import { LessonRecordWorkspace } from "@/app/components/lesson-record-workspace";

type PageProps = {
  params: Promise<{ lessonUuid: string }>;
};

export default async function LessonRecordPage({ params }: PageProps) {
  const { lessonUuid } = await params;
  return <LessonRecordWorkspace role="learner" initialLessonUuid={lessonUuid} />;
}
