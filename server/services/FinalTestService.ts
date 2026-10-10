/**
 * RubyLingo — `FinalTestService`: chấm và ghi lại MỘT PHẦN của bài thi cuối khoá Starters (G6).
 *
 * ⭐⭐ NHIỆM VỤ: NHẬN DỮ LIỆU THÔ → TỰ TÍNH KHIÊN → GHI VÀO SỔ CỦA BÉ → TRAO THƯỞNG (MỘT LẦN).
 *
 *   "TỰ TÍNH KHIÊN" là chữ quan trọng nhất. Client chỉ gửi lên SỰ THẬT THÔ — làm phần nào, mỗi
 *   câu có đúng ngay lần đầu không, đã thua mấy lần. Khiên do SERVER tính từ đó, bằng **đúng
 *   những hàm mà client dùng để hiện kết quả ngay** (`shared/final-test-scoring.ts`). Body nộp
 *   bài KHÔNG có trường `shields`/`score`, nên client không có đường nào để tự tuyên bố "5 khiên".
 *
 * ⚠️ `totalItems` LẤY TỪ CHỈ MỤC NỘI DUNG (`getFinalTestMeta`), KHÔNG TỪ BODY.
 *   Nếu client khai "phần này 3 câu" thì bé chỉ cần gửi 3 câu đúng để được 5 khiên. Mẫu số phải
 *   là sự thật của server.
 *
 * -----------------------------------------------------------------------------
 * BỐN QUYẾT ĐỊNH CẦN HIỂU TRƯỚC KHI SỬA
 * -----------------------------------------------------------------------------
 *
 * ⚠️ 1. `client_event_id` LÀ CỔNG CHỐNG GHI TRÙNG — MỌI THỨ KHÁC PHỤ THUỘC VÀO NÓ.
 *    Kịch bản thật: bé nộp xong, server ghi xong, PHẢN HỒI mất trên đường về. Client gửi lại y
 *    nguyên. Cổng này chặn lần thứ hai ⇒ phần thưởng không bị cộng hai lần. Dùng `INSERT OR
 *    IGNORE` rồi ĐỌC LẠI hàng — vì `OR IGNORE` nuốt CẢ lỗi `CHECK`, không chỉ lỗi trùng khoá
 *    (xem quyết định 3 ở đầu `GameResultService.ts`).
 *
 * ⚠️ 2. TOÀN BỘ VIỆC GHI NẰM TRONG **MỘT** TRANSACTION.
 *    Dòng `final_test_attempt` + xoá tiến độ dở + XP + ví + thống kê ngày + nhiệm vụ + huy hiệu.
 *    Nếu tách ra, một lỗi ở bước thứ ba để lại trạng thái nửa vời: phần thi đã bị đánh dấu "đã
 *    nộp" (nên lần gửi lại bị chặn) nhưng thưởng thì chưa cộng — bé mất phần thưởng VĨNH VIỄN.
 *
 * ⚠️ 3. PHẦN THƯỞNG KINH TẾ CHỈ Ở **LẦN HOÀN THÀNH ĐẦU TIÊN CỦA CẢ BÀI THI**.
 *    "Hoàn thành cả bài thi" = ba phần đều đã có ≥1 lần nộp. Quà được trao đúng khi số phần đã
 *    nộp chuyển từ 2 → 3 (lần đầu đủ ba). Làm lại một phần sau đó (để cải thiện khiên) chỉ cập
 *    nhật kỷ lục khiên — KHÔNG cộng lại ⭐/🌰/XP. Cách nhận biết: so `sectionsBefore` (tập phần đã
 *    có TRƯỚC khi chèn) với danh mục phần thi; điều kiện chỉ đúng một lần duy nhất.
 *
 * ⚠️ 4. HUY HIỆU ĐI **CUỐI CÙNG**.
 *    `BadgeService.evaluate` đọc lại SỔ trong DB (`final_test_attempt`, `wallet`, `xp_state`…).
 *    Nó chỉ thấy đúng trạng thái SAU khi các bước trên ghi xong — nếu chạy trước, cú nộp vừa đủ
 *    điều kiện tốt nghiệp sẽ không được tính. Cùng thứ tự như `GameResultService`.
 */

