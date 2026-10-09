/**
 * RubyLingo — Danh sách VỊ TRÍ của vật phẩm trên Momo (T065). **NGUỒN CHÂN LÝ DUY NHẤT.**
 *
 * ⚠️⚠️ VÌ SAO CẦN MỘT TỆP RIÊNG CHO HAI MẢNG NHỎ NHƯ VẬY:
 *   Cùng một danh sách này được HAI tầng dùng, ở hai thời điểm khác nhau:
 *     • `shared/schemas/content.ts` — lúc NẠP JSON: từ chối `shop-items.json` có phụ kiện thiếu
 *       `slot`, hoặc trang trí gắn `slot: 'head'`.
 *     • `shared/content/shop.ts` — lúc TRA CỨU: đổi `ShopItem.slot` (kiểu `PetSlot`) thành vị trí
 *       đã hẹp kiểu (`AccessorySlot` / `DecorationSlot`) cho `PetAvatar` vẽ.
 *   Nếu mỗi tầng tự khai một bản, ngày ai đó thêm vị trí `'tail'` vào một bản thì schema cho qua
 *   còn `PetAvatar` coi là không hợp lệ ⇒ món đồ **biến mất khỏi Momo** mà cả hai cổng đều xanh.
 *   Để ở tệp này thì không thể lệch: cùng một tham chiếu mảng.
 *
 *   Không đặt trong `shared/types/reward.ts` vì tệp đó là tệp KIỂU — mọi thứ trong đó bị `import
 *   type` xoá sạch lúc build, nên mảng ở đó sẽ không tồn tại lúc chạy.
 *
 * ⚠️ KHÔNG import `shared/content/shop.ts` từ đây và ngược lại: `shop.ts` đã import schema, mà
 *    schema import tệp này ⇒ vòng import. Tệp này phải là LÁ, không phụ thuộc gì lúc chạy.
 */

import type { AccessorySlot, DecorationSlot } from './types/reward.js';

/**
 * Vị trí GẮN phụ kiện lên người Momo, xếp theo THỨ TỰ VẼ từ sau ra trước.
 *
 * ⭐ Thứ tự trong mảng là thứ tự lớp (z-index), không phải thứ tự bảng chữ cái:
 *   `back` (áo choàng, cánh, ba lô) nằm SAU thân Momo; `feet` ngay dưới thân; rồi `head` (mũ,
 *   vương miện) và `neck` (khăn quàng) ở trên; `face` (kính) vẽ CUỐI CÙNG để luôn nằm trên mặt.
 *   Đổi thứ tự mảng này là đổi hình — nên nó nằm ở đây, có tên, chứ không phải một chỗ nào đó
 *   trong JSX.
 *
 * `satisfies` buộc mọi giá trị phải là thành viên của kiểu `AccessorySlot`: thêm một vị trí mới
 * vào mảng mà quên khai vào kiểu là **lỗi biên dịch**, không phải một giá trị lạc trôi tới UI.
 */
export const ACCESSORY_SLOTS = [
  'back',
  'feet',
  'head',
  'neck',
  'face',
] as const satisfies readonly AccessorySlot[];

/**
 * Vị trí BÀY trang trí quanh cảnh.
 *
 * ⭐ `sky` và `ground` là hai HÀNG ngang tự xuống dòng, không phải hai toạ độ tuyệt đối — xem
 *   ghi chú `DecorationSlot`. Thứ tự ở đây là thứ tự hiển thị từ trên xuống (bầu trời trước,
 *   mặt đất sau), cũng là thứ tự đọc của trình đọc màn hình.
 */
export const DECORATION_SLOTS = ['sky', 'ground'] as const satisfies readonly DecorationSlot[];
