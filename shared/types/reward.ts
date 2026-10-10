/**
 * RubyLingo — Kiểu dữ liệu THƯỞNG: tiền tệ, XP, thú cưng, nhiệm vụ, cửa hàng, sưu tầm.
 *
 * Triết lý "KHÔNG BAO GIỜ MẮNG ĐỨA TRẺ":
 *   - Không trừ điểm, không trừ tiền, không mất vật phẩm đã mua.
 *   - `happiness` có SÀN = 1 ⇒ linh vật không bao giờ buồn bã hoàn toàn.
 *   - Không xếp hạng, không so sánh giữa các bé.
 */

// =============================================================================
// Phần thưởng được trao
// =============================================================================

/**
 * Một phần thưởng cụ thể được trao.
 *
 * Định nghĩa ở ĐÂY (miền "thưởng"), không ở progress.ts: `XpLevelDefinition` và
 * `QuestDefinition` đều cần kiểu này, còn progress.ts chỉ tiêu thụ nó.
 */
export interface RewardGrant {
  kind: 'stars' | 'acorns' | 'xp' | 'badge' | 'sticker' | 'item';
  /** id của huy hiệu / sticker / vật phẩm; không dùng cho tiền tệ. */
  refId?: string;
  amount?: number;
}

// =============================================================================
// Tiền tệ & XP
// =============================================================================

/** Hai loại tiền tệ. KHÔNG có tiền thật, KHÔNG có paywall. */
export type CurrencyKind = 'stars' | 'acorns';

export interface Wallet {
  childId: string;
  /** ⭐ Sao — tiền tệ phổ thông, kiếm nhanh, tiêu hằng ngày. */
  stars: number;
  /** 🌰 Hạt dẻ — tiền tệ hiếm, mua vật phẩm đặc biệt. */
  acorns: number;
  updatedAt: string;
}

export interface XpState {
  childId: string;
  xp: number;
  /** Cấp hiện tại 1–7, suy ra từ `xp` theo shared/content/xp-levels.json. */
  level: number;
  updatedAt: string;
}

/** Một bậc trong bảng 7 cấp Nhà thám hiểm. */
export interface XpLevelDefinition {
  level: number;
  title_vi: string;
  icon: string;
  /** XP tối thiểu để đạt cấp này. */
  xpRequired: number;
  rewards: RewardGrant[];
}

// =============================================================================
// Thú cưng
// =============================================================================

/**
 * Giai đoạn tiến hoá — theo TỔNG SỐ TỪ ĐÃ HỌC, không mua được bằng tiền.
 *
 * ⚠️ BA BẬC, KHÔNG CÒN `'egg'` (T04). Bậc `'egg'` (🥚) đã bị bỏ: khi bé CHỌN con mình muốn ngay
 *   từ đầu, giữ một quả trứng vô danh làm bậc 0 nghĩa là bé vừa chọn "Rồng" xong lại thấy 🥚 —
 *   chọn con mà không thấy con. Nay bậc đầu là `'baby'` (con non bé vừa chọn). Bảng ngưỡng nằm ở
 *   `shared/content/xp-levels.json` (`wordsRequired` 0 / 40 / 120).
 *
 * ⚠️ PHẢI KHỚP `xpLevelsFileSchema.evolutionStages[].stage` trong `shared/schemas/content.ts`.
 */
export type EvolutionStage = 'baby' | 'adult' | 'super';

/**
 * id thú cưng bé chọn — một CHUỖI, KHÔNG phải union các con cụ thể.
 *
 * ⭐ VÌ SAO KHÔNG PHẢI `'monkey' | 'cat' | 'dog' | ...`:
 *   "Có những con nào" là DỮ LIỆU (`shared/content/pets.json`), không phải mã. Một union cứng
 *   buộc mỗi lần thêm con mới phải deploy cả client lẫn server, và một bản deploy cũ sẽ coi con
 *   mới là "lạ" — trong khi `pet_state.pet_type` là cột TEXT không có `CHECK` enum (xem migration
 *   `011`). Server kiểm id hợp lệ bằng `isPetId()` (`shared/content/pets.ts`), tra từ danh mục.
 */
