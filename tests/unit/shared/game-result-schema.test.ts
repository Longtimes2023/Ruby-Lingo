/**
 * RubyLingo — Test cho hợp đồng `game-result` (T049.1).
 *
 * ⭐ ĐIỀU QUAN TRỌNG NHẤT ĐƯỢC KIỂM Ở ĐÂY: dữ liệu MÂU THUẪN phải bị TỪ CHỐI.
 *
 *   `game-result` là endpoint ghi thẳng vào sổ tiến độ của bé. Một payload mâu thuẫn lọt qua
 *   sẽ để lại trong sổ một con số KHÔNG THỂ TIN — và vì tiến độ là "thành tựu không bao giờ
 *   mất" (xem `mergeWordProgress`), con số sai đó sẽ ở lại VĨNH VIỄN. Không có màn hình nào
 *   sửa lại được. Vì vậy ở đây kiểm cả những ca mà người viết client KHÔNG định gửi: mục đích
 *   là bắt lỗi của chính mình, không phải bắt lỗi người dùng.
 */

import { describe, expect, it } from 'vitest';

import { GAME_TYPES } from '../../../shared/game-scoring.js';
import {
  MAX_ANSWERS_PER_RUN,
  MAX_DURATION_SECONDS,
  MAX_WRONG_PER_ANSWER,
  gameResultSubmissionSchema,
} from '../../../shared/schemas/progress.js';

/** Một lượt chơi hợp lệ tối thiểu; từng test ghi đè đúng trường nó muốn phá. */
function validRun(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    clientEventId: 'evt_abc123_xyz',
    exerciseId: 'at-the-zoo/z1/listen-tap',
    lessonId: 'at-the-zoo/z1',
    gameType: 'listen_tap',
    totalRounds: 4,
    occurredAt: '2026-10-06T09:15:00.000Z',
    durationSeconds: 42,
    answers: [
      { wordId: 'starters.at-the-zoo.monkey', firstTry: true, wrongAttempts: 0 },
      { wordId: 'starters.at-the-zoo.lion', firstTry: false, wrongAttempts: 2 },
      { wordId: 'starters.at-the-zoo.elephant', firstTry: true, wrongAttempts: 0 },
      { wordId: 'starters.at-the-zoo.zebra', firstTry: true, wrongAttempts: 0 },
    ],
    ...overrides,
  };
}

describe('gameResultSubmissionSchema — lượt chơi hợp lệ', () => {
  it('nhận một lượt chơi bình thường', () => {
    const parsed = gameResultSubmissionSchema.parse(validRun());
    expect(parsed.gameType).toBe('listen_tap');
    expect(parsed.answers).toHaveLength(4);
  });

  it('nhận lượt chơi kết thúc sớm: ít câu trả lời hơn totalRounds', () => {
    const parsed = gameResultSubmissionSchema.parse(
      validRun({ totalRounds: 6, answers: [{ wordId: 'w1', firstTry: true, wrongAttempts: 0 }] }),
    );
    expect(parsed.answers).toHaveLength(1);
    expect(parsed.totalRounds).toBe(6);
  });

  it('nhận lượt chơi không có câu trả lời nào (bé thoát ngay)', () => {
    expect(() => gameResultSubmissionSchema.parse(validRun({ answers: [] }))).not.toThrow();
  });

  it('nhận cùng một từ lặp lại nhiều vòng', () => {
    const answers = [
      { wordId: 'w1', firstTry: true, wrongAttempts: 0 },
      { wordId: 'w1', firstTry: false, wrongAttempts: 1 },
    ];
    expect(() =>
      gameResultSubmissionSchema.parse(validRun({ totalRounds: 2, answers })),
    ).not.toThrow();
  });

  /**
   * ⭐ `wordId: null` PHẢI ĐƯỢC CHẤP NHẬN — không phải kẽ hở cho tiện.
   *
   *   `prepositions` dạy GIỚI TỪ trong một câu (`PrepositionSlot` không có `wordId`), và
   *   `number_match`/`count_tap`/`colour_learn` dạy số/màu. Nếu schema bắt buộc `wordId`,
   *   client hoặc phải gán bừa một từ (ghi số SAI vĩnh viễn vào sổ của bé) hoặc bỏ câu khỏi
   *   `answers` (⇒ `answered` hụt ⇒ bé chơi hết vẫn bị coi là bỏ dở ⇒ 1 sao oan).
   *   Xem `GameAnswerRecord.wordId` ở `shared/types/progress.ts`.
   */
  it('nhận câu KHÔNG gắn với từ nào (`wordId: null`)', () => {
    const parsed = gameResultSubmissionSchema.parse(
      validRun({
        gameType: 'prepositions',
        totalRounds: 2,
        answers: [
          { wordId: null, firstTry: true, wrongAttempts: 0 },
          { wordId: null, firstTry: false, wrongAttempts: 1 },
        ],
      }),
    );
    expect(parsed.answers[0]!.wordId).toBeNull();
    expect(parsed.answers).toHaveLength(2);
  });
});

