/**
 * RubyLingo — `BadgeService`: đánh giá tiêu chí huy hiệu rồi trao (T068).
 *
 * ⭐ NHIỆM VỤ: một chỗ DUY NHẤT biết "làm sao biết bé đã xứng đáng một huy hiệu". Danh mục 18
 *   huy hiệu nằm ở `shared/content/badges.json` dưới dạng DỮ LIỆU (`BadgeCriteria`), nên thêm
 *   một huy hiệu mới KHÔNG cần một hàm mới — chỉ cần thêm một mục JSON, và `badgesFileSchema`
 *   từ chối mục sai ngay lúc nạp.
 *
 * ⭐ SERVER LÀ TRỌNG TÀI CUỐI. Client KHÔNG bao giờ gửi "tôi vừa đạt huy hiệu X". Nó chỉ gửi
 *   những SỰ THẬT THÔ (một lượt chơi, một bài đã học); service này đọc lại SỔ trong DB rồi tự
 *   quyết định. Đây là cùng nguyên tắc như `GameResultService` tự chấm lại điểm.
 *
 * ⚠️ HÀM `evaluate` PHẢI ĐƯỢC GỌI **BÊN TRONG** MỘT TRANSACTION ĐÃ MỞ (nhận `db`, KHÔNG tự mở).
 *   Người gọi điều phối nhiều bảng trong cùng một đơn vị công việc — ví dụ `GameResultService.submit`
 *   ghi lượt chơi + tiến độ + ví + XP trong MỘT transaction, và huy hiệu phải nằm trong đúng
 *   transaction đó: nếu lượt chơi rollback thì huy hiệu cũng phải rollback theo, nếu không bé sẽ
 *   có một huy hiệu cho một lượt chơi không hề được ghi.
 *
 * -----------------------------------------------------------------------------
 * HAI QUYẾT ĐỊNH CẦN HIỂU TRƯỚC KHI SỬA
 * -----------------------------------------------------------------------------
 *
 * ⚠️ 1. "HOÀN THÀNH MỘT BÀI" = `lesson_progress.completed = 1` — CÙNG định nghĩa với
 *    `QuestService`.
 *
 *    `lesson_progress` có ba cột có thể "trông như" hoàn thành: `completed`, `stars_best`,
 *    `best_score`. Chúng KHÔNG cùng nghĩa, và chọn nhầm ở đây là gieo một định nghĩa thứ hai
 *    cho một khái niệm đã có chủ:
 *
 *      • `completed = 1` — cờ "bé đã học xong bài", do `ProgressService.applyLessonCompleted`
 *        đặt khi nhận sự kiện `lesson_completed` của LUỒNG FLASHCARD. Đây là định nghĩa mà
 *        `QuestService` (nhiệm vụ `complete_lesson` / `complete_theme`) đã dùng.
 *      • `stars_best` / `best_score` — KỶ LỤC của các LƯỢT CHƠI GAME. Một lượt chơi game CỐ Ý
 *        **KHÔNG** đặt `completed = 1` (xem ghi chú "một cột, một chủ sở hữu" ở
 *        `ProgressService.applyGameScoreInTx`) — vì vậy lấy `stars_best >= 1` làm "hoàn thành"
 *        sẽ là một định nghĩa KHÁC, và sẽ khiến bé có huy hiệu "Bạn của sở thú" trong khi nhiệm
 *        vụ "Hoàn thành cả Sở thú" vẫn hiện chưa xong. Hai câu trả lời cho một sự thật.
 *
 *    ⭐ HỆ QUẢ CÓ Ý THỨC: huy hiệu "hoàn thành bài/chủ đề" được trao ở LUỒNG FLASHCARD — nơi
 *      `completed` thật sự được đặt. `ProgressService` gọi `evaluate` ngay sau khi ghi
 *      `lesson_progress`, trong cùng transaction. Luồng chơi game cũng gọi `evaluate`, nhưng ở
 *      đó nó bắt những huy hiệu KHÁC (thắng game, đủ sao, đủ cấp, đủ tiền, chuỗi ngày) — đúng
 *      loại dữ liệu mà một lượt chơi làm thay đổi.
 *
 * ⚠️ 2. `streak_days` ĐO BẰNG `streak_state.longest_streak`, **KHÔNG** PHẢI `current_streak`.
 *
 *    Huy hiệu là SƯU TẦM VĨNH VIỄN: đã đạt là không bao giờ mất. `current_streak` là một đại
 *    lượng có thể TỤT — bé đứt chuỗi là nó về 0. Nếu huy hiệu "Học 7 ngày liên tiếp" đo bằng
 *    `current_streak`, thì hôm bé đạt 7 ngày nó nổ, nhưng hôm sau bé nghỉ một ngày, lần đọc tiếp
 *    theo sẽ nói "chưa đạt" — một huy hiệu đã trao mà không còn "đúng". `longest_streak` chỉ
 *    tăng, nên nó là mốc đúng cho một thành tựu không thể thu hồi.
 *    `badge-service.test.ts` có một ca chống hồi quy riêng cho điều này (đứt chuỗi hiện tại
 *    nhưng `longest_streak` đã đủ ⇒ huy hiệu VẪN được giữ).
 *
 * ⚠️ TƯƠNG TỰ VỚI `earn_currency`: đo bằng `stars_earned_total`/`acorns_earned_total` (TỔNG đã
 *    kiếm, chỉ tăng), KHÔNG bằng số dư `wallet.stars`/`acorns` (tụt khi bé tiêu). Xem
 *    `009_wallet_lifetime.sql`.
 */

