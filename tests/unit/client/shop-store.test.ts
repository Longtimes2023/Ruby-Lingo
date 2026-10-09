/**
 * Test cho `shopStore` — nơi điều phối ba hành động tiêu tiền.
 *
 * Năm nhóm được kiểm kỹ nhất, vì cả năm đều hỏng IM LẶNG:
 *
 *   1. **Cú chạm thứ hai phải bị chặn NGAY, không chờ mạng.** Bé 7 tuổi chạm rất nhanh. Với đồ ăn
 *      (nhóm DUY NHẤT mua được nhiều lần) một cú chạm lọt qua là trừ tiền hai lần và cho hai quả
 *      chuối; với cho ăn là tiêu mất hai phần đồ.
 *
 *   2. **Cờ "đang chạy" phải được NHẢ KHI HỎNG.** Nhả ở cuối nhánh thành công thôi thì một lần
 *      mạng hỏng sẽ để cờ kẹt ở `true` và nút mờ VĨNH VIỄN. Đây là nhóm dễ bỏ sót nhất vì nó chỉ
 *      xuất hiện khi mạng hỏng — đúng lúc bé cần bấm lại nhất.
 *
 *   3. **`INSUFFICIENT_FUNDS` KHÔNG được thành `error`.** Ví đã CŨ là chuyện bình thường, không
 *      phải lỗi của bé. Nhưng nó VẪN phải kéo theo một lần nạp lại — nếu không, con số sai nằm
 *      lại vĩnh viễn và bé tiếp tục bấm trên một cái nút sẽ luôn thất bại.
 *
 *   4. **"Vừa ăn" KHÁC "đang no".** Server trả cùng một mã 200 cho cả hai; hiện "Momo ăn ngon
 *      quá!" khi Momo không hề ăn là NÓI DỐI bé. Nhưng khi thiếu dữ kiện để phân biệt thì phải
 *      IM LẶNG, không được đoán.
 *
 *   5. **Đổi bé phải chặn mọi ghi dữ liệu.** Ví của bé cũ không được vá lên màn hình bé mới, và
 *      khi ví của bé này CHƯA được nạp thì không được gọi mạng tiêu tiền.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '@/api/client.js';
import { rewardsApi } from '@/api/endpoints.js';
import { __resetRewardStoreForTests, useRewardStore } from '@/store/rewardStore.js';
import { __resetShopStoreForTests, useShopStore } from '@/store/shopStore.js';
import { useSessionStore } from '@/store/sessionStore.js';
import { getShopItem } from '@shared/content/shop.js';
import type { ChildProfileDto } from '@shared/types/api.js';
import type { EquipmentResult, FeedResult, PurchaseResult, RewardSnapshot } from '@shared/types/reward.js';

vi.mock('@/api/endpoints.js', () => ({
  rewardsApi: { get: vi.fn(), buy: vi.fn(), feed: vi.fn(), equip: vi.fn() },
}));

const getMock = vi.mocked(rewardsApi.get);
const buyMock = vi.mocked(rewardsApi.buy);
const feedMock = vi.mocked(rewardsApi.feed);
const equipMock = vi.mocked(rewardsApi.equip);

const CHILD = 'chi_na';
const OTHER_CHILD = 'chi_em';
const FOOD = 'food-banana'; // 5 ⭐, +1 ❤️ — id THẬT trong shop-items.json
const HAT = 'acc-hat';
const NOW = '2026-10-08T08:00:00.000Z';

// =============================================================================
// Dữ liệu dựng sẵn
// =============================================================================

const CHILD_PROFILE: ChildProfileDto = {
  id: CHILD,
  nickname: 'Na',
  age: 7,
  avatarId: 'rabbit',
  createdAt: NOW,
};

function item(id: string) {
  const found = getShopItem(id);
  if (!found) throw new Error(`shop-items.json thiếu "${id}" — fixture của test đã lệch dữ liệu`);
  return found;
}

/** Ảnh chụp ví/túi/linh vật của bé đang chọn. `stars` mặc định 50 ⇒ đủ tiền cho mọi món trong test. */
function snapshot(overrides: Partial<RewardSnapshot> = {}): RewardSnapshot {
  return {
    childId: CHILD,
    wallet: { childId: CHILD, stars: 50, acorns: 2, updatedAt: NOW },
    xp: { childId: CHILD, xp: 140, level: 1, updatedAt: NOW },
    pet: {
      childId: CHILD,
      evolutionStage: 'baby',
      petType: 'monkey',
      petChosen: true,
      wordsLearned: 0,
      happiness: 3,
      equippedItemIds: [],
      lastFedAt: null,
      updatedAt: NOW,
    },
    streak: {
      childId: CHILD,
      currentStreak: 3,
      longestStreak: 5,
      lastActiveDate: '2026-10-07',
      milestonesClaimed: [],
      updatedAt: NOW,
    },
    inventory: [],
    badges: [],
    stickers: [],
    serverTime: NOW,
    ...overrides,
  };
}

