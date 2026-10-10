// @vitest-environment node
/**
 * RubyLingo — CỔNG NỘI DUNG cho ĐỀ THI CUỐI KHOÁ Starters (Giai đoạn 4).
 *
 * ⭐ VÌ SAO TỆP NÀY TỒN TẠI:
 *   Đề thi là nội dung TỰ SOẠN (ràng buộc bản quyền). Có những lỗi chỉ test chạy thật mới bắt được —
 *   và chúng im lặng tuyệt đối với `tsc`/`eslint`:
 *     • đếm sai số câu (Listening phải 20, Reading & Writing phải 25) ⇒ server chấm lệch khiên;
 *     • `wordId` trỏ tới một từ KHÔNG có trong level ⇒ bé học mà không có từ để nhớ;
 *     • audio/prompt lọt dấu tiếng Việt ⇒ máy đọc en-GB đọc sai;
 *     • lọt một câu nhận dạng đề Cambridge ⇒ rủi ro bản quyền.
 *
 * ⚠️ ĐỌC ĐỀ THẬT TỪ ĐĨA (`src/data/levels/starters/final-test/*.json`), không dùng dữ liệu bịa.
 *    Luật ngữ nghĩa gọi lại ĐÚNG hàm thuần `shared/final-test-rules.ts` mà `validate-content.ts`
 *    dùng — một mã, hai nơi (xem đầu file luật đó).
 *
 * ⚠️ KHÔNG dùng `new URL(..., import.meta.url)` dưới Vitest (không mang scheme `file:` ⇒ ném lỗi).
 *    Dùng `process.cwd()` như `content-index.test.ts`.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  finalTestManifestSchema,
  finalTestSectionFileSchema,
} from '../../../shared/schemas/final-test.js';
import type { FinalTestItem, FinalTestSectionFile } from '../../../shared/schemas/final-test.js';
import { auditFinalTestCambridge, auditFinalTestItem } from '../../../shared/final-test-rules.js';

const ROOT = `${process.cwd()}/`;
const THEMES_DIR = join(ROOT, 'src/data/levels/starters/themes');
const FINAL_TEST_DIR = join(ROOT, 'src/data/levels/starters/final-test');

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

/** Mọi id từ CÓ THẬT của level Starters. */
function levelWordIds(): Set<string> {
  const ids = new Set<string>();
  for (const file of readdirSync(THEMES_DIR).filter((f) => f.endsWith('.json'))) {
    const data = readJson(join(THEMES_DIR, file)) as { words?: Array<{ id: string }> };
    for (const word of data.words ?? []) ids.add(word.id);
  }
  return ids;
}

const manifest = finalTestManifestSchema.parse(readJson(join(FINAL_TEST_DIR, 'manifest.json')));
const listening = finalTestSectionFileSchema.parse(
  readJson(join(FINAL_TEST_DIR, 'listening.json')),
);
const readingWriting = finalTestSectionFileSchema.parse(
  readJson(join(FINAL_TEST_DIR, 'reading-writing.json')),
);
const speaking = finalTestSectionFileSchema.parse(readJson(join(FINAL_TEST_DIR, 'speaking.json')));
const sections: FinalTestSectionFile[] = [listening, readingWriting, speaking];
const wordIds = levelWordIds();

/** Đệ quy lấy mọi item của một section. */
function itemsOf(section: FinalTestSectionFile): FinalTestItem[] {
  return section.parts.flatMap((part) => part.items);
}
const allItems = sections.flatMap(itemsOf);

/** Mọi chuỗi hiển thị/đọc của đề — để kiểm tiếng Anh sạch dấu + bản quyền. */
function stringsOf(section: FinalTestSectionFile): string[] {
  const out: string[] = [];
  for (const part of section.parts) {
    out.push(part.title_vi, part.instruction_vi);
    for (const item of part.items) {
      for (const value of Object.values(item)) {
        if (typeof value === 'string') out.push(value);
        else if (Array.isArray(value))
          for (const v of value) if (typeof v === 'string') out.push(v);
      }
    }
  }
  return out;
}

// =============================================================================
// 0. Chống "test rỗng tự khen mình"
// =============================================================================

