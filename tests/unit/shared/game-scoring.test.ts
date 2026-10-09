/**
 * Test cho LUẬT CHẤM ĐIỂM GAME (`shared/game-scoring.ts`).
 *
 * Bộ test này khoá lại ba RÀNG BUỘC CỨNG của thiết kế, vì cả ba đều là loại lỗi "im lặng":
 * không cổng nào khác bắt được, và triệu chứng chỉ lộ ra khi một đứa trẻ 7 tuổi nhìn thấy
 * "0 sao" trên màn hình.
 *
 *   1. Không bao giờ 0 sao.
 *   2. Không trừ điểm khi sai.
 *   3. Không có đồng hồ (nên không có tham số thời gian nào ở đây).
 */

import { describe, expect, it } from 'vitest';

import {
  GAME_HEARTS,
  GAME_ROUND_POINTS,
  MAX_WRONG_PER_ROUND,
  STREAK_BONUS_EVERY,
  STREAK_BONUS_MAX,
  pointsForRound,
  starsForRun,
  streakBonusFor,
  summarizeGameRun,
} from '../../../shared/game-scoring.js';
import type { GameRunRaw } from '../../../shared/game-scoring.js';
import { GAME_LABELS, MVP_GAME_TYPES } from '../../../shared/types/content.js';

/** Dữ liệu thô hợp lệ, để mỗi test chỉ phải nêu trường nó quan tâm. */
function raw(overrides: Partial<GameRunRaw> = {}): GameRunRaw {
  return {
    totalRounds: 10,
    correctFirstTry: 0,
    answered: 0,
    wrongAttempts: 0,
    longestStreak: 0,
    endedEarly: false,
    roundScore: 0,
    ...overrides,
  };
}

// =============================================================================
// Ràng buộc cứng #1 — KHÔNG BAO GIỜ 0 SAO
// =============================================================================

describe('starsForRun — KHÔNG BAO GIỜ 0 sao', () => {
  it('trả 1 sao khi bé sai hết', () => {
    expect(starsForRun(0, 10)).toBe(1);
  });

  it('trả 1 sao khi lượt chơi không có câu nào', () => {
    expect(starsForRun(0, 0)).toBe(1);
  });

  it('trả 1 sao ngay cả khi tổng số câu là số âm (dữ liệu bẩn)', () => {
    expect(starsForRun(0, -5)).toBe(1);
  });

  it('kết quả luôn nằm trong 1..3 với mọi cặp đầu vào trong khoảng hợp lệ', () => {
    for (let total = 0; total <= 20; total += 1) {
      for (let correct = 0; correct <= total; correct += 1) {
        const stars = starsForRun(correct, total);
        expect(stars, `${correct}/${total}`).toBeGreaterThanOrEqual(1);
        expect(stars, `${correct}/${total}`).toBeLessThanOrEqual(3);
      }
    }
  });
});

// =============================================================================
// Ngưỡng sao
// =============================================================================

describe('starsForRun — ngưỡng 90% và 70%', () => {
  it('10/10 ⇒ 3 sao', () => {
    expect(starsForRun(10, 10)).toBe(3);
  });

  it('9/10 ⇒ 3 sao (đúng biên "≥ 90%", và cũng là "≤ 1 lỗi")', () => {
    expect(starsForRun(9, 10)).toBe(3);
  });

  it('8/10 ⇒ 2 sao (vừa dưới ngưỡng 3 sao)', () => {
    expect(starsForRun(8, 10)).toBe(2);
  });

  it('7/10 ⇒ 2 sao (đúng biên "≥ 70%")', () => {
    expect(starsForRun(7, 10)).toBe(2);
  });

  it('6/10 ⇒ 1 sao (4 lỗi, vượt cả hai ngưỡng)', () => {
    expect(starsForRun(6, 10)).toBe(1);
  });

  it('5/10 ⇒ 1 sao', () => {
    expect(starsForRun(5, 10)).toBe(1);
  });

  it('đúng nhiều hơn tổng số câu thì bị kẹp lại, không vượt 3 sao', () => {
    expect(starsForRun(99, 10)).toBe(3);
  });

  it('số âm bị kẹp về 0 ⇒ vẫn 1 sao, không ném lỗi', () => {
    expect(starsForRun(-3, 10)).toBe(1);
  });
});

// -----------------------------------------------------------------------------
// ⭐ Nhánh "≤ N lỗi" — cần cho các game có ÍT câu
// -----------------------------------------------------------------------------
//
// Thiết kế viết "≥ 90% câu (hoặc ≤ 1 lỗi)". Hai cách nói đó chỉ trùng nhau khi số câu chia hết
// cho 10. Với 6 câu, 90% đòi đúng cả 6 — trong khi "≤ 1 lỗi" là 5/6. Bộ test dưới đây khoá lại
// việc đọc theo HƯỚNG RỘNG RÃI, đúng tinh thần "không tạo áp lực".

