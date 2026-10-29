import mongoose, { Schema, type Model } from 'mongoose';
import { COLLECTIONS, type CollectionName } from '../domain/types';
import {
  DuplicateKeyError,
  INDEXES,
  type DocStore,
  type Filter,
  type FindOptions,
  type Primitive,
  type SearchSpec,
  type TimeSeriesOptions,
  type TimeSeriesPoint,
} from './store';

type LeanDoc = Record<string, unknown> & { _id?: unknown };

function stripId(doc: LeanDoc | null): Record<string, unknown> | null {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  void _id;
  return rest;
}

function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toMongoFilter(filter?: Filter, search?: SearchSpec): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(filter ?? {})) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const operators: Record<string, Primitive | Primitive[]> = {};
      for (const [operator, operand] of Object.entries(value)) {
        operators[operator] = operand;
      }
      query[field] = operators;
    } else {
      query[field] = value;
    }
  }
  if (search && search.term.trim()) {
    const regex = new RegExp(escapeRegex(search.term.trim()), 'i');
    const or = search.fields.map((field) => ({ [field]: regex }));
    if (Object.keys(query).length) {
      return { $and: [query, { $or: or }] };
    }
    return { $or: or };
  }
  return query;
}

export class MongoDocStore implements DocStore {
  readonly engine = 'mongodb' as const;
  private models = new Map<CollectionName, Model<Record<string, unknown>>>();

  constructor(private readonly uri: string) {}

  private modelFor(collection: CollectionName): Model<Record<string, unknown>> {
    const existing = this.models.get(collection);
    if (existing) return existing;

    const schema = new Schema<Record<string, unknown>>(
      {},
      { strict: false, collection, versionKey: false, minimize: false },
    );
    for (const index of INDEXES[collection]) {
      const fields = Object.fromEntries(
        index.fields.map((field) => [field.field, field.direction]),
      );
      schema.index(fields, { name: index.name, unique: index.unique ?? false });
    }
    const modelName = `LedgerLens_${collection}`;
    const model =
      (mongoose.models[modelName] as Model<Record<string, unknown>> | undefined) ??
      mongoose.model<Record<string, unknown>>(modelName, schema);
    this.models.set(collection, model);
    return model;
  }

  async init(): Promise<void> {
    mongoose.set('strictQuery', true);
    await mongoose.connect(this.uri, {
      serverSelectionTimeoutMS: 7000,
      autoIndex: false,
    });
    for (const collection of COLLECTIONS) {
      await this.modelFor(collection).createIndexes();
    }
  }

  async ping(): Promise<void> {
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection is not ready');
    await db.admin().ping();
  }

  async insert<T extends { id: string }>(collection: CollectionName, doc: T): Promise<void> {
    try {
      await this.modelFor(collection).create(doc);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new DuplicateKeyError(collection, JSON.stringify(doc).slice(0, 80));
      }
      throw error;
    }
  }

  async findOne<T>(collection: CollectionName, filter: Filter): Promise<T | null> {
    const doc = await this.modelFor(collection)
      .findOne(toMongoFilter(filter))
      .lean<LeanDoc>();
    return stripId(doc) as T | null;
  }

  async find<T>(collection: CollectionName, options: FindOptions = {}): Promise<T[]> {
    const query = this.modelFor(collection)
      .find(toMongoFilter(options.filter, options.search))
      .lean<LeanDoc[]>();
    if (options.sort) {
      query.sort({ [options.sort.field]: options.sort.direction === 'asc' ? 1 : -1, id: 1 });
    }
    if (options.skip) query.skip(options.skip);
    if (options.limit !== undefined) query.limit(options.limit);
    const docs = await query.exec();
    return docs.map((doc) => stripId(doc) as T);
  }

  async count(collection: CollectionName, filter?: Filter, search?: SearchSpec): Promise<number> {
    return this.modelFor(collection).countDocuments(toMongoFilter(filter, search));
  }

  async updateOne<T>(
    collection: CollectionName,
    filter: Filter,
    patch: Record<string, unknown>,
  ): Promise<T | null> {
    const doc = await this.modelFor(collection)
      .findOneAndUpdate(toMongoFilter(filter), { $set: patch }, { new: true })
      .lean<LeanDoc>();
    return stripId(doc) as T | null;
  }

  async deleteMany(collection: CollectionName, filter: Filter): Promise<number> {
    const result = await this.modelFor(collection).deleteMany(toMongoFilter(filter));
    return result.deletedCount ?? 0;
  }

  async groupCount(
    collection: CollectionName,
    field: string,
    filter?: Filter,
  ): Promise<Array<{ value: string; count: number }>> {
    const rows = await this.modelFor(collection).aggregate<{ _id: unknown; count: number }>([
      { $match: toMongoFilter(filter) },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return rows.map((row) => ({
      value: row._id === null || row._id === undefined ? 'UNKNOWN' : String(row._id),
      count: row.count,
    }));
  }

  async sum(collection: CollectionName, field: string, filter?: Filter): Promise<number> {
    const rows = await this.modelFor(collection).aggregate<{ total: number | null }>([
      { $match: toMongoFilter(filter) },
      { $group: { _id: null, total: { $sum: `$${field}` } } },
    ]);
    return rows[0]?.total ?? 0;
  }

  async groupSum(
    collection: CollectionName,
    groupField: string,
    valueField: string,
    filter?: Filter,
  ): Promise<Array<{ value: string; total: number }>> {
    const rows = await this.modelFor(collection).aggregate<{
      _id: unknown;
      total: number;
    }>([
      { $match: toMongoFilter(filter) },
      {
        $group: {
          _id: `$${groupField}`,
          total: { $sum: `$${valueField}` },
        },
      },
      { $sort: { total: -1 } },
    ]);
    return rows.map((row) => ({
      value: row._id === null || row._id === undefined ? 'UNKNOWN' : String(row._id),
      total: row.total,
    }));
  }

  async timeSeries(
    collection: CollectionName,
    options: TimeSeriesOptions,
  ): Promise<TimeSeriesPoint[]> {
    const match = toMongoFilter({
      ...(options.filter ?? {}),
      [options.timeField]: { $gte: options.from, $lte: options.to },
    });
    const unit = options.granularity === 'hour' ? 'hour' : 'day';
    const rows = await this.modelFor(collection).aggregate<{
      _id: Date;
      count: number;
      value: number;
      successCount: number;
    }>([
      { $match: match },
      {
        $addFields: {
          __date: { $dateFromString: { dateString: `$${options.timeField}` } },
        },
      },
      {
        $group: {
          _id: { $dateTrunc: { date: '$__date', unit, timezone: 'UTC' } },
          count: { $sum: 1 },
          value: { $sum: `$${options.valueField}` },
          successCount: {
            $sum: { $cond: [{ $eq: ['$status', 'PAID'] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return rows.map((row) => ({
      bucket:
        options.granularity === 'hour'
          ? row._id.toISOString()
          : row._id.toISOString().slice(0, 10),
      count: row.count,
      value: row.value,
      successCount: row.successCount,
    }));
  }

  async resetDemoData(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const collection of COLLECTIONS) {
      const result = await this.modelFor(collection).deleteMany({ environment: 'demo' });
      counts[collection] = result.deletedCount ?? 0;
    }
    return counts;
  }

  async close(): Promise<void> {
    await mongoose.disconnect();
  }
}
