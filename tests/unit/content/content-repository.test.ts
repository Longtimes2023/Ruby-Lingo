/**
 * Test ContentRepository (task T016) — `src/services/ContentRepository.ts`.
 *
 * Trọng tâm là `pickDistractors`: hàm này quyết định BÀN CHƠI của mọi game dạng hình.
 * Nếu nó trả về hai ô cùng emoji, hoặc một ô trùng emoji với đáp án, thì bé chạm ĐÚNG
 * mà app báo SAI — bé mất niềm tin vào app và không chơi nữa. Đó là lỗi thật đã xảy ra
 * khi soạn nội dung (5 cặp trùng emoji trong cùng một chủ đề).
 *
 * Vì vậy test dưới đây KHÔNG kiểm vài ví dụ mẫu. Nó QUÉT TOÀN BỘ 275 từ × 4 chế độ
 * (1100 lượt) và khẳng định các bất biến đúng cho MỌI lượt. Một ví dụ mẫu có thể may mắn
 * rơi vào từ "sạch"; quét toàn bộ thì không.
 */

import { describe, expect, it } from 'vitest';

import {
  ContentRepository,
  contentRepository,
  isExercisePlayable,
  type DistractorMode,
  type GameRuntime,
} from '@/services/ContentRepository.js';
import type { Exercise, GameType } from '@shared/types/content.js';

const withSpeech: GameRuntime = { hasSpeechRecognition: true };
const noSpeech: GameRuntime = { hasSpeechRecognition: false };

const ALL_MODES: DistractorMode[] = ['same_theme', 'cross_theme', 'similar_sound', 'same_lesson'];

describe('loadLevel — cache', () => {
  it('gọi hai lần cùng id ⇒ trả CÙNG một object (không đọc lại, không lập chỉ mục lại)', () => {
    const repo = new ContentRepository();
    expect(repo.loadLevel('starters')).toBe(repo.loadLevel('starters'));
  });

  it('loadedLevelIds phản ánh các level đã nạp', () => {
    const repo = new ContentRepository();
    expect(repo.loadedLevelIds()).toEqual([]);
    repo.loadLevel('starters');
    expect(repo.loadedLevelIds()).toEqual(['starters']);
  });

  it('mặc định nạp DEFAULT_LEVEL_ID khi không truyền gì', () => {
    const repo = new ContentRepository();
    expect(repo.loadLevel().level.id).toBe('starters');
  });
});

describe('tra cứu trả null cho id không tồn tại (không ném lỗi)', () => {
  it('getTheme / getLesson / getWord / getExercise', () => {
    expect(contentRepository.getTheme('khong-co')).toBeNull();
    expect(contentRepository.getLesson('khong-co')).toBeNull();
    expect(contentRepository.getWord('khong-co')).toBeNull();
    expect(contentRepository.getExercise('khong-co')).toBeNull();
  });

  it('getThemeBundle của chủ đề lạ ⇒ null', () => {
    expect(contentRepository.getThemeBundle('khong-co')).toBeNull();
  });
});

describe('isExercisePlayable — ẩn game cần micro trên Safari/iOS (PRD US-16)', () => {
  const make = (gameType: GameType): Exercise =>
    ({ id: 'x/y', lessonId: 'x/l', gameType, wordIds: ['x.a'], difficulty: 1, config: {} }) as unknown as Exercise;

  it('`say_it` CHƠI ĐƯỢC khi trình duyệt có nhận diện giọng nói', () => {
    expect(isExercisePlayable(make('say_it'), withSpeech)).toBe(true);
  });

  it('`say_it` BỊ ẨN khi không có nhận diện giọng nói — ẩn, không báo lỗi', () => {
    expect(isExercisePlayable(make('say_it'), noSpeech)).toBe(false);
  });

  it('các game khác không bị ảnh hưởng bởi khả năng micro', () => {
    for (const g of ['listen_tap', 'memory_match', 'word_picture', 'missing_letter'] as GameType[]) {
      expect(isExercisePlayable(make(g), noSpeech), `${g} không được phụ thuộc micro`).toBe(true);
    }
  });
});

