/**
 * RubyLingo — canh giữ BẢNG MÀU TOKEN.
 *
 * ⭐ VÌ SAO CẦN TEST NÀY (ba lỗi thật, đều im lặng tuyệt đối):
 *
 *   Toàn bộ màu của app chảy qua một đường ống hai chặng:
 *
 *       component  →  class Tailwind  →  tailwind.config.ts  →  var(--c-*)  →  tokens.css
 *
 *   Đường ống này KHÔNG có cổng nào kiểm tra. `tsc` không biết class Tailwind là gì, eslint
 *   không đọc CSS, jsdom không tính màu. Hỏng ở chặng nào cũng chỉ hiện ra trên trình duyệt —
 *   và thường hiện ra dưới dạng "không có gì cả", thứ mà mắt người đọc thành "chắc là cố ý".
 *
 *   Ba kiểu hỏng đã thực sự xảy ra trong dự án này:
 *
 *   ① Sai tên biến trong `tailwind.config.ts`
 *      `'var(--c-brnad)'` ⇒ Tailwind phát ra `background-color: var(--c-brnad)`, biến không tồn
 *      tại nên giá trị thành KHÔNG HỢP LỆ và bị bỏ ⇒ nền trong suốt. Không có thông báo nào.
 *
 *   ② Token khai trong `tokens.css` nhưng quên expose ở config
 *      Token đó là mã chết: không class nào dùng được nó, mà đọc file CSS thì vẫn thấy "có".
 *
 *   ③ Dùng hậu tố độ mờ trên màu token — `bg-success/10`
 *      Tailwind sinh `rgb(var(--c-success) / 0.1)`. Nhưng `--c-success` là mã HEX (`#16a34a`),
 *      không phải bộ ba kênh (`22 163 74`) ⇒ CSS KHÔNG HỢP LỆ ⇒ trình duyệt bỏ qua ⇒ nền trong
 *      suốt. Đã đo trên Chrome thật: `bg-success` ra `rgb(22, 163, 74)`, còn `bg-success/10` ra
 *      `rgba(0, 0, 0, 0)`. **16 chỗ** tô nền phản hồi trong các game đã hỏng theo cách này —
 *      bé chỉ thấy đổi màu viền chứ không thấy nền đổi màu.
 *      Cách đúng: dùng token `-soft` khai sẵn bằng `rgba()` (xem `tokens.css`).
 *
 *   ④ Tầng TÔNG MÀU CHỦ ĐỀ (khối test thứ hai trong tệp này)
 *      Mỗi chủ đề đổ 4 biến cục bộ `--c-accent*`, component chỉ dùng 4 class cố định
 *      (`border-th`, `text-th-ink`, `bg-th-soft`, `from-th-soft`). Sai một chữ số hex thì màu
 *      VẪN HIỆN RA BÌNH THƯỜNG — chỉ là tương phản trượt AA, hoặc hai chủ đề trùng tông. Đây là
 *      con số, không phải lỗi cú pháp ⇒ không cổng tĩnh nào bắt được. 44 mã này do
 *      `scripts/gen-theme-colors.mts` sinh; khẳng định ④–⑧ ĐỘC LẬP kiểm lại trên chính các mã
 *      đang nằm trong `tokens.css`.
 *
 * ⚠️ Test này ĐỌC TỆP THẬT TRÊN ĐĨA, không mock, không import module. Nó hỏi đúng một câu:
 *   "đường ống màu có liền mạch không?" — câu mà không cổng nào khác trả lời được.
 *
 * ⚠️ Test này đỏ thì sửa NGUỒN (config / tokens.css / component), TUYỆT ĐỐI không nới test ra.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Gốc repo `rubylingo/`.
 *
 * ⚠️ KHÔNG dùng `fileURLToPath(new URL('../../../', import.meta.url))`: dưới Vitest,
 * `import.meta.url` không mang scheme `file:` ⇒ `TypeError: The URL must be of scheme file`.
 * Đây là bẫy đã trả giá ở `styles-fonts.test.ts`.
 */
