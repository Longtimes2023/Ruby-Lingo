/**
 * RubyLingo — `shopStore`: điều phối các hành động ở cửa hàng & nhà thú cưng (T063 · T04).
 *
 * Ba hành động tiêu tiền: **mua** một vật phẩm, **cho ăn** một món đã sở hữu, **mặc / bỏ ra** một
 * phụ kiện. Cộng thêm **đổi bạn đồng hành** (T04) — MIỄN PHÍ, xem khối ghi chú riêng bên dưới.
 * Cả bốn dùng chung một hình dạng: chặn cú chạm thứ hai → gọi mạng → ghi NGAY dữ liệu server vừa
 * trả về → nạp lại ảnh chụp đầy đủ.
 *
 * ⭐ VÌ SAO TRẠNG THÁI NÀY NẰM TRONG STORE, KHÔNG PHẢI `useState` CỦA TRANG:
 *   Cùng lý do đã áp dụng cho `questStore` (xem ghi chú đầu tệp đó), và ở đây nó còn cấp thiết
 *   hơn một bậc:
 *   • **Cờ "đang mua" phải sống lâu hơn một lần render.** Bé 7 tuổi chạm rất nhanh, và một cú
 *     chạm thứ hai lọt qua sẽ MUA HAI LẦN cùng một món hoặc TIÊU HAI phần đồ ăn. Cờ trong
 *     `useState` biến mất khi component bị tháo ra lắp lại (đổi tab trong Nhà thú cưng, xoay
 *     điện thoại khiến layout đổi) — đúng lúc cử chỉ chạm thứ hai đang tới.
 *   • **Thông báo kết quả phải sống qua việc chuyển màn hình.** Bé bấm "Mua", rồi chạy sang tab
 *     "Cho ăn" ngay. Nếu kết quả nằm trong state của component vừa bị tháo, câu "Bé vừa mua được
 *     Nón xinh!" BIẾN MẤT trong khi ví đã trừ tiền — bé mất 30 ⭐ mà không thấy gì xảy ra.
 *
 * ⚠️⚠️ Ở ĐÂY KHÔNG CÓ BẢN LƯU TRONG MÁY, VÀ KHÔNG CÓ ẢNH CHỤP RIÊNG — CỐ Ý:
 *   Thứ duy nhất store này giữ là **trạng thái của những hành động đang chạy**. Ví, túi đồ, linh
 *   vật đều là bản sao trong `rewardStore`, và chỉ có MỘT nơi giữ chúng. Nếu tệp này cũng cất một
 *   bản ví riêng, ta có hai con số có thể lệch nhau và không có cách nào biết con số nào đúng.
 *   Bởi vậy mọi cập nhật dữ liệu ở đây đều đi qua `rewardStore`.
 *
 * ⭐ VÌ SAO "GHI NGAY RỒI VẪN NẠP LẠI" (giống `questStore.claim` và `rewardStore.applyAward`):
 *   Phản hồi của ba endpoint này CHỈ mang một phần ảnh chụp:
 *     • `buy`   → `wallet` + một `inventoryItem` (KHÔNG có cả túi đồ)
 *     • `feed`  → `wallet` + `pet` (KHÔNG có `inventory`, nên không thấy món vừa tiêu)
 *     • `equip` → `pet` + **cả** `inventory` (đầy đủ cho hai trường đó)
 *   Nếu chỉ ghi phần nhận được rồi thôi, bản sao sẽ ĐỨNG YÊN ở những trường còn thiếu — bé cho ăn
 *   xong vẫn thấy quả chuối cũ nằm trong túi. Nên: ghi ngay phần server vừa nói (để bé thấy ví và
 *   Momo đổi TỨC THÌ, và để một lần nạp hỏng không làm con số cũ nằm lại vĩnh viễn), rồi nạp lại
 *   ảnh chụp thật để mọi trường đuổi kịp.
 *
 * ⚠️ MỌI HÀM Ở ĐÂY **KHÔNG BAO GIỜ NÉM**. Chỗ gọi là một `onClick`; ném ở đó chỉ tạo ra một
 *    promise bị bỏ rơi mà không ai bắt. Lỗi được ghi vào `error` (kỹ thuật, KHÔNG hiển thị cho bé).
 */

import { create } from 'zustand';

