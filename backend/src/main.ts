import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { setupSwagger } from './common/swagger/swagger.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);

  app.setGlobalPrefix('api');

  // CORS for the admin dashboard dev origin. credentials:true required
  // because the refresh cookie crosses origins. Strict allow-list — no wildcards.
  // Strip any trailing slash — the browser Origin header never carries one,
  // so 'https://admin.masrafy.app/' would never match and CORS would fail.
  const corsOrigins = (process.env['CORS_ORIGINS'] ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'X-Correlation-Id',
      'Idempotency-Key',
      'X-Confirm-Program-Code',
    ],
    exposedHeaders: ['X-Correlation-Id'],
    maxAge: 600,
  });
  logger.log(
    `CORS enabled for ${corsOrigins.length} origin(s): ${corsOrigins.join(', ')}`,
    'Bootstrap',
  );

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const isProd = process.env['NODE_ENV'] === 'production';
  setupSwagger(app, isProd);

  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
