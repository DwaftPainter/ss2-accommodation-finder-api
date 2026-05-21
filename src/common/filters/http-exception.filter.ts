import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
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
      timestamp: new Date().toISOString(),
    };

    if (status >= 500) {
      this.logger.error(payload);
    } else {
      this.logger.debug(payload);
    }

    response.status(status).json(payload);
  }
}
