/**
 * RubyLingo — đặt lại / KHÔI PHỤC vị trí cuộn mỗi khi chuyển màn hình.
 *
 * ⚠️⚠️ PHẦN "ĐẶT LẠI" LÀ BẢN SỬA CHO MỘT LỖI CÓ THẬT, ĐÃ ĐO ĐƯỢC — ĐỌC TRƯỚC KHI XOÁ:
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
 * ⚠️ VÌ SAO `useLayoutEffect` CHỨ KHÔNG PHẢI `useEffect`:
 *   `useEffect` chạy SAU khi trình duyệt đã vẽ. Bé sẽ thấy màn hình mới hiện ra ở lưng chừng
 *   rồi GIẬT lên đầu trang — một cú nhảy nhìn thấy được, đúng kiểu "app bị lỗi".
 *   `useLayoutEffect` chạy trước khi vẽ, nên bé chỉ thấy màn hình mới ở đúng vị trí cuối cùng.
 *   (Cùng lý do đã ghi ở ghi chú `LoadingScreen` trong `guards.tsx` về việc tránh nháy.)
 *
 * ⚠️ VÌ SAO ÉP `scrollRestoration = 'manual'`:
 *   Chrome/Firefox có cơ chế tự khôi phục vị trí cuộn (nhất là khi bấm Back). Nếu để nguyên,
 *   HAI cơ chế cùng tranh nhau: ta cuộn về 0, rồi trình duyệt khôi phục về chỗ cũ — kết quả
 *   phụ thuộc thứ tự và thời điểm, tức là lúc đúng lúc sai. Phải tắt hẳn cơ chế của trình duyệt
 *   để chỉ còn MỘT nguồn quyết định.
 *
 * -----------------------------------------------------------------------------
 * ⭐⭐ PHẦN "KHÔI PHỤC" — THÊM 2026-10-14 (mục 5, chủ dự án báo) — KHÔNG MÂU THUẪN VỚI PHẦN TRÊN
 * -----------------------------------------------------------------------------
 *   Nguyên văn: *"Khi bé đang ở khu vực các bài học, thì khi chơi xong 1 game thì lại tự động
 *   quay lại đầu trang chứ không phải vẫn neo ở chính chỗ thao tác thời điểm đó."*
 *
 *   ⚠️ ĐÂY LÀ HAI VIỆC KHÁC NHAU, ĐỪNG GỘP:
 *     • ĐI TỚI một màn hình CHƯA XEM  ⇒ về đầu trang. (Bản sửa gốc ở trên; bỏ đi là lỗi "tiêu
 *       đề game bị thanh trên che" quay lại.)
 *     • QUAY LẠI một màn hình ĐÃ XEM ⇒ trả bé về ĐÚNG chỗ bé rời đi. (Việc mới.)
 *   Bản cũ làm việc thứ hai bằng việc thứ nhất, nên bé rời bài 5 rồi quay lại thì bị ném về đầu
 *   trang chủ đề và phải cuộn lại từ đầu — mỗi lượt chơi một lần.
 *
 *   ⭐ VÌ SAO GHI NHỚ THEO TỪNG `pathname` (chứ không một biến "vị trí trước đó"):
 *     Bé có thể đi A → B → A → B. Một biến đơn chỉ nhớ được MỘT chỗ và sẽ trả bé về vị trí của
 *     màn hình kia. Khoá theo `pathname` thì mỗi màn hình giữ vị trí của CHÍNH NÓ.
 *
 *   ⚠️ VÌ SAO NGHE SỰ KIỆN `scroll` (chứ không đọc `window.scrollY` lúc điều hướng):
 *     Tới lúc hiệu ứng chạy cho `pathname` mới thì DOM đã là màn hình MỚI và trình duyệt đã kẹp
 *     lại vị trí cuộn — đọc lúc đó là đọc số của màn mới rồi gán cho màn cũ. Nghe `scroll` thì
 *     mỗi lần bé cuộn, con số được ghi ngay dưới ĐÚNG `pathname` đang đứng.
 *
 *   ⚠️ `Map.get()` trả `undefined` = "chưa từng xem màn này" — phân biệt với `0` = "đã xem và
 *     đang ở đầu trang". Hai ca cho cùng kết quả cuộn, nhưng tách ra thì đọc mã là hiểu ý định,
 *     và sau này nếu chỉ một trong hai ca cần đổi hành vi thì không phải đoán.
 *
 * ⚠️ VÌ SAO KHÔNG DÙNG `<ScrollRestoration>` CỦA REACT ROUTER:
 *   Component đó chỉ có ở "data router" (`createBrowserRouter`). Dự án đang dùng
 *   `<BrowserRouter>` + `<Routes>` (xem `main.tsx`), và đổi sang data router là một cuộc thay
 *   đổi kiến trúc định tuyến — không cần thiết cho một việc vài dòng.
 *
 * ⚠️ VÌ SAO KHÔNG ĐẶT LẠI KHI CHỈ ĐỔI QUERY (`?tab=...`):
 *   Khoá theo `pathname`. Đổi query nghĩa là vẫn ở cùng màn hình (VD lọc danh sách), và cuộn
 *   về đầu trong trường hợp đó sẽ làm bé mất chỗ đang xem.
 */

import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Vị trí cuộn đã thấy của từng `pathname`.
 *
 * ⚠️ Cấp MODULE (không phải `useRef`) là CỐ Ý: hook được gọi ở gốc ứng dụng, nhưng nếu nó bị
 *    gỡ rồi gắn lại giữa hai lượt điều hướng (VD `StrictMode` gỡ-gắn hai lần trong dev) thì
 *    `useRef` sẽ mất sạch ký ức và bé lại bị ném về đầu trang. Ký ức này là thứ sống lâu hơn
 *    vòng đời component — nó thuộc về PHIÊN ĐIỀU HƯỚNG, không thuộc về một lần render.
 */
const scrollPositionsByPath = new Map<string, number>();

export function useScrollResetOnNavigate(): void {
  const { pathname } = useLocation();

  /** `pathname` đang đứng — để trình nghe `scroll` ghi đúng chỗ mà không phải gắn lại mỗi lần đổi. */
  const currentPathRef = useRef(pathname);

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

  /**
   * GHI NHỚ vị trí cuộn của màn hình đang đứng, mỗi lần bé cuộn.
   *
   * `{ passive: true }`: trình nghe này KHÔNG bao giờ gọi `preventDefault()`, nên khai báo bị
   * động cho trình duyệt biết trước — cuộn không phải chờ JavaScript chạy xong.
   */
  useLayoutEffect(() => {
    const remember = () => {
      scrollPositionsByPath.set(currentPathRef.current, window.scrollY);
    };

    window.addEventListener('scroll', remember, { passive: true });
    return () => window.removeEventListener('scroll', remember);
  }, []);

  useLayoutEffect(() => {
    const seen = scrollPositionsByPath.get(pathname);

    // Chưa từng xem màn này ⇒ về đầu trang (giữ nguyên bản sửa gốc: tiêu đề không bị thanh trên che).
    // Đã xem rồi ⇒ trả bé về đúng chỗ bé rời đi (mục 5).
    window.scrollTo(0, seen ?? 0);

    // ⚠️ Gán SAU lệnh cuộn: từ đây trở đi, mọi sự kiện `scroll` phải được ghi cho màn MỚI.
    currentPathRef.current = pathname;
  }, [pathname]);
}
