/**
 * RubyLingo — Hook truy cập tiến độ học của bé đang chọn.
 *
 * ⭐ NHIỆM VỤ: nạp tiến độ của ĐÚNG bé đang chọn, và tự nạp lại khi bố mẹ đổi bé.
 *
 * ⚠️⚠️ HAI HOOK, HAI NHIỆM VỤ KHÁC NHAU — ĐỪNG GỘP (giống `useSync` / `useSyncLifecycle`):
 *   • `useProgressLifecycle()` — chỉ NẠP và XOÁ tiến độ. Gọi MỘT LẦN ở `AppShell`.
 *   • `useProgress()`          — ĐỌC dữ liệu + lấy các hàm ghi. Gọi ở bất kỳ màn hình nào.
 *
 *   Vì sao tách: trước đây `useProgress()` tự nạp, nghĩa là **tiến độ chỉ được nạp nếu có một
 *   màn hình tình cờ dùng hook này**. Màn hình bản đồ hành trình chỉ cần ĐỌC tiến độ qua
 *   `useThemeAccess()`, không cần hàm ghi nào — nên nếu để việc nạp nằm trong `useProgress()`,
 *   bản đồ sẽ hiện toàn số 0 cho tới khi bé mở một màn hình khác. Đúng kiểu lỗi im lặng.
 *
 *   Nạp ở `AppShell` cũng là chỗ ĐÚNG về mặt vòng đời: `AppShell` nằm trong `RequireChild`, nên
 *   chắc chắn đã có bé đang chọn; và nó chỉ được dựng một lần cho cả phiên (xem `router.tsx`).
 *
 * ⚠️ TRƯỚC KHI NẠP XONG (`isHydrated === false`), MỌI THAO TÁC GHI ĐỀU BỊ CHẶN.
 *   Xem `progressStore.record()`. Nếu không chặn, một cú chạm rất nhanh ngay khi màn hình vừa
 *   hiện sẽ ghi sự kiện vào ảnh chụp RỖNG rồi lưu đè lên dữ liệu thật trong máy.
 */

import { useCallback, useEffect } from 'react';

import type { ProgressEvent, ProgressSnapshot } from '@shared/types/progress.js';
import {
  completedLessonIds,
  learnedWordIds,
  masteredWordIds,
  starsForLesson,
} from '@shared/progress-merge.js';
import { useProgressStore } from '../store/progressStore.js';
import { useActiveChild } from '../store/sessionStore.js';

export interface UseProgressResult {
  /**
   * Bé mà tiến độ dưới đây thuộc về — `null` cho tới khi nạp xong.
   *
   * ⭐ Cần cho những thao tác GỬI LÊN SERVER theo `childId` trong URL (ví dụ gửi kết quả một
   *   lượt chơi, T049). Không suy ra được từ `snapshot`: ảnh chụp rỗng có `childId === ''` khi
   *   chưa nạp, và `''` là một giá trị hợp lệ để gửi đi một cách vô ích.
   */
  childId: string | null;
  /** Ảnh chụp tiến độ. Rỗng cho tới khi nạp xong. */
  snapshot: ProgressSnapshot;
  /** Số sự kiện còn chờ gửi lên server — `SyncBadge` dùng số này. */
  pendingCount: number;
  /** Lần đồng bộ thành công gần nhất, hoặc `null`. */
  lastSyncedAt: string | null;
  /** Đã nạp xong tiến độ từ máy chưa. */
  isHydrated: boolean;
  /** Ghi một câu trả lời. Không làm gì nếu chưa nạp xong. */
  recordWordAnswer: (wordId: string, correct: boolean) => void;
  markWordLearned: (wordId: string) => void;
  completeLesson: (lessonId: string) => void;
}

export function useProgress(): UseProgressResult {
  const childId = useProgressStore((s) => s.childId);
  const snapshot = useProgressStore((s) => s.snapshot);
  const pendingEvents = useProgressStore((s) => s.pendingEvents);
  const lastSyncedAt = useProgressStore((s) => s.lastSyncedAt);
  const isHydrated = useProgressStore((s) => s.hydrated);

  const storeRecordWordAnswer = useProgressStore((s) => s.recordWordAnswer);
  const storeMarkWordLearned = useProgressStore((s) => s.markWordLearned);
  const storeCompleteLesson = useProgressStore((s) => s.completeLesson);

  const recordWordAnswer = useCallback(
    (wordId: string, correct: boolean) => {
      storeRecordWordAnswer(wordId, correct);
    },
    [storeRecordWordAnswer],
  );

  const markWordLearned = useCallback(
    (wordId: string) => {
      storeMarkWordLearned(wordId);
    },
    [storeMarkWordLearned],
  );

  const completeLesson = useCallback(
    (lessonId: string) => {
      storeCompleteLesson(lessonId);
    },
    [storeCompleteLesson],
  );

  return {
    childId,
    snapshot,
    pendingCount: pendingEvents.length,
    lastSyncedAt,
    isHydrated,
    recordWordAnswer,
    markWordLearned,
    completeLesson,
  };
}