const ROOT = process.cwd() + '/';

const TOKENS_CSS = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8');
const TAILWIND_CONFIG = readFileSync(join(ROOT, 'tailwind.config.ts'), 'utf8');

/** Mọi biến `--x` được KHAI (có dấu `:`) trong `tokens.css`. */
function declaredVariables(css: string): string[] {
  return [...css.matchAll(/(--[a-z0-9-]+)\s*:/g)]
    .map((m) => m[1])
    .filter((v): v is string => typeof v === 'string');
}

/** Mọi biến `--x` được THAM CHIẾU (`var(--x)`) trong `tailwind.config.ts`. */
function referencedVariables(config: string): string[] {
  return [...config.matchAll(/var\((--[a-z0-9-]+)\)/g)]
    .map((m) => m[1])
    .filter((v): v is string => typeof v === 'string');
}

/** Danh sách tệp nguồn `.ts`/`.tsx` dưới `src/`. */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

/**
 * Bỏ các dòng CHÚ THÍCH trước khi quét.
 *
 * ⭐ Vì sao cần: chính tài liệu trong `ThemeCard.tsx` phải viết ra ví dụ SAI (`bg-ink/45`) để
 *   giải thích vì sao nó sai. Nếu quét cả chú thích thì test sẽ đỏ vì một dòng văn xuôi — và
 *   cách chữa duy nhất là xoá tài liệu đi. Bỏ dòng chú thích là cách giữ được cả hai.
 */
function codeLines(source: string): string[] {
  return source.split('\n').filter((line) => {
    const t = line.trim();
    return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
  });
}

/**
 * `tailwind.config.ts` sau khi bỏ dòng chú thích — dùng cho ① và ②.
 *
 * ⭐ Cùng lý do như `codeLines` ở trên: chính tài liệu trong config phải viết ra ví dụ
 *   (`var(--c-brand)` trong giải thích `hoverable:`, `var(--c-th-at-the-zoo)` trong giải thích
 *   tầng gián tiếp). Quét cả chú thích nghĩa là một dòng văn xuôi có thể làm test đỏ.
 */
const TAILWIND_CODE = codeLines(TAILWIND_CONFIG).join('\n');

