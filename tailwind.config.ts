import type { Config } from 'tailwindcss';
// Kiểu cho hàm plugin. Cần khai tường minh vì `Config.plugins` không suy ra được tham số
// của callback, nên `({ addVariant })` bị `tsc` báo `implicitly has an 'any' type`.
import type { PluginCreator } from 'tailwindcss/types/config';

/**
 * ⚠️⚠️ SỬA TỆP NÀY (thêm/bớt khoá màu, cỡ chữ, breakpoint) THÌ PHẢI KHỞI ĐỘNG LẠI `vite`.
 *
 *   Vite và Tailwind nạp `tailwind.config.ts` MỘT LẦN lúc khởi động rồi giữ lại. Tệp này không
 *   nằm trong đồ thị module của Vite (nó được PostCSS `require` từ ngoài), nên sửa nó KHÔNG
 *   kích hoạt dựng lại CSS — mà cũng không có cảnh báo nào.
 *
 *   Triệu chứng đã gặp thật (khi thêm bảng màu `th` cho 11 chủ đề): các file nguồn đúng, `tsc`
 *   xanh, eslint xanh, 729 unit test xanh, `class` nằm trong `.tsx` đàng hoàng — nhưng CSS mà
 *   trình duyệt nhận được KHÔNG có một lớp `bg-th-soft` / `text-th-ink` nào. Hệ quả trên màn
 *   hình: nền chip trong suốt, chữ thừa hưởng màu mực thường, cả 11 tông màu biến mất.
 *
 *   Cách phát hiện nhanh (không cần mở trình duyệt):
 *     curl -s http://localhost:5173/src/styles/index.css | grep -c 'bg-th-soft'
 *   0 ⇒ máy chủ đang giữ bản cũ ⇒ tắt và chạy lại `npm run dev`.
 *
 *   Đính kèm: tầng gián tiếp `--c-accent*` còn có bẫy riêng, xem khối `th` ngay dưới.
 */

/**
 * Biến thể `hoverable:` — chỉ áp dụng khi thiết bị THẬT SỰ có chuột VÀ đang RÊ CHUỘT.
 *
 * ⭐ Vì sao cần: trên iPad/điện thoại, `:hover` không biến mất sau khi chạm — nút giữ
 *   nguyên trạng thái "đang rê chuột" cho tới khi bé chạm chỗ khác. Với app cho trẻ, việc
 *   đó khiến bé tưởng nút đang bị chọn/kẹt. `@media (hover: hover)` lọc đúng thiết bị.
 *
 * Thêm `(pointer: fine)` để loại luôn màn hình cảm ứng có bàn phím (một số laptop lai vẫn
 * báo `hover: hover` khi đang dùng cảm ứng).
 *
 * Dùng: `className="hoverable:brightness-105"`.
 *
 * ⚠️⚠️ PHẢI CÓ `{ &:hover }` — THIẾU NÓ LÀ HỎNG ÂM THẦM TRÊN ĐÚNG MÁY TÍNH XÁCH TAY.
 *
 *   Bản đầu chỉ khai `addVariant('hoverable', '@media (hover: hover) and (pointer: fine)')`.
 *   Tailwind sinh ra:
 *
 *       @media (hover: hover) and (pointer: fine) {
 *         .hoverable\:border-brand { border-color: var(--c-brand); }   ← KHÔNG có :hover
 *       }
 *
 *   Mệnh đề media chỉ lọc *thiết bị*, không lọc *trạng thái*. Nên trên MỌI laptop/desktop —
 *   vốn thoả `(hover: hover)` + `(pointer: fine)` — mọi lớp `hoverable:*` được áp VĨNH VIỄN,
 *   không cần rê chuột:
 *     • mọi ô chạm (`border-line` + `hoverable:border-brand`) mất viền xám trung tính và
 *       thành MÀU TÍM BRAND thường trực ⇒ mất hẳn tín hiệu "đang trỏ tới";
 *     • `hoverable:brightness-105` / `brightness-[1.02]` làm mọi nút/thẻ SÁNG hơn 5% vĩnh viễn;
 *     • `hoverable:bg-surface-raised` đổi nền tab đang chọn ở `BottomNav` vĩnh viễn.
 *
 *   Trên iPad/điện thoại thì không thấy gì (media không khớp) ⇒ **lỗi chỉ hiện trên 1 trong 4
 *   thiết bị đích**, và không cổng nào bắt được: `tsc`/eslint/test jsdom đều không chạy CSS.
 *   Chỉ đo `getComputedStyle().borderTopColor` trên trình duyệt thật mới lộ ra: lớp có cả
 *   `border-line` lẫn `hoverable:border-brand`, `isHovered === false`, mà viền vẫn ra đúng
 *   mã màu brand đang khai trong `tokens.css` (`rgb(200, 30, 99)` với bảng màu hồng hiện tại —
 *   con số này đổi theo brand, nên kiểm bằng `getComputedStyle` chứ đừng chép lại vào test).
 *
 *   `{ &:hover }` làm selector thành `.hoverable\:border-brand:hover` — độ ưu tiên (0,2,0) cao
 *   hơn `.border-line` (0,1,0), nên ghi đè ĐÚNG LÚC rê chuột và thôi ghi đè khi buông ra.
 *   `tests/unit/client/tailwind-hoverable-variant.test.ts` giữ cho dòng này không bị bỏ quên.
 */
