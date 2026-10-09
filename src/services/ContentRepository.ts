/**
 * RubyLingo — ContentRepository.
 *
 * ⭐ NGUỒN SỰ THẬT DUY NHẤT về nội dung học. Component KHÔNG bao giờ đọc JSON trực tiếp.
 * Nhờ vậy: (1) chỉ nạp và lập chỉ mục một lần, (2) đổi cách lưu nội dung chỉ phải sửa
 * một chỗ, (3) test được mà không cần render React.
 *
 * ⚙️ Thuần TypeScript — KHÔNG import React, KHÔNG chạm `speechSynthesis`/`fetch`.
 */

import {
  DEFAULT_LEVEL_ID,
  listLevelIds,
  readLevelBundle,
  sceneAssetUrlOrNull,
  sliceTheme,
} from '../data/index.js';
import { GLOBAL_SCENES, getGlobalScene as getGlobalSceneFromRegistry } from '../data/global-scenes.js';
import { hashString, shuffleSeeded } from '../lib/random.js';
import type {
  Exercise,
  GameType,
  GlobalSceneAsset,
  Lesson,
  LevelBundle,
  Theme,
  ThemeBundle,
  ThemeMapItem,
  Word,
} from '@shared/types/content.js';

/** Cách chọn từ gây nhiễu. Khớp `config.distractorMode` trong JSON bài tập. */
export type DistractorMode = 'same_theme' | 'cross_theme' | 'similar_sound';

/**
 * Khả năng THẬT của trình duyệt đang chạy, ảnh hưởng tới việc CHỌN bài tập.
 *
 * Truyền vào từ ngoài (không tự dò trong repository) để repository vẫn là hàm thuần —
 * test được trên Node mà không cần giả lập trình duyệt.
 */
export interface GameRuntime {
  /** Safari/iOS KHÔNG có SpeechRecognition ⇒ phải ẩn game `say_it`. */
  hasSpeechRecognition: boolean;
}

/** Game cần micro — xem `SPEECH_INPUT_GAME_TYPES`. */
const SPEECH_GAMES: readonly GameType[] = ['say_it'];

/**
 * Bài tập này có CHƠI ĐƯỢC trên trình duyệt đang chạy không?
 *
 * Tách ra thành hàm thuần, export được, để test trực tiếp mà không phải dựng nội dung
 * thật có game `say_it`. Hiện nội dung MVP chưa có bài `say_it` nào, nên nếu để logic
 * này nằm trong thân `getExercisesForLesson` thì nhánh `continue` **không bao giờ được
 * chạy trong test** — tức là bộ lọc PRD US-16 sẽ mãi mãi là code chưa từng được kiểm.
 */
export function isExercisePlayable(exercise: Exercise, runtime: GameRuntime): boolean {
  if (SPEECH_GAMES.includes(exercise.gameType) && !runtime.hasSpeechRecognition) return false;
  return true;
}

export class ContentRepository {
  private readonly bundles = new Map<string, LevelBundle>();

  // --- Nạp & cache ----------------------------------------------------------

  /** Nạp level (có cache). Gọi lại cùng id không đọc lại đĩa. */
  loadLevel(levelId: string = DEFAULT_LEVEL_ID): LevelBundle {
    const cached = this.bundles.get(levelId);
    if (cached) return cached;

    const bundle = readLevelBundle(levelId);
    this.bundles.set(levelId, bundle);
    return bundle;
  }

  /** Các level đã nạp (không tự nạp thêm). */
  loadedLevelIds(): string[] {
    return [...this.bundles.keys()];
  }

  // --- Tra cứu --------------------------------------------------------------
  //
  // Id của theme/lesson/exercise/word là DUY NHẤT trong toàn hệ thống (word.id có tiền
  // tố level; theme/lesson id có tiền tố theme). Nên tra cứu chỉ cần id, không cần
  // truyền levelId — nhưng vẫn phải biết level nào để nạp.
  //
  // Chiến lược: tìm trong các bundle ĐÃ NẠP trước; nếu không thấy thì mới nạp thêm các
  // level khác (mỗi level chỉ nạp một lần nhờ cache). Đường đi thường gặp — tra một id
  // thuộc level đang chơi — chỉ tốn một lần tra Map.

  getTheme(themeId: string): Theme | null {
    return this.lookup((b) => b.themeById.get(themeId));
  }

  getLesson(lessonId: string): Lesson | null {
    return this.lookup((b) => b.lessonById.get(lessonId));
  }

  getWord(wordId: string): Word | null {
    return this.lookup((b) => b.wordById.get(wordId));
  }

