import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from './redis.tokens';

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

@Injectable()
export class DistributedLockService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async withLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T | undefined> {
    const token = randomUUID();
    const acquired = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
    if (acquired !== 'OK') return undefined;

    try {
      return await fn();
    } finally {
      await this.redis.eval(RELEASE_SCRIPT, 1, key, token);
    }
  }
}
