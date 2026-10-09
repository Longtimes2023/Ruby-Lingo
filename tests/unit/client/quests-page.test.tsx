/**
 * Test cho `QuestsPage` (M9 — Bảng nhiệm vụ).
 *
 * Năm nhóm được kiểm kỹ nhất, vì cả năm đều hỏng IM LẶNG:
 *
 *   1. **Ba tầng, và tầng rỗng thì KHÔNG vẽ tiêu đề.** Một tiêu đề đứng một mình trông như app
 *      thiếu dữ liệu — trẻ con đọc đó là "hình như con làm sai gì rồi".
 *
 *   2. **"Chưa đọc được" KHÁC "đọc rồi và không có gì".** Hiện màn hình trống trong lúc dữ liệu
 *      đang về khiến bé tưởng mình không có nhiệm vụ nào. Chưa đọc được ⇒ "đang chuẩn bị".
 *
 *   3. **Túi quà phải mở ra khi bé tự bấm "Nhận thưởng"**, và phải nói ĐÚNG những gì bé nhận.
 *      Lấy nguyên `quest.rewards` là ăn mừng một huy hiệu bé đã có từ tuần trước — xem
 *      `celebrationRewards` trong `QuestsPage.tsx`.
 *
 *   4. **Lên cấp phải hiện SAU khi bé đóng túi quà, không phải thay thế nó.** `lastClaim` là
 *      nguồn DUY NHẤT của `levelUp` và `dismissClaim()` xoá nó — quên chuyển sang state của
 *      trang là mất luôn lời chúc mừng lên cấp, trong khi ví đã cộng XP. Không lỗi, chỉ im lặng.
 *
 *   5. **Không bao giờ hiện lỗi kỹ thuật cho bé.** Bé không làm gì sai; chỉ cần một lời nói thật
 *      và một nút thử lại.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import { ApiClientError } from '@/api/client.js';
import { questsApi, rewardsApi } from '@/api/endpoints.js';
import { QuestsPage } from '@/pages/quests/QuestsPage.js';
import { __resetQuestStoreForTests, useQuestStore } from '@/store/questStore.js';
import { __resetRewardStoreForTests, useRewardStore } from '@/store/rewardStore.js';
import { useSessionStore } from '@/store/sessionStore.js';
import { getSticker } from '@shared/content/badges.js';
import type { ClaimQuestResponse, ChildProfileDto, QuestsGetResponse } from '@shared/types/api.js';
import type { QuestWithProgress } from '@shared/types/reward.js';

vi.mock('@/api/endpoints.js', () => ({
  questsApi: { get: vi.fn(), claim: vi.fn() },
  rewardsApi: { get: vi.fn() },
}));

const getMock = vi.mocked(questsApi.get);
const claimMock = vi.mocked(questsApi.claim);
const rewardsGetMock = vi.mocked(rewardsApi.get);

const CHILD = 'chi_na';
const NOW = '2026-10-07T08:00:00.000Z';

/**
 * ⚠️ jsdom không cài `matchMedia` đầy đủ, mà `useReducedMotion()` của Framer Motion (dùng trong
 *    `RewardBurst` và `LevelUpOverlay`) đọc nó. Thiếu stub ⇒ `TypeError: window.matchMedia is not
 *    a function` — một lỗi của MÔI TRƯỜNG TEST bị hiểu nhầm thành "component hỏng".
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

function quest(overrides: Partial<QuestWithProgress> = {}): QuestWithProgress {
  return {
    id: 'qd-01',
    tier: 'daily',
    description_vi: 'Học 1 bài mới',
    icon: '📖',
    criteria: { kind: 'complete_lessons', count: 1 },
    rewards: [{ kind: 'stars', amount: 10 }],
    phase: 'mvp',
    progress: 1,
    target: 1,
    completed: true,
    claimed: false,
    ...overrides,
  };
}

/** Ba tầng, đúng hình dạng dữ liệu thật của `quests.json`. */
function threeTiers(): QuestWithProgress[] {
  return [
    quest({ id: 'qd-02', description_vi: 'Chơi 3 game', icon: '🎮', progress: 1, target: 3, completed: false, criteria: { kind: 'play_games', count: 3 } }),
    quest({ id: 'qw-01', tier: 'weekly', description_vi: 'Học 5 bài trong tuần', icon: '📚', progress: 0, target: 5, completed: false, claimed: false, criteria: { kind: 'complete_lessons', count: 5 }, rewards: [{ kind: 'stars', amount: 60 }] }),
    quest({ id: 'qm-03', tier: 'milestone', description_vi: 'Nhà thám hiểm — đạt cấp 3', icon: '🧭', progress: 1, target: 3, completed: false, claimed: false, criteria: { kind: 'reach_level', level: 3 }, rewards: [{ kind: 'stars', amount: 40 }] }),
  ];
}