describe('bảng màu token — đường ống component → Tailwind → tokens.css phải liền mạch', () => {
  it('① mọi biến tailwind.config.ts tham chiếu đều CÓ THẬT trong tokens.css', () => {
    /**
     * Bốn biến CỤC BỘ `--c-accent*` do `src/lib/themeAccent.ts` đặt lúc CHẠY, nên cố ý KHÔNG
     * có mặt trong `tokens.css`: giá trị thật vẫn nằm ở `--c-th-*`. Miễn trừ đúng bốn tên này,
     * và suy ra từ `SUFFIXES` chứ không chép tay — thêm vai màu thứ năm thì danh sách miễn trừ
     * tự đi theo, còn ⑧ vẫn canh cho `ACCENT_SUFFIXES` khớp `tokens.css`.
     *
     * ⚠️ Miễn trừ ở đây KHÔNG làm mất độ phủ: cái cần chặn là "config trỏ tới biến gõ sai",
     *   còn `--c-th-*` (giá trị thật) được ④/⑤/⑧ kiểm trực tiếp.
     */
    const runtimeAccentVars = SUFFIXES.map((suffix) => `--c-accent${suffix}`);

    const declared = new Set(declaredVariables(TOKENS_CSS));
    const thieu = [...new Set(referencedVariables(TAILWIND_CODE))]
      .filter((v) => !runtimeAccentVars.includes(v))
      .filter((v) => !declared.has(v));

    expect(
      thieu,
      `tailwind.config.ts trỏ tới biến không tồn tại: ${thieu.join(', ')}\n` +
        '⇒ Tailwind sẽ phát ra CSS không hợp lệ và màu đó LẶNG LẼ thành trong suốt.',
    ).toEqual([]);
  });

  it('② mọi màu khai trong tokens.css đều được tailwind.config.ts expose (không có token chết)', () => {
    const referenced = new Set(referencedVariables(TAILWIND_CODE));
    const chet = declaredVariables(TOKENS_CSS)
      .filter((v) => v.startsWith('--c-'))
      /**
       * ⚠️⚠️ DÒNG `!referenced.has(v)` TỪNG BỊ THIẾU — và đây là một lỗi thật, không phải giả định.
       *
       *   Bản đầu viết: lọc `--c-` → lọc bỏ `--c-th-` → hết. Tập `referenced` được dựng ra rồi
       *   KHÔNG AI DÙNG. Khẳng định vì thế biến thành "tokens.css không được khai token màu nào
       *   ngoài `--c-th-*`" — một câu vô nghĩa, đỏ ngay trên bộ token hoàn toàn đúng (nó tố
       *   27 token đang được config trỏ tới đàng hoàng).
       *
       *   Một khẳng định đỏ VÌ LÝ DO SAI còn tệ hơn không có khẳng định: người sửa sau chỉ thấy
       *   "test đỏ" rồi đi nới ngưỡng, và mất luôn cả phần bắt lỗi thật. Nên khi test đỏ, việc
       *   đầu tiên là đọc xem nó đỏ vì cái gì — chứ không phải nới nó ra.
       */
      .filter((v) => !referenced.has(v))
      /**
       * ⚠️ MIỄN TRỪ `--c-th-*` — CÓ LÝ DO, VÀ KHÔNG LÀM MẤT ĐỘ PHỦ:
       *   44 token tông chủ đề KHÔNG được trỏ tới bằng một `var(--c-th-…)` viết cứng trong
       *   `tailwind.config.ts`. Chúng được đọc qua một tầng gián tiếp: component đặt
       *   `--c-accent*` (xem `src/lib/themeAccent.ts`), config trỏ `th.* → var(--c-accent*)`.
       *   Viết cứng 44 dòng vào config sẽ tạo ra 44 class không ai dùng — đúng thứ khẳng định
       *   này sinh ra để chặn.
       *   Độ phủ KHÔNG giảm: khẳng định ⑧ bên dưới kiểm cả hai chiều giữa `tokens.css` và
       *   `themeAccent.ts`, nên một token `--c-th-…` mồ côi vẫn bị bắt — chỉ là bắt ở chỗ khác.
       */
      .filter((v) => !v.startsWith('--c-th-'));

    expect(
      chet,
      `token màu khai mà không expose ra Tailwind: ${chet.join(', ')}\n` +
        '⇒ không component nào dùng được nó. Hoặc là thêm vào config, hoặc là xoá khỏi tokens.css.',
    ).toEqual([]);
  });

  it('③ không component nào dùng hậu tố độ mờ trên màu token (`bg-success/10`)', () => {
    // Tên class = tên biến bỏ tiền tố `--c-`. Xếp dài trước để `brand-soft` không bị `brand` nuốt.
    const colourNames = declaredVariables(TOKENS_CSS)
      .filter((v) => v.startsWith('--c-'))
      .map((v) => v.slice('--c-'.length))
      .sort((a, b) => b.length - a.length);

    const prefixes =
      'bg|text|border|from|via|to|ring|fill|stroke|divide|decoration|outline|accent|caret';
    const violation = new RegExp(`\\b(?:${prefixes})-(?:${colourNames.join('|')})/\\d`);

    const viPham: string[] = [];
    for (const file of sourceFiles(join(ROOT, 'src'))) {
      codeLines(readFileSync(file, 'utf8')).forEach((line, index) => {
        const found = line.match(violation);
        if (found) {
          viPham.push(`${relative(ROOT, file).split('\\').join('/')}:${index + 1} → ${found[0]}`);
        }
      });
    }

    expect(
      viPham,
      `dùng hậu tố độ mờ trên màu token:\n  ${viPham.join('\n  ')}\n` +
        '⇒ Tailwind sinh `rgb(var(--c-...) / 0.x)` nhưng biến là mã HEX ⇒ CSS không hợp lệ ⇒\n' +
        '   trình duyệt bỏ qua và nền LẶNG LẼ thành trong suốt.\n' +
        '   Cách đúng: dùng token `-soft` khai sẵn bằng `rgba()` trong tokens.css.',
    ).toEqual([]);
  });
});

