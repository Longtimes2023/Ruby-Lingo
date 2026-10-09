/**
 * RubyLingo — Luật GỘP TIẾN ĐỘ, dùng CHUNG client + server.
 *
 * ⭐ VÌ SAO Ở `shared/` CHỨ KHÔNG Ở MỘT BÊN:
 *   Cả hai bên đều phải gộp tiến độ:
 *     • **Client** gộp ảnh chụp từ server vào bản đang giữ trong máy (bé chơi offline rồi
 *       có mạng lại).
 *     • **Server** gộp sự kiện trong hàng đợi của client vào bản trong DB (T039).
 *   Nếu mỗi bên tự viết luật riêng, sớm muộn chúng lệch nhau — và kiểu lệch này cực khó
 *   truy: cùng một dữ liệu, client hiện "12 từ đã học" còn báo cáo phụ huynh hiện "9 từ".
 *   Một luật, một chỗ.
 *
 * ⭐ LUẬT CƠ BẢN: **LẦN GHI SAU THẮNG (Last-Write-Wins)** theo `updatedAt`.
 *   Không dùng cách "cộng dồn" hay "lấy số lớn hơn" — xem `mergeWordProgress`.
 *
 * ⚙️ HÀM THUẦN: không đọc `Date.now()`, không chạm `localStorage`, không gọi mạng. Thời
 *    điểm luôn được truyền vào. Nhờ vậy test được mà không cần giả lập đồng hồ.
 */

import type {
  DailyStat,
  LessonProgress,
  ProgressEvent,
  ProgressSnapshot,
  ThemeProgress,
  WordProgress,
} from './types/progress.js';

// =============================================================================
// Tiện ích so sánh
// =============================================================================

/**
 * Bản ghi nào mới hơn.
 *
 * ⚠️ So sánh CHUỖI ISO-8601 bằng `<`/`>` là ĐÚNG và có chủ đích: định dạng ISO-8601 UTC
 *    (`2026-10-06T12:00:00.000Z`) sắp xếp theo thứ tự từ điển TRÙNG với thứ tự thời gian,
 *    vì mọi thành phần đều có độ rộng cố định. Dùng `Date.parse()` sẽ chậm hơn, và tệ hơn:
 *    âm thầm sai nếu một bên ghi thiếu `Z` hoặc lệch múi giờ.
 *
 * ⚠️ Chuỗi rỗng hoặc không hợp lệ được coi là CŨ NHẤT — bản ghi có thời điểm thật luôn thắng
 *    bản ghi thiếu thời điểm. Nếu làm ngược lại, một bản ghi hỏng sẽ đè mất dữ liệu tốt.
 */
export function isNewer(candidate: string, reference: string): boolean {
  if (!candidate) return false;
  if (!reference) return true;
  return candidate > reference;
}

/** Lấy bản ghi mới hơn trong hai. Bằng nhau thì ưu tiên `a` (ổn định, không đổi kết quả). */
function newerOf<T extends { updatedAt: string }>(a: T, b: T): T {
  return isNewer(b.updatedAt, a.updatedAt) ? b : a;
}

/** `true` nếu một trong hai giá trị là `true` — dùng cho các cờ "đã đạt được". */
function sticky(a: boolean, b: boolean): boolean {
  return a || b;
}

/** Ngày giờ mới hơn trong hai, bỏ qua giá trị `null`. */
function laterDate(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a > b ? a : b;
}

// =============================================================================
// Gộp từng loại bản ghi
// =============================================================================