function questsResponse(quests: QuestWithProgress[]): QuestsGetResponse {
  return {
    quests,
    streak: {
      childId: CHILD,
      currentStreak: 3,
      longestStreak: 5,
      lastActiveDate: '2026-10-06',
      milestonesClaimed: [],
      updatedAt: NOW,
    },
    periodKeys: { daily: '2026-10-07', weekly: '2026-W41' },
  };
}

/** Gieo sẵn store như thể danh sách vừa được nạp xong từ server. */
function seed(quests: QuestWithProgress[]): void {
  useSessionStore.setState({ children: [CHILD_PROFILE], activeChildId: CHILD });
  useQuestStore.setState({
    childId: CHILD,
    quests,
    streak: questsResponse(quests).streak,
    periodKeys: questsResponse(quests).periodKeys,
    hydrated: true,
    loading: false,
    error: null,
    claiming: {},
    lastClaim: null,
  });
}

beforeEach(() => {
  __resetQuestStoreForTests();
  __resetRewardStoreForTests();
  useSessionStore.setState({ children: [CHILD_PROFILE], activeChildId: CHILD });
  vi.clearAllMocks();
  // `questStore.claim` gọi `rewardStore.reload(CHILD)`; `reload` bỏ qua nếu ví đang thuộc bé khác.
  useRewardStore.setState({ childId: CHILD, hydrated: true });
  // Ví: treo mãi. `QuestsPage` không đọc ví (thanh trên cùng lo việc đó), nên không cần dữ liệu.
  rewardsGetMock.mockImplementation(() => new Promise<never>(() => {}));
  // Mặc định: mọi request nạp treo mãi ⇒ trạng thái đã gieo trong `seed()` giữ nguyên.
  getMock.mockImplementation(() => new Promise<QuestsGetResponse>(() => {}));
});

afterEach(() => {
  vi.restoreAllMocks();
});

// =============================================================================
// Ba tầng
// =============================================================================

describe('QuestsPage — ba tầng nhiệm vụ', () => {
  it('vẽ đủ ba tiêu đề tầng theo đúng thứ tự ngày → tuần → mốc', () => {
    seed(threeTiers());
    render(<QuestsPage />);

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Nhiệm vụ hôm nay', 'Nhiệm vụ tuần này', 'Cột mốc']);
  });

  it('tầng KHÔNG có nhiệm vụ nào ⇒ không vẽ tiêu đề rỗng', () => {
    seed([quest({ id: 'qd-01' })]);
    render(<QuestsPage />);

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Nhiệm vụ hôm nay']);
  });

  it('mỗi nhiệm vụ có một thẻ với nút "Nhận thưởng" mang tên nhiệm vụ', () => {
    seed(threeTiers());
    render(<QuestsPage />);

    expect(
      screen.getByRole('button', { name: 'Nhận thưởng: Chơi 3 game' }),
    ).toBeInTheDocument();
  });

  it('xong hết nhiệm vụ NGÀY ⇒ hiện lời khen (và nó đọc được cho screen reader)', () => {
    seed([quest({ id: 'qd-01', claimed: true }), quest({ id: 'qd-02', claimed: true })]);
    render(<QuestsPage />);

    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Bé đã hoàn thành hết nhiệm vụ hôm nay!');
  });

  it('còn nhiệm vụ ngày chưa nhận ⇒ KHÔNG hiện lời khen', () => {
    seed([quest({ id: 'qd-01', claimed: true }), quest({ id: 'qd-02', claimed: false })]);
    render(<QuestsPage />);

    expect(screen.queryByText(/hoàn thành hết nhiệm vụ hôm nay/)).not.toBeInTheDocument();
  });

  it('hiện chuỗi ngày 🔥 của bé', () => {
    seed(threeTiers());
    render(<QuestsPage />);

    expect(screen.getByRole('img', { name: /3 ngày/ })).toBeInTheDocument();
  });
});

