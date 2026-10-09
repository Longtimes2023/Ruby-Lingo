/**
 * RubyLingo — LUẬT MỞ KHOÁ chủ đề trên bản đồ hành trình.
 *
 * ⭐ VÌ SAO LUẬT NÀY NẰM Ở `shared/` VÀ LÀ HÀM THUẦN:
 *   Đây là luật nghiệp vụ, không phải chi tiết giao diện: "chủ đề nào bé được vào". Server sẽ
 *   cần đúng luật này khi trao thưởng mở khoá (`reward` / `GameResultService`, Nhóm 6) — nếu
 *   client nói "đã mở" mà server nói "chưa", bé sẽ thấy chủ đề mở ra rồi biến mất sau khi đồng
 *   bộ. Một chỗ khai báo, hai bên cùng đọc.
 *
 *   Hàm thuần (không React, không `fetch`, không `Date.now`) nên kiểm thử được trực tiếp — xem
 *   `tests/unit/shared/theme-access.test.ts`.
 *
 * ⭐ BỐN TRẠNG THÁI, KHÔNG PHẢI HAI:
 *
 *   `open`        — vào được, và CÓ GAME để chơi. Thẻ trên bản đồ hiện ⭐.
 *   `study`       — vào được, nhưng chưa có game: chỉ có thẻ từ vựng. Thẻ hiện tiến độ TỪ,
 *                   không hiện ⭐ (vì ⭐ luôn bằng 0 và "0 sao" đọc lên như một lời chê).
 *   `locked`      — có nội dung nhưng điều kiện mở khoá chưa đạt. Hiện rõ CẦN GÌ để mở.
 *   `coming_soon` — KHÔNG có nội dung học nào. Đây mới thật sự là "sắp mở".
 *
 * ⚠️⚠️ `unlockCondition.type === 'coming_soon'` KHÔNG ĐỒNG NGHĨA VỚI `kind === 'coming_soon'`.
 *
 *   Đây là chỗ dễ hiểu sai nhất trong toàn bộ file, và nó đã từng được hiểu sai:
 *
 *   `unlockCondition: { type: 'coming_soon' }` là ghi chú của người soạn nội dung, nghĩa là
 *   **"chủ đề này chưa có GAME"**. Nó KHÔNG có nghĩa là "chưa có từ vựng": cả 11 chủ đề Starters
 *   đều đã có đủ từ và bài học (275 từ / 43 bài), chỉ riêng `at-the-zoo` có bài tập game.
 *
 *   Nếu lấy cờ đó để KHOÁ màn hình chủ đề, bé sẽ chỉ học được 21/275 từ — trong khi 254 từ còn
 *   lại đã nằm sẵn trong ứng dụng, đã qua kiểm tra nội dung, và học thẻ từ thì KHÔNG cần game.
 *   Nên: có nội dung học ⇒ vẫn cho vào, chỉ là vào ở trạng thái `study`.
 *
 *   Khi một chủ đề thật sự chưa có từ nào (`wordCount === 0` hoặc `lessonCount === 0`) thì mới
 *   là `coming_soon` — không bấm vào được, vì bấm vào cũng không có gì để xem.
 *
 * ⭐ TIẾN ĐỘ ĐƯỢC TÍNH TỪ `snapshot.lessons`, KHÔNG TỪ `snapshot.themes[].lessonsCompleted`:
 *   `ThemeProgress.lessonsCompleted` / `starsEarned` là số TỔNG HỢP do server duy trì. Client
 *   chỉ nhận được chúng sau khi đồng bộ xong. Nhưng bản ghi từng bài (`LessonProgress`) thì
 *   client có NGAY, kể cả khi đang offline — `progressStore` tự áp sự kiện tại chỗ.
 *
 *   Hệ quả nếu dùng số tổng hợp: bé học xong bài cuối của chủ đề khi mất mạng, bản đồ vẫn hiện
 *   "chưa xong" và chủ đề kế tiếp vẫn khoá cho tới khi có mạng trở lại. Bé vừa làm xong một việc
 *   lớn mà ứng dụng không công nhận — đúng thứ không được phép xảy ra.
 */

import type { ThemeMapItem } from './types/content.js';
import type { LessonProgress, ProgressSnapshot } from './types/progress.js';
import { learnedWordIds } from './progress-merge.js';

/** Số sao tối đa của một bài. Phải khớp `starsBest: 0 | 1 | 2 | 3` trong `LessonProgress`. */
export const MAX_STARS_PER_LESSON = 3;