export type PetType = string;

/**
 * Một con thú cưng trong danh mục — định nghĩa TĨNH ở `shared/content/pets.json`.
 *
 * Dùng CHUNG: server cần `id` để kiểm/parse `pet_type`; client cần `name_vi` + 3 emoji để vẽ
 * `PetAvatar` và màn chọn con. Một định nghĩa, hai người dùng.
 */
export interface PetDefinition {
  id: string;
  name_vi: string;
  name_en: string;
  /** Emoji giai đoạn `baby`. */
  iconBaby: string;
  /** Emoji giai đoạn `adult`. */
  iconAdult: string;
  /** Emoji giai đoạn `super`. */
  iconSuper: string;
  /** Giai đoạn ra mắt: 'mvp' | 'p1' | 'p2'. */
  phase: 'mvp' | 'p1' | 'p2';
}

export interface EvolutionStageDefinition {
  stage: EvolutionStage;
  name_vi: string;
  icon: string;
  /** Số từ đã học cần để đạt giai đoạn này. */
  wordsRequired: number;
}

export interface PetState {
  childId: string;
  evolutionStage: EvolutionStage;
  /**
   * Con thú cưng của bé — ĐÃ PHÂN GIẢI, **KHÔNG BAO GIỜ null**.
   *
   * ⭐ VÌ SAO LUÔN CÓ GIÁ TRỊ (khác `petChosen` ngay dưới): server LUÔN trả về một con có thật.
   *   `pet_state.pet_type` trong DB là nullable (bé cũ chưa từng chọn), nhưng nếu để client tự
   *   quyết định "chưa chọn thì hiện gì", thì mọi màn vẽ Momo phải có một nhánh cho "chưa có con"
   *   — và nhánh đó luôn là nhánh bị bỏ quên khi thêm màn mới (đúng loại lỗi im lặng dự án cấm).
   *   Thay vào đó server phân giải NULL/lạ về `DEFAULT_PET_ID` (`'monkey'` — xem
   *   `RewardService.readPet`), nên client vẽ `petType` VÔ ĐIỀU KIỆN.
   *
   *   Việc "bé đã chọn con chưa" là câu hỏi KHÁC, trả lời bằng `petChosen`.
   */
  petType: PetType;
  /**
   * Bé đã CHỌN con thú cưng của mình chưa — `true` khi và chỉ khi DB có `pet_type`.
   *
   * ⭐ VÌ SAO CẦN RIÊNG CỜ NÀY (không suy ra được từ `petType`): `petType` LUÔN có giá trị (đã
   *   phân giải về mặc định), nên nó KHÔNG nói được bé đã chọn hay chưa. Nhưng nhà thú cưng cần
   *   biết đúng điều đó để quyết định có MỞ MÀN CHỌN CON hay không: bé mới (`false`) phải được
   *   mời chọn; bé đã chọn rồi (`true`) phải vào thẳng nhà. Suy từ `petType === DEFAULT_PET_ID`
   *   là SAI — một bé thật sự chọn con Khỉ cũng có `petType === 'monkey'`.
   */
  petChosen: boolean;
  /**
   * Số TỪ ĐÃ HỌC của bé — CHÍNH con số server dùng để suy ra `evolutionStage` ngay trên.
   *
   * ⭐ VÌ SAO PHẢI TRẢ RA (T071.1): màn Hồ sơ nhà thám hiểm (M13) cần vẽ thanh "còn bao nhiêu
   *   từ nữa thì Momo lớn hơn". Trước đây client tự đếm từ trong `progressStore` — đó là một
   *   NGUỒN SỰ THẬT THỨ HAI, và nó LỆCH với server đúng ở ca đáng quan tâm nhất: bé chơi offline
   *   rồi mới đồng bộ, hoặc mở app trên thiết bị thứ hai (máy kia chưa có dữ liệu). Trả về đúng
   *   con số mà server ĐÃ dùng để chọn `evolutionStage` khiến thanh tiến độ và hình dáng linh vật
   *   KHÔNG THỂ nói khác nhau.
   */
  wordsLearned: number;
  /** Chỉ số Vui vẻ 1–5. SÀN = 1: linh vật không bao giờ buồn bã hoàn toàn. */
  happiness: number;
  /** id các vật phẩm đang mặc/đang trưng bày. */
  equippedItemIds: string[];
  lastFedAt: string | null;
  updatedAt: string;
}

