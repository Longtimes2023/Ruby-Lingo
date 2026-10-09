/**
 * Test cho luật GỘP TIẾN ĐỘ (`shared/progress-merge.ts`).
 *
 * Đây là file test quan trọng nhất của phần đồng bộ: nếu luật gộp sai, triệu chứng không
 * phải là màn hình trắng mà là **bé mất tiến độ** hoặc **báo cáo phụ huynh phồng số** — cả
 * hai đều chỉ lộ ra sau nhiều ngày sử dụng, khi đã quá muộn để sửa dữ liệu.
 */

import { describe, expect, it } from 'vitest';

import {
  MASTERED_THRESHOLD,
  applyEvent,
  completedLessonIds,
  emptySnapshot,
  learnedWordIds,
  masteredWordIds,
  mergeDailyStat,
  mergeLessonProgress,
  mergeProgressSnapshots,
  mergeThemeProgress,
  mergeWordProgress,
  starsForLesson,
} from '../../../shared/progress-merge.js';
import type {
  DailyStat,
  LessonProgress,
  ProgressSnapshot,
  ThemeProgress,
  WordProgress,
} from '../../../shared/types/progress.js';

const CHILD = 'chi_test';

const T1 = '2026-10-06T08:00:00.000Z';
const T2 = '2026-10-06T09:00:00.000Z';
const T3 = '2026-10-06T10:00:00.000Z';

function word(overrides: Partial<WordProgress> = {}): WordProgress {
  return {
    childId: CHILD,
    wordId: 'starters.orange-n',
    learned: false,
    mastered: false,
    correctCount: 0,
    wrongCount: 0,
    lastSeenAt: null,
    updatedAt: T1,
    ...overrides,
  };
}

function lesson(overrides: Partial<LessonProgress> = {}): LessonProgress {
  return {
    childId: CHILD,
    lessonId: 'at-the-zoo-1',
    bestScore: 0,
    starsBest: 0,
    attempts: 0,
    completed: false,
    completedAt: null,
    updatedAt: T1,
    ...overrides,
  };
}

function theme(overrides: Partial<ThemeProgress> = {}): ThemeProgress {
  return {
    childId: CHILD,
    themeId: 'at-the-zoo',
    unlocked: false,
    unlockedAt: null,
    lessonsCompleted: 0,
    starsEarned: 0,
    updatedAt: T1,
    ...overrides,
  };
}

function daily(overrides: Partial<DailyStat> = {}): DailyStat {
  return {
    childId: CHILD,
    date: '2026-10-06',
    wordsLearned: 0,
    questionsAnswered: 0,
    correctCount: 0,
    starsEarned: 0,
    acornsEarned: 0,
    xpEarned: 0,
    activeSeconds: 0,
    updatedAt: T1,
    ...overrides,
  };
}

// =============================================================================
// Thành tựu không bao giờ mất
// =============================================================================

