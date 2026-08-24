import { Injectable, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

import { isGraphQLContext } from './graphql-context';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  override getRequestResponse(context: ExecutionContext): {
    req: Record<string, unknown>;
    res: Record<string, unknown>;
  } {
    if (isGraphQLContext(context)) {
      const gqlContext = GqlExecutionContext.create(context).getContext<{
        req?: Record<string, unknown>;
        request?: Record<string, unknown>;
        reply?: Record<string, unknown>;
      }>();
      const reply = gqlContext.reply ?? {};

      return {
        req: gqlContext.req ?? gqlContext.request ?? {},
        res: typeof reply.header === 'function' ? reply : { ...reply, header: () => undefined },
      };
    }

    const http = context.switchToHttp();
    return {
      req: http.getRequest<Record<string, unknown>>(),
      res: http.getResponse<Record<string, unknown>>(),
    };
  }
}
