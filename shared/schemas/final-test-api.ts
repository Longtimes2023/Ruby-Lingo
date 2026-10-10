/**
 * RubyLingo — Zod schema cho API bài thi cuối khoá Starters (dùng CHUNG client + server).
 *
 * ⚠️ VÌ SAO Ở `shared/` VÀ KHÔNG NHÉT VÀO `final-test.ts` (schema NỘI DUNG):
 *   `final-test.ts` mô tả ĐỀ THI TĨNH (đọc từ `src/data/.../final-test/*.json`). Tệp này mô tả
 *   HỢP ĐỒNG HTTP (client gửi gì lên, server trả gì về). Hai miền khác nhau, hai vòng đời khác
 *   nhau — gộp lại sẽ khiến sửa hợp đồng API phải đụng vào schema nội dung đã khoá từ G4.
 *
 * ⚠️⚠️ BODY NỘP BÀI **KHÔNG CÓ** TRƯỜNG `shields`/`score`/`correctFirstTry` — ĐÓ LÀ CHỦ Ý.
 *   Client chỉ gửi SỰ THẬT THÔ: từng câu (`itemId`), có đúng ngay lần đầu không (`firstTry`),
 *   đã thua mấy lần (`wrongAttempts`). SERVER tự đếm rồi tự tính khiên bằng đúng hàm ở
 *   `shared/final-test-scoring.ts`. Một trường `shields` do client khai là một trường có thể
 *   MÂU THUẪN với chính `answers` gửi kèm — và khi ấy phải chọn tin bên nào. Bỏ hẳn đi thì câu
 *   hỏi đó không tồn tại, và `{"shields": 5}` trong JSON bị schema cắt bỏ (không có khoá nào
 *   nhận nó). Cùng nguyên tắc "server là trọng tài cuối" như `gameResultSubmissionSchema`.
 *
 * ⚠️ `section` NẰM TRÊN ĐƯỜNG DẪN, KHÔNG Ở TRONG BODY.
 *   Cùng lối đã áp cho `:itemId` ở `equipItemRequestSchema`: một sự thật chỉ có MỘT chỗ khai.
 *   Hai nguồn (`:section` trên URL và `section` trong body) chỉ cần lệch nhau một lần là nộp
 *   nhầm phần. Vì vậy `finalTestSubmissionSchema` KHÔNG có `section`; route lấy phần thi từ
 *   `:section` rồi truyền xuống service.
 */

import { z } from 'zod';
import { finalTestSectionIdSchema } from './final-test.js';

/** Trần số câu trả lời trong một lần nộp / một lần lưu tiến độ (phần lớn nhất có 25 câu). */
export const MAX_FINAL_TEST_ANSWERS = 40;

/** Trần số lần thua ở MỘT câu (khớp `MAX_WRONG_PER_ANSWER` của game — cùng ý nghĩa). */
export const MAX_FINAL_TEST_WRONG = 50;

/** Trần độ dài một đáp án thô bé chọn (đáp án dài nhất là một từ tiếng Anh). */
export const MAX_FINAL_TEST_ANSWER_VALUE = 200;

/** Chuỗi ISO-8601 UTC, có `Z` ở cuối — điều kiện để so sánh mốc thời gian bằng chuỗi. */
const isoUtcSchema = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/,
    'Thời điểm phải ở định dạng ISO-8601 UTC (có Z ở cuối)',
  );

/** Id do client sinh, dùng để server chống ghi trùng khi client gửi lại. */
const clientEventIdSchema = z
  .string()
  .trim()
  .min(1, 'Thiếu mã sự kiện')
  .max(64, 'Mã sự kiện quá dài')
  .regex(/^[A-Za-z0-9_-]+$/, 'Mã sự kiện chứa ký tự không hợp lệ');

/** id của một item trong đề (khoá trong DB/nội dung). */
const itemIdSchema = z.string().trim().min(1).max(120);

// =============================================================================
// NỘP MỘT PHẦN THI
// =============================================================================

/**
 * Một câu trả lời THÔ của bé ở một item.
 *
 * ⚠️ `firstTry` và `wrongAttempts` KHÔNG THỂ cùng "đúng" — xem `superRefine` bên dưới. Cặp số
 *    vô nghĩa (vừa đúng ngay lần đầu vừa có lần sai) chỉ có thể đến từ một client lỗi hoặc một
 *    JSON bị sửa tay; nhận nó nghĩa là cộng một con số không thể tin vào khiên của bé.
 */
export const finalTestAnswerSchema = z
  .object({
    itemId: itemIdSchema,
    firstTry: z.boolean(),
    wrongAttempts: z.number().int().min(0).max(MAX_FINAL_TEST_WRONG),
  })
  .superRefine((answer, ctx) => {
    if (answer.firstTry && answer.wrongAttempts > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['wrongAttempts'],
        message: 'Đúng ngay lần đầu thì không thể có lần chọn sai',
      });
    }
  });

export type FinalTestAnswerInput = z.infer<typeof finalTestAnswerSchema>;

/**
 * Body của `POST /api/children/:id/final-test/:section/submit`.
 *
 * ⚠️ KHÔNG có `section` (nằm trên URL) và KHÔNG có `shields`/`score` (server tự tính). Xem ghi
 *    chú đầu tệp.
 */
export const finalTestSubmissionSchema = z.object({
  clientEventId: clientEventIdSchema,
  occurredAt: isoUtcSchema,
  answers: z.array(finalTestAnswerSchema).max(MAX_FINAL_TEST_ANSWERS),
});

export type FinalTestSubmissionInput = z.infer<typeof finalTestSubmissionSchema>;

