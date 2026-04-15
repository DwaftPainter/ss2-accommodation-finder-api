import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// Fix BigInt serialization issue
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Config CORS
  app.enableCors({
    origin: '*', // Allow all origin
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: false,
  });

  app.setGlobalPrefix('api', {
    exclude: ['api/docs'], // exclude 'docs' endpoint
  });

  // Set up swagger docs
  const config = new DocumentBuilder()
    .setTitle('Accommodation Finder API')
    .setDescription('API for rental listing system')
    .setVersion('1.0')
    .addBearerAuth()
    .addServer('/api')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = process.env.PORT || 10000;

  await app.listen(port, '0.0.0.0');

  console.log(`Server running at http://localhost:${port}`);
}

bootstrap();