export type ThemeAccessKind =
  /** Vào được và có game. */
  | 'open'
  /** Vào được nhưng chỉ có thẻ từ (chưa có game). */
  | 'study'
  /** Có nội dung nhưng chưa đủ điều kiện mở khoá. */
  | 'locked'
  /** Chưa có nội dung học nào. */
  | 'coming_soon';

/** Điều kiện còn thiếu để mở khoá — dùng để hiện câu giải thích cho bé. */
export type ThemeRequirement =
  | { type: 'previous_theme'; themeId: string; themeName_vi: string }
  | { type: 'stars_required'; stars: number; have: number };

export interface ThemeAccess {
  themeId: string;
  /** Vị trí trên bản đồ, bắt đầu từ 1. */
  index: number;
  kind: ThemeAccessKind;
  /** Bé có bấm vào được không (`open` hoặc `study`). */
  enterable: boolean;
  /** Chủ đề có bài tập game chưa. Quyết định thẻ hiện ⭐ hay hiện tiến độ từ. */
  hasGames: boolean;
  /** Còn thiếu gì để mở. `null` khi đã mở, hoặc khi chủ đề chưa có nội dung. */
  requirement: ThemeRequirement | null;
  lessonCount: number;
  lessonsCompleted: number;
  wordCount: number;
  wordsLearned: number;
  starsEarned: number;
  /** `lessonCount × 3`. */
  starsMax: number;
}

export interface ResolveThemeAccessOptions {
  /**
   * Từ của từng chủ đề (`LevelBundle.wordIdsByTheme`).
   *
   * Không bắt buộc, nhưng THIẾU NÓ THÌ `wordsLearned` LUÔN BẰNG 0 — vì `ThemeMapItem` cố ý chỉ
   * chứa dữ liệu nội dung, còn danh sách id từ thì nằm ở cấp level. Truyền `undefined` vẫn hợp
   * lệ: màn hình nào không hiện tiến độ từ thì không cần nạp.
   */
  wordIdsByTheme?: ReadonlyMap<string, readonly string[]>;
}

/**
 * Tính trạng thái mở khoá cho TẤT CẢ chủ đề của một level, theo đúng thứ tự bản đồ.
 *
 * Trả về mảng song song với `items` (cùng thứ tự, cùng độ dài) để bên gọi ghép được với thẻ.
 */
