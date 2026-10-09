/**
 * RubyLingo — QuestService (server): tiến độ nhiệm vụ theo KỲ + "Nhận thưởng" (T058).
 *
 * ⭐ RESET NHIỆM VỤ NGÀY/TUẦN **KHÔNG CẦN CRON**:
 *   Mỗi hàng `quest_progress` mang `period_key` của kỳ nó thuộc về
 *   (`daily → "2026-10-06"`, `weekly → "2026-W41"`, `milestone → "all"`). Khi truy vấn, server
 *   tự suy ra khoá kỳ HIỆN TẠI rồi lọc theo nó ⇒ hàng của kỳ cũ tự nhiên không khớp. Không có
 *   job dọn dẹp, không có trạng thái "quên reset" nào tồn tại.
 *
 * -----------------------------------------------------------------------------
 * BỐN QUYẾT ĐỊNH CẦN HIỂU TRƯỚC KHI SỬA
 * -----------------------------------------------------------------------------
 *
 * ⚠️ 1. HAI LOẠI TIÊU CHÍ, HAI CÁCH TÍNH — VÀ CHÚNG KHÔNG ĐƯỢC LẪN VÀO NHAU.
 *
 *   • ĐẾM (`complete_lessons`, `play_games`, `correct_answers`): `progress` CỘNG DỒN theo sự
 *     kiện. Không thể suy lại từ dữ liệu hiện có: `word_progress.correct_count` là con số CẢ ĐỜI
 *     (không tách được "tuần này"), còn `daily_stats` chỉ có số theo NGÀY. Muốn biết "tuần này bé
 *     trả lời đúng bao nhiêu câu" thì phải có ai đó đếm lúc sự kiện xảy ra.
 *   • SUY DIỄN (`complete_lesson`, `complete_theme`, `learn_days`, `unlock_theme`,
 *     `collect_stickers`, `reach_level`): `progress` được TÍNH LẠI từ dữ liệu bền vững mỗi lần
 *     đọc/ghi, KHÔNG cộng dồn.
 *
 *   Lẫn hai cách là nguồn của hai lỗi im lặng: một tiêu chí đếm bị "suy diễn" sẽ dùng con số cả
 *   đời làm tiến độ tuần; một tiêu chí suy diễn bị "cộng dồn" sẽ đúng lên gấp nhiều lần mỗi khi
 *   client gửi lại một sự kiện.
 *
 * ⚠️ 2. `completed` DÍNH TRONG KỲ — KHÔNG BAO GIỜ QUAY VỀ `false`.
 *   Một khi nhiệm vụ đã xong, nó ở trạng thái xong cho tới hết kỳ. Lý do không phải cho đẹp:
 *   `claimed = true` chỉ có thể tồn tại cùng `completed = true`, nên nếu `completed` có thể tụt
 *   thì sẽ có hàng mang "đã nhận thưởng nhưng chưa hoàn thành" — một trạng thái vô nghĩa, và
 *   không có cách nào sửa mà không lấy lại quà của bé.
 *   Luật này nằm ở `combineQuestProgress()` — hàm THUẦN, kiểm được không cần DB.
 *
 * ⚠️ 3. `claimed` LÀ CỔNG CHỐNG NHẬN HAI LẦN, VÀ NÓ NẰM TRONG `WHERE`.
 *   Điều kiện "chưa nhận" là một phần của câu `UPDATE` (`AND claimed = 0`), không phải một
 *   `if` ở tầng JS đọc-rồi-ghi. Cùng lý do như `RewardService.spendInTx`: nếu kiểm ở JS thì hai
 *   lần bấm gần nhau có thể cùng đọc `claimed = 0` và cùng trao quà. `changes === 0` nghĩa là
 *   *có người khác đã nhận trước* ⇒ `ALREADY_CLAIMED`.
 *
 * ⚠️ 4. NHIỆM VỤ MỐC (`milestone`) DÙNG `period_key = 'all'` ⇒ KHÔNG BAO GIỜ RESET.
 *   Chúng là thành tựu một lần trong đời hồ sơ bé. Vì hàng không bao giờ hết hạn, `completed`
 *   cũng vĩnh viễn — đúng ý nghĩa "mốc".
 *
 * -----------------------------------------------------------------------------
 * VÌ SAO CÓ HAI HÀM NỘI BỘ NHÌN GẦN GIỐNG NHAU: `readForChild` và `advanceQuest`
 * -----------------------------------------------------------------------------
 *   `readForChild` KHÔNG GHI GÌ (dùng cho GET). Nó tính tiến độ hiệu dụng = `max(hàng đã lưu,
 *   giá trị suy diễn)`, nhờ vậy màn hình Nhiệm vụ luôn đúng kể cả khi hàng chưa từng được tạo —
 *   ví dụ bé đã học 3 ngày nhưng chưa có sự kiện nào tạo hàng cho nhiệm vụ "học 4 ngày".
 *   `advanceQuest` GHI hàng, và được gọi cho MỌI sự kiện (xem `applyEventInTx`).
 *   Gộp hai hàm làm một sẽ buộc GET phải ghi — tức là một thao tác chỉ-đọc lại có thể sinh
 *   hàng mới, và mọi lỗi ghi sẽ hiện ra ở màn hình bé đang mở.
 */

