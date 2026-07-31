import { DrillAssignmentDTO, GenerationProgress } from './contracts';

export function toAssignmentDTO(
  row: any,
  counts: { blanksCorrect: number; blanksTotal: number },
): DrillAssignmentDTO {
  const progress = row.generationProgress as Partial<GenerationProgress> | null;
  return {
    uuid: row.uuid,
    setUuid: row.setUuid,
    studentId: row.studentId,
    teacherId: row.teacherId,
    origin: row.origin,
    lessonUuid: row.lessonUuid,
    title: row.title,
    languageCode: row.languageCode,
    materialLanguage: row.materialLanguage,
    status: row.status,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    resourceLinks: row.resourceLinks ?? [],
    itemCount: row.items?.length ?? 0,
    blanksCorrect: counts.blanksCorrect,
    blanksTotal: counts.blanksTotal,
    generationProgress: progress && progress.phase ? (progress as GenerationProgress) : null,
    createdAt: row.createdAt.toISOString(),
    assignedAt: row.assignedAt ? row.assignedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}
