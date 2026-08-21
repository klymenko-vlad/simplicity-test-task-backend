import { Injectable } from '@nestjs/common';

import { type Database, type Transaction } from './database.tokens';
import { PrismaReadService, PrismaService } from './prisma.service';
import {
  currentTransaction,
  runInTransaction,
  type TransactionOptions,
} from './transaction.context';

@Injectable()
export class TransactionHost {
  constructor(
    private readonly primary: PrismaService,
    private readonly readOnly: PrismaReadService,
  ) {}

  get db(): Database {
    return this.primary;
  }

  get current(): Transaction | undefined {
    return currentTransaction();
  }

  get isActive(): boolean {
    return currentTransaction() !== undefined;
  }

  client(tx?: Transaction): Database | Transaction {
    return tx ?? currentTransaction() ?? this.primary;
  }

  reader(tx?: Transaction, consistent = false): Database | Transaction {
    const ambient = tx ?? currentTransaction();
    if (ambient) return ambient;

    return consistent ? this.primary : this.readOnly;
  }

  run<T>(fn: (tx: Transaction) => Promise<T>, options?: TransactionOptions): Promise<T> {
    return runInTransaction(this.primary, fn, options);
  }
}

export type { TransactionOptions };
