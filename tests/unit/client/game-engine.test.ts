/**
 * Test cho `useGameEngine` — bộ đếm dùng chung của cả 12 game.
 *
 * Bộ test này khoá lại thứ tự sự kiện mà MỌI game phải tuân theo: `attempt()` để báo một lựa
 * chọn, `completeRound()` để báo đã giải xong một câu. Nếu hai việc đó bị gộp làm một, một từ
 * 9 chữ cái ở `missing_letter` sẽ bị tính thành 9 câu — và không test nào khác bắt được.
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useGameEngine } from '../../../src/hooks/useGameEngine.js';

/** Engine 10 câu, 5 mạng, 2 điểm/câu — giống `listen_tap`. */
function setup(overrides: Partial<Parameters<typeof useGameEngine>[0]> = {}) {
  return renderHook(() =>
    useGameEngine({ totalRounds: 10, maxHearts: 5, roundPoints: 2, ...overrides }),
  );
}

/** Trả lời đúng một câu "ngay lần đầu" — đường đi của hầu hết các test. */
function answerCorrect(engine: ReturnType<typeof setup>, times = 1): void {
  for (let i = 0; i < times; i += 1) {
    act(() => engine.result.current.attempt(true));
    act(() => engine.result.current.completeRound('w.test'));
  }
}

// =============================================================================
// Trạng thái đầu
// =============================================================================

describe('trạng thái đầu', () => {
  it('bắt đầu ở câu 1, đủ mạng, chưa xong', () => {
    const engine = setup();
    const { state, result, roundNumber, isLastRound } = engine.result.current;

    expect(state.index).toBe(0);
    expect(state.hearts).toBe(5);
    expect(state.finished).toBe(false);
    expect(state.roundScore).toBe(0);
    expect(result).toBeNull();
    expect(roundNumber).toBe(1);
    expect(isLastRound).toBe(false);
  });

  it('lượt chơi 0 câu ⇒ kết thúc ngay, không treo', () => {
    const engine = setup({ totalRounds: 0 });
    expect(engine.result.current.state.finished).toBe(true);
    expect(engine.result.current.result?.stars).toBe(1);
  });

  it('câu cuối được nhận đúng ở 10 câu', () => {
    const engine = setup();
    answerCorrect(engine, 9);
    expect(engine.result.current.state.index).toBe(9);
    expect(engine.result.current.isLastRound).toBe(true);
    expect(engine.result.current.roundNumber).toBe(10);
  });
});

// =============================================================================
// Trả lời SAI — mất mạng, đứt chuỗi, KHÔNG mất điểm
// =============================================================================

describe('attempt(false) — mất mạng, KHÔNG mất điểm', () => {
  it('mất đúng 1 mạng', () => {
    const engine = setup();
    act(() => engine.result.current.attempt(false));
    expect(engine.result.current.state.hearts).toBe(4);
  });

  it('⭐ KHÔNG trừ điểm — điểm giữ nguyên 0', () => {
    const engine = setup();
    answerCorrect(engine, 2);
    const before = engine.result.current.state.roundScore;

    act(() => engine.result.current.attempt(false));

    expect(engine.result.current.state.roundScore).toBe(before);
  });

  it('đếm số lần sai (cả lượt và trong câu)', () => {
    const engine = setup();
    act(() => engine.result.current.attempt(false));
    act(() => engine.result.current.attempt(false));

    expect(engine.result.current.state.wrongAttempts).toBe(2);
    expect(engine.result.current.state.wrongThisRound).toBe(2);
  });

  it('đứt chuỗi 🔥', () => {
    const engine = setup();
    answerCorrect(engine, 3);
    expect(engine.result.current.state.streak).toBe(3);

    act(() => engine.result.current.attempt(false));
    expect(engine.result.current.state.streak).toBe(0);
  });

  it('chuỗi dài nhất được giữ lại làm kỷ niệm của lượt', () => {
    const engine = setup();
    answerCorrect(engine, 4);
    act(() => engine.result.current.attempt(false));

    expect(engine.result.current.state.streak).toBe(0);
    expect(engine.result.current.state.longestStreak).toBe(4);
  });
});

