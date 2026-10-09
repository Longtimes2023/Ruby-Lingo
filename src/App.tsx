/**
 * RubyLingo — Thành phần gốc.
 *
 * Ba nhiệm vụ, theo đúng thứ tự quan trọng:
 *   1. Nạp phiên đăng nhập MỘT LẦN khi app khởi động.
 *   2. Bọc toàn bộ ứng dụng trong `ErrorBoundary` — lưới an toàn chống màn hình trắng.
 *   3. Giao lại cho router.
 *
 * ⭐ VÌ SAO NẠP PHIÊN Ở ĐÂY MÀ KHÔNG Ở TRONG GUARD:
 *   Guard chạy cho TỪNG nhánh route, nên nếu để nó tự nạp phiên thì mỗi lần điều hướng lại có
 *   thêm một chỗ gọi API. Ở đây chỉ có một lần cho cả app, và mọi guard chỉ việc ĐỌC trạng thái
 *   đã có.
 *
 * ⭐ VÌ SAO ĐỒNG BỘ TIẾN ĐỘ CŨNG BẬT Ở ĐÂY (`useSyncLifecycle`):
 *   Đồng bộ phải là MỘT tiến trình cho cả ứng dụng, không phải việc của từng màn hình. Nếu để
 *   mỗi màn hình tự bật, thì màn hình nào unmount trước sẽ tắt đồng bộ cho toàn bộ app — và
 *   triệu chứng là "tiến độ lúc đồng bộ được lúc không", tuỳ theo bé đi vòng qua màn hình nào.
 *   `useSyncLifecycle` tự chờ tới khi bé đã đăng nhập VÀ tiến độ đã nạp xong.
 *
 * ⭐ VÌ SAO ĐẶT LẠI VỊ TRÍ CUỘN CŨNG Ở ĐÂY (`useScrollResetOnNavigate`):
 *   Đây là việc của CẢ ứng dụng, không phải của từng màn hình — cùng lý do như trên. Nếu mỗi
 *   màn hình tự cuộn lên đầu, màn hình nào quên là màn hình đó mở ra ở lưng chừng (bị thanh trên
 *   che mất tiêu đề). Đặt ở một chỗ thì không màn hình nào quên được.
 *   Xem ghi chú đầu `useScrollResetOnNavigate.ts` — lỗi này đã được ĐO trên bản chạy thật.
 *
 * ⭐ VÌ SAO `ErrorBoundary` NẰM NGOÀI CÙNG, BÊN TRONG `BrowserRouter`:
 *   • Ngoài cùng, để bắt được cả lỗi của chính các guard và router — nếu đặt bên trong `Routes`,
 *     một lỗi trong guard sẽ không có gì bắt và vẫn ra màn hình trắng.
 *   • Bên trong `BrowserRouter`, để dùng được `useLocation()` cho `resetKeys`. Nhờ đó khi bé
 *     chuyển sang màn hình khác, boundary tự phục hồi thay vì nhốt bé trong màn hình lỗi mãi mãi.
 *
 * Vì sao cần một component `AppErrorBoundary` riêng để đọc `useLocation`: `ErrorBoundary` là
 * class component (React không có hook tương đương cho `componentDidCatch`), mà hook thì chỉ gọi
 * được trong function component. Nên phải có một lớp function component ở giữa để lấy `pathname`
 * rồi truyền xuống class.
 */

import { useLocation } from 'react-router-dom';

import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import { useScrollResetOnNavigate } from './hooks/useScrollResetOnNavigate.js';
import { useSessionBootstrap } from './hooks/useSession.js';
import { useSyncLifecycle } from './hooks/useSync.js';
import { AppRoutes } from './router.js';

export function App() {
  useSessionBootstrap();
  useSyncLifecycle();
  // SPA không tự đưa về đầu trang khi chuyển màn hình — xem ghi chú đầu hook này.
  useScrollResetOnNavigate();
  return <AppErrorBoundary />;
}

function AppErrorBoundary() {
  const location = useLocation();
  return (
    <ErrorBoundary
      // Đổi đường dẫn ⇒ xoá trạng thái lỗi và thử render lại. Không có dòng này, một lỗi ở
      // trang này sẽ theo bé sang mọi trang khác.
      resetKeys={[location.pathname]}
    >
      <AppRoutes />
    </ErrorBoundary>
  );
}
