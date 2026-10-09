/**
 * gen-theme-colors.ts — SINH và KIỂM 44 token tông màu chủ đề trong `src/styles/tokens.css`.
 *
 * ⭐ VÌ SAO CÓ TỆP NÀY:
 *   44 mã hex viết tay thì không ai kiểm nổi. Tệp này là *nguồn gốc* của 44 mã đó: nó tính
 *   bằng công thức, tự đo lại bằng WCAG 2.1, và tự khai báo mình có đạt ngưỡng hay không.
 *   `tests/unit/client/styles-tokens.test.ts` (khẳng định ④–⑧) ĐỘC LẬP kiểm lại kết quả trên
 *   chính các mã đang nằm trong `tokens.css` — hai đường, một đáp số.
 *
 * ⭐ CÁCH CHỌN MÀU — CHUẨN HOÁ THEO CIE L*, KHÔNG THEO ĐỘ TƯƠNG PHẢN:
 *   Chọn mỗi tông bằng "giá trị đầu tiên đạt ngưỡng tương phản" thì hue VÀNG phải rất tối mới
 *   đạt 3:1 trên nền trắng, còn hue XANH chỉ cần hơi đậm ⇒ 11 thẻ lệch trọng lượng thị giác.
 *   Chuẩn hoá theo độ tương phản cũng lệch, vì độ tương phản không phải độ sáng mà mắt thấy.
 *   Cách đúng: chốt **CIE L\***. L\* là hàm THUẦN của độ chói Y, nên chốt L\* là chốt luôn Y ⇒
 *   tương phản trên nền trắng TỰ ĐỘNG bằng nhau ở cả 11 tông. Một mũi tên trúng hai đích.
 *
 * ⭐ CHỌN HUE — ĐỀU NHAU TRÊN CUNG KHÔNG ĐỤNG MÀU MANG Ý NGHĨA:
 *   Bốn màu mang nghĩa (`--c-brand` hồng, `--c-star` hổ phách, `--c-acorn` nâu, `--c-heart` đỏ)
 *   KHÔNG được đổi theo chủ đề — bé phải phân biệt "sao mình vừa kiếm" với "màu của chặng".
 *   Script đọc hue THẬT của chúng từ `tokens.css` rồi khoanh vùng cấm ±20°; cung còn lại được
 *   chia ĐỀU cho 11 chủ đề. Chia đều là cách duy nhất để khoảng cách nhỏ nhất là lớn nhất —
 *   và khoảng cách nhỏ nhất chính là thứ khẳng định ⑦ canh.
 *
 *   ⚠️ Bài học đã trả giá: bản đầu tôi chia tay (58°, 78°, 100°…) để "mỗi chủ đề một sắc thái
 *     riêng". Kết quả là hai cặp chỉ cách 20,0° danh nghĩa — mà lưới độ sáng 0,25% làm hue
 *     đọc lại lệch ~0,3° ⇒ đo ra 19,7° và 19,9°, TRƯỢT ngưỡng. Đặt đúng bằng ngưỡng là tự
 *     chuốc lấy lỗi. Nay chia đều 25,0° ⇒ cặp gần nhất đo được 24,x°.
 *
 * DÙNG:
 *   npx tsx scripts/gen-theme-colors.ts            # CHẾ ĐỘ KIỂM: in bảng + so tokens.css với
 *                                                  # đầu ra script; lệch một mã cũng exit 1.
 *                                                  # `npm run ci` chạy đúng lệnh này.
 *   npx tsx scripts/gen-theme-colors.ts --apply    # ghi lại 44 mã vào tokens.css
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const TOKENS_PATH = join(ROOT, 'src/styles/tokens.css');

if (!existsSync(TOKENS_PATH)) {
  console.error(
    `KHONG tim thay ${TOKENS_PATH}\n  - Chay script tu goc repo rubylingo/ (npx tsx scripts/gen-theme-colors.ts).`,
  );
  process.exit(1);
}

/** Thứ tự PHẢI khớp thứ tự khai trong `tokens.css` (script ghi lại theo đúng thứ tự này). */
const THEME_HUES: ReadonlyArray<readonly [string, number]> = [
  ['numbers-1-20', 60],
  ['at-home', 85],
  ['my-favourite-food', 110],
  ['at-the-zoo', 135],
  ['my-body', 160],
  ['at-the-beach', 185],
  ['my-friends-birthday', 210],
  ['at-school', 235],
  ['my-street', 260],
  ['at-the-clothes-shop', 285],
  ['alphabet', 310],
];

