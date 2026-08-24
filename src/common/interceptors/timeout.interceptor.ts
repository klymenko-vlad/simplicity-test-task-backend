import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

import { isGraphQLContext } from '../graphql/graphql-context';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly ms = 15_000) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (this.isMutation(context)) return next.handle();

    return next.handle().pipe(
      timeout(this.ms),
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof TimeoutError ? new RequestTimeoutException() : error,
        ),
      ),
    );
  }

  private isMutation(context: ExecutionContext): boolean {
    if (!isGraphQLContext(context)) return false;

    const info = GqlExecutionContext.create(context).getInfo<{
      operation?: { operation?: string };
    }>();

    return info.operation?.operation === 'mutation';
  }
}