// =============================================================================
// Gợi ý sau 2 lần sai
// =============================================================================

describe('gợi ý sau 2 lần sai trong cùng một câu', () => {
  it('chưa sai lần nào ⇒ chưa gợi ý', () => {
    const engine = setup();
    expect(engine.result.current.hintVisible).toBe(false);
  });

  it('sai 1 lần ⇒ chưa gợi ý', () => {
    const engine = setup();
    act(() => engine.result.current.attempt(false));
    expect(engine.result.current.hintVisible).toBe(false);
  });

  it('sai 2 lần ⇒ hiện gợi ý', () => {
    const engine = setup();
    act(() => engine.result.current.attempt(false));
    act(() => engine.result.current.attempt(false));
    expect(engine.result.current.hintVisible).toBe(true);
  });

  it('sang câu mới thì gợi ý TẮT lại', () => {
    const engine = setup();
    act(() => engine.result.current.attempt(false));
    act(() => engine.result.current.attempt(false));
    expect(engine.result.current.hintVisible).toBe(true);

    act(() => engine.result.current.completeRound('w.test'));
    expect(engine.result.current.hintVisible).toBe(false);
  });
});

// =============================================================================
// attempt(true) một mình KHÔNG cộng điểm
// =============================================================================

describe('attempt(true) không tự cộng điểm — điểm cộng ở completeRound', () => {
  it('⭐ trả lời đúng mà chưa completeRound thì chưa có gì thay đổi', () => {
    const engine = setup();
    act(() => engine.result.current.attempt(true));

    const { state } = engine.result.current;
    expect(state.roundScore).toBe(0);
    expect(state.correctFirstTry).toBe(0);
    expect(state.answered).toBe(0);
    expect(state.index).toBe(0);
  });

  it('⭐ lý do: một từ nhiều chữ cái không được cộng điểm nhiều lần', () => {
    // Bé gõ 4 chữ cái, mỗi chữ là một `attempt(true)`, rồi mới xong cả từ.
    const engine = setup({ roundPoints: 2 });
    act(() => engine.result.current.attempt(true));
    act(() => engine.result.current.attempt(true));
    act(() => engine.result.current.attempt(true));
    act(() => engine.result.current.attempt(true));

    expect(engine.result.current.state.roundScore).toBe(0);

    act(() => engine.result.current.completeRound('w.test'));
    // Đúng 2 điểm cho CẢ TỪ, không phải 8.
    expect(engine.result.current.state.roundScore).toBe(2);
    expect(engine.result.current.state.answered).toBe(1);
  });
});

// =============================================================================
// completeRound
// =============================================================================

describe('completeRound — cộng điểm và đi tiếp', () => {
  it('câu đúng ngay lần đầu ⇒ điểm đầy đủ, tính vào `correctFirstTry`', () => {
    const engine = setup({ roundPoints: 3 });
    act(() => engine.result.current.attempt(true));
    act(() => engine.result.current.completeRound('w.test'));

    const { state } = engine.result.current;
    expect(state.roundScore).toBe(3);
    expect(state.correctFirstTry).toBe(1);
    expect(state.answered).toBe(1);
    expect(state.index).toBe(1);
    expect(state.streak).toBe(1);
  });

  it('câu phải sửa rồi mới đúng ⇒ nửa điểm, KHÔNG tính vào `correctFirstTry`', () => {
    const engine = setup({ roundPoints: 4 });
    act(() => engine.result.current.attempt(false));
    act(() => engine.result.current.attempt(true));
    act(() => engine.result.current.completeRound('w.test'));

    const { state } = engine.result.current;
    expect(state.roundScore).toBe(2); // floor(4/2)
    expect(state.correctFirstTry).toBe(0);
    expect(state.answered).toBe(1);
    expect(state.streak).toBe(0);
  });

  it('câu 1 điểm mà phải sửa vẫn được 1 — không có câu nào là công cốc', () => {
    const engine = setup({ roundPoints: 1 });
    act(() => engine.result.current.attempt(false));
    act(() => engine.result.current.completeRound('w.test'));

    expect(engine.result.current.state.roundScore).toBe(1);
  });

  it('số câu đã xong tăng, số lần sai trong câu được đặt lại', () => {
    const engine = setup();
    act(() => engine.result.current.attempt(false));
    act(() => engine.result.current.completeRound('w.test'));

    expect(engine.result.current.state.answered).toBe(1);
    expect(engine.result.current.state.wrongThisRound).toBe(0);
    expect(engine.result.current.state.wrongAttempts).toBe(1); // tổng lượt vẫn giữ
  });

  it('đi hết số câu ⇒ finished, và completed = true', () => {
    const engine = setup({ totalRounds: 3 });
    answerCorrect(engine, 3);

    expect(engine.result.current.state.finished).toBe(true);
    expect(engine.result.current.result?.completed).toBe(true);
    expect(engine.result.current.result?.stars).toBe(3);
  });
});

