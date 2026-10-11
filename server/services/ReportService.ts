/**
 * RubyLingo — `ReportService`: BÁO CÁO TUẦN cho phụ huynh (T073).
 *
 * ⭐ NHIỆM VỤ: đọc sổ của bé trong một KHOẢNG NGÀY và trả về đúng `ReportResponse` đã có sẵn
 *   trong `shared/types/api.ts`. Hợp đồng KHÔNG do tệp này thiết kế — nó đã đóng băng.
 *
 * -----------------------------------------------------------------------------
 * BỐN QUYẾT ĐỊNH CẦN HIỂU TRƯỚC KHI SỬA
 * -----------------------------------------------------------------------------
 *
 * ⚠️ 1. "NGÀY" PHẢI LÀ **MỘT** ĐỊNH NGHĨA — và nó là `localDateKey`.
 *    Khoảng ngày, `daily_stats.date`, `streak_state.last_active_date` và nhiệm vụ `learn_days`
 *    đều dùng khoá NGÀY ĐỊA PHƯƠNG (`YYYY-MM-DD`, UTC+7). Nếu báo cáo lọc theo UTC thì một buổi
 *    học lúc 23:30 giờ Việt Nam sẽ rơi sang NGÀY HÔM SAU — báo cáo, chuỗi ngày và nhiệm vụ sẽ
 *    nói ba con số khác nhau cho cùng một tuần, và không ai biết số nào đúng.
 *    Vì vậy `lessonsCompleted` PHẢI quy `completed_at` (ISO) về khoá ngày bằng chính `localDateKey`
 *    rồi mới so khoảng — xem `countLessonsCompletedInRange`.
 *
 * ⚠️ 2. `to` **BAO GỒM** ngày cuối (`date >= from AND date <= to`, so khoá ngày trực tiếp).
 *    Một khoảng "7 ngày" vì thế là `from = to - 6 ngày`. Đây là chỗ dễ lệch một ngày nhất.
 *
 * ⚠️ 3. CHẶN TRẦN KHOẢNG NGÀY. `?from=1970-01-01` không được phép quét cả bảng: xem
 *    `REPORT_MAX_RANGE_DAYS`. Không có trần thì một request rẻ tiền làm nghẽn máy.
 *
 * ⚠️ 4. `strugglingWords` và `masteredWords` **KHÔNG BAO GIỜ GIAO NHAU**. Một từ không thể vừa
 *    "còn hay nhầm" vừa "đã nhớ chắc". Cơ chế: `strugglingWords` yêu cầu `mastered = 0`, còn
 *    `masteredWords` yêu cầu `mastered = 1` — hai điều kiện LOẠI TRỪ nhau. Điều kiện `mastered = 0`
 *    vừa đúng về nghĩa, vừa là thứ khiến giao luôn rỗng; test khoá đúng điều đó.
 *    ⚠️ "Đã nhớ chắc" KHÔNG có ngưỡng riêng ở đây: nó đọc cột `word_progress.mastered` — cột đã
 *       được `ProgressService` đặt bằng `MASTERED_THRESHOLD` (`shared/progress-merge.ts`). Đọc
 *       cột dẫn xuất là cách "dùng lại ngưỡng" đúng nhất: một ngưỡng, một chỗ tính.
 */

import type { ReportResponse, WordAccuracyDto } from '../../shared/types/api.js';
import type { FinalTestSectionStatus } from '../../shared/types/final-test.js';
import type { ParentSpeakingState } from '../../shared/schemas/parent-speaking.js';
import type { ShieldCount } from '../../shared/final-test-scoring.js';
import { reportQuerySchema } from '../../shared/schemas/report.js';
import type { ReportQueryInput } from '../../shared/schemas/report.js';
import { finalTestSectionStatusSchema } from '../../shared/schemas/final-test-api.js';
import {
  parentSpeakingStateSchema,
  parseParentSpeakingMarks,
} from '../../shared/schemas/parent-speaking.js';
import {
  REPORT_DEFAULT_RANGE_DAYS,
  REPORT_MAX_RANGE_DAYS,
  REPORT_WORD_LIST_LIMIT,
  STRUGGLING_MIN_WRONG,
} from '../../shared/constants.js';
import { getFinalTestMeta, getWordText } from '../../shared/content/content-index.js';
import type { Db } from '../db/connection.js';
import { getDb } from '../db/connection.js';
import { dateKeyDaysAgo, daysBetweenDateKeys, localDateKey } from '../lib/time.js';
import { logger } from '../lib/logger.js';
import { errors } from '../plugins/errors.js';
import { childService } from './ChildService.js';
import type { ChildService } from './ChildService.js';
import { dailyStatToDto } from './dailyStats.js';
import type { DailyStatRow } from './dailyStats.js';

