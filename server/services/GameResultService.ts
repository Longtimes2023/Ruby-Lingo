/**
 * RubyLingo — `GameResultService`: chấm điểm và ghi lại MỘT LƯỢT CHƠI GAME (T049).
 *
 * ⭐⭐ NHIỆM VỤ: NHẬN DỮ LIỆU THÔ → TỰ TÍNH LẠI ĐIỂM/SAO → GHI VÀO SỔ CỦA BÉ → TRẢ KẾT QUẢ.
 *
 *   "TỰ TÍNH LẠI" là chữ quan trọng nhất trong câu trên. Client chỉ gửi lên những SỰ THẬT
 *   THÔ — ván này có mấy câu, câu nào đúng ngay lần đầu, câu nào phải thử lại mấy lần. Điểm
 *   và số sao do SERVER tính từ những sự thật đó, bằng **đúng những hàm mà client dùng để
 *   hiện kết quả ngay** (`shared/game-scoring.ts`). Client không có đường nào để tự tuyên bố
 *   "tôi được 3 sao": nó có sửa trường nào trong JSON đi chăng nữa thì server cũng không đọc
 *   trường đó, vì những trường ấy KHÔNG TỒN TẠI trong hợp đồng (`GameResultSubmission`).
 *
 * ⚠️ VÌ SAO KHÔNG TIN SỐ ĐẾM DO CLIENT KHAI — KỂ CẢ KHI CLIENT LÀ "CỦA MÌNH":
 *   Không phải vì bé 7 tuổi sẽ hack. Vì một client hỏng sẽ khai sai mà không ai biết: đếm
 *   nhầm, gửi lại sau khi mất mạng, hoặc đơn giản là một bug ở một trong 12 game. Khi ấy số
 *   liệu SAI được ghi vào sổ của bé, và vì tiến độ là "thành tựu không bao giờ mất"
 *   (xem `mergeWordProgress`), nó ở lại VĨNH VIỄN. Tự tính lại từ dữ liệu thô là cách duy
 *   nhất để một bug ở tầng hiển thị không trở thành một vết bẩn vĩnh viễn trong sổ.
 *
 * -----------------------------------------------------------------------------
 * NĂM QUYẾT ĐỊNH CẦN HIỂU TRƯỚC KHI SỬA
 * -----------------------------------------------------------------------------
 *
 * ⚠️ 1. `game_result.client_event_id` LÀ CỔNG CHỐNG GHI TRÙNG — VÀ MỌI THỨ KHÁC PHỤ THUỘC VÀO NÓ.
 *    Kịch bản thật: bé chơi xong, request tới server, server ghi xong, nhưng PHẢN HỒI mất trên
 *    đường về. Client không biết là đã gửi nên gửi lại y nguyên. Cổng này chặn lần thứ hai.
 *    Điều quan trọng: `applyDailyStatInTx` **CỘNG DỒN**, nên nếu cổng này thủng thì số liệu
 *    phồng lên mỗi lần gửi lại — không có cách nào phát hiện về sau. Hai cơ chế này là một cặp:
 *    **ĐỪNG BỎ CÁI NÀY MÀ GIỮ CÁI KIA.**
 *
 * ⚠️ 2. TOÀN BỘ VIỆC GHI NẰM TRONG **MỘT** TRANSACTION.
 *    Dòng `game_result` + tiến độ từng từ + kỷ lục bài + thống kê ngày. Nếu tách ra, một lỗi ở
 *    bước thứ ba sẽ để lại trạng thái nửa vời: lượt chơi đã bị đánh dấu "đã ghi" (nên lần gửi
 *    lại bị chặn) nhưng điểm thì chưa cộng. Bé mất lượt chơi đó VĨNH VIỄN. Một transaction biến
 *    "3/4 bước" thành "hoặc 4, hoặc 0".
 *
 * ⚠️ 3. `INSERT OR IGNORE` NUỐT CẢ LỖI RÀNG BUỘC, KHÔNG CHỈ LỖI TRÙNG KHOÁ.
 *    Đây là cái bẫy thật của SQLite: `OR IGNORE` bỏ qua MỌI hàng vi phạm ràng buộc — kể cả
 *    `CHECK` và `NOT NULL`. Nếu chỉ nhìn `changes === 0` rồi kết luận "trùng rồi, thôi bỏ qua",
 *    một hàng bị `CHECK` từ chối sẽ được báo về như một lượt chơi trùng lặp: không có gì được
 *    ghi, không có lỗi nào nổi lên, và bé thấy màn hình kết quả bình thường. Vì vậy sau khi
 *    `changes === 0` ta **đọc lại hàng đó**; không thấy ⇒ đây là lỗi thật, phải ném ra.
 *
 * ⚠️ 4. `word_progress` / `lesson_progress` / `daily_stats` KHÔNG ĐƯỢC GHI TRỰC TIẾP Ở ĐÂY.
 *    Cả ba bảng đó thuộc `ProgressService` — nơi duy nhất định nghĩa "một câu trả lời làm gì
 *    với sổ của bé". Service này chỉ gọi các hàm `*InTx` của nó. Viết một câu SQL tương tự ở
 *    đây là tạo bản sao thứ hai của cùng một luật, và hai bản sao luôn lệch nhau đúng lúc
 *    quan trọng nhất.
 *
 * ⚠️ 5. PHẦN THƯỞNG KINH TẾ (⭐/🌰/XP) CŨNG NẰM TRONG CHÍNH TRANSACTION NÀY (T054).
 *    Không có endpoint riêng nào để "nhận thưởng sau". Đây là hệ quả trực tiếp của quyết định 2:
 *    nếu ví được cộng ở một request thứ hai, sẽ tồn tại một khoảng thời gian bé ĐÃ có dòng
 *    `game_result` mà CHƯA có ⭐. Và nếu request thứ hai không bao giờ tới (mất mạng, bé đóng
 *    tab), số ⭐ đó MẤT VĨNH VIỄN — vì cổng chống trùng ở quyết định 1 đã chặn mọi lần gửi lại.
 *    Cùng một transaction nghĩa là "có lượt chơi ⇒ có tiền", không có trạng thái nửa vời.
 *
 *    ⚠️ VÀ XP **KHÔNG** ĐƯỢC CỘNG QUA `RewardService` — xem quyết định 2 ở `RewardService.ts`.
 *      `XpService.addXpInTx` là đường DUY NHẤT cộng XP, vì cộng XP không chỉ là `xp = xp + n`:
 *      nó còn phải phát hiện ĐÃ VƯỢT CẤP NÀO và trao quà của MỌI cấp bị nhảy qua.
 */

