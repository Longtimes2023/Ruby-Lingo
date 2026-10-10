/**
 * RubyLingo — Zod schema cho BÀI THI CUỐI KHOÁ Starters (nội dung TĨNH, JSON).
 *
 * ⚠️⚠️ NỘI DUNG TỰ SOẠN — RÀNG BUỘC CỨNG VỀ BẢN QUYỀN.
 *   KHÔNG dán đề/transcript/wordlist/ảnh/audio của Cambridge vào `final-test/*.json`.
 *   Đề trong app chỉ MÔ PHỎNG DẠNG BÀI (Listening 4 part · Reading & Writing 5 part · Speaking 4 part),
 *   còn nội dung do RubyLingo tự viết, dùng lại từ vựng có sẵn của level (`src/data/levels/starters/themes/*`).
 *   `manifest.source` BẮT BUỘC = "original"; luật V27 ở `scripts/validate-content.ts` chặn chuỗi
 *   nhận dạng Cambridge ngay ở tầng build. Chi tiết: `docs/ke-hoach/thiet-ke-bai-thi-cuoi-khoa.md` §10.
 *
 * ⭐ VÌ SAO BÀI THI LÀ MIỀN DỮ LIỆU RIÊNG (không nhét vào `Exercise`):
 *   `Exercise` gắn chặt với `lesson_progress` / `game_result` (điểm, sao, XP, huy hiệu, nhiệm vụ).
 *   Nhồi bài thi vào đó sẽ LÀM BẨN sổ của bé và đếm sai nhiệm vụ/huy hiệu. Bài thi có "khiên" riêng,
 *   có phần Speaking không chấm tự động, và 3 section độc lập — đó là một thực thể khác.
 *
 * ⚠️ KỸ THUẬT: `z.discriminatedUnion` chỉ nhận các thành viên là `ZodObject` THUẦN. Mọi quy tắc
 *    ngữ nghĩa (đáp án phải nằm trong `options`, `hintMask` khớp `answer`, `audioTextEn` chỉ tiếng Anh…)
 *    KHÔNG được `.refine()` bên trong union — chúng nằm ở luật V21–V27 (`scripts/validate-content.ts`)
 *    hoặc ở module luật thuần `shared/final-test-rules.ts` để test gọi lại được.
 *
 * ⚠️ Luật id (`idString`) khai LẠI CỤC BỘ thay vì import từ `content.ts`: `content.ts` phải import
 *    `finalTestIndexEntrySchema` ở đây để mở rộng `contentIndexFileSchema`, nên import ngược lại
 *    sẽ tạo VÒNG. Regex chỉ 1 dòng — rủi ro lệch là không đáng kể so với rủi ro vòng import.
 */

import { z } from 'zod';

/** Slug id: chữ thường, số, gạch ngang; cho phép '.' và '/' — GIỐNG `idString` ở `content.ts`. */
const idString = z
  .string()
  .min(2)
  .regex(/^[a-z0-9][a-z0-9._/-]*$/, 'id chỉ được chứa a-z 0-9 . _ - /');

// =============================================================================
// Section & item
// =============================================================================

/** Ba phần thi — đúng thứ tự này trong `manifest.sections` (V21 kiểm). */
export const finalTestSectionIdSchema = z.enum(['listening', 'reading-writing', 'speaking']);
export type FinalTestSectionId = z.infer<typeof finalTestSectionIdSchema>;

/**
 * Kiểu tương tác của một item. Đây là union ĐÓNG theo thiết kế §2.4 (KHÔNG thêm vào `GameType` —
 * đó là union game, đã chốt 12 giá trị). Giai đoạn sau sẽ map `interaction → component` ở
 * `src/components/final-test/registry.tsx`.
 */
export type FinalTestInteraction =
  | 'pick_name' // Listening P1  — nghe → chọn đúng nhân vật
  | 'write_word' // Listening P2  — nghe → viết 1 tên/số/chữ cái
  | 'choose_picture' // Listening P3/P4 — nghe → chọn 1 trong 3 tranh
  | 'tick_cross' // Reading P1    — đọc câu ↔ tranh → tick/cross
  | 'yes_no' // Reading P2    — đọc câu ↔ tranh → yes/no
  | 'arrange_letters' // Reading P3    — xếp chữ cái thành từ
  | 'gap_fill' // Reading P4    — chọn từ ở khung điền vào chỗ trống
  | 'story_answer' // Reading P5    — trả lời 1 từ về truyện tranh
  | 'speak_prompt'; // Speaking        — chỉ nhắc bé nói, KHÔNG chấm tự động

/** Item nhiều lựa chọn / viết ngắn (Listening P1–P2, Reading P1–P2). */
const finalTestChoiceItemSchema = z.object({
  id: idString,
  interaction: z.enum(['pick_name', 'write_word', 'tick_cross', 'yes_no']),
  /** Từ vựng CÓ THẬT của level mà item này kiểm (validator V23 chặn id sai). */
  wordId: idString,
  promptEn: z.string().min(1).optional(),
  /** CHỈ tiếng Anh — TTS en-GB (B7); luật V25 chặn dấu tiếng Việt. */
  audioTextEn: z.string().min(1).optional(),
  /** Khoá asset (KHÔNG phải đường dẫn). */
  imageKey: z.string().min(1).optional(),
  options: z.array(z.string().min(1)).min(2).max(6).optional(),
  answer: z.string().min(1),
});