import type { Db } from '../db/connection.js';
import { getDb, transaction } from '../db/connection.js';
import { localDateKey, periodKeyForTier, weeklyPeriodKey, dailyPeriodKey } from '../lib/time.js';
import { errors } from '../plugins/errors.js';
import { childService } from './ChildService.js';
import type { ChildService } from './ChildService.js';
import { rewardService } from './RewardService.js';
import type { RewardService } from './RewardService.js';
import { xpService } from './XpService.js';
import type { XpService } from './XpService.js';
/**
 * ⚠️ Câu SQL ghi `daily_stats` nằm ở MODULE LÁ `dailyStats.ts`, và `QuestService` KHÔNG được
 *    `import` `ProgressService`. Chi tiết + hậu quả thật của việc vi phạm: xem ghi chú đầu
 *    `dailyStats.ts`. Tóm tắt: `ProgressService` cần gọi `QuestService` (báo "bé vừa xong một
 *    bài"), nên chiều ngược lại sẽ tạo vòng import ⇒ singleton rơi vào vùng tạm ⇒ server không
 *    khởi động được.
 */
import { applyDailyStatInTx } from './dailyStats.js';
import { activeQuests, getQuest, questTarget } from '../../shared/content/quests.js';
import { splitRewards, toRewardBundle } from '../../shared/content/rewards.js';
import { DEFAULT_CONTENT_LEVEL_ID, getThemeIndex, themeIdsWithGames } from '../../shared/content/content-index.js';
import type { ClaimQuestResponse, QuestsGetResponse } from '../../shared/types/api.js';
import type { QuestCriteria, QuestDefinition, QuestWithProgress } from '../../shared/types/reward.js';

// =============================================================================
// Sự kiện mà QuestService hiểu
// =============================================================================

/**
 * Một sự kiện có thể làm tiến độ nhiệm vụ thay đổi.
 *
 * ⚠️ HÌNH DẠNG NÀY DO SERVER ĐỊNH NGHĨA, KHÔNG PHẢI CLIENT GỬI LÊN.
 *   Không route nào nhận `QuestEvent` từ body. Chúng chỉ được dựng ở những chỗ mà server ĐÃ
 *   kiểm chứng sự thật rồi mới dựng:
 *     • `ProgressService.applyEventOnce` — sau khi `progress_event` chấp nhận sự kiện
 *       (`lesson_completed`).
 *     • `GameResultService.submit` — sau khi hàng `game_result` với `client_event_id` mới đã
 *       được chèn (cổng chống ghi trùng).
 *   Nếu để client gửi `QuestEvent`, bé chỉ cần gửi `{"kind":"game_played","count":999}` là xong
 *   nhiệm vụ mà không chơi gì — đúng thứ kiến trúc "server là trọng tài cuối" sinh ra để chặn.
 */
export type QuestEvent =
  /** Bé vừa hoàn thành một bài (đã ghi `lesson_progress` TRƯỚC khi bắn sự kiện này). */
  | { kind: 'lesson_completed'; lessonId: string }
  /** Bé vừa chơi xong một ván game. `count` mặc định 1. */
  | { kind: 'game_played'; count?: number }
  /** Bé vừa trả lời đúng `count` câu NGAY LẦN ĐẦU trong một ván. */
  | { kind: 'correct_answers'; count: number };

// =============================================================================
// Luật THUẦN (không DB) — kiểm được trong vài mili giây
// =============================================================================

/** Tiêu chí nào là ĐẾM (cộng dồn theo sự kiện) — xem quyết định 1. */
export function isCounterCriteria(criteria: QuestCriteria): boolean {
  return (
    criteria.kind === 'complete_lessons' ||
    criteria.kind === 'play_games' ||
    criteria.kind === 'correct_answers'
  );
}