// =============================================================================
// ⭐ HẾT MẠNG KHÔNG PHẢI LÀ THUA
// =============================================================================

describe('hết mạng ❤️ — kết thúc sớm, KHÔNG phải thua', () => {
  it('hết mạng ⇒ finished + endedEarly', () => {
    const engine = setup({ maxHearts: 3 });
    act(() => engine.result.current.attempt(false));
    act(() => engine.result.current.attempt(false));
    act(() => engine.result.current.attempt(false));

    expect(engine.result.current.state.hearts).toBe(0);
    expect(engine.result.current.state.finished).toBe(true);
    expect(engine.result.current.state.endedEarly).toBe(true);
  });

  it('⭐ bé VẪN nhận sao — không bao giờ 0 sao', () => {
    const engine = setup({ maxHearts: 2 });
    act(() => engine.result.current.attempt(false));
    act(() => engine.result.current.attempt(false));

    expect(engine.result.current.result?.stars).toBeGreaterThanOrEqual(1);
  });

  it('⭐ mẫu số tính sao là số câu ĐÃ ĐI QUA, không phải số câu kế hoạch', () => {
    // 4 câu đầu đúng cả 4, rồi hết mạng. 4/4 phải là 3 sao, KHÔNG phải 4/10 = 1 sao.
    const engine = setup({ maxHearts: 2 });
    answerCorrect(engine, 4);
    act(() => engine.result.current.attempt(false));
    act(() => engine.result.current.attempt(false));

    const result = engine.result.current.result;
    expect(result?.answered).toBe(4);
    expect(result?.totalRounds).toBe(10);
    expect(result?.stars).toBe(3);
    expect(result?.completed).toBe(false);
  });

  it('hết mạng ở câu đầu, chưa đúng câu nào ⇒ vẫn 1 sao', () => {
    const engine = setup({ maxHearts: 1 });
    act(() => engine.result.current.attempt(false));

    expect(engine.result.current.result?.stars).toBe(1);
    expect(engine.result.current.result?.answered).toBe(0);
  });

  it('game KHÔNG có mạng (maxHearts = 0) ⇒ trả lời sai không bao giờ kết thúc lượt', () => {
    const engine = setup({ maxHearts: 0 });
    for (let i = 0; i < 50; i += 1) {
      act(() => engine.result.current.attempt(false));
    }

    expect(engine.result.current.state.hearts).toBe(0);
    expect(engine.result.current.state.finished).toBe(false);
    expect(engine.result.current.state.wrongAttempts).toBe(50);
  });
});

// =============================================================================
// Thao tác sau khi kết thúc bị bỏ qua
// =============================================================================

