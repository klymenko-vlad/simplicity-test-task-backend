import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';

import { AnnouncementRemindersScheduler } from './announcement-reminders.scheduler';
import { AnnouncementsRepository } from './announcements.repository';
import { AnnouncementsResolver } from './announcements.resolver';
import { AnnouncementsService } from './announcements.service';
import { CategoriesRepository } from './categories.repository';

@Module({
  imports: [NotificationsModule],
  providers: [
    AnnouncementsService,
    AnnouncementsRepository,
    CategoriesRepository,
    AnnouncementsResolver,
    AnnouncementRemindersScheduler,
  ],
  exports: [AnnouncementsService, AnnouncementsRepository, CategoriesRepository],
})
export class AnnouncementsModule {}
