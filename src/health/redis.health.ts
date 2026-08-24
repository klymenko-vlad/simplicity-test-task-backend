import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from '../common/redis/redis.tokens';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly indicator: HealthIndicatorService,
  ) {}

  async pingCheck(key: string, timeoutMs = 2_000) {
    const check = this.indicator.check(key);
    const startedAt = performance.now();

    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`redis ping exceeded ${timeoutMs}ms`));
      }, timeoutMs);
      timer.unref();
    });

    const ping = this.redis.ping();
    ping.catch(() => undefined);

    try {
      await Promise.race([ping, timeout]);
      return check.up({ responseTimeMs: Math.round(performance.now() - startedAt) });
    } catch (error) {
      return check.down({ message: (error as Error).message });
    } finally {
      clearTimeout(timer);
    }
  }
}
