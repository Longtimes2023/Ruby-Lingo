// @vitest-environment node

/**
 * RubyLingo — Test cho `GameResultService` (T049.2).
 *
 * ⭐ HAI NHÓM, HAI MỤC ĐÍCH KHÁC NHAU:
 *
 *   1. `deriveRun` — HÀM THUẦN suy các con số từ dữ liệu thô. Đây là phần "hiểu biết" của
 *      endpoint: nó đếm sai thì mọi thứ phía sau đều sai. Kiểm được mà không cần DB nên mọi
 *      nhánh (đúng hết, phải sửa, hết mạng sớm, một từ lặp lại) chỉ tốn vài mili giây.
 *
 *   2. `submit` — GHI VÀO SỔ. Đây là chỗ thành tựu của bé được ghi, nên thứ quan trọng nhất
 *      cần chứng minh là **tính LŨY ĐẲNG**: gửi lại cùng một lượt chơi KHÔNG được cộng hai
 *      lần. Đó là kịch bản xảy ra hằng ngày (mất mạng giữa lúc gửi), không phải ca hiếm — và
 *      nếu cổng đó thủng thì `daily_stats` phồng lên vĩnh viễn mà không cách nào phát hiện.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDb, type Db } from '../../../server/db/connection.js';
import { authService } from '../../../server/services/AuthService.js';
import { childService } from '../../../server/services/ChildService.js';
import { GameResultService, deriveRun } from '../../../server/services/GameResultService.js';
import type { GameResultSubmissionInput } from '../../../shared/schemas/progress.js';
import { clearAllData, setupTestDb } from './helpers/testDb.js';

// =============================================================================
// Dữ liệu dựng sẵn
// =============================================================================

/** Id lượt chơi tăng dần — mỗi lượt trong một test phải là một mã KHÁC NHAU. */
let runSeq = 0;
function nextEventId(): string {
  runSeq += 1;
  return `evt_test_${String(runSeq).padStart(4, '0')}`;
}

