/**
 * RubyLingo — Test luật MỞ KHOÁ chủ đề (`shared/theme-access.ts`).
 *
 * ⭐ VÌ SAO BỘ TEST NÀY QUAN TRỌNG HƠN VẺ NGOÀI CỦA NÓ:
 *   `resolveThemeAccess` quyết định bé có bấm vào được một chủ đề hay không. Nếu nó sai theo
 *   hướng "khoá nhầm", bé mất quyền học những từ đã có sẵn trong ứng dụng — và triệu chứng là
 *   một tấm thẻ xám, không phải một thông báo lỗi. Nếu nó sai theo hướng "mở nhầm", bé vào được
 *   một chủ đề trống. Cả hai đều im lặng, nên phải có test canh.
 *
 * ⚠️ BỐN TRƯỜNG HỢP DỄ SAI NHẤT, ĐỀU CÓ TEST RIÊNG:
 *   1. `unlockCondition.type === 'coming_soon'` + CÓ từ vựng ⇒ phải là `study`, KHÔNG phải khoá.
 *      Đây là trường hợp của 10/11 chủ đề Starters hiện tại.
 *   2. Chủ đề không có nội dung ⇒ `coming_soon`, và `serverUnlocked` KHÔNG được cứu nó.
 *   3. `previous_theme` khi chủ đề trước KHÔNG có nội dung ⇒ phải MỞ, nếu không sẽ khoá vĩnh
 *      viễn mọi chủ đề đứng sau.
 *   4. Tiến độ phải tính từ `snapshot.lessons` (có ngay cả khi offline), KHÔNG từ
 *      `snapshot.themes[].lessonsCompleted` (chỉ có sau khi đồng bộ).
 */

import { describe, expect, it } from 'vitest';

import {
  MAX_STARS_PER_LESSON,
  resolveThemeAccess,
  summarizeThemeAccess,
  themeAccessById,
} from '@shared/theme-access.js';
import type {
  LessonProgress,
  ProgressSnapshot,
  ThemeProgress,
  WordProgress,
} from '@shared/types/progress.js';
import type { Theme, ThemeMapItem, UnlockCondition } from '@shared/types/content.js';

// =============================================================================
// Bộ dựng dữ liệu
// =============================================================================

const T0 = '2026-10-06T08:00:00.000Z';

interface ThemeSpec {
  id: string;
  name_vi?: string;
  /** Id các bài. Bỏ trống = chủ đề chưa có nội dung. */
  lessonIds?: string[];
  unlockCondition?: UnlockCondition;
  exerciseCount?: number;
  /** Số từ. Mặc định suy ra: có bài ⇒ 5 từ, không bài ⇒ 0. */
  wordCount?: number;
}

function makeTheme(spec: ThemeSpec): Theme {
  const lessonIds = spec.lessonIds ?? [];
  return {
    id: spec.id,
    levelId: 'starters',
    name_en: spec.id,
    name_vi: spec.name_vi ?? spec.id,
    icon: '🐾',
    sceneImage: '',
    sceneAlt: '',
    unlockCondition: spec.unlockCondition ?? { type: 'always' },
    lessonIds,
  };
}

function makeItems(specs: ThemeSpec[]): ThemeMapItem[] {
  return specs.map((spec, position) => {
    const theme = makeTheme(spec);
    return {
      theme,
      index: position + 1,
      wordCount: spec.wordCount ?? (theme.lessonIds.length > 0 ? 5 : 0),
      lessonCount: theme.lessonIds.length,
      exerciseCount: spec.exerciseCount ?? 0,
      sceneUrl: null,
    };
  });
}

function makeLesson(
  lessonId: string,
  options: { completed?: boolean; starsBest?: 0 | 1 | 2 | 3 } = {},
): LessonProgress {
  return {
    childId: 'c1',
    lessonId,
    bestScore: 0,
    starsBest: options.starsBest ?? 0,
    attempts: options.completed ? 1 : 0,
    completed: options.completed ?? false,
    completedAt: options.completed ? T0 : null,
    updatedAt: T0,
  };
}

function makeWord(wordId: string, learned: boolean): WordProgress {
  return {
    childId: 'c1',
    wordId,
    learned,
    mastered: false,
    correctCount: 0,
    wrongCount: 0,
    lastSeenAt: learned ? T0 : null,
    updatedAt: T0,
  };
}

