/**
 * RubyLingo — canh giữ cơ chế "biểu tượng từ vựng LẤP ĐẦY khung" (T03, §B.2 của THIET-KE).
 *
 * ⭐ VÌ SAO PHẢI CÓ MỘT TEST QUÉT NGUỒN, KHÔNG CHỈ TEST RENDER:
 *   jsdom KHÔNG chạy CSS và KHÔNG tính layout ⇒ mọi test render đều XANH dù biểu tượng vẫn teo
 *   tí xíu. Lỗi thật ở đây là loại "khai báo trông đúng nhưng hành vi sai":
 *     • quên `container-type: inline-size` trên `.wi-frame` ⇒ `cqw` không phân giải, cỡ về 0;
 *     • quên `@supports` ⇒ mất đường dự phòng cho trình duyệt cũ;
 *     • quên 1 trong 5 chỗ gọi ⇒ đúng chỗ đó vẫn hiện biểu tượng bé như trước (im lặng);
 *     • để lại lớp `text-[…]` ở chỗ gọi ⇒ gây nhầm lẫn (dù bị `.wi-fill` ghi đè).
 *   Không cổng nào khác bắt được bốn thứ đó. Test này ĐỌC TỆP THẬT TRÊN ĐĨA và hỏi đúng một câu:
 *   "cơ chế lấp khung có còn nguyên vẹn không?"
 *
 * ⚠️ Test này đỏ thì sửa NGUỒN (CSS / chỗ gọi), TUYỆT ĐỐI không nới test ra.
 * ⚠️ Đo THẬT tỉ lệ `img.width / frame.width` phải làm bằng Playwright (xem §F.2) — jsdom bó tay.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Gốc repo `rubylingo/`.
 *
 * ⚠️ KHÔNG dùng `fileURLToPath(new URL('../../../', import.meta.url))`: dưới Vitest,
 * `import.meta.url` không mang scheme `file:` ⇒ `TypeError`. Đây là bẫy đã trả giá ở
 * `styles-fonts.test.ts` / `styles-tokens.test.ts`.
 */
const ROOT = process.cwd() + '/';

function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf8');
}

const WORD_ICON_CSS = read('src/styles/word-icon.css');
const TOKENS_CSS = read('src/styles/tokens.css');
const INDEX_CSS = read('src/styles/index.css');

/** 5 chỗ gọi `WordIcon` phải bọc biểu tượng trong khung `.wi-frame` + lớp `.wi-fill`. */
const CALL_SITES = [
  'src/components/games/listen-tap/ListenTapGame.tsx',
  'src/components/games/word-picture/WordPictureGame.tsx',
  'src/components/games/memory-match/MemoryMatchGame.tsx',
  'src/components/games/missing-letter/MissingLetterGame.tsx',
  'src/pages/FlashcardPage.tsx',
] as const;

describe('word-icon.css — cơ chế container-query lấp đầy khung', () => {
  it('`.wi-frame` mở container bằng `container-type: inline-size` (KHÔNG phải `size`)', () => {
    expect(WORD_ICON_CSS).toContain('container-type: inline-size');
    // `size` sẽ sập chiều cao thẻ flashcard — khoá lại để không ai "đổi cho gọn".
    expect(WORD_ICON_CSS).not.toMatch(/container-type:\s*size\s*;/);
  });

  it('`.wi-fill` có dự phòng CỠ TUYỆT ĐỐI (KHÔNG dùng `1em`) + `@supports (font-size: 1cqw)`', () => {
    // ⚠️ Chỉnh sửa bắt buộc #1: dự phòng PHẢI là cỡ tuyệt đối (~56px), KHÔNG `1em` — vì các lớp
    //    `text-[…]` ở 5 chỗ gọi đã bị gỡ, `1em` sẽ tụt về cỡ chữ thừa hưởng (~16px).
    expect(WORD_ICON_CSS).toMatch(/font-size:\s*3\.5rem/);
    expect(WORD_ICON_CSS).not.toMatch(/font-size:\s*1em/);

    expect(WORD_ICON_CSS).toContain('@supports (font-size: 1cqw)');
    expect(WORD_ICON_CSS).toContain('var(--fs-icon-fill)');
  });

  it('`.wi-fill` dùng flex + line-height: 1 để ảnh và emoji cùng canh giữa', () => {
    expect(WORD_ICON_CSS).toMatch(/\.wi-fill\s*\{[^}]*display:\s*flex/);
    expect(WORD_ICON_CSS).toMatch(/line-height:\s*1\s*;/);
  });
});

