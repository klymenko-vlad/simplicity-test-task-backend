import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from '../common/redis/redis.tokens';

import { timedPing } from './timed-ping';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly indicator: HealthIndicatorService,
  ) {}

  pingCheck<TKey extends string>(key: TKey, timeoutMs = 2_000) {
    return timedPing(this.indicator, key, 'redis', timeoutMs, () => this.redis.ping());
  }
}