describe('gameResultSubmissionSchema — TỪ CHỐI dữ liệu mâu thuẫn', () => {
  it('từ chối khi "đúng ngay lần đầu" mà lại có lần chọn sai', () => {
    const bad = validRun({
      answers: [{ wordId: 'w1', firstTry: true, wrongAttempts: 3 }],
      totalRounds: 1,
    });

    const result = gameResultSubmissionSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (result.success) return;

    // Phải chỉ ĐÚNG trường sai, để client hiện được thông báo có ích.
    const issue = result.error.issues.find((i) => i.path.join('.') === 'answers.0.wrongAttempts');
    expect(issue).toBeDefined();
  });

  it('từ chối khi số câu trả lời VƯỢT tổng số câu của lượt chơi', () => {
    const bad = validRun({ totalRounds: 1 });
    const result = gameResultSubmissionSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('từ chối `wrongAttempts` âm', () => {
    const bad = validRun({
      totalRounds: 1,
      answers: [{ wordId: 'w1', firstTry: false, wrongAttempts: -1 }],
    });
    expect(gameResultSubmissionSchema.safeParse(bad).success).toBe(false);
  });

  it('từ chối `wrongAttempts` vượt trần', () => {
    const bad = validRun({
      totalRounds: 1,
      answers: [{ wordId: 'w1', firstTry: false, wrongAttempts: MAX_WRONG_PER_ANSWER + 1 }],
    });
    expect(gameResultSubmissionSchema.safeParse(bad).success).toBe(false);
  });

  it('từ chối `gameType` không tồn tại', () => {
    expect(gameResultSubmissionSchema.safeParse(validRun({ gameType: 'nấu_phở' })).success).toBe(
      false,
    );
  });

  it('từ chối `clientEventId` rỗng (mất khả năng chống ghi trùng)', () => {
    expect(gameResultSubmissionSchema.safeParse(validRun({ clientEventId: '' })).success).toBe(
      false,
    );
  });

  it('từ chối `clientEventId` chứa ký tự lạ (nó là khoá UNIQUE trong DB)', () => {
    expect(
      gameResultSubmissionSchema.safeParse(validRun({ clientEventId: 'evt/../etc/passwd' })).success,
    ).toBe(false);
  });

  it('từ chối khi thiếu `answers`', () => {
    const bad = validRun();
    delete bad.answers;
    expect(gameResultSubmissionSchema.safeParse(bad).success).toBe(false);
  });

  it('từ chối `totalRounds` âm', () => {
    expect(gameResultSubmissionSchema.safeParse(validRun({ totalRounds: -1 })).success).toBe(false);
  });

  it('từ chối thời lượng vượt trần 6 giờ', () => {
    expect(
      gameResultSubmissionSchema.safeParse(validRun({ durationSeconds: MAX_DURATION_SECONDS + 1 }))
        .success,
    ).toBe(false);
  });

  it('từ chối mảng câu trả lời vượt trần (chống làm sập DB)', () => {
    const answers = Array.from({ length: MAX_ANSWERS_PER_RUN + 1 }, (_, i) => ({
      wordId: `w${i}`,
      firstTry: true,
      wrongAttempts: 0,
    }));
    expect(
      gameResultSubmissionSchema.safeParse(
        validRun({ totalRounds: MAX_ANSWERS_PER_RUN + 1, answers }),
      ).success,
    ).toBe(false);
  });
});

describe('GAME_TYPES — danh sách game lúc chạy KHÔNG được lệch với union', () => {
  it('có đủ 12 game và không trùng', () => {
    expect(GAME_TYPES).toHaveLength(12);
    expect(new Set(GAME_TYPES).size).toBe(GAME_TYPES.length);
  });

  it('chứa cả 5 game MVP', () => {
    for (const game of ['listen_tap', 'missing_letter', 'prepositions', 'memory_match', 'word_picture']) {
      expect(GAME_TYPES).toContain(game);
    }
  });

  it('là NGUỒN duy nhất cho enum của schema — mọi giá trị đều parse được', () => {
    for (const gameType of GAME_TYPES) {
      const result = gameResultSubmissionSchema.safeParse(
        validRun({ gameType, totalRounds: 1, answers: [] }),
      );
      expect(result.success, `gameType "${gameType}" phải parse được`).toBe(true);
    }
  });
});
