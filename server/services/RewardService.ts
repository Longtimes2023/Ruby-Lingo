/**
 * RubyLingo — `RewardService`: ví tiền tệ, túi đồ, bộ sưu tập (T052).
 *
 * ⭐ NHIỆM VỤ: một chỗ DUY NHẤT biết cách ghi vào `wallet`, `inventory`, `badge_earned`,
 *   `sticker_earned`, `pet_state`, `streak_state`. Mọi service khác (game, nhiệm vụ, huy hiệu,
 *   cửa hàng) đều đi qua đây thay vì tự viết SQL.
 *
 * -----------------------------------------------------------------------------
 * BỐN QUYẾT ĐỊNH CẦN HIỂU TRƯỚC KHI SỬA
 * -----------------------------------------------------------------------------
 *
 * ⚠️ 1. KHÔNG BAO GIỜ ĐỂ SỐ DƯ ÂM — VÀ CÂU CHỐT NẰM TRONG MỆNH ĐỀ `WHERE`.
 *    `spendInTx` không đọc số dư rồi mới trừ. Nó trừ với điều kiện:
 *      `UPDATE wallet SET stars = stars - ? WHERE child_id = ? AND stars >= ?`
 *    rồi kiểm `changes === 0`.
 *
 *    ⭐ Vì sao không dùng `SELECT` rồi `UPDATE`: giữa hai câu lệnh đó có một khe thời gian. Bé
 *      bấm "Mua" hai lần thật nhanh (hoặc hai tab cùng lúc) ⇒ cả hai lần `SELECT` đều thấy đủ
 *      tiền, cả hai lần `UPDATE` đều chạy, và ví bị trừ hai lần cho một món đồ. Điều kiện nằm
 *      trong `WHERE` khiến "kiểm" và "trừ" là MỘT thao tác không thể chia cắt — SQLite đảm bảo
 *      điều đó ngay cả bên trong transaction.
 *
 *    Đây cũng là lý do bảng `wallet` có `CHECK (stars >= 0)`: nếu tầng ứng dụng có sai sót, DB
 *      vẫn từ chối thay vì ghi một số dư âm mà không ai phát hiện.
 *
 * ⚠️ 2. XP **KHÔNG** ĐI QUA FILE NÀY. Chỉ có `XpService.addXpInTx`.
 *    Cám dỗ là cho `applyGrantsInTx` nhận luôn `xp` cho tiện. ĐỪNG LÀM THẾ. Cộng XP không chỉ
 *      là `xp = xp + n`: nó còn phải phát hiện LÊN CẤP và trao quà của (các) cấp đã vượt qua.
 *      Một hàm cộng XP "cho tiện" ở đây sẽ là hàm cộng XP QUÊN trao quà lên cấp, và người gọi
 *      nó sẽ không biết mình vừa làm mất quà của bé. Có đúng một đường để cộng XP, và đường đó
 *      là `XpService`.
 *
 * ⚠️ 3. HÀNG TRONG `wallet`/`pet_state` ĐÃ ĐƯỢC TẠO SẴN — NHƯNG VẪN `INSERT OR IGNORE` TRƯỚC KHI GHI.
 *
 *    ⭐ SỰ THẬT TRƯỚC TIÊN: `ChildService.createChild` tạo hồ sơ bé **cùng lúc** với cả năm hàng
 *      con (`wallet`, `xp_state`, `pet_state`, `streak_state`, `settings`) trong MỘT transaction.
 *      Nên trong luồng bình thường, hàng ĐÃ có sẵn ở đây. Ghi chú này không được nói khác đi —
 *      một comment sai về cơ chế sẽ khiến người sửa sau bỏ mất thứ đang thật sự chạy.
 *
 *    ⭐ VẬY THÌ `INSERT OR IGNORE` ĐỂ LÀM GÌ: nó là LƯỚI AN TOÀN cho những hàng CÓ THỂ không
 *      tồn tại, và những đường đó là thật:
 *        • `ChildService` từng không tạo chúng — một bản phục hồi từ sao lưu cũ vẫn có hồ sơ bé
 *          mà không có `wallet`.
 *        • DB sửa tay, hoặc một migration bị chạy sót.
 *        • Ai đó gọi thẳng service từ script seed / CLI, không đi qua `ChildService`.
 *      Cái giá của lưới này là gần bằng 0 (một câu `INSERT OR IGNORE` trên khoá chính đã tồn
 *      tại), còn cái giá của việc thiếu nó là một lỗi `SQLITE_CONSTRAINT` nổ ra ở giữa lượt
 *      chơi của bé. Rẻ hơn nhiều để luôn tự bảo đảm.
 *
 *    ⚠️ Hệ quả: `getSnapshot` phải đọc được cả khi hàng CHƯA tồn tại, và nó trả giá trị mặc
 *      định thay vì tự tạo hàng. Một `GET` KHÔNG ĐƯỢC GHI VÀO DB — nếu không thì mở app lên
 *      chỉ để xem cũng đã làm thay đổi dữ liệu, và mọi lần đồng bộ sẽ thấy "có gì đó mới".
 *
 * ⚠️ 4. "ĐANG MẶC GÌ" CHỈ CÓ MỘT CHỦ: `inventory.equipped`.
 *    Cột `pet_state.equipped_item_ids` (JSON array, có từ migration 004) TRÔNG như chỗ lưu
 *      đúng cùng một sự thật. Nếu cả hai cùng được ghi thì đó là HAI BẢN SAO của một sự thật,
 *      nghĩa là một ngày nào đó chúng sẽ lệch — và đường gây lệch đã có sẵn trong chính dự án:
 *      test HTTP của `GET /rewards` xoá hàng `pet_state` để chứng minh `GET` không ghi DB. Sau
 *      lần xoá đó, `inventory` vẫn nói "đang đội mũ" còn `pet_state` mới toanh nói "không có gì"
 *      — hai nguồn, hai câu trả lời, và không có cách nào biết câu nào đúng.
 *
 *    ⭐ NÊN: `inventory.equipped` là chủ DUY NHẤT. `pet_state.equipped_item_ids` KHÔNG BAO GIỜ
 *      được ghi và KHÔNG BAO GIỜ được đọc; `readPet` SUY `equippedItemIds` từ `inventory`.
 *      Migration là BẤT BIẾN nên cột vẫn nằm trong schema với mặc định `'[]'` — nó chỉ đơn
 *      thuần không được dùng tới.
 *
 *    ⚠️ Vì cột đó LÀ MỘT CÁI BẪY CHỜ NGƯỜI SỬA SAU ("có cột sẵn mà không dùng, chắc là quên"),
 *      `reward-service.test.ts` có một test khoá đúng điều này: ghi rác vào cột rồi khẳng định
 *      `readPet().equippedItemIds` KHÔNG hề bị ảnh hưởng. Xoá test đó là mở đường cho cột sống
 *      lại.
 */

import type {
  EquipmentResult,
  FeedResult,
  InventoryItem,
  PetState,
  PurchaseResult,
  RewardSnapshot,
  ShopItem,
  StreakState,
  Wallet,
  XpState,
} from '../../shared/types/reward.js';
import type { Db } from '../db/connection.js';
import { getDb, transaction } from '../db/connection.js';
import { getEvolutionStage, getLevelForXp } from '../../shared/content/levels.js';
import { getShopItem, happinessGainOf, isEquippable, isStackable } from '../../shared/content/shop.js';
import { HAPPINESS_DEFAULT, computeHappiness } from '../../shared/pet-happiness.js';
import {
  buyItemRequestSchema,
  equipItemRequestSchema,
  feedPetRequestSchema,
} from '../../shared/schemas/reward.js';
import { daysBetweenDateKeys, localDateKey, nowIso } from '../lib/time.js';
import { errors } from '../plugins/errors.js';
import { childService } from './ChildService.js';
import type { ChildService } from './ChildService.js';

