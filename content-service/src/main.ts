import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ContentLogger } from './shared/content-logger';
import { validateEnv } from './shared/validate-env';
import { HttpErrorFilter } from './shared/http-exception.filter';

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

async function bootstrap(): Promise<void> {
  try {
    console.log('Starting Content Service bootstrap...');
    validateEnv();
    console.log('Environment validated');
    console.log('Creating NestJS application...');
    let app;
    try {
      app = await NestFactory.create(AppModule, {
        logger: new ContentLogger(),
      });
      console.log('NestJS application created');
    } catch (createError) {
      console.error('Failed to create NestJS application:', createError);
      console.error('Create error message:', (createError as Error)?.message);
      console.error('Create error stack:', (createError as Error)?.stack);
      throw createError;
    }
    app.enableShutdownHooks();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    app.useGlobalFilters(new HttpErrorFilter());
    const port = Number(process.env.PORT);
    console.log(`Starting server on port ${port}...`);
    await app.listen(port);
    Logger.log(`Content Service started on port ${port}`, 'Bootstrap');
    console.log(`Content Service started successfully on port ${port}`);
  } catch (error) {
    console.error('Bootstrap error:', error);
    console.error('Error message:', (error as Error)?.message);
    console.error('Error stack:', (error as Error)?.stack);
    Logger.error('Content Service bootstrap failed', error);
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  console.error('Uncaught bootstrap error:', error);
  console.error('Error stack:', (error as Error).stack);
  Logger.error('Content Service bootstrap failed', error);
  process.exit(1);
});
