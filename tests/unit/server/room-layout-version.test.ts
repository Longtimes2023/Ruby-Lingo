// @vitest-environment node
/**
 * Test — VERSION GUARD CHO VỊ TRÍ ĐỒ TRANG TRÍ ĐÃ LƯU.
 *
 * ⭐ VẤN ĐỀ CHỦ DỰ ÁN BÁO: bố cục mặc định 10 món trang trí vừa đổi mạnh (món to lên 1,5× và đổi
 *   chỗ: `treehouse` 18→8,5 · `plant` 82→19,9 · `castle` 26→32,9 · `sunflower` 74→71 · `aquarium`
 *   70→84). Nhưng vị trí bé ĐÃ KÉO TAY thì vẫn được giữ nguyên ⇒ bé nào từng kê đồ sẽ thấy phòng
 *   chồng chéo, không phải bố cục mới.
 *
 * CÁCH CHỮA: mỗi dòng trong `room_decoration_placement` mang thêm `layout_version`
 *   (migration `015_room_layout_version.sql`). `getPlacements` CHỈ trả dòng có
 *   `layout_version = ROOM_LAYOUT_VERSION`; dòng cũ KHÔNG bị xoá ở đường ĐỌC — chỉ bị bỏ qua.
 *
 * ⚠️ ĐIỀU FILE NÀY KHOÁ (và là thứ dễ bị "tối ưu" làm hỏng nhất):
 *   1. Dòng version CŨ không bao giờ lọt ra API ⇒ bé thấy bố cục mặc định mới.
 *   2. Đường ĐỌC không phá dữ liệu: dòng cũ vẫn nằm nguyên trong bảng sau khi `getPlacements`.
 *   3. `savePlacements` ghi ĐÚNG version hiện hành — nếu quên, lần lưu sau lại bị coi là "cũ" và
 *      vị trí bé vừa kéo biến mất, đúng kiểu lỗi "kéo xong mở lại thì mất".
 *   4. Migration chạy được trên DB ĐÃ CÓ DỮ LIỆU: `ALTER TABLE … ADD COLUMN … DEFAULT 0`, dòng cũ
 *      nhận 0, không mất dòng nào (dùng DB dừng ở `014` như `pet-choose.test.ts`).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { getDb } from '../../../server/db/connection.js';
import { AuthService } from '../../../server/services/AuthService.js';
import { ChildService } from '../../../server/services/ChildService.js';
import { RoomService } from '../../../server/services/RoomService.js';
import { ROOM_LAYOUT_VERSION } from '../../../shared/schemas/room.js';
import { clearAllData, setupTestDb } from './helpers/testDb.js';

const auth = new AuthService();
const children = new ChildService();
const room = new RoomService();

const PASSWORD = 'matkhau123';

async function makeParent(email: string): Promise<string> {
  const { parent } = await auth.signup({ email, password: PASSWORD, parentalConsent: true });
  return parent.id;
}

function makeChild(parentId: string, nickname = 'Bông'): string {
  return children.createChild(parentId, { nickname, age: 7, avatarId: 'panda' }).id;
}

/**
 * Cấp quyền sở hữu bằng SQL tay — ĐÚNG khuôn `room-routes.test.ts`. Đi qua `RewardService.buy` sẽ
 * kéo thêm ví/giá vào phép kiểm, mà thứ đang được kiểm ở đây là VERSION, không phải kinh tế.
 */
function grant(childId: string, itemIds: readonly string[]): void {
  const insert = getDb().prepare(
    'INSERT INTO inventory (child_id, item_id, quantity, equipped, acquired_at) VALUES (?, ?, 1, 0, ?)',
  );
  const at = new Date().toISOString();
  for (const itemId of itemIds) insert.run(childId, itemId, at);
}

interface RawRow {
  item_id: string;
  x: number;
  y: number;
  hidden: number;
  layout_version: number;
}

