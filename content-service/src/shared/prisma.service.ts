import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  [key: string]: unknown;
  private readonly logger = new Logger(PrismaService.name);
  private isConnected = false;

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      console.log('[PrismaService] Connecting to database...');
      this.logger.log('Connecting to database...');
      await this.$connect();
      this.isConnected = true;
      console.log('[PrismaService] Database connection established');
      this.logger.log('Database connection established');
    } catch (error) {
      console.error('[PrismaService] Failed to connect to database:', error);
      console.error('[PrismaService] Error message:', (error as Error)?.message);
      console.error('[PrismaService] Error stack:', (error as Error)?.stack);
      this.logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.isConnected) {
      await this.$disconnect();
    }
  }
}
