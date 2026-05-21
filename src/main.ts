import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import {
  configureCors,
  configureSwagger,
  configureValidation,
  enableBigIntJsonSerialization,
} from './common/bootstrap';

async function bootstrap() {
  enableBigIntJsonSerialization();

  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  configureCors(app, config);

  app.setGlobalPrefix('api', {
    exclude: ['api/docs'],
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  configureSwagger(app);
  configureValidation(app);

  const port = config.get<number>('port') ?? 3000;

  await app.listen(port, '0.0.0.0');
  logger.log(`Server running at http://localhost:${port}`);
}

bootstrap();
