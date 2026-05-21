import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';

export function configureValidation(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );
}