export function resolveThemeAccess(
  items: readonly ThemeMapItem[],
  snapshot: ProgressSnapshot,
  options: ResolveThemeAccessOptions = {},
): ThemeAccess[] {
  const lessonById = new Map<string, LessonProgress>(
    snapshot.lessons.map((lesson) => [lesson.lessonId, lesson]),
  );
  const themeById = new Map(snapshot.themes.map((theme) => [theme.themeId, theme]));
  const learned = learnedWordIds(snapshot);

  /**
   * Tổng sao của CẢ level — dùng cho điều kiện `stars_required`.
   *
   * Tính trước một lượt thay vì cộng dồn trong vòng lặp: điều kiện sao nói về tổng của cả cấp
   * học, không phải của những chủ đề đứng trước. Cộng dồn trong vòng lặp sẽ khiến một chủ đề
   * đứng sau được hưởng lợi từ chính số sao mà nó chưa hề kiếm được.
   */
  const starsTotal = items.reduce((sum, item) => sum + countStars(item, lessonById), 0);

  /** Chủ đề đã hoàn thành chưa — tính dần theo thứ tự, để `previous_theme` đọc được. */
  const completedByTheme = new Map<string, boolean>();

  return items.map((item, position) => {
    const lessonIds = item.theme.lessonIds;
    const lessonCount = lessonIds.length;
    const lessonsCompleted = lessonIds.reduce(
      (count, id) => count + (lessonById.get(id)?.completed === true ? 1 : 0),
      0,
    );
    const starsEarned = countStars(item, lessonById);

    const wordIds = options.wordIdsByTheme?.get(item.theme.id);
    const wordsLearned = wordIds
      ? wordIds.reduce((count, id) => count + (learned.has(id) ? 1 : 0), 0)
      : 0;

    const base = {
      themeId: item.theme.id,
      index: item.index,
      lessonCount,
      lessonsCompleted,
      wordCount: item.wordCount,
      wordsLearned,
      starsEarned,
      starsMax: lessonCount * MAX_STARS_PER_LESSON,
      hasGames: item.exerciseCount > 0,
    } satisfies Omit<ThemeAccess, 'kind' | 'enterable' | 'requirement'>;

    // --- Chưa có nội dung học ⇒ thật sự "sắp mở" ---------------------------
    // Bấm vào cũng không có gì để xem, nên KHÔNG cho vào. Khác hẳn trường hợp
    // `unlockCondition.type === 'coming_soon'` (chưa có game nhưng đã có từ) — xem ghi chú đầu file.
    if (lessonCount === 0 || item.wordCount === 0) {
      completedByTheme.set(item.theme.id, false);
      return { ...base, kind: 'coming_soon', enterable: false, requirement: null };
    }

    const isCompleted = lessonsCompleted >= lessonCount;
    completedByTheme.set(item.theme.id, isCompleted);

    // --- Server đã cấp quyền ⇒ tôn trọng, không cãi lại ---------------------
    // Server là bên chấm điểm cuối cùng. Nếu nó đã mở chủ đề này (ví dụ qua một nhiệm vụ đặc
    // biệt), client không được thu hồi quyền đó chỉ vì công thức nội dung chưa khớp.
    if (themeById.get(item.theme.id)?.unlocked === true) {
      return { ...base, kind: 'open', enterable: true, requirement: null };
    }

    const condition = item.theme.unlockCondition;

    switch (condition.type) {
      case 'always':
        return { ...base, kind: 'open', enterable: true, requirement: null };

      case 'coming_soon':
        // ⭐ Cờ này nghĩa là "chưa có GAME". Từ vựng và bài học đã có ⇒ vẫn cho bé vào học thẻ từ.
        return {
          ...base,
          kind: base.hasGames ? 'open' : 'study',
          enterable: true,
          requirement: null,
        };

      case 'previous_theme': {
        // `?? null` để `undefined` (do `noUncheckedIndexedAccess`) và `null` là cùng một thứ.
        const previous = position > 0 ? (items[position - 1] ?? null) : null;

        /**
         * ⚠️ CHỦ ĐỀ TRƯỚC KHÔNG CÓ NỘI DUNG ⇒ BỎ QUA ĐIỀU KIỆN, KHÔNG KHOÁ.
         *
         *   Nếu lấy một chủ đề không có bài nào làm điều kiện, điều kiện đó KHÔNG BAO GIỜ đạt
         *   được (không có bài thì không có "hoàn thành"), và mọi chủ đề đứng sau nó bị khoá
         *   vĩnh viễn. Một file JSON bị bỏ trống trong `level.themeIds` sẽ làm hỏng cả bản đồ —
         *   mà lỗi lại nằm ở một chủ đề khác, rất khó truy.
         */
        if (previous === null || previous.lessonCount === 0 || previous.wordCount === 0) {
          return { ...base, kind: 'open', enterable: true, requirement: null };
        }

        if (completedByTheme.get(previous.theme.id) === true) {
          return { ...base, kind: 'open', enterable: true, requirement: null };
        }

        return {
          ...base,
          kind: 'locked',
          enterable: false,
          requirement: {
            type: 'previous_theme',
            themeId: previous.theme.id,
            themeName_vi: previous.theme.name_vi,
          },
        };
      }

      case 'stars_required': {
        const needed = Math.max(0, condition.stars ?? 0);
        if (starsTotal >= needed) {
          return { ...base, kind: 'open', enterable: true, requirement: null };
        }
        return {
          ...base,
          kind: 'locked',
          enterable: false,
          requirement: { type: 'stars_required', stars: needed, have: starsTotal },
        };
      }
    }
  });
}

/** Tra nhanh trạng thái của một chủ đề theo id — dùng ở `ThemePage` (đọc từ URL). */
export function themeAccessById(access: readonly ThemeAccess[]): ReadonlyMap<string, ThemeAccess> {
  return new Map(access.map((item) => [item.themeId, item]));
}

/** Tổng hợp toàn level — dùng cho dải tóm tắt trên bản đồ. */
export interface ThemeAccessSummary {
  themeCount: number;
  enterableCount: number;
  wordCount: number;
  wordsLearned: number;
  starsEarned: number;
  starsMax: number;
}

export function summarizeThemeAccess(access: readonly ThemeAccess[]): ThemeAccessSummary {
  return {
    themeCount: access.length,
    enterableCount: access.filter((item) => item.enterable).length,
    wordCount: access.reduce((sum, item) => sum + item.wordCount, 0),
    wordsLearned: access.reduce((sum, item) => sum + item.wordsLearned, 0),
    starsEarned: access.reduce((sum, item) => sum + item.starsEarned, 0),
    starsMax: access.reduce((sum, item) => sum + item.starsMax, 0),
  };
}

function countStars(item: ThemeMapItem, lessonById: ReadonlyMap<string, LessonProgress>): number {
  let total = 0;
  for (const lessonId of item.theme.lessonIds) {
    total += lessonById.get(lessonId)?.starsBest ?? 0;
  }
  return total;
}