// =============================================================================
// Tông màu riêng của 11 chủ đề
// =============================================================================

/**
 * ⭐ VÌ SAO CẦN KHỐI TEST NÀY:
 *
 *   44 con số màu nằm trong `tokens.css` trông rất "có vẻ đúng". Sai một chữ số hex thì màu
 *   vẫn hiện ra — chỉ là **tương phản trượt ngưỡng AA** mà không cổng kiểm nào biết. Đúng họ
 *   lỗi "khai báo trông đúng" ở skill `css-silent-failures`.
 *
 *   Khối này ĐO bằng công thức WCAG 2.1 thật trên chính các giá trị hex đang chạy, và kiểm cả
 *   ba thứ mà mắt người không kiểm nổi: tương phản, khoảng cách HUE với màu mang ý nghĩa
 *   (⭐🌰❤️ + hồng thương hiệu), và sự khớp hai chiều giữa ba tệp.
 *
 *   Ngưỡng đã chốt (xem `tokens.css`, mục "11 tông màu chủ đề"):
 *     vivid (L*≈56) ≥ 3,0:1 trên nền sáng   — WCAG cho thành phần GIAO DIỆN, không phải chữ
 *     ink   (L*≈45) ≥ 4,5:1 trên nền TỐI NHẤT mà nó từng đứng ⇒ tự động đạt ở mọi chỗ sáng hơn
 *     hue: cách mọi màu mang ý nghĩa ≥ 20°, và các chủ đề cách nhau ≥ 20°
 */

const LEVEL_JSON = JSON.parse(
  readFileSync(join(ROOT, 'src/data/levels/starters/level.json'), 'utf8'),
) as { themeIds: string[] };

const THEME_ACCENT_TS = readFileSync(join(ROOT, 'src/lib/themeAccent.ts'), 'utf8');

/** Mọi token `--c-th-*` khai trong `tokens.css`: tên → giá trị. */
function themeTokens(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/(--c-th-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out.set(m[1] as string, (m[2] as string).trim());
  }
  return out;
}

