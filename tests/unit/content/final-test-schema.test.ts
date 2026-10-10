// @vitest-environment node
/**
 * RubyLingo — CỔNG SCHEMA + LUẬT cho đề thi cuối khoá (V23–V25, V27).
 *
 * ⭐ VÌ SAO TỆP NÀY TỒN TẠI:
 *   `final-test-content.test.ts` khẳng định ĐỀ THẬT hợp lệ. Nhưng một cổng XANH có thể là cổng RỖNG:
 *   nếu schema/luật quá dễ dãi thì đề hỏng vẫn lọt. Tệp này TIÊM DỮ LIỆU SAI và bắt buộc schema/luật
 *   phải TỪ CHỐI — chứng minh cổng có răng (đúng khuôn `_verify/qa-gate-sensitivity.ts`).
 *
 *   Luật ngữ nghĩa gọi CHÍNH `shared/final-test-rules.ts` mà `scripts/validate-content.ts` dùng.
 */

import { describe, expect, it } from 'vitest';

import {
  finalTestManifestSchema,
  finalTestSectionFileSchema,
} from '../../../shared/schemas/final-test.js';
import type { FinalTestItem } from '../../../shared/schemas/final-test.js';
import { auditFinalTestCambridge, auditFinalTestItem } from '../../../shared/final-test-rules.js';

/** Tập từ "có thật" giả lập cho test luật. */
const WORD_IDS = new Set([
  'starters.boy',
  'starters.cat',
  'starters.apple',
  'starters.kite',
  'starters.hat',
  'starters.milk',
]);

/** Một section file TỐI THIỂU hợp lệ, để mỗi ca chỉ phải đổi đúng một chỗ. */
function validSectionFile(itemOverrides: Partial<Record<string, unknown>> = {}) {
  return {
    section: 'listening',
    title_vi: 'Phần Nghe',
    autoScored: true,
    maxShields: 5,
    parts: [
      {
        id: 'starters.final-test.listening.p1',
        index: 1,
        title_vi: 'Phần 1',
        instruction_vi: 'Nghe rồi chọn.',
        items: [
          {
            id: 'starters.final-test.listening.p1.q1',
            interaction: 'pick_name',
            wordId: 'starters.boy',
            promptEn: 'Who is it?',
            audioTextEn: 'This is a boy.',
            options: ['boy', 'girl'],
            answer: 'boy',
            ...itemOverrides,
          },
        ],
      },
    ],
  };
}

/** Một manifest TỐI THIỂU hợp lệ (đủ 3 section). */
function validManifest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'starters.final-test',
    levelId: 'starters',
    version: '1.0.0',
    source: 'original',
    sections: [
      { section: 'listening', partCount: 1, itemCount: 1, autoScored: true },
      { section: 'reading-writing', partCount: 1, itemCount: 1, autoScored: true },
      { section: 'speaking', partCount: 1, itemCount: 1, autoScored: false },
    ],
    ...overrides,
  };
}

describe('schema: file hợp lệ thì PHẢI qua (chống cổng rỗng)', () => {
  it('section file tối thiểu hợp lệ ⇒ parse thành công', () => {
    expect(finalTestSectionFileSchema.safeParse(validSectionFile()).success).toBe(true);
  });

  it('manifest tối thiểu hợp lệ ⇒ parse thành công', () => {
    expect(finalTestManifestSchema.safeParse(validManifest()).success).toBe(true);
  });
});

describe('schema: TỪ CHỐI cấu trúc sai', () => {
  it('`source` KHÁC "original" ⇒ từ chối (ràng buộc bản quyền)', () => {
    const r = finalTestManifestSchema.safeParse(validManifest({ source: 'cambridge-sample' }));
    expect(r.success).toBe(false);
  });

  it('`maxShields` KHÁC 5 ⇒ từ chối (trần khiên là hợp đồng với thang điểm)', () => {
    const r = finalTestSectionFileSchema.safeParse({ ...validSectionFile(), maxShields: 4 });
    expect(r.success).toBe(false);
  });

  it('`interaction` lạ ⇒ từ chối (union đóng — thêm dạng mới phải khai có chủ đích)', () => {
    const r = finalTestSectionFileSchema.safeParse(
      validSectionFile({ interaction: 'khong_ton_tai', answer: 'x' }),
    );
    expect(r.success).toBe(false);
  });

  it('item thiếu `answer` ⇒ từ chối', () => {
    const file = validSectionFile();
    delete (file.parts[0]!.items[0] as Record<string, unknown>).answer;
    expect(finalTestSectionFileSchema.safeParse(file).success).toBe(false);
  });

  it('item chấm tự động thiếu `wordId` ⇒ từ chối', () => {
    const r = finalTestSectionFileSchema.safeParse(
      (() => {
        const f = validSectionFile();
        delete (f.parts[0]!.items[0] as Record<string, unknown>).wordId;
        return f;
      })(),
    );
    expect(r.success).toBe(false);
  });

  it('manifest khai SAI số section (không phải 3) ⇒ từ chối', () => {
    const r = finalTestManifestSchema.safeParse(
      validManifest({
        sections: [{ section: 'listening', partCount: 1, itemCount: 1, autoScored: true }],
      }),
    );
    expect(r.success).toBe(false);
  });
});

