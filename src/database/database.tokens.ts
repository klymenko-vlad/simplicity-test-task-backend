import type { Prisma, PrismaClient } from '@prisma/client';

export type Database = PrismaClient;
export type Transaction = Prisma.TransactionClient;
