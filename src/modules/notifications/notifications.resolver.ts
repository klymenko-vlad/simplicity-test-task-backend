import { ParseUUIDPipe } from '@nestjs/common';
import {
  Args,
  Context,
  ID,
  Int,
  Mutation,
  Query,
  Resolver,
  Subscription,
} from '@nestjs/graphql';

import { NOTIFICATION_CREATED_TOPIC } from '../../common/pubsub/pubsub.tokens';

import { NotificationFeedType, NotificationType } from './notification.entity';
import { NotificationsService } from './notifications.service';

interface NotificationEvent extends Omit<
  NotificationType,
  'publishedAt' | 'createdAt' | 'readAt'
> {
  publishedAt: string;
  createdAt: string;
}

interface MercuriusPubSub {
  subscribe(topic: string): Promise<AsyncIterable<NotificationEvent>>;
}

function toNotification(event: NotificationEvent): NotificationType {
  const notification = new NotificationType();

  notification.id = event.id;
  notification.announcementId = event.announcementId;
  notification.kind = event.kind;
  notification.title = event.title;
  notification.publishedAt = new Date(event.publishedAt);
  notification.createdAt = new Date(event.createdAt);

  return notification;
}

@Resolver(() => NotificationType)
export class NotificationsResolver {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Query(() => NotificationFeedType, { description: 'Recent notifications, newest first' })
  notifications(
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<NotificationFeedType> {
    return this.notificationsService.feed(limit ?? undefined);
  }

  @Mutation(() => Int, {
    description: 'Marks the given notifications read, or all when omitted',
  })
  markNotificationsRead(
    @Args(
      'ids',
      { type: () => [ID], nullable: true },
      new ParseUUIDPipe({ version: '4', optional: true }),
    )
    ids?: string[],
  ): Promise<number> {
    return this.notificationsService.markRead(ids);
  }

  @Subscription(() => NotificationType, {
    resolve: (payload: NotificationEvent) => toNotification(payload),
  })
  notificationCreated(
    @Context('pubsub') pubsub: MercuriusPubSub,
  ): Promise<AsyncIterable<NotificationEvent>> {
    return pubsub.subscribe(NOTIFICATION_CREATED_TOPIC);
  }
}