/**
 * Sự kiện này cộng thêm bao nhiêu vào một tiêu chí ĐẾM. `0` cho mọi trường hợp khác.
 *
 * ⭐ Hàm thuần tách riêng để `tests/unit/server/quest-service.test.ts` khoá được ma trận
 *   "sự kiện × tiêu chí" mà không cần dựng DB — và để chỉ có MỘT chỗ quyết định việc này.
 */
export function questEventDelta(criteria: QuestCriteria, event: QuestEvent): number {
  switch (criteria.kind) {
    case 'complete_lessons':
      return event.kind === 'lesson_completed' ? 1 : 0;
    case 'play_games':
      return event.kind === 'game_played' ? Math.max(0, Math.trunc(event.count ?? 1)) : 0;
    case 'correct_answers':
      return event.kind === 'correct_answers' ? Math.max(0, Math.trunc(event.count)) : 0;
    default:
      return 0;
  }
}

/**
 * Luật gộp DUY NHẤT của tiến độ nhiệm vụ (thuần).
 *
 * @param derived `null` khi tiêu chí là ĐẾM (khi đó dùng `prevProgress + delta`).
 *                Ngược lại là giá trị TÍNH LẠI từ dữ liệu — xem quyết định 1.
 *
 * ⚠️ Vì sao nhiệm vụ suy diễn lấy `max(prev, derived)` chứ không lấy thẳng `derived`:
 *    một sự kiện đến MUỘN (bé chơi offline hôm qua, hôm nay mới có mạng) có thể làm giá trị suy
 *    diễn NHỎ HƠN hàng đã lưu của kỳ này — ví dụ `learn_days` đếm theo `period_key` hiện tại
 *    trong khi hàng được ghi bởi sự kiện của kỳ trước. Lấy `max` bảo đảm tiến độ của kỳ không
 *    bao giờ tụt, và `completed` của kỳ không bao giờ bị "chữa lành ngược".
 */
export function combineQuestProgress(input: {
  target: number;
  prevProgress: number;
  prevCompleted: boolean;
  delta: number;
  derived: number | null;
}): { progress: number; completed: boolean } {
  const raw =
    input.derived === null
      ? Math.max(0, input.prevProgress) + input.delta
      : Math.max(Math.max(0, input.prevProgress), input.derived);
  const progress = Math.max(0, Math.trunc(raw));
  return { progress, completed: input.prevCompleted || progress >= input.target };
}

// =============================================================================
// Hình dạng hàng trong DB
// =============================================================================

interface QuestRow {
  child_id: string;
  quest_id: string;
  period_key: string;
  progress: number;
  target: number;
  completed: number;
  claimed: number;
  claimed_at: string | null;
  updated_at: string;
}

// =============================================================================
// Service
// =============================================================================

export class QuestService {
  /**
   * ⚠️ BỐN phụ thuộc, và KHÔNG có phụ thuộc nào trỏ tới `ProgressService` — xem ghi chú đầu file.
   *
   * `rewards` đọc được ví/XP/sticker (và trao quà khi claim); `xp` là ĐƯỜNG DUY NHẤT cộng XP;
   * `children` để kiểm quyền sở hữu ở hai phương thức công khai.
   */
  constructor(
    private readonly db: Db = getDb(),
    private readonly children: ChildService = childService,
    private readonly rewards: RewardService = rewardService,
    private readonly xp: XpService = xpService,
  ) {}

  // ===========================================================================
  // API công khai
  // ===========================================================================

  /**
   * Toàn bộ dữ liệu cho màn hình Nhiệm vụ (M9): danh sách nhiệm vụ + chuỗi ngày + khoá kỳ.
   *
   * `childId` đến từ URL ⇒ PHẢI kiểm quyền sở hữu trước khi trả bất cứ thứ gì.
   */
  listForChild(parentId: string, childId: string, now: Date = new Date()): QuestsGetResponse {
    this.requireChild(parentId, childId);

    return {
      quests: this.readForChild(this.db, childId, now),
      streak: this.rewards.readStreak(this.db, childId),
      periodKeys: { daily: dailyPeriodKey(now), weekly: weeklyPeriodKey(now) },
    };
  }

