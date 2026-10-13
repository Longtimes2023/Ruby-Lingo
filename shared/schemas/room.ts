import { z } from 'zod';

const placementSchema = z.object({
  itemId: z.string().trim().min(1).max(120),
  x: z.number().finite().min(0).max(100),
  y: z.number().finite().min(0).max(100),
  hidden: z.boolean(),
});

/**
 * Danh sách vật thể bé đặt tự do trong phòng (đồ trang trí + phụ kiện).
 *
 * ⭐ TRẦN 20 = 10 ĐỒ TRANG TRÍ + 10 PHỤ KIỆN, và đây là một con số của DANH MỤC chứ không của
 *   giao diện: `shared/content/shop-items.json` có đúng 10 món `decoration` và 10 món `accessory`.
 *   Trần cũ là 10 — vừa đủ cho đồ trang trí — nên khi phụ kiện cũng được kéo thả tự do (chủ dự án
 *   chốt: tách phụ kiện ra khỏi "mặc lên người", để bé tự đặt), đặt đủ 10 trang trí rồi thì món
 *   phụ kiện thứ nhất bị schema từ chối ⇒ server trả 400 và cả lần lưu hỏng, dù bé không làm gì sai.
 *   Nâng lên 20 để hai nhóm cùng nằm được. Nếu danh mục lớn hơn số này, schema phải nâng theo —
 *   nhưng KHÔNG nâng lên vô cực: trần là thứ chặn một request gõ tay nhét vào hàng nghìn dòng.
 *
 * ⚠️ BẢNG LƯU VẪN TÊN `room_decoration_placement` (migration `012_room_placement.sql`) — TÊN CÓ
 *   CHỮ "decoration" LÀ DI SẢN, KHÔNG PHẢI LỖI. Khoá chính `(child_id, item_id)` đã chứa được cả
 *   id `acc-*`, nên phụ kiện dùng lại đúng bảng đó. ĐỔI TÊN BẢNG là một migration rủi ro không đem
 *   lại giá trị gì — xem ghi chú cùng chủ đề ở `server/services/RoomService.ts`.
 */
export const ROOM_PLACEMENT_LIMIT = 20;

export const roomPlacementsSchema = z
  .array(placementSchema)
  .max(ROOM_PLACEMENT_LIMIT)
  .refine((placements) => new Set(placements.map(({ itemId }) => itemId)).size === placements.length, {
    message: 'Trang trí không được lặp lại',
  });

export type RoomPlacement = z.infer<typeof placementSchema>;
export type RoomPlacements = z.infer<typeof roomPlacementsSchema>;