function purchase(overrides: Partial<PurchaseResult> = {}): PurchaseResult {
  return {
    item: item(FOOD),
    wallet: { childId: CHILD, stars: 45, acorns: 2, updatedAt: NOW },
    inventoryItem: {
      childId: CHILD,
      itemId: FOOD,
      quantity: 1,
      equipped: false,
      acquiredAt: NOW,
    },
    ...overrides,
  };
}

function feedResult(happiness: number, overrides: Partial<FeedResult> = {}): FeedResult {
  return {
    pet: {
      childId: CHILD,
      evolutionStage: 'baby',
      petType: 'monkey',
      petChosen: true,
      wordsLearned: 0,
      happiness,
      equippedItemIds: [],
      lastFedAt: NOW,
      updatedAt: NOW,
    },
    item: item(FOOD),
    wallet: { childId: CHILD, stars: 45, acorns: 2, updatedAt: NOW },
    ...overrides,
  };
}

function equipResult(equipped: boolean): EquipmentResult {
  return {
    item: item(HAT),
    inventory: [
      {
        childId: CHILD,
        itemId: HAT,
        quantity: 1,
        equipped,
        acquiredAt: NOW,
      },
    ],
    pet: {
      childId: CHILD,
      evolutionStage: 'baby',
      petType: 'monkey',
      petChosen: true,
      wordsLearned: 0,
      happiness: 3,
      equippedItemIds: equipped ? [HAT] : [],
      lastFedAt: null,
      updatedAt: NOW,
    },
  };
}

/**
 * ⚠️ LẦN NẠP LẠI (`reload`) PHẢI ĐƯỢC ĐIỀU KHIỂN BẰNG TAY, KHÔNG ĐỂ NÓ TỰ CHẠY XONG.
 *
 *   Hai lý do, và cả hai đều là chuyện thật của tệp này:
 *   • Muốn chứng minh "ví đổi NGAY theo phản hồi mua" thì lần nạp lại chưa được trả về — nếu nó
 *     trả về trước, giá trị ta đọc là của `GET` và bài test không còn nói gì về bản vá.
 *   • `refreshQueued` của `rewardStore` giữ một biến `refreshInFlight` SỐNG QUA CÁC BÀI TEST
 *     (nó nằm trong closure của `create`, không bị `__resetRewardStoreForTests` chạm tới). Một
 *     promise treo mãi sẽ làm mọi lần nạp của các bài sau bị xếp hàng vô ích. Nên mỗi bài phải
 *     nhả hết ở `afterEach`.
 */
interface DeferredGet {
  resolve: (value: RewardSnapshot) => void;
}

let pendingGets: DeferredGet[] = [];

/** Cho `rewardsApi.get` trả về một promise chỉ hoàn tất khi bài test tự nhả. */
function deferGets(): void {
  getMock.mockImplementation(
    () =>
      new Promise<RewardSnapshot>((resolve) => {
        pendingGets.push({ resolve });
      }),
  );
}

/**
 * Nhả tất cả lần nạp đang treo, rồi để vi vụ việc chạy xong.
 *
 * ⚠️ PHẢI LẶP, KHÔNG NHẢ MỘT VÒNG. Một lần nạp có thể sinh ra lần nạp KẾ TIẾP: `reload()` gọi
 *    trong lúc đang nạp chỉ đặt `refreshRequested`, và vòng `do…while` của `refreshQueued` chạy
 *    thêm đúng một vòng nữa — tức một promise mới. Nhả một vòng thôi sẽ để promise thứ hai treo
 *    mãi, và `refreshInFlight` (một biến sống qua các bài test, không bị `__resetRewardStoreForTests`
 *    chạm tới) kẹt ở `true`: mọi bài sau gọi `reload()` đều bị XẾP HÀNG mà không bao giờ chạy.
 *    Trần 10 vòng để một lỗi thật không biến thành vòng lặp vô hạn.
 */
