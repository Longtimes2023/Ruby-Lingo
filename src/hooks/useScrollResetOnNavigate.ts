/**
 * RubyLingo — đặt lại vị trí cuộn mỗi khi chuyển màn hình.
 *
 * ⚠️⚠️ ĐÂY LÀ BẢN SỬA CHO MỘT LỖI CÓ THẬT, ĐÃ ĐO ĐƯỢC — ĐỌC TRƯỚC KHI XOÁ:
 *
 *   Ứng dụng là SPA: chuyển màn hình KHÔNG nạp lại trang, nên trình duyệt KHÔNG tự đưa về đầu
 *   trang. Nếu không ai làm việc đó, màn hình mới mở ra ở đúng vị trí cuộn của màn hình CŨ.
 *
 *   Đo trên bản chạy thật (360×780, chủ đề `at-the-zoo`):
 *     • trang chủ đề cao 1445px, bé cuộn xuống 665px để tới bài 3;
 *     • bé bấm "Nghe & Chạm" của bài 3;
 *     • màn hình game mở ra với `scrollY = 38`;
 *     • tiêu đề game nằm ở `top = 49` trong khi thanh trên cùng chiếm tới `67`
 *       ⇒ **tiêu đề game bị thanh trên che mất**.
 *
 *   ⭐ VÌ SAO LỖI NÀY MÃI KHÔNG AI THẤY, VÀ VÌ SAO NÓ VỪA LỘ RA:
 *     Trình duyệt KẸP vị trí cuộn vào chiều cao thật của trang mới. Mọi màn hình trước đây
 *     (bản đồ, chủ đề, thẻ từ) đều THẤP HƠN khung nhìn ⇒ vị trí cuộn thừa hưởng bị kẹp về 0,
 *     và lỗi tự che mình. Màn hình chơi game là màn hình ĐẦU TIÊN cao hơn khung nhìn (818px so
 *     với 780px), nên nó là màn hình đầu tiên có đủ 38px đất để lộ lỗi ra.
 *     ⇒ Mọi màn hình dài thêm trong tương lai sẽ lộ lỗi này. Sửa ở gốc, không sửa ở màn hình.
 *
 *   ⭐ VÌ SAO `useLayoutEffect` CHỨ KHÔNG PHẢI `useEffect`:
 *     `useEffect` chạy SAU khi trình duyệt đã vẽ. Bé sẽ thấy màn hình mới hiện ra ở lưng chừng
 *     rồi GIẬT lên đầu trang — một cú nhảy nhìn thấy được, đúng kiểu "app bị lỗi".
 *     `useLayoutEffect` chạy trước khi vẽ, nên bé chỉ thấy màn hình mới ở đầu trang.
 *     (Cùng lý do đã ghi ở ghi chú `LoadingScreen` trong `guards.tsx` về việc tránh nháy.)
 *
 *   ⭐ VÌ SAO ÉP `scrollRestoration = 'manual'`:
 *     Chrome/Firefox có cơ chế tự khôi phục vị trí cuộn (nhất là khi bấm Back). Nếu để nguyên,
 *     HAI cơ chế cùng tranh nhau: ta cuộn về 0, rồi trình duyệt khôi phục về chỗ cũ — kết quả
 *     phụ thuộc thứ tự và thời điểm, tức là lúc đúng lúc sai. Phải tắt hẳn cơ chế của trình duyệt
 *     để chỉ còn MỘT nguồn quyết định.
 *
 * ⚠️ VÌ SAO KHÔNG DÙNG `<ScrollRestoration>` CỦA REACT ROUTER:
 *   Component đó chỉ có ở "data router" (`createBrowserRouter`). Dự án đang dùng
 *   `<BrowserRouter>` + `<Routes>` (xem `main.tsx`), và đổi sang data router là một cuộc thay
 *   đổi kiến trúc định tuyến — không cần thiết cho một việc 5 dòng.
 *
 * ⚠️ VÌ SAO KHÔNG ĐẶT LẠI KHI CHỈ ĐỔI QUERY (`?tab=...`):
 *   Khoá theo `pathname`. Đổi query nghĩa là vẫn ở cùng màn hình (VD lọc danh sách), và cuộn
 *   về đầu trong trường hợp đó sẽ làm bé mất chỗ đang xem.
 */

import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useScrollResetOnNavigate(): void {
  const { pathname } = useLocation();

  /**
   * Tắt cơ chế khôi phục của trình duyệt — xem ghi chú "VÌ SAO ÉP scrollRestoration" ở trên.
   *
   * `if ('scrollRestoration' in window.history)` là cần thiết: Safari cũ và một số trình duyệt
   * nhúng không có thuộc tính này, và gán vào nó chỉ tạo ra một thuộc tính vô nghĩa.
   */
  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
}
