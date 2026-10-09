/**
 * RubyLingo — Hằng số KINH TẾ (điểm, sao, XP, tiền tệ).
 *
 * ⚠️ ĐÂY LÀ NƠI DUY NHẤT chỉnh cân bằng kinh tế. Không hardcode số ở component.
 *    Sửa file này là cả client lẫn server đổi theo (server là bên chấm điểm thật).
 *
 * ⚠️ LƯU Ý VỀ MÂU THUẪN TRONG TÀI LIỆU THIẾT KẾ:
 *    `GAME-REWARD-DESIGN.md` §2.2 cho phần thưởng theo từng game
 *    (+2⭐/từ, +10⭐ hoàn thành bài...) — cộng lại khoảng 72⭐ cho MỘT bài 3 game.
 *    Nhưng §8.2 lại ước tính tổng thu nhập chỉ ~85⭐/NGÀY.
 *    Hai con số này không khớp nhau. Ta chọn theo §2.2 (cụ thể hơn, gắn với từng game)
 *    vì **quyết định C1 đã chốt: hào phóng có chủ ý, KHÔNG đặt cap** (app dùng trong nhà,
 *    không kinh doanh) ⇒ hào phóng hơn dự kiến KHÔNG gây hại.
 *    Hệ quả cần biết: cửa hàng sẽ trở nên "rẻ" so với dự kiến. Đây là việc **cân bằng lại
 *    bằng dữ liệu chơi thật**, không thể chốt đúng trên giấy — xem `BALANCE_TODO`.
 */

import type { GameType } from '../types/content.js';
import type { GameRunResult } from '../game-scoring.js';

// =============================================================================
// ⚠️⚠️ ĐÃ XOÁ BA HẰNG SỐ TRÙNG LẶP Ở ĐÂY — ĐỌC TRƯỚC KHI THÊM LẠI
// =============================================================================
//
// File này từng khai lại ba thứ mà `shared/game-scoring.ts` đã định nghĩa, và cả ba đều là
// nguồn chân lý thứ hai cho CÙNG một luật:
//
//   • `POINTS_PER_CORRECT`  → trùng giá trị với `GAME_ROUND_POINTS`. Trùng giá trị nên chưa
//                             gây hại, nhưng hai chỗ sửa là hai chỗ sẽ lệch.
//   • `STAR_THRESHOLDS`     → trùng `STAR_THRESHOLD_THREE/TWO`, VÀ thiếu hẳn nhánh "theo số
//                             lỗi" (`STAR_MAX_ERRORS_THREE/TWO`). Ai dùng bản này để tính sao
//                             sẽ ra kết quả KHÁC cho game 4 câu và 6 câu — đúng những game
//                             đang có trong MVP.
//   • `STREAK_BONUS`        → ⚠️ CÔNG THỨC KHÁC HẲN. Bản ở đây là "cộng dồn +1 mỗi câu khi
//                             chuỗi >= 2"; bản đang chạy là `floor(chuỗiDàiNhất / 3)`, trần 5.
//                             Hai công thức này cho ra số điểm khác nhau trên cùng một ván.
//
// ⚠️ CẢ BA ĐỀU KHÔNG ĐƯỢC IMPORT Ở ĐÂU — chúng là bom hẹn giờ, không phải tính năng. Chúng bị
//    xoá chứ không phải để nguyên kèm ghi chú, vì một hằng số "đang nằm đó, trông dùng được"
//    sẽ được import lại bởi người tiếp theo cần đúng con số ấy.
//
// ⇒ Mọi thứ liên quan tới ĐIỂM, SAO, CHUỖI nằm ở `shared/game-scoring.ts` (server chấm bằng
//   chính file đó). File NÀY chỉ giữ những gì chưa có nhà: phần thưởng tiền tệ, XP, giới hạn.

// =============================================================================
// ⭐ SAO — tiền tệ phổ thông
// =============================================================================

