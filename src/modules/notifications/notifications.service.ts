import { Injectable } from '@nestjs/common';

import { InvalidInputError } from '../../common/errors/domain.error';

import { NotificationFeedType, NotificationType } from './notification.entity';
import { NotificationsRepository, type NotificationInput } from './notifications.repository';

const DEFAULT_FEED_LIMIT = 20;
const MAX_FEED_LIMIT = 100;
const MAX_MARK_READ_IDS = 200;

@Injectable()
export class NotificationsService {
  constructor(private readonly notificationsRepository: NotificationsRepository) {}

  async feed(limit = DEFAULT_FEED_LIMIT): Promise<NotificationFeedType> {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_FEED_LIMIT) {
      throw new InvalidInputError(
        'INVALID_FEED_LIMIT',
        `limit must be an integer between 1 and ${MAX_FEED_LIMIT}`,
      );
    }

    const [items, unreadCount] = await Promise.all([
      this.notificationsRepository.findRecent(limit),
      this.notificationsRepository.countUnread(),
    ]);

    const feed = new NotificationFeedType();
    feed.items = items.map((item) => NotificationType.fromEntity(item));
    feed.unreadCount = unreadCount;

    return feed;
  }

  async record(input: NotificationInput): Promise<NotificationType> {
    const created = await this.notificationsRepository.transaction(async (tx) => {
      const notification = await this.notificationsRepository.upsert(input, tx);
      await this.notificationsRepository.createOutboxEvent(notification, tx);

      return notification;
    });

    return NotificationType.fromEntity(created);
  }

  markRead(ids?: string[]): Promise<number> {
    if (ids && ids.length > MAX_MARK_READ_IDS) {
      throw new InvalidInputError(
        'TOO_MANY_IDS',
        `at most ${MAX_MARK_READ_IDS} ids can be marked read at once`,
      );
    }

    return this.notificationsRepository.markRead(ids ? [...new Set(ids)] : undefined);
  }

  discardForAnnouncement(announcementId: string): Promise<number> {
    return this.notificationsRepository.deleteForAnnouncement(announcementId);
  }
}
