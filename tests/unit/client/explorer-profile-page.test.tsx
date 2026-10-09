/**
 * Test cho `ExplorerProfilePage` (T071) — Hồ sơ nhà thám hiểm (M13).
 *
 * Năm nhóm, chọn theo tiêu chí "hỏng thì hỏng IM LẶNG":
 *
 *   1. **Tên cấp + thanh XP đúng theo `snapshot.xp`.** Sai cấp hoặc sai thanh không ném lỗi —
 *      bé chỉ thấy một danh hiệu không phải của mình.
 *
 *   2. **Ô huy hiệu CHƯA kiếm KHÔNG được lộ emoji.** Hồ sơ dùng lại `BadgeCard` (T070): ô chưa
 *      có hiện `?`. Test quét `innerHTML` cho MỌI icon huy hiệu MVP chưa kiếm — mạnh hơn kiểm
 *      một ô, vì chỉ cần một ô lọt emoji là phần thưởng tương lai mất hết bất ngờ.
 *
 *   3. **Thanh tiến độ linh vật đi theo `snapshot.pet.wordsLearned`** (số SERVER trả) và tới
 *      giai đoạn kế tiếp; ở giai đoạn cuối thì thanh đầy, KHÔNG chia cho 0.
 *
 *   4. **Điểm vào (TopBar) + route `/profile` hoạt động.**
 *
 *   5. **⭐ LUẬT SỐ 1: KHÔNG BAO GIỜ MẮNG TRẺ.** Quét `innerHTML` (bắt cả `aria-label` lẫn chuỗi
 *      hardcode trong JSX) ở BỐN trạng thái: có dữ liệu · rỗng · lỗi tải · đang nạp.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import { rewardsApi } from '@/api/endpoints.js';
import { TopBar } from '@/components/common/TopBar.js';
import { ExplorerProfilePage } from '@/pages/profile/ExplorerProfilePage.js';
import { __resetProgressStoreForTests, useProgressStore } from '@/store/progressStore.js';
import { __resetRewardStoreForTests, useRewardStore } from '@/store/rewardStore.js';
import { useSessionStore } from '@/store/sessionStore.js';
import { BADGES, badgesForPhase } from '@shared/content/badges.js';
import { EVOLUTION_STAGES, getXpProgress, stageDefinition } from '@shared/content/levels.js';
import type { ChildProfileDto } from '@shared/types/api.js';
import type { RewardSnapshot } from '@shared/types/reward.js';

/** Mock `rewardsApi.get` — nút "Thử lại" gọi mạng qua nó. */
vi.mock('@/api/endpoints.js', () => ({
  rewardsApi: { get: vi.fn() },
}));

const getMock = vi.mocked(rewardsApi.get);

const CHILD = 'chi_na';
const NOW = '2026-10-08T08:00:00.000Z';

const CHILD_PROFILE: ChildProfileDto = {
  id: CHILD,
  nickname: 'Na',
  age: 7,
  avatarId: 'rabbit',
  createdAt: NOW,
};

/** Danh mục MVP — đếm từ DỮ LIỆU, không hardcode. */
const BADGES_MVP = badgesForPhase('mvp');

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

/** Gieo ví/huy hiệu (rewardStore) + tiến độ (progressStore) như thể đã nạp xong. */
function seed(overrides: Partial<RewardSnapshot> = {}): void {
  useRewardStore.setState({
    childId: CHILD,
    snapshot: snap(overrides),
    hydrated: true,
    loading: false,
    error: null,
  });
  useProgressStore.setState({ childId: CHILD, hydrated: true });
}

beforeEach(() => {
  __resetRewardStoreForTests();
  __resetProgressStoreForTests();
  useSessionStore.setState({ children: [CHILD_PROFILE], activeChildId: CHILD });
  vi.clearAllMocks();
  getMock.mockResolvedValue(snap());
  seed();
});

// =============================================================================
// Nhóm 1 — tên cấp + thanh XP
// =============================================================================

