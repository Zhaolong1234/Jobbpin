import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { AppLoggerService } from '../logger/app-logger.service';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = this.resolveMessage(exception);

    const trace = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(
      `${request.method} ${request.url} -> ${status}: ${message}`,
      trace,
      'HttpExceptionFilter',
    );

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private resolveMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (response && typeof response === 'object') {
        const maybeMessage = (response as { message?: string | string[] }).message;
        if (Array.isArray(maybeMessage)) {
          return maybeMessage.join('; ');
        }
        if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
          return maybeMessage;
        }
      }
      return exception.message;
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'Internal server error';
  }
}
