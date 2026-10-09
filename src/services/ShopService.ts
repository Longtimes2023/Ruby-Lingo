/**
 * RubyLingo — `ShopService` (phía CLIENT): mua vật phẩm, cho ăn, mặc / bỏ ra, đổi bạn đồng hành.
 *
 * ⭐ NHIỆM VỤ DUY NHẤT, VÀ VÌ SAO NÓ ĐÁNG TỒN TẠI THÀNH MỘT TỆP RIÊNG:
 *   Gói `INSUFFICIENT_FUNDS` (HTTP 409) lại thành một **trạng thái bình thường**, không phải
 *   một lỗi. Bé mở cửa hàng, thấy chiếc nón 30 ⭐ trong khi ví còn 20 ⭐ — trên màn hình nút đã
 *   bị mờ (T064), nên đường tới đây là ví đã CŨ: bé vừa tiêu ở nơi khác, hoặc một thiết bị khác
 *   vừa mua hộ. Đó không phải hành vi sai của bé, và theo luật của dự án thì **KHÔNG BAO GIỜ
 *   MẮNG ĐỨA TRẺ**. Câu trả lời đúng là "Mình cùng học thêm nhé!" kèm ví đọc lại — không phải
 *   một banner báo hỏng.
 *
 *   Quyết định "409 này là bình thường" là một quyết định về MIỀN NGHIỆP VỤ, không phải về vận
 *   chuyển. Đặt nó ở đây — chứ không trong `endpoints.ts` (nơi chỉ nên biết HTTP) và không trong
 *   `shopStore.ts` (nơi chỉ nên biết trạng thái UI) — giữ cho cả hai chỗ kia không phải học một
 *   luật riêng của cửa hàng. Đây đúng là khuôn mẫu đã dùng cho `QuestService` (xem tệp đó).
 *
 * ⚠️ CHỈ CÓ **MỘT** MÃ ĐƯỢC DỊCH. MỌI MÃ KHÁC ĐƯỢC NÉM NGUYÊN VẸN.
 *   Nuốt tất cả (bắt `Error` chung chung) sẽ biến "mất mạng" thành "không đủ tiền" — bé bấm, màn
 *   hình bảo học thêm, mà thật ra chỉ là wifi chập. Tệ hơn: `ITEM_NOT_FOUND` có nghĩa là danh mục
 *   trong máy (`@shared/content/shop.js`) và danh mục của server đã lệch nhau — một lỗi lập trình
 *   thật, phải nổi lên chứ không được hoá trang thành một câu dễ thương.
 *
 * ⚠️ KHÔNG PHÂN LOẠI Ở `feedPet` / `setEquipped` — VÀ ĐÓ LÀ CHỦ Ý, KHÔNG PHẢI THIẾU SÓT:
 *   Hai hành động này KHÔNG CÓ nhánh 409 nào để dịch. Server đã trả **200 kèm trạng thái hiện
 *   có** cho mọi trường hợp "không có gì thay đổi": cho ăn lúc Momo đã no (❤️ = 5) và mặc lại món
 *   đang mặc đều là `UPDATE` đặt lại cùng giá trị — idempotent sẵn có của SQL. Xem
 *   `RewardService.feed` / `RewardService.equip`: luật "không lấy gì của bé mà không đổi lại được
 *   gì" nghĩa là cú bấm thừa KHÔNG trừ một đồng nào, nên không cần một kết quả đặc biệt để nói về
 *   nó. Thứ duy nhất còn ném ra là `VALIDATION_FAILED` ("Món này không cho ăn được") — và đó là
 *   lỗi giao diện (nút sai nhóm), không phải một tình huống của bé.
 *
 * ⚠️ HÀM Ở ĐÂY KHÔNG CHẠM VÀO STORE NÀO — cố ý: giống `QuestService`, chúng chỉ gọi mạng và
 *   phân loại kết quả. Nhờ vậy mỗi hàm là THUẦN theo nghĩa dễ kiểm nhất: cho một hàm gọi API giả,
 *   khẳng định đúng một điều. Việc cập nhật `shopStore` và đồng bộ ví là của `shopStore` — xem
 *   ghi chú đầu tệp đó.
 */

import type { EquipmentResult, FeedResult, PetState, PurchaseResult } from '@shared/types/reward.js';
import { ApiClientError } from '../api/client.js';
import { rewardsApi } from '../api/endpoints.js';

