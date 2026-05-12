import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    response.status(status).json({
      error: {
        code: exceptionResponse.code || 'INTERNAL_ERROR',
        message: exceptionResponse.message || exception.message,
        details: exceptionResponse.details || null,
      },
    });
  }
}
