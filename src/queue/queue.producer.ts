import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { JobsOptions } from 'bullmq';

import {
  notificationJobSchemas,
  type NotificationJobName,
  type NotificationJobPayload,
} from './jobs/notification.jobs';
import { QUEUES } from './queue.constants';

@Injectable()
export class QueueProducer {
  constructor(@InjectQueue(QUEUES.NOTIFICATIONS) private readonly notificationsQueue: Queue) {}

  async enqueueNotification<TName extends NotificationJobName>(
    name: TName,
    payload: NotificationJobPayload<TName>,
    options?: JobsOptions,
  ): Promise<string> {
    const data = notificationJobSchemas[name].parse(payload);

    const job = await this.notificationsQueue.add(name, data, options);

    return job.id ?? '';
  }

  async removeNotificationJob(jobId: string): Promise<void> {
    await this.notificationsQueue.remove(jobId).catch(() => undefined);
  }
}