/**
 * Nạp / xoá tiến độ theo bé đang chọn. **Gọi MỘT LẦN ở `AppShell`** — xem ghi chú đầu file.
 *
 * ⚠️ VIỆC NẠP NẰM TRONG `useEffect` CHỨ KHÔNG TRONG THÂN RENDER:
 *   `hydrate()` đọc `localStorage` và ghi vào store — hai hiệu ứng phụ. Gọi trong thân render
 *   sẽ khiến StrictMode chạy nó hai lần mỗi lượt render, và tệ hơn: React có thể render một
 *   component rồi VỨT BỎ kết quả (render bị gián đoạn), để lại store đã bị ghi mà UI không
 *   bao giờ hiện. Đây là cùng một lý do đã áp dụng ở `useSpeech`.
 */
export function useProgressLifecycle(): void {
  const child = useActiveChild();
  const hydrate = useProgressStore((s) => s.hydrate);
  const reset = useProgressStore((s) => s.reset);

  useEffect(() => {
    if (child) {
      hydrate(child.id);
      return;
    }
    // Không còn bé nào đang chọn (đăng xuất, hoặc bố mẹ vừa xoá hồ sơ cuối cùng) ⇒ xoá
    // tiến độ khỏi bộ nhớ. Để lại sẽ khiến bé kế tiếp nhìn thấy tiến độ của bé trước trong
    // tích tắc đầu — và tệ hơn, nếu có gì đó ghi vào lúc đó thì tiến độ chảy sang hồ sơ sai.
    reset();
  }, [child, hydrate, reset]);
}

/** Tập id các từ bé đã học — dùng để tô sáng thẻ từ vựng. */
export function useLearnedWordIds(): ReadonlySet<string> {
  const snapshot = useProgressStore((s) => s.snapshot);
  return learnedWordIds(snapshot);
}

/** Tập id các từ bé đã nhớ chắc. */
export function useMasteredWordIds(): ReadonlySet<string> {
  const snapshot = useProgressStore((s) => s.snapshot);
  return masteredWordIds(snapshot);
}

/**
 * Tập id các bài đã HOÀN THÀNH — nguồn chân lý duy nhất cho "bài đã xong".
 *
 * ⚠️ KHÔNG suy ra "bài đã xong" từ số từ đã học. Hai đại lượng đó khác nhau, và dùng sai
 *   đại lượng sẽ làm hai màn hình nói hai điều trái ngược — xem ghi chú ở
 *   `completedLessonIds()` trong `shared/progress-merge.ts`.
 */
export function useCompletedLessonIds(): ReadonlySet<string> {
  const snapshot = useProgressStore((s) => s.snapshot);
  return completedLessonIds(snapshot);
}

/** Một bài cụ thể đã hoàn thành chưa. */
export function useLessonCompleted(lessonId: string): boolean {
  const completed = useCompletedLessonIds();
  return completed.has(lessonId);
}

/** Số sao cao nhất của một bài. `0` = chưa chơi. */
export function useLessonStars(lessonId: string): 0 | 1 | 2 | 3 {
  const snapshot = useProgressStore((s) => s.snapshot);
  return starsForLesson(snapshot, lessonId);
}

/**
 * Điểm kỷ lục của một bài, hoặc `null` nếu CHƯA BIẾT.
 *
 * ⚠️⚠️ `null` KHÁC `0`. `0` nghĩa là "đã biết, và kỷ lục là 0 điểm"; `null` nghĩa là "bài này
 *   chưa có trong ảnh chụp" — chưa từng chơi, hoặc ảnh chụp chưa về. Cùng lập luận như
 *   `useChildStatus()`: hiện số 0 cho một thứ chưa biết là một lời nói dối cụ thể.
 *
 * ⚠️ ĐÂY LÀ HIỂU BIẾT TRONG MÁY, KHÔNG PHẢI SỰ THẬT CUỐI CÙNG.
 *   Ảnh chụp tiến độ chỉ được cập nhật khi có lần đồng bộ với server. Một lượt chơi vừa xong
 *   KHÔNG ghi vào đây (đường ghi là `game-result`, không phải sự kiện tiến độ). Nên ngay sau
 *   lượt thứ hai, hàm này vẫn trả kỷ lục của lượt thứ nhất. Chỗ nào cần con số ĐÚNG ngay lập
 *   tức thì phải đọc `bestScore` từ phần thưởng server trả về (`GameResultAward`), như
 *   `ResultOverlay` đang làm.
 */
export function useLessonBestScore(lessonId: string): number | null {
  const snapshot = useProgressStore((s) => s.snapshot);
  return snapshot.lessons.find((l) => l.lessonId === lessonId)?.bestScore ?? null;
}

/** Tổng số sao bé đã giành được ở một chủ đề. */
export function useThemeStars(themeId: string): number {
  return useProgressStore(
    (s) => s.snapshot.themes.find((t) => t.themeId === themeId)?.starsEarned ?? 0,
  );
}

/**
 * Sự kiện vừa được tạo (nếu có) — dùng cho tầng đồng bộ (T038).
 *
 * Trả về hàm đọc thay vì giá trị, vì sự kiện được tạo ra NGOÀI vòng render (trong trình xử
 * lý cú chạm). `SyncService` cần biết "vừa có gì mới" để lên lịch gửi, mà không phải biến
 * mọi cú chạm thành một lần render.
 */
export function readPendingEvents(): ProgressEvent[] {
  return useProgressStore.getState().pendingEvents;
}