import { clampStarsBest } from '../../shared/game-scoring.js';
import { resolveFinalTestAccess } from '../../shared/final-test-access.js';
import type { FinalTestAccess } from '../../shared/final-test-access.js';
import {
  readSectionShields,
  shieldsForSpeaking,
  type ShieldCount,
} from '../../shared/final-test-scoring.js';
import { FINAL_TEST_COMPLETION_REWARD } from '../../shared/final-test-rewards.js';
import {
  getFinalTestMeta,
  levelRequiredExerciseIds,
  levelRequiredLessonIds,
} from '../../shared/content/content-index.js';
import {
  finalTestGateResponseSchema,
  finalTestProgressSaveSchema,
  finalTestProgressSchema,
  finalTestSubmissionSchema,
  finalTestSubmitResultSchema,
} from '../../shared/schemas/final-test-api.js';
import type { FinalTestSubmissionInput } from '../../shared/schemas/final-test-api.js';
import { finalTestSectionIdSchema } from '../../shared/schemas/final-test.js';
import type { FinalTestSectionId } from '../../shared/schemas/final-test.js';
import type {
  FinalTestGateState,
  FinalTestProgressDto,
  FinalTestSectionStatus,
  FinalTestSubmitResult,
} from '../../shared/types/final-test.js';
import type { LessonProgress } from '../../shared/types/progress.js';
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
import type { AppliedGrants, RewardService } from './RewardService.js';
import { xpService } from './XpService.js';
import type { XpService } from './XpService.js';

// =============================================================================
// Hình dạng hàng trong DB
// =============================================================================

interface AttemptSummaryRow {
  section: string;
  best: number;
  /** Thời điểm nộp GẦN NHẤT (`MAX(occurred_at)`) — chuỗi ISO UTC. */
  last: string;
  n: number;
}

interface ProgressRow {
  section: string;
  answered: number;
  answers_json: string;
  updated_at: string;
}

interface LessonRow {
  child_id: string;
  lesson_id: string;
  best_score: number;
  stars_best: number;
  attempts: number;
  completed: number;
  completed_at: string | null;
  updated_at: string;
}

/** Bọc rỗng cho phần thưởng của lần nộp KHÔNG phải lần hoàn thành đầu tiên. */
function noGrant(): AppliedGrants {
  return { starsGained: 0, acornsGained: 0, badgeIds: [], stickerIds: [], itemIds: [] };
}

/** Kết quả một lần cộng XP mà `submit` cần — đúng những trường nó đọc. */
interface XpOutcome {
  xpGained: number;
  levelUp: FinalTestSubmitResult['levelUp'];
  rewards: AppliedGrants;
}

/** Phần thưởng rỗng của một lần nộp KHÔNG trao gì (dùng cho `duplicate`/không phải lần đầu). */
function noXp(): XpOutcome {
  return { xpGained: 0, levelUp: null, rewards: noGrant() };
}

// =============================================================================
// Service
// =============================================================================

export class FinalTestService {
  /**
   * ⚠️ SÁU phụ thuộc, tất cả nằm trong CÙNG transaction của `submit()` — xem quyết định 2.
   *    Nhận qua tham số (có mặc định) để test cắm được bản giả, và để chữ ký hàm NÓI RA rằng
   *    một lần nộp chạm vào sáu miền dữ liệu.
   *
   * ⚠️ KHÔNG có vòng import: không service nào ở đây trỏ ngược lại `FinalTestService`. Chiều
   *    phụ thuộc hợp lệ là `FinalTestService → {Progress, Quest, Badge, Reward, Xp, Child}`; câu
   *    hỏi dùng chung "đã tốt nghiệp chưa" nằm ở module lá `finalTestCompletion.ts`.
   */
  constructor(
    private readonly children: ChildService = childService,
    private readonly progress: ProgressService = progressService,
    private readonly rewards: RewardService = rewardService,
    private readonly xp: XpService = xpService,
    private readonly quests: QuestService = questService,
    private readonly badges: BadgeService = badgeService,
  ) {}

  // ===========================================================================
  // GET — trạng thái cổng + tiến độ + kết quả đã có
  // ===========================================================================

