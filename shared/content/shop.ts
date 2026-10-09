/**
 * RubyLingo — Danh mục cửa hàng, đọc từ `shared/content/shop-items.json`.
 *
 * ⚠️⚠️ VÌ SAO FILE NÀY NẰM Ở `shared/` CHỨ KHÔNG Ở `server/`:
 *   Cùng lý do như `shared/content/levels.ts`. Món đồ có HAI người dùng khác nhau:
 *     • SERVER cần `price` + `currency` để biết trừ bao nhiêu ⭐, và `happinessGain` để biết
 *       cho ăn được thêm mấy ❤️. Server PHẢI là bên quyết định giá — nếu tin giá do client gửi
 *       lên thì bé mua vương miện với giá 1 ⭐.
 *     • CLIENT cần `icon` + `name_vi` + `category` để VẼ túi đồ và màn cửa hàng.
 *       `RewardSnapshot` chỉ trả về `itemId` (kiểu `InventoryItem`), nên nếu client không có
 *       danh mục này thì nó phải hiển thị một chuỗi id thô như `acc-star-glasses`.
 *   Server KHÔNG import được `src/` (`tsconfig.server.json` chỉ gom `server/`, `shared/`,
 *   `scripts/`). Để danh mục ở `src/` nghĩa là server buộc phải có bản sao thứ hai — và bản
 *   sao thứ hai của GIÁ cả là loại lệch nguy hiểm nhất.
 *
 * ⭐ GIÁ VÀ PHẦN THƯỞNG ĐỀU LÀ DỮ LIỆU, KHÔNG PHẢI CODE. Thêm món mới = sửa JSON, không sửa
 *   file này. File này chỉ là lớp ĐỌC + TRA CỨU, không chứa con số nào của riêng nó.
 */

import raw from './shop-items.json';
import { ACCESSORY_SLOTS, DECORATION_SLOTS } from '../pet-slots.js';
import { shopItemsFileSchema } from '../schemas/content.js';
import type {
  AccessorySlot,
  CurrencyKind,
  DecorationSlot,
  PetSlot,
  ShopItem,
  ShopItemCategory,
} from '../types/reward.js';

/**
 * Kiểm NGAY LÚC NẠP MODULE — cùng lý do như `levels.ts`.
 *
 * Một danh mục hỏng phải làm server KHÔNG KHỞI ĐỘNG ĐƯỢC. Nếu để nó chạy, hậu quả là bé mua
 * một món với giá `undefined` (⇒ `spendInTx` trừ 0 ⭐ và món đồ vẫn vào túi) — một lỗ hổng
 * kinh tế im lặng, không có lỗi nào nổi lên.
 */
const parsed = shopItemsFileSchema.safeParse(raw);
if (!parsed.success) {
  throw new Error(
    'shared/content/shop-items.json không hợp lệ: ' +
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  );
}

/** Toàn bộ vật phẩm, GIỮ NGUYÊN thứ tự trong file (file đã nhóm theo `category`). */
export const SHOP_ITEMS: readonly ShopItem[] = parsed.data.items;

/**
 * Bảng tra theo id, dựng MỘT LẦN.
 *
 * ⚠️ Kiểm trùng id ngay tại đây, dù `validate-content.ts` cũng kiểm: validator là một script
 *    riêng, có thể không chạy (test đơn vị import thẳng file này). Hai vật phẩm cùng id sẽ
 *    khiến `Map` im lặng giữ cái SAU, tức là giá của một trong hai món biến mất tuỳ theo thứ
 *    tự dòng trong file — một bug chỉ đổi hành vi khi ai đó sắp xếp lại JSON.
 */
const byId = new Map<string, ShopItem>();
for (const item of SHOP_ITEMS) {
  if (byId.has(item.id)) {
    throw new Error(`shared/content/shop-items.json có hai vật phẩm cùng id: "${item.id}"`);
  }
  byId.set(item.id, item);
}

/** Tra vật phẩm theo id. Trả `undefined` khi không có — người gọi tự quyết định ném lỗi gì. */
export function getShopItem(itemId: string): ShopItem | undefined {
  return byId.get(itemId);
}