/** Bốn vai màu. `lstar` = độ sáng cảm nhận; `sat` = độ bão hoà HSL khi dò. */
const ROLES: ReadonlyArray<{ suffix: string; lstar: number; sat: number; note: string }> = [
  { suffix: '', lstar: 56, sat: 78, note: 'VIỀN / dải gradient — ngưỡng giao diện 3:1' },
  { suffix: '-ink', lstar: 45, sat: 80, note: 'CHỮ trên nền sáng — ngưỡng chữ 4,5:1' },
  { suffix: '-soft', lstar: 94, sat: 75, note: 'NỀN chip' },
  { suffix: '-tint', lstar: 96.5, sat: 55, note: 'NỀN thân thẻ' },
];

/** Màu MANG Ý NGHĨA — không tông chủ đề nào được tới gần. */
const RESERVED = ['--c-brand', '--c-star', '--c-acorn', '--c-heart'] as const;

/** Cận dưới khoảng cách hue, tính bằng độ. Phải khớp khẳng định ⑥/⑦ trong test canh giữ. */
const MIN_HUE_GAP = 20;
/** Cận dưới tương phản. Phải khớp khẳng định ⑤ trong test canh giữ. */
const MIN_BORDER_CONTRAST = 3.0;
const MIN_TEXT_CONTRAST = 4.5;

// ---------------------------------------------------------------------------
// Màu: chuyển đổi và đo
// ---------------------------------------------------------------------------

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
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

function rgbToHex([r, g, b]: Rgb): string {
  const f = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}

