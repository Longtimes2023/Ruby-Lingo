/**
 * RubyLingo — CANH GIỮ: MỌI BÀI đều có game để chơi, và game `missing_letter` CHƠI ĐƯỢC
 * với mọi từ trong bài (kể cả từ một chữ cái như "A" của chủ đề `alphabet`).
 *
 * ⭐ VÌ SAO TEST NÀY TỒN TẠI:
 *
 *   1. Yêu cầu của chủ dự án: "mỗi chủ đề đều có game để chơi". Trước G1, **40/43 bài** chỉ có
 *      đúng MỘT loại game (`memory_match`) — bé chỉ luyện được kỹ năng ghi nhớ. Một test đếm số
 *      loại game theo từng bài là cách duy nhất khiến "thiếu game" không quay lại trong im lặng.
 *
 *   2. `missing_letter` ẩn chữ cái trong từ. Với từ **một chữ cái** (`alphabet`: A, B, C…), luật
 *      "không bao giờ ẩn hết cả từ" (`hiddenIndices`, `src/components/games/missing-letter/logic.ts:39-52`)
 *      KHÔNG THỂ giữ được — chỉ có 1 chữ để ẩn. Test dưới đây chứng minh ca đó vẫn CHƠI ĐƯỢC:
 *      luôn có ô trống, và chữ đúng luôn nằm trong bàn phím ảo. Nếu ai đó đổi luật ẩn chữ, test
 *      này nổ trước khi bé gặp một màn hình không thể bấm xong.
 *
 * ⚠️ NGƯỠNG TRONG FILE NÀY ĐÃ ĐƯỢC NÂNG QUA CÁC GIAI ĐOẠN:
 *   - G1 (đã xong): mọi bài ≥ 2 loại game (thêm `missing_letter`).
 *   - G2 (đã xong): thêm `listen_tap` + `word_picture` cho bài có ≥ 4 từ `picturable`;
 *     nâng `THEME_FLOOR` lên đúng ma trận mục tiêu trong `docs/ke-hoach/game-phu-moi-chu-de.md`.
 *   - G3 (đã xong): thêm `prepositions` cho 24 bài hợp ngữ nghĩa; 8 chủ đề có tranh đạt 5/5 loại game.
 *   Khi thêm game mới, hãy nâng `THEME_FLOOR` và mở rộng test tương ứng — đừng xoá test này.
 */

import { describe, expect, it } from 'vitest';

import { readLevelBundle } from '@/data/index.js';
import {
  correctLetters,
  hiddenIndices,
  letterOptions,
} from '@/components/games/missing-letter/logic.js';
import { MVP_GAME_TYPES } from '@shared/types/content.js';
import type { GameType } from '@shared/types/content.js';

const bundle = readLevelBundle('starters');

/** Chủ đề KHÔNG THỂ có game dạng hình (0 từ `picturable`) ⇒ trần thấp hơn — xem ghi chú ở test. */
const NO_PICTURE_THEMES = new Set(['alphabet', 'numbers-1-20']);

/**
 * ⭐ NGƯỠNG SỐ LOẠI GAME KHÁC NHAU CỦA MỖI CHỦ ĐỀ — ma trận G3 (đọc từ chính dữ liệu).
 *
 * BẢNG KỲ VỌNG cụ thể, KHÔNG phải "≥ 2 cho mọi chủ đề" như thời G1:
 *   - 8 chủ đề có tranh đạt 5/5 loại game (`at-the-zoo` + `at-home`, `at-school`, `at-the-beach`,
 *     `at-the-clothes-shop`, `my-favourite-food`, `my-friends-birthday`, `my-street`).
 *   - `my-body` đạt 4 — bộ phận cơ thể không thể "núp dưới hộp" nên KHÔNG có `prepositions`.
 *   - `alphabet` / `numbers-1-20` (0 từ picturable, không có danh từ) đạt 2 — trần tự nhiên.
 *
 * Dùng `>=` (ngưỡng) chứ không phải `===`: game mới sẽ nâng số này lên, nhưng KHÔNG chủ đề nào
 * được phép TỤT xuống dưới ngưỡng đã cam kết — đó là điều test canh.
 */
