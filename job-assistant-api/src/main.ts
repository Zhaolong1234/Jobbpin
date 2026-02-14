import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { loadLocalEnvFile } from './common/config/load-env';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppLoggerService } from './common/logger/app-logger.service';

async function bootstrap() {
  loadLocalEnvFile();
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  const logger = app.get(AppLoggerService);
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ].filter((value): value is string => Boolean(value));

  app.useLogger(logger);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      try {
        const isAllowedVercelPreview =
          new URL(origin).hostname.endsWith('.vercel.app');
        if (allowedOrigins.includes(origin) || isAllowedVercelPreview) {
          callback(null, true);
          return;
        }
      } catch {
        // fall through to rejection
      }

      callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter(logger));

  const port = Number(process.env.PORT || 4000);
  await app.listen(port);
  logger.log(`API server running on port ${port}`);
  logger.log(
    `Supabase configured: ${Boolean(
      process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
    )}`,
    'Config',
  );
}
bootstrap();
