import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';

import {
  ANNOUNCEMENT_CHANGED_TOPIC,
  MQ_EMITTER,
  NOTIFICATION_CREATED_TOPIC,
  type MqEmitter,
} from '../../common/pubsub/pubsub.tokens';
import { DistributedLockService } from '../../common/redis/distributed-lock.service';
import { PrismaService } from '../../database/prisma.service';

const LOCK_KEY = 'outbox:dispatch';
const LOCK_TTL_MS = 30_000;
const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 5;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class OutboxProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lock: DistributedLockService,
    @Inject(MQ_EMITTER) private readonly emitter: MqEmitter,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(OutboxProcessor.name);
  }

  @Cron(CronExpression.EVERY_SECOND)
  async dispatch(): Promise<void> {
    await this.lock.withLock(LOCK_KEY, LOCK_TTL_MS, () => this.dispatchBatch());
  }

  @Cron(CronExpression.EVERY_HOUR)
  async prune(): Promise<void> {
    await this.lock.withLock('outbox:prune', LOCK_TTL_MS, async () => {
      const { count } = await this.prisma.outboxEvent.deleteMany({
        where: { processedAt: { lt: new Date(Date.now() - RETENTION_MS) } },
      });

      if (count > 0) this.logger.info({ count }, 'pruned processed outbox events');
    });
  }

  private async dispatchBatch(): Promise<void> {
    const events = await this.prisma.outboxEvent.findMany({
      where: { processedAt: null, failedAt: null },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    const dispatched: string[] = [];

    for (const event of events) {
      try {
        await this.publishEvent(event);
        dispatched.push(event.id);
      } catch (error) {
        await this.recordFailure(event.id, event.attempts, error);
      }
    }

    if (dispatched.length > 0) {
      await this.prisma.outboxEvent.updateMany({
        where: { id: { in: dispatched } },
        data: { processedAt: new Date() },
      });

      this.logger.debug({ count: dispatched.length }, 'dispatched outbox events');
    }
  }

  private publishEvent(event: {
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: unknown;
  }): Promise<void> {
    const payload = event.payload as Record<string, unknown>;

    if (event.aggregateType === 'announcement') {
      return this.publish({
        topic: ANNOUNCEMENT_CHANGED_TOPIC,
        payload: {
          ...payload,
          eventType: event.eventType,
          announcementId: event.aggregateId,
        },
      });
    }

    if (event.aggregateType === 'notification') {
      return this.publish({ topic: NOTIFICATION_CREATED_TOPIC, payload });
    }

    return Promise.reject(new Error(`unknown outbox aggregate "${event.aggregateType}"`));
  }

  private async recordFailure(id: string, attempts: number, error: unknown): Promise<void> {
    const nextAttempts = attempts + 1;
    const exhausted = nextAttempts >= MAX_ATTEMPTS;
    const message = error instanceof Error ? error.message : String(error);

    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        attempts: nextAttempts,
        lastError: message.slice(0, 1000),
        ...(exhausted ? { failedAt: new Date() } : {}),
      },
    });

    if (exhausted) {
      this.logger.error(
        { outboxEventId: id, attempts: nextAttempts, err: error },
        'outbox event dead-lettered after repeated publish failures',
      );
    } else {
      this.logger.warn(
        { outboxEventId: id, attempts: nextAttempts, err: error },
        'outbox event publish failed; will retry',
      );
    }
  }

  private publish(message: { topic: string; payload: Record<string, unknown> }): Promise<void> {
    return new Promise((resolve, reject) => {
      this.emitter.emit(message, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}