describe('mergeWordProgress — thành tựu dính, số đếm theo LWW', () => {
  /**
   * ⭐ TEST QUAN TRỌNG NHẤT. Một bản ghi CŨ nhưng có `updatedAt` mới hơn (đã xảy ra khi
   *    đồng hồ thiết bị lệch, hoặc khi bản ghi được tạo lại) tuyệt đối không được xoá
   *    `mastered`. Bé đã nhớ từ rồi thì nhớ luôn.
   */
  it('KHÔNG BAO GIỜ xoá cờ "đã nhớ" dù bản ghi kia mới hơn', () => {
    const local = word({ learned: true, mastered: true, updatedAt: T1 });
    const remote = word({ learned: false, mastered: false, updatedAt: T2 });
    const merged = mergeWordProgress(local, remote);
    expect(merged.learned).toBe(true);
    expect(merged.mastered).toBe(true);
  });

  it('KHÔNG BAO GIỜ xoá cờ "đã học"', () => {
    const merged = mergeWordProgress(
      word({ learned: true, updatedAt: T3 }),
      word({ learned: false, updatedAt: T1 }),
    );
    expect(merged.learned).toBe(true);
  });

  it('lấy số đếm của bản MỚI HƠN, không cộng dồn', () => {
    const merged = mergeWordProgress(
      word({ correctCount: 5, updatedAt: T1 }),
      word({ correctCount: 7, updatedAt: T2 }),
    );
    expect(merged.correctCount).toBe(7);
  });

  /**
   * ⭐ Chống phồng số: bé chơi offline (máy đếm 5), gửi lại hàng đợi, client vẫn giữ 5.
   *    Cộng dồn sẽ ra 10 — sai vĩnh viễn. Gộp hai lần phải ra đúng một kết quả (lũy đẳng).
   */
  it('gộp LŨY ĐẲNG — gộp lại nhiều lần không làm số phồng lên', () => {
    const a = word({ correctCount: 5, updatedAt: T2 });
    const b = word({ correctCount: 5, updatedAt: T2 });
    const once = mergeWordProgress(a, b);
    const twice = mergeWordProgress(once, b);
    expect(once.correctCount).toBe(5);
    expect(twice.correctCount).toBe(5);
  });

  it('lấy mốc "lần cuối gặp" MUỘN NHẤT, bất kể bản nào thắng', () => {
    const merged = mergeWordProgress(
      word({ lastSeenAt: T3, updatedAt: T3 }),
      word({ lastSeenAt: T2, updatedAt: T2 }),
    );
    expect(merged.lastSeenAt).toBe(T3);
  });

  it('bỏ qua giá trị null khi tìm mốc muộn nhất', () => {
    const merged = mergeWordProgress(
      word({ lastSeenAt: null, updatedAt: T2 }),
      word({ lastSeenAt: T1, updatedAt: T1 }),
    );
    expect(merged.lastSeenAt).toBe(T1);
  });

  it('`updatedAt` của kết quả là mốc mới nhất trong hai', () => {
    expect(mergeWordProgress(word({ updatedAt: T1 }), word({ updatedAt: T3 })).updatedAt).toBe(T3);
  });

  it('coi chuỗi thời gian RỖNG là cũ nhất — bản ghi hỏng không đè được dữ liệu tốt', () => {
    const merged = mergeWordProgress(
      word({ correctCount: 9, updatedAt: T1 }),
      word({ correctCount: 0, updatedAt: '' }),
    );
    expect(merged.correctCount).toBe(9);
  });
});

describe('mergeLessonProgress — kỷ lục không bao giờ giảm', () => {
  it('lấy điểm cao nhất, không theo bản mới hơn', () => {
    const merged = mergeLessonProgress(
      lesson({ bestScore: 90, starsBest: 3, updatedAt: T3 }),
      lesson({ bestScore: 40, starsBest: 1, updatedAt: T1 }),
    );
    expect(merged.bestScore).toBe(90);
    expect(merged.starsBest).toBe(3);
  });

  it('lấy số sao cao nhất khi bản mới hơn có điểm thấp hơn', () => {
    const merged = mergeLessonProgress(
      lesson({ starsBest: 3, updatedAt: T1 }),
      lesson({ starsBest: 0, updatedAt: T2 }),
    );
    expect(merged.starsBest).toBe(3);
  });

  it('cờ "đã hoàn thành" dính', () => {
    const merged = mergeLessonProgress(
      lesson({ completed: true, updatedAt: T1 }),
      lesson({ completed: false, updatedAt: T2 }),
    );
    expect(merged.completed).toBe(true);
  });

  it('số lần thử lấy giá trị lớn hơn (chỉ tăng)', () => {
    expect(
      mergeLessonProgress(lesson({ attempts: 4, updatedAt: T1 }), lesson({ attempts: 2, updatedAt: T2 }))
        .attempts,
    ).toBe(4);
  });

  it('`completedAt` lấy mốc muộn nhất', () => {
    expect(
      mergeLessonProgress(
        lesson({ completedAt: T1, updatedAt: T1 }),
        lesson({ completedAt: T3, updatedAt: T3 }),
      ).completedAt,
    ).toBe(T3);
  });
});

describe('mergeThemeProgress', () => {
  it('cờ "đã mở khoá" dính', () => {
    const merged = mergeThemeProgress(
      theme({ unlocked: true, unlockedAt: T1, updatedAt: T1 }),
      theme({ unlocked: false, updatedAt: T2 }),
    );
    expect(merged.unlocked).toBe(true);
    expect(merged.unlockedAt).toBe(T1);
  });

  it('số bài đã xong và số sao lấy theo bản mới hơn', () => {
    const merged = mergeThemeProgress(
      theme({ lessonsCompleted: 1, starsEarned: 3, updatedAt: T1 }),
      theme({ lessonsCompleted: 4, starsEarned: 11, updatedAt: T2 }),
    );
    expect(merged.lessonsCompleted).toBe(4);
    expect(merged.starsEarned).toBe(11);
  });
});