/** Một hàng `word_progress` cần cho hai danh sách từ. */
interface WordProgressRow {
  word_id: string;
  correct_count: number;
  wrong_count: number;
}

/** Gộp một phần thi cuối khoá: khiên cao nhất + số lần nộp + mốc nộp gần nhất. */
interface FinalTestAttemptRow {
  section: string;
  best: number;
  last: string;
  n: number;
}

export class ReportService {
  constructor(
    private readonly db: Db = getDb(),
    private readonly children: ChildService = childService,
  ) {}

  /**
   * Báo cáo của một bé trong khoảng ngày.
   *
   * ⚠️ BA TẦNG BẢO VỆ, VÀ TẦNG THỨ BA NẰM Ở ĐÂY — cố ý:
   *    `requireParent` (đã đăng nhập) và `requireParentGate` (đã qua cổng PIN) là `preHandler` ở
   *    tầng route. Tầng thứ ba — **SỞ HỮU** (`parent_id` của bé phải là phụ huynh đang gọi) —
   *    nằm ở đây vì MỌI service khác của dự án đều kiểm sở hữu theo đúng cách này
   *    (`RewardService`, `QuestService`, `ProgressService`…). Chỉ kiểm "bé có tồn tại" là một
   *    phụ huynh đọc được dữ liệu con nhà khác — đó là ranh giới giữa các gia đình.
   */
  getReport(
    parentId: string,
    childId: string,
    rawQuery: unknown,
    now: Date = new Date(),
  ): ReportResponse {
    // Parse ở tầng service (không chỉ ở route) — xem ghi chú ở `ChildService`.
    const query = reportQuerySchema.parse(rawQuery);

    // --- Tầng bảo vệ thứ ba: SỞ HỮU --------------------------------------
    const child = this.children.getChild(parentId, childId);
    if (!child) throw errors.childNotFound();

    const { from, to } = this.resolveRange(query, now);

    // --- daily_stats trong khoảng (nguồn của "học thêm bao nhiêu từ / bao nhiêu ⭐") ----
    const dailyRows = this.db
      .prepare(
        'SELECT * FROM daily_stats WHERE child_id = ? AND date >= ? AND date <= ? ORDER BY date',
      )
      .all(childId, from, to) as DailyStatRow[];

    let wordsLearned = 0;
    let starsEarned = 0;
    let activeDays = 0;
    for (const row of dailyRows) {
      wordsLearned += row.words_learned;
      starsEarned += row.stars_earned;
      // "Ngày có hoạt động học" — CÙNG định nghĩa với nhiệm vụ `learn_days` (bỏ hàng toàn số 0
      // mà `QuestService.claim` sinh ra khi bé bấm "Nhận thưởng": nhận quà KHÔNG phải là học).
      if (row.words_learned > 0 || row.questions_answered > 0 || row.active_seconds > 0) {
        activeDays += 1;
      }
    }

    const lessonsCompleted = this.countLessonsCompletedInRange(childId, from, to);
    const wordsMastered = this.countMastered(childId);

    const strugglingWords = this.readStrugglingWords(childId);
    const masteredWords = this.readMasteredWords(childId);

    return {
      finalTest: this.readFinalTestSections(childId),
      parentSpeaking: this.readParentSpeaking(childId),
      child,
      summary_vi: this.buildSummary({
        activeDays,
        wordsLearned,
        starsEarned,
        lessonsCompleted,
        strugglingCount: strugglingWords.length,
      }),
      range: { from, to },
      dailyStats: dailyRows.map(dailyStatToDto),
      wordsLearned,
      /** ⚠️ LUỸ KẾ, KHÔNG theo khoảng — xem ghi chú đầy đủ ở `countMastered`. */
      wordsMastered,
      lessonsCompleted,
      starsEarned,
      strugglingWords,
      masteredWords,
    };
  }

  // --- Nội bộ ---------------------------------------------------------------

