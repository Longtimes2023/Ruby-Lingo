/**
 * Test cho `useShop` / `useShopLifecycle` — lớp nối store với màn hình Cửa hàng.
 *
 * Hai nhóm được kiểm kỹ nhất:
 *
 *   1. **Không có bé đang chọn ⇒ KHÔNG gọi mạng.** `useShop` lấy bé từ `useActiveChild()`. Nếu nó
 *      gọi thẳng xuống store với một `childId` rỗng, yêu cầu sẽ đi tới server với đường dẫn
 *      `/api/children//shop/buy` — hoặc tệ hơn, với id của bé CŨ vừa bị bỏ chọn. Cả hai đều là
 *      tiêu tiền sai người.
 *
 *   2. **`useShopLifecycle` chỉ xoá khi ĐỔI BÉ, không xoá ở mỗi lần render.** Đây chính là lý do
 *      hook ấy phải nằm ở `AppShell` chứ không ở màn hình Cửa hàng: `useEffect` chạy lại mỗi lần
 *      component được gắn vào, nên đặt nó ở màn hình sẽ xoá sạch thông báo "Bé vừa mua được Nón
 *      xinh!" mỗi lần bé rời màn hình rồi quay lại — đúng thứ mà việc để thông báo trong store
 *      sinh ra để tránh.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { rewardsApi } from '@/api/endpoints.js';
import { useShop, useShopLifecycle } from '@/hooks/useShop.js';
import { __resetRewardStoreForTests, useRewardStore } from '@/store/rewardStore.js';
import { __resetShopStoreForTests, useShopStore } from '@/store/shopStore.js';
import { useSessionStore } from '@/store/sessionStore.js';
import type { ChildProfileDto } from '@shared/types/api.js';
import type { PurchaseResult, RewardSnapshot } from '@shared/types/reward.js';

vi.mock('@/api/endpoints.js', () => ({
  rewardsApi: { get: vi.fn(), buy: vi.fn(), feed: vi.fn(), equip: vi.fn() },
}));

const getMock = vi.mocked(rewardsApi.get);
const buyMock = vi.mocked(rewardsApi.buy);

const CHILD = 'chi_na';
const OTHER_CHILD = 'chi_em';
const FOOD = 'food-banana';
const NOW = '2026-10-08T08:00:00.000Z';

const CHILD_PROFILE: ChildProfileDto = {
  id: CHILD,
  nickname: 'Na',
  age: 7,
  avatarId: 'rabbit',
  createdAt: NOW,
};

const OTHER_PROFILE: ChildProfileDto = { ...CHILD_PROFILE, id: OTHER_CHILD, nickname: 'Em' };

function snapshot(): RewardSnapshot {
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
  };
}

function purchase(): PurchaseResult {
  return {
    item: {
      id: FOOD,
      name_vi: 'Chuối',
      icon: '🍌',
      category: 'food',
      price: 5,
      currency: 'stars',
      description_vi: 'Momo rất thích chuối.',
      happinessGain: 1,
      phase: 'mvp',
    },
    wallet: { childId: CHILD, stars: 45, acorns: 2, updatedAt: NOW },
    inventoryItem: {
      childId: CHILD,
      itemId: FOOD,
      quantity: 1,
      equipped: false,
      acquiredAt: NOW,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetRewardStoreForTests();
  __resetShopStoreForTests();
  useSessionStore.setState({ children: [CHILD_PROFILE, OTHER_PROFILE], activeChildId: CHILD });
  useRewardStore.setState({
    childId: CHILD,
    snapshot: snapshot(),
    hydrated: true,
    loading: false,
    error: null,
    awards: {},
  });
  // Lần nạp lại sau mỗi hành động: treo mãi, để không ghi đè giá trị mà bài test đang khảo sát.
  getMock.mockImplementation(() => new Promise<RewardSnapshot>(() => {}));
  buyMock.mockResolvedValue(purchase());
});

afterEach(() => {
  vi.restoreAllMocks();
});

// =============================================================================
// useShop
// =============================================================================

describe('useShop', () => {
  it('buy() dùng BÉ ĐANG CHỌN, không phải một id nào khác', async () => {
    const { result } = renderHook(() => useShop());

    await act(async () => {
      await result.current.buy(FOOD);
    });

    expect(buyMock.mock.calls[0]?.[0]).toBe(CHILD);
  });

  it('⚠️ KHÔNG có bé đang chọn ⇒ KHÔNG gọi mạng, và vẫn trả promise đã xong', async () => {
    useSessionStore.setState({ children: [], activeChildId: null });

    const { result } = renderHook(() => useShop());

    // `resolves` chứ không `not.toThrow`: chỗ gọi là một `onClick`, nên một promise bị từ chối mà
    // không ai `await` sẽ lọt qua mọi khẳng định kiểu đó.
    await act(async () => {
      await expect(result.current.buy(FOOD)).resolves.toBeUndefined();
    });

    expect(buyMock).not.toHaveBeenCalled();
  });

  it('isBuying phản ánh đúng cờ đang-chạy của store (bật rồi tắt)', async () => {
    let releaseBuy!: (value: PurchaseResult) => void;
    buyMock.mockImplementation(
      () => new Promise<PurchaseResult>((resolve) => (releaseBuy = resolve)),
    );

    const { result } = renderHook(() => useShop());
    expect(result.current.isBuying(FOOD)).toBe(false);

    let inFlight!: Promise<void>;
    act(() => {
      inFlight = result.current.buy(FOOD);
    });

    await waitFor(() => expect(result.current.isBuying(FOOD)).toBe(true));

    await act(async () => {
      releaseBuy(purchase());
      await inFlight;
    });

    // Cờ phải được nhả SAU KHI xong — nếu không, nút mua mờ vĩnh viễn.
    expect(result.current.isBuying(FOOD)).toBe(false);
  });

  it('lastNotice đi thẳng từ store ra hook', async () => {
    const { result } = renderHook(() => useShop());

    await act(async () => {
      await result.current.buy(FOOD);
    });

    expect(result.current.lastNotice).toEqual({ kind: 'bought', itemId: FOOD });

    act(() => {
      result.current.dismissNotice();
    });

    expect(result.current.lastNotice).toBeNull();
  });
});

// =============================================================================
// useShopLifecycle
// =============================================================================

describe('useShopLifecycle', () => {
  it('⚠️ render lại với CÙNG một bé ⇒ KHÔNG xoá thông báo', () => {
    const { rerender } = renderHook(() => useShopLifecycle());

    // Thông báo bé vừa thấy (ví dụ đến từ tab "Cửa hàng").
    act(() => {
      useShopStore.setState({ lastNotice: { kind: 'fed', itemId: FOOD, happiness: 4 } });
    });

    rerender();

    // Đây là điều kiện để hook này KHÔNG được đặt ở màn hình Cửa hàng: ở đó, mỗi lần bé quay lại
    // màn hình là một lần THÔNG BÁO BỊ XOÁ, và bé không bao giờ đọc được kết quả việc mình vừa làm.
    expect(useShopStore.getState().lastNotice).toEqual({
      kind: 'fed',
      itemId: FOOD,
      happiness: 4,
    });
  });

  it('⭐ ĐỔI BÉ ⇒ xoá thông báo và cờ của bé cũ', async () => {
    renderHook(() => useShopLifecycle());

    act(() => {
      useShopStore.setState({
        lastNotice: { kind: 'bought', itemId: FOOD },
        buying: { [FOOD]: true },
      });
    });

    act(() => {
      useSessionStore.setState({ activeChildId: OTHER_CHILD });
    });

    // Thông báo "Momo ăn ngon quá!" là câu nói về linh vật của bé CŨ; hiện nó cho bé MỚI là nói
    // một điều không có thật. Cờ còn sót lại thì làm nút của bé mới mờ vĩnh viễn ở đúng một món.
    const state = useShopStore.getState();
    expect(state.lastNotice).toBeNull();
    expect(state.buying).toEqual({});
  });
});