// =============================================================================
// Cửa hàng & túi đồ
// =============================================================================

export type ShopItemCategory = 'food' | 'accessory' | 'decoration';

/**
 * Vị trí GẮN phụ kiện lên người Momo (T065).
 *
 * ⭐ VÌ SAO LÀ DỮ LIỆU CHỨ KHÔNG PHẢI MỘT BẢNG TRA TRONG COMPONENT:
 *   `PetAvatar` phải biết mũ nằm trên đầu và giày nằm dưới chân. Nếu bảng "món nào đi đâu" sống
 *   trong `src/`, thì thêm một chiếc mũ mới vào `shop-items.json` sẽ khiến nó **biến mất khỏi
 *   Momo** mà không có lỗi nào — đúng loại hỏng im lặng mà dự án này cấm. Để `slot` nằm trong
 *   JSON, cạnh `price` và `icon`, nghĩa là món mới KHÔNG THỂ hợp lệ mà thiếu vị trí (schema
 *   `shopItemsFileSchema` từ chối), và server cũng đọc được cùng một sự thật.
 */
export type AccessorySlot = 'head' | 'face' | 'neck' | 'back' | 'feet';

/**
 * Vị trí BÀY trang trí quanh cảnh nhà Momo (T065) — quyết định C3.
 *
 * ⭐ CHỈ HAI VỊ TRÍ, VÀ ĐÓ LÀ CHỦ Ý: `sky` (trên cao: bóng bay, cầu vồng, đèn lồng) và `ground`
 *   (dưới đất: chậu cây, bể cá, lâu đài). Mỗi vị trí là một HÀNG ngang tự xuống dòng, nên 10 món
 *   trang trí không bao giờ chồng lên nhau dù bé bật hết. Đặt toạ độ tuyệt đối cho từng món sẽ
 *   đẹp hơn trên laptop và vỡ trên iPhone 320px — mà "vỡ trên máy của bé" là hỏng thật.
 */
export type DecorationSlot = 'sky' | 'ground';

/** Mọi vị trí một vật phẩm có thể chiếm. */
export type PetSlot = AccessorySlot | DecorationSlot;

/** Vật phẩm trong cửa hàng — định nghĩa TĨNH ở shared/content/shop-items.json. */
export interface ShopItem {
  id: string;
  name_vi: string;
  /** Icon dùng emoji ⇒ 0 request tải ảnh. */
  icon: string;
  category: ShopItemCategory;
  /**
   * Vị trí vật phẩm chiếm trên Momo (phụ kiện) hoặc trong cảnh (trang trí).
   *
   * ⚠️ `undefined` CHỈ hợp lệ với đồ ăn — schema từ chối phụ kiện/trang trí thiếu `slot`. Kiểu
   *    để tuỳ chọn vì `ShopItem` là kiểu DÙNG CHUNG cho cả ba nhóm, còn luật "nhóm nào phải có
   *    slot" nằm ở tầng dữ liệu, nơi nó có thể chạy được.
   */
  slot?: PetSlot;

  /** Giá theo loại tiền tệ tương ứng. */
  price: number;
  currency: CurrencyKind;
  /** Mô tả ngắn hiển thị cho bé. */
  description_vi: string;
  /** Số ❤️ cộng thêm khi cho ăn (chỉ nhóm food). */
  happinessGain?: number;
  /** Hiệu ứng đặc biệt khi dùng (lấp lánh, animation lớn...). */
  effect?: 'sparkle' | 'big_animation' | 'rainbow';
  /** Giai đoạn ra mắt: 'mvp' | 'p1' | 'p2'. */
  phase: 'mvp' | 'p1' | 'p2';
}

/** Một vật phẩm bé đã sở hữu. Đã mua = VĨNH VIỄN, không bao giờ bị thu hồi. */
export interface InventoryItem {
  childId: string;
  itemId: string;
  quantity: number;
  equipped: boolean;
  acquiredAt: string;
}

