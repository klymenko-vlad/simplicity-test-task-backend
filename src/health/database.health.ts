import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';

import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly indicator: HealthIndicatorService,
  ) {}

  async pingCheck(key: string, timeoutMs = 3_000) {
    const check = this.indicator.check(key);
    const startedAt = performance.now();

    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`database ping exceeded ${timeoutMs}ms`));
      }, timeoutMs);
      timer.unref();
    });

    const ping = this.prisma.$queryRaw`select 1`;
    ping.catch(() => undefined);

    try {
      await Promise.race([ping, timeout]);
      return check.up({ responseTimeMs: Math.round(performance.now() - startedAt) });
    } catch (error) {
      return check.down({ message: (error as Error).message });
    } finally {
      clearTimeout(timer);
    }
  }
}
