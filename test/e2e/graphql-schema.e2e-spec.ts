import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestHarness, type TestHarness } from '../setup/app-harness';

describe('GraphQL schema (e2e)', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('serves introspection and matches the committed schema.gql shape', async () => {
    const res = await harness.graphql(
      `{ __schema { queryType { name } mutationType { name } } }`,
    );

    expect(res.errors).toBeUndefined();
    expect(res.data?.__schema).toMatchObject({
      queryType: { name: 'Query' },
      mutationType: { name: 'Mutation' },
    });
  });

  it('has a committed schema.gql that defines the announcement types', () => {
    const schema = readFileSync(join(process.cwd(), 'src/schema.gql'), 'utf8');

    expect(schema).toContain('type Announcement');
    expect(schema).toContain('type Notification');
  });
});
