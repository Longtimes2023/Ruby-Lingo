/**
 * RubyLingo — Kiểu DTO cho API bài thi cuối khoá (dùng CHUNG client + server).
 *
 * ⭐ HÌNH DẠNG KHỚP `shared/schemas/final-test-api.ts`. Schema ở đó `.parse()` CẢ đầu vào lẫn
 *   đầu ra; tệp này là hình dạng TypeScript để client và server cùng nói về một hợp đồng. Giữ
 *   hai bên cạnh nhau để một lần đổi schema mà quên đổi kiểu là lỗi biên dịch, không phải một
 *   `undefined` ở tầng vẽ.
 */

import type { FinalTestSectionId } from '../schemas/final-test.js';
import type { FinalTestAccess } from '../final-test-access.js';
import type { ShieldCount } from '../final-test-scoring.js';
import type { GameResultAward } from './progress.js';

/** Một câu bé đã chọn đáp án nhưng phần thi CHƯA xong (để làm tiếp khi mở lại / đổi máy). */
export interface FinalTestProgressAnswer {
  itemId: string;
  /** Đáp án thô bé đã chọn (chuỗi) — server KHÔNG chấm từ trường này, chỉ để làm tiếp. */
  value: string;
}

/** Tiến độ đang dở của một phần thi. */
export interface FinalTestProgressDto {
  section: FinalTestSectionId;
  /** Số câu đã làm — server suy từ `answers.length`, không nhận con số client khai. */
  answered: number;
  answers: FinalTestProgressAnswer[];
  updatedAt: string;
}

/** Tóm tắt một phần thi cho màn "Khu vực thi". */
export interface FinalTestSectionStatus {
  section: FinalTestSectionId;
  autoScored: boolean;
  totalItems: number;
  /** Khiên cao nhất từng đạt — `null` nếu bé CHƯA hoàn thành phần này lần nào. */
  bestShields: ShieldCount | null;
  /** Đã có ≥1 lần hoàn thành phần này chưa. */
  completed: boolean;
  attempts: number;
  /**
   * Thời điểm NỘP GẦN NHẤT của phần này (ISO-8601 UTC), `null` nếu bé CHƯA nộp lần nào.
   *
   * ⭐ Dùng cho BÁO CÁO PHỤ HUYNH ("ngày làm gần nhất"). Lấy từ CÙNG hàng `final_test_attempt`
   *   (`MAX(occurred_at)`) — không suy từ `progress.updatedAt` (tiến độ dở KHÔNG phải một lần
   *   nộp, và có thể mới hơn lần nộp cuối).
   */
  lastAttemptAt: string | null;
  /** Tiến độ đang dở (nếu có). */
  progress: FinalTestProgressDto | null;
}

/** Phản hồi của `GET /api/children/:id/final-test`. */
export interface FinalTestGateState {
  childId: string;
  gate: FinalTestAccess;
  sections: FinalTestSectionStatus[];
  serverTime: string;
}

/** Phản hồi của `POST /api/children/:id/final-test/:section/submit`. */
export interface FinalTestSubmitResult {
  section: FinalTestSectionId;
  /** `true` nếu lần nộp này ĐÃ được ghi từ trước (client gửi lại sau khi mất phản hồi). */
  duplicate: boolean;
  totalItems: number;
  correctFirstTry: number;
  /** Khiên của lần nộp này — LUÔN 1–5 (SÀN = 1). */
  shields: ShieldCount;
  /** Khiên cao nhất của phần này SAU lần nộp (không bao giờ giảm). */
  bestShields: ShieldCount;
  /** Lần này có phá kỷ lục khiên của phần không. */
  isNewRecord: boolean;
  /** Lần này có làm XONG CẢ BÀI THI lần đầu không (⇒ phần thưởng một-lần được trao). */
  firstCompletion: boolean;
  xpGained: number;
  starsGained: number;
  acornsGained: number;
  /** Có lên cấp không (nếu có, client hiện overlay ăn mừng). */
  levelUp: GameResultAward['levelUp'];
  /** Nhiệm vụ VỪA hoàn thành ở lần nộp này (chỉ thông báo — quà nhận ở màn Nhiệm vụ). */
  questsCompleted: string[];
  /** Huy hiệu MỚI THỰC SỰ được trao ở lần nộp này. */
  badgesEarned: string[];
}
