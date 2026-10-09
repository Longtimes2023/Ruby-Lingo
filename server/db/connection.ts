/**
 * RubyLingo — Kết nối SQLite (better-sqlite3).
 *
 * Quyết định thiết kế:
 *   - **WAL** bật để đọc/ghi song song (bé đang chơi vẫn xem được báo cáo).
 *   - **foreign_keys = ON** để khoá ngoại được thực thi thật (SQLite mặc định TẮT).
 *   - **busy_timeout** để ghi đồng thời không ném lỗi SQLITE_BUSY ngay lập tức.
 *   - Đọc/ghi ĐỒNG BỘ: đơn giản, không cần pool, phù hợp quy mô gia đình / vài trăm bé.
 *
 * ⚠️ File DB KHÔNG bao giờ nằm trong static root và không được commit (xem .gitignore).
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

export type Db = Database.Database;

let instance: Db | null = null;

/** Mở (hoặc tái sử dụng) kết nối DB. Gọi nhiều lần vẫn trả về cùng một instance. */
export function getDb(): Db {
  if (instance) return instance;

  mkdirSync(dirname(config.dbPath), { recursive: true });

  const db = new Database(config.dbPath);

  // WAL: cho phép đọc trong khi đang ghi — quan trọng khi bé chơi game và phụ huynh xem báo cáo.
  db.pragma('journal_mode = WAL');
  // Khoá ngoại mặc định TẮT trong SQLite ⇒ phải bật thủ công.
  db.pragma('foreign_keys = ON');
  // Chờ tối đa 5s thay vì ném SQLITE_BUSY ngay.
  db.pragma('busy_timeout = 5000');
  // Cân bằng giữa an toàn dữ liệu và tốc độ; WAL + NORMAL là khuyến nghị phổ biến.
  db.pragma('synchronous = NORMAL');

  instance = db;
  logger.info({ path: config.dbPath }, 'Đã mở cơ sở dữ liệu SQLite (WAL)');
  return db;
}

/** Đóng kết nối — gọi khi tắt server để WAL được gộp lại sạch sẽ. */
export function closeDb(): void {
  if (instance) {
    instance.close();
    instance = null;
    logger.info('Đã đóng cơ sở dữ liệu');
  }
}

/**
 * Chạy một hàm trong transaction. Ném lỗi ⇒ rollback toàn bộ.
 * Dùng cho các thao tác nhiều bước (mua vật phẩm: trừ tiền + thêm vào túi).
 */
export function transaction<T>(fn: (db: Db) => T): T {
  const db = getDb();
  const run = db.transaction(fn);
  return run(db);
}

/** Kiểm tra kết nối còn sống — dùng cho /api/health. */
export function pingDb(): boolean {
  try {
    getDb().prepare('SELECT 1').get();
    return true;
  } catch {
    return false;
  }
}