describe('getExercisesForLesson', () => {
  const lessonId = 'at-the-zoo/z1';

  it('bài không tồn tại ⇒ mảng rỗng', () => {
    expect(contentRepository.getExercisesForLesson('khong-co', withSpeech)).toEqual([]);
  });

  it('bài có thật ⇒ trả bài tập, mọi bài đều thuộc đúng bài đó', () => {
    const list = contentRepository.getExercisesForLesson(lessonId, withSpeech);
    expect(list.length).toBeGreaterThan(0);
    for (const e of list) expect(e.lessonId).toBe(lessonId);
  });

  it('hiện tại nội dung chưa có `say_it` nên hai runtime cho cùng kết quả', () => {
    // Nếu test này đổ, nghĩa là nội dung ĐÃ có bài `say_it` — hãy thay bằng khẳng định
    // rằng bài `say_it` bị lọc khi không có micro.
    const a = contentRepository.getExercisesForLesson(lessonId, withSpeech);
    const b = contentRepository.getExercisesForLesson(lessonId, noSpeech);
    expect(b).toEqual(a);
  });

  it('getExercisesForTheme gom đủ bài tập của mọi bài trong chủ đề', () => {
    const theme = contentRepository.getTheme('at-the-zoo');
    expect(theme).not.toBeNull();
    if (!theme) return;
    const list = contentRepository.getExercisesForTheme('at-the-zoo', withSpeech);
    const fromLessons = theme.lessonIds.flatMap((id) =>
      contentRepository.getExercisesForLesson(id, withSpeech),
    );
    expect(list.map((e) => e.id)).toEqual(fromLessons.map((e) => e.id));
  });
});

describe('getWordsForLesson', () => {
  it('trả từ ĐÚNG thứ tự trong lesson.wordIds', () => {
    const lesson = contentRepository.getLesson('at-the-zoo/z1');
    expect(lesson).not.toBeNull();
    if (!lesson) return;
    const words = contentRepository.getWordsForLesson(lesson.id);
    expect(words.map((w) => w.id)).toEqual(lesson.wordIds);
  });

  it('bài không tồn tại ⇒ mảng rỗng', () => {
    expect(contentRepository.getWordsForLesson('khong-co')).toEqual([]);
  });
});

