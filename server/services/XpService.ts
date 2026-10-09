/**
 * RubyLingo — `XpService`: cộng XP và phát hiện LÊN CẤP (T053).
 *
 * ⭐⭐ ĐÂY LÀ **ĐƯỜNG DUY NHẤT** ĐỂ CỘNG XP TRONG TOÀN BỘ HỆ THỐNG.
 *
 *   `RewardService.GrantBundle` **cố tình không có trường `xp`** — xem quyết định 2 ở đầu file
 *   đó. Cám dỗ là cho nó nhận luôn `xp` để "cộng một lượt cho tiện". Nhưng cộng XP không chỉ là
 *   `xp = xp + n`: nó còn phải phát hiện ĐÃ VƯỢT CẤP NÀO và TRAO QUÀ của (các) cấp đó. Một hàm
 *   cộng XP "cho tiện" ở chỗ khác sẽ là hàm cộng XP **QUÊN trao quà lên cấp** — và người gọi nó
 *   sẽ không biết mình vừa làm mất quà của bé. Không có lỗi nào được ném ra, không có gì đỏ.
 *
 * -----------------------------------------------------------------------------
 * BA QUYẾT ĐỊNH CẦN HIỂU TRƯỚC KHI SỬA
 * -----------------------------------------------------------------------------
 *
 * ⚠️ 1. TRAO QUÀ CHO **MỌI** CẤP ĐÃ VƯỢT QUA, KHÔNG CHỈ CẤP CUỐI CÙNG.
 *
 *    Đây là bug đắt nhất mà file này tồn tại để chặn. Một lần cộng XP có thể nhảy qua nhiều
 *    cấp: bé hoàn thành bài đầu tiên, hoặc nhận mốc chuỗi 7 ngày (+30 XP) cùng lúc với một lượt
 *    chơi. Nếu code chỉ so `cấp cũ` với `cấp mới` rồi trao quà của cấp mới:
 *
 *        cấp 2 (150 XP) → cấp 4 (900 XP)  ⇒  quà của cấp 3 MẤT VĨNH VIỄN
 *
 *    "Vĩnh viễn" là chữ đúng: bé đã ở trên mốc XP của cấp 3, nên lần sau có cộng thêm bao nhiêu
 *    cũng không bao giờ "lên" cấp 3 nữa. Không có cách nào phát hiện về sau — không ai biết bé
 *    đáng lẽ được nhận gì.
 *
 *    Vì vậy ta dùng `getLevelsCrossed(xpCũ, xpMới)` — nó trả về DANH SÁCH, và ta trao quà của
 *    tất cả. `getLevelForXp` một mình KHÔNG ĐỦ.
 *
 * ⚠️ 2. XP CHỈ TĂNG, CẤP KHÔNG BAO GIỜ TỤT.
 *
 *    Không có hình phạt nào trong app này (không trừ điểm, không trừ ⭐, không mất vật phẩm đã
 *    mua). Nên `addXpInTx` với số ≤ 0 là một NO-OP: không ghi gì, không trả về "lên cấp âm".
 *    Một hàm "cộng XP" nhận số âm là một lỗ hổng để lách qua đúng cái luật đó, và ở chỗ gọi nó
 *    trông hoàn toàn vô hại.
 *
 *    ⚠️ Hệ quả quan trọng: nếu ai đó sửa `xp-levels.json` và NÂNG mốc XP của một cấp, thì người
 *      đang ở cấp đó vẫn giữ nguyên cấp (vì `xp` không đổi và `getLevelForXp` chỉ chạy khi có
 *      XP mới). Cấp ở đây là "thành tựu đã đạt", không phải "trạng thái được tính lại liên tục".
 *
 * ⚠️ 3. HÀM NÀY PHẢI ĐƯỢC GỌI **BÊN TRONG** MỘT TRANSACTION ĐÃ MỞ.
 *
 *    Người gọi điều phối nhiều bảng trong cùng một đơn vị công việc — ví dụ T054 ghi lượt chơi
 *    (GameResultService) + tiến độ từng từ (ProgressService) + XP (ở đây) + ví (RewardService).
 *    Nếu hàm này tự mở transaction riêng, nó sẽ thoát ra ngoài transaction của người gọi và phá
 *    vỡ tính "hoặc tất cả, hoặc không gì": bé có thể được cộng XP cho một lượt chơi mà dòng
 *    `game_result` đã bị rollback.
 *    Vì vậy tên có hậu tố `InTx`, và nó KHÔNG tự kiểm quyền sở hữu — người gọi đã kiểm rồi.
 */