  /**
   * Toàn bộ dữ liệu cho màn "Khu vực thi": cổng có mở không, mỗi phần bé đang ở đâu, khiên cao
   * nhất từng đạt là bao nhiêu.
   *
   * @param parentId Phụ huynh đang đăng nhập — quyền sở hữu suy từ `parent_id`, KHÔNG tin URL.
   */
  getState(parentId: string, childId: string): FinalTestGateState {
    this.requireChild(parentId, childId);
    const db = getDb();

    const attempts = this.readAttemptSummaries(db, childId);
    const gate = this.readGate(db, childId, attempts.size > 0);
    const progress = this.readProgressRows(db, childId);

    const state: FinalTestGateState = {
      childId,
      gate,
      sections: this.sectionStatuses(attempts, progress),
      serverTime: nowIso(),
    };

    // Parse ĐẦU RA bằng schema dùng chung: server trả sai hình dạng thì nó ném Ở ĐÂY, không để
    // client nhận dữ liệu méo mó rồi hỏng âm thầm. Cùng lối như `GameResultService.listGameSummaries`.
    finalTestGateResponseSchema.parse(state);
    return state;
  }

  // ===========================================================================
  // POST — nộp MỘT phần thi (server tự chấm)
  // ===========================================================================

  /**
   * Chấm và ghi lại một phần thi. **Lũy đẳng theo `clientEventId`.**
   *
   * @param rawSection `:section` trên URL — parse ở ĐÂY (và ở route) để giữ một luật cho mọi
   *                   đường gọi (test, script). Xem ghi chú đầu `shared/schemas/final-test-api.ts`.
   */
  submit(
    parentId: string,
    childId: string,
    rawSection: unknown,
    rawInput: unknown,
  ): FinalTestSubmitResult {
    const section = finalTestSectionIdSchema.parse(rawSection);
    // Parse ở tầng service (không chỉ ở route) — xem ghi chú ở `ChildService`.
    const input = finalTestSubmissionSchema.parse(rawInput);

    this.requireChild(parentId, childId);

    const meta = getFinalTestMeta();
    if (!meta) throw errors.internal('Cấp học này chưa có bài thi cuối khoá');
    const sectionMeta = meta.sections.find((s) => s.section === section);
    if (!sectionMeta) throw errors.internal(`Phần thi "${section}" không có trong bài thi`);

    // Mẫu số là SỰ THẬT CỦA SERVER, không phải con số client khai.
    const total = sectionMeta.itemCount;
    const answered = input.answers.length;
    const correctFirstTry = input.answers.filter((answer) => answer.firstTry).length;

    /**
     * ⚠️ NỘP PHẢI ĐỦ SỐ CÂU CỦA PHẦN — không thiếu, không thừa.
     *    Thiếu ⇒ chưa xong (không phải "0 khiên"). Thừa ⇒ bé gửi 40 câu đúng cho phần 20 câu để
     *    kéo tỉ lệ lên — mẫu số là sự thật của server, và một lần nộp phải khớp đúng phần đó.
     */
    if (answered !== total) {
      throw errors.validation('Phần thi chưa làm đúng số câu của phần này', {
        answers: `Phần này có ${total} câu, đã gửi ${answered}`,
      });
    }

    /**
     * ⭐ KHIÊN TÍNH BẰNG ĐÚNG HÀM Ở `shared/` MÀ CLIENT CŨNG DÙNG.
     *
     * ⚠️ Phần chấm tự động (Listening / Reading & Writing) đi qua `readSectionShields`, hàm này
     *    trả `null` khi phần CHƯA hoàn thành (chưa đi hết số câu) — nên một lần nộp THIẾU câu
     *    không thể sinh ra khiên. Phần Nói KHÔNG chấm tự động: dùng `shieldsForSpeaking` (đủ câu
     *    ⇒ 5 khiên "đã bỏ công", không xét đúng/sai — xem tài liệu §3.4).
     */
    const shields: ShieldCount | null = sectionMeta.autoScored
      ? readSectionShields({ correctFirstTry, answered, total })
      : shieldsForSpeaking(answered, total);

    if (shields === null) {
      // Lưới an toàn thứ hai: với `answered === total` nhánh này KHÔNG chạy, nhưng giữ lại để
      // một thay đổi trong `shared/` không thể biến "chưa xong" thành một khiên giả.
      throw errors.validation('Phần thi chưa làm hết, bé cần hoàn thành tất cả các câu', {
        answers: `Cần ${total} câu, đã làm ${answered}`,
      });
    }

    const requiredSections = meta.sections.map((s) => s.section);

    return transaction((db) => {
      // --- Cổng vào: server tự kiểm bằng DỮ LIỆU THẬT, không tin client ---
      const sectionsBefore = this.readDistinctSections(db, childId);
      const gate = this.readGate(db, childId, sectionsBefore.size > 0);
      if (!gate.enterable) throw errors.finalTestLocked();

      /**
       * ⚠️ LẦN HOÀN THÀNH CẢ BÀI THI = phần này CHƯA từng được nộp, VÀ mọi phần khác ĐÃ nộp.
       *    Điều kiện này chỉ đúng một lần duy nhất trong đời hồ sơ bé ⇒ quà chỉ trao một lần.
       */
      const firstCompletion =
        !sectionsBefore.has(section) &&
        requiredSections.every((s) => s === section || sectionsBefore.has(s));

      // --- Ghi nhật ký lần thi (cổng chống trùng) ------------------------
      if (!this.insertAttemptOnce(db, childId, section, input, total, correctFirstTry, shields)) {
        return this.duplicateResult(db, childId, section, input.clientEventId);
      }

      // --- Tiến độ: phần này không còn "đang dở" nữa ---------------------
      this.clearProgressInTx(db, childId, section);

      // --- Trao thưởng (CHỈ lần hoàn thành đầu tiên) ----------------------
      let xpGain: XpOutcome = noXp();
      let applied: AppliedGrants = noGrant();
      let questsCompleted: string[] = [];

      if (firstCompletion) {
        const reward = FINAL_TEST_COMPLETION_REWARD;

        // ⚠️ XP ĐI QUA `XpService` — đường DUY NHẤT cộng XP (nó còn phát hiện vượt cấp + trao
        //    quà của mọi cấp bị nhảy qua). Xem quyết định 2 ở đầu `RewardService.ts`.
        xpGain = this.xp.addXpInTx(db, childId, reward.xp, input.occurredAt);
        applied = this.rewards.applyGrantsInTx(
          db,
          childId,
          { stars: reward.stars, acorns: reward.acorns },
          input.occurredAt,
        );

        const starsGained = applied.starsGained + xpGain.rewards.starsGained;
        const acornsGained = applied.acornsGained + xpGain.rewards.acornsGained;

        // --- Thống kê ngày (bảng của `ProgressService`) --------------------
        this.progress.applyDailyStatInTx(
          db,
          childId,
          localDateKey(new Date(input.occurredAt)),
          {
            wordsLearned: 0,
            questionsAnswered: total,
            correctCount: correctFirstTry,
            activeSeconds: 0,
            starsEarned: starsGained,
            acornsEarned: acornsGained,
            xpEarned: xpGain.xpGained,
          },
          input.occurredAt,
        );

        // --- Nhiệm vụ: báo "bài thi vừa đổi" để nhiệm vụ tốt nghiệp được đánh lại ---
        questsCompleted = this.quests.applyEventInTx(
          db,
          childId,
          { kind: 'final_test_completed' },
          input.occurredAt,
        );
      }

      // --- Sưu tầm: huy hiệu ĐI CUỐI CÙNG — xem quyết định 4 --------------
      const badgesEarned = this.badges.evaluate(db, childId, input.occurredAt);

      const bestShields = this.readBestShields(db, childId, section);
      if (bestShields === null) {
        throw errors.internal('Vừa ghi lần thi nhưng không đọc lại được khiên cao nhất');
      }

      const result: FinalTestSubmitResult = {
        section,
        duplicate: false,
        totalItems: total,
        correctFirstTry,
        shields,
        bestShields,
        isNewRecord: shields > this.bestShieldsBefore(db, childId, section, input.clientEventId),
        firstCompletion,
        xpGained: xpGain.xpGained,
        starsGained: applied.starsGained + xpGain.rewards.starsGained,
        acornsGained: applied.acornsGained + xpGain.rewards.acornsGained,
        levelUp: xpGain.levelUp,
        questsCompleted,
        badgesEarned: [...new Set([...xpGain.rewards.badgeIds, ...badgesEarned])],
      };

      finalTestSubmitResultSchema.parse(result);
      return result;
    });
  }

