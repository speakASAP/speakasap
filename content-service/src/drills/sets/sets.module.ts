import { Module } from '@nestjs/common';
import { SetsController } from './sets.controller';
import { SetsService } from './sets.service';

// PrismaService comes from the @Global() SharedModule already imported in
// AppModule, so it is not re-provided here — same as DrillsModule.
@Module({
  controllers: [SetsController],
  providers: [SetsService],
  exports: [SetsService],
})
export class SetsModule {}