import { stickerForLesson } from '../../shared/content/badges.js';
import { rewardsForGameRun } from '../../shared/content/economy.js';
import {
  GAME_ROUND_POINTS,
  clampStarsBest,
  pointsForRound,
  summarizeGameRun,
} from '../../shared/game-scoring.js';
import { gameResultSubmissionSchema } from '../../shared/schemas/progress.js';
import type { GameResultSubmissionInput } from '../../shared/schemas/progress.js';
import { gameResultsResponseSchema } from '../../shared/schemas/progress.js';
import type { GameResultAward, GameResultsResponse } from '../../shared/types/progress.js';
import type { Db } from '../db/connection.js';
import { getDb, transaction } from '../db/connection.js';
import { newId } from '../lib/ids.js';
import { localDateKey, nowIso } from '../lib/time.js';
import { errors } from '../plugins/errors.js';
import { childService } from './ChildService.js';
import type { ChildService } from './ChildService.js';
import { badgeService } from './BadgeService.js';
import type { BadgeService } from './BadgeService.js';
import { progressService } from './ProgressService.js';
import type { ProgressService } from './ProgressService.js';
import { questService } from './QuestService.js';
import type { QuestService } from './QuestService.js';
import { rewardService } from './RewardService.js';
import type { RewardService } from './RewardService.js';
import { xpService } from './XpService.js';
import type { XpService } from './XpService.js';

// =============================================================================
// Suy ra các con số từ dữ liệu thô — HÀM THUẦN
// =============================================================================

/** Một lần bé đưa ra lựa chọn ở một câu. */
export interface WordAttempt {
  wordId: string;
  correct: boolean;
}

/** Mọi con số server cần, suy ra từ `answers` + `totalRounds`. */
export interface DerivedRun {
  /** Số câu bé ĐI QUA (`= answers.length`). Nhỏ hơn `totalRounds` khi bé hết mạng giữa chừng. */
  answered: number;
  /** Số câu đúng NGAY LẦN ĐẦU — con số quyết định số sao. */
  correctFirstTry: number;
  /** Tổng số lần chọn sai trong cả lượt. */
  wrongAttempts: number;
  /** Chuỗi đúng liên tiếp dài nhất. */
  longestStreak: number;
  /** Lượt chơi dừng trước khi hết số câu theo kế hoạch. */
  endedEarly: boolean;
  /** Điểm các câu đã cộng dồn (chưa gồm thưởng chuỗi). */
  roundScore: number;
  /**
   * Danh sách "lần thử" theo ĐÚNG thứ tự xảy ra: với mỗi câu, các lần SAI trước rồi mới tới
   * lần ĐÚNG. Đây là hình dạng mà `ProgressService.applyWordAttemptsInTx` nhận, nên kết quả
   * trong `word_progress` giống hệt như khi bé trả lời trong flashcard.
   */
  attempts: WordAttempt[];
}

/**
 * Suy mọi con số từ dữ liệu thô.
 *
 * ⭐ VÌ SAO PHẢI LÀ HÀM THUẦN, TÁCH KHỎI SERVICE:
 *   Đây là toàn bộ phần "hiểu biết" của endpoint — phần dễ sai nhất và cũng là phần đáng kiểm
 *   nhất. Là hàm thuần và được export, nó kiểm được mà không cần DB, không cần dựng service,
 *   không cần giả lập gì. Mọi nhánh (hết mạng sớm, đúng hết, sai hết, một từ lặp lại) đều
 *   kiểm được trong vài mili giây.
 */
