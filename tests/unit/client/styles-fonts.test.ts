/**
 * RubyLingo — canh cho font hiển thị THẬT SỰ được nạp.
 *
 * ⭐⭐ VÌ SAO CẦN TEST NÀY — ĐÂY KHÔNG PHẢI LỖI GIẢ ĐỊNH:
 *
 *   `tokens.css` đã khai `--font-display: 'Baloo 2', 'Nunito', …` từ đầu dự án, và khai như
 *   thế là ĐÚNG về mặt cú pháp. Nhưng chưa từng có tệp font nào, chưa từng có `@font-face`.
 *   Trình duyệt gặp tên font không tồn tại thì **im lặng rơi về font hệ thống** — không cảnh
 *   báo, không lỗi, không màn hình trắng. Cả app đã chạy bằng Segoe UI trong nhiều nhóm task
 *   mà không ai biết, vì `tsc`, eslint, jsdom đều KHÔNG tải font.
 *
 *   Đây là cùng một loại lỗi với `hoverable:` (xem `tailwind-hoverable-variant.test.ts`):
 *   khai báo TRÔNG đúng, hành vi SAI, và mọi cổng kiểm tĩnh đều đi qua.
 *
 *   Phát hiện lần này là nhờ đo bằng Chrome thật (`document.fonts.check`), không phải nhờ test.
 *   Test này tồn tại để lần sau không phải đo lại bằng tay.
 *
 * ⚠️ BỐN CÁCH HỎNG NÓ PHẢI BẮT ĐƯỢC (đã thử từng cách, xem mục "kiểm chứng" ở nhật ký):
 *   1. Xoá dòng `@import './fonts.css'` khỏi `index.css`  ⇒ font không bao giờ tải.
 *   2. Đặt `@import './fonts.css'` SAU `@tailwind …` ⇒ CSS bỏ qua `@import` một cách im lặng.
 *   3. Trỏ `url()` sai tên tệp, hoặc tệp font bị xoá khỏi `public/fonts/` ⇒ 404, rơi về hệ thống.
 *   4. Sửa `tokens.css` để không còn dùng hai họ đó ⇒ font tải về mà không ai dùng.
 *
 * ⚠️ Nếu test này đỏ thì sửa NGUỒN, đừng sửa test.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Gốc repo `rubylingo/` — Vitest luôn chạy với cwd = gốc repo.
 *
 * ⚠️ KHÔNG dùng `fileURLToPath(new URL('../../../', import.meta.url))`: dưới Vitest
 * `import.meta.url` không mang scheme `file:` nên ném `TypeError: The URL must be of
 * scheme file` — test đỏ vì hạ tầng chứ không vì sản phẩm, đúng kiểu lỗi làm người ta
 * mất niềm tin vào test. Các test khác trong repo cũng dùng `process.cwd()`.
 */
const ROOT = process.cwd() + '/';

function doc(rel: string): string {
  return readFileSync(ROOT + rel, 'utf8');
}

/** Bỏ chú thích `/* … *\/` để không bắt nhầm chữ nằm trong ghi chú. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

const indexCss = doc('src/styles/index.css');
const fontsCss = doc('src/styles/fonts.css');
const tokensCss = doc('src/styles/tokens.css');

describe('Font hiển thị — tự host, và phải THẬT SỰ được nạp', () => {
  it('index.css nhập fonts.css TRƯỚC tokens.css, và trước mọi quy tắc khác', () => {
    const clean = stripComments(indexCss);

    const iFonts = clean.indexOf("@import './fonts.css'");
    const iTokens = clean.indexOf("@import './tokens.css'");

    expect(iFonts, "index.css thiếu `@import './fonts.css'` — font không bao giờ được nạp").toBeGreaterThanOrEqual(0);
    expect(iTokens).toBeGreaterThanOrEqual(0);
    expect(iFonts, 'fonts.css phải đứng trước tokens.css').toBeLessThan(iTokens);

    // Theo đặc tả CSS, `@import` chỉ hợp lệ khi nằm trước mọi quy tắc khác.
    // Đặt nó sau `@tailwind` (hoặc sau bất kỳ rule nào) thì trình duyệt BỎ QUA im lặng.
    const truocImportDau = clean.slice(0, iFonts);
    expect(
      truocImportDau.trim(),
      'chỉ được có @import ở đầu index.css — chèn sau một quy tắc thì CSS bỏ qua nó',
    ).toBe('');
  });

  it('fonts.css khai đủ hai họ font, mỗi mặt chữ có font-display và unicode-range', () => {
    const faces = [...fontsCss.matchAll(/@font-face\s*\{([\s\S]*?)\}/g)].map((m) => m[1]);
    expect(faces.length, 'fonts.css không có @font-face nào').toBeGreaterThan(0);

    for (const ho of ['Baloo 2', 'Nunito']) {
      expect(fontsCss, `thiếu @font-face cho "${ho}"`).toContain(`font-family: '${ho}'`);
    }

    for (const body of faces) {
      expect(body, '@font-face thiếu font-display: swap (sẽ chặn hiển thị chữ)').toMatch(
        /font-display:\s*swap/,
      );
      expect(body, '@font-face thiếu unicode-range (mọi tập con đều bị tải)').toMatch(
        /unicode-range\s*:/,
      );
    }
  });

  it('mọi tệp font được trỏ tới đều CÓ THẬT trên đĩa', () => {
    // `m[1]` mang kiểu `string | undefined` (noUncheckedIndexedAccess). Nhóm bắt buộc
    // trong regex luôn có khi khớp, nhưng vẫn lọc tường minh thay vì dùng `!` — để nếu
    // ai đó sửa regex thành nhóm tuỳ chọn thì test báo thiếu, chứ không lặng lẽ bỏ qua.
    const urls = [...fontsCss.matchAll(/url\('(\/fonts\/[^']+)'\)/g)]
      .map((m) => m[1])
      .filter((u): u is string => typeof u === 'string');

    expect(urls.length, 'fonts.css không trỏ tới tệp font nào').toBeGreaterThan(0);

    const thieu = urls.filter((u) => !existsSync(join(ROOT, 'public', u)));
    expect(thieu, `tệp font thiếu trên đĩa: ${thieu.join(', ')}`).toEqual([]);
  });

  it('tokens.css thật sự DÙNG hai họ đó (nếu không thì tải về mà không ai dùng)', () => {
    const display = /--font-display:\s*([^;]+);/.exec(tokensCss)?.[1] ?? '';
    const body = /--font-body:\s*([^;]+);/.exec(tokensCss)?.[1] ?? '';

    expect(display, '--font-display phải dùng "Baloo 2"').toContain("'Baloo 2'");
    expect(body, '--font-body phải dùng "Nunito"').toContain("'Nunito'");
  });
});
