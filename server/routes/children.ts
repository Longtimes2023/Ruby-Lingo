/**
 * RubyLingo — Routes hồ sơ bé: `/api/children/**`.
 *
 * ⭐ MỌI route ở đây đều `preHandler: requireParent` ⇒ chỉ phụ huynh đã đăng nhập mới gọi
 *    được. Nhưng đăng nhập CHƯA ĐỦ: `childId` nằm trong URL nên phụ huynh A có thể gửi
 *    `childId` của bé nhà phụ huynh B. Vì vậy `ChildService` kiểm `parent_id` trong MỌI
 *    truy vấn. Ở tầng route không cần kiểm lại — nhưng cũng không được gọi thẳng DB ở đây.
 *
 * ⚠️ TẠI SAO KHÔNG CÓ ROUTE `GET /api/children/:id`:
 *    Danh sách bé đã nằm trong `GET /api/auth/session` (client luôn cần nó để vẽ màn hình
 *    chọn bé). Thêm route tra một bé chỉ tạo thêm một chỗ nữa để quên kiểm quyền sở hữu.
 *    Khi nào màn hình chi tiết bé cần dữ liệu riêng thì thêm sau, kèm test quyền sở hữu.
 */

import type { FastifyInstance } from 'fastify';
import type { ApiOk, ChildProfileDto, SettingsDto } from '../../shared/types/api.js';
import { createChildSchema, updateChildSchema } from '../../shared/schemas/auth.js';
import { updateSettingsSchema } from '../../shared/schemas/settings.js';
import { childService } from '../services/ChildService.js';
import { requireParent, type AuthedRequest } from '../plugins/auth.js';
import { requireParentGate } from './parent.js';

/** Lấy `:id` từ params và ép kiểu — Fastify cho params là `unknown` nếu không khai schema. */
function childIdOf(req: { params: unknown }): string {
  const params = req.params as { id?: string };
  return params.id ?? '';
}