// =============================================================================
// Gói phần thưởng
// =============================================================================

/** Một vật phẩm được trao. `quantity` mặc định 1. */
export interface ItemGrant {
  itemId: string;
  quantity?: number;
}

/** Một sticker được trao, kèm bài học làm rơi ra nó (nếu có). */
export interface StickerGrant {
  stickerId: string;
  lessonId?: string | null;
}

/**
 * Gói phần thưởng cần trao.
 *
 * ⚠️ KHÔNG CÓ TRƯỜNG `xp` — xem quyết định 2 ở đầu file. Cộng XP phải đi qua `XpService`.
 */
export interface GrantBundle {
  stars?: number;
  acorns?: number;
  badges?: readonly string[];
  stickers?: readonly StickerGrant[];
  items?: readonly ItemGrant[];
}

/** Những gì THỰC SỰ được trao — để người gọi báo lại cho bé. */
export interface AppliedGrants {
  starsGained: number;
  acornsGained: number;
  /** Chỉ gồm huy hiệu MỚI. Trao lại huy hiệu đã có không tính là "vừa nhận". */
  badgeIds: string[];
  /** Chỉ gồm sticker MỚI. */
  stickerIds: string[];
  /** Chỉ gồm vật phẩm MỚI trong túi (lần đầu sở hữu). */
  itemIds: string[];
}

function emptyGrants(): AppliedGrants {
  return { starsGained: 0, acornsGained: 0, badgeIds: [], stickerIds: [], itemIds: [] };
}

// =============================================================================
// Hình dạng hàng trong DB
// =============================================================================

interface WalletRow {
  child_id: string;
  stars: number;
  acorns: number;
  updated_at: string;
}

interface XpRow {
  child_id: string;
  xp: number;
  level: number;
  updated_at: string;
}

/**
 * Hàng `pet_state`.
 *
 * ⚠️ KHÔNG CÓ `equipped_item_ids` — và đó là chủ ý, xem quyết định 4 ở đầu file. Cột đó vẫn
 *    tồn tại trong schema (migration là bất biến) nhưng hệ thống không đọc nó; khai nó ở đây
 *    chỉ mời gọi người sửa sau dùng lại nó. "Đang mặc gì" nằm ở `inventory.equipped`.
 */
interface PetRow {
  child_id: string;
  /**
   * ⚠️ KHÔNG có `evolution_stage` ở đây, và đó là chủ ý (T066): cột vẫn tồn tại trong schema
   *    nhưng KHÔNG được đọc nữa — tiến hoá suy ra từ `word_progress`. Khai nó vào kiểu này là
   *    mời người sửa sau đọc nó "cho tiện", và thế là cột sống lại thành nguồn thứ hai.
   */
  happiness: number;
  last_fed_at: string | null;
  updated_at: string;
}

interface StreakRow {
  child_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  milestones_claimed: string;
  updated_at: string;
}

interface InventoryRow {
  child_id: string;
  item_id: string;
  quantity: number;
  equipped: number;
  acquired_at: string;
}

/**
 * Danh sách mốc chuỗi đã nhận — lưu dạng mảng SỐ.
 *
 * ⚠️ Chịu được dữ liệu hỏng, KHÔNG ném: giá trị này là TEXT tự do, nên một bản phục hồi sao lưu
 *    cũ hoặc một lần sửa tay có thể để lại chuỗi không parse được. Ném lỗi ở đây sẽ làm màn hình
 *    Nhà thú cưng trắng trong khi dữ liệu học của bé vẫn nguyên vẹn — hỏng một thứ phụ không
 *    được kéo cả app xuống.
 *
 * ⭐ Đây từng là hàm thứ hai trong một CẶP (`parseJsonArray` cho `equipped_item_ids`). Hàm đó
 *   đã bị xoá cùng lúc với việc `pet_state.equipped_item_ids` ngừng được đọc — "đang mặc gì" nay
 *   suy từ `inventory` (quyết định 4 ở đầu file). Nếu ai đó thấy cột JSON còn trống chỗ đọc, thì
 *   thứ cần làm là XOÁ CỘT trong một migration mới, không phải dựng lại hàm này.
 */
function parseNumberArray(raw: string): number[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  } catch {
    console.warn('[rubylingo] cột milestones_claimed không đọc được, coi như rỗng');
    return [];
  }
}

// =============================================================================
// Service
// =============================================================================

export class RewardService {
  /**
   * ⚠️ Nhận một HÀM mở DB (`() => Db`), không nhận sẵn một handle `Db`.
   *
   *   Nếu nhận sẵn handle, giá trị mặc định `getDb()` sẽ chạy ngay lúc MODULE được nạp — tức là
   *   mở file SQLite ngay khi `import`, trước cả khi server khởi động xong. Hàm `transaction()`
   *   của `db/connection` cũng mở DB theo kiểu lười vì đúng lý do này. Giữ cùng một kiểu ở đây
   *   để thứ tự khởi động không phụ thuộc vào việc ai `import` ai.
   *
   *   Đổi lại, test truyền được `() => dbTest` và không cần chạm vào file DB thật.
   */
  constructor(
    private readonly children: ChildService = childService,
    private readonly openDb: () => Db = getDb,
  ) {}

  // --- Đọc ảnh chụp ---------------------------------------------------------

  /**
   * Toàn bộ trạng thái thưởng của một bé, để client dựng màn Nhà thú cưng / Cửa hàng / Nhiệm vụ.
   *
   * ⚠️ CHỈ ĐỌC. Xem quyết định 3 ở đầu file.
   */
  getSnapshot(parentId: string, childId: string): RewardSnapshot {
    this.requireChild(parentId, childId);
    return this.readSnapshot(this.openDb(), childId);
  }

  /** Đọc ảnh chụp từ một handle DB bất kỳ (dùng được cả trong transaction). */
  readSnapshot(db: Db, childId: string): RewardSnapshot {
    const serverTime = nowIso();
    return {
      childId,
      wallet: this.readWallet(db, childId),
      xp: this.readXp(db, childId),
      pet: this.readPet(db, childId),
      streak: this.readStreak(db, childId),
      inventory: this.readInventory(db, childId),
      badges: this.readBadgeIds(db, childId),
      stickers: this.readStickerIds(db, childId),
      serverTime,
    };
  }

  /**
   * Ví của bé. Hàng chưa tồn tại ⇒ trả 0 sao / 0 hạt dẻ.
   *
   * `updatedAt` khi chưa có hàng lấy `nowIso()` — đây KHÔNG phải bịa: câu "tính đến bây giờ,
   * bé có 0 ⭐" là đúng. Điều không được làm là bịa một con SỐ DƯ.
   */
  readWallet(db: Db, childId: string): Wallet {
    const row = db
      .prepare('SELECT child_id, stars, acorns, updated_at FROM wallet WHERE child_id = ?')
      .get(childId) as WalletRow | undefined;

    if (!row) return { childId, stars: 0, acorns: 0, updatedAt: nowIso() };
    return {
      childId: row.child_id,
      stars: row.stars,
      acorns: row.acorns,
      updatedAt: row.updated_at,
    };
  }