/**
 * Gộp tiến độ của MỘT từ.
 *
 * ⭐ BA LOẠI TRƯỜNG, BA CÁCH GỘP KHÁC NHAU — đây là chỗ dễ làm sai nhất:
 *
 *   1. **Thành tựu (`learned`, `mastered`) — DÍNH, không bao giờ mất.**
 *      Một khi bé đã học hoặc đã nhớ từ này thì không có thao tác nào trên đời lấy lại được.
 *      Nếu dùng LWW thuần cho hai cờ này, một bản ghi CŨ nhưng tình cờ mới hơn ở trường
 *      khác có thể đặt `mastered` về `false` — bé mất thành quả và phụ huynh thấy báo cáo
 *      tụt lùi. Trong app học tập, "mất tiến độ" là lỗi nghiêm trọng nhất có thể có.
 *
 *   2. **Số đếm (`correctCount`, `wrongCount`) — LẤY THEO BẢN MỚI HƠN, KHÔNG CỘNG.**
 *      Cộng hai bên nghe có vẻ "đúng" nhưng sai ở đúng tình huống hay gặp nhất: bé chơi
 *      offline (máy đếm 5), mất mạng, gửi lại hàng đợi 2 lần (server nhận 5, client vẫn giữ
 *      5) ⇒ cộng thành 10. Số liệu phồng lên vĩnh viễn và không có cách nào sửa về sau.
 *      LWW cho kết quả TẤT ĐỊNH và LŨY ĐẲNG (gộp lại nhiều lần vẫn ra một kết quả), đó là
 *      hai tính chất mà một cơ chế đồng bộ cần hơn là "chính xác tuyệt đối".
 *      Cái giá: nếu hai thiết bị cùng học offline rồi cùng đồng bộ, số đếm của bên thua bị
 *      mất. Với app gia đình (một bé, vài thiết bị, hiếm khi dùng cùng lúc) cái giá này nhỏ
 *      hơn nhiều so với việc số liệu phồng lên.
 *
 *   3. **`lastSeenAt` — LẤY MỐC MUỘN NHẤT.** Đây là câu hỏi "lần cuối bé gặp từ này là khi
 *      nào", nên câu trả lời đúng luôn là mốc muộn hơn, bất kể bản ghi nào thắng.
 */
export function mergeWordProgress(a: WordProgress, b: WordProgress): WordProgress {
  const winner = newerOf(a, b);
  return {
    childId: winner.childId,
    wordId: winner.wordId,
    learned: sticky(a.learned, b.learned),
    mastered: sticky(a.mastered, b.mastered),
    correctCount: winner.correctCount,
    wrongCount: winner.wrongCount,
    lastSeenAt: laterDate(a.lastSeenAt, b.lastSeenAt),
    updatedAt: isNewer(a.updatedAt, b.updatedAt) ? a.updatedAt : b.updatedAt,
  };
}

/**
 * Gộp tiến độ một bài học.
 *
 * `bestScore` và `starsBest` lấy SỐ LỚN HƠN, không theo LWW: migration 003 ghi rõ
 * *"KHÔNG BAO GIỜ giảm: chơi lại kém hơn không làm mất kỷ lục"*. Đó là lời hứa với bé, và
 * LWW sẽ phá lời hứa đó mỗi khi bản ghi cũ tình cờ mới hơn.
 * `attempts` cũng lấy số lớn hơn vì đây là số đếm chỉ tăng.
 */
export function mergeLessonProgress(a: LessonProgress, b: LessonProgress): LessonProgress {
  const winner = newerOf(a, b);
  return {
    childId: winner.childId,
    lessonId: winner.lessonId,
    bestScore: Math.max(a.bestScore, b.bestScore),
    starsBest: Math.max(a.starsBest, b.starsBest) as 0 | 1 | 2 | 3,
    attempts: Math.max(a.attempts, b.attempts),
    completed: sticky(a.completed, b.completed),
    completedAt: laterDate(a.completedAt, b.completedAt),
    updatedAt: isNewer(a.updatedAt, b.updatedAt) ? a.updatedAt : b.updatedAt,
  };
}

/** Gộp tiến độ một chủ đề. `unlocked` dính; số đếm lấy theo bản mới hơn. */
export function mergeThemeProgress(a: ThemeProgress, b: ThemeProgress): ThemeProgress {
  const winner = newerOf(a, b);
  return {
    childId: winner.childId,
    themeId: winner.themeId,
    unlocked: sticky(a.unlocked, b.unlocked),
    unlockedAt: laterDate(a.unlockedAt, b.unlockedAt),
    lessonsCompleted: winner.lessonsCompleted,
    starsEarned: winner.starsEarned,
    updatedAt: isNewer(a.updatedAt, b.updatedAt) ? a.updatedAt : b.updatedAt,
  };
}

