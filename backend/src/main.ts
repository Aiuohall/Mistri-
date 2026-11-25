import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import type { EnvironmentVariables } from './config/environment.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const config = app.get(ConfigService<EnvironmentVariables, true>);
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  const allowedOrigins = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (config.getOrThrow<boolean>('ENABLE_SWAGGER')) {
    const openApiConfiguration = new DocumentBuilder()
      .setTitle('Mistri API')
      .setDescription('API for roadside mechanic assistance in Bangladesh')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, openApiConfiguration));
  }

  await app.listen(config.getOrThrow('PORT'), '0.0.0.0');
}

void bootstrap();
