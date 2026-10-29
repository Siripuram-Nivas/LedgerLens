import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { COLLECTIONS, type CollectionName } from '../domain/types';
import {
  DuplicateKeyError,
  INDEXES,
  type DocStore,
  type Filter,
  type FilterValue,
  type FindOptions,
  type Primitive,
  type SearchSpec,
  type TimeSeriesOptions,
  type TimeSeriesPoint,
} from './store';

type SqlValue = string | number | bigint | Buffer | null;

const FIELD_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

function assertField(field: string): string {
  if (!FIELD_PATTERN.test(field)) {
    throw new Error(`Unsafe field name: ${field}`);
  }
  return field;
}

function jsonField(field: string): string {
  return `json_extract(doc, '$.${assertField(field)}')`;
}

function bind(value: Primitive): SqlValue {
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

function isOperator(value: FilterValue): value is Exclude<FilterValue, Primitive> {
  return typeof value === 'object' && value !== null;
}

function buildWhere(filter?: Filter, search?: SearchSpec): { sql: string; params: SqlValue[] } {
  const clauses: string[] = [];
  const params: SqlValue[] = [];

  for (const [field, value] of Object.entries(filter ?? {})) {
    const expr = jsonField(field);
    if (!isOperator(value)) {
      if (value === null) {
        clauses.push(`${expr} IS NULL`);
      } else {
        clauses.push(`${expr} = ?`);
        params.push(bind(value));
      }
      continue;
    }
    if (value.$in) {
      if (value.$in.length === 0) {
        clauses.push('0 = 1');
      } else {
        const hasNull = value.$in.some((entry) => entry === null);
        const nonNull = value.$in.filter((entry): entry is Exclude<Primitive, null> => entry !== null);
        const parts: string[] = [];
        if (hasNull) parts.push(`${expr} IS NULL`);
        if (nonNull.length) {
          parts.push(`${expr} IN (${nonNull.map(() => '?').join(', ')})`);
          params.push(...nonNull.map(bind));
        }
        clauses.push(`(${parts.join(' OR ')})`);
      }
    }
    if (value.$ne !== undefined) {
      if (value.$ne === null) {
        clauses.push(`${expr} IS NOT NULL`);
      } else {
        clauses.push(`(${expr} IS NULL OR ${expr} <> ?)`);
        params.push(bind(value.$ne));
      }
    }
    if (value.$gte !== undefined) {
      clauses.push(`${expr} >= ?`);
      params.push(bind(value.$gte));
    }
    if (value.$lte !== undefined) {
      clauses.push(`${expr} <= ?`);
      params.push(bind(value.$lte));
    }
    if (value.$gt !== undefined) {
      clauses.push(`${expr} > ?`);
      params.push(bind(value.$gt));
    }
    if (value.$lt !== undefined) {
      clauses.push(`${expr} < ?`);
      params.push(bind(value.$lt));
    }
  }

  if (search && search.term.trim()) {
    const term = `%${search.term.trim().toLowerCase().replace(/[\\%_]/g, '\\$&')}%`;
    const fields = search.fields.map(assertField);
    clauses.push(
      `(${fields
        .map(
          (field) =>
            `LOWER(COALESCE(CAST(${jsonField(field)} AS TEXT), '')) LIKE ? ESCAPE '\\'`,
        )
        .join(' OR ')})`,
    );
    params.push(...fields.map(() => term));
  }

  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

function stripId(doc: Record<string, unknown>): Record<string, unknown> {
  const { _id, ...rest } = doc;
  void _id;
  return rest;
}

export class SqliteDocStore implements DocStore {
  readonly engine = 'sqlite' as const;
  private db: Database.Database | null = null;

  constructor(private readonly filename: string) {}

  async init(): Promise<void> {
    if (this.filename !== ':memory:') {
      fs.mkdirSync(path.dirname(path.resolve(this.filename)), { recursive: true });
    }
    const db = new Database(this.filename);
    if (this.filename !== ':memory:') {
      db.pragma('journal_mode = WAL');
    }
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    this.db = db;

    for (const collection of COLLECTIONS) {
      db.exec(`CREATE TABLE IF NOT EXISTS "${collection}" (id TEXT PRIMARY KEY, doc TEXT NOT NULL)`);
      for (const index of INDEXES[collection]) {
        const columns = index.fields.map((field) => jsonField(field.field)).join(', ');
        const unique = index.unique ? 'UNIQUE ' : '';
        db.exec(
          `CREATE ${unique}INDEX IF NOT EXISTS "${index.name}" ON "${collection}" (${columns})`,
        );
      }
    }
  }

  private database(): Database.Database {
    if (!this.db) throw new Error('SQLite store not initialized');
    return this.db;
  }

  async ping(): Promise<void> {
    this.database().prepare('SELECT 1').get();
  }

  async insert<T extends { id: string }>(collection: CollectionName, doc: T): Promise<void> {
    try {
      this.database()
        .prepare(`INSERT INTO "${collection}" (id, doc) VALUES (?, ?)`)
        .run(doc.id, JSON.stringify(doc));
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
        throw new DuplicateKeyError(collection, JSON.stringify(doc).slice(0, 80));
      }
      throw error;
    }
  }

  async findOne<T>(collection: CollectionName, filter: Filter): Promise<T | null> {
    const where = buildWhere(filter);
    const row = this.database()
      .prepare(`SELECT doc FROM "${collection}" ${where.sql} LIMIT 1`)
      .get(...where.params) as { doc: string } | undefined;
    return row ? (stripId(JSON.parse(row.doc)) as T) : null;
  }

  async find<T>(collection: CollectionName, options: FindOptions = {}): Promise<T[]> {
    const where = buildWhere(options.filter, options.search);
    const sort = options.sort
      ? `ORDER BY ${jsonField(options.sort.field)} COLLATE NOCASE ${options.sort.direction.toUpperCase()}, id ${options.sort.direction.toUpperCase()}`
      : '';
    let limit = '';
    const params = [...where.params];
    if (options.limit !== undefined) {
      limit = 'LIMIT ?';
      params.push(options.limit);
      if (options.skip) {
        limit += ' OFFSET ?';
        params.push(options.skip);
      }
    } else if (options.skip) {
      limit = 'LIMIT -1 OFFSET ?';
      params.push(options.skip);
    }
    const rows = this.database()
      .prepare(`SELECT doc FROM "${collection}" ${where.sql} ${sort} ${limit}`)
      .all(...params) as Array<{ doc: string }>;
    return rows.map((row) => stripId(JSON.parse(row.doc)) as T);
  }

  async count(collection: CollectionName, filter?: Filter, search?: SearchSpec): Promise<number> {
    const where = buildWhere(filter, search);
    const row = this.database()
      .prepare(`SELECT COUNT(*) AS count FROM "${collection}" ${where.sql}`)
      .get(...where.params) as { count: number };
    return row.count;
  }

  async updateOne<T>(
    collection: CollectionName,
    filter: Filter,
    patch: Record<string, unknown>,
  ): Promise<T | null> {
    const run = this.database().transaction(() => {
      const where = buildWhere(filter);
      const row = this.database()
        .prepare(`SELECT id, doc FROM "${collection}" ${where.sql} LIMIT 1`)
        .get(...where.params) as { id: string; doc: string } | undefined;
      if (!row) return null;
      const next = { ...JSON.parse(row.doc), ...patch };
      this.database()
        .prepare(`UPDATE "${collection}" SET doc = ? WHERE id = ?`)
        .run(JSON.stringify(next), row.id);
      return stripId(next) as T;
    });
    return run();
  }

  async deleteMany(collection: CollectionName, filter: Filter): Promise<number> {
    const where = buildWhere(filter);
    return this.database()
      .prepare(`DELETE FROM "${collection}" ${where.sql}`)
      .run(...where.params).changes;
  }

  async groupCount(
    collection: CollectionName,
    field: string,
    filter?: Filter,
  ): Promise<Array<{ value: string; count: number }>> {
    const where = buildWhere(filter);
    const expr = jsonField(field);
    return this.database()
      .prepare(
        `SELECT COALESCE(CAST(${expr} AS TEXT), 'UNKNOWN') AS value, COUNT(*) AS count
         FROM "${collection}" ${where.sql} GROUP BY value ORDER BY count DESC`,
      )
      .all(...where.params) as Array<{ value: string; count: number }>;
  }

  async sum(collection: CollectionName, field: string, filter?: Filter): Promise<number> {
    const where = buildWhere(filter);
    const row = this.database()
      .prepare(
        `SELECT COALESCE(SUM(CAST(${jsonField(field)} AS INTEGER)), 0) AS total
         FROM "${collection}" ${where.sql}`,
      )
      .get(...where.params) as { total: number };
    return row.total;
  }

  async groupSum(
    collection: CollectionName,
    groupField: string,
    valueField: string,
    filter?: Filter,
  ): Promise<Array<{ value: string; total: number }>> {
    const where = buildWhere(filter);
    const groupExpr = jsonField(groupField);
    return this.database()
      .prepare(
        `SELECT COALESCE(CAST(${groupExpr} AS TEXT), 'UNKNOWN') AS value,
                COALESCE(SUM(CAST(${jsonField(valueField)} AS INTEGER)), 0) AS total
         FROM "${collection}" ${where.sql}
         GROUP BY value ORDER BY total DESC`,
      )
      .all(...where.params) as Array<{ value: string; total: number }>;
  }

  async timeSeries(
    collection: CollectionName,
    options: TimeSeriesOptions,
  ): Promise<TimeSeriesPoint[]> {
    const timeExpr = jsonField(options.timeField);
    const valueExpr = jsonField(options.valueField);
    const filter = { ...(options.filter ?? {}), [options.timeField]: { $gte: options.from, $lte: options.to } };
    const where = buildWhere(filter);
    const bucket =
      options.granularity === 'hour'
        ? `strftime('%Y-%m-%dT%H:00:00.000Z', ${timeExpr})`
        : `strftime('%Y-%m-%d', ${timeExpr})`;
    const rows = this.database()
      .prepare(
        `SELECT ${bucket} AS bucket,
                COUNT(*) AS count,
                COALESCE(SUM(CAST(${valueExpr} AS INTEGER)), 0) AS value,
                SUM(CASE WHEN json_extract(doc, '$.status') = 'PAID' THEN 1 ELSE 0 END) AS successCount
         FROM "${collection}" ${where.sql}
         GROUP BY bucket ORDER BY bucket ASC`,
      )
      .all(...where.params) as TimeSeriesPoint[];
    return rows;
  }

  async resetDemoData(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    const run = this.database().transaction(() => {
      for (const collection of COLLECTIONS) {
        counts[collection] = this.database()
          .prepare(`DELETE FROM "${collection}" WHERE json_extract(doc, '$.environment') = 'demo'`)
          .run().changes;
      }
    });
    run();
    return counts;
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }
}