/**
 * Gộp thống kê một ngày.
 *
 * ⚠️ LẤY THEO BẢN MỚI HƠN cho mọi trường số, KHÔNG lấy số lớn nhất và KHÔNG cộng.
 *    • Cộng ⇒ phồng số khi client gửi lại hàng đợi (cùng lý do như `mergeWordProgress`).
 *    • Lấy số lớn nhất ⇒ che mất một sự thật khó chịu nhưng cần biết: nếu server đã tính
 *      lại và ra số NHỎ HƠN (VD: phát hiện sự kiện trùng), ta phải chấp nhận số mới. Báo
 *      cáo phụ huynh phải phản ánh dữ liệu thật, không phải con số đẹp nhất từng có.
 */
export function mergeDailyStat(a: DailyStat, b: DailyStat): DailyStat {
  const winner = newerOf(a, b);
  return { ...winner, date: winner.date, childId: winner.childId };
}

// =============================================================================
// Gộp ảnh chụp toàn bộ
// =============================================================================

/** Gộp hai mảng bản ghi theo khoá, dùng hàm gộp cho từng cặp trùng khoá. */
function mergeByKey<T>(
  a: readonly T[],
  b: readonly T[],
  keyOf: (item: T) => string,
  merge: (x: T, y: T) => T,
): T[] {
  const map = new Map<string, T>();
  for (const item of a) map.set(keyOf(item), item);
  for (const item of b) {
    const key = keyOf(item);
    const existing = map.get(key);
    map.set(key, existing ? merge(existing, item) : item);
  }
  // Sắp xếp lại cho TẤT ĐỊNH: thứ tự trong `Map` phụ thuộc thứ tự chèn, mà thứ tự chèn phụ
  // thuộc bên nào gọi trước. Không sắp xếp thì hai lần gộp cùng dữ liệu có thể ra hai mảng
  // khác thứ tự ⇒ React render lại vô ích và test so sánh mảng sẽ chập chờn.
  return [...map.values()].sort((x, y) => keyOf(x).localeCompare(keyOf(y)));
}

/**
 * Gộp hai ảnh chụp tiến độ thành một. **Lũy đẳng**: gộp `A` với `A` ra `A`.
 *
 * Dùng ở CẢ HAI BÊN (xem ghi chú đầu file):
 *   • client: `mergeProgressSnapshots(bản trong máy, ảnh chụp từ server)`
 *   • server: `mergeProgressSnapshots(bản trong DB, ảnh chụp client gửi lên)`
 */
export function mergeProgressSnapshots(
  a: ProgressSnapshot,
  b: ProgressSnapshot,
): ProgressSnapshot {
  return {
    // Hai ảnh chụp khác bé thì KHÔNG được gộp. Trả về `b` (bản đến sau) thay vì trộn bừa —
    // trộn hai bé sẽ khiến tiến độ của bé này xuất hiện trong hồ sơ bé kia.
    childId: b.childId,
    words: mergeByKey(a.words, b.words, (w) => w.wordId, mergeWordProgress),
    lessons: mergeByKey(a.lessons, b.lessons, (l) => l.lessonId, mergeLessonProgress),
    themes: mergeByKey(a.themes, b.themes, (t) => t.themeId, mergeThemeProgress),
    dailyStats: mergeByKey(a.dailyStats, b.dailyStats, (d) => d.date, mergeDailyStat),
    serverTime: isNewer(b.serverTime, a.serverTime) ? b.serverTime : a.serverTime,
  };
}

/** Ảnh chụp rỗng của một bé — trạng thái khởi đầu khi bé chưa học gì. */
export function emptySnapshot(childId: string, serverTime: string): ProgressSnapshot {
  return { childId, words: [], lessons: [], themes: [], dailyStats: [], serverTime };
}