  getExercise(exerciseId: string): Exercise | null {
    return this.lookup((b) => b.exerciseById.get(exerciseId));
  }

  /** Gói nội dung một chủ đề (theme + bài + từ + bài tập của nó). */
  getThemeBundle(themeId: string): ThemeBundle | null {
    const theme = this.getTheme(themeId);
    if (!theme) return null;
    return sliceTheme(this.loadLevel(theme.levelId), themeId);
  }

  /** Từ của một bài, ĐÚNG thứ tự trong `lesson.wordIds`. */
  getWordsForLesson(lessonId: string): Word[] {
    const lesson = this.getLesson(lessonId);
    if (!lesson) return [];
    const bundle = this.bundleForLesson(lesson);
    if (!bundle) return [];
    const out: Word[] = [];
    for (const wordId of lesson.wordIds) {
      const word = bundle.wordById.get(wordId);
      // Từ có thể được định nghĩa ở chủ đề khác (quy ước "cùng nghĩa ⇒ một định nghĩa").
      // `wordById` ở cấp LEVEL nên vẫn tra được.
      if (word) out.push(word);
    }
    return out;
  }

  /**
   * Bài tập của một bài, ĐÃ LỌC theo khả năng trình duyệt.
   *
   * Game `say_it` bị ẨN (không báo lỗi) khi trình duyệt không hỗ trợ nhận diện giọng nói
   * — Safari/iOS. Đây là yêu cầu PRD US-16: bé không được thấy một nút bấm vào là hỏng.
   */
  getExercisesForLesson(lessonId: string, runtime: GameRuntime): Exercise[] {
    const lesson = this.getLesson(lessonId);
    if (!lesson) return [];
    const bundle = this.bundleForLesson(lesson);
    if (!bundle) return [];

    const out: Exercise[] = [];
    for (const exerciseId of lesson.exerciseIds) {
      const exercise = bundle.exerciseById.get(exerciseId);
      if (!exercise) continue;
      if (!isExercisePlayable(exercise, runtime)) continue;
      out.push(exercise);
    }
    return out;
  }

  /** Mọi bài tập có trong một chủ đề (đã lọc theo trình duyệt). */
  getExercisesForTheme(themeId: string, runtime: GameRuntime): Exercise[] {
    const theme = this.getTheme(themeId);
    if (!theme) return [];
    const out: Exercise[] = [];
    for (const lessonId of theme.lessonIds) {
      out.push(...this.getExercisesForLesson(lessonId, runtime));
    }
    return out;
  }

  /** Thẻ chủ đề cho bản đồ hành trình — theo ĐÚNG thứ tự `level.themeIds`. */
  getThemesForMap(levelId: string = DEFAULT_LEVEL_ID): ThemeMapItem[] {
    const bundle = this.loadLevel(levelId);
    return bundle.themes.map((theme, i) => {
      const lessonIds = new Set(theme.lessonIds);
      return {
        theme,
        index: i + 1,
        wordCount: bundle.wordIdsByTheme.get(theme.id)?.length ?? 0,
        lessonCount: theme.lessonIds.length,
        exerciseCount: bundle.exercises.filter((e) => lessonIds.has(e.lessonId)).length,
        sceneUrl: sceneAssetUrlOrNull(theme.sceneImage),
      };
    });
  }

  // --- Tranh cảnh toàn cục --------------------------------------------------

  getGlobalScene(key: string): GlobalSceneAsset | null {
    return getGlobalSceneFromRegistry(key);
  }

  allGlobalScenes(): readonly GlobalSceneAsset[] {
    return GLOBAL_SCENES;
  }

  // --- Chọn từ gây nhiễu ----------------------------------------------------

