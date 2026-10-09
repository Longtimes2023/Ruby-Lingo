/**
 * Test cho `QuestService` (phía client) — nơi `ALREADY_CLAIMED` được dịch thành "đã nhận rồi".
 *
 * ⭐ VÌ SAO TỆP NÀY ĐÁNG TỒN TẠI: đây là chỗ DUY NHẤT trong client biết rằng HTTP 409 với mã
 *   `ALREADY_CLAIMED` **không phải là lỗi**. Nếu ai đó "dọn dẹp" bằng cách bỏ `try/catch` ở đây
 *   (trông như code thừa), thì mỗi lần bé 7 tuổi chạm nút hai lần sẽ nổi lên một lỗi — và theo
 *   luật của dự án, ta KHÔNG BAO GIỜ mắng trẻ vì một hành vi hoàn toàn bình thường.
 *
 *   Điều quan trọng không kém: mọi mã lỗi KHÁC phải được ném NGUYÊN VẸN. Nuốt tất cả (bắt
 *   `Error` chung chung) sẽ biến "mất mạng" thành "đã nhận rồi" — bé bấm, màn hình nói đã nhận,
 *   mà ví không tăng, và không có gì để lần theo.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '@/api/client.js';
import { questsApi } from '@/api/endpoints.js';
import { claimQuest, loadQuests } from '@/services/QuestService.js';
import type { ClaimQuestResponse } from '@shared/types/api.js';

vi.mock('@/api/endpoints.js', () => ({
  questsApi: { get: vi.fn(), claim: vi.fn() },
}));

const getMock = vi.mocked(questsApi.get);
const claimMock = vi.mocked(questsApi.claim);

const CHILD = 'chi_na';
const QUEST = 'qd-01';

function claimResult(): ClaimQuestResponse {
  return {
    quest: {
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
      claimed: true,
    },
    wallet: { childId: CHILD, stars: 20, acorns: 2, updatedAt: '2026-10-07T08:00:00.000Z' },
    xp: { childId: CHILD, xp: 170, level: 2, updatedAt: '2026-10-07T08:00:00.000Z' },
    levelUp: null,
    badgesEarned: [],
    stickerIds: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('claimQuest — phân loại kết quả', () => {
  it('server trao quà ⇒ trả về "claimed" kèm nguyên phản hồi', async () => {
    const result = claimResult();
    claimMock.mockResolvedValue(result);

    const outcome = await claimQuest(CHILD, QUEST);

    expect(outcome).toEqual({ status: 'claimed', result });
    expect(claimMock).toHaveBeenCalledWith(CHILD, QUEST);
  });

  it('409 ALREADY_CLAIMED ⇒ "already", KHÔNG ném lỗi', async () => {
    claimMock.mockRejectedValue(
      new ApiClientError('ALREADY_CLAIMED', 'Nhiệm vụ này đã được nhận rồi.', 409),
    );

    // Khẳng định bằng `resolves`, không bằng `not.toThrow` quên `await`: một promise bị từ chối
    // mà không ai `await` sẽ lọt qua mọi khẳng định kiểu đó.
    await expect(claimQuest(CHILD, QUEST)).resolves.toEqual({ status: 'already' });
  });

  it('QUEST_NOT_COMPLETE ⇒ NÉM NGUYÊN VẸN (không được nuốt thành "already")', async () => {
    const error = new ApiClientError('QUEST_NOT_COMPLETE', 'Nhiệm vụ chưa xong.', 409);
    claimMock.mockRejectedValue(error);

    await expect(claimQuest(CHILD, QUEST)).rejects.toBe(error);
  });

  it('lỗi mạng ⇒ NÉM NGUYÊN VẸN (mất mạng KHÁC "đã nhận rồi")', async () => {
    const error = new ApiClientError('INTERNAL_ERROR', 'Không kết nối được.', 0, {
      isNetworkError: true,
    });
    claimMock.mockRejectedValue(error);

    await expect(claimQuest(CHILD, QUEST)).rejects.toBe(error);
  });

  it('lỗi KHÔNG phải ApiClientError ⇒ NÉM NGUYÊN VẸN', async () => {
    const error = new Error('hỏng gì đó');
    claimMock.mockRejectedValue(error);

    await expect(claimQuest(CHILD, QUEST)).rejects.toBe(error);
  });

  it('KHÔNG gửi body nào lên server — client không được khai tiến độ hay số quà', async () => {
    claimMock.mockResolvedValue(claimResult());

    await claimQuest(CHILD, QUEST);

    // `claim` chỉ được gọi với hai tham số: id bé và id nhiệm vụ. Bất kỳ tham số thứ ba nào
    // (một body) đều nghĩa là client đang gửi thêm dữ kiện — đúng thứ kiến trúc "server là trọng
    // tài cuối" sinh ra để chặn.
    expect(claimMock.mock.calls[0]).toEqual([CHILD, QUEST]);
  });
});

describe('loadQuests', () => {
  it('chuyển tiếp id bé xuống tầng endpoint', async () => {
    getMock.mockResolvedValue({
      quests: [],
      streak: {
        childId: CHILD,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        milestonesClaimed: [],
        updatedAt: '2026-10-07T08:00:00.000Z',
      },
      periodKeys: { daily: '2026-10-07', weekly: '2026-W41' },
    });

    await loadQuests(CHILD);

    expect(getMock).toHaveBeenCalledWith(CHILD);
  });
});
