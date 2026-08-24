# Simplicity Fullstack Task — Backend

NestJS backend for managing city announcements. The application exposes a GraphQL API for
announcement CRUD, categories, and real-time in-app notifications.

## Features

- Create, read, update, and soft-delete announcements
- Assign one or more seeded categories to an announcement
- Paginated and sortable announcement list
- Live GraphQL subscriptions for announcement changes
- Immediate, upcoming, and published in-app notifications
- PostgreSQL persistence through Prisma
- Redis-backed subscriptions, rate limiting, and distributed locks
- BullMQ jobs for scheduled notifications
- Liveness, readiness, and full health endpoints

> **Assignment gap:** category assignment is implemented, but server-side filtering by category
> and text search across an announcement's title and content are not currently exposed by the
> GraphQL schema. The `announcements` query currently supports pagination and sorting.

## Technology

- Node.js 22 and TypeScript
- NestJS 11 with Fastify
- GraphQL with Mercurius
- Prisma and PostgreSQL
- Redis and BullMQ
- Vitest and Testcontainers

## Requirements

- Node.js 22 or newer
- pnpm 10 or newer
- Docker with Docker Compose

## Running locally

```bash
pnpm install
cp .env.example .env
pnpm docker:up
pnpm db:migrate
pnpm db:seed
pnpm start:dev
```

The seed command creates the available categories and one sample announcement. It is safe to run
more than once in a development environment.

With the default `.env.example` configuration, the backend runs at
`http://localhost:3001` and GraphQL is available at `http://localhost:3001/graphql`.

To stop the infrastructure:

```bash
pnpm docker:down
```

## API documentation: GraphiQL instead of Swagger

This project does not use Swagger. Swagger/OpenAPI is intended primarily for REST APIs, while the
application API is GraphQL. Its equivalent sources of documentation are:

- **GraphiQL:** interactive documentation and request runner at
  `http://localhost:3001/graphiql` in development
- **Generated schema:** [`src/schema.gql`](src/schema.gql)

GraphiQL is enabled by `GRAPHIQL_ENABLED=true` in the development environment and is disabled in
production.

## Available endpoints

| Method | Path            | Purpose                                            |
| ------ | --------------- | -------------------------------------------------- |
| `GET`  | `/graphiql`     | GraphiQL interface in development                  |
| `POST` | `/graphql`      | GraphQL queries and mutations                      |
| `WS`   | `/graphql`      | Subscriptions using `graphql-transport-ws`         |
| `GET`  | `/health/live`  | Process liveness                                   |
| `GET`  | `/health/ready` | PostgreSQL and Redis readiness                     |
| `GET`  | `/health`       | Database, Redis, queues, and process-memory health |

All GraphQL operations are public because the supplied task has no authentication flow.

### GraphQL operations

| Operation                       | Type         | Description                                      |
| ------------------------------- | ------------ | ------------------------------------------------ |
| `announcements(pagination)`     | Query        | Paginated and sorted announcement list           |
| `announcement(id)`              | Query        | One announcement with its categories             |
| `categories`                    | Query        | All seeded categories                            |
| `notifications(limit)`          | Query        | Recent notifications and unread count            |
| `createAnnouncement(input)`     | Mutation     | Create an announcement                           |
| `updateAnnouncement(id, input)` | Mutation     | Replace announcement values and categories       |
| `deleteAnnouncement(id)`        | Mutation     | Soft-delete an announcement                      |
| `markNotificationsRead(ids)`    | Mutation     | Mark selected notifications, or all when omitted |
| `announcementChanged`           | Subscription | Announcement create/update/delete events         |
| `notificationCreated`           | Subscription | New in-app notifications                         |

`publishedAt` mutation input uses `MM/DD/YYYY HH:mm` and is interpreted as a UTC wall-clock value.

## Testing manually with GraphiQL

GraphiQL is the preferred manual testing interface because it provides schema documentation,
autocomplete, validation, variables, and subscription support in the browser.

1. Start the backend using the local setup above.
2. Open `http://localhost:3001/graphiql`.
3. Run this query to obtain valid category IDs:

```graphql
query Categories {
  categories {
    id
    name
    slug
  }
}
```