/** Item dạng tranh (Listening P3–P4: chọn tranh) và xếp chữ cái (Reading P3). */
const finalTestPictureItemSchema = z.object({
  id: idString,
  interaction: z.enum(['choose_picture', 'arrange_letters']),
  wordId: idString,
  promptEn: z.string().min(1),
  audioTextEn: z.string().min(1).optional(),
  imageKey: z.string().min(1).optional(),
  imageKeys: z.array(z.string().min(1)).length(3).optional(),
  /**
   * ⚠️ Với `choose_picture`: 3 nhãn tranh (`answer` nằm trong đây).
   *    Với `arrange_letters`: CHÍNH LÀ các chữ cái đã xáo trộn (V24 kiểm tập chữ = tập chữ của `answer`).
   *    ⚠️ Đây là lý do schema dùng `.min(3)` chứ KHÔNG `.min(3).max(3)` như bản thiết kế §2.4 —
   *       "apple" cần 5 chữ cái, `.max(3)` sẽ chặn nhầm chính dạng xếp chữ.
   */
  options: z.array(z.string().min(1)).min(3).optional(),
  /** Gạch gợi ý số chữ cho bé (vd "c _ _") — bắt buộc với `arrange_letters`, V24 kiểm. */
  hintMask: z.string().min(1).optional(),
  answer: z.string().min(1),
});

/** Item điền khuyết (Reading P4) và trả lời truyện 1 từ (Reading P5). */
const finalTestGapItemSchema = z.object({
  id: idString,
  interaction: z.enum(['gap_fill', 'story_answer']),
  wordId: idString,
  promptEn: z.string().min(1),
  audioTextEn: z.string().min(1).optional(),
  imageKey: z.string().min(1).optional(),
  /** Khung từ cho `gap_fill` (`answer` phải nằm trong đây — V23). */
  wordBox: z.array(z.string().min(1)).min(2).optional(),
  answer: z.string().min(1),
});

/**
 * Item NÓI. KHÔNG có `answer`: phần Speaking không chấm tự động (bé tự nói theo mẫu en-GB,
 * không ghi âm, không AI chấm — xem §3.4). `wordId` tuỳ chọn vì câu hỏi cá nhân không gắn từ nào.
 */
const finalTestSpeakItemSchema = z.object({
  id: idString,
  interaction: z.literal('speak_prompt'),
  promptEn: z.string().min(1),
  audioTextEn: z.string().min(1).optional(),
  imageKey: z.string().min(1).optional(),
  wordId: idString.optional(),
});

export const finalTestItemSchema = z.discriminatedUnion('interaction', [
  finalTestChoiceItemSchema,
  finalTestPictureItemSchema,
  finalTestGapItemSchema,
  finalTestSpeakItemSchema,
]);

export type FinalTestItem = z.infer<typeof finalTestItemSchema>;

export const finalTestPartSchema = z.object({
  id: idString,
  index: z.number().int().min(1),
  title_vi: z.string().min(1),
  /** Tiếng Việt: CHỈ hiển thị (B7) — không bao giờ đưa vào `audioTextEn`. */
  instruction_vi: z.string().min(1),
  items: z.array(finalTestItemSchema).min(1),
});

export type FinalTestPart = z.infer<typeof finalTestPartSchema>;

export const finalTestSectionFileSchema = z.object({
  /** Ghi chú bản quyền (xem đầu file). */
  note: z.string().optional(),
  section: finalTestSectionIdSchema,
  title_vi: z.string().min(1),
  /** Listening / Reading & Writing: true. Speaking: false (KHÔNG chấm tự động). */
  autoScored: z.boolean(),
  /** Trần khiên của phần này — luôn = 5 (mô hình Cambridge); SÀN = 1 (B1) do thang điểm lo. */
  maxShields: z.literal(5),
  parts: z.array(finalTestPartSchema).min(1),
});

export type FinalTestSectionFile = z.infer<typeof finalTestSectionFileSchema>;

// =============================================================================
// Manifest
// =============================================================================

/** Tóm tắt một section — dùng chung cho `manifest.json` và khối `finalTest` của content-index. */
export const finalTestSectionSummarySchema = z.object({
  section: finalTestSectionIdSchema,
  partCount: z.number().int().min(1),
  itemCount: z.number().int().min(1),
  autoScored: z.boolean(),
});

export type FinalTestSectionSummary = z.infer<typeof finalTestSectionSummarySchema>;

export const finalTestManifestSchema = z.object({
  note: z.string().optional(),
  /** "starters.final-test" — cũng là tiền tố id của mọi part/item. */
  id: idString,
  levelId: idString,
  /** Đổi khi sửa đề — dùng cho cache-busting + thống kê. */
  version: z.string().min(1),
  /** BẮT BUỘC: khẳng định đề là nội dung TỰ SOẠN (bản quyền — V27). */
  source: z.literal('original'),
  sections: z.array(finalTestSectionSummarySchema).length(3),
});

export type FinalTestManifest = z.infer<typeof finalTestManifestSchema>;

// =============================================================================
// Khối bài thi trong content-index (bản chiếu cho SERVER — không chép cả đề)
// =============================================================================

/**
 * Server ĐỌC khối này để biết "bài thi gồm mấy phần, mỗi phần mấy câu, phần nào chấm tự động"
 * khi chấm. KHÔNG chép toàn bộ đề vào index (đề nặng, server không cần từng item).
 */
export const finalTestIndexEntrySchema = z.object({
  id: idString,
  version: z.string().min(1),
  sections: z.array(finalTestSectionSummarySchema).length(3),
});

export type FinalTestIndexEntry = z.infer<typeof finalTestIndexEntrySchema>;
