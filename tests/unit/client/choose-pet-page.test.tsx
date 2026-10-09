/**
 * Test cho `ChoosePetPage` (T04) — màn "Chọn bạn đồng hành" (`/pet/chon`).
 *
 * ⭐ VÌ SAO TỆP NÀY ĐÁNG TỒN TẠI (điểm #2 chủ dự án báo):
 *   *"Thú cưng không cho các bé chọn à, mặc định là trứng."* Màn này là câu trả lời cho khiếu nại
 *   đó. Nó hỏng IM LẶNG theo hai kiểu, và cả hai đều là lý do tệp test này có mặt:
 *     • Lưới hiện thiếu con (hoặc `aria-pressed` tô sáng 0 ô / 2 ô) ⇒ bé không biết mình đang chọn
 *       con nào, và trình đọc màn hình cũng không.
 *     • Nút xác nhận nhỏ hơn 88px, hoặc "Để sau" vẫn gọi mạng ⇒ bé bấm hụt, hoặc bị ĐỔI CON ngoài
 *       ý muốn khi bé chỉ muốn rời màn.
 *
 * ⚠️ LUẬT SỐ 1 — KHÔNG BAO GIỜ MẮNG TRẺ. Nhóm cuối quét `innerHTML` (bắt cả `aria-label`) để
 *    chắc không chuỗi nào — kể cả trạng thái lỗi — dùng "sai"/"kém"/"chưa đạt"/"thất bại".
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import { rewardsApi } from '@/api/endpoints.js';
import { ChoosePetPage } from '@/pages/pet/ChoosePetPage.js';
import { PET_CHOOSE_SKIP_KEY } from '@/lib/petChooseSkip.js';
import { __resetRewardStoreForTests, useRewardStore } from '@/store/rewardStore.js';
import { useSessionStore } from '@/store/sessionStore.js';
import { __resetShopStoreForTests } from '@/store/shopStore.js';
import { PET_DEFINITIONS } from '@shared/content/pets.js';
import type { ChildProfileDto } from '@shared/types/api.js';
import type { PetState, RewardSnapshot } from '@shared/types/reward.js';

/**
 * ⚠️ Mock CHỈ hai hàm mà màn này chạm tới: `get` (nút "Thử lại") và `choosePet` (nút xác nhận).
 *    `shopStore` import cả `buy`/`feed`/`equip` nhưng KHÔNG gọi chúng ở đây.
 */
vi.mock('@/api/endpoints.js', () => ({
  rewardsApi: { get: vi.fn(), choosePet: vi.fn() },
}));

const getMock = vi.mocked(rewardsApi.get);
const choosePetMock = vi.mocked(rewardsApi.choosePet);

const CHILD = 'chi_na';
const NOW = '2026-10-08T08:00:00.000Z';

const CHILD_PROFILE: ChildProfileDto = {
  id: CHILD,
  nickname: 'Na',
  age: 7,
  avatarId: 'rabbit',
  createdAt: NOW,
};

function pet(overrides: Partial<PetState> = {}): PetState {
  return {
    childId: CHILD,
    evolutionStage: 'baby',
    petType: 'monkey',
    petChosen: false,
    wordsLearned: 0,
    happiness: 3,
    equippedItemIds: [],
    lastFedAt: null,
    updatedAt: NOW,
    ...overrides,
  };
}