const hoverableVariant: PluginCreator = ({ addVariant }) => {
  addVariant('hoverable', '@media (hover: hover) and (pointer: fine) { &:hover }');
};

// RubyLingo — Tailwind: 5 breakpoint responsive (điện thoại dọc -> laptop lớn)
// Nguồn chân lý cho màu/cỡ chữ là CSS variables trong src/styles/tokens.css.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      xs: '360px', // điện thoại nhỏ (iPhone SE, Android phổ thông)
      sm: '480px', // điện thoại lớn
      md: '768px', // tablet dọc
      lg: '1024px', // tablet ngang / laptop nhỏ
      xl: '1366px', // laptop
    },
    extend: {
      colors: {
        // Đổi theme tập trung: mọi màu đều trỏ về CSS variable
        brand: {
          DEFAULT: 'var(--c-brand)',
          soft: 'var(--c-brand-soft)',
          tint: 'var(--c-brand-tint)',
          pop: 'var(--c-brand-pop)',
          strong: 'var(--c-brand-strong)',
        },
        /**
         * Tông màu RIÊNG CỦA TỪNG CHỦ ĐỀ — đọc từ 4 biến CỤC BỘ `--c-accent*`.
         *
         * ⭐ VÌ SAO ĐI VÒNG QUA BIẾN CỤC BỘ THAY VÌ KHAI 44 MÀU Ở ĐÂY:
         *   Có 11 chủ đề × 4 vai = 44 giá trị. Khai thẳng ở đây thì mỗi lần thêm chủ đề phải
         *   sửa 4 chỗ trong file này, và 44 tên màu không bao giờ được dùng đúng tên. Thay vào
         *   đó, component đặt `style={{ '--c-accent': 'var(--c-th-at-the-zoo)' }}` trên phần tử
         *   gốc, rồi chỉ dùng 4 class CỐ ĐỊNH: `border-th`, `text-th-ink`, `bg-th-soft`,
         *   `from-th-soft`. Thêm chủ đề mới = thêm 4 dòng vào `tokens.css`, KHÔNG sửa file này.
         *
         *   Giá trị màu vẫn nằm duy nhất ở `tokens.css` ⇒ không phá quy ước "một nguồn chân lý".
         *
         * ⚠️ `text-th-ink` + `text-kid-xs` đi qua `cn()` an toàn — đã đo, không bị `tailwind-merge`
         *    nuốt (xem skill `css-silent-failures`, nhánh 2).
         * ⚠️ KHÔNG viết `bg-th/10` — `--c-th-*` là mã hex, hậu tố độ mờ sẽ sinh CSS không hợp lệ
         *    và nền thành trong suốt (xem ghi chú "Nền nhạt của màu ngữ nghĩa" ở trên).
         * ⚠️⚠️ GIÁ TRỊ gán cho `--c-accent*` phải là một tham chiếu `var(...)` HOÀN CHỈNH, không
         *    phải TÊN biến. `--c-accent: --c-th-at-the-zoo` (thiếu `var(`) là CSS **hợp lệ** nên
         *    trình duyệt im lặng, rồi tới chỗ dùng mới hỏng: `color` về màu thừa hưởng,
         *    `background-color` về trong suốt. Đã xảy ra thật — xem `src/lib/themeAccent.ts`.
         */
        th: {
          DEFAULT: 'var(--c-accent)',
          ink: 'var(--c-accent-ink)',
          soft: 'var(--c-accent-soft)',
          tint: 'var(--c-accent-tint)',
        },
        /**
         * Màu phần thưởng. `-ink` là bản dùng cho CHỮ (đủ tối để đạt AA trên nền sáng);
         * bản không hậu tố dùng cho NỀN và HÌNH — xem ghi chú trong `tokens.css`.
         */
        star: {
          DEFAULT: 'var(--c-star)',
          ink: 'var(--c-star-ink)',
          soft: 'var(--c-star-soft)',
        },
        acorn: 'var(--c-acorn)',
        heart: {
          DEFAULT: 'var(--c-heart)',
          ink: 'var(--c-heart-ink)',
        },
        surface: {
          DEFAULT: 'var(--c-surface)',
          raised: 'var(--c-surface-raised)',
          sunken: 'var(--c-surface-sunken)',
        },
        ink: {
          DEFAULT: 'var(--c-ink)',
          soft: 'var(--c-ink-soft)',
          faint: 'var(--c-ink-faint)',
          inverse: 'var(--c-ink-inverse)',
        },
        success: {
          DEFAULT: 'var(--c-success)',
          /** Nền nhạt — xem ghi chú "Nền nhạt của màu ngữ nghĩa" trong `tokens.css`. */
          soft: 'var(--c-success-soft)',
        },
        warn: {
          DEFAULT: 'var(--c-warn)',
          /** Bản dùng cho CHỮ — `--c-warn` chỉ đạt 3,02:1 trên nền `raised`, trượt AA 4,5:1. */
          ink: 'var(--c-warn-ink)',
          soft: 'var(--c-warn-soft)',
        },
        danger: {
          DEFAULT: 'var(--c-danger)',
          soft: 'var(--c-danger-soft)',
        },
        line: 'var(--c-line)',
        /**
         * Lớp phủ mờ cho overlay. Đã bao gồm sẵn độ trong suốt nên dùng trần `bg-scrim`,
         * KHÔNG dùng `bg-scrim/50` — xem ghi chú trong `tokens.css`.
         */
        scrim: 'var(--c-scrim)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
      },
      fontSize: {
        // Thang cỡ chữ cho trẻ: không nhỏ hơn 16px, nội dung chính >= 24px
        'kid-xs': ['var(--fs-xs)', { lineHeight: '1.4' }],
        'kid-sm': ['var(--fs-sm)', { lineHeight: '1.4' }],
        'kid-md': ['var(--fs-md)', { lineHeight: '1.35' }],
        'kid-lg': ['var(--fs-lg)', { lineHeight: '1.3' }],
        'kid-xl': ['var(--fs-xl)', { lineHeight: '1.25' }],
        'kid-2xl': ['var(--fs-2xl)', { lineHeight: '1.2' }],
        'kid-3xl': ['var(--fs-3xl)', { lineHeight: '1.15' }],
      },
      borderRadius: {
        kid: 'var(--r-kid)',
        /** Thẻ lớn (thẻ chủ đề, dải tóm tắt) — bo nhiều hơn để trông mềm, "đồ chơi". */
        card: 'var(--r-card)',
        pill: '9999px',
      },
      boxShadow: {
        kid: 'var(--sh-kid)',
        'kid-lg': 'var(--sh-kid-lg)',
        /** Quầng hồng dưới thẻ chủ đề — tạo nổi khối mà bóng xám không làm được. */
        brand: 'var(--sh-brand)',
        pop: 'var(--sh-pop)',
      },
      spacing: {
        // Vùng chạm tối thiểu cho bé: 64px (chính 88px)
        touch: 'var(--sp-touch)',
        'touch-lg': 'var(--sp-touch-lg)',
      },
      minHeight: {
        touch: 'var(--sp-touch)',
        'touch-lg': 'var(--sp-touch-lg)',
      },
      minWidth: {
        touch: 'var(--sp-touch)',
        'touch-lg': 'var(--sp-touch-lg)',
      },
      /**
       * Tiện ích `size-*` (Tailwind 3.4) đọc từ `theme.size`. Thêm hai bậc vùng chạm vào đây để
       * viết được `size-touch` thay vì phải ghép `min-h-touch min-w-touch` ở mọi chỗ.
       * `extend` nên các bậc mặc định của `size-*` (size-4, size-6...) vẫn dùng được.
       */
      size: {
        touch: 'var(--sp-touch)',
        'touch-lg': 'var(--sp-touch-lg)',
      },
      transitionDuration: {
        kid: '180ms',
      },
      zIndex: {
        nav: '40',
        overlay: '60',
        toast: '80',
      },
    },
  },
  plugins: [
    hoverableVariant,
  ],
} satisfies Config;
