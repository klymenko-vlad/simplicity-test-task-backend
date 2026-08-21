export type DomainErrorKind = 'not_found' | 'conflict' | 'invalid';

export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;

  abstract readonly code: string;

  readonly details: Record<string, unknown> | undefined;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.details = details;
    Error.captureStackTrace(this, new.target);
  }
}

export class EntityNotFoundError extends DomainError {
  readonly kind = 'not_found' as const;
  readonly code: string;

  constructor(entity: string, id?: string) {
    super(id ? `${entity} ${id} not found` : `${entity} not found`, id ? { id } : undefined);
    this.code = `${screamingSnake(entity)}_NOT_FOUND`;
  }
}

export class ConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(
    readonly code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message, details);
  }
}

export class InvalidInputError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message, details);
  }
}

function screamingSnake(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toUpperCase()
    .replace(/^_+|_+$/g, '');
}