describe('starsForRun — game ít câu vẫn phải rộng rãi', () => {
  it('⭐ 6 câu (missing_letter): 5/6 = 83% vẫn 3 sao, vì chỉ sai 1 câu', () => {
    expect(starsForRun(5, 6)).toBe(3);
  });

  it('6 câu: 6/6 ⇒ 3 sao', () => {
    expect(starsForRun(6, 6)).toBe(3);
  });

  it('6 câu: 4/6 (sai 2 câu) ⇒ 2 sao', () => {
    expect(starsForRun(4, 6)).toBe(2);
  });

  it('6 câu: 3/6 (sai 3 câu) ⇒ 1 sao', () => {
    expect(starsForRun(3, 6)).toBe(1);
  });

  it('⭐ 4 câu (prepositions): 3/4 vẫn 3 sao, vì chỉ sai 1 câu', () => {
    expect(starsForRun(3, 4)).toBe(3);
  });

  it('4 câu: 2/4 (sai 2 câu) ⇒ 2 sao', () => {
    expect(starsForRun(2, 4)).toBe(2);
  });

  it('4 câu: 1/4 ⇒ 1 sao', () => {
    expect(starsForRun(1, 4)).toBe(1);
  });

  it('⭐ thang sao phải MƯỢT: đúng thêm câu thì không bao giờ tụt sao', () => {
    // Không có "vực": đọc thuần theo tỉ lệ ở 4 câu sẽ cho 4→3, 3→2, 2→1 (rơi một bậc mỗi câu).
    for (const total of [4, 5, 6, 10, 12]) {
      for (let correct = 0; correct < total; correct += 1) {
        expect(
          starsForRun(correct + 1, total),
          `${correct + 1}/${total} phải ≥ ${correct}/${total}`,
        ).toBeGreaterThanOrEqual(starsForRun(correct, total));
      }
    }
  });

  it('⭐ không có VỰC: 4 câu thì 4→3 sao và 3→3 sao (không rơi ngay khi sai một câu)', () => {
    expect(starsForRun(4, 4)).toBe(3);
    expect(starsForRun(3, 4)).toBe(3);
  });
});

// =============================================================================
// Thưởng chuỗi 🔥
// =============================================================================

describe('streakBonusFor — chuỗi 🔥', () => {
  it('chuỗi ngắn hơn 3 thì không có thưởng', () => {
    expect(streakBonusFor(0)).toBe(0);
    expect(streakBonusFor(1)).toBe(0);
    expect(streakBonusFor(2)).toBe(0);
  });

  it('cứ 3 câu liên tiếp thì +1 điểm', () => {
    expect(streakBonusFor(3)).toBe(1);
    expect(streakBonusFor(5)).toBe(1);
    expect(streakBonusFor(6)).toBe(2);
    expect(streakBonusFor(9)).toBe(3);
  });

  it('không vượt trần 5 điểm cho một lượt', () => {
    expect(streakBonusFor(15)).toBe(STREAK_BONUS_MAX);
    expect(streakBonusFor(1000)).toBe(STREAK_BONUS_MAX);
  });

  it('trần đúng bằng 5', () => {
    expect(STREAK_BONUS_MAX).toBe(5);
    expect(STREAK_BONUS_EVERY).toBe(3);
  });

  it('chuỗi âm không cho ra thưởng âm', () => {
    expect(streakBonusFor(-10)).toBe(0);
  });
});

// =============================================================================
// Điểm từng câu
// =============================================================================

describe('pointsForRound — không trừ điểm khi sai', () => {
  it('đúng ngay lần đầu ⇒ điểm đầy đủ', () => {
    expect(pointsForRound(5, true)).toBe(5);
    expect(pointsForRound(2, true)).toBe(2);
  });

  it('phải sửa lại rồi đúng ⇒ một nửa', () => {
    expect(pointsForRound(5, false)).toBe(2);
    expect(pointsForRound(2, false)).toBe(1);
  });

  it('câu 1 điểm mà phải sửa vẫn được 1 — không có câu nào là công cốc', () => {
    expect(pointsForRound(1, false)).toBe(1);
  });

  it('câu 0 điểm không sinh điểm từ hư không', () => {
    expect(pointsForRound(0, true)).toBe(0);
    expect(pointsForRound(0, false)).toBe(0);
  });

  it('KHÔNG BAO GIỜ trả số âm — không có hình phạt nào ở đây', () => {
    for (const points of [0, 1, 2, 3, 5, 10]) {
      expect(pointsForRound(points, true)).toBeGreaterThanOrEqual(0);
      expect(pointsForRound(points, false)).toBeGreaterThanOrEqual(0);
    }
  });
});

// =============================================================================
// Tổng kết lượt chơi
// =============================================================================

