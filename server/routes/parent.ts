/**
 * RubyLingo — Routes KHU VỰC PHỤ HUYNH: `/api/parent/**` (T072, Nhóm 11).
 *
 * ⭐ BỐN VIỆC, MỘT TẦNG:
 *   `GET  /api/parent/gate`     — cổng của PHIÊN này đang mở hay đóng (KHÔNG ghi DB)
 *   `POST /api/parent/gate`     — nhập PIN để mở cổng (**rate-limit BẮT BUỘC**)
 *   `PATCH /api/parent/pin`     — đặt / đổi mã PIN (phải qua cổng)
 *   `POST /api/parent/pin/reset`— ĐẶT LẠI PIN khi quên, xác thực bằng MẬT KHẨU (T072.1)
 *
 * -----------------------------------------------------------------------------
 * BA ĐIỀU KHÔNG ĐƯỢC BỎ KHI SỬA TỆP NÀY
 * -----------------------------------------------------------------------------
 *
 * ⚠️ 1. `POST /api/parent/gate` **BẮT BUỘC** có `config: { rateLimit: parentGateRateLimit }`.
 *    PIN 4 chữ số = 10.000 tổ hợp. Không chặn tần suất thì dò được trong vài phút — đây chính là
 *    lý do cổng tồn tại thành một endpoint riêng thay vì để client tự so PIN. Hạn mức siết chặt
 *    hơn đăng nhập, và lý do nằm ở `parentGateRateLimit` (`plugins/security.ts`).
 *
 * ⚠️ 2. `PATCH /api/parent/pin` PHẢI qua `requireParentGate`. Đổi được mã PIN nghĩa là mở được
 *    khu vực phụ huynh MÃI MÃI — nếu để hở thì cổng PIN vô nghĩa. Ngoại lệ duy nhất, có chủ ý:
 *    tài khoản CHƯA có PIN thì `isGateOpen` trả `true` (không có gì để chặn), nên phụ huynh vẫn
 *    ĐẶT ĐƯỢC PIN ĐẦU TIÊN. Xem `ParentService.isGateOpen` (quyết định 3).
 *
 * ⚠️ 3. Mã PIN KHÔNG bao giờ được log. Route không log `req.body`; `redact` của pino cũng phủ
 *    `pin`/`pinHash` như lớp thứ hai (`lib/logger.ts`).
 *
 * ⚠️ Mọi route đều `requireParent`: cổng PIN là lớp THỨ HAI, không thay lớp đăng nhập. Ranh giới
 *    bảo mật thật vẫn là phiên (xem chú thích `pin_hash` ở `migrations/001_account.sql`).
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { ApiOk, ParentGateResponse } from '../../shared/types/api.js';
import { setPinSchema, resetPinSchema } from '../../shared/schemas/auth.js';
import { errors } from '../plugins/errors.js';
import { requireParent, type AuthedRequest } from '../plugins/auth.js';
import { parentGateRateLimit } from '../plugins/security.js';
import { parentService } from '../services/ParentService.js';

/**
 * `preHandler`: cổng PIN của phiên phải đang mở.
 *
 * ⚠️ Đặt cạnh `requireParent` (cùng là guard ở tầng route) để mọi route phụ huynh trong tương lai
 *    (báo cáo, cài đặt — T073/T074) dùng lại được. Nhờ vậy việc "cổng PIN chắn khu vực phụ
 *    huynh" là một luật khai MỘT LẦN, không phải một `if` lặp ở từng route — và một route mới
 *    quên nó là lỗ hổng im lặng.
 */
export async function requireParentGate(
  req: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const authed = req as AuthedRequest;
  if (!parentService.isGateOpen(authed.parent.id, authed.sessionToken)) {
    throw errors.parentGateRequired();
  }
}

export async function parentRoutes(app: FastifyInstance): Promise<void> {
  // --- Đọc trạng thái cổng ----------------------------------------------
  /**
   * ⚠️ CHỈ ĐỌC — không ghi DB. Client gọi mỗi lần mở `/parent` (kể cả tải lại trang) để biết
   *    cổng của phiên này đã mở chưa mà không phải hỏi lại PIN.
   */
  app.get('/api/parent/gate', { preHandler: requireParent }, async (req, reply) => {
    const authed = req as AuthedRequest;
    const body: ApiOk<ParentGateResponse> = {
      data: parentService.gateStatus(authed.sessionToken),
    };
    return reply.send(body);
  });

  // --- Nhập PIN để mở cổng (rate-limit) ---------------------------------
  app.post(
    '/api/parent/gate',
    { preHandler: requireParent, config: { rateLimit: parentGateRateLimit } },
    async (req, reply) => {
      const authed = req as AuthedRequest;
      // Parse ở tầng route để lỗi trả về có `fields` chỉ đúng ô sai; service parse lại lần nữa
      // (xem ghi chú ở `ChildService`).
      setPinSchema.parse(req.body);

      const body: ApiOk<ParentGateResponse> = {
        data: await parentService.openGate(authed.parent.id, authed.sessionToken, req.body),
      };
      return reply.send(body);
    },
  );

  // --- Đặt / đổi mã PIN (phải qua cổng) ---------------------------------
  app.patch(
    '/api/parent/pin',
    { preHandler: [requireParent, requireParentGate] },
    async (req, reply) => {
      const authed = req as AuthedRequest;
      setPinSchema.parse(req.body);

      await parentService.setPin(authed.parent.id, authed.sessionToken, req.body);

      const body: ApiOk<{ ok: true }> = { data: { ok: true } };
      return reply.send(body);
    },
  );

  // --- Đặt LẠI mã PIN khi quên (xác thực bằng MẬT KHẨU) -----------------
  /**
   * ⚠️⚠️ ROUTE NÀY **KHÔNG** QUA `requireParentGate` — VÀ ĐÓ LÀ CẢ LÝ DO NÓ TỒN TẠI.
   *    `PATCH /pin` bị cổng chắn, nên phụ huynh QUÊN PIN sẽ kẹt vĩnh viễn (đăng nhập lại cũng bị
   *    cổng chắn). Đường lùi phải xác thực bằng MẬT KHẨU tài khoản (ranh giới bảo mật THẬT), chứ
   *    không bằng PIN (rào UX). Xem `ParentService.resetPin`.
   *
   * ⚠️ VẪN PHẢI RATE-LIMIT: đây là một endpoint ĐOÁN. Dùng `parentGateRateLimit` (5/phút) — chặt
   *    hơn `authRateLimit` của đăng nhập. Mật khẩu mạnh hơn PIN 4 số, nhưng "mạnh hơn" không có
   *    nghĩa là "không cần chặn".
   */
  app.post(
    '/api/parent/pin/reset',
    { preHandler: requireParent, config: { rateLimit: parentGateRateLimit } },
    async (req, reply) => {
      const authed = req as AuthedRequest;
      // Parse ở tầng route để lỗi có `fields`; service parse lại (xem ghi chú ở `ChildService`).
      resetPinSchema.parse(req.body);

      await parentService.resetPin(authed.parent.id, req.body);

      const body: ApiOk<{ ok: true }> = { data: { ok: true } };
      return reply.send(body);
    },
  );
}
