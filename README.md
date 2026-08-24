# backend

NestJS backend on Fastify with a GraphQL API (Mercurius, code-first schema).

## Stack

- NestJS 11 on Fastify
- GraphQL via `@nestjs/graphql` + `@nestjs/mercurius`, code-first — the schema is generated to
  `src/schema.gql` and committed, the GraphQL analogue of an OpenAPI document
- Prisma ORM + Postgres
- Redis: cache, distributed lock, rate-limit storage
- BullMQ background jobs, split into API/worker roles via `ROLE`
- `nestjs-pino` logging, `@nestjs/terminus` health checks
- `@nestjs/throttler` with Redis storage, split budgets for credential mutations vs. everything
  else
- `@nestjs/config` + `zod` env validation
- `argon2` password hashing, JWT access/refresh tokens with rotation and reuse detection
- Vitest (unit + e2e projects), Testcontainers for the e2e Postgres/Redis instances

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm docker:up          # Postgres + Redis
pnpm db:migrate
pnpm db:seed             # optional: admin@example.local / ada@example.local
pnpm start:dev
```

GraphiQL is available at `/graphql` in development (`GRAPHIQL_ENABLED=true`).

## Scripts

| Script                            | What it does                                                             |
| --------------------------------- | ------------------------------------------------------------------------ |
| `pnpm start:dev`                  | Run with hot reload                                                      |
| `pnpm build`                      | Compile to `dist/`                                                       |
| `pnpm lint` / `pnpm format:check` | Static checks                                                            |
| `pnpm typecheck`                  | `tsc --noEmit`                                                           |
| `pnpm test` / `pnpm test:cov`     | Unit tests                                                               |
| `pnpm test:e2e`                   | e2e tests (spins up Postgres/Redis via Testcontainers — requires Docker) |
| `pnpm graphql:generate`           | Regenerate `src/schema.gql` from resolver metadata (no services needed)  |
| `pnpm graphql:check`              | Regenerate and fail if `src/schema.gql` is stale                         |
| `pnpm db:generate`                | Generate a Prisma Client from the schema                                 |
| `pnpm db:migrate`                 | Apply migrations                                                         |
| `pnpm verify`                     | lint + typecheck + test:cov + build + graphql:check                      |

## Scope decisions

The task ships no login screen, so authentication was removed rather than half-built: every
GraphQL operation is public. Anything deployed beyond a review environment needs an auth layer
in front of the mutations first.

The only REST surface is `/health/*`; everything else is `/graphql`.

`publishedAt` travels as `MM/DD/YYYY HH:mm` and is interpreted as a UTC wall clock on both
sides, so the value a user types is the value they read back regardless of their timezone.

## Announcements

`announcements` is the domain module: Prisma model → repository → service → GraphQL resolver.

| Operation                       | Kind         | Notes                                   |
| ------------------------------- | ------------ | --------------------------------------- |
| `announcements(pagination)`     | query        | Newest update first                     |
| `announcement(id)`              | query        | Single announcement with its categories |
| `categories`                    | query        | Seeded category list                    |
| `createAnnouncement(input)`     | mutation     | `publishedAt` is `MM/DD/YYYY HH:mm`     |
| `updateAnnouncement(id, input)` | mutation     |                                         |
| `deleteAnnouncement(id)`        | mutation     | Soft delete                             |
| `announcementChanged`           | subscription | Cache invalidation feed for the client  |

## Notifications

In-app notifications are pushed over the GraphQL subscription WebSocket. Three moments produce
one `notifications` row each — the `(announcement, kind)` pair is unique, so a job retry
re-emits instead of duplicating:

| Kind        | Fires                                  |
| ----------- | -------------------------------------- |
| `created`   | Right after an announcement is created |
| `upcoming`  | 30 minutes before `publishedAt`        |
| `published` | At `publishedAt`                       |

The two timed ones are BullMQ delayed jobs on the `notifications` queue with deterministic ids
(`announcement-upcoming-<id>`), so moving the publication date reschedules them and deleting the
announcement cancels them. The worker writes the row and an outbox event in one transaction; the
outbox dispatcher publishes it to Redis, and every connected client receives it — the socket only
ever announces committed rows.

| Operation                    | Kind         | Notes                              |
| ---------------------------- | ------------ | ---------------------------------- |
| `notifications(limit)`       | query        | Recent feed + `unreadCount`        |
| `markNotificationsRead(ids)` | mutation     | Omit `ids` to mark everything read |
| `notificationCreated`        | subscription | Live push behind the bell menu     |

### Testing it

Open GraphiQL at `/graphql`, run the subscription in one tab:

```graphql
subscription {
  notificationCreated {
    id
    kind
    title
    publishedAt
  }
}
```

then create an announcement in another tab. The `created` event arrives immediately; set
`publishedAt` ~31 minutes ahead to watch `upcoming` and `published` land on schedule. From the
CLI the same works over `wscat -c ws://localhost:3000/graphql -s graphql-transport-ws`.

## Example module

`announcements` demonstrates the full chain: Prisma model → repository → service → GraphQL
resolver → e2e test hitting `/graphql`.