function snap(overrides: Partial<RewardSnapshot> = {}): RewardSnapshot {
  return {
    childId: CHILD,
    wallet: { childId: CHILD, stars: 0, acorns: 0, updatedAt: NOW },
    xp: { childId: CHILD, xp: 0, level: 1, updatedAt: NOW },
    pet: pet(),
    streak: {
      childId: CHILD,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
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

/** Render màn chọn bên trong một router (trang dùng `useNavigate`). */
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/pet/chon']}>
      <Routes>
        <Route path="/pet/chon" element={<ChoosePetPage />} />
        <Route path="/pet" element={<p>nhà thú cưng</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Sáu nút thẻ (có `aria-pressed`) — dùng chung cho nhiều khẳng định. */
function petButtons(): HTMLElement[] {
  // `queryAllByRole` (không `getAllByRole`): trạng thái "chưa nạp" KHÔNG có nút nào, và
  // `getAllByRole` sẽ NÉM thay vì trả mảng rỗng — làm test đỏ vì lý do sai.
  return screen.queryAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'));
}

beforeEach(() => {
  __resetRewardStoreForTests();
  __resetShopStoreForTests();
  useSessionStore.setState({ children: [CHILD_PROFILE], activeChildId: CHILD });
  sessionStorage.clear();
  vi.clearAllMocks();
  getMock.mockResolvedValue(snap({ pet: pet({ petType: 'cat', petChosen: true }) }));
  choosePetMock.mockResolvedValue(pet({ petType: 'cat', petChosen: true }));
  seed();
});

// =============================================================================
// 1. Lưới 6 thẻ + trạng thái đang chọn
// =============================================================================

describe('ChoosePetPage — lưới chọn con', () => {
  it('render ĐỦ 6 nút thẻ (một nút cho mỗi con trong danh mục)', () => {
    renderPage();

    expect(PET_DEFINITIONS).toHaveLength(6);
    expect(petButtons()).toHaveLength(PET_DEFINITIONS.length);
    for (const definition of PET_DEFINITIONS) {
      expect(screen.getByRole('button', { name: definition.name_vi })).toBeInTheDocument();
    }
  });

  it('⚠️ `aria-pressed` đúng MỘT nút = true tại một thời điểm', () => {
    renderPage();

    const pressed = petButtons().map((b) => b.getAttribute('aria-pressed'));
    expect(pressed.filter((p) => p === 'true')).toHaveLength(1);
  });

  it('chạm một con khác ⇒ dấu đang chọn CHUYỂN sang con đó (vẫn đúng một ô)', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Rồng Long' }));

    const pressed = petButtons().filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveAccessibleName('Rồng Long');
  });

  it('thẻ có vùng chạm ≥64px (`min-h-touch`)', () => {
    renderPage();

    for (const button of petButtons()) {
      expect(button.className).toContain('min-h-touch');
    }
  });
});

// =============================================================================
// 2. Nút xác nhận
// =============================================================================

describe('ChoosePetPage — xác nhận', () => {
  it('nút xác nhận có lớp `min-h-touch-lg` (≥88px)', () => {
    renderPage();

    const confirm = screen.getByRole('button', { name: 'Chọn bạn này!' });
    expect(confirm.className).toContain('min-h-touch-lg');
  });

  it('⚠️ bấm một thẻ rồi xác nhận ⇒ `choosePet` gọi ĐÚNG MỘT LẦN với ĐÚNG id đã chọn', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Mèo Miu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chọn bạn này!' }));

    await waitFor(() => expect(choosePetMock).toHaveBeenCalledTimes(1));
    expect(choosePetMock.mock.calls[0]).toEqual([CHILD, { petType: 'cat' }]);
  });

  it('xác nhận xong ⇒ về nhà thú cưng', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Chọn bạn này!' }));

    await waitFor(() => expect(screen.getByText('nhà thú cưng')).toBeInTheDocument());
  });
});

// =============================================================================
// 3. "Để sau"
// =============================================================================

describe('ChoosePetPage — để sau', () => {
  it('⚠️ "Để sau" KHÔNG đổi con, và ghi cờ vào `sessionStorage`', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Để sau' }));

    expect(choosePetMock).not.toHaveBeenCalled();
    // `sessionStorage`, KHÔNG `localStorage`: "đừng hỏi lại trong PHIÊN này".
    expect(sessionStorage.getItem(PET_CHOOSE_SKIP_KEY)).toBe('1');
  });

  it('"Để sau" cũng đưa bé về nhà thú cưng', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Để sau' }));

    expect(screen.getByText('nhà thú cưng')).toBeInTheDocument();
  });
});

// =============================================================================
// 4. Chưa nạp xong / nạp hỏng
// =============================================================================

describe('ChoosePetPage — chưa nạp được', () => {
  it('chưa nạp xong ⇒ "Đang chuẩn bị", KHÔNG hiện lưới', () => {
    __resetRewardStoreForTests();
    renderPage();

    expect(screen.getByText('Đang chuẩn bị...')).toBeInTheDocument();
    expect(petButtons()).toHaveLength(0);
  });

  it('⚠️ nạp hỏng ⇒ lời thật + nút thử lại, KHÔNG lộ lỗi kỹ thuật', async () => {
    useRewardStore.setState({
      childId: CHILD,
      snapshot: null,
      hydrated: true,
      loading: false,
      error: 'NetworkError: failed to fetch',
    });
    renderPage();

    expect(screen.getByText('Chưa mở được các bạn đồng hành')).toBeInTheDocument();
    expect(screen.queryByText(/NetworkError/)).not.toBeInTheDocument();

    getMock.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(getMock).toHaveBeenCalledWith(CHILD));
  });
});

// =============================================================================
// 5. LUẬT SỐ 1 — không mắng trẻ
// =============================================================================

const BANNED_WORDS = ['sai', 'kém', 'chưa đạt', 'thất bại'] as const;

function assertNoBannedWords(container: HTMLElement): void {
  const html = container.innerHTML;
  for (const word of BANNED_WORDS) {
    expect(html.includes(word)).toBe(false);
  }
}

describe('ChoosePetPage — LUẬT TRẺ: không từ bị cấm', () => {
  it('trạng thái có dữ liệu sạch từ bị cấm', () => {
    const { container } = renderPage();
    assertNoBannedWords(container);
  });

  it('trạng thái LỖI tải sạch từ bị cấm', () => {
    useRewardStore.setState({
      childId: CHILD,
      snapshot: null,
      hydrated: true,
      loading: false,
      error: 'boom',
    });
    const { container } = renderPage();
    assertNoBannedWords(container);
  });

  it('trạng thái ĐANG NẠP sạch từ bị cấm', () => {
    __resetRewardStoreForTests();
    const { container } = renderPage();
    assertNoBannedWords(container);
  });
});
