/**
 * RubyLingo — `SyncStrip`: dải nhỏ báo tiến độ CHƯA lên được server.
 *
 * ⭐ VÌ SAO LÀ MỘT DẢI RIÊNG, KHÔNG NHÉT VÀO `TopBar`:
 *   `TopBar` đã chật: trên điện thoại 360px, dãy số đếm (⭐ + 🌰 + nút âm thanh) vừa khít một
 *   dòng, và chính vì thế ❤️/🔥 đã phải ẩn dưới 480px (xem ghi chú đầu `TopBar.tsx`). Thêm một
 *   viên nữa vào đó là đẩy dãy số xuống dòng thứ hai và làm thanh trên cao thêm ~40px — đúng
 *   thứ vừa được sửa xong.
 *
 * ⭐ VÌ SAO TÁCH KHỎI `AppShell` THÀNH COMPONENT RIÊNG:
 *   `useSync()` đăng ký theo dõi `syncService`, nên mỗi lần trạng thái đồng bộ đổi là component
 *   dùng hook đó render lại. Nếu để `useSync()` ngay trong `AppShell`, mỗi lần đồng bộ xong là
 *   **cả `AppShell` và toàn bộ màn hình con bên trong `<Outlet />` render lại** — trong khi chỉ
 *   có một huy hiệu 40px cần đổi.
 *
 * ⚠️⚠️ CHỈ HIỆN KHI CÓ VIỆC CHƯA XONG, VÀ PHẢI CHỜ MỘT LÚC MỚI HIỆN.
 *
 *   Đây là phần dễ làm sai nhất, và bản đầu đã làm sai: hiện thẳng `status` ra thì thấy gì?
 *
 *     • `'synced'` — `SyncService` đặt trạng thái này sau mỗi lần đồng bộ thành công và KHÔNG
 *       bao giờ tự trả về `'idle'`. Hiện thẳng ⇒ huy hiệu "Đã đồng bộ" nằm vĩnh viễn trên mọi
 *       màn hình, chiếm một dải ~40px. Đã thấy đúng như vậy trên ảnh render thật.
 *
 *     • `'pending'` — trạng thái này bật lên sau MỖI câu trả lời của bé, kéo dài bằng thời gian
 *       gộp (`DEBOUNCE_MS` = 1,5 s) rồi tắt. Bé học 10 từ là huy hiệu nhấp nháy 10 lần.
 *
 *   Nên luật ở đây là: **chỉ hiện khi có hàng đợi thật sự chưa gửi được, và hàng đợi đó đã tồn
 *   tại lâu hơn một nhịp gộp bình thường.** Nhờ vậy:
 *     • Học bình thường có mạng  ⇒ không thấy gì (đúng: không có gì để nói).
 *     • Mất mạng, hàng đợi dồn lại ⇒ sau ~2,5 s hiện "Chưa đồng bộ được — sẽ thử lại".
 *     • Đồng bộ hỏng liên tục       ⇒ hiện ngay khi có hàng đợi.
 *     • Vừa thông mạng trở lại      ⇒ hàng đợi về 0, huy hiệu biến mất.
 *
 * ⚠️ ĐIỀU KIỆN HIỂN THỊ LÀ "CÒN HÀNG ĐỢI", KHÔNG PHẢI "TRẠNG THÁI KHÁC idle".
 *   Lý do: `pendingCount > 0` là SỰ THẬT về dữ liệu (có N thay đổi chưa lên server), còn
 *   `status` chỉ là bước của máy trạng thái. Một lần đồng bộ chậm vẫn đang ở `'syncing'` — nếu
 *   lọc theo trạng thái thì huy hiệu sẽ tắt đúng lúc phụ huynh cần biết nhất.
 */

import { useEffect, useState } from 'react';

import { useSync } from '../../hooks/useSync.js';
import { SyncBadge } from './SyncBadge.js';
import type { SyncStatus } from '../../services/SyncService.js';

/**
 * Thời gian hàng đợi phải tồn tại trước khi hiện huy hiệu, ms.
 *
 * Phải LỚN HƠN `DEBOUNCE_MS` (1,5 s) của `SyncService`, nếu không thì mỗi cú chạm của bé lại làm
 * huy hiệu nhấp nháy một lần. 2,5 s là mức an toàn: dài hơn một nhịp gộp, nhưng vẫn đủ nhanh để
 * phụ huynh biết ngay khi mạng có vấn đề.
 */
const APPEAR_DELAY_MS = 2500;

export function SyncStrip() {
  const { status, pendingCount } = useSync();
  const [visible, setVisible] = useState(false);

  const hasBacklog = status === 'failed' || pendingCount > 0;

  useEffect(() => {
    if (!hasBacklog) {
      // Hàng đợi đã trôi hết (hoặc đồng bộ vừa xong) ⇒ ẩn NGAY, không chờ.
      // Chờ thêm ở đây là giữ lại một lời cảnh báo đã hết đúng.
      setVisible(false);
      return;
    }

    // Còn hàng đợi: đợi một nhịp rồi mới hiện. Nếu hàng đợi trôi hết trước đó, cleanup huỷ
    // timer và huy hiệu không bao giờ hiện — đúng ý đồ, không phải trục trặc.
    const timer = window.setTimeout(() => setVisible(true), APPEAR_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [hasBacklog]);

  if (!visible) return null;

  /**
   * ⚠️ KHÔNG TRUYỀN THẲNG `status` XUỐNG HUY HIỆU — CÓ MỘT TRƯỜNG HỢP NÓ NÓI SAI.
   *
   *   `SyncService` đặt `'synced'` ngay sau khi một lô gửi xong, RỒI mới đếm lại hàng đợi. Nếu
   *   bé trả lời thêm trong lúc request đang bay, lô đó nằm lại trong hàng đợi — và ta có
   *   `status === 'synced'` cùng `pendingCount > 0`. Truyền thẳng xuống thì huy hiệu hiện
   *   "✅ Đã đồng bộ" trong khi thực tế còn 3 thay đổi chưa lên server. Đúng kiểu câu trấn an sai
   *   chỗ: phụ huynh mở máy khác, thấy thiếu tiến độ, và lần sau không tin huy hiệu nữa.
   *
   *   Quy về hai giá trị có nghĩa với người đọc: hỏng thì nói hỏng, còn lại thì nói "đang chờ".
   */
  const badgeStatus: SyncStatus = status === 'failed' ? 'failed' : 'pending';

  return (
    <div className="mx-auto flex w-full max-w-[880px] justify-end px-4 pt-2">
      <SyncBadge status={badgeStatus} pendingCount={pendingCount} />
    </div>
  );
}