/** `#rgb` / `#rrggbb` → ba kênh 0..255. */
function rgb(hex: string): [number, number, number] {
  const h = hex.trim().replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Độ chói tương đối theo WCAG 2.1. */
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Tỉ số tương phản WCAG 2.1 — LUÔN tính, không bao giờ chép tay từ tài liệu. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Góc hue (0..360) — dùng để phát hiện tông chủ đề trùng màu mang ý nghĩa. */
function hueOf(hex: string): number {
  const [r255, g255, b255] = rgb(hex);
  const [r, g, b] = [r255 / 255, g255 / 255, b255 / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (((h * 60) % 360) + 360) % 360;
}

/** Khoảng cách ngắn nhất giữa hai góc hue (bánh xe màu là vòng tròn). */
function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

/** Giá trị một token, hoặc `undefined`. */
function token(css: string, name: string): string | undefined {
  const m = css.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  return m?.[1]?.trim();
}

/** Bốn vai của một chủ đề: đọc từ `tokens.css`. */
const SUFFIXES = ['', '-ink', '-soft', '-tint'] as const;

/** Màu MANG Ý NGHĨA — không được trùng hue với tông chủ đề (xem ghi chú `tokens.css`). */
const RESERVED = ['--c-brand', '--c-star', '--c-acorn', '--c-heart'];

describe('tông màu 11 chủ đề — mỗi chủ đề một tông riêng, đo được', () => {
  const tokens = themeTokens(TOKENS_CSS);
  const ids = [
    ...new Set(
      [...tokens.keys()].map((k) => k.replace(/^--c-th-/, '').replace(/-ink$|-soft$|-tint$/, '')),
    ),
  ];

  it('④ mọi chủ đề trong level.json đều có đủ 4 token (vivid/ink/soft/tint)', () => {
    const thieu: string[] = [];
    for (const id of LEVEL_JSON.themeIds) {
      for (const suffix of SUFFIXES) {
        if (!tokens.has(`--c-th-${id}${suffix}`)) thieu.push(`--c-th-${id}${suffix}`);
      }
    }

    expect(
      thieu,
      `chủ đề thiếu token tông màu: ${thieu.join(', ')}\n` +
        '⇒ nếu `themeAccent.ts` trỏ tới biến không tồn tại, `var()` không phân giải được và trình\n' +
        '   duyệt làm khai báo KHÔNG HỢP LỆ ⇒ viền về `currentColor`, nền về trong suốt. Im lặng.',
    ).toEqual([]);
  });

  it('⑤ vivid đạt ≥ 3,0:1 và ink đạt ≥ 4,5:1 trên mọi nền nó thực sự đứng', () => {
    const surface = token(TOKENS_CSS, '--c-surface') as string;
    const raised = token(TOKENS_CSS, '--c-surface-raised') as string;
    const sunken = token(TOKENS_CSS, '--c-surface-sunken') as string;
    const viPham: string[] = [];

    for (const id of ids) {
      const vivid = tokens.get(`--c-th-${id}`) as string;
      const ink = tokens.get(`--c-th-${id}-ink`) as string;

      // vivid chỉ được làm viền / dải trang trí ⇒ ngưỡng của THÀNH PHẦN GIAO DIỆN là 3:1
      for (const [ten, nen] of [
        ['surface', surface],
        ['surface-raised', raised],
        ['surface-sunken', sunken],
      ] as const) {
        const c = contrast(vivid, nen);
        if (c < 3.0) viPham.push(`${id}: vivid ${vivid} trên ${ten} chỉ ${c.toFixed(2)}:1 (< 3,0)`);
      }

      // ink là CHỮ. Nền tối nhất nó từng đứng là surface-sunken + soft của chính nó.
      for (const [ten, nen] of [
        ['surface', surface],
        ['surface-raised', raised],
        ['surface-sunken', sunken],
        ['soft', tokens.get(`--c-th-${id}-soft`) as string],
        ['tint', tokens.get(`--c-th-${id}-tint`) as string],
      ] as const) {
        const c = contrast(ink, nen);
        if (c < 4.5) viPham.push(`${id}: ink ${ink} trên ${ten} chỉ ${c.toFixed(2)}:1 (< 4,5)`);
      }
    }

    expect(
      viPham,
      `tông chủ đề trượt ngưỡng tương phản WCAG AA:\n  ${viPham.join('\n  ')}\n` +
        '⇒ tương phản KHÔNG nhìn ra bằng mắt trên ảnh chụp. Phải tính. Xem `tokens.css` để biết\n' +
        '   cách chốt theo CIE L* (chốt L* là chốt luôn độ chói ⇒ tương phản tự khớp ở cả 11 tông).',
    ).toEqual([]);
  });

  it('⑥ CHỮ của màu mang ý nghĩa: bản `-ink` ĐẠT AA, bản gốc TRƯỢT — đó là lý do bản `-ink` tồn tại', () => {
    const surface = token(TOKENS_CSS, '--c-surface') as string;
    const raised = token(TOKENS_CSS, '--c-surface-raised') as string;
    const sunken = token(TOKENS_CSS, '--c-surface-sunken') as string;
    const cacNen = [
      ['surface', surface],
      ['surface-raised', raised],
      ['surface-sunken', sunken],
    ] as const;
    const viPham: string[] = [];

    // Ba cặp đã TRẢ GIÁ — mỗi lần đều phát hiện bằng cách ĐO, không phải bằng cách nhìn:
    //   ⭐ `--c-star`  2,15:1 (Nhóm 4) · ❤️ `--c-heart` 3,57:1 · ⚠️ `--c-warn` 3,02:1 (T082).
    for (const goc of ['--c-star', '--c-heart', '--c-warn']) {
      const ink = token(TOKENS_CSS, `${goc}-ink`) as string;
      const vivid = token(TOKENS_CSS, goc) as string;

      for (const [ten, mau] of cacNen) {
        const cInk = contrast(ink, mau);
        if (cInk < 4.5) {
          viPham.push(`${goc}-ink ${ink} trên ${ten} chỉ ${cInk.toFixed(2)}:1 (< 4,5) — chữ sẽ mờ`);
        }
        // Canh CHIỀU NGƯỢC LẠI: nếu bản GỐC cũng đạt AA thì token `-ink` là thừa và nên xoá.
        // Không có chiều này thì test chỉ khuyến khích tích thêm token mà không bao giờ dọn.
        const cGoc = contrast(vivid, mau);
        if (cGoc >= 4.5) {
          viPham.push(
            `${goc} ${vivid} đạt ${cGoc.toFixed(2)}:1 trên ${ten} ⇒ ${goc}-ink là THỪA, hãy xoá`,
          );
        }
      }
    }

    // `--c-acorn` KHÔNG cần bản `-ink`: tự nó đã đủ tối (5,02 · 4,77 · 4,54). Khẳng định điều
    // đó để không ai thêm một token chỉ vì muốn cho đối xứng.
    const acorn = token(TOKENS_CSS, '--c-acorn') as string;
    for (const [ten, mau] of cacNen) {
      const c = contrast(acorn, mau);
      if (c < 4.5) viPham.push(`--c-acorn ${acorn} trên ${ten} chỉ ${c.toFixed(2)}:1 (< 4,5)`);
    }
    expect(
      token(TOKENS_CSS, '--c-acorn-ink'),
      '--c-acorn đã đạt AA nên KHÔNG được thêm bản -ink (xem ghi chú ở `tokens.css`)',
    ).toBeUndefined();

    expect(
      viPham,
      `màu mang ý nghĩa dùng làm CHỮ trượt ngưỡng AA:\n  ${viPham.join('\n  ')}\n` +
        '⇒ đây đúng là lỗi đã lặp lại BA lần (⭐ 2,15:1 · ❤️ 3,57:1 · ⚠️ 3,02:1). Quy tắc: màu\n' +
        '   dùng cho NỀN và HÌNH giữ bản sáng (đó là hình ảnh bé nhìn); màu dùng cho CHỮ phải có\n' +
        '   bản `-ink` tối hơn. Tương phản KHÔNG nhìn ra được bằng mắt trên ảnh chụp — phải tính.',
    ).toEqual([]);
  });

  it('⑦ mọi tông chủ đề cách màu MANG Ý NGHĨA (⭐🌰❤️ + hồng thương hiệu) ≥ 20° hue', () => {
    const mauNghia = RESERVED.map((name) => ({
      name,
      hue: hueOf(token(TOKENS_CSS, name) as string),
    }));
    const viPham: string[] = [];

    for (const id of ids) {
      const hue = hueOf(tokens.get(`--c-th-${id}`) as string);
      for (const m of mauNghia) {
        const d = hueDistance(hue, m.hue);
        if (d < 20) {
          viPham.push(
            `${id} (hue ${hue.toFixed(0)}°) cách ${m.name} (hue ${m.hue.toFixed(0)}°) chỉ ${d.toFixed(1)}°`,
          );
        }
      }
    }

    expect(
      viPham,
      `tông chủ đề quá gần màu mang ý nghĩa:\n  ${viPham.join('\n  ')}\n` +
        '⇒ bé không còn phân biệt "sao mình vừa kiếm" với "màu của chủ đề". Ba màu phần thưởng\n' +
        '   (⭐🌰❤️) KHÔNG được đổi theo tông chủ đề — chúng mang nghĩa, không phải trang trí.',
    ).toEqual([]);
  });

  it('⑧ các tông chủ đề cách nhau ≥ 20° hue (mỗi chủ đề phải KHÁC nhau thật)', () => {
    const viPham: string[] = [];
    const hues = ids.map((id) => ({ id, hue: hueOf(tokens.get(`--c-th-${id}`) as string) }));

    for (let i = 0; i < hues.length; i += 1) {
      for (let j = i + 1; j < hues.length; j += 1) {
        const a = hues[i] as { id: string; hue: number };
        const b = hues[j] as { id: string; hue: number };
        const d = hueDistance(a.hue, b.hue);
        if (d < 20) {
          viPham.push(
            `${a.id} (${a.hue.toFixed(0)}°) ↔ ${b.id} (${b.hue.toFixed(0)}°): ${d.toFixed(1)}°`,
          );
        }
      }
    }

    expect(
      viPham,
      `hai chủ đề có tông gần như trùng nhau:\n  ${viPham.join('\n  ')}\n` +
        '⇒ "mỗi chủ đề một tông màu riêng" mất tác dụng: bé không phân biệt được hai chặng.',
    ).toEqual([]);
  });

  it('⑨ ba tệp phải khớp NHAU: level.json ↔ themeAccent.ts ↔ tokens.css (không token mồ côi)', () => {
    // Danh sách id khai trong themeAccent.ts (nguồn duy nhất về "chủ đề nào CÓ tông màu").
    const block =
      THEME_ACCENT_TS.match(/THEME_ACCENT_IDS\s*=\s*\[([\s\S]*?)\]\s*as const/)?.[1] ?? '';
    const declaredIds = [...block.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1] as string);

    // Các hậu tố khai trong themeAccent.ts phải đúng bằng 4 vai ở tokens.css.
    const suffixBlock =
      THEME_ACCENT_TS.match(/ACCENT_SUFFIXES\s*=\s*\[([\s\S]*?)\]\s*as const/)?.[1] ?? '';
    const declaredSuffixes = [...suffixBlock.matchAll(/'([a-z-]*)'/g)].map((m) => m[1] as string);

    const vanDe: string[] = [];

    if ([...declaredSuffixes].sort().join(',') !== [...SUFFIXES].sort().join(',')) {
      vanDe.push(
        `hậu tố lệch: themeAccent.ts khai [${declaredSuffixes.join(', ')}] ` +
          `nhưng test đang kiểm [${SUFFIXES.join(', ')}]`,
      );
    }

    // (a) themeAccent.ts → tokens.css: mọi biến nó có thể sinh ra đều phải tồn tại.
    for (const id of declaredIds) {
      for (const suffix of declaredSuffixes) {
        if (!tokens.has(`--c-th-${id}${suffix}`))
          vanDe.push(`themeAccent.ts sinh --c-th-${id}${suffix} nhưng tokens.css không có`);
      }
    }

    // (b) tokens.css → themeAccent.ts: không token MỒ CÔI (khai mà không ai dùng được).
    for (const key of tokens.keys()) {
      const id = key.replace(/^--c-th-/, '').replace(/-ink$|-soft$|-tint$/, '');
      if (!declaredIds.includes(id))
        vanDe.push(`${key} có trong tokens.css nhưng không có trong THEME_ACCENT_IDS`);
    }

    // (c) level.json → themeAccent.ts: mọi chủ đề đang dạy đều phải có tông màu.
    for (const id of LEVEL_JSON.themeIds) {
      if (!declaredIds.includes(id))
        vanDe.push(`level.json có chủ đề "${id}" nhưng chưa có tông màu`);
    }

    expect(
      vanDe,
      `ba tệp lệch nhau:\n  ${vanDe.join('\n  ')}\n` +
        '⇒ (a) chủ đề rơi về màu thương hiệu; (b) token chết; (c) chủ đề mới không có tông riêng.',
    ).toEqual([]);
  });
});
