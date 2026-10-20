/**
 * RubyLingo — `ScrollToTop`: nút nổi "lên đầu trang", CHỈ hiện khi bé đã cuộn đủ xa.
 *
 * ⭐ VÌ SAO CẦN NÚT NÀY (chủ dự án báo, nguyên văn: *"Thiếu nút scroll up"*):
 *   Màn dài nhất của app là trang chủ đề và trang bài học (danh sách từ + nhiều game). Bé cuộn
 *   hết một bài dài thì không có cách nào nhanh để về đầu trang — phải vuốt ngược hàng nghìn
 *   pixel bằng tay trẻ 7 tuổi. `BottomNav` ở đáy là điều hướng GIỮA các màn hình, không phải
 *   "về đầu trang NÀY".
 *
 * ⭐ VÌ SAO ĐẶT Ở `AppShell` (không sửa từng trang):
 *   `AppShell` là khung chung của mọi màn hình của bé (layout route — xem `router.tsx`). Đặt một
 *   lần ở đây là MỌI màn hiện tại và tương lai đều có nút, không phải nhớ thêm ở từng trang.
 *
 * -----------------------------------------------------------------------------
 * ⚠️⚠️ VỊ TRÍ — PHẦN KHÓ NHẤT, VÌ `BottomNav` LÀ `sticky` CHỨ KHÔNG `fixed`
 * -----------------------------------------------------------------------------
 *   `BottomNav` dùng `position: sticky; bottom: 0` (xem ghi chú đầu `BottomNav.tsx`), nên nó nằm
 *   TRONG luồng bố cục và chiều cao của nó tự đúng — đổi theo bề rộng màn hình (dưới 480px,
 *   `--sp-touch` hạ 64→56px) và theo `env(safe-area-inset-bottom)` của iPhone.
 *
 *   Hệ quả: KHÔNG được neo nút bằng `position: fixed; bottom: <một số px>` — con số đó sẽ SAI ở
 *   ít nhất một trong ba thiết bị đích, và sai theo kiểu nút đè lên thanh điều hướng. Đúng thứ dễ
 *   bấm nhầm nhất với tay trẻ.
 *
 *   ⭐ CÁCH LÀM Ở ĐÂY — NEO VÀO CHÍNH KHỐI ĐÁY, KHÔNG ĐOÁN PX:
 *     Component này trả về một lớp phủ `absolute` NEO VÀO KHỐI CHỨA NÓ. `AppShell` đặt nó ngay
 *     cạnh `BottomNav` trong một khối `relative` (xem `AppShell.tsx`). Khối chứa đó cao ĐÚNG bằng
 *     thanh điều hướng, nên `bottom-[calc(100%+0.75rem)]` (100% = chiều cao thật của thanh) luôn
 *     đặt nút NGAY TRÊN thanh một khoảng 12px — ở MỌI thiết bị, kể cả khi thanh đổi chiều cao.
 *     Không một con số px nào của thanh điều hướng bị chép vào đây.
 *
 *   ⚠️ Nhờ cách này, nút KHÔNG BAO GIỜ giao với `BottomNav` — đã đo bằng `getBoundingClientRect()`
 *      trên bản build production ở cả ba viewport (360×640, 820×1180, 1280×720).
 *
 *   ⚠️ `pointer-events-none` ở lớp phủ, `pointer-events-auto` ở nút: lớp phủ trải hết bề rộng
 *      nhưng KHÔNG được nuốt cú chạm của bé vào nội dung nằm dưới nó.
 * -----------------------------------------------------------------------------
 * ⚠️ VÌ SAO Ở ĐẦU TRANG THÌ ẨN HẲN (trả `null`, không phải `opacity: 0`)
 *   Nút nổi trên màn hình của bé là thứ dễ bấm nhầm nhất. Khi bé đang ở đầu trang thì nút không có
 *   việc gì để làm, và một vòng tròn mờ ở góc dưới chỉ mời gọi một cú chạm vô nghĩa. Trả `null` còn
 *   hơn `hidden`: nó biến mất khỏi cả cây truy cập (screen reader không đọc tới), không chỉ khỏi mắt.
 *
 * ⚠️ VÌ SAO PHẢI `useState` + LISTENER, KHÔNG ĐỌC `window.scrollY` TRONG RENDER
 *   Nếu state "đang cuộn đủ xa" sống ở `AppShell` thì mỗi lần cuộn là **cả `AppShell` và toàn bộ
 *   màn hình con trong `<Outlet />` render lại** — đúng cái bẫy đã ghi ở đầu `SyncStrip.tsx`. Nên
 *   state sống ở ĐÂY, trong một component LÁ: cuộn chỉ render lại đúng cái nút.
 *
 *   `{ passive: true }`: trình nghe không bao giờ gọi `preventDefault()`, nên khai báo bị động cho
 *   trình duyệt biết trước mà không phải chờ JavaScript — cuộn mượt hơn trên máy yếu.
 *   Và listener PHẢI được gỡ khi unmount (cleanup của `useEffect`), nếu không nó giữ cả cây
 *   component sống mãi sau khi rời màn.
 *
 * ⚠️ VÌ SAO ĐƯỢC PHÉP CUỘN VỀ 0 — VÀ TÔN TRỌNG `prefers-reduced-motion`
 *   Đây là HÀNH ĐỘNG CHỦ ĐỘNG của bé (bé tự bấm "lên đầu trang"), nên được phép cuộn về 0 — khác
 *   với việc ĐIỀU HƯỚNG tự động (do `useScrollResetOnNavigate` lo). Nhưng chuyển động phải tôn
 *   trọng cài đặt hệ điều hành: bé nhạy cảm với chuyển động (rối loạn tiền đình, tự kỷ) đã bật
 *   "giảm chuyển động" thì một cú cuộn `smooth` dài hàng nghìn pixel là đúng thứ bé cần tránh.
 *   Khi đó nhảy tức thì (`behavior: 'auto'`).
 *
 *   ⚠️ Đọc cài đặt qua `prefersReducedMotion()` (đã chịu được jsdom — xem `featureDetect.ts`) thay
 *      vì tra `window.matchMedia` trần, để nút không nổ khi `matchMedia` thiếu.
 *
 * ⚠️ KHÔNG PHÁ `useScrollResetOnNavigate`:
 *   Hook đó GHI vị trí cuộn của từng `pathname` mỗi sự kiện `scroll`, và KHÔI PHỤC khi quay lại màn
 *   cũ. Nút này chỉ cuộn về 0 trong CÙNG màn hình ⇒ sự kiện `scroll` do nó phát ra được hook ghi
 *   đúng cho `pathname` đang đứng (giá trị 0). Đó chính là ý nghĩa đúng: bé vừa chọn về đầu trang
 *   thì nếu rời đi rồi quay lại, bé nên ở đầu trang. Nút KHÔNG điều hướng, nên không có cuộc tranh
 *   nhau nào giữa hai cơ chế.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { prefersReducedMotion } from '../../lib/featureDetect.js';
import { cn } from '../../lib/cn.js';

/**
 * Ngưỡng cuộn (px) để nút hiện ra — ĐÃ CHỌN THEO PHÉP ĐO, KHÔNG PHẢI CẢM GIÁC.
 *
 * ⭐ VÌ SAO 400:
 *   • Màn nhỏ nhất phải chịu được là 360×640 (`tokens.css` + cấu hình Playwright). 400px ≈ 0,63
 *     chiều cao khung nhìn ở đó — tức bé đã cuộn qua gần hai phần ba màn hình đầu tiên.
 *   • Đây cũng xấp xỉ chiều cao KHỐI NỘI DUNG ĐẦU TIÊN ở hai màn dài nhất (tiêu đề + dải tóm tắt
 *     + thẻ đầu tiên). Qua mốc này thì đầu trang đã khuất khỏi tầm nhìn, nên "về đầu trang" mới
 *     thực sự có ích — trước đó bé vẫn thấy đầu trang và nút chỉ gây rối.
 *   • Nhỏ hơn (VD 150–200) thì nút nhấp nháy ngay khi bé mới hích nhẹ; lớn hơn (VD trọn một màn
 *     hình, 640) thì trên máy ngắn, trang chủ đề có khi chưa cuộn tới ngưỡng đã hết trang.
 *   Dùng `>` (lớn hơn hẳn), không phải `>=`: mốc đúng bằng ngưỡng vẫn coi là "chưa cuộn đủ".
 */