  /**
   * Bé bấm "Nhận thưởng". **Server quyết định**, không tin bất cứ con số nào từ client.
   *
   * Trả về nhiệm vụ sau khi nhận + ví + XP + (nếu có) lên cấp. `levelUp` PHẢI được trả vì một
   * nhiệm vụ thưởng XP có thể đẩy bé qua cấp — mà mỗi cấp có quà riêng trong `xp-levels.json`.
   * Bỏ trường này thì quà vẫn được trao (đúng) nhưng bé không bao giờ thấy màn ăn mừng (sai) —
   * và không ai phát hiện, vì ví vẫn tăng.
   */
  claim(
    parentId: string,
    childId: string,
    questId: string,
    now: Date = new Date(),
  ): ClaimQuestResponse {
    const quest = getQuest(questId);
    if (!quest) throw errors.questNotFound();

    this.requireChild(parentId, childId);

    /**
     * ⚠️ MỘT ĐỒNG HỒ DUY NHẤT: mọi mốc thời gian của lượt nhận này đến từ `now`, KHÔNG từ
     *    `nowIso()`.
     *
     *    Trước đây chỗ này gọi `nowIso()` trong khi khoá kỳ tính bằng `now` — hai nguồn thời
     *    gian cho cùng một sự việc. Ở production chúng trùng nhau (mặc định `now = new Date()`)
     *    nên không ai thấy; nhưng nó khiến tham số `now` chỉ điều khiển được MỘT NỬA hệ quả, và
     *    bất kỳ ai truyền `now` khác đồng hồ thật (test, nhập lại dữ liệu) sẽ ghi ra hàng
     *    `daily_stats` mang ngày của `now` nhưng `updated_at` của hôm nay — một hàng tự mâu thuẫn.
     */
    const at = now.toISOString();

    return transaction((db) => {
      const periodKey = periodKeyForTier(quest.tier, now);
      const effective = this.effectiveState(db, childId, quest, periodKey);

      // Thứ tự hai lần kiểm này quan trọng: "đã nhận" phải được kiểm TRƯỚC "chưa xong", vì một
      // nhiệm vụ đã nhận rồi thì câu đúng là "nhận rồi", không phải "chưa hoàn thành".
      if (effective.claimed) throw errors.alreadyClaimed();
      if (!effective.completed) throw errors.questNotComplete();

      /**
       * Ghi hàng TRƯỚC khi claim. Cần thiết vì `effectiveState` suy diễn được "đã xong" ngay cả
       * khi hàng chưa tồn tại (bé đã làm việc đó từ lâu, chưa từng có sự kiện nào tạo hàng —
       * ví dụ nhiệm vụ mốc `complete_lesson`). Không ghi trước thì câu `UPDATE` bên dưới khớp
       * 0 hàng và ta sẽ báo `ALREADY_CLAIMED` cho một nhiệm vụ chưa ai nhận — một lời nói sai.
       */
      this.writeQuestRow(db, childId, quest, periodKey, effective.progress, at);

      // ⚠️ CỔNG CHỐNG NHẬN HAI LẦN NẰM TRONG `WHERE` — xem quyết định 3.
      const gate = db
        .prepare(
          `UPDATE quest_progress SET claimed = 1, claimed_at = ?, updated_at = ?
             WHERE child_id = ? AND quest_id = ? AND period_key = ? AND claimed = 0`,
        )
        .run(at, at, childId, questId, periodKey);

      if (gate.changes === 0) throw errors.alreadyClaimed();

      // --- Trao quà ---------------------------------------------------------
      const split = splitRewards(quest.rewards);

      // ⭐ XP KHÔNG đi qua `applyGrantsInTx` — `toRewardBundle` cố tình bỏ nó. Xem quyết định 2
      //   ở đầu `RewardService.ts`. Đường duy nhất cộng XP là `XpService.addXpInTx`.
      const applied = this.rewards.applyGrantsInTx(db, childId, toRewardBundle(split), at);
      const xpGain = this.xp.addXpInTx(db, childId, split.xp, at);

      /**
       * ⭐ Ghi vào `daily_stats` SỐ THỰC SỰ ĐƯỢC TRAO (kể cả quà lên cấp vừa kích hoạt).
       *
       * ⚠️ Vì sao không quên được: `daily_stats` là NGUỒN DUY NHẤT của báo cáo phụ huynh. Quà
       *    nhiệm vụ mà không vào đây thì phụ huynh mở báo cáo thấy tổng ⭐ nhỏ hơn số dư trong
       *    ví — hai con số nói về cùng một thứ mà lệch nhau, và không ai tin được con số nào.
       *
       * ⚠️ Mọi delta HỌC TẬP là 0: bấm "Nhận thưởng" không phải là học. Hệ quả có chủ ý: hàng
       *    `daily_stats` sinh ra ở đây có thể toàn số 0, và `learn_days` PHẢI bỏ qua những ngày
       *    như vậy — xem `collectActiveDateKeys()`.
       */
      applyDailyStatInTx(
        db,
        childId,
        localDateKey(now),
        {
          wordsLearned: 0,
          questionsAnswered: 0,
          correctCount: 0,
          activeSeconds: 0,
          starsEarned: applied.starsGained + xpGain.rewards.starsGained,
          acornsEarned: applied.acornsGained + xpGain.rewards.acornsGained,
          xpEarned: xpGain.xpGained,
        },
        at,
      );

      return {
        quest: {
          ...quest,
          progress: effective.progress,
          target: questTarget(quest.criteria),
          completed: true,
          claimed: true,
        },
        wallet: this.rewards.readWallet(db, childId),
        xp: this.rewards.readXp(db, childId),
        levelUp: xpGain.levelUp,
        /**
         * ⭐ HAI NGUỒN HUY HIỆU, KHÔNG PHẢI MỘT: quà của nhiệm vụ (`applied`) VÀ quà của
         *    (các) cấp vừa vượt (`xpGain.rewards`).
         *
         *    Chỉ lấy `applied.badgeIds` là BỎ SÓT đúng ca mà `levelUp` sinh ra để phục vụ: nhiệm
         *    vụ thưởng XP đẩy bé qua cấp, cấp đó có huy hiệu riêng — huy hiệu vào sổ đúng đắn
         *    nhưng không bao giờ được thông báo, vì ví và XP vẫn tăng như mong đợi nên không ai
         *    nghi ngờ gì. `new Set` chỉ để chắc chắn: hai đường này trao tuần tự trong cùng
         *    transaction nên trên thực tế rời nhau, nhưng một huy hiệu xuất hiện hai lần trong
         *    thông báo là ăn mừng hai lần cho cùng một thứ.
         */
        badgesEarned: [...new Set([...applied.badgeIds, ...xpGain.rewards.badgeIds])],
        /**
         * ⭐ STICKER MỚI MỞ (T069.1) — cùng luật "HAI NGUỒN" như `badgesEarned` ngay trên: quà
         *    của nhiệm vụ (`applied`) VÀ quà của (các) cấp vừa vượt (`xpGain.rewards`). Hôm nay
         *    `xp-levels.json` chưa trao sticker nào, nhưng gộp cả hai để trường này KHÔNG lệch
         *    khỏi `badgesEarned` khi ai đó thêm sticker vào quà lên cấp — và để có một chỗ duy
         *    nhất định nghĩa "sticker vừa mở trong lượt nhận".
         */
        stickerIds: [...new Set([...applied.stickerIds, ...xpGain.rewards.stickerIds])],
      };
    });
  }