export function deriveRun(input: GameResultSubmissionInput): DerivedRun {
  const roundPoints = GAME_ROUND_POINTS[input.gameType];

  const attempts: WordAttempt[] = [];
  let correctFirstTry = 0;
  let wrongAttempts = 0;
  let longestStreak = 0;
  let streak = 0;
  let roundScore = 0;

  for (const answer of input.answers) {
    /**
     * ⚠️ CÂU KHÔNG GẮN VỚI TỪ NÀO (`wordId === null`) VẪN ĐƯỢC TÍNH ĐỦ ĐIỂM/SAO.
     *
     *   `prepositions` dạy giới từ trong một câu, `number_match`/`count_tap`/`colour_learn`
     *   dạy số và màu — chúng KHÔNG có từ vựng để quy về. Xem `GameAnswerRecord.wordId`.
     *   Câu như vậy chỉ bị bỏ qua ở đúng một việc: sinh `attempt` cho `word_progress`. Mọi
     *   con số khác (roundScore, correctFirstTry, chuỗi, số câu đã đi qua) vẫn đếm bình thường
     *   — nếu bỏ luôn cả câu thì `answered` hụt và bé bị coi là bỏ dở lượt chơi.
     */
    if (answer.wordId !== null) {
      // Các lần SAI trước, rồi mới tới lần đúng — để `word_progress.wrong_count` nhận đúng
      // số lần bé đã thử hụt ở từ này.
      for (let i = 0; i < answer.wrongAttempts; i += 1) {
        attempts.push({ wordId: answer.wordId, correct: false });
      }
      attempts.push({ wordId: answer.wordId, correct: true });
    }

    wrongAttempts += answer.wrongAttempts;
    roundScore += pointsForRound(roundPoints, answer.firstTry);

    if (answer.firstTry) {
      correctFirstTry += 1;
      streak += 1;
      longestStreak = Math.max(longestStreak, streak);
    } else {
      // Đứt chuỗi. KHÔNG trừ điểm — xem ràng buộc cứng #2 ở `shared/game-scoring.ts`.
      streak = 0;
    }
  }

  const answered = input.answers.length;

  return {
    answered,
    correctFirstTry,
    wrongAttempts,
    longestStreak,
    endedEarly: answered < input.totalRounds,
    roundScore,
    attempts,
  };
}

// =============================================================================
// Hàng dữ liệu thô
// =============================================================================

interface GameResultRow {
  id: string;
  child_id: string;
  client_event_id: string;
  exercise_id: string;
  lesson_id: string;
  game_type: string;
  total_questions: number;
  correct_count: number;
  longest_streak: number;
  score: number;
  stars: number;
  duration_seconds: number;
  created_at: string;
  answered: number;
  wrong_attempts: number;
}

/**
 * Một hàng KẾT QUẢ GỘP theo `exercise_id` (T05) — đầu ra của `GROUP BY` trong
 * `listGameSummaries`. Tên trường theo `AS` của câu SQL.
 */
interface GameSummaryRow {
  exercise_id: string;
  best_stars: number;
  best_score: number;
  attempts: number;
  last_played_at: string;
}

/**
 * Phần thưởng của một lượt chơi ĐÃ GHI TỪ TRƯỚC — mọi trường đều rỗng. Dùng cho nhánh TRÙNG LẶP.
 *
 * ⭐ VÌ SAO ĐÂY KHÔNG CÒN LÀ "PHẦN THƯỞNG CHƯA LÀM" (đổi tên ở T054):
 *   Tới T049, hàm này mang tên `noRewards()` và nghĩa của nó là "T051/T054/T057… chưa làm xong".
 *   Nay XP và ví ĐÃ có đường trao (`XpService` / `RewardService`), nên một hàm tên như cũ sẽ
 *   khiến người đọc nghĩ số 0 ở đây là do thiếu việc — rồi "sửa" bằng cách điền số vào, và làm
 *   hỏng đúng cái luật nó đang giữ.
 *
 *   Con số 0 ở đây là một QUYẾT ĐỊNH, không phải một khoảng trống: đây là lượt chơi CŨ mà client
 *   gửi lại vì mất phản hồi, không phải một ván mới. Xem ghi chú ở `submit`.
 *
 * ⚠️ `questsCompleted` / `badgesEarned` / `stickerEarned` rỗng — vì CÙNG một lý do: lượt chơi
 *    này ĐÃ được xử lý từ trước, nên không có gì MỚI để báo. Nếu trả về id huy hiệu/sticker ở
 *    đây, client sẽ ăn mừng lại một thứ bé đã nhận ở lần gửi trước — lặp lại mỗi lần gửi lại:
 *      • `questsCompleted` rỗng vì `QuestService` đã tính ván này ở lần ghi đầu. **Kể từ T058,
 *        trường này rỗng KỂ CẢ khi mọi thứ chạy đúng.** ĐỪNG "sửa" bằng cách điền vào.
 *      • `badgesEarned` rỗng vì mọi đường sinh huy hiệu (quà lên cấp, thành tích) đều nằm sau
 *        cổng `insertRunOnce` — lượt cũ không đi qua chúng nữa.
 *      • `stickerEarned` = `null` vì sticker của bài đã được mở ở lần ghi đầu (T069). Khoá
 *        chính `(child_id, sticker_id)` bảo đảm lần gửi lại không mở thêm.
 */