describe('đề thi Starters — có nội dung THẬT để kiểm', () => {
  it('nạp được đề và có câu để kiểm', () => {
    expect(wordIds.size).toBeGreaterThan(0);
    expect(allItems.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// 1. SỐ LIỆU ĐỀ (theo bản Digital — số liệu CỨNG)
// =============================================================================

describe('số liệu đề đúng chuẩn Digital', () => {
  it('Listening: 4 part · 20 câu', () => {
    expect(listening.parts).toHaveLength(4);
    expect(itemsOf(listening)).toHaveLength(20);
  });

  it('Reading & Writing: 5 part · 25 câu', () => {
    expect(readingWriting.parts).toHaveLength(5);
    expect(itemsOf(readingWriting)).toHaveLength(25);
  });

  it('Speaking: 4 part', () => {
    expect(speaking.parts).toHaveLength(4);
  });

  it('manifest khớp TỪNG section: section / partCount / itemCount / autoScored', () => {
    for (const section of sections) {
      const summary = manifest.sections.find((s) => s.section === section.section);
      expect(summary, section.section).toBeDefined();
      expect(summary?.partCount, section.section).toBe(section.parts.length);
      expect(summary?.itemCount, section.section).toBe(itemsOf(section).length);
      expect(summary?.autoScored, section.section).toBe(section.autoScored);
    }
    expect(manifest.sections.map((s) => s.section)).toEqual([
      'listening',
      'reading-writing',
      'speaking',
    ]);
  });

  it('autoScored: Listening & R&W = true; Speaking = false (KHÔNG chấm tự động)', () => {
    expect(listening.autoScored).toBe(true);
    expect(readingWriting.autoScored).toBe(true);
    expect(speaking.autoScored).toBe(false);
  });

  it('trần khiên = 5 cho MỌI phần', () => {
    for (const section of sections) expect(section.maxShields, section.section).toBe(5);
  });
});

// =============================================================================
// 2. TỪ VỰNG — mọi `wordId` phải CÓ THẬT
// =============================================================================

describe('mọi item bám vào từ vựng có thật của level', () => {
  it('mọi `wordId` tham chiếu đều tồn tại trong 275 từ của Starters', () => {
    const bad: string[] = [];
    for (const item of allItems) {
      if ('wordId' in item && item.wordId !== undefined && !wordIds.has(item.wordId)) {
        bad.push(`${item.id} → ${item.wordId}`);
      }
    }
    expect(bad, `wordId không tồn tại:\n${bad.join('\n')}`).toEqual([]);
  });

  it('mọi item CHẤM TỰ ĐỘNG đều có `wordId` (item Nói được miễn — câu cá nhân không gắn từ)', () => {
    const bad: string[] = [];
    for (const section of [listening, readingWriting]) {
      for (const item of itemsOf(section)) {
        if (!('wordId' in item) || item.wordId === undefined) bad.push(item.id);
      }
    }
    expect(bad, `item thiếu wordId:\n${bad.join('\n')}`).toEqual([]);
  });
});

// =============================================================================
// 3. LUẬT NGỮ NGHĨA (V23–V25) — gọi CHÍNH hàm validator dùng
// =============================================================================

describe('luật ngữ nghĩa V23–V25 áp lên đề thật', () => {
  it('mọi item HỢP LỆ theo `auditFinalTestItem` (rỗng = không vi phạm)', () => {
    const bad: string[] = [];
    for (const item of allItems) {
      for (const v of auditFinalTestItem(item, wordIds)) bad.push(`[${v.rule}] ${v.message}`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('id mọi item là DUY NHẤT toàn bài thi và đúng quy ước …p<part>.q<n>', () => {
    const seen = new Set<string>();
    for (const section of sections) {
      section.parts.forEach((part, partIndex) => {
        expect(part.id, section.section).toBe(
          `${manifest.id}.${section.section}.p${partIndex + 1}`,
        );
        part.items.forEach((item, itemIndex) => {
          expect(item.id).toBe(`${part.id}.q${itemIndex + 1}`);
          expect(seen.has(item.id), `id trùng: ${item.id}`).toBe(false);
          seen.add(item.id);
        });
      });
    }
  });
});

// =============================================================================
// 4. TIẾNG ANH SẠCH DẤU (V25) + BẢN QUYỀN (V27)
// =============================================================================

describe('tiếng Anh sạch dấu + không có chuỗi nhận dạng Cambridge', () => {
  it('mọi `promptEn` / `audioTextEn` chỉ chứa ký tự ASCII (không dấu tiếng Việt)', () => {
    const ascii = /^[\x20-\x7E]*$/;
    const bad: string[] = [];
    for (const item of allItems) {
      for (const field of ['promptEn', 'audioTextEn'] as const) {
        const value = item[field];
        if (typeof value === 'string' && !ascii.test(value))
          bad.push(`${item.id}.${field} = ${value}`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('`manifest.source === "original"` — đề là nội dung TỰ SOẠN', () => {
    expect(manifest.source).toBe('original');
  });

  it('KHÔNG có chuỗi nhận dạng đề Cambridge ở bất kỳ nội dung nào (V27)', () => {
    const texts = [...sections.flatMap(stringsOf), manifest.id, manifest.levelId, manifest.version];
    const bad = auditFinalTestCambridge(texts);
    expect(
      bad.map((v) => v.message),
      bad.map((v) => v.message).join('\n'),
    ).toEqual([]);
  });
});
