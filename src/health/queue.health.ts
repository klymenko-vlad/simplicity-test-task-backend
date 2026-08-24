import { getQueueToken } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { HealthIndicatorService } from '@nestjs/terminus';
import { Queue } from 'bullmq';

import { ALL_QUEUES } from '../queue/queue.constants';

@Injectable()
export class QueueHealthIndicator {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly indicator: HealthIndicatorService,
  ) {}

  async check(key: string, maxWaiting = 10_000) {
    const check = this.indicator.check(key);

    try {
      const perQueue = await Promise.all(
        ALL_QUEUES.map(async (name) => {
          const queue = this.moduleRef.get<Queue>(getQueueToken(name), { strict: false });
          const counts = await queue.getJobCounts('waiting', 'active', 'failed');

          return [name, counts] as const;
        }),
      );

      const details = Object.fromEntries(perQueue);
      const backlogged = perQueue.filter(([, counts]) => (counts.waiting ?? 0) > maxWaiting);

      return backlogged.length > 0
        ? check.down({
            ...details,
            message: `queue backlog above ${maxWaiting}: ${backlogged
              .map(([name]) => name)
              .join(', ')}`,
          })
        : check.up(details);
    } catch (error) {
      return check.down({ message: (error as Error).message });
    }
  }
}
