import { Module } from '@nestjs/common';

import { NotificationsRepository } from './notifications.repository';
import { NotificationsResolver } from './notifications.resolver';
import { NotificationsService } from './notifications.service';

@Module({
  providers: [NotificationsService, NotificationsRepository, NotificationsResolver],
  exports: [NotificationsService],
})
export class NotificationsModule {}