// =============================================================================
// LƯU TIẾN ĐỘ ĐANG DỞ
// =============================================================================

/** Một câu bé đã chọn đáp án nhưng phần thi CHƯA xong (để làm tiếp khi mở lại / đổi máy). */
export const finalTestProgressAnswerSchema = z.object({
  itemId: itemIdSchema,
  value: z.string().max(MAX_FINAL_TEST_ANSWER_VALUE),
});

export type FinalTestProgressAnswerInput = z.infer<typeof finalTestProgressAnswerSchema>;

/**
 * Body của `PUT /api/children/:id/final-test/progress`.
 *
 * ⚠️ `answered` KHÔNG có trong body: server suy nó từ `answers.length`. Một con số đếm do client
 *    khai riêng là nguồn sự thật thứ hai cho cùng một việc.
 */
export const finalTestProgressSaveSchema = z.object({
  section: finalTestSectionIdSchema,
  answers: z.array(finalTestProgressAnswerSchema).max(MAX_FINAL_TEST_ANSWERS),
});

export type FinalTestProgressSaveInput = z.infer<typeof finalTestProgressSaveSchema>;

// =============================================================================
// PHẢN HỒI
// =============================================================================

/** Khiên hợp lệ 1–5 (SÀN = 1) — khớp `ShieldCount` ở `shared/final-test-scoring.ts`. */
const shieldCountSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

/** "Còn thiếu gì để mở cổng" — khuôn khớp `FinalTestRequirement` ở `shared/final-test-access.ts`. */
const finalTestRequirementSchema = z.union([
  z.object({
    type: z.literal('lessons_incomplete'),
    lessonsMissing: z.number().int().min(0),
    lessonsCompleted: z.number().int().min(0),
    lessonsTotal: z.number().int().min(0),
  }),
  z.object({
    type: z.literal('games_unplayed'),
    gamesMissing: z.number().int().min(0),
    gamesPlayed: z.number().int().min(0),
    gamesTotal: z.number().int().min(0),
  }),
]);

/** Trạng thái cổng vào khu vực thi — khớp `FinalTestAccess`. */
export const finalTestAccessSchema = z.object({
  kind: z.enum(['locked', 'ready', 'pending', 'done']),
  enterable: z.boolean(),
  requirement: finalTestRequirementSchema.nullable(),
  lessonsCompleted: z.number().int().min(0),
  lessonsTotal: z.number().int().min(0),
  exercisesPlayed: z.number().int().min(0),
  exercisesTotal: z.number().int().min(0),
});

/** Tiến độ đang dở của một phần. */
export const finalTestProgressSchema = z.object({
  section: finalTestSectionIdSchema,
  answered: z.number().int().min(0).max(MAX_FINAL_TEST_ANSWERS),
  answers: z.array(finalTestProgressAnswerSchema).max(MAX_FINAL_TEST_ANSWERS),
  updatedAt: isoUtcSchema,
});

/** Tóm tắt một phần thi cho màn "Khu vực thi". */
export const finalTestSectionStatusSchema = z.object({
  section: finalTestSectionIdSchema,
  autoScored: z.boolean(),
  totalItems: z.number().int().min(1),
  /** Khiên cao nhất từng đạt — `null` nếu bé CHƯA hoàn thành phần này lần nào. */
  bestShields: shieldCountSchema.nullable(),
  /** Đã có ≥1 lần hoàn thành phần này chưa. */
  completed: z.boolean(),
  attempts: z.number().int().min(0),
  /** Thời điểm NỘP GẦN NHẤT (ISO UTC) — `null` nếu bé CHƯA nộp phần này lần nào. */
  lastAttemptAt: isoUtcSchema.nullable(),
  /** Tiến độ đang dở (nếu có). */
  progress: finalTestProgressSchema.nullable(),
});

/** Phản hồi của `GET /api/children/:id/final-test`. */
export const finalTestGateResponseSchema = z.object({
  childId: z.string().trim().min(1).max(64),
  gate: finalTestAccessSchema,
  sections: z.array(finalTestSectionStatusSchema),
  serverTime: isoUtcSchema,
});

/** Phản hồi của `POST /api/children/:id/final-test/:section/submit`. */
export const finalTestSubmitResultSchema = z.object({
  section: finalTestSectionIdSchema,
  /** `true` nếu lần nộp này ĐÃ được ghi từ trước (client gửi lại sau khi mất phản hồi). */
  duplicate: z.boolean(),
  totalItems: z.number().int().min(1),
  correctFirstTry: z.number().int().min(0),
  /** Khiên của lần nộp này — LUÔN 1–5. */
  shields: shieldCountSchema,
  /** Khiên cao nhất của phần này SAU lần nộp (không bao giờ giảm). */
  bestShields: shieldCountSchema,
  /** Lần này có phá kỷ lục khiên của phần không. */
  isNewRecord: z.boolean(),
  /** Lần này có làm XONG CẢ BÀI THI lần đầu không (⇒ phần thưởng được trao). */
  firstCompletion: z.boolean(),
  xpGained: z.number().int().min(0),
  starsGained: z.number().int().min(0),
  acornsGained: z.number().int().min(0),
  levelUp: z
    .object({
      from: z.number().int().min(0),
      to: z.number().int().min(0),
      rewards: z.array(
        z.object({
          kind: z.enum(['stars', 'acorns', 'xp', 'badge', 'sticker', 'item']),
          refId: z.string().min(1).optional(),
          amount: z.number().int().min(0).optional(),
        }),
      ),
    })
    .nullable(),
  questsCompleted: z.array(z.string()),
  badgesEarned: z.array(z.string()),
});
