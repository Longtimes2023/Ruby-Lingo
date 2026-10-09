// @vitest-environment node
/**
 * QA XÁC MINH ĐỘC LẬP — Nhóm 9 (Huy hiệu & Sưu tầm).
 *
 * Tệp này KHÔNG thay thế test của kỹ sư. Nó tự dựng lại các ca tấn công mà QA phải tự tay thử:
 *
 *   • Migration 009 chạy trên DB TRỐNG và trên hàng `wallet` CŨ (giá trị suy ngược = MAX).
 *   • Bất biến "mọi đường cộng tiền đều đẩy `*_earned_total`" — một test TỔNG QUÁT, không liệt
 *     kê từng nguồn: sau khi thưởng mà CHƯA tiêu, `earned_total` phải BẰNG số dư. Lệch nhau =
 *     có đường cộng tiền đi vòng qua `addCurrencyInTx`.
 *   • `streak_days` đo `longest_streak` (đứt chuỗi hiện tại vẫn giữ huy hiệu), VÀ KHÔNG đo
 *     `max(current, longest)` (ca `current=7, longest=6` phải CHƯA đạt).
 *   • Tính NGUYÊN TỬ: nếu một bước SAU khi đã trao huy hiệu thất bại thì huy hiệu + lượt chơi
 *     cùng rollback (không có "huy hiệu cho một lượt chơi không hề được ghi").
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { closeDb, getDb, transaction } from '../../../server/db/connection.js';
import { authService } from '../../../server/services/AuthService.js';
import { badgeService } from '../../../server/services/BadgeService.js';
import { childService } from '../../../server/services/ChildService.js';
import { gameResultService } from '../../../server/services/GameResultService.js';
import { rewardService } from '../../../server/services/RewardService.js';
import { xpService } from '../../../server/services/XpService.js';

import { clearAllData, setupTestDb } from './helpers/testDb.js';

const AT = '2026-10-09T09:00:00.000Z';
const PASSWORD = 'matkhau123';

let parentId = '';
let childId = '';

beforeAll(() => {
  setupTestDb();
});

beforeEach(async () => {
  clearAllData(getDb());
  parentId = (
    await authService.signup({ email: 'bo@example.com', password: PASSWORD, parentalConsent: true })
  ).parent.id;
  childId = childService.createChild(parentId, { nickname: 'Bin', age: 7, avatarId: 'fox' }).id;
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  closeDb();
});

// =============================================================================
// Tiện ích
// =============================================================================

function evaluate(): string[] {
  return transaction((db) => badgeService.evaluate(db, childId, AT));
}

function ints(table: string, column: string): string[] {
  const rows = getDb()
    .prepare(`SELECT ${column} AS v FROM ${table} WHERE child_id = ? ORDER BY ${column}`)
    .all(childId) as { v: string }[];
  return rows.map((r) => r.v);
}

function countRows(table: string): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE child_id = ?`)
    .get(childId) as { n: number };
  return row.n;
}

function walletRow(): {
  stars: number;
  acorns: number;
  stars_earned_total: number;
  acorns_earned_total: number;
} {
  return getDb()
    .prepare(
      'SELECT stars, acorns, stars_earned_total, acorns_earned_total FROM wallet WHERE child_id = ?',
    )
    .get(childId) as {
    stars: number;
    acorns: number;
    stars_earned_total: number;
    acorns_earned_total: number;
  };
}

function setStreak(current: number, longest: number): void {
  getDb()
    .prepare('UPDATE streak_state SET current_streak = ?, longest_streak = ? WHERE child_id = ?')
    .run(current, longest, childId);
}

let seq = 0;
function run(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  seq += 1;
  return {
    clientEventId: `qa-evt-${seq}`,
    exerciseId: 'at-the-zoo/z1/listen-tap',
    lessonId: 'at-the-zoo/z1',
    gameType: 'listen_tap',
    totalRounds: 4,
    occurredAt: '2026-10-06T09:15:00.000Z',
    durationSeconds: 42,
    answers: [
      { wordId: 'w.monkey', firstTry: true, wrongAttempts: 0 },
      { wordId: 'w.lion', firstTry: true, wrongAttempts: 0 },
      { wordId: 'w.elephant', firstTry: true, wrongAttempts: 0 },
      { wordId: 'w.zebra', firstTry: true, wrongAttempts: 0 },
    ],
    ...overrides,
  };
}

// =============================================================================
// C6/C7 — MIGRATION 009 tự tay chạy trên schema tối thiểu
// =============================================================================
//
// ⚠️ Test này KHÔNG dùng runner. Nó dựng `wallet` + `daily_stats` đúng cột mà 009 đọc, nạp các
//    hàng "cũ", rồi chạy CHÍNH chuỗi SQL của 009. Nhờ vậy nó kiểm được phần SUY NGƯỢC cho hàng
//    cũ — thứ mà bộ test thật KHÔNG chạm tới (lúc migration chạy trên DB test, `wallet` còn rỗng
//    vì `clearAllData` xoá sạch trước `beforeEach`).

const MIGRATION_009_SQL = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../server/db/migrations/009_wallet_lifetime.sql',
  ),
  'utf8',
);

function legacyDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE wallet (
      child_id   TEXT PRIMARY KEY,
      stars      INTEGER NOT NULL DEFAULT 0 CHECK (stars >= 0),
      acorns     INTEGER NOT NULL DEFAULT 0 CHECK (acorns >= 0),
      updated_at TEXT NOT NULL
    );
    CREATE TABLE daily_stats (
      child_id      TEXT NOT NULL,
      date          TEXT NOT NULL,
      stars_earned  INTEGER NOT NULL DEFAULT 0 CHECK (stars_earned >= 0),
      acorns_earned INTEGER NOT NULL DEFAULT 0 CHECK (acorns_earned >= 0),
      PRIMARY KEY (child_id, date)
    );
  `);
  return db;
}

function columnsOf(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
}

describe('C6 — Migration 009 trên DB TRỐNG HOÀN TOÀN (cài mới)', () => {
  it('không ném, thêm đủ hai cột — kể cả khi `daily_stats` chưa có hàng nào', () => {
    const db = legacyDb();
    expect(() => db.exec(MIGRATION_009_SQL)).not.toThrow();

    const cols = columnsOf(db, 'wallet');
    expect(cols).toContain('stars_earned_total');
    expect(cols).toContain('acorns_earned_total');

    // Không có hàng `wallet` ⇒ UPDATE tác động 0 hàng, không lỗi.
    const n = (db.prepare('SELECT COUNT(*) AS n FROM wallet').get() as { n: number }).n;
    expect(n).toBe(0);
    db.close();
  });

  it('chạy LẦN HAI ném (ALTER TABLE) ⇒ runner BẮT BUỘC chống bằng `schema_migrations`', () => {
    const db = legacyDb();
    db.exec(MIGRATION_009_SQL);
    expect(() => db.exec(MIGRATION_009_SQL)).toThrow();
    db.close();
  });
});

describe('C7 — Migration 009 suy ngược cho hàng `wallet` CŨ', () => {
  function oldWallet(stars: number, acorns: number): Database.Database {
    const db = legacyDb();
    db.prepare(
      'INSERT INTO wallet (child_id, stars, acorns, updated_at) VALUES (?, ?, ?, ?)',
    ).run('c1', stars, acorns, '2026-01-01T00:00:00.000Z');
    return db;
  }

  function seedDaily(
    db: Database.Database,
    starsEarned: readonly number[],
    acornsEarned: readonly number[],
  ): void {
    const stmt = db.prepare(
      `INSERT INTO daily_stats (child_id, date, stars_earned, acorns_earned)
       VALUES ('c1', ?, ?, ?)`,
    );
    starsEarned.forEach((s, i) => stmt.run(`2026-01-0${i + 1}`, s, acornsEarned[i] ?? 0));
  }

  function earned(db: Database.Database): { stars: number; acorns: number } {
    return db
      .prepare('SELECT stars_earned_total AS stars, acorns_earned_total AS acorns FROM wallet')
      .get() as { stars: number; acorns: number };
  }

  it('KHÔNG có dữ liệu daily_stats ⇒ lấy đúng số dư hiện tại', () => {
    const db = oldWallet(500, 30);
    db.exec(MIGRATION_009_SQL);
    expect(earned(db)).toEqual({ stars: 500, acorns: 30 });
    db.close();
  });

  it('daily_stats cộng lại LỚN HƠN số dư (bé đã tiêu) ⇒ lấy tổng đã kiếm', () => {
    const db = oldWallet(500, 30);
    // Đã kiếm 1200 ⭐ (tiêu còn 500) và 5 🌰 (số dư 30 > 5).
    seedDaily(db, [700, 500], [0, 5]);
    db.exec(MIGRATION_009_SQL);
    // stars: MAX(500, 1200) = 1200 ; acorns: MAX(30, 5) = 30.
    expect(earned(db)).toEqual({ stars: 1200, acorns: 30 });
    db.close();
  });

  it('số dư = 0 nhưng daily_stats có dữ liệu ⇒ vẫn suy ra tổng đã kiếm', () => {
    const db = oldWallet(0, 0);
    seedDaily(db, [800], [12]);
    db.exec(MIGRATION_009_SQL);
    expect(earned(db)).toEqual({ stars: 800, acorns: 12 });
    db.close();
  });
});

// =============================================================================
// C8 — Migration 009 CÓ thực sự chạy trong bộ test (qua runner), nhưng nhánh SUY NGƯỢC thì không
// =============================================================================

describe('C8 — 009 được áp dụng thật trong DB test', () => {
  it('DB test có đủ hai cột + `schema_migrations` ghi nhận 009', () => {
    const cols = (getDb().prepare('PRAGMA table_info(wallet)').all() as { name: string }[]).map(
      (c) => c.name,
    );
    expect(cols).toContain('stars_earned_total');
    expect(cols).toContain('acorns_earned_total');

    const row = getDb()
      .prepare(
        "SELECT COUNT(*) AS n FROM schema_migrations WHERE name = '009_wallet_lifetime.sql'",
      )
      .get() as { n: number };
    expect(row.n).toBe(1);
  });
});

// =============================================================================
// B5 — MỌI đường cộng tiền đều đẩy bộ đếm tổng (test TỔNG QUÁT, không liệt kê nguồn)
// =============================================================================

describe('B5 — bất biến: chưa tiêu thì `earned_total` PHẢI bằng số dư', () => {
  it('thưởng lượt chơi + quà lên cấp ⇒ `*_earned_total` bằng đúng số dư', () => {
    gameResultService.submit(parentId, childId, run());
    // Quà lên cấp đi qua XpService → applyGrantsInTx → addCurrencyInTx.
    transaction((db) => xpService.addXpInTx(db, childId, 200, AT));

    const w = walletRow();
    expect(w.stars).toBeGreaterThan(0); // có tiền thật để so, không phải so 0 với 0
    expect(w.acorns_earned_total).toBe(w.acorns);

    /**
     * ⭐ PHÉP SO QUAN TRỌNG NHẤT: nếu tồn tại một đường cộng ⭐/🌰 KHÔNG đi qua
     *    `addCurrencyInTx`, số dư sẽ lớn hơn `*_earned_total` và dòng dưới đỏ ngay.
     */
    expect(w.stars_earned_total).toBe(w.stars);
  });

  it('`spendInTx` làm GIẢM số dư nhưng KHÔNG đụng `*_earned_total`', () => {
    transaction((db) => rewardService.addCurrencyInTx(db, childId, { stars: 400, acorns: 40 }, AT));
    transaction((db) => rewardService.spendInTx(db, childId, { stars: 150, acorns: 10 }, AT));

    expect(walletRow()).toMatchObject({
      stars: 250,
      acorns: 30,
      stars_earned_total: 400,
      acorns_earned_total: 40,
    });
  });
});

