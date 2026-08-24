import { Injectable } from '@nestjs/common';
import type { Notification, NotificationKind } from '@prisma/client';

import type { Transaction } from '../../database/database.tokens';
import { writeOutboxEvent } from '../../database/outbox';
import { TransactionHost } from '../../database/transaction.host';

export interface NotificationInput {
  announcementId: string;
  kind: NotificationKind;
  title: string;
  publishedAt: Date;
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly txHost: TransactionHost) {}

  transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.txHost.run(fn);
  }

  findRecent(limit: number): Promise<Notification[]> {
    return this.txHost.reader().notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  countUnread(): Promise<number> {
    return this.txHost.reader().notification.count({ where: { readAt: null } });
  }

  upsert(input: NotificationInput, tx: Transaction): Promise<Notification> {
    return tx.notification.upsert({
      where: {
        announcementId_kind: { announcementId: input.announcementId, kind: input.kind },
      },
      create: input,
      update: { title: input.title, publishedAt: input.publishedAt, readAt: null },
    });
  }

  async markRead(ids?: string[]): Promise<number> {
    if (ids?.length === 0) return 0;

    const { count } = await this.txHost.client().notification.updateMany({
      where: { readAt: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });

    return count;
  }

  async deleteForAnnouncement(announcementId: string, tx?: Transaction): Promise<number> {
    const { count } = await this.txHost
      .client(tx)
      .notification.deleteMany({ where: { announcementId } });

    return count;
  }

  createOutboxEvent(notification: Notification, tx: Transaction): Promise<unknown> {
    return writeOutboxEvent(
      tx,
      'notification',
      notification.announcementId,
      notification.kind,
      {
        id: notification.id,
        announcementId: notification.announcementId,
        kind: notification.kind,
        title: notification.title,
        publishedAt: notification.publishedAt.toISOString(),
        createdAt: notification.createdAt.toISOString(),
      },
    );
  }
}
