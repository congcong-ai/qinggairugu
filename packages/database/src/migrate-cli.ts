import postgres from 'postgres';
import { migrateCloud } from './migrate';
const url = process.env.DATABASE_URL;
if (!url) throw new Error('请设置 DATABASE_URL');
const sql = postgres(url, { max: 1 });
try {
  await migrateCloud(sql);
  console.log('共享数据迁移完成');
} finally {
  await sql.end();
}
