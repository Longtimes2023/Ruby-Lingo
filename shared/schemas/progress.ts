/**
 * RubyLingo — Zod schema cho TIẾN ĐỘ (dùng chung client + server).
 *
 * ⚠️ VÌ SAO PHẢI GIỚI HẠN SỐ LƯỢNG SỰ KIỆN (`MAX_EVENTS_PER_SYNC`):
 *   Đây là endpoint DUY NHẤT mà client gửi lên một MẢNG có độ dài do nó quyết định. Không
 *   giới hạn thì một client hỏng (hoặc một kẻ tấn công) gửi 500.000 sự kiện trong một
 *   request, và server sẽ cố ghi từng cái trong một transaction — khoá DB, làm sập app của
 *   mọi bé khác. Giới hạn này là hàng rào chống tê liệt, không phải chuyện thẩm mỹ.
 *   Con số 200 đủ rộng cho một buổi học dài không có mạng, và đủ nhỏ để một request vẫn
 *   xử lý xong trong vài chục mili giây.
 *
 * ⚠️ VÌ SAO `occurredAt` BẮT BUỘC LÀ ISO-8601 UTC:
 *   Luật gộp là "lần ghi sau thắng" và so sánh bằng CHUỖI (xem `shared/progress-merge.ts`).
 *   Phép so sánh đó chỉ đúng khi mọi chuỗi cùng định dạng, cùng múi giờ. Một chuỗi
 *   `"06/10/2026"` lọt vào sẽ sắp xếp sai hoàn toàn và phá cơ chế đồng bộ.
 */

import { z } from 'zod';

import { GAME_TYPES } from '../game-scoring.js';
import type { GameType } from '../types/content.js';

/** Trần số sự kiện trong một lần đồng bộ. Xem ghi chú đầu file. */
export const MAX_EVENTS_PER_SYNC = 200;

/** Trần số bản ghi client được gửi lên trong một ảnh chụp. */
export const MAX_RECORDS_PER_SYNC = 2_000;

/** Chuỗi ISO-8601 UTC, có `Z` ở cuối — điều kiện để so sánh chuỗi đúng được. */
const isoUtcSchema = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/,
    'Thời điểm phải ở định dạng ISO-8601 UTC (có Z ở cuối)',
  );

/** Khoá ngày địa phương YYYY-MM-DD. */
const dateKeySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải ở định dạng YYYY-MM-DD');

/**
 * Id do client sinh, dùng để server chống ghi trùng khi client gửi lại.
 *
 * ⚠️ Có giới hạn độ dài vì giá trị này được lưu vào một cột có chỉ mục UNIQUE. Một chuỗi
 *    dài bất kỳ sẽ làm chỉ mục phình ra và (tệ hơn) cho phép client nhét dữ liệu tuỳ ý vào
 *    khoá chính. Chỉ cho phép chữ, số và dấu gạch — đúng những gì `newIdWithPrefix` sinh ra.
 */
const clientEventIdSchema = z
  .string()
  .trim()
  .min(1, 'Thiếu mã sự kiện')
  .max(64, 'Mã sự kiện quá dài')
  .regex(/^[A-Za-z0-9_-]+$/, 'Mã sự kiện chứa ký tự không hợp lệ');

/** id của từ / bài / chủ đề. Có giới hạn độ dài vì đây là khoá trong DB. */
const contentIdSchema = z.string().trim().min(1).max(120);

// =============================================================================
// Sự kiện tiến độ
// =============================================================================

/**
 * Một sự kiện tiến độ do client sinh ra.
 *
 * ⚠️ `wordId`/`lessonId` là TUỲ CHỌN ở cấp schema và được kiểm chéo với `kind` bằng
 *    `superRefine`. Không thể khai `wordId` bắt buộc khi `kind === 'word_answer'` bằng
 *    `z.discriminatedUnion` gọn gàng hơn — nhưng cách đó tạo ra một union phức tạp khó đọc
 *    ở phía client. `superRefine` giữ một hình dạng phẳng, dễ dùng, mà vẫn bắt đủ lỗi.
 */
export const progressEventSchema = z
  .object({
    clientEventId: clientEventIdSchema,
    kind: z.enum(['word_answer', 'word_learned', 'lesson_completed']),
    wordId: contentIdSchema.optional(),
    lessonId: contentIdSchema.optional(),
    correct: z.boolean().optional(),
    occurredAt: isoUtcSchema,
  })
  .superRefine((event, ctx) => {
    if ((event.kind === 'word_answer' || event.kind === 'word_learned') && !event.wordId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['wordId'],
        message: `Sự kiện "${event.kind}" phải kèm wordId`,
      });
    }
    if (event.kind === 'lesson_completed' && !event.lessonId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lessonId'],
        message: 'Sự kiện "lesson_completed" phải kèm lessonId',
      });
    }
    if (event.kind === 'word_answer' && event.correct === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['correct'],
        message: 'Sự kiện "word_answer" phải cho biết trả lời đúng hay chưa',
      });
    }
  });

