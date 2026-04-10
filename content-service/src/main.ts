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
    console.log('Creating ContentLogger...');
    let logger;
    try {
      logger = new ContentLogger();
      console.log('ContentLogger created successfully');
    } catch (loggerError) {
      console.error('Failed to create ContentLogger:', loggerError);
      console.error('Logger error:', (loggerError as Error)?.message);
      throw loggerError;
    }
    let app;
    try {
      console.log('Creating NestFactory...');
      app = await NestFactory.create(AppModule, {
        logger: logger,
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
    const version = process.env.npm_package_version || 'unknown';
    Logger.log(`Content Service v${version} started on port ${port}`, 'Bootstrap');
    Logger.log(
      'Translate routes registered: POST /api/v1/dictionary/translate, POST /api/v1/grammar/translate',
      'Bootstrap',
    );
    console.log(`Content Service v${version} started successfully on port ${port}`);
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
