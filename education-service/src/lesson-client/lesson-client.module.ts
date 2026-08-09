import { Module } from '@nestjs/common';
import { LessonClientService } from './lesson-client.service';

/**
 * LESSON-API: transitional — delete or repoint at legacy sunset.
 *
 * The only route from this service to lesson data, which lives in the portal.
 */
@Module({
  providers: [LessonClientService],
  exports: [LessonClientService],
})
export class LessonClientModule {}