import { getLevelForXp, getLevelsCrossed } from '../../shared/content/levels.js';
import { splitRewards, toRewardBundle } from '../../shared/content/rewards.js';
import type { RewardGrant, XpLevelDefinition } from '../../shared/types/reward.js';
import type { GameResultAward } from '../../shared/types/progress.js';
import type { Db } from '../db/connection.js';
import { rewardService } from './RewardService.js';
import type { AppliedGrants, GrantBundle, RewardService } from './RewardService.js';

// =============================================================================
// Quà của bảng cấp ⇒ gói trao được
// =============================================================================

/**
 * Đổi `rewards` của một (hoặc nhiều) cấp thành `GrantBundle` mà `RewardService` hiểu.
 *
 * ⚠️ `kind: 'xp'` BỊ CẤM TRONG QUÀ LÊN CẤP — VÀ ĐÂY LÀ LÝ DO:
 *   Cộng XP lại sinh ra quà lên cấp ⇒ đó là một VÒNG LẶP, và mỗi vòng lặp cần một câu trả lời
 *   cho "dừng ở đâu" (một lần cộng có thể sinh XP, XP đó lại vượt cấp, cấp đó lại cho XP…).
 *   Dự án CHƯA trả lời câu hỏi đó, nên nó bị chặn ở tầng NỘI DUNG
 *   (`scripts/validate-content.ts`, luật V16c) thay vì được xử lý nửa vời ở đây.
 *
 *   Nếu một bản nội dung sai vẫn lọt qua: ta BỎ QUA và GHI LOG. Không cộng, không đệ quy, không
 *   ném lỗi — một bản nội dung sai không được làm hỏng lượt chơi của bé.
 *
 * ⭐ VIỆC PHÂN LOẠI `RewardGrant[]` NAY NẰM Ở `shared/content/rewards.ts`, KHÔNG Ở ĐÂY.
 *   Cùng một luật ấy còn được dùng cho quà NHIỆM VỤ (QuestService) và cho client vẽ chip quà.
 *   Ba bản `switch` chép tay sẽ lệch nhau ngay lần đầu ai đó thêm một `kind` mới. Hàm này giờ
 *   chỉ còn đúng phần ĐẶC THÙ của quà lên cấp: cảnh báo khi gặp `xp`.
 */
export function levelRewardsToBundle(grants: readonly RewardGrant[]): GrantBundle {
  if (grants.some((grant) => grant.kind === 'xp')) {
    console.warn(
      '[rubylingo] quà lên cấp chứa "xp" — không được hỗ trợ, đã bỏ qua. ' +
        'Xem luật V16c trong scripts/validate-content.ts.',
    );
  }
  return toRewardBundle(splitRewards(grants));
}

// =============================================================================
// Kết quả một lần cộng XP
// =============================================================================

export interface XpGainResult {
  xpBefore: number;
  /** Số XP thực sự được cộng. `0` khi đầu vào ≤ 0 (no-op) — xem quyết định 2. */
  xpGained: number;
  xpAfter: number;
  levelBefore: number;
  levelAfter: number;
  /**
   * Các cấp đã vượt qua trong lần cộng này, theo thứ tự TĂNG DẦN. Rỗng ⇒ không lên cấp.
   * Là DANH SÁCH chứ không phải một cấp — xem quyết định 1.
   */
  levelsCrossed: XpLevelDefinition[];
  /** Quà THỰC SỰ mới được trao, gộp từ mọi cấp đã vượt. */
  rewards: AppliedGrants;
  /**
   * Sẵn sàng để gán thẳng vào `GameResultAward.levelUp`. `null` khi không lên cấp.
   *
   * ⚠️ `rewards` ở đây là ĐỊNH NGHĨA THÔ (`RewardGrant[]`) chứ không phải "những gì mới được
   *    trao". Điều đó ĐÚNG trong trường hợp này: mỗi cấp chỉ bị vượt qua đúng MỘT LẦN trong đời
   *    một hồ sơ bé, nên quà của nó không thể trùng với thứ bé đã có. Nhờ vậy overlay ăn mừng
   *    hiện được đúng danh sách phần thưởng như thiết kế (`GAME-REWARD-DESIGN`), thay vì một
   *    danh sách đã bị lọc mất những món bé tình cờ đã có từ đường khác.
   */
  levelUp: GameResultAward['levelUp'];
}