export const STARS = {
  /** Học đúng một từ LẦN ĐẦU (chỉ tính một lần cho mỗi từ). */
  perNewWordLearned: 1,
  /** Trả lời đúng trong game (theo GAME-REWARD §2.2). */
  perCorrectAnswer: {
    listen_tap: 2,
    missing_letter: 2,
    prepositions: 3,
    memory_match: 3,
    word_picture: 2,
    word_search: 2,
    number_match: 2,
    say_it: 3,
    word_builder: 2,
    sort_basket: 2,
    count_tap: 2,
    colour_learn: 2,
  } as Record<GameType, number>,
  /** Thưởng khi chơi xong một game (theo GAME-REWARD §2.2). */
  perGameCompleted: {
    listen_tap: 10,
    missing_letter: 10,
    prepositions: 12,
    memory_match: 10,
    word_picture: 10,
    word_search: 10,
    number_match: 10,
    say_it: 10,
    word_builder: 10,
    sort_basket: 10,
    count_tap: 10,
    colour_learn: 10,
  } as Record<GameType, number>,
  /** Hoàn thành một bài học. */
  perLessonCompleted: 5,
  /** Bài hoàn hảo (không sai câu nào) — cộng thêm. */
  perfectLessonBonus: 5,
} as const;

// =============================================================================
// 🌰 HẠT DẺ — tiền tệ hiếm
// =============================================================================

export const ACORNS = {
  /** Nhiệm vụ ngày (QD-02, QD-03 mỗi cái 1). */
  perDailyQuest: 1,
  /** Nhiệm vụ tuần. */
  perWeeklyQuest: 2,
  /** Bài hoàn hảo. */
  perPerfectLesson: 1,
  /** Thưởng cố định khi lên cấp — xem `xp-levels.json` (rewards). */
} as const;

// =============================================================================
// XP
// =============================================================================

export const XP = {
  /** Học một từ mới lần đầu. */
  perNewWordLearned: 5,
  /** Trả lời đúng. */
  perCorrectAnswer: 2,
  /** Chơi xong một game. */
  perGameCompleted: 10,
  /** Hoàn thành một bài. */
  perLessonCompleted: 20,
  /** Bài hoàn hảo — cộng thêm. */
  perfectLessonBonus: 20,
  /** Học mỗi ngày (cộng khi mở app và có hoạt động học). */
  perActiveDay: 5,
} as const;

// =============================================================================
// MỘT LƯỢT CHƠI ĐÁNG BAO NHIÊU
// =============================================================================

/**
 * ⚠️⚠️ LỆCH VỚI TÀI LIỆU THIẾT KẾ — ĐỌC TRƯỚC KHI "SỬA CHO KHỚP":
 *
 *   `GAME-REWARD-DESIGN.md` §4.1 ghi: học đúng 1 từ lần đầu +2 XP, trả lời đúng trong game
 *   +3 XP, hoàn thành 1 bài +20 XP, bài hoàn hảo +15 XP.
 *   Các hằng số `XP` ở trên lại là 5 / 2 / 20 / 20.
 *
 *   Ba trong bốn con số KHÔNG khớp nhau. Ta dùng `XP` (file này) vì hai lý do:
 *     1. Đây là nơi được tuyên bố là NGUỒN CHÂN LÝ để chỉnh cân bằng kinh tế, và nó là DỮ LIỆU
 *        CHẠY ĐƯỢC — tài liệu thì không. Sửa một con số ở đây là cả client lẫn server đổi theo.
 *     2. Quyết định C1 đã chốt "hào phóng có chủ ý, không đặt cap" (app dùng trong nhà, không
 *        kinh doanh) ⇒ con số cao hơn KHÔNG gây hại. Nó chỉ làm bé lên cấp nhanh hơn dự kiến.
 *
 *   ⚠️ VIỆC CẦN LÀM: chốt lại một bộ số duy nhất và sửa tài liệu theo, HOẶC sửa file này. Hai
 *      nguồn số cho cùng một luật là đúng loại lỗi mà `BALANCE_TODO` bên dưới đang chờ dữ liệu
 *      chơi thật để xử lý. Ghi lại ở đây để lần sau không ai phải tự đoán.
 */
export interface GameRunRewards {
  stars: number;
  acorns: number;
  xp: number;
}

