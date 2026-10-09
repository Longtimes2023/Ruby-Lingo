/**
 * RubyLingo — `BigButton`: nút bấm cỡ lớn cho tay trẻ con.
 *
 * ⭐ VÌ SAO KHÔNG DÙNG THẲNG `<button>` VỚI CLASS TAILWIND Ở TỪNG CHỖ:
 *   Vùng chạm tối thiểu (64px, nút chính 88px) là yêu cầu về KHẢ NĂNG DÙNG ĐƯỢC, không
 *   phải sở thích thẩm mỹ. Nếu mỗi màn hình tự viết class, chỉ cần một chỗ quên là có nút
 *   nhỏ xíu mà bé 7 tuổi bấm mãi không trúng — và không ai phát hiện ra khi duyệt bằng chuột
 *   trên laptop. Gói vào một component thì quy tắc được ép ở một chỗ.
 *
 * ⭐ CỠ NÚT TỰ CO THEO MÀN HÌNH, KHÔNG CẦN JAVASCRIPT:
 *   `min-h-touch` = 64px, `min-h-touch-lg` = 88px, và `tokens.css` đã hạ hai biến này
 *   xuống 56/72px dưới 480px. Nghĩa là cùng một class cho ra kích thước đúng ở mọi bậc
 *   màn hình — không cần `useViewport`, không có nhịp "giật" lúc mới tải.
 *
 * ⭐ PHẢN HỒI KHI BẤM (quan trọng với trẻ):
 *   Nút dịch xuống 2px và bóng đổ biến mất khi bấm (`active:translate-y-*` + `active:shadow-none`).
 *   Trông như nút cao su bị ấn thật. Với trẻ, phản hồi này là thứ xác nhận "con vừa bấm trúng"
 *   — thiếu nó thì bé hay bấm lại nhiều lần.
 */

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '../../lib/cn.js';

/**
 * `lg` = nút hành động chính (Bắt đầu, Tiếp tục) — cao 88px.
 * `md` = nút thường (Chọn, Đổi bé) — cao 64px.
 */
export type BigButtonSize = 'md' | 'lg';

/**
 * `primary`  — hành động chính của màn hình. Chỉ nên có MỘT nút primary một lúc.
 * `secondary`— hành động phụ, nền sáng viền đậm.
 * `success`  — xác nhận ("Xong rồi!"), dùng màu xanh.
 * `ghost`    — không viền, cho hành động rất phụ (Bỏ qua).
 * `danger`   — chỉ dùng ở khu vực phụ huynh (xoá tài khoản). KHÔNG dùng trong màn hình của bé.
 */
export type BigButtonVariant = 'primary' | 'secondary' | 'success' | 'ghost' | 'danger';

export interface BigButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: BigButtonSize;
  variant?: BigButtonVariant;
  /** Icon/emoji đặt trước nhãn. Đã tự `aria-hidden` — bé nghe nhãn chữ, không nghe emoji. */
  icon?: ReactNode;
  /** Chiếm hết chiều ngang. Mặc định `true` vì hầu hết nút trong app này là nút toàn dòng. */
  fullWidth?: boolean;
  /** Đang xử lý: khoá nút và báo cho screen reader. Tự khoá luôn cả khi không truyền `disabled`. */
  loading?: boolean;
}

const SIZE_CLASSES: Record<BigButtonSize, string> = {
  md: 'min-h-touch px-6 text-kid-md',
  lg: 'min-h-touch-lg px-8 text-kid-lg',
};

const VARIANT_CLASSES: Record<BigButtonVariant, string> = {
  // Chữ trắng trên nền tím đậm: tương phản ~7:1, vượt WCAG AA cho chữ lớn.
  primary: 'bg-brand text-ink-inverse border-brand-strong',
  secondary: 'bg-surface text-brand border-brand',
  success: 'bg-success text-ink-inverse border-success',
  ghost: 'bg-transparent text-ink-soft border-transparent',
  danger: 'bg-danger text-ink-inverse border-danger',
};

export const BigButton = forwardRef<HTMLButtonElement, BigButtonProps>(function BigButton(
  {
    size = 'md',
    variant = 'primary',
    icon,
    fullWidth = true,
    loading = false,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled === true || loading;

  return (
    <button
      {...rest}
      ref={ref}
      // Mặc định `type="button"`: nút nằm trong `<form>` mà không khai báo type sẽ mặc định
      // là `submit` và vô tình gửi form khi bé bấm "Nghe lại". Đây là lỗi rất hay gặp.
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        // Bố cục
        'inline-flex items-center justify-center gap-3 rounded-kid border-2 font-bold',
        // Phản hồi khi bấm — xem ghi chú đầu file
        'shadow-kid transition-transform duration-kid',
        'active:translate-y-[2px] active:shadow-none',
        // Không cho chọn text / menu ngữ cảnh khi bé giữ nút
        'select-none',
        // Trạng thái
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0',
        // Trên thiết bị cảm ứng, `:hover` dính lại sau khi chạm ⇒ chỉ bật hover khi CÓ chuột.
        // `@media (hover: hover)` là cách đúng; Tailwind chưa có tiện ích sẵn nên dùng class
        // tuỳ biến đã khai trong index.css.
        'hoverable:brightness-105',
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        fullWidth && 'w-full',
        className,
      )}
    >
      {loading ? (
        // Vòng xoay thay cho icon khi đang xử lý. `aria-hidden` vì `aria-busy` đã báo rồi.
        <span
          aria-hidden="true"
          className="size-6 shrink-0 animate-spin rounded-full border-[3px] border-current border-t-transparent"
        />
      ) : (
        icon != null && (
          <span aria-hidden="true" className="shrink-0 text-[1.2em] leading-none">
            {icon}
          </span>
        )
      )}
      {/* Nhãn có thể xuống dòng nhưng không bị bóp: `min-w-0` cho phép co trong flex. */}
      <span className="min-w-0">{children}</span>
    </button>
  );
});
