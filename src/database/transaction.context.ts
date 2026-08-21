import { AsyncLocalStorage } from 'node:async_hooks';

import { Prisma } from '@prisma/client';

import type { Database, Transaction } from './database.tokens';

export type IsolationLevel = 'read committed' | 'repeatable read' | 'serializable';

export interface TransactionOptions {
  isolationLevel?: IsolationLevel;
  readOnly?: boolean;
}

const storage = new AsyncLocalStorage<Transaction>();

export function currentTransaction(): Transaction | undefined {
  return storage.getStore();
}

const ISOLATION_LEVELS: Record<IsolationLevel, Prisma.TransactionIsolationLevel> = {
  'read committed': Prisma.TransactionIsolationLevel.ReadCommitted,
  'repeatable read': Prisma.TransactionIsolationLevel.RepeatableRead,
  serializable: Prisma.TransactionIsolationLevel.Serializable,
};

export async function runInTransaction<T>(
  db: Database,
  fn: (tx: Transaction) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const ambient = storage.getStore();
  if (ambient) return fn(ambient);

  return db.$transaction(
    async (tx) => {
      if (options.readOnly) {
        await tx.$executeRawUnsafe('set transaction read only');
      }

      return storage.run(tx, () => fn(tx));
    },
    options.isolationLevel
      ? { isolationLevel: ISOLATION_LEVELS[options.isolationLevel] }
      : undefined,
  );
}