/**
 * Phần thưởng của MỘT LƯỢT CHƠI GAME. HÀM THUẦN.
 *
 * ⭐ VÌ SAO GOM VÀO MỘT HÀM Ở `shared/`, KHÔNG RẢI TRONG `GameResultService`:
 *   Đây là toàn bộ "một lượt chơi đáng bao nhiêu" — phần dễ sai nhất và cũng là phần đáng kiểm
 *   nhất. Là hàm thuần, nó kiểm được mà không cần DB, không cần dựng service, không cần dựng
 *   HTTP. Và vì nằm cạnh những con số nó dùng, người chỉnh cân bằng không phải đi tìm công thức
 *   ở một file khác — đúng thứ đã gây ra ba hằng số trùng lặp từng bị xoá khỏi file này.
 *
 * ⚠️ `run` LÀ KẾT QUẢ ĐÃ CHẤM (`summarizeGameRun`), KHÔNG PHẢI DỮ LIỆU THÔ. Nhờ vậy luật
 *    "thế nào là hoàn thành một lượt" chỉ tồn tại ở MỘT chỗ (`shared/game-scoring.ts`) và hàm
 *    này không có cơ hội định nghĩa lại nó theo một cách khác.
 *
 * ⚠️ NHỮNG GÌ **KHÔNG** CÓ Ở ĐÂY — VÀ ĐÓ LÀ CHỦ Ý:
 *   Quà cấp BÀI HỌC (`STARS.perLessonCompleted`, `STARS.perfectLessonBonus`,
 *   `ACORNS.perPerfectLesson`, `XP.perLessonCompleted`, `XP.perLessonBonus`) KHÔNG được cộng ở
 *   đây. Một lượt chơi game không biết "bài học này vừa xong chưa" — chỉ đường sự kiện
 *   `lesson_completed` (`ProgressService.applyLessonCompleted`, đi qua `/progress/sync`) biết.
 *   Cộng ở đây sẽ trao quà bài học cho MỖI GAME trong bài ⇒ bé chơi 3 game được thưởng 3 lần.
 *
 *   ⚠️ Hệ quả cần biết: cho tới khi đường `lesson_completed` được nối vào ví, phần thưởng
 *      "hoàn thành bài" CHƯA được trao ở đâu cả. Đây là việc còn thiếu, không phải hành vi
 *      đã chốt — xem ghi chú `LESSON_REWARD_TODO`.
 */
export function rewardsForGameRun(
  gameType: GameType,
  run: GameRunResult,
  newlyLearnedWords: number,
): GameRunRewards {
  // Kẹp mọi đầu vào về số nguyên không âm. Trường này tính từ dữ liệu đã qua schema, nhưng một
  // `NaN` lọt vào sẽ lan ra toàn bộ phép cộng và biến phần thưởng thành `NaN` — mà `NaN` ghi
  // được vào SQLite, và sau đó mọi phép so sánh với nó đều sai.
  const correctFirstTry = Math.max(0, Math.floor(run.correctFirstTry) || 0);
  const newWords = Math.max(0, Math.floor(newlyLearnedWords) || 0);
  const freePoints = STARS.perCorrectAnswer[gameType];
  const completionStars = STARS.perGameCompleted[gameType];

  return {
    stars:
      correctFirstTry * freePoints +
      newWords * STARS.perNewWordLearned +
      (run.completed ? completionStars : 0),
    // 🌰 chỉ đến từ nhiệm vụ và bài hoàn hảo ⇒ một lượt chơi game không cho hạt dẻ nào.
    // Trường này tồn tại để người gọi không phải tự suy ra "chắc là 0".
    acorns: 0,
    xp:
      correctFirstTry * XP.perCorrectAnswer +
      newWords * XP.perNewWordLearned +
      (run.completed ? XP.perGameCompleted : 0),
  };
}

/**
 * Những phần thưởng CHƯA có đường trao — ghi lại để không bị coi là "đã xong".
 *
 * Mỗi dòng ở đây là một khoản trong `GAME-REWARD-DESIGN.md` mà hiện tại KHÔNG được cộng ở đâu
 * cả. Chúng không phải bug, mà là việc còn thiếu — và cách duy nhất để chúng không bị lãng quên
 * là ghi chúng ra thành danh sách có thể đọc được.
 */