import type { RewardSnapshot } from '@shared/types/reward.js';
import { buyItem, choosePet as choosePetService, feedPet, setEquipped } from '../services/ShopService.js';
import { useRewardStore } from './rewardStore.js';

/**
 * Kết quả của hành động vừa xong, để màn hình ăn mừng / báo nhẹ.
 *
 * ⭐ VÌ SAO `full` LÀ MỘT KẾT QUẢ RIÊNG, KHÔNG GỘP VÀO `fed`:
 *   Server trả **200 kèm trạng thái không đổi** khi cho ăn lúc Momo đã no — không mất đồ, không
 *   lỗi (xem `RewardService.feed`). Nhưng nếu ta vẫn hiện "Momo ăn ngon quá!" thì đó là một lời
 *   NÓI DỐI: bé vừa đưa một quả chuối mà Momo không hề ăn. Luật của dự án là không bao giờ mắng
 *   trẻ — và không nói dối trẻ cũng là cùng một luật. Câu đúng là "Momo đang no lắm rồi!".
 */
export type ShopNotice =
  | { kind: 'bought'; itemId: string }
  | { kind: 'notEnough' }
  | { kind: 'fed'; itemId: string; happiness: number }
  | { kind: 'full' };

interface ShopState {
  /**
   * `itemId` → đang có một yêu cầu MUA chạy.
   *
   * ⭐ Chặn cú chạm hai lần Ở ĐÂY (phía client) SONG SONG với cổng ở server, đúng khuôn mẫu của
   *   `questStore.claiming`: server đã chống mua lại món dùng-mãi (`buy` trả nguyên trạng khi đã
   *   sở hữu), nhưng để bé chờ một vòng mạng mới biết thì nút đã nhấp nháy vô ích. Cờ này chỉ là
   *   phản hồi tức thì — nó KHÔNG phải cổng an toàn, vì client có thể bị can thiệp.
   *
   * ⚠️ ĐỒ ĂN là trường hợp cờ này thật sự có giá trị: nó là nhóm DUY NHẤT mua được nhiều lần, nên
   *    hai cú chạm liên tiếp sẽ trừ tiền hai lần và cho hai quả chuối.
   */
  buying: Record<string, boolean>;
  /** `itemId` → đang có một yêu cầu CHO ĂN chạy. Hai cú chạm liên tiếp sẽ tiêu hai phần đồ ăn. */
  feeding: Record<string, boolean>;
  /** `itemId` → đang có một yêu cầu MẶC / BỎ RA chạy. */
  equipping: Record<string, boolean>;
  /**
   * Đang có một yêu cầu ĐỔI BẠN ĐỒNG HÀNH chạy.
   *
   * ⚠️ LÀ MỘT `boolean`, KHÔNG PHẢI MAP THEO `itemId` (khác `buying`/`feeding`/`equipping`).
   *   Bé chỉ có MỘT con thú cưng, và màn chọn chỉ gửi được một yêu cầu tại một thời điểm — không
   *   có khoá nào để phân biệt. Một map ở đây sẽ là một hình dạng thừa, và chỗ đọc sẽ phải đoán
   *   khoá nào để tra.
   */
  choosing: boolean;
  /** Kết quả của hành động gần nhất; `null` = không có gì để hiện. */
  lastNotice: ShopNotice | null;
  /**
   * Lỗi KỸ THUẬT của lần gần nhất. **KHÔNG bao giờ hiển thị cho bé** — nút vẫn sáng để bé thử
   * lại, và một câu báo lỗi về tiền bạc chỉ làm bé lo.
   */
  error: string | null;

  /** Bé bấm "Mua". Không bao giờ ném — lỗi được ghi vào `error`. */
  buy: (childId: string, itemId: string) => Promise<void>;
  /** Bé bấm "Cho ăn". Không bao giờ ném. */
  feed: (childId: string, itemId: string) => Promise<void>;
  /** Bé bấm "Dùng ngay" / "Bỏ ra". `equipped` là TRẠNG THÁI ĐÍCH, không phải lệnh đảo. */
  equip: (childId: string, itemId: string, equipped: boolean) => Promise<void>;
  /**
   * Bé bấm "Chọn bạn này!" ở màn chọn con (T04). **MIỄN PHÍ, không đụng ví.** Không bao giờ ném.
   *
   * ⚠️ KHÔNG ĐẶT `lastNotice` SAU KHI XONG — cùng lý do như `equip`: kết quả nhìn thấy được của
   *    việc đổi con CHÍNH LÀ con vật đổi hình trên màn nhà. Một câu "Bé đã đổi bạn đồng hành!"
   *    là nói lại điều bé vừa tự tay làm.
   */
  choosePet: (childId: string, petType: string) => Promise<void>;
  /** Đóng thông báo (sau khi bé đã xem xong). */
  dismissNotice: () => void;
  /** Xoá sạch (đăng xuất, hoặc bố mẹ đổi sang bé khác). */
  reset: () => void;
}

