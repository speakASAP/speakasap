import 'reflect-metadata';
import { Logger, ValidationPipe, HttpException, HttpStatus } from '@nestjs/common';
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
    process.env.PORT = process.env.SALARY_SERVICE_PORT || process.env.PORT;
    process.env.SERVICE_NAME = process.env.SERVICE_NAME || 'speakasap-salary-service';
    process.env.DATABASE_URL = process.env.SALARY_DATABASE_URL || process.env.DATABASE_URL;

    const logger = new RemoteLogger();
    const app = await NestFactory.create(AppModule, {
      logger,
    });
    app.enableShutdownHooks();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    app.useGlobalFilters(new HttpErrorFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
        exceptionFactory: (errors) =>
          new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              error: {
                code: 'VALIDATION_FAILED',
                message: 'Validation failed',
                details: { validation: errors },
              },
            },
            HttpStatus.BAD_REQUEST,
          ),
      }),
    );
    const port = Number(process.env.PORT);
    await app.listen(port);
    const version = process.env.npm_package_version || 'unknown';
    const label = process.env.SERVICE_NAME || 'salary-service';
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