const THEME_FLOOR: Record<string, number> = {
  'at-the-zoo': 5,
  'at-home': 5,
  'at-school': 5,
  'at-the-beach': 5,
  'at-the-clothes-shop': 5,
  'my-favourite-food': 5,
  'my-friends-birthday': 5,
  'my-street': 5,
  'my-body': 4,
  alphabet: 2,
  'numbers-1-20': 2,
};

/**
 * Bài được miễn ngưỡng 4 loại game:
 *   - `my-friends-birthday/l3` chỉ có 3 từ `picturable` ⇒ chưa đủ điều kiện thêm game dạng hình.
 *   - mọi bài của `alphabet` / `numbers-1-20` (0 từ picturable) — lọc theo chủ đề ở dưới.
 */
const LESSON_FLOOR_EXEMPT = new Set(['my-friends-birthday/l3']);

describe('Phủ game theo bài (G3)', () => {
  it('mọi bài có ÍT NHẤT 2 loại game khác nhau', () => {
    const offenders: string[] = [];

    for (const lesson of bundle.lessons) {
      const types = new Set<GameType>(
        bundle.exercises.filter((e) => e.lessonId === lesson.id).map((e) => e.gameType),
      );
      if (types.size < 2) {
        offenders.push(`${lesson.id} → ${types.size} loại (${[...types].join(', ') || 'không có'})`);
      }
    }

    expect(offenders, `bài chỉ có 1 loại game:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('mọi chủ đề đạt ĐÚNG ngưỡng số loại game của ma trận G2', () => {
    expect(bundle.themes.length).toBe(11);

    // Mọi chủ đề có thật phải có mặt trong bảng — chủ đề MỚI thêm mà quên khai ngưỡng
    // sẽ bị bắt ở đây thay vì lặng lẽ lọt qua.
    const known = new Set(Object.keys(THEME_FLOOR));
    for (const theme of bundle.themes) {
      expect(
        known.has(theme.id),
        `chủ đề "${theme.id}" chưa có trong THEME_FLOOR — cập nhật bảng ngưỡng của ma trận G2`,
      ).toBe(true);
    }
    for (const id of known) {
      expect(
        bundle.themes.some((t) => t.id === id),
        `THEME_FLOOR có "${id}" nhưng dữ liệu không có chủ đề này`,
      ).toBe(true);
    }

    for (const theme of bundle.themes) {
      const floor = THEME_FLOOR[theme.id] ?? 0;
      const lessonIds = new Set(theme.lessonIds);
      const types = new Set<GameType>(
        bundle.exercises.filter((e) => lessonIds.has(e.lessonId)).map((e) => e.gameType),
      );
      expect(
        types.size,
        `chủ đề ${theme.id}: ${types.size} loại game (${[...types].join(', ') || 'không có'}) dưới ngưỡng ${floor}`,
      ).toBeGreaterThanOrEqual(floor);
    }
  });

  it('mọi bài có ÍT NHẤT 4 loại game (trừ alphabet, numbers-1-20, my-friends-birthday/l3)', () => {
    const offenders: string[] = [];

    for (const lesson of bundle.lessons) {
      if (NO_PICTURE_THEMES.has(lesson.themeId)) continue;
      if (LESSON_FLOOR_EXEMPT.has(lesson.id)) continue;

      const types = new Set<GameType>(
        bundle.exercises.filter((e) => e.lessonId === lesson.id).map((e) => e.gameType),
      );
      if (types.size < 4) {
        offenders.push(`${lesson.id} → ${types.size} loại (${[...types].join(', ') || 'không có'})`);
      }
    }

    expect(
      offenders,
      `bài có dưới 4 loại game dù đủ điều kiện:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('word_picture của MỌI bài chỉ dùng từ picturable=true (chốt "game hình mà không có hình")', () => {
    const wordPictureExercises = bundle.exercises.filter((e) => e.gameType === 'word_picture');
    expect(
      wordPictureExercises.length,
      'không có exercise word_picture nào — game Nối từ với hình biến mất khỏi nội dung',
    ).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const exercise of wordPictureExercises) {
      const nonPicturable = exercise.wordIds.filter(
        (wordId) => bundle.wordById.get(wordId)?.picturable !== true,
      );
      if (nonPicturable.length > 0) {
        offenders.push(`${exercise.id}: từ KHÔNG vẽ được hình → ${nonPicturable.join(', ')}`);
      }
    }

    expect(offenders, `word_picture dùng từ không có hình:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('mọi exercise prepositions: câu đúng mẫu, chủ ngữ có thật trong wordIds, correctSlot nằm trong slots', () => {
    const prepositionsExercises = bundle.exercises.filter((e) => e.gameType === 'prepositions');
    expect(
      prepositionsExercises.length,
      'không có exercise prepositions nào — game Thú cưng trốn ở đâu? biến mất khỏi nội dung',
    ).toBeGreaterThan(0);

    // ⚠️ Mẫu câu CỐ ĐỊNH: "The {noun} is {prep} the box." — riêng "between" dùng "the boxes.".
    //    (Bản gốc đề xuất `the boxes?\.` là SAI: `boxes?` = "boxe" + "s?" nên KHÔNG khớp "box.";
    //     sửa thành `box(?:es)?` để khớp cả "box." lẫn "boxes.".)
    const sentencePattern = /^The .+ is (in|on|under|behind|next to|between) the box(?:es)?\.$/;
    const problems: string[] = [];

    for (const exercise of prepositionsExercises) {
      if (exercise.config.kind !== 'prepositions') continue;

      // Chủ ngữ trong câu PHẢI là `en` của một từ trong CHÍNH exercise — nếu không, cảnh sẽ
      // hiện icon 🐾 chung chung (subjectIcon không tra được) và bé không biết chạm vào đâu.
      const subjectEns = new Set(
        exercise.wordIds
          .map((id) => bundle.wordById.get(id)?.en)
          .filter((en): en is string => typeof en === 'string'),
      );

      for (const slot of exercise.config.slots) {
        if (!sentencePattern.test(slot.sentenceEn)) {
          problems.push(
            `${exercise.id}: câu "${slot.sentenceEn}" không khớp mẫu "The {noun} is {prep} the box."`,
          );
        }
        const subject = slot.sentenceEn.slice('The '.length, slot.sentenceEn.indexOf(' is '));
        if (!subjectEns.has(subject)) {
          problems.push(
            `${exercise.id}: chủ ngữ "${subject}" không phải "en" của từ nào trong wordIds [${exercise.wordIds.join(', ')}]`,
          );
        }
        if (!slot.slots.includes(slot.correctSlot)) {
          problems.push(
            `${exercise.id}: correctSlot "${slot.correctSlot}" không nằm trong slots [${slot.slots.join(', ')}]`,
          );
        }
      }
    }

    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('mọi exercise dùng game ĐÃ CÓ component chơi được (không khai game "trên giấy")', () => {
    for (const exercise of bundle.exercises) {
      expect(
        MVP_GAME_TYPES,
        `${exercise.id} dùng game "${exercise.gameType}" chưa có component đăng ký`,
      ).toContain(exercise.gameType);
    }
  });

  it('chủ đề alphabet và numbers-1-20 KHÔNG có từ picturable nào (lý do trần 2 loại game)', () => {
    for (const themeId of NO_PICTURE_THEMES) {
      const wordIds = new Set(bundle.wordIdsByTheme.get(themeId) ?? []);
      const picturable = bundle.words.filter((w) => wordIds.has(w.id) && w.picturable);
      expect(picturable, `${themeId} bỗng có từ vẽ được hình — cập nhật lại kế hoạch`).toEqual([]);
    }
  });
});

describe('missing_letter — chơi được với MỌI từ của mọi bài', () => {
  const missingLetterExercises = bundle.exercises.filter((e) => e.gameType === 'missing_letter');

  it('có đúng một exercise missing_letter cho mỗi bài (43 bài)', () => {
    expect(missingLetterExercises.length).toBe(bundle.lessons.length);
  });

  it('mỗi exercise: mọi từ đều có ô trống và chữ đúng luôn nằm trong bàn phím ảo', () => {
    const problems: string[] = [];

    for (const exercise of missingLetterExercises) {
      if (exercise.config.kind !== 'missing_letter') continue;
      const { hideCount, hidePosition } = exercise.config;

      // Nhiễu lấy từ CHÍNH bài học đó — đúng cách component truyền `siblings`.
      const siblings = exercise.wordIds
        .map((id) => bundle.wordById.get(id)?.en)
        .filter((en): en is string => typeof en === 'string');

      for (const wordId of exercise.wordIds) {
        const word = bundle.wordById.get(wordId);
        if (!word) {
          problems.push(`${exercise.id}: từ lạ ${wordId}`);
          continue;
        }

        const hidden = hiddenIndices(word.en, hideCount, hidePosition, `${exercise.id}:${wordId}`);
        if (hidden.length === 0) {
          problems.push(`${exercise.id} / "${word.en}": KHÔNG có ô trống nào ⇒ bé bấm mãi không xong`);
          continue;
        }

        const options = letterOptions(word.en, hidden, siblings, `${exercise.id}:${wordId}`);
        for (const letter of correctLetters(word.en, hidden)) {
          if (!options.includes(letter)) {
            problems.push(
              `${exercise.id} / "${word.en}": chữ đúng "${letter}" KHÔNG có trên bàn phím ⇒ không thể thắng`,
            );
          }
        }
      }
    }

    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('từ MỘT chữ cái (chủ đề alphabet) vẫn có bàn phím nhiều lựa chọn và có chữ đúng', () => {
    const letters = bundle.words.filter((w) => w.primaryThemeId === 'alphabet');
    expect(letters.length).toBe(26);

    const alphabetLessons = new Set(
      bundle.themes.find((t) => t.id === 'alphabet')?.lessonIds ?? [],
    );
    const alphabetExercises = missingLetterExercises.filter((e) =>
      alphabetLessons.has(e.lessonId),
    );
    expect(alphabetExercises.length).toBe(alphabetLessons.size);

    for (const exercise of alphabetExercises) {
      // ⭐ `siblings` PHẢI đúng như component truyền: các từ KHÁC trong chính bài tập đó
      //    (`MissingLetterGame.tsx`: `words.filter(w => w.id !== target.id).map(w => w.en)`).
      //    Dùng cả 26 chữ cái làm nhiễu là SAI — khi đó mọi chữ đều bị chặn và bàn phím teo còn
      //    1 ô, test sẽ báo lỗi giả.
      const pairs = exercise.wordIds
        .map((id) => bundle.wordById.get(id))
        .filter((w): w is NonNullable<typeof w> => w !== undefined);

      for (const word of pairs) {
        const siblings = pairs.filter((w) => w.id !== word.id).map((w) => w.en);
        const hidden = hiddenIndices(word.en, 1, 'any', `${exercise.id}:${word.id}`);

        // Từ 1 chữ cái: buộc phải ẩn chính chữ đó — đây là "nghe và chạm chữ cái", vẫn chơi được.
        expect(hidden.length, `${word.en} không có ô trống`).toBe(1);

        const options = letterOptions(word.en, hidden, siblings, `${exercise.id}:${word.id}`);
        expect(options, `${word.en}: bàn phím thiếu chữ đúng`).toContain(word.en.toLowerCase());
        expect(
          options.length,
          `${word.en} (${exercise.id}): bàn phím chỉ có ${options.length} lựa chọn ⇒ game vô nghĩa`,
        ).toBeGreaterThan(1);
      }
    }
  });
});
