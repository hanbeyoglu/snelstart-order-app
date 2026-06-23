import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SentryExceptionCaptured } from '@sentry/nestjs';
import { Response } from 'express';

function safeMessage(statusCode: number): string {
  if (statusCode === HttpStatus.BAD_REQUEST) return 'Invalid request';
  if (statusCode === HttpStatus.UNAUTHORIZED) return 'Unauthorized';
  if (statusCode === HttpStatus.FORBIDDEN) return 'Forbidden';
  if (statusCode === HttpStatus.NOT_FOUND) return 'Not found';
  if (statusCode === HttpStatus.TOO_MANY_REQUESTS) return 'Too many requests';
  return 'Internal server error';
}

function isValidationErrorBody(body: unknown): body is {
  success: false;
  message: string;
  errors: Record<string, string>;
} {
  return (
    typeof body === 'object' &&
    body !== null &&
    'success' in body &&
    (body as { success?: unknown }).success === false &&
    'errors' in body &&
    typeof (body as { errors?: unknown }).errors === 'object' &&
    (body as { errors?: unknown }).errors !== null
  );
}

@Catch()
export class SanitizedExceptionFilter implements ExceptionFilter {
  @SentryExceptionCaptured()
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (exception instanceof HttpException) {
      const exceptionBody = exception.getResponse();
      if (statusCode === HttpStatus.BAD_REQUEST && isValidationErrorBody(exceptionBody)) {
        response.status(statusCode).json(exceptionBody);
        return;
      }
    }

    response.status(statusCode).json({
      statusCode,
      message: safeMessage(statusCode),
      error: HttpStatus[statusCode] || 'Error',
    });
  }
}
