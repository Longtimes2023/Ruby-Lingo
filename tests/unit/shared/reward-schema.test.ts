/**
 * RubyLingo — Test hợp đồng MIỀN THƯỞNG (`shared/schemas/reward.ts`).
 *
 * ⭐ VÌ SAO BỘ TEST NÀY QUAN TRỌNG HƠN VẺ NGOÀI CỦA NÓ:
 *   Ba schema dưới đây được dùng ở CẢ route (`server/routes/rewards.ts`) LẪN service
 *   (`server/services/RewardService.ts`). Chúng là cổng vào ví của bé — mà ví là CỘNG DỒN, nên
 *   một giá trị đi lọt sẽ Ở LẠI VĨNH VIỄN, không có màn hình nào phát hiện ra.
 *
 * ⚠️ ĐIỀU QUAN TRỌNG NHẤT: `buyItemRequestSchema` KHÔNG có trường `price`/`currency`.
 *   Giá nằm ở `shared/content/shop-items.json` và server tự tra. Nếu giá lọt được vào hợp đồng,
 *   một bé biết mở DevTools chỉ cần sửa một con số là mua được vương miện giá 1 ⭐. Test dưới đây
 *   chứng minh client gửi `price` lên cũng bị BỎ QUA.
 *
 * ⚠️ BA SCHEMA KHÔNG DÙNG `.strict()`: khoá lạ bị Zod CẮT (bỏ qua im lặng), KHÔNG bị từ chối.
 *   Đây là chủ ý để client cũ không vỡ. Test khoá đúng hành vi đó — để nếu ai đó đổi sang
 *   `.strict()`, suite chuyển đỏ ngay.
 *
 * ℹ️ KHÔNG có ràng buộc SỐ/lượng nào trong ba schema này: thứ duy nhất có khoảng là ĐỘ DÀI CHUỖI
 *   của `itemId` (1..120). Vì vậy "biên số" ở đây là biên độ dài, không phải một trường số lượng.
 */

import { describe, expect, it } from 'vitest';

import {
  buyItemRequestSchema,
  equipItemRequestSchema,
  feedPetRequestSchema,
} from '@shared/schemas/reward.js';

// =============================================================================
// `buyItemRequestSchema` — mua một vật phẩm
// =============================================================================

describe('buyItemRequestSchema — định danh vật phẩm', () => {
  it('nhận một yêu cầu mua hợp lệ và giữ nguyên itemId', () => {
    const parsed = buyItemRequestSchema.parse({ itemId: 'acc-crown' });

    expect(parsed).toEqual({ itemId: 'acc-crown' });
  });

  it('thiếu itemId bị từ chối', () => {
    expect(buyItemRequestSchema.safeParse({}).success).toBe(false);
  });

  it('itemId không phải chuỗi bị từ chối', () => {
    expect(buyItemRequestSchema.safeParse({ itemId: 123 }).success).toBe(false);
    expect(buyItemRequestSchema.safeParse({ itemId: null }).success).toBe(false);
  });

  /**
   * ⚠️ `itemId` là khoá chính được lập chỉ mục của bảng `inventory`. Một khoá RỖNG ghi vào DB là
   *   dữ liệu rác không tra lại được. `.trim()` chạy TRƯỚC `.min(1)` nên chuỗi toàn khoảng trắng
   *   cũng bị coi là rỗng và bị từ chối.
   */
  it('itemId rỗng hoặc toàn khoảng trắng bị từ chối', () => {
    expect(buyItemRequestSchema.safeParse({ itemId: '' }).success).toBe(false);
    expect(buyItemRequestSchema.safeParse({ itemId: '   ' }).success).toBe(false);
  });

  it('biên độ dài: 1 và 120 nhận; 0 và 121 bị từ chối', () => {
    const len120 = 'a'.repeat(120);
    const len121 = 'a'.repeat(121);

    expect(buyItemRequestSchema.safeParse({ itemId: 'a' }).success).toBe(true);
    expect(buyItemRequestSchema.safeParse({ itemId: len120 }).success).toBe(true);
    expect(buyItemRequestSchema.safeParse({ itemId: len121 }).success).toBe(false);
  });
});

