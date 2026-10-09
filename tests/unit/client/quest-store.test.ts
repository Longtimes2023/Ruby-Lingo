/**
 * Test cho `questStore` — danh sách nhiệm vụ trong bộ nhớ + điều phối một lần "Nhận thưởng".
 *
 * Bốn nhóm được kiểm kỹ nhất, vì cả bốn đều hỏng IM LẶNG:
 *
 *   1. **`ALREADY_CLAIMED` KHÔNG được thành lỗi.** Bé 7 tuổi chạm nút hai lần là chuyện thường.
 *      Nếu mã 409 đó nổi lên thành `error`, màn hình sẽ báo hỏng trong khi thật ra bé đã nhận
 *      quà — vừa sai, vừa ngược với luật "không bao giờ mắng trẻ".
 *
 *   2. **`lastClaim` phải được đặt khi VÀ CHỈ KHI thật sự có quà mới.** Đặt nó ở nhánh
 *      `already` là ăn mừng lại phần thưởng đã trao từ lượt trước — nói dối bé. Không đặt nó ở
 *      nhánh `claimed` là bé vừa nhận quà mà không thấy gì (lỗi im lặng: ví vẫn tăng đúng).
 *
 *   3. **Đổi bé phải XOÁ dữ liệu bé cũ TRƯỚC khi chờ mạng.** Nếu không, trong vài trăm mili giây
 *      bé mới sẽ thấy danh sách nhiệm vụ CỦA BÉ CŨ, kèm nút "Nhận thưởng" đang sáng.
 *
 *   4. **`QUEST_NOT_COMPLETE` nghĩa là danh sách của ta ĐÃ CŨ.** Server vừa nói nhiệm vụ chưa
 *      xong, tức tiến độ trên màn hình sai. Không nạp lại thì nút tiếp tục sáng và bé bấm mãi mà
 *      không hiểu vì sao.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '@/api/client.js';
import { questsApi, rewardsApi } from '@/api/endpoints.js';
import { __resetQuestStoreForTests, useQuestStore } from '@/store/questStore.js';
import { __resetRewardStoreForTests, useRewardStore } from '@/store/rewardStore.js';
import type { ClaimQuestResponse, QuestsGetResponse } from '@shared/types/api.js';
import type { QuestWithProgress } from '@shared/types/reward.js';

/**
 * Thay cả module endpoint bằng mock. Phải có `rewardsApi` vì `questStore` (qua `rewardStore`)
 * gọi nó để đồng bộ ví sau khi nhận thưởng — thiếu nó thì import sẽ hỏng.
 */
vi.mock('@/api/endpoints.js', () => ({
  questsApi: { get: vi.fn(), claim: vi.fn() },
  rewardsApi: { get: vi.fn() },
}));

const getMock = vi.mocked(questsApi.get);
const claimMock = vi.mocked(questsApi.claim);
const rewardsGetMock = vi.mocked(rewardsApi.get);

const CHILD = 'chi_na';
const OTHER_CHILD = 'chi_em';
const QUEST = 'qd-01';
const NOW = '2026-10-07T08:00:00.000Z';

// =============================================================================
// Dữ liệu dựng sẵn
// =============================================================================

