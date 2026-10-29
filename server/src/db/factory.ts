import path from 'node:path';
import type { AppConfig } from '../config';
import { MongoDocStore } from './mongo';
import { SqliteDocStore } from './sqlite';
import type { DocStore } from './store';

export async function createStore(config: AppConfig): Promise<DocStore> {
  if (config.PERSISTENCE === 'mongodb') {
    if (!config.MONGODB_URI) {
      throw new Error('MONGODB_URI is required when PERSISTENCE=mongodb');
    }
    const store = new MongoDocStore(config.MONGODB_URI);
    await store.init();
    return store;
  }

  const filename =
    config.SQLITE_PATH === ':memory:'
      ? ':memory:'
      : path.resolve(process.cwd(), config.SQLITE_PATH);
  const store = new SqliteDocStore(filename);
  await store.init();
  return store;
}
