import { Module } from '@nestjs/common';
import { LessonRecordsController } from './lesson-records.controller';
import { LessonRecordsService } from './lesson-records.service';
import { LessonRecordMediaTokenService } from './media-token.service';
import { LessonRecordStorageService } from './storage.service';
import { UserProfilesClient } from './user-profiles.client';

@Module({
  controllers: [LessonRecordsController],
  providers: [
    LessonRecordsService,
    LessonRecordMediaTokenService,
    LessonRecordStorageService,
    UserProfilesClient,
  ],
})
export class LessonRecordsModule {}