  // ===========================================================================
  // PUT — lưu tiến độ đang dở
  // ===========================================================================

  /**
   * Lưu tiến độ đang dở của MỘT phần (để đổi máy làm tiếp).
   *
   * ⚠️ `answered` suy từ `answers.length` — server KHÔNG nhận con số đếm do client khai riêng.
   * ⚠️ Cổng chưa mở thì KHÔNG lưu được (bé chưa vào được khu vực thi thì không có gì để dở).
   */
  saveProgress(parentId: string, childId: string, rawInput: unknown): FinalTestProgressDto {
    const input = finalTestProgressSaveSchema.parse(rawInput);
    this.requireChild(parentId, childId);

    const answers = input.answers.map((answer) => ({ itemId: answer.itemId, value: answer.value }));

    return transaction((db) => {
      const gate = this.readGate(db, childId, this.readDistinctSections(db, childId).size > 0);
      if (!gate.enterable) throw errors.finalTestLocked();

      const at = nowIso();
      db.prepare(
        `INSERT INTO final_test_progress (child_id, section, answered, answers_json, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (child_id, section) DO UPDATE SET
           answered     = excluded.answered,
           answers_json = excluded.answers_json,
           updated_at   = excluded.updated_at`,
      ).run(childId, input.section, answers.length, JSON.stringify(answers), at);

      const dto: FinalTestProgressDto = {
        section: input.section,
        answered: answers.length,
        answers,
        updatedAt: at,
      };
      finalTestProgressSchema.parse(dto);
      return dto;
    });
  }

