/**
 * RubyLingo — `themeAccent`: tông màu riêng của từng chủ đề.
 *
 * ⭐ VẤN ĐỀ: có 11 chủ đề × 4 vai màu = 44 giá trị. Nếu mỗi component tự viết class màu
 *   (`border-th-at-the-zoo`, `text-th-my-body-ink`…) thì mỗi chủ đề mới lại phải rắc tên vào
 *   vài chỗ, và Tailwind sẽ sinh class cho những cái tên chẳng ai dùng.
 *
 * ⭐ CÁCH LÀM: đặt BỐN biến cục bộ trên phần tử gốc của thẻ, rồi component chỉ dùng 4 class
 *   CỐ ĐỊNH (`border-th`, `text-th-ink`, `bg-th-soft`, `from-th-soft`). Muốn thêm chủ đề mới:
 *   thêm 4 dòng vào `tokens.css`, KHÔNG sửa file này cũng không sửa `tailwind.config.ts`.
 *
 *   Giá trị màu vẫn nằm duy nhất ở `tokens.css` — đây là đi vòng để tránh lặp, KHÔNG phải
 *   hardcode màu ở component (quy ước của dự án vẫn nguyên vẹn).
 *
 * ⚠️⚠️ VÌ SAO BẮT BUỘC PHẢI CÓ `FALLBACK`:
 *   Nếu chủ đề chưa có tông màu, `var(--c-th-<id>)` là một biến KHÔNG TỒN TẠI. CSS xử lý
 *   `var()` không phân giải được bằng cách làm khai báo **không hợp lệ tại thời điểm tính toán**
 *   ⇒ `border-color` trở về `currentColor`, `background-color` trở về `transparent`. Im lặng
 *   tuyệt đối — đúng họ lỗi ở skill `css-silent-failures`. Nên biến cục bộ LUÔN trỏ tới
 *   `var(--c-brand…)` làm phương án hai khi chủ đề chưa có tông riêng.
 *   Lưới an toàn thứ hai là khẳng định trong `tests/unit/client/styles-tokens.test.ts`:
 *   MỌI chủ đề trong `level.json` đều phải có đủ 4 token (khẳng định ④), và ba tệp
 *   `level.json` ↔ tệp này ↔ `tokens.css` phải khớp nhau (khẳng định ⑧).
 */

import type { CSSProperties } from 'react';

/** Mười một chủ đề Starters đã có tông màu riêng trong `tokens.css`. */
export const THEME_ACCENT_IDS = [
  'numbers-1-20',
  'at-home',
  'my-favourite-food',
  'at-the-zoo',
  'my-body',
  'at-the-beach',
  'my-friends-birthday',
  'at-school',
  'my-street',
  'at-the-clothes-shop',
  'alphabet',
] as const;

export type ThemeAccentId = (typeof THEME_ACCENT_IDS)[number];

/** Bốn vai màu của một tông chủ đề. `--c-th-<id>` + hậu tố. */
export const ACCENT_SUFFIXES = ['', '-ink', '-soft', '-tint'] as const;
export type AccentSuffix = (typeof ACCENT_SUFFIXES)[number];

/** Phương án hai khi chủ đề chưa có tông riêng — dùng lại màu thương hiệu, xem ghi chú đầu tệp. */
const BRAND_FALLBACK: Record<AccentSuffix, string> = {
  '': 'var(--c-brand)',
  '-ink': 'var(--c-brand)',
  '-soft': 'var(--c-brand-soft)',
  '-tint': 'var(--c-brand-tint)',
};

export function hasThemeAccent(themeId: string): themeId is ThemeAccentId {
  return (THEME_ACCENT_IDS as readonly string[]).includes(themeId);
}

/**
 * Giá trị để gán cho một biến cục bộ — LUÔN là một tham chiếu `var(...)` hoàn chỉnh.
 *
 * ⚠️⚠️ ĐỪNG BAO GIỜ TRẢ VỀ **TÊN** BIẾN (kết quả không có `var(`). Đây là lỗi đã thật sự xảy ra
 *   ở đây, và nó im lặng qua MỌI cổng kiểm:
 *
 *     `--c-accent: --c-th-at-the-zoo;`      ← TÊN, không phải giá trị
 *
 *   Về mặt cú pháp CSS, đây là khai báo **HOÀN TOÀN HỢP LỆ**: giá trị của một custom property
 *   được phép là chuỗi token bất kỳ, nên trình duyệt không kêu một tiếng nào. Nó chỉ nổ ở
 *   CHỖ DÙNG:
 *     · `color: var(--c-accent-ink)`      → `color: --c-th-at-the-zoo-ink` → giá trị không hợp
 *       lệ cho `color` ⇒ khai báo bị bỏ và `color` **thừa hưởng** từ cha ⇒ chữ ra màu mực
 *       thường `--c-ink`, trông vẫn "bình thường".
 *     · `background-color: var(--c-accent-soft)` → không hợp lệ ⇒ **trong suốt**.
 *   Hệ quả: cả 11 tông màu chủ đề BIẾN MẤT, mà:
 *     ✔ `tsc` xanh   ✔ eslint xanh   ✔ 729 unit test xanh   ✔ build xanh
 *     ✔ CSS sinh ra ĐÚNG (`text-th-ink { color: var(--c-accent-ink) }` nằm trong tệp một cách
 *       hoàn hảo)   ✔ ảnh chụp màn hình không hề có lỗi cú pháp nào để nhìn thấy
 *   Chỉ có một phép đo bắt được nó: đọc `getComputedStyle(el).color` trên trình duyệt THẬT và
 *   so với mã hex trong `tokens.css`. Xem khẳng định ⑨ ở `tests/unit/client/theme-accent.test.ts`
 *   — canh đúng dạng `^var\(--c-…\)$` để không tái diễn.
 */
export function themeAccentVar(themeId: string, suffix: AccentSuffix = ''): string {
  return hasThemeAccent(themeId)
    ? `var(--c-th-${themeId}${suffix})`
    : (BRAND_FALLBACK[suffix] as string);
}

/**
 * Bốn biến cục bộ để spread lên phần tử GỐC của thẻ chủ đề:
 *
 * ```tsx
 * <div style={themeAccentStyle(theme.id)}>
 *   <span className="bg-th-soft text-th-ink">…</span>
 * </div>
 * ```
 *
 * Phải nằm trên phần tử gốc (hoặc tổ tiên chung) thì mọi phần tử con mới thừa hưởng.
 */
export function themeAccentStyle(themeId: string): CSSProperties {
  return {
    '--c-accent': themeAccentVar(themeId, ''),
    '--c-accent-ink': themeAccentVar(themeId, '-ink'),
    '--c-accent-soft': themeAccentVar(themeId, '-soft'),
    '--c-accent-tint': themeAccentVar(themeId, '-tint'),
  } as CSSProperties;
}
