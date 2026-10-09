/**
 * RubyLingo — Tiện ích ngẫu nhiên.
 *
 * Vì sao không dùng `Math.random()` trực tiếp trong component: mỗi lần React render lại
 * sẽ ra kết quả mới ⇒ hình nhấp nháy, bé bấm nhầm. Các hàm ở đây nhận `seed` để kết quả
 * **ổn định trong cùng một lượt chơi** nhưng vẫn khác nhau giữa các lượt.
 */

/** Băm chuỗi thành số nguyên 32-bit — dùng làm hạt giống ổn định. */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Bộ sinh số giả ngẫu nhiên có hạt giống (mulberry32) — tất định, nhanh. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Xáo trộn mảng bằng Fisher–Yates với hạt giống cho trước (không sửa mảng gốc). */
export function shuffleSeeded<T>(items: readonly T[], seed: number | string): T[] {
  const rng = seededRandom(typeof seed === 'string' ? hashString(seed) : seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/** Chọn một phần tử theo hạt giống. */
export function pickSeeded<T>(items: readonly T[], seed: number | string): T | undefined {
  if (items.length === 0) return undefined;
  const rng = seededRandom(typeof seed === 'string' ? hashString(seed) : seed);
  return items[Math.floor(rng() * items.length)];
}

/**
 * Chọn `count` phần tử khác nhau, ưu tiên khác `exclude`.
 * Dùng để chọn từ gây nhiễu cho game Nghe & Chạm.
 */
export function pickDistractors<T>(
  pool: readonly T[],
  count: number,
  exclude: readonly T[],
  seed: number | string,
): T[] {
  const excluded = new Set(exclude);
  const candidates = pool.filter((x) => !excluded.has(x));
  const shuffled = shuffleSeeded(candidates, seed);
  return shuffled.slice(0, Math.max(0, count));
}

/** Số nguyên ngẫu nhiên trong [min, max] theo hạt giống. */
export function randomIntSeeded(min: number, max: number, seed: number | string): number {
  const rng = seededRandom(typeof seed === 'string' ? hashString(seed) : seed);
  return min + Math.floor(rng() * (max - min + 1));
}

/** Chia mảng thành các nhóm có kích thước tối đa `size` (chia bài thành các lượt). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) return [Array.from(items)];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