  // ===========================================================================
  // Nội bộ — cổng & đọc
  // ===========================================================================

  /** Kiểm quyền sở hữu. Ném `CHILD_NOT_FOUND` nếu không phải con của phụ huynh này. */
  private requireChild(parentId: string, childId: string): void {
    if (!this.children.getChild(parentId, childId)) throw errors.childNotFound();
  }

  /**
   * Tính trạng thái cổng `resolveFinalTestAccess` từ DỮ LIỆU THẬT của server:
   *   • `lessons`             — bản ghi tiến độ từng bài (`lesson_progress`).
   *   • `requiredLessonIds`   — mọi bài của level (mẫu số "học hết"), từ chỉ mục nội dung.
   *   • `requiredExerciseIds` — mọi exercise chơi được của level (mẫu số "chơi hết").
   *   • `playedExerciseIds`   — exercise bé đã chơi ≥1 lần (`game_result`).
   *   • `hydrated` = true     — server LUÔN có đủ dữ liệu (khác client lúc offline).
   *   • `hasResult`           — đã có kết quả thi ⇒ cổng `done`, không bao giờ khoá lại.
   */
  private readGate(db: Db, childId: string, hasResult: boolean): FinalTestAccess {
    const lessons = this.readLessonProgress(db, childId);
    const playedExerciseIds = this.readPlayedExerciseIds(db, childId);

    return resolveFinalTestAccess({
      lessons,
      requiredLessonIds: levelRequiredLessonIds(),
      requiredExerciseIds: levelRequiredExerciseIds(),
      playedExerciseIds,
      hydrated: true,
      hasResult,
    });
  }

  /** Bản ghi tiến độ TỪNG BÀI của bé — `ProgressSnapshot.lessons`. */
  private readLessonProgress(db: Db, childId: string): LessonProgress[] {
    const rows = db
      .prepare('SELECT * FROM lesson_progress WHERE child_id = ?')
      .all(childId) as LessonRow[];
    return rows.map((row) => ({
      childId: row.child_id,
      lessonId: row.lesson_id,
      bestScore: row.best_score,
      starsBest: clampStarsBest(row.stars_best),
      attempts: row.attempts,
      completed: row.completed === 1,
      completedAt: row.completed_at,
      updatedAt: row.updated_at,
    }));
  }

  /** Tập exercise bé ĐÃ chơi (có ≥1 hàng `game_result`). */
  private readPlayedExerciseIds(db: Db, childId: string): Set<string> {
    const rows = db
      .prepare('SELECT DISTINCT exercise_id FROM game_result WHERE child_id = ?')
      .all(childId) as Array<{ exercise_id: string }>;
    return new Set(rows.map((row) => row.exercise_id));
  }

  /** Tập phần thi bé đã nộp ÍT NHẤT một lần. */
  private readDistinctSections(db: Db, childId: string): Set<string> {
    const rows = db
      .prepare('SELECT DISTINCT section FROM final_test_attempt WHERE child_id = ?')
      .all(childId) as Array<{ section: string }>;
    return new Set(rows.map((row) => row.section));
  }

  /** Khiên cao nhất từng đạt của một phần, hoặc `null` nếu chưa từng hoàn thành. */
  private readBestShields(db: Db, childId: string, section: FinalTestSectionId): ShieldCount | null {
    const row = db
      .prepare(
        'SELECT MAX(shields) AS best FROM final_test_attempt WHERE child_id = ? AND section = ?',
      )
      .get(childId, section) as { best: number | null } | undefined;
    if (!row || row.best === null) return null;
    return row.best as ShieldCount;
  }