import type { BadgeCriteria } from '../../shared/types/reward.js';
import type { Db } from '../db/connection.js';
import { BADGES } from '../../shared/content/badges.js';
import { getThemeIndex } from '../../shared/content/content-index.js';
import { rewardService } from './RewardService.js';
import type { RewardService } from './RewardService.js';
import { hasCompletedFinalTest } from './finalTestCompletion.js';

// =============================================================================
// Service
// =============================================================================

export class BadgeService {
  /**
   * ⚠️ Chỉ MỘT phụ thuộc: `RewardService` — bên duy nhất được ghi vào `badge_earned`. Service
   *    này KHÔNG tự viết `INSERT INTO badge_earned`, đúng luật ở đầu `RewardService.ts`: mọi
   *    ghi vào bảng sưu tầm đều đi qua `grantBadgeInTx` (đã idempotent nhờ khoá chính), nên
   *    "trao trùng" là bất khả thi ở tầng ràng buộc, không phải ở một `if` có thể quên.
   */
  constructor(private readonly rewards: RewardService = rewardService) {}

  /**
   * Đánh giá MỌI huy hiệu trong danh mục và trao những cái bé vừa đủ điều kiện.
   *
   * Trả về id của những huy hiệu **MỚI** được trao (chỉ cái vừa vào sổ, để client ăn mừng đúng
   * một lần). Chạy lại trên cùng trạng thái ⇒ trả `[]` — nhờ `grantBadgeInTx` chống trùng.
   *
   * ⚠️ PHẢI gọi trong transaction của người gọi (xem ghi chú đầu tệp). Không kiểm quyền sở hữu:
   *    người gọi đã kiểm (nó chỉ gọi với `childId` đến từ URL của một bé thuộc phụ huynh đang
   *    đăng nhập).
   *
   * ⭐ DUYỆT **TẤT CẢ** huy hiệu mỗi lần, không lọc trước theo "sự kiện này ảnh hưởng huy hiệu
   *   nào". Cùng lý do như `QuestService.applyEventInTx`: một bảng "sự kiện nào ↔ huy hiệu nào"
   *   là thứ phải nhớ cập nhật mỗi khi thêm tiêu chí mới, và quên nó là hỏng im lặng. Danh mục
   *   chỉ 18 mục; duyệt hết là vài truy vấn chỉ mục trong một transaction SQLite.
   */
  evaluate(db: Db, childId: string, at: string): string[] {
    const newlyEarned: string[] = [];

    for (const badge of BADGES) {
      if (!this.meets(db, childId, badge.criteria)) continue;
      // `grantBadgeInTx` tự `INSERT OR IGNORE`: chỉ trả `true` khi đây là huy hiệu MỚI.
      if (this.rewards.grantBadgeInTx(db, childId, badge.id, at)) {
        newlyEarned.push(badge.id);
      }
    }

    return newlyEarned;
  }