/** Ba bản đồ cờ đang-chạy. Cố ý tách rời: mua và cho ăn CÙNG một `itemId` là hai việc độc lập. */
type FlagKey = 'buying' | 'feeding' | 'equipping';

/** Trạng thái rỗng — cũng là trạng thái trong lúc chờ. */
function emptyState(): Omit<
  ShopState,
  'buy' | 'feed' | 'equip' | 'choosePet' | 'dismissNotice' | 'reset'
> {
  return {
    buying: {},
    feeding: {},
    equipping: {},
    choosing: false,
    lastNotice: null,
    error: null,
  };
}

/**
 * Dựng `patch` cho một cờ.
 *
 * ⚠️ Viết bằng `switch` chứ không bằng khoá tính toán (`{ [key]: value }`): khoá tính toán làm kiểu
 *    của `patch` sụp về `Record<string, ...>` và phải `as` mới qua được TypeScript — mà `as` ở đây
 *    lại che mất đúng lỗi mà ta cần bắt: gõ sai tên cờ, hoặc gán giá trị sai kiểu.
 */
function flagsPatch(key: FlagKey, value: Record<string, boolean>): Partial<ShopState> {
  switch (key) {
    case 'buying':
      return { buying: value };
    case 'feeding':
      return { feeding: value };
    case 'equipping':
      return { equipping: value };
  }
}

/** Bỏ một khoá khỏi một bản đồ cờ, KHÔNG sửa bản đồ cũ tại chỗ. */
function withoutKey(flags: Record<string, boolean>, key: string): Record<string, boolean> {
  const { [key]: _done, ...rest } = flags;
  return rest;
}

/** Đọc ảnh chụp ví/túi/linh vật hiện có — `null` khi chưa nạp xong. */
function snapshotOf(childId: string): RewardSnapshot | null {
  const state = useRewardStore.getState();
  // Ảnh chụp của bé KHÁC không được dùng: so sánh `happiness` với dữ liệu của bé kia sẽ cho ra kết
  // luận sai về một hành động vừa xảy ra với bé này.
  return state.childId === childId ? state.snapshot : null;
}

/**
 * Phân loại một lần cho ăn vừa xong: Momo có thật sự ăn không?
 *
 * ⭐ `happiness` KHÔNG ĐỔI ⇔ KHÔNG CÓ GÌ ĐƯỢC ĂN. Nhánh "đã no" của `RewardService.feed` trả về
 *   ĐÚNG hàng `pet_state` cũ và không đụng gì; nhánh thật thì `happiness` LUÔN TĂNG — nó đã qua
 *   cổng `happiness < 5`, và món ăn cộng ít nhất 1 ❤️. Nên phép so sánh này không cần thêm manh
 *   mối nào khác (không cần `lastFedAt`, không cần giờ).
 *
 * ⚠️ `before === null` (chưa có ảnh chụp) ⇒ trả `null`: KHÔNG KẾT LUẬN GÌ. Đoán bừa ở đây là chọn
 *    giữa hai câu mà chỉ một câu đúng, và ta có thể chọn câu sai — im lặng thì không nói dối.
 */
function classifyFeed(before: number | null, after: number, itemId: string): ShopNotice | null {
  if (before === null) return null;
  if (after === before) return { kind: 'full' };
  return { kind: 'fed', itemId, happiness: after };
}