export async function childrenRoutes(app: FastifyInstance): Promise<void> {
  // --- Danh sách bé -----------------------------------------------------
  app.get('/api/children', { preHandler: requireParent }, async (req, reply) => {
    const authed = req as AuthedRequest;
    const body: ApiOk<{ children: ChildProfileDto[] }> = {
      data: { children: childService.listChildren(authed.parent.id) },
    };
    return reply.send(body);
  });

  // --- Tạo bé -----------------------------------------------------------
  app.post('/api/children', { preHandler: requireParent }, async (req, reply) => {
    const authed = req as AuthedRequest;
    const input = createChildSchema.parse(req.body);
    const child = childService.createChild(authed.parent.id, input);
    const body: ApiOk<{ child: ChildProfileDto }> = { data: { child } };
    return reply.status(201).send(body);
  });

  // --- Sửa hồ sơ bé -----------------------------------------------------
  /**
   * ⚠️ QUA CỔNG PIN (T072.3): sửa hồ sơ là thao tác QUẢN TRỊ của phụ huynh, không phải việc bé
   *    làm liên tục. Trước đây route này chỉ `requireParent` ⇒ một phiên đang mở (bé với
   *    DevTools) sửa được hồ sơ mà không cần PIN — trong khi ĐỌC báo cáo thì đã phải qua cổng.
   *    Bất đối xứng đó là lỗ hổng im lặng: cùng một "khu vực phụ huynh" mà một cửa có khoá, một
   *    cửa không.
   *
   * ✅ KHÔNG khoá người dùng mới: tài khoản CHƯA có PIN thì `isGateOpen` trả `true` (ngoại lệ có
   *    chủ ý của T072) ⇒ phụ huynh vừa tạo tài khoản vẫn dùng được ngay.
   */
  app.patch(
    '/api/children/:id',
    { preHandler: [requireParent, requireParentGate] },
    async (req, reply) => {
      const authed = req as AuthedRequest;
      const input = updateChildSchema.parse(req.body);
      const child = childService.updateChild(authed.parent.id, childIdOf(req), input);
      const body: ApiOk<{ child: ChildProfileDto }> = { data: { child } };
      return reply.send(body);
    },
  );

  // --- Xoá hồ sơ bé -----------------------------------------------------
  /**
   * ⚠️ QUA CỔNG PIN (T072.3) — route này QUAN TRỌNG NHẤT trong ba route hồ sơ: nó PHÁ HUỶ.
   *    Xoá hồ sơ kéo theo toàn bộ tiến độ/ví/huy hiệu của bé (`ON DELETE CASCADE`) và KHÔNG
   *    hoàn tác được. Một thao tác như vậy mà chỉ cần "đang có phiên" là quá rẻ.
   */
  app.delete(
    '/api/children/:id',
    { preHandler: [requireParent, requireParentGate] },
    async (req, reply) => {
      const authed = req as AuthedRequest;
      childService.deleteChild(authed.parent.id, childIdOf(req));
      const body: ApiOk<{ ok: true }> = { data: { ok: true } };
      return reply.send(body);
    },
  );

  // --- Cài đặt của bé (T074) --------------------------------------------
  /**
   * ⚠️ HAI route này có BA tầng bảo vệ: `requireParent` (đăng nhập) + **`requireParentGate`**
   *    (đã qua CỔNG PIN) + kiểm **SỞ HỮU** `parent_id` bên trong `ChildService`. Kiến trúc xếp
   *    cài đặt vào nhóm endpoint phụ huynh — dữ liệu về bé, không phải màn hình của bé.
   *
   *    `requireParentGate` được IMPORT từ `routes/parent.ts`, không viết lại: cổng PIN là MỘT
   *    luật, một bản sao thứ hai sẽ lệch đúng lúc cổng đổi cách hoạt động.
   *
   * ✅ ĐÃ THỐNG NHẤT (T072.3): `PATCH`/`DELETE /api/children/:id` nay CŨNG qua cổng PIN, cùng
   *    hai route cài đặt này. Trước đó chúng chỉ `requireParent` ⇒ một phiên đang mở sửa/xoá được
   *    hồ sơ (kể cả XOÁ — thao tác phá huỷ) mà không cần PIN, trong khi ĐỌC báo cáo thì phải qua
   *    cổng. Bất đối xứng đó là lỗ hổng im lặng.
   *
   * ℹ️ CÒN LẠI CHƯA QUA CỔNG: `POST /api/children` (tạo hồ sơ bé). Đây là CHỦ Ý của phạm vi
   *    T072.3, và lý do cũng hợp lý: nó chỉ được gọi ở luồng onboarding (`ChildProfileSetupPage`,
   *    Tầng 2 `RequireParent`) — lúc đó tài khoản CHƯA có PIN nên cổng mở, gate sẽ không thêm bảo
   *    vệ nào mà chỉ thêm một bước. Nếu chủ dự án muốn "mọi thao tác quản trị đều qua cổng" thì
   *    đó là một quyết định riêng (cần cập nhật test), KHÔNG tự ý đổi ở đây.
   */
  app.get(
    '/api/children/:id/settings',
    { preHandler: [requireParent, requireParentGate] },
    async (req, reply) => {
      const authed = req as AuthedRequest;
      const body: ApiOk<SettingsDto> = {
        data: childService.readSettings(authed.parent.id, childIdOf(req)),
      };
      return reply.send(body);
    },
  );

  /**
   * PATCH cài đặt — CẬP NHẬT MỘT PHẦN THẬT (chỉ ghi trường được gửi).
   *
   * ⚠️ KHÔNG có `.default()` trong `updateSettingsSchema`, và service dùng `??` (không dùng `||`) —
   *    hai điều kiện đó là thứ giữ cho "gửi một trường" không đặt lại các trường còn lại. Xem
   *    ghi chú dài ở `ChildService.updateSettings`.
   */
  app.patch(
    '/api/children/:id/settings',
    { preHandler: [requireParent, requireParentGate] },
    async (req, reply) => {
      const authed = req as AuthedRequest;
      const input = updateSettingsSchema.parse(req.body);
      const body: ApiOk<SettingsDto> = {
        data: childService.updateSettings(authed.parent.id, childIdOf(req), input),
      };
      return reply.send(body);
    },
  );
}
