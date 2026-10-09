/**
 * RubyLingo — chốt chặn cho `themeAccent`: tầng tông màu riêng của từng chủ đề.
 *
 * ⭐⭐ VÌ SAO CẦN TỆP NÀY — MỘT LỖI CÓ THẬT, ĐÃ LỌT QUA **MỌI** CỔNG KIỂM:
 *
 *   `themeAccentStyle()` phải trả về một tham chiếu `var(...)` hoàn chỉnh:
 *
 *       '--c-accent': 'var(--c-th-at-the-zoo)'      ← ĐÚNG
 *       '--c-accent':   '--c-th-at-the-zoo'         ← SAI, và đây là bản đã viết ra
 *
 *   Bản SAI không phải lỗi cú pháp. Với custom property, trình duyệt cho phép giá trị là chuỗi
 *   token BẤT KỲ, nên `--c-accent: --c-th-at-the-zoo;` là CSS **HOÀN TOÀN HỢP LỆ**. Nó chỉ nổ ở
 *   chỗ dùng, và nổ theo hai kiểu đều KHÓ NHÌN:
 *
 *     `color: var(--c-accent-ink)`            → `color: --c-th-at-the-zoo-ink`
 *       ⇒ không hợp lệ cho `color` ⇒ khai báo bị bỏ ⇒ `color` **thừa hưởng** từ cha
 *       ⇒ chữ ra đúng màu mực thường `--c-ink`, nhìn KHÔNG có gì bất thường.
 *     `background-color: var(--c-accent-soft)` → không hợp lệ ⇒ **trong suốt**
 *       ⇒ nền chip mất, nhưng chip vẫn còn viền và chữ nên vẫn "ra hình".
 *
 *   Hệ quả: cả 11 tông màu chủ đề BIẾN MẤT khỏi giao diện. Và:
 *
 *     ✔ `tsc`                          xanh
 *     ✔ `eslint`                       xanh
 *     ✔ 729 unit test                  xanh
 *     ✔ `npm run build`                xanh
 *     ✔ CSS sinh ra ĐÚNG — `text-th-ink { color: var(--c-accent-ink) }` nằm trong tệp hoàn hảo
 *     ✔ ảnh chụp màn hình             không có lỗi cú pháp nào để nhìn thấy
 *
 *   Cách duy nhất bắt được: ĐO `getComputedStyle(el).color` trên trình duyệt thật rồi so với mã
 *   hex trong `tokens.css`. Đó là việc của khẳng định ⑨ — nó canh đúng cái dạng đã hỏng, nên
 *   lần sau ai viết lại thành tên biến trần là CI đỏ ngay, không cần mở trình duyệt.
 *
 * ⚠️ Test này ĐỌC TỆP THẬT (`tokens.css`) chứ không mock: tên biến sinh ra phải TỒN TẠI.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ACCENT_SUFFIXES,
  THEME_ACCENT_IDS,
  hasThemeAccent,
  themeAccentStyle,
  themeAccentVar,
  type AccentSuffix,
} from '../../../src/lib/themeAccent.js';

const ROOT = process.cwd() + '/';
const TOKENS_CSS = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8');

/** Mọi biến `--x` được KHAI trong `tokens.css`. */
function declaredVariables(css: string): Set<string> {
  return new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1] as string));
}

/**
 * Dạng BẮT BUỘC của một giá trị gán cho biến cục bộ: một tham chiếu `var(--c-…)` hoàn chỉnh.
 * Đây chính là dạng mà bản lỗi đã vi phạm (nó thiếu cả `var(` lẫn `)`).
 */
const HOP_LE = /^var\(--c-[a-z0-9-]+\)$/;

const declared = declaredVariables(TOKENS_CSS);

