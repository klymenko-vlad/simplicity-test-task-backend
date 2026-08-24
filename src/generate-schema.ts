import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { GraphQLSchemaBuilderModule, GraphQLSchemaFactory } from '@nestjs/graphql';
import { lexicographicSortSchema, printSchema } from 'graphql';

import { AnnouncementsResolver } from './modules/announcements/api/announcements.resolver';
import { NotificationsResolver } from './modules/notifications/notifications.resolver';

const SCHEMA_PATH = resolve(process.cwd(), 'src/schema.gql');
const GENERATED_HEADER = [
  '# ------------------------------------------------------',
  '# THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY)',
  '# ------------------------------------------------------',
].join('\n');

async function main(): Promise<void> {
  const context = await NestFactory.createApplicationContext(GraphQLSchemaBuilderModule, {
    logger: false,
  });

  try {
    const schemaFactory = context.get(GraphQLSchemaFactory);
    const schema = await schemaFactory.create([AnnouncementsResolver, NotificationsResolver]);

    await writeFile(
      SCHEMA_PATH,
      `${GENERATED_HEADER}\n\n${printSchema(lexicographicSortSchema(schema))}`,
    );
  } finally {
    await context.close();
  }

  console.log('schema.gql written to src/schema.gql');
}

main().catch((error: unknown) => {
  console.error('failed to generate GraphQL schema', error);
  process.exit(1);
});