describe('ExplorerProfilePage — thanh XP của bé', () => {
  it('hiện tiêu đề hồ sơ và biệt danh của bé', () => {
    render(<ExplorerProfilePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Na' })).toBeInTheDocument();
    expect(screen.getByText('Hồ sơ nhà thám hiểm')).toBeInTheDocument();
  });

  it('⚠️ hiện ĐÚNG tên cấp theo `snapshot.xp` + có thanh tiến độ', () => {
    // 150 XP = mốc cấp 2; lấy tên cấp từ chính hàm dùng chung, không chép chuỗi vào test.
    seed({ xp: { childId: CHILD, xp: 150, level: 2, updatedAt: NOW } });
    render(<ExplorerProfilePage />);

    const xpRegion = screen.getByRole('region', { name: 'Cấp nhà thám hiểm' });
    expect(within(xpRegion).getByText(getXpProgress(150).level.title_vi)).toBeInTheDocument();
    expect(within(xpRegion).getByRole('progressbar')).toBeInTheDocument();
  });
});

// =============================================================================
// Nhóm 2 — huy hiệu đã kiếm / chưa kiếm
// =============================================================================

describe('ExplorerProfilePage — huy hiệu', () => {
  const earned = BADGES.find((b) => b.id === 'badge-first-step')!;

  it('hiện SỐ huy hiệu bé đã kiếm', () => {
    seed({ badges: [earned.id] });
    render(<ExplorerProfilePage />);

    // Dòng đếm trên khối huy hiệu.
    expect(screen.getByText(`1/${BADGES_MVP.length} huy hiệu`)).toBeInTheDocument();

    // Và thẻ thống kê "Huy hiệu đã kiếm" = 1.
    const stats = screen.getByRole('region', { name: 'Thành tích của bé' });
    const card = within(stats).getByText('Huy hiệu đã kiếm').closest('li')!;
    expect(within(card).getByText('1')).toBeInTheDocument();
  });

  it('⚠️ KHÔNG icon huy hiệu MVP nào CHƯA kiếm bị lộ ra DOM', () => {
    seed({ badges: [earned.id] });
    const { container } = render(<ExplorerProfilePage />);
    const html = container.innerHTML;

    // Ô đã kiếm: icon PHẢI hiện.
    expect(html.includes(earned.icon)).toBe(true);
    // Mọi ô chưa kiếm: KHÔNG được lộ emoji thật (BadgeCard thay bằng `?`).
    for (const badge of BADGES_MVP) {
      if (badge.id === earned.id) continue;
      expect(html.includes(badge.icon)).toBe(false);
    }
  });

  it('chưa kiếm huy hiệu nào ⇒ một lời hẹn nhẹ (không trách)', () => {
    render(<ExplorerProfilePage />);

    expect(screen.getByText('Bé sẽ sưu tầm được nhiều huy hiệu nhé!')).toBeInTheDocument();
  });
});

// =============================================================================
// Nhóm 3 — thanh tiến độ linh vật (số từ SERVER trả)
// =============================================================================

describe('ExplorerProfilePage — tiến hoá linh vật', () => {
  it('⚠️ thanh + "còn N từ nữa" đi theo `snapshot.pet.wordsLearned` (số SERVER trả)', () => {
    // egg → baby: lấy mốc từ DỮ LIỆU, không chép số vào test.
    const egg = stageDefinition('egg');
    const baby = stageDefinition('baby');
    const wordsLearned = Math.floor(baby.wordsRequired / 2); // đang ở giữa hai giai đoạn

    seed({
      pet: {
        childId: CHILD,
        evolutionStage: egg.stage,
        wordsLearned,
        happiness: 3,
        equippedItemIds: [],
        lastFedAt: null,
        updatedAt: NOW,
      },
    });
    render(<ExplorerProfilePage />);

    const petRegion = screen.getByRole('region', { name: 'Momo lớn lên' });
    // Giai đoạn hiện tại (theo ID server trả) + đích kế tiếp.
    expect(within(petRegion).getByText(egg.name_vi)).toBeInTheDocument();
    expect(within(petRegion).getByText(baby.name_vi)).toBeInTheDocument();

    // Thanh mang ĐÚNG con số server trả; mẫu số là khoảng cách giữa hai giai đoạn.
    const span = baby.wordsRequired - egg.wordsRequired;
    const intoStage = wordsLearned - egg.wordsRequired;
    const bar = within(petRegion).getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', String(intoStage));
    expect(bar).toHaveAttribute('aria-valuemax', String(span));
    expect(bar.getAttribute('aria-valuetext')).toContain(String(baby.wordsRequired - wordsLearned));

    /*
      ⚠️ BỀ RỘNG của div fill BÊN TRONG — thứ bé NHÌN THẤY, khác hẳn `aria-*` (ngữ nghĩa).
      Bộ đột biến `t070` phát hiện: ca này chỉ hỏi `aria-*`, nên sửa `stageRatio` (đổi tỉ lệ vẽ)
      mà test vẫn XANH. Phải khẳng định `style.width`, và lấy tỉ lệ từ DỮ LIỆU (không chép số).
    */
    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe(`${(intoStage / span) * 100}%`);

    // Câu "còn N từ nữa" hiện ra (chuỗi ở `pet.nextStage`).
    expect(
      within(petRegion).getByText(`Còn ${baby.wordsRequired - wordsLearned} từ nữa để lớn hơn`),
    ).toBeInTheDocument();
  });

  it('⚠️ giai đoạn CUỐI ⇒ thanh đầy, KHÔNG chia cho 0 và KHÔNG hở "còn 0 từ nữa"', () => {
    const last = EVOLUTION_STAGES.at(-1)!;
    seed({
      pet: {
        childId: CHILD,
        evolutionStage: last.stage,
        wordsLearned: last.wordsRequired + 42,
        happiness: 3,
        equippedItemIds: [],
        lastFedAt: null,
        updatedAt: NOW,
      },
    });
    render(<ExplorerProfilePage />);

    const petRegion = screen.getByRole('region', { name: 'Momo lớn lên' });
    expect(within(petRegion).getByText('Bạn ấy đã lớn nhất rồi!')).toBeInTheDocument();
    expect(within(petRegion).queryByText(/nữa để lớn hơn/)).not.toBeInTheDocument();

    // Mẫu số bị kẹp về 1 (không phải 0) ⇒ không chia cho 0; thanh đã đầy.
    const bar = within(petRegion).getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemax', '1');
    expect(bar).toHaveAttribute('aria-valuenow', '1');

    /*
      ⚠️⚠️ BỀ RỘNG THẬT của fill — hai đột biến CP2/CP3 của bộ `t070` LỌT LƯỚI đúng ở đây:
        • CP2: nhánh cuối `stageRatio = nextStage ? … : 1` bị đổi thành `: 0` ⇒ thanh RỖNG ở đỉnh
          (đúng thứ chú thích mã cấm: "thanh rỗng ở đỉnh trông như vừa tụt hạng").
        • CP3: bỏ chốt `nextStage ?` ⇒ `stageSpan = 0` ⇒ `0/0 = NaN` ⇒ `width: 'NaN%'`.
      Cả hai đều KHÔNG đổi `aria-*` (thanh NGOÀI vẫn `max=1/now=1`), nên khẳng định `aria-*` ở
      trên không bắt được. Hai dòng dưới mới canh đúng thứ bé NHÌN THẤY.
    */
    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe('100%');
    expect(fill.style.width).not.toContain('NaN');
  });

  it('⚠️ ĐÚNG mốc giai đoạn cuối (`wordsIntoStage = 0`) ⇒ thanh vẫn ĐẦY, KHÔNG "NaN%"', () => {
    /*
      Ca ranh giới ĐỘC HẠI NHẤT — `wordsLearned` ĐÚNG bằng mốc giai đoạn cuối ⇒ `wordsIntoStage = 0`
      và `stageSpan = 0`. Nếu chốt `nextStage ? … : 1` bị bỏ (đột biến CP3 của bộ `t070`) thì
      `0/0 = NaN` ⇒ `style.width = 'NaN%'`: thanh biến mất, còn `aria-*` vẫn `max=1/now=1` nên
      KHÔNG ca nào hỏi `aria-*` bắt được. Đây là ca duy nhất sinh ra `NaN`.
    */
    const last = EVOLUTION_STAGES.at(-1)!;
    seed({
      pet: {
        childId: CHILD,
        evolutionStage: last.stage,
        wordsLearned: last.wordsRequired,
        happiness: 3,
        equippedItemIds: [],
        lastFedAt: null,
        updatedAt: NOW,
      },
    });
    render(<ExplorerProfilePage />);

    const petRegion = screen.getByRole('region', { name: 'Momo lớn lên' });
    const bar = within(petRegion).getByRole('progressbar');
    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe('100%');
    expect(fill.style.width).not.toContain('NaN');
  });
});

// =============================================================================
// Nhóm 4 — điểm vào (TopBar) + route
// =============================================================================

describe('ExplorerProfilePage — điểm vào và route', () => {
  it('TopBar có nút riêng dẫn tới /profile (KHÔNG đụng nút đổi hồ sơ bé)', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <TopBar child={CHILD_PROFILE} status={null} profileTo="/profile" />
        <Routes>
          <Route path="/" element={<p>trang chủ</p>} />
          <Route path="/profile" element={<p>hồ sơ đây</p>} />
        </Routes>
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: 'Hồ sơ nhà thám hiểm' });
    expect(link).toHaveAttribute('href', '/profile');

    fireEvent.click(link);
    expect(screen.getByText('hồ sơ đây')).toBeInTheDocument();
  });

  it('route /profile render đúng trang hồ sơ', () => {
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/profile" element={<ExplorerProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Na' })).toBeInTheDocument();
  });
});