4. Copy a category ID and create an announcement. The publication time must be in the future:

```graphql
mutation CreateAnnouncement($input: CreateAnnouncementInput!) {
  createAnnouncement(input: $input) {
    id
    title
    content
    publishedAt
    categories {
      id
      name
    }
  }
}
```

Use the **Variables** panel:

```json
{
  "input": {
    "title": "Community cleanup",
    "content": "Meet at the town hall at 09:00.",
    "publishedAt": "08/25/2026 09:00",
    "categoryIds": ["PASTE-A-CATEGORY-UUID-HERE"]
  }
}
```

5. List announcements:

```graphql
query Announcements($pagination: PaginationInput) {
  announcements(pagination: $pagination) {
    total
    items {
      id
      title
      content
      publishedAt
      updatedAt
      categories {
        id
        name
      }
    }
  }
}
```

Variables:

```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "sortBy": "updatedAt",
    "order": "desc"
  }
}
```

Supported `sortBy` values are `publishedAt`, `updatedAt`, `createdAt`, and `title`. The `order`
value can be `asc` or `desc`.

### Testing live notifications

Open a second GraphiQL tab and start this subscription:

```graphql
subscription NotificationCreated {
  notificationCreated {
    id
    announcementId
    kind
    title
    publishedAt
    createdAt
  }
}
```

Create an announcement in the first tab. A `created` notification should appear immediately in
the subscription tab. The application also schedules an `upcoming` notification 30 minutes before
publication and a `published` notification at the publication time.

## Testing with Postman

Postman can test the same GraphQL queries and mutations over HTTP:

1. Create a new request and select `POST`.
2. Use `http://localhost:3001/graphql` as the URL.
3. Open **Body**, select **GraphQL**, and paste a query or mutation into the query field.
4. Paste its JSON variables into the **GraphQL Variables** field.
5. Send the request. No authorization header is required.

For example, list the categories with:

```graphql
query Categories {
  categories {
    id
    name
    slug
  }
}
```

For a raw JSON request instead of Postman's GraphQL editor, set
`Content-Type: application/json` and use:

```json
{
  "query": "query Categories { categories { id name slug } }",
  "variables": {}
}
```

Use GraphiQL for subscriptions; its integrated client handles the GraphQL WebSocket protocol and
is simpler than configuring subscription protocol messages manually in Postman.

## Automated tests and quality checks

```bash
pnpm test
pnpm test:e2e
pnpm verify
```

- `pnpm test` runs unit tests.
- `pnpm test:e2e` runs GraphQL and health tests with disposable PostgreSQL and Redis containers;
  Docker must be running.
- `pnpm verify` runs linting, type checking, unit tests with coverage, the production build, and a
  generated-schema consistency check.

## Useful commands

| Command                 | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `pnpm start:dev`        | Start the backend with hot reload              |
| `pnpm build`            | Compile the production application             |
| `pnpm graphql:generate` | Regenerate `src/schema.gql`                    |
| `pnpm graphql:check`    | Fail when the committed schema is stale        |
| `pnpm db:migrate`       | Apply Prisma migrations                        |
| `pnpm db:seed`          | Seed categories and a sample announcement      |
| `pnpm db:studio`        | Open Prisma Studio                             |
| `pnpm docker:up`        | Start local PostgreSQL and Redis               |
| `pnpm docker:reset`     | Recreate local infrastructure and its data     |
| `pnpm lint`             | Run ESLint                                     |
| `pnpm typecheck`        | Run TypeScript checks without emitting files   |
| `pnpm test:cov`         | Run unit tests with coverage                   |
| `pnpm test:e2e`         | Run container-backed end-to-end tests          |
| `pnpm verify`           | Run the complete non-Docker verification suite |

## Architecture notes

The announcement flow is organized as GraphQL resolver → service → repository → Prisma. Domain
errors remain transport-independent and are converted to GraphQL errors with stable
`extensions.code` values.

Announcement mutations write an outbox event in the same database transaction as the domain
change. A BullMQ worker publishes committed events through Redis, allowing every API instance to
deliver consistent subscription updates. Scheduled notification jobs use deterministic IDs so
updates can reschedule them and deletions can cancel them safely.