  /**
   * Áp MỘT sự kiện lên tiến độ của MỌI nhiệm vụ, và trả về id những nhiệm vụ VỪA XONG.
   *
   * ⚠️ KHÔNG kiểm quyền sở hữu và KHÔNG tự mở transaction: hàm này chỉ được gọi từ bên trong
   *    transaction của một service khác, nơi quyền đã được kiểm và nơi "hoặc tất cả, hoặc không
   *    gì" đã được thiết lập. Nhận `db` làm tham số đầu để buộc người gọi phải đang ở trong
   *    một transaction (họ phải có `db` để truyền vào).
   *
   * ⚠️ DUYỆT **TẤT CẢ** nhiệm vụ, không chỉ những cái "liên quan tới sự kiện này".
   *    Lọc trước theo `kind` nghe có vẻ tối ưu, nhưng nó bỏ sót đúng những nhiệm vụ SUY DIỄN:
   *    `complete_theme` không nhận sự kiện riêng nào — nó xong nhờ một `lesson_completed` bình
   *    thường. Danh mục có 11 nhiệm vụ; duyệt hết là một vòng lặp 11 phần tử trong một
   *    transaction SQLite. Đổi lại: không có danh sách "sự kiện nào ảnh hưởng nhiệm vụ nào"
   *    để mà quên cập nhật khi thêm tiêu chí mới.
   */
  applyEventInTx(db: Db, childId: string, event: QuestEvent, at: string): string[] {
    const newlyCompleted: string[] = [];

    for (const quest of activeQuests()) {
      const periodKey = periodKeyForTier(quest.tier, new Date(at));
      const becameCompleted = this.advanceQuest(db, childId, quest, periodKey, event, at);
      if (becameCompleted) newlyCompleted.push(quest.id);
    }

    return newlyCompleted;
  }