function duplicateRewards(): Pick<
  GameResultAward,
  | 'xpGained'
  | 'starsGained'
  | 'acornsGained'
  | 'levelUp'
  | 'questsCompleted'
  | 'badgesEarned'
  | 'stickerEarned'
> {
  return {
    xpGained: 0,
    starsGained: 0,
    acornsGained: 0,
    levelUp: null,
    questsCompleted: [], // ← CỐ Ý RỖNG, không phải "chưa làm" — xem ghi chú ở trên.
    badgesEarned: [],
    stickerEarned: null, // ← lượt cũ: sticker của bài đã mở ở lần ghi đầu (T069).
  };
}

// =============================================================================
// Service
// =============================================================================

/**
 * Sao của một lượt chơi ĐÃ GHI trong DB, luôn nằm trong 1–3.
 *
 * ⚠️ Khác `clampStarsBest` ở chỗ nào: hàm kia cho phép `0` (vì `stars_best` của một bài CHƯA
 *    chơi đúng là 0). Còn một LƯỢT CHƠI thì không bao giờ 0 sao — đó là ràng buộc cứng #1
 *    ("hoàn thành là đã có thưởng"). Nếu đọc ra 0 thì dữ liệu đã hỏng; nâng lên 1 sao vẫn
 *    đúng tinh thần "không bao giờ để bé nhận 0 sao", thay vì để lọt một giá trị mà kiểu
 *    `GameResultAward.stars` cấm.
 */
function storedRunStars(value: number): 1 | 2 | 3 {
  const clamped = clampStarsBest(value);
  return clamped === 0 ? 1 : clamped;
}

export class GameResultService {
  /**
   * ⚠️ SÁU phụ thuộc, và tất cả đều nằm trong CÙNG transaction của `submit()`. Nhận qua tham số
   *    (có giá trị mặc định) thay vì `import` thẳng singleton là để test cắm được bản giả — nhưng
   *    quan trọng hơn: nó làm hiện ra ngay trên chữ ký hàm rằng service này chạm vào SÁU miền dữ
   *    liệu khác nhau, và mọi thứ nó chạm đều phải nằm trong một transaction. Một service chỉ
   *    `import` singleton trông như thể nó không phụ thuộc gì cả.
   *
   * ⚠️ `quests` (T058) KHÔNG được trỏ ngược lại `ProgressService`. Chiều phụ thuộc hợp lệ là
   *    `GameResultService → ProgressService → QuestService`. Nếu `QuestService` import
   *    `ProgressService` thì vòng lặp đó làm module rơi vào vùng tạm (TDZ) và SERVER KHÔNG KHỞI
   *    ĐỘNG ĐƯỢC — chi tiết ở đầu `dailyStats.ts`.
   *
   * ⭐ `badges` (T068) đứng CUỐI chuỗi phụ thuộc: nó chỉ gọi `RewardService.grantBadgeInTx`, và
   *    KHÔNG được ai trỏ ngược lại nó — nên nó không thể tạo vòng import.
   */
  constructor(
    private readonly children: ChildService = childService,
    private readonly progress: ProgressService = progressService,
    private readonly rewards: RewardService = rewardService,
    private readonly xp: XpService = xpService,
    private readonly quests: QuestService = questService,
    private readonly badges: BadgeService = badgeService,
  ) {}

