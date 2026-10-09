/**
 * BrandLogo — logo RubyLingo (thỏ hồng).
 *
 * NGUỒN CHÂN LÝ DUY NHẤT là `public/logo.svg`. Component này KHÔNG vẽ lại SVG —
 * favicon trong `index.html` cũng trỏ vào đúng file đó. Nếu vẽ lại ở đây thì sẽ có
 * hai bản logo và chúng sẽ lệch nhau ngay lần sửa đầu tiên.
 */

interface BrandLogoProps {
  /** Cạnh của logo, tính bằng px. 96 là cỡ hợp lý cho màn hình chào. */
  size?: number;
  /**
   * `true` khi tên thương hiệu đã nằm ngay cạnh (ví dụ có `<h1>RubyLingo</h1>` bên dưới).
   * Khi đó logo chỉ là trang trí ⇒ ẩn khỏi screen reader để bé không nghe "RubyLingo" hai lần.
   */
  decorative?: boolean;
  className?: string;
}

export function BrandLogo({ size = 96, decorative = false, className = '' }: BrandLogoProps) {
  return (
    <img
      src="/logo.svg"
      width={size}
      height={size}
      alt={decorative ? '' : 'RubyLingo'}
      aria-hidden={decorative || undefined}
      draggable={false}
      className={`inline-block select-none ${className}`}
    />
  );
}
