import { Injectable } from '@nestjs/common';
import type { Announcement, Prisma } from '@prisma/client';

import type { Database, Transaction } from '../../database/database.tokens';
import { writeOutboxEvent } from '../../database/outbox';
import { BaseRepository } from '../../database/repository/base.repository';
import type { Delegate } from '../../database/repository/repository.types';
import { TransactionHost } from '../../database/transaction.host';

import type { AnnouncementWithCategories } from './announcement.entity';

const CATEGORIES_INCLUDE = { categories: { include: { category: true } } } as const;

export type AnnouncementSortField = 'publishedAt' | 'updatedAt' | 'createdAt' | 'title';

export interface AnnouncementData {
  title: string;
  content: string;
  publishedAt: Date;
}

@Injectable()
export class AnnouncementsRepository extends BaseRepository<Announcement> {
  constructor(txHost: TransactionHost) {
    super(
      txHost,
      (client: Database | Transaction) =>
        client.announcement as unknown as Delegate<Announcement>,
      'announcement',
    );
  }

  async findByIdWithCategories(
    id: string,
    tx?: Transaction,
    consistent = false,
  ): Promise<AnnouncementWithCategories | undefined> {
    const found = await this.reader(tx, { consistent }).announcement.findFirst({
      where: { id, deletedAt: null },
      include: CATEGORIES_INCLUDE,
    });

    return found ?? undefined;
  }

  async findPageWithCategories(
    limit: number,
    offset: number,
    sortBy: AnnouncementSortField,
    order: Prisma.SortOrder,
    tx?: Transaction,
  ): Promise<{ items: AnnouncementWithCategories[]; total: number }> {
    const client = this.reader(tx);
    const where = { deletedAt: null };

    const [items, total] = await Promise.all([
      client.announcement.findMany({
        where,
        include: CATEGORIES_INCLUDE,
        orderBy: { [sortBy]: order },
        take: limit,
        skip: offset,
      }),
      client.announcement.count({ where }),
    ]);

    return { items, total };
  }

  async createWithCategories(
    data: AnnouncementData,
    categoryIds: string[],
    tx: Transaction,
  ): Promise<AnnouncementWithCategories> {
    const created = await tx.announcement.create({ data });

    await this.replaceCategories(created.id, categoryIds, tx);
    await writeOutboxEvent(tx, 'announcement', created.id, 'created', {
      id: created.id,
      title: created.title,
    });

    return this.requireWithCategories(created.id, tx);
  }

  async updateWithCategories(
    id: string,
    data: AnnouncementData,
    categoryIds: string[],
    tx: Transaction,
  ): Promise<AnnouncementWithCategories | undefined> {
    const { count } = await tx.announcement.updateMany({
      where: { id, deletedAt: null },
      data,
    });
    if (count === 0) return undefined;

    await this.replaceCategories(id, categoryIds, tx);
    await writeOutboxEvent(tx, 'announcement', id, 'updated', { id });

    return this.requireWithCategories(id, tx);
  }

  async softDeleteWithOutbox(id: string, tx: Transaction): Promise<boolean> {
    const { count } = await tx.announcement.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0) return false;

    await writeOutboxEvent(tx, 'announcement', id, 'deleted', { id });

    return true;
  }

  private async replaceCategories(
    announcementId: string,
    categoryIds: string[],
    tx: Transaction,
  ): Promise<void> {
    await tx.announcementCategory.deleteMany({ where: { announcementId } });
    await tx.announcementCategory.createMany({
      data: categoryIds.map((categoryId) => ({ announcementId, categoryId })),
    });
  }

  private async requireWithCategories(
    id: string,
    tx: Transaction,
  ): Promise<AnnouncementWithCategories> {
    const found = await this.findByIdWithCategories(id, tx);
    if (!found) throw this.notFound(id);

    return found;
  }
}
