/**
 * Test cho `ShopService` (phía client) — nơi `INSUFFICIENT_FUNDS` được dịch thành "chưa đủ tiền".
 *
 * ⭐ VÌ SAO TỆP NÀY ĐÁNG TỒN TẠI: đây là chỗ DUY NHẤT trong client biết rằng HTTP 409 với mã
 *   `INSUFFICIENT_FUNDS` **không phải là lỗi**. Nếu ai đó "dọn dẹp" bằng cách bỏ `try/catch` ở
 *   đây (trông như code thừa), thì mỗi lần ví trên màn hình cũ hơn ví thật — bé vừa tiêu ở tab
 *   khác, hoặc một thiết bị khác vừa mua hộ — bé sẽ nhận một banner báo hỏng cho một việc hoàn
 *   toàn bình thường. Luật của dự án: KHÔNG BAO GIỜ MẮNG ĐỨA TRẺ.
 *
 *   Điều quan trọng không kém: mọi mã lỗi KHÁC phải được ném NGUYÊN VẸN. Nuốt tất cả (bắt `Error`
 *   chung chung) sẽ biến "mất mạng" thành "chưa đủ tiền" — bé bấm, màn hình bảo học thêm, mà thật
 *   ra chỉ là wifi chập. Và `ITEM_NOT_FOUND` thì tệ hơn nữa: nó nghĩa là danh mục trong máy và
 *   danh mục của server đã lệch nhau — một lỗi lập trình thật, phải nổi lên.
 *
 * ⚠️ `feedPet` VÀ `setEquipped` CỐ Ý KHÔNG CÓ NHÁNH NÀO ĐỂ DỊCH, và các test dưới đây khoá đúng
 *    điều đó: server trả 200 kèm trạng thái hiện có cho mọi trường hợp "không có gì đổi" (cho ăn
 *    lúc đã no, mặc lại món đang mặc), nên không tồn tại một mã 409 nào để biến thành kết quả
 *    bình thường. Nếu một ngày ai đó thêm một nhánh `catch` vào hai hàm ấy, test sẽ đỏ.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '@/api/client.js';
import { rewardsApi } from '@/api/endpoints.js';
import { buyItem, feedPet, setEquipped } from '@/services/ShopService.js';
import { getShopItem } from '@shared/content/shop.js';
import type { FeedResult, PurchaseResult } from '@shared/types/reward.js';

vi.mock('@/api/endpoints.js', () => ({
  rewardsApi: { get: vi.fn(), buy: vi.fn(), feed: vi.fn(), equip: vi.fn() },
}));

const buyMock = vi.mocked(rewardsApi.buy);
const feedMock = vi.mocked(rewardsApi.feed);
const equipMock = vi.mocked(rewardsApi.equip);

const CHILD = 'chi_na';
const FOOD = 'food-banana';
const HAT = 'acc-hat';
const NOW = '2026-10-08T08:00:00.000Z';

/** Vật phẩm THẬT từ `shared/content/shop-items.json` — không bịa id để test khỏi lệch dữ liệu. */
function item(id: string) {
  const found = getShopItem(id);
  if (!found) throw new Error(`shop-items.json thiếu "${id}" — fixture của test đã lệch dữ liệu`);
  return found;
}

function purchase(): PurchaseResult {
  return {
    item: item(FOOD),
    wallet: { childId: CHILD, stars: 15, acorns: 2, updatedAt: NOW },
    inventoryItem: {
      childId: CHILD,
      itemId: FOOD,
      quantity: 1,
      equipped: false,
      acquiredAt: NOW,
    },
  };
}