  /**
   * Khiên cao nhất của phần TRƯỚC lần nộp đang xét — dùng để biết lần này có phá kỷ lục không.
   *
   * ⚠️ Loại TRỪ hàng vừa chèn (theo `client_event_id`): sau khi `insertAttemptOnce` chạy, hàng mới
   *    đã nằm trong bảng; nếu không loại nó ra thì "kỷ lục trước" luôn bằng chính lần này và
   *    `isNewRecord` luôn sai.
   */
  private bestShieldsBefore(
    db: Db,
    childId: string,
    section: FinalTestSectionId,
    clientEventId: string,
  ): number {
    const row = db
      .prepare(
        `SELECT MAX(shields) AS best FROM final_test_attempt
          WHERE child_id = ? AND section = ? AND client_event_id <> ?`,
      )
      .get(childId, section, clientEventId) as { best: number | null } | undefined;
    return row?.best ?? 0;
  }

  /**
   * Gộp mỗi phần: khiên cao nhất + số lần nộp + thời điểm nộp gần nhất.
   *
   * ⚠️ `MAX(occurred_at)` trả về CHUỖI (cột `occurred_at` là TEXT) — so sánh này chỉ đúng vì
   *    mọi mốc đều là ISO-8601 UTC có `Z` (schema nộp bài ép định dạng). `occurred_at` là cột
   *    NOT NULL và nhóm chỉ có hàng khi đã nộp, nên `last` không bao giờ rỗng.
   */
  private readAttemptSummaries(db: Db, childId: string): Map<string, AttemptSummaryRow> {
    const rows = db
      .prepare(
        `SELECT section, MAX(shields) AS best, MAX(occurred_at) AS last, COUNT(*) AS n
           FROM final_test_attempt WHERE child_id = ? GROUP BY section`,
      )
      .all(childId) as AttemptSummaryRow[];
    return new Map(rows.map((row) => [row.section, row]));
  }

  /** Tiến độ đang dở của mọi phần, đã parse `answers_json` (chịu được dữ liệu hỏng). */
  private readProgressRows(db: Db, childId: string): Map<string, FinalTestProgressDto> {
    const rows = db
      .prepare('SELECT section, answered, answers_json, updated_at FROM final_test_progress WHERE child_id = ?')
      .all(childId) as ProgressRow[];

    const out = new Map<string, FinalTestProgressDto>();
    for (const row of rows) {
      const section = finalTestSectionIdSchema.safeParse(row.section);
      if (!section.success) continue; // hàng lạ (nội dung đổi) — bỏ qua, không làm sập màn hình.
      out.set(row.section, {
        section: section.data,
        answered: row.answered,
        answers: parseProgressAnswers(row.answers_json),
        updatedAt: row.updated_at,
      });
    }
    return out;
  }

  /**
   * Tóm tắt từng phần thi — hợp nhất danh mục phần (nguồn sự thật) với kết quả bé đã có.
   *
   * ⚠️ Duyệt theo `meta.sections` (KHÔNG theo kết quả trong DB): bé CHƯA làm phần nào vẫn phải
   *    thấy phần đó trong danh sách (nút "Bắt đầu"), thay vì nó biến mất khỏi màn hình.
   */
  private sectionStatuses(
    attempts: Map<string, AttemptSummaryRow>,
    progress: Map<string, FinalTestProgressDto>,
  ): FinalTestSectionStatus[] {
    const meta = getFinalTestMeta();
    if (!meta) return [];

    return meta.sections.map((summary) => {
      const section = summary.section;
      const attempt = attempts.get(section);
      const best = attempt ? (attempt.best as ShieldCount) : null;
      return {
        section,
        autoScored: summary.autoScored,
        totalItems: summary.itemCount,
        bestShields: best,
        completed: attempt !== undefined,
        attempts: attempt?.n ?? 0,
        // Chưa nộp lần nào ⇒ `null` (KHÔNG bịa một mốc). `attempt` có hàng ⇒ `last` luôn có giá trị.
        lastAttemptAt: attempt?.last ?? null,
        progress: progress.get(section) ?? null,
      };
    });
  }

  // ===========================================================================
  // Nội bộ — ghi
  // ===========================================================================

