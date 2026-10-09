/**
 * RubyLingo — Hook cho cửa hàng: mua, cho ăn, mặc / bỏ ra.
 *
 * ⚠️⚠️ HAI HOOK, HAI NHIỆM VỤ KHÁC NHAU — ĐỪNG GỘP. Cùng lý do đã áp dụng cho
 *   `useProgress`/`useProgressLifecycle`, `useRewards`/`useRewardsLifecycle` và
 *   `useQuests`/`useQuestsLifecycle` (xem ghi chú đầu các tệp đó):
 *   • `useShopLifecycle()` — chỉ XOÁ trạng thái hành động. Gọi MỘT LẦN ở `AppShell`.
 *   • `useShop()`          — ĐỌC trạng thái + gọi hành động. Gọi ở màn hình Cửa hàng.
 *
 * ⭐ VÌ SAO `useShop()` KHÔNG TỰ NẠP GÌ CẢ (khác `useQuestStore.load`):
 *   Cửa hàng không có "danh sách của server" để nạp. Danh mục vật phẩm là một tệp tĩnh dùng chung
 *   (`@shared/content/shop.js`) mà component `import` thẳng — không tốn một vòng mạng nào. Còn ví
 *   ⭐🌰 và túi đồ đã được `useRewardsLifecycle()` nạp sẵn ở `AppShell` cho MỌI màn hình. Thêm một
 *   lần nạp nữa ở đây chỉ tạo ra request thừa và một trạng thái "đang tải" thứ hai có thể lệch với
 *   trạng thái của `rewardStore`.
 *
 * ⚠️ `useShopLifecycle()` GỌI Ở `AppShell`, KHÔNG Ở `PetHousePage` — VÀ ĐÂY LÀ MỘT CÁI BẪY THẬT:
 *   `useEffect` chạy lại mỗi lần component ĐƯỢC GẮN vào, kể cả khi tham số phụ thuộc KHÔNG đổi.
 *   Đặt hook này ở màn hình Cửa hàng nghĩa là mỗi lần bé rời màn hình rồi quay lại, thông báo
 *   "Bé vừa mua được Nón xinh!" vừa hiện sẽ bị xoá sạch — đúng thứ mà việc để nó trong store sinh
 *   ra để tránh. Ở `AppShell` (layout route, chỉ gắn một lần cho cả phiên) thì việc xoá chỉ xảy ra
 *   đúng khi bố mẹ ĐỔI BÉ, tức đúng lúc cần.
 */

import { useCallback, useEffect } from 'react';

import type { ShopNotice } from '../store/shopStore.js';
import { useShopStore } from '../store/shopStore.js';
import { useActiveChild } from '../store/sessionStore.js';

export interface UseShopResult {
  /** Bé bấm "Mua". Nhận `itemId`; không bao giờ ném. */
  buy: (itemId: string) => Promise<void>;
  /** Bé bấm "Cho ăn". Nhận `itemId`; không bao giờ ném. */
  feed: (itemId: string) => Promise<void>;
  /** Bé bấm "Dùng ngay" / "Bỏ ra". `equipped` là TRẠNG THÁI ĐÍCH, không phải lệnh đảo. */
  equip: (itemId: string, equipped: boolean) => Promise<void>;
  /** Món này đang gửi yêu cầu MUA? (để làm mờ nút + hiện vòng xoay). */
  isBuying: (itemId: string) => boolean;
  /** Món này đang gửi yêu cầu CHO ĂN? */
  isFeeding: (itemId: string) => boolean;
  /** Món này đang gửi yêu cầu MẶC / BỎ RA? */
  isEquipping: (itemId: string) => boolean;
  /** Kết quả hành động gần nhất để ăn mừng / báo nhẹ; `null` = không có gì. */
  lastNotice: ShopNotice | null;
  /** Đóng thông báo. */
  dismissNotice: () => void;
  /**
   * Lỗi KỸ THUẬT của lần gần nhất. **KHÔNG hiển thị cho bé** — xem ghi chú đầu `shopStore`.
   * Chỗ gọi chỉ nên dùng nó để quyết định có hiện nút "Thử lại" hay không.
   */
  error: string | null;
}

