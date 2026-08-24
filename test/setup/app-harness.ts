import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import { createApp } from '../../src/bootstrap';
import type { Database } from '../../src/database/database.tokens';
import { PrismaService } from '../../src/database/prisma.service';

export interface GraphQLResponse {
  statusCode: number;
  data?: Record<string, unknown>;
  errors?: { message: string; extensions?: Record<string, unknown> }[];
}

export interface TestHarness {
  app: NestFastifyApplication;
  db: Database;
  graphql: (
    query: string,
    variables?: Record<string, unknown>,
    headers?: Record<string, string>,
  ) => Promise<GraphQLResponse>;
  truncateAll: () => Promise<void>;
  close: () => Promise<void>;
}

export async function createTestHarness(): Promise<TestHarness> {
  const app = await createApp();
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const db = app.get(PrismaService);

  const truncateAll = async (): Promise<void> => {
    const rows = await db.$queryRaw<{ tablename: string }[]>`
      select tablename from pg_tables
      where schemaname = 'public' and tablename not like '_prisma%'
    `;
    if (rows.length === 0) return;

    const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
    await db.$executeRawUnsafe(`truncate table ${list} restart identity cascade`);
  };

  const graphql: TestHarness['graphql'] = async (query, variables, headers = {}) => {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: { query, variables },
      headers: { 'content-type': 'application/json', ...headers },
    });

    const body: Omit<GraphQLResponse, 'statusCode'> = res.json();
    return { statusCode: res.statusCode, ...body };
  };

  return {
    app,
    db,
    graphql,
    truncateAll,
    close: () => app.close(),
  };
}