export type ProgressEventInput = z.infer<typeof progressEventSchema>;

// =============================================================================
// Đồng bộ
// =============================================================================

export const progressSyncRequestSchema = z.object({
  events: z
    .array(progressEventSchema)
    .max(MAX_EVENTS_PER_SYNC, `Mỗi lần chỉ đồng bộ tối đa ${MAX_EVENTS_PER_SYNC} sự kiện`),
  /** Lần đồng bộ thành công gần nhất (ISO UTC), hoặc `null` nếu chưa từng đồng bộ. */
  since: isoUtcSchema.nullable(),
});

export type ProgressSyncRequestInput = z.infer<typeof progressSyncRequestSchema>;

// =============================================================================
// Ghi tiến độ học flashcard (không qua game)
// =============================================================================

export const recordWordAnswerSchema = z.object({
  wordId: contentIdSchema,
  correct: z.boolean(),
  source: z.enum(['flashcard', 'game']),
});

export type RecordWordAnswerInput = z.infer<typeof recordWordAnswerSchema>;

export const markWordLearnedSchema = z.object({
  wordId: contentIdSchema,
});

export type MarkWordLearnedInput = z.infer<typeof markWordLearnedSchema>;

// =============================================================================
// Kết quả một lượt chơi game (T049)
// =============================================================================
//
// ⚠️ VÌ SAO PHẢI CÓ TRẦN CHO MỌI CON SỐ Ở ĐÂY:
//   Đây là endpoint thứ hai mà client gửi lên một mảng do NÓ quyết định độ dài (endpoint thứ
//   nhất là `progress/sync`). Không có trần thì một client hỏng gửi 200.000 câu trả lời, và
//   server sẽ cố ghi từng câu trong một transaction — khoá DB, làm sập app của mọi bé khác.
//   Cùng lý do như `MAX_EVENTS_PER_SYNC` ở đầu file.
//
// ⚠️ VÌ SAO `durationSeconds` CÓ TRẦN 6 GIỜ:
//   Trường này KHÔNG tham gia tính điểm (xem ràng buộc cứng #3 ở `game-scoring.ts` — không có
//   đồng hồ). Nó chỉ để thống kê. Trần ở đây thuần tuý để chặn giá trị rác, không phải để
//   giới hạn thời gian học của bé.

/** Trần số câu THEO KẾ HOẠCH của một lượt chơi. */
export const MAX_ROUNDS_PER_RUN = 60;

/** Trần số câu trả lời trong một lượt — không thể nhiều hơn số câu theo kế hoạch. */
export const MAX_ANSWERS_PER_RUN = 60;

/** Trần số lần chọn sai ở MỘT câu. */
export const MAX_WRONG_PER_ANSWER = 50;

/** Trần thời lượng một lượt chơi (6 giờ). */
export const MAX_DURATION_SECONDS = 6 * 60 * 60;

/**
 * Một câu trả lời: từ nào, đúng ngay lần đầu không, và đã chọn sai mấy lần.
 *
 * Phẳng (không dùng union) để phía client dễ dựng — cùng lý do như `progressEventSchema`.
 */
export const gameAnswerSchema = z.object({
  /**
   * `null` = câu này không thuộc về một từ vựng nào.
   *
   * ⚠️ Xem ghi chú dài ở `GameAnswerRecord.wordId` (`shared/types/progress.ts`) — đây KHÔNG
   *    phải chỗ lỏng lẻo cho tiện, mà là mô hình ĐÚNG: `prepositions` dạy giới từ trong một
   *    câu, `number_match`/`count_tap`/`colour_learn` dạy số và màu. Bắt buộc `wordId` sẽ
   *    buộc client hoặc gán bừa một từ (ghi số sai vào sổ của bé, vĩnh viễn) hoặc bỏ câu khỏi
   *    `answers` (⇒ bé chơi hết vẫn bị coi là bỏ dở ⇒ 1 sao oan).
   */
  wordId: contentIdSchema.nullable(),
  firstTry: z.boolean(),
  wrongAttempts: z.number().int().min(0).max(MAX_WRONG_PER_ANSWER),
});

export type GameAnswerInput = z.infer<typeof gameAnswerSchema>;

/**
 * Dữ liệu THÔ của một lượt chơi game.
 *
 * ⚠️ CHÚ Ý NHỮNG GÌ **KHÔNG** CÓ Ở ĐÂY: `score`, `stars`, `correctCount`, `longestStreak`,
 *    `endedEarly`. Tất cả đều SUY RA ĐƯỢC từ `totalRounds` + `answers`, nên server tự tính
 *    lại. Client không có đường nào để tuyên bố "tôi được 3 sao" — xem ghi chú ở
 *    `GameResultSubmission` trong `shared/types/progress.ts`.
 */