/** Ghi thẳng một dòng với version bất kỳ — mô phỏng dữ liệu của một bản deploy TRƯỚC. */
function seedPlacement(
  childId: string,
  itemId: string,
  x: number,
  y: number,
  layoutVersion: number,
  hidden = 0,
): void {
  getDb()
    .prepare(
      `INSERT INTO room_decoration_placement (child_id, item_id, x, y, hidden, updated_at, layout_version)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(childId, itemId, x, y, hidden, new Date().toISOString(), layoutVersion);
}

function rawRows(childId: string): RawRow[] {
  return getDb()
    .prepare(
      `SELECT item_id, x, y, hidden, layout_version
         FROM room_decoration_placement
        WHERE child_id = ?
        ORDER BY item_id ASC`,
    )
    .all(childId) as RawRow[];
}

describe('version guard cho vị trí đã lưu', () => {
  beforeAll(() => {
    setupTestDb();
  });

  beforeEach(() => {
    clearAllData(getDb());
  });

  it('(a) dòng có version CŨ (0 — trước khi có khái niệm version) KHÔNG được trả về', async () => {
    const parentId = await makeParent('cu@example.com');
    const childId = makeChild(parentId);
    grant(childId, ['dec-treehouse', 'dec-plant']);
    // Đúng những cặp (x, y) mà bố cục CŨ đã dùng cho hai món to nhất — nay là chỗ chồng chéo.
    seedPlacement(childId, 'dec-treehouse', 18, 62, 0);
    seedPlacement(childId, 'dec-plant', 82, 80, 0);

    expect(room.getPlacements(parentId, childId)).toEqual([]);

    /*
      ⚠️ VÀ DÒNG CŨ VẪN CÒN NGUYÊN TRONG BẢNG — đường ĐỌC không được phép xoá.
      `getPlacements` là một `SELECT`; nếu ai đó "dọn dẹp" bằng `DELETE` ở đây thì mỗi lần mở
      phòng lại là một lần phá dữ liệu, và không có cách nào lấy lại được.
    */
    expect(rawRows(childId)).toHaveLength(2);
  });

  it('(b) dòng có version HIỆN TẠI được trả về, kèm cả dòng ẩn', async () => {
    const parentId = await makeParent('moi@example.com');
    const childId = makeChild(parentId);
    grant(childId, ['dec-castle', 'dec-rainbow']);
    seedPlacement(childId, 'dec-castle', 32.9, 55.5, ROOM_LAYOUT_VERSION);
    seedPlacement(childId, 'dec-rainbow', 12, 34, ROOM_LAYOUT_VERSION, 1);

    expect(room.getPlacements(parentId, childId)).toEqual([
      { itemId: 'dec-castle', x: 32.9, y: 55.5, hidden: false },
      { itemId: 'dec-rainbow', x: 12, y: 34, hidden: true },
    ]);
  });

  it('LỌC TRỘN: chỉ dòng đúng version sống sót, dòng cũ bị bỏ qua (không xoá)', async () => {
    const parentId = await makeParent('tron@example.com');
    const childId = makeChild(parentId);
    grant(childId, ['dec-plant', 'dec-castle', 'dec-sunflower']);
    seedPlacement(childId, 'dec-plant', 82, 80, 0);
    seedPlacement(childId, 'dec-castle', 32.9, 55.5, ROOM_LAYOUT_VERSION);
    seedPlacement(childId, 'dec-sunflower', 74, 70, ROOM_LAYOUT_VERSION - 1);

    expect(room.getPlacements(parentId, childId)).toEqual([
      { itemId: 'dec-castle', x: 32.9, y: 55.5, hidden: false },
    ]);
    // Ba dòng vẫn nằm trong bảng — bỏ qua ≠ xoá.
    expect(rawRows(childId)).toHaveLength(3);
  });

  it('(c) sau `savePlacements`, MỌI dòng mang version hiện hành', async () => {
    const parentId = await makeParent('luu@example.com');
    const childId = makeChild(parentId);
    grant(childId, ['dec-plant', 'dec-castle']);

    const saved = room.savePlacements(parentId, childId, [
      { itemId: 'dec-plant', x: 19.9, y: 78, hidden: false },
      { itemId: 'dec-castle', x: 32.9, y: 55.5, hidden: true },
    ]);

    expect(saved).toEqual([
      { itemId: 'dec-castle', x: 32.9, y: 55.5, hidden: true },
      { itemId: 'dec-plant', x: 19.9, y: 78, hidden: false },
    ]);
    // Đọc THẲNG từ bảng: response đúng mà cột sai là kịch bản tệ nhất — lần mở phòng sau sẽ
    // "mất" đúng những gì bé vừa kéo.
    expect(rawRows(childId).map((row) => row.layout_version)).toEqual([
      ROOM_LAYOUT_VERSION,
      ROOM_LAYOUT_VERSION,
    ]);
  });

  it('lưu lần hai (kéo tiếp) không sinh dòng version lạc hậu', async () => {
    const parentId = await makeParent('luu2@example.com');
    const childId = makeChild(parentId);
    grant(childId, ['dec-plant']);

    room.savePlacements(parentId, childId, [{ itemId: 'dec-plant', x: 10, y: 20, hidden: false }]);
    room.savePlacements(parentId, childId, [{ itemId: 'dec-plant', x: 19.9, y: 78, hidden: false }]);

    const rows = rawRows(childId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ item_id: 'dec-plant', x: 19.9, y: 78 });
    expect(rows[0]!.layout_version).toBe(ROOM_LAYOUT_VERSION);
  });

  /*
    ⚠️ HÀNH VI CÓ CHỦ Ý — DÒNG CỦA BỐ CỤC CŨ BỊ XOÁ KHI BÉ LƯU LẠI (xem comment dài trong
    `RoomService.savePlacements`). Hai lý do: (1) API nhận TOÀN BỘ danh sách nên phải "xoá sạch rồi
    ghi lại" mới diễn đạt được "bé bỏ món này ra khỏi phòng"; (2) khoá chính là `(child_id, item_id)`
    nên dòng cũ cùng `item_id` sẽ đụng khoá khi `INSERT`. Dòng cũ vốn vô nghĩa với bố cục mới.
    Test này ghi lại đúng điều đó để một lần "sửa cho khỏi xoá" phải cố ý sửa cả test.
  */
  it('khi bé lưu lại, dòng bố cục CŨ bị thay thế (không hồi sinh, không đụng khoá chính)', async () => {
    const parentId = await makeParent('thay@example.com');
    const childId = makeChild(parentId);
    grant(childId, ['dec-plant']);
    seedPlacement(childId, 'dec-plant', 82, 80, 0);

    const saved = room.savePlacements(parentId, childId, [
      { itemId: 'dec-plant', x: 19.9, y: 78, hidden: false },
    ]);

    expect(saved).toEqual([{ itemId: 'dec-plant', x: 19.9, y: 78, hidden: false }]);
    expect(rawRows(childId)).toEqual([
      {
        item_id: 'dec-plant',
        x: 19.9,
        y: 78,
        hidden: 0,
        layout_version: ROOM_LAYOUT_VERSION,
      },
    ]);
  });

  it('`ROOM_LAYOUT_VERSION` là số nguyên ≥ 1 (0 đã dành cho "trước khi có version")', () => {
    expect(Number.isInteger(ROOM_LAYOUT_VERSION)).toBe(true);
    // 0 là DEFAULT của migration `015` — nghĩa là "dòng có từ trước". Dùng 0 làm version hiện hành
    // sẽ khiến MỌI dòng cũ đột nhiên hợp lệ trở lại, tức là tắt luôn version guard.
    expect(ROOM_LAYOUT_VERSION).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// MIGRATION `015` — CHẠY TRÊN DB ĐÃ CÓ DỮ LIỆU
// =============================================================================

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../server/db/migrations');
const MIGRATION_015 = '015_room_layout_version.sql';

/** Mọi file migration, theo thứ tự TÊN (đánh số 3 chữ số nên sort chuỗi là đúng thứ tự). */
function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

/** DB trong bộ nhớ dừng ở `014` — TRẠNG THÁI TRƯỚC khi có cột `layout_version`. */
function openDbBefore015(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  for (const file of migrationFiles()) {
    if (file >= MIGRATION_015) continue;
    db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  return db;
}

/** Gieo một bé CÓ đồ và CÓ vị trí đã lưu theo bố cục cũ — dữ liệu phải sống sót qua migration. */
function seedLegacyRoom(db: Database.Database): void {
  const now = '2026-01-01T00:00:00.000Z';
  db.prepare(
    `INSERT INTO parent_account
       (id, email, password_hash, consent_policy_version, consented_at, created_at, updated_at)
     VALUES ('par_cu', 'cu-phong@example.com', 'x', 'v1', ?, ?, ?)`,
  ).run(now, now, now);
  db.prepare(
    `INSERT INTO child_profile (id, parent_id, nickname, age, avatar_id, created_at, updated_at)
     VALUES ('chi_cu', 'par_cu', 'Na', 7, 'rabbit', ?, ?)`,
  ).run(now, now);
  db.prepare(
    'INSERT INTO inventory (child_id, item_id, quantity, equipped, acquired_at) VALUES (?, ?, 1, 0, ?)',
  ).run('chi_cu', 'dec-plant', now);
  db.prepare(
    `INSERT INTO room_decoration_placement (child_id, item_id, x, y, hidden, updated_at)
     VALUES ('chi_cu', 'dec-plant', 82, 80, 0, ?)`,
  ).run(now);
}

describe('migration 015 — thêm cột `layout_version`', () => {
  it('cột mới có DEFAULT 0 và KHÔNG xoá dòng nào', () => {
    const db = openDbBefore015();
    seedLegacyRoom(db);

    db.exec(readFileSync(join(MIGRATIONS_DIR, MIGRATION_015), 'utf8'));

    const columns = db
      .prepare('PRAGMA table_info(room_decoration_placement)')
      .all() as { name: string; dflt_value: string | null; notnull: number }[];
    const added = columns.find((column) => column.name === 'layout_version');
    expect(added, 'migration 015 phải thêm cột `layout_version`').toBeDefined();
    expect(added!.dflt_value).toBe('0');
    expect(added!.notnull).toBe(1);

    // Dòng của bé vẫn nguyên vẹn, chỉ được gán version 0 ("bố cục cũ").
    const row = db
      .prepare('SELECT item_id, x, y, hidden, layout_version FROM room_decoration_placement')
      .all() as RawRow[];
    expect(row).toEqual([
      { item_id: 'dec-plant', x: 82, y: 80, hidden: 0, layout_version: 0 },
    ]);

    db.close();
  });

  it('dùng `ALTER TABLE … ADD COLUMN` nên bảng và khoá chính cũ giữ nguyên', () => {
    const db = openDbBefore015();
    seedLegacyRoom(db);
    db.exec(readFileSync(join(MIGRATIONS_DIR, MIGRATION_015), 'utf8'));

    // Khoá chính `(child_id, item_id)` là thứ `savePlacements` dựa vào để DELETE-then-INSERT;
    // dựng lại bảng mà làm rơi nó sẽ khiến mỗi `(child_id, item_id)` chép được nhiều dòng.
    expect(() =>
      db
        .prepare(
          `INSERT INTO room_decoration_placement (child_id, item_id, x, y, hidden, updated_at, layout_version)
           VALUES ('chi_cu', 'dec-plant', 1, 1, 0, '2026-01-02T00:00:00.000Z', 2)`,
        )
        .run(),
    ).toThrow();

    db.close();
  });
});