function quest(overrides: Partial<QuestWithProgress> = {}): QuestWithProgress {
  return {
    id: QUEST,
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

function claimResult(overrides: Partial<ClaimQuestResponse> = {}): ClaimQuestResponse {
  return {
    quest: quest({ claimed: true }),
    wallet: { childId: CHILD, stars: 20, acorns: 2, updatedAt: NOW },
    xp: { childId: CHILD, xp: 170, level: 2, updatedAt: NOW },
    levelUp: null,
    badgesEarned: [],
    stickerIds: [],
    ...overrides,
  };
}

function snapshot() {
  return {
    childId: CHILD,
    wallet: { childId: CHILD, stars: 10, acorns: 2, updatedAt: NOW },
    xp: { childId: CHILD, xp: 140, level: 1, updatedAt: NOW },
    pet: {
      childId: CHILD,
      evolutionStage: 'baby' as const,
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
      lastActiveDate: '2026-10-06',
      milestonesClaimed: [],
      updatedAt: NOW,
    },
    inventory: [],
    badges: [],
    stickers: [],
    serverTime: NOW,
  };
}

/** Nạp xong danh sách cho một bé, với đúng một nhiệm vụ đã xong nhưng CHƯA nhận. */
async function loadFor(childId: string, quests: QuestWithProgress[] = [quest()]): Promise<void> {
  getMock.mockResolvedValueOnce(questsResponse(quests));
  await useQuestStore.getState().load(childId);
}

beforeEach(() => {
  __resetQuestStoreForTests();
  __resetRewardStoreForTests();
  vi.clearAllMocks();
  // `reload()` bỏ qua nếu ví đang thuộc bé KHÁC. Đặt sẵn để phép kiểm "đồng bộ ví" có ý nghĩa.
  useRewardStore.setState({ childId: CHILD, hydrated: true, snapshot: snapshot() });
  rewardsGetMock.mockResolvedValue(snapshot());
});

afterEach(() => {
  vi.restoreAllMocks();
});

// =============================================================================
// Nạp
// =============================================================================

describe('questStore.load', () => {
  it('nạp danh sách + chuỗi ngày + khoá kỳ', async () => {
    await loadFor(CHILD);

    const state = useQuestStore.getState();
    expect(state.childId).toBe(CHILD);
    expect(state.quests).toHaveLength(1);
    expect(state.streak?.currentStreak).toBe(3);
    expect(state.periodKeys?.daily).toBe('2026-10-07');
    expect(state.hydrated).toBe(true);
    expect(state.loading).toBe(false);
  });

  it('gọi hai lần liên tiếp cho CÙNG một bé chỉ tốn MỘT request (StrictMode)', async () => {
    getMock.mockResolvedValue(questsResponse([quest()]));

    // Hai lời gọi ĐỒNG BỘ, không `await` ở giữa — đúng cách StrictMode gọi hiệu ứng hai lần.
    const first = useQuestStore.getState().load(CHILD);
    const second = useQuestStore.getState().load(CHILD);
    await Promise.all([first, second]);

    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('đã có dữ liệu và lần trước không hỏng ⇒ không nạp lại', async () => {
    await loadFor(CHILD);
    expect(getMock).toHaveBeenCalledTimes(1);

    await useQuestStore.getState().load(CHILD);

    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('lần nạp hỏng ⇒ ĐƯỢC nạp lại (không kẹt ở trạng thái rỗng mãi mãi)', async () => {
    getMock.mockRejectedValueOnce(new Error('mất mạng'));
    await useQuestStore.getState().load(CHILD);
    expect(useQuestStore.getState().error).toBeTruthy();

    getMock.mockResolvedValueOnce(questsResponse([quest()]));
    await useQuestStore.getState().load(CHILD);

    expect(useQuestStore.getState().quests).toHaveLength(1);
    expect(useQuestStore.getState().error).toBeNull();
  });

  it('⚠️ đổi bé ⇒ XOÁ dữ liệu bé cũ NGAY, trước khi chờ mạng', async () => {
    await loadFor(CHILD, [quest({ id: 'qd-01', description_vi: 'của bé Na' })]);

    let release: (value: QuestsGetResponse) => void = () => {};
    getMock.mockReturnValueOnce(
      new Promise<QuestsGetResponse>((resolve) => {
        release = resolve;
      }),
    );

    const pending = useQuestStore.getState().load(OTHER_CHILD);

    // Chưa có phản hồi: danh sách CỦA BÉ CŨ phải đã biến mất, nếu không bé mới sẽ thấy nó.
    expect(useQuestStore.getState().quests).toBeNull();
    expect(useQuestStore.getState().childId).toBe(OTHER_CHILD);
    expect(useQuestStore.getState().loading).toBe(true);

    release(questsResponse([quest({ id: 'qw-01', description_vi: 'của bé Em' })]));
    await pending;

    expect(useQuestStore.getState().quests?.[0]?.description_vi).toBe('của bé Em');
  });
});

// =============================================================================
// Nhận thưởng
// =============================================================================

describe('questStore.claim — đường thành công', () => {
  it('đánh dấu nhiệm vụ đã nhận, đặt màn ăn mừng, và đồng bộ ví', async () => {
    await loadFor(CHILD);
    claimMock.mockResolvedValue(
      claimResult({ badgesEarned: ['badge-diligent'], levelUp: { from: 1, to: 2, rewards: [] } }),
    );

    await useQuestStore.getState().claim(CHILD, QUEST);

    const state = useQuestStore.getState();
    expect(state.quests?.[0]?.claimed).toBe(true);
    expect(state.lastClaim?.questId).toBe(QUEST);
    expect(state.lastClaim?.badgesEarned).toEqual(['badge-diligent']);
    expect(state.lastClaim?.levelUp?.to).toBe(2);
    expect(state.claiming[QUEST]).toBeUndefined();
    expect(state.error).toBeNull();
    // ⚠️ Ví PHẢI được đọc lại: phản hồi `claim` không mang danh sách huy hiệu ĐẦY ĐỦ, nên nếu
    // không nạp lại thì bé vừa nhận huy hiệu mới mà bộ sưu tập vẫn trống.
    expect(rewardsGetMock).toHaveBeenCalledWith(CHILD);
  });

  it('mang `stickerIds` vào màn ăn mừng (T069.2)', async () => {
    await loadFor(CHILD);
    claimMock.mockResolvedValue(claimResult({ stickerIds: ['sticker-medal'] }));

    await useQuestStore.getState().claim(CHILD, QUEST);

    expect(useQuestStore.getState().lastClaim?.stickerIds).toEqual(['sticker-medal']);
  });

  it('vẫn giữ nguyên các nhiệm vụ khác trong danh sách', async () => {
    await loadFor(CHILD, [quest({ id: 'qd-01' }), quest({ id: 'qd-02', claimed: false })]);
    claimMock.mockResolvedValue(claimResult({ quest: quest({ id: 'qd-01', claimed: true }) }));

    await useQuestStore.getState().claim(CHILD, 'qd-01');

    const state = useQuestStore.getState();
    expect(state.quests).toHaveLength(2);
    expect(state.quests?.map((q) => q.id)).toEqual(['qd-01', 'qd-02']);
    expect(state.quests?.[0]?.claimed).toBe(true);
    expect(state.quests?.[1]?.claimed).toBe(false);
  });
});

describe('questStore.claim — ALREADY_CLAIMED là đường đi BÌNH THƯỜNG', () => {
  it('đánh dấu đã nhận, KHÔNG báo lỗi, KHÔNG ăn mừng lại', async () => {
    await loadFor(CHILD);
    claimMock.mockRejectedValue(
      new ApiClientError('ALREADY_CLAIMED', 'Nhiệm vụ này đã được nhận rồi.', 409),
    );

    await useQuestStore.getState().claim(CHILD, QUEST);

    const state = useQuestStore.getState();
    expect(state.error).toBeNull();
    expect(state.quests?.[0]?.claimed).toBe(true);
    // ⚠️ KHÔNG được ăn mừng: quà đã trao ở lượt trước. Ăn mừng lại là nói dối bé.
    expect(state.lastClaim).toBeNull();
    // Nhưng VẪN đồng bộ ví: một lần bấm trước đó có thể đã thành công ở server mà phản hồi không
    // về tới client — không đọc lại thì ví thiếu đúng phần thưởng ấy, mãi mãi.
    expect(rewardsGetMock).toHaveBeenCalledWith(CHILD);
  });
});

describe('questStore.claim — chặn bấm hai lần & đường lỗi', () => {
  it('hai cú chạm liên tiếp chỉ tốn MỘT request', async () => {
    await loadFor(CHILD);
    // Promise không bao giờ xong: mô phỏng mạng đang chậm, bé chạm thêm lần nữa.
    claimMock.mockImplementation(() => new Promise<ClaimQuestResponse>(() => {}));

    void useQuestStore.getState().claim(CHILD, QUEST);
    void useQuestStore.getState().claim(CHILD, QUEST);

    expect(claimMock).toHaveBeenCalledTimes(1);
  });

  it('lỗi khác ⇒ ghi `error`, KHÔNG ăn mừng, và nút DÙNG LẠI ĐƯỢC', async () => {
    await loadFor(CHILD);
    claimMock.mockRejectedValue(new ApiClientError('INTERNAL_ERROR', 'Hỏng.', 500));

    await useQuestStore.getState().claim(CHILD, QUEST);

    const state = useQuestStore.getState();
    expect(state.error).toBeTruthy();
    expect(state.lastClaim).toBeNull();
    expect(state.quests?.[0]?.claimed).toBe(false);
    // ⚠️ Cờ `claiming` PHẢI được gỡ ở cả nhánh lỗi — nếu không, nút kẹt ở trạng thái đang gửi
    // và bé không bao giờ bấm lại được. Đây là lý do việc gỡ nằm trong `finally`.
    expect(state.claiming[QUEST]).toBeUndefined();
  });

  it('QUEST_NOT_COMPLETE ⇒ NẠP LẠI danh sách (vì danh sách của ta đã cũ)', async () => {
    await loadFor(CHILD);
    expect(getMock).toHaveBeenCalledTimes(1);

    claimMock.mockRejectedValue(
      new ApiClientError('QUEST_NOT_COMPLETE', 'Nhiệm vụ chưa xong.', 409),
    );
    getMock.mockResolvedValue(questsResponse([quest({ completed: false, progress: 0 })]));

    await useQuestStore.getState().claim(CHILD, QUEST);

    expect(getMock).toHaveBeenCalledTimes(2);
    expect(useQuestStore.getState().quests?.[0]?.completed).toBe(false);
  });

  it('claim cho bé KHÁC thì bị bỏ qua (không trộn dữ liệu giữa các bé)', async () => {
    await loadFor(CHILD);

    await useQuestStore.getState().claim(OTHER_CHILD, QUEST);

    expect(claimMock).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Vòng đời
// =============================================================================

describe('questStore — vòng đời', () => {
  it('dismissClaim đóng màn ăn mừng nhưng giữ nguyên danh sách', async () => {
    await loadFor(CHILD);
    claimMock.mockResolvedValue(claimResult());
    await useQuestStore.getState().claim(CHILD, QUEST);
    expect(useQuestStore.getState().lastClaim).not.toBeNull();

    useQuestStore.getState().dismissClaim();

    expect(useQuestStore.getState().lastClaim).toBeNull();
    expect(useQuestStore.getState().quests).toHaveLength(1);
  });

  it('reset xoá sạch mọi thứ', async () => {
    await loadFor(CHILD);
    claimMock.mockResolvedValue(claimResult());
    await useQuestStore.getState().claim(CHILD, QUEST);

    useQuestStore.getState().reset();

    const state = useQuestStore.getState();
    expect(state.childId).toBeNull();
    expect(state.quests).toBeNull();
    expect(state.lastClaim).toBeNull();
    expect(state.claiming).toEqual({});
  });
});