// =============================================================================
// Chưa đọc được / rỗng
// =============================================================================

describe('QuestsPage — chưa đọc được và rỗng', () => {
  it('⚠️ chưa nạp xong ⇒ "Đang chuẩn bị", KHÔNG phải màn hình rỗng', () => {
    // Không `seed()`: store ở trạng thái rỗng, `hydrated = false`.
    render(<QuestsPage />);

    expect(screen.getByText('Đang chuẩn bị...')).toBeInTheDocument();
    expect(screen.queryByText(/Chưa có nhiệm vụ nào/)).not.toBeInTheDocument();
  });

  it('⚠️ nạp hỏng ⇒ KHÔNG hiện lỗi kỹ thuật, chỉ một lời thật + nút thử lại', () => {
    useQuestStore.setState({
      childId: CHILD,
      quests: null,
      hydrated: true,
      loading: false,
      error: 'NetworkError: failed to fetch',
    });
    render(<QuestsPage />);

    expect(screen.getByText('Chưa mở được nhiệm vụ')).toBeInTheDocument();
    // Thông báo thô của trình duyệt KHÔNG được lộ ra cho trẻ 7 tuổi.
    expect(screen.queryByText(/NetworkError/)).not.toBeInTheDocument();
  });

  it('nút "Thử lại" thật sự gọi mạng lại (nạp hỏng KHÔNG được kẹt vĩnh viễn)', async () => {
    /**
     * ⚠️ LẦN NẠP LÚC GẮN PHẢI **KẾT THÚC** (hỏng ngay), KHÔNG ĐƯỢC TREO.
     *   Lý do: `questStore.load()` có cổng `if (state.loading) return`. `loading` chỉ được tắt
     *   khi lần nạp kết thúc (`fetchQuests`), nên một mock TREO MÃI để lại `loading = true` vĩnh
     *   viễn và cú bấm "Thử lại" bị cổng đó chặn — test đỏ vì MÔI TRƯỜNG TEST, không phải vì hành
     *   vi của app. (Còn `beforeEach` đặt mock treo là đúng cho các test khác: nó giữ nguyên trạng
     *   thái đã gieo.)
     *
     *   Hỏng NGAY tái hiện đúng cảnh thật cần kiểm: lần nạp đầu đã xong và thất bại.
     */
    getMock.mockRejectedValueOnce(new Error('boom'));
    render(<QuestsPage />);

    // Chờ trạng thái hỏng hiện ra — cũng là chờ lần nạp đầu kết thúc trước khi bấm thử lại.
    const retry = await screen.findByRole('button', { name: 'Thử lại' });

    // Hiệu ứng `useQuestsLifecycle` đã gọi một lần lúc gắn — xoá dấu để chỉ đếm cú bấm của bé.
    getMock.mockClear();
    getMock.mockResolvedValue(questsResponse([quest()]));

    fireEvent.click(retry);

    await waitFor(() => expect(getMock).toHaveBeenCalledWith(CHILD));
  });

  it('danh sách RỖNG (khác "chưa đọc được") ⇒ màn hình rỗng có linh vật', () => {
    seed([]);
    render(<QuestsPage />);

    expect(screen.getByText('Chưa có nhiệm vụ nào')).toBeInTheDocument();
    expect(screen.queryByText('Đang chuẩn bị...')).not.toBeInTheDocument();
  });
});

