import { Module } from '@nestjs/common';
import { DrillsController } from './drills.controller';
import { DrillsService } from './drills.service';
import { VocabularyController } from '../vocabulary/vocabulary.controller';
import { VocabularyService } from '../vocabulary/vocabulary.service';

// Owns both the drill-bank endpoints and the vocabulary-baseline endpoint. There is no
// separate VocabularyModule (Task A.8 only calls for vocabulary.controller.ts, not a
// module of its own) — DrillsService already depends on VocabularyService, so this
// module is the natural home for both controllers and both providers. PrismaService
// comes from the @Global() SharedModule already imported in AppModule, so it is not
// re-provided here.
@Module({
  controllers: [DrillsController, VocabularyController],
  providers: [DrillsService, VocabularyService],
})
export class DrillsModule {}
