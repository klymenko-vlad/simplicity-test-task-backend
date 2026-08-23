import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { NotificationKind } from '@prisma/client';
import type { Notification } from '@prisma/client';

registerEnumType(NotificationKind, { name: 'NotificationKind' });

@ObjectType('Notification')
export class NotificationType {
  @Field(() => ID) id!: string;
  @Field(() => ID) announcementId!: string;
  @Field(() => NotificationKind) kind!: NotificationKind;
  @Field() title!: string;
  @Field() publishedAt!: Date;
  @Field({ nullable: true }) readAt?: Date;
  @Field() createdAt!: Date;

  static fromEntity(notification: Notification): NotificationType {
    const dto = new NotificationType();

    dto.id = notification.id;
    dto.announcementId = notification.announcementId;
    dto.kind = notification.kind;
    dto.title = notification.title;
    dto.publishedAt = notification.publishedAt;
    dto.readAt = notification.readAt ?? undefined;
    dto.createdAt = notification.createdAt;

    return dto;
  }
}

@ObjectType('NotificationFeed')
export class NotificationFeedType {
  @Field(() => [NotificationType]) items!: NotificationType[];
  @Field(() => Int) unreadCount!: number;
}
