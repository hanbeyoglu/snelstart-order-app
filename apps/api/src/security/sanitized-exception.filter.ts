import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

function safeMessage(statusCode: number, originalMessage: unknown): string {
  if (statusCode === HttpStatus.BAD_REQUEST) return 'Invalid request';
  if (statusCode === HttpStatus.UNAUTHORIZED) return 'Unauthorized';
  if (statusCode === HttpStatus.FORBIDDEN) return 'Forbidden';
  if (statusCode === HttpStatus.NOT_FOUND) return 'Not found';
  if (statusCode === HttpStatus.TOO_MANY_REQUESTS) return 'Too many requests';
  return 'Internal server error';
}

@Catch()
export class SanitizedExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(statusCode).json({
      statusCode,
      message: safeMessage(statusCode, undefined),
      error: HttpStatus[statusCode] || 'Error',
    });
  }
}