// =============================================================================
// Huy hiệu & Sticker (sưu tầm — KHÔNG tiêu được)
// =============================================================================

export interface BadgeDefinition {
  id: string;
  name_vi: string;
  icon: string;
  description_vi: string;
  /** Điều kiện đạt — server đánh giá theo sự kiện. */
  criteria: BadgeCriteria;
  phase: 'mvp' | 'p1' | 'p2';
}

export type BadgeCriteria =
  | { kind: 'complete_lesson'; lessonId: string }
  | { kind: 'complete_theme'; themeId: string }
  | { kind: 'perfect_lessons'; count: number }
  | { kind: 'streak_days'; days: number }
  | { kind: 'reach_level'; level: number }
  | { kind: 'earn_currency'; currency: CurrencyKind; amount: number }
  | { kind: 'win_game'; gameType: string; count: number }
  /**
   * Hoàn thành CẢ bài thi cuối khoá (mọi phần đều có ≥1 lần nộp) — huy chương TỐT NGHIỆP.
   *
   * ⚠️ KHÔNG có tham số: "bài thi cuối khoá" là một thứ duy nhất của level đang dùng. Khi có
   *    Movers/Flyers, tiêu chí này sẽ cần một `levelId` — nhưng thêm bây giờ là thêm một trường
   *    chưa ai đọc (nguyên tắc "chỉ chép thứ server cần" của chỉ mục nội dung).
   */
  | { kind: 'complete_final_test' };

/**
 * Huy hiệu — định nghĩa TĨNH ở `shared/content/badges.json` (T068).
 *
 * ⭐ VÌ SAO TRƯỜNG LÀ `criteria` CHỨ KHÔNG PHẢI `condition`: cùng lý do như nhiệm vụ — điều kiện
 *   được DIỄN ĐẠT BẰNG DỮ LIỆU để `BadgeService` đánh giá được, thay vì mỗi huy hiệu một hàm
 *   trong code. Thêm huy hiệu mới = thêm một mục JSON, và `badgesFileSchema` từ chối mục sai.
 *
 * ⚠️ Huy hiệu là SƯU TẦM: đã đạt là VĨNH VIỄN, không bao giờ thu hồi (xem `005_collect.sql`).
 *    Hệ quả cho người viết tiêu chí: đừng dùng điều kiện có thể TỤT (ví dụ `wallet.stars` hiện
 *    có — bé tiêu ⭐ là tụt). Đó là lý do `earn_currency` phải đo TỔNG ĐÃ KIẾM, không phải số dư.
 */
export interface Badge {
  id: string;
  name_vi: string;
  icon: string;
  description_vi: string;
  criteria: BadgeCriteria;
  phase: 'mvp' | 'p1' | 'p2';
}

export interface StickerDefinition {
  id: string;
  name_vi: string;
  icon: string;
  /** Sticker mở theo bài học (phần thưởng biến thiên — bé không biết trước). */
  lessonId?: string;
  phase: 'mvp' | 'p1' | 'p2';
}

// =============================================================================
// Nhiệm vụ (3 tầng)
// =============================================================================

export type QuestTier = 'daily' | 'weekly' | 'milestone';

export interface QuestDefinition {
  id: string;
  tier: QuestTier;
  /** Câu hiển thị cho bé, ngôn ngữ hướng trẻ. */
  description_vi: string;
  icon: string;
  criteria: QuestCriteria;
  rewards: RewardGrant[];
  phase: 'mvp' | 'p1' | 'p2';
}

