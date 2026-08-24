# Agent notes

This is a GraphQL-first NestJS backend (Fastify + Mercurius, code-first schema). It mirrors the
infrastructure of a REST/Swagger sibling project, with the API-surface pieces swapped for their
GraphQL equivalents:

- `*.resolver.ts` instead of `*.controller.ts`; `@Query`/`@Mutation` instead of `@Get`/`@Post`.
- `@ObjectType` / `@InputType` GraphQL types instead of Swagger-decorated DTOs. `class-validator`
  still runs on every input type via the global `ValidationPipe`.
- `src/schema.gql` is generated (`pnpm graphql:generate`) and committed, checked in CI via
  `pnpm graphql:check` (regenerate + `git diff --exit-code`) — the GraphQL analogue of a
  committed `openapi.json`.
- `health` stays a REST controller deliberately: it is an infrastructure endpoint
  polled by an orchestrator/Prometheus, not application API, and GraphQL would only add overhead
  for callers that cannot execute a GraphQL request in the first place.
- The throttler guard (`GqlThrottlerGuard`) reads the request off `GqlExecutionContext` rather
  than `context.switchToHttp()`, because Mercurius resolver invocations arrive through Nest's
  GraphQL execution context, not the HTTP one.
- Domain errors (`src/common/errors/domain.error.ts`) are still transport-agnostic; only the
  filter that renders them changed — `GqlExceptionFilter` (`extensions.code`) replaces
  `AllExceptionsFilter` (HTTP status + JSON body).

## Scope

`announcements` (CRUD, categories, live subscription) and `notifications` (feed, reminders) are
implemented. There is no authentication: the task ships no login screen, so every operation is
public. This is deliberate and documented in the backend README.

## Before committing

Run `pnpm verify` (lint, typecheck, unit tests with coverage, build, GraphQL schema check).
`pnpm test:e2e` additionally requires Docker (Testcontainers boots Postgres and Redis) and is not
part of `verify` for that reason — CI runs it as its own job.
