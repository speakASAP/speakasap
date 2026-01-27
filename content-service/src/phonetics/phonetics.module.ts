import { Module } from '@nestjs/common';
import { PhoneticsController } from './phonetics.controller';
import { PhoneticsService } from './phonetics.service';

@Module({
  controllers: [PhoneticsController],
  providers: [PhoneticsService],
})
export class PhoneticsModule {}
