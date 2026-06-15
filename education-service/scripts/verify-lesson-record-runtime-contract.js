#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assertIncludes(file, needle) {
  const text = read(file);
  if (!text.includes(needle)) {
    throw new Error(`${file} is missing expected text: ${needle}`);
  }
}

assertIncludes('src/app.module.ts', 'LessonRecordsModule');
assertIncludes('src/lesson-records/lesson-records.controller.ts', "@Controller('lessons/:lessonUuid/record')");
assertIncludes('src/lesson-records/lesson-records.controller.ts', "@Get('playback')");
assertIncludes('src/lesson-records/lesson-records.controller.ts', "@Get('download')");
assertIncludes('src/lesson-records/lesson-records.controller.ts', "@Post('presign')");
assertIncludes('src/lesson-records/lesson-records.controller.ts', "@Post('commit')");
assertIncludes('src/lesson-records/lesson-records.controller.ts', "@Post('merge')");
assertIncludes('src/lesson-records/lesson-records.controller.ts', '@Delete()');
assertIncludes('src/lesson-records/lesson-records.service.ts', 'hasPaidAccess');
assertIncludes('src/lesson-records/lesson-records.service.ts', 'presignPut');
assertIncludes('src/lesson-records/lesson-records.service.ts', 'headObject');
assertIncludes('src/lesson-records/lesson-records.service.ts', 'durationSeconds');
assertIncludes('scripts/backfill-lesson-record-durations.js', 'private_lesson_record_media_ffprobe');
assertIncludes('scripts/repair-lesson-record-keys.js', 'education_lesson_record_key_repair');
assertIncludes('src/lesson-records/lesson-records.service.ts', 'confirmMerge');
assertIncludes('src/lesson-records/lesson-records.service.ts', 'confirmDelete');
assertIncludes('src/lesson-records/lesson-records.service.ts', 'deleteObject');
assertIncludes('src/lesson-records/lesson-records.service.ts', "status: 'merged'");
assertIncludes('src/lesson-records/storage.service.ts', 'RECORDS_S3_HELPER_URL');
assertIncludes('src/lesson-records/storage.service.ts', 'RECORDS_S3_ACCESS_KEY');
assertIncludes('src/lesson-records/storage.service.ts', 'downloadObjectToFile');
assertIncludes('src/lesson-records/storage.service.ts', 'putObjectFromFile');
assertIncludes('src/lesson-records/storage.service.ts', 'deleteObject');
assertIncludes('src/lesson-records/storage.service.ts', 'courses/records/');
assertIncludes('src/lesson-records/media-token.service.ts', 'MAX_TTL_SECONDS = 3600');
assertIncludes('src/lesson-records/media-token.service.ts', "scope: 'playback'");
assertIncludes('src/lesson-records/media-token.service.ts', 'parsePayload');
assertIncludes('src/lesson-records/media-token.service.ts', "throw new UnauthorizedException('Invalid media token')");
assertIncludes('../k8s/services/education-service.yaml', 'LESSON_RECORD_MEDIA_TOKEN_SECRET');
assertIncludes('src/shared/staff-access.ts', 'superadmin');
assertIncludes('src/internal-salary/internal-salary.service.ts', 'scheduledSeconds - input.durationSeconds <= FULL_LESSON_TOLERANCE_SECONDS');
if (read('src/internal-salary/internal-salary.service.ts').includes('scheduledSeconds * 0.95')) {
  throw new Error('internal salary duration rule must use fixed five-minute tolerance, not percentage tolerance');
}
assertIncludes('prisma/schema.prisma', 'model StudentAccess');
assertIncludes('prisma/schema.prisma', 'durationSeconds   Int?               @map("duration_seconds")');
assertIncludes('prisma/migrations/20260613130000_lesson_record_duration_seconds/migration.sql', 'duration_seconds');
assertIncludes('prisma/migrations/20260612143000_student_access/migration.sql', 'education_studentaccess');

console.log('lesson-record runtime contract verification passed');