  /**
   * Chèn dòng `final_test_attempt` ĐÚNG MỘT LẦN. Trả `false` nếu `clientEventId` đã tồn tại.
   *
   * ⚠️ ĐỌC LẠI HÀNG SAU KHI `changes === 0` — xem quyết định 1. `INSERT OR IGNORE` bỏ qua cả
   *    hàng vi phạm `CHECK`, nên `changes === 0` KHÔNG chứng minh được là trùng lặp.
   */
  private insertAttemptOnce(
    db: Db,
    childId: string,
    section: FinalTestSectionId,
    input: FinalTestSubmissionInput,
    totalItems: number,
    correctFirstTry: number,
    shields: ShieldCount,
  ): boolean {
    const inserted = db
      .prepare(
        `INSERT OR IGNORE INTO final_test_attempt
           (id, child_id, section, client_event_id, occurred_at, total_items, correct_first_try, shields, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId(),
        childId,
        section,
        input.clientEventId,
        input.occurredAt,
        totalItems,
        correctFirstTry,
        shields,
        nowIso(),
      );

    if (inserted.changes > 0) return true;

    const existing = db
      .prepare('SELECT id FROM final_test_attempt WHERE client_event_id = ?')
      .get(input.clientEventId) as { id: string } | undefined;
    if (!existing) {
      throw errors.internal(
        'Không ghi được kết quả phần thi và cũng không tìm thấy bản ghi trùng',
      );
    }
    return false;
  }

  /** Xoá tiến độ đang dở của một phần: phần đó đã hoàn thành, không còn gì để "làm tiếp". */
  private clearProgressInTx(db: Db, childId: string, section: FinalTestSectionId): void {
    db.prepare('DELETE FROM final_test_progress WHERE child_id = ? AND section = ?').run(
      childId,
      section,
    );
  }

  /**
   * Kết quả trả về khi phần thi đã được ghi từ trước (client gửi lại sau khi mất phản hồi).
   *
   * ⚠️ MỌI TRƯỜNG THƯỞNG BẰNG 0 — đây là QUYẾT ĐỊNH, không phải khoảng trống. Client đang gửi
   *    lại, không phải nộp thêm; nếu trả lại số thưởng, bé thấy overlay "Bé được +300 ⭐" lần thứ
   *    hai cho cùng một việc. Cơ chế chống cộng trùng thật là khoá UNIQUE trên `client_event_id`.
   */
  private duplicateResult(
    db: Db,
    childId: string,
    section: FinalTestSectionId,
    clientEventId: string,
  ): FinalTestSubmitResult {
    const row = db
      .prepare('SELECT * FROM final_test_attempt WHERE client_event_id = ?')
      .get(clientEventId) as
      | {
          total_items: number;
          correct_first_try: number;
          shields: number;
        }
      | undefined;
    if (!row) throw errors.internal('Phần thi đã ghi nhưng không đọc lại được bản ghi');

    const best = this.readBestShields(db, childId, section);
    if (best === null) throw errors.internal('Đã có lần nộp nhưng không suy ra được khiên cao nhất');

    const result: FinalTestSubmitResult = {
      section,
      duplicate: true,
      totalItems: row.total_items,
      correctFirstTry: row.correct_first_try,
      shields: row.shields as ShieldCount,
      bestShields: best,
      // Không phải kỷ lục MỚI: kỷ lục đã được xác lập ở lần ghi đầu tiên.
      isNewRecord: false,
      firstCompletion: false,
      xpGained: 0,
      starsGained: 0,
      acornsGained: 0,
      levelUp: null,
      questsCompleted: [],
      badgesEarned: [],
    };
    finalTestSubmitResultSchema.parse(result);
    return result;
  }
}

/** Đọc `answers_json` của tiến độ, chịu được dữ liệu hỏng (trả `[]` thay vì ném). */
function parseProgressAnswers(raw: string): FinalTestProgressDto['answers'] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is { itemId: string; value: string } =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as { itemId?: unknown }).itemId === 'string' &&
          typeof (entry as { value?: unknown }).value === 'string',
      )
      .map((entry) => ({ itemId: entry.itemId, value: entry.value }));
  } catch {
    console.warn('[rubylingo] final_test_progress.answers_json không đọc được, coi như rỗng');
    return [];
  }
}

/** Dùng chung một instance. */
export const finalTestService = new FinalTestService();
