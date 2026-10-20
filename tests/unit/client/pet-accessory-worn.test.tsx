/**
 * Test cho `PetHousePage` — PHỤ KIỆN ĐANG MẶC (mục "phụ kiện không di chuyển tự do được").
 *
 * ⚠️ TỆP NÀY MÔ TẢ **HIỆN TRẠNG**, KHÔNG PHẢI MONG MUỐN.
 *
 * Bối cảnh: chủ dự án báo *"phụ kiện không di chuyển tự do được"*. Đo trên bản production thì ra:
 * một món bé bấm "Dùng ngay" **biến mất khỏi cả hai nơi** — không còn vật thể rời trong phòng, và
 * cũng không còn trong khay — chỉ còn hình vẽ trên người con vật. Mà toàn bộ cây vẽ con vật đều
 * `pointer-events-none`, nên **không có gì để chạm** ⇒ bé không kéo được món đang mặc.
 *
 * Ba khẳng định dưới đây khoá lại ĐÚNG hiện trạng đó (nguồn: `wornIds` lọc bỏ món `equipped` khỏi
 * `roomAccessories` ở dòng ~613 và khỏi `trayAccessories` ở dòng ~637 của `PetHousePage.tsx`):
 *
 *   1. Món ĐANG MẶC ⇒ trong phòng KHÔNG có `[data-room-accessory="<id>"]` (đếm = 0).
 *   2. Cùng lúc đó, khay đồ KHÔNG mời "Đặt <tên món> vào phòng" (đếm = 0).
 *   3. Món CHƯA mặc, sau khi bấm nút khay ⇒ trong phòng CÓ đúng MỘT phần tử (đếm = 1).
 *
 * ⚠️ Cách dựng màn được SAO LẠI từ `tests/unit/client/pet-house-page.test.tsx` (mock store / mạng /
 *    router) — không dựng từ đầu, để hai tệp không lệch nhau về cách gieo dữ liệu.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import { rewardsApi, roomApi } from '@/api/endpoints.js';
import { PetHousePage } from '@/pages/pet/PetHousePage.js';
import { __resetRewardStoreForTests, useRewardStore } from '@/store/rewardStore.js';
import { useSessionStore } from '@/store/sessionStore.js';
import { __resetShopStoreForTests } from '@/store/shopStore.js';
import { __resetRoomPlacementStoreForTests } from '@/store/roomPlacementStore.js';
import { getShopItem } from '@shared/content/shop.js';
import type { ChildProfileDto } from '@shared/types/api.js';
import type {
  EquipmentResult,
  InventoryItem,
  PetState,
  RewardSnapshot,
  ShopItem,
  Wallet,
} from '@shared/types/reward.js';

vi.mock('@/api/endpoints.js', () => ({
  rewardsApi: { get: vi.fn(), buy: vi.fn(), feed: vi.fn(), equip: vi.fn() },
  roomApi: { getPlacements: vi.fn(), savePlacements: vi.fn() },
}));

const getMock = vi.mocked(rewardsApi.get);
const equipMock = vi.mocked(rewardsApi.equip);
const getRoomMock = vi.mocked(roomApi.getPlacements);
const saveRoomMock = vi.mocked(roomApi.savePlacements);

const CHILD = 'chi_na';
const NOW = '2026-10-08T08:00:00.000Z';

/** jsdom thiếu `matchMedia` đầy đủ; `useReducedMotion()` của Framer Motion đọc nó (như tệp gốc). */
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

/** Vật phẩm THẬT từ danh mục — fixture lệch dữ liệu thì ném ngay, không im lặng cho qua. */
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

/** Gieo `rewardStore` như thể ví vừa được nạp xong từ server. */
function seed(overrides: Partial<RewardSnapshot> = {}): void {
  useRewardStore.setState({
    childId: CHILD,
    snapshot: snap(overrides),
    hydrated: true,
    loading: false,
    error: null,
  });
}

/** Kết quả `equip` mà `shopStore` ghi thẳng vào `rewardStore` (server gửi trọn gói túi đồ). */
function equipment(inventory: InventoryItem[]): EquipmentResult {
  return { item: item('acc-hat'), inventory, pet: pet() };
}

