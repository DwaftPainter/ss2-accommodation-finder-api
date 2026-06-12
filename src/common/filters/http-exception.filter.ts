import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    const exceptionResponse = exception.getResponse();

    // ValidationPipe returns an object like { message: string[], error: string }
    // Other exceptions return a plain string
    const message =
      typeof exceptionResponse === 'object'
        ? (exceptionResponse as any).message
        : exceptionResponse;

    const payload = {
      statusCode: status,
      message,
      method: request.method,
      path: request.originalUrl ?? request.url,
      timestamp: new Date().toISOString(),
    };

    const logPayload = {
      ...payload,
      ip: request.ip,
      userAgent: request.get('user-agent'),
    };

    if (status >= 500) {
      this.logger.error(logPayload);
    } else {
      this.logger.debug(logPayload);
    }

    response.status(status).json(payload);
  }
}