/** Kết quả rỗng — dùng cho no-op, để không phải rải object literal ở ba chỗ. */
function noGain(xp: number, level: number): XpGainResult {
  return {
    xpBefore: xp,
    xpGained: 0,
    xpAfter: xp,
    levelBefore: level,
    levelAfter: level,
    levelsCrossed: [],
    rewards: { starsGained: 0, acornsGained: 0, badgeIds: [], stickerIds: [], itemIds: [] },
    levelUp: null,
  };
}

// =============================================================================
// Service
// =============================================================================

export class XpService {
  /**
   * ⚠️ KHÔNG nhận `ChildService` — service này không có route riêng và không bao giờ nhận
   *    `childId` từ client. Nó chỉ được gọi từ bên trong transaction của một service khác, nơi
   *    quyền sở hữu đã được kiểm. Thêm một phụ thuộc không dùng tới là thêm một thứ phải hiểu.
   */
  constructor(private readonly rewards: RewardService = rewardService) {}

  /**
   * Cộng XP và trao quà của MỌI cấp vượt qua. **Phải gọi trong transaction đã mở.**
   *
   * Đầu vào ≤ 0 ⇒ no-op (xem quyết định 2). No-op vẫn trả về trạng thái HIỆN TẠI, không phải
   * một object rỗng — người gọi cần `xpAfter` để hiển thị thanh XP mà không phải đọc lại DB.
   */
  addXpInTx(db: Db, childId: string, amount: number, at: string): XpGainResult {
    const gain = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;

    // Đọc TRƯỚC khi ghi. `readXp` tự tính lại cấp từ `xp` thay vì tin cột `level` — xem ghi chú
    // ở `RewardService.readXp`.
    const before = this.rewards.readXp(db, childId);

    if (gain === 0) return noGain(before.xp, before.level);

    const xpAfter = before.xp + gain;
    const levelAfter = getLevelForXp(xpAfter);

    // Một câu UPDATE duy nhất cho cả `xp` lẫn `level`. Ghi hai lần thì có một khoảnh khắc hàng
    // mang `xp` mới nhưng `level` cũ — vô hại trong transaction, nhưng là trạng thái không nên
    // tồn tại, và nó sẽ trở thành bug thật nếu ai đó gọi hàm này mà quên bọc transaction.
    this.rewards.ensureXpRowInTx(db, childId, at);
    db.prepare('UPDATE xp_state SET xp = ?, level = ?, updated_at = ? WHERE child_id = ?').run(
      xpAfter,
      levelAfter.level,
      at,
      childId,
    );

    // ⭐ DANH SÁCH, KHÔNG PHẢI MỘT CẤP — xem quyết định 1. Đây là dòng quyết định bé có nhận đủ
    //   quà của những cấp bị nhảy qua hay không.
    const levelsCrossed = getLevelsCrossed(before.xp, xpAfter);

    // Trao quà của TẤT CẢ các cấp đã vượt. Gói rỗng ⇒ `applyGrantsInTx` không ghi gì, nên gọi
    // vô điều kiện ở đây không tạo thêm một nhánh "nếu như" nào phải kiểm.
    const applied = this.rewards.applyGrantsInTx(
      db,
      childId,
      levelRewardsToBundle(levelsCrossed.flatMap((level) => level.rewards)),
      at,
    );

    return {
      xpBefore: before.xp,
      xpGained: gain,
      xpAfter,
      levelBefore: before.level,
      levelAfter: levelAfter.level,
      levelsCrossed,
      rewards: applied,
      levelUp:
        levelsCrossed.length === 0
          ? null
          : {
              from: before.level,
              to: levelAfter.level,
              rewards: levelsCrossed.flatMap((level) => level.rewards),
            },
    };
  }
}

/** Dùng chung một instance. */
export const xpService = new XpService();