// =============================================================================
// Nhận thưởng: túi quà + lên cấp
// =============================================================================

describe('QuestsPage — nhận thưởng', () => {
  /**
   * Nhiệm vụ SAU khi nhận, ĐÚNG như server trả về: CHÍNH nhiệm vụ đó, `claimed = true`, và
   * `rewards` GIỮ NGUYÊN.
   *
   * ⚠️ VÌ SAO KHÔNG ĐƯỢC TỰ DỰNG MỘT NHIỆM VỤ MỚI Ở CHỖ GỌI: `QuestsPage` mở túi quà từ
   *    `lastClaim.quest.rewards` (xem `celebrationRewards`). Trả về một nhiệm vụ có `rewards`
   *    KHÁC nhiệm vụ đã gieo là kiểm một tình huống không bao giờ xảy ra — server luôn trả lại
   *    đúng định nghĩa nhiệm vụ. Fixture sai kiểu đó làm test đỏ vì lý do giả ("+10 Sao" thay vì
   *    "+60 Sao") và che mất lỗi thật.
   */
  function afterClaim(base: QuestWithProgress): QuestWithProgress {
    return { ...base, completed: true, claimed: true };
  }

  /**
   * Kết quả server trả về khi nhận thưởng.
   *
   * ⚠️ `after` là tham số BẮT BUỘC (không có mặc định) — cố ý. Một mặc định `quest({ claimed:
   *    true })` sẽ lặng lẽ thay `rewards` của nhiệm vụ đang kiểm bằng phần thưởng mặc định, và
   *    test vẫn xanh trong khi không hề kiểm điều nó tuyên bố kiểm.
   */
  function claimResult(
    after: QuestWithProgress,
    overrides: Partial<ClaimQuestResponse> = {},
  ): ClaimQuestResponse {
    return {
      quest: after,
      wallet: { childId: CHILD, stars: 20, acorns: 2, updatedAt: NOW },
      xp: { childId: CHILD, xp: 170, level: 2, updatedAt: NOW },
      levelUp: null,
      badgesEarned: [],
      stickerIds: [],
      ...overrides,
    };
  }

  /** Nút "Nhận thưởng" — nhãn đọc luôn kèm tên nhiệm vụ (xem `QuestCard`). */
  function claimButton(): HTMLElement {
    return screen.getByRole('button', { name: /^Nhận thưởng:/ });
  }

  /**
   * Đóng lớp túi quà.
   *
   * ⚠️ KHÔNG dùng `getByRole('status')`: sau khi nhận hết nhiệm vụ ngày, lời khen
   *    "Bé đã hoàn thành hết nhiệm vụ hôm nay!" cũng mang `role="status"`, nên có HAI phần tử
   *    cùng vai và truy vấn theo vai sẽ mơ hồ. Chạm thẳng vào tiêu đề của túi quà — sự kiện nổi
   *    bọt lên lớp bắt sự kiện của `RewardBurst` ("chạm ở đâu cũng tắt").
   */
  async function dismissGiftBag(): Promise<void> {
    fireEvent.click(await screen.findByText('Bé mở túi quà!'));
  }

  it('bấm "Nhận thưởng" ⇒ gọi API đúng nhiệm vụ', async () => {
    const q = quest({ id: 'qd-01' });
    seed([q]);
    claimMock.mockResolvedValue(claimResult(afterClaim(q)));
    render(<QuestsPage />);

    fireEvent.click(claimButton());
    await screen.findByText('Bé mở túi quà!');

    expect(claimMock).toHaveBeenCalledWith(CHILD, 'qd-01');
  });

  it('túi quà mở ra và nói ĐÚNG số quà bé nhận', async () => {
    const q = quest({
      id: 'qd-01',
      rewards: [
        { kind: 'stars', amount: 10 },
        { kind: 'acorns', amount: 1 },
      ],
    });
    seed([q]);
    claimMock.mockResolvedValue(claimResult(afterClaim(q)));
    render(<QuestsPage />);

    fireEvent.click(claimButton());

    expect(await screen.findByText('+10 Sao')).toBeInTheDocument();
    expect(screen.getByText('+1 Hạt dẻ')).toBeInTheDocument();
  });

  it('⚠️ huy hiệu ĐÃ CÓ từ trước ⇒ KHÔNG ăn mừng lại (chỉ tin `badgesEarned`)', async () => {
    const q = quest({
      id: 'qw-01',
      tier: 'weekly',
      rewards: [
        { kind: 'stars', amount: 60 },
        { kind: 'badge', refId: 'badge-diligent' },
      ],
    });
    seed([q]);
    // Nhiệm vụ KHAI BÁO thưởng huy hiệu, nhưng server không trao gì mới ⇒ `badgesEarned` rỗng.
    claimMock.mockResolvedValue(claimResult(afterClaim(q), { badgesEarned: [] }));
    render(<QuestsPage />);

    fireEvent.click(claimButton());
    await screen.findByText('+60 Sao');

    expect(screen.queryByText('Huy hiệu mới')).not.toBeInTheDocument();
  });

  it('huy hiệu MỚI thật ⇒ có ăn mừng', async () => {
    const q = quest({
      id: 'qw-01',
      tier: 'weekly',
      rewards: [
        { kind: 'stars', amount: 60 },
        { kind: 'badge', refId: 'badge-diligent' },
      ],
    });
    seed([q]);
    claimMock.mockResolvedValue(
      claimResult(afterClaim(q), { badgesEarned: ['badge-diligent'] }),
    );
    render(<QuestsPage />);

    fireEvent.click(claimButton());

    expect(await screen.findByText('Huy hiệu mới')).toBeInTheDocument();
  });

  it('⚠️ LÊN CẤP hiện SAU khi bé đóng túi quà, KHÔNG thay thế nó', async () => {
    const q = quest({ id: 'qd-01' });
    seed([q]);
    claimMock.mockResolvedValue(
      claimResult(afterClaim(q), {
        levelUp: { from: 1, to: 2, rewards: [{ kind: 'stars', amount: 20 }] },
      }),
    );
    render(<QuestsPage />);

    fireEvent.click(claimButton());
    await screen.findByText('Bé mở túi quà!');

    // Bé chưa chạm để đóng túi quà ⇒ màn lên cấp PHẢI còn đóng.
    expect(screen.queryByText('Bé lên cấp 2!')).not.toBeInTheDocument();

    // Chạm để đóng túi quà ⇒ giờ mới tới lượt màn lên cấp.
    await dismissGiftBag();

    expect(await screen.findByText('Bé lên cấp 2!')).toBeInTheDocument();
  });

  it('lượt nhận KHÔNG lên cấp ⇒ không có màn lên cấp nào', async () => {
    const q = quest({ id: 'qd-01' });
    seed([q]);
    claimMock.mockResolvedValue(claimResult(afterClaim(q)));
    render(<QuestsPage />);

    fireEvent.click(claimButton());
    await dismissGiftBag();

    expect(screen.queryByText(/Bé lên cấp/)).not.toBeInTheDocument();
  });

  it('⚠️ lượt nhận KHÔNG có gì ĐẾM ĐƯỢC ⇒ KHÔNG kẹt: lớp lên cấp vẫn tự tới', async () => {
    /**
     * Phòng thủ cho đúng một cái bẫy chết người: `RewardBurst` KHÔNG hiện gì khi danh sách quà
     * RỖNG, và khi đó nó KHÔNG BAO GIỜ gọi `onDismiss` ⇒ `lastClaim` không được xoá ⇒
     * `LevelUpOverlay` kẹt vĩnh viễn (quà lên cấp đã vào ví mà bé không bao giờ thấy).
     *
     * Một nhiệm vụ CHỈ thưởng sticker — mà bé đã có sticker đó nên `badgesEarned` rỗng — rơi
     * đúng vào đó: sticker không nằm trong nhóm ĐẾM ĐƯỢC (⭐/🌰/XP), nên `celebrationRewards`
     * trả về mảng rỗng. `QuestsPage` phải tự đóng lớp túi quà trong trường hợp này.
     */
    const q = quest({ id: 'qd-01', rewards: [{ kind: 'sticker', refId: 'st-01' }] });
    seed([q]);
    claimMock.mockResolvedValue(
      claimResult(afterClaim(q), {
        levelUp: { from: 1, to: 2, rewards: [{ kind: 'stars', amount: 20 }] },
      }),
    );
    render(<QuestsPage />);

    fireEvent.click(claimButton());

    // Không có túi quà nào để mở (không có gì đếm được)…
    expect(screen.queryByText('Bé mở túi quà!')).not.toBeInTheDocument();
    // …nên lớp lên cấp phải TỰ tới, không chờ một cú chạm vào thứ không tồn tại.
    expect(await screen.findByText('Bé lên cấp 2!')).toBeInTheDocument();
  });

  it('sau khi nhận, nút của nhiệm vụ đó chuyển sang "Đã nhận"', async () => {
    const q = quest({ id: 'qd-01' });
    seed([q]);
    claimMock.mockResolvedValue(claimResult(afterClaim(q)));
    render(<QuestsPage />);

    fireEvent.click(claimButton());

    const button = await screen.findByRole('button', { name: /Đã nhận:/ });
    expect(button).toBeDisabled();
  });
});