/** Bé có sở hữu vật phẩm này không — theo id, không cần tra bảng. */
export function isOwned(itemId: string, ownedItemIds: readonly string[]): boolean {
  return ownedItemIds.includes(itemId);
}

/**
 * Thông tin hai loại tiền tệ ⭐ 🌰 để client vẽ nhãn (tên + icon).
 *
 * ⚠️ VÌ SAO PHẢI KIỂM ĐỦ HAI KHOÁ RỒI MỚI ÉP KIỂU:
 *    `z.record(z.enum([...]), …)` của Zod cho ra `Partial<Record<…>>` — nghĩa là về mặt KIỂU,
 *    `currencies.stars` có thể là `undefined`. Nhưng về mặt NGHIỆP VỤ thì không: thiếu một loại
 *    tiền tệ nghĩa là có vật phẩm trong danh mục mà client không biết vẽ nhãn giá, và giá sẽ
 *    hiện ra dưới dạng `NaN ⭐`. Vậy nên ta kiểm ngay lúc nạp module rồi mới ép kiểu — lời hứa
 *    "luôn có đủ hai khoá" được BIẾN THÀNH một phép kiểm chạy được, thay vì một `as` suông.
 */
const currencies = parsed.data.currencies;
for (const kind of ['stars', 'acorns'] as const) {
  if (!currencies[kind]) {
    throw new Error(`shared/content/shop-items.json thiếu thông tin tiền tệ "${kind}"`);
  }
}

export const SHOP_CURRENCIES: Readonly<Record<CurrencyKind, { name_vi: string; icon: string }>> =
  currencies as Record<CurrencyKind, { name_vi: string; icon: string }>;

/** Vật phẩm thuộc nhóm đồ ăn (cho thú cưng ăn được). */
export function isFood(item: ShopItem): boolean {
  return item.category === 'food';
}

/**
 * Món đồ này có MUA ĐƯỢC NHIỀU LẦN không.
 *
 * ⭐ CHỈ ĐỒ ĂN xếp chồng được. Đây là một luật của mô hình dữ liệu, không phải chi tiết UI:
 *   `inventory` có khoá chính `(child_id, item_id)`, nên mua lần hai chỉ làm `quantity` thành 2.
 *   Với đồ ăn điều đó đúng (bé mua 3 quả chuối). Với một chiếc nón thì "2 chiếc nón" là vô
 *   nghĩa — bé trả tiền mà không nhận thêm được gì. Xem `RewardService.buy`.
 */
export function isStackable(item: ShopItem): boolean {
  return isFood(item);
}

/**
 * Nhóm vật phẩm MẶC / TRƯNG ĐƯỢC lên linh vật.
 *
 * ⚠️ VÌ SAO LÀ DANH SÁCH TRẮNG, KHÔNG PHẢI `category !== 'food'`:
 *    Hai cách viết cho CÙNG kết quả hôm nay, nhưng khác nhau vào ngày ai đó thêm nhóm vật phẩm
 *    thứ tư. `!== 'food'` sẽ tự động cho nhóm mới mặc được — kể cả một nhóm mà việc "mặc lên
 *    linh vật" là vô nghĩa (ví dụ "vé chơi game", "thú cưng bạn"). Danh sách trắng thì nhóm mới
 *    mặc định KHÔNG mặc được, và ai muốn cho mặc phải sửa đúng dòng dưới đây — một hành động có
 *    ý thức, không phải một hệ quả tình cờ.
 *    Giữa hai kiểu im lặng, chọn kiểu im lặng AN TOÀN HƠN.
 */
const EQUIPPABLE_CATEGORIES: ReadonlySet<ShopItemCategory> = new Set(['accessory', 'decoration']);

