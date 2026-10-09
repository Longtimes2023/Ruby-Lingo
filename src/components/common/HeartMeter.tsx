/**
 * RubyLingo — `HeartMeter`: mức Vui vẻ của linh vật (❤️).
 *
 * ⭐ SÀN = 1 — ĐÂY LÀ RÀNG BUỘC TRIẾT LÝ, KHÔNG PHẢI CHI TIẾT TRANG TRÍ.
 *   Linh vật KHÔNG BAO GIỜ buồn bã hoàn toàn. Dù bé nghỉ học cả tháng, Momo vẫn còn 1 ❤️ và
 *   vẫn vui khi bé quay lại. Một thanh "0/5" trống trơn là lời trách móc bằng hình ảnh — đúng
 *   thứ mà thiết kế này sinh ra để tránh. Vì vậy giá trị được KẸP xuống tối thiểu 1 ngay trong
 *   component, để không màn hình nào vô tình hiển thị 0 dù dữ liệu có xấu thế nào.
 *
 * ⭐ VÌ SAO Ô TRỐNG DÙNG CÙNG EMOJI ❤️ VỚI `grayscale` + GIẢM ĐỘ MỜ, KHÔNG DÙNG 🤍:
 *   `🤍` là "trái tim trắng" — trên nền sáng của app này nó gần như tàng hình, bé chỉ thấy
 *   mấy khoảng trắng và không hiểu còn thiếu bao nhiêu. Giữ nguyên hình dạng trái tim rồi làm
 *   nó xám đi thì bé đếm được "còn 2 ô nữa là đầy" mà không cần đọc số.
 */

import { cn } from '../../lib/cn.js';

/** Số ô tối đa theo thiết kế (`happiness` 1–5 trong `shared/types/reward.ts`). */
export const HEART_MAX = 5;

export interface HeartMeterProps {
  /** Mức vui vẻ hiện tại. Tự kẹp vào khoảng `[1, max]`. */
  value: number;
  /** Số ô hiển thị. Mặc định 5. */
  max?: number;
  /**
   * ⭐ `true` = bản GỌN cho TopBar: chỉ một trái tim + con số, thay vì 5 ô.
   *
   * Vì sao cần: 5 ô ❤️ chiếm ~90px. Cộng với ⭐, 🌰, 🔥 trong thanh trên cùng, trên điện thoại
   * 360px cả dãy sẽ tràn ra ngoài. Bản gọn giữ đủ thông tin (mức mấy trên mấy đọc được từ
   * `aria-label`) mà chỉ tốn ~55px.
   */
  compact?: boolean;
  /** Chưa tải xong dữ liệu ⇒ hiện "—". */
  pending?: boolean;
  className?: string;
}

export function HeartMeter({
  value,
  max = HEART_MAX,
  compact = false,
  pending = false,
  className,
}: HeartMeterProps) {
  // `max` hỏng (0 hoặc âm) sẽ làm vòng lặp bên dưới không vẽ gì ⇒ thanh biến mất không lý do.
  const slots = Math.max(1, Math.trunc(max));
  // Kẹp hai đầu: dưới là sàn triết lý 1, trên là số ô thực có.
  const filled = Math.min(slots, Math.max(1, Math.trunc(value)));

  if (compact) {
    return (
      <span
        role="img"
        aria-label={pending ? 'Vui vẻ: đang tải' : `Vui vẻ: ${filled} trên ${slots}`}
        className={cn(
          // Cỡ co theo màn hình — cùng lý do như `CounterChip`, xem ghi chú ở đó.
          'inline-flex items-center gap-1 rounded-pill border border-line bg-surface-raised px-2.5 py-1',
          'sm:gap-1.5 sm:px-3',
          className,
        )}
      >
        <span aria-hidden="true" className="text-[18px] leading-none sm:text-[20px]">
          ❤️
        </span>
        <span
          aria-hidden="true"
          className={cn(
            // `text-heart-ink`, không phải `text-heart`: bản tươi (#ef4444) hợp với trái tim
            // hình, nhưng làm CHỮ 16px trên nền sáng chỉ đạt 3,57:1 — trượt AA. Xem `tokens.css`.
            'text-kid-xs font-bold tabular-nums text-heart-ink sm:text-kid-sm',
            pending && 'opacity-50',
          )}
        >
          {pending ? '—' : filled}
        </span>
      </span>
    );
  }

  return (
    <span
      // Gộp cả thanh thành MỘT phần tử có nhãn: nếu để từng trái tim riêng lẻ, screen reader
      // sẽ đọc "trái tim trái tim trái tim..." — vô nghĩa với bé dùng trình đọc màn hình.
      role="img"
      aria-label={`Vui vẻ: ${filled} trên ${slots}`}
      className={cn('inline-flex items-center gap-0.5', className)}
    >
      {Array.from({ length: slots }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={cn(
            'text-[18px] leading-none transition-all duration-kid',
            index < filled ? 'opacity-100' : 'opacity-25 grayscale',
          )}
        >
          ❤️
        </span>
      ))}
    </span>
  );
}