// =============================================================================
// Ăn mừng STICKER MỚI khi nhận thưởng (T069.2)
// =============================================================================

/**
 * ⭐ VÌ SAO NHÓM NÀY TỒN TẠI:
 *   Cả ý nghĩa của sticker là *"phần thưởng BIẾN THIÊN — mở ra mới biết là con gì"*. Từ khi 3
 *   sticker MVP được gắn vào quà nhiệm vụ mốc, bé CÓ THỂ mở được sticker khi bấm "Nhận thưởng".
 *   Nếu màn hình không nói gì, bé không bao giờ biết mình vừa được con gì — mất đúng cái thú vị
 *   của sticker. Nhóm này khoá ba điều: (1) sticker mới HIỆN icon thật + tên; (2) sticker KHÔNG
 *   mới thì KHÔNG ăn mừng; (3) và nó không được mắng trẻ.
 */
describe('QuestsPage — ăn mừng sticker mới', () => {
  function afterClaim(base: QuestWithProgress): QuestWithProgress {
    return { ...base, completed: true, claimed: true };
  }

  function claimResult(
    after: QuestWithProgress,
    overrides: Partial<ClaimQuestResponse> = {},
  ): ClaimQuestResponse {
    return {
      quest: after,
      wallet: { childId: CHILD, stars: 20, acorns: 2, updatedAt: NOW },
      xp: { childId: CHILD, xp: 170, level: 2, updatedAt: NOW },
      levelUp: null,
      badgesEarned: [],
      stickerIds: [],
      ...overrides,
    };
  }

  function claimButton(): HTMLElement {
    return screen.getByRole('button', { name: /^Nhận thưởng:/ });
  }

  it('⚠️ mở được sticker MỚI ⇒ túi quà hiện ICON THẬT + TÊN sticker', async () => {
    // Tên + icon lấy từ DANH MỤC, không chép chuỗi vào test (danh mục đổi là test bắt được).
    const sticker = getSticker('sticker-medal')!;
    const q = quest({ id: 'qm-01', tier: 'milestone', rewards: [{ kind: 'stars', amount: 40 }] });
    seed([q]);
    claimMock.mockResolvedValue(claimResult(afterClaim(q), { stickerIds: [sticker.id] }));
    render(<QuestsPage />);

    fireEvent.click(claimButton());

    // Nhãn nói rõ ĐÂY LÀ STICKER VỪA MỞ (không phải chỉ tên trơ), kèm tên thật.
    expect(await screen.findByText(`Sticker mới: ${sticker.name_vi}`)).toBeInTheDocument();
    // ⚠️ Và ICON THẬT nằm trong DOM — không phải icon dự phòng 🎨 của `RewardBurst`.
    expect(screen.getByText(sticker.icon)).toBeInTheDocument();
  });

  it('⚠️ KHÔNG có sticker mới (`stickerIds` rỗng) ⇒ KHÔNG ăn mừng sticker', async () => {
    const sticker = getSticker('sticker-medal')!;
    const q = quest({ id: 'qd-01' });
    seed([q]);
    claimMock.mockResolvedValue(claimResult(afterClaim(q))); // `stickerIds: []`
    render(<QuestsPage />);

    fireEvent.click(claimButton());
    await screen.findByText('+10 Sao');

    expect(screen.queryByText(/Sticker mới/)).not.toBeInTheDocument();
    expect(screen.queryByText(sticker.icon)).not.toBeInTheDocument();
  });

  it('⚠️ nhiệm vụ KHAI BÁO thưởng sticker nhưng bé đã có ⇒ KHÔNG ăn mừng (chỉ tin `stickerIds`)', async () => {
    // Cùng cái bẫy như huy hiệu: `quest.rewards` là ĐỊNH NGHĨA, `stickerIds` là phần CHÊNH thật.
    const q = quest({
      id: 'qm-01',
      tier: 'milestone',
      rewards: [
        { kind: 'stars', amount: 40 },
        { kind: 'sticker', refId: 'sticker-medal' },
      ],
    });
    seed([q]);
    claimMock.mockResolvedValue(claimResult(afterClaim(q), { stickerIds: [] }));
    render(<QuestsPage />);

    fireEvent.click(claimButton());
    await screen.findByText('+40 Sao');

    expect(screen.queryByText(/Sticker mới/)).not.toBeInTheDocument();
  });

  it('⚠️ nhận LẠI (409) ⇒ KHÔNG mở túi quà, KHÔNG ăn mừng sticker', async () => {
    const q = quest({ id: 'qd-01' });
    seed([q]);
    claimMock.mockRejectedValue(new ApiClientError('ALREADY_CLAIMED', 'Đã nhận rồi', 409));
    render(<QuestsPage />);

    fireEvent.click(claimButton());

    // Nút tự chuyển sang "Đã nhận" (đường đi BÌNH THƯỜNG), nhưng không có lớp ăn mừng nào.
    expect(await screen.findByRole('button', { name: /Đã nhận:/ })).toBeDisabled();
    expect(screen.queryByText('Bé mở túi quà!')).not.toBeInTheDocument();
    expect(screen.queryByText(/Sticker mới/)).not.toBeInTheDocument();
  });

  it('⭐ LUẬT TRẺ: túi quà ăn mừng sticker không chứa từ mang tính phán xét', async () => {
    const sticker = getSticker('sticker-medal')!;
    const q = quest({ id: 'qm-01', tier: 'milestone', rewards: [{ kind: 'stars', amount: 40 }] });
    seed([q]);
    claimMock.mockResolvedValue(claimResult(afterClaim(q), { stickerIds: [sticker.id] }));
    const { container } = render(<QuestsPage />);

    fireEvent.click(claimButton());
    await screen.findByText(`Sticker mới: ${sticker.name_vi}`);

    // Quét `innerHTML` để bắt cả `aria-label` lẫn chuỗi bị hardcode trong JSX.
    const html = container.innerHTML;
    for (const banned of ['sai', 'kém', 'chưa đạt', 'thất bại']) {
      expect(html.includes(banned)).toBe(false);
    }
  });
});
