/**
 * RubyLingo — `CounterChip`: viên hiển thị "icon + số", dùng chung cho ⭐ và 🌰.
 *
 * ⭐ VÌ SAO TÁCH RIÊNG: `StarCounter` và `AcornCounter` khác nhau ĐÚNG ba thứ — emoji, màu,
 *   và tên gọi. Viết hai lần nghĩa là mọi sửa đổi về cỡ chữ, khoảng đệm, cách đọc cho screen
 *   reader đều phải làm hai lần, và chắc chắn sẽ lệch nhau ở lần sửa thứ hai.
 *
 * ⭐ VÌ SAO SỐ DÙNG `tabular-nums`:
 *   Với font mặc định, chữ số `1` hẹp hơn `8`. Khi số sao chạy từ 9 → 10 → 100, cả viên sẽ
 *   rộng ra hẹp vào mỗi lần đổi, làm nhãn bên cạnh bị đẩy qua đẩy lại. `tabular-nums` cho mọi
 *   chữ số cùng bề rộng nên viên đứng yên.
 *
 * ⭐ VÌ SAO `role="img"` + `aria-label`:
 *   Screen reader đọc "⭐ 12" thành "ngôi sao mười hai" — nghe như một biểu tượng trang trí.
 *   Gộp cả viên thành một ảnh có nhãn "Sao: 12" thì bé nghe đúng thông tin. Không dùng
 *   `aria-live` ở đây: việc thông báo phần thưởng đã do `RewardBurst` lo, thêm nữa là đọc
 *   hai lần cùng một chuyện.
 */

import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '../../lib/cn.js';

export interface CounterChipProps {
  /** Emoji đại diện. Đã tự `aria-hidden` — nhãn chữ đã nằm trong `aria-label`. */
  icon: string;
  value: number;
  /** Tên đọc lên cho screen reader, ví dụ "Sao". */
  label: string;
  /**
   * ⭐ `true` = CHƯA BIẾT giá trị (dữ liệu chưa tải xong) ⇒ hiện "—" thay vì số.
   *
   * Vì sao cần trạng thái riêng thay vì mặc định 0: hiện "0 ⭐" cho một bé đang có 250 sao là
   * NÓI SAI. Bé sẽ hoảng (mất hết sao rồi!) hoặc bấm loạn để kiểm tra. Dấu "—" nói đúng sự
   * thật: chưa biết, đang tải.
   */
  pending?: boolean;
  /** Lớp màu cho phần chữ. Icon giữ nguyên màu emoji. */
  toneClass?: string;
  className?: string;
}

export function CounterChip({
  icon,
  value,
  label,
  pending = false,
  toneClass = 'text-ink',
  className,
}: CounterChipProps) {
  const reduceMotion = useReducedMotion();

  // Giá trị âm không có nghĩa với hai loại tiền tệ này. Kẹp lại để một lỗi tính toán ở đâu đó
  // không hiển thị "-3 sao" cho bé rồi làm bé lo.
  const safeValue = Math.max(0, Math.trunc(value));

  return (
    <span
      role="img"
      aria-label={pending ? `${label}: đang tải` : `${label}: ${safeValue}`}
      className={cn(
        /**
         * ⭐ CỠ VIÊN CO THEO BỀ RỘNG MÀN HÌNH — ĐÂY LÀ CHI TIẾT QUYẾT ĐỊNH CẢ BỐ CỤC THANH TRÊN.
         *
         * Đo thực tế trên 360px (khung 328px sau khi trừ đệm): bốn viên cỡ đầy đủ rộng
         * 79 + 79 + 79 + 75 = 334px ⇒ viên thứ tư RỚT XUỐNG DÒNG, biến thanh trên thành 3 hàng
         * và cao 181px — chiếm 23% màn hình điện thoại. Chỉ thiếu đúng 6px.
         *
         * Cỡ nhỏ (mặc định, dưới 480px): icon 18px, số 16px (`--fs-xs` — mức nhỏ nhất được phép
         * trong app này), đệm 10px ⇒ mỗi viên ~64px, cả bốn viên + tên bé VỪA MỘT HÀNG.
         * Từ 480px trở lên có đủ chỗ nên trả về cỡ thoải mái.
         *
         * ⚠️ Số có 3 chữ số (ví dụ 250 ⭐) vẫn có thể đẩy viên thứ tư xuống dòng. Đó là hành vi
         *    ĐÚNG — thanh tự cao thêm thay vì cắt bớt số của bé.
         */
        'inline-flex items-center gap-1 rounded-pill bg-surface-raised px-2.5 py-1',
        'sm:gap-1.5 sm:px-3',
        'border border-line',
        className,
      )}
    >
      <span aria-hidden="true" className="text-[18px] leading-none sm:text-[20px]">
        {icon}
      </span>
      {pending ? (
        <span
          aria-hidden="true"
          className={cn('text-kid-xs font-bold tabular-nums opacity-50 sm:text-kid-sm', toneClass)}
        >
          —
        </span>
      ) : (
        /*
          `key={safeValue}` làm phần tử được GẮN LẠI mỗi khi số đổi, nhờ đó animation `initial`
          chạy lại từ đầu. Cách này gọn hơn dùng `useEffect` + `animate()` và không để lại
          animation treo khi component unmount giữa chừng.
        */
        <motion.span
          key={safeValue}
          initial={reduceMotion ? false : { scale: 1.5 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          className={cn('text-kid-xs font-bold tabular-nums sm:text-kid-sm', toneClass)}
        >
          {safeValue}
        </motion.span>
      )}
    </span>
  );
}
