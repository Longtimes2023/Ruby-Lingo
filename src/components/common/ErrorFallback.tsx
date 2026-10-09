/**
 * RubyLingo — `ErrorFallback`: màn hình hiện khi `ErrorBoundary` bắt được lỗi.
 *
 * ⭐ VÌ SAO TÁCH KHỎI `ErrorBoundary.tsx`:
 *   `ErrorBoundary` là CLASS component — đây là ngoại lệ bắt buộc của React, vì
 *   `componentDidCatch` chưa có bản hook tương đương. Trộn một class với một function component
 *   trong cùng một file làm tính năng fast-refresh của Vite mất tác dụng (mỗi lần sửa, cả trang
 *   bị tải lại và mất trạng thái đang thử). Tách ra thì cả hai file đều chỉ có MỘT component.
 *
 * ⭐ BA ĐIỀU CÂU CHỮ Ở ĐÂY PHẢI LÀM ĐƯỢC:
 *   1. Nói rõ lỗi KHÔNG PHẢI DO BÉ — nếu không bé sẽ tự trách mình.
 *   2. Khẳng định tiến độ KHÔNG MẤT — đây là lo lắng lớn nhất của cả bé và phụ huynh.
 *   3. Chỉ cho MỘT hành động rõ ràng. Ba nút khác nhau khiến người đang bối rối chọn sai.
 *
 * Chi tiết kỹ thuật của lỗi chỉ hiện ở chế độ phát triển, và luôn nằm trong khối có thể bôi đen
 * chọn chữ để phụ huynh copy gửi đi.
 */

import { BrandLogo } from '../BrandLogo.js';

export interface ErrorFallbackProps {
  error: Error;
  /** Thử render lại mà không tải lại trang. */
  onRetry: () => void;
}

export function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  return (
    <main
      // `role="alert"` để trình đọc màn hình đọc ngay khi màn hình này xuất hiện — người dùng
      // khiếm thị cần biết ngay rằng thứ họ đang chờ đã không tới.
      role="alert"
      className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <BrandLogo size={80} decorative />

      <h1 className="text-kid-xl text-ink">Ôi, có gì đó chưa ổn</h1>

      <p className="text-kid-md text-ink-soft">
        Lỗi này không phải do bé đâu. Tiến độ học vẫn được giữ nguyên. Bố mẹ thử mở lại giúp con
        nhé.
      </p>

      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onRetry}
          className="min-h-touch w-full rounded-kid border-2 border-brand bg-brand px-6 text-kid-md font-bold text-ink-inverse shadow-kid transition-transform duration-kid active:translate-y-[2px] active:shadow-none"
        >
          Thử lại
        </button>
        <button
          type="button"
          // Tải lại cả trang là cách chắc chắn nhất để thoát khỏi trạng thái hỏng, kể cả khi lỗi
          // nằm trong module đã nạp. Nút "Thử lại" ở trên nhẹ nhàng hơn nhưng có thể không đủ
          // nếu lỗi tái diễn.
          onClick={() => window.location.reload()}
          className="min-h-touch w-full rounded-kid border-2 border-line bg-surface px-6 text-kid-md font-bold text-ink-soft"
        >
          Mở lại
        </button>
      </div>

      {import.meta.env.DEV && (
        // `data-selectable` bật lại khả năng bôi đen chọn chữ (mặc định bị tắt toàn cục để bé
        // không kéo chọn text khi chơi game).
        <pre
          data-selectable="true"
          className="mt-4 max-h-[200px] w-full overflow-auto rounded-kid bg-surface-sunken p-3 text-left text-kid-xs text-danger"
        >
          {error.message}
          {error.stack ? `\n\n${error.stack}` : ''}
        </pre>
      )}
    </main>
  );
}
