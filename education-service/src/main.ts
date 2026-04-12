import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { RemoteLogger } from './shared/remote-logger';
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
    validateEnv();
    const logger = new RemoteLogger();
    const app = await NestFactory.create(AppModule, {
      logger,
    });
    app.enableShutdownHooks();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    app.useGlobalFilters(new HttpErrorFilter());
    const port = Number(process.env.PORT);
    await app.listen(port);
    const version = process.env.npm_package_version || 'unknown';
    const label = process.env.SERVICE_NAME || 'education-service';
    Logger.log(`${label} v${version} started on port ${port}`, 'Bootstrap');
  } catch (error) {
    Logger.error('Bootstrap failed', error);
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  Logger.error('Bootstrap failed', error);
  process.exit(1);
});
