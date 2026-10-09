/**
 * Test KHÂU NỐI CUỐI của T055: phần thưởng server trả về → `rewardStore`.
 *
 * ⭐ VÌ SAO CẦN MỘT FILE RIÊNG CHO BA DÒNG MÃ:
 *   `game-result-queue.test.ts` kiểm hàng đợi qua `GameResultQueueDeps` được TIÊM VÀO — nghĩa là
 *   nó dựng một hàng đợi GIẢ và tự truyền `onSent` của nó. Test đó vì vậy chứng minh được
 *   "hàng đợi gọi `onSent`", NHƯNG KHÔNG chứng minh được "instance thật dùng chung có nối
 *   `onSent` vào `rewardStore` hay không".
 *
 *   Đó đúng là khoảng trống đã làm dự án trả giá nhiều lần: một dòng nối bị thiếu thì mọi unit
 *   test của hai đầu vẫn xanh, ứng dụng vẫn chạy, chỉ là phần thưởng KHÔNG BAO GIỜ tới ví. Ở
 *   đây ta chạm vào ĐÚNG instance thật (`gameResultQueue`) và ĐÚNG store thật.
 *
 * ⚠️ ĐIỀU FILE NÀY KHÔNG KIỂM: phép cộng delta (⭐/🌰/XP, suy lại cấp). Phép đó đã có
 *    `reward-store.test.ts` lo, với ngân sách khẳng định chi tiết hơn nhiều. Ở đây chỉ khoá
 *    sự tồn tại và tính đúng đắn của ĐƯỜNG ĐI.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  submitGameResult: vi.fn(),
  getRewards: vi.fn(),
}));

/**
 * Thay cả module endpoint. Cần CẢ HAI hàm:
 *   • `progressApi.submitGameResult` — hàng đợi thật gọi nó để gửi lượt chơi.
 *   • `rewardsApi.get`               — `rewardStore` gọi nó để nạp lại ảnh chụp sau khi cộng.
 * Thiếu cái thứ hai thì `applyAward()` sẽ ném ngay ở bước nạp lại và test đỏ vì lý do sai.
 */
vi.mock('@/api/endpoints.js', () => ({
  progressApi: { submitGameResult: mocks.submitGameResult },
  rewardsApi: { get: mocks.getRewards },
}));

import {
  clearGameResultQueue,
  gameResultQueue,
  type GameRunContext,
} from '@/services/GameResultService.js';
import { __resetRewardStoreForTests, useRewardStore } from '@/store/rewardStore.js';
import type { GameResultAward } from '@shared/types/progress.js';
import type { RewardSnapshot } from '@shared/types/reward.js';

const CHILD = 'chi_na';
const OTHER_CHILD = 'chi_em';
const NOW = '2026-10-07T08:00:00.000Z';