describe('mergeDailyStat', () => {
  it('lấy toàn bộ theo bản mới hơn — không cộng, không lấy số lớn nhất', () => {
    const merged = mergeDailyStat(
      daily({ questionsAnswered: 20, updatedAt: T1 }),
      daily({ questionsAnswered: 12, updatedAt: T3 }),
    );
    // 12 thắng vì mới hơn: server đã tính lại và ra số nhỏ hơn là chuyện hợp lệ.
    expect(merged.questionsAnswered).toBe(12);
  });
});

// =============================================================================
// Gộp ảnh chụp
// =============================================================================

function snapshot(overrides: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return {
    childId: CHILD,
    words: [],
    lessons: [],
    themes: [],
    dailyStats: [],
    serverTime: T1,
    ...overrides,
  };
}

describe('mergeProgressSnapshots', () => {
  it('hợp nhất theo khoá, không nhân bản bản ghi', () => {
    const a = snapshot({ words: [word({ wordId: 'w1' }), word({ wordId: 'w2' })] });
    const b = snapshot({ words: [word({ wordId: 'w2' }), word({ wordId: 'w3' })] });
    const merged = mergeProgressSnapshots(a, b);
    expect(merged.words.map((w) => w.wordId)).toEqual(['w1', 'w2', 'w3']);
  });

  it('gộp nội dung của bản ghi trùng khoá', () => {
    const a = snapshot({ words: [word({ wordId: 'w1', learned: true, updatedAt: T1 })] });
    const b = snapshot({ words: [word({ wordId: 'w1', correctCount: 3, updatedAt: T2 })] });
    const merged = mergeProgressSnapshots(a, b);
    expect(merged.words).toHaveLength(1);
    expect(merged.words[0]!.learned).toBe(true);
    expect(merged.words[0]!.correctCount).toBe(3);
  });

  it('LŨY ĐẲNG — gộp một ảnh chụp với chính nó ra chính nó', () => {
    const a = snapshot({
      words: [word({ wordId: 'w1', learned: true, correctCount: 2, lastSeenAt: T2, updatedAt: T2 })],
      lessons: [lesson({ bestScore: 80, starsBest: 2, updatedAt: T2 })],
    });
    expect(mergeProgressSnapshots(a, a)).toEqual(a);
  });

  it('KHÔNG phụ thuộc thứ tự tham số (giao hoán, trừ childId)', () => {
    const a = snapshot({ words: [word({ wordId: 'w1', correctCount: 1, updatedAt: T1 })] });
    const b = snapshot({ words: [word({ wordId: 'w1', correctCount: 2, updatedAt: T2 })] });
    expect(mergeProgressSnapshots(a, b).words[0]!.correctCount).toBe(
      mergeProgressSnapshots(b, a).words[0]!.correctCount,
    );
  });

  it('kết quả sắp xếp TẤT ĐỊNH theo khoá', () => {
    const a = snapshot({ words: [word({ wordId: 'w3' }), word({ wordId: 'w1' })] });
    const b = snapshot({ words: [word({ wordId: 'w2' })] });
    expect(mergeProgressSnapshots(a, b).words.map((w) => w.wordId)).toEqual(['w1', 'w2', 'w3']);
  });

  it('gộp cả bốn loại bản ghi cùng lúc', () => {
    const a = snapshot({
      words: [word({ wordId: 'w1' })],
      lessons: [lesson({ lessonId: 'l1' })],
      themes: [theme({ themeId: 't1' })],
      dailyStats: [daily({ date: '2026-10-05' })],
    });
    const b = snapshot({
      words: [word({ wordId: 'w2' })],
      lessons: [lesson({ lessonId: 'l2' })],
      themes: [theme({ themeId: 't2' })],
      dailyStats: [daily({ date: '2026-10-06' })],
    });
    const merged = mergeProgressSnapshots(a, b);
    expect(merged.words).toHaveLength(2);
    expect(merged.lessons).toHaveLength(2);
    expect(merged.themes).toHaveLength(2);
    expect(merged.dailyStats).toHaveLength(2);
  });

  it('`serverTime` lấy mốc muộn nhất', () => {
    expect(
      mergeProgressSnapshots(snapshot({ serverTime: T1 }), snapshot({ serverTime: T3 })).serverTime,
    ).toBe(T3);
  });

  it('`childId` lấy của tham số thứ hai (bản đến sau)', () => {
    expect(
      mergeProgressSnapshots(snapshot({ childId: 'a' }), snapshot({ childId: 'b' })).childId,
    ).toBe('b');
  });
});