  /**
   * XP và cấp của bé.
   *
   * ⚠️ `level` trong bảng là BẢN GHI ĐỆM của một giá trị suy ra được từ `xp` — và nó có thể
   *    lệch với `xp` nếu ai đó sửa bảng cấp (`xp-levels.json`) sau khi bé đã có XP. Khi đọc ra,
   *    ta TÍNH LẠI từ `xp` thay vì tin cột `level`: bảng cấp là nguồn chân lý, còn cột `level`
   *    chỉ để truy vấn nhanh ở tầng SQL. Trả về số sai ở đây nghĩa là bé thấy cấp của mình sai.
   */
  readXp(db: Db, childId: string): XpState {
    const row = db
      .prepare('SELECT child_id, xp, level, updated_at FROM xp_state WHERE child_id = ?')
      .get(childId) as XpRow | undefined;

    if (!row) {
      return { childId, xp: 0, level: getLevelForXp(0).level, updatedAt: nowIso() };
    }
    return {
      childId: row.child_id,
      xp: row.xp,
      level: getLevelForXp(row.xp).level,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Trạng thái linh vật.
   *
   * ⚠️⚠️ `equippedItemIds` được SUY TỪ `inventory`, KHÔNG đọc từ `pet_state.equipped_item_ids`.
   *   Câu `SELECT` dưới đây CỐ TÌNH không lấy cột đó ra — một cột không ai `SELECT` thì không ai
   *   vô tình dùng lại nó. Lý do đầy đủ ở quyết định 4 đầu file; bản tóm tắt là: một sự thật chỉ
   *   được có một chủ, và chủ ở đây là `inventory.equipped`.
   *
   * ⭐ Suy ra ở TẦNG ĐỌC (chứ không ghi song song hai nơi) khiến sự lệch nhau là BẤT KHẢ THI, kể
   *   cả khi hàng `pet_state` không tồn tại: nhánh "chưa có hàng" dưới đây vẫn trả về đúng những
   *   món đang mặc, thay vì `[]` như khi đọc một cột trống.
   */
  readPet(db: Db, childId: string): PetState {
    /**
     * ⚠️⚠️ KHÔNG `SELECT evolution_stage` — CỘT ĐÓ KHÔNG CÒN LÀ CHỦ CỦA SỰ THẬT NÀO (T066).
     *
     *   Tiến hoá được SUY RA từ số từ đã học, đúng khuôn mẫu đã áp cho `equippedItemIds` ngay
     *   trên đây: suy ở tầng ĐỌC khiến hai nguồn lệch nhau là BẤT KHẢ THI. Nếu vừa ghi cột vừa
     *   suy ra, sẽ có ngày cột nói `adult` còn `word_progress` nói `baby` — và không có cách nào
     *   biết cái nào đúng. Đường gây lệch đã có sẵn trong chính dự án: test HTTP của
     *   `GET /rewards` XOÁ hàng `pet_state` để chứng minh `GET` không ghi DB.
     *
     *   Cột vẫn nằm trong schema vì migration là BẤT BIẾN, và vì thêm một giai đoạn mới PHẢI kèm
     *   migration — 4 giai đoạn này gắn với 4 bộ hình linh vật, không phải thao tác chỉ sửa JSON
     *   (xem chú thích ở `004_reward.sql`). `reward-service.test.ts` khoá điều này lại: ghi rác
     *   vào cột rồi khẳng định `readPet` KHÔNG hề bị ảnh hưởng.
     */
    const row = db
      .prepare(
        `SELECT child_id, happiness, last_fed_at, updated_at
           FROM pet_state WHERE child_id = ?`,
      )
      .get(childId) as PetRow | undefined;

    const equippedItemIds = this.readEquippedItemIds(db, childId);

    /**
     * ⭐ Suy ra NGOÀI nhánh `if (!row)`, có chủ ý: một bé đã học đủ từ để lên `baby` nhưng chưa
     *   từng có hàng `pet_state` (phục hồi từ sao lưu cũ, DB sửa tay) vẫn phải thấy đúng giai
     *   đoạn của mình — thay vì `egg` chỉ vì hàng đó chưa tồn tại. Cùng lý do như `equippedItemIds`.
     *
     * ⭐ ĐẾM **MỘT LẦN**, TRẢ CẢ HAI (T071.1): `wordsLearned` là chính con số quyết định
     *   `evolutionStage` (thanh tiến độ linh vật ở màn Hồ sơ dùng nó). Gọi `countLearnedWords`
     *   hai lần (một cho giai đoạn, một cho trường trả về) là hai phép đọc có thể lệch nhau nếu
     *   có ghi xen giữa — và khi ấy thanh tiến độ sẽ nói khác hình dáng Momo. Một phép đếm, hai
     *   chỗ dùng, không thể lệch.
     */
    const wordsLearned = this.countLearnedWords(db, childId);
    const evolutionStage = this.evaluateEvolution(wordsLearned);

    if (!row) {
      return {
        childId,
        evolutionStage,
        wordsLearned,
        happiness: HAPPINESS_DEFAULT,
        equippedItemIds,
        lastFedAt: null,
        updatedAt: nowIso(),
      };
    }
    return {
      childId: row.child_id,
      evolutionStage,
      wordsLearned,
      /**
       * ⚠️ `row.happiness` là mức ĐÃ LƯU, không phải mức hiện tại. Hao hụt được tính ở đây, mỗi
       *    lần đọc, và KHÔNG BAO GIỜ được ghi lại (một `GET` không được ghi DB — xem chú thích
       *    đầu tệp). Khi bé cho ăn, `feedPet` đọc mức đã hao này rồi cộng ❤️ và ghi lại, đồng
       *    thời cập nhật mốc hoạt động ⇒ hao hụt được "chốt sổ" đúng lúc.
       */
      happiness: computeHappiness(row.happiness, this.daysAwayFromApp(db, childId)),
      equippedItemIds,
      lastFedAt: row.last_fed_at,
      updatedAt: row.updated_at,
    };
  }

  readStreak(db: Db, childId: string): StreakState {
    const row = db
      .prepare(
        `SELECT child_id, current_streak, longest_streak, last_active_date,
                milestones_claimed, updated_at
           FROM streak_state WHERE child_id = ?`,
      )
      .get(childId) as StreakRow | undefined;

    if (!row) {
      return {
        childId,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        milestonesClaimed: [],
        updatedAt: nowIso(),
      };
    }
    return {
      childId: row.child_id,
      currentStreak: row.current_streak,
      longestStreak: row.longest_streak,
      lastActiveDate: row.last_active_date,
      milestonesClaimed: parseNumberArray(row.milestones_claimed),
      updatedAt: row.updated_at,
    };
  }

  readInventory(db: Db, childId: string): InventoryItem[] {
    const rows = db
      .prepare(
        `SELECT child_id, item_id, quantity, equipped, acquired_at
           FROM inventory WHERE child_id = ? ORDER BY acquired_at ASC, item_id ASC`,
      )
      .all(childId) as InventoryRow[];

    return rows.map((row) => ({
      childId: row.child_id,
      itemId: row.item_id,
      quantity: row.quantity,
      equipped: row.equipped === 1,
      acquiredAt: row.acquired_at,
    }));
  }

  /**
   * id những vật phẩm bé ĐANG MẶC / ĐANG TRƯNG.
   *
   * ⚠️ Đây là NGUỒN DUY NHẤT cho "đang mặc gì" (quyết định 4 ở đầu file): `readPet` gọi hàm này
   *    chứ không đọc `pet_state.equipped_item_ids`. Tách ra thành một hàm riêng để câu SQL ấy chỉ
   *    tồn tại ở MỘT chỗ — nếu `readPet` viết thẳng câu SELECT, mỗi lần ai đó cần danh sách này
   *    lại có cơ hội viết một biến thể hơi khác (thiếu `ORDER BY`, thiếu điều kiện `child_id`).
   *
   * ⭐ `ORDER BY` KHỚP `readInventory` (acquired_at, rồi item_id). Hai lời gọi trên cùng một
   *   trạng thái phải cho cùng một thứ tự: một mảng không ổn định sẽ làm test giả (xanh/đỏ tuỳ
   *   may) và làm bất kỳ phép so sánh ảnh chụp nào báo "có gì đó mới" mỗi lần đọc. `item_id` là
   *   khoá phá thế bằng ở đây vì `acquired_at` có thể trùng nhau khi bé mua hai món trong cùng
   *   một mili giây.
   */
  readEquippedItemIds(db: Db, childId: string): string[] {
    const rows = db
      .prepare(
        `SELECT item_id FROM inventory WHERE child_id = ? AND equipped = 1
           ORDER BY acquired_at ASC, item_id ASC`,
      )
      .all(childId) as { item_id: string }[];

    return rows.map((row) => row.item_id);
  }

  readBadgeIds(db: Db, childId: string): string[] {
    const rows = db
      .prepare('SELECT badge_id FROM badge_earned WHERE child_id = ? ORDER BY earned_at ASC')
      .all(childId) as { badge_id: string }[];
    return rows.map((r) => r.badge_id);
  }

  readStickerIds(db: Db, childId: string): string[] {
    const rows = db
      .prepare('SELECT sticker_id FROM sticker_earned WHERE child_id = ? ORDER BY earned_at ASC')
      .all(childId) as { sticker_id: string }[];
    return rows.map((r) => r.sticker_id);
  }

  /** Một vật phẩm trong túi, hoặc `null` nếu bé chưa từng sở hữu nó. */
  readInventoryItem(db: Db, childId: string, itemId: string): InventoryItem | null {
    const row = db
      .prepare(
        `SELECT child_id, item_id, quantity, equipped, acquired_at
           FROM inventory WHERE child_id = ? AND item_id = ?`,
      )
      .get(childId, itemId) as InventoryRow | undefined;

    if (!row) return null;
    return {
      childId: row.child_id,
      itemId: row.item_id,
      quantity: row.quantity,
      equipped: row.equipped === 1,
      acquiredAt: row.acquired_at,
    };
  }

  // ===========================================================================
  // Mua, mặc & cho ăn (T052 · T062)
  // ===========================================================================
  //
  // ⭐ MỘT LUẬT DUY NHẤT CHI PHỐI CẢ BA HÀM DƯỚI ĐÂY:
  //
  //        "KHÔNG BAO GIỜ LẤY THỨ GÌ CỦA BÉ MÀ KHÔNG ĐỔI LẠI ĐƯỢC GÌ."
  //
  //   Đây là hệ quả trực tiếp của triết lý "không bao giờ mắng đứa trẻ", nhưng ở tầng KINH TẾ
  //   chứ không phải tầng lời nói. Một bé 7 tuổi không thể hiểu vì sao quả chuối biến mất mà
  //   Momo không vui hơn, hay vì sao bị trừ ⭐ mà túi không có gì mới. Hai trường hợp đó nhìn
  //   từ phía bé giống hệt "app lấy mất đồ của mình" — và đó là cảm giác ta không được tạo ra.
  //
  //   Vì vậy: đồ ăn mua được nhiều lần (bé CỐ Ý mua 3 quả chuối ⇒ trừ 3 lần là đúng, có đổi
  //   lại đủ 3 quả); còn **mua lại một món dùng-mãi** và **cho ăn khi đã no** thì KHÔNG trừ gì
  //   cả — chúng trả về trạng thái hiện có. Hai nhánh đó vô hình với bé, nhưng chúng là thứ
  //   biến một cú bấm đúp (hoặc hai tab cùng lúc) từ "mất tiền oan" thành "không có gì xảy ra".
  //
  //   `equip` là cùng luật đó ở dạng thứ ba: mặc / bỏ ra KHÔNG trừ gì, và bấm hai lần cho ra
  //   đúng kết quả của bấm một lần.

  /**
   * Mua một vật phẩm bằng ⭐ hoặc 🌰. Trừ tiền và thêm vào túi trong MỘT transaction.
   *
   * ⚠️ GIÁ DO SERVER TRA TỪ `shop-items.json`, KHÔNG LẤY TỪ BODY — xem ghi chú đầu
   *    `shared/schemas/reward.ts`. Body chỉ có `itemId`.
   *
   * ⭐ THỨ TỰ CÓ NGHĨA: TRỪ TIỀN TRƯỚC, NHẬN ĐỒ SAU.
   *   `spendInTx` là bước duy nhất có thể ném `INSUFFICIENT_FUNDS`. Đặt nó lên trước nghĩa là
   *   khi bé không đủ tiền, transaction dừng ngay và **túi chưa hề bị đụng tới**. Nếu làm ngược
   *   lại (nhận đồ rồi mới trừ tiền), phần "nhận đồ" đã chạy xong mới phát hiện thiếu tiền —
   *   và mặc dù transaction sẽ rollback, thứ tự đó khiến mọi người đọc code phải tự hỏi
   *   "rollback có thật sự chạy không". Một thứ tự không cần phải tin ai cả thì tốt hơn.
   */
  buy(parentId: string, childId: string, rawInput: unknown): PurchaseResult {
    // Parse ở tầng service, không chỉ ở route — xem ghi chú ở `ChildService`.
    const { itemId } = buyItemRequestSchema.parse(rawInput);
    this.requireChild(parentId, childId);

    const item = getShopItem(itemId);
    // Vật phẩm không có trong danh mục ⇒ không có giá ⇒ không thể mua. Ném ra thay vì cho qua
    // với giá 0: "món đồ miễn phí" là một lỗ hổng kinh tế im lặng, không phải một hành vi.
    if (!item) throw errors.itemNotFound();

    return transaction((db) => {
      const at = nowIso();

      /**
       * ⭐ MÓN DÙNG-MÃI ĐÃ SỞ HỮU ⇒ KHÔNG TRỪ GÌ, trả về nguyên trạng.
       *
       * Đây là lưới an toàn cho cú bấm đúp, và nó là LÝ DO `isStackable` tồn tại (chỉ đồ ăn
       * mới mua nhiều lần). Không ném lỗi: một lỗi ở đây sẽ hiện lên thành một câu từ chối
       * với bé vì một việc bé vừa làm đúng (bấm "Mua" trên món mình đã có — nút đó lẽ ra đã
       * bị mờ đi ở tầng UI). Trả về trạng thái thật, không trừ tiền, không thêm gì.
       */
      const owned = this.readInventoryItem(db, childId, item.id);
      if (owned && !isStackable(item)) {
        return { item, wallet: this.readWallet(db, childId), inventoryItem: owned };
      }

      // 1. Trả tiền. Ném `INSUFFICIENT_FUNDS` ⇒ rollback ⇒ bước 2 không bao giờ chạy.
      this.spendInTx(db, childId, this.priceOf(item), at);
      // 2. Nhận đồ.
      this.grantItemInTx(db, childId, item.id, 1, at);
      // 3. Đọc lại ĐÚNG hàng vừa ghi — không tự dựng object từ dữ liệu đầu vào. Nếu bước 2
      //    không thật sự ghi được gì, `requireInventoryItem` ném lỗi thay vì trả một món đồ
      //    tưởng tượng mà client sẽ vẽ ra như thật.
      return {
        item,
        wallet: this.readWallet(db, childId),
        inventoryItem: this.requireInventoryItem(db, childId, item.id),
      };
    });
  }

  /**
   * Cho thú cưng ăn một món ĐÃ SỞ HỮU. Tiêu 1 đơn vị và cộng ❤️.
   *
   * ⚠️ KHÔNG TRỪ TIỀN Ở ĐÂY. Tiền đã trả lúc mua. Cho ăn là tiêu thụ món đã nằm trong túi —
   *    nếu trừ tiền ở cả hai bước thì bé bị tính hai lần cho một quả chuối. `FeedResult` có
   *    `wallet` chỉ để client cập nhật lại ví sau khi đồng bộ, không phải vì có gì đổi ở đó.
   */
  feed(parentId: string, childId: string, rawInput: unknown): FeedResult {
    const { itemId } = feedPetRequestSchema.parse(rawInput);
    this.requireChild(parentId, childId);

    const item = getShopItem(itemId);
    if (!item) throw errors.itemNotFound();
    // Chỉ đồ ăn mới cho ăn được. Kiểm ở server chứ không chỉ ở UI: một phụ kiện "ăn được"
    // nghĩa là bé tiêu mất chiếc nón của mình để đổi lấy ❤️ — và không có cách nào lấy lại.
    if (item.category !== 'food') {
      throw errors.validation('Món này không cho ăn được');
    }

    return transaction((db) => {
      const at = nowIso();
      const before = this.readPet(db, childId);

      /**
       * ⭐ ĐÃ NO (❤️ = 5) ⇒ KHÔNG TIÊU ĐỒ, KHÔNG ĐỔI GÌ.
       *
       * Cùng luật "không lấy gì mà không đổi lại được gì": tiêu một quả chuối lúc Momo đã no
       * là lấy mất 5 ⭐ của bé mà bé không nhận thêm được gì. Trả về trạng thái hiện có; client
       * thấy `pet.happiness` đã ở mức tối đa và hiện câu "Momo đang no lắm rồi!" (T065).
       *
       * ⚠️ Hệ quả có ý thức: gọi route này liên tục lúc no KHÔNG làm mất đồ ⇒ không cần chặn
       *    ở tầng rate-limit. Một ứng dụng "làm gì cũng được, không mất gì" không cần hàng rào.
       */
      if (before.happiness >= 5) {
        return { pet: before, item, wallet: this.readWallet(db, childId) };
      }

      // 1. Tiêu 1 đơn vị. Ném `ITEM_NOT_FOUND` ⇒ rollback ⇒ ❤️ không tăng oan.
      this.consumeItemInTx(db, childId, item.id, 1);
      // 2. Cộng ❤️ (đã kẹp trần 5 bên trong `setPetHappinessInTx`).
      this.setPetHappinessInTx(db, childId, before.happiness + happinessGainOf(item), at);
      // 3. Ghi dấu lần cho ăn gần nhất — mốc để biết "Momo vừa được ăn lúc nào".
      //    ⚠️ KHÔNG dùng nó làm mốc hao hụt ❤️: hao hụt neo vào NGÀY BÉ HOẠT ĐỘNG GẦN NHẤT,
      //       nếu không thì một bé học mỗi ngày mà không tiêu ⭐ sẽ thấy Momo buồn dần — một áp
      //       lực tiêu tiền lên trẻ 7 tuổi. Xem `daysAwayFromApp`.
      this.touchPetFedInTx(db, childId, at);

      return {
        pet: this.readPet(db, childId),
        item,
        wallet: this.readWallet(db, childId),
      };
    });
  }

  /**
   * MẶC / BỎ RA một vật phẩm đã sở hữu.
   *
   * ⚠️ ĐẶT THEO TRẠNG THÁI ĐÍCH (`equipped`), TUYỆT ĐỐI KHÔNG ĐẢO TRẠNG THÁI.
   *   Bé bấm "Dùng ngay" hai lần thật nhanh phải cho kết quả y hệt bấm một lần. Một hàm đảo
   *   (`equipped = 1 - equipped`) biến cú bấm đúp — hành vi hoàn toàn bình thường của trẻ 7 tuổi
   *   — thành "mặc rồi bỏ ra": bé thấy món vừa chọn biến mất khỏi Momo và không có cách nào hiểu
   *   vì sao. Với trạng thái đích, lần gửi thứ hai ghi đúng cùng một giá trị: không đổi gì,
   *   không lỗi, không bất ngờ.
   *
   * ⭐ KHÔNG TRỪ TIỀN, KHÔNG TIÊU ĐỒ. Món đồ thuộc về bé từ lúc mua; mặc hay bỏ ra chỉ đổi cách
   *   hiển thị. Đây là bản sao ở tầng kinh tế của quyết định C2 ("đã mua = VĨNH VIỄN").
   *
   * ⚠️ CHỈ PHỤ KIỆN / TRANG TRÍ — kiểm ở SERVER, không chỉ ở UI. Xem `isEquippable` để hiểu vì
   *    sao đồ ăn không mặc được (nó bị tiêu khi cho ăn).
   *
   * ⚠️ `itemId` đến từ ĐƯỜNG DẪN, `rawInput` chỉ chứa `{equipped}` — xem
   *    `shared/schemas/reward.ts`. Không có chỗ nào ở đây đọc `itemId` từ body.
   */
  equip(parentId: string, childId: string, itemId: string, rawInput: unknown): EquipmentResult {
    // Parse ở tầng service, không chỉ ở route — xem ghi chú ở `ChildService`.
    const { equipped } = equipItemRequestSchema.parse(rawInput);
    this.requireChild(parentId, childId);

    const item = getShopItem(itemId);
    // Không có trong danh mục ⇒ không biết nó thuộc nhóm nào ⇒ không thể quyết định nó có mặc
    // được hay không. Ném ra thay vì mặc định cho qua: "cho qua" biến một id gõ sai thành một
    // món đồ ma trong túi (nó sẽ hiện trong danh sách đang mặc mà không có tên/icon để vẽ).
    if (!item) throw errors.itemNotFound();

    if (!isEquippable(item)) {
      throw errors.validation('Món này không mặc được');
    }

    return transaction((db) => {
      const owned = this.readInventoryItem(db, childId, item.id);

      /**
       * ⚠️ CHƯA SỞ HỮU ⇒ `ITEM_NOT_FOUND`, VÀ TUYỆT ĐỐI KHÔNG TẠO HÀNG `inventory`.
       *
       *   Tạo hàng ở đây là CẤP KHÔNG một món đồ: bé mặc được vương miện mà chưa từng mua — và
       *   tệ hơn, hàng mới đó khiến cửa hàng hiển thị "Đã có", nên bé không bao giờ trả tiền cho
       *   nó nữa. Một lỗ hổng kinh tế im lặng, đúng loại mà `buy()` đã chặn ở nhánh
       *   `if (!item) throw errors.itemNotFound()`.
       *
       *   `quantity <= 0`: một hàng `inventory` với số lượng 0 nghĩa là "đã TỪNG sở hữu, hiện
       *   không còn" — `grantItemInTx` cố ý không xoá hàng khi hết (`đã từng mua` là vĩnh viễn).
       *   Hôm nay chỉ đồ ăn chạm tới 0, mà đồ ăn đã bị chặn ngay trên; nhưng điều kiện này nói về
       *   SỰ SỞ HỮU chứ không về nhóm, nên nó vẫn đúng nếu sau này có món tiêu được khác.
       */
      if (!owned || owned.quantity <= 0) throw errors.itemNotFound();

      /**
       * Ghi vô điều kiện, kể cả khi giá trị đã đúng.
       *
       * ⭐ Vì sao không `if (owned.equipped !== equipped)`: nhánh đó KHÔNG QUAN SÁT ĐƯỢC — bỏ nó
       *   đi cho kết quả y hệt, nên nó là một nhánh mà không bài test nào có thể chứng minh là
       *   cần thiết. Một nhánh như vậy chỉ tồn tại để che một lỗi trong tương lai.
       *   `UPDATE` đặt lại cùng giá trị là thao tác idempotent sẵn có của SQL — không cần tự viết
       *   lại tính idempotent bằng tay.
       */
      db.prepare('UPDATE inventory SET equipped = ? WHERE child_id = ? AND item_id = ?').run(
        equipped ? 1 : 0,
        childId,
        item.id,
      );

      /**
       * Đọc lại ĐÚNG trạng thái vừa ghi thay vì tự dựng object từ dữ liệu đầu vào.
       *
       * ⚠️ Nếu `UPDATE` ở trên không thật sự tác động hàng nào (ví dụ `item_id` bị đổi ở một lần
       *    sửa sau này), ta TRẢ VỀ trạng thái thật — và trạng thái thật đó nói "món này vẫn chưa
       *    được mặc". Tự dựng object từ `equipped` sẽ trả về một lời nói dối mà client vẽ ra như
       *    thật, còn nguyên nhân thì không bao giờ nổi lên.
       */
      return {
        item,
        inventory: this.readInventory(db, childId),
        pet: this.readPet(db, childId),
      };
    });
  }

  /** Giá của một vật phẩm, quy về ĐÚNG loại tiền tệ của nó. */
  private priceOf(item: ShopItem): { stars?: number; acorns?: number } {
    return item.currency === 'stars' ? { stars: item.price } : { acorns: item.price };
  }

  /**
   * Đọc một hàng `inventory` vừa ghi, ném lỗi nếu không thấy.
   *
   * ⚠️ Dùng cho nhánh "chắc chắn vừa ghi xong". Nếu không đọc ra hàng đó, suy luận ở trên đã
   *    sai — và một `undefined` lọt tới client sẽ thành `undefined.quantity` ở tầng vẽ giao
   *    diện (màn hình trắng), trong khi nguyên nhân thật nằm ở đây. Ném ra để nó vào log.
   */
  private requireInventoryItem(db: Db, childId: string, itemId: string): InventoryItem {
    const row = this.readInventoryItem(db, childId, itemId);
    if (!row) {
      throw errors.internal('Vừa thêm vật phẩm vào túi nhưng không đọc lại được');
    }
    return row;
  }

  // --- Trao thưởng (trong transaction) -------------------------------------

  /**
   * Trao một gói phần thưởng. Trả về những gì THỰC SỰ mới được trao.
   *
   * ⚠️ PHẢI được gọi bên trong một transaction đã mở (xem `transaction()` ở `db/connection`).
   *    Người gọi điều phối nhiều bảng trong cùng một đơn vị công việc — ví dụ T054 ghi lượt chơi
   *    + tiến độ từng từ + ví. Nếu hàm này tự mở transaction riêng, nó sẽ thoát ra ngoài
   *    transaction của người gọi và phá vỡ tính "hoặc tất cả, hoặc không gì".
   *
   * ⭐ LŨY ĐẲNG THEO TỰ NHIÊN VỚI HUY HIỆU VÀ STICKER: khoá chính của `badge_earned` là
   *   `(child_id, badge_id)`, nên `INSERT OR IGNORE` tự chặn trao trùng. Ta dùng `changes` để
   *   biết đâu là phần thưởng MỚI — nhờ vậy overlay không ăn mừng lại một huy hiệu bé đã có.
   *
   * ⚠️ TIỀN TỆ THÌ KHÔNG LŨY ĐẲNG — cố ý. `stars`/`acorns` là CỘNG DỒN. Chống cộng trùng không
   *    nằm ở đây mà ở tầng trên: `game_result.client_event_id` chặn ghi lại cùng một lượt chơi.
   *    Nếu ai đó gọi hàm này hai lần cho cùng một sự kiện thì tiền sẽ cộng hai lần — và đó là
   *    lý do `GameResultService` phải là nơi duy nhất quyết định "sự kiện này đã được xử lý chưa".
   */
  applyGrantsInTx(db: Db, childId: string, grants: GrantBundle, at: string): AppliedGrants {
    const applied = emptyGrants();

    const stars = Math.max(0, Math.floor(grants.stars ?? 0));
    const acorns = Math.max(0, Math.floor(grants.acorns ?? 0));

    if (stars > 0 || acorns > 0) {
      this.addCurrencyInTx(db, childId, { stars, acorns }, at);
      applied.starsGained = stars;
      applied.acornsGained = acorns;
    }

    for (const badgeId of grants.badges ?? []) {
      if (this.grantBadgeInTx(db, childId, badgeId, at)) applied.badgeIds.push(badgeId);
    }

    for (const sticker of grants.stickers ?? []) {
      if (this.grantStickerInTx(db, childId, sticker.stickerId, sticker.lessonId ?? null, at)) {
        applied.stickerIds.push(sticker.stickerId);
      }
    }

    for (const item of grants.items ?? []) {
      const isNew = this.grantItemInTx(db, childId, item.itemId, item.quantity ?? 1, at);
      if (isNew) applied.itemIds.push(item.itemId);
    }

    return applied;
  }

  /**
   * Cộng tiền tệ. CHỈ CỘNG — không có tham số âm.
   *
   * ⚠️ Vì sao không cho phép số âm để "trừ cho tiện": mọi lần trừ tiền đều phải đi qua
   *    `spendInTx` để có điều kiện `>=` bảo vệ. Một hàm "cộng" nhận số âm là đường lách qua
   *    đúng cái bảo vệ đó, và nó trông hoàn toàn vô hại ở chỗ gọi.
   *
   * ⭐ ĐÂY CŨNG LÀ CHỖ DUY NHẤT CẬP NHẬT **TỔNG ĐÃ KIẾM** (`stars_earned_total` /
   *    `acorns_earned_total`, migration 009) — và đó là lý do hai cột đó nằm lại được trong một
   *    câu `UPDATE` duy nhất ở đây thay vì ở tầng trên:
   *
   *    • SỐ DƯ (`stars`/`acorns`) và TỔNG ĐÃ KIẾM là hai con số KHÁC NHAU: số dư giảm khi bé
   *      tiêu (xem `spendInTx`), còn tổng đã kiếm CHỈ TĂNG. Huy hiệu `earn_currency` phải đo
   *      tổng đã kiếm, vì huy hiệu là SƯU TẦM VĨNH VIỄN — đo bằng số dư thì bé tiêu ⭐ là "mất"
   *      huy hiệu đã đạt. Xem ghi chú đầy đủ ở `009_wallet_lifetime.sql`.
   *
   *    • Ghi cả hai trong MỘT câu lệnh khiến chúng không thể lệch nhau: không có khoảnh khắc
   *      "số dư đã tăng mà tổng chưa" (hay ngược lại) để một reader bắt gặp.
   *
   *    ⚠️ `spendInTx` CỐ TÌNH KHÔNG đụng tới hai cột tổng — tiêu tiền không làm giảm "đã kiếm".
   */
  addCurrencyInTx(
    db: Db,
    childId: string,
    delta: { stars?: number; acorns?: number },
    at: string,
  ): void {
    const stars = Math.max(0, Math.floor(delta.stars ?? 0));
    const acorns = Math.max(0, Math.floor(delta.acorns ?? 0));
    if (stars === 0 && acorns === 0) return;

    this.ensureWalletRow(db, childId, at);
    db.prepare(
      `UPDATE wallet
          SET stars               = stars + ?,
              acorns              = acorns + ?,
              stars_earned_total  = stars_earned_total + ?,
              acorns_earned_total = acorns_earned_total + ?,
              updated_at          = ?
        WHERE child_id = ?`,
    ).run(stars, acorns, stars, acorns, at, childId);
  }

  /**
   * Trừ tiền khi mua. Ném `INSUFFICIENT_FUNDS` nếu không đủ.
   *
   * ⚠️ ĐIỀU KIỆN NẰM TRONG `WHERE` — xem quyết định 1 ở đầu file. Đây là điểm duy nhất trong
   *    toàn bộ luồng mua có thể khiến bé nhận được một món đồ mà không mất tiền, hoặc mất tiền
   *    hai lần cho một món. Cả hai đều là lỗi không thể sửa về sau.
   *
   * Thông báo lỗi CỐ TÌNH không nói "bé không đủ tiền" theo cách làm bé thấy kém cỏi — xem
   * `errors.insufficientFunds()`.
   */
  spendInTx(
    db: Db,
    childId: string,
    cost: { stars?: number; acorns?: number },
    at: string,
  ): void {
    const stars = Math.max(0, Math.floor(cost.stars ?? 0));
    const acorns = Math.max(0, Math.floor(cost.acorns ?? 0));
    if (stars === 0 && acorns === 0) return;

    this.ensureWalletRow(db, childId, at);

    const result = db
      .prepare(
        `UPDATE wallet SET stars = stars - ?, acorns = acorns - ?, updated_at = ?
           WHERE child_id = ? AND stars >= ? AND acorns >= ?`,
      )
      .run(stars, acorns, at, childId, stars, acorns);

    // `changes === 0` ở đây KHÔNG mơ hồ như ở `INSERT OR IGNORE`: hàng chắc chắn tồn tại (vừa
    // `ensureWalletRow`), nên mệnh đề `WHERE` chỉ có thể sai vì điều kiện số dư.
    if (result.changes === 0) throw errors.insufficientFunds();
  }

  // --- Huy hiệu / sticker / vật phẩm ---------------------------------------

  /** Trao huy hiệu. Trả `true` nếu đây là huy hiệu MỚI. */
  grantBadgeInTx(db: Db, childId: string, badgeId: string, at: string): boolean {
    const result = db
      .prepare('INSERT OR IGNORE INTO badge_earned (child_id, badge_id, earned_at) VALUES (?, ?, ?)')
      .run(childId, badgeId, at);
    /**
     * ⚠️ Ở ĐÂY `changes === 0` LÀ MƠ HỒ, VÀ TA CHẤP NHẬN ĐIỀU ĐÓ — khác hẳn `GameResultService`.
     *
     *   `INSERT OR IGNORE` nuốt cả lỗi `CHECK`/`FOREIGN KEY`, không chỉ lỗi trùng khoá. Nhưng
     *   bảng này chỉ có ba cột, hai cột đầu là khoá chính, cột thứ ba là TEXT không ràng buộc.
     *   Ngoại lệ `FOREIGN KEY` (child_id không tồn tại) đã bị chặn từ trước đó bởi
     *   `requireChild()`. Nên nhánh "bị từ chối vì lý do khác" không tồn tại.
     *   ⇒ `changes === 0` nghĩa là "huy hiệu này đã có", và bỏ qua là hành vi đúng.
     */
    return result.changes > 0;
  }

  /** Trao sticker. Trả `true` nếu đây là sticker MỚI. */
  grantStickerInTx(
    db: Db,
    childId: string,
    stickerId: string,
    lessonId: string | null,
    at: string,
  ): boolean {
    const result = db
      .prepare(
        'INSERT OR IGNORE INTO sticker_earned (child_id, sticker_id, lesson_id, earned_at) VALUES (?, ?, ?, ?)',
      )
      .run(childId, stickerId, lessonId, at);
    // Cùng lý do như `grantBadgeInTx`.
    return result.changes > 0;
  }

  /**
   * Thêm vật phẩm vào túi. Trả `true` nếu bé SỞ HỮU nó lần đầu.
   *
   * ⭐ VÌ SAO `quantity` CỘNG DỒN NHƯNG KHÔNG BAO GIỜ BỊ TRỪ ĐẾN 0:
   *   Vật phẩm ăn được (nhóm `food`) bị tiêu khi cho ăn ⇒ `quantity` phải giảm được. Nhưng
   *   "đã từng mua" là VĨNH VIỄN (quyết định C2: không bao giờ mất vật phẩm đã mua) — nên
   *   `quantity` chạm 0 thì HÀNG VẪN CÒN, và cửa hàng biết bé đã từng sở hữu nó.
   *   Vì vậy hàm này KHÔNG xoá hàng khi `quantity` về 0, và `consumeItemInTx` cũng không xoá.
   */
  grantItemInTx(db: Db, childId: string, itemId: string, quantity: number, at: string): boolean {
    const amount = Math.max(1, Math.floor(quantity));
    const existing = db
      .prepare('SELECT quantity FROM inventory WHERE child_id = ? AND item_id = ?')
      .get(childId, itemId) as { quantity: number } | undefined;

    if (!existing) {
      db.prepare(
        'INSERT INTO inventory (child_id, item_id, quantity, equipped, acquired_at) VALUES (?, ?, ?, 0, ?)',
      ).run(childId, itemId, amount, at);
      return true;
    }

    db.prepare(
      'UPDATE inventory SET quantity = quantity + ? WHERE child_id = ? AND item_id = ?',
    ).run(amount, childId, itemId);
    return false;
  }

  /**
   * Tiêu thụ `quantity` đơn vị một vật phẩm đã sở hữu (cho ăn).
   *
   * ⚠️ Điều kiện `quantity >= ?` nằm trong `WHERE`, cùng lý do như `spendInTx`.
   *    Ném `ITEM_NOT_FOUND` khi không đủ để tiêu — câu này dành cho phụ huynh đọc log; bé thì
   *    thấy màn hình "mình chưa có món này", không phải một lỗi đỏ.
   */
  consumeItemInTx(db: Db, childId: string, itemId: string, quantity: number): void {
    const amount = Math.max(1, Math.floor(quantity));
    const result = db
      .prepare('UPDATE inventory SET quantity = quantity - ? WHERE child_id = ? AND item_id = ? AND quantity >= ?')
      .run(amount, childId, itemId, amount);

    if (result.changes === 0) throw errors.itemNotFound();
  }

  // --- Thú cưng & chuỗi ngày ----------------------------------------------

  /**
   * Cập nhật trạng thái thú cưng trong transaction.
   *
   * ⚠️ `happiness` LUÔN bị kẹp về `[1, 5]` trước khi ghi. DB đã có `CHECK (happiness BETWEEN
   *    1 AND 5)`, nhưng kẹp ở đây cho một hành vi TỐT HƠN: nếu tầng trên tính sai (ví dụ trừ
   *    quá tay), ta hạ xuống SÀN 1 và bé vẫn thấy linh vật vui vẻ — thay vì ném một lỗi
   *    `SQLITE_CONSTRAINT` làm hỏng cả giao dịch và mất luôn phần thưởng của lượt chơi đó.
   *    SÀN = 1 là quyết định thiết kế (không bao giờ buồn bã hoàn toàn), không phải chi tiết.
   */
  setPetHappinessInTx(db: Db, childId: string, happiness: number, at: string): void {
    const clamped = Math.min(5, Math.max(1, Math.floor(happiness)));
    this.ensurePetRow(db, childId, at);
    db.prepare('UPDATE pet_state SET happiness = ?, updated_at = ? WHERE child_id = ?').run(
      clamped,
      at,
      childId,
    );
  }

  /** Ghi lại lần cho ăn gần nhất. */
  touchPetFedInTx(db: Db, childId: string, at: string): void {
    this.ensurePetRow(db, childId, at);
    db.prepare('UPDATE pet_state SET last_fed_at = ?, updated_at = ? WHERE child_id = ?').run(
      at,
      at,
      childId,
    );
  }

  /**
   * Tổng số từ bé ĐÃ HỌC — nguồn DUY NHẤT của tiến hoá (T066).
   *
   * ⭐ `word_progress.learned = 1` là sự thật gốc: mỗi từ bé đã gặp và học được ghi một hàng ở
   *   đó, do `ProgressService` cập nhật. Đếm ở đây (thay vì cộng dồn `daily_stats.words_learned`)
   *   vì phép cộng dồn có thể đếm trùng khi một từ được học lại ở bài khác, còn `word_progress`
   *   có khoá chính `(child_id, word_id)` ⇒ một từ chỉ được đếm đúng một lần, mãi mãi.
   *
   * ⚠️ `learned = 1` chứ không phải `mastered = 1`: tiến hoá thưởng cho việc HỌC, không phải cho
   *    việc đã thuộc lòng. Bắt bé phải "mastered" mới lớn được là dựng thêm một kỳ thi.
   */
  countLearnedWords(db: Db, childId: string): number {
    const row = db
      .prepare('SELECT COUNT(*) AS n FROM word_progress WHERE child_id = ? AND learned = 1')
      .get(childId) as { n: number } | undefined;
    return row?.n ?? 0;
  }

  /**
   * Giai đoạn tiến hoá theo tổng số từ đã học.
   *
   * ⭐ KHÔNG có tham số tiền, KHÔNG có đường nào mua được giai đoạn: bảng `exp` của bé không dính
   *   dáng tới đây. Đây là điểm khác biệt có chủ ý so với túi đồ — thứ mua được thì phải mua,
   *   còn "lớn lên" là phần thưởng của việc học, và chỉ của việc học.
   */
  evaluateEvolution(totalWords: number): PetState['evolutionStage'] {
    return getEvolutionStage(totalWords).stage;
  }

  /**
   * Số NGÀY TRỌN VẸN kể từ lần cuối bé "để tâm tới Momo" — dùng để tính hao hụt ❤️.
   *
   * ⭐ NEO = **muộn hơn** trong hai mốc: `streak_state.last_active_date` (bé có học) và
   *   `pet_state.updated_at` (hàng của Momo vừa được ghi — tức là bé vừa cho ăn).
   *
   * ⚠️⚠️ VÌ SAO KHÔNG CHỈ DÙNG `last_fed_at` — dù ghi chú ở `feedPet` (viết từ T052) đã hẹn
   *   rằng `computeHappiness` sẽ dùng nó:
   *
   *   Lấy "lần cho ăn gần nhất" làm mốc nghĩa là một bé **học mỗi ngày** nhưng không tiêu ⭐ vào
   *   đồ ăn sẽ thấy Momo buồn dần. Bé 7 tuổi đọc điều đó thành *"Momo buồn vì mình không cho ăn"*
   *   ⇒ một áp lực tiêu tiền đặt lên một đứa trẻ, và tệ hơn: đó là một lời trách móc — cùng họ
   *   với mắng trẻ (luật số một của dự án). Vì vậy việc HỌC cũng phải tính là "bé có mặt".
   *
   * ⚠️⚠️ VÌ SAO CŨNG KHÔNG CHỈ DÙNG `last_active_date`: đó là bản sửa của một LỖI THẬT mà test
   *   bắt được. Nếu neo chỉ vào ngày học, thì khi bé xa 3 ngày rồi quay lại cho ăn: `feed` đọc
   *   mức đã hao (1), ghi 1 + 1 = 2 — nhưng lần ĐỌC LẠI ngay sau đó lại áp hao hụt với CÙNG
   *   `daysAway = 3` ⇒ trả về 1. Bé cho Momo ăn một quả chuối và **thanh ❤️ không nhích** — đúng
   *   kiểu "lấy gì của bé mà không đổi lại được gì" mà dự án cấm. Lấy mốc muộn hơn sửa được
   *   việc này: `setPetHappinessInTx` và `touchPetFedInTx` đều đẩy `pet_state.updated_at` lên
   *   `now`, nên ngay sau khi cho ăn, `daysAway` trở thành 0 và ❤️ hiện đúng con số vừa ghi.
   *
   * ⚠️ Không có mốc nào (bé vừa tạo hồ sơ, chưa học buổi nào và chưa từng cho ăn) ⇒ trả 0 ⇒
   *    KHÔNG hao. Một bé vừa được tạo hồ sơ mà đã bị trừ ❤️ là vô nghĩa.
   */
  daysAwayFromApp(db: Db, childId: string): number {
    const streak = db
      .prepare('SELECT last_active_date FROM streak_state WHERE child_id = ?')
      .get(childId) as { last_active_date: string | null } | undefined;
    const pet = db
      .prepare('SELECT updated_at FROM pet_state WHERE child_id = ?')
      .get(childId) as { updated_at: string } | undefined;

    /**
     * ⚠️ So sánh bằng KHOÁ NGÀY (`YYYY-MM-DD`), không bằng ISO: `last_active_date` là khoá ngày
     *    còn `updated_at` là ISO đầy đủ. So chuỗi thô sẽ so "2026-10-08" với "2026-10-08T08:00:…"
     *    — chuỗi ngắn hơn luôn nhỏ hơn, nên mốc muộn hơn bị chọn SAI tuỳ độ dài chuỗi.
     */
    const anchors: string[] = [];
    if (streak?.last_active_date != null) anchors.push(streak.last_active_date);
    if (pet !== undefined) {
      const touchedAt = new Date(pet.updated_at);
      if (!Number.isNaN(touchedAt.getTime())) anchors.push(localDateKey(touchedAt));
    }
    if (anchors.length === 0) return 0;

    // Khoá ngày so sánh được bằng thứ tự từ điển (YYYY-MM-DD) ⇒ `reduce` cho ra mốc muộn nhất.
    const anchor = anchors.reduce((latest, candidate) =>
      candidate > latest ? candidate : latest,
    );
    return Math.max(0, daysBetweenDateKeys(anchor, localDateKey()));
  }

  // --- Tạo hàng khi cần ----------------------------------------------------

  private ensureWalletRow(db: Db, childId: string, at: string): void {
    db.prepare(
      'INSERT OR IGNORE INTO wallet (child_id, stars, acorns, updated_at) VALUES (?, 0, 0, ?)',
    ).run(childId, at);
  }

  /**
   * Bảo đảm hàng `xp_state` tồn tại.
   *
   * ⚠️ PUBLIC, KHÔNG PHẢI PRIVATE — và đây là chủ ý.
   *
   *   `xp_state` có HAI người dùng với hai vai khác hẳn nhau:
   *     • `XpService` là bên GHI — nó biết luật XP (suy cấp, phát hiện vượt cấp, trao quà).
   *     • `RewardService` (file này) là bên ĐỌC — nó dựng `RewardSnapshot` cho `GET /rewards`.
   *
   *   Hình dạng hàng, việc tạo hàng khi thiếu, và câu SQL đọc thì chỉ nên có MỘT bản. Đặt tất
   *   cả ở đây rồi để `XpService` gọi sang là cách duy nhất giữ được điều đó mà không tạo vòng
   *   import (`XpService` → `RewardService` để trao quà; nếu `RewardService` cũng → `XpService`
   *   thì hai module phụ thuộc nhau và thứ tự nạp trở thành thứ phải suy nghĩ).
   *
   *   Nói cách khác: file này quản lý HÀNG, `XpService` quản lý LUẬT.
   */
  ensureXpRowInTx(db: Db, childId: string, at: string): void {
    db.prepare(
      'INSERT OR IGNORE INTO xp_state (child_id, xp, level, updated_at) VALUES (?, 0, 1, ?)',
    ).run(childId, at);
  }

  private ensurePetRow(db: Db, childId: string, at: string): void {
    db.prepare(
      `INSERT OR IGNORE INTO pet_state
         (child_id, evolution_stage, happiness, equipped_item_ids, last_fed_at, updated_at)
       VALUES (?, 'egg', 3, '[]', NULL, ?)`,
    ).run(childId, at);
  }

  /**
   * Kiểm quyền sở hữu. Ném `CHILD_NOT_FOUND` nếu không phải con của phụ huynh này.
   *
   * ⚠️ `childId` đến từ URL, KHÔNG BAO GIỜ từ body — xem ghi chú ở `routes/progress.ts`.
   *    Không có route nào ở đây được phép tin `childId` do client gửi trong payload.
   */
  private requireChild(parentId: string, childId: string): void {
    const child = this.children.getChild(parentId, childId);
    if (!child) throw errors.childNotFound();
  }

  /** Ngày hôm nay theo GIỜ ĐỊA PHƯƠNG của gia đình — dùng cho chuỗi ngày. */
  todayKey(date: Date = new Date()): string {
    return localDateKey(date);
  }
}

/** Dùng chung một instance. */
export const rewardService = new RewardService();
