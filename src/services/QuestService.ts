/**
 * RubyLingo — `QuestService` (phía CLIENT): đọc nhiệm vụ và nhận thưởng nhiệm vụ.
 *
 * ⭐ NHIỆM VỤ DUY NHẤT, VÀ VÌ SAO NÓ ĐÁNG TỒN TẠI THÀNH MỘT TỆP RIÊNG:
 *   Gói `ALREADY_CLAIMED` (HTTP 409) lại thành một **kết quả bình thường**. Server trả 409 khi
 *   hàng `quest_progress` đã có `claimed = 1` — nghĩa là bé (hoặc một lần gửi lại do mạng chập)
 *   đã nhận phần thưởng này rồi. Với một đứa trẻ 7 tuổi, bấm nút hai lần là hành vi BÌNH THƯỜNG,
 *   không phải tấn công và không phải lỗi.
 *
 *   Quyết định "409 này là bình thường" là một quyết định về MIỀN NGHIỆP VỤ, không phải về vận
 *   chuyển. Đặt nó ở đây — chứ không trong `endpoints.ts` (nơi chỉ nên biết HTTP) và không trong
 *   `questStore.ts` (nơi chỉ nên biết trạng thái UI) — giữ cho cả hai chỗ kia không phải học một
 *   luật riêng của nhiệm vụ.
 *
 * ⚠️ HÀM Ở ĐÂY KHÔNG CHẠM VÀO STORE NÀO — cố ý:
 *   `claimQuest` chỉ gọi mạng và phân loại kết quả. Nhờ vậy nó là hàm THUẦN theo nghĩa dễ kiểm
 *   nhất: cho một hàm gọi API giả, khẳng định đúng một điều. Việc cập nhật `questStore` và đồng
 *   bộ ví là của `questStore.claim()` — xem ghi chú đầu tệp đó.
 */

import type { ClaimQuestResponse, QuestsGetResponse } from '@shared/types/api.js';
import { ApiClientError } from '../api/client.js';
import { questsApi } from '../api/endpoints.js';

/**
 * Kết quả của một lần bé bấm "Nhận thưởng".
 *
 * ⭐ VÌ SAO `already` KHÔNG MANG THEO DỮ LIỆU QUÀ:
 *   Khi server trả 409, nó KHÔNG trao thêm gì — nên không có `wallet`/`xp` mới để trả về. Ta chỉ
 *   biết chắc một điều: nhiệm vụ này đã ở trạng thái "đã nhận". Tầng gọi dùng đúng một dữ kiện
 *   đó để chuyển nút sang trạng thái đã nhận. Bịa thêm dữ liệu ở đây sẽ là đoán mò.
 */
export type ClaimOutcome =
  | { status: 'claimed'; result: ClaimQuestResponse }
  | { status: 'already' };

/** Đọc danh sách nhiệm vụ kèm tiến độ. Chỉ đọc — server không ghi gì (xem `routes/quests.ts`). */
export function loadQuests(childId: string): Promise<QuestsGetResponse> {
  return questsApi.get(childId);
}

/**
 * Bé bấm "Nhận thưởng" một nhiệm vụ.
 *
 * Trả `{ status: 'claimed' }` khi server thật sự trao quà, `{ status: 'already' }` khi nhiệm vụ
 * đã được nhận từ trước. **Mọi lỗi khác đều được ném ra nguyên vẹn** — không được nuốt chúng:
 * mất mạng, `QUEST_NOT_COMPLETE`, `QUEST_NOT_FOUND` đều là những tình huống mà tầng gọi cần biết
 * để xử lý khác nhau (ví dụ `QUEST_NOT_COMPLETE` nghĩa là danh sách trên màn hình đã cũ).
 */
export async function claimQuest(childId: string, questId: string): Promise<ClaimOutcome> {
  try {
    const result = await questsApi.claim(childId, questId);
    return { status: 'claimed', result };
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'ALREADY_CLAIMED') {
      return { status: 'already' };
    }
    throw error;
  }
}
