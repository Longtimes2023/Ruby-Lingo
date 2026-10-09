/**
 * RubyLingo — Routes xác thực: `/api/auth/**`.
 *
 * Quy ước response (xem `shared/types/api.ts`):
 *   • thành công → `{ data: <payload> }`
 *   • thất bại   → `{ error: { code, message, fields? } }`  (do `plugins/errors.ts` sinh)
 *
 * ⚙️ VÌ SAO KIỂM DỮ LIỆU BẰNG ZOD Ở ĐÂY MÀ KHÔNG DÙNG SCHEMA CỦA FASTIFY:
 *   Dùng cùng một schema Zod với client (`shared/schemas/auth.ts`) ⇒ luật kiểm chỉ có MỘT
 *   bản. Nếu khai báo JSON Schema riêng cho Fastify thì ta có hai bản luật phải giữ khớp
 *   nhau — đúng kiểu lệch mà kiến trúc này đang tránh. `plugins/errors.ts` đã bắt
 *   `ZodError` và chuyển thành `VALIDATION_FAILED` kèm `fields` cho từng ô nhập.
 *
 * ⚙️ VÌ SAO ĐĂNG NHẬP VÀ GET /session TRẢ CÙNG MỘT HÌNH DẠNG (`SessionResponse`):
 *   Client sau khi đăng nhập cần đúng thứ mà lúc tải lại trang nó cũng cần: phụ huynh +
 *   danh sách bé. Trả cùng hình dạng ⇒ client dùng CHUNG một hàm xử lý, không phải phân
 *   nhánh "vừa đăng nhập" và "tải lại trang" — nhánh thứ hai luôn là nhánh bị bỏ quên.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ApiOk, SessionResponse, SignupResponse } from '../../shared/types/api.js';
import {
  changePasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from '../../shared/schemas/auth.js';
import { config } from '../config.js';
import { authService } from '../services/AuthService.js';
import { childService } from '../services/ChildService.js';
import { requireParent, type AuthedRequest } from '../plugins/auth.js';
import { authRateLimit } from '../plugins/security.js';

/** Gắn cookie phiên. Xem ghi chú về việc KHÔNG ký cookie bên dưới. */
function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(config.cookie.name, token, {
    httpOnly: config.cookie.httpOnly,
    sameSite: config.cookie.sameSite,
    secure: config.cookie.secure,
    path: config.cookie.path,
    // `maxAge` tính bằng GIÂY (khác `expires` của Express). Làm tròn XUỐNG để cookie không
    // sống lâu hơn phiên trong DB — nếu cookie sống lâu hơn, người dùng gặp trạng thái
    // "có cookie nhưng server coi như chưa đăng nhập", rất khó hiểu.
    maxAge: Math.floor(config.sessionTtlMs / 1000),
    /**
     * CỐ TÌNH KHÔNG KÝ COOKIE (`signed: false`, mặc định).
     *
     * Ký cookie chỉ có ích khi giá trị cookie do ta sinh ra nhưng có thể bị đoán/sửa — ví dụ
     * `userId=42`. Ở đây giá trị là 256 bit ngẫu nhiên từ `crypto.randomBytes`, và DB chỉ
     * lưu SHA-256 của nó. Kẻ tấn công không đoán được, cũng không chế ra được giá trị khớp
     * hash. Thêm chữ ký chỉ làm cookie dài hơn mà không tăng bảo mật.
     */
    signed: false,
  });
}

function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(config.cookie.name, {
    path: config.cookie.path,
    httpOnly: config.cookie.httpOnly,
    sameSite: config.cookie.sameSite,
    secure: config.cookie.secure,
  });
}

/** User-Agent/IP để ghi vết phiên (audit). KHÔNG dùng để xác thực. */
function sessionContext(req: FastifyRequest): { userAgent?: string; ip?: string } {
  const ua = req.headers['user-agent'];
  return {
    userAgent: typeof ua === 'string' ? ua.slice(0, 300) : undefined,
    ip: req.ip,
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // --- Đăng ký ----------------------------------------------------------
  app.post('/api/auth/signup', { config: { rateLimit: authRateLimit } }, async (req, reply) => {
    const input = signupSchema.parse(req.body);
    const { parent, recoveryCode, sessionToken } = await authService.signup(
      input,
      sessionContext(req),
    );
    setSessionCookie(reply, sessionToken);

    // Trả kèm `recoveryCode` — CHỈ LẦN NÀY. DB chỉ giữ SHA-256 nên không thể hiện lại.
    // `children` là mảng rỗng (tài khoản mới chưa có bé), nhưng VẪN trả về để hình dạng
    // response khớp `SessionResponse` — client dùng chung một hàm xử lý cho cả ba đường.
    const body: ApiOk<SignupResponse> = {
      data: { parent, recoveryCode, children: [] },
    };
    return reply.status(201).send(body);
  });

  // --- Đăng nhập --------------------------------------------------------
  app.post('/api/auth/login', { config: { rateLimit: authRateLimit } }, async (req, reply) => {
    const input = loginSchema.parse(req.body);
    const { parent, sessionToken } = await authService.login(input, sessionContext(req));
    setSessionCookie(reply, sessionToken);

    const body: ApiOk<SessionResponse> = {
      data: { parent, children: childService.listChildren(parent.id) },
    };
    return reply.send(body);
  });

  // --- Đăng xuất --------------------------------------------------------
  app.post('/api/auth/logout', async (req, reply) => {
    // Idempotent: gọi khi chưa đăng nhập vẫn trả thành công. Client không phải phân nhánh
    // "có phiên hay không" chỉ để đăng xuất.
    if (req.sessionToken) authService.logout(req.sessionToken);
    clearSessionCookie(reply);
    const body: ApiOk<{ ok: true }> = { data: { ok: true } };
    return reply.send(body);
  });

  // --- Đọc phiên hiện tại ----------------------------------------------
  app.get('/api/auth/session', { preHandler: requireParent }, async (req, reply) => {
    const authed = req as AuthedRequest;
    const body: ApiOk<SessionResponse> = {
      data: { parent: authed.parent, children: childService.listChildren(authed.parent.id) },
    };
    return reply.send(body);
  });

  // --- Đổi mật khẩu (đã đăng nhập) --------------------------------------
  app.post(
    '/api/auth/password',
    { preHandler: requireParent, config: { rateLimit: authRateLimit } },
    async (req, reply) => {
      const authed = req as AuthedRequest;
      const input = changePasswordSchema.parse(req.body);
      await authService.changePassword(authed.parent.id, input, authed.sessionToken);
      const body: ApiOk<{ ok: true }> = { data: { ok: true } };
      return reply.send(body);
    },
  );

  // --- Đặt lại mật khẩu bằng mã khôi phục -------------------------------
  app.post('/api/auth/reset', { config: { rateLimit: authRateLimit } }, async (req, reply) => {
    const input = resetPasswordSchema.parse(req.body);
    const { recoveryCode } = await authService.resetPassword(input);
    // Trả mã khôi phục MỚI — xem ghi chú `AuthService.resetPassword`.
    const body: ApiOk<{ recoveryCode: string }> = { data: { recoveryCode } };
    return reply.send(body);
  });
}
