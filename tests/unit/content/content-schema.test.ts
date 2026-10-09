/**
 * Test schema nội dung (task T013 + T017 — `tests/fixtures/**`).
 *
 * CÁCH LÀM: chỉ có MỘT file fixture hợp lệ (`valid-minimal.json`). Mọi ca lỗi được tạo
 * bằng cách sao chép rồi BIẾN ĐỔI đúng một chỗ. Vì sao không tạo 6 file lỗi riêng:
 * chúng sẽ giống nhau ~90%, và mỗi lần sửa schema phải sửa 6 chỗ — sớm muộn sẽ lệch
 * nhau. Biến đổi tại chỗ còn làm câu test TỰ GIẢI THÍCH được nó phá cái gì.
 *
 * Mỗi ca dưới đây tương ứng một LỖI THẬT đã từng xảy ra khi sinh nội dung, không phải
 * ca lý thuyết:
 *   - thiếu `picturable`      ⇒ game Nghe & Chạm không có hình để chạm
 *   - thiếu `type: 'title'`   ⇒ Mr/Mrs/Miss không có kiểu từ hợp lệ
 *   - bài 3 từ / 9 từ         ⇒ lưới từ tràn màn hình điện thoại
 *   - `level` thiếu name_en   ⇒ schema trượt ⇒ validator KHÔNG nạp theme nào ⇒ che 6 lỗi khác
 *   - prepositions sai khớp   ⇒ bé không thể chọn đúng / câu đọc không khớp đáp án
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  exerciseConfigSchema,
  levelSchema,
  lessonSchema,
  themeFileSchema,
  wordSchema,
} from '@shared/schemas/content.js';

import validTheme from '../../fixtures/theme/valid-minimal.json';

/** Bản sao sâu, kiểu "JSON mở" để tiện phá hoại có chủ đích. */
type Json = Record<string, unknown>;
const clone = (): Json => JSON.parse(JSON.stringify(validTheme)) as Json;

const words = (t: Json): Array<Record<string, unknown>> => t.words as Array<Record<string, unknown>>;
const lessons = (t: Json): Array<Record<string, unknown>> =>
  t.lessons as Array<Record<string, unknown>>;
const exercises = (t: Json): Array<Record<string, unknown>> =>
  t.exercises as Array<Record<string, unknown>>;
const config = (t: Json): Record<string, unknown> =>
  exercises(t)[0]!.config as Record<string, unknown>;

/**
 * Gộp thông báo lỗi thành một chuỗi để assert bằng `toContain`.
 *
 * Nhận `unknown` (không phải `ZodSafeParseResult<T>`) vì mỗi schema ở đây có kiểu `T`
 * khác nhau; nếu khai báo chặt thì mỗi lần gọi lại phải chỉ định generic mà chẳng thêm
 * được gì — helper này chỉ đọc `issues` để hiển thị.
 */
function messagesOf(result: unknown): string {
  const r = result as {
    success?: boolean;
    error?: { issues?: Array<{ message?: string; path?: Array<string | number> }> };
  };
  if (r.success || !r.error?.issues) return '';
  return r.error.issues
    .map((i) => `${(i.path ?? []).join('.')}: ${i.message ?? ''}`)
    .join(' | ');
}

/** Bỏ một trường khỏi bản sao, không dùng destructuring (tránh biến thừa). */
function without(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy = { ...source };
  delete copy[key];
  return copy;
}

describe('fixture gốc', () => {
  it('phải hợp lệ — nếu không thì mọi ca dưới đây vô nghĩa', () => {
    const parsed = themeFileSchema.safeParse(clone());
    expect(messagesOf(parsed)).toBe('');
    expect(parsed.success).toBe(true);
  });
});