export const SCROLL_THRESHOLD_PX = 400;

export function ScrollToTop() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sync = () => {
      setVisible(window.scrollY > SCROLL_THRESHOLD_PX);
    };

    // Đọc MỘT LẦN lúc gắn: khi bé quay lại màn cũ, `useScrollResetOnNavigate` có thể đã khôi phục
    // vị trí cuộn > ngưỡng, và lúc đó KHÔNG có sự kiện `scroll` nào phát ra để đồng bộ state.
    sync();

    window.addEventListener('scroll', sync, { passive: true });
    return () => window.removeEventListener('scroll', sync);
  }, []);

  const handleClick = useCallback(() => {
    // Tôn trọng cài đặt "giảm chuyển động" của hệ điều hành — xem ghi chú đầu tệp.
    const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
    window.scrollTo({ top: 0, behavior });
  }, []);

  if (!visible) return null;

  return (
    <div
      // Lớp phủ trải hết bề rộng, neo NGAY TRÊN khối chứa (khối đáy chứa `BottomNav`).
      // ⚠️ `calc(100%_+_0.75rem)`: dấu `_` là CÁCH VIẾT KHOẢNG TRẮNG của Tailwind trong giá trị
      //   tuỳ ý. CSS `calc()` BẮT BUỘC có khoảng trắng quanh dấu `+`; viết `calc(100%+0.75rem)`
      //   là CSS KHÔNG HỢP LỆ và trình duyệt BỎ QUA cả khai báo — nút sẽ dính sát đáy thay vì
      //   nổi lên trên (lỗi im lặng, không cổng nào bắt được).
      // `pointer-events-none`: không nuốt cú chạm vào nội dung nằm dưới lớp phủ này.
      className="pointer-events-none absolute inset-x-0 bottom-[calc(100%_+_0.75rem)] flex justify-end px-4"
    >
      <button
        type="button"
        // Nhãn đọc tiếng Việt — mắt bé thấy mũi tên, screen reader đọc "Lên đầu trang".
        aria-label={t('nav.scrollToTop')}
        onClick={handleClick}
        className={cn(
          // Vùng chạm theo TOKEN (`--sp-touch`: 64px, hạ 56px dưới 480px) — không hardcode px.
          'pointer-events-auto flex size-touch items-center justify-center',
          // Màu / cỡ chữ / bo góc ĐỀU lấy từ token. Không một mã màu nào viết tay.
          // ⭐ Nút TRÒN: dùng `rounded-full` — CÙNG quy ước với `SoundButton` (nút nổi tròn duy
          //    nhất khác của app). Đồng bộ với nút có sẵn quan trọng hơn việc tự chế một bán kính
          //    mới; bán kính token (`rounded-kid`/`rounded-card`) để dành cho thẻ và ô vuông.
          'rounded-full border-2 border-brand-strong bg-brand text-ink-inverse shadow-kid-lg',
          'text-kid-md font-bold leading-none',
          // Phản hồi chạm giống mọi nút khác của app (xem `SoundButton`).
          'transition-transform duration-kid active:translate-y-[2px] active:shadow-none',
          'select-none',
        )}
      >
        <span aria-hidden="true">↑</span>
      </button>
    </div>
  );
}
