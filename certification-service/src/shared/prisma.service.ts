import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private isConnected = false;

  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('Connecting to database...');
      await this.$connect();
      this.isConnected = true;
      this.logger.log('Database connection established');
    } catch (error) {
      this.logger.error('Failed to connect to database', error as Error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.isConnected) {
      await this.$disconnect();
    }
  }
}