async function flushPendingGets(value: RewardSnapshot = snapshot()): Promise<void> {
  for (let round = 0; round < 10; round += 1) {
    if (pendingGets.length === 0) return;

    const waiting = pendingGets;
    pendingGets = [];
    for (const get of waiting) get.resolve(value);

    // Hai vòng microtask + một macrotask: đủ để `fetchSnapshot` ghi vào store rồi vòng `do…while`
    // của `refreshQueued` chạy tiếp hoặc thoát.
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetRewardStoreForTests();
  __resetShopStoreForTests();
  pendingGets = [];
  deferGets();

  useSessionStore.setState({ children: [CHILD_PROFILE], activeChildId: CHILD });

  // Ví của bé đang chọn ĐÃ nạp xong — điều kiện để `shopStore` chịu gọi mạng.
  useRewardStore.setState({
    childId: CHILD,
    snapshot: snapshot(),
    hydrated: true,
    loading: false,
    error: null,
    awards: {},
  });
});

afterEach(async () => {
  await flushPendingGets();
  vi.restoreAllMocks();
});

// =============================================================================
// buy
// =============================================================================

describe('shopStore.buy', () => {
  it('mua thành công ⇒ ghi ví NGAY (trước khi nạp lại xong) và báo "bought"', async () => {
    buyMock.mockResolvedValue(purchase());

    await useShopStore.getState().buy(CHILD, FOOD);

    // 45 là con số server vừa trả — KHÁC 50 trong ảnh chụp, nên giá trị này chỉ có thể đến từ bản
    // vá tức thì. Lần nạp lại vẫn đang treo (xem `deferGets`).
    expect(useRewardStore.getState().snapshot?.wallet.stars).toBe(45);
    expect(useShopStore.getState().lastNotice).toEqual({ kind: 'bought', itemId: FOOD });
    expect(useShopStore.getState().error).toBeNull();
  });

  it('vẫn NẠP LẠI ảnh chụp, và server THẮNG bản vá tức thì', async () => {
    buyMock.mockResolvedValue(purchase());

    await useShopStore.getState().buy(CHILD, FOOD);
    expect(getMock).toHaveBeenCalledWith(CHILD);

    // Lần nạp lại trả về con số KHÁC (ví dụ bé vừa tiêu ở thiết bị khác) ⇒ phải thắng bản vá.
    await flushPendingGets(snapshot({ wallet: { childId: CHILD, stars: 999, acorns: 2, updatedAt: NOW } }));

    expect(useRewardStore.getState().snapshot?.wallet.stars).toBe(999);
  });

  it('409 INSUFFICIENT_FUNDS ⇒ thông báo nhẹ, KHÔNG phải `error`, ví nguyên vẹn, VẪN nạp lại', async () => {
    buyMock.mockRejectedValue(
      new ApiClientError('INSUFFICIENT_FUNDS', 'Không đủ Sao để mua món này.', 409),
    );

    await useShopStore.getState().buy(CHILD, FOOD);

    expect(useShopStore.getState().lastNotice).toEqual({ kind: 'notEnough' });
    // ⚠️ Không được đặt `error`: bé không làm gì sai, và một banner báo hỏng ở đây là mắng trẻ vì
    // một cái ví đã cũ.
    expect(useShopStore.getState().error).toBeNull();
    // Ví KHÔNG bị bịa ra một con số nào — 50 vẫn là con số của ảnh chụp cũ.
    expect(useRewardStore.getState().snapshot?.wallet.stars).toBe(50);
    // ⭐ Nhưng PHẢI nạp lại: chính vì ví cũ nên con số phải được sửa, nếu không bé sẽ bấm mãi một
    // cái nút không bao giờ thành công.
    expect(getMock).toHaveBeenCalledWith(CHILD);
  });

  it('lỗi khác (mất mạng) ⇒ GHI vào `error`, không giả vờ là "chưa đủ tiền"', async () => {
    buyMock.mockRejectedValue(
      new ApiClientError('INTERNAL_ERROR', 'Không kết nối được máy chủ', 0, { isNetworkError: true }),
    );

    await useShopStore.getState().buy(CHILD, FOOD);

    expect(useShopStore.getState().lastNotice).toBeNull();
    expect(useShopStore.getState().error).toBe('Không kết nối được máy chủ');
  });

  it('⭐ bấm hai lần thật nhanh ⇒ CHỈ MỘT request (đồ ăn mua được nhiều lần nên đây là tiền thật)', async () => {
    let releaseBuy!: (value: PurchaseResult) => void;
    buyMock.mockImplementation(
      () => new Promise<PurchaseResult>((resolve) => (releaseBuy = resolve)),
    );

    const first = useShopStore.getState().buy(CHILD, FOOD);
    const second = useShopStore.getState().buy(CHILD, FOOD);

    // Yêu cầu đầu còn đang bay; cú chạm thứ hai phải bị chặn NGAY, không chờ mạng trả lời.
    expect(useShopStore.getState().buying[FOOD]).toBe(true);
    expect(buyMock).toHaveBeenCalledTimes(1);

    releaseBuy(purchase());
    await Promise.all([first, second]);

    expect(useShopStore.getState().buying[FOOD]).toBeUndefined();
  });

  it('⚠️ mua HỎNG ⇒ cờ được NHẢ (nút không bị mờ vĩnh viễn) và bấm lại được', async () => {
    buyMock.mockRejectedValueOnce(new Error('mạng hỏng'));

    await useShopStore.getState().buy(CHILD, FOOD);
    expect(useShopStore.getState().buying[FOOD]).toBeUndefined();

    // Lần thử lại thật sự đi tới mạng — nếu cờ còn kẹt, lần này sẽ không có request nào.
    buyMock.mockResolvedValueOnce(purchase());
    await useShopStore.getState().buy(CHILD, FOOD);

    expect(buyMock).toHaveBeenCalledTimes(2);
    expect(useShopStore.getState().lastNotice).toEqual({ kind: 'bought', itemId: FOOD });
  });

  it('hai MÓN khác nhau không chặn nhau (cờ khoá theo từng món)', async () => {
    const pending: Array<(value: PurchaseResult) => void> = [];
    buyMock.mockImplementation(() => new Promise<PurchaseResult>((r) => pending.push(r)));

    const a = useShopStore.getState().buy(CHILD, FOOD);
    const b = useShopStore.getState().buy(CHILD, HAT);

    // Mua một quả chuối không được làm nút "Mua" của chiếc nón đứng im.
    expect(buyMock).toHaveBeenCalledTimes(2);

    pending.forEach((resolve) => resolve(purchase()));
    await Promise.all([a, b]);
  });

  it('⚠️ ví của bé này CHƯA được nạp ⇒ KHÔNG gọi mạng (không tiêu tiền trong mù)', async () => {
    // `childId` khác ⇒ `rewardStore` đang giữ ví của bé khác (hoặc chưa nạp xong).
    useRewardStore.setState({ childId: OTHER_CHILD, snapshot: null });

    await useShopStore.getState().buy(CHILD, FOOD);

    expect(buyMock).not.toHaveBeenCalled();
    expect(useShopStore.getState().lastNotice).toBeNull();
  });

  it('⚠️ đổi bé GIỮA CHỪNG ⇒ không ghi ví, không báo, không nạp lại', async () => {
    let releaseBuy!: (value: PurchaseResult) => void;
    buyMock.mockImplementation(
      () => new Promise<PurchaseResult>((resolve) => (releaseBuy = resolve)),
    );

    const inFlight = useShopStore.getState().buy(CHILD, FOOD);
    // Bố mẹ đổi sang bé khác trong lúc yêu cầu đang bay.
    useRewardStore.setState({ childId: OTHER_CHILD, snapshot: null });

    releaseBuy(purchase());
    await inFlight;

    // Tiền của bé Na đã tiêu ở server (không hoàn tác được), nhưng màn hình đang là của bé Em —
    // ghi ví của Na lên đó là hiện số của bé này cho bé kia.
    expect(useShopStore.getState().lastNotice).toBeNull();
    expect(getMock).not.toHaveBeenCalled();
    expect(useRewardStore.getState().snapshot).toBeNull();
  });
});

