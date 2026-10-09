/**
 * RubyLingo — `cn()`: gộp class có điều kiện + khử class Tailwind trùng nhau.
 *
 * ⭐ VÌ SAO CẦN `twMerge` CHỨ KHÔNG CHỈ `clsx`:
 *   Component nhận `className` từ bên ngoài để ghi đè. Nếu chỉ nối chuỗi thì
 *   `"rounded-kid px-4" + "px-8"` cho ra CẢ HAI class, và thứ tự thắng thua phụ thuộc
 *   vào thứ tự khai báo trong file CSS của Tailwind — không phải thứ tự trong chuỗi.
 *   Kết quả: có lúc ghi đè được, có lúc không, một cách rất khó đoán.
 *   `twMerge` hiểu ngữ nghĩa Tailwind nên `px-8` thắng `px-4` một cách xác định.
 *
 * Vì sao `clsx` đứng trong: xử lý `false`, `undefined`, mảng, object có điều kiện.
 *
 * ============================================================================
 * ⚠️⚠️ BẪY NẶNG ĐÃ TỪNG XẢY RA: `twMerge` MẶC ĐỊNH XOÁ MẤT CỠ CHỮ `text-kid-*`
 * ============================================================================
 *
 * `twMerge` chỉ biết thang cỡ chữ MẶC ĐỊNH của Tailwind (`text-xs`, `text-sm`, `text-base`…)
 * và giá trị tuỳ ý (`text-[14px]`). Với một cái tên nó không biết — như `text-kid-xs` — nó
 * rơi vào nhánh suy đoán cuối: **`text-*` nào không phải cỡ chữ thì là MÀU CHỮ**.
 *
 * Hệ quả: `cn('text-kid-xs', 'text-brand')` khiến `twMerge` tưởng hai class này CÙNG NHÓM
 * (đều là màu chữ), nên nó **xoá `text-kid-xs`** và chỉ giữ `text-brand`.
 *
 * Lỗi này KHÔNG báo ở đâu cả:
 *   - TypeScript không thấy — cả hai đều là `string`.
 *   - Tailwind không thấy — class có trong file nguồn nên CSS vẫn được sinh ra đầy đủ.
 *   - `eslint` không thấy.
 *   Chỉ có MẮT nhìn ảnh chụp màn hình mới thấy.
 *
 * Triệu chứng thực tế đã bắt được (Nhóm 4, màn bản đồ hành trình ở 1366px):
 *   Nhãn trạng thái trên thẻ chủ đề mất cỡ chữ, kế thừa 26px từ tổ tiên, nên chữ
 *   "Thẻ từ vựng" / "Chơi game" TỰ XUỐNG DÒNG bên trong viên thuốc và viên thuốc cao gấp đôi.
 *   Đo được: `pillW: 171, pillH: 86, fontSize: 26px`, và `pillClasses` **thiếu hẳn `text-kid-xs`**.
 *
 * Cách sửa: DẠY `twMerge` thang cỡ chữ của dự án (bên dưới). Sửa một chỗ, hết cho mọi nơi —
 * có 23 file dùng `text-kid-*`, và 94 dòng có nguy cơ (đứng cạnh một `text-<màu>`).
 *
 * 🔒 KHI THÊM BẬC CỠ CHỮ MỚI VÀO `tailwind.config.ts` → `theme.extend.fontSize`,
 *    PHẢI thêm tên đó vào `KID_FONT_SIZES` ở đây. Quên là lỗi quay lại.
 *    `tests/unit/client/cn.test.ts` có test đối chiếu hai danh sách này, nên quên sẽ đỏ CI.
 */

import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Các bậc cỡ chữ riêng của RubyLingo.
 *
 * Phải khớp CHÍNH XÁC với khoá trong `tailwind.config.ts` → `theme.extend.fontSize`.
 * Test `cn.test.ts` đọc thẳng file config và đối chiếu, nên lệch nhau là CI đỏ.
 */
export const KID_FONT_SIZES = [
  'kid-xs',
  'kid-sm',
  'kid-md',
  'kid-lg',
  'kid-xl',
  'kid-2xl',
  'kid-3xl',
] as const;

/**
 * `twMerge` đã được dạy thang cỡ chữ của dự án.
 *
 * `extend` (không phải ghi đè) nên thang mặc định của Tailwind vẫn nguyên vẹn:
 * `text-sm`, `text-[14px]`, `text-center`, `text-brand`… đều xử lý như cũ.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      // Khai đúng nhóm `font-size` để `text-kid-*` không bị hiểu nhầm thành màu chữ.
      'font-size': [{ text: [...KID_FONT_SIZES] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
