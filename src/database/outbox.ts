import type { Prisma } from '@prisma/client';

import type { Transaction } from './database.tokens';

export type OutboxAggregate = 'announcement' | 'notification';

export function writeOutboxEvent(
  tx: Transaction,
  aggregateType: OutboxAggregate,
  aggregateId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  return tx.outboxEvent.create({
    data: {
      aggregateType,
      aggregateId,
      eventType,
      payload: payload as Prisma.InputJsonValue,
    },
  });
}
