/**
 * Test cho `PetHousePage` (T064) — Nhà thú cưng + cửa hàng.
 *
 * Năm nhóm được kiểm kỹ nhất, vì cả năm đều hỏng IM LẶNG:
 *
 *   1. **"Chưa nạp được ví" KHÁC "ví rỗng".** Cửa hàng cần số dư để biết nút nào mờ. Vẽ thẻ khi
 *      chưa biết số dư nghĩa là hiện những con số sai — hoặc nút sáng cho món bé không mua được.
 *
 *   2. **Ví đã CŨ (HTTP 409 `INSUFFICIENT_FUNDS`) không phải lỗi.** Bé không làm gì sai; con số
 *      trên màn hình chỉ cao hơn con số thật. Không được có banner báo hỏng — chỉ một câu mời nhẹ
 *      — và ví PHẢI được đọc lại, nếu không con số sai nằm lại vĩnh viễn.
 *
 *   3. **Cho ăn lúc Momo đã no ⇒ câu "đang no", KHÔNG phải "ăn ngon quá!".** Server trả 200 và
 *      không tiêu món ăn của bé; nói "ăn ngon quá!" là NÓI DỐI. Cùng một luật với "không mắng trẻ".
 *
 *   4. **Mua thì gửi `{ itemId }` — KHÔNG gửi giá.** Giá do server quyết định; một trường `price`
 *      ở đây là mở đường cho client tự định giá món đồ của chính mình.
 *
 *   5. **Mặc / bỏ ra KHÔNG hiện thông báo.** Kết quả nhìn thấy được chính là Momo đội mũ; thêm
 *      một câu nữa là nói lại điều bé vừa tự tay làm.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import { ApiClientError } from '@/api/client.js';
import { rewardsApi } from '@/api/endpoints.js';
import { PetHousePage } from '@/pages/pet/PetHousePage.js';
import { __resetRewardStoreForTests, useRewardStore } from '@/store/rewardStore.js';
import { useSessionStore } from '@/store/sessionStore.js';
import { __resetShopStoreForTests } from '@/store/shopStore.js';
import { getShopItem } from '@shared/content/shop.js';
import type { ChildProfileDto } from '@shared/types/api.js';
import type {
  InventoryItem,
  PetState,
  PurchaseResult,
  RewardSnapshot,
  ShopItem,
  Wallet,
} from '@shared/types/reward.js';

vi.mock('@/api/endpoints.js', () => ({
  rewardsApi: { get: vi.fn(), buy: vi.fn(), feed: vi.fn(), equip: vi.fn() },
}));

const getMock = vi.mocked(rewardsApi.get);
const buyMock = vi.mocked(rewardsApi.buy);
const feedMock = vi.mocked(rewardsApi.feed);
const equipMock = vi.mocked(rewardsApi.equip);

const CHILD = 'chi_na';
const NOW = '2026-10-08T08:00:00.000Z';

/**
 * ⚠️ jsdom không cài `matchMedia` đầy đủ, mà `useReducedMotion()` của Framer Motion (dùng trong
 *    `CounterChip` — nhãn giá của mỗi thẻ) đọc nó. Thiếu stub ⇒ `TypeError: window.matchMedia is
 *    not a function` — một lỗi của MÔI TRƯỜNG TEST bị hiểu nhầm thành "trang hỏng".
 */
beforeAll(() => {
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
});

const CHILD_PROFILE: ChildProfileDto = {
  id: CHILD,
  nickname: 'Na',
  age: 7,
  avatarId: 'rabbit',
  createdAt: NOW,
};

// =============================================================================
// Dữ liệu dựng sẵn
// =============================================================================

/** Vật phẩm THẬT từ danh mục — xem ghi chú ở `shop-item-card.test.tsx`. */
function item(id: string): ShopItem {
  const found = getShopItem(id);
  if (!found) throw new Error(`shop-items.json thiếu "${id}" — fixture của test đã lệch dữ liệu`);
  return found;
}

function wallet(overrides: Partial<Wallet> = {}): Wallet {
  return { childId: CHILD, stars: 100, acorns: 5, updatedAt: NOW, ...overrides };
}