describe('themeAccent — giá trị gán cho biến cục bộ PHẢI là tham chiếu var() hoàn chỉnh', () => {
  it('⑨ mọi vai của mọi chủ đề đều là `var(--c-…)`, KHÔNG BAO GIỜ là tên biến trần', () => {
    const viPham: string[] = [];

    for (const id of THEME_ACCENT_IDS) {
      const style = themeAccentStyle(id) as Record<string, string>;
      for (const suffix of ACCENT_SUFFIXES) {
        const name = `--c-accent${suffix}`;
        const value = style[name];
        if (typeof value !== 'string' || !HOP_LE.test(value)) {
          viPham.push(`${id}${suffix}: ${name} = ${JSON.stringify(value)}`);
        }
      }
    }

    expect(
      viPham,
      `giá trị KHÔNG phải tham chiếu var() hoàn chỉnh:\n  ${viPham.join('\n  ')}\n` +
        '⇒ `--c-accent: --c-th-…` là CSS HỢP LỆ nên trình duyệt không báo gì, nhưng tới chỗ dùng\n' +
        '   (`color: var(--c-accent-ink)`) thì thành `color: --c-th-…-ink` — không hợp lệ cho\n' +
        '   `color` ⇒ khai báo bị bỏ ⇒ chữ THỪA HƯỞNG màu mực thường, nền thành TRONG SUỐT.\n' +
        '   Cả 11 tông màu biến mất mà tsc/eslint/729 test/build đều xanh.',
    ).toEqual([]);
  });

  it('⑩ mỗi chủ đề trỏ tới ĐÚNG 4 token của chính nó (không rơi về màu thương hiệu)', () => {
    const viPham: string[] = [];

    for (const id of THEME_ACCENT_IDS) {
      const style = themeAccentStyle(id) as Record<string, string>;
      for (const suffix of ACCENT_SUFFIXES) {
        const want = `var(--c-th-${id}${suffix})`;
        const got = style[`--c-accent${suffix}`];
        if (got !== want) viPham.push(`${id}: --c-accent${suffix} = ${JSON.stringify(got)}, mong đợi ${want}`);
      }
    }

    expect(
      viPham,
      `chủ đề không trỏ tới token của chính nó:\n  ${viPham.join('\n  ')}\n` +
        '⇒ tông riêng của chủ đề bị thay bằng màu khác ⇒ "mỗi chủ đề một tông màu riêng" mất tác dụng.',
    ).toEqual([]);
  });

  it('⑪ tên biến trần (không có `var(`) LÀ SAI — khoá lại đúng dạng đã từng hỏng', () => {
    // Khẳng định trực tiếp trên hàm sinh tên: nó phải trả về một GIÁ TRỊ dùng được, không phải
    // một cái tên. Nếu ai đó "sửa" `themeAccentVar` về lại bản trần, test này đỏ ngay.
    for (const id of THEME_ACCENT_IDS) {
      for (const suffix of ACCENT_SUFFIXES) {
        const value = themeAccentVar(id, suffix as AccentSuffix);
        expect(value, `${id}${suffix} → ${value}`).toMatch(HOP_LE);
        expect(value, `${id}${suffix} không được là tên biến trần`).not.toBe(`--c-th-${id}${suffix}`);
      }
    }
  });

  it('⑫ chủ đề LẠ vẫn phải ra `var(--c-…)` (phương án hai), không bao giờ ra tên biến trần', () => {
    const viPham: string[] = [];

    for (const id of ['khong-ton-tai', '', 'at-the-zoo ', 'AT-THE-ZOO']) {
      expect(hasThemeAccent(id), `${JSON.stringify(id)} không được coi là chủ đề có tông`).toBe(false);
      const style = themeAccentStyle(id) as Record<string, string>;
      for (const suffix of ACCENT_SUFFIXES) {
        const value = style[`--c-accent${suffix}`];
        if (typeof value !== 'string' || !HOP_LE.test(value)) {
          viPham.push(`${JSON.stringify(id)}${suffix}: ${JSON.stringify(value)}`);
        }
      }
    }

    expect(
      viPham,
      `chủ đề lạ không rơi về phương án hai hợp lệ:\n  ${viPham.join('\n  ')}\n` +
        '⇒ chủ đề mới thêm vào `level.json` mà quên tông màu sẽ ra NỀN TRONG SUỐT thay vì màu\n' +
        '   thương hiệu — hỏng im lặng đúng như ghi chú đầu tệp `themeAccent.ts`.',
    ).toEqual([]);
  });

  it('⑬ mọi tên biến `themeAccentVar` sinh ra đều có THẬT trong tokens.css', () => {
    const viPham: string[] = [];

    for (const id of THEME_ACCENT_IDS) {
      for (const suffix of ACCENT_SUFFIXES) {
        const value = themeAccentVar(id, suffix as AccentSuffix);
        const name = value.slice('var('.length, -1);
        if (!declared.has(name)) viPham.push(`${id}${suffix} → ${name} không có trong tokens.css`);
      }
    }

    expect(
      viPham,
      `trỏ tới biến không tồn tại:\n  ${viPham.join('\n  ')}\n` +
        '⇒ `var()` không phân giải được ⇒ khai báo không hợp lệ tại thời điểm tính toán ⇒\n' +
        '   `border-color` về `currentColor`, `background-color` về trong suốt. Im lặng.',
    ).toEqual([]);
  });
});