  /**
   * Chốt khoảng ngày từ query, áp MẶC ĐỊNH và TRẦN.
   *
   * ⚠️ Mặc định `from` tính LÙI TỪ `to` (không phải từ hôm nay): nếu client chỉ gửi `to` (một tuần
   *    cũ), khoảng mặc định phải là 7 ngày KẾT THÚC ở `to` — nếu tính từ hôm nay thì `from > to`
   *    và một yêu cầu hợp lý bị từ chối oan.
   */
  private resolveRange(query: ReportQueryInput, now: Date): { from: string; to: string } {
    const to = query.to ?? localDateKey(now);
    // `to` là khoá ngày; dùng nửa đêm UTC của chính nó làm mốc để lùi ngày (vẫn cùng ngày địa phương).
    const from =
      query.from ?? dateKeyDaysAgo(REPORT_DEFAULT_RANGE_DAYS - 1, new Date(`${to}T00:00:00Z`));

    const span = daysBetweenDateKeys(from, to); // = to - from, đơn vị ngày
    if (span < 0) {
      throw errors.validation('Khoảng ngày chưa hợp lệ: "từ" phải trước hoặc bằng "đến".', {
        from: 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc',
      });
    }
    if (span > REPORT_MAX_RANGE_DAYS - 1) {
      throw errors.validation(
        `Khoảng ngày quá dài: báo cáo chỉ nhận tối đa ${REPORT_MAX_RANGE_DAYS} ngày.`,
        { from: `Khoảng ngày tối đa là ${REPORT_MAX_RANGE_DAYS} ngày` },
      );
    }
    return { from, to };
  }

  /**
   * Số bài HOÀN THÀNH trong khoảng.
   *
   * ⚠️ Quy `completed_at` (ISO) về KHOÁ NGÀY ĐỊA PHƯƠNG bằng chính `localDateKey` rồi mới so —
   *    KHÔNG so chuỗi ISO trực tiếp với `from`/`to`. So trực tiếp là lỗi lệch-ngày kinh điển:
   *    bài xong lúc 23:30 giờ Việt Nam có `completed_at` mang NGÀY UTC hôm sau.
   */
  private countLessonsCompletedInRange(childId: string, from: string, to: string): number {
    const rows = this.db
      .prepare(
        `SELECT completed_at FROM lesson_progress
          WHERE child_id = ? AND completed = 1 AND completed_at IS NOT NULL`,
      )
      .all(childId) as Array<{ completed_at: string }>;

    let count = 0;
    for (const row of rows) {
      const key = localDateKey(new Date(row.completed_at));
      if (key >= from && key <= to) count += 1;
    }
    return count;
  }

  /**
   * Số từ "đã nhớ chắc" — **ẢNH CHỤP LUỸ KẾ, KHÔNG theo khoảng ngày** (quyết định của chủ dự án).
   *
   * ⚠️⚠️ ĐỌC KỸ TRƯỚC KHI "SỬA CHO ĐÚNG": ba con số còn lại của báo cáo (`wordsLearned`,
   *   `starsEarned`, `lessonsCompleted`) lọc THEO KHOẢNG, nhưng con số này là **tổng luỹ kế tới
   *   nay** — trả lời câu "con tôi đang ở đâu trên tổng thể", không phải "tuần này con nhớ thêm
   *   bao nhiêu từ". Vì vậy phía client PHẢI dán nhãn "tổng cộng" cho ô này, nếu không phụ huynh
   *   sẽ đọc nó như số của tuần.
   *
   *   ⚠️ VÌ SAO KHÔNG LỌC THEO KHOẢNG: `word_progress` KHÔNG lưu "nhớ chắc từ lúc nào" (chỉ có
   *   `mastered` 0/1). Thêm cột `mastered_at` sẽ khiến MỌI bé hiện có hiện 0 từ cho MỌI khoảng
   *   trong quá khứ — sai theo hướng ngược lại, và tệ hơn: phụ huynh đọc thành "tuần này con
   *   không nhớ được từ nào". Dữ liệu lịch sử không thể suy ngược, nên giữ luỹ kế là trung thực
   *   nhất; cách sửa đúng nằm ở phần TRÌNH BÀY (nhãn), không ở dữ liệu.
   */
  private countMastered(childId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM word_progress WHERE child_id = ? AND mastered = 1')
      .get(childId) as { n: number };
    return row.n;
  }

