import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';

import { AnnouncementsResolver } from './api/announcements.resolver';
import { AnnouncementRemindersScheduler } from './application/announcement-reminders.scheduler';
import { AnnouncementsService } from './application/announcements.service';
import { AnnouncementsRepository } from './persistence/announcements.repository';
import { CategoriesRepository } from './persistence/categories.repository';

@Module({
  imports: [NotificationsModule],
  providers: [
    AnnouncementsService,
    AnnouncementsRepository,
    CategoriesRepository,
    AnnouncementsResolver,
    AnnouncementRemindersScheduler,
  ],
  exports: [AnnouncementsRepository],
})
export class AnnouncementsModule {}
