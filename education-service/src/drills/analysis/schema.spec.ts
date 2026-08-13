import { readFileSync } from 'fs';
import { join } from 'path';

const schema = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf8');

describe('remedial drills schema', () => {
  it('declares the four new models', () => {
    expect(schema).toContain('model GrammarTopic');
    expect(schema).toContain('model DrillAnalysisRun');
    expect(schema).toContain('model DrillGapAnalysis');
    expect(schema).toContain('model StudentWordMastery');
  });

  it('keeps one analysis run per source assignment', () => {
    expect(schema).toMatch(/sourceAssignmentUuid\s+String\s+@unique/);
  });

  it('keeps one gap cluster per assignment and topic', () => {
    expect(schema).toContain('@@unique([sourceAssignmentUuid, topicSlug])');
  });

  it('keeps one mastery row per student, language and normalized answer', () => {
    expect(schema).toContain('@@unique([studentId, languageCode, normalizedAnswer])');
  });

  it('links a remedial assignment back to its gap without cascading deletes onto it', () => {
    expect(schema).toContain('sourceAnalysisUuid String? @map("source_analysis_uuid") @db.Uuid');
    expect(schema).toMatch(/RemedialSource".*onDelete: SetNull/s);
  });

  it('leaves origin wide enough for REMEDIAL', () => {
    expect('REMEDIAL'.length).toBeLessThanOrEqual(8);
    expect(schema).toMatch(/origin\s+String\s+@db\.VarChar\(8\)/);
  });
});
