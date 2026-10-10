/**
 * RubyLingo — Test LUẬT MỞ KHOÁ bài thi cuối khoá (`shared/final-test-access.ts`).
 *
 * ⭐ VÌ SAO BỘ TEST NÀY QUAN TRỌNG HƠN VẺ NGOÀI CỦA NÓ:
 *   `resolveFinalTestAccess` quyết định bé có vào được khu vực thi hay không. Sai theo hướng
 *   "khoá nhầm" ⇒ bé đã học và chơi hết mà cổng vẫn đóng (triệu chứng: một tấm thẻ xám, không có
 *   lỗi). Sai theo hướng "mở nhầm" ⇒ bé vào làm bài trong khi chưa học hết. Và tệ nhất: sai theo
 *   hướng "kết luận thiếu khi CHƯA có dữ liệu" ⇒ MẮNG OAN một bé vừa chơi xong mà đang offline.
 *
 * ⚠️ BỐN CA BIÊN BẮT BUỘC, MỖI CA MỘT TEST:
 *   1. Chủ đề 0 bài ⇒ không đóng góp id nào ⇒ KHÔNG khoá (bỏ qua, không khoá).
 *   2. `requiredExerciseIds` rỗng ⇒ vế B coi như đạt.
 *   3. Đã có kết quả thi ⇒ `done`, LUÔN vào được (kể cả khi nội dung lớn thêm).
 *   4. Chưa hydrate ⇒ `pending`, TUYỆT ĐỐI không lộ "còn thiếu".
 */

import { describe, expect, it } from 'vitest';

import { resolveFinalTestAccess, type FinalTestAccessInput } from '@shared/final-test-access.js';
import type { LessonProgress } from '@shared/types/progress.js';

// =============================================================================
// Bộ dựng dữ liệu
// =============================================================================

const T0 = '2026-10-10T08:00:00.000Z';

function lesson(lessonId: string, completed: boolean): LessonProgress {
  return {
    childId: 'c1',
    lessonId,
    bestScore: 0,
    starsBest: completed ? 1 : 0,
    attempts: completed ? 1 : 0,
    completed,
    completedAt: completed ? T0 : null,
    updatedAt: T0,
  };
}

function input(overrides: Partial<FinalTestAccessInput> = {}): FinalTestAccessInput {
  return {
    lessons: [],
    requiredLessonIds: [],
    requiredExerciseIds: [],
    playedExerciseIds: new Set<string>(),
    hydrated: true,
    ...overrides,
  };
}

// =============================================================================
// Vế A — học hết
// =============================================================================

describe('resolveFinalTestAccess — vế A (học hết)', () => {
  it('còn bài chưa xong ⇒ locked + lessons_incomplete, nêu ĐÚNG số còn thiếu', () => {
    const access = resolveFinalTestAccess(
      input({
        requiredLessonIds: ['a/l1', 'a/l2', 'b/l1'],
        lessons: [lesson('a/l1', true)],
      }),
    );

    expect(access.kind).toBe('locked');
    expect(access.enterable).toBe(false);
    expect(access.requirement).toEqual({
      type: 'lessons_incomplete',
      lessonsMissing: 2,
      lessonsCompleted: 1,
      lessonsTotal: 3,
    });
    expect(access.lessonsCompleted).toBe(1);
    expect(access.lessonsTotal).toBe(3);
  });

  it('mọi bài đều xong VÀ chơi hết game ⇒ ready, enterable', () => {
    const access = resolveFinalTestAccess(
      input({
        requiredLessonIds: ['a/l1', 'b/l1'],
        requiredExerciseIds: ['a/l1/g1'],
        lessons: [lesson('a/l1', true), lesson('b/l1', true)],
        playedExerciseIds: new Set(['a/l1/g1']),
      }),
    );

    expect(access.kind).toBe('ready');
    expect(access.enterable).toBe(true);
    expect(access.requirement).toBeNull();
  });

  it('bài lạ (không trong requiredLessonIds) KHÔNG được tính vào mẫu số', () => {
    const access = resolveFinalTestAccess(
      input({
        requiredLessonIds: ['a/l1'],
        lessons: [lesson('a/l1', true), lesson('other/x', true)],
      }),
    );

    expect(access.lessonsCompleted).toBe(1);
    expect(access.lessonsTotal).toBe(1);
    expect(access.kind).toBe('ready');
  });

  it('ưu tiên BÀI trước GAME: thiếu cả hai ⇒ nêu lessons_incomplete', () => {
    const access = resolveFinalTestAccess(
      input({
        requiredLessonIds: ['a/l1'],
        requiredExerciseIds: ['a/l1/g1'],
        lessons: [],
        playedExerciseIds: new Set(),
      }),
    );

    expect(access.kind).toBe('locked');
    expect(access.requirement?.type).toBe('lessons_incomplete');
  });
});

// =============================================================================
// Vế B — chơi hết
// =============================================================================

describe('resolveFinalTestAccess — vế B (chơi hết game)', () => {
  it('học hết nhưng còn game chưa chơi ⇒ locked + games_unplayed', () => {
    const access = resolveFinalTestAccess(
      input({
        requiredLessonIds: ['a/l1'],
        requiredExerciseIds: ['a/l1/g1', 'a/l1/g2', 'b/l1/g1'],
        lessons: [lesson('a/l1', true)],
        playedExerciseIds: new Set(['a/l1/g1']),
      }),
    );

    expect(access.kind).toBe('locked');
    expect(access.requirement).toEqual({
      type: 'games_unplayed',
      gamesMissing: 2,
      gamesPlayed: 1,
      gamesTotal: 3,
    });
    expect(access.exercisesPlayed).toBe(1);
    expect(access.exercisesTotal).toBe(3);
  });

  it('game lạ (không trong requiredExerciseIds) không tính vào mẫu số', () => {
    const access = resolveFinalTestAccess(
      input({
        requiredExerciseIds: ['a/l1/g1'],
        playedExerciseIds: new Set(['a/l1/g1', 'zzz/g9']),
      }),
    );

    expect(access.exercisesPlayed).toBe(1);
    expect(access.exercisesTotal).toBe(1);
    expect(access.kind).toBe('ready');
  });
});

