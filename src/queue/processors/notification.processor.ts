import { Processor } from '@nestjs/bullmq';
import { NotificationKind } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';

import { AnnouncementsRepository } from '../../modules/announcements/persistence/announcements.repository';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { BaseProcessor } from '../base.processor';
import {
  notificationJobSchemas,
  type NotificationJobPayload,
  type NotificationJobSchemas,
} from '../jobs/notification.jobs';
import { QUEUES } from '../queue.constants';

@Processor(QUEUES.NOTIFICATIONS, { concurrency: 5 })
export class NotificationProcessor extends BaseProcessor<NotificationJobSchemas> {
  protected readonly schemas = notificationJobSchemas;

  protected readonly handlers = {
    'announcement.created': (payload: NotificationJobPayload<'announcement.created'>) =>
      this.notify(payload.announcementId, NotificationKind.created),
    'announcement.upcoming': (payload: NotificationJobPayload<'announcement.upcoming'>) =>
      this.notify(payload.announcementId, NotificationKind.upcoming),
    'announcement.published': (payload: NotificationJobPayload<'announcement.published'>) =>
      this.notify(payload.announcementId, NotificationKind.published),
  };

  constructor(
    private readonly announcementsRepository: AnnouncementsRepository,
    private readonly notificationsService: NotificationsService,
    logger: PinoLogger,
  ) {
    super(logger);
  }

  private async notify(announcementId: string, kind: NotificationKind): Promise<void> {
    const announcement = await this.announcementsRepository.findByIdWithCategories(
      announcementId,
      undefined,
      true,
    );

    if (!announcement) {
      this.logger.debug(
        { announcementId, kind },
        'skipping notification for missing announcement',
      );

      return;
    }

    await this.notificationsService.record({
      announcementId,
      kind,
      title: announcement.title,
      publishedAt: announcement.publishedAt,
    });
  }
}
