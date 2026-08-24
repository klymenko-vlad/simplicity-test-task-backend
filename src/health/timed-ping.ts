import type { HealthIndicatorService } from '@nestjs/terminus';

export async function timedPing<TKey extends string>(
  indicator: HealthIndicatorService,
  key: TKey,
  label: string,
  timeoutMs: number,
  ping: () => Promise<unknown>,
) {
  const check = indicator.check(key);
  const startedAt = performance.now();

  let timer: NodeJS.Timeout | undefined;
  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} ping exceeded ${timeoutMs}ms`));
    }, timeoutMs);
    timer.unref();
  });

  const pending = ping();
  pending.catch(() => undefined);

  try {
    await Promise.race([pending, expiry]);
    return check.up({ responseTimeMs: Math.round(performance.now() - startedAt) });
  } catch (error) {
    return check.down({ message: (error as Error).message });
  } finally {
    clearTimeout(timer);
  }
}
