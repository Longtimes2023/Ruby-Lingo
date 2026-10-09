/**
 * RubyLingo — Routes tiến độ: `/api/children/:id/progress**` và `/api/children/:id/game-result`.
 *
 * ⭐ BA ENDPOINT, ĐÚNG BA CHIỀU:
 *   `GET  /api/children/:id/progress`       — đọc ảnh chụp (lần đầu mở app, hoặc sau khi cài lại)
 *   `POST /api/children/:id/progress/sync`  — gửi sự kiện lên, nhận ảnh chụp đã gộp
 *   `POST /api/children/:id/game-result`    — gửi MỘT LƯỢT CHƠI GAME đã kết thúc, nhận thưởng
 *
 * ⚠️ VÌ SAO `game-result` KHÔNG ĐI QUA `/progress/sync`:
 *    `sync` nhận một LÔ sự kiện rời rạc, mỗi sự kiện là một câu trả lời độc lập. Nhưng một
 *    LƯỢT CHƠI là một đơn vị có nghĩa: điểm và sao được tính từ TOÀN BỘ các câu cùng nhau
 *    (chuỗi đúng liên tiếp, tỉ lệ đúng ngay lần đầu). Không thể chấm điểm một lượt chơi bằng
 *    cách cộng dồn từng câu rời — nên nó phải là request riêng, mang theo cả lượt chơi, và
 *    được chấm ở `GameResultService` (T049).
 *
 * ⚠️ KHÔNG CÓ `PUT` NHẬN ẢNH CHỤP TỪ CLIENT — đây là quyết định thiết kế, không phải thiếu sót.
 *    Xem ghi chú đầy đủ ở cuối `shared/schemas/progress.ts`.
 *
 * ⚠️ MỌI ROUTE ĐỀU `preHandler: requireParent`.
 *    Nhưng đăng nhập CHƯA ĐỦ: `:id` nằm trong URL nên phụ huynh A có thể gửi id của bé nhà
 *    phụ huynh B. `ProgressService.requireChild()` / `ChildService.getChild()` kiểm `parent_id`
 *    trong MỌI phương thức. Ở tầng route KHÔNG cần kiểm lại — nhưng cũng KHÔNG được gọi thẳng
 *    DB ở đây.
 *
 * ⚠️ `childId` DO CLIENT GỬI KHÔNG BAO GIỜ ĐƯỢC TIN.
 *    Không có trường `childId` nào trong body được dùng để quyết định ghi vào hồ sơ nào. Bé
 *    luôn được suy ra từ `:id` trong URL + `parent_id` của phiên đăng nhập.
 */

import type { FastifyInstance } from 'fastify';

import type {
  ApiOk,
  ProgressGetResponse,
  ProgressSyncRequest,
  ProgressSyncResponse,
  SubmitGameResultRequest,
  SubmitGameResultResponse,
} from '../../shared/types/api.js';
import { progressSyncRequestSchema } from '../../shared/schemas/progress.js';
import { gameResultSubmissionSchema } from '../../shared/schemas/progress.js';
import { progressService } from '../services/ProgressService.js';
import { gameResultService } from '../services/GameResultService.js';
import { childIdFromParams } from '../lib/params.js';
import { requireParent, type AuthedRequest } from '../plugins/auth.js';

export async function progressRoutes(app: FastifyInstance): Promise<void> {
  // --- Đọc ảnh chụp tiến độ ---------------------------------------------
  app.get('/api/children/:id/progress', { preHandler: requireParent }, async (req, reply) => {
    const authed = req as AuthedRequest;
    const query = req.query as { since?: string };
    // `since` chỉ được dùng để LỌC BỚT dữ liệu trả về, không ảnh hưởng quyền hay nội dung.
    // Một giá trị rác chỉ làm kết quả rộng hơn (lấy nhiều hơn), không phải lỗi bảo mật.
    const since = typeof query.since === 'string' && query.since !== '' ? query.since : null;

    const body: ApiOk<ProgressGetResponse> = {
      data: progressService.getSnapshot(authed.parent.id, childIdFromParams(req), since),
    };
    return reply.send(body);
  });

  // --- Đồng bộ sự kiện ---------------------------------------------------
  app.post('/api/children/:id/progress/sync', { preHandler: requireParent }, async (req, reply) => {
    const authed = req as AuthedRequest;
    // Parse ở tầng route để lỗi trả về có `fields` chỉ rõ trường sai — service parse lại lần
    // nữa để bảo vệ các đường gọi khác (test, script). Xem ghi chú ở `ChildService`.
    const input = progressSyncRequestSchema.parse(req.body) as ProgressSyncRequest;

    const result: ProgressSyncResponse = progressService.sync(
      authed.parent.id,
      childIdFromParams(req),
      input,
    );

    const body: ApiOk<ProgressSyncResponse> = { data: result };
    return reply.send(body);
  });

  // --- Ghi kết quả một LƯỢT CHƠI GAME -----------------------------------
  /**
   * ⭐⭐ CLIENT GỬI "SỰ THẬT THÔ", SERVER TỰ CHẤM ĐIỂM.
   *
   *   Body (`SubmitGameResultRequest`) chỉ có: ván này mấy câu, mỗi câu là từ nào, có đúng
   *   ngay lần đầu không, đã thử sai mấy lần. Nó **KHÔNG** có trường `score` hay `stars` — và
   *   đó là chủ ý. Server chấm điểm từ dữ liệu thô bằng chính hàm ở `shared/game-scoring.ts`
   *   mà client dùng để hiện kết quả ngay. Client muốn "3 sao" cũng không có đường khai.
   *
   * ⚠️ LŨY ĐẲNG THEO `clientEventId`: gửi lại cùng một lượt chơi KHÔNG cộng thêm gì. Đây là
   *    kịch bản THẬT (phản hồi mất trên đường về sau khi mất mạng), không phải ca hiếm. Cổng
   *    này sống chung với tính CỘNG DỒN của `daily_stats` — thiếu nó thì số liệu phồng lên mỗi
   *    lần gửi lại, vĩnh viễn và không cách nào phát hiện. Xem `GameResultService`.
   */
  app.post('/api/children/:id/game-result', { preHandler: requireParent }, async (req, reply) => {
    const authed = req as AuthedRequest;
    // Parse ở tầng route để lỗi trả về có `fields` chỉ rõ trường sai; service parse lại lần
    // nữa để bảo vệ các đường gọi khác (test, script). Xem ghi chú ở `ChildService`.
    const input = gameResultSubmissionSchema.parse(req.body) as SubmitGameResultRequest;

    const award: SubmitGameResultResponse = gameResultService.submit(
      authed.parent.id,
      childIdFromParams(req),
      input,
    );

    const body: ApiOk<SubmitGameResultResponse> = { data: award };
    return reply.send(body);
  });
}