describe('summarizeGameRun — hết mạng KHÔNG phải là thua', () => {
  it('đi hết cả lượt ⇒ completed = true', () => {
    const result = summarizeGameRun(raw({ totalRounds: 10, answered: 10, correctFirstTry: 9 }));
    expect(result.completed).toBe(true);
    expect(result.stars).toBe(3);
  });

  it('hết mạng ở câu 5 ⇒ completed = false nhưng VẪN có sao', () => {
    const result = summarizeGameRun(
      raw({ totalRounds: 10, answered: 5, correctFirstTry: 5, endedEarly: true }),
    );
    expect(result.completed).toBe(false);
    expect(result.stars).toBe(3); // 5/5, không phải 5/10
    expect(result.answered).toBe(5);
  });

  it('⭐ mẫu số khi hết mạng sớm là số câu ĐÃ ĐI QUA, không phải số câu kế hoạch', () => {
    // 4 câu đầu đúng cả 4, rồi hết mạng ở câu 5. Chia cho 10 sẽ ra 40% ⇒ 1 sao (SAI).
    const result = summarizeGameRun(
      raw({ totalRounds: 10, answered: 4, correctFirstTry: 4, endedEarly: true }),
    );
    expect(result.stars).toBe(3);
  });

  it('answered bị kẹp không vượt totalRounds', () => {
    const result = summarizeGameRun(raw({ totalRounds: 5, answered: 99, correctFirstTry: 99 }));
    expect(result.answered).toBe(5);
    expect(result.correctFirstTry).toBe(5);
  });

  it('correctFirstTry bị kẹp không vượt answered', () => {
    const result = summarizeGameRun(raw({ totalRounds: 10, answered: 3, correctFirstTry: 9 }));
    expect(result.correctFirstTry).toBe(3);
    expect(result.stars).toBe(3);
  });

  it('lượt rỗng (chưa đi câu nào) vẫn cho 1 sao, không ném lỗi', () => {
    const result = summarizeGameRun(raw({ totalRounds: 10, answered: 0, correctFirstTry: 0 }));
    expect(result.stars).toBe(1);
    expect(result.score).toBe(0);
    expect(result.completed).toBe(false);
  });

  it('điểm = điểm câu + thưởng chuỗi', () => {
    const result = summarizeGameRun(
      raw({ totalRounds: 10, answered: 10, correctFirstTry: 10, longestStreak: 10, roundScore: 20 }),
    );
    expect(result.streakBonus).toBe(3); // floor(10/3)
    expect(result.score).toBe(23);
  });

  it('điểm câu âm (dữ liệu bẩn) không làm điểm tổng âm', () => {
    const result = summarizeGameRun(raw({ roundScore: -100, longestStreak: 0 }));
    expect(result.score).toBe(0);
  });

  it('thưởng chuỗi tách riêng để màn kết quả kể được "nhờ chuỗi"', () => {
    const result = summarizeGameRun(
      raw({ totalRounds: 10, answered: 10, correctFirstTry: 10, longestStreak: 9, roundScore: 20 }),
    );
    expect(result.streakBonus).toBe(3);
    expect(result.score - result.streakBonus).toBe(20);
  });
});

// =============================================================================
// Bảng hằng số theo loại game
// =============================================================================

describe('bảng hằng số phải phủ ĐỦ 12 loại game', () => {
  const allTypes = Object.keys(GAME_LABELS) as Array<keyof typeof GAME_HEARTS>;

  it('mọi loại game đều có số mạng', () => {
    for (const type of allTypes) {
      expect(GAME_HEARTS[type], `thiếu mạng cho ${type}`).toBeTypeOf('number');
    }
  });

  it('mọi loại game đều có điểm mỗi câu', () => {
    for (const type of allTypes) {
      expect(GAME_ROUND_POINTS[type], `thiếu điểm cho ${type}`).toBeGreaterThan(0);
    }
  });

  it('⭐ `memory_match` KHÔNG có mạng — lật thẻ không có "sai"', () => {
    expect(GAME_HEARTS.memory_match).toBe(0);
  });

  it('5 game MVP đều có mạng > 0 (trừ memory_match)', () => {
    for (const type of MVP_GAME_TYPES) {
      if (type === 'memory_match') continue;
      expect(GAME_HEARTS[type], type).toBeGreaterThan(0);
    }
  });

  it('số mạng nằm trong khoảng 0..5 như thiết kế ("3–5 mạng")', () => {
    for (const type of allTypes) {
      expect(GAME_HEARTS[type], type).toBeGreaterThanOrEqual(0);
      expect(GAME_HEARTS[type], type).toBeLessThanOrEqual(5);
    }
  });

  it('MAX_WRONG_PER_ROUND là 2 — sau đó phải hiện gợi ý', () => {
    expect(MAX_WRONG_PER_ROUND).toBe(2);
  });
});