  /**
   * Chấm và ghi lại một lượt chơi. **Lũy đẳng theo `clientEventId`.**
   *
   * Gọi lại với cùng `clientEventId` KHÔNG cộng thêm gì; trả về `duplicate: true` kèm kết quả
   * đã ghi ở lần đầu. Nhờ vậy client cứ gửi lại thoải mái khi mất mạng — không cần biết lần
   * trước đã tới server hay chưa.
   *
   * ⚠️ MỘT LƯỢT GHI THÀNH CÔNG CHẠM VÀO **SÁU** MIỀN: nhật ký chơi (`game_result`), tiến độ
   *    của bé (`ProgressService`), kinh tế (XP ở `XpService` + ví ở `RewardService`), nhiệm vụ
   *    (`QuestService`, T058), và SƯU TẦM — huy hiệu (`BadgeService`, T068) + sticker (T069).
   *    Cả sáu nằm trong MỘT transaction — xem quyết định 2 và 5 ở đầu file.
   */
  submit(parentId: string, childId: string, rawInput: unknown): GameResultAward {
    // Parse ở tầng service (không chỉ ở route) — xem ghi chú ở `ChildService`.
    const input = gameResultSubmissionSchema.parse(rawInput);
    this.requireChild(parentId, childId);

    const derived = deriveRun(input);

    // ⭐ Server tính lại điểm và sao từ dữ liệu thô, bằng ĐÚNG hàm mà client đã dùng để hiện
    //   kết quả ngay cho bé. Một luật, hai nơi gọi — xem ghi chú đầu `shared/game-scoring.ts`.
    const run = summarizeGameRun({
      totalRounds: input.totalRounds,
      correctFirstTry: derived.correctFirstTry,
      answered: derived.answered,
      wrongAttempts: derived.wrongAttempts,
      longestStreak: derived.longestStreak,
      endedEarly: derived.endedEarly,
      roundScore: derived.roundScore,
    });

    return transaction((db) => {
      if (!this.insertRunOnce(db, childId, input, derived, run)) {
        return this.duplicateAward(db, childId, input);
      }

      // --- Tiến độ học (bảng của `ProgressService`) ------------------------
      const { newlyLearned } = this.progress.applyWordAttemptsInTx(
        db,
        childId,
        derived.attempts,
        input.occurredAt,
      );

      const lesson = this.progress.applyGameScoreInTx(
        db,
        childId,
        input.lessonId,
        run.score,
        run.stars,
        input.occurredAt,
      );

      // --- Kinh tế: XP và ví (T054) ----------------------------------------
      //
      // ⚠️ KHỐI NÀY ĐỨNG TRƯỚC KHỐI THỐNG KÊ NGÀY, VÀ THỨ TỰ ĐÓ LÀ CỐ Ý.
      //    `applyDailyStatInTx` cần biết SỐ THỰC SỰ ĐƯỢC TRAO để báo cáo phụ huynh khớp với ví
      //    (xem ghi chú `starsEarned` ở `ProgressService`). Nếu ghi thống kê trước rồi mới trao
      //    thưởng, ta chỉ có thể đoán con số — và đoán sai đúng ở ca thú vị nhất: lượt chơi vượt
      //    cấp, nơi ví tăng nhiều hơn phần thưởng của ván.
      //
      // ⚠️ "MỘT LƯỢT CHƠI ĐÁNG BAO NHIÊU" LÀ HÀM THUẦN Ở `shared/`, KHÔNG PHẢI CÔNG THỨC Ở ĐÂY.
      //    Xem `rewardsForGameRun`. Nó nhận `run` ĐÃ CHẤM (không phải dữ liệu thô) nên luật
      //    "thế nào là hoàn thành một lượt" vẫn chỉ tồn tại ở đúng một chỗ.
      const prizes = rewardsForGameRun(input.gameType, run, newlyLearned);

      // ⚠️ XP ĐI QUA `XpService`, KHÔNG QUA `applyGrantsInTx` — xem quyết định 5 ở đầu file.
      //    `addXpInTx` trả về quà của (các) cấp vượt qua, và ta cần con số đó để báo cho bé.
      //    Nó không giành tài nguyên với bước dưới đây (XP ghi `xp_state`, ví ghi `wallet`), nên
      //    thứ tự giữa hai dòng này không đổi kết quả — chỉ đổi thứ tự đọc code.
      const xp = this.xp.addXpInTx(db, childId, prizes.xp, input.occurredAt);

      const wallet = this.rewards.applyGrantsInTx(
        db,
        childId,
        { stars: prizes.stars, acorns: prizes.acorns },
        input.occurredAt,
      );

      // Số THỰC SỰ vào ví/XP — gồm cả quà lên cấp. Xem `starsGained` ở khối `return`.
      const starsGained = wallet.starsGained + xp.rewards.starsGained;
      const acornsGained = wallet.acornsGained + xp.rewards.acornsGained;

      // --- Thống kê ngày (bảng của `ProgressService`) ----------------------
      //
      // Ngày theo GIỜ ĐỊA PHƯƠNG của gia đình, không phải UTC — nếu dùng UTC thì buổi học tối
      // ở Việt Nam (UTC+7) sẽ bị tính sang ngày hôm sau.
      this.progress.applyDailyStatInTx(
        db,
        childId,
        localDateKey(new Date(input.occurredAt)),
        {
          wordsLearned: newlyLearned,
          questionsAnswered: derived.answered,
          correctCount: derived.correctFirstTry,
          activeSeconds: input.durationSeconds,
          starsEarned: starsGained,
          acornsEarned: acornsGained,
          xpEarned: xp.xpGained,
        },
        input.occurredAt,
      );

      // --- Nhiệm vụ (T058) -------------------------------------------------
      //
      // ⚠️ ĐỨNG SAU `applyDailyStatInTx`, VÀ THỨ TỰ ĐÓ LÀ BẮT BUỘC.
      //    Nhiệm vụ tuần "Học 4 ngày trong tuần" (`learn_days`) được SUY RA từ `daily_stats` +
      //    `progress_event`, chứ không đếm theo sự kiện. Bắn sự kiện nhiệm vụ TRƯỚC khi ghi
      //    thống kê ngày thì hôm nay chưa nằm trong `daily_stats` lúc nhiệm vụ được tính lại —
      //    bé học cả ngày mà nhiệm vụ vẫn đứng ở "3/4" cho tới lần chơi sau.
      //
      // ⚠️ HAI SỰ KIỆN, VÌ CHÚNG LÀ HAI SỰ THẬT KHÁC NHAU.
      //    • `game_played`     — bé vừa chơi xong một ván (nhiệm vụ "Chơi 3 game").
      //    • `correct_answers` — bé vừa trả lời đúng `correctFirstTry` câu NGAY LẦN ĐẦU
      //      (nhiệm vụ "Trả lời đúng 12 câu"). Dùng đúng con số mà `daily_stats.correctCount`
      //      dùng, nên "số câu đúng" trong báo cáo phụ huynh và trong nhiệm vụ luôn khớp nhau.
      //
      //    Gộp hai sự kiện làm một (`{kind:'game_played', correct: 12}`) sẽ khiến mỗi lần thêm
      //    một tiêu chí mới lại phải sửa chữ ký sự kiện — và sự kiện là thứ mà `QuestService`
      //    hiểu, không phải thứ người gọi tự định nghĩa.
      const questsCompleted = [
        ...new Set([
          ...this.quests.applyEventInTx(db, childId, { kind: 'game_played' }, input.occurredAt),
          ...this.quests.applyEventInTx(
            db,
            childId,
            { kind: 'correct_answers', count: derived.correctFirstTry },
            input.occurredAt,
          ),
        ]),
      ];

      // --- Sưu tầm: huy hiệu (T068) + sticker (T069) ----------------------
      //
      // ⚠️ ĐỨNG CUỐI CÙNG, SAU tiến độ + kinh tế + nhiệm vụ, VÀ THỨ TỰ ĐÓ LÀ BẮT BUỘC.
      //    `BadgeService` đánh giá tiêu chí bằng cách ĐỌC SỔ trong DB (`lesson_progress`,
      //    `game_result`, `wallet`, `xp_state`, `streak_state`). Nó chỉ thấy đúng trạng thái
      //    SAU khi các bước trên đã ghi xong — nếu chạy trước, một lượt chơi vừa đủ điều kiện
      //    "thắng 20 lượt Nghe & Chạm" sẽ không được tính chính lượt đang chạy.
      const achievementBadges = this.badges.evaluate(db, childId, input.occurredAt);

      /**
       * ⭐ STICKER LÀ PHẦN THƯỞNG BIẾN THIÊN: bé mở ra mới biết là con gì (T069).
       *
       * ⚠️ `stickerForLesson` trả `null` khi bài KHÔNG có sticker — chuyện BÌNH THƯỜNG, và
       *    TUYỆT ĐỐI không được ném lỗi ở đây: luồng này chấm điểm sau MỖI lượt chơi, ném lỗi
       *    vì một bài không có sticker là làm hỏng cả lượt chơi của bé. `null` ⇒ không trao gì,
       *    lượt chơi vẫn thành công bình thường.
       *
       * ⭐ Chỉ trao khi `grantStickerInTx` nói "MỚI": gửi lại cùng bài (khác lượt, hoặc gửi lại
       *    cùng payload) không được trao sticker lần hai — khoá chính `(child_id, sticker_id)`
       *    bảo đảm điều đó ở tầng ràng buộc, nên `stickerEarned` là "phần thưởng VỪA mở", dùng
       *    đúng cho overlay ăn mừng.
       */
      const sticker = stickerForLesson(input.lessonId);
      const stickerEarned =
        sticker !== null &&
        this.rewards.grantStickerInTx(db, childId, sticker.id, input.lessonId, input.occurredAt)
          ? sticker.id
          : null;

      return {
        score: run.score,
        stars: run.stars,
        bestScore: lesson.bestScore,
        bestStars: lesson.bestStars,
        isNewRecord: lesson.isNewRecord,
        duplicate: false,
        xpGained: xp.xpGained,
        /**
         * ⚠️ TỔNG CỦA HAI NGUỒN, KHÔNG PHẢI CHỈ `wallet.starsGained`.
         *
         *   Bé có thể nhận ⭐ từ hai chỗ trong CÙNG một lượt chơi: thưởng của ván, và quà của
         *   cấp vừa vượt qua (`xp.rewards`). Cả hai đều ĐÃ vào ví. Chỉ báo một nửa thì overlay
         *   nói "Bé được +12 ⭐" trong khi ví tăng 22 — bé tự cộng lại và thấy lệch, mà không
         *   có gì trên màn hình giải thích khoản chênh đó.
         */
        starsGained,
        acornsGained,
        levelUp: xp.levelUp,
        /**
         * ⚠️ QUÀ CỦA NHIỆM VỤ **KHÔNG** ĐƯỢC TRAO Ở ĐÂY — CHỈ BÁO LÀ "VỪA XONG".
         *
         *   Bé phải tự bấm "Nhận thưởng" ở màn Nhiệm vụ (`QuestService.claim`) — đó là chủ ý
         *   thiết kế (xem ARCHITECTURE §9.d): một cú bấm của bé là một khoảnh khắc bé thấy mình
         *   vừa được thưởng, còn quà tự nhảy vào ví thì không ai nhận ra nó đã xảy ra.
         *   Nên danh sách này chỉ dùng để hiện "Bé vừa xong nhiệm vụ X!" — trao quà ở đây sẽ
         *   khiến bé không bao giờ thấy nhiệm vụ đó ở trạng thái "chờ nhận".
         */
        questsCompleted,
        /**
         * ⚠️ Huy hiệu MỚI THẬT SỰ ĐƯỢC TRAO, đến từ HAI NGUỒN — và phải gộp CẢ HAI:
         *      • `xp.rewards.badgeIds` — quà của (các) cấp vừa vượt qua (T053).
         *      • `achievementBadges` — huy hiệu theo THÀNH TÍCH vừa đủ điều kiện (T068).
         *    Bỏ nguồn nào cũng sai: bỏ nguồn cấp thì bé không thấy màn "huy hiệu mới" khi lên
         *    cấp; bỏ nguồn thành tích thì mọi huy hiệu T068 vào sổ mà không ai được báo.
         *
         *    `new Set` chỉ để chắc chắn: hai nguồn trao tuần tự trong cùng transaction nên trên
         *    thực tế rời nhau (một huy hiệu đã có thì `grantBadgeInTx` trả `false`), nhưng trùng
         *    lặp trong thông báo là ăn mừng hai lần cho cùng một thứ.
         *
         *    ⚠️ KHÁC `levelUp.rewards` — danh sách kia là ĐỊNH NGHĨA thô của cấp (liệt kê MỌI
         *      món, kể cả món bé đã có từ đường khác). Dùng `levelUp.rewards` để vẽ màn "Lên
         *      cấp!"; dùng `badgesEarned` để bật thông báo "Bé vừa có huy hiệu mới".
         */
        badgesEarned: [...new Set([...xp.rewards.badgeIds, ...achievementBadges])],
        /** Sticker vừa mở ở lượt này (`null` nếu bài không có sticker, hoặc sticker đã có). */
        stickerEarned,
      };
    });
  }