/**
 * Món này MẶC / TRƯNG được lên linh vật không.
 *
 * ⭐ ĐỒ ĂN THÌ KHÔNG, và không chỉ vì "mặc quả chuối là vô nghĩa": đồ ăn bị TIÊU khi cho ăn
 *   (`consumeItemInTx`). Nếu cho mặc, bé gắn một món lên Momo rồi chính món đó biến mất ở lần
 *   cho ăn sau — linh vật đang "đội" một thứ không còn tồn tại. Đây là mặt trái của cùng một
 *   luật đã khiến `feed()` từ chối phụ kiện.
 *
 * ⚠️ Hàm này có HAI người gọi với hai vai khác nhau, và cả hai đều cần:
 *     • CLIENT ẩn nút "Dùng ngay" với đồ ăn (T064) — để bé không bấm vào thứ không làm gì.
 *     • SERVER từ chối request hỏng (`RewardService.equip`) — vì UI ẩn nút KHÔNG ngăn được một
 *       client cũ hoặc một request gõ tay. Một phép kiểm chỉ ở UI là một phép kiểm không tồn tại.
 */
export function isEquippable(item: ShopItem): boolean {
  return EQUIPPABLE_CATEGORIES.has(item.category);
}

/** Số ❤️ mặc định khi cho ăn nếu món đó không ghi `happinessGain`. */
export const DEFAULT_HAPPINESS_GAIN = 1;

/** Số ❤️ món này cho thêm khi ăn. */
export function happinessGainOf(item: ShopItem): number {
  return item.happinessGain ?? DEFAULT_HAPPINESS_GAIN;
}

/** Vật phẩm theo nhóm, giữ thứ tự file — dùng cho các tab của màn Cửa hàng (M6). */
export function shopItemsByCategory(category: ShopItemCategory): ShopItem[] {
  return SHOP_ITEMS.filter((item) => item.category === category);
}

// =============================================================================
// Vị trí vật phẩm (T065) — cho `PetAvatar` biết món nào nằm ở đâu
// =============================================================================

/**
 * ⚠️ Dùng `Set` + type-predicate chứ KHÔNG `as AccessorySlot`:
 *   `item.slot` có kiểu `PetSlot | undefined` — nó có thể là `'sky'`, mà `'sky'` không phải vị
 *   trí của phụ kiện. Ép kiểu thẳng sẽ biến một trang trí bị dán nhãn sai thành một phụ kiện
 *   "hợp lệ" và `PetAvatar` vẽ một cái lâu đài lên đầu Momo. Predicate thì kiểm thật.
 */
const ACCESSORY_SLOT_SET: ReadonlySet<string> = new Set(ACCESSORY_SLOTS);
const DECORATION_SLOT_SET: ReadonlySet<string> = new Set(DECORATION_SLOTS);

function isAccessorySlot(value: PetSlot | undefined): value is AccessorySlot {
  return value !== undefined && ACCESSORY_SLOT_SET.has(value);
}

function isDecorationSlot(value: PetSlot | undefined): value is DecorationSlot {
  return value !== undefined && DECORATION_SLOT_SET.has(value);
}

/**
 * Vị trí gắn món này lên người Momo. `null` = món này KHÔNG phải phụ kiện đeo được.
 *
 * Trả `null` (chứ không ném) vì đây là hàm chạy TRONG lúc render — ném ở đó làm trắng cả màn
 * hình của bé vì một dòng dữ liệu. Dữ liệu thiếu `slot` đã bị `shopItemsFileSchema` chặn từ lúc
 * nạp module, nên nhánh `null` chỉ còn là lưới an toàn; `pet-avatar.test.tsx` có một phép kiểm
 * chạy trên TOÀN BỘ danh mục thật để chắc rằng không món phụ kiện nào rơi vào đó.
 */
export function accessorySlotOf(item: ShopItem): AccessorySlot | null {
  if (item.category !== 'accessory') return null;
  return isAccessorySlot(item.slot) ? item.slot : null;
}

/** Vị trí bày món trang trí quanh cảnh. `null` = món này không phải trang trí. */
export function decorationSlotOf(item: ShopItem): DecorationSlot | null {
  if (item.category !== 'decoration') return null;
  return isDecorationSlot(item.slot) ? item.slot : null;
}
