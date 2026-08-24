import type { AppConfigService } from '../../config/app-config.service';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/** Structural, so it satisfies ioredis, mqemitter-redis and BullMQ alike. */
export interface RedisConnectionOptions {
  host: string;
  port: number;
  password: string | undefined;
  db: number;
  tls: Record<string, never> | undefined;
}

export function redisOptions(config: AppConfigService): RedisConnectionOptions {
  const { host, port, password, db, tls } = config.redis;

  return { host, port, password, db, tls: tls ? {} : undefined };
}
