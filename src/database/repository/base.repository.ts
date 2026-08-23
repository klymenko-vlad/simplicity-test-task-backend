import { EntityNotFoundError } from '../../common/errors/domain.error';
import type { Database, Transaction } from '../database.tokens';
import type { TransactionOptions } from '../transaction.context';
import { type TransactionHost } from '../transaction.host';

import { isRecordNotFound } from './database-error';
import {
  type Delegate,
  type FindManyOptions,
  type FindOneOptions,
  type ReadOptions,
} from './repository.types';

interface ManagedEntity {
  id: string;
  deletedAt: Date | null;
}

export abstract class BaseRepository<TEntity extends ManagedEntity> {
  protected readonly entityName: string;

  constructor(
    protected readonly txHost: TransactionHost,
    private readonly delegateOf: (client: Database | Transaction) => Delegate<TEntity>,
    entityName: string,
  ) {
    this.entityName = entityName;
  }

  protected client(tx?: Transaction): Database | Transaction {
    return this.txHost.client(tx);
  }

  protected reader(tx?: Transaction, options: ReadOptions = {}): Database | Transaction {
    return this.txHost.reader(tx, options.consistent);
  }

  transaction<T>(
    fn: (tx: Transaction) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    return this.txHost.run(fn, options);
  }

  private delegate(client: Database | Transaction): Delegate<TEntity> {
    return this.delegateOf(client);
  }

  async create(data: Record<string, unknown>, tx?: Transaction): Promise<TEntity> {
    return this.delegate(this.client(tx)).create({ data });
  }

  async update(id: string, data: Record<string, unknown>, tx?: Transaction): Promise<TEntity> {
    try {
      return await this.delegate(this.client(tx)).update({ where: { id }, data });
    } catch (error) {
      if (isRecordNotFound(error)) throw this.notFound(id);
      throw error;
    }
  }

  async updateMany(
    where: Record<string, unknown>,
    data: Record<string, unknown>,
    options: ReadOptions = {},
    tx?: Transaction,
  ): Promise<number> {
    const result = await this.delegate(this.client(tx)).updateMany({
      where: this.scope(where, options.withDeleted),
      data,
    });

    return result.count;
  }

  async softDelete(id: string, tx?: Transaction): Promise<TEntity> {
    return this.update(id, { deletedAt: new Date() }, tx);
  }

  async hardDeleteMany(where: Record<string, unknown>, tx?: Transaction): Promise<number> {
    const result = await this.delegate(this.client(tx)).deleteMany({ where });

    return result.count;
  }

  findById(
    id: string,
    options: FindOneOptions = {},
    tx?: Transaction,
  ): Promise<TEntity | undefined> {
    return this.findOne({ id }, options, tx);
  }

  async findByIdOrFail(
    id: string,
    options: FindOneOptions = {},
    tx?: Transaction,
  ): Promise<TEntity> {
    const found = await this.findById(id, options, tx);
    if (!found) throw this.notFound(id);

    return found;
  }

  async findOne(
    where: Record<string, unknown>,
    options: FindOneOptions = {},
    tx?: Transaction,
  ): Promise<TEntity | undefined> {
    const found = await this.delegate(this.reader(tx, options)).findFirst({
      where: this.scope(where, options.withDeleted),
    });

    return found ?? undefined;
  }

  async findOneOrFail(
    where: Record<string, unknown>,
    options: FindOneOptions = {},
    tx?: Transaction,
  ): Promise<TEntity> {
    const found = await this.findOne(where, options, tx);
    if (!found) throw new EntityNotFoundError(this.entityName);

    return found;
  }

  async findMany(options: FindManyOptions = {}, tx?: Transaction): Promise<TEntity[]> {
    return this.delegate(this.reader(tx, options)).findMany({
      where: this.scope(options.where, options.withDeleted),
      orderBy: options.orderBy ?? { createdAt: 'desc' },
      ...(options.limit === undefined ? {} : { take: options.limit }),
      ...(options.offset === undefined ? {} : { skip: options.offset }),
    });
  }

  async exists(
    where: Record<string, unknown>,
    options: ReadOptions = {},
    tx?: Transaction,
  ): Promise<boolean> {
    const found = await this.delegate(this.reader(tx, options)).count({
      where: this.scope(where, options.withDeleted),
      take: 1,
    });

    return found > 0;
  }

  async count(
    where: Record<string, unknown> = {},
    options: ReadOptions = {},
    tx?: Transaction,
  ): Promise<number> {
    return this.delegate(this.reader(tx, options)).count({
      where: this.scope(where, options.withDeleted),
    });
  }

  protected scope(
    where: Record<string, unknown> = {},
    withDeleted = false,
  ): Record<string, unknown> {
    if (withDeleted) return where;

    return { ...where, deletedAt: null };
  }

  protected notFound(id: string): EntityNotFoundError {
    return new EntityNotFoundError(this.entityName, id);
  }
}