  /** Bé có thoả một tiêu chí không. TÁM nhánh, đúng bằng tám `kind` trong `BadgeCriteria`. */
  private meets(db: Db, childId: string, criteria: BadgeCriteria): boolean {
    switch (criteria.kind) {
      case 'complete_lesson':
        return this.isLessonCompleted(db, childId, criteria.lessonId);

      case 'complete_theme': {
        /**
         * "Xong CẢ chủ đề" = xong MỌI bài, không phải xong phần lớn — cùng nghĩa với
         * `QuestService.deriveProgress` cho `complete_theme`. Một chủ đề 3 bài mà bé xong 2 bài
         * là CHƯA xong.
         *
         * ⚠️ `themeId` không có trong chỉ mục ⇒ trả `false` (coi như chưa đạt), KHÔNG ném. Nội
         *    dung được sửa theo thời gian; một huy hiệu trỏ tới chủ đề đã đổi tên chỉ nên đứng
         *    yên, chứ không được làm hỏng lượt chơi đang chạy. `scripts/validate-content.ts` là
         *    nơi bắt id gõ sai, ở thời điểm build.
         */
        const theme = getThemeIndex(criteria.themeId);
        if (!theme || theme.lessonIds.length === 0) return false;
        return theme.lessonIds.every((lessonId) => this.isLessonCompleted(db, childId, lessonId));
      }

      case 'perfect_lessons':
        return this.countPerfectLessons(db, childId) >= criteria.count;

      case 'streak_days':
        // ⚠️ `longest_streak`, KHÔNG `current_streak` — xem quyết định 2 ở đầu tệp.
        return this.readLongestStreak(db, childId) >= criteria.days;

      case 'reach_level':
        /**
         * Dùng `readXp().level` (TÍNH LẠI từ `xp` theo bảng cấp) chứ không đọc thẳng cột
         * `xp_state.level` — cùng lý do như `QuestService`: cột `level` chỉ là bản ghi đệm và có
         * thể lệch nếu `xp-levels.json` đổi sau khi bé đã có XP.
         */
        return this.rewards.readXp(db, childId).level >= criteria.level;

      case 'earn_currency':
        // ⚠️ TỔNG ĐÃ KIẾM, không phải số dư — xem quyết định 2 và `009_wallet_lifetime.sql`.
        return this.readLifetimeEarned(db, childId, criteria.currency) >= criteria.amount;

      case 'win_game':
        return this.countGameRuns(db, childId, criteria.gameType) >= criteria.count;

      /**
       * ⭐ HUY CHƯƠNG TỐT NGHIỆP (G6) — bé đã nộp đủ MỌI phần của bài thi cuối khoá.
       *
       * ⚠️ Câu hỏi này sống ở `finalTestCompletion.ts` (module lá) vì `QuestService` cũng hỏi
       *    đúng nó. Hai bản SQL cho cùng một sự thật thì sớm muộn cũng lệch.
       */
      case 'complete_final_test':
        return hasCompletedFinalTest(db, childId);
    }
  }

