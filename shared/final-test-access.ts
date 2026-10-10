/**
 * RubyLingo — LUẬT MỞ KHOÁ bài thi cuối khoá Starters.
 *
 * ⭐ VÌ SAO LUẬT NÀY NẰM Ở `shared/` VÀ LÀ HÀM THUẦN:
 *   Đây là luật nghiệp vụ, không phải chi tiết giao diện. Client đọc để vẽ cổng "🎓 Khu vực thi";
 *   SERVER cũng đọc đúng luật này để tự kiểm điều kiện trước khi nhận bài (chống gõ thẳng API).
 *   Nếu hai bên lệch nhau, bé sẽ thấy cổng mở ra rồi biến mất sau khi đồng bộ. Một chỗ khai báo,
 *   hai bên cùng đọc. Hàm thuần: không React, không `fetch`, không `Date.now`.
 *
 * ⭐ ĐIỀU KIỆN MỞ = "HỌC HẾT" **VÀ** "CHƠI HẾT":
 *   · Vế A — HỌC HẾT: mọi bài của MỌI chủ đề CÓ BÀI đều `completed === true`.
 *   · Vế B — CHƠI HẾT: mọi exercise CHƠI ĐƯỢC của level đều đã được chơi (>= 1 sao).
 *
 * ⚠️⚠️ TIẾN ĐỘ BÀI ĐỌC TỪ BẢN GHI TỪNG BÀI (`LessonProgress`), KHÔNG TỪ SỐ TỔNG HỢP:
 *   `snapshot.lessons` client có NGAY (kể cả offline — `progressStore` áp sự kiện tại chỗ), còn
 *   `ThemeProgress.lessonsCompleted` chỉ có sau khi đồng bộ xong. Đọc số tổng hợp sẽ khiến bé học
 *   xong bài cuối khi mất mạng mà cổng thi vẫn khoá — bé vừa làm xong một việc lớn mà ứng dụng
 *   không công nhận. Cùng lý do đã ghi ở đầu `shared/theme-access.ts`.
 *
 * ⚠️⚠️ "MẪU SỐ" PHẢI ĐƯỢC TRUYỀN VÀO, KHÔNG SUY TỪ `lessons`:
 *   Chỉ nhìn `lessons` (bản ghi tiến độ) thì KHÔNG biết level còn bao nhiêu bài chưa chạm — bản
 *   ghi chỉ tồn tại cho bài bé đã đụng tới. Nếu lấy "mọi bài trong `lessons` đều completed" làm
 *   điều kiện, một máy vừa cài sẽ mở cổng thi NGAY vì `lessons` rỗng (rỗng thì "mọi phần tử" đúng
 *   hiển nhiên). Đó là lỗi im lặng đúng loại dự án này chống. Nên luật nhận thêm `requiredLessonIds`
 *   — danh sách TOÀN BỘ bài của level — làm mẫu số tường minh. Cùng tinh thần với `requiredExerciseIds`.
 *
 * ⭐ BỐN TRẠNG THÁI, KHÔNG PHẢI HAI:
 *   `locked`  — chưa đủ điều kiện; `requirement` nói RÕ còn thiếu bao nhiêu bài / bao nhiêu game.
 *   `ready`   — đủ điều kiện, bé vào thi được.
 *   `pending` — CHƯA ĐỒNG BỘ XONG (`hydrated === false`) ⇒ trạng thái TRUNG TÍNH. TUYỆT ĐỐI
 *               KHÔNG nói bé còn thiếu gì: khi offline, dữ liệu "đã chơi" có thể trống, và báo
 *               "còn 20 trò nữa" cho một bé đã chơi hết là MẮNG OAN.
 *   `done`    — đã có kết quả thi ⇒ LUÔN vào được. Bé đã thi rồi thì không bao giờ bị khoá lại,
 *               kể cả khi sau này nội dung lớn thêm và ngưỡng "chơi hết" tự nâng lên (Q1).
 */

import type { LessonProgress } from './types/progress.js';

/** Trạng thái cổng vào bài thi cuối khoá. */
export type FinalTestAccessKind =
  /** Chưa đủ điều kiện (thiếu bài, hoặc thiếu game). */
  | 'locked'
  /** Đủ điều kiện — bé vào thi được. */
  | 'ready'
  /** Chưa đồng bộ xong — trạng thái TRUNG TÍNH, không lộ "còn thiếu". */
  | 'pending'
  /** Đã có kết quả thi — LUÔN vào được, không bao giờ khoá lại. */
  | 'done';

/**
 * Còn thiếu gì để mở cổng. Dùng để hiện câu giải thích cho bé ("còn 3 bài nữa").
 *
 * ⭐ KHUÔN NÀY THEO `ThemeRequirement` ở `shared/theme-access.ts`: một union PHÂN BIỆT theo `type`,
 *   mỗi nhánh mang đúng con số mà UI cần nói ra. Thứ tự ưu tiên khi cả hai vế đều thiếu: BÀI TRƯỚC,
 *   GAME SAU — để câu hướng dẫn cho bé không nhảy qua nhảy lại giữa hai việc.
 */