export const LESSON_REWARD_TODO = [
  '⭐/🌰/XP khi HOÀN THÀNH BÀI HỌC — thuộc đường sự kiện `lesson_completed` (ProgressService.applyLessonCompleted + ProgressService.sync), chưa nối vào ví/XP.',
  '⭐ khi HỌC MỘT TỪ ở chế độ flashcard — `ProgressService.applyWordAnswerInTx` hiện không trao gì; từ học qua game thì đã được tính trong `rewardsForGameRun`.',
  '⭐/🌰/XP khi nhận MỐC CHUỖI NGÀY (3/7/14/30) — xem `STREAK_REWARDS`; chưa có service nào áp dụng.',
  'XP cho NGÀY HOẠT ĐỘNG (`XP.perActiveDay`) — chưa có đường trao.',
] as const;

// =============================================================================
// Giới hạn an toàn (chống dữ liệu rác, KHÔNG phải cap kinh tế)
// =============================================================================

export const LIMITS = {
  /** Một lượt chơi không thể có nhiều hơn ngần này câu (chống payload giả). */
  maxQuestionsPerSession: 30,
  /** Số giây tối đa tính cho một lượt chơi (chống treo máy qua đêm). */
  maxSessionSeconds: 60 * 30,
  /** Từ đã đúng >= ngần này lần thì coi là "đã nhớ". */
  masteredCorrectCount: 3,
  /** Số từ tối đa trong một bài — khớp validator nội dung. */
  maxWordsPerLesson: 8,
  minWordsPerLesson: 4,
  /** Số sao tối đa. */
  maxStars: 3,
  /** Chỉ số Vui vẻ: SÀN = 1 (linh vật không bao giờ buồn bã hoàn toàn). */
  happinessMin: 1,
  happinessMax: 5,
  /** Mỗi ngần này ⭐ thì +1 ❤️. */
  starsPerHappinessPoint: 10,
  /** Mất 1 ❤️ mỗi ngần này ngày bé không mở app. */
  idleDaysPerHappinessLoss: 1,
} as const;

// =============================================================================
// Ghi chú cân bằng — việc cần làm khi có dữ liệu chơi thật
// =============================================================================

export const BALANCE_TODO = [
  'Đo thu nhập ⭐ thực tế của một bé trong 7 ngày đầu.',
  'Nếu cửa hàng quá rẻ (mua hết trong 1–2 ngày), tăng giá vật phẩm — KHÔNG giảm thưởng (giữ cam kết C1).',
  'Nếu bé thấy "hết thứ để mua", thêm vật phẩm mới (P1/P2) trước khi nghĩ đến việc giảm thưởng.',
  'Kiểm tra ngưỡng 3 sao: nếu bé 7 tuổi hiếm khi đạt 3 sao, hạ `STAR_THRESHOLDS.three` xuống 0.8.',
] as const;

// =============================================================================
// Chuỗi ngày
// =============================================================================

/** Các mốc chuỗi ngày được nhận quà. */
export const STREAK_MILESTONES = [3, 7, 14, 30] as const;

/** Phần thưởng cho từng mốc chuỗi ngày. */
export const STREAK_REWARDS: Record<number, { stars: number; acorns: number; xp: number }> = {
  3: { stars: 15, acorns: 1, xp: 15 },
  7: { stars: 30, acorns: 2, xp: 30 },
  14: { stars: 50, acorns: 3, xp: 50 },
  30: { stars: 100, acorns: 5, xp: 100 },
};

// =============================================================================
// Phiên bản chính sách quyền riêng tư (tuân thủ COPPA / GDPR-K)
// =============================================================================

/**
 * Tăng chuỗi này mỗi khi sửa `PRIVACY_POLICY`.
 * Dấu vết đồng ý của phụ huynh lưu kèm phiên bản ⇒ chứng minh được đã đồng ý bản nào.
 */
export const CONSENT_POLICY_VERSION = '2026-10-06-v1';

/** Tuổi tối thiểu của bé mà app hỗ trợ. */
export const MIN_CHILD_AGE = 5;
export const MAX_CHILD_AGE = 12;
