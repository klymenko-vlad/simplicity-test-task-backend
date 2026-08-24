import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { QueueProducer } from '../../../queue/queue.producer';

import {
  AnnouncementRemindersScheduler,
  UPCOMING_LEAD_MS,
} from './announcement-reminders.scheduler';

const ANNOUNCEMENT_ID = '00000000-0000-4000-8000-000000000001';
const NOW = new Date('2026-01-01T12:00:00.000Z');

function setup() {
  const queue = {
    enqueueNotification: vi.fn().mockResolvedValue('job-id'),
    removeNotificationJob: vi.fn().mockResolvedValue(undefined),
  };

  return {
    queue,
    scheduler: new AnnouncementRemindersScheduler(queue as unknown as QueueProducer),
  };
}

type QueueMock = ReturnType<typeof setup>['queue'];

function jobNames(queue: QueueMock): string[] {
  return queue.enqueueNotification.mock.calls.map((call) => String(call[0]));
}

function removedIds(queue: QueueMock): string[] {
  return queue.removeNotificationJob.mock.calls.map((call) => String(call[0]));
}

function delayOf(queue: QueueMock, name: string): number | undefined {
  const call = queue.enqueueNotification.mock.calls.find(([jobName]) => jobName === name);

  return (call?.[2] as { delay?: number } | undefined)?.delay;
}

describe('AnnouncementRemindersScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it('queues the created notification immediately and both reminders ahead of publication', async () => {
    const { queue, scheduler } = setup();
    const publishedAt = new Date(NOW.getTime() + 2 * 60 * 60 * 1000);

    await scheduler.onCreated(ANNOUNCEMENT_ID, publishedAt);

    expect(queue.enqueueNotification).toHaveBeenCalledTimes(3);
    expect(delayOf(queue, 'announcement.created')).toBeUndefined();
    expect(delayOf(queue, 'announcement.upcoming')).toBe(2 * 60 * 60 * 1000 - UPCOMING_LEAD_MS);
    expect(delayOf(queue, 'announcement.published')).toBe(2 * 60 * 60 * 1000);
  });

  it('skips the 30-minute reminder when publication is already closer than that', async () => {
    const { queue, scheduler } = setup();

    await scheduler.onCreated(ANNOUNCEMENT_ID, new Date(NOW.getTime() + 10 * 60 * 1000));

    expect(jobNames(queue)).toEqual(['announcement.created', 'announcement.published']);
  });

  it('drops the pending reminders before queueing the new ones on reschedule', async () => {
    const { queue, scheduler } = setup();

    await scheduler.onRescheduled(ANNOUNCEMENT_ID, new Date(NOW.getTime() + 60 * 60 * 1000));

    expect(removedIds(queue)).toEqual([
      `announcement-upcoming-${ANNOUNCEMENT_ID}`,
      `announcement-published-${ANNOUNCEMENT_ID}`,
    ]);
    expect(queue.enqueueNotification).toHaveBeenCalledTimes(2);
  });

  it('queues nothing for a publication date in the past', async () => {
    const { queue, scheduler } = setup();

    await scheduler.onRescheduled(ANNOUNCEMENT_ID, new Date(NOW.getTime() - 1_000));

    expect(queue.enqueueNotification).not.toHaveBeenCalled();
  });

  it('removes every queued job when the announcement is deleted', async () => {
    const { queue, scheduler } = setup();

    await scheduler.onDeleted(ANNOUNCEMENT_ID);

    expect(removedIds(queue)).toEqual([
      `announcement-upcoming-${ANNOUNCEMENT_ID}`,
      `announcement-published-${ANNOUNCEMENT_ID}`,
      `announcement-created-${ANNOUNCEMENT_ID}`,
    ]);
  });
});