/** Render `PetHousePage` BÊN TRONG router (trang dùng `useNavigate()`). */
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
  getMock.mockResolvedValue(snap());
  equipMock.mockResolvedValue(equipment([]));
  seed();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PetHousePage — món ĐANG MẶC: một hình, và bấm được để THÁO', () => {
  it('⚠️ món ĐANG MẶC: có vẽ trên NGƯỜI con vật, KHÔNG là vật thể rời, KHÔNG nằm trong khay', async () => {
    // Một món ĐANG MẶC. Tên thật trong danh mục: `acc-hat` ⇒ "Mũ".
    seed({ inventory: [inventoryItem('acc-hat', { equipped: true })] });
    renderPage();

    const room = screen.getByRole('region', { name: 'Góc phòng của bé' });
    // Chờ vị trí tải xong — nếu không, "không có mũ dưới sàn" chỉ đúng vì khay/phòng còn đang tải.
    await waitFor(() => expect(within(room).queryByText('Đang tải vị trí…')).toBeNull());

    // (0) Nó CÓ trên người con vật — chứng minh đây đúng là ca "đang mặc", không phải "chưa có".
    const holder = room.querySelector<HTMLElement>('[data-room-pet]');
    expect(holder, 'phòng phải có con vật').not.toBeNull();
    expect(holder!.querySelectorAll('[data-accessory-id="acc-hat"]').length).toBeGreaterThan(0);

    // (1) Trong phòng: KHÔNG có chiếc mũ nào là vật thể rời (luật "một món, một chỗ").
    expect(room.querySelectorAll('[data-room-accessory="acc-hat"]').length).toBe(0);

    // (2) Trong khay: KHÔNG mời "Đặt Mũ vào phòng".
    expect(within(room).queryByRole('button', { name: 'Đặt Mũ vào phòng' })).toBeNull();
  });

  it('⚠️ T4 — món ĐANG MẶC có NÚT THÁO bấm được, nhãn đọc lên đúng tiếng Việt', async () => {
    seed({ inventory: [inventoryItem('acc-hat', { equipped: true })] });
    renderPage();

    const room = screen.getByRole('region', { name: 'Góc phòng của bé' });
    await waitFor(() => expect(within(room).queryByText('Đang tải vị trí…')).toBeNull());

    // Nhãn đủ HÀNH ĐỘNG + TÊN MÓN + TÊN CON: "Tháo Mũ ra khỏi Khỉ Momo".
    const removeButton = within(room).getByRole('button', {
      name: 'Tháo Mũ ra khỏi Khỉ Momo',
    });
    expect(removeButton).toBeInTheDocument();
    // Vùng chạm ≥56px bằng token dự án (`size-touch`), không phải px cứng.
    expect(removeButton.className).toContain('size-touch');

    /*
      ⚠️ KHÔNG khẳng định toạ độ/kích thước thật ở đây: jsdom KHÔNG tính layout, nên
      `getBoundingClientRect()` luôn trả 0 và mọi phép kiểm "≥56px" sẽ XANH GIẢ. Cỡ thật được
      chứng minh bằng ảnh chụp trên trình duyệt thật (xem báo cáo).
    */
  });

  it('⚠️ T5 — bấm nút tháo ⇒ `equip` được gọi với trạng thái ĐÍCH `false`', async () => {
    seed({ inventory: [inventoryItem('acc-hat', { equipped: true })] });
    renderPage();

    const room = screen.getByRole('region', { name: 'Góc phòng của bé' });
    await waitFor(() => expect(within(room).queryByText('Đang tải vị trí…')).toBeNull());

    fireEvent.click(within(room).getByRole('button', { name: 'Tháo Mũ ra khỏi Khỉ Momo' }));

    await waitFor(() =>
      expect(equipMock).toHaveBeenCalledWith(CHILD, 'acc-hat', { equipped: false }),
    );
  });

  it('⚠️ T6 — sau khi tháo: món hiện dưới sàn ĐÚNG MỘT lần (không phải 2) và nút tháo biến mất', async () => {
    seed({ inventory: [inventoryItem('acc-hat', { equipped: true })] });
    // Mũ có sẵn một chỗ trên sàn từ trước (dữ liệu cũ) — đúng ca "một món vừa equipped vừa có placement".
    getRoomMock.mockResolvedValue([{ itemId: 'acc-hat', x: 80, y: 70, hidden: false }]);
    // Server trả túi đồ SAU khi tháo: cùng chiếc mũ, `equipped: false`.
    equipMock.mockResolvedValue(equipment([inventoryItem('acc-hat', { equipped: false })]));
    getMock.mockResolvedValue(snap({ inventory: [inventoryItem('acc-hat', { equipped: false })] }));
    renderPage();

    const room = screen.getByRole('region', { name: 'Góc phòng của bé' });
    await waitFor(() => expect(within(room).queryByText('Đang tải vị trí…')).toBeNull());

    // Trước khi bấm: chưa có vật thể rời (món đang ở trên người).
    expect(room.querySelectorAll('[data-room-accessory="acc-hat"]').length).toBe(0);

    fireEvent.click(within(room).getByRole('button', { name: 'Tháo Mũ ra khỏi Khỉ Momo' }));

    // Sau khi tháo: ĐÚNG MỘT chiếc mũ dưới sàn — không bao giờ 2.
    await waitFor(() =>
      expect(room.querySelectorAll('[data-room-accessory="acc-hat"]').length).toBe(1),
    );
    // Và nút tháo không còn (món không còn "đang mặc").
    expect(
      within(room).queryByRole('button', { name: 'Tháo Mũ ra khỏi Khỉ Momo' }),
    ).toBeNull();
  });

  it('⚠️ món CHƯA mặc: bấm nút khay ⇒ trong phòng có ĐÚNG MỘT vật thể rời', async () => {
    // `acc-bow` ⇒ "Nơ" — món khác `acc-hat`, KHÔNG mặc.
    seed({ inventory: [inventoryItem('acc-bow')] });
    renderPage();

    const room = screen.getByRole('region', { name: 'Góc phòng của bé' });
    const trayButton = await within(room).findByRole('button', { name: 'Đặt Nơ vào phòng' });
    // Khay chỉ sẵn sàng khi vị trí đã tải xong — chờ nút hết `disabled` rồi mới bấm.
    await waitFor(() => expect(trayButton).toBeEnabled());

    // Trước khi đặt: chưa có gì trong phòng.
    expect(room.querySelector('[data-room-accessory="acc-bow"]')).toBeNull();

    fireEvent.click(trayButton);

    // Sau khi đặt: đúng MỘT vật thể rời mang `data-room-accessory="acc-bow"`.
    await waitFor(() =>
      expect(room.querySelectorAll('[data-room-accessory="acc-bow"]').length).toBe(1),
    );
    expect(
      within(room).getByRole('button', { name: /^Nơ, vị trí \d+%, \d+%/ }),
    ).toBeInTheDocument();
  });
});
