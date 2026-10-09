/**
 * Test cho BA endpoint của cửa hàng trong `endpoints.ts` (T063):
 * `rewardsApi.buy` / `.feed` / `.equip`.
 *
 * ⚠️ VÌ SAO CẦN TỆP NÀY, KHI ĐÃ CÓ `shop-service.test.ts`:
 *   `shop-service.test.ts` THAY CẢ module `@/api/endpoints.js` bằng mock — nó chứng minh "service
 *   gọi đúng hàm với đúng tham số", chứ KHÔNG chứng minh hàm ấy dựng đúng ĐƯỜNG DẪN. Mà đường
 *   dẫn là thứ duy nhất ở tầng này, và nó hỏng im lặng: một `itemId` chứa `/` biến
 *   `…/inventory/a/equip` thành một đường dẫn khác hẳn, server trả 404 cho một món có thật, và
 *   không có lỗi biên dịch nào để chỉ ra. Cùng loại lỗi mà `ROUTE1` đã đào bới ở phía server.
 *
 * ⭐ BỐN ĐIỀU ĐƯỢC KHOÁ Ở ĐÂY:
 *   1. Đường dẫn của từng endpoint (sai một chữ cũng là gọi vào hư không).
 *   2. `itemId` của `equip` NẰM TRÊN ĐƯỜNG DẪN, và body CHỈ có `equipped` — hai nguồn cho hai sự
 *      thật khác nhau thì không có chỗ nào để chúng lệch (xem `shared/types/api.ts`).
 *   3. Cả `childId` lẫn `itemId` đều đi qua `encodeURIComponent`.
 *   4. `buy`/`feed` KHÔNG gửi gì ngoài `{ itemId }` — client không được khai giá (xem
 *      `ShopService.buyItem`).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/api/client.js';
import { rewardsApi } from '@/api/endpoints.js';

vi.mock('@/api/client.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

const postMock = vi.mocked(api.post);

const CHILD = 'chi_na';
const FOOD = 'food-banana';
const HAT = 'acc-hat';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('rewardsApi — ba endpoint của cửa hàng (T063)', () => {
  it('buy: POST /children/:id/shop/buy, body CHỈ có { itemId }', async () => {
    postMock.mockResolvedValue(null);

    await rewardsApi.buy(CHILD, { itemId: FOOD });

    // Gửi kèm giá ở đây là mở đường cho client tự định giá món đồ của chính mình.
    expect(postMock.mock.calls[0]).toEqual([`/children/${CHILD}/shop/buy`, { itemId: FOOD }]);
  });

  it('feed: POST /children/:id/pet/feed, body CHỈ có { itemId }', async () => {
    postMock.mockResolvedValue(null);

    await rewardsApi.feed(CHILD, { itemId: FOOD });

    expect(postMock.mock.calls[0]).toEqual([`/children/${CHILD}/pet/feed`, { itemId: FOOD }]);
  });

  it('equip: `itemId` đi TRÊN ĐƯỜNG DẪN, body chỉ có `{ equipped }`', async () => {
    postMock.mockResolvedValue(null);

    await rewardsApi.equip(CHILD, HAT, { equipped: true });

    // `itemId` KHÔNG được có mặt trong body: hai nguồn nói cùng một sự thật chỉ cần lệch một lần
    // là mặc nhầm món.
    expect(postMock.mock.calls[0]).toEqual([
      `/children/${CHILD}/inventory/${HAT}/equip`,
      { equipped: true },
    ]);
  });

  it('⚠️ equip: `itemId` có dấu `/` KHÔNG được phá đường dẫn', async () => {
    postMock.mockResolvedValue(null);

    await rewardsApi.equip(CHILD, 'a/b', { equipped: false });

    expect(postMock.mock.calls[0]?.[0]).toBe(`/children/${CHILD}/inventory/a%2Fb/equip`);
  });

  it('⚠️ equip: `childId` cũng được mã hoá', async () => {
    postMock.mockResolvedValue(null);

    await rewardsApi.equip('chi/na', HAT, { equipped: true });

    expect(postMock.mock.calls[0]?.[0]).toBe('/children/chi%2Fna/inventory/acc-hat/equip');
  });
});