  /**
   * Bé đã học xong bài này chưa — định nghĩa "hoàn thành" duy nhất của dự án (xem quyết định 1).
   *
   * ⚠️ Chỉ chọn cột `completed`, KHÔNG `SELECT *`: câu truy vấn tự nói lên rằng chỉ một cột là
   *    nguồn của câu trả lời này.
   */
  private isLessonCompleted(db: Db, childId: string, lessonId: string): boolean {
    const row = db
      .prepare('SELECT completed FROM lesson_progress WHERE child_id = ? AND lesson_id = ?')
      .get(childId, lessonId) as { completed: number } | undefined;
    return row?.completed === 1;
  }

  /**
   * Số bài bé đạt ĐIỂM TUYỆT ĐỐI (3 sao).
   *
   * ⭐ `stars_best = 3` chứ không `best_score` (điểm thô): "bài hoàn hảo" theo thiết kế là ba
   *   sao. `stars_best` là KỶ LỤC và KHÔNG BAO GIỜ giảm (chơi lại kém hơn không làm mất sao —
   *   xem migration 003), nên nó đúng cho một thành tựu sưu tầm.
   */
  private countPerfectLessons(db: Db, childId: string): number {
    const row = db
      .prepare('SELECT COUNT(*) AS n FROM lesson_progress WHERE child_id = ? AND stars_best = 3')
      .get(childId) as { n: number };
    return row.n;
  }

  /**
   * Chuỗi ngày học dài nhất bé từng đạt. Hàng chưa tồn tại ⇒ 0 (bé mới, chưa từng học).
   *
   * ⚠️ Đây là đại lượng CHỈ TĂNG: đứt chuỗi hiện tại làm `current_streak` về 0 nhưng KHÔNG đụng
   *    tới `longest_streak` — nên huy hiệu đã đạt không bao giờ bị đọc thành "chưa đạt".
   */
  private readLongestStreak(db: Db, childId: string): number {
    const row = db
      .prepare('SELECT longest_streak FROM streak_state WHERE child_id = ?')
      .get(childId) as { longest_streak: number } | undefined;
    return row?.longest_streak ?? 0;
  }

  /**
   * TỔNG tiền tệ bé đã kiếm trong cả đời (chỉ tăng). Hàng ví chưa tồn tại ⇒ 0.
   *
   * ⭐ Tên cột lấy từ ĐÚNG hai giá trị của `CurrencyKind` (union đóng), nên không có đường nào
   *   chèn một chuỗi lạ vào câu SQL.
   */
  private readLifetimeEarned(db: Db, childId: string, currency: 'stars' | 'acorns'): number {
    const column = currency === 'stars' ? 'stars_earned_total' : 'acorns_earned_total';
    const row = db
      .prepare(`SELECT ${column} AS total FROM wallet WHERE child_id = ?`)
      .get(childId) as { total: number } | undefined;
    return row?.total ?? 0;
  }

  /**
   * Số LƯỢT chơi một loại game (không xét thắng/thua).
   *
   * ⭐ VÌ SAO ĐẾM LƯỢT CHƠI, KHÔNG ĐÒI "THẮNG": mô tả huy hiệu là "Chơi giỏi game Nghe & Chạm
   *   20 lần" / "Thắng 10 lượt Lật thẻ". Trong hệ thống này mọi lượt chơi gửi lên đều đã là một
   *   lượt HOÀN THÀNH (có ≥1 sao — xem ràng buộc cứng ở `shared/game-scoring.ts`, không có lượt
   *   0 sao). Thêm một ngưỡng "thắng" nữa sẽ là một định nghĩa thứ hai có thể lệch với số liệu
   *   mà báo cáo phụ huynh hiển thị. Đếm theo `game_type` là đúng con số migration 003 đã ghi
   *   mục đích ("đếm 'thắng N lượt game X' cho huy hiệu").
   */
  private countGameRuns(db: Db, childId: string, gameType: string): number {
    const row = db
      .prepare('SELECT COUNT(*) AS n FROM game_result WHERE child_id = ? AND game_type = ?')
      .get(childId, gameType) as { n: number };
    return row.n;
  }
}

/** Dùng chung một instance. */
export const badgeService = new BadgeService();