// =============================================================================
// B3 — `streak_days` đo `longest_streak`, KHÔNG đo `current_streak`
// =============================================================================

describe('B3 — chuỗi ngày: huy hiệu là vĩnh viễn', () => {
  it('current=0, longest=7 (vừa đứt chuỗi) ⇒ VẪN đạt', () => {
    setStreak(0, 7);
    expect(evaluate()).toContain('badge-streak-7');
  });

  it('⭐ current=7 nhưng longest=6 ⇒ CHƯA đạt (chứng minh KHÔNG dùng `current_streak`)', () => {
    setStreak(7, 6);
    expect(evaluate()).not.toContain('badge-streak-7');
  });
});

// =============================================================================
// B4 — `earn_currency` đo TỔNG ĐÃ KIẾM, không đo số dư
// =============================================================================

describe('B4 — kiếm đủ rồi tiêu hết vẫn giữ huy hiệu', () => {
  it('kiếm 1000 ⭐ rồi tiêu sạch ⇒ tiêu chí vẫn đúng (đo bằng tổng đã kiếm)', () => {
    transaction((db) => rewardService.addCurrencyInTx(db, childId, { stars: 1000 }, AT));
    transaction((db) => rewardService.spendInTx(db, childId, { stars: 1000 }, AT));

    expect(walletRow()).toMatchObject({ stars: 0, stars_earned_total: 1000 });
    expect(evaluate()).toContain('badge-zoo-keeper');
  });

  it('kiếm 50 🌰, tiêu hết ⇒ "Sóc chăm chỉ" vẫn đạt', () => {
    transaction((db) => rewardService.addCurrencyInTx(db, childId, { acorns: 50 }, AT));
    transaction((db) => rewardService.spendInTx(db, childId, { acorns: 50 }, AT));

    expect(walletRow()).toMatchObject({ acorns: 0, acorns_earned_total: 50 });
    expect(evaluate()).toContain('badge-diligent');
  });
});