describe('wordSchema — `picturable` là bắt buộc', () => {
  it('thiếu `picturable` ⇒ từ chối (bug thật: 275 từ đều thiếu)', () => {
    const w = without(words(clone())[0]!, 'picturable');
    const parsed = wordSchema.safeParse(w);
    expect(parsed.success).toBe(false);
    expect(messagesOf(parsed)).toContain('picturable');
  });

  it('`picturable: false` là HỢP LỆ — từ trừu tượng vẫn có chỗ đứng', () => {
    const w = words(clone())[0]!;
    w.picturable = false;
    expect(wordSchema.safeParse(w).success).toBe(true);
  });

  it("chấp nhận `type: 'title'` cho Mr/Mrs/Miss (bug thật: thiếu trong PosType)", () => {
    const w = words(clone())[0]!;
    w.type = 'title';
    expect(wordSchema.safeParse(w).success).toBe(true);
  });

  it('từ chối `type` không nằm trong danh sách', () => {
    const w = words(clone())[0]!;
    w.type = 'interjection';
    expect(wordSchema.safeParse(w).success).toBe(false);
  });
});

describe('lessonSchema — kích thước bài 4–8 từ', () => {
  it('4 từ là hợp lệ (biên dưới)', () => {
    expect(lessonSchema.safeParse(lessons(clone())[0]).success).toBe(true);
  });

  it('3 từ ⇒ từ chối', () => {
    const l = lessons(clone())[0]!;
    l.wordIds = ['fix-level.a', 'fix-level.b', 'fix-level.c'];
    const parsed = lessonSchema.safeParse(l);
    expect(parsed.success).toBe(false);
    expect(messagesOf(parsed)).toContain('4–8');
  });

  it('9 từ ⇒ từ chối (bug thật: bài "Màu sắc" có 11 từ)', () => {
    const l = lessons(clone())[0]!;
    l.wordIds = Array.from({ length: 9 }, (_, i) => `fix-level.w${i}`);
    const parsed = lessonSchema.safeParse(l);
    expect(parsed.success).toBe(false);
    expect(messagesOf(parsed)).toContain('4–8');
  });

  it('KHÔNG còn trường `order` trong dữ liệu đã parse', () => {
    const l = lessons(clone())[0]!;
    l.order = 1;
    const parsed = lessonSchema.safeParse(l);
    // Zod mặc định BỎ QUA khoá lạ, nên vẫn "hợp lệ" — nhưng `order` phải biến mất khỏi
    // kết quả. Đó mới là điều cần khẳng định: nó không còn là một phần của dữ liệu, nên
    // không thể lệch với `theme.lessonIds` (hai nguồn chân lý cho cùng một thứ).
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect('order' in parsed.data).toBe(false);
  });
});

describe('levelSchema — trường mà validator phụ thuộc', () => {
  const validLevel: Record<string, unknown> = {
    id: 'fix-level',
    code: 'fix-level',
    name_en: 'Fixture level',
    name_vi: 'Cấp thử',
    order: 1,
    themeIds: ['fix-theme'],
  };

  it('hợp lệ với đủ trường', () => {
    expect(levelSchema.safeParse(validLevel).success).toBe(true);
  });

  it('thiếu `name_en` ⇒ từ chối (bug thật: đã che 6 lỗi nội dung khác)', () => {
    const parsed = levelSchema.safeParse(without(validLevel, 'name_en'));
    expect(parsed.success).toBe(false);
    expect(messagesOf(parsed)).toContain('name_en');
  });

  it('`themeIds` rỗng ⇒ từ chối (bản đồ hành trình không thể rỗng)', () => {
    const parsed = levelSchema.safeParse({ ...validLevel, themeIds: [] });
    expect(parsed.success).toBe(false);
  });

  it('thiếu `order` ⇒ từ chối (cần để sắp menu chọn cấp học)', () => {
    expect(levelSchema.safeParse(without(validLevel, 'order')).success).toBe(false);
  });
});

