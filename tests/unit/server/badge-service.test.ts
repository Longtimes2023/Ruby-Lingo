// @vitest-environment node
/**
 * RubyLingo — chốt chặn cho `BadgeService` (T068).
 *
 * ⭐⭐ VÌ SAO TỆP NÀY TỒN TẠI — BỐN LỖI IM LẶNG MÀ CHỈ TEST NÀY BẮT ĐƯỢC:
 *
 *  1. **TRAO LẠI HUY HIỆU ĐÃ CÓ.** Huy hiệu là SƯU TẦM, đã đạt là vĩnh viễn. Nếu `evaluate`
 *     trả về cả huy hiệu cũ (không dựa vào `grantBadgeInTx`), client sẽ ăn mừng lại mỗi lần
 *     đánh giá — mỗi lượt chơi một lần "Bé vừa có huy hiệu X!" cho đúng một huy hiệu.
 *  2. **HUY HIỆU ĐO BẰNG ĐẠI LƯỢNG TỤT.** `streak_days` phải đo `longest_streak`; `earn_currency`
 *     phải đo TỔNG ĐÃ KIẾM. Đo bằng `current_streak`/số dư thì bé đứt chuỗi (hoặc tiêu ⭐) sẽ
 *     "mất" một huy hiệu đã đạt — đúng thứ mô hình sưu tầm cấm.
 *  3. **"HOÀN THÀNH BÀI" MƠ HỒ.** Nếu định nghĩa hoàn thành lệch khỏi `completed = 1` (định
 *     nghĩa `QuestService` đang dùng), bé có thể có huy hiệu mà nhiệm vụ vẫn hiện chưa xong.
 *  4. **ĐÁNH GIÁ SAI TẠI THỜI ĐIỂM GHI.** `ProgressService` phải chấm huy hiệu ngay sau khi đặt
 *     `completed = 1`, trong cùng transaction — nếu không, huy hiệu chỉ được trao LỎNG ở lượt
 *     chơi game kế tiếp, hoặc không bao giờ.
 *
 * ⚠️ MỌI LỜI GỌI `evaluate` ĐỀU NẰM TRONG `transaction(...)` — đúng như người gọi thật. Gọi
 *    ngoài transaction là bỏ qua chính hợp đồng mà service này ràng buộc.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDb, getDb, transaction } from '../../../server/db/connection.js';
import { authService } from '../../../server/services/AuthService.js';
import { badgeService } from '../../../server/services/BadgeService.js';
import { childService } from '../../../server/services/ChildService.js';
import { progressService } from '../../../server/services/ProgressService.js';
import { rewardService } from '../../../server/services/RewardService.js';
import { getBadge } from '../../../shared/content/badges.js';

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

afterAll(() => {
  closeDb();
});

// =============================================================================
// Tiện ích test
// =============================================================================

/** Đánh giá huy hiệu TRONG một transaction — đúng hợp đồng của `evaluate`. */
function evaluate(): string[] {
  return transaction((db) => badgeService.evaluate(db, childId, AT));
}

/** id huy hiệu ĐANG có trong sổ của bé (đọc từ BẢNG, không chỉ giá trị trả về). */
function earnedIds(): string[] {
  const rows = getDb()
    .prepare('SELECT badge_id FROM badge_earned WHERE child_id = ? ORDER BY badge_id')
    .all(childId) as { badge_id: string }[];
  return rows.map((row) => row.badge_id);
}

/**
 * Ghi một hàng `lesson_progress`.
 *
 * ⚠️ Đây KHÔNG phải đường vòng "làm giả" sự thật — `BadgeService` chỉ ĐỌC bảng này; người ghi
 *    thật là `ProgressService` / `GameResultService`. Test nào cần tiền đề "bé đã xong bài X"
 *    thì phải tự dựng tiền đề đó (giống `quest-service.test.ts`).
 */
function setLesson(lessonId: string, opts: { completed?: boolean; starsBest?: number } = {}): void {
  const completed = opts.completed === true ? 1 : 0;
  const starsBest = opts.starsBest ?? 0;
  getDb()
    .prepare(
      `INSERT INTO lesson_progress
         (child_id, lesson_id, best_score, stars_best, attempts, completed, completed_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)
       ON CONFLICT (child_id, lesson_id) DO UPDATE SET
         best_score   = excluded.best_score,
         stars_best   = excluded.stars_best,
         completed    = excluded.completed,
         completed_at = excluded.completed_at,
         updated_at   = excluded.updated_at`,
    )
    .run(childId, lessonId, starsBest * 10, starsBest, completed, completed ? AT : null, AT);
}

/** Thêm `count` lượt chơi loại `gameType` vào nhật ký. */
function addGameRuns(gameType: string, count: number): void {
  const stmt = getDb().prepare(
    `INSERT INTO game_result
       (id, child_id, client_event_id, exercise_id, lesson_id, game_type,
        total_questions, correct_count, created_at)
     VALUES (?, ?, ?, ?, 'at-the-zoo/z1', ?, 4, 4, ?)`,
  );
  for (let i = 0; i < count; i += 1) {
    stmt.run(`gr-${gameType}-${i}`, childId, `evt-${gameType}-${i}`, `ex-${gameType}`, gameType, AT);
  }
}

/** Chuỗi ngày: bé có thể đang "đứt chuỗi" (`current = 0`) nhưng đã từng đạt mốc dài hơn. */
function setStreak(current: number, longest: number): void {
  getDb()
    .prepare('UPDATE streak_state SET current_streak = ?, longest_streak = ? WHERE child_id = ?')
    .run(current, longest, childId);
}

function setXp(xp: number, level: number): void {
  getDb()
    .prepare('UPDATE xp_state SET xp = ?, level = ? WHERE child_id = ?')
    .run(xp, level, childId);
}

/** Cộng tiền ĐI QUA SERVICE thật (nên `*_earned_total` cũng được cập nhật). */
function earn(amount: { stars?: number; acorns?: number }): void {
  transaction((db) => rewardService.addCurrencyInTx(db, childId, amount, AT));
}

function walletRow(): { stars: number; acorns: number; stars_earned_total: number; acorns_earned_total: number } {
  return getDb()
    .prepare(
      'SELECT stars, acorns, stars_earned_total, acorns_earned_total FROM wallet WHERE child_id = ?',
    )
    .get(childId) as { stars: number; acorns: number; stars_earned_total: number; acorns_earned_total: number };
}

/** Sắp xếp để khẳng định không phụ thuộc thứ tự trong danh mục. */
function sorted(ids: string[]): string[] {
  return [...ids].sort();
}

// =============================================================================
// Sáu loại tiêu chí SUY TỪ SỔ — mỗi loại một ca ĐẠT và một ca CHƯA ĐẠT
// =============================================================================

describe('BadgeService.evaluate — tiêu chí suy từ sổ', () => {
  it('bé mới toanh: KHÔNG có huy hiệu nào', () => {
    expect(evaluate()).toEqual([]);
    expect(earnedIds()).toEqual([]);
  });

  describe('complete_lesson', () => {
    it('CHƯA hoàn thành bài ⇒ không có "Bước đầu tiên"', () => {
      expect(evaluate()).not.toContain('badge-first-step');
      expect(earnedIds()).toEqual([]);
    });

    it('đã hoàn thành at-the-zoo/z1 ⇒ trao "Bước đầu tiên"', () => {
      setLesson('at-the-zoo/z1', { completed: true });
      expect(evaluate()).toEqual(['badge-first-step']);
      expect(earnedIds()).toEqual(['badge-first-step']);
    });

    it('⭐ "hoàn thành" = `completed = 1`, KHÔNG phải có điểm cao từ game', () => {
      // Bài có kỷ lục 3 sao nhưng CHƯA được học xong (completed = 0 — đúng như một lượt chơi
      // game để lại) ⇒ CHƯA tính là hoàn thành. Đây là định nghĩa dùng chung với `QuestService`.
      setLesson('at-the-zoo/z1', { completed: false, starsBest: 3 });
      expect(evaluate()).not.toContain('badge-first-step');
    });
  });

  describe('complete_theme', () => {
    const ZOO = ['at-the-zoo/z1', 'at-the-zoo/z2', 'at-the-zoo/z3'];

    it('thiếu MỘT bài ⇒ chưa có "Bạn của sở thú"', () => {
      setLesson(ZOO[0] as string, { completed: true });
      setLesson(ZOO[1] as string, { completed: true });
      expect(evaluate()).not.toContain('badge-zoo-friend');
    });

    it('đủ CẢ BA bài ⇒ trao "Bạn của sở thú"', () => {
      for (const lessonId of ZOO) setLesson(lessonId, { completed: true });
      expect(evaluate()).toContain('badge-zoo-friend');
    });
  });

  describe('perfect_lessons', () => {
    /**
     * Ngưỡng LẤY TỪ DANH MỤC, không hardcode — đổi `count` trong `badges.json` là test đi theo,
     * thay vì đỏ oan. (Ngưỡng hiện tại là 3, khớp trần "số bài có game" của nội dung MVP —
     * `badges-content.test.ts` canh chuyện đó ở tầng nội dung.)
     */
    const needed = (() => {
      const badge = getBadge('badge-perfect');
      if (!badge || badge.criteria.kind !== 'perfect_lessons') {
        throw new Error('badge-perfect phải có criteria kind = perfect_lessons');
      }
      return badge.criteria.count;
    })();

    it(`thiếu MỘT bài (${needed - 1}) ⇒ chưa đủ "Hoàn hảo"`, () => {
      for (let i = 1; i <= needed - 1; i += 1) setLesson(`x/l${i}`, { starsBest: 3 });
      expect(evaluate()).not.toContain('badge-perfect');
    });

    it(`đủ ${needed} bài 3 sao ⇒ trao "Hoàn hảo"`, () => {
      for (let i = 1; i <= needed; i += 1) setLesson(`x/l${i}`, { starsBest: 3 });
      expect(evaluate()).toContain('badge-perfect');
    });
  });

  describe('streak_days', () => {
    it('chuỗi dài nhất 6 ngày ⇒ chưa có "Bền bỉ" (cần 7)', () => {
      setStreak(6, 6);
      expect(evaluate()).not.toContain('badge-streak-7');
    });

    it('chuỗi dài nhất 7 ngày ⇒ trao "Bền bỉ"', () => {
      setStreak(7, 7);
      expect(evaluate()).toContain('badge-streak-7');
    });

    /**
     * ⭐⭐ CA CHỐNG HỒI QUY QUAN TRỌNG NHẤT CỦA NHÓM NÀY.
     *
     *   Bé TỪNG đạt 7 ngày rồi đứt chuỗi: `current_streak = 0` nhưng `longest_streak = 7`.
     *   Huy hiệu là SƯU TẦM VĨNH VIỄN ⇒ VẪN đạt. Nếu ai đó "đơn giản hoá" hàm này sang
     *   `current_streak`, test này đỏ ngay — và đó là điều duy nhất ngăn nó xảy ra.
     */
    it('⭐⭐ đứt chuỗi hiện tại NHƯNG `longest_streak` đủ ⇒ VẪN giữ huy hiệu', () => {
      setStreak(0, 7);
      expect(evaluate()).toContain('badge-streak-7');
    });
  });

  describe('reach_level', () => {
    it('cấp 1 ⇒ chưa có huy hiệu cấp 2', () => {
      setXp(0, 1);
      expect(evaluate()).not.toContain('badge-forest-friend');
    });

    it('đạt cấp 2 (150 XP) ⇒ trao huy hiệu cấp 2', () => {
      setXp(150, 2);
      expect(evaluate()).toContain('badge-forest-friend');
    });

    it('⭐ cấp được TÍNH LẠI từ `xp`, không tin cột `level` đã lưu', () => {
      // Cột `level` nói 1 (bản ghi đệm cũ) nhưng `xp` đã đủ cho cấp 2 ⇒ vẫn phải trao.
      setXp(150, 1);
      expect(evaluate()).toContain('badge-forest-friend');
    });
  });

  describe('win_game', () => {
    it('19 lượt Nghe & Chạm ⇒ chưa có "Tai thính" (cần 20)', () => {
      addGameRuns('listen_tap', 19);
      expect(evaluate()).not.toContain('badge-good-ear');
    });

    it('20 lượt Nghe & Chạm ⇒ trao "Tai thính"; loại game khác KHÔNG tính lẫn', () => {
      addGameRuns('listen_tap', 20);
      const earned = evaluate();
      expect(earned).toContain('badge-good-ear');
      // 0 lượt Lật thẻ ⇒ huy hiệu Lật thẻ (cần 10) chưa đạt — đếm theo `game_type`, không gộp.
      expect(earned).not.toContain('badge-memory-master');
    });
  });

  describe('earn_currency', () => {
    it('999 ⭐ ⇒ chưa có "Người chăm vườn thú" (cần 1000)', () => {
      earn({ stars: 999 });
      expect(evaluate()).not.toContain('badge-zoo-keeper');
    });

    it('1000 ⭐ ⇒ trao "Người chăm vườn thú"', () => {
      earn({ stars: 1000 });
      expect(evaluate()).toContain('badge-zoo-keeper');
    });

    it('50 🌰 ⇒ trao "Sóc chăm chỉ"', () => {
      earn({ acorns: 50 });
      expect(evaluate()).toContain('badge-diligent');
    });

    /**
     * ⭐⭐ CA CHỐNG HỒI QUY: KIẾM ĐỦ RỒI TIÊU HẾT.
     *
     *   Bé kiếm 1000 ⭐ (nhận huy hiệu), rồi mua sạch ⇒ số dư về 0. Nếu `earn_currency` đo bằng
     *   SỐ DƯ, lần đọc sau sẽ nói "chưa đạt" — hai câu trả lời cho một sự thật. Đo bằng TỔNG ĐÃ
     *   KIẾM thì huy hiệu đứng vững.
     */
    it('⭐⭐ kiếm 1000 ⭐ rồi TIÊU HẾT ⇒ vẫn đạt (đo tổng đã kiếm, không đo số dư)', () => {
      earn({ stars: 1000 });
      transaction((db) => rewardService.spendInTx(db, childId, { stars: 1000 }, AT));

      expect(walletRow()).toMatchObject({ stars: 0, stars_earned_total: 1000 });
      expect(evaluate()).toContain('badge-zoo-keeper');
    });
  });
});

// =============================================================================
// Lũy đẳng — "đạt rồi thì KHÔNG trao lại"
// =============================================================================

describe('BadgeService.evaluate — lũy đẳng', () => {
  it('chạy HAI lần trên cùng trạng thái ⇒ lần hai trả mảng RỖNG', () => {
    setStreak(0, 7);
    expect(evaluate()).toEqual(['badge-streak-7']);
    expect(evaluate()).toEqual([]);

    // Và trong sổ vẫn chỉ MỘT hàng.
    const count = getDb()
      .prepare("SELECT COUNT(*) AS n FROM badge_earned WHERE child_id = ? AND badge_id = 'badge-streak-7'")
      .get(childId) as { n: number };
    expect(count.n).toBe(1);
  });

  it('nhiều huy hiệu cùng lúc: lần đầu trả HẾT cái mới, lần sau rỗng', () => {
    setStreak(7, 7);
    for (let i = 1; i <= 10; i += 1) setLesson(`x/l${i}`, { starsBest: 3 });

    expect(sorted(evaluate())).toEqual(sorted(['badge-streak-7', 'badge-perfect']));
    expect(evaluate()).toEqual([]);
  });
});

// =============================================================================
// Tích hợp Luồng FLASHCARD — nơi `completed = 1` thật sự được đặt
// =============================================================================

describe('ProgressService.sync — trao huy hiệu "hoàn thành bài" ngay khi học xong', () => {
  /**
   * ⚠️ Nếu `ProgressService` không gọi `BadgeService`, test này đỏ: sau khi đồng bộ một sự kiện
   *    `lesson_completed`, sổ huy hiệu vẫn rỗng — và huy hiệu "Bước đầu tiên" chỉ hiện ra (nếu
   *    có) ở một lượt chơi game sau đó, hoặc không bao giờ.
   */
  it('đồng bộ "học xong at-the-zoo/z1" ⇒ "Bước đầu tiên" vào sổ ngay', () => {
    progressService.sync(parentId, childId, {
      events: [
        {
          clientEventId: 'evt-flashcard-1',
          kind: 'lesson_completed',
          lessonId: 'at-the-zoo/z1',
          occurredAt: AT,
        },
      ],
      since: null,
    });

    expect(earnedIds()).toContain('badge-first-step');
  });

  it('bài KHÔNG có huy hiệu tương ứng vẫn đồng bộ bình thường (không ném)', () => {
    const res = progressService.sync(parentId, childId, {
      events: [
        {
          clientEventId: 'evt-flashcard-2',
          kind: 'lesson_completed',
          lessonId: 'khong/co-huy-hieu',
          occurredAt: AT,
        },
      ],
      since: null,
    });

    expect(res.applied).toBe(1);
    expect(earnedIds()).toEqual([]);
  });
});
