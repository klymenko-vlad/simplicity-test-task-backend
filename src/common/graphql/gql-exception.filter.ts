import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { GqlExceptionFilter as GqlFilterMarker } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { PinoLogger } from 'nestjs-pino';

import { isPrismaError } from '../../database/repository/database-error';
import { DomainError, type DomainErrorKind } from '../errors/domain.error';

import { isGraphQLContext } from './graphql-context';

const HTTP_STATUS_CODE: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_USER_INPUT',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

const KIND_CODE: Record<DomainErrorKind, string> = {
  not_found: 'NOT_FOUND',
  conflict: 'CONFLICT',
  invalid: 'BAD_USER_INPUT',
};

const PRISMA_CODE_MAP: Record<string, { code: string; message: string }> = {
  P2002: { code: 'RESOURCE_ALREADY_EXISTS', message: 'Resource already exists' },
  P2003: {
    code: 'REFERENCED_RESOURCE_MISSING',
    message: 'Referenced resource does not exist',
  },
  P2011: { code: 'REQUIRED_FIELD_MISSING', message: 'A required field was not provided' },
  P2000: {
    code: 'INVALID_VALUE_FORMAT',
    message: 'A value in the request is not in the expected format',
  },
  P2034: {
    code: 'SERIALIZATION_FAILURE',
    message: 'Concurrent update conflict — retry the request',
  },
  P2024: { code: 'TOO_MANY_CONNECTIONS', message: 'The database is at capacity' },
};

const SECURITY_RELEVANT: ReadonlySet<string> = new Set(['UNAUTHENTICATED', 'FORBIDDEN']);

function describeHttpResponse(exception: HttpException): {
  message: string;
  details?: Record<string, unknown>;
} {
  const response = exception.getResponse();

  if (typeof response === 'string') return { message: response };

  const body = response as { message?: unknown };

  if (Array.isArray(body.message)) {
    const messages = body.message.map(String);

    return { message: messages.join('; '), details: { messages } };
  }

  if (typeof body.message === 'string') return { message: body.message };

  return { message: exception.message };
}

@Catch()
export class GqlExceptionFilter implements ExceptionFilter, GqlFilterMarker {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GqlExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): GraphQLError | undefined {
    const { code, message, details } = this.describe(exception);

    const payload = { err: exception, code };
    if (code === 'INTERNAL_SERVER_ERROR') {
      this.logger.error(payload, 'unhandled exception');
    } else if (SECURITY_RELEVANT.has(code)) {
      this.logger.warn(payload, 'request rejected');
    } else {
      this.logger.debug(payload, 'request failed');
    }

    if (isGraphQLContext(host)) {
      return new GraphQLError(message, {
        extensions: { code, ...(details ? { details } : {}) },
      });
    }

    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;

    httpAdapter.reply(ctx.getResponse(), { statusCode: status, code, message }, status);
    return undefined;
  }

  private describe(exception: unknown): {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } {
    if (exception instanceof DomainError) {
      return {
        code: KIND_CODE[exception.kind],
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const { message, details } = describeHttpResponse(exception);

      return { code: HTTP_STATUS_CODE[status] ?? 'REQUEST_FAILED', message, details };
    }

    if (exception instanceof GraphQLError) {
      const code = exception.extensions.code as string | undefined;

      return { code: code ?? 'INTERNAL_SERVER_ERROR', message: exception.message };
    }

    if (isPrismaError(exception)) {
      const mapped = PRISMA_CODE_MAP[exception.code];
      if (mapped) return mapped;
    }

    return { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' };
  }
}