describe('tokens.css — nguồn chân lý cho cỡ biểu tượng', () => {
  it('khai `--fs-icon-fill: 82cqw`', () => {
    expect(TOKENS_CSS).toMatch(/--fs-icon-fill:\s*82cqw\s*;/);
  });
});

/**
 * Bỏ CHÚ THÍCH KHỐI trong CSS trước khi dò vị trí chỉ thị.
 *
 * ⭐ VÌ SAO BẮT BUỘC: chính chú thích đầu `index.css` PHẢI viết ra chuỗi `@tailwind base` để
 *   giải thích vì sao thứ tự quan trọng. Nếu dò trên văn bản thô, `indexOf('@tailwind base')`
 *   khớp vào DÒNG CHÚ THÍCH (nằm trước các `@import`) ⇒ test đỏ dù thứ tự thật HOÀN TOÀN ĐÚNG.
 *   Một khẳng định đỏ vì lý do sai còn tệ hơn không có — nên phải soi phần MÃ, không soi văn xuôi.
 */
function stripBlockComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('index.css — `@import` phải đứng TRƯỚC `@tailwind base`', () => {
  it('nạp `word-icon.css` và mọi `@import` nằm trên `@tailwind base`', () => {
    const code = stripBlockComments(INDEX_CSS);
    const importIndex = code.indexOf("@import './word-icon.css'");
    const tailwindIndex = code.indexOf('@tailwind base');

    expect(importIndex, 'index.css phải có @import word-icon.css').toBeGreaterThanOrEqual(0);
    expect(tailwindIndex).toBeGreaterThanOrEqual(0);
    // Nếu `@import` nằm SAU `@tailwind base`, trình duyệt BỎ QUA nó im lặng.
    expect(importIndex).toBeLessThan(tailwindIndex);
  });
});

describe('5 chỗ gọi WordIcon đều có cả `.wi-frame` lẫn `.wi-fill`', () => {
  it.each(CALL_SITES)('%s', (relPath) => {
    const source = read(relPath);
    expect(source, `${relPath} thiếu "wi-frame"`).toContain('wi-frame');
    expect(source, `${relPath} thiếu "wi-fill"`).toContain('wi-fill');
  });

  it('KHÔNG còn lớp cỡ chữ `text-[…px]` nào bọc quanh WordIcon (đã chuyển sang .wi-fill)', () => {
    /**
     * ⚠️ Các lớp `text-[56px]`/`text-[68px]`/`text-[44px]`/`text-[38px]`/`text-[80px]` PHẢI bị gỡ
     *    khỏi chỗ gọi: `.wi-fill` (CSS không nằm trong `@layer`) vốn đã ghi đè chúng, để lại chỉ
     *    gây nhầm lẫn cho người sửa sau. Khoá lại bằng test để chúng không quay về.
     */
    const stale = [
      'text-[56px]',
      'text-[64px]',
      'text-[68px]',
      'text-[44px]',
      'text-[38px]',
      'text-[80px]',
    ];
    const found: string[] = [];
    for (const relPath of CALL_SITES) {
      const source = read(relPath);
      for (const cls of stale) {
        if (source.includes(cls)) found.push(`${relPath}: ${cls}`);
      }
    }
    expect(found).toEqual([]);
  });
});