  // --- Đọc kết quả đã chơi (T05) --------------------------------------------

  /**
   * Kết quả game ĐÃ CHƠI của một bé, **GỘP theo `exercise_id`** — nguồn dữ liệu cho chip trò chơi.
   *
   * ⭐ VÌ SAO LÀ MỘT PHƯƠNG THỨC ĐỌC RIÊNG, KHÔNG NHÉT VÀO `getSnapshot`/`getRewards`:
   *   `game_result` là miền dữ liệu RIÊNG (thành tích từng bài tập), không phải ví hay tiến độ.
   *   Nhét nó vào ảnh chụp ví sẽ làm phình mọi lần mở app, và trộn hai miền vào một response.
   *   Cần thì MỞ MỘT ĐƯỜNG ĐỌC cho nó — đó là cả việc này.
   *
   * ⚠️ `MAX(stars)` (KHÔNG `SUM`): câu hỏi là "đã chơi bài tập này chưa + tốt nhất tới đâu", không
   *    phải tổng. `stars` không bao giờ 0 với hàng có thật (ràng buộc `game-scoring`: tối thiểu
   *    1 ★) nên hễ có hàng là `bestStars ≥ 1` ⇒ `ThemePage` đọc ra `played = bestStars > 0`.
   * ⚠️ `COUNT(*)` = số lượt chơi; `MAX(created_at)` = lượt gần nhất. Chỉ đọc — câu SQL này KHÔNG
   *    ghi gì (đây là lý do T05 KHÔNG cần migration nào).
   * ⚠️ `idx_game_result_child (child_id, created_at DESC)` phục vụ `WHERE child_id = ?` rất tốt.
   *
   * ⚠️ Dùng `getDb()` trực tiếp (không qua `transaction`): đây là một truy vấn CHỈ-ĐỌC, không có
   *    chuỗi ghi nào cần tính nguyên tử. `requireChild` bên dưới mới là thứ quyết định quyền.
   */
  listGameSummaries(parentId: string, childId: string): GameResultsResponse {
    // Quyền sở hữu do service kiểm (KHÔNG tin `:id` trong URL) — ném CHILD_NOT_FOUND nếu bé không
    // thuộc phụ huynh này. Cùng mẫu như mọi phương thức khác của dự án.
    this.requireChild(parentId, childId);

    const rows = getDb()
      .prepare(
        `SELECT exercise_id,
                MAX(stars)      AS best_stars,
                MAX(score)      AS best_score,
                COUNT(*)        AS attempts,
                MAX(created_at) AS last_played_at
           FROM game_result
          WHERE child_id = ?
          GROUP BY exercise_id`,
      )
      .all(childId) as GameSummaryRow[];

    // Parse ĐẦU RA bằng chính schema dùng chung — nếu server trả sai hình dạng, nó ném Ở ĐÂY
    // (log rõ ràng) chứ không để client nhận dữ liệu méo mó rồi hỏng âm thầm.
    return gameResultsResponseSchema.parse({
      childId,
      results: rows.map((row) => ({
        exerciseId: row.exercise_id,
        // `game_result.stars` trong DB nằm trong 0–3 (ràng buộc CHECK ở migration
        // `003_progress.sql`), và `starsForRun()` không bao giờ trả 0 cho một lượt có thật ⇒ hàng
        // đọc ra luôn có `bestStars ≥ 1`. Ép kiểu này an toàn; schema ở trên vẫn là lưới an toàn
        // cuối cùng.
        bestStars: row.best_stars as 0 | 1 | 2 | 3,
        bestScore: row.best_score,
        attempts: row.attempts,
        lastPlayedAt: row.last_played_at,
      })),
      serverTime: nowIso(),
    });
  }