describe('sau khi kết thúc, mọi thao tác bị bỏ qua', () => {
  it('⭐ chạm thêm không làm thay đổi điểm đã chốt', () => {
    const engine = setup({ totalRounds: 2 });
    answerCorrect(engine, 2);

    const snapshot = { ...engine.result.current.state };

    act(() => engine.result.current.attempt(false));
    act(() => engine.result.current.attempt(true));
    act(() => engine.result.current.completeRound('w.test'));

    expect(engine.result.current.state).toEqual(snapshot);
  });

  it('kết quả đã chấm không đổi sau khi bé chạm thêm', () => {
    const engine = setup({ totalRounds: 2 });
    answerCorrect(engine, 2);
    const before = engine.result.current.result;

    act(() => engine.result.current.attempt(false));

    expect(engine.result.current.result).toEqual(before);
  });
});

// =============================================================================
// Chơi lại
// =============================================================================

describe('restart', () => {
  it('xoá sạch mọi bộ đếm', () => {
    const engine = setup({ totalRounds: 3 });
    act(() => engine.result.current.attempt(false));
    answerCorrect(engine, 3);
    expect(engine.result.current.state.finished).toBe(true);

    act(() => engine.result.current.restart());

    const { state, result } = engine.result.current;
    expect(state.index).toBe(0);
    expect(state.hearts).toBe(5);
    expect(state.roundScore).toBe(0);
    expect(state.correctFirstTry).toBe(0);
    expect(state.answered).toBe(0);
    expect(state.wrongAttempts).toBe(0);
    expect(state.longestStreak).toBe(0);
    expect(state.finished).toBe(false);
    expect(result).toBeNull();
  });

  it('chơi lại được cả khi đã hết mạng', () => {
    const engine = setup({ maxHearts: 1 });
    act(() => engine.result.current.attempt(false));
    expect(engine.result.current.state.endedEarly).toBe(true);

    act(() => engine.result.current.restart());

    expect(engine.result.current.state.hearts).toBe(1);
    expect(engine.result.current.state.finished).toBe(false);
    expect(engine.result.current.state.endedEarly).toBe(false);
  });
});

// =============================================================================
// Thưởng chuỗi 🔥 chảy vào kết quả
// =============================================================================

describe('thưởng chuỗi 🔥 trong kết quả', () => {
  it('chuỗi 9 câu đúng liên tiếp ⇒ +3 điểm thưởng', () => {
    const engine = setup({ totalRounds: 9, roundPoints: 2 });
    answerCorrect(engine, 9);

    const result = engine.result.current.result;
    expect(result?.longestStreak).toBe(9);
    expect(result?.streakBonus).toBe(3);
    expect(result?.score).toBe(9 * 2 + 3);
  });

  it('chuỗi bị đứt làm thưởng thấp hơn', () => {
    const engine = setup({ totalRounds: 6, roundPoints: 2 });
    answerCorrect(engine, 2);
    act(() => engine.result.current.attempt(false));
    act(() => engine.result.current.completeRound('w.test'));
    answerCorrect(engine, 3);

    expect(engine.result.current.result?.longestStreak).toBe(3);
    expect(engine.result.current.result?.streakBonus).toBe(1);
  });
});

// =============================================================================
// Nhật ký từng câu — dữ liệu thô để T049 gửi lên server
// =============================================================================

/**
 * ⭐ VÌ SAO NHÓM TEST NÀY QUAN TRỌNG:
 *   Server chấm lại điểm/sao TỪ MẢNG NÀY. Nếu nhật ký sai thứ tự, sai `firstTry`, hoặc mất
 *   câu, thì không có cách nào phát hiện về sau — bé sẽ thấy số sao khác với những gì mình
 *   vừa chơi, và tiến độ đã ghi vào sổ thì KHÔNG BAO GIỜ mất.
 */
