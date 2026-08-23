import { z } from 'zod';

const announcementRef = z.object({ announcementId: z.uuid() });

export const notificationJobSchemas = {
  'announcement.created': announcementRef,
  'announcement.upcoming': announcementRef,
  'announcement.published': announcementRef,
} as const;

export type NotificationJobSchemas = typeof notificationJobSchemas;
export type NotificationJobName = keyof NotificationJobSchemas;
export type NotificationJobPayload<T extends NotificationJobName> = z.infer<
  NotificationJobSchemas[T]
>;