  // --- Nội bộ ---------------------------------------------------------------

  /** Kiểm quyền sở hữu. Ném `CHILD_NOT_FOUND` nếu không phải con của phụ huynh này. */
  private requireChild(parentId: string, childId: string): void {
    const child = this.children.getChild(parentId, childId);
    if (!child) throw errors.childNotFound();
  }

  /**
   * Chèn dòng `game_result` ĐÚNG MỘT LẦN. Trả `false` nếu `clientEventId` đã tồn tại.
   *
   * ⚠️ ĐỌC LẠI HÀNG SAU KHI `changes === 0` — xem quyết định 3 ở đầu file. `INSERT OR IGNORE`
   *    bỏ qua cả hàng vi phạm `CHECK`, nên `changes === 0` KHÔNG chứng minh được là trùng lặp.
   *    Không đọc lại thì một hàng bị từ chối vì ràng buộc sẽ trôi qua im lặng dưới vỏ bọc
   *    "lượt chơi trùng lặp" — không ghi gì, không báo lỗi.
   */
  private insertRunOnce(
    db: Db,
    childId: string,
    input: GameResultSubmissionInput,
    derived: DerivedRun,
    run: { score: number; stars: 1 | 2 | 3 },
  ): boolean {
    const inserted = db
      .prepare(
        `INSERT OR IGNORE INTO game_result
           (id, child_id, client_event_id, exercise_id, lesson_id, game_type,
            total_questions, correct_count, longest_streak, score, stars,
            duration_seconds, created_at, answered, wrong_attempts)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId(),
        childId,
        input.clientEventId,
        input.exerciseId,
        input.lessonId,
        input.gameType,
        input.totalRounds,
        derived.correctFirstTry,
        derived.longestStreak,
        run.score,
        run.stars,
        input.durationSeconds,
        input.occurredAt,
        derived.answered,
        derived.wrongAttempts,
      );

    if (inserted.changes > 0) return true;

    const existing = this.readRun(db, input.clientEventId);
    if (!existing) {
      // Không phải trùng lặp ⇒ hàng bị ràng buộc từ chối. Đây là lỗi thật, phải nổi lên.
      throw errors.internal(
        'Không ghi được kết quả lượt chơi và cũng không tìm thấy bản ghi trùng',
      );
    }
    return false;
  }

  private readRun(db: Db, clientEventId: string): GameResultRow | undefined {
    return db
      .prepare('SELECT * FROM game_result WHERE client_event_id = ?')
      .get(clientEventId) as GameResultRow | undefined;
  }

  /**
   * Kết quả trả về khi lượt chơi đã được ghi từ trước.
   *
   * ⚠️ MỌI TRƯỜNG THƯỞNG ĐỀU BẰNG 0, kể cả khi lượt chơi gốc được thưởng. Đây là điều ĐÚNG:
   *    client đang gửi lại vì mất phản hồi, chứ không phải chơi thêm một ván. Nếu trả lại số
   *    thưởng như lần đầu, client có thể hiện overlay "Bé được +3 ⭐" lần thứ hai cho cùng một
   *    ván — bé thấy mình được thưởng hai lần cho một việc, rồi lần sau không được gì và
   *    tưởng app hỏng.
   *
   * ⭐ VÀ TIỀN THÌ THẬT SỰ KHÔNG BỊ CỘNG HAI LẦN — không chỉ vì hàm này trả 0. `insertRunOnce`
   *   đã chặn trước đó, nên toàn bộ khối kinh tế trong `submit` (XP + ví) KHÔNG HỀ CHẠY ở nhánh
   *   này. Con số 0 ở đây chỉ để màn hình kết quả khỏi ăn mừng lại; cơ chế chống cộng trùng thật
   *   là khoá UNIQUE trên `client_event_id`.
   *
   * `score`/`stars` thì lấy từ bản ghi GỐC (không phải 0) — đó là kết quả của ván này, và
   * màn hình kết quả cần con số đúng để hiện.
   */
  private duplicateAward(
    db: Db,
    childId: string,
    input: GameResultSubmissionInput,
  ): GameResultAward {
    const existing = this.readRun(db, input.clientEventId);

    // Không thể xảy ra: `insertRunOnce` đã khẳng định hàng tồn tại trước khi trả `false`.
    // Ném ra thay vì trả số 0 — nếu lần này chạy được thì có nghĩa là logic ở trên đã sai, và
    // một con số 0 im lặng sẽ che mất điều đó.
    if (!existing) {
      throw errors.internal('Lượt chơi đã ghi nhưng không đọc lại được bản ghi');
    }

    const lesson = db
      .prepare(
        'SELECT best_score, stars_best FROM lesson_progress WHERE child_id = ? AND lesson_id = ?',
      )
      .get(childId, input.lessonId) as { best_score: number; stars_best: number } | undefined;

    return {
      score: existing.score,
      stars: storedRunStars(existing.stars),
      bestScore: lesson?.best_score ?? 0,
      bestStars: clampStarsBest(lesson?.stars_best ?? 0),
      // Không phải kỷ lục MỚI: kỷ lục đã được xác lập ở lần ghi đầu tiên.
      isNewRecord: false,
      duplicate: true,
      ...duplicateRewards(),
    };
  }
}

/** Dùng chung một instance. */
export const gameResultService = new GameResultService();