/** Một lượt chơi 4 câu, đúng hết; từng test ghi đè đúng phần nó muốn nói tới. */
function run(overrides: Partial<GameResultSubmissionInput> = {}): GameResultSubmissionInput {
  return {
    clientEventId: nextEventId(),
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
// 1. `deriveRun` — hàm thuần, không cần DB
// =============================================================================

describe('deriveRun — suy các con số từ dữ liệu thô', () => {
  it('đúng hết: mọi câu đều đúng ngay lần đầu', () => {
    const d = deriveRun(run());

    expect(d.answered).toBe(4);
    expect(d.correctFirstTry).toBe(4);
    expect(d.wrongAttempts).toBe(0);
    expect(d.longestStreak).toBe(4);
    expect(d.endedEarly).toBe(false);
    expect(d.roundScore).toBe(4 * 2); // listen_tap = 2 điểm/câu, đúng ngay ⇒ đủ điểm
  });

  it('phải sửa: đứt chuỗi và chỉ được nửa điểm cho câu đó', () => {
    const d = deriveRun(
      run({
        answers: [
          { wordId: 'w1', firstTry: true, wrongAttempts: 0 },
          { wordId: 'w2', firstTry: true, wrongAttempts: 0 },
          { wordId: 'w3', firstTry: false, wrongAttempts: 2 },
          { wordId: 'w4', firstTry: true, wrongAttempts: 0 },
        ],
      }),
    );

    expect(d.correctFirstTry).toBe(3);
    expect(d.wrongAttempts).toBe(2);
    // Chuỗi dài nhất là 2 (hai câu đầu), KHÔNG phải 3 — câu 3 làm đứt chuỗi.
    expect(d.longestStreak).toBe(2);
    expect(d.roundScore).toBe(2 + 2 + 1 + 2); // 1 = nửa của 2, làm tròn xuống
  });

  it('hết mạng giữa chừng: ít câu trả lời hơn kế hoạch ⇒ `endedEarly`', () => {
    const d = deriveRun(
      run({
        totalRounds: 10,
        answers: [
          { wordId: 'w1', firstTry: true, wrongAttempts: 0 },
          { wordId: 'w2', firstTry: true, wrongAttempts: 0 },
          { wordId: 'w3', firstTry: false, wrongAttempts: 5 },
        ],
      }),
    );

    expect(d.answered).toBe(3);
    expect(d.endedEarly).toBe(true);
    expect(d.longestStreak).toBe(2);
  });

  it('lượt chơi 0 câu không sập', () => {
    const d = deriveRun(run({ totalRounds: 6, answers: [] }));

    expect(d.answered).toBe(0);
    expect(d.correctFirstTry).toBe(0);
    expect(d.longestStreak).toBe(0);
    expect(d.endedEarly).toBe(true);
  });

  it('`attempts` = các lần SAI trước rồi mới tới lần ĐÚNG', () => {
    const d = deriveRun(
      run({
        totalRounds: 2,
        answers: [
          { wordId: 'w1', firstTry: false, wrongAttempts: 2 },
          { wordId: 'w2', firstTry: true, wrongAttempts: 0 },
        ],
      }),
    );

    expect(d.attempts).toEqual([
      { wordId: 'w1', correct: false },
      { wordId: 'w1', correct: false },
      { wordId: 'w1', correct: true },
      { wordId: 'w2', correct: true },
    ]);
  });

  it('cùng một từ lặp ở hai vòng: ghi hai lần, không gộp', () => {
    const d = deriveRun(
      run({
        totalRounds: 2,
        answers: [
          { wordId: 'w1', firstTry: true, wrongAttempts: 0 },
          { wordId: 'w1', firstTry: true, wrongAttempts: 0 },
        ],
      }),
    );

    expect(d.attempts).toHaveLength(2);
    expect(d.correctFirstTry).toBe(2);
  });

  it('điểm mỗi câu theo ĐÚNG bảng điểm của game', () => {
    // memory_match = 5 điểm/cặp, hơn gấp đôi listen_tap = 2.
    const d = deriveRun(
      run({
        gameType: 'memory_match',
        totalRounds: 2,
        answers: [
          { wordId: 'w1', firstTry: true, wrongAttempts: 0 },
          { wordId: 'w2', firstTry: true, wrongAttempts: 0 },
        ],
      }),
    );

    expect(d.roundScore).toBe(10);
  });
});

// =============================================================================
// 2. `submit` — ghi vào sổ (cần DB thật)
// =============================================================================

describe('GameResultService.submit — ghi vào sổ của bé', () => {
  let db: Db;
  let service: GameResultService;

  beforeAll(() => {
    db = setupTestDb();
    service = new GameResultService();
  });

  beforeEach(() => {
    clearAllData(db);
  });

  afterAll(() => {
    closeDb();
  });

  /** Tạo một gia đình mới (phụ huynh + một bé). Email tăng dần nên không bao giờ trùng. */
  let familySeq = 0;
  async function newFamily(): Promise<{ parentId: string; childId: string }> {
    familySeq += 1;
    const parent = await authService.signup({
      email: `parent-${familySeq}@example.com`,
      password: 'matkhau12345',
      parentalConsent: true,
    });
    const child = childService.createChild(parent.parent.id, {
      nickname: 'Bé Na',
      age: 7,
      avatarId: 'fox',
    });
    return { parentId: parent.parent.id, childId: child.id };
  }

  function runRow(childId: string, clientEventId: string) {
    return db
      .prepare('SELECT * FROM game_result WHERE child_id = ? AND client_event_id = ?')
      .get(childId, clientEventId) as
      | {
          score: number;
          stars: number;
          answered: number;
          correct_count: number;
          wrong_attempts: number;
          total_questions: number;
        }
      | undefined;
  }

  function wordRow(childId: string, wordId: string) {
    return db
      .prepare('SELECT * FROM word_progress WHERE child_id = ? AND word_id = ?')
      .get(childId, wordId) as
      | { learned: number; mastered: number; correct_count: number; wrong_count: number }
      | undefined;
  }

  function lessonRow(childId: string, lessonId: string) {
    return db
      .prepare('SELECT * FROM lesson_progress WHERE child_id = ? AND lesson_id = ?')
      .get(childId, lessonId) as
      | { best_score: number; stars_best: number; attempts: number; completed: number }
      | undefined;
  }

  function dailyRow(childId: string, date: string) {
    return db
      .prepare('SELECT * FROM daily_stats WHERE child_id = ? AND date = ?')
      .get(childId, date) as
      | {
          words_learned: number;
          questions_answered: number;
          correct_count: number;
          active_seconds: number;
          stars_earned: number;
        }
      | undefined;
  }

  function countRuns(childId: string): number {
    const row = db
      .prepare('SELECT COUNT(*) AS n FROM game_result WHERE child_id = ?')
      .get(childId) as { n: number };
    return row.n;
  }

  function walletRow(childId: string) {
    return db.prepare('SELECT stars, acorns FROM wallet WHERE child_id = ?').get(childId) as
      | { stars: number; acorns: number }
      | undefined;
  }

  function xpRow(childId: string) {
    return db.prepare('SELECT xp, level FROM xp_state WHERE child_id = ?').get(childId) as
      | { xp: number; level: number }
      | undefined;
  }

  function badgeIds(childId: string): string[] {
    const rows = db
      .prepare('SELECT badge_id FROM badge_earned WHERE child_id = ? ORDER BY badge_id ASC')
      .all(childId) as { badge_id: string }[];
    return rows.map((r) => r.badge_id);
  }

  function stickerIds(childId: string): string[] {
    const rows = db
      .prepare('SELECT sticker_id FROM sticker_earned WHERE child_id = ? ORDER BY sticker_id ASC')
      .all(childId) as { sticker_id: string }[];
    return rows.map((r) => r.sticker_id);
  }

  // --- Ghi đúng -----------------------------------------------------------

  it('lượt chơi hoàn hảo: 3 sao, và ghi đủ sáu bảng', async () => {
    const { parentId, childId } = await newFamily();
    const input = run();

    const award = service.submit(parentId, childId, input);

    expect(award.duplicate).toBe(false);
    expect(award.stars).toBe(3);
    // 4 câu × 2 điểm = 8, CỘNG 1 điểm thưởng chuỗi: `streakBonusFor(4)` = ⌊4/3⌋ = 1.
    expect(award.score).toBe(9);
    expect(award.isNewRecord).toBe(true);
    expect(award.bestScore).toBe(9);
    expect(award.bestStars).toBe(3);

    // Nhật ký lượt chơi.
    const logged = runRow(childId, input.clientEventId);
    expect(logged).toMatchObject({
      score: 9,
      stars: 3,
      answered: 4,
      correct_count: 4,
      wrong_attempts: 0,
      total_questions: 4,
    });

    // Tiến độ từng từ: cả 4 từ đều `learned`, mỗi từ 1 lần đúng.
    for (const answer of input.answers) {
      // `run()` ở file này không bao giờ tạo câu `wordId: null`, nên khẳng định này là hợp lệ.
      expect(answer.wordId).not.toBeNull();
      expect(wordRow(childId, answer.wordId!)).toMatchObject({
        learned: 1,
        correct_count: 1,
        wrong_count: 0,
      });
    }

    // Kỷ lục bài.
    expect(lessonRow(childId, input.lessonId)).toMatchObject({
      best_score: 9,
      stars_best: 3,
      // ⚠️ `attempts`/`completed` KHÔNG bị đụng tới — chúng thuộc `applyLessonCompleted`
      //    (luồng flashcard). Một cột, một chủ sở hữu.
      attempts: 0,
      completed: 0,
    });

    // Thống kê ngày. `occurredAt` 09:15Z ⇒ 16:15 giờ Việt Nam (UTC+7) ⇒ vẫn ngày 06.
    //
    // ⭐ ⭐/XP Ở ĐÂY LÀ SỐ THẬT ĐƯỢC TRAO (T054), không còn là 0 như trước:
    //    ⭐ = 4 câu đúng × 2 (listen_tap) + 4 từ mới × 1 + 10 (chơi xong) = 22
    //    XP = 4 × 2 + 4 × 5 + 10 = 38  (chưa đủ 150 để lên cấp 2)
    //    🌰 = 0 — game không bao giờ cho hạt dẻ (chỉ nhiệm vụ và bài hoàn hảo).
    expect(dailyRow(childId, '2026-10-06')).toMatchObject({
      words_learned: 4,
      questions_answered: 4,
      correct_count: 4,
      active_seconds: 42,
      stars_earned: 22,
      acorns_earned: 0,
      xp_earned: 38,
    });
  });

  it('câu phải sửa: vẫn tính là ĐÚNG (cộng 1), nhưng ghi thêm số lần sai', async () => {
    const { parentId, childId } = await newFamily();

    service.submit(
      parentId,
      childId,
      run({
        answers: [
          { wordId: 'w1', firstTry: true, wrongAttempts: 0 },
          { wordId: 'w2', firstTry: true, wrongAttempts: 0 },
          { wordId: 'w3', firstTry: false, wrongAttempts: 2 },
          { wordId: 'w4', firstTry: true, wrongAttempts: 0 },
        ],
      }),
    );

    // w3: bé đã chọn sai 2 lần rồi mới đúng ⇒ 1 đúng, 2 sai.
    expect(wordRow(childId, 'w3')).toMatchObject({ learned: 1, correct_count: 1, wrong_count: 2 });
    // w1: đúng ngay ⇒ không có lần sai nào.
    expect(wordRow(childId, 'w1')).toMatchObject({ correct_count: 1, wrong_count: 0 });
  });

  it('"hoàn thành là đã có thưởng": lượt chơi 0 câu VẪN được 1 sao, không bao giờ 0', async () => {
    const { parentId, childId } = await newFamily();

    const award = service.submit(parentId, childId, run({ totalRounds: 6, answers: [] }));

    expect(award.stars).toBe(1);
    expect(award.bestStars).toBe(1);
  });

  /**
   * ⭐ `prepositions` DẠY GIỚI TỪ, KHÔNG DẠY TỪ VỰNG ⇒ `wordId: null`.
   *
   *   Đây là bài kiểm chứng cho quy tắc ở `GameAnswerRecord.wordId`: câu không gắn với từ nào
   *   vẫn phải được tính ĐỦ (điểm, sao, số câu, thống kê ngày) — nếu bị bỏ qua thì bé chơi hết
   *   cả ván vẫn bị coi là bỏ dở và chỉ nhận 1 sao. Đổi lại, nó KHÔNG được ghi gì vào
   *   `word_progress`, vì gán bừa một từ sẽ tạo ra một con số sai ở lại vĩnh viễn trong sổ.
   */
  it('câu `wordId: null` (prepositions): đủ sao, nhưng KHÔNG ghi `word_progress`', async () => {
    const { parentId, childId } = await newFamily();

    const input = run({
      gameType: 'prepositions', // 3 điểm/câu
      totalRounds: 4,
      answers: [
        { wordId: null, firstTry: true, wrongAttempts: 0 },
        { wordId: null, firstTry: true, wrongAttempts: 0 },
        { wordId: null, firstTry: true, wrongAttempts: 0 },
        { wordId: null, firstTry: true, wrongAttempts: 0 },
      ],
    });

    const award = service.submit(parentId, childId, input);

    // 4 câu × 3 điểm = 12, cộng thưởng chuỗi ⌊4/3⌋ = 1 ⇒ 13. Vẫn 3 sao (đúng hết).
    expect(award.score).toBe(13);
    expect(award.stars).toBe(3);

    // Nhật ký lượt chơi VẪN được ghi, và vẫn đếm đủ 4 câu.
    const logged = runRow(childId, input.clientEventId);
    expect(logged).toMatchObject({ answered: 4, correct_count: 4, score: 13, stars: 3 });

    // Thống kê ngày vẫn đếm 4 câu đã trả lời.
    expect(dailyRow(childId, '2026-10-06')).toMatchObject({
      questions_answered: 4,
      correct_count: 4,
      words_learned: 0, // ⭐ không có từ nào ⇒ không có từ mới nào
    });

    // VÀ ĐIỀU QUAN TRỌNG NHẤT: không có dòng `word_progress` nào được tạo.
    const wordCount = db
      .prepare('SELECT COUNT(*) AS n FROM word_progress WHERE child_id = ?')
      .get(childId) as { n: number };
    expect(wordCount.n).toBe(0);
  });

  // --- Lũy đẳng -----------------------------------------------------------

  it('gửi lại CÙNG một lượt chơi: không cộng thêm gì', async () => {
    const { parentId, childId } = await newFamily();
    const input = run();

    const first = service.submit(parentId, childId, input);

    // Chốt lại ví/XP SAU LẦN ĐẦU, trước khi gửi lại — để khẳng định dưới đây so với con số
    // THẬT, không phải so với 0 (so với 0 thì một bug "cộng hai lần rồi trừ về 0" cũng lọt).
    const walletAfterFirst = walletRow(childId);
    const xpAfterFirst = xpRow(childId);
    expect(first.xpGained).toBe(38);
    expect(first.starsGained).toBe(22);
    expect(walletAfterFirst).toEqual({ stars: 22, acorns: 0 });
    expect(xpAfterFirst).toEqual({ xp: 38, level: 1 });

    const second = service.submit(parentId, childId, input);

    // Lần thứ hai báo là trùng lặp, và KHÔNG có phần thưởng nào.
    expect(second.duplicate).toBe(true);
    expect(second.xpGained).toBe(0);
    expect(second.starsGained).toBe(0);
    expect(second.acornsGained).toBe(0);
    expect(second.isNewRecord).toBe(false);

    // Kết quả của VÁN vẫn phải đúng để màn hình kết quả hiện được con số thật.
    expect(second.score).toBe(first.score);
    expect(second.stars).toBe(first.stars);

    // ⭐⭐ VÀ ĐIỀU QUAN TRỌNG NHẤT CỦA T054: VÍ VÀ XP KHÔNG NHÚC NHÍCH.
    //    Tiền là CỘNG DỒN, không lũy đẳng theo tự nhiên như huy hiệu — nếu cổng chống trùng
    //    thủng ở đây thì số dư vĩnh viễn sai mà không có cách nào phát hiện về sau.
    expect(walletRow(childId)).toEqual(walletAfterFirst);
    expect(xpRow(childId)).toEqual(xpAfterFirst);

    // Và không có gì bị ghi hai lần.
    expect(countRuns(childId)).toBe(1);
    expect(wordRow(childId, 'w.monkey')).toMatchObject({ correct_count: 1 });
    expect(dailyRow(childId, '2026-10-06')).toMatchObject({
      questions_answered: 4,
      correct_count: 4,
      words_learned: 4,
      active_seconds: 42,
      stars_earned: 22,
      xp_earned: 38,
    });
  });

  // --- Kỷ lục không bao giờ giảm ------------------------------------------

  it('chơi lại KÉM hơn không làm mất kỷ lục', async () => {
    const { parentId, childId } = await newFamily();

    const good = service.submit(parentId, childId, run());
    expect(good.bestScore).toBe(9);

    // Lượt sau: 1 câu đúng ngay, 3 câu phải sửa ⇒ điểm thấp hơn hẳn.
    const worse = service.submit(
      parentId,
      childId,
      run({
        answers: [
          { wordId: 'w.monkey', firstTry: true, wrongAttempts: 0 },
          { wordId: 'w.lion', firstTry: false, wrongAttempts: 3 },
          { wordId: 'w.elephant', firstTry: false, wrongAttempts: 2 },
          { wordId: 'w.zebra', firstTry: false, wrongAttempts: 1 },
        ],
      }),
    );

    expect(worse.score).toBeLessThan(good.score);
    expect(worse.isNewRecord).toBe(false);
    // Kỷ lục VẪN là 9 — đó là lời hứa ở migration 003.
    expect(worse.bestScore).toBe(9);
    expect(lessonRow(childId, 'at-the-zoo/z1')?.best_score).toBe(9);
  });

  it('điểm BẰNG kỷ lục cũ không tính là kỷ lục mới', async () => {
    const { parentId, childId } = await newFamily();

    service.submit(parentId, childId, run());
    const second = service.submit(parentId, childId, run());

    expect(second.score).toBe(9);
    expect(second.isNewRecord).toBe(false);
  });

  // --- Thống kê ngày ------------------------------------------------------

  it('`wordsLearned` chỉ đếm từ MỚI, không đếm lại từ đã học', async () => {
    const { parentId, childId } = await newFamily();

    // Lượt 1: hai từ mới.
    service.submit(
      parentId,
      childId,
      run({
        totalRounds: 2,
        answers: [
          { wordId: 'w1', firstTry: true, wrongAttempts: 0 },
          { wordId: 'w2', firstTry: true, wrongAttempts: 0 },
        ],
      }),
    );
    expect(dailyRow(childId, '2026-10-06')?.words_learned).toBe(2);

    // Lượt 2: một từ CŨ (w1) + một từ MỚI (w3) ⇒ chỉ cộng thêm 1.
    service.submit(
      parentId,
      childId,
      run({
        totalRounds: 2,
        answers: [
          { wordId: 'w1', firstTry: true, wrongAttempts: 0 },
          { wordId: 'w3', firstTry: true, wrongAttempts: 0 },
        ],
      }),
    );

    expect(dailyRow(childId, '2026-10-06')?.words_learned).toBe(3);
    expect(dailyRow(childId, '2026-10-06')?.questions_answered).toBe(4);
  });

  it('hai ngày khác nhau có hai dòng thống kê riêng', async () => {
    const { parentId, childId } = await newFamily();

    // 2026-10-06 19:00Z ⇒ 02:00 giờ Việt Nam ngày 07 — cố ý vắt qua nửa đêm để chứng minh
    // ngày được tính theo GIỜ ĐỊA PHƯƠNG, không phải UTC.
    service.submit(parentId, childId, run({ occurredAt: '2026-10-06T19:00:00.000Z' }));

    expect(dailyRow(childId, '2026-10-06')).toBeUndefined();
    expect(dailyRow(childId, '2026-10-07')?.questions_answered).toBe(4);
  });

  // --- Quyền và kiểm dữ liệu ----------------------------------------------

  it('phụ huynh KHÁC không ghi được vào hồ sơ bé nhà người ta', async () => {
    const { childId } = await newFamily();
    const stranger = await newFamily();

    expect(() => service.submit(stranger.parentId, childId, run())).toThrowError();
    expect(countRuns(childId)).toBe(0);
  });

  it('dữ liệu thô sai định dạng bị từ chối, không ghi gì', async () => {
    const { parentId, childId } = await newFamily();

    expect(() =>
      service.submit(parentId, childId, {
        ...run(),
        gameType: 'nấu_phở',
      }),
    ).toThrowError();
    expect(countRuns(childId)).toBe(0);
  });

  it('dữ liệu MÂU THUẪN (đúng ngay lần đầu mà có lần sai) bị từ chối', async () => {
    const { parentId, childId } = await newFamily();

    expect(() =>
      service.submit(
        parentId,
        childId,
        run({
          totalRounds: 1,
          answers: [{ wordId: 'w1', firstTry: true, wrongAttempts: 3 }],
        }),
      ),
    ).toThrowError();
    expect(countRuns(childId)).toBe(0);
  });

  // =========================================================================
  // Kinh tế: XP và ví (T054)
  // =========================================================================
  //
  // ⭐ CÔNG THỨC ĐẦY ĐỦ CHO `listen_tap` (một lượt 4 câu, đúng hết, 4 từ mới):
  //      ⭐  = 4×2 (2 ⭐/câu đúng) + 4×1 (từ mới) + 10 (chơi xong)  = 22
  //      XP  = 4×2 + 4×5 (từ mới) + 10                             = 38
  //      🌰  = 0  (game không bao giờ cho hạt dẻ — chỉ nhiệm vụ và bài hoàn hảo)
  //
  //   Ba con số này xuất hiện ở BA nơi và cả ba PHẢI khớp nhau: giá trị trả về cho client,
  //   hàng trong `wallet`/`xp_state`, và dòng `daily_stats`. Một trong ba lệch nghĩa là bé
  //   thấy một con số, ví có một con số khác, và báo cáo phụ huynh nói một con số thứ ba.

  it('lượt hoàn hảo: ví, XP và thống kê ngày đều khớp con số trả về cho client', async () => {
    const { parentId, childId } = await newFamily();

    const award = service.submit(parentId, childId, run());

    expect(award.xpGained).toBe(38);
    expect(award.starsGained).toBe(22);
    expect(award.acornsGained).toBe(0);
    expect(award.levelUp).toBeNull();

    expect(walletRow(childId)).toEqual({ stars: 22, acorns: 0 });
    expect(xpRow(childId)).toEqual({ xp: 38, level: 1 });
  });

  it('hết mạng giữa chừng: KHÔNG có thưởng "chơi xong", vẫn có ⭐/XP theo câu đã đúng', async () => {
    const { parentId, childId } = await newFamily();

    const award = service.submit(
      parentId,
      childId,
      run({
        totalRounds: 10,
        answers: [
          { wordId: 'w1', firstTry: true, wrongAttempts: 0 },
          { wordId: 'w2', firstTry: true, wrongAttempts: 0 },
        ],
      }),
    );

    // 2×2 + 2×1 + 0 (không hoàn thành) = 6 ⭐ ; XP = 2×2 + 2×5 + 0 = 14.
    expect(award.starsGained).toBe(6);
    expect(award.xpGained).toBe(14);
    expect(walletRow(childId)?.stars).toBe(6);
  });

  it('chơi lại TỪ ĐÃ HỌC: không được tính ⭐/XP của "từ mới" thêm lần nữa', async () => {
    const { parentId, childId } = await newFamily();

    const answers = [
      { wordId: 'w1', firstTry: true, wrongAttempts: 0 },
      { wordId: 'w2', firstTry: true, wrongAttempts: 0 },
    ];

    // 2×2 + 2×1 + 10 = 16 ⭐ ; XP = 2×2 + 2×5 + 10 = 24.
    const first = service.submit(parentId, childId, run({ totalRounds: 2, answers }));
    expect(first.starsGained).toBe(16);
    expect(first.xpGained).toBe(24);

    // Lượt hai: CÙNG hai từ đó (đã `learned`) ⇒ mất phần "từ mới", phần còn lại giữ nguyên.
    const second = service.submit(parentId, childId, run({ totalRounds: 2, answers }));
    expect(second.starsGained).toBe(14); // 2×2 + 0 + 10
    expect(second.xpGained).toBe(14); // 2×2 + 0 + 10

    // ⚠️ HAI LƯỢT TRONG CÙNG MỘT NGÀY ⇒ dòng `daily_stats` đã tồn tại, nên đây là bài kiểm
    //    duy nhất chạm vào nhánh `ON CONFLICT ... DO UPDATE` của ba cột tiền tệ. Nếu ai đó
    //    quên `stars_earned = excluded.stars_earned` trong mệnh đề đó, lượt thứ hai sẽ không
    //    được cộng vào thống kê — và không có test nào khác bắt được.
    expect(walletRow(childId)).toEqual({ stars: 30, acorns: 0 });
    expect(dailyRow(childId, '2026-10-06')).toMatchObject({
      stars_earned: 30, // 16 + 14
      xp_earned: 38, // 24 + 14
    });
  });

  /**
   * ⭐⭐ TEST QUAN TRỌNG NHẤT CỦA T054.
   *
   *   22 câu, đúng hết, 22 từ mới ⇒ XP = 22×2 + 22×5 + 10 = 164 ≥ 150 ⇒ VƯỢT CẤP 2.
   *   Cấp 2 thưởng: huy hiệu `badge-forest-friend` + 20 ⭐ (xem `shared/content/xp-levels.json`).
   *
   *   Điều phải chứng minh KHÔNG phải "có lên cấp" — `xp-service.test.ts` đã lo phần đó. Ở đây
   *   phải chứng minh hai điều chỉ tích hợp mới bộc lộ:
   *     1. Quà của cấp THỰC SỰ vào ví trong cùng transaction với lượt chơi.
   *     2. `daily_stats` ghi ĐÚNG số dư (96), không phải chỉ phần thưởng của ván (76). Nếu ai
   *        đó đảo thứ tự ghi thống kê lên trước khi trao thưởng, assert thứ hai sẽ đỏ — và nó
   *        là dòng duy nhất bắt được lỗi đó.
   */
  it('vượt cấp: quà của cấp vào ví, `levelUp` trả về, và thống kê ngày khớp ĐÚNG số dư', async () => {
    const { parentId, childId } = await newFamily();

    const answers = Array.from({ length: 22 }, (_, i) => ({
      wordId: `w${i + 1}`,
      firstTry: true,
      wrongAttempts: 0,
    }));

    const award = service.submit(parentId, childId, run({ totalRounds: 22, answers }));

    expect(award.xpGained).toBe(164);
    expect(xpRow(childId)).toEqual({ xp: 164, level: 2 });

    // ⭐ = 22×2 + 22×1 + 10 = 76 (ván), RỒI + 20 ⭐ của cấp 2 = 96.
    expect(award.starsGained).toBe(96);
    expect(walletRow(childId)).toEqual({ stars: 96, acorns: 0 });

    expect(award.levelUp).toEqual({
      from: 1,
      to: 2,
      rewards: [
        { kind: 'badge', refId: 'badge-forest-friend' },
        { kind: 'stars', amount: 20 },
      ],
    });
    expect(award.badgesEarned).toEqual(['badge-forest-friend']);
    expect(badgeIds(childId)).toEqual(['badge-forest-friend']);

    expect(dailyRow(childId, '2026-10-06')).toMatchObject({
      stars_earned: 96,
      xp_earned: 164,
    });
  });

  /**
   * ⭐ MỘT LƯỢT CHƠI NHẢY QUA **NHIỀU** CẤP — quà của cấp bị nhảy qua KHÔNG được mất.
   *
   *   60 câu (trần `MAX_ROUNDS_PER_RUN`), đúng hết, 60 từ mới:
   *      XP = 60×2 + 60×5 + 10 = 430 ⇒ vượt CẢ cấp 2 (150) LẪN cấp 3 (400).
   *
   *   Đây là bug đắt nhất mà `XpService` tồn tại để chặn: nếu code chỉ so `cấp cũ` với `cấp mới`
   *   rồi trao quà của cấp mới, quà của cấp 3 (30 ⭐ + 3 🌰 + huy hiệu) MẤT VĨNH VIỄN — bé đã ở
   *   trên mốc XP của cấp 3 nên không bao giờ "lên" cấp đó nữa, và không ai biết bé đáng lẽ
   *   được nhận gì. Test này kiểm qua ĐÚNG đường thật (`submit`), không phải gọi service trực tiếp.
   */
  it('một lượt nhảy qua HAI cấp: quà của cả hai cấp đều được trao', async () => {
    const { parentId, childId } = await newFamily();

    const answers = Array.from({ length: 60 }, (_, i) => ({
      wordId: `w${i + 1}`,
      firstTry: true,
      wrongAttempts: 0,
    }));

    const award = service.submit(parentId, childId, run({ totalRounds: 60, answers }));

    expect(award.xpGained).toBe(430);
    expect(xpRow(childId)).toEqual({ xp: 430, level: 3 });

    // ⭐ = 60×2 + 60×1 + 10 = 190 (ván) + 20 (cấp 2) + 30 (cấp 3) = 240.
    // 🌰 = 3 (chỉ cấp 3 cho hạt dẻ).
    expect(award.starsGained).toBe(240);
    expect(award.acornsGained).toBe(3);
    expect(walletRow(childId)).toEqual({ stars: 240, acorns: 3 });

    // `levelsCrossed` là DANH SÁCH ⇒ quà của cả hai cấp được gộp, theo thứ tự tăng dần.
    expect(award.levelUp?.from).toBe(1);
    expect(award.levelUp?.to).toBe(3);
    expect(award.levelUp?.rewards).toEqual([
      { kind: 'badge', refId: 'badge-forest-friend' },
      { kind: 'stars', amount: 20 },
      { kind: 'badge', refId: 'badge-explorer' },
      { kind: 'stars', amount: 30 },
      { kind: 'acorns', amount: 3 },
    ]);
    expect(badgeIds(childId)).toEqual(['badge-explorer', 'badge-forest-friend']);

    expect(dailyRow(childId, '2026-10-06')).toMatchObject({
      stars_earned: 240,
      acorns_earned: 3,
      xp_earned: 430,
    });
  });

  // ===========================================================================
  // T069 — sticker rơi ra khi hoàn thành một bài (phần thưởng biến thiên)
  // ===========================================================================

  it('bài CÓ sticker ⇒ trao sticker mới và trả id về cho client', async () => {
    const { parentId, childId } = await newFamily();
    // `run()` mặc định `lessonId = 'at-the-zoo/z1'` — bài này có sticker "Voi con".
    const award = service.submit(parentId, childId, run());

    expect(award.stickerEarned).toBe('sticker-z1');
    expect(stickerIds(childId)).toEqual(['sticker-z1']);
  });

  /**
   * ⭐ GỬI LẠI CÙNG PAYLOAD (mất phản hồi rồi gửi lại) ⇒ KHÔNG mở thêm sticker.
   *
   *   Khoá chính `(child_id, sticker_id)` là cổng chống trùng; `stickerEarned` trả `null` ở lần
   *   gửi lại để client không ăn mừng "mở được sticker mới" cho một sticker đã có.
   */
  it('gửi lại CÙNG payload ⇒ `stickerEarned = null` và KHÔNG có hàng thứ hai', async () => {
    const { parentId, childId } = await newFamily();
    const input = run();

    const first = service.submit(parentId, childId, input);
    expect(first.stickerEarned).toBe('sticker-z1');

    const second = service.submit(parentId, childId, input);
    expect(second.duplicate).toBe(true);
    expect(second.stickerEarned).toBeNull();
    expect(stickerIds(childId)).toEqual(['sticker-z1']);
  });

  it('chơi lại bài đó ở một LƯỢT khác ⇒ sticker đã có, không trao lại', async () => {
    const { parentId, childId } = await newFamily();
    service.submit(parentId, childId, run());
    const again = service.submit(parentId, childId, run());

    expect(again.duplicate).toBe(false); // lượt mới thật sự
    expect(again.stickerEarned).toBeNull(); // nhưng sticker đã mở rồi
    expect(stickerIds(childId)).toEqual(['sticker-z1']);
  });

  /**
   * ⭐ BÀI KHÔNG CÓ STICKER LÀ CHUYỆN BÌNH THƯỜNG — KHÔNG ĐƯỢC NÉM LỖI.
   *
   *   `stickerForLesson` trả `null`; nếu luồng chấm điểm ném ở đây thì bé MẤT cả lượt chơi vì
   *   một chuyện hoàn toàn bình thường (hầu hết bài đều không có sticker).
   */
  it('bài KHÔNG có sticker ⇒ lượt chơi vẫn thành công, `stickerEarned = null`', async () => {
    const { parentId, childId } = await newFamily();
    const award = service.submit(parentId, childId, run({ lessonId: 'khong/co-sticker' }));

    expect(award.duplicate).toBe(false);
    expect(award.stars).toBe(3);
    expect(award.stickerEarned).toBeNull();
    expect(stickerIds(childId)).toEqual([]);
  });

  // ===========================================================================
  // T068 — huy hiệu THÀNH TÍCH được đánh giá trong cùng transaction lượt chơi
  // ===========================================================================

  /**
   * ⭐ Chạm mốc "thắng 20 lượt Nghe & Chạm" ⇒ huy hiệu "Tai thính" vào sổ và được báo về.
   *
   *   Chứng minh `BadgeService.evaluate` thực sự được gọi trong `submit` (T068). Nếu bỏ lời gọi
   *   đó, `badgesEarned` chỉ còn quà lên cấp — huy hiệu thành tích vào sổ không ai báo, hoặc
   *   không bao giờ vào.
   */
  it('chạm mốc 20 lượt Nghe & Chạm ⇒ huy hiệu "Tai thính" được trao và báo về (T068)', async () => {
    const { parentId, childId } = await newFamily();

    let last;
    for (let i = 0; i < 20; i += 1) last = service.submit(parentId, childId, run());

    expect(last?.badgesEarned).toContain('badge-good-ear');
    expect(badgeIds(childId)).toContain('badge-good-ear');
  });
});
