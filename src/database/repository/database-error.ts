import { Prisma } from '@prisma/client';

export const PrismaErrorCode = {
  UniqueConstraint: 'P2002',
  ForeignKeyConstraint: 'P2003',
  NullConstraint: 'P2011',
  RecordNotFound: 'P2025',
  TransactionConflict: 'P2034',
  ConnectionTimeout: 'P2024',
} as const;

export type PrismaErrorCode = (typeof PrismaErrorCode)[keyof typeof PrismaErrorCode];

export function isPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

export function hasErrorCode(error: unknown, ...codes: string[]): boolean {
  return isPrismaError(error) && codes.includes(error.code);
}

export function isRecordNotFound(error: unknown): boolean {
  return hasErrorCode(error, PrismaErrorCode.RecordNotFound);
}
