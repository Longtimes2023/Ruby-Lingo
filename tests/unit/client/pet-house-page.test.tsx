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
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import { ApiClientError } from '@/api/client.js';
import { rewardsApi, roomApi } from '@/api/endpoints.js';
import { PetHousePage } from '@/pages/pet/PetHousePage.js';
import { __resetRewardStoreForTests, useRewardStore } from '@/store/rewardStore.js';
import { useSessionStore } from '@/store/sessionStore.js';
import { __resetShopStoreForTests } from '@/store/shopStore.js';
import { __resetRoomPlacementStoreForTests } from '@/store/roomPlacementStore.js';
import { getShopItem } from '@shared/content/shop.js';
import type { RoomPlacement } from '@shared/schemas/room.js';
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
  roomApi: { getPlacements: vi.fn(), savePlacements: vi.fn() },
}));

const getMock = vi.mocked(rewardsApi.get);
const buyMock = vi.mocked(rewardsApi.buy);
const feedMock = vi.mocked(rewardsApi.feed);
const equipMock = vi.mocked(rewardsApi.equip);
const getRoomMock = vi.mocked(roomApi.getPlacements);
const saveRoomMock = vi.mocked(roomApi.savePlacements);

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
  __resetRoomPlacementStoreForTests();
  useSessionStore.setState({ children: [CHILD_PROFILE], activeChildId: CHILD });
  vi.clearAllMocks();
  getRoomMock.mockResolvedValue([]);
  saveRoomMock.mockImplementation(async (_childId, placements) => placements);

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

  it('trang trí đang bày ⇒ hiện trong cảnh quanh nhà', async () => {
    seed({ inventory: [inventoryItem('dec-balloon')] });
    getRoomMock.mockResolvedValue([{ itemId: 'dec-balloon', x: 30, y: 40, hidden: false }]);
    renderPage();

    const room = screen.getByRole('region', { name: 'Góc phòng của bé' });
    expect(await within(room).findByRole('button', { name: /Bóng bay, vị trí 30%, 40%/ })).toBeInTheDocument();
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

  it('nhiều món cùng lúc: mặc + bày hiện ở đúng khu vực', async () => {
    seed({
      inventory: [inventoryItem('acc-scarf', { equipped: true }), inventoryItem('dec-plant')],
    });
    getRoomMock.mockResolvedValue([{ itemId: 'dec-plant', x: 50, y: 65, hidden: false }]);
    renderPage();

    const momo = screen.getByRole('img', { name: 'Khỉ Momo đang dùng: Khăn quàng' });
    /*
      ⚠️ `getAllByText` chứ `getByText`: khăn quàng là món QUẤN quanh cổ nên được vẽ HAI LƯỢT
      (`ACCESSORY_WRAP` — nửa trên ở lớp sau, nửa dưới ở lớp trước), và đường lùi emoji của
      `ShopArtwork` nằm trong cả hai lượt ⇒ hai phần tử cùng chữ. Điều cần khẳng định là MÓN CÓ MẶT.
    */
    expect(within(momo).getAllByText('🧣').length).toBe(2);
    const room = screen.getByRole('region', { name: 'Góc phòng của bé' });
    expect(await within(room).findByRole('button', { name: /Chậu cây, vị trí 50%, 65%/ })).toBeInTheDocument();
  });

  it('mũi tên bàn phím cập nhật vị trí và chỉ lưu một lần', async () => {
    seed({ inventory: [inventoryItem('dec-balloon')] });
    getRoomMock.mockResolvedValue([{ itemId: 'dec-balloon', x: 30, y: 40, hidden: false }]);
    renderPage();

    const room = screen.getByRole('region', { name: 'Góc phòng của bé' });
    const decoration = await within(room).findByRole('button', { name: /Bóng bay, vị trí 30%, 40%/ });
    fireEvent.keyDown(decoration, { key: 'ArrowRight' });

    await waitFor(() => expect(saveRoomMock).toHaveBeenCalledTimes(1));
    expect(saveRoomMock).toHaveBeenLastCalledWith(CHILD, [
      { itemId: 'dec-balloon', x: 32, y: 40, hidden: false },
    ]);
  });

  it('nhiều thay đổi trong lúc lưu tuần tự ghi snapshot mới nhất', async () => {
    seed({ inventory: [inventoryItem('dec-balloon')] });
    getRoomMock.mockResolvedValue([{ itemId: 'dec-balloon', x: 30, y: 40, hidden: false }]);
    let finishFirst!: (value: RoomPlacement[]) => void;
    saveRoomMock.mockImplementationOnce(
      () => new Promise((resolve) => { finishFirst = resolve; }),
    );
    renderPage();

    const room = screen.getByRole('region', { name: 'Góc phòng của bé' });
    const decoration = await within(room).findByRole('button', { name: /Bóng bay, vị trí 30%, 40%/ });
    fireEvent.keyDown(decoration, { key: 'ArrowRight' });
    await waitFor(() => expect(saveRoomMock).toHaveBeenCalledTimes(1));
    fireEvent.keyDown(decoration, { key: 'ArrowRight' });
    expect(saveRoomMock).toHaveBeenCalledTimes(1);

    finishFirst([{ itemId: 'dec-balloon', x: 32, y: 40, hidden: false }]);
    await waitFor(() => expect(saveRoomMock).toHaveBeenCalledTimes(2));
    expect(saveRoomMock).toHaveBeenLastCalledWith(CHILD, [
      { itemId: 'dec-balloon', x: 34, y: 40, hidden: false },
    ]);
  });

  it('T066 — hình con vật và tên giai đoạn đi theo `snapshot.pet.evolutionStage`', () => {
    // Server là bên đếm từ; màn hình chỉ vẽ theo ID nó trả về. Hình lấy từ `pets.json` theo
    // (con × bậc): Khỉ ở bậc 'baby' là 🐵 (T04 — KHÔNG còn quả trứng 🥚, và không còn lấy hình
    // theo bậc từ `xp-levels.json`).
    seed({ pet: pet({ evolutionStage: 'baby' }) });
    renderPage();

    /*
      ⚠️ `getAllByText` chứ không `getByText`: emoji là ĐƯỜNG LÙI của `PetArtwork` (`<span hidden>`),
         và từ khi con vật trong "Góc phòng của bé" cũng vẽ bằng `PetAvatar`, cùng một emoji có mặt
         ở HAI chỗ (thẻ đầu trang + trong phòng). Khẳng định "có ít nhất một chỗ" là điều test này
         muốn nói; số lần xuất hiện là chuyện của bố cục, không phải của giai đoạn tiến hoá.
    */
    expect(screen.getAllByText('🐵').length).toBeGreaterThan(0);
    expect(screen.getByText('Nhóc con')).toBeInTheDocument();
  });

  it('⚠️ bé CHƯA từng chọn con ⇒ màn nhà tự mở màn chọn bạn đồng hành', () => {
    // `petChosen: false` = DB chưa có `pet_type`. Bé phải được mời chọn con TRƯỚC khi chơi.
    seed({ pet: pet({ petChosen: false }) });
    renderPage();

    expect(screen.getByText('màn chọn bạn đồng hành')).toBeInTheDocument();
  });
});

