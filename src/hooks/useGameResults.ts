/**
 * RubyLingo — `useGameResults`: đọc KẾT QUẢ GAME ĐÃ CHƠI của bé đang chọn (T05).
 *
 * ⭐ NHIỆM VỤ: cung cấp cho màn chủ đề (`ThemePage`) một `Map<exerciseId, GameResultSummary>`
 *   để tô chip trò chơi "đã chơi" (✓ + ★). Nguồn dữ liệu là kênh ĐỌC riêng
 *   `GET /api/children/:id/game-results` — KHÔNG nhét vào ảnh chụp tiến độ, vì đó là kênh GHI.
 *
 * ⚠️⚠️ MẠNG LỖI ⇒ `Map` RỖNG, KHÔNG NÉM RA UI (Chỉnh sửa bắt buộc #2 / Q-D1).
 *   Đây là quy tắc cứng của app:
 *     • KHÔNG hiện thông báo lỗi kỹ thuật cho bé.
 *     • KHÔNG hiện "0 ★" — 0 sao là một LỜI NÓI DỐI CỤ THỂ (xem lập luận `null` vs `0` ở
 *       `src/hooks/useProgress.ts`). Khi chưa biết thì chip ở trạng thái TRUNG TÍNH y như chưa
 *       chơi — trạng thái đó không khoe sai điều gì, và lần vào sau (mạng OK) chip tự đúng.
 *   React Query tự BẮT lỗi của `queryFn` (đặt `query.isError`), nên `query.data` chỉ là `undefined`
 *   ⇒ vòng lặp dưới không chạy ⇒ `Map` rỗng. Không cần `try/catch` ở đây.
 *
 * ⭐ `refetchOnMount: 'always'` (giữ theo thiết kế): quay lại màn chủ đề sau khi chơi ⇒ đọc lại ⇒
 *   chip đổi màu. Đây là lưới an toàn cho ca MỞ APP Ở THIẾT BỊ THỨ HAI (máy kia chơi, máy này mở
 *   lên phải thấy). Nhưng nó KHÔNG đủ cho ca "vừa chơi xong trên máy này": lượt chơi còn nằm
 *   trong hàng đợi chờ gửi ⇒ xem `gameResultQueue.onSent` (làm mới đúng lúc lượt chơi tới server).
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { GameResultSummary } from '@shared/types/progress.js';

import { progressApi } from '../api/endpoints.js';
import { gameResultsQueryKey } from '../lib/queryKeys.js';
import { useActiveChild } from '../store/sessionStore.js';

export interface UseGameResultsResult {
  /** Kết quả đã chơi, tra theo `exercise.id`. Rỗng khi chưa có dữ liệu HOẶC khi mạng lỗi. */
  byExerciseId: Map<string, GameResultSummary>;
}

/**
 * Kết quả game đã chơi của bé đang chọn, dạng `Map` tra theo `exerciseId`.
 *
 * Trả về `Map` (không phải mảng) vì chỗ dùng tra theo `exercise.id` cho TỪNG chip — tra `Map`
 * là O(1), còn quét mảng mỗi chip là O(n·m).
 */
export function useGameResults(): UseGameResultsResult {
  const child = useActiveChild();
  const childId = child?.id ?? null;

  const query = useQuery({
    queryKey: gameResultsQueryKey(childId),
    queryFn: () => progressApi.getGameResults(childId!),
    enabled: childId !== null,
    // `staleTime: 0` + `refetchOnMount: 'always'`: mỗi lần vào màn chủ đề đều đọc lại.
    staleTime: 0,
    refetchOnMount: 'always',
    // Một lần thử lại là đủ cho mạng chập chờn; hỏng thì thôi, KHÔNG chặn UI (xem ghi chú đầu file).
    retry: 1,
  });

  const byExerciseId = useMemo(() => {
    const map = new Map<string, GameResultSummary>();
    // `query.data` là `undefined` khi đang tải HOẶC khi lỗi ⇒ `Map` rỗng, không ném.
    for (const summary of query.data?.results ?? []) map.set(summary.exerciseId, summary);
    return map;
  }, [query.data]);

  return { byExerciseId };
}
