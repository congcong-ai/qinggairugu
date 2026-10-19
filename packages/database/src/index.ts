import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
export function connectDatabase(url: string) {
  const sql = postgres(url, { max: 5 });
  return { db: drizzle(sql, { schema }), sql };
}
export type Database = ReturnType<typeof connectDatabase>['db'];
export { schema };
export { eq, and, gt, desc } from 'drizzle-orm';

export { default as postgres } from 'postgres';