// =============================================================================
// A1/A2 — Lũy đẳng
// =============================================================================

describe('A1/A2 — lũy đẳng', () => {
  it('evaluate HAI lần: lần hai rỗng, sổ chỉ có MỘT hàng', () => {
    setStreak(7, 7);
    expect(evaluate()).toEqual(['badge-streak-7']);
    expect(evaluate()).toEqual([]);
    expect(countRows('badge_earned')).toBe(1);
  });

  it('A2 — gửi lại ĐÚNG payload lượt chơi cũ ⇒ KHÔNG mở thêm sticker/huy hiệu', () => {
    const payload = run();
    const first = gameResultService.submit(parentId, childId, payload);
    expect(first.stickerEarned).toBe('sticker-z1');
    expect(ints('sticker_earned', 'sticker_id')).toEqual(['sticker-z1']);

    const second = gameResultService.submit(parentId, childId, payload);
    expect(second.duplicate).toBe(true);
    expect(second.stickerEarned).toBeNull();
    expect(second.badgesEarned).toEqual([]);
    expect(ints('sticker_earned', 'sticker_id')).toEqual(['sticker-z1']);
    expect(countRows('game_result')).toBe(1);
  });
});

// =============================================================================
// D9 — Tính NGUYÊN TỬ: huy hiệu nằm CHUNG transaction với lượt chơi
// =============================================================================