  /**
   * Danh sách nhiệm vụ kèm tiến độ hiệu dụng — KHÔNG GHI GÌ (dùng cho GET).
   *
   * Công khai để route và test dùng lại; `db` là tham số đầu vì route có thể đang ở trong một
   * transaction đọc.
   */
  readForChild(db: Db, childId: string, now: Date = new Date()): QuestWithProgress[] {
    return activeQuests().map((quest) => {
      const periodKey = periodKeyForTier(quest.tier, now);
      const effective = this.effectiveState(db, childId, quest, periodKey);

      return {
        ...quest,
        progress: effective.progress,
        target: questTarget(quest.criteria),
        completed: effective.completed,
        claimed: effective.claimed,
      };
    });
  }

  // ===========================================================================
  // Nội bộ — đọc
  // ===========================================================================

  /** Kiểm quyền sở hữu. Ném `CHILD_NOT_FOUND` nếu không phải con của phụ huynh này. */
  private requireChild(parentId: string, childId: string): void {
    if (!this.children.getChild(parentId, childId)) throw errors.childNotFound();
  }

  private readRow(db: Db, childId: string, questId: string, periodKey: string): QuestRow | undefined {
    return db
      .prepare(
        `SELECT * FROM quest_progress WHERE child_id = ? AND quest_id = ? AND period_key = ?`,
      )
      .get(childId, questId, periodKey) as QuestRow | undefined;
  }

  /**
   * Tiến độ HIỆU DỤNG của một nhiệm vụ trong một kỳ: `max(hàng đã lưu, giá trị suy diễn)`.
   *
   * ⚠️ Không ghi. `readForChild` và `claim` đều dùng hàm này, nên "thế nào là xong" chỉ được
   *    định nghĩa ở ĐÚNG MỘT CHỖ — nếu `claim` tự tính lại theo cách khác thì sẽ có nhiệm vụ
   *    hiện "3/3" trên màn hình mà nút "Nhận thưởng" báo `QUEST_NOT_COMPLETE`.
   */
  private effectiveState(
    db: Db,
    childId: string,
    quest: QuestDefinition,
    periodKey: string,
  ): { progress: number; completed: boolean; claimed: boolean } {
    const row = this.readRow(db, childId, quest.id, periodKey);
    const target = questTarget(quest.criteria);

    const derived = isCounterCriteria(quest.criteria)
      ? null
      : this.deriveProgress(db, childId, quest, periodKey);

    const base = combineQuestProgress({
      target,
      prevProgress: row?.progress ?? 0,
      prevCompleted: row ? row.completed !== 0 : false,
      delta: 0,
      derived,
    });

    return { progress: base.progress, completed: base.completed, claimed: row?.claimed === 1 };
  }

  // ===========================================================================
  // Nội bộ — ghi
  // ===========================================================================

  /**
   * Đẩy tiến độ một nhiệm vụ theo sự kiện. Trả `true` nếu nhiệm vụ VỪA xong (để `applyEventInTx`
   * báo cho bé biết có gì đó vừa hoàn thành — và CHỈ lần đầu, không phải mọi lần sau).
   *
   * Ghi hàng chỉ khi có gì đó thay đổi: nhiều sự kiện (vd `correct_answers`) không đụng tới
   * nhiệm vụ nào, và một câu `UPDATE` vô nghĩa cho mỗi nhiệm vụ trên mỗi sự kiện là công vô ích
   * làm hàng `updated_at` nhảy liên tục.
   */
  private advanceQuest(
    db: Db,
    childId: string,
    quest: QuestDefinition,
    periodKey: string,
    event: QuestEvent,
    at: string,
  ): boolean {
    const row = this.readRow(db, childId, quest.id, periodKey);
    const prevProgress = row?.progress ?? 0;
    const prevCompleted = row ? row.completed !== 0 : false;
    const target = questTarget(quest.criteria);

    const counter = isCounterCriteria(quest.criteria);
    const next = combineQuestProgress({
      target,
      prevProgress,
      prevCompleted,
      delta: questEventDelta(quest.criteria, event),
      derived: counter ? null : this.deriveProgress(db, childId, quest, periodKey),
    });

    const becameCompleted = next.completed && !prevCompleted;
    const changed = next.progress !== prevProgress || next.completed !== prevCompleted;

    if (changed || !row) {
      this.writeQuestRow(db, childId, quest, periodKey, next.progress, at);
    }

    return becameCompleted;
  }