  /**
   * Chọn `count` từ gây nhiễu cho game dạng hình (Nghe & Chạm, Nối từ với hình...).
   *
   * ⚠️ BA ĐIỀU KIỆN BẮT BUỘC, mỗi điều phòng một lỗi làm game KHÔNG THỂ CHƠI ĐÚNG:
   *
   *  1. **Khác `icon` với từ đích.** Nếu hai ô cùng hiện 🪑 mà chỉ một ô là đáp án đúng
   *     thì bé chạm ô đúng vẫn bị báo sai — bé mất niềm tin vào app. Đây là lỗi thật đã
   *     gặp khi soạn nội dung (5 cặp trùng emoji trong cùng chủ đề).
   *  2. **`icon` của các từ nhiễu cũng phải KHÁC NHAU.** Hai ô nhiễu giống hệt nhau thì
   *     bé chọn ô nào cũng thấy "sai" ở một trong hai.
   *  3. **`picturable === true`.** Từ trừu tượng (breakfast, morning) không có hình để chạm.
   *
   * ⚠️ Ghi chú về `distractorMode: 'cross_theme'`: emoji CÓ THỂ trùng giữa các chủ đề
   * (vd 🎨 vừa là "painting" vừa là "drawing"). Điều kiện (1) và (2) ở trên chính là
   * thứ khiến chế độ này an toàn — không được bỏ để "cho đủ số ô".
   *
   * Trả về ÍT HƠN `count` nếu không đủ từ thoả mãn. Bên gọi PHẢI chấp nhận điều đó
   * (giảm số ô) — TUYỆT ĐỐI không nới điều kiện (1)/(2) cho đủ số.
   */
  pickDistractors(
    wordId: string,
    count: number,
    mode: DistractorMode,
    seed?: number | string,
  ): Word[] {
    const target = this.getWord(wordId);
    if (!target || count <= 0) return [];

    // Chỉ lấy trong CÙNG level: trộn từ Starters với Movers sẽ tạo nhiễu quá dễ hoặc quá khó.
    const bundle = this.loadLevel(target.levelId);
    const themeWordIds = new Set(bundle.wordIdsByTheme.get(target.primaryThemeId) ?? []);

    const pool = bundle.words.filter((w) => {
      if (!w.picturable) return false; // (3)
      if (w.id === target.id) return false;
      // Cùng chữ nhưng khác nghĩa (orange quả cam / orange màu cam) sẽ hiện hai ô
      // giống hệt nhau về chữ ⇒ cũng là nhiễu hỏng.
      if (w.en.toLowerCase() === target.en.toLowerCase()) return false;
      if (w.icon === target.icon) return false; // (1)
      return matchesMode(w, target, themeWordIds, mode);
    });

    const shuffled = shuffleSeeded(pool, seed ?? hashString(target.id));
    const usedIcons = new Set<string>([target.icon]);
    const out: Word[] = [];
    for (const word of shuffled) {
      if (out.length >= count) break;
      if (usedIcons.has(word.icon)) continue; // (2)
      usedIcons.add(word.icon);
      out.push(word);
    }
    return out;
  }

  // --- Nội bộ ---------------------------------------------------------------

  /**
   * Bundle của level chứa một bài.
   *
   * ⚠️ KHÔNG suy ra levelId bằng cách cắt chuỗi từ `lesson.themeId`. `Lesson` KHÔNG có
   * trường `levelId`, và `themeId` là slug trần ("at-the-zoo"), KHÔNG phải "starters/at-the-zoo".
   * Bản trước làm `lesson.themeId.split('/')[0]` ⇒ trả về "at-the-zoo" rồi đem đi nạp như
   * một levelId ⇒ ném "Không tìm thấy level" ngay khi bé mở bài học. Muốn biết level thì
   * phải hỏi chính `Theme` — nơi có trường `levelId`.
   */
  private bundleForLesson(lesson: Lesson): LevelBundle | null {
    const theme = this.getTheme(lesson.themeId);
    if (!theme) return null;
    return this.loadLevel(theme.levelId);
  }

  /** Tìm trong các bundle đã nạp; nếu chưa có thì nạp thêm level khác rồi tìm lại. */
  private lookup<T>(pick: (bundle: LevelBundle) => T | undefined): T | null {
    for (const bundle of this.bundles.values()) {
      const hit = pick(bundle);
      if (hit !== undefined) return hit;
    }
    for (const levelId of listLevelIds()) {
      if (this.bundles.has(levelId)) continue;
      const hit = pick(this.loadLevel(levelId));
      if (hit !== undefined) return hit;
    }
    return null;
  }
}

function matchesMode(
  word: Word,
  target: Word,
  themeWordIds: ReadonlySet<string>,
  mode: DistractorMode,
): boolean {
  switch (mode) {
    case 'same_theme':
      return themeWordIds.has(word.id);
    case 'cross_theme':
      return !themeWordIds.has(word.id);
    case 'similar_sound': {
      // Cùng chữ cái đầu là dấu hiệu "nghe na ná" rõ nhất với bé mới học.
      const a = word.en.charAt(0).toLowerCase();
      const b = target.en.charAt(0).toLowerCase();
      if (a === b && a !== '') return true;
      // Dự phòng: cùng độ dài ⇒ khó phân biệt khi chỉ nghe.
      return Math.abs(word.en.length - target.en.length) <= 1;
    }
    default:
      return false;
  }
}

/** Dùng chung một instance: nội dung bất biến, cache dùng chung là đúng. */
export const contentRepository = new ContentRepository();
