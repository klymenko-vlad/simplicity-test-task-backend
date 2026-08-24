import type { ArgumentsHost } from '@nestjs/common';

export function isGraphQLContext(host: ArgumentsHost): boolean {
  return (host.getType<'graphql'>() as string) === 'graphql';
}
