import { Module } from '@nestjs/common';

import { HealthModule } from './health/health.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [InfrastructureModule, HealthModule, AnnouncementsModule, NotificationsModule],
})
export class AppModule {}
