/**
 * RubyLingo — Dãy KHIÊN 🛡️ của một phần thi (dùng ở màn kết thúc phần và màn chứng nhận).
 *
 * ⭐ VÌ SAO LÀ HÌNH + NHÃN ĐỌC, KHÔNG PHẢI CHỈ MỘT CON SỐ:
 *   Bé 7 tuổi đọc "4 khiên" qua hình 🛡️ trực quan hơn nhiều so với chữ số trần. Nhưng hình thì
 *   trình đọc màn hình KHÔNG đọc được — nên mỗi dãy khiên mang một `role="img"` + `aria-label`
 *   là một CÂU đầy đủ ("Phần Nghe: bé được 4 khiên"). Thiếu nhãn đó là bé khiếm thị nhận ZERO
 *   thông tin từ khối quan trọng nhất của màn kết quả.
 *
 * ⚠️ SÀN = 1 (B1): `shields` LUÔN 1–5, không bao giờ 0. Component không nhận 0.
 */

import { cn } from '../../lib/cn.js';

export interface ShieldRowProps {
  /** Số khiên 1–5. */
  shields: number;
  /** Nhãn đọc đầy đủ cho screen reader. */
  label: string;
  className?: string;
}

export function ShieldRow({ shields, label, className }: ShieldRowProps) {
  const count = Math.max(0, shields);

  return (
    <div
      role="img"
      aria-label={label}
      className={cn('flex flex-wrap items-center justify-center gap-1', className)}
    >
      {Array.from({ length: count }, (_, index) => (
        <span key={index} aria-hidden="true" className="text-[32px] leading-none">
          🛡️
        </span>
      ))}
    </div>
  );
}
