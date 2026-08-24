import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createTestHarness, type TestHarness } from '../setup/app-harness';

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
  query List($pagination: PaginationInput) {
    announcements(pagination: $pagination) { total items { id title } }
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
});
