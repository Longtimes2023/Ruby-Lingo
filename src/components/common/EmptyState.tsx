/**
 * RubyLingo — `EmptyState`: màn hình khi danh sách chưa có gì.
 *
 * ⭐ VÌ SAO KHÔNG ĐƯỢC ĐỂ TRỐNG TRƠN:
 *   Với người lớn, một danh sách rỗng là "chưa có dữ liệu". Với bé 7 tuổi, một khoảng trắng là
 *   "hình như con làm sai rồi" hoặc "app bị hỏng". Mọi danh sách rỗng trong app này PHẢI có một
 *   hình ảnh quen thuộc và một câu nói rõ chuyện gì đang xảy ra, kèm việc cần làm tiếp theo.
 *
 * ⭐ VÌ SAO LUÔN CÓ MỘT LINH VẬT:
 *   Linh vật là người nói câu đó. "Chưa có huy hiệu nào" do Momo nói khác hẳn với một dòng chữ
 *   xám trên nền trắng — nó biến thông báo thành một cuộc trò chuyện, đúng tinh thần của app.
 */

import type { ReactNode } from 'react';

import { cn } from '../../lib/cn.js';

export interface EmptyStateProps {
  /** Emoji lớn — nên là linh vật hoặc biểu tượng của thứ đang thiếu. */
  icon?: string;
  title: string;
  /** Một câu giải thích hoặc gợi ý việc cần làm. */
  description?: string;
  /** Nút hành động (thường là `BigButton`). Bỏ trống nếu không có gì để làm. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon = '🐵',
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex w-full flex-col items-center gap-3 rounded-kid border-2 border-dashed border-line bg-surface-raised p-6 text-center',
        className,
      )}
    >
      <span aria-hidden="true" className="text-[56px] leading-none opacity-80">
        {icon}
      </span>

      <h2 className="text-kid-lg text-ink">{title}</h2>

      {description && <p className="max-w-[42ch] text-kid-sm text-ink-soft">{description}</p>}

      {action && <div className="mt-2 w-full max-w-[320px]">{action}</div>}
    </div>
  );
}
