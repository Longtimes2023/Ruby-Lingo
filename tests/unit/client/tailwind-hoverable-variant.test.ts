/**
 * RubyLingo — giữ cho biến thể `hoverable:` KHÔNG áp vĩnh viễn trên laptop/desktop.
 *
 * ⭐⭐ VÌ SAO PHẢI BIÊN DỊCH CSS THẬT, KHÔNG CHỈ ĐỌC FILE CONFIG:
 *
 *   Lỗi gốc không nằm ở chỗ "quên chữ nào" — nó nằm ở CHUỖI CSS SINH RA. Config khai
 *
 *       addVariant('hoverable', '@media (hover: hover) and (pointer: fine)')
 *
 *   trông rất hợp lý khi đọc, và Tailwind cũng không báo gì. Chỉ khi biên dịch mới thấy nó ra
 *
 *       @media (hover: hover) and (pointer: fine) {
 *         .hoverable\:border-brand { border-color: var(--c-brand); }
 *       }
 *
 *   — KHÔNG có `:hover`. Mệnh đề media lọc *thiết bị*, không lọc *trạng thái*, nên trên mọi
 *   laptop/desktop (thoả `hover: hover` + `pointer: fine`) mọi lớp `hoverable:*` được áp VĨNH
 *   VIỄN: mọi ô chạm mất viền xám trung tính và thành tím brand thường trực, mọi nút sáng hơn
 *   5%, tab `BottomNav` đổi nền luôn. Trên iPad/điện thoại thì không thấy gì ⇒ **lỗi chỉ hiện
 *   trên 1 trong 4 thiết bị đích**, và `tsc` / eslint / jsdom đều KHÔNG chạy CSS nên không cổng
 *   nào bắt được. Phát hiện được là nhờ đo `getComputedStyle().borderTopColor` trên Chrome thật:
 *   lớp có cả `border-line` lẫn `hoverable:border-brand`, `isHovered === false`, mà viền vẫn ra
 *   đúng mã màu brand đang khai trong `tokens.css` (`rgb(200, 30, 99)` với bảng màu hồng hiện
 *   tại — con số này đổi theo brand nên đừng chép nó vào một khẳng định).
 *
 *   Nên test này KHÔNG khẳng định "chuỗi config có chữ `:hover`" (cách đó vẫn cho qua một biến
 *   thể viết đúng chữ nhưng sai chỗ, và vỡ ngay khi ai đó đổi cách khai). Nó chạy đúng đường
 *   ống thật: `postcss` + `tailwindcss` + `tailwind.config.ts` ⇒ soi CSS đầu ra.
 *
 * ⚠️ Nếu test này đỏ, TUYỆT ĐỐI không sửa test cho khớp. Sửa `hoverableVariant` trong
 *   `tailwind.config.ts` thành `'@media (hover: hover) and (pointer: fine) { &:hover }'`.
 */

import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { describe, expect, it } from 'vitest';

import config from '../../../tailwind.config.js';

/** Biên dịch CHỈ các utility cần thiết — `content` giả để Tailwind không quét cả repo. */
async function compileUtilities(classNames: string): Promise<string> {
  const result = await postcss([
    tailwindcss({
      ...config,
      content: [{ raw: `<div class="${classNames}"></div>`, extension: 'html' }],
    }),
  ]).process('@tailwind utilities;', { from: undefined });

  return result.css;
}

interface MatchedRule {
  selector: string;
  /** Mệnh đề `@media` bao quanh, hoặc `null` nếu rule nằm ở gốc. */
  media: string | null;
}

/**
 * Hình dạng tối thiểu của một node postcss khi chỉ cần LẦN NGƯỢC LÊN để tìm `@media` bao quanh.
 *
 * ⚠️ Vì sao không dùng thẳng `rule.parent`: kiểu của postcss là
 *   `Container | Document | undefined`, và mỗi bước `node.parent` lại là một union khác —
 *   `tsc` báo `Document_` không gán được cho `ContainerWithChildren`. Ta chỉ cần `type`/`name`/
 *   `params`/`parent`, nên khai đúng bấy nhiêu là đủ và không phải viết `any`.
 */
interface CssNode {
  type: string;
  name?: string;
  params?: string;
  parent?: CssNode;
}

/** Mọi rule có selector chứa `className` (đã ở dạng đã escape, vd `hoverable\:border-brand`). */
function rulesFor(css: string, className: string): MatchedRule[] {
  const out: MatchedRule[] = [];

  postcss.parse(css).walkRules((rule) => {
    if (!rule.selector.includes(className)) return;

    // Đi từ gần ra xa; biến thể này chỉ lồng đúng một `@media`, nên gán đè là đủ.
    let media: string | null = null;
    for (let node = rule.parent as CssNode | undefined; node; node = node.parent) {
      if (node.type === 'atrule' && node.name === 'media') media = String(node.params);
    }
    out.push({ selector: rule.selector, media });
  });

  return out;
}

describe('biến thể `hoverable:` — phải là :hover THẬT, không phải chỉ lọc thiết bị', () => {
  it('mọi selector `hoverable:*` sinh ra đều mang `:hover`', async () => {
    /**
     * Hai lớp đại diện cho hai họ dùng nhiều nhất: đổi VIỀN (mọi ô chạm trong game) và đổi
     * ĐỘ SÁNG (mọi nút / thẻ chủ đề). Nếu chỉ kiểm một lớp, một biến thể hỏng cục bộ vẫn lọt.
     */
    const css = await compileUtilities('hoverable:border-brand hoverable:brightness-105');

    for (const className of ['hoverable\\:border-brand', 'hoverable\\:brightness-105']) {
      const rules = rulesFor(css, className);

      // Không sinh ra rule nào ⇒ tên biến thể sai, hoặc Tailwind không thấy lớp. Cả hai đều hỏng.
      expect(rules.length, `không sinh ra rule nào cho "${className}"`).toBeGreaterThan(0);

      for (const rule of rules) {
        expect(
          rule.selector,
          `selector "${rule.selector}" THIẾU :hover ⇒ lớp này sẽ áp VĨNH VIỄN trên mọi ` +
            `laptop/desktop, không cần rê chuột.`,
        ).toContain(':hover');
      }
    }
  });

  it('vẫn nằm trong `@media (hover: hover) and (pointer: fine)` để iPad/điện thoại không dính', async () => {
    const css = await compileUtilities('hoverable:border-brand');
    const rules = rulesFor(css, 'hoverable\\:border-brand');

    expect(rules.length).toBeGreaterThan(0);

    for (const rule of rules) {
      // Thiếu mệnh đề media ⇒ `:hover` dính chặt trên cảm ứng (đúng thứ biến thể này sinh ra
      // để tránh: bé chạm xong nút vẫn "kẹt" ở trạng thái rê chuột).
      expect(rule.media, `"${rule.selector}" không nằm trong @media`).not.toBeNull();
      expect(rule.media).toContain('hover: hover');
      expect(rule.media).toContain('pointer: fine');
    }
  });
});