// =============================================================================
// Áp sự kiện tại chỗ (client, khi chơi offline)
// =============================================================================

/**
 * Áp một sự kiện tiến độ vào ảnh chụp hiện có — **hàm thuần**, trả về ảnh chụp MỚI.
 *
 * ⭐ VÌ SAO CLIENT CẦN TỰ ÁP SỰ KIỆN, KHÔNG CHỜ SERVER:
 *   Bé chơi trên iPad ở nhà không có wifi. Nếu mỗi câu trả lời phải đợi server xác nhận thì
 *   app đứng im — đúng thứ không được xảy ra. Client áp sự kiện ngay để bé thấy tiến độ,
 *   rồi hàng đợi được gửi lên sau (T038). Server vẫn là bên CHẤM ĐIỂM cuối cùng (T049);
 *   những gì ở đây chỉ là bản xem trước.
 *
 * ⚠️ `event.occurredAt` được dùng làm `updatedAt` của bản ghi, KHÔNG dùng giờ hệ thống hiện
 *    tại. Nếu dùng `Date.now()`, một sự kiện cũ gửi lại sẽ mang thời điểm mới và thắng cả
 *    những bản ghi mới hơn thật — phá vỡ toàn bộ luật LWW.
 */
export function applyEvent(
  snapshot: ProgressSnapshot,
  event: ProgressEvent,
  options: { masteredThreshold?: number } = {},
): ProgressSnapshot {
  const masteredThreshold = options.masteredThreshold ?? MASTERED_THRESHOLD;

  if (event.kind === 'word_answer' && event.wordId) {
    return updateWord(snapshot, event.wordId, event.occurredAt, (prev) => {
      const correct = event.correct === true;
      const correctCount = prev.correctCount + (correct ? 1 : 0);
      const wrongCount = prev.wrongCount + (correct ? 0 : 1);
      return {
        ...prev,
        correctCount,
        wrongCount,
        learned: true,
        // Ngưỡng "nhớ chắc": 3 lần đúng. PHẢI khớp hằng số phía server (T039) — xem
        // `MASTERED_THRESHOLD`.
        mastered: prev.mastered || correctCount >= masteredThreshold,
        lastSeenAt: laterDate(prev.lastSeenAt, event.occurredAt),
      };
    });
  }

  if (event.kind === 'word_learned' && event.wordId) {
    return updateWord(snapshot, event.wordId, event.occurredAt, (prev) => ({
      ...prev,
      learned: true,
      lastSeenAt: laterDate(prev.lastSeenAt, event.occurredAt),
    }));
  }

  if (event.kind === 'lesson_completed' && event.lessonId) {
    return updateLesson(snapshot, event.lessonId, event.occurredAt, (prev) => ({
      ...prev,
      completed: true,
      completedAt: laterDate(prev.completedAt, event.occurredAt),
    }));
  }

  // Sự kiện không khớp `kind` nào (dữ liệu hỏng từ bản cũ) ⇒ trả nguyên trạng. Không ném lỗi:
  // một sự kiện hỏng trong hàng đợi không được phép chặn cả hàng đợi.
  return snapshot;
}

/**
 * Số lần trả lời đúng để coi là "đã nhớ".
 *
 * ⚠️ PHẢI khớp `MASTERED_THRESHOLD` phía server. Nếu client dùng 3 còn server dùng 5, bé sẽ
 *    thấy từ được đánh dấu "đã nhớ" trong máy rồi biến mất sau khi đồng bộ — và không ai
 *    hiểu vì sao.
 */
export const MASTERED_THRESHOLD = 3;

