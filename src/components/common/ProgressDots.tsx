/**
 * RubyLingo — `ProgressDots`: chấm tiến độ trong một lượt chơi / một chuỗi bước.
 *
 * ⭐ VÌ SAO CHẤM (DOTS) CHỨ KHÔNG PHẢI THANH PHẦN TRĂM:
 *   Bé 7 tuổi chưa đọc được "7/10 = 70%". Nhưng bé ĐẾM được 7 chấm đầy trong 10 chấm — đó là
 *   kỹ năng bé đã có từ lớp 1. Chấm biến tiến độ thành thứ bé tự kiểm tra được.
 *
 * ⭐ CHẤM HIỆN TẠI ĐƯỢC VẼ KHÁC HAI LOẠI CÒN LẠI:
 *   Ba trạng thái phải phân biệt được bằng MẮT, không chỉ bằng màu (bé mù màu, và màn hình
 *   ngoài nắng làm màu bạc màu): đã xong = đầy, đang làm = đầy + vòng nhấn, chưa tới = nhạt.
 *
 * ⚠️ QUÁ NHIỀU CHẤM THÌ CHUYỂN SANG THANH:
 *   Chủ đề "numbers-1-20" có tới 20 câu. 20 chấm trên màn hình 360px là ~14px mỗi chấm — bé
 *   không đếm được nữa, mà chấm nhỏ còn khó thấy hơn. Vượt `maxDots` thì tự đổi sang thanh
 *   liền mạch, giữ nguyên ngữ nghĩa và khả năng đọc.
 */

import { cn } from '../../lib/cn.js';

export interface ProgressDotsProps {
  /** Số bước đã hoàn thành. */
  value: number;
  /** Tổng số bước. */
  total: number;
  /** Vượt ngưỡng này thì chuyển sang dạng thanh. Mặc định 12. */
  maxDots?: number;
  /** Nhãn đọc lên cho screen reader, ví dụ "Câu 3 trên 10". */
  label?: string;
  className?: string;
}

export function ProgressDots({
  value,
  total,
  maxDots = 12,
  label,
  className,
}: ProgressDotsProps) {
  const safeTotal = Math.max(1, Math.trunc(total));
  const safeValue = Math.min(safeTotal, Math.max(0, Math.trunc(value)));

  return (
    <div
      // `progressbar` là role ĐÚNG về ngữ nghĩa: trình đọc màn hình sẽ thông báo "tiến độ" kèm
      // giá trị, thay vì đọc từng chấm một.
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      aria-valuenow={safeValue}
      aria-valuetext={label ?? `${safeValue}/${safeTotal}`}
      aria-label={label}
      className={cn('w-full', className)}
    >
      {safeTotal <= maxDots ? (
        <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
          {Array.from({ length: safeTotal }, (_, index) => {
            const done = index < safeValue;
            const current = index === safeValue;
            return (
              <span
                key={index}
                className={cn(
                  'rounded-full transition-all duration-kid',
                  done && 'size-3 bg-brand',
                  // Chấm hiện tại to hơn + có vòng: phân biệt được cả khi in đen trắng.
                  current && 'size-4 bg-brand ring-2 ring-brand-soft',
                  !done && !current && 'size-3 bg-line',
                )}
              />
            );
          })}
        </div>
      ) : (
        // Dạng thanh: `overflow-hidden` để phần đầy không tràn ra ngoài góc bo.
        <div className="h-3 w-full overflow-hidden rounded-pill bg-line" aria-hidden="true">
          <div
            className="h-full rounded-pill bg-brand transition-all duration-kid"
            style={{ width: `${(safeValue / safeTotal) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