describe('exerciseConfigSchema — discriminated union', () => {
  it('module import được ⇒ hồi quy lỗi `discriminatedUnion` + ZodEffects', () => {
    // Lỗi thật: `.refine()` bọc schema thành ZodEffects, `discriminatedUnion` ném
    // "Cannot read properties of undefined (reading 'kind')" NGAY LÚC IMPORT.
    // Chỉ cần file này import được và hàm dưới chạy là lỗi đó không tái phát.
    expect(typeof exerciseConfigSchema.safeParse).toBe('function');
  });

  it('`kind` sai ⇒ từ chối', () => {
    const c = config(clone());
    c.kind = 'not_a_game';
    expect(exerciseConfigSchema.safeParse(c).success).toBe(false);
  });

  it('thiếu trường bắt buộc của kind ⇒ từ chối', () => {
    expect(exerciseConfigSchema.safeParse(without(config(clone()), 'optionCount')).success).toBe(
      false,
    );
  });

  it('`optionCount` ngoài 2–6 ⇒ từ chối', () => {
    const c = config(clone());
    c.optionCount = 9;
    expect(exerciseConfigSchema.safeParse(c).success).toBe(false);
  });

  describe('prepositions — 2 quy tắc ở superRefine (sau union)', () => {
    interface PrepSlot {
      sentenceEn: string;
      preposition: string;
      correctSlot: string;
      slots: string[];
    }
    const validPrep = {
      kind: 'prepositions',
      rounds: 3,
      slots: [
        {
          sentenceEn: 'The ball is under the table.',
          preposition: 'under',
          correctSlot: 'under',
          slots: ['in', 'on', 'under'],
        },
      ] as PrepSlot[],
    };

    it('cấu hình đúng ⇒ hợp lệ', () => {
      expect(exerciseConfigSchema.safeParse(validPrep).success).toBe(true);
    });

    it('`correctSlot` không nằm trong `slots` ⇒ từ chối (bé không thể chọn đúng)', () => {
      const bad = structuredClone(validPrep);
      bad.slots[0]!.correctSlot = 'behind';
      const parsed = exerciseConfigSchema.safeParse(bad);
      expect(parsed.success).toBe(false);
      expect(messagesOf(parsed)).toContain('không nằm trong slots');
    });

    it('`sentenceEn` không chứa `preposition` ⇒ từ chối (câu đọc không khớp đáp án)', () => {
      const bad = structuredClone(validPrep);
      bad.slots[0]!.sentenceEn = 'The ball is on the table.';
      const parsed = exerciseConfigSchema.safeParse(bad);
      expect(parsed.success).toBe(false);
      expect(messagesOf(parsed)).toContain('không chứa preposition');
    });
  });
});

describe('nội dung THẬT trên đĩa phải qua được schema', () => {
  // Test tích hợp: đọc thẳng 11 file theme thật. Đây là lưới an toàn bắt trường hợp
  // schema chặt lên mà nội dung chưa cập nhật (hoặc ngược lại) — thứ mà test fixture
  // không bao giờ phát hiện được.
  const levelsDir = join(process.cwd(), 'src', 'data', 'levels');

  it('mọi file theme của mọi level đều hợp lệ', () => {
    const failures: string[] = [];
    let checked = 0;

    for (const levelId of readdirSync(levelsDir)) {
      const themesDir = join(levelsDir, levelId, 'themes');
      let files: string[];
      try {
        files = readdirSync(themesDir).filter((f) => f.endsWith('.json'));
      } catch {
        continue; // level chưa có thư mục themes — bỏ qua
      }
      for (const file of files) {
        checked++;
        const raw: unknown = JSON.parse(readFileSync(join(themesDir, file), 'utf8'));
        const parsed = themeFileSchema.safeParse(raw);
        if (!parsed.success) failures.push(`${levelId}/themes/${file}: ${messagesOf(parsed)}`);
      }
    }

    expect(failures).toEqual([]);
    // 11 chủ đề Starters — nếu số này đổi thì hoặc là cố ý, hoặc là việc đọc file hỏng.
    expect(checked).toBe(11);
  });
});