describe('D9 — nguyên tử', () => {
  it('đối chứng: khi mọi bước chạy đúng ⇒ lượt chơi + huy hiệu + sticker CÙNG được ghi', () => {
    setStreak(7, 7);
    const award = gameResultService.submit(parentId, childId, run());

    expect(award.badgesEarned).toContain('badge-streak-7');
    expect(award.stickerEarned).toBe('sticker-z1');
    expect(countRows('game_result')).toBe(1);
    expect(ints('badge_earned', 'badge_id')).toContain('badge-streak-7');
    expect(ints('sticker_earned', 'sticker_id')).toEqual(['sticker-z1']);
  });

  it('⭐ bước CUỐI (trao sticker) lỗi ⇒ huy hiệu đã trao VÀ lượt chơi cùng BIẾN MẤT', () => {
    setStreak(7, 7); // đủ điều kiện badge-streak-7

    // Bước trao sticker nằm SAU bước trao huy hiệu. Ép nó lỗi để xem huy hiệu có sống sót
    // ngoài transaction không — nếu có, đó là "huy hiệu cho một lượt chơi không hề được ghi".
    let badgeSeenInsideTx: string[] = [];
    vi.spyOn(rewardService, 'grantStickerInTx').mockImplementation(() => {
      // Đọc NGAY TRONG transaction: huy hiệu đã được ghi chưa ở thời điểm này?
      badgeSeenInsideTx = ints('badge_earned', 'badge_id');
      throw new Error('QA-boom');
    });

    expect(() => gameResultService.submit(parentId, childId, run())).toThrow(/QA-boom/);

    // ⭐ CHỨNG MINH THỨ TỰ: lúc bước sticker chạy, huy hiệu ĐÃ nằm trong sổ (cùng transaction).
    expect(badgeSeenInsideTx).toContain('badge-streak-7');
    // ⭐ VÀ CHỨNG MINH ROLLBACK: sau lỗi, huy hiệu đó BIẾN MẤT cùng lượt chơi — không có trạng
    //    thái "huy hiệu cho một lượt chơi chưa được ghi".
    expect(countRows('game_result')).toBe(0);
    expect(countRows('badge_earned')).toBe(0);
    expect(countRows('sticker_earned')).toBe(0);
    expect(walletRow()).toMatchObject({ stars: 0, acorns: 0 });
  });
});
