import { z } from 'zod';

const NodeEnv = z.enum(['development', 'test', 'production']);
type NodeEnv = z.infer<typeof NodeEnv>;

export const AppRole = z.enum(['api', 'worker', 'all']);
export type AppRole = z.infer<typeof AppRole>;

const bool = (fallback: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(fallback)
    .transform((v) => v === 'true');

const envSchema = z.object({
  NODE_ENV: NodeEnv.default('development'),
  ROLE: AppRole.default('all'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),

  API_PREFIX: z.string().default('api'),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  CORS_ORIGINS: z.string().default('*'),

  TRUSTED_PROXIES: z.string().default('loopback'),

  BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(1_048_576),

  DATABASE_URL: z.url().describe('postgres://user:pass@host:5432/db'),
  DATABASE_URL_REPLICA: z.url().optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  DATABASE_SSL: bool('false'),
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  DATABASE_IDLE_TX_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().min(0).default(0),
  REDIS_TLS: bool('false'),

  QUEUE_PREFIX: z.string().default('backend'),
  QUEUE_DEFAULT_ATTEMPTS: z.coerce.number().int().positive().default(3),
  QUEUE_DEFAULT_BACKOFF_MS: z.coerce.number().int().positive().default(1_000),

  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),

  GRAPHIQL_ENABLED: bool('false'),

  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  SHUTDOWN_DRAIN_MS: z.coerce.number().int().min(0).default(5_000),
});

export type Env = z.infer<typeof envSchema>;

function assertProductionHardening(env: Env, ctx: z.RefinementCtx): void {
  if (env.NODE_ENV !== 'production') return;

  const reject = (path: keyof Env, message: string): void => {
    ctx.addIssue({ code: 'custom', path: [path], message });
  };

  if (env.CORS_ORIGINS === '*') {
    reject(
      'CORS_ORIGINS',
      'must list explicit origins in production; "*" reflects any origin and, combined with credentialed requests, lets any site call this API as a signed-in user',
    );
  }

  if (env.GRAPHIQL_ENABLED) {
    reject(
      'GRAPHIQL_ENABLED',
      'must be false in production; it publishes the GraphQL IDE and disables the Helmet CSP',
    );
  }

  if (env.TRUSTED_PROXIES === 'true') {
    reject(
      'TRUSTED_PROXIES',
      'must name the actual proxy hops; trusting all of them lets a client forge X-Forwarded-For and bypass rate limiting',
    );
  }
}

const validatedEnvSchema = envSchema.superRefine(assertProductionHardening);

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = validatedEnvSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${details}`);
  }

  return result.data;
}