function makeThemeProgress(themeId: string, unlocked: boolean): ThemeProgress {
  return {
    childId: 'c1',
    themeId,
    unlocked,
    unlockedAt: unlocked ? T0 : null,
    lessonsCompleted: 0,
    starsEarned: 0,
    updatedAt: T0,
  };
}

function makeSnapshot(overrides: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return {
    childId: 'c1',
    words: [],
    lessons: [],
    themes: [],
    dailyStats: [],
    serverTime: T0,
    ...overrides,
  };
}

// =============================================================================
// `always` và `coming_soon`
// =============================================================================

describe('resolveThemeAccess — điều kiện always và coming_soon', () => {
  it('`always` + có nội dung ⇒ mở, và có game thì `open`', () => {
    const items = makeItems([
      { id: 'zoo', lessonIds: ['zoo/z1'], unlockCondition: { type: 'always' }, exerciseCount: 5 },
    ]);

    const [access] = resolveThemeAccess(items, makeSnapshot());

    expect(access?.kind).toBe('open');
    expect(access?.enterable).toBe(true);
    expect(access?.hasGames).toBe(true);
    expect(access?.requirement).toBeNull();
  });

  it('`always` + có nội dung nhưng CHƯA có game ⇒ vẫn `open` (kind `open` không đòi game)', () => {
    const items = makeItems([
      { id: 'zoo', lessonIds: ['zoo/z1'], unlockCondition: { type: 'always' } },
    ]);

    const [access] = resolveThemeAccess(items, makeSnapshot());

    expect(access?.kind).toBe('open');
    expect(access?.enterable).toBe(true);
    expect(access?.hasGames).toBe(false);
  });

  it('`coming_soon` + CÓ từ vựng, chưa có game ⇒ `study` và VẪN VÀO ĐƯỢC', () => {
    const items = makeItems([
      { id: 'body', lessonIds: ['body/b1', 'body/b2'], unlockCondition: { type: 'coming_soon' } },
    ]);

    const [access] = resolveThemeAccess(items, makeSnapshot());

    expect(access?.kind).toBe('study');
    expect(access?.enterable).toBe(true);
    expect(access?.hasGames).toBe(false);
    expect(access?.requirement).toBeNull();
  });

  it('`coming_soon` + có game ⇒ `open` (dữ liệu tự mâu thuẫn, chọn kết quả có lợi cho bé)', () => {
    const items = makeItems([
      {
        id: 'body',
        lessonIds: ['body/b1'],
        unlockCondition: { type: 'coming_soon' },
        exerciseCount: 3,
      },
    ]);

    const [access] = resolveThemeAccess(items, makeSnapshot());

    expect(access?.kind).toBe('open');
    expect(access?.enterable).toBe(true);
  });

  it('KHÔNG có bài nào ⇒ `coming_soon`, không vào được, không có yêu cầu nào để nêu', () => {
    const items = makeItems([{ id: 'empty', unlockCondition: { type: 'always' } }]);

    const [access] = resolveThemeAccess(items, makeSnapshot());

    expect(access?.kind).toBe('coming_soon');
    expect(access?.enterable).toBe(false);
    expect(access?.requirement).toBeNull();
    expect(access?.lessonCount).toBe(0);
  });

  it('CÓ bài nhưng 0 từ ⇒ vẫn `coming_soon` (bài học rỗng thì không có gì để học)', () => {
    const items = makeItems([
      { id: 'hollow', lessonIds: ['hollow/h1'], wordCount: 0, exerciseCount: 2 },
    ]);

    const [access] = resolveThemeAccess(items, makeSnapshot());

    expect(access?.kind).toBe('coming_soon');
    expect(access?.enterable).toBe(false);
  });

  it('chủ đề không nội dung KHÔNG được `serverUnlocked` cứu', () => {
    const items = makeItems([{ id: 'empty', unlockCondition: { type: 'always' } }]);
    const snapshot = makeSnapshot({ themes: [makeThemeProgress('empty', true)] });

    const [access] = resolveThemeAccess(items, snapshot);

    expect(access?.kind).toBe('coming_soon');
    expect(access?.enterable).toBe(false);
  });
});

// =============================================================================
// `previous_theme`
// =============================================================================

