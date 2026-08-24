import { Injectable } from '@nestjs/common';

import type { NotificationJobName } from '../../../queue/jobs/notification.jobs';
import { QueueProducer } from '../../../queue/queue.producer';

export const UPCOMING_LEAD_MS = 30 * 60 * 1000;

const REMINDER_JOBS: NotificationJobName[] = [
  'announcement.upcoming',
  'announcement.published',
];

function jobId(announcementId: string, name: NotificationJobName): string {
  return `${name.replace('.', '-')}-${announcementId}`;
}

@Injectable()
export class AnnouncementRemindersScheduler {
  constructor(private readonly queue: QueueProducer) {}

  async onCreated(announcementId: string, publishedAt: Date): Promise<void> {
    await this.queue.enqueueNotification(
      'announcement.created',
      { announcementId },
      { jobId: jobId(announcementId, 'announcement.created') },
    );

    await this.scheduleReminders(announcementId, publishedAt);
  }

  async onRescheduled(announcementId: string, publishedAt: Date): Promise<void> {
    await this.cancelReminders(announcementId);
    await this.scheduleReminders(announcementId, publishedAt);
  }

  async onDeleted(announcementId: string): Promise<void> {
    await this.cancelReminders(announcementId);
    await this.queue.removeNotificationJob(jobId(announcementId, 'announcement.created'));
  }

  private async scheduleReminders(announcementId: string, publishedAt: Date): Promise<void> {
    await this.enqueueAt(
      'announcement.upcoming',
      announcementId,
      publishedAt.getTime() - UPCOMING_LEAD_MS,
    );
    await this.enqueueAt('announcement.published', announcementId, publishedAt.getTime());
  }

  private async enqueueAt(
    name: NotificationJobName,
    announcementId: string,
    at: number,
  ): Promise<void> {
    const delay = at - Date.now();
    if (delay <= 0) return;

    await this.queue.enqueueNotification(
      name,
      { announcementId },
      { delay, jobId: jobId(announcementId, name) },
    );
  }

  private async cancelReminders(announcementId: string): Promise<void> {
    await Promise.all(
      REMINDER_JOBS.map((name) =>
        this.queue.removeNotificationJob(jobId(announcementId, name)),
      ),
    );
  }
}