// =============================================================================
// feed
// =============================================================================

describe('shopStore.feed', () => {
  it('Momo ăn thật (❤️ tăng) ⇒ báo "fed" kèm số ❤️ mới, và ghi pet + ví ngay', async () => {
    feedMock.mockResolvedValue(feedResult(4)); // ảnh chụp đang là 3

    await useShopStore.getState().feed(CHILD, FOOD);

    expect(useShopStore.getState().lastNotice).toEqual({ kind: 'fed', itemId: FOOD, happiness: 4 });
    expect(useRewardStore.getState().snapshot?.pet.happiness).toBe(4);
    expect(useRewardStore.getState().snapshot?.wallet.stars).toBe(45);
  });

  it('⭐ Momo ĐANG NO (❤️ không đổi) ⇒ "full", TUYỆT ĐỐI không phải "fed"', async () => {
    feedMock.mockResolvedValue(feedResult(3)); // y hệt ảnh chụp ⇒ server không cho ăn

    await useShopStore.getState().feed(CHILD, FOOD);

    // Hiện "Momo ăn ngon quá!" ở đây là nói dối bé: quả chuối vẫn còn nguyên.
    expect(useShopStore.getState().lastNotice).toEqual({ kind: 'full' });
  });

  it('⚠️ chưa có ảnh chụp ⇒ KHÔNG kết luận gì (thà im lặng còn hơn đoán sai)', async () => {
    // Ví đã được yêu cầu nạp cho bé này nhưng chưa có dữ liệu ⇒ không biết ❤️ trước đó là bao nhiêu.
    useRewardStore.setState({ childId: CHILD, snapshot: null });
    feedMock.mockResolvedValue(feedResult(4));

    await useShopStore.getState().feed(CHILD, FOOD);

    expect(useShopStore.getState().lastNotice).toBeNull();
    // Nhưng vẫn phải nạp lại: trạng thái thật vẫn phải về màn hình.
    expect(getMock).toHaveBeenCalledWith(CHILD);
  });

  it('bấm hai lần thật nhanh ⇒ CHỈ MỘT request (mỗi cú lọt là một phần đồ ăn bị tiêu)', async () => {
    let releaseFeed!: (value: FeedResult) => void;
    feedMock.mockImplementation(() => new Promise<FeedResult>((r) => (releaseFeed = r)));

    const first = useShopStore.getState().feed(CHILD, FOOD);
    const second = useShopStore.getState().feed(CHILD, FOOD);

    expect(feedMock).toHaveBeenCalledTimes(1);

    releaseFeed(feedResult(4));
    await Promise.all([first, second]);

    expect(useShopStore.getState().feeding[FOOD]).toBeUndefined();
  });
});

