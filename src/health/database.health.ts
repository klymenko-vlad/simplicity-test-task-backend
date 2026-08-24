import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';

import { PrismaService } from '../database/prisma.service';

import { timedPing } from './timed-ping';

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly indicator: HealthIndicatorService,
  ) {}

  pingCheck<TKey extends string>(key: TKey, timeoutMs = 3_000) {
    return timedPing(
      this.indicator,
      key,
      'database',
      timeoutMs,
      () => this.prisma.$queryRaw`select 1`,
    );
  }
}