export type QuestCriteria =
  | { kind: 'complete_lessons'; count: number }
  /** Hoàn thành MỘT bài cụ thể — dùng cho chuỗi mốc mở khoá. */
  | { kind: 'complete_lesson'; lessonId: string }
  | { kind: 'play_games'; count: number }
  | { kind: 'correct_answers'; count: number }
  | { kind: 'learn_days'; count: number }
  | { kind: 'unlock_theme'; count: number }
  | { kind: 'complete_theme'; themeId: string }
  | { kind: 'collect_stickers'; count: number }
  | { kind: 'reach_level'; level: number }
  /**
   * Hoàn thành CẢ bài thi cuối khoá (mọi phần đều có ≥1 lần nộp) — nhiệm vụ MỐC tốt nghiệp.
   *
   * ⚠️ Là tiêu chí SUY DIỄN (đọc `final_test_attempt`), KHÔNG phải đếm: `QuestService` tính lại
   *    từ dữ liệu bền vững mỗi lần chạy, nên không có nguy cơ "gửi lại một sự kiện là cộng hai
   *    lần". `questTarget` trả 1 (một việc, hai trạng thái).
   */
  | { kind: 'complete_final_test' };

/**
 * Tiến độ một nhiệm vụ trong kỳ hiện tại.
 *
 * `periodKey` là chìa khoá reset KHÔNG CẦN CRON:
 *   daily     → "2026-10-06"
 *   weekly    → "2026-W41"
 *   milestone → "all"  (không reset)
 * Khi truy vấn, server tự suy ra periodKey hiện tại ⇒ kỳ cũ tự nhiên không khớp.
 */
export interface QuestProgress {
  childId: string;
  questId: string;
  periodKey: string;
  progress: number;
  target: number;
  completed: boolean;
  /** Đã bấm "Nhận thưởng" chưa. */
  claimed: boolean;
  claimedAt: string | null;
  updatedAt: string;
}

/** Nhiệm vụ kèm tiến độ — dữ liệu cho màn hình Nhiệm vụ (M9). */
export interface QuestWithProgress extends QuestDefinition {
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
}

// =============================================================================
// Chuỗi ngày (streak)
// =============================================================================

export interface StreakState {
  childId: string;
  /** Số ngày học liên tiếp hiện tại. */
  currentStreak: number;
  longestStreak: number;
  /** Ngày học gần nhất, YYYY-MM-DD. */
  lastActiveDate: string | null;
  /** Các mốc quà đã nhận: 3, 7, 14, 30. */
  milestonesClaimed: number[];
  updatedAt: string;
}

// =============================================================================
// Gói tổng hợp
// =============================================================================

/** Toàn bộ trạng thái thưởng của một bé — trả về từ GET /api/children/:id/rewards. */
export interface RewardSnapshot {
  childId: string;
  wallet: Wallet;
  xp: XpState;
  pet: PetState;
  streak: StreakState;
  inventory: InventoryItem[];
  badges: string[];
  stickers: string[];
  serverTime: string;
}

/** Kết quả sau khi mua vật phẩm. */
export interface PurchaseResult {
  item: ShopItem;
  wallet: Wallet;
  inventoryItem: InventoryItem;
}

/** Kết quả sau khi cho ăn. */
export interface FeedResult {
  pet: PetState;
  item: ShopItem;
  wallet: Wallet;
}

/**
 * Kết quả sau khi MẶC / BỎ RA một vật phẩm.
 *
 * ⭐ `inventory` LÀ **CẢ MẢNG**, KHÔNG PHẢI MỘT PHẦN TỬ.
 *   Client thay trọn mảng thay vì tự đi tìm phần tử rồi vá `equipped` tại chỗ. Một phép vá ở
 *   client là bản sao thứ hai của luật "món nào đang mặc" — và hai bản sao thì có ngày lệch
 *   nhau. Cả túi đồ có nhiều nhất vài chục món, nên gửi trọn gói rẻ hơn nhiều so với việc phải
 *   suy luận xem client đã vá đúng chưa.
 *
 * ⭐ `pet` ĐI KÈM VÌ ĐÓ LÀ KẾT QUẢ NHÌN THẤY ĐƯỢC.
 *   Bé bấm "Dùng ngay" để thấy Momo đội mũ. `PetAvatar` (T065) cần đúng trường này, và nó được
 *   server SUY RA từ `inventory` (xem `RewardService.readPet`) — nên nó không thể nói khác
 *   `inventory`. Trả nó ở đây để client không phải viết lại phép suy đó.
 */
export interface EquipmentResult {
  item: ShopItem;
  inventory: InventoryItem[];
  pet: PetState;
}
