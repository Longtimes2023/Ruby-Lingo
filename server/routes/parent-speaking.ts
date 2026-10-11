/**
 * RubyLingo — Routes XÁC NHẬN PHẦN NÓI CỦA PHỤ HUYNH: `/api/children/:id/parent-speaking`.
 *
 * ⭐ HAI ENDPOINT, HAI CHIỀU:
 *   `GET /api/children/:id/parent-speaking` — trạng thái rubric 4 mục Nói hiện tại của bé.
 *   `PUT /api/children/:id/parent-speaking` — ghi đè (upsert) trạng thái 4 mục.
 *
 * ⚠️ BAO NGOÀI CHỈ `requireParent` — KHÔNG cổng PIN. Đây là quyết định theo nhóm endpoint của BÉ
 *    (`/room`, `/final-test`, `/progress`, `/rewards`), đúng như `routes/room.ts`. Quyền với bé
 *    CỤ THỂ do `ParentSpeakingService` kiểm qua `parent_id` (`ChildService.getChild`); tầng route
 *    KHÔNG kiểm lại và KHÔNG gọi DB. Phụ huynh khác ⇒ `CHILD_NOT_FOUND`.
 *    ⚠️ Ghi chú riêng (chỗ tài liệu mơ hồ): khối "Bài thi cuối khoá" trong BÁO CÁO cũng hiện dữ
 *       liệu này, mà báo cáo thì đi qua cổng PIN (`routes/reports.ts`). Ta chọn mô hình `room`
 *       như yêu cầu của người điều phối để nhất quán trong nhóm này; nếu sau này muốn siết, chỉ
 *       cần thêm `requireParentGate` vào mảng `preHandler` — service không phải đổi.
 *
 * ⚠️ Body của PUT CHỈ có `{ items: [{ id, done }] }`. KHÔNG có `childId` (đường dẫn đã có), KHÔNG
 *    có `updatedAt` (server tự đóng dấu). Cùng luật "một sự thật chỉ có MỘT chỗ khai".
 */

import type { FastifyInstance } from 'fastify';
import type {
  ApiOk,
  ParentSpeakingGetResponse,
  ParentSpeakingSaveRequest,
  ParentSpeakingSaveResponse,
} from '../../shared/types/api.js';
import { parentSpeakingSaveSchema } from '../../shared/schemas/parent-speaking.js';
import { childIdFromParams } from '../lib/params.js';
import { requireParent, type AuthedRequest } from '../plugins/auth.js';
import { parentSpeakingService } from '../services/ParentSpeakingService.js';

export async function parentSpeakingRoutes(app: FastifyInstance): Promise<void> {
  // --- Trạng thái xác nhận phần Nói hiện tại -----------------------------
  app.get('/api/children/:id/parent-speaking', { preHandler: requireParent }, async (req, reply) => {
    const authed = req as AuthedRequest;
    const body: ApiOk<ParentSpeakingGetResponse> = {
      data: parentSpeakingService.getState(authed.parent.id, childIdFromParams(req)),
    };
    return reply.send(body);
  });

  // --- Ghi đè trạng thái 4 mục Nói ---------------------------------------
  app.put('/api/children/:id/parent-speaking', { preHandler: requireParent }, async (req, reply) => {
    const authed = req as AuthedRequest;
    // Parse ở tầng route để lỗi trả về có `fields` chỉ rõ trường sai; service parse lại lần nữa
    // để bảo vệ các đường gọi khác (test, script). Xem ghi chú ở `ChildService`.
    const input: ParentSpeakingSaveRequest = parentSpeakingSaveSchema.parse(req.body);
    const body: ApiOk<ParentSpeakingSaveResponse> = {
      data: parentSpeakingService.saveState(authed.parent.id, childIdFromParams(req), input),
    };
    return reply.send(body);
  });
}
