import { toAssignmentDTO } from './assignment.mapper';

const row = {
  uuid: 'a-1', setUuid: 's-1', studentId: 42, teacherId: 7, origin: 'TEACHER',
  lessonUuid: null, title: 'Prepositions', languageCode: 'de', materialLanguage: 'ru',
  status: 'ASSIGNED', dueAt: null, resourceLinks: [{ topic: 'prepositions', url: 'https://x' }],
  generationProgress: {}, firstTryAccuracy: 0.62,
  createdAt: new Date('2026-07-29T10:00:00Z'), assignedAt: null, completedAt: null,
  items: [{ uuid: 'i-1', blanks: [{ index: 0, prompt: 'на', answer: 'auf', alternatives: [] }] }],
} as any;

describe('toAssignmentDTO', () => {
  it('never includes firstTryAccuracy — it is not a teacher-facing field', () => {
    const dto = toAssignmentDTO(row, { blanksCorrect: 3, blanksResolved: 5, blanksRevealed: 2, blanksTotal: 10 });
    expect(JSON.stringify(dto)).not.toContain('firstTryAccuracy');
    expect((dto as unknown as Record<string, unknown>).firstTryAccuracy).toBeUndefined();
  });

  it('never includes an answer string', () => {
    const dto = toAssignmentDTO(row, { blanksCorrect: 3, blanksResolved: 5, blanksRevealed: 2, blanksTotal: 10 });
    expect(JSON.stringify(dto)).not.toContain('auf');
  });

  it('carries progress counts and item count', () => {
    const dto = toAssignmentDTO(row, { blanksCorrect: 3, blanksResolved: 5, blanksRevealed: 2, blanksTotal: 10 });
    expect(dto.blanksCorrect).toBe(3);
    // Correct and resolved are distinct fields: 5 blanks are done with, but only 3 of
    // them were answered — the other 2 were revealed.
    expect(dto.blanksResolved).toBe(5);
    expect(dto.blanksRevealed).toBe(2);
    expect(dto.blanksTotal).toBe(10);
    expect(dto.itemCount).toBe(1);
  });

  it('serializes dates as ISO strings', () => {
    const dto = toAssignmentDTO(row, { blanksCorrect: 0, blanksResolved: 0, blanksRevealed: 0, blanksTotal: 10 });
    expect(dto.createdAt).toBe('2026-07-29T10:00:00.000Z');
    expect(dto.assignedAt).toBeNull();
  });

  it('returns null generationProgress when the job is not running', () => {
    const dto = toAssignmentDTO(row, { blanksCorrect: 0, blanksResolved: 0, blanksRevealed: 0, blanksTotal: 10 });
    expect(dto.generationProgress).toBeNull();
  });
});
