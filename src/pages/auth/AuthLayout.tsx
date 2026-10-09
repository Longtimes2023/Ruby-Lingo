/**
 * RubyLingo — Thành phần dùng chung cho các trang xác thực.
 *
 * ⚠️ ĐÂY LÀ THÀNH PHẦN CỤC BỘ CỦA KHU VỰC XÁC THỰC, KHÔNG PHẢI DESIGN SYSTEM.
 *   Nút/ô nhập ở đây cố tình đơn giản và chỉ phục vụ form của phụ huynh (chữ nhỏ hơn, mật độ
 *   dày hơn khu vực của bé). Bộ nút lớn cho bé (`BigButton`, vùng chạm ≥64px) là task T028 ở
 *   nhóm sau — đừng gộp hai thứ này làm một, vì yêu cầu về kích thước và tương phản khác hẳn.
 *
 * Người dùng ở đây là PHỤ HUYNH (đang cầm điện thoại, có thể đang vội), không phải bé.
 */

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef, useState } from 'react';

import { BrandLogo } from '../../components/BrandLogo.js';

// =============================================================================
// Khung trang
// =============================================================================

/** Khung chung: logo + tiêu đề + thẻ nội dung. Giữ các trang xác thực trông như một mạch. */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col justify-center gap-5 p-5">
      <header className="flex flex-col items-center gap-2 text-center">
        <BrandLogo size={72} decorative />
        <h1 className="text-kid-xl text-brand">RubyLingo</h1>
        <p className="text-kid-xs text-ink-faint">Nhà Vườn Thú Của Bé</p>
      </header>

      <section className="rounded-kid bg-surface p-5 shadow-kid">
        <h2 className="text-kid-lg">{title}</h2>
        {subtitle && <p className="mt-1 text-kid-xs text-ink-soft">{subtitle}</p>}
        <div className="mt-4">{children}</div>
      </section>
    </main>
  );
}

// =============================================================================
// Ô nhập
// =============================================================================

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Câu gợi ý dưới ô nhập (khi chưa có lỗi). */
  hint?: string;
  /** Câu lỗi — hiện ĐỎ ngay dưới ô nhập. */
  error?: string | undefined;
}

/**
 * Ô nhập có nhãn, gợi ý và lỗi.
 *
 * ⚠️ Điều quan trọng nhất ở đây là LIÊN KẾT `aria-describedby` + `aria-invalid`: lỗi không
 *    chỉ hiện màu đỏ, mà còn được trình đọc màn hình đọc lên. Nếu chỉ đổi màu chữ thì người
 *    dùng khiếm thị hoàn toàn không biết mình nhập sai.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, id, className, ...rest },
  ref,
) {
  const inputId = id ?? `field-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-kid-xs font-bold text-ink-soft">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        className={[
          'min-h-[52px] rounded-kid border-2 bg-surface-raised px-4 text-kid-sm text-ink',
          'outline-none transition-colors duration-kid',
          error ? 'border-danger' : 'border-line focus:border-brand',
          className ?? '',
        ].join(' ')}
        {...rest}
      />
      {hint && !error && (
        <p id={hintId} className="text-kid-xs text-ink-faint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-kid-xs font-bold text-danger">
          {error}
        </p>
      )}
    </div>
  );
});

// =============================================================================
// Nút & thông báo
// =============================================================================

/** Nút gửi form. Cao 56px — đủ lớn cho ngón tay trên điện thoại, vẫn gọn cho form phụ huynh. */
export function SubmitButton({
  children,
  pending,
  ...rest
}: { children: ReactNode; pending?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={[
        'min-h-[56px] w-full rounded-kid bg-brand px-5 text-kid-md font-bold text-ink-inverse',
        'shadow-kid-lg transition-transform duration-kid',
        'active:translate-y-[2px] active:shadow-kid',
        'disabled:cursor-not-allowed disabled:opacity-60',
      ].join(' ')}
      {...rest}
    >
      {pending ? 'Đang xử lý...' : children}
    </button>
  );
}

/**
 * Thông báo lỗi chung của form.
 *
 * Dùng `role="alert"` để trình đọc màn hình đọc ngay khi xuất hiện — lỗi form mà không được
 * đọc lên thì người dùng chỉ biết mình bấm nút mà "không có gì xảy ra".
 */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-kid border-2 border-danger bg-surface-sunken px-4 py-3 text-kid-xs font-bold text-danger"
    >
      {children}
    </div>
  );
}

// =============================================================================
// Khối hiện mã khôi phục
// =============================================================================

/**
 * Hiện mã khôi phục và CHẶN cho tới khi phụ huynh xác nhận đã lưu.
 *
 * ⭐ VÌ SAO DÙNG CHUNG CHO CẢ ĐĂNG KÝ LẪN ĐẶT LẠI MẬT KHẨU:
 *   Cả hai luồng đều chỉ có ĐÚNG MỘT CƠ HỘI để phụ huynh nhìn thấy mã (`resetPassword` phát
 *   mã mới, mã cũ bị đánh dấu đã dùng). Nếu mỗi trang tự viết một bản, chỉ cần một bản quên
 *   nút xác nhận là người dùng mất đường lùi vĩnh viễn. Một thành phần ⇒ một hành vi.
 *
 * Nút "tiếp tục" KHÔNG tự chuyển trang: nó gọi `onContinue` để trang quyết định đi đâu
 * (đăng ký → tạo hồ sơ bé; đặt lại mật khẩu → đăng nhập lại, vì server đã thu hồi mọi phiên).
 */
export function RecoveryCodePanel({
  code,
  onContinue,
  continueLabel,
}: {
  code: string;
  onContinue: () => void;
  continueLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard có thể bị chặn (không phải HTTPS, hoặc quyền bị từ chối). Không phải lỗi
      // chặn đường: phụ huynh vẫn chép tay được từ màn hình.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="alert"
        className="rounded-kid border-2 border-warn bg-surface-sunken px-4 py-3 text-kid-xs font-bold text-warn"
      >
        Mã này chỉ hiện MỘT LẦN. Bố mẹ hãy chụp ảnh hoặc ghi lại ở nơi an toàn. Nếu quên mật
        khẩu, cần mã này để đặt lại.
      </div>

      <p
        data-selectable="true"
        className="rounded-kid border-2 border-line bg-surface-raised px-4 py-4 text-center font-display text-kid-lg tracking-wider"
      >
        {code}
      </p>

      <button
        type="button"
        onClick={copyCode}
        className="min-h-[52px] w-full rounded-kid border-2 border-brand bg-surface px-5 text-kid-sm font-bold text-brand"
      >
        {copied ? 'Đã sao chép ✓' : 'Sao chép mã'}
      </button>

      <SubmitButton type="button" onClick={onContinue}>
        {continueLabel}
      </SubmitButton>
    </div>
  );
}
