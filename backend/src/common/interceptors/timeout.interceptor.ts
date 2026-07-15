import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  // NOTE: we deliberately do NOT accept the timeout via a constructor
  // parameter. Nest registers this interceptor as APP_INTERCEPTOR with
  // `useClass`, which drives DI off constructor metadata. A parameter
  // typed `number` (like `timeoutMs = 30_000` used to be) is emitted as
  // the JS `Object` constructor in decorator metadata, and Nest then
  // fails with `argument Object at index [0]` because no provider
  // supplies `Object`. Reading directly from `process.env` sidesteps
  // that entirely while still letting operators tune the value at
  // deploy time via `REQUEST_TIMEOUT_MS`.
  private readonly timeoutMs: number = Number(process.env.REQUEST_TIMEOUT_MS) || 30_000;

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException('Request timed out'));
        }
        return throwError(() => err);
      }),
    );
  }
}
