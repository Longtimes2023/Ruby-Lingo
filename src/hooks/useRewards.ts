/**
 * RubyLingo — Hook truy cập ví ⭐🌰, XP, linh vật của bé đang chọn.
 *
 * ⚠️⚠️ HAI HOOK, HAI NHIỆM VỤ KHÁC NHAU — ĐỪNG GỘP. Cùng lý do đã áp dụng cho
 *   `useProgress` / `useProgressLifecycle` (xem ghi chú đầu `useProgress.ts`):
 *   • `useRewardsLifecycle()` — chỉ NẠP và XOÁ. Gọi MỘT LẦN ở `AppShell`.
 *   • `useRewards()`          — ĐỌC dữ liệu. Gọi ở bất kỳ màn hình nào.
 *
 *   Nếu để việc nạp nằm trong `useRewards()`, ví chỉ được nạp khi có một màn hình tình cờ dùng
 *   hook đó — và `TopBar` (nằm ở MỌI màn hình) sẽ hiện "—" cho tới lúc đó. Nạp ở `AppShell` là
 *   chỗ đúng về vòng đời: nó nằm trong `RequireChild` nên chắc chắn đã có bé, và nó chỉ được
 *   dựng một lần cho cả phiên (layout route — xem `router.tsx`).
 */

import { useEffect } from 'react';

import type { GameResultAward } from '@shared/types/progress.js';
import type { RewardSnapshot } from '@shared/types/reward.js';
import { useRewardStore } from '../store/rewardStore.js';
import { useActiveChild } from '../store/sessionStore.js';

export interface UseRewardsResult {
  /** Bé mà dữ liệu dưới đây thuộc về — `null` cho tới khi nạp xong. */
  childId: string | null;
  /** Ảnh chụp ví/XP/linh vật. `null` = CHƯA BIẾT ⇒ UI phải hiện "—", không được hiện số 0. */
  snapshot: RewardSnapshot | null;
  /** Đã thử nạp xong chưa (thành công hay thất bại đều tính). */
  isHydrated: boolean;
  /** Đang nạp lần đầu. */
  isLoading: boolean;
  /** Lỗi kỹ thuật của lần nạp hỏng gần nhất. KHÔNG hiển thị cho bé — xem `rewardStore`. */
  error: string | null;
}

export function useRewards(): UseRewardsResult {
  const childId = useRewardStore((s) => s.childId);
  const snapshot = useRewardStore((s) => s.snapshot);
  const isHydrated = useRewardStore((s) => s.hydrated);
  const isLoading = useRewardStore((s) => s.loading);
  const error = useRewardStore((s) => s.error);

  return { childId, snapshot, isHydrated, isLoading, error };
}

/**
 * Phần thưởng server chấm cho MỘT lượt chơi, theo `clientEventId`.
 *
 * ⭐ VÌ SAO CẦN HOOK RIÊNG THAY VÌ ĐỌC `useRewards().awards[clientEventId]` Ở CHỖ GỌI:
 *   Đọc cả bảng `awards` làm component render lại mỗi khi BẤT KỲ lượt chơi nào được gửi xong —
 *   kể cả những lượt đang gửi bù từ hôm qua mà màn hình này không liên quan. Selector dưới đây
 *   chỉ phụ thuộc một khoá, và giá trị trả về là tham chiếu ỔN ĐỊNH trong bảng (không tạo object
 *   mới mỗi lần gọi), nên không có vòng render thừa.
 *
 * Trả `null` khi lượt chơi CHƯA tới được server (đang mất mạng, hoặc đang trong hàng đợi). Đó
 * là "chưa biết", khác hẳn "không có thưởng" — UI phải phân biệt hai thứ này.
 */
export function useGameAward(clientEventId: string | null): GameResultAward | null {
  return useRewardStore((s) => (clientEventId ? (s.awards[clientEventId] ?? null) : null));
}

/**
 * Nạp / xoá ví theo bé đang chọn. **Gọi MỘT LẦN ở `AppShell`** — xem ghi chú đầu file.
 *
 * ⚠️ VIỆC NẠP NẰM TRONG `useEffect`, KHÔNG TRONG THÂN RENDER:
 *   `load()` gọi mạng và ghi vào store — hai hiệu ứng phụ. Gọi trong thân render sẽ khiến
 *   StrictMode chạy nó hai lần mỗi lượt render, và tệ hơn: React có thể render rồi VỨT BỎ kết
 *   quả (render bị gián đoạn), để lại store đã ghi mà UI không bao giờ hiện.
 *
 * ⚠️ `void` chứ không `await`: hiệu ứng của React không được là `async`. `load()` không bao giờ
 *   ném (lỗi được ghi vào `error`), nên không có promise nào bị bỏ rơi mà không ai biết.
 */
export function useRewardsLifecycle(): void {
  const child = useActiveChild();
  const load = useRewardStore((s) => s.load);
  const reset = useRewardStore((s) => s.reset);

  useEffect(() => {
    if (child) {
      void load(child.id);
      return;
    }
    // Không còn bé nào đang chọn (đăng xuất, hoặc bố mẹ vừa xoá hồ sơ cuối cùng) ⇒ xoá ví khỏi
    // bộ nhớ. Để lại sẽ khiến bé kế tiếp thấy ví CỦA BÉ TRƯỚC trong tích tắc đầu.
    reset();
  }, [child, load, reset]);
}