describe('resolveThemeAccess — điều kiện previous_theme', () => {
  const chain = (): ThemeMapItem[] =>
    makeItems([
      { id: 'first', lessonIds: ['first/l1', 'first/l2'] },
      {
        id: 'second',
        lessonIds: ['second/l1'],
        unlockCondition: { type: 'previous_theme' },
      },
    ]);

  it('chủ đề trước CHƯA xong ⇒ khoá, và nêu ĐÍCH DANH chủ đề cần học xong', () => {
    const items = chain();
    const snapshot = makeSnapshot({
      lessons: [makeLesson('first/l1', { completed: true })],
    });

    const [, second] = resolveThemeAccess(items, snapshot);

    expect(second?.kind).toBe('locked');
    expect(second?.enterable).toBe(false);
    expect(second?.requirement).toEqual({
      type: 'previous_theme',
      themeId: 'first',
      themeName_vi: 'first',
    });
  });

  it('chủ đề trước xong HẾT các bài ⇒ mở', () => {
    const items = chain();
    const snapshot = makeSnapshot({
      lessons: [
        makeLesson('first/l1', { completed: true }),
        makeLesson('first/l2', { completed: true }),
      ],
    });

    const [, second] = resolveThemeAccess(items, snapshot);

    expect(second?.kind).toBe('open');
    expect(second?.enterable).toBe(true);
  });

  it('chủ đề đầu tiên dùng `previous_theme` ⇒ vẫn mở (không có chủ đề trước)', () => {
    const items = makeItems([
      { id: 'first', lessonIds: ['first/l1'], unlockCondition: { type: 'previous_theme' } },
    ]);

    const [first] = resolveThemeAccess(items, makeSnapshot());

    expect(first?.kind).toBe('open');
  });

  it('chủ đề TRƯỚC không có nội dung ⇒ BỎ QUA điều kiện, không khoá vĩnh viễn', () => {
    // Kịch bản thật: người soạn nội dung thả một chủ đề trống vào giữa `level.themeIds`.
    // Nếu lấy nó làm điều kiện, "hoàn thành" là bất khả thi ⇒ mọi chủ đề sau bị khoá mãi mãi.
    const items = makeItems([
      { id: 'hole', unlockCondition: { type: 'always' } },
      { id: 'after', lessonIds: ['after/l1'], unlockCondition: { type: 'previous_theme' } },
    ]);

    const [, after] = resolveThemeAccess(items, makeSnapshot());

    expect(after?.kind).toBe('open');
    expect(after?.enterable).toBe(true);
  });

  it('xong bài khi ĐANG OFFLINE vẫn mở được chủ đề kế (đọc từ `snapshot.lessons`)', () => {
    // `snapshot.themes` RỖNG — đúng trạng thái sau khi bé học xong mà chưa đồng bộ được.
    // Nếu luật này đọc `ThemeProgress.lessonsCompleted` thì sẽ là 0 và chủ đề vẫn khoá.
    const items = chain();
    const snapshot = makeSnapshot({
      lessons: [
        makeLesson('first/l1', { completed: true }),
        makeLesson('first/l2', { completed: true }),
      ],
      themes: [],
    });

    const [, second] = resolveThemeAccess(items, snapshot);

    expect(second?.kind).toBe('open');
  });
});

// =============================================================================
// `stars_required`
// =============================================================================

