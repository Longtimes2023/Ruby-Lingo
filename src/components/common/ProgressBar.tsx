/**
 * RubyLingo — `ProgressBar`: thanh tiến độ cho một TỈ LỆ HOÀN THÀNH.
 *
 * ⚠️⚠️ VÌ SAO CẦN COMPONENT NÀY, KHI ĐÃ CÓ `ProgressDots`:
 *
 *   Hai thứ trông giống nhau nhưng trả lời hai câu hỏi KHÁC NHAU, và trộn chúng lại gây hiểu sai:
 *
 *     • `ProgressDots` — "tôi đang ở BƯỚC NÀO trong một chuỗi". Nó vẽ một chấm ĐANG LÀM to hơn
 *       kèm vòng sáng. Dùng đúng chỗ: tiến độ từng câu trong một lượt chơi, từng thẻ trong bộ
 *       thẻ. Ở đó "bước hiện tại" là thông tin thật.
 *
 *     • `ProgressBar`  — "đã xong bao nhiêu trên tổng". Không có khái niệm "đang ở bước nào".
 *       Dùng đúng chỗ: một chủ đề đã xong mấy bài, một bài đã học mấy từ.
 *
 *   ⚠️ LỖI CỤ THỂ KHI DÙNG SAI — đã nhìn thấy trên ảnh render thật:
 *     Thẻ chủ đề hiện "0/13 từ" kèm `ProgressDots` với `value = 0` cho ra **một chấm TO màu
 *     thương hiệu cộng sáu chấm nhạt**. Bé đếm được một chấm đậm ⇒ đọc thành "1/7". Trong khi
 *     con số ngay bên cạnh ghi 0. Hai thông tin mâu thuẫn trên cùng một thẻ, và thứ bé tin là
 *     hình, không phải chữ. (Lúc phát hiện brand còn là tím; màu chỉ là phương tiện, lỗi nằm ở
 *     chỗ dùng sai LOẠI thanh đo.)
 *
 *   Thanh rỗng ở `value = 0` thì không thể đọc sai thành gì khác.
 *
 * ⭐ KHÔNG BAO GIỜ HIỆN SỐ ÂM HAY VƯỢT 100%:
 *   `value` có thể đến từ dữ liệu cũ hoặc từ server; một thanh tràn ra ngoài khung là lỗi hiển
 *   thị trông rất rõ. Kẹp lại ở đây thay vì bắt mọi nơi gọi tự kẹp.
 */

import { cn } from '../../lib/cn.js';

export interface ProgressBarProps {
  value: number;
  total: number;
  /**
   * Nhãn cho trình đọc màn hình, ví dụ "Đã học 3 trên 7 từ".
   *
   * BẮT BUỘC, không có mặc định: một thanh tiến độ không có nhãn thì trình đọc màn hình chỉ đọc
   * "tiến độ, 43 phần trăm" mà không nói đang đo cái gì.
   */
  label: string;
  /**
   * `brand` = tiến độ học (hồng thương hiệu). `star` = tiến độ sao (hổ phách).
   * `accent` = tông RIÊNG CỦA CHỦ ĐỀ (đọc biến cục bộ `--c-accent` do thẻ chủ đề đặt — xem
   * `lib/themeAccent.ts`). Nơi gọi phải bảo đảm có tổ tiên đã đặt biến đó, nếu không nó rơi về
   * màu thương hiệu; đây là lý do `tone` mặc định vẫn là `brand` chứ không phải `accent`.
   */
  tone?: 'brand' | 'star' | 'accent';
  className?: string;
}

export function ProgressBar({ value, total, label, tone = 'brand', className }: ProgressBarProps) {
  const safeTotal = Math.max(1, Math.trunc(total));
  const safeValue = Math.min(safeTotal, Math.max(0, Math.trunc(value)));
  const percent = (safeValue / safeTotal) * 100;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      aria-valuenow={safeValue}
      aria-valuetext={label}
      aria-label={label}
      className={cn('h-2.5 w-full overflow-hidden rounded-pill bg-line', className)}
    >
      <div
        className={cn(
          'h-full rounded-pill transition-all duration-kid',
          tone === 'star' ? 'bg-star' : tone === 'accent' ? 'bg-th' : 'bg-brand',
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