/** Cập nhật (hoặc tạo) bản ghi tiến độ của một từ. */
function updateWord(
  snapshot: ProgressSnapshot,
  wordId: string,
  occurredAt: string,
  change: (prev: WordProgress) => WordProgress,
): ProgressSnapshot {
  const index = snapshot.words.findIndex((w) => w.wordId === wordId);
  const prev: WordProgress =
    index >= 0
      ? snapshot.words[index]!
      : {
          childId: snapshot.childId,
          wordId,
          learned: false,
          mastered: false,
          correctCount: 0,
          wrongCount: 0,
          lastSeenAt: null,
          updatedAt: occurredAt,
        };

  const next = { ...change(prev), updatedAt: occurredAt };
  const words = [...snapshot.words];
  if (index >= 0) words[index] = next;
  else words.push(next);

  return { ...snapshot, words };
}

/** Cập nhật (hoặc tạo) bản ghi tiến độ của một bài học. */
function updateLesson(
  snapshot: ProgressSnapshot,
  lessonId: string,
  occurredAt: string,
  change: (prev: LessonProgress) => LessonProgress,
): ProgressSnapshot {
  const index = snapshot.lessons.findIndex((l) => l.lessonId === lessonId);
  const prev: LessonProgress =
    index >= 0
      ? snapshot.lessons[index]!
      : {
          childId: snapshot.childId,
          lessonId,
          bestScore: 0,
          starsBest: 0,
          attempts: 0,
          completed: false,
          completedAt: null,
          updatedAt: occurredAt,
        };

  const next = { ...change(prev), updatedAt: occurredAt };
  const lessons = [...snapshot.lessons];
  if (index >= 0) lessons[index] = next;
  else lessons.push(next);

  return { ...snapshot, lessons };
}

// =============================================================================
// Truy vấn tiện dụng trên ảnh chụp
// =============================================================================

/** Tập id các từ bé đã học. */
export function learnedWordIds(snapshot: ProgressSnapshot): ReadonlySet<string> {
  return new Set(snapshot.words.filter((w) => w.learned).map((w) => w.wordId));
}

/** Tập id các từ bé đã nhớ chắc. */
export function masteredWordIds(snapshot: ProgressSnapshot): ReadonlySet<string> {
  return new Set(snapshot.words.filter((w) => w.mastered).map((w) => w.wordId));
}

/** Số sao cao nhất bé đạt được ở một bài. `0` nếu chưa chơi. */
export function starsForLesson(snapshot: ProgressSnapshot, lessonId: string): 0 | 1 | 2 | 3 {
  return snapshot.lessons.find((l) => l.lessonId === lessonId)?.starsBest ?? 0;
}

/**
 * Tập id các bài đã HOÀN THÀNH (`LessonProgress.completed`).
 *
 * ⭐ ĐÂY LÀ ĐỊNH NGHĨA DUY NHẤT CỦA "BÀI ĐÃ XONG" — mọi màn hình phải dùng hàm này.
 *
 *   Trước đây `ThemePage` tự định nghĩa "xong" là *bé đã học hết số từ của bài*
 *   (`learnedCount >= total`), còn luật mở khoá ở `shared/theme-access.ts` dùng
 *   `LessonProgress.completed` (do sự kiện `lesson_completed` ghi vào). Hai định nghĩa đó
 *   LỆCH NHAU, và cái lệch ấy HIỆN RA MÀN HÌNH: bé vuốt hết 7 thẻ nhưng chưa bấm nút
 *   "🎉 Xong rồi!" thì màn chủ đề ghi "✓ Bé đã học xong bài này!" trong khi thẻ chủ đề trên
 *   bản đồ vẫn ghi "0/3 bài". Hai màn hình nói hai điều khác nhau về cùng một việc.
 *
 *   Nay "bài đã xong" chỉ có một nghĩa, và `FlashcardPage` tự ghi nhận hoàn thành ngay khi bé
 *   học hết số từ của bài — nên bé không bao giờ kẹt ở trạng thái "7/7 từ mà bài chưa xong".
 */
export function completedLessonIds(snapshot: ProgressSnapshot): ReadonlySet<string> {
  return new Set(snapshot.lessons.filter((l) => l.completed).map((l) => l.lessonId));
}