describe('resolveThemeAccess — điều kiện stars_required', () => {
  const items = (): ThemeMapItem[] =>
    makeItems([
      // Hai bài ⇒ tối đa 6 sao, đủ chỗ để vượt ngưỡng 4.
      { id: 'a', lessonIds: ['a/l1', 'a/l2'] },
      { id: 'b', lessonIds: ['b/l1'], unlockCondition: { type: 'stars_required', stars: 4 } },
    ]);

  it('chưa đủ sao ⇒ khoá, và nói rõ đang có bao nhiêu', () => {
    const snapshot = makeSnapshot({ lessons: [makeLesson('a/l1', { starsBest: 2 })] });

    const [, b] = resolveThemeAccess(items(), snapshot);

    expect(b?.kind).toBe('locked');
    expect(b?.requirement).toEqual({ type: 'stars_required', stars: 4, have: 2 });
  });

  it('đủ sao ⇒ mở', () => {
    const snapshot = makeSnapshot({
      lessons: [makeLesson('a/l1', { starsBest: 2 }), makeLesson('a/l2', { starsBest: 2 })],
    });

    const [, b] = resolveThemeAccess(items(), snapshot);

    expect(b?.kind).toBe('open');
    expect(b?.requirement).toBeNull();
  });

  it('`stars: 0` ⇒ mở ngay (không phải một cách khoá lén)', () => {
    const custom = makeItems([
      { id: 'a', lessonIds: ['a/l1'], unlockCondition: { type: 'stars_required', stars: 0 } },
    ]);

    const [a] = resolveThemeAccess(custom, makeSnapshot());

    expect(a?.kind).toBe('open');
  });

  it('sao của chủ đề ĐỨNG SAU cũng được tính — điều kiện nói về TỔNG của cả cấp', () => {
    const snapshot = makeSnapshot({
      lessons: [
        makeLesson('a/l1', { starsBest: 1 }),
        // 'c' đứng sau 'b' nhưng sao của nó vẫn thuộc về bé.
        makeLesson('c/l1', { starsBest: 3 }),
      ],
    });
    const itemsWithThird = makeItems([
      { id: 'a', lessonIds: ['a/l1'] },
      { id: 'b', lessonIds: ['b/l1'], unlockCondition: { type: 'stars_required', stars: 4 } },
      { id: 'c', lessonIds: ['c/l1'] },
    ]);

    const [, b] = resolveThemeAccess(itemsWithThird, snapshot);

    expect(b?.kind).toBe('open');
  });
});

// =============================================================================
// Quyền do server cấp
// =============================================================================

describe('resolveThemeAccess — quyền do server cấp', () => {
  it('`unlocked: true` mở được chủ đề đang bị điều kiện nội dung khoá', () => {
    const items = makeItems([
      { id: 'a', lessonIds: ['a/l1'] },
      { id: 'b', lessonIds: ['b/l1'], unlockCondition: { type: 'stars_required', stars: 99 } },
    ]);
    const snapshot = makeSnapshot({ themes: [makeThemeProgress('b', true)] });

    const [, b] = resolveThemeAccess(items, snapshot);

    expect(b?.kind).toBe('open');
    expect(b?.enterable).toBe(true);
    expect(b?.requirement).toBeNull();
  });

  it('`unlocked: false` không thay đổi gì so với việc không có bản ghi', () => {
    const items = makeItems([
      { id: 'a', lessonIds: ['a/l1'] },
      { id: 'b', lessonIds: ['b/l1'], unlockCondition: { type: 'previous_theme' } },
    ]);
    const snapshot = makeSnapshot({ themes: [makeThemeProgress('b', false)] });

    const [, b] = resolveThemeAccess(items, snapshot);

    expect(b?.kind).toBe('locked');
  });
});

// =============================================================================
// Số liệu tiến độ
// =============================================================================

describe('resolveThemeAccess — số liệu tiến độ', () => {
  it('`starsMax` = số bài × 3', () => {
    expect(MAX_STARS_PER_LESSON).toBe(3);

    const items = makeItems([{ id: 'a', lessonIds: ['a/l1', 'a/l2', 'a/l3'] }]);
    const [a] = resolveThemeAccess(items, makeSnapshot());

    expect(a?.starsMax).toBe(9);
    expect(a?.starsEarned).toBe(0);
  });

  it('`starsEarned` chỉ cộng sao của các bài THUỘC chủ đề này', () => {
    const items = makeItems([
      { id: 'a', lessonIds: ['a/l1'] },
      { id: 'b', lessonIds: ['b/l1'] },
    ]);
    const snapshot = makeSnapshot({
      lessons: [makeLesson('a/l1', { starsBest: 2 }), makeLesson('b/l1', { starsBest: 3 })],
    });

    const [a, b] = resolveThemeAccess(items, snapshot);

    expect(a?.starsEarned).toBe(2);
    expect(b?.starsEarned).toBe(3);
  });

  it('`lessonsCompleted` đếm đúng số bài đã xong, không vượt quá `lessonCount`', () => {
    const items = makeItems([{ id: 'a', lessonIds: ['a/l1', 'a/l2'] }]);
    const snapshot = makeSnapshot({
      lessons: [
        makeLesson('a/l1', { completed: true }),
        makeLesson('a/l2', { completed: true }),
        // Bài lạ (đến từ level khác, hoặc dữ liệu cũ) không được tính vào chủ đề này.
        makeLesson('other/x', { completed: true }),
      ],
    });

    const [a] = resolveThemeAccess(items, snapshot);

    expect(a?.lessonsCompleted).toBe(2);
    expect(a?.lessonCount).toBe(2);
  });

  it('`wordsLearned` đếm từ đã học trong chủ đề khi có `wordIdsByTheme`', () => {
    const items = makeItems([{ id: 'a', lessonIds: ['a/l1'], wordCount: 3 }]);
    const snapshot = makeSnapshot({
      words: [makeWord('w1', true), makeWord('w2', false), makeWord('w3', true)],
    });
    const wordIdsByTheme = new Map<string, readonly string[]>([['a', ['w1', 'w2', 'w3']]]);

    const [a] = resolveThemeAccess(items, snapshot, { wordIdsByTheme });

    expect(a?.wordsLearned).toBe(2);
    expect(a?.wordCount).toBe(3);
  });

  it('thiếu `wordIdsByTheme` ⇒ `wordsLearned` bằng 0 (không đoán bừa)', () => {
    const items = makeItems([{ id: 'a', lessonIds: ['a/l1'], wordCount: 3 }]);
    const snapshot = makeSnapshot({ words: [makeWord('w1', true)] });

    const [a] = resolveThemeAccess(items, snapshot);

    expect(a?.wordsLearned).toBe(0);
  });
});

