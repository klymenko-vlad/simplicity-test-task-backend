import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  createTestHarness,
  type GraphQLResponse,
  type TestHarness,
} from '../setup/app-harness';

const CREATE = `
  mutation Create($input: CreateAnnouncementInput!) {
    createAnnouncement(input: $input) {
      id
      title
      content
      publishedAt
      categories { id name }
    }
  }
`;

const UPDATE = `
  mutation Update($id: ID!, $input: UpdateAnnouncementInput!) {
    updateAnnouncement(id: $id, input: $input) { id title publishedAt categories { id } }
  }
`;

const DELETE = `mutation Delete($id: ID!) { deleteAnnouncement(id: $id) }`;

const LIST = `
  query List($pagination: PaginationInput, $filter: AnnouncementFilterInput) {
    announcements(pagination: $pagination, filter: $filter) { total items { id title } }
  }
`;

const ONE = `query One($id: ID!) { announcement(id: $id) { id title } }`;

function inDays(days: number, hours = 12): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const pad = (value: number): string => String(value).padStart(2, '0');

  return `${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}/${String(
    date.getUTCFullYear(),
  )} ${pad(hours)}:00`;
}

describe('Announcements (e2e)', () => {
  let harness: TestHarness;
  let categoryId: string;

  beforeAll(async () => {
    harness = await createTestHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  afterEach(async () => {
    await harness.truncateAll();
  });

  async function seedCategory(): Promise<string> {
    const category = await harness.db.category.create({
      data: { name: 'City', slug: `city-${randomUUID()}` },
    });

    return category.id;
  }

  async function createAnnouncement(overrides: Record<string, unknown> = {}) {
    categoryId = await seedCategory();

    return harness.graphql(CREATE, {
      input: {
        title: 'Street closure notice',
        content: 'Main street is closed for maintenance this weekend.',
        publishedAt: inDays(2),
        categoryIds: [categoryId],
        ...overrides,
      },
    });
  }

  it('creates an announcement and returns it in the list', async () => {
    const created = await createAnnouncement();
    expect(created.errors).toBeUndefined();

    const list = await harness.graphql(LIST);
    expect(list.data?.announcements).toMatchObject({
      total: 1,
      items: [{ title: 'Street closure notice' }],
    });
  });

  it('writes a created outbox event in the same transaction', async () => {
    const created = await createAnnouncement();
    const id = (created.data?.createAnnouncement as { id: string }).id;

    const events = await harness.db.outboxEvent.findMany({ where: { aggregateId: id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      aggregateType: 'announcement',
      eventType: 'created',
      processedAt: null,
      attempts: 0,
    });
  });

  it('round-trips publishedAt without shifting the instant', async () => {
    const publishedAt = inDays(3, 9);
    const created = await createAnnouncement({ publishedAt });

    const stored = (created.data?.createAnnouncement as { publishedAt: string }).publishedAt;
    const [month, day, year, hours, minutes] = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/
      .exec(publishedAt)!
      .slice(1);

    expect(new Date(stored).toISOString()).toBe(
      `${year}-${month}-${day}T${hours}:${minutes}:00.000Z`,
    );
  });

  it('rejects a title shorter than the backend minimum with a field-level message', async () => {
    const created = await createAnnouncement({ title: 'ab' });

    expect(created.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
    expect(created.errors?.[0]?.message).toMatch(/title/i);
  });

  it('rejects a publication date in the past', async () => {
    const created = await createAnnouncement({ publishedAt: inDays(-2) });

    expect(created.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('rejects a malformed id with a user error rather than an internal one', async () => {
    const found = await harness.graphql(ONE, { id: 'not-a-uuid' });

    expect(found.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('reports a missing announcement as NOT_FOUND', async () => {
    const found = await harness.graphql(ONE, { id: randomUUID() });

    expect(found.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('updates title and categories', async () => {
    const created = await createAnnouncement();
    const id = (created.data?.createAnnouncement as { id: string }).id;
    const nextCategoryId = await seedCategory();

    const updated = await harness.graphql(UPDATE, {
      id,
      input: {
        title: 'Street closure cancelled',
        content: 'Maintenance has been postponed to a later date.',
        publishedAt: inDays(4),
        categoryIds: [nextCategoryId],
      },
    });

    expect(updated.errors).toBeUndefined();
    expect(updated.data?.updateAnnouncement).toMatchObject({
      title: 'Street closure cancelled',
      categories: [{ id: nextCategoryId }],
    });
  });

  it('refuses to update a deleted announcement', async () => {
    const created = await createAnnouncement();
    const id = (created.data?.createAnnouncement as { id: string }).id;

    await harness.graphql(DELETE, { id });

    const updated = await harness.graphql(UPDATE, {
      id,
      input: {
        title: 'Resurrected announcement',
        content: 'This must not bring the row back.',
        publishedAt: inDays(5),
        categoryIds: [categoryId],
      },
    });

    expect(updated.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('soft deletes, hides the row from the list, and emits one deleted event', async () => {
    const created = await createAnnouncement();
    const id = (created.data?.createAnnouncement as { id: string }).id;

    const deleted = await harness.graphql(DELETE, { id });
    expect(deleted.data?.deleteAnnouncement).toBe(true);

    const list = await harness.graphql(LIST);
    expect(list.data?.announcements).toMatchObject({ total: 0, items: [] });

    const row = await harness.db.announcement.findUnique({ where: { id } });
    expect(row?.deletedAt).not.toBeNull();

    const events = await harness.db.outboxEvent.findMany({
      where: { aggregateId: id, eventType: 'deleted' },
    });
    expect(events).toHaveLength(1);
  });

  it('reports a second delete as NOT_FOUND instead of succeeding twice', async () => {
    const created = await createAnnouncement();
    const id = (created.data?.createAnnouncement as { id: string }).id;

    await harness.graphql(DELETE, { id });
    const again = await harness.graphql(DELETE, { id });

    expect(again.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('honours the requested sort field and direction', async () => {
    categoryId = await seedCategory();

    for (const [title, days] of [
      ['Later', 9],
      ['Sooner', 3],
    ] as const) {
      await harness.graphql(CREATE, {
        input: {
          title,
          content: 'Content long enough to pass validation.',
          publishedAt: inDays(days),
          categoryIds: [categoryId],
        },
      });
    }

    const ascending = await harness.graphql(LIST, {
      pagination: { sortBy: 'publishedAt', order: 'asc' },
    });

    expect(
      (ascending.data?.announcements as { items: { title: string }[] }).items.map(
        (item) => item.title,
      ),
    ).toEqual(['Sooner', 'Later']);
  });

  it('rejects an unknown sort field', async () => {
    const list = await harness.graphql(LIST, { pagination: { sortBy: 'password' } });

    expect(list.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  describe('filtering', () => {
    async function seedForFiltering(): Promise<{ roads: string; parks: string }> {
      const roads = await seedCategory();
      const parks = await seedCategory();

      const rows = [
        { title: 'Road closure downtown', content: 'Detours are in place.', ids: [roads] },
        { title: 'Park cleanup day', content: 'Volunteers welcome downtown.', ids: [parks] },
        {
          title: 'Winter service plan',
          content: 'Snow ploughs are ready.',
          ids: [roads, parks],
        },
      ];

      for (const [index, row] of rows.entries()) {
        const created = await harness.graphql(CREATE, {
          input: {
            title: row.title,
            content: row.content,
            publishedAt: inDays(index + 1),
            categoryIds: row.ids,
          },
        });
        expect(created.errors).toBeUndefined();
      }

      return { roads, parks };
    }

    function titles(result: GraphQLResponse): string[] {
      return (result.data?.announcements as { items: { title: string }[] }).items
        .map((item) => item.title)
        .sort();
    }

    it('returns only announcements in the requested category', async () => {
      const { parks } = await seedForFiltering();

      const list = await harness.graphql(LIST, { filter: { categoryIds: [parks] } });

      expect(list.errors).toBeUndefined();
      expect((list.data?.announcements as { total: number }).total).toBe(2);
      expect(titles(list)).toEqual(['Park cleanup day', 'Winter service plan']);
    });

    it('matches any of several categories rather than requiring all of them', async () => {
      const { roads, parks } = await seedForFiltering();

      const list = await harness.graphql(LIST, {
        filter: { categoryIds: [roads, parks] },
      });

      expect((list.data?.announcements as { total: number }).total).toBe(3);
    });

    it('searches title and content case-insensitively', async () => {
      await seedForFiltering();

      const list = await harness.graphql(LIST, { filter: { search: 'DOWNTOWN' } });

      expect(titles(list)).toEqual(['Park cleanup day', 'Road closure downtown']);
    });

    it('combines search and category filters', async () => {
      const { roads } = await seedForFiltering();

      const list = await harness.graphql(LIST, {
        filter: { categoryIds: [roads], search: 'downtown' },
      });

      expect(titles(list)).toEqual(['Road closure downtown']);
    });

    it('treats LIKE wildcards in the search term as literal characters', async () => {
      await seedForFiltering();

      const list = await harness.graphql(LIST, { filter: { search: '%' } });

      expect((list.data?.announcements as { total: number }).total).toBe(0);
    });

    it('ignores a blank search term', async () => {
      await seedForFiltering();

      const list = await harness.graphql(LIST, { filter: { search: '   ' } });

      expect((list.data?.announcements as { total: number }).total).toBe(3);
    });

    it('never returns soft-deleted announcements through a filter', async () => {
      const { roads } = await seedForFiltering();
      const all = await harness.graphql(LIST, { filter: { categoryIds: [roads] } });
      const id = (all.data?.announcements as { items: { id: string }[] }).items[0]!.id;

      await harness.graphql(DELETE, { id });

      const list = await harness.graphql(LIST, { filter: { categoryIds: [roads] } });
      expect((list.data?.announcements as { total: number }).total).toBe(1);
    });

    it('rejects a malformed category id', async () => {
      const list = await harness.graphql(LIST, {
        filter: { categoryIds: ['not-a-uuid'] },
      });

      expect(list.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
    });
  });
});