describe('getThemesForMap', () => {
  const items = contentRepository.getThemesForMap('starters');

  it('trả đủ 11 chủ đề', () => {
    expect(items).toHaveLength(11);
  });

  it('`index` đếm từ 1 và tăng liên tục (dùng để vẽ số thứ tự trên bản đồ)', () => {
    expect(items.map((i) => i.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('chủ đề đầu là at-the-zoo — nơi bé bắt đầu hành trình', () => {
    expect(items[0]?.theme.id).toBe('at-the-zoo');
  });

  it('số bài / số bài tập khớp với dữ liệu gốc', () => {
    for (const item of items) {
      expect(item.lessonCount).toBe(item.theme.lessonIds.length);
      expect(item.exerciseCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('sceneUrl là null khi chủ đề chưa có tranh (sceneImage rỗng)', () => {
    for (const item of items) {
      if (item.theme.sceneImage === '') {
        expect(item.sceneUrl).toBeNull();
      } else {
        expect(item.sceneUrl).toBe(`/assets/scenes/${item.theme.sceneImage}.webp`);
      }
    }
  });
});

describe('tranh cảnh toàn cục', () => {
  it('tra được homeSceneImage', () => {
    const scene = contentRepository.getGlobalScene('homeSceneImage');
    expect(scene).not.toBeNull();
    expect(scene?.usedInScreen).toBe('M6');
  });

  it('khoá lạ ⇒ null', () => {
    expect(contentRepository.getGlobalScene('khongCo')).toBeNull();
  });

  it('allGlobalScenes trả về danh sách không rỗng', () => {
    expect(contentRepository.allGlobalScenes().length).toBeGreaterThan(0);
  });
});

describe('pickDistractors — bất biến quét TOÀN BỘ 275 từ × 4 chế độ', () => {
  const bundle = contentRepository.loadLevel('starters');

  it('quét toàn bộ: không lượt nào vi phạm điều kiện (1)/(2)/(3)', () => {
    const violations: string[] = [];
    let calls = 0;

    for (const target of bundle.words) {
      for (const mode of ALL_MODES) {
        calls++;
        const picked = contentRepository.pickDistractors(target.id, 3, mode);
        const label = `${target.id} (${target.en}, ${target.icon}) mode=${mode}`;

        if (picked.length > 3) violations.push(`${label}: trả ${picked.length} > 3`);

        const icons = new Set<string>([target.icon]);
        for (const d of picked) {
          // (1) khác emoji với từ đích
          if (d.icon === target.icon) {
            violations.push(`${label}: nhiễu "${d.id}" TRÙNG emoji ${d.icon} với đáp án`);
          }
          // (2) emoji các nhiễu phải khác nhau
          if (icons.has(d.icon)) {
            violations.push(`${label}: nhiễu "${d.id}" trùng emoji ${d.icon} với nhiễu khác`);
          }
          icons.add(d.icon);
          // (3) phải có hình để chạm
          if (!d.picturable) {
            violations.push(`${label}: nhiễu "${d.id}" KHÔNG picturable`);
          }
          // cùng chữ nhưng khác nghĩa ⇒ hai ô giống hệt nhau về chữ
          if (d.en.toLowerCase() === target.en.toLowerCase()) {
            violations.push(`${label}: nhiễu "${d.id}" trùng chữ "${d.en}" với đáp án`);
          }
          if (d.id === target.id) violations.push(`${label}: nhiễu trùng chính đáp án`);
        }
      }
    }

    expect(violations).toEqual([]);
    // Chốt số lượt quét để test không bị "rỗng ruột" nếu nội dung biến mất.
    expect(calls).toBe(bundle.words.length * ALL_MODES.length);
    // 275 từ × 4 chế độ = 1100 (≥ 1100 vì nội dung chỉ được THÊM, không bớt).
    expect(calls).toBeGreaterThanOrEqual(1100);
  });

  it('same_theme: mọi nhiễu đều nằm trong chủ đề gốc của từ đích', () => {
    const violations: string[] = [];
    for (const target of bundle.words) {
      const inTheme = new Set(bundle.wordIdsByTheme.get(target.primaryThemeId) ?? []);
      for (const d of contentRepository.pickDistractors(target.id, 3, 'same_theme')) {
        if (!inTheme.has(d.id)) violations.push(`${target.id}: "${d.id}" không thuộc ${target.primaryThemeId}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('cross_theme: mọi nhiễu đều KHÁC chủ đề gốc của từ đích', () => {
    const violations: string[] = [];
    for (const target of bundle.words) {
      const inTheme = new Set(bundle.wordIdsByTheme.get(target.primaryThemeId) ?? []);
      for (const d of contentRepository.pickDistractors(target.id, 3, 'cross_theme')) {
        if (inTheme.has(d.id)) violations.push(`${target.id}: "${d.id}" lại thuộc chính ${target.primaryThemeId}`);
      }
    }
    expect(violations).toEqual([]);
  });

  /**
   * ⭐ T02 — nhiễu phải đến từ CÙNG BÀI HỌC. Đây là bất biến mà chủ dự án yêu cầu: bé học từng
   *    bài một, nên nhiễu lấy từ bài khác (bé chưa học) là quá khó và sai ngữ cảnh.
   */
  it('same_lesson: mọi nhiễu đều thuộc ĐÚNG bài học của từ đích', () => {
    const violations: string[] = [];
    for (const target of bundle.words) {
      for (const d of contentRepository.pickDistractors(target.id, 3, 'same_lesson')) {
        if (d.primaryLessonId !== target.primaryLessonId) {
          violations.push(
            `${target.id} (${target.primaryLessonId}): nhiễu "${d.id}" thuộc ${d.primaryLessonId}`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('ổn định theo seed: cùng seed ⇒ cùng kết quả (bàn chơi không nhảy khi re-render)', () => {
    for (const target of bundle.words.slice(0, 40)) {
      const a = contentRepository.pickDistractors(target.id, 3, 'same_theme', 'seed-co-dinh');
      const b = contentRepository.pickDistractors(target.id, 3, 'same_theme', 'seed-co-dinh');
      expect(b.map((w) => w.id)).toEqual(a.map((w) => w.id));
    }
  });

  it('seed khác nhau có thể cho kết quả khác (không bị đóng băng một bộ)', () => {
    // Không khẳng định CHẮC CHẮN khác (có thể trùng do ngẫu nhiên), chỉ khẳng định
    // rằng trên nhiều từ thì tồn tại ít nhất một từ cho kết quả khác.
    const differs = bundle.words.some((t) => {
      const a = contentRepository.pickDistractors(t.id, 3, 'same_theme', 1);
      const b = contentRepository.pickDistractors(t.id, 3, 'same_theme', 999);
      return a.map((w) => w.id).join() !== b.map((w) => w.id).join();
    });
    expect(differs).toBe(true);
  });

  it('trả ÍT HƠN count khi thiếu từ, KHÔNG ném lỗi và KHÔNG nới điều kiện', () => {
    const target = bundle.words[0];
    expect(target).toBeDefined();
    if (!target) return;
    // Đòi 500 nhiễu — không thể có đủ, nhưng phải trả về mảng hợp lệ đã khử trùng emoji.
    const picked = contentRepository.pickDistractors(target.id, 500, 'same_theme');
    expect(Array.isArray(picked)).toBe(true);
    expect(picked.length).toBeLessThanOrEqual(bundle.words.length - 1);
    expect(new Set(picked.map((w) => w.icon)).size).toBe(picked.length);
  });

  it('count <= 0 ⇒ mảng rỗng', () => {
    expect(contentRepository.pickDistractors(bundle.words[0]!.id, 0, 'same_theme')).toEqual([]);
    expect(contentRepository.pickDistractors(bundle.words[0]!.id, -3, 'same_theme')).toEqual([]);
  });

  it('từ không tồn tại ⇒ mảng rỗng', () => {
    expect(contentRepository.pickDistractors('khong-co', 3, 'same_theme')).toEqual([]);
  });
});

describe('bàn chơi của game dạng hình phải ĐỦ ô', () => {
  // Kiểm tra chất lượng nội dung: mỗi bài `listen_tap` cần (optionCount - 1) nhiễu cùng
  // chủ đề. Nếu không đủ, game vẫn chạy nhưng bàn chơi bị ít ô hơn thiết kế — điều mà
  // không lỗi nào báo ra. Đây là chỗ duy nhất phát hiện được.
  it('mọi bài listen_tap lấy đủ (optionCount - 1) nhiễu theo distractorMode của nó', () => {
    const bundle = contentRepository.loadLevel('starters');
    const shortfalls: string[] = [];

    for (const exercise of bundle.exercises) {
      if (exercise.gameType !== 'listen_tap') continue;
      const cfg = exercise.config;
      if (cfg.kind !== 'listen_tap') continue;

      const needed = cfg.optionCount - 1;
      for (const wordId of exercise.wordIds) {
        const picked = contentRepository.pickDistractors(wordId, needed, cfg.distractorMode);
        if (picked.length < needed) {
          shortfalls.push(
            `${exercise.id} / từ "${wordId}": cần ${needed} nhiễu (${cfg.distractorMode}) nhưng chỉ có ${picked.length}`,
          );
        }
      }
    }

    expect(shortfalls).toEqual([]);
  });

  /**
   * ⭐ T02 — bằng chứng trực tiếp cho ca chủ dự án báo: bài "Động vật hoang dã to lớn"
   *    (`at-the-zoo/z1`) không được có nhiễu là xe máy / mặt trăng / cái bàn (từ chủ đề khác)
   *    hay ❌. Mọi nhiễu phải là con vật CÙNG BÀI.
   */
  it('at-the-zoo/z1/listen-tap: mọi nhiễu cùng bài, không lấy từ chủ đề khác', () => {
    const exercise = contentRepository.getExercise('at-the-zoo/z1/listen-tap');
    expect(exercise).not.toBeNull();
    if (!exercise) return;
    const cfg = exercise.config;
    expect(cfg.kind).toBe('listen_tap');
    if (cfg.kind !== 'listen_tap') return;

    expect(cfg.distractorMode).toBe('same_lesson');

    for (const wordId of exercise.wordIds) {
      const picked = contentRepository.pickDistractors(wordId, cfg.optionCount - 1, cfg.distractorMode);
      expect(picked.length, `từ "${wordId}" phải đủ ${cfg.optionCount - 1} nhiễu`).toBe(
        cfg.optionCount - 1,
      );
      for (const d of picked) {
        expect(d.primaryLessonId, `nhiễu "${d.id}" của "${wordId}" phải cùng bài`).toBe('at-the-zoo/z1');
        expect(d.picturable).toBe(true);
      }
    }
  });
});