function hslToRgb(hDeg: number, s: number, l: number): Rgb {
  const h = ((hDeg % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = Math.floor(h / 60) % 6;
  const [r1, g1, b1] = (
    [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ] as ReadonlyArray<Rgb>
  )[seg] as Rgb;
  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
}

/** Độ chói tương đối theo WCAG 2.1. */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Tỉ số tương phản WCAG 2.1 — LUÔN tính, không bao giờ chép tay. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** CIE L\* — độ sáng cảm nhận, 0 (đen) … 100 (trắng). */
function lstar(hex: string): number {
  const y = luminance(hex);
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
}

/** Góc hue (0..360). */
function hueOf(hex: string): number {
  const [r255, g255, b255] = hexToRgb(hex);
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

/**
 * Tìm mã hex gần nhất có CIE L\* cho trước, trên lưới độ sáng 0,25%.
 *
 * ⚠️ Lưới 0,25% (không phải 1%) vì hue ĐỌC LẠI của mã sinh ra lệch khỏi hue ĐẶT VÀO: cùng một
 *   hue, đổi độ sáng là đổi luôn tỉ lệ kênh sau khi làm tròn 8 bit. Lưới thô làm độ lệch đó
 *   lớn — đủ để hai tông cách nhau 20,0° danh nghĩa đo ra 19,7° và trượt ngưỡng.
 *
 * ⚠️⚠️ `satPercent` là 0–100 còn HSL cần 0–1. Nhận thẳng 0–100 rồi tự chia ở ĐÂY, để không
 *   chỗ gọi nào quên chia — quên thì `c` vượt xa 1, mọi kênh bị kẹp trần và hue sụp về các
 *   màu thuần (`#00ff00`, `#00ffff`), tức là "11 tông chủ đề" biến thành 4 màu neon trùng nhau.
 */
function generate(hue: number, satPercent: number, targetLstar: number): string {
  const sat = satPercent / 100;
  let best = '#000000';
  let bestErr = Number.POSITIVE_INFINITY;
  for (let l = 0.02; l <= 0.995; l += 0.0025) {
    const hex = rgbToHex(hslToRgb(hue, sat, l));
    const err = Math.abs(lstar(hex) - targetLstar);
    if (err < bestErr) {
      bestErr = err;
      best = hex;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Đọc màu nền + màu mang ý nghĩa TỪ CHÍNH tokens.css (không chép tay con số)
// ---------------------------------------------------------------------------

const css = readFileSync(TOKENS_PATH, 'utf8');

function tokenValue(name: string): string {
  const m = css.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  if (!m) throw new Error(`tokens.css khong co ${name}`);
  return (m[1] as string).trim();
}

const SURFACE = tokenValue('--c-surface');
const SURFACE_RAISED = tokenValue('--c-surface-raised');
const SURFACE_SUNKEN = tokenValue('--c-surface-sunken');

const reservedHues = RESERVED.map((name) => {
  const hex = tokenValue(name);
  return { name, hex, hue: hueOf(hex) };
});

// ---------------------------------------------------------------------------
// Sinh
// ---------------------------------------------------------------------------

const values = new Map<string, string>();
for (const [id, hue] of THEME_HUES) {
  for (const role of ROLES) {
    values.set(`--c-th-${id}${role.suffix}`, generate(hue, role.sat, role.lstar));
  }
}

// ---------------------------------------------------------------------------
// Kiểm — đúng những ngưỡng mà test canh giữ dùng
// ---------------------------------------------------------------------------

const problems: string[] = [];

// ⑤ tương phản
let vividMin = Number.POSITIVE_INFINITY;
let vividMax = 0;
let inkMin = Number.POSITIVE_INFINITY;
let inkMax = 0;

for (const [id] of THEME_HUES) {
  const vivid = values.get(`--c-th-${id}`) as string;
  const ink = values.get(`--c-th-${id}-ink`) as string;

  for (const [ten, nen] of [
    ['surface', SURFACE],
    ['surface-raised', SURFACE_RAISED],
    ['surface-sunken', SURFACE_SUNKEN],
  ] as const) {
    const c = contrast(vivid, nen);
    vividMin = Math.min(vividMin, c);
    vividMax = Math.max(vividMax, c);
    if (c < MIN_BORDER_CONTRAST) {
      problems.push(
        `${id}: vivid ${vivid} trên ${ten} chỉ ${c.toFixed(2)}:1 (< ${MIN_BORDER_CONTRAST})`,
      );
    }
  }

  for (const [ten, nen] of [
    ['surface', SURFACE],
    ['surface-raised', SURFACE_RAISED],
    ['surface-sunken', SURFACE_SUNKEN],
    ['soft', values.get(`--c-th-${id}-soft`) as string],
    ['tint', values.get(`--c-th-${id}-tint`) as string],
  ] as const) {
    const c = contrast(ink, nen);
    inkMin = Math.min(inkMin, c);
    inkMax = Math.max(inkMax, c);
    if (c < MIN_TEXT_CONTRAST) {
      problems.push(`${id}: ink ${ink} trên ${ten} chỉ ${c.toFixed(2)}:1 (< ${MIN_TEXT_CONTRAST})`);
    }
  }
}

// ⑥ cách màu mang ý nghĩa
let reservedMin = Number.POSITIVE_INFINITY;
let reservedMinPair = '';
for (const [id] of THEME_HUES) {
  const hue = hueOf(values.get(`--c-th-${id}`) as string);
  for (const m of reservedHues) {
    const d = hueDistance(hue, m.hue);
    if (d < reservedMin) {
      reservedMin = d;
      reservedMinPair = `${id} (${hue.toFixed(1)}°) ↔ ${m.name} (${m.hue.toFixed(1)}°)`;
    }
    if (d < MIN_HUE_GAP) {
      problems.push(
        `${id} (hue ${hue.toFixed(1)}°) cách ${m.name} (hue ${m.hue.toFixed(1)}°) chỉ ${d.toFixed(1)}°`,
      );
    }
  }
}

// ⑦ các chủ đề cách nhau
let pairMin = Number.POSITIVE_INFINITY;
let pairMinPair = '';
const measured = THEME_HUES.map(([id, target]) => {
  const hex = values.get(`--c-th-${id}`) as string;
  return { id, target, hex, hue: hueOf(hex) };
});
for (let i = 0; i < measured.length; i += 1) {
  for (let j = i + 1; j < measured.length; j += 1) {
    const a = measured[i] as (typeof measured)[number];
    const b = measured[j] as (typeof measured)[number];
    const d = hueDistance(a.hue, b.hue);
    if (d < pairMin) {
      pairMin = d;
      pairMinPair = `${a.id} (${a.hue.toFixed(1)}°) ↔ ${b.id} (${b.hue.toFixed(1)}°)`;
    }
    if (d < MIN_HUE_GAP) {
      problems.push(
        `${a.id} (${a.hue.toFixed(1)}°) ↔ ${b.id} (${b.hue.toFixed(1)}°): ${d.toFixed(1)}°`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Báo cáo
// ---------------------------------------------------------------------------

const pad = (s: string, n: number) => s.padEnd(n, ' ');
console.log('Tông màu chủ đề — bảng sinh và đo\n');
console.log(
  `${pad('chủ đề', 24)}${pad('hue đặt', 10)}${pad('hue đo', 10)}${pad('vivid', 10)}${pad('ink', 10)}`,
);
for (const m of measured) {
  console.log(
    `${pad(m.id, 24)}${pad(m.target.toFixed(1), 10)}${pad(m.hue.toFixed(1), 10)}${pad(m.hex, 10)}${pad(
      values.get(`--c-th-${m.id}-ink`) as string,
      10,
    )}`,
  );
}

console.log('\nSàn tương phản:');
console.log(
  `  vivid trên nền sáng  : ${vividMin.toFixed(2)}–${vividMax.toFixed(2)}:1  (ngưỡng ${MIN_BORDER_CONTRAST})`,
);
console.log(
  `  ink trên mọi nền dùng: ${inkMin.toFixed(2)}–${inkMax.toFixed(2)}:1  (ngưỡng ${MIN_TEXT_CONTRAST})`,
);
console.log(
  `\nKhoảng cách hue nhỏ nhất tới màu mang ý nghĩa: ${reservedMin.toFixed(1)}° — ${reservedMinPair}`,
);
console.log(
  `Khoảng cách hue nhỏ nhất giữa hai chủ đề     : ${pairMin.toFixed(1)}° — ${pairMinPair}`,
);

if (problems.length > 0) {
  console.error(`\n✗ TRƯỢT NGƯỠNG:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('\n✓ Mọi ngưỡng đạt.');

// ---------------------------------------------------------------------------
// `tokens.css` có ĐÚNG là thứ script này sinh ra không?
//
// ⭐ Vì sao cần: chỉ ghi ra "đã sinh" thì lời hứa "44 mã này do script sinh" không ai giữ.
//   Chạy không có `--apply` = chế độ KIỂM; lệch một mã cũng là lỗi. Nhờ vậy `npm run ci`
//   khẳng định được `tokens.css` đúng bằng đầu ra của script — hoặc sửa tay thì phải nói ra.
// ---------------------------------------------------------------------------

const currentValues = new Map<string, string>();
for (const m of css.matchAll(/(--c-th-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
  currentValues.set(m[1] as string, (m[2] as string).toLowerCase());
}

const lech: string[] = [];
for (const [name, want] of values) {
  const now = currentValues.get(name);
  if (now !== want) lech.push(`${name}: tokens.css ${now ?? '(khong co)'} → script ${want}`);
}

const apply = process.argv.includes('--apply');

if (apply) {
  // -------------------------------------------------------------------------
  // Ghi đĩa — giữ nguyên thứ tự dòng, chú thích cuối dòng và mọi thứ khác
  // -------------------------------------------------------------------------
  let touched = 0;
  const out = css
    .split('\n')
    .map((line) => {
      const m = line.match(/^(\s*)(--c-th-[a-z0-9-]+)(\s*:\s*)(#[0-9a-fA-F]{6})(\s*;)(.*)$/);
      if (!m) return line;
      const name = m[2] as string;
      const value = values.get(name);
      if (!value) throw new Error(`khong tinh duoc gia tri cho ${name}`);
      touched += 1;
      if (value === (m[4] as string).toLowerCase()) return line;
      return `${m[1]}${name}${m[3]}${value}${m[5]}${m[6]}`;
    })
    .join('\n');

  if (touched !== THEME_HUES.length * ROLES.length) {
    throw new Error(`ghi ${touched} dòng, mong đợi ${THEME_HUES.length * ROLES.length}`);
  }
  writeFileSync(TOKENS_PATH, out, 'utf8');
  console.log(`\n→ Đã ghi ${touched} token vào src/styles/tokens.css (${lech.length} mã được sửa)`);
} else if (lech.length > 0) {
  console.error(
    `\n✗ src/styles/tokens.css LỆCH khỏi script (${lech.length} mã):\n  ${lech.join('\n  ')}\n` +
      '⇒ tệp CSS nói "44 mã này do script sinh" nhưng không còn đúng nữa.\n' +
      '   Chạy `npx tsx scripts/gen-theme-colors.ts --apply` để ghi lại, hoặc sửa kế hoạch\n' +
      '   hue / vai màu trong script nếu bạn định đổi bằng tay.',
  );
  process.exit(1);
} else {
  console.log('✓ src/styles/tokens.css khớp đúng đầu ra của script (44/44 mã).');
}
