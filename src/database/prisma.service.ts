import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { AppConfigService } from '../config/app-config.service';
import type { DatabaseConfig } from '../config/app-config.service';

function connectionUrl(database: DatabaseConfig, url: string): string {
  const parsed = new URL(url);
  const params = parsed.searchParams;

  params.set('connection_limit', String(database.poolMax));
  params.set('statement_timeout', String(database.statementTimeoutMs));
  params.set('idle_in_transaction_session_timeout', String(database.idleTransactionTimeoutMs));
  if (database.ssl) params.set('sslmode', 'require');

  return parsed.toString();
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: AppConfigService) {
    super({
      datasources: { db: { url: connectionUrl(config.database, config.database.url) } },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

@Injectable()
export class PrismaReadService extends PrismaClient implements OnModuleDestroy {
  constructor(config: AppConfigService) {
    const { database } = config;

    super({
      datasources: {
        db: { url: connectionUrl(database, database.replicaUrl ?? database.url) },
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
