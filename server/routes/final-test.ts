/**
 * RubyLingo — Routes bài thi cuối khoá: `/api/children/:id/final-test**`.
 *
 * ⭐ BA ENDPOINT, BA CHIỀU:
 *   `GET  /api/children/:id/final-test`                 — trạng thái cổng + tiến độ + kết quả đã có.
 *   `POST /api/children/:id/final-test/:section/submit` — nộp MỘT phần, server tự chấm + trao thưởng.
 *   `PUT  /api/children/:id/final-test/progress`        — lưu tiến độ ĐANG DỞ (đổi máy làm tiếp).
 *
 * ⚠️ `:section` NẰM TRÊN ĐƯỜNG DẪN, KHÔNG Ở TRONG BODY.
 *    Body nộp bài CHỈ chứa sự thật thô (`clientEventId`, `occurredAt`, `answers[]`). Không có
 *    `section`, không có `shields`/`score`. Cùng lối như `:itemId` ở route `equip` — một sự thật
 *    chỉ có MỘT chỗ khai. Xem ghi chú đầu `shared/schemas/final-test-api.ts`.
 *
 * ⚠️ MỌI ROUTE ĐỀU `preHandler: requireParent`. Nhưng đăng nhập CHƯA ĐỦ: `:id` nằm trong URL nên
 *    phụ huynh A có thể gửi id của bé nhà phụ huynh B. Quyền với bé CỤ THỂ do `FinalTestService`
 *    kiểm (`ChildService.getChild` → `parent_id`), đúng như MỌI service khác. Tầng route KHÔNG
 *    kiểm lại, cũng KHÔNG gọi DB.
 *
 * ⚠️ Cổng chưa mở ⇒ `FINAL_TEST_LOCKED` (409), do SERVICE ném (server là trọng tài cuối; client
 *    chỉ là rào UX). Route không tự quyết định "mở" hay "khoá".
 */

import type { FastifyInstance } from 'fastify';
import type {
  ApiOk,
  FinalTestGetResponse,
  FinalTestProgressSaveResponse,
  FinalTestSubmitResponse,
} from '../../shared/types/api.js';
import {
  finalTestProgressSaveSchema,
  finalTestSubmissionSchema,
} from '../../shared/schemas/final-test-api.js';
import { finalTestSectionIdSchema } from '../../shared/schemas/final-test.js';
import { childIdFromParams, finalTestSectionFromParams } from '../lib/params.js';
import { requireParent, type AuthedRequest } from '../plugins/auth.js';
import { finalTestService } from '../services/FinalTestService.js';

export async function finalTestRoutes(app: FastifyInstance): Promise<void> {
  // --- Trạng thái khu vực thi -------------------------------------------
  /**
   * Chỉ `requireParent` (KHÔNG cổng PIN): đây là màn của BÉ, cùng nhóm với `/progress` và
   * `/rewards`. Cổng PIN dành cho BÁO CÁO PHỤ HUYNH — xem `routes/reports.ts`.
   */
  app.get('/api/children/:id/final-test', { preHandler: requireParent }, async (req, reply) => {
    const authed = req as AuthedRequest;
    const body: ApiOk<FinalTestGetResponse> = {
      data: finalTestService.getState(authed.parent.id, childIdFromParams(req)),
    };
    return reply.send(body);
  });

  // --- Nộp MỘT phần thi --------------------------------------------------
  app.post(
    '/api/children/:id/final-test/:section/submit',
    { preHandler: requireParent },
    async (req, reply) => {
      const authed = req as AuthedRequest;
      // Parse ở tầng route để lỗi trả về có `fields` chỉ rõ trường sai; service parse lại lần nữa
      // để bảo vệ các đường gọi khác (test, script). Xem ghi chú ở `ChildService`.
      const section = finalTestSectionIdSchema.parse(finalTestSectionFromParams(req));
      const input = finalTestSubmissionSchema.parse(req.body);

      const body: ApiOk<FinalTestSubmitResponse> = {
        data: finalTestService.submit(authed.parent.id, childIdFromParams(req), section, input),
      };
      return reply.send(body);
    },
  );

  // --- Lưu tiến độ đang dở ----------------------------------------------
  app.put(
    '/api/children/:id/final-test/progress',
    { preHandler: requireParent },
    async (req, reply) => {
      const authed = req as AuthedRequest;
      const input = finalTestProgressSaveSchema.parse(req.body);
      const body: ApiOk<FinalTestProgressSaveResponse> = {
        data: finalTestService.saveProgress(authed.parent.id, childIdFromParams(req), input),
      };
      return reply.send(body);
    },
  );
}