/**
 * Đọc trạng thái cửa hàng + ba hành động.
 *
 * ⭐ VÌ SAO TRẢ HÀM `isBuying(itemId)` THAY VÌ CẢ MAP `buying`:
 *   Cả map làm MỌI thẻ vật phẩm render lại mỗi khi BẤT KỲ món nào bắt đầu/kết thúc gửi — kể cả
 *   những thẻ không liên quan. Hàm tra cứu giữ chỗ gọi không phải biết hình dạng của map, và khi
 *   nào cần tối ưu thì chỉ phải sửa ở đúng một nơi. Cùng lý do đã dùng cho `useClaimQuest`.
 *
 * ⚠️ TÊN HÀM TRÙNG VỚI TÊN TRƯỜNG TRẠNG THÁI (`buy`), và đó là chủ ý: chỗ gọi đọc
 *    `shop.buy(item.id)` chứ không phải `shop.buyAction(...)`. Tên dài chỉ để tránh một sự trùng
 *    lặp nội bộ của hook, không giúp gì người đọc màn hình.
 */
export function useShop(): UseShopResult {
  const child = useActiveChild();
  const childId = child?.id ?? null;

  const buyInStore = useShopStore((s) => s.buy);
  const feedInStore = useShopStore((s) => s.feed);
  const equipInStore = useShopStore((s) => s.equip);
  const buying = useShopStore((s) => s.buying);
  const feeding = useShopStore((s) => s.feeding);
  const equipping = useShopStore((s) => s.equipping);
  const lastNotice = useShopStore((s) => s.lastNotice);
  const dismissNotice = useShopStore((s) => s.dismissNotice);
  const error = useShopStore((s) => s.error);

  // Không có bé đang chọn ⇒ không có gì để mua. Trả promise đã xong thay vì ném: chỗ gọi là một
  // `onClick`, ném ở đó chỉ tạo ra một promise bị bỏ rơi. Cùng khuôn mẫu với `useClaimQuest`.
  const buy = useCallback(
    (itemId: string): Promise<void> =>
      childId ? buyInStore(childId, itemId) : Promise.resolve(),
    [childId, buyInStore],
  );

  const feed = useCallback(
    (itemId: string): Promise<void> =>
      childId ? feedInStore(childId, itemId) : Promise.resolve(),
    [childId, feedInStore],
  );

  const equip = useCallback(
    (itemId: string, equipped: boolean): Promise<void> =>
      childId ? equipInStore(childId, itemId, equipped) : Promise.resolve(),
    [childId, equipInStore],
  );

  const isBuying = useCallback((itemId: string) => Boolean(buying[itemId]), [buying]);
  const isFeeding = useCallback((itemId: string) => Boolean(feeding[itemId]), [feeding]);
  const isEquipping = useCallback((itemId: string) => Boolean(equipping[itemId]), [equipping]);

  return {
    buy,
    feed,
    equip,
    isBuying,
    isFeeding,
    isEquipping,
    lastNotice,
    dismissNotice,
    error,
  };
}

/**
 * Xoá trạng thái hành động của cửa hàng khi bé đang chọn thay đổi. **Gọi MỘT LẦN ở `AppShell`**.
 *
 * ⚠️ VÌ SAO PHẢI XOÁ, KHÔNG CHỈ ĐỂ ĐÓ:
 *   Cờ "đang mua" mà còn sót lại sẽ làm nút của bé MỚI mờ vĩnh viễn ở đúng một món — bé bấm không
 *   có gì xảy ra và không cách nào hiểu vì sao. Còn thông báo sót lại ("Momo ăn ngon quá!") là một
 *   câu nói về linh vật của bé CŨ, hiện lên cho bé MỚI — cùng loại lỗi mà `rewardStore.load` đã
 *   chặn bằng cách xoá dữ liệu bé cũ trước khi chờ mạng.
 *
 * ⚠️ KHÔNG `await`, KHÔNG trả gì: `reset()` chỉ ghi vào store. Một hiệu ứng của React không được
 *    là `async`, và không có promise nào ở đây để bỏ rơi.
 */
export function useShopLifecycle(): void {
  const child = useActiveChild();
  const reset = useShopStore((s) => s.reset);

  useEffect(() => {
    /**
     * Phụ thuộc `child?.id` — một CHUỖI, không phải object `child`.
     *
     *   `useActiveChild()` trả về phần tử trong `sessionStore.children`, nên tham chiếu của nó ổn
     *   định chừng nào danh sách và bé đang chọn chưa đổi; `[child]` vì thế cũng chạy đúng. Dùng
     *   `child?.id` để điều kiện chạy lại gắn chặt với ĐÚNG thứ mà việc xoá này nói tới — danh
     *   tính của bé. Một object mới nhưng cùng `id` (ví dụ biệt danh vừa được sửa) KHÔNG phải là
     *   lý do để xoá thông báo bé đang đọc.
     */
    reset();
  }, [child?.id, reset]);
}
