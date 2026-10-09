/**
 * RubyLingo — Guard định tuyến: quyết định ai được vào màn hình nào.
 *
 * ⭐ VÌ SAO TẬP TRUNG Ở ĐÂY, KHÔNG KIỂM TRONG TỪNG TRANG:
 *   Kiểm quyền trong từng trang nghĩa là mỗi trang mới thêm vào lại có một cơ hội để quên.
 *   Guard là một chỗ duy nhất, và nó chạy TRƯỚC khi trang được render — nên trang không bao
 *   giờ phải tự hỏi "đã đăng nhập chưa".
 *
 * ⚠️ ĐÂY LÀ RÀO CẢN GIAO DIỆN, KHÔNG PHẢI RÀO CẢN BẢO MẬT.
 *   Người dùng có thể sửa JavaScript trong trình duyệt để qua mặt guard này. Bảo mật thật
 *   nằm ở server: mọi endpoint đều kiểm phiên (`requireParent`) và kiểm quyền sở hữu
 *   (`parent_id` trong từng truy vấn của `ChildService`). Guard ở đây chỉ để trải nghiệm
 *   không gãy — không được dựa vào nó để bảo vệ dữ liệu.
 */

import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { BrandLogo } from '../components/BrandLogo.js';
import { useSessionStore } from '../store/sessionStore.js';

/** Đường dẫn hợp lý nhất cho một phụ huynh đã đăng nhập. */
function useHomePath(): string {
  const childCount = useSessionStore((s) => s.children.length);
  return childCount > 0 ? '/' : '/children/new';
}

/**
 * Màn hình chờ khi CHƯA BIẾT đã đăng nhập chưa.
 *
 * Vì sao không đưa thẳng về trang đăng nhập: lúc mới tải trang ta chưa hỏi xong server. Nếu
 * coi "chưa biết" là "chưa đăng nhập", mỗi lần F5 người dùng thấy trang đăng nhập nháy lên
 * rồi mới được đưa vào — rất khó chịu, và với bé thì dễ tưởng là bị đăng xuất.
 */
function LoadingScreen() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-4 p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <BrandLogo size={80} decorative />
      <p className="text-kid-md text-ink-soft">Đang mở Nhà Vườn Thú...</p>
    </main>
  );
}

/** Chỉ phụ huynh đã đăng nhập. Chưa đăng nhập ⇒ về trang đăng nhập, nhớ nơi vừa định vào. */
export function RequireParent() {
  const status = useSessionStore((s) => s.status);
  const location = useLocation();

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'anonymous') {
    // `state.from` để sau khi đăng nhập xong quay lại đúng chỗ đang muốn vào.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

/** Cần đã đăng nhập VÀ đã chọn được bé. Chưa có bé nào ⇒ sang màn hình tạo hồ sơ. */
export function RequireChild() {
  const status = useSessionStore((s) => s.status);
  const activeChildId = useSessionStore((s) => s.activeChildId);

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'anonymous') return <Navigate to="/login" replace />;
  if (!activeChildId) return <Navigate to="/children/new" replace />;
  return <Outlet />;
}

/** Dùng cho trang đăng nhập/đăng ký: đã đăng nhập rồi thì không cần xem lại. */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const status = useSessionStore((s) => s.status);
  const home = useHomePath();

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'authenticated') return <Navigate to={home} replace />;
  return <>{children}</>;
}
