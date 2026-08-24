import { Injectable } from '@nestjs/common';
import type { Category } from '@prisma/client';

import type { Transaction } from '../../../database/database.tokens';
import { TransactionHost } from '../../../database/transaction.host';

@Injectable()
export class CategoriesRepository {
  constructor(private readonly txHost: TransactionHost) {}

  findAllOrdered(tx?: Transaction): Promise<Category[]> {
    return this.txHost.reader(tx).category.findMany({ orderBy: { name: 'asc' } });
  }

  async allIdsExist(ids: string[], tx?: Transaction): Promise<boolean> {
    if (ids.length === 0) return false;

    const count = await this.txHost.reader(tx).category.count({ where: { id: { in: ids } } });

    return count === ids.length;
  }
}
