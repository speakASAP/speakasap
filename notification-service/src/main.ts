import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
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
    process.env.PORT = process.env.NOTIFICATION_SERVICE_PORT || process.env.PORT;
    process.env.SERVICE_NAME = process.env.SERVICE_NAME || 'speakasap-notification-service';
    process.env.DATABASE_URL = process.env.NOTIFICATION_DATABASE_URL || process.env.DATABASE_URL;

    const logger = new RemoteLogger();
    const app = await NestFactory.create(AppModule, {
      logger,
    });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.enableShutdownHooks();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    app.useGlobalFilters(new HttpErrorFilter());
    const port = Number(process.env.PORT);
    await app.listen(port);
    const version = process.env.npm_package_version || 'unknown';
    const label = process.env.SERVICE_NAME || 'notification-service';
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
