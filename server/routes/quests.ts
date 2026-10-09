/**
 * RubyLingo — Routes NHIỆM VỤ: `/api/children/:id/quests` (T059).
 *
 * ⭐ HAI ENDPOINT, HAI VIỆC KHÁC HẲN NHAU:
 *   `GET  /api/children/:id/quests`                    — danh sách nhiệm vụ + chuỗi ngày + khoá kỳ
 *   `POST /api/children/:id/quests/:questId/claim`     — bé bấm "Nhận thưởng"
 *
 * ⚠️ MỌI ROUTE ĐỀU `preHandler: requireParent`, VÀ ĐĂNG NHẬP LÀ CHƯA ĐỦ.
 *    `:id` nằm trong URL nên phụ huynh A có thể gửi id của bé nhà phụ huynh B. `QuestService` kiểm
 *    `parent_id` trong cả hai phương thức công khai (qua `requireChild`). Tầng route KHÔNG kiểm
 *    lại — nhưng cũng KHÔNG được gọi thẳng DB ở đây, vì như vậy là tạo con đường thứ hai bỏ qua
 *    phép kiểm ấy.
 *
 * ⚠️ VÌ SAO `POST …/claim` KHÔNG CÓ BODY — VÀ ĐÂY LÀ ĐIỀU QUAN TRỌNG NHẤT CỦA FILE NÀY.
 *    Bé bấm "Nhận thưởng" ⇒ đúng nghĩa là client chỉ được phép nói *"bé muốn nhận nhiệm vụ qd-01"*.
 *    Nó KHÔNG được nói bé đã làm được gì, cũng không được nói bé nhận bao nhiêu:
 *      • Tiến độ và trạng thái "xong" do server tự tính từ dữ liệu đã ghi
 *        (`lesson_progress`, `daily_stats`, `progress_event`, ví, XP) — xem `effectiveState()`.
 *      • Số quà do `shared/content/quests.json` quyết định, không có trường nào để client điền.
 *    Nếu route này nhận `{ completed: true }` hay `{ stars: 100 }`, bé chỉ cần gửi một request là
 *    xong. Đúng thứ kiến trúc "server là trọng tài cuối" sinh ra để chặn.
 *    Hệ quả có chủ ý: KHÔNG có `shared/schemas/quest.ts`, và `req.body` không được đọc ở đây —
 *    một schema rỗng vẫn là một chỗ để sau này ai đó thêm trường vào.
 *
 * ⚠️ `GET` LÀ MỘT THAO TÁC CHỈ-ĐỌC — NÓ KHÔNG ĐƯỢC GHI VÀO DB.
 *    Client gọi route này mỗi lần mở màn hình Nhiệm vụ (và mỗi lần app quay lại tiền cảnh). Vì
 *    `readForChild()` tính tiến độ hiệu dụng = `max(hàng đã lưu, giá trị suy diễn)` mà KHÔNG ghi,
 *    màn hình vẫn đúng kể cả khi hàng `quest_progress` chưa từng tồn tại. Nếu ở đây ta "tiện thể"
 *    ghi hàng, thì mở app là dữ liệu đã đổi: mọi lần đồng bộ sau đó đều thấy "có gì đó mới", và ta
 *    mất khả năng phân biệt "bé vừa làm gì" với "bé vừa mở app". Cùng lý do như `GET /rewards`.
 *
 * ⚠️ VÌ SAO `ALREADY_CLAIMED` (409) KHÔNG PHẢI LÀ MỘT LỖI ĐÁNG SỢ VỚI CLIENT:
 *    Bé bấm nút hai lần, hoặc mạng chập chờn rồi client gửi lại — đó là hành vi BÌNH THƯỜNG của
 *    trẻ 7 tuổi, không phải tấn công. Cổng chống nhận hai lần nằm trong câu `UPDATE`
 *    (`AND claimed = 0`, xem `QuestService.claim`), nên lần bấm thứ hai KHÔNG trao thêm quà và
 *    trả 409. Tầng client (T060) PHẢI coi mã `ALREADY_CLAIMED` là "bé đã nhận rồi" và chuyển nút
 *    sang trạng thái đã nhận — KHÔNG được hiện một màn hình lỗi, vì bé không làm gì sai cả.
 */

import type { FastifyInstance } from 'fastify';

import type { ApiOk, ClaimQuestResponse, QuestsGetResponse } from '../../shared/types/api.js';
import { questService } from '../services/QuestService.js';
import { childIdFromParams, questIdFromParams } from '../lib/params.js';
import { requireParent, type AuthedRequest } from '../plugins/auth.js';

export async function questsRoutes(app: FastifyInstance): Promise<void> {
  // --- Đọc danh sách nhiệm vụ ---------------------------------------------
  app.get('/api/children/:id/quests', { preHandler: requireParent }, async (req, reply) => {
    const authed = req as AuthedRequest;
    const body: ApiOk<QuestsGetResponse> = {
      data: questService.listForChild(authed.parent.id, childIdFromParams(req)),
    };
    return reply.send(body);
  });

  // --- Nhận thưởng nhiệm vụ ------------------------------------------------
  /**
   * ⚠️ `async` không cần thiết về mặt kỹ thuật (`QuestService.claim` là hàm ĐỒNG BỘ — nó tự mở
   *    transaction qua `transaction()` của better-sqlite3). Giữ `async` để hình dạng handler
   *    giống mọi route khác; nhưng nếu có ai chuyển sang `await` một việc gì đó ở đây thì phải
   *    hiểu rằng transaction đã đóng xong trước khi handler trả về.
   *
   * ⚠️ KHÔNG trả 201. Không có tài nguyên mới nào được tạo ra cho client — hàng `quest_progress`
   *    là chi tiết bên trong, và cửa hàng `/shop/buy` (nơi có vật phẩm thật sự vào túi) cũng trả
   *    200. Trả 201 ở đây sẽ khiến tầng client phải nhớ một luật riêng cho một route.
   */
  app.post(
    '/api/children/:id/quests/:questId/claim',
    { preHandler: requireParent },
    async (req, reply) => {
      const authed = req as AuthedRequest;
      const body: ApiOk<ClaimQuestResponse> = {
        data: questService.claim(
          authed.parent.id,
          childIdFromParams(req),
          questIdFromParams(req),
        ),
      };
      return reply.send(body);
    },
  );
}
