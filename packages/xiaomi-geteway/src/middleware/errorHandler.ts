import { Context, Next } from 'koa';
import { AppError, ErrorResponse } from '../types';

export async function errorHandler(ctx: Context, next: Next): Promise<void> {
  try {
    await next();
  } catch (err: any) {
    if (err instanceof AppError) {
      ctx.status = err.status;
      ctx.body = {
        error: true,
        code: err.code,
        message: err.message,
        details: err.details,
      } as ErrorResponse;
    } else {
      ctx.status = err.status || 500;
      ctx.body = {
        error: true,
        code: 'UNKNOWN_ERROR',
        message: err.message || 'Unknown error',
        details: err.stack,
      } as ErrorResponse;
    }
  }
}