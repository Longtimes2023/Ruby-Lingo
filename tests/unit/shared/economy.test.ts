/**
 * RubyLingo — Test KINH TẾ của một lượt chơi (`shared/content/economy.ts`).
 *
 * ⭐ VÌ SAO BỘ TEST NÀY QUAN TRỌNG HƠN VẺ NGOÀI CỦA NÓ:
 *   `rewardsForGameRun` là HÀM THUẦN quyết định "một lượt chơi đáng bao nhiêu ⭐/XP". Server dùng
 *   chính nó để chấm (server là trọng tài cuối). Vì ví là CỘNG DỒN, một con số lệch ở đây ở lại
 *   vĩnh viễn và không phân biệt được với một bé thật sự đã chơi ngần ấy. Nằm ở `shared/` nên test
 *   được mà không cần DB, không cần dựng service.
 *
 * ⚠️ HAI CÁI BẪY IM LẶNG ĐƯỢC CANH RIÊNG:
 *   1. `??` vs `||`: nguồn kẹp đầu vào bằng `Math.floor(x) || 0`. Đúng đắn CHỈ vì giá trị thay thế
 *      trùng với "không" hợp lệ (0). Test khoá lại: phần thưởng 0 phải GIỮ NGUYÊN 0, và `NaN`
 *      phải bị kẹp về 0 — nếu ai đó đổi `||` thành `??` thì `NaN` lọt thẳng vào phép cộng.
 *   2. `STREAK_REWARDS` là `Record<number, …>`: tra một mốc KHÔNG có trong bảng (ví dụ chuỗi 8)
 *      trả về `undefined` mà KHÔNG có hàm tra nào kèm fallback. Test ghi lại khoảng trống đó thay
 *      vì che đi.
 */

import { describe, expect, it } from 'vitest';

import { STREAK_MILESTONES as CONSTANTS_STREAK_MILESTONES } from '@shared/constants.js';
import {
  STARS,
  STREAK_MILESTONES,
  STREAK_REWARDS,
  XP,
  rewardsForGameRun,
} from '@shared/content/economy.js';
import type { GameRunResult } from '@shared/game-scoring.js';

// =============================================================================
// Bộ dựng dữ liệu
// =============================================================================

/** Một lượt chơi đã chấm, hợp lệ tối thiểu; từng test ghi đè đúng trường nó muốn xét. */
function makeRun(overrides: Partial<GameRunResult> = {}): GameRunResult {
  return {
    stars: 1,
    score: 0,
    streakBonus: 0,
    correctFirstTry: 0,
    answered: 0,
    totalRounds: 4,
    completed: false,
    longestStreak: 0,
    ...overrides,
  };
}

// =============================================================================
// Số 0 phải GIỮ NGUYÊN 0
// =============================================================================

describe('rewardsForGameRun — phần thưởng bằng 0', () => {
  /**
   * ⭐ VÌ SAO ĐẶC BIỆT: nguồn viết `Math.max(0, Math.floor(correctFirstTry) || 0)`. Vế `|| 0` chỉ
   *   an toàn vì giá trị thay thế TRÙNG với giá trị hợp lệ (0). Nếu ai đó đổi thành một mặc định
   *   KHÁC 0, một bé chưa trả lời đúng câu nào sẽ bỗng có phần thưởng. Test này khoá lại.
   */
  it('không đúng câu nào và chưa xong ⇒ 0 sao, 0 hạt dẻ, 0 XP', () => {
    expect(rewardsForGameRun('listen_tap', makeRun(), 0)).toEqual({
      stars: 0,
      acorns: 0,
      xp: 0,
    });
  });

  /**
   * ⚠️ NaN LÀ LOẠI HỎNG VÔ HÌNH: nó lan qua mọi phép cộng và GHI ĐƯỢC vào SQLite; sau đó mọi so
   *   sánh với nó đều trả về "không đúng", nên lỗi đi qua im lặng. Nếu `|| 0` bị đổi thành `?? 0`,
   *   `NaN ?? 0` vẫn là `NaN` ⇒ hai test dưới chuyển đỏ.
   */
  it('NaN ở số câu đúng bị kẹp về 0 (không làm phần thưởng thành NaN)', () => {
    const result = rewardsForGameRun('listen_tap', makeRun({ correctFirstTry: Number.NaN }), 0);

    expect(result).toEqual({ stars: 0, acorns: 0, xp: 0 });
    expect(Number.isFinite(result.stars)).toBe(true);
    expect(Number.isFinite(result.xp)).toBe(true);
  });

  it('NaN ở số từ mới bị kẹp về 0', () => {
    expect(rewardsForGameRun('listen_tap', makeRun(), Number.NaN)).toEqual({
      stars: 0,
      acorns: 0,
      xp: 0,
    });
  });

  it('đầu vào âm bị kẹp về 0', () => {
    expect(rewardsForGameRun('listen_tap', makeRun({ correctFirstTry: -5 }), -3)).toEqual({
      stars: 0,
      acorns: 0,
      xp: 0,
    });
  });
});

// =============================================================================
// Công thức phần thưởng
// =============================================================================

describe('rewardsForGameRun — công thức', () => {
  it('bài chơi hoàn hảo: điểm câu đúng + thưởng hoàn thành', () => {
    const result = rewardsForGameRun('listen_tap', makeRun({ correctFirstTry: 4, completed: true }), 0);

    // listen_tap: 2 ⭐/câu + 10 ⭐ hoàn thành ⇒ 4*2 + 10 = 18.
    expect(result.stars).toBe(4 * STARS.perCorrectAnswer.listen_tap + STARS.perGameCompleted.listen_tap);
    expect(result.stars).toBe(18);
    expect(result.xp).toBe(4 * XP.perCorrectAnswer + XP.perGameCompleted);
    expect(result.xp).toBe(18);
  });

  it('thưởng hoàn thành CHỈ được cộng khi completed = true', () => {
    const notDone = rewardsForGameRun('listen_tap', makeRun({ correctFirstTry: 3 }), 0);
    const done = rewardsForGameRun('listen_tap', makeRun({ correctFirstTry: 3, completed: true }), 0);

    expect(done.stars - notDone.stars).toBe(STARS.perGameCompleted.listen_tap);
    expect(done.xp - notDone.xp).toBe(XP.perGameCompleted);
  });

  it('từ mới được thưởng đúng số ⭐/XP của nó', () => {
    const result = rewardsForGameRun('listen_tap', makeRun(), 3);

    expect(result.stars).toBe(3 * STARS.perNewWordLearned);
    expect(result.xp).toBe(3 * XP.perNewWordLearned);
  });

  it('hạt dẻ luôn bằng 0 cho một lượt chơi game', () => {
    expect(rewardsForGameRun('listen_tap', makeRun({ correctFirstTry: 4, completed: true }), 3).acorns).toBe(
      0,
    );
  });
});

// =============================================================================
// Biên và tính đơn điệu
// =============================================================================

describe('rewardsForGameRun — biên và tính đơn điệu', () => {
  it('điểm rất lớn vẫn hữu hạn và đúng công thức', () => {
    const result = rewardsForGameRun('listen_tap', makeRun({ correctFirstTry: 10000, completed: true }), 0);

    expect(result.stars).toBe(10000 * STARS.perCorrectAnswer.listen_tap + STARS.perGameCompleted.listen_tap);
    expect(result.stars).toBe(20010);
    expect(Number.isFinite(result.stars)).toBe(true);
    expect(Number.isFinite(result.xp)).toBe(true);
  });

  /**
   * ⭐ ĐƠN ĐIỆU: đúng thêm câu không bao giờ được ít thưởng hơn. Nếu một chỉnh cân bằng vô tình
   *   tạo hệ số âm, tính chất này vỡ và test chuyển đỏ.
   */
  it('số câu đúng tăng ⇒ phần thưởng KHÔNG giảm', () => {
    const rewards = [0, 1, 2, 5, 50].map((n) =>
      rewardsForGameRun('listen_tap', makeRun({ correctFirstTry: n, completed: true }), 0),
    );

    for (let i = 1; i < rewards.length; i += 1) {
      expect(rewards[i]!.stars).toBeGreaterThanOrEqual(rewards[i - 1]!.stars);
      expect(rewards[i]!.xp).toBeGreaterThanOrEqual(rewards[i - 1]!.xp);
    }
  });

  it('không sửa đầu vào (hàm thuần)', () => {
    const run = makeRun({ correctFirstTry: 3, completed: true });
    const before = JSON.stringify(run);

    rewardsForGameRun('listen_tap', run, 2);

    expect(JSON.stringify(run)).toBe(before);
  });
});

// =============================================================================
// `STREAK_REWARDS` — không có lỗ, và KHÔNG có fallback
// =============================================================================

describe('STREAK_REWARDS — bảng mốc chuỗi ngày', () => {
  /**
   * ⭐ KHÔNG CÓ LỖ: mọi mốc trong `STREAK_MILESTONES` phải có một phần thưởng. Một mốc thiếu ở
   *   đây ⇒ `STREAK_REWARDS[streak]` trả `undefined` và mọi phép cộng sau đó thành `NaN`.
   */
  it('mọi mốc chuỗi đều có phần thưởng (không lỗ)', () => {
    for (const milestone of STREAK_MILESTONES) {
      expect(STREAK_REWARDS[milestone]).toBeDefined();
    }
  });

  it('khoá của STREAK_REWARDS khớp ĐÚNG STREAK_MILESTONES (không thừa, không thiếu)', () => {
    const rewardKeys = Object.keys(STREAK_REWARDS)
      .map(Number)
      .sort((a, b) => a - b);

    expect(rewardKeys).toEqual([...STREAK_MILESTONES].sort((a, b) => a - b));
  });

  /**
   * ⚠️ RỦI RO ĐÃ BIẾT — GHI LẠI THAY VÌ CHE: KHÔNG có hàm tra nào kèm fallback cho mốc không nằm
   *   trong bảng. Với chuỗi 8 (không phải mốc), `STREAK_REWARDS[8]` là `undefined`. Bất kỳ người
   *   dùng tương lai nào tra thẳng đều phải tự canh `undefined`, nếu không sẽ cộng phải `NaN`.
   */
  it('mốc KHÔNG có trong bảng trả về undefined (chưa có fallback)', () => {
    expect(STREAK_REWARDS[8]).toBeUndefined();
  });

  it('phần thưởng tăng dần theo mốc (mốc sau không nhỏ hơn mốc trước)', () => {
    const ordered = [...STREAK_MILESTONES].sort((a, b) => a - b);

    for (let i = 1; i < ordered.length; i += 1) {
      const prev = STREAK_REWARDS[ordered[i - 1]!]!;
      const cur = STREAK_REWARDS[ordered[i]!]!;

      expect(cur.stars).toBeGreaterThan(prev.stars);
      expect(cur.acorns).toBeGreaterThanOrEqual(prev.acorns);
      expect(cur.xp).toBeGreaterThanOrEqual(prev.xp);
    }
  });

  /**
   * ⚠️⚠️ DRIFT: `STREAK_MILESTONES` bị KHAI HAI LẦN — `shared/content/economy.ts:255` và
   *   `shared/constants.ts:90` (cùng là [3, 7, 14, 30]). `StreakFlame` dùng bản của `constants.ts`
   *   còn bảng quà dùng bản của `economy.ts`. Hai danh sách cho CÙNG một luật là hai chỗ để lệch.
   *   Test dưới đây buộc hai bản phải bằng nhau: sửa một bản mà quên bản kia ⇒ suite chuyển đỏ.
   */
  it('DRIFT: STREAK_MILESTONES ở economy khớp bản ở constants', () => {
    expect([...STREAK_MILESTONES]).toEqual([...CONSTANTS_STREAK_MILESTONES]);
  });
});
