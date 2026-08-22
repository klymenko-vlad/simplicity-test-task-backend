import type { RedisOptions } from 'ioredis';

import type { AppConfigService } from '../../config/app-config.service';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export function redisOptions(config: AppConfigService): RedisOptions {
  return {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
    tls: config.redis.tls ? {} : undefined,
  };
}