// =============================================================================
// equip
// =============================================================================

describe('shopStore.equip', () => {
  it('mặc thành công ⇒ ghi TRỌN túi đồ + pet, và KHÔNG đặt thông báo', async () => {
    equipMock.mockResolvedValue(equipResult(true));

    await useShopStore.getState().equip(CHILD, HAT, true);

    const after = useRewardStore.getState().snapshot;
    expect(after?.inventory).toEqual(equipResult(true).inventory);
    expect(after?.pet.equippedItemIds).toEqual([HAT]);
    // ⭐ Không có thông báo: kết quả nhìn thấy được CHÍNH LÀ Momo đội nón lên. Thêm một câu nữa là
    // nói lại điều bé vừa tự tay làm.
    expect(useShopStore.getState().lastNotice).toBeNull();
  });

  it('bỏ ra ⇒ gửi đúng `equipped: false` xuống endpoint (không tự đảo thành `true`)', async () => {
    equipMock.mockResolvedValue(equipResult(false));

    await useShopStore.getState().equip(CHILD, HAT, false);

    expect(equipMock.mock.calls[0]).toEqual([CHILD, HAT, { equipped: false }]);
  });

  it('bấm hai lần thật nhanh ⇒ CHỈ MỘT request', async () => {
    let releaseEquip!: (value: EquipmentResult) => void;
    equipMock.mockImplementation(() => new Promise<EquipmentResult>((r) => (releaseEquip = r)));

    const first = useShopStore.getState().equip(CHILD, HAT, true);
    const second = useShopStore.getState().equip(CHILD, HAT, true);

    expect(equipMock).toHaveBeenCalledTimes(1);

    releaseEquip(equipResult(true));
    await Promise.all([first, second]);

    expect(useShopStore.getState().equipping[HAT]).toBeUndefined();
  });
});

// =============================================================================
// dọn trạng thái
// =============================================================================

describe('dọn trạng thái', () => {
  it('dismissNotice xoá thông báo nhưng GIỮ cờ đang chạy', async () => {
    buyMock.mockResolvedValue(purchase());
    await useShopStore.getState().buy(CHILD, FOOD);
    expect(useShopStore.getState().lastNotice).not.toBeNull();

    useShopStore.getState().dismissNotice();

    expect(useShopStore.getState().lastNotice).toBeNull();
  });

  it('reset xoá sạch cờ, thông báo và lỗi', async () => {
    buyMock.mockRejectedValueOnce(new Error('mạng hỏng'));
    await useShopStore.getState().buy(CHILD, FOOD);
    expect(useShopStore.getState().error).not.toBeNull();

    useShopStore.getState().reset();

    const state = useShopStore.getState();
    expect(state.buying).toEqual({});
    expect(state.feeding).toEqual({});
    expect(state.equipping).toEqual({});
    expect(state.lastNotice).toBeNull();
    expect(state.error).toBeNull();
  });
});
