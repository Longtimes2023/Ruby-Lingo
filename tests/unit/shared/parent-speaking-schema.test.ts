/**
 * RubyLingo — Test schema xác nhận phần Nói của phụ huynh (TẦNG 4) + ĐỐI CHIẾU DANH MỤC với đề.
 *
 * ⭐ NHỮNG ĐIỀU FILE NÀY CANH:
 *   1. **Danh mục 4 mục Nói KHỚP nội dung thật** (`src/data/.../final-test/speaking.json`). Đây là
 *      lưới chống LỆCH IM LẶNG: ai thêm/bớt part trong đề mà quên mục Nói ở `shared/` ⇒ đỏ ngay.
 *   2. **Hình dạng hợp lệ** bị từ chối đúng chỗ: id lạ, id trùng, quá số mục.
 *   3. `parseParentSpeakingMarks` CHỊU ĐƯỢC dữ liệu hỏng — một hàng rác không được làm sập báo cáo.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  PARENT_SPEAKING_ITEM_COUNT,
  PARENT_SPEAKING_ITEM_IDS,
  parentSpeakingItemSchema,
  parentSpeakingSaveSchema,
  parentSpeakingStateSchema,
  parseParentSpeakingMarks,
} from '../../../shared/schemas/parent-speaking.js';

// ⚠️ KHÔNG dùng `fileURLToPath(new URL(…, import.meta.url))`: dưới Vitest, `import.meta.url`
//    không mang scheme `file:` ⇒ ném `TypeError: The URL must be of scheme file`. `process.cwd()`
//    là gốc repo khi vitest chạy — cùng cách các test khác trong repo (`styles-tokens.test.ts`).
const SPEAKING_JSON = join(
  process.cwd(),
  'src/data/levels/starters/final-test/speaking.json',
);

interface SpeakingFile {
  section: string;
  parts: { id: string; index: number }[];
}

describe('danh mục mục Nói đối chiếu với đề thật', () => {
  it('số mục bằng số part trong speaking.json và thứ tự khớp index', () => {
    const file = JSON.parse(readFileSync(SPEAKING_JSON, 'utf8')) as SpeakingFile;

    expect(file.section).toBe('speaking');
    expect(file.parts).toHaveLength(PARENT_SPEAKING_ITEM_COUNT);
    expect(PARENT_SPEAKING_ITEM_IDS).toHaveLength(PARENT_SPEAKING_ITEM_COUNT);

    file.parts.forEach((part, i) => {
      // Đề đánh số part từ 1 và tăng dần ⇒ danh mục tĩnh `p1..p4` phải trùng thứ tự này.
      expect(part.index).toBe(i + 1);
      expect(part.id).toMatch(/^starters\.final-test\.speaking\.p\d+$/);
    });
  });
});

describe('parentSpeakingSaveSchema', () => {
  it('nhận danh sách 4 mục hợp lệ (gồm cả done:false = "ôn thêm")', () => {
    const parsed = parentSpeakingSaveSchema.parse({
      items: [
        { id: 'p1', done: true },
        { id: 'p2', done: false },
      ],
    });
    expect(parsed.items).toEqual([
      { id: 'p1', done: true },
      { id: 'p2', done: false },
    ]);
  });

  it('nhận danh sách RỖNG (bố mẹ bỏ hết đánh dấu)', () => {
    expect(parentSpeakingSaveSchema.parse({ items: [] })).toEqual({ items: [] });
  });

  it('từ chối id lạ, id trùng, và quá số mục', () => {
    expect(parentSpeakingSaveSchema.safeParse({ items: [{ id: 'p9', done: true }] }).success).toBe(false);
    expect(
      parentSpeakingSaveSchema.safeParse({
        items: [
          { id: 'p1', done: true },
          { id: 'p1', done: false },
        ],
      }).success,
    ).toBe(false);
    expect(
      parentSpeakingSaveSchema.safeParse({
        items: [
          { id: 'p1', done: true },
          { id: 'p2', done: true },
          { id: 'p3', done: true },
          { id: 'p4', done: true },
          { id: 'p1', done: true },
        ],
      }).success,
    ).toBe(false);
  });
});

describe('parentSpeakingStateSchema', () => {
  it('cho phép updatedAt = null (chưa từng đồng bộ)', () => {
    expect(parentSpeakingStateSchema.parse({ items: [], updatedAt: null })).toEqual({
      items: [],
      updatedAt: null,
    });
  });

  it('đòi updatedAt đúng ISO-8601 UTC khi có giá trị', () => {
    expect(
      parentSpeakingStateSchema.safeParse({ items: [], updatedAt: '2026-10-06 09:00' }).success,
    ).toBe(false);
    expect(
      parentSpeakingStateSchema.parse({ items: [], updatedAt: '2026-10-06T09:00:00.000Z' }).updatedAt,
    ).toBe('2026-10-06T09:00:00.000Z');
  });
});

describe('parentSpeakingItemSchema', () => {
  it('done phải là boolean thật', () => {
    expect(parentSpeakingItemSchema.safeParse({ id: 'p1', done: 'yes' }).success).toBe(false);
    expect(parentSpeakingItemSchema.safeParse({ id: 'p1', done: true }).success).toBe(true);
  });
});

describe('parseParentSpeakingMarks — chịu dữ liệu hỏng', () => {
  it('JSON sai ⇒ mảng rỗng (không ném)', () => {
    expect(parseParentSpeakingMarks('{{{')).toEqual([]);
    expect(parseParentSpeakingMarks('null')).toEqual([]);
    expect(parseParentSpeakingMarks('{"a":1}')).toEqual([]);
  });

  it('bỏ qua mục lạ / méo mó và KHỬ TRÙNG theo id', () => {
    const raw = JSON.stringify([
      { id: 'p1', done: true },
      { id: 'pX', done: true }, // id lạ ⇒ bỏ
      { id: 'p2', done: 'no' }, // done sai kiểu ⇒ bỏ
      { id: 'p1', done: false }, // trùng id ⇒ bỏ (giữ bản đầu)
      { id: 'p3', done: false },
    ]);
    expect(parseParentSpeakingMarks(raw)).toEqual([
      { id: 'p1', done: true },
      { id: 'p3', done: false },
    ]);
  });
});
