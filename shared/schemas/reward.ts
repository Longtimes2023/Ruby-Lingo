/**
 * RubyLingo — Zod schema cho MIỀN THƯỞNG (ví, cửa hàng, cho ăn) — dùng chung client + server.
 *
 * ⚠️ ĐIỂM QUAN TRỌNG NHẤT CỦA FILE NÀY: NÓ **KHÔNG** CÓ TRƯỜNG GIÁ.
 *
 *   `buyItemRequestSchema` chỉ nhận `itemId`. Nó KHÔNG nhận `price`, KHÔNG nhận `currency`.
 *   Giá nằm ở `shared/content/shop-items.json` và server tự tra. Đây là cùng một nguyên tắc
 *   như `GameResultSubmission` (client gửi sự thật thô, server tự tính điểm):
 *   **client không bao giờ được nói cho server biết phải trừ bao nhiêu tiền của nó.**
 *
 *   Nếu để `price` trong hợp đồng, một client hỏng (hoặc một bé 9 tuổi biết mở DevTools) chỉ
 *   cần sửa một con số là mua được vương miện với 1 ⭐. Và vì ví là CỘNG DỒN, số dư sai đó ở
 *   lại vĩnh viễn — không có cách nào phân biệt với một bé thật sự đã kiếm được ngần ấy tiền.
 *
 *   Cách kiểm chứng điều này không nằm ở file này mà ở test: gửi kèm `price: 1` trong body và
 *   khẳng định server vẫn trừ ĐÚNG giá trong JSON. Xem `reward-routes.test.ts`.
 */

import { z } from 'zod';

/**
 * id vật phẩm. Là khoá chính của `inventory` và khoá tra trong `shop-items.json`, nên có giới
 * hạn độ dài: cột này được lập chỉ mục, và không có lý do gì để client nhét một chuỗi dài tuỳ
 * ý vào khoá chính.
 */
const itemIdSchema = z.string().trim().min(1, 'Thiếu mã vật phẩm').max(120, 'Mã vật phẩm quá dài');

/** `POST /api/children/:id/shop/buy` — mua một vật phẩm. */
export const buyItemRequestSchema = z.object({
  itemId: itemIdSchema,
});

export type BuyItemRequestInput = z.infer<typeof buyItemRequestSchema>;

/** `POST /api/children/:id/pet/feed` — cho thú cưng ăn một món đã sở hữu. */
export const feedPetRequestSchema = z.object({
  itemId: itemIdSchema,
});

export type FeedPetRequestInput = z.infer<typeof feedPetRequestSchema>;

/**
 * `POST /api/children/:id/inventory/:itemId/equip` — mặc / bỏ ra một vật phẩm đã sở hữu.
 *
 * ⚠️⚠️ Ở ĐÂY **KHÔNG CÓ** `itemId`, KHÁC VỚI BẢN THIẾT KẾ ĐẦU TIÊN.
 *
 *   `shared/types/api.ts` (viết từ T008) khai `EquipItemRequest { itemId, equipped }`, và
 *   `ARCHITECTURE.md` cũng ghi body là `{equipped: boolean}` trên một đường dẫn **đã có**
 *   `:itemId`. Tức là HAI chỗ cùng trả lời câu "đang nói tới món nào" — và khi chúng trả lời
 *   khác nhau thì không có đáp án đúng. Body `{ itemId: 'acc-crown' }` gửi tới đường dẫn
 *   `…/acc-bow/equip` là một cuộc tranh chấp chỉ chờ ai đó viết `??` hoặc `||` ở giữa, rồi mặc
 *   nhầm món tuỳ theo thứ tự đọc.
 *
 *   Nên: **định danh đi theo ĐƯỜNG DẪN**, đúng luật đã chốt ở `server/lib/params.ts` và đã áp
 *   cho `POST …/quests/:questId/claim`. Body chỉ còn ĐÚNG trạng thái muốn đặt.
 *
 *   `z.object` của Zod CẮT khoá lạ, nên một client cũ lỡ gửi kèm `itemId` sẽ bị bỏ qua HOÀN
 *   TOÀN, chứ không ghi đè đường dẫn. `reward-routes.test.ts` khoá đúng điều đó lại — cùng kiểu
 *   test với "GIÁ DO CLIENT GỬI LÊN BỊ BỎ QUA" ở `/shop/buy`.
 */
export const equipItemRequestSchema = z.object({
  equipped: z.boolean({
    required_error: 'Thiếu trạng thái mặc / bỏ ra',
    invalid_type_error: 'Trạng thái mặc / bỏ ra phải là đúng hay sai',
  }),
});

export type EquipItemRequestInput = z.infer<typeof equipItemRequestSchema>;