// =============================================================================
// Áp sự kiện tại chỗ
// =============================================================================

describe('applyEvent', () => {
  it('trả về ảnh chụp MỚI, không sửa ảnh chụp cũ (hàm thuần)', () => {
    const before = emptySnapshot(CHILD, T1);
    const after = applyEvent(before, {
      clientEventId: 'e1',
      kind: 'word_learned',
      wordId: 'w1',
      occurredAt: T2,
    });
    expect(before.words).toHaveLength(0);
    expect(after.words).toHaveLength(1);
    expect(after).not.toBe(before);
  });

  it('trả lời đúng ⇒ tăng số đúng và đánh dấu đã học', () => {
    const after = applyEvent(emptySnapshot(CHILD, T1), {
      clientEventId: 'e1',
      kind: 'word_answer',
      wordId: 'w1',
      correct: true,
      occurredAt: T2,
    });
    expect(after.words[0]).toMatchObject({
      wordId: 'w1',
      correctCount: 1,
      wrongCount: 0,
      learned: true,
      mastered: false,
    });
  });

  it('trả lời chưa đúng ⇒ tăng số sai, KHÔNG đánh dấu đã nhớ', () => {
    const after = applyEvent(emptySnapshot(CHILD, T1), {
      clientEventId: 'e1',
      kind: 'word_answer',
      wordId: 'w1',
      correct: false,
      occurredAt: T2,
    });
    expect(after.words[0]).toMatchObject({ correctCount: 0, wrongCount: 1, mastered: false });
  });

  it('đánh dấu "đã nhớ" sau đúng 3 lần', () => {
    let snap = emptySnapshot(CHILD, T1);
    for (let i = 0; i < MASTERED_THRESHOLD; i += 1) {
      snap = applyEvent(snap, {
        clientEventId: `e${i}`,
        kind: 'word_answer',
        wordId: 'w1',
        correct: true,
        occurredAt: T2,
      });
    }
    expect(snap.words[0]!.mastered).toBe(true);
  });

  it('cờ "đã nhớ" dính — trả lời sai sau đó không xoá nó', () => {
    let snap = applyEvent(emptySnapshot(CHILD, T1), {
      clientEventId: 'e1',
      kind: 'word_answer',
      wordId: 'w1',
      correct: true,
      occurredAt: T2,
    });
    snap = { ...snap, words: [{ ...snap.words[0]!, mastered: true }] };
    snap = applyEvent(snap, {
      clientEventId: 'e2',
      kind: 'word_answer',
      wordId: 'w1',
      correct: false,
      occurredAt: T3,
    });
    expect(snap.words[0]!.mastered).toBe(true);
    expect(snap.words[0]!.wrongCount).toBe(1);
  });

  it('dùng `occurredAt` của SỰ KIỆN làm updatedAt, không dùng giờ hệ thống', () => {
    const after = applyEvent(emptySnapshot(CHILD, T1), {
      clientEventId: 'e1',
      kind: 'word_learned',
      wordId: 'w1',
      occurredAt: T2,
    });
    expect(after.words[0]!.updatedAt).toBe(T2);
  });

  it('áp nhiều sự kiện cho cùng một từ thì cộng dồn trong máy', () => {
    let snap = emptySnapshot(CHILD, T1);
    for (const correct of [true, true, false, true]) {
      snap = applyEvent(snap, {
        clientEventId: `e${correct}-${Math.random()}`,
        kind: 'word_answer',
        wordId: 'w1',
        correct,
        occurredAt: T2,
      });
    }
    expect(snap.words[0]!.correctCount).toBe(3);
    expect(snap.words[0]!.wrongCount).toBe(1);
  });

  it('sự kiện hoàn thành bài đánh dấu bài đã xong', () => {
    const after = applyEvent(emptySnapshot(CHILD, T1), {
      clientEventId: 'e1',
      kind: 'lesson_completed',
      lessonId: 'l1',
      occurredAt: T2,
    });
    expect(after.lessons[0]).toMatchObject({ lessonId: 'l1', completed: true, completedAt: T2 });
  });

  it('sự kiện thiếu id tương ứng ⇒ trả nguyên trạng, không ném lỗi', () => {
    const before = emptySnapshot(CHILD, T1);
    expect(applyEvent(before, { clientEventId: 'e1', kind: 'word_learned', occurredAt: T2 })).toBe(
      before,
    );
    expect(
      applyEvent(before, { clientEventId: 'e2', kind: 'lesson_completed', occurredAt: T2 }),
    ).toBe(before);
  });

  it('không nhân bản bản ghi khi áp nhiều sự kiện cho cùng một từ', () => {
    let snap = emptySnapshot(CHILD, T1);
    for (let i = 0; i < 5; i += 1) {
      snap = applyEvent(snap, {
        clientEventId: `e${i}`,
        kind: 'word_answer',
        wordId: 'w1',
        correct: true,
        occurredAt: T2,
      });
    }
    expect(snap.words).toHaveLength(1);
  });
});

