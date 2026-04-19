import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RemoteLogger } from './shared/remote-logger';
import { validateEnv } from './shared/validate-env';
import { HttpErrorFilter } from './shared/http-exception.filter';

process.env.SERVICE_NAME ||= 'api-gateway';
process.env.PORT ||= process.env.API_GATEWAY_PORT || process.env.GATEWAY_SERVICE_PORT || '4210';

async function bootstrap(): Promise<void> {
  validateEnv();
  const logger = new RemoteLogger();
  const app = await NestFactory.create(AppModule, {
    logger,
    bodyParser: false,
  });
  app.enableShutdownHooks();
  app.useGlobalFilters(new HttpErrorFilter());
  const port = Number(process.env.PORT);
  await app.listen(port);
  Logger.log(`api-gateway listening on ${port}`, 'Bootstrap');
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