function snapshot(overrides: Partial<RewardSnapshot> = {}): RewardSnapshot {
  return {
    childId: CHILD,
    wallet: { childId: CHILD, stars: 10, acorns: 2, updatedAt: NOW },
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
      currentStreak: 2,
      longestStreak: 5,
      lastActiveDate: '2026-10-06',
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

function award(overrides: Partial<GameResultAward> = {}): GameResultAward {
  return {
    score: 12,
    stars: 3,
    bestScore: 12,
    bestStars: 3,
    isNewRecord: true,
    duplicate: false,
    xpGained: 20,
    starsGained: 5,
    acornsGained: 1,
    levelUp: null,
    questsCompleted: [],
    badgesEarned: [],
    stickerEarned: null,
    ...overrides,
  };
}

/** Một lượt chơi 1 câu. */
function context(overrides: Partial<GameRunContext> = {}): GameRunContext {
  return {
    childId: CHILD,
    exerciseId: 'at-the-zoo/z1/listen-tap',
    lessonId: 'at-the-zoo/z1',
    gameType: 'listen_tap',
    totalRounds: 1,
    durationSeconds: 12,
    answers: [{ wordId: 'w.monkey', firstTry: true, wrongAttempts: 0 }],
    ...overrides,
  };
}

/** Đưa store về trạng thái "đã nạp xong cho `CHILD`" — điều kiện để `applyAward` chịu cộng. */
function seedStore(): RewardSnapshot {
  const snap = snapshot();
  useRewardStore.setState({
    childId: CHILD,
    snapshot: snap,
    hydrated: true,
    loading: false,
    error: null,
    awards: {},
  });
  return snap;
}

beforeEach(() => {
  mocks.submitGameResult.mockReset();
  mocks.getRewards.mockReset();
  // Ảnh chụp nạp lại: trả về chính ảnh chụp "server đã cập nhật". Không quan trọng giá trị,
  // chỉ cần nó SETTLE — một promise treo sẽ để `refreshInFlight` bật mãi và làm hỏng test sau.
  mocks.getRewards.mockResolvedValue(snapshot());
  clearGameResultQueue();
  __resetRewardStoreForTests();
});

describe('gameResultQueue (instance thật) → rewardStore', () => {
  /**
   * ⭐ KHẲNG ĐỊNH CỐT LÕI. Xoá dòng `onSent` khỏi `GameResultService.ts` thì test này đỏ, còn
   *    toàn bộ test khác của dự án vẫn xanh.
   */
  it('⭐ gửi xong một lượt ⇒ phần thưởng nằm trong store, khoá theo `clientEventId` của lượt', async () => {
    seedStore();
    const theAward = award({ xpGained: 20, starsGained: 5, acornsGained: 1 });
    mocks.submitGameResult.mockResolvedValue(theAward);

    const item = gameResultQueue.enqueue(context());
    expect(await gameResultQueue.flush()).toBe(1);

    const state = useRewardStore.getState();
    expect(state.awards[item.submission.clientEventId]).toEqual(theAward);
  });

  it('phần thưởng của hai lượt nằm CẠNH NHAU, không ghi đè nhau', async () => {
    seedStore();
    mocks.submitGameResult
      .mockResolvedValueOnce(award({ score: 1, starsGained: 1 }))
      .mockResolvedValueOnce(award({ score: 9, starsGained: 3 }));

    const first = gameResultQueue.enqueue(context({ exerciseId: 'a/1/first' }));
    const second = gameResultQueue.enqueue(context({ exerciseId: 'a/1/second' }));
    expect(await gameResultQueue.flush()).toBe(2);

    const { awards } = useRewardStore.getState();
    expect(awards[first.submission.clientEventId]!.score).toBe(1);
    expect(awards[second.submission.clientEventId]!.score).toBe(9);
  });

  /**
   * ⚠️ Bé đổi hồ sơ trong lúc request đang bay: lượt chơi của bé CŨ về muộn KHÔNG được cộng
   *    vào ví bé MỚI. Cổng chặn nằm ở `rewardStore.applyAward` (so `childId`) — test này chứng
   *    minh hàng đợi thật truyền `childId` xuống đúng, chứ không chỉ truyền mỗi phần thưởng.
   */
  it('lượt chơi của bé KHÁC không được cộng vào ví bé đang chọn', async () => {
    const snap = seedStore();
    mocks.submitGameResult.mockResolvedValue(award({ starsGained: 5 }));

    gameResultQueue.enqueue(context({ childId: OTHER_CHILD }));
    expect(await gameResultQueue.flush()).toBe(1);

    const state = useRewardStore.getState();
    expect(state.awards).toEqual({});
    expect(state.snapshot!.wallet.stars).toBe(snap.wallet.stars);
  });

  it('gửi hỏng ⇒ store KHÔNG đổi gì (không có phần thưởng nào để ghi)', async () => {
    const snap = seedStore();
    mocks.submitGameResult.mockRejectedValue(new Error('mất mạng'));

    gameResultQueue.enqueue(context());
    expect(await gameResultQueue.flush()).toBe(0);

    const state = useRewardStore.getState();
    expect(state.awards).toEqual({});
    expect(state.snapshot!.wallet.stars).toBe(snap.wallet.stars);
  });
});
