import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AiClientService } from './ai-client.service';

@Global()
@Module({
  providers: [PrismaService, AiClientService],
  exports: [PrismaService, AiClientService],
})
export class SharedModule {}
