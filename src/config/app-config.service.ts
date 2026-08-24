import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppRole, Env } from './env.schema';

interface HttpConfig {
  readonly port: number;
  readonly host: string;
  readonly apiPrefix: string;
  readonly requestTimeoutMs: number;
  readonly shutdownDrainMs: number;
  readonly corsOrigins: true | string[];
}

export interface DatabaseConfig {
  readonly url: string;
  readonly replicaUrl: string | undefined;
  readonly poolMax: number;
  readonly ssl: boolean;
  readonly statementTimeoutMs: number;
  readonly idleTransactionTimeoutMs: number;
}

interface RedisConfig {
  readonly host: string;
  readonly port: number;
  readonly password: string | undefined;
  readonly db: number;
  readonly tls: boolean;
}

interface QueueConfig {
  readonly prefix: string;
  readonly defaultAttempts: number;
  readonly defaultBackoffMs: number;
}

interface ThrottleConfig {
  readonly ttlMs: number;
  readonly limit: number;
}

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv(): Env['NODE_ENV'] {
    return this.config.get<Env['NODE_ENV']>('NODE_ENV');
  }

  get role(): AppRole {
    return this.config.get<AppRole>('ROLE');
  }

  get servesHttp(): boolean {
    return this.role !== 'worker';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get http(): HttpConfig {
    return {
      port: this.config.get<number>('PORT'),
      host: this.config.get<string>('HOST'),
      apiPrefix: this.config.get<string>('API_PREFIX'),
      requestTimeoutMs: this.config.get<number>('REQUEST_TIMEOUT_MS'),
      shutdownDrainMs: this.config.get<number>('SHUTDOWN_DRAIN_MS'),
      corsOrigins: this.parseOrigins(this.config.get<string>('CORS_ORIGINS')),
    };
  }

  get database(): DatabaseConfig {
    return {
      url: this.config.get<string>('DATABASE_URL'),
      replicaUrl: this.config.get<string | undefined>('DATABASE_URL_REPLICA'),
      poolMax: this.config.get<number>('DATABASE_POOL_MAX'),
      ssl: this.config.get<boolean>('DATABASE_SSL'),
      statementTimeoutMs: this.config.get<number>('DATABASE_STATEMENT_TIMEOUT_MS'),
      idleTransactionTimeoutMs: this.config.get<number>('DATABASE_IDLE_TX_TIMEOUT_MS'),
    };
  }

  get redis(): RedisConfig {
    return {
      host: this.config.get<string>('REDIS_HOST'),
      port: this.config.get<number>('REDIS_PORT'),
      password: this.config.get<string | undefined>('REDIS_PASSWORD'),
      db: this.config.get<number>('REDIS_DB'),
      tls: this.config.get<boolean>('REDIS_TLS'),
    };
  }

  get queue(): QueueConfig {
    return {
      prefix: this.config.get<string>('QUEUE_PREFIX'),
      defaultAttempts: this.config.get<number>('QUEUE_DEFAULT_ATTEMPTS'),
      defaultBackoffMs: this.config.get<number>('QUEUE_DEFAULT_BACKOFF_MS'),
    };
  }

  get throttle(): ThrottleConfig {
    return {
      ttlMs: this.config.get<number>('THROTTLE_TTL_MS'),
      limit: this.config.get<number>('THROTTLE_LIMIT'),
    };
  }

  get logging(): { readonly level: Env['LOG_LEVEL'] } {
    return { level: this.config.get<Env['LOG_LEVEL']>('LOG_LEVEL') };
  }

  get graphiqlEnabled(): boolean {
    return this.config.get<boolean>('GRAPHIQL_ENABLED');
  }

  private parseOrigins(raw: string): true | string[] {
    if (raw === '*') return true;

    return raw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
}