export type FinalTestRequirement =
  | {
      type: 'lessons_incomplete';
      /** Số bài CHƯA xong. */
      lessonsMissing: number;
      lessonsCompleted: number;
      lessonsTotal: number;
    }
  | {
      type: 'games_unplayed';
      /** Số game CHƯA chơi. */
      gamesMissing: number;
      gamesPlayed: number;
      gamesTotal: number;
    };

export interface FinalTestAccess {
  kind: FinalTestAccessKind;
  /** Bé có bấm vào khu vực thi được không (`ready` hoặc `done`). */
  enterable: boolean;
  /** Còn thiếu gì. `null` khi đã mở (`ready`/`done`) HOẶC khi chưa đồng bộ (`pending`). */
  requirement: FinalTestRequirement | null;
  lessonsCompleted: number;
  lessonsTotal: number;
  exercisesPlayed: number;
  exercisesTotal: number;
}

export interface FinalTestAccessInput {
  /** Bản ghi tiến độ TỪNG bài — `ProgressSnapshot.lessons`. */
  lessons: readonly LessonProgress[];
  /**
   * TOÀN BỘ id bài của level (mọi chủ đề CÓ BÀI). Mẫu số của "học hết".
   * Chủ đề 0 bài KHÔNG đóng góp id nào ⇒ tự động được bỏ qua, không thể khoá oan.
   */
  requiredLessonIds: readonly string[];
  /**
   * Mọi id exercise CHƠI ĐƯỢC của level. Chủ đề 0 game không đóng góp id nào ⇒ điều kiện
   * "chơi hết" với chủ đề đó thoả hiển nhiên. Rỗng cũng hợp lệ: coi như đã đạt.
   */
  requiredExerciseIds: readonly string[];
  /** Tập id exercise bé ĐÃ CHƠI (>= 1 sao) — suy từ `GameResultSummary`. */
  playedExerciseIds: ReadonlySet<string>;
  /** `false` = chưa đồng bộ xong (`useGameResults` chưa hydrate) ⇒ cổng ở trạng thái trung tính. */
  hydrated: boolean;
  /** Đã có kết quả thi chưa (server trả). `true` ⇒ `done`, luôn vào được. */
  hasResult?: boolean;
}

/**
 * Tính trạng thái cổng vào bài thi cuối khoá. HÀM THUẦN — kiểm thử trực tiếp được.
 *
 * Thứ tự xét (quan trọng — đổi thứ tự là đổi hành vi):
 *   1. `hasResult` ⇒ `done` (bé đã thi rồi thì không khoá lại; đây là SỰ THẬT DƯƠNG, ưu tiên
 *      hơn mọi thứ, kể cả khi chưa hydrate xong — biết rồi thì không cần "đang kiểm tra" nữa).
 *   2. `!hydrated` ⇒ `pending` (không đủ dữ liệu để kết luận, KHÔNG được kết luận "còn thiếu").
 *   3. còn bài chưa xong ⇒ `locked` + `lessons_incomplete`.
 *   4. còn game chưa chơi ⇒ `locked` + `games_unplayed`.
 *   5. còn lại ⇒ `ready`.
 */
export function resolveFinalTestAccess(input: FinalTestAccessInput): FinalTestAccess {
  const completedLessonIds = new Set<string>();
  for (const lesson of input.lessons) {
    if (lesson.completed === true) completedLessonIds.add(lesson.lessonId);
  }

  const lessonsTotal = input.requiredLessonIds.length;
  let lessonsCompleted = 0;
  let lessonsMissing = 0;
  for (const id of input.requiredLessonIds) {
    if (completedLessonIds.has(id)) lessonsCompleted += 1;
    else lessonsMissing += 1;
  }

  const exercisesTotal = input.requiredExerciseIds.length;
  let exercisesPlayed = 0;
  let gamesMissing = 0;
  for (const id of input.requiredExerciseIds) {
    if (input.playedExerciseIds.has(id)) exercisesPlayed += 1;
    else gamesMissing += 1;
  }

  const counts = { lessonsCompleted, lessonsTotal, exercisesPlayed, exercisesTotal };

  // --- 1. Đã thi rồi ⇒ luôn vào được (Q1: ngưỡng nâng lên cũng không khoá lại) -----
  if (input.hasResult === true) {
    return { ...counts, kind: 'done', enterable: true, requirement: null };
  }

  // --- 2. Chưa hydrate ⇒ trung tính, KHÔNG lộ "còn thiếu" (tránh mắng oan khi offline) --
  if (input.hydrated !== true) {
    return { ...counts, kind: 'pending', enterable: false, requirement: null };
  }

  // --- 3. Vế A — học hết -------------------------------------------------------
  if (lessonsMissing > 0) {
    return {
      ...counts,
      kind: 'locked',
      enterable: false,
      requirement: { type: 'lessons_incomplete', lessonsMissing, lessonsCompleted, lessonsTotal },
    };
  }

  // --- 4. Vế B — chơi hết game -------------------------------------------------
  if (gamesMissing > 0) {
    return {
      ...counts,
      kind: 'locked',
      enterable: false,
      requirement: { type: 'games_unplayed', gamesMissing, gamesPlayed: exercisesPlayed, gamesTotal: exercisesTotal },
    };
  }

  // --- 5. Đủ cả hai vế ---------------------------------------------------------
  return { ...counts, kind: 'ready', enterable: true, requirement: null };
}