export const gameResultSubmissionSchema = z
  .object({
    clientEventId: clientEventIdSchema,
    exerciseId: contentIdSchema,
    lessonId: contentIdSchema,
    // Danh sách lấy từ `GAME_TYPES` (suy ra từ `GAME_HEARTS`) ⇒ thêm game mới là tự động
    // được chấp nhận, và không bao giờ lệch với union `GameType`.
    gameType: z.enum(GAME_TYPES as [GameType, ...GameType[]]),
    totalRounds: z.number().int().min(0).max(MAX_ROUNDS_PER_RUN),
    occurredAt: isoUtcSchema,
    durationSeconds: z.number().int().min(0).max(MAX_DURATION_SECONDS),
    answers: z.array(gameAnswerSchema).max(MAX_ANSWERS_PER_RUN),
  })
  .superRefine((run, ctx) => {
    // 1. Không thể trả lời nhiều câu hơn số câu của lượt chơi.
    if (run.answers.length > run.totalRounds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['answers'],
        message: `Số câu trả lời (${run.answers.length}) vượt quá tổng số câu của lượt chơi (${run.totalRounds})`,
      });
    }

    // 2. "Đúng ngay lần đầu" và "đã chọn sai" là hai điều KHÔNG THỂ cùng đúng.
    //    Dữ liệu như vậy luôn là dấu hiệu client bị lỗi (hoặc bị sửa tay), và nếu lọt qua thì
    //    `word_progress` sẽ nhận một cặp số vô nghĩa: vừa đúng-ngay-lần-đầu vừa có lần sai.
    //    Thà từ chối cả lượt còn hơn ghi vào sổ của bé một con số không thể tin.
    run.answers.forEach((answer, index) => {
      if (answer.firstTry && answer.wrongAttempts > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['answers', index, 'wrongAttempts'],
          message: 'Đúng ngay lần đầu thì không thể có lần chọn sai',
        });
      }
    });
  });

export type GameResultSubmissionInput = z.infer<typeof gameResultSubmissionSchema>;

// =============================================================================
// ĐỌC kết quả game đã chơi (T05) — kênh ĐỌC RIÊNG cho chip trò chơi
// =============================================================================
//
// ⚠️⚠️ VÌ SAO LÀ MỘT KÊNH ĐỌC RIÊNG, KHÔNG NHÉT VÀO `progressSnapshotSchema`:
//   Ảnh chụp tiến độ là KÊNH GHI hai chiều (`POST /progress/sync`). Nhét `gameResults` vào đó
//   buộc client phải GỬI NGƯỢC LÊN một thứ nó KHÔNG sở hữu — phá thẳng nguyên tắc "server là
//   trọng tài" (xem ghi chú cuối file và `shared/progress-merge.ts`). Nhưng bảng `game_result`
//   ĐÃ nằm ở server; việc còn thiếu chỉ là MỞ MỘT ĐƯỜNG ĐỌC cho nó.
//
// ⚠️ `bestStars` LÀ `MAX(stars)` (không phải tổng, không phải sao của bài): "đã chơi bài tập
//    này chưa + tốt nhất tới đâu". Một bài có nhiều GAME; lấy sao của BÀI tô cho từng game là
//    nói dối (game chưa chơi cũng sáng sao). Ở tầng SQL, `stars` không bao giờ 0 với hàng có
//    thật (ràng buộc `game-scoring`: tối thiểu 1 ★) nên tồn tại hàng ⇒ `bestStars ≥ 1`.

/** Tổng hợp kết quả ĐÃ CHƠI của MỘT bài tập (gộp theo `exercise_id`). */
export const gameResultSummarySchema = z.object({
  exerciseId: contentIdSchema,
  /** Sao CAO NHẤT từng đạt cho bài tập này. `0` chỉ có nghĩa "chưa từng chơi". */
  bestStars: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  bestScore: z.number().int().min(0).max(1_000_000),
  attempts: z.number().int().min(1).max(1_000_000),
  lastPlayedAt: isoUtcSchema,
});

/**
 * Phản hồi của `GET /api/children/:id/game-results` — danh sách kết quả game của MỘT bé.
 *
 * Trần `MAX_RECORDS_PER_SYNC` để một bé chơi rất nhiều cũng không thể làm phồng phản hồi vô hạn
 * (cùng lý do như các mảng khác trong file này).
 */
