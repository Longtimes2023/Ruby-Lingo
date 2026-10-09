/**
 * Test cho `CollectionPage` (T070) — Bộ sưu tập huy hiệu & sticker.
 *
 * Bốn nhóm được kiểm kỹ nhất, vì cả bốn đều hỏng IM LẶNG:
 *
 *   1. **Vẽ ĐỦ ô của giai đoạn MVP.** Nếu lưới chỉ vẽ thứ bé đã có, một bé mới mở ra thấy trống
 *      trơn — nhưng test kiểm "có 1 huy hiệu đạt" vẫn xanh, vì ô duy nhất đúng là ô đã có. Nên
 *      phải khẳng định SỐ Ô bằng đúng số phần tử DANH MỤC (đếm từ `badgesForPhase`, không
 *      hardcode mù — đếm mù thì thêm huy hiệu mới là test đỏ oan, hoặc tệ hơn: test xanh sai).
 *
 *   2. **Ô chưa có KHÔNG được lộ emoji thật.** Ta KHÔNG chỉ làm mờ: ta thay hình bằng `?`. Test
 *      khẳng định `queryByText(icon)` là `null` — vì một emoji chỉ hơi mờ vẫn đọc ra được trên
 *      màn hình nhỏ, và khi ấy phần thưởng tương lai mất hết bất ngờ.
 *
 *   3. **Nhãn đọc được.** Bé khiếm thị phải nghe được tên + trạng thái của từng ô.
 *
 *   4. **⭐ LUẬT SỐ 1: KHÔNG BAO GIỜ MẮNG TRẺ.** Quét DOM THẬT (không phải chuỗi i18n) để bắt cả
 *      trường hợp một chuỗi bị hardcode trong JSX. "sai", "kém", "chưa đạt" tuyệt đối không được
 *      xuất hiện — kể cả trong nhãn đọc.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import { rewardsApi } from '@/api/endpoints.js';
import { CollectionPage } from '@/pages/rewards/CollectionPage.js';
import { __resetRewardStoreForTests, useRewardStore } from '@/store/rewardStore.js';
import { badgesForPhase, stickersForPhase } from '@shared/content/badges.js';
import type { RewardSnapshot } from '@shared/types/reward.js';

/**
 * ⚠️ Mock mạng: `rewardStore.reload()` gọi `rewardsApi.get`. Không mock thì cú bấm "Thử lại" sẽ
 *    gọi `fetch` thật; và một promise treo sẽ giữ cổng `refreshInFlight` (biến cấp MODULE) đóng
 *    vĩnh viễn, làm test sau đỏ vì MÔI TRƯỜNG chứ không vì app.
 */
vi.mock('@/api/endpoints.js', () => ({
  rewardsApi: { get: vi.fn() },
}));

const getMock = vi.mocked(rewardsApi.get);

const CHILD = 'chi_na';
const NOW = '2026-10-08T08:00:00.000Z';

/** Danh mục MVP — đếm từ DỮ LIỆU, không hardcode. */
const BADGES_MVP = badgesForPhase('mvp');
const STICKERS_MVP = stickersForPhase('mvp');

