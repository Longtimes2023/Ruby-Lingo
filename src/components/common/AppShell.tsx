/**
 * RubyLingo — `AppShell`: khung chung cho mọi màn hình của bé.
 *
 * ⭐ BỐ CỤC: MỘT CỘT FLEX, KHÔNG CÓ PHÉP TÍNH PADDING NÀO.
 *   `TopBar` và `BottomNav` đều dùng `position: sticky` (xem ghi chú đầu `TopBar.tsx`), nên cả
 *   hai nằm TRONG luồng bố cục và chiều cao của chúng tự đúng. Nhờ vậy file này không cần biết
 *   thanh trên cao bao nhiêu px, cũng không cần đo bằng JavaScript.
 *
 *   Hệ quả thực tế: khi dãy số đếm xuống dòng trên điện thoại 360px, hoặc khi biệt danh của bé
 *   dài tới mức bị cắt, bố cục vẫn đúng — không có nội dung nào bị thanh trên che mất.
 *
 * ⭐ `min-h-[100dvh]` — VÌ SAO KHÔNG DÙNG `100vh`:
 *   Trên Safari/iOS, `100vh` tính cả phần bị thanh địa chỉ động che ⇒ trang LUÔN cao hơn màn
 *   hình một đoạn, và thanh điều hướng ở đáy bị đẩy xuống dưới tầm nhìn. `dvh` (dynamic viewport
 *   height) co giãn theo thanh địa chỉ thật. Đặt qua `style` để trình duyệt cũ (không hiểu `dvh`)
 *   tự bỏ qua và rơi về `min-h-screen` của class — nâng cấp dần, không cần dò tính năng.
 *
 * ⭐ VÌ SAO ĐÂY LÀ LAYOUT ROUTE (render `<Outlet />`):
 *   React Router v6 cho phép một route chỉ đóng vai trò khung, còn nội dung do các route con
 *   quyết định. Nhờ vậy khung chỉ được dựng MỘT LẦN và KHÔNG bị tháo ra lắp lại khi bé chuyển
 *   màn hình — thanh trên cùng không nhấp nháy, và trạng thái cuộn của khung được giữ nguyên.
 */

import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import { useChildStatus } from '../../hooks/useChildStatus.js';
import { useProgressLifecycle } from '../../hooks/useProgress.js';
import { useRewardsLifecycle } from '../../hooks/useRewards.js';
import { useShopLifecycle } from '../../hooks/useShop.js';
import { useActiveChild, useSessionStore } from '../../store/sessionStore.js';
import { BottomNav } from './BottomNav.js';
import { ChildSwitcherDialog } from './ChildSwitcherDialog.js';
import { SoundButton } from './SoundButton.js';
import { SyncStrip } from './SyncStrip.js';
import { TopBar } from './TopBar.js';

export function AppShell() {
  const child = useActiveChild();
  const childCount = useSessionStore((s) => s.children.length);
  const { status } = useChildStatus();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  /**
   * ⭐ NẠP TIẾN ĐỘ Ở ĐÂY, KHÔNG Ở TỪNG MÀN HÌNH.
   *
   *   `AppShell` nằm trong `RequireChild` (chắc chắn đã có bé) và chỉ được dựng MỘT LẦN cho cả
   *   phiên (là layout route — xem `router.tsx`). Nạp ở đây nghĩa là mọi màn hình con đều có
   *   tiến độ mà không phải tự lo, kể cả màn hình chỉ ĐỌC mà không ghi (bản đồ hành trình).
   *
   *   Nếu để việc nạp nằm trong `useProgress()` như trước, tiến độ chỉ được nạp khi có một màn
   *   hình tình cờ dùng hook đó — và bản đồ sẽ hiện toàn số 0 cho tới khi bé mở một màn hình
   *   khác. Lỗi im lặng, không ai phát hiện khi duyệt bằng mắt.
   */
  useProgressLifecycle();

  /**
   * ⭐ NẠP VÍ ⭐🌰 / XP / LINH VẬT — CÙNG CHỖ VÀ CÙNG LÝ DO NHƯ TIẾN ĐỘ Ở TRÊN.
   *
   *   `useChildStatus()` (ngay dưới) đọc số từ `rewardStore`. Nếu việc nạp không nằm ở đây,
   *   thanh trên cùng sẽ hiện dấu "—" cho tới khi có một màn hình tình cờ dùng `useRewards()`.
   *   `AppShell` nằm ở MỌI màn hình của bé và chỉ được dựng một lần cho cả phiên, nên đây là
   *   chỗ đúng về vòng đời.
   */
  useRewardsLifecycle();

  /**
   * ⭐ XOÁ TRẠNG THÁI HÀNH ĐỘNG CỦA CỬA HÀNG KHI ĐỔI BÉ — và ở ĐÂY, không ở màn hình Cửa hàng.
   *
   *   Hook này chỉ làm một việc: khi bé đang chọn đổi, xoá cờ "đang mua" và thông báo còn sót
   *   (`shopStore.reset`). Đặt ở `AppShell` vì `useEffect` chạy lại mỗi lần component được gắn
   *   vào — ở màn hình Cửa hàng, điều đó nghĩa là mỗi lần bé quay lại màn hình, thông báo vừa hiện
   *   lại bị xoá. Xem ghi chú đầy đủ ở `useShopLifecycle`.
   *
   *   Không có việc NẠP nào ở đây: ví và túi đồ đã do `useRewardsLifecycle()` ngay trên lo, còn
   *   danh mục vật phẩm là tệp tĩnh mà màn hình `import` thẳng.
   */
  useShopLifecycle();

  // Phòng thủ: `AppShell` chỉ được dùng bên trong `RequireChild`, nên nhánh này không nên xảy ra.
  // Nhưng nếu có ai đó lỡ đặt nó sai chỗ, trả về `null` sẽ cho ra một màn hình trắng không dấu
  // vết — tệ hơn nhiều so với việc chỉ render nội dung mà không có khung.
  if (!child) return <Outlet />;

  return (
    <div className="flex min-h-screen flex-col bg-surface-sunken" style={{ minHeight: '100dvh' }}>
      <TopBar
        child={child}
        status={status}
        // Chỉ cho bấm khi thật sự có gì để đổi — xem ghi chú đầu `ChildSwitcherDialog`.
        onIdentityClick={childCount > 1 ? () => setSwitcherOpen(true) : undefined}
        // Nút Hồ sơ nhà thám hiểm (M13). Điểm vào ở đây vì `BottomNav` đã đủ 5 mục (trần của dự
        // án) — xem chú thích `profileTo` trong `TopBar.tsx`.
        profileTo="/profile"
        // Nút âm thanh nằm TRONG thanh trên cùng, không nổi ở góc — nếu nổi, nó đè lên số ⭐.
        // Cỡ `sm` (44px) để không ép hàng số đếm cao thêm — xem ghi chú ở `SoundButton`.
        trailing={<SoundButton floating={false} size="sm" />}
      />

      {/* Chỉ chiếm chỗ khi thật sự có việc để nói — xem ghi chú đầu `SyncStrip.tsx`. */}
      <SyncStrip />

      <main className="mx-auto w-full max-w-[880px] flex-1 px-4 py-5">
        <Outlet />
      </main>

      <BottomNav />

      <ChildSwitcherDialog open={switcherOpen} onOpenChange={setSwitcherOpen} />
    </div>
  );
}