function pet(overrides: Partial<PetState> = {}): PetState {
  return {
    childId: CHILD,
    evolutionStage: 'baby',
    // ⚠️ BẮT BUỘC từ T04 (không còn tuỳ chọn): server LUÔN trả một con có thật (`petType`) và cờ
    //    "bé đã chọn chưa" (`petChosen`). Mặc định ở đây là "bé đã chọn Khỉ Momo" — nhờ vậy màn
    //    nhà KHÔNG tự điều hướng sang `/pet/chon` trong các ca không liên quan tới việc chọn con.
    petType: 'monkey',
    petChosen: true,
    wordsLearned: 0,
    happiness: 3,
    equippedItemIds: [],
    lastFedAt: null,
    updatedAt: NOW,
    ...overrides,
  };
}

function inventoryItem(itemId: string, overrides: Partial<InventoryItem> = {}): InventoryItem {
  return { childId: CHILD, itemId, quantity: 1, equipped: false, acquiredAt: NOW, ...overrides };
}

function snap(overrides: Partial<RewardSnapshot> = {}): RewardSnapshot {
  return {
    childId: CHILD,
    wallet: wallet(),
    xp: { childId: CHILD, xp: 0, level: 1, updatedAt: NOW },
    pet: pet(),
    streak: {
      childId: CHILD,
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: '2026-10-08',
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

function purchase(itemId = 'food-banana'): PurchaseResult {
  return {
    item: item(itemId),
    wallet: wallet({ stars: 95 }),
    inventoryItem: inventoryItem(itemId),
  };
}

/** Gieo sẵn `rewardStore` như thể ví vừa được nạp xong từ server. */
function seed(overrides: Partial<RewardSnapshot> = {}): void {
  useRewardStore.setState({
    childId: CHILD,
    snapshot: snap(overrides),
    hydrated: true,
    loading: false,
    error: null,
  });
}

/**
 * Render `PetHousePage` BÊN TRONG một router.
 *
 * ⚠️ BẮT BUỘC từ T04: trang nay dùng `useNavigate()` (nút "Đổi bạn đồng hành" + tự mở màn chọn
 *    con). `useNavigate()` NÉM nếu component không nằm trong một `<Router>` — nên mọi lần render
 *    ở tệp này phải đi qua đây, không gọi `render(<PetHousePage />)` trực tiếp nữa.
 *
 * Có sẵn route `/pet/chon` để ca "bé chưa chọn con" kiểm được việc điều hướng thật sự xảy ra.
 */
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/pet']}>
      <Routes>
        <Route path="/pet" element={<PetHousePage />} />
        <Route path="/pet/chon" element={<p>màn chọn bạn đồng hành</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  __resetRewardStoreForTests();
  __resetShopStoreForTests();
  useSessionStore.setState({ children: [CHILD_PROFILE], activeChildId: CHILD });
  vi.clearAllMocks();

  /**
   * ⚠️ MẶC ĐỊNH: MỌI VÒNG MẠNG THÀNH CÔNG NGAY — KHÔNG dùng promise treo.
   *
   * `rewardStore` có cổng "chỉ một lần nạp lại chạy tại một thời điểm", nằm ở biến cấp MODULE
   * (`refreshInFlight`) mà `__resetRewardStoreForTests()` KHÔNG chạm tới được. Một promise treo sẽ
   * giữ cổng đó đóng vĩnh viễn, và cú bấm "Thử lại" ở test sau không bao giờ gọi mạng — test đỏ vì
   * MÔI TRƯỜNG TEST, không vì hành vi của app. `mockResolvedValue` ở đây ghi đè mọi cài đặt còn sót
   * của test trước, nên không có test nào thừa hưởng một mock từ test khác.
   */
  getMock.mockResolvedValue(snap());
  buyMock.mockResolvedValue(purchase());
  feedMock.mockResolvedValue({
    pet: pet({ happiness: 4 }),
    item: item('food-banana'),
    wallet: wallet(),
  });
  equipMock.mockResolvedValue({ item: item('acc-hat'), inventory: [], pet: pet() });

  seed();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// =============================================================================
// Nhóm 1 — chưa nạp được ví / nạp hỏng
// =============================================================================

describe('PetHousePage — chưa nạp được ví', () => {
  it('⚠️ chưa nạp xong ⇒ "Đang chuẩn bị", KHÔNG hiện giá hay nút Mua', () => {
    __resetRewardStoreForTests();
    renderPage();

    expect(screen.getByText('Đang chuẩn bị...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Mua:/ })).not.toBeInTheDocument();
  });

  it('⚠️ nạp ví hỏng ⇒ KHÔNG lộ lỗi kỹ thuật, chỉ một lời thật + nút thử lại', () => {
    useRewardStore.setState({
      childId: CHILD,
      snapshot: null,
      hydrated: true,
      loading: false,
      error: 'NetworkError: failed to fetch',
    });
    renderPage();

    expect(screen.getByText('Chưa mở được cửa hàng')).toBeInTheDocument();
    // Thông báo thô của trình duyệt KHÔNG được lộ ra cho trẻ 7 tuổi.
    expect(screen.queryByText(/NetworkError/)).not.toBeInTheDocument();
  });

  it('nút "Thử lại" thật sự gọi mạng lại (nạp hỏng KHÔNG được kẹt vĩnh viễn)', async () => {
    useRewardStore.setState({
      childId: CHILD,
      snapshot: null,
      hydrated: true,
      loading: false,
      error: 'boom',
    });
    renderPage();

    getMock.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    await waitFor(() => expect(getMock).toHaveBeenCalledWith(CHILD));
  });
});

// =============================================================================
// Nhóm 2 — đầu trang: Momo + ❤️
// =============================================================================

describe('PetHousePage — đầu trang', () => {
  it('hiện tiêu đề màn hình và TÊN con bé đã chọn', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Nhà thú cưng' })).toBeInTheDocument();
    // Tên con nay suy từ `petType` (T04): 'monkey' ⇒ "Khỉ Momo" — KHÔNG còn hằng số "Momo".
    expect(screen.getByText('Khỉ Momo')).toBeInTheDocument();
  });

  it('hiện mức Vui vẻ của con vật', () => {
    seed({ pet: pet({ happiness: 4 }) });
    renderPage();

    expect(screen.getByRole('img', { name: 'Vui vẻ: 4 trên 5' })).toBeInTheDocument();
  });

  it('⚠️ có nút "Đổi bạn đồng hành" (≥64px) và nó dẫn tới /pet/chon', () => {
    renderPage();

    const button = screen.getByRole('button', { name: 'Đổi bạn đồng hành' });
    // Vùng chạm ≥64px (`min-h-touch`) — bắt buộc cho tay trẻ con.
    expect(button.className).toContain('min-h-touch');

    fireEvent.click(button);
    expect(screen.getByText('màn chọn bạn đồng hành')).toBeInTheDocument();
  });
});

// =============================================================================
// Nhóm 3 — ba nhóm vật phẩm
// =============================================================================

describe('PetHousePage — ba nhóm vật phẩm', () => {
  it('mặc định mở nhóm "Đồ ăn"', () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'Đồ ăn' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Mua: Chuối' })).toBeInTheDocument();
  });

  it('bấm nhóm "Phụ kiện" ⇒ hiện phụ kiện, ẩn đồ ăn', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Phụ kiện' }));

    expect(screen.getByRole('button', { name: 'Mua: Mũ' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mua: Chuối' })).not.toBeInTheDocument();
  });

  it('⚠️ chỉ MỘT nhóm được đánh dấu đang mở tại một thời điểm', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Trang trí' }));

    const pressed = ['Đồ ăn', 'Phụ kiện', 'Trang trí'].map((label) =>
      screen.getByRole('button', { name: label }).getAttribute('aria-pressed'),
    );
    expect(pressed).toEqual(['false', 'false', 'true']);
  });

  it('⚠️ chưa có món ăn nào ⇒ một câu mời nhẹ (không trách)', () => {
    renderPage();

    expect(
      screen.getByText('Bé chưa có món ăn nào. Mua một món cho Khỉ Momo nhé!'),
    ).toBeInTheDocument();
  });

  it('đã có đồ ăn trong túi ⇒ KHÔNG hiện câu mời đó nữa', () => {
    seed({ inventory: [inventoryItem('food-banana')] });
    renderPage();

    expect(screen.queryByText(/Bé chưa có món ăn nào/)).not.toBeInTheDocument();
  });

  it('câu mời chỉ thuộc nhóm "Đồ ăn", không lẫn sang nhóm khác', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Phụ kiện' }));

    expect(screen.queryByText(/Bé chưa có món ăn nào/)).not.toBeInTheDocument();
  });
});

// =============================================================================
// Nhóm 4 — mua
// =============================================================================

describe('PetHousePage — mua vật phẩm', () => {
  it('⚠️ chỉ gửi `{ itemId }` — KHÔNG gửi giá lên server', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Mua: Chuối' }));

    await waitFor(() => expect(buyMock).toHaveBeenCalled());
    expect(buyMock.mock.calls[0]![0]).toBe(CHILD);
    expect(buyMock.mock.calls[0]![1]).toEqual({ itemId: 'food-banana' });
  });

  it('mua xong ⇒ lời khen ĐÚNG tên món, và trình đọc màn hình cũng nghe thấy', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Mua: Chuối' }));

    expect(await screen.findByText('Bé vừa mua được Chuối!')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Bé vừa mua được Chuối!');
  });

  it('bấm ✕ ⇒ thông báo biến mất', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Mua: Chuối' }));
    await screen.findByText('Bé vừa mua được Chuối!');

    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));

    expect(screen.queryByText('Bé vừa mua được Chuối!')).not.toBeInTheDocument();
  });

  it('⚠️ ví trên màn hình đã CŨ (409) ⇒ câu mời nhẹ, KHÔNG phải lỗi, và ví được ĐỌC LẠI', async () => {
    renderPage();
    getMock.mockClear();
    buyMock.mockRejectedValue(new ApiClientError('INSUFFICIENT_FUNDS', 'Không đủ tiền', 409));

    fireEvent.click(screen.getByRole('button', { name: 'Mua: Chuối' }));

    expect(await screen.findByText('Mình cùng học thêm nhé!')).toBeInTheDocument();
    // Thông báo kỹ thuật của hệ thống KHÔNG được hiện cho bé.
    expect(screen.queryByText(/INSUFFICIENT_FUNDS/)).not.toBeInTheDocument();
    // Con số sai chỉ được sửa bằng cách đọc lại ví — không có đường nào khác.
    await waitFor(() => expect(getMock).toHaveBeenCalledWith(CHILD));
  });

  it('⚠️ thiếu tiền ⇒ nút Mua MỜ (để bé không bấm rồi bị từ chối)', () => {
    seed({ wallet: wallet({ stars: 0, acorns: 0 }) });
    renderPage();

    expect(screen.getByRole('button', { name: 'Mua: Chuối' })).toBeDisabled();
  });
});