  /**
   * Kết quả BÀI THI CUỐI KHOÁ theo từng phần — cho khối "Bài thi cuối khoá" của báo cáo.
   *
   * ⭐ ĐỌC THẲNG `final_test_attempt` (bảng của migration 013), CÙNG lối với `daily_stats` /
   *   `word_progress` ở trên: `ReportService` đã kiểm SỞ HỮU một lần rồi đọc bảng thô, KHÔNG gọi
   *   `FinalTestService` (gọi nó sẽ kéo theo cả phép tính cổng + parse hợp đồng của màn thi —
   *   thừa cho một khối báo cáo).
   *
   * ⚠️ MỘT PHẦN, MỘT HÀNG GỘP: khiên cao nhất `MAX(shields)`, số lượt `COUNT(*)`, mốc gần nhất
   *    `MAX(occurred_at)`. Ba con số này KHÔNG lọc theo khoảng ngày của báo cáo — "bài thi cuối
   *    khoá" là cột mốc MỘT LẦN của cả lộ trình, không phải hoạt động trong tuần. Cùng lý do như
   *    `wordsMastered` (luỹ kế), nên khối này phải được đặt NHÃN rõ ở client.
   *
   * ⚠️ BÉ CHƯA THI ⇒ `bestShields`/`lastAttemptAt` = `null`, KHÔNG phải `0`. "0 khiên" đọc lên
   *    như một lời chê; `null` buộc client hiện trạng thái "chưa làm" trung tính. Duyệt theo
   *    `meta.sections` (nguồn sự thật) chứ KHÔNG theo hàng trong DB, để phần bé chưa làm vẫn
   *    xuất hiện trong danh sách thay vì biến mất.
   */
  private readFinalTestSections(childId: string): FinalTestSectionStatus[] {
    const meta = getFinalTestMeta();
    if (!meta) return [];

    const rows = this.db
      .prepare(
        `SELECT section, MAX(shields) AS best, MAX(occurred_at) AS last, COUNT(*) AS n
           FROM final_test_attempt WHERE child_id = ? GROUP BY section`,
      )
      .all(childId) as FinalTestAttemptRow[];
    const bySection = new Map(rows.map((row) => [row.section, row]));

    const sections: FinalTestSectionStatus[] = meta.sections.map((summary) => {
      const attempt = bySection.get(summary.section);
      return {
        section: summary.section,
        autoScored: summary.autoScored,
        totalItems: summary.itemCount,
        bestShields: attempt ? (attempt.best as ShieldCount) : null,
        completed: attempt !== undefined,
        attempts: attempt?.n ?? 0,
        lastAttemptAt: attempt?.last ?? null,
        // Tiến độ ĐANG DỞ không thuộc báo cáo phụ huynh — xem ghi chú ở `ReportResponse.finalTest`.
        progress: null,
      };
    });

    // Parse ĐẦU RA bằng schema dùng chung với màn thi: hình dạng lệch sẽ ném Ở ĐÂY, không để
    // client nhận dữ liệu méo rồi hỏng âm thầm (cùng lối như `FinalTestService.getState`).
    return finalTestSectionStatusSchema.array().parse(sections);
  }

  /**
   * Xác nhận PHẦN NÓI của phụ huynh (TẦNG 4) cho khối "Bài thi cuối khoá" của báo cáo.
   *
   * ⭐ ĐỌC THẲNG `parent_speaking_confirm` (bảng của migration 014), CÙNG lối với
   *   `readFinalTestSections` ở trên: `ReportService` đã kiểm SỞ HỮU một lần rồi đọc bảng thô,
   *   KHÔNG gọi `ParentSpeakingService` (gọi nó sẽ kéo theo cả parse hợp đồng API — thừa cho một
   *   khối báo cáo). Việc parse `marks_json` dùng CHUNG hàm ở `shared/` với service để hai nơi
   *   không thể đọc JSON theo hai cách khác nhau.
   *
   * ⚠️ BÉ CHƯA ĐƯỢC XÁC NHẬN ⇒ `{ items: [], updatedAt: null }`, KHÔNG bịa mốc, KHÔNG bịa "0/4".
   *    Client hiện câu trung tính — "0/4" đọc lên như một lời chê.
   */
  private readParentSpeaking(childId: string): ParentSpeakingState {
    const row = this.db
      .prepare('SELECT marks_json, updated_at FROM parent_speaking_confirm WHERE child_id = ?')
      .get(childId) as { marks_json: string; updated_at: string } | undefined;

    if (!row) return { items: [], updatedAt: null };

    return parentSpeakingStateSchema.parse({
      items: parseParentSpeakingMarks(row.marks_json),
      updatedAt: row.updated_at,
    });
  }

  /**
   * Từ "còn hay nhầm": sai ≥ `STRUGGLING_MIN_WRONG` lần VÀ **chưa** nhớ chắc.
   *
   * ⚠️ `mastered = 0` là điều kiện KÉP: đúng về nghĩa ("hay nhầm" loại trừ "nhớ chắc") VÀ là thứ
   *    bảo đảm giao với `readMasteredWords` luôn RỖNG.
   */
  private readStrugglingWords(childId: string): WordAccuracyDto[] {
    const rows = this.db
      .prepare(
        `SELECT word_id, correct_count, wrong_count FROM word_progress
          WHERE child_id = ? AND mastered = 0 AND wrong_count >= ?
          ORDER BY wrong_count DESC, correct_count ASC, word_id ASC
          LIMIT ?`,
      )
      .all(childId, STRUGGLING_MIN_WRONG, REPORT_WORD_LIST_LIMIT) as WordProgressRow[];
    return this.toWordAccuracyList(rows);
  }