// =============================================================================
// Truy vấn tiện dụng
// =============================================================================

describe('truy vấn trên ảnh chụp', () => {
  const snap = snapshot({
    words: [
      word({ wordId: 'w1', learned: true, mastered: true }),
      word({ wordId: 'w2', learned: true, mastered: false }),
      word({ wordId: 'w3', learned: false }),
    ],
    lessons: [lesson({ lessonId: 'l1', starsBest: 2 })],
  });

  it('`learnedWordIds` chỉ gồm từ đã học', () => {
    expect([...learnedWordIds(snap)].sort()).toEqual(['w1', 'w2']);
  });

  it('`masteredWordIds` chỉ gồm từ đã nhớ chắc', () => {
    expect([...masteredWordIds(snap)]).toEqual(['w1']);
  });

  it('`starsForLesson` trả số sao cao nhất', () => {
    expect(starsForLesson(snap, 'l1')).toBe(2);
  });

  it('`starsForLesson` trả 0 cho bài chưa chơi', () => {
    expect(starsForLesson(snap, 'khong-co')).toBe(0);
  });
});

// =============================================================================
// `completedLessonIds` — nguồn chân lý DUY NHẤT cho "bài đã xong"
// =============================================================================
//
// Bộ test này khoá lại một lỗi đã HIỆN RA MÀN HÌNH: `ThemePage` từng tự định nghĩa "bài đã
// xong" là "bé đã học hết số từ của bài", trong khi luật mở khoá dùng `LessonProgress.completed`.
// Hai định nghĩa lệch nhau nên màn chủ đề ghi "✓ Bé đã học xong bài này!" trong khi thẻ chủ đề
// trên bản đồ vẫn ghi "0/3 bài" — hai màn hình nói ngược nhau về cùng một việc.

describe('`completedLessonIds`', () => {
  it('chỉ gồm bài có cờ `completed`, KHÔNG suy ra từ số từ đã học', () => {
    const snap = snapshot({
      words: [
        // Bé đã học hết 3 từ của bài `l1`…
        word({ wordId: 'w1', learned: true }),
        word({ wordId: 'w2', learned: true }),
        word({ wordId: 'w3', learned: true }),
      ],
      lessons: [
        // …nhưng bài `l1` CHƯA được ghi nhận hoàn thành.
        lesson({ lessonId: 'l1', completed: false }),
        lesson({ lessonId: 'l2', completed: true }),
      ],
    });

    const done = completedLessonIds(snap);

    expect([...done]).toEqual(['l2']);
    expect(done.has('l1')).toBe(false);
  });

  it('bài chưa có bản ghi tiến độ nào thì không tính là xong', () => {
    const snap = snapshot({ lessons: [] });
    expect(completedLessonIds(snap).size).toBe(0);
  });

  it('ảnh chụp rỗng cho ra tập rỗng', () => {
    expect(completedLessonIds(emptySnapshot(CHILD, T1)).size).toBe(0);
  });

  it('sự kiện `lesson_completed` làm bài xuất hiện trong tập', () => {
    const after = applyEvent(emptySnapshot(CHILD, T1), {
      clientEventId: 'e1',
      kind: 'lesson_completed',
      lessonId: 'l9',
      occurredAt: T2,
    });

    expect(completedLessonIds(after).has('l9')).toBe(true);
  });

  it('gộp ảnh chụp không làm mất cờ `completed` đã có ở một bên', () => {
    const local = snapshot({ lessons: [lesson({ lessonId: 'l1', completed: true })] });
    const remote = snapshot({ lessons: [lesson({ lessonId: 'l2', completed: true })] });

    const merged = mergeProgressSnapshots(local, remote);

    expect([...completedLessonIds(merged)].sort()).toEqual(['l1', 'l2']);
  });
});