describe('nhật ký từng câu (`state.answers`)', () => {
  it('mỗi câu xong ghi ĐÚNG MỘT dòng, theo thứ tự bé chơi', () => {
    const engine = setup({ totalRounds: 3 });

    act(() => engine.result.current.attempt(true));
    act(() => engine.result.current.completeRound('w.one'));
    act(() => engine.result.current.attempt(true));
    act(() => engine.result.current.completeRound('w.two'));
    act(() => engine.result.current.attempt(true));
    act(() => engine.result.current.completeRound('w.three'));

    expect(engine.result.current.state.answers).toEqual([
      { wordId: 'w.one', firstTry: true, wrongAttempts: 0 },
      { wordId: 'w.two', firstTry: true, wrongAttempts: 0 },
      { wordId: 'w.three', firstTry: true, wrongAttempts: 0 },
    ]);
  });

  it('câu phải sửa: `firstTry: false` và ghi ĐÚNG số lần đã chọn sai', () => {
    const engine = setup({ totalRounds: 1 });

    act(() => engine.result.current.attempt(false));
    act(() => engine.result.current.attempt(false));
    act(() => engine.result.current.attempt(true));
    act(() => engine.result.current.completeRound('w.tough'));

    expect(engine.result.current.state.answers).toEqual([
      { wordId: 'w.tough', firstTry: false, wrongAttempts: 2 },
    ]);
  });

  it('⭐ số lần sai KHÔNG rò từ câu này sang câu sau', () => {
    const engine = setup({ totalRounds: 2 });

    // Câu 1: sai 1 lần rồi mới đúng.
    act(() => engine.result.current.attempt(false));
    act(() => engine.result.current.attempt(true));
    act(() => engine.result.current.completeRound('w.first'));

    // Câu 2: đúng ngay. Nếu `wrongThisRound` không được xoá về 0, dòng này sẽ ghi `wrongAttempts: 1`
    // và server sẽ cộng oan một lần sai vào `word_progress.wrong_count`.
    act(() => engine.result.current.attempt(true));
    act(() => engine.result.current.completeRound('w.second'));

    expect(engine.result.current.state.answers[1]).toEqual({
      wordId: 'w.second',
      firstTry: true,
      wrongAttempts: 0,
    });
  });

  it('`wordId: null` được ghi nguyên vẹn (game không dạy từ vựng như `prepositions`)', () => {
    const engine = setup({ totalRounds: 1 });

    act(() => engine.result.current.attempt(true));
    act(() => engine.result.current.completeRound(null));

    expect(engine.result.current.state.answers).toEqual([
      { wordId: null, firstTry: true, wrongAttempts: 0 },
    ]);
  });

  it('số dòng nhật ký LUÔN bằng số câu đã đi qua', () => {
    const engine = setup({ totalRounds: 5 });
    answerCorrect(engine, 3);

    expect(engine.result.current.state.answers).toHaveLength(3);
    expect(engine.result.current.state.answers).toHaveLength(
      engine.result.current.state.answered,
    );
  });

  it('chơi lại thì nhật ký BẮT ĐẦU LẠI TỪ ĐẦU, không nối vào ván cũ', () => {
    const engine = setup({ totalRounds: 2 });
    answerCorrect(engine, 2);
    expect(engine.result.current.state.answers).toHaveLength(2);

    act(() => engine.result.current.restart());

    expect(engine.result.current.state.answers).toEqual([]);
    answerCorrect(engine, 1);
    expect(engine.result.current.state.answers).toHaveLength(1);
  });

  it('hết mạng giữa chừng: nhật ký CHỈ có những câu đã đi qua', () => {
    const engine = setup({ totalRounds: 10, maxHearts: 2 });

    act(() => engine.result.current.attempt(true));
    act(() => engine.result.current.completeRound('w.kept'));

    // Hai lần sai ở câu 2 ⇒ hết mạng, câu 2 KHÔNG được ghi (bé chưa giải xong).
    act(() => engine.result.current.attempt(false));
    act(() => engine.result.current.attempt(false));

    expect(engine.result.current.state.endedEarly).toBe(true);
    expect(engine.result.current.state.answers).toEqual([
      { wordId: 'w.kept', firstTry: true, wrongAttempts: 0 },
    ]);
  });
});
