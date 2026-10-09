/**
 * RubyLingo — Hook truy cập nhiệm vụ của bé đang chọn.
 *
 * ⚠️⚠️ HAI HOOK, HAI NHIỆM VỤ KHÁC NHAU — ĐỪNG GỘP. Cùng lý do đã áp dụng cho
 *   `useProgress`/`useProgressLifecycle` và `useRewards`/`useRewardsLifecycle`:
 *   • `useQuestsLifecycle()` — chỉ NẠP và XOÁ.
 *   • `useQuests()`          — ĐỌC dữ liệu. Gọi ở bất kỳ màn hình nào cần.
 *   • `useClaimQuest()`      — HÀNH ĐỘNG nhận thưởng + trạng thái đang gửi.
 *
 * ⭐ VÌ SAO `useQuestsLifecycle()` GỌI Ở `QuestsPage` (M9), KHÔNG Ở `AppShell`:
 *   Khác ví ⭐🌰 và tiến độ. `TopBar` nằm ở MỌI màn hình và hiện số ⭐, nên ví phải được nạp ở
 *   `AppShell`. Nhưng danh sách nhiệm vụ chỉ có MỘT màn hình dùng tới. Nạp ở `AppShell` nghĩa là
 *   mỗi lần bé mở app — kể cả chỉ để chơi một game — đều tốn thêm một request vô ích. Nạp ở
 *   `QuestsPage` giữ chi phí đúng chỗ: chỉ trả khi bé thật sự mở màn Nhiệm vụ.
 *
 *   ⚠️ ĐÁNH ĐỔI ĐÃ BIẾT: rời màn hình rồi quay lại sẽ KHÔNG nạp lại (`load()` thấy đã có dữ liệu
 *      thì thôi). Đó là chủ ý — nhiệm vụ đổi khi bé học xong một bài, và lúc đó `claim`/`load`
 *      đã tự làm mới danh sách. Muốn chắc chắn mới, màn hình gọi `load()` thủ công là đủ.
 */

import { useCallback, useEffect } from 'react';

import type { QuestWithProgress, StreakState } from '@shared/types/reward.js';
import type { ClaimCelebration } from '../store/questStore.js';
import { useQuestStore } from '../store/questStore.js';
import { useActiveChild } from '../store/sessionStore.js';

export interface UseQuestsResult {
  /** Bé mà dữ liệu dưới đây thuộc về — `null` cho tới khi nạp xong. */
  childId: string | null;
  /** Danh sách nhiệm vụ kèm tiến độ. `null` = CHƯA BIẾT ⇒ UI hiện trạng thái tải, không hiện rỗng. */
  quests: QuestWithProgress[] | null;
  /** Chuỗi ngày học. `null` = chưa biết. */
  streak: StreakState | null;
  /** Khoá kỳ hiện tại (`daily` / `weekly`) để hiện "còn bao lâu thì reset". */
  periodKeys: { daily: string; weekly: string } | null;
  /** Đã thử nạp xong chưa (thành công hay thất bại đều tính). */
  isHydrated: boolean;
  /** Đang nạp lần đầu. */
  isLoading: boolean;
  /** Lỗi kỹ thuật của lần nạp hỏng gần nhất. KHÔNG hiển thị cho bé — xem `questStore`. */
  error: string | null;
}

export function useQuests(): UseQuestsResult {
  const childId = useQuestStore((s) => s.childId);
  const quests = useQuestStore((s) => s.quests);
  const streak = useQuestStore((s) => s.streak);
  const periodKeys = useQuestStore((s) => s.periodKeys);
  const isHydrated = useQuestStore((s) => s.hydrated);
  const isLoading = useQuestStore((s) => s.loading);
  const error = useQuestStore((s) => s.error);

  return { childId, quests, streak, periodKeys, isHydrated, isLoading, error };
}

export interface UseClaimQuestResult {
  /** Bé bấm "Nhận thưởng". Nhận `questId`; không bao giờ ném. */
  claim: (questId: string) => Promise<void>;
  /** Nhiệm vụ này đang gửi yêu cầu nhận thưởng? (để tắt nút + hiện vòng xoay). */
  isClaiming: (questId: string) => boolean;
  /** Lần nhận gần nhất để ăn mừng; `null` = không có gì. */
  lastClaim: ClaimCelebration | null;
  /** Đóng màn ăn mừng. */
  dismissClaim: () => void;
}

/**
 * Hành động nhận thưởng + trạng thái đang gửi + kết quả để ăn mừng.
 *
 * ⭐ VÌ SAO TRẢ HÀM `isClaiming(questId)` THAY VÌ CẢ MAP `claiming`:
 *   Cả map làm component render lại mỗi khi BẤT KỲ nhiệm vụ nào bắt đầu/kết thúc gửi — kể cả
 *   nhiệm vụ mà thẻ này không liên quan. Hàm tra cứu giữ chỗ gọi không phải biết hình dạng của
 *   map, và khi nào cần tối ưu thì chỉ phải sửa ở đúng một nơi.
 */
export function useClaimQuest(): UseClaimQuestResult {
  const child = useActiveChild();
  const childId = child?.id ?? null;
  const claimInStore = useQuestStore((s) => s.claim);
  const claiming = useQuestStore((s) => s.claiming);
  const lastClaim = useQuestStore((s) => s.lastClaim);
  const dismissClaim = useQuestStore((s) => s.dismissClaim);

  const claim = useCallback(
    (questId: string): Promise<void> => {
      // Không có bé đang chọn ⇒ không có gì để nhận. Trả promise đã xong thay vì ném: chỗ gọi
      // là một `onClick`, ném ở đó chỉ tạo ra một promise bị bỏ rơi.
      if (!childId) return Promise.resolve();
      return claimInStore(childId, questId);
    },
    [childId, claimInStore],
  );

  const isClaiming = useCallback((questId: string) => Boolean(claiming[questId]), [claiming]);

  return { claim, isClaiming, lastClaim, dismissClaim };
}

/**
 * Nạp / xoá danh sách nhiệm vụ theo bé đang chọn. **Gọi ở `QuestsPage`** — xem ghi chú đầu file.
 *
 * ⚠️ VIỆC NẠP NẰM TRONG `useEffect`, KHÔNG TRONG THÂN RENDER:
 *   `load()` gọi mạng và ghi vào store — hai hiệu ứng phụ. Gọi trong thân render sẽ khiến
 *   StrictMode chạy nó hai lần mỗi lượt render, và tệ hơn: React có thể render rồi VỨT BỎ kết
 *   quả (render bị gián đoạn), để lại store đã ghi mà UI không bao giờ hiện.
 *
 * ⚠️ `void` chứ không `await`: hiệu ứng của React không được là `async`. `load()` không bao giờ
 *   ném (lỗi được ghi vào `error`), nên không có promise nào bị bỏ rơi mà không ai biết.
 */
export function useQuestsLifecycle(): void {
  const child = useActiveChild();
  const load = useQuestStore((s) => s.load);
  const reset = useQuestStore((s) => s.reset);

  useEffect(() => {
    if (child) {
      void load(child.id);
      return;
    }
    // Không còn bé nào đang chọn (đăng xuất, hoặc bố mẹ vừa xoá hồ sơ cuối cùng) ⇒ xoá khỏi bộ
    // nhớ. Để lại sẽ khiến bé kế tiếp thấy danh sách nhiệm vụ CỦA BÉ TRƯỚC trong tích tắc đầu.
    reset();
  }, [child, load, reset]);
}