// =============================================================================
// Nhóm 8 — phòng phải là MỘT CĂN PHÒNG và mọi cỡ phải theo % KHUNG (T067)
// =============================================================================

/**
 * ⚠️ VÌ SAO NHÓM NÀY TỒN TẠI — LỖI CHỦ DỰ ÁN BÁO CÓ THẬT:
 *   *"phòng của thú cưng không phải trong 1 khung ảnh sao, lấy bóng bay, chậu cây, tranh treo
 *   tường thì nhỏ xíu, phòng thì không ra cái phòng, chỉ là cái phông nền"*.
 *   Đo ra thì: khung rộng 328px ở 360×640 nhưng 848px ở 1280×800, còn mọi món trang trí thì
 *   ĐỨNG YÊN ở 24px (`size-6`) ⇒ màn càng lớn càng nhỏ xíu (7,3% → 2,8% khung). Ba khẳng định
 *   dưới đây khoá lại ĐÚNG ba thứ đã hỏng: (1) có tường + baseboard + sàn; (2) cỡ đo theo khung
 *   bằng `cqw` chứ không px; (3) thú cưng cũng theo khung, không còn `clamp(…vw…)`.
 */
describe('PetHousePage — phòng đúng tỉ lệ khung, không phụ thuộc viewport (T067)', () => {
  const roomRegion = () =>
    screen.getByRole('region', { name: 'Góc phòng của bé' });

  it('⚠️ có đủ tường + baseboard + sàn: chân tường 61,8%H, baseboard 2,5%H', () => {
    renderPage();

    const wall = roomRegion().querySelector<HTMLElement>('[data-room-wall]');
    const baseboard = roomRegion().querySelector<HTMLElement>('[data-room-baseboard]');
    const floor = roomRegion().querySelector<HTMLElement>('[data-room-floor]');

    expect(wall, 'thiếu dải tường').not.toBeNull();
    expect(baseboard, 'thiếu baseboard — đây là chi tiết làm nên "căn phòng"').not.toBeNull();
    expect(floor, 'thiếu dải sàn').not.toBeNull();

    expect(wall!.style.height).toBe('61.8%');
    expect(baseboard!.style.top).toBe('61.8%');
    expect(baseboard!.style.height).toBe('2.5%');
    // Sàn = phần còn lại dưới baseboard: 100 − (61,8 + 2,5) = 35,7%H.
    expect(floor!.style.height).toBe('35.7%');
  });

  it('⚠️ ảnh trang trí đo theo % KHUNG (cqw) — KHÔNG còn 24px cứng', async () => {
    seed({ inventory: [inventoryItem('dec-balloon')] });
    getRoomMock.mockResolvedValue([{ itemId: 'dec-balloon', x: 30, y: 40, hidden: false }]);
    renderPage();

    const button = await within(roomRegion()).findByRole('button', { name: /^Bóng bay, vị trí 30%, 40%/ });

    // Ô CHẠM vẫn ≥64px cho tay trẻ con…
    expect(button.className).toContain('size-touch');
    // …nhưng ẢNH bên trong không còn bị ghim vào cỡ 24px (`size-6`) — đúng căn bệnh cũ.
    expect(button.className).not.toContain('size-6');

    const art = button.querySelector<HTMLElement>(':scope > span');
    expect(art, 'ảnh phải nằm trong một khung đo theo khung phòng').not.toBeNull();
    // 13%W của khung ⇒ 13cqw (1cqw = 1% bề rộng khung; khung có `container-type: inline-size`).
    // ⚠️ jsdom không hiểu đơn vị `cqw` nên khai báo đi qua biến CSS — xem `roomSizeStyle`.
    expect(art!.style.getPropertyValue('--room-w')).toBe('13cqw');
    expect(art!.style.getPropertyValue('--room-h')).toBe('13cqw');
    expect(art!.className).not.toContain('size-6');
  });

  it('⚠️ thú cưng trong phòng: đáy 16% / cao 46% khung — KHÔNG còn clamp(…vw…)', () => {
    renderPage();

    const holder = roomRegion().querySelector<HTMLElement>('[data-room-pet]');
    expect(holder, 'phòng phải có con vật').not.toBeNull();

    // Đáy ở 84%H ⇒ cách mép dưới 16%; cao 46%H; rộng suy từ cao (ảnh gốc vuông) = 34,5cqw.
    expect(holder!.style.bottom).toBe('16%');
    expect(holder!.style.height).toBe('46%');
    expect(holder!.style.getPropertyValue('--room-pet-w')).toBe('34.5cqw');
    // `clamp(72px,24vw,144px)` là biểu thức làm con vật ĐỨNG YÊN khi khung giãn.
    expect(roomRegion().innerHTML).not.toContain('clamp(');
  });

  /**
   * ⚠️⚠️ ĐÂY LÀ CHỖ HÀNH VI ĐÃ ĐỔI THEO QUYẾT ĐỊNH CỦA CHỦ DỰ ÁN.
   *
   * Bản trước: con vật TRONG PHÒNG mặc đúng bộ phụ kiện đang mặc (`equipped`). Chủ dự án kết luận
   * cách "ghép phụ kiện lên người theo lớp" không đẹp, và chốt: TÁCH phụ kiện ra thành vật thể tự
   * do, bé tự kéo vào phòng. Vì vậy con vật trong phòng nay ĐỨNG TRẦN — còn thẻ ở ĐẦU TRANG vẫn
   * mặc bộ `equipped` như cũ (bé cần thấy "con vật đang mặc gì" ở thẻ hồ sơ).
   */
  it('⚠️ con vật TRONG PHÒNG KHÔNG mặc phụ kiện, nhưng thẻ ĐẦU TRANG vẫn mặc', () => {
    seed({
      inventory: [
        inventoryItem('acc-hat', { equipped: true }),
        inventoryItem('acc-scarf', { equipped: true }),
        inventoryItem('acc-glasses', { equipped: true }),
      ],
    });
    renderPage();

    const holder = roomRegion().querySelector<HTMLElement>('[data-room-pet]');
    expect(holder, 'phòng phải có con vật').not.toBeNull();
    // Trong phòng: KHÔNG có lớp phụ kiện nào của `PetAvatar`.
    expect(holder!.querySelectorAll('[data-accessory-id]').length).toBe(0);

    // Thẻ đầu trang: vẫn mặc đúng bộ đang `equipped`.
    const card = screen.getByRole('img', { name: 'Khỉ Momo đang dùng: Mũ, Khăn quàng, Kính' });
    const worn = [
      ...new Set(
        [...card.querySelectorAll<HTMLElement>('[data-accessory-id]')].map(
          (node) => node.dataset.accessoryId,
        ),
      ),
    ];
    expect(worn.sort()).toEqual(['acc-glasses', 'acc-hat', 'acc-scarf']);
  });

  it('⚠️ phụ kiện slot `back` vẽ TRƯỚC con vật; slot khác vẽ SAU con vật', async () => {
    seed({
      inventory: [inventoryItem('acc-backpack'), inventoryItem('acc-hat')],
    });
    getRoomMock.mockResolvedValue([
      { itemId: 'acc-backpack', x: 20, y: 70, hidden: false },
      { itemId: 'acc-hat', x: 80, y: 70, hidden: false },
    ]);
    renderPage();

    const room = roomRegion();
    const back = await within(room).findByRole('button', { name: /^Ba lô, vị trí 20%, 70%/ });
    const front = await within(room).findByRole('button', { name: /^Mũ, vị trí 80%, 70%/ });
    const pet = room.querySelector<HTMLElement>('[data-room-pet]');
    expect(pet, 'phòng phải có con vật').not.toBeNull();

    // Ba lô (slot `back`) ở SAU lưng ⇒ xuất hiện TRƯỚC con vật trong DOM.
    expect(back.compareDocumentPosition(pet!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Mũ (slot `head`) đeo TRƯỚC người ⇒ xuất hiện SAU con vật trong DOM.
    expect(front.compareDocumentPosition(pet!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();

    /*
      ⚠️ Khẳng định thêm trên `z-index`: jsdom KHÔNG tính `z-index`, nên thứ tự DOM ở trên vẫn
      xanh kể cả khi món `back` bị gán `z-10` (khi đó ba lô sẽ ĐÈ LÊN con vật trong trình duyệt
      thật). Khoá thẳng lớp là cách duy nhất bắt được lỗi đó bằng unit test.
    */
    expect(back.className).not.toContain('z-10');
    expect(front.className).toContain('z-10');
  });

  it('⚠️ khay đồ: hiện món CHƯA đặt; bấm ⇒ món vào phòng và RỜI khay', async () => {
    seed({ inventory: [inventoryItem('acc-hat')] });
    renderPage();

    const room = roomRegion();
    const trayButton = await within(room).findByRole('button', { name: 'Đặt Mũ vào phòng' });
    // Chưa đặt ⇒ con vật / phòng không có món này.
    expect(room.querySelector('[data-room-accessory="acc-hat"]')).toBeNull();

    // Khay chỉ sẵn sàng khi vị trí đã tải xong — chờ nút hết `disabled` rồi mới bấm.
    await waitFor(() => expect(trayButton).toBeEnabled());
    fireEvent.click(trayButton);

    // Đã vào phòng, ở vị trí mặc định trên sàn (y = 70%).
    expect(
      await within(room).findByRole('button', { name: /^Mũ, vị trí \d+%, 70%/ }),
    ).toBeInTheDocument();
    // … và biến khỏi khay.
    await waitFor(() =>
      expect(within(room).queryByRole('button', { name: 'Đặt Mũ vào phòng' })).toBeNull(),
    );
  });

  it('⚠️ khay ẩn khi bé CHƯA có phụ kiện nào', () => {
    renderPage();

    expect(screen.queryByRole('group', { name: 'Đồ của Khỉ Momo' })).not.toBeInTheDocument();
  });

  it('⚠️ khay ẩn khi mọi phụ kiện đã đặt trong phòng (không để khung trống)', async () => {
    seed({ inventory: [inventoryItem('acc-hat')] });
    getRoomMock.mockResolvedValue([{ itemId: 'acc-hat', x: 50, y: 70, hidden: false }]);
    renderPage();

    await within(roomRegion()).findByRole('button', { name: /^Mũ, vị trí 50%, 70%/ });
    expect(screen.queryByRole('group', { name: 'Đồ của Khỉ Momo' })).not.toBeInTheDocument();
  });

  it('⚠️ khay không tràn ngang ở màn hẹp — dùng `flex-wrap` + `overflow-x-auto`', async () => {
    seed({ inventory: [inventoryItem('acc-hat')] });
    renderPage();

    const tray = await screen.findByRole('group', { name: 'Đồ của Khỉ Momo' });
    expect(tray.className).toContain('flex-wrap');
    expect(tray.className).toContain('overflow-x-auto');
    // Mỗi món là nút chạm ≥64px (`size-touch`).
    expect(within(tray).getByRole('button', { name: 'Đặt Mũ vào phòng' }).className).toContain(
      'size-touch',
    );
  });

  it('⚠️ con vật trong phòng là bối cảnh TRẦN — không thẻ lồng trong phòng', () => {
    renderPage();

    const holder = roomRegion().querySelector<HTMLElement>('[data-room-pet]');
    expect(holder).not.toBeNull();

    // Có HÌNH thật của con vật…
    expect(holder!.querySelector('img[src^="/assets/pets/"]')).not.toBeNull();
    // …nhưng KHÔNG kèm dải trời/dải cỏ của thẻ (phòng đã có tường/baseboard/sàn riêng)…
    expect(holder!.querySelector('.bg-pet-sky')).toBeNull();
    expect(holder!.querySelector('.bg-pet-ground')).toBeNull();
    // …và KHÔNG kèm chú thích giai đoạn của thẻ.
    expect(within(holder!).queryByText('Nhóc con')).toBeNull();
    // Nhãn đọc lên đã có ở thẻ đầu trang ⇒ con vật trong phòng là TRANG TRÍ, không đọc lặp.
    expect(holder!.querySelector('[role="img"]')).toBeNull();
  });

  it('⚠️ khung phòng dùng container query để mọi cỡ bên trong bám theo khung', () => {
    renderPage();

    const frame = roomRegion().querySelector<HTMLElement>('div.aspect-\\[4\\/3\\]');
    expect(frame, 'không tìm thấy khung phòng 4:3').not.toBeNull();
    expect(frame!.className).toContain('[container-type:inline-size]');
  });

  it('⚠️ ảnh nền phòng phải CÓ THẬT trên đĩa (URL 404 ⇒ bé thấy ô ảnh vỡ)', () => {
    renderPage();

    const src = '/assets/rooms/room-default.webp';
    const background = roomRegion().querySelector(`img[src="${src}"]`);
    expect(background, 'khung phòng phải tham chiếu ảnh nền').not.toBeNull();
    // Ảnh là ĐƯỜNG LÙI, không phải thứ bắt buộc — nhưng nếu đã khai URL thì tệp phải tồn tại.
    expect(existsSync(join(process.cwd(), 'public', src)), `${src} không có trên đĩa`).toBe(true);
  });

  it('món bé TỰ KÉO vẫn được tôn trọng vị trí (chỉ kẹp trong khung)', async () => {
    seed({ inventory: [inventoryItem('dec-plant')] });
    // Vị trí bé đã kéo: 14% / 70% — KHÁC hẳn vị trí mặc định của chậu cây (làn xa, ~58%H).
    getRoomMock.mockResolvedValue([{ itemId: 'dec-plant', x: 14, y: 70, hidden: false }]);
    renderPage();

    const button = await within(roomRegion()).findByRole('button', { name: /^Chậu cây, vị trí 14%, 70%/ });
    expect(button.style.left).toBe('14%');
    expect(button.style.top).toBe('70%');
  });

  it('món CHƯA đặt không hiện trong phòng', () => {
    seed({ inventory: [inventoryItem('dec-castle')] });
    renderPage();

    // Chưa có placement ⇒ chưa vẽ trong khung, nhưng vẫn có nút "Đặt … vào phòng".
    expect(roomRegion().querySelector('button[aria-label^="Lâu đài nhỏ"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Đặt Lâu đài nhỏ vào phòng' })).toBeInTheDocument();
  });
});
