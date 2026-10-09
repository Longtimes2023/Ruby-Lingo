#!/usr/bin/env tsx
/**
 * RubyLingo — Migration runner.
 *
 * Chạy: npm run migrate
 *
 * Cách hoạt động: đọc `server/db/migrations/*.sql` theo thứ tự TÊN FILE (đánh số 3 chữ số),
 * so với bảng `schema_migrations`, rồi chỉ áp dụng những file chưa chạy.
 *
 * Nguyên tắc:
 *   - Mỗi migration chạy trong MỘT transaction ⇒ lỗi giữa đường thì không để lại trạng thái nửa vời.
 *   - File đã áp dụng là BẤT BIẾN: sửa file cũ sẽ không có tác dụng. Muốn đổi ⇒ thêm file mới.
 *   - Chạy lại nhiều lần là an toàn (idempotent).
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, closeDb } from './connection.js';
import { logger } from '../lib/logger.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

interface MigrationRow {
  name: string;
  applied_at: string;
}

function ensureMigrationsTable(): void {
  getDb()
    .prepare(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name       TEXT PRIMARY KEY,
         applied_at TEXT NOT NULL
       )`,
    )
    .run();
}

function appliedMigrations(): Set<string> {
  const rows = getDb().prepare('SELECT name FROM schema_migrations').all() as MigrationRow[];
  return new Set(rows.map((r) => r.name));
}

/** Số migration đã áp dụng — dùng cho /api/health để phát hiện VPS chưa migrate. */
export function countAppliedMigrations(): number {
  try {
    const row = getDb().prepare('SELECT COUNT(*) AS n FROM schema_migrations').get() as { n: number };
    return row.n;
  } catch {
    return 0;
  }
}

export function runMigrations(): { applied: string[]; total: number } {
  if (!existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Không tìm thấy thư mục migration: ${MIGRATIONS_DIR}`);
  }

  ensureMigrationsTable();
  const done = appliedMigrations();
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // 001_, 002_, ... — đánh số 3 chữ số nên sort chuỗi là đúng thứ tự

  const db = getDb();
  const applied: string[] = [];

  for (const file of files) {
    if (done.has(file)) continue;

    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const record = db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)');

    // Toàn bộ file chạy trong 1 transaction: hoặc xong hết, hoặc không đổi gì.
    const apply = db.transaction(() => {
      db.exec(sql);
      record.run(file, new Date().toISOString());
    });

    try {
      apply();
      applied.push(file);
      logger.info({ file }, 'Đã áp dụng migration');
    } catch (e) {
      logger.error({ file, err: (e as Error).message }, 'Migration THẤT BẠI — đã rollback file này');
      throw e;
    }
  }

  return { applied, total: files.length };
}

/** Chạy trực tiếp: `npm run migrate` */
const isDirectRun =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('migrate.ts') || process.argv[1].endsWith('migrate.js'));

if (isDirectRun) {
  try {
    const { applied, total } = runMigrations();
    if (applied.length === 0) {
      console.log(`✅ Không có migration mới. Đã áp dụng đủ ${total} file.`);
    } else {
      console.log(`✅ Đã áp dụng ${applied.length}/${total} migration:`);
      for (const f of applied) console.log(`   • ${f}`);
    }
    closeDb();
  } catch (e) {
    console.error(`\n❌ Migration thất bại: ${(e as Error).message}\n`);
    closeDb();
    process.exit(1);
  }
}