  /** Từ "đã nhớ chắc" — nhiều lần đúng nhất trước. */
  private readMasteredWords(childId: string): WordAccuracyDto[] {
    const rows = this.db
      .prepare(
        `SELECT word_id, correct_count, wrong_count FROM word_progress
          WHERE child_id = ? AND mastered = 1
          ORDER BY correct_count DESC, word_id ASC
          LIMIT ?`,
      )
      .all(childId, REPORT_WORD_LIST_LIMIT) as WordProgressRow[];
    return this.toWordAccuracyList(rows);
  }

  /**
   * Hàng thô ⇒ DTO, KÈM chữ của từ (tra từ chỉ mục nội dung).
   *
   * ⚠️ Từ KHÔNG còn trong nội dung (`getWordText` trả `undefined`) bị BỎ QUA, không làm hỏng báo
   *    cáo: một từ đã bị gỡ khỏi `src/data/` vẫn còn hàng trong `word_progress` của bé, và báo cáo
   *    phải mở được — chỉ là không gọi tên được từ đó. `scripts/validate-content.ts` mới là nơi
   *    bắt lỗi nội dung, lúc build.
   */
  private toWordAccuracyList(rows: WordProgressRow[]): WordAccuracyDto[] {
    const out: WordAccuracyDto[] = [];
    for (const row of rows) {
      const text = getWordText(row.word_id);
      if (!text) {
        logger.warn({ wordId: row.word_id }, 'Báo cáo: từ không có trong chỉ mục nội dung — bỏ qua');
        continue;
      }
      const total = row.correct_count + row.wrong_count;
      out.push({
        wordId: row.word_id,
        en: text.en,
        vi: text.vi,
        correctCount: row.correct_count,
        wrongCount: row.wrong_count,
        // Tỉ lệ 0–1. `total === 0` không thể xảy ra (hàng chỉ có sau một câu trả lời) nhưng vẫn
        // kẹp để một hàng rác không sinh ra `NaN` trong JSON.
        accuracy: total === 0 ? 0 : row.correct_count / total,
      });
    }
    return out;
  }

  /**
   * Câu tóm tắt cho PHỤ HUYNH đọc.
   *
   * ⚠️ LUẬT NGÔN NGỮ ÁP CHO CẢ CÂU NÀY, dù người đọc là người lớn: KHÔNG phán xét, không
   *    "kém/chưa đạt/thất bại". Lý do sâu hơn cả phép lịch sự: người đọc câu này là phụ huynh, và
   *    họ sẽ PHẢN ỨNG với con dựa trên nó. Một câu làm phụ huynh hoảng sẽ thành áp lực lên bé.
   *    Tuần bé học ít ⇒ câu TRUNG TÍNH và HƯỚNG TƯƠNG LAI, không phải một lời nhắc lỗi.
   */
  private buildSummary(input: {
    activeDays: number;
    wordsLearned: number;
    starsEarned: number;
    lessonsCompleted: number;
    strugglingCount: number;
  }): string {
    const { activeDays, wordsLearned, starsEarned, lessonsCompleted, strugglingCount } = input;

    if (activeDays === 0) {
      return (
        'Tuần này bé chưa có buổi học nào. Bố mẹ thử mở app và học cùng con vài phút nhé — ' +
        'mỗi ngày một chút là con quen dần.'
      );
    }

    const parts: string[] = [`Tuần này bé có ${activeDays} ngày học`];
    if (wordsLearned > 0) parts.push(`học thêm ${wordsLearned} từ mới`);
    if (lessonsCompleted > 0) parts.push(`hoàn thành ${lessonsCompleted} bài`);
    if (starsEarned > 0) parts.push(`nhận ${starsEarned} ngôi sao`);

    let sentence = `${parts.join(', ')}.`;
    if (strugglingCount > 0) {
      sentence += ' Có vài từ bé còn hay nhầm — bố mẹ ôn cùng con một chút sẽ rất tốt.';
    } else {
      sentence += ' Bé đang giữ nhịp đều đặn, bố mẹ yên tâm nhé!';
    }
    return sentence;
  }
}

/** Dùng chung một instance. */
export const reportService = new ReportService();