// =============================================================================
// Nhóm 5 — chưa nạp được / nạp hỏng
// =============================================================================

describe('ExplorerProfilePage — chưa nạp được', () => {
  it('chưa nạp xong ⇒ "Đang chuẩn bị", KHÔNG hiện huy hiệu', () => {
    __resetRewardStoreForTests();
    useProgressStore.setState({ childId: CHILD, hydrated: true });
    render(<ExplorerProfilePage />);

    expect(screen.getByText('Đang chuẩn bị...')).toBeInTheDocument();
    expect(screen.queryByText('Huy hiệu của bé')).not.toBeInTheDocument();
  });

  it('⚠️ nạp hỏng ⇒ lời thật + nút thử lại, KHÔNG lộ lỗi kỹ thuật', async () => {
    useRewardStore.setState({
      childId: CHILD,
      snapshot: null,
      hydrated: true,
      loading: false,
      error: 'NetworkError: failed to fetch',
    });
    render(<ExplorerProfilePage />);

    expect(screen.getByText('Chưa mở được hồ sơ')).toBeInTheDocument();
    expect(screen.queryByText(/NetworkError/)).not.toBeInTheDocument();

    getMock.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(getMock).toHaveBeenCalledWith(CHILD));
  });
});

// =============================================================================
// Nhóm 6 — ⭐ LUẬT SỐ 1: KHÔNG BAO GIỜ MẮNG TRẺ
// =============================================================================