export const gameResultsResponseSchema = z.object({
  childId: z.string().trim().min(1).max(64),
  results: z.array(gameResultSummarySchema).max(MAX_RECORDS_PER_SYNC),
  serverTime: isoUtcSchema,
});

// =============================================================================
// Bản ghi trong ảnh chụp (client gửi lên khi đồng bộ hai chiều)
// =============================================================================

export const wordProgressSchema = z.object({
  childId: z.string().trim().min(1).max(64),
  wordId: contentIdSchema,
  learned: z.boolean(),
  mastered: z.boolean(),
  correctCount: z.number().int().min(0).max(1_000_000),
  wrongCount: z.number().int().min(0).max(1_000_000),
  lastSeenAt: isoUtcSchema.nullable(),
  updatedAt: isoUtcSchema,
});

export const lessonProgressSchema = z.object({
  childId: z.string().trim().min(1).max(64),
  lessonId: contentIdSchema,
  bestScore: z.number().int().min(0).max(1_000_000),
  starsBest: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  attempts: z.number().int().min(0).max(1_000_000),
  completed: z.boolean(),
  completedAt: isoUtcSchema.nullable(),
  updatedAt: isoUtcSchema,
});

export const themeProgressSchema = z.object({
  childId: z.string().trim().min(1).max(64),
  themeId: contentIdSchema,
  unlocked: z.boolean(),
  unlockedAt: isoUtcSchema.nullable(),
  lessonsCompleted: z.number().int().min(0).max(1_000_000),
  starsEarned: z.number().int().min(0).max(1_000_000),
  updatedAt: isoUtcSchema,
});

export const dailyStatSchema = z.object({
  childId: z.string().trim().min(1).max(64),
  date: dateKeySchema,
  wordsLearned: z.number().int().min(0).max(1_000_000),
  questionsAnswered: z.number().int().min(0).max(1_000_000),
  correctCount: z.number().int().min(0).max(1_000_000),
  starsEarned: z.number().int().min(0).max(1_000_000),
  acornsEarned: z.number().int().min(0).max(1_000_000),
  xpEarned: z.number().int().min(0).max(1_000_000),
  activeSeconds: z.number().int().min(0).max(1_000_000),
  updatedAt: isoUtcSchema,
});

/**
 * Ảnh chụp tiến độ đầy đủ.
 *
 * ⚠️ `childId` trong ảnh chụp KHÔNG được tin. Server luôn suy ra bé từ URL + `parent_id`
 *    (xem `routes/children.ts`), rồi GHI ĐÈ `childId` của mọi bản ghi bằng giá trị thật.
 *    Nếu tin `childId` do client gửi, phụ huynh A chỉ cần sửa một trường trong JSON là ghi
 *    được tiến độ vào hồ sơ bé nhà phụ huynh B.
 */
export const progressSnapshotSchema = z.object({
  childId: z.string().trim().min(1).max(64),
  words: z.array(wordProgressSchema).max(MAX_RECORDS_PER_SYNC),
  lessons: z.array(lessonProgressSchema).max(MAX_RECORDS_PER_SYNC),
  themes: z.array(themeProgressSchema).max(MAX_RECORDS_PER_SYNC),
  dailyStats: z.array(dailyStatSchema).max(MAX_RECORDS_PER_SYNC),
  serverTime: isoUtcSchema,
});

export type ProgressSnapshotInput = z.infer<typeof progressSnapshotSchema>;

// =============================================================================
// Ghi chú thiết kế: VÌ SAO KHÔNG CÓ ENDPOINT "ĐẨY ẢNH CHỤP LÊN"
// =============================================================================
//
// Ý tưởng ban đầu là cho client `PUT` cả ảnh chụp tiến độ của nó lên. Đã bỏ, vì hai lý do:
//
//   1. **Hai nguồn sự thật cho cùng một dữ liệu.** Nếu client vừa gửi sự kiện vừa gửi ảnh
//      chụp, server phải quyết định tin cái nào khi chúng mâu thuẫn. Không có câu trả lời
//      đúng — chỉ có một loạt luật đặc biệt chồng lên nhau.
//   2. **Ảnh chụp của client là DẪN XUẤT.** Nó được tạo ra từ sự kiện cộng với ảnh chụp
//      server. Gửi nó lên là gửi lại thứ server đã biết, kèm theo nguy cơ ghi đè bằng một
//      phiên bản cũ hơn.
//
// Thiết kế đã chọn: client chỉ gửi **SỰ KIỆN** (nguồn sự thật duy nhất về thay đổi), server
// áp chúng rồi trả về **ảnh chụp** đã gộp. Một chiều vào, một chiều ra, không có vòng lặp
// mâu thuẫn. Hàm `progressSnapshotSchema` ở trên vì thế chỉ dùng để KIỂM phản hồi, không
// dùng để nhận dữ liệu do client đẩy lên.
