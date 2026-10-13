import { describe, expect, it } from 'vitest';
import { ROOM_PLACEMENT_LIMIT, roomPlacementsSchema } from '../../../shared/schemas/room.js';

/**
 * Dựng `count` phần tử ĐÚNG LOẠI ĐẶT ĐƯỢC (`acc-*` / `dec-*`), `itemId` KHÁC NHAU.
 *
 * ⚠️ VÌ SAO KHÔNG LẤY `food-*` LÀM MÓN THỨ 21: `food` bị `RoomService` chặn bằng một luật KHÁC
 *   (không phải luật trần) ⇒ một test trộn lẫn hai luật sẽ xanh ngay cả khi trần đã bị bỏ. Test
 *   này phải cô lập đúng MỘT luật: trần `ROOM_PLACEMENT_LIMIT`.
 */
function placements(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    itemId: index % 2 === 0 ? `acc-${index}` : `dec-${index}`,
    x: 0,
    y: 0,
    hidden: false,
  }));
}

describe('roomPlacementsSchema', () => {
  it('接受有效的百分比画布位置与隐藏状态', () => {
    expect(roomPlacementsSchema.parse([{ itemId: 'dec-plant', x: 100, y: 0, hidden: true }])).toEqual([
      { itemId: 'dec-plant', x: 100, y: 0, hidden: true },
    ]);
  });

  it('拒绝越界坐标、重复物品和未知字段以外的错误形状', () => {
    expect(roomPlacementsSchema.safeParse([{ itemId: 'dec-plant', x: 101, y: 10, hidden: false }]).success).toBe(false);
    expect(roomPlacementsSchema.safeParse([
      { itemId: 'dec-plant', x: 1, y: 2, hidden: false },
      { itemId: 'dec-plant', x: 3, y: 4, hidden: false },
    ]).success).toBe(false);
  });

  it('⚠️ 恰好 20 项 (10 acc + 10 dec) 通过；21 项 CÙNG LOẠI bị từ chối vì VƯỢT TRẦN', () => {
    /*
      ⚠️ ĐÂY LÀ CHỖ DUY NHẤT CHỨNG MINH ĐƯỢC TRẦN 20.
      Danh mục thật (`shop-items.json`) chỉ có đúng 20 món KHÔNG-phải-đồ-ăn (10 `decoration` +
      10 `accessory`), nên KHÔNG THỂ chứng minh trần này qua HTTP: request 21 món buộc phải dùng
      thêm một món `food-*`, mà `food` đã bị `RoomService` chặn bằng luật riêng ⇒ nhánh 400 đó
      xanh kể cả khi `.max(20)` bị gỡ. Test tầng schema hỏi thẳng schema, nên cô lập được luật trần.
    */
    expect(ROOM_PLACEMENT_LIMIT).toBe(20);
    expect(roomPlacementsSchema.safeParse(placements(20)).success).toBe(true);
    // 21 phần tử `acc-*`/`dec-*` KHÁC NHAU — không có `food`, không trùng id ⇒ chỉ vượt trần.
    expect(roomPlacementsSchema.safeParse(placements(21)).success).toBe(false);
  });
});
