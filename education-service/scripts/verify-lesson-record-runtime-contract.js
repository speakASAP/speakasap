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
assertIncludes('src/lesson-records/lesson-records.service.ts', 'Student paid lesson-record access is not implemented in target data yet');
assertIncludes('src/lesson-records/lesson-records.service.ts', 'Target record deletion is disabled until owner-approved object deletion exists');
assertIncludes('src/lesson-records/storage.service.ts', 'RECORDS_S3_HELPER_URL');
assertIncludes('src/lesson-records/storage.service.ts', 'courses/records/');
assertIncludes('src/lesson-records/media-token.service.ts', 'MAX_TTL_SECONDS = 3600');
assertIncludes('src/lesson-records/media-token.service.ts', "scope: 'playback'");

console.log('lesson-record runtime contract verification passed');