// =============================================================================
// Nhóm 5 — cho ăn và mặc phụ kiện
// =============================================================================

describe('PetHousePage — cho ăn', () => {
  it('⚠️ con vật ĐÃ NO ⇒ "đang no lắm rồi!", KHÔNG phải "ăn ngon quá!"', async () => {
    seed({ pet: pet({ happiness: 5 }), inventory: [inventoryItem('food-banana')] });
    feedMock.mockResolvedValue({
      pet: pet({ happiness: 5 }),
      item: item('food-banana'),
      wallet: wallet(),
    });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Cho ăn: Chuối' }));

    expect(await screen.findByText('Khỉ Momo đang no lắm rồi!')).toBeInTheDocument();
    expect(screen.queryByText('Khỉ Momo ăn ngon quá!')).not.toBeInTheDocument();
  });

  it('cho ăn thật (❤️ tăng) ⇒ "ăn ngon quá!"', async () => {
    seed({ pet: pet({ happiness: 3 }), inventory: [inventoryItem('food-banana')] });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Cho ăn: Chuối' }));

    expect(await screen.findByText('Khỉ Momo ăn ngon quá!')).toBeInTheDocument();
  });
});

describe('PetHousePage — mặc phụ kiện', () => {
  it('bấm "Dùng ngay" ⇒ gửi đúng trạng thái ĐÍCH `equipped: true`', async () => {
    seed({ inventory: [inventoryItem('acc-hat')] });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Phụ kiện' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dùng ngay: Mũ' }));

    await waitFor(() =>
      expect(equipMock).toHaveBeenCalledWith(CHILD, 'acc-hat', { equipped: true }),
    );
  });

  it('⚠️ mặc / bỏ ra KHÔNG hiện thông báo — Momo đội mũ chính là kết quả', async () => {
    seed({ inventory: [inventoryItem('acc-hat')] });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Phụ kiện' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dùng ngay: Mũ' }));

    await waitFor(() => expect(equipMock).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

// =============================================================================
// Nhóm 7 — Momo MẶC ĐỒ ĐÃ MUA (T065)
// =============================================================================

/**
 * ⚠️ VÌ SAO MỌI TRUY VẤN Ở ĐÂY ĐỀU BỌC TRONG `within(momo)`:
 *   Icon của một món đồ xuất hiện ở HAI chỗ trên màn hình — trong thẻ ở lưới cửa hàng và trên
 *   người Momo. `screen.getByText('🎩')` vì thế vẫn xanh kể cả khi `PetAvatar` KHÔNG hề vẽ gì, vì
 *   nó tìm thấy chiếc mũ trong thẻ cửa hàng. Test sẽ nói dối đúng ở chỗ ta cần nó nói thật.
 */
describe('PetHousePage — Momo mặc đồ bé đã mua (T065)', () => {
  it('món ĐANG MẶC hiện trên người Momo', () => {
    seed({ inventory: [inventoryItem('acc-hat', { equipped: true })] });
    renderPage();

    const momo = screen.getByRole('img', { name: 'Khỉ Momo đang dùng: Mũ' });
    expect(within(momo).getByText('🎩')).toBeInTheDocument();
  });

  it('món CHƯA mặc thì KHÔNG hiện trên người con vật, dù bé đã sở hữu', () => {
    seed({ inventory: [inventoryItem('acc-hat')] });
    renderPage();

    const momo = screen.getByRole('img', { name: 'Khỉ Momo đang chơi trong nhà' });
    expect(within(momo).queryByText('🎩')).not.toBeInTheDocument();
  });

  it('trang trí đang bày ⇒ hiện trong cảnh quanh nhà', () => {
    seed({ inventory: [inventoryItem('dec-balloon', { equipped: true })] });
    renderPage();

    const momo = screen.getByRole('img', { name: 'Quanh nhà có Bóng bay' });
    expect(within(momo).getByText('🎈')).toBeInTheDocument();
  });

  it('⚠️ đồ ăn lỡ có `equipped = true` ⇒ KHÔNG lên người con vật, nhãn cũng không nhắc tới', () => {
    // Dữ liệu cũ hoặc một lần ghi sai. Đồ ăn bị TIÊU khi cho ăn, nên "đội quả chuối" sẽ sớm thành
    // một món đồ không còn tồn tại. Hai lớp chặn: `isEquippable` ở đây và `accessorySlotOf` trong
    // `PetAvatar`.
    seed({ inventory: [inventoryItem('food-banana', { equipped: true })] });
    renderPage();

    const momo = screen.getByRole('img', { name: 'Khỉ Momo đang chơi trong nhà' });
    expect(within(momo).queryByText('🍌')).not.toBeInTheDocument();
  });

  it('nhiều món cùng lúc: mặc + bày ⇒ nhãn đọc lên đủ cả hai vế', () => {
    seed({
      inventory: [
        inventoryItem('acc-scarf', { equipped: true }),
        inventoryItem('dec-plant', { equipped: true }),
      ],
    });
    renderPage();

    const momo = screen.getByRole('img', {
      name: 'Khỉ Momo đang dùng: Khăn quàng. Quanh nhà có Chậu cây',
    });
    expect(within(momo).getByText('🧣')).toBeInTheDocument();
    expect(within(momo).getByText('🪴')).toBeInTheDocument();
  });

  it('T066 — hình con vật và tên giai đoạn đi theo `snapshot.pet.evolutionStage`', () => {
    // Server là bên đếm từ; màn hình chỉ vẽ theo ID nó trả về. Hình lấy từ `pets.json` theo
    // (con × bậc): Khỉ ở bậc 'baby' là 🐵 (T04 — KHÔNG còn quả trứng 🥚, và không còn lấy hình
    // theo bậc từ `xp-levels.json`).
    seed({ pet: pet({ evolutionStage: 'baby' }) });
    renderPage();

    expect(screen.getByText('🐵')).toBeInTheDocument();
    expect(screen.getByText('Nhóc con')).toBeInTheDocument();
  });

  it('⚠️ bé CHƯA từng chọn con ⇒ màn nhà tự mở màn chọn bạn đồng hành', () => {
    // `petChosen: false` = DB chưa có `pet_type`. Bé phải được mời chọn con TRƯỚC khi chơi.
    seed({ pet: pet({ petChosen: false }) });
    renderPage();

    expect(screen.getByText('màn chọn bạn đồng hành')).toBeInTheDocument();
  });
});