function feed(): FeedResult {
  return {
    pet: {
      childId: CHILD,
      evolutionStage: 'egg',
      wordsLearned: 0,
      happiness: 4,
      equippedItemIds: [],
      lastFedAt: NOW,
      updatedAt: NOW,
    },
    item: item(FOOD),
    wallet: { childId: CHILD, stars: 15, acorns: 2, updatedAt: NOW },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// buyItem
// =============================================================================

describe('buyItem — phân loại kết quả', () => {
  it('server trừ tiền và trao đồ ⇒ "bought" kèm nguyên phản hồi', async () => {
    const result = purchase();
    buyMock.mockResolvedValue(result);

    await expect(buyItem(CHILD, FOOD)).resolves.toEqual({ status: 'bought', result });
  });

  it('409 INSUFFICIENT_FUNDS ⇒ "notEnough", KHÔNG ném lỗi', async () => {
    buyMock.mockRejectedValue(
      new ApiClientError('INSUFFICIENT_FUNDS', 'Không đủ Sao để mua món này.', 409),
    );

    // Khẳng định bằng `resolves`, không bằng `not.toThrow` quên `await`: một promise bị từ chối mà
    // không ai `await` sẽ lọt qua mọi khẳng định kiểu đó.
    await expect(buyItem(CHILD, FOOD)).resolves.toEqual({ status: 'notEnough' });
  });

  it('404 ITEM_NOT_FOUND ⇒ NÉM NGUYÊN VẸN (danh mục hai bên đã lệch)', async () => {
    const error = new ApiClientError('ITEM_NOT_FOUND', 'Không tìm thấy món này.', 404);
    buyMock.mockRejectedValue(error);

    await expect(buyItem(CHILD, 'acc-khong-co')).rejects.toBe(error);
  });

  it('400 VALIDATION_FAILED ⇒ NÉM NGUYÊN VẸN (không được hoá trang thành "chưa đủ tiền")', async () => {
    const error = new ApiClientError('VALIDATION_FAILED', 'Dữ liệu không hợp lệ.', 400);
    buyMock.mockRejectedValue(error);

    await expect(buyItem(CHILD, FOOD)).rejects.toBe(error);
  });

  it('lỗi mạng ⇒ NÉM NGUYÊN VẸN (mất mạng KHÁC "chưa đủ tiền")', async () => {
    const error = new ApiClientError('INTERNAL_ERROR', 'Không kết nối được.', 0, {
      isNetworkError: true,
    });
    buyMock.mockRejectedValue(error);

    await expect(buyItem(CHILD, FOOD)).rejects.toBe(error);
  });

  it('lỗi KHÔNG phải ApiClientError ⇒ NÉM NGUYÊN VẸN', async () => {
    const error = new Error('hỏng gì đó');
    buyMock.mockRejectedValue(error);

    await expect(buyItem(CHILD, FOOD)).rejects.toBe(error);
  });

  it('CHỈ gửi { itemId } — client KHÔNG được khai giá', async () => {
    buyMock.mockResolvedValue(purchase());

    await buyItem(CHILD, FOOD);

    // Một tham số thứ ba (hay một trường `price` trong body) nghĩa là client đang tự định giá món
    // đồ của chính mình — đúng thứ mà việc server tra giá trong `shop-items.json` sinh ra để chặn.
    expect(buyMock.mock.calls[0]).toEqual([CHILD, { itemId: FOOD }]);
  });
});

// =============================================================================
// feedPet
// =============================================================================

describe('feedPet — chuyển tiếp thẳng', () => {
  it('gửi { itemId } và trả nguyên `FeedResult`', async () => {
    const result = feed();
    feedMock.mockResolvedValue(result);

    await expect(feedPet(CHILD, FOOD)).resolves.toBe(result);
    expect(feedMock.mock.calls[0]).toEqual([CHILD, { itemId: FOOD }]);
  });

  it('server trả 200 khi Momo đã no ⇒ vẫn là một lần gọi THÀNH CÔNG, không có nhánh riêng', async () => {
    // "Đã no" trả về chính hàng `pet_state` cũ — xem `RewardService.feed`. Phân loại "vừa ăn" hay
    // "đang no" là việc của `shopStore` (nó so `happiness` trước/sau), KHÔNG phải của tầng này.
    const stillFull = feed();
    stillFull.pet.happiness = 5;
    feedMock.mockResolvedValue(stillFull);

    await expect(feedPet(CHILD, FOOD)).resolves.toBe(stillFull);
  });

  it('lỗi ⇒ NÉM NGUYÊN VẸN (không nuốt thành một kết quả êm)', async () => {
    const error = new ApiClientError('VALIDATION_FAILED', 'Món này không cho ăn được', 400);
    feedMock.mockRejectedValue(error);

    await expect(feedPet(CHILD, HAT)).rejects.toBe(error);
  });
});

// =============================================================================
// setEquipped
// =============================================================================

describe('setEquipped — chuyển tiếp thẳng', () => {
  it('gửi `itemId` trên đường dẫn và `equipped` trong body', async () => {
    const result = {
      item: item(HAT),
      inventory: [],
      pet: {
        childId: CHILD,
        evolutionStage: 'egg' as const,
        wordsLearned: 0,
        happiness: 3,
        equippedItemIds: [HAT],
        lastFedAt: null,
        updatedAt: NOW,
      },
    };
    equipMock.mockResolvedValue(result);

    await expect(setEquipped(CHILD, HAT, true)).resolves.toBe(result);
    // Ba tham số tách rời: id bé, id món (đường dẫn), body. Không có chỗ nào để `itemId` lọt vào
    // body rồi mâu thuẫn với đường dẫn.
    expect(equipMock.mock.calls[0]).toEqual([CHILD, HAT, { equipped: true }]);
  });

  it('bỏ ra (`equipped: false`) KHÔNG bị đổi thành `true` ở tầng này', async () => {
    equipMock.mockResolvedValue({
      item: item(HAT),
      inventory: [],
      pet: {
        childId: CHILD,
        evolutionStage: 'egg',
        wordsLearned: 0,
        happiness: 3,
        equippedItemIds: [],
        lastFedAt: null,
        updatedAt: NOW,
      },
    });

    await setEquipped(CHILD, HAT, false);

    // Tầng này TUYỆT ĐỐI không được tự đảo trạng thái: `equipped` là trạng thái đích, do chỗ gọi
    // quyết định. Một phép đảo ở đây biến cú bấm đúp của trẻ 7 tuổi thành "mặc rồi bỏ ra".
    expect(equipMock.mock.calls[0]![2]).toEqual({ equipped: false });
  });

  it('lỗi ⇒ NÉM NGUYÊN VẸN', async () => {
    const error = new ApiClientError('ITEM_NOT_FOUND', 'Không tìm thấy món này.', 404);
    equipMock.mockRejectedValue(error);

    await expect(setEquipped(CHILD, HAT, true)).rejects.toBe(error);
  });
});
