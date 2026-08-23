import type { SortOrder } from '../../common/dto/pagination.types';

export interface ReadOptions {
  withDeleted?: boolean;
  consistent?: boolean;
}

export type FindOneOptions = ReadOptions;

export interface FindManyOptions extends ReadOptions {
  where?: Record<string, unknown>;
  orderBy?: Record<string, SortOrder> | Record<string, SortOrder>[];
  limit?: number;
  offset?: number;
}

export interface Delegate<TEntity> {
  create(args: { data: Record<string, unknown> }): Promise<TEntity>;
  update(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<TEntity>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
  deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
  findFirst(args: Record<string, unknown>): Promise<TEntity | null>;
  findMany(args: Record<string, unknown>): Promise<TEntity[]>;
  count(args: Record<string, unknown>): Promise<number>;
}

export type { SortOrder };
