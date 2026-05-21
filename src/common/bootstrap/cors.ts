import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function parseOrigins(value?: string) {
  if (!value || value === '*') {
    return '*';
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function configureCors(app: INestApplication, config: ConfigService) {
  app.enableCors({
    origin: parseOrigins(config.get<string>('cors.origin')),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: config.get<boolean>('cors.credentials') ?? false,
  });
}