describe('buyItemRequestSchema — GIÁ do client gửi lên bị bỏ qua', () => {
  /**
   * ⭐⭐ TEST CHỐNG GIAN LẬN QUAN TRỌNG NHẤT CỦA TỆP NÀY: client gửi kèm `price`/`currency`
   *   nhưng schema chỉ nhận `itemId`, phần còn lại bị cắt. Server vì thế LUÔN trừ theo giá trong
   *   JSON, không theo con số client đưa.
   */
  it('khoá giá/tiền tệ bị CẮT khỏi kết quả', () => {
    const parsed = buyItemRequestSchema.parse({
      itemId: 'acc-crown',
      price: 1,
      currency: 'stars',
    });

    expect(parsed).toEqual({ itemId: 'acc-crown' });
    expect('price' in parsed).toBe(false);
    expect('currency' in parsed).toBe(false);
  });
});

// =============================================================================
// `feedPetRequestSchema` — cho thú cưng ăn
// =============================================================================

describe('feedPetRequestSchema — cùng hợp đồng itemId', () => {
  /**
   * ⚠️ Vì `feedPetRequestSchema` dùng CHUNG `itemIdSchema` với `buyItemRequestSchema`, hai schema
   *   có thể lệch nhau nếu ai đó gỡ ràng buộc ở một bên. Test song song hai bên để chặn lệch.
   */
  it('nhận itemId hợp lệ', () => {
    expect(feedPetRequestSchema.parse({ itemId: 'food-apple' })).toEqual({ itemId: 'food-apple' });
  });

  it('thiếu itemId bị từ chối', () => {
    expect(feedPetRequestSchema.safeParse({}).success).toBe(false);
  });

  it('itemId rỗng bị từ chối (nhất quán với buyItem)', () => {
    expect(feedPetRequestSchema.safeParse({ itemId: '' }).success).toBe(false);
    expect(feedPetRequestSchema.safeParse({ itemId: '  ' }).success).toBe(false);
  });
});

// =============================================================================
// `equipItemRequestSchema` — mặc / bỏ ra
// =============================================================================

describe('equipItemRequestSchema — trạng thái mặc', () => {
  it('nhận equipped true và false, giữ NGUYÊN giá trị', () => {
    expect(equipItemRequestSchema.parse({ equipped: true })).toEqual({ equipped: true });
    expect(equipItemRequestSchema.parse({ equipped: false })).toEqual({ equipped: false });
  });

  it('false phải SỐNG SÓT (không bị biến thành true)', () => {
    expect(equipItemRequestSchema.parse({ equipped: false }).equipped).toBe(false);
  });

  it('thiếu equipped bị từ chối', () => {
    expect(equipItemRequestSchema.safeParse({}).success).toBe(false);
  });

  it('equipped không phải boolean bị từ chối', () => {
    expect(equipItemRequestSchema.safeParse({ equipped: 1 }).success).toBe(false);
    expect(equipItemRequestSchema.safeParse({ equipped: 'true' }).success).toBe(false);
  });

  /**
   * ⭐⚠️ ĐỊNH DANH ĐI THEO ĐƯỜNG DẪN, KHÔNG THEO BODY: đường dẫn `…/inventory/:itemId/equip` đã
   *   nói đang mặc món nào, nên body cố tình KHÔNG có `itemId`. Một client cũ lỡ gửi `itemId` trong
   *   body phải bị BỎ QUA — không được phép ghi đè đường dẫn, nếu không hai nguồn "món nào" sẽ
   *   tranh chấp và mặc nhầm món tuỳ thứ tự đọc.
   */
  it('itemId trong body bị CẮT (định danh theo đường dẫn thắng)', () => {
    const parsed = equipItemRequestSchema.parse({ itemId: 'acc-crown', equipped: true });

    expect(parsed).toEqual({ equipped: true });
    expect('itemId' in parsed).toBe(false);
  });
});
