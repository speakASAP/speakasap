import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { logOperationalFailure } from '../shared/operational-log';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });
    this.$on('error' as never, (event: Prisma.LogEvent) => {
      logOperationalFailure(this.log, {
        component: 'prisma',
        operation: 'engine',
        message: event.message,
        target: event.target ?? '',
      });
      this.log.error(`Prisma error event: ${event.message}`);
    });
    this.$on('warn' as never, (event: Prisma.LogEvent) => {
      this.log.warn(`Prisma warn: ${event.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