// =============================================================================
// Ca biên bắt buộc
// =============================================================================

describe('resolveFinalTestAccess — ca biên bắt buộc', () => {
  it('chủ đề 0 bài (không đóng góp id nào) ⇒ KHÔNG khoá', () => {
    // Chủ đề rỗng không có id bài lẫn id game ⇒ hai danh sách required rỗng ⇒ điều kiện thoả
    // hiển nhiên. Đây đúng là ca "chủ đề 0 bài bỏ qua, không khoá" (theme-access.ts:198).
    const access = resolveFinalTestAccess(input({ hydrated: true }));

    expect(access.kind).toBe('ready');
    expect(access.enterable).toBe(true);
    expect(access.requirement).toBeNull();
  });

  it('requiredExerciseIds rỗng ⇒ vế B coi như ĐẠT (học hết là đủ)', () => {
    const access = resolveFinalTestAccess(
      input({
        requiredLessonIds: ['a/l1'],
        requiredExerciseIds: [],
        lessons: [lesson('a/l1', true)],
      }),
    );

    expect(access.kind).toBe('ready');
    expect(access.exercisesTotal).toBe(0);
    expect(access.enterable).toBe(true);
  });

  it('đã có kết quả thi ⇒ done, LUÔN vào được dù thiếu bài/game', () => {
    const access = resolveFinalTestAccess(
      input({
        requiredLessonIds: ['a/l1', 'a/l2'],
        requiredExerciseIds: ['a/l1/g1'],
        lessons: [],
        playedExerciseIds: new Set(),
        hasResult: true,
      }),
    );

    expect(access.kind).toBe('done');
    expect(access.enterable).toBe(true);
    expect(access.requirement).toBeNull();
  });

  it('hasResult = false KHÔNG phải "done" (vẫn xét điều kiện bình thường)', () => {
    const access = resolveFinalTestAccess(
      input({ requiredLessonIds: ['a/l1'], hasResult: false }),
    );

    expect(access.kind).toBe('locked');
  });

  it('chưa hydrate ⇒ pending, KHÔNG lộ "còn thiếu" dù dữ liệu chơi trống', () => {
    // Mô phỏng bé offline: `lessons`/`playedExerciseIds` có thể trống dù bé đã làm xong.
    const access = resolveFinalTestAccess(
      input({
        requiredLessonIds: ['a/l1', 'a/l2'],
        requiredExerciseIds: ['a/l1/g1'],
        lessons: [],
        playedExerciseIds: new Set(),
        hydrated: false,
      }),
    );

    expect(access.kind).toBe('pending');
    expect(access.enterable).toBe(false);
    // ĐIỂM MẤU CHỐT: KHÔNG có requirement ⇒ UI không thể nói "còn 2 bài" (tránh mắng oan).
    expect(access.requirement).toBeNull();
  });

  it('đã có kết quả (hasResult) THẮNG cả khi chưa hydrate ⇒ done, không "đang kiểm tra"', () => {
    const access = resolveFinalTestAccess(input({ hydrated: false, hasResult: true }));

    expect(access.kind).toBe('done');
    expect(access.enterable).toBe(true);
  });

  it('số liệu đếm vẫn đúng ở trạng thái pending (UI vẫn có thể hiện thanh tiến độ)', () => {
    const access = resolveFinalTestAccess(
      input({
        requiredLessonIds: ['a/l1', 'a/l2'],
        requiredExerciseIds: ['a/l1/g1', 'a/l1/g2'],
        lessons: [lesson('a/l1', true)],
        playedExerciseIds: new Set(['a/l1/g1']),
        hydrated: false,
      }),
    );

    expect(access.lessonsCompleted).toBe(1);
    expect(access.lessonsTotal).toBe(2);
    expect(access.exercisesPlayed).toBe(1);
    expect(access.exercisesTotal).toBe(2);
  });
});

// =============================================================================
// Tính thuần
// =============================================================================

describe('resolveFinalTestAccess — hàm thuần', () => {
  it('KHÔNG sửa đầu vào', () => {
    const inputObj = input({
      requiredLessonIds: ['a/l1'],
      requiredExerciseIds: ['a/l1/g1'],
      lessons: [lesson('a/l1', true)],
      playedExerciseIds: new Set(['a/l1/g1']),
    });
    const before = JSON.stringify({
      lessons: inputObj.lessons,
      requiredLessonIds: inputObj.requiredLessonIds,
      requiredExerciseIds: inputObj.requiredExerciseIds,
    });

    resolveFinalTestAccess(inputObj);

    expect(
      JSON.stringify({
        lessons: inputObj.lessons,
        requiredLessonIds: inputObj.requiredLessonIds,
        requiredExerciseIds: inputObj.requiredExerciseIds,
      }),
    ).toBe(before);
  });

  it('cùng đầu vào ⇒ cùng kết quả (tất định, không đọc giờ/mạng)', () => {
    const args = input({ requiredLessonIds: ['a/l1'] });

    expect(resolveFinalTestAccess(args)).toEqual(resolveFinalTestAccess(args));
  });
});