// =============================================================================
// Hình dạng kết quả và tính thuần
// =============================================================================

describe('resolveThemeAccess — hình dạng kết quả', () => {
  it('trả về mảng SONG SONG với đầu vào: cùng thứ tự, cùng độ dài, `index` từ 1', () => {
    const items = makeItems([
      { id: 'a', lessonIds: ['a/l1'] },
      { id: 'b', lessonIds: ['b/l1'] },
      { id: 'c', lessonIds: ['c/l1'] },
    ]);

    const access = resolveThemeAccess(items, makeSnapshot());

    expect(access).toHaveLength(3);
    expect(access.map((item) => item.themeId)).toEqual(['a', 'b', 'c']);
    expect(access.map((item) => item.index)).toEqual([1, 2, 3]);
  });

  it('danh sách rỗng ⇒ mảng rỗng, không ném lỗi', () => {
    expect(resolveThemeAccess([], makeSnapshot())).toEqual([]);
  });

  it('KHÔNG sửa đầu vào (hàm thuần)', () => {
    const items = makeItems([{ id: 'a', lessonIds: ['a/l1'] }]);
    const snapshot = makeSnapshot({ lessons: [makeLesson('a/l1', { completed: true })] });
    const itemsBefore = JSON.stringify(items);
    const snapshotBefore = JSON.stringify(snapshot);

    resolveThemeAccess(items, snapshot);

    expect(JSON.stringify(items)).toBe(itemsBefore);
    expect(JSON.stringify(snapshot)).toBe(snapshotBefore);
  });

  it('`themeAccessById` tra đúng theo id', () => {
    const items = makeItems([
      { id: 'a', lessonIds: ['a/l1'] },
      { id: 'b', lessonIds: ['b/l1'] },
    ]);

    const byId = themeAccessById(resolveThemeAccess(items, makeSnapshot()));

    expect(byId.size).toBe(2);
    expect(byId.get('b')?.index).toBe(2);
    expect(byId.get('missing')).toBeUndefined();
  });

  it('`summarizeThemeAccess` cộng đúng, và đếm số chủ đề vào được', () => {
    const items = makeItems([
      { id: 'a', lessonIds: ['a/l1'], wordCount: 4 },
      { id: 'b', lessonIds: ['b/l1'], wordCount: 6 },
      { id: 'empty' },
    ]);
    const snapshot = makeSnapshot({
      lessons: [makeLesson('a/l1', { completed: true, starsBest: 3 })],
      words: [makeWord('w1', true), makeWord('w2', true)],
    });
    const wordIdsByTheme = new Map<string, readonly string[]>([
      ['a', ['w1', 'w2']],
      ['b', []],
    ]);

    const summary = summarizeThemeAccess(
      resolveThemeAccess(items, snapshot, { wordIdsByTheme }),
    );

    expect(summary.themeCount).toBe(3);
    expect(summary.enterableCount).toBe(2);
    expect(summary.wordCount).toBe(10);
    expect(summary.wordsLearned).toBe(2);
    expect(summary.starsEarned).toBe(3);
    expect(summary.starsMax).toBe(6);
  });
});