  /**
   * UPSERT một hàng `quest_progress`.
   *
   * ⚠️ `claimed` / `claimed_at` KHÔNG có trong mệnh đề `DO UPDATE`. Nếu chúng có mặt ở đó (kể cả
   *    với giá trị "đúng"), thì bất kỳ sự kiện nào xảy ra sau khi bé nhận thưởng cũng ghi lại
   *    hàng đó — và chỉ cần một lần ai đó tính nhầm `claimed` thành `0`/`NULL` là bé mất dấu
   *    "đã nhận", rồi nhận được quà lần hai. Quyền sửa `claimed` chỉ thuộc về `claim()`.
   */
  private writeQuestRow(
    db: Db,
    childId: string,
    quest: QuestDefinition,
    periodKey: string,
    progress: number,
    at: string,
  ): void {
    db.prepare(
      `INSERT INTO quest_progress
         (child_id, quest_id, period_key, progress, target, completed, claimed, claimed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?)
       ON CONFLICT (child_id, quest_id, period_key) DO UPDATE SET
         progress   = excluded.progress,
         target     = excluded.target,
         completed  = excluded.completed,
         updated_at = excluded.updated_at`,
    ).run(
      childId,
      quest.id,
      periodKey,
      Math.max(0, Math.trunc(progress)),
      questTarget(quest.criteria),
      progress >= questTarget(quest.criteria) ? 1 : 0,
      at,
    );
  }

  // ===========================================================================
  // Nội bộ — suy diễn tiến độ
  // ===========================================================================

  /**
   * Tính LẠI tiến độ của một nhiệm vụ SUY DIỄN từ dữ liệu bền vững (quyết định 1).
   *
   * ⚠️ KHÔNG gọi hàm này cho tiêu chí ĐẾM: các nhánh `default` trả 0, và trả 0 cho một nhiệm vụ
   *    đếm sẽ XOÁ tiến độ đã cộng (`max(prev, 0)` thì không, nhưng nếu ai đó đổi sang lấy thẳng
   *    `derived` thì có). `isCounterCriteria` là cổng chặn — xem hai chỗ gọi.
   *
   * ⚠️ Một `themeId`/`lessonId` không còn trong chỉ mục nội dung KHÔNG phải lỗi ở đây: nội dung
   *    được sửa theo thời gian (một chủ đề có thể bị đổi tên), và một nhiệm vụ trỏ tới chủ đề đã
   *    biến mất chỉ nên đứng yên. `scripts/validate-content.ts` (V16b) là nơi bắt lỗi gõ sai id,
   *    ở thời điểm build — không phải lúc bé đang chơi.
   */
  private deriveProgress(
    db: Db,
    childId: string,
    quest: QuestDefinition,
    periodKey: string,
  ): number {
    const criteria = quest.criteria;

    switch (criteria.kind) {
      case 'complete_lesson':
        return this.isLessonCompleted(db, childId, criteria.lessonId) ? 1 : 0;

      case 'complete_theme': {
        const theme = getThemeIndex(criteria.themeId);
        if (!theme || theme.lessonIds.length === 0) return 0;
        const done = theme.lessonIds.reduce(
          (count, lessonId) => count + (this.isLessonCompleted(db, childId, lessonId) ? 1 : 0),
          0,
        );
        // "Hoàn thành cả chủ đề" = xong MỌI bài, không phải xong phần lớn. Một chủ đề 3 bài mà
        // bé xong 2 bài là chưa xong — và thanh tiến độ đã nói điều đó.
        return done >= theme.lessonIds.length ? 1 : 0;
      }

      case 'reach_level':
        // `progress` và `target` cùng đơn vị (CẤP với CẤP) — xem ghi chú ở `questTarget`.
        return this.rewards.readXp(db, childId).level;

      case 'collect_stickers':
        return this.rewards.readStickerIds(db, childId).length;

      case 'learn_days':
        return this.countLearnDays(db, childId, quest, periodKey);

      case 'unlock_theme':
        return this.countPlayableThemes();

      default:
        return 0;
    }
  }

  private isLessonCompleted(db: Db, childId: string, lessonId: string): boolean {
    const row = db
      .prepare('SELECT completed FROM lesson_progress WHERE child_id = ? AND lesson_id = ?')
      .get(childId, lessonId) as { completed: number } | undefined;
    return row?.completed === 1;
  }