/**
 * Kết quả của một lần bé bấm "Mua".
 *
 * ⭐ VÌ SAO `notEnough` KHÔNG MANG THEO DỮ LIỆU VÍ:
 *   Khi server trả 409, nó KHÔNG trừ gì và KHÔNG trao gì — nên không có ví mới nào để trả về.
 *   Ta chỉ biết chắc một điều: ví trên màn hình đang CAO HƠN ví thật. Tầng gọi dùng đúng dữ kiện
 *   đó để đọc lại ví. Tự bịa một con số ở đây (ví dụ `stars - price`) là đoán mò: con số đúng chỉ
 *   server biết.
 */
export type BuyOutcome =
  | { status: 'bought'; result: PurchaseResult }
  | { status: 'notEnough' };

/**
 * Mua một vật phẩm. Trả `{ status: 'bought' }` khi server thật sự trừ tiền và trao đồ,
 * `{ status: 'notEnough' }` khi ví không đủ.
 *
 * ⚠️ KHÔNG gửi giá lên server — và không được gửi. `rewardsApi.buy` chỉ đẩy `{ itemId }`; server
 *    tra giá trong `shop-items.json` (xem ghi chú đầu `shared/schemas/reward.ts`). Thêm một
 *    trường `price` ở đây là mở đường cho client tự định giá món đồ của chính mình.
 */
export async function buyItem(childId: string, itemId: string): Promise<BuyOutcome> {
  try {
    const result = await rewardsApi.buy(childId, { itemId });
    return { status: 'bought', result };
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'INSUFFICIENT_FUNDS') {
      return { status: 'notEnough' };
    }
    throw error;
  }
}

/**
 * Cho thú cưng ăn một món ĐÃ SỞ HỮU. Trả về `FeedResult` nguyên vẹn.
 *
 * ⚠️ KHÔNG TRỪ TIỀN Ở BƯỚC NÀY — tiền đã trả lúc mua. Cho ăn chỉ tiêu 1 đơn vị trong túi và
 *    cộng ❤️. Vì vậy một cú bấm đúp có thể tiêu hai phần đồ ăn; đó là lý do `shopStore` khoá
 *    nút theo `itemId` ngay khi bé chạm (xem `shopStore`).
 */
export function feedPet(childId: string, itemId: string): Promise<FeedResult> {
  return rewardsApi.feed(childId, { itemId });
}

/**
 * Mặc / bỏ ra một vật phẩm đã sở hữu.
 *
 * ⚠️ `equipped` LÀ TRẠNG THÁI ĐÍCH, KHÔNG PHẢI LỆNH ĐẢO — và ta chuyển thẳng tham số ấy xuống
 *    server, không tự tính `!current`. Một client tự đảo (`equipped: !đang_mặc`) biến cú bấm đúp
 *    — hành vi hoàn toàn bình thường của trẻ 7 tuổi — thành "mặc rồi lại bỏ ra", và bé thấy món
 *    đồ nhấp nháy thay vì ở lại trên người Momo. Xem `RewardService.equip`.
 *
 * ⚠️ `itemId` ĐI TRÊN ĐƯỜNG DẪN, không nằm trong body — cùng lý do đã ghi ở
 *    `shared/schemas/reward.ts`: hai nguồn nói cùng một sự thật thì chỉ cần lệch một lần là mặc
 *    nhầm món.
 */
export function setEquipped(
  childId: string,
  itemId: string,
  equipped: boolean,
): Promise<EquipmentResult> {
  return rewardsApi.equip(childId, itemId, { equipped });
}

/**
 * Bé CHỌN / ĐỔI con thú cưng đồng hành (T04). Trả về `PetState` nguyên vẹn.
 *
 * ⚠️ KHÔNG BẮT LỖI, KHÔNG PHÂN LOẠI — VÀ ĐÓ LÀ CHỦ Ý, KHÁC HẲN `buyItem`.
 *   Ở đây **KHÔNG có nhánh 409 nào để dịch**: đổi bạn đồng hành là MIỄN PHÍ, không có giao dịch
 *   tiền, nên không tồn tại một kết quả "bình thường" nào mà server trả về dưới dạng lỗi. Thứ duy
 *   nhất có thể ném ra là lỗi thật (`VALIDATION_FAILED` khi id lạ, hoặc lỗi mạng). Nuốt lỗi ở đây
 *   (bắt `Error` chung chung) sẽ biến "mất mạng" thành "đã đổi con xong" — bé thấy màn chọn đóng
 *   lại, con vật KHÔNG đổi, và không ai biết vì sao.
 *
 * ⚠️ KHÔNG gửi giá lên server — và không được gửi. `rewardsApi.choosePet` chỉ đẩy `{ petType }`;
 *    server tự tra danh mục để kiểm id hợp lệ (xem ghi chú đầu `shared/content/pets.ts`).
 */
export function choosePet(childId: string, petType: string): Promise<PetState> {
  return rewardsApi.choosePet(childId, { petType });
}