describe('luật V23/V24/V25: TIÊM DỮ LIỆU SAI và bắt buộc phải kêu', () => {
  const rulesOf = (item: FinalTestItem): string[] =>
    auditFinalTestItem(item, WORD_IDS).map((v) => v.rule);

  it('(a) `answer` KHÔNG nằm trong `options` ⇒ báo lỗi', () => {
    const bad = {
      id: 'x.q1',
      interaction: 'pick_name',
      wordId: 'starters.boy',
      options: ['girl', 'man'],
      answer: 'boy',
    } as unknown as FinalTestItem;
    expect(rulesOf(bad)).toContain('V23');
  });

  it('(b) `arrange_letters` có `hintMask` LỆCH độ dài ⇒ báo lỗi', () => {
    const bad = {
      id: 'x.q1',
      interaction: 'arrange_letters',
      wordId: 'starters.kite',
      promptEn: 'Make the word.',
      options: ['k', 'i', 't', 'e'],
      hintMask: 'k__',
      answer: 'kite',
    } as unknown as FinalTestItem;
    expect(rulesOf(bad)).toContain('V24');
  });

  it('(b2) `arrange_letters` xáo trộn SAI tập chữ ⇒ báo lỗi (bé xếp mãi không ra)', () => {
    const bad = {
      id: 'x.q1',
      interaction: 'arrange_letters',
      wordId: 'starters.kite',
      promptEn: 'Make the word.',
      options: ['k', 'i', 't', 'o'],
      hintMask: 'k___',
      answer: 'kite',
    } as unknown as FinalTestItem;
    expect(rulesOf(bad)).toContain('V24');
  });

  it('(c) `audioTextEn` chứa DẤU tiếng Việt ⇒ báo lỗi (máy chỉ đọc en-GB)', () => {
    const bad = {
      id: 'x.q1',
      interaction: 'pick_name',
      wordId: 'starters.boy',
      audioTextEn: 'Đây là một cậu bé.',
      options: ['boy', 'girl'],
      answer: 'boy',
    } as unknown as FinalTestItem;
    expect(rulesOf(bad)).toContain('V25');
  });

  it('(d) `wordId` KHÔNG có thật trong level ⇒ báo lỗi', () => {
    const bad = {
      id: 'x.q1',
      interaction: 'pick_name',
      wordId: 'starters.khong-co-tu-nay',
      options: ['boy', 'girl'],
      answer: 'boy',
    } as unknown as FinalTestItem;
    expect(rulesOf(bad)).toContain('V23');
  });

  it('`gap_fill` có `answer` KHÔNG nằm trong `wordBox` ⇒ báo lỗi', () => {
    const bad = {
      id: 'x.q1',
      interaction: 'gap_fill',
      wordId: 'starters.hat',
      promptEn: 'I have a ___.',
      wordBox: ['book', 'shoe'],
      answer: 'hat',
    } as unknown as FinalTestItem;
    expect(rulesOf(bad)).toContain('V23');
  });

  it('`write_word` có `answer` nhiều từ / viết hoa ⇒ báo lỗi (phải 1 từ chữ thường)', () => {
    const bad = {
      id: 'x.q1',
      interaction: 'write_word',
      wordId: 'starters.milk',
      promptEn: 'Write the word.',
      answer: 'Ice Cream',
    } as unknown as FinalTestItem;
    expect(rulesOf(bad)).toContain('V23');
  });

  it('item HỢP LỆ ⇒ KHÔNG có vi phạm (chống luật luôn kêu)', () => {
    const good = {
      id: 'x.q1',
      interaction: 'pick_name',
      wordId: 'starters.boy',
      promptEn: 'Who is it?',
      audioTextEn: 'This is a boy.',
      options: ['boy', 'girl'],
      answer: 'boy',
    } as unknown as FinalTestItem;
    expect(auditFinalTestItem(good, WORD_IDS)).toEqual([]);
  });

  it('V27: chuỗi nhận dạng Cambridge ⇒ báo lỗi', () => {
    const bad = auditFinalTestCambridge(['This is a Cambridge sample test.']);
    expect(bad.map((v) => v.rule)).toContain('V27');
  });

  it('V27: câu tiếng Anh bình thường ⇒ KHÔNG kêu (chống cổng rỗng/kêu oan)', () => {
    expect(auditFinalTestCambridge(['This is a boy. He is happy.'])).toEqual([]);
  });
});
