/**
 * RubyLingo — `ResponsiveGrid`: lưới tự chia cột theo bề rộng khả dụng.
 *
 * ⭐ VÌ SAO DÙNG `auto-fill` + `minmax(min(<w>px, 100%), 1fr)` CHỨ KHÔNG PHẢI BREAKPOINT:
 *   Cách quen thuộc là khai `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`. Nhưng số cột phù hợp
 *   không phụ thuộc vào BỀ RỘNG MÀN HÌNH — nó phụ thuộc vào bề rộng VÙNG CHỨA. Cùng một iPad
 *   ở chế độ dọc: lưới chủ đề (chiếm cả màn hình) cần 3 cột, còn lưới vật phẩm trong ngăn kéo
 *   bên cạnh chỉ cần 2. Breakpoint không biết được điều đó, `auto-fill` thì biết.
 *
 * ⭐ VÌ SAO PHẢI BỌC `min(<w>px, 100%)` — ĐÂY LÀ CHI TIẾT CHỐNG TRÀN MÀN HÌNH:
 *   Nếu chỉ ghi `minmax(200px, 1fr)`, trên một điện thoại rộng 360px với đệm 2 bên, vùng chứa
 *   còn ~320px. `auto-fill` sẽ tính được 1 cột (đúng), NHƯNG nếu ô cha có `min-width` từ nội
 *   dung bên trong (một từ tiếng Anh dài, một ảnh to), ô lưới sẽ bị đẩy rộng ra và TRÀN ngang.
 *   `min(200px, 100%)` chặn trần ở đúng bề rộng khả dụng, nên dù nội dung có cứng đầu thế nào
 *   cũng không đẩy được lưới ra ngoài màn hình.
 *
 * ⭐ `auto-fill` (không phải `auto-fit`): giữ nguyên cỡ ô kể cả khi có ít phần tử. Với 2 chủ đề
 *   trên màn hình laptop, `auto-fit` sẽ kéo 2 ô phình to bằng nửa màn hình mỗi ô — trông như
 *   lỗi. `auto-fill` giữ chúng đúng cỡ như khi có 9 ô.
 */

import type { CSSProperties, ElementType, ReactNode } from 'react';

import { cn } from '../../lib/cn.js';

export interface ResponsiveGridProps {
  children: ReactNode;
  /**
   * Bề rộng tối thiểu của một ô, px. Lưới tự xếp được bao nhiêu cột thì xếp.
   * Nên chọn theo nội dung: thẻ từ vựng 140–160, thẻ chủ đề 200–240.
   */
  minItemWidth?: number;
  /** Khoảng cách giữa các ô, px. Mặc định 16. */
  gap?: number;
  /** Thẻ bao ngoài. Mặc định `div` — đổi thành `ul` khi các con là `li`. */
  as?: ElementType;
  className?: string;
}

export function ResponsiveGrid({
  children,
  minItemWidth = 160,
  gap = 16,
  as: Tag = 'div',
  className,
}: ResponsiveGridProps) {
  // Kẹp lại: `minItemWidth` bằng 0 sẽ làm CSS `minmax(0, 1fr)` ⇒ số cột vô hạn ⇒ trình duyệt
  // treo khi tính bố cục. Một giá trị sai từ bên ngoài không được phép làm sập trang.
  const safeMin = Math.max(80, Math.round(minItemWidth));
  const safeGap = Math.max(0, Math.round(gap));

  const style: CSSProperties = {
    display: 'grid',
    gap: `${safeGap}px`,
    gridTemplateColumns: `repeat(auto-fill, minmax(min(${safeMin}px, 100%), 1fr))`,
  };

  return (
    <Tag style={style} className={cn('w-full', className)}>
      {children}
    </Tag>
  );
}
