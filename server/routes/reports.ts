/**
 * RubyLingo — Routes BÁO CÁO PHỤ HUYNH: `/api/children/:id/report` (T073).
 *
 * ⭐ MỘT ENDPOINT, BA TẦNG BẢO VỆ — và cả ba đều BẮT BUỘC:
 *   1. `requireParent`      — phải đăng nhập.
 *   2. `requireParentGate`  — phải đã qua CỔNG PIN (T072). Kiến trúc xếp báo cáo vào nhóm endpoint
 *      phụ huynh cần cổng: đây là dữ liệu về con, không phải màn hình của bé.
 *   3. **SỞ HỮU** (`parent_id` của bé) — nằm trong `ReportService.getReport` (gọi `ChildService`),
 *      đúng như MỌI service khác của dự án. Tầng route KHÔNG kiểm lại, nhưng cũng KHÔNG được gọi
 *      thẳng DB ở đây: chỉ kiểm "bé có tồn tại" là một phụ huynh đọc được dữ liệu con nhà khác.
 *
 * ⚠️ `requireParentGate` được IMPORT từ `routes/parent.ts` — không viết lại. Cổng PIN là MỘT luật,
 *    khai một lần; một bản sao thứ hai sẽ lệch đúng lúc cổng đổi cách hoạt động.
 */

import type { FastifyInstance } from 'fastify';

import type { ApiOk, ReportResponse } from '../../shared/types/api.js';
import { reportQuerySchema } from '../../shared/schemas/report.js';
import { childIdFromParams } from '../lib/params.js';
import { requireParent, type AuthedRequest } from '../plugins/auth.js';
import { requireParentGate } from './parent.js';
import { reportService } from '../services/ReportService.js';

export async function reportsRoutes(app: FastifyInstance): Promise<void> {
  // --- Báo cáo tuần của một bé ------------------------------------------
  /**
   * `?from=YYYY-MM-DD&to=YYYY-MM-DD` — cả hai TUỲ CHỌN; thiếu thì service dùng khoảng mặc định
   * (một tuần, kết thúc ở hôm nay). `to` BAO GỒM ngày cuối. Xem `ReportService.resolveRange`.
   *
   * ⚠️ Parse ở tầng route để lỗi trả về có `fields`; service parse lại lần nữa (cùng schema) —
   *    xem ghi chú ở `ChildService`.
   */
  app.get(
    '/api/children/:id/report',
    { preHandler: [requireParent, requireParentGate] },
    async (req, reply) => {
      const authed = req as AuthedRequest;
      const query = reportQuerySchema.parse(req.query);

      const body: ApiOk<ReportResponse> = {
        data: reportService.getReport(authed.parent.id, childIdFromParams(req), query),
      };
      return reply.send(body);
    },
  );
}
