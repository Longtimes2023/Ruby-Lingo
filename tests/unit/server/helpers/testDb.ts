/**
 * Helper dùng chung cho test tầng server.
 *
 * Mỗi file test server nên có dòng đầu tiên:
 *     // @vitest-environment node
 * để không phải dựng jsdom (nhanh hơn nhiều) — test server không cần DOM.
 */

// ⚠️ File này nằm ở tests/unit/server/helpers/ — SÂU HƠN file test một cấp
// (tests/unit/server/*.test.ts), nên cần BỐN `../` chứ không phải ba.
import { getDb, type Db } from '../../../../server/db/connection.js';
import { runMigrations } from '../../../../server/db/migrate.js';

/** Chạy migration trên DB tạm của lần test này. Gọi trong `beforeAll`. */
export function setupTestDb(): Db {
  runMigrations();
  return getDb();
}

/**
 * Xoá sạch dữ liệu giữa các test.
 *
 * Chỉ cần xoá `parent_account`: mọi bảng khác đều có khoá ngoại `ON DELETE CASCADE` trỏ về
 * nó (trực tiếp hoặc qua `child_profile`), và `foreign_keys = ON` đã được bật trong
 * `db/connection.ts` nên cascade thực sự chạy.
 *
 * ⚠️ Nếu một bảng con nào đó KHÔNG cascade, dữ liệu sẽ rò rỉ sang test sau và gây ra những
 * thất bại khó hiểu. Hàm `assertAllTablesEmpty()` dưới đây kiểm đúng điều đó.
 */
export function clearAllData(db: Db): void {
  db.prepare('DELETE FROM parent_account').run();
}

/** Các bảng có dữ liệu theo tài khoản — dùng để kiểm cascade đã dọn sạch thật chưa. */
const ACCOUNT_TABLES = [
  'parent_account',
  'session',
  'recovery_code',
  'child_profile',
  'settings',
  'wallet',
  'xp_state',
  'pet_state',
  'streak_state',
  'inventory',
] as const;

/**
 * Khẳng định mọi bảng đã rỗng — dùng để CHỨNG MINH `ON DELETE CASCADE` hoạt động.
 * Trả về danh sách bảng còn dữ liệu để test hiển thị được chỗ rò rỉ.
 */
export function tablesWithRows(db: Db): string[] {
  const dirty: string[] = [];
  for (const table of ACCOUNT_TABLES) {
    const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
    if (row.n > 0) dirty.push(`${table}(${row.n})`);
  }
  return dirty;
}