/**
 * ⚠️ Quét `innerHTML` (không chỉ `textContent`) để bắt luôn cả `aria-label` và chuỗi bị hardcode
 *    trong JSX — nhãn đọc cũng được bé khiếm thị nghe, nên cũng phải sạch.
 */
const BANNED_WORDS = ['sai', 'kém', 'chưa đạt', 'thất bại'] as const;

function assertNoBannedWords(container: HTMLElement): void {
  const html = container.innerHTML;
  for (const word of BANNED_WORDS) {
    expect(html.includes(word)).toBe(false);
  }
}

describe('ExplorerProfilePage — LUẬT TRẺ: không mắng, không từ bị cấm', () => {
  it('trạng thái CÓ dữ liệu (huy hiệu + giai đoạn) sạch từ bị cấm', () => {
    seed({ badges: [BADGES_MVP[0]!.id] });
    const { container } = render(<ExplorerProfilePage />);

    assertNoBannedWords(container);
  });

  it('trạng thái RỖNG (chưa có huy hiệu nào) sạch từ bị cấm', () => {
    const { container } = render(<ExplorerProfilePage />);

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
    const { container } = render(<ExplorerProfilePage />);

    assertNoBannedWords(container);
  });

  it('trạng thái ĐANG NẠP sạch từ bị cấm', () => {
    __resetRewardStoreForTests();
    const { container } = render(<ExplorerProfilePage />);

    assertNoBannedWords(container);
  });
});