export const useShopStore = create<ShopState>((set, get) => {
  /** Bật / tắt một cờ đang-chạy. */
  const setFlag = (key: FlagKey, itemId: string, on: boolean): void => {
    const current = get()[key];
    set(flagsPatch(key, on ? { ...current, [itemId]: true } : withoutKey(current, itemId)));
  };

  /**
   * Cổng vào của cả ba hành động. Trả về một hàm "bé còn là bé này không?", hoặc `null` nghĩa là
   * **KHÔNG được chạy** (đã có yêu cầu khác đang gửi, hoặc không phải bé đang có ví).
   *
   * ⚠️ "BÉ CÒN LÀ BÉ NÀY KHÔNG?" ĐƯỢC ĐỌC LẠI Ở MỖI LẦN GỌI, không phải chụp một lần trước
   *    `await`. Đổi bé xảy ra TRONG lúc chờ mạng, nên một giá trị chụp sẵn sẽ luôn nói "ổn" — và
   *    ta sẽ ghi ví của bé cũ lên màn hình của bé mới.
   */
  const enter = (key: FlagKey, childId: string, itemId: string): (() => boolean) | null => {
    /**
     * ⚠️ CHƯA CÓ VÍ CỦA BÉ NÀY ⇒ KHÔNG GỌI MẠNG.
     *   `rewardStore.childId` là bằng chứng duy nhất cho "ví của bé này đã được yêu cầu nạp". Khi
     *   nó khác `childId`, ta đang ở một trong hai tình huống: ví chưa nạp xong (màn hình chưa có
     *   giá, nút mua chưa thể sáng), hoặc bố mẹ VỪA đổi bé. Gọi mạng lúc đó là tiêu tiền của bé
     *   này trong khi màn hình đang hiện dữ liệu của bé kia.
     */
    if (useRewardStore.getState().childId !== childId) return null;

    // Đang gửi rồi ⇒ bỏ qua cú chạm thứ hai.
    if (get()[key][itemId]) return null;

    set({ error: null });
    setFlag(key, itemId, true);

    return () => useRewardStore.getState().childId === childId;
  };

  /**
   * Cổng vào của `choosePet` — CÙNG HAI ĐIỀU KIỆN NHƯ `enter()`, nhưng không có `itemId`.
   *
   * ⚠️ KHÔNG DÙNG LẠI ĐƯỢC `enter()`: nó khoá cờ theo `itemId`, mà đổi con không có `itemId`
   *    (chỉ có MỘT con thú cưng). Sao chép đúng hai điều kiện ở đây thay vì bẻ `enter()` cho vừa:
   *      • ví của bé này CHƯA nạp (`rewardStore.childId !== childId`) ⇒ KHÔNG gọi mạng — cùng lý do
   *        như `enter()`: có thể là bố mẹ VỪA đổi bé, và gọi mạng lúc đó là ghi dữ liệu của bé này
   *        lên màn hình đang hiện dữ liệu của bé kia.
   *      • đang `choosing` ⇒ bỏ qua cú chạm thứ hai (nút xác nhận đã mờ, nhưng cờ là lớp chặn thật).
   *
   * Trả về hàm "bé còn là bé này không?" — phải đọc LẠI ở mỗi lần gọi, không chụp sẵn trước `await`.
   */
  const enterOnce = (childId: string): (() => boolean) | null => {
    if (useRewardStore.getState().childId !== childId) return null;
    if (get().choosing) return null;

    set({ error: null });
    set({ choosing: true });

    return () => useRewardStore.getState().childId === childId;
  };

  return {
    ...emptyState(),

    buy: async (childId, itemId) => {
      const stillSameChild = enter('buying', childId, itemId);
      if (!stillSameChild) return;

      try {
        const outcome = await buyItem(childId, itemId);
        if (!stillSameChild()) return;

        if (outcome.status === 'bought') {
          // Ví mới là dữ liệu server vừa trả — ghi ngay để `TopBar` đổi số tức thì.
          useRewardStore
            .getState()
            .applyServerSnapshot(childId, { wallet: outcome.result.wallet });
          set({ lastNotice: { kind: 'bought', itemId } });
        } else {
          /**
           * ⚠️ `INSUFFICIENT_FUNDS` KHÔNG PHẢI LỖI — nó là ví trên màn hình đã CŨ (cao hơn ví
           *   thật). Vì vậy nó không đi vào `error` mà thành một thông báo nhẹ, và `reload()` ngay
           *   bên dưới chính là cách sửa con số sai.
           */
          set({ lastNotice: { kind: 'notEnough' } });
        }

        // Túi đồ không có trong phản hồi `buy` ⇒ bắt buộc phải nạp lại để món mới xuất hiện.
        useRewardStore.getState().reload(childId);
      } catch (error) {
        if (!stillSameChild()) return;
        set({ error: error instanceof Error ? error.message : String(error) });
      } finally {
        setFlag('buying', itemId, false);
      }
    },

    feed: async (childId, itemId) => {
      // Chụp ❤️ TRƯỚC khi gọi mạng — xem ghi chú ở đoạn phân loại bên dưới.
      const before = snapshotOf(childId)?.pet.happiness ?? null;

      const stillSameChild = enter('feeding', childId, itemId);
      if (!stillSameChild) return;

      try {
        const result = await feedPet(childId, itemId);
        if (!stillSameChild()) return;

        useRewardStore
          .getState()
          .applyServerSnapshot(childId, { wallet: result.wallet, pet: result.pet });

        // `null` (không đủ dữ kiện) được ghi thẳng vào `lastNotice` — xem `classifyFeed`.
        set({ lastNotice: classifyFeed(before, result.pet.happiness, itemId) });

        // Túi đồ KHÔNG có trong phản hồi `feed` ⇒ món vừa tiêu chỉ biến mất sau khi nạp lại.
        useRewardStore.getState().reload(childId);
      } catch (error) {
        if (!stillSameChild()) return;
        set({ error: error instanceof Error ? error.message : String(error) });
      } finally {
        setFlag('feeding', itemId, false);
      }
    },

    equip: async (childId, itemId, equipped) => {
      const stillSameChild = enter('equipping', childId, itemId);
      if (!stillSameChild) return;

      try {
        const result = await setEquipped(childId, itemId, equipped);
        if (!stillSameChild()) return;

        /**
         * ⭐ KHÔNG ĐẶT `lastNotice` Ở ĐÂY, VÀ ĐÓ LÀ CHỦ Ý.
         *   Kết quả nhìn thấy được của việc mặc đồ CHÍNH LÀ Momo đội nón lên — nó hiện ra ngay
         *   trên màn hình. Thêm một câu "Bé đã mặc Nón xinh!" là nói lại điều bé vừa tự tay làm.
         *
         *   `inventory` ở đây là **CẢ MẢNG** (server gửi trọn gói), nên ghi thẳng được, không phải
         *   tự vá phần tử nào — xem ghi chú ở `EquipmentResult`.
         */
        useRewardStore
          .getState()
          .applyServerSnapshot(childId, { pet: result.pet, inventory: result.inventory });
        useRewardStore.getState().reload(childId);
      } catch (error) {
        if (!stillSameChild()) return;
        set({ error: error instanceof Error ? error.message : String(error) });
      } finally {
        setFlag('equipping', itemId, false);
      }
    },

    choosePet: async (childId, petType) => {
      const stillSameChild = enterOnce(childId);
      if (!stillSameChild) return;

      try {
        const pet = await choosePetService(childId, petType);
        if (!stillSameChild()) return;

        /**
         * ⭐ KHÔNG ĐẶT `lastNotice` Ở ĐÂY — cùng lý do như `equip`: kết quả nhìn thấy được của
         *   việc đổi con CHÍNH LÀ con vật đổi hình trên màn nhà. Thêm một câu nữa là nói lại điều
         *   bé vừa tự tay làm.
         *
         * ⚠️ Ghi TRỌN `pet` mà server vừa trả (không phải `{ petType }`): phản hồi là `readPet`,
         *    nên nó mang cả `evolutionStage`/`happiness`/`equippedItemIds` đã được server tính —
         *    ghi thẳng vào cache để con vật đổi hình NGAY, rồi `reload()` cho mọi trường đuổi kịp.
         */
        useRewardStore.getState().applyServerSnapshot(childId, { pet });
        useRewardStore.getState().reload(childId);
      } catch (error) {
        if (!stillSameChild()) return;
        set({ error: error instanceof Error ? error.message : String(error) });
      } finally {
        set({ choosing: false });
      }
    },

    dismissNotice: () => {
      set({ lastNotice: null });
    },

    reset: () => {
      set(emptyState());
    },
  };
});

/** Chỉ dùng trong test. */
export function __resetShopStoreForTests(): void {
  useShopStore.setState(emptyState());
}