  /**
   * Số NGÀY có hoạt động HỌC trong kỳ hiện tại.
   *
   * ⚠️ HAI NGUỒN, VÀ PHẢI LÀ CẢ HAI:
   *   • `daily_stats` — có số câu hỏi/thời gian hoạt động. Đây là nguồn của những ngày bé CHƠI GAME.
   *   • `progress_event.occurred_at` — nhật ký sự kiện từ `ProgressService.sync`. Đây là nguồn
   *     của những ngày bé chỉ HỌC THẺ TỪ: một buổi flashcard không ghi `daily_stats` (không có
   *     ván game nào để tổng kết), nên nếu chỉ nhìn `daily_stats` thì "học 4 ngày trong tuần"
   *     sẽ không bao giờ tính được một ngày học thẻ — nhiệm vụ tuần thành ra chỉ đếm được game.
   *
   * ⚠️ BỎ QUA hàng `daily_stats` toàn số 0: `QuestService.claim` ghi một hàng như vậy mỗi lần
   *    bé bấm "Nhận thưởng" (để số ⭐ của báo cáo phụ huynh khớp ví). Bấm nhận quà không phải là
   *    học, nên nếu tính nó là một "ngày học", bé chỉ cần mở app bấm quà 4 ngày là xong nhiệm vụ
   *    "Học 4 ngày trong tuần" mà không học gì.
   */
  private countLearnDays(db: Db, childId: string, quest: QuestDefinition, periodKey: string): number {
    const dateKeys = new Set<string>();

    const days = db
      .prepare(
        `SELECT date, words_learned, questions_answered, active_seconds
           FROM daily_stats WHERE child_id = ?`,
      )
      .all(childId) as Array<{
      date: string;
      words_learned: number;
      questions_answered: number;
      active_seconds: number;
    }>;

    for (const day of days) {
      const hasLearning = day.words_learned > 0 || day.questions_answered > 0 || day.active_seconds > 0;
      if (hasLearning) dateKeys.add(day.date);
    }

    const events = db
      .prepare('SELECT DISTINCT occurred_at FROM progress_event WHERE child_id = ?')
      .all(childId) as Array<{ occurred_at: string }>;
    for (const event of events) dateKeys.add(localDateKey(new Date(event.occurred_at)));

    let count = 0;
    for (const dateKey of dateKeys) {
      // `T00:00:00Z` để các thành phần UTC của `Date` đúng bằng ngày trên lịch — `weeklyPeriodKey`
      // đọc thành phần UTC, còn `localDateKey` cộng thêm 7 giờ (vẫn cùng ngày).
      if (periodKeyForTier(quest.tier, new Date(`${dateKey}T00:00:00Z`)) === periodKey) count += 1;
    }
    return count;
  }

  /**
   * Số chủ đề bé ĐANG CÓ THỂ CHƠI (chủ đề đã có bài tập game).
   *
   * ⭐ VÌ SAO LÀ "CÓ GAME", KHÔNG PHẢI "MỞ ĐƯỢC":
   *   Theo `shared/theme-access.ts`, một chủ đề `coming_soon` mà ĐÃ CÓ từ vựng vẫn vào được ở
   *   trạng thái `study` — nó mở sẵn từ đầu. Vậy "mở khoá" một chủ đề chỉ có từ vựng không phải
   *   một thành tích: bé không làm gì để được nó. Thứ thực sự được "mở" là phần CHƠI ĐƯỢC
   *   (có exercise), và đó là điều nhiệm vụ "Mở khoá 1 chủ đề mới" muốn nói.
   *
   * ⚠️ Đây là con số LUỸ KẾ theo nội dung: nội dung Starters hiện tại có đúng 1 chủ đề có game
   *    (`at-the-zoo`), nên nhiệm vụ tuần này xong ngay khi nó được tính lần đầu trong kỳ. Khi
   *    thêm game cho các chủ đề khác, ngưỡng sẽ tự nhiên có ý nghĩa hơn. Chấp nhận có ý thức:
   *    cách còn lại (đánh dấu "mở khoá lúc nào") sẽ tạo ra NGUỒN CHÂN LÝ THỨ HAI cho khái niệm
   *    "đã mở khoá" — mà `theme_progress` đã tồn tại đúng cho việc đó và hiện không ai ghi.
   */
  private countPlayableThemes(): number {
    return themeIdsWithGames(DEFAULT_CONTENT_LEVEL_ID).length;
  }
}

/** Dùng chung một instance. */
export const questService = new QuestService();