/**
 * ⚠️ jsdom không cài `matchMedia` đầy đủ. Stub phòng thủ để một component lỡ dùng `framer-motion`
 *    trong tương lai không làm đỏ test vì lý do của MÔI TRƯỜNG.
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

function snap(overrides: Partial<RewardSnapshot> = {}): RewardSnapshot {
  return {
    childId: CHILD,
    wallet: { childId: CHILD, stars: 0, acorns: 0, updatedAt: NOW },
    xp: { childId: CHILD, xp: 0, level: 1, updatedAt: NOW },
    pet: {
      childId: CHILD,
      evolutionStage: 'egg',
      wordsLearned: 0,
      happiness: 3,
      equippedItemIds: [],
      lastFedAt: null,
      updatedAt: NOW,
    },
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

beforeEach(() => {
  __resetRewardStoreForTests();
  vi.clearAllMocks();
  getMock.mockResolvedValue(snap());
  seed();
});

// =============================================================================
// Nhóm 1 — vẽ ĐỦ ô của giai đoạn MVP
// =============================================================================

describe('CollectionPage — vẽ đủ ô của giai đoạn MVP', () => {
  it('tab Huy hiệu vẽ ĐỦ số ô MVP (kể cả ô chưa có)', () => {
    render(<CollectionPage />);

    expect(BADGES_MVP.length).toBeGreaterThan(0);
    expect(screen.getAllByRole('listitem')).toHaveLength(BADGES_MVP.length);
  });

  it('⚠️ tab Sticker khớp DANH MỤC thật — không hardcode mù', () => {
    render(<CollectionPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Sticker' }));

    expect(STICKERS_MVP.length).toBeGreaterThan(0);
    expect(screen.getAllByRole('listitem')).toHaveLength(STICKERS_MVP.length);
  });
});

// =============================================================================
// Nhóm 2 — ô đã có hiện hình, ô chưa có thì KHÔNG
// =============================================================================

describe('CollectionPage — ô đã có hiện hình, ô chưa có giấu hình', () => {
  const earned = BADGES_MVP[0]!;
  const locked = BADGES_MVP[1]!;

  it('huy hiệu ĐÃ đạt ⇒ icon của nó HIỆN', () => {
    seed({ badges: [earned.id] });
    render(<CollectionPage />);

    expect(screen.getByText(earned.icon)).toBeInTheDocument();
  });

  it('⚠️ huy hiệu CHƯA đạt ⇒ icon KHÔNG có trong DOM, thay bằng dấu ?', () => {
    seed({ badges: [earned.id] });
    render(<CollectionPage />);

    // Đây là điều quan trọng nhất: emoji thật của ô chưa có KHÔNG được nằm trong DOM.
    expect(screen.queryByText(locked.icon)).not.toBeInTheDocument();
    // Số dấu ? = số ô chưa có = tổng - số đã đạt.
    expect(screen.getAllByText('?')).toHaveLength(BADGES_MVP.length - 1);
  });

  it('tên của ô CHƯA có VẪN hiện (bé biết mình sẽ kiếm được gì)', () => {
    render(<CollectionPage />);

    expect(screen.getByText(locked.name_vi)).toBeInTheDocument();
  });
});

// =============================================================================
// Nhóm 3 — nhãn đọc được cho trình đọc màn hình
// =============================================================================

describe('CollectionPage — nhãn đọc được', () => {
  const item = BADGES_MVP[0]!;
  const locked = BADGES_MVP[1]!;

  it('ô đã đạt có nhãn "<tên>: đã đạt"', () => {
    seed({ badges: [item.id] });
    render(<CollectionPage />);

    expect(screen.getByRole('img', { name: `${item.name_vi}: đã đạt` })).toBeInTheDocument();
  });

  it('⚠️ ô chưa có có nhãn HƯỚNG TƯƠNG LAI, không phải lời chê', () => {
    render(<CollectionPage />);

    expect(screen.getByRole('img', { name: `${locked.name_vi}: Sắp có rồi!` })).toBeInTheDocument();
  });
});

// =============================================================================
// Nhóm 4 — chuyển tab
// =============================================================================

describe('CollectionPage — chuyển tab', () => {
  it('sang tab Sticker ⇒ thấy sticker của mình, ẩn huy hiệu', () => {
    const sticker = STICKERS_MVP[0]!;
    seed({ stickers: [sticker.id] });
    render(<CollectionPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Sticker' }));

    expect(screen.getByText(sticker.icon)).toBeInTheDocument();
    expect(screen.queryByText(BADGES_MVP[0]!.icon)).not.toBeInTheDocument();
  });

  it('⚠️ chỉ MỘT tab được đánh dấu đang mở tại một thời điểm', () => {
    render(<CollectionPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Sticker' }));

    const pressed = ['Huy hiệu', 'Sticker'].map((label) =>
      screen.getByRole('button', { name: label }).getAttribute('aria-pressed'),
    );
    expect(pressed).toEqual(['false', 'true']);
  });
});

// =============================================================================
// Nhóm 5 — nạp hỏng (khác "đọc rồi và không có gì")
// =============================================================================

describe('CollectionPage — chưa nạp được', () => {
  it('chưa nạp xong ⇒ "Đang chuẩn bị", KHÔNG vẽ ô nào (để bé không thấy toàn dấu ?)', () => {
    __resetRewardStoreForTests();
    render(<CollectionPage />);

    expect(screen.getByText('Đang chuẩn bị...')).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('⚠️ nạp hỏng ⇒ lời thật + nút thử lại, KHÔNG lộ lỗi kỹ thuật', () => {
    useRewardStore.setState({
      childId: CHILD,
      snapshot: null,
      hydrated: true,
      loading: false,
      error: 'NetworkError: failed to fetch',
    });
    render(<CollectionPage />);

    expect(screen.getByText('Chưa mở được bộ sưu tập')).toBeInTheDocument();
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
    render(<CollectionPage />);

    getMock.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    await waitFor(() => expect(getMock).toHaveBeenCalledWith(CHILD));
  });
});

// =============================================================================
// Nhóm 6 — ⭐ LUẬT SỐ 1: KHÔNG BAO GIỜ MẮNG TRẺ
// =============================================================================

/** Quét DOM THẬT ⇒ bắt được cả một chuỗi bị hardcode trong JSX, không chỉ chuỗi i18n. */
function assertNoJudgementalWords(container: HTMLElement): void {
  const text = container.textContent ?? '';
  for (const banned of ['sai', 'kém', 'chưa đạt']) {
    expect(text.includes(banned)).toBe(false);
  }
}

describe('CollectionPage — LUẬT TRẺ: không mắng, không từ bị cấm', () => {
  it('tab Huy hiệu (có ô chưa đạt) KHÔNG chứa từ mang tính phán xét', () => {
    seed({ badges: [BADGES_MVP[0]!.id] });
    const { container } = render(<CollectionPage />);

    assertNoJudgementalWords(container);
  });

  it('tab Sticker cũng KHÔNG chứa từ mang tính phán xét', () => {
    seed({ stickers: [STICKERS_MVP[0]!.id] });
    const { container } = render(<CollectionPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Sticker' }));
    assertNoJudgementalWords(container);
  });
});
