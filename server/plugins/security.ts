/**
 * RubyLingo — Plugin bảo mật.
 *
 * Gồm: helmet (header bảo mật), cookie (đọc/ghi cookie phiên), rate-limit (chống dò
 * mật khẩu & spam đăng ký), và kiểm tra Origin (chống CSRF).
 *
 * Vì app **same-origin** (server Node phục vụ luôn frontend) nên không cần CORS:
 * cookie `SameSite=Lax` + kiểm tra `Origin` là đủ cho mọi request ghi.
 *
 * ⚠️⚠️ BỌC BẰNG `fastify-plugin` (fp) — TUYỆT ĐỐI KHÔNG BỎ, ĐÂY KHÔNG PHẢI TRANG TRÍ:
 *
 *   Fastify **đóng gói (encapsulate)** mọi thứ đăng ký qua `app.register()`. Decoration
 *   (`reply.setCookie`, `req.cookies`) và hook thêm bên trong một plugin đã `register` CHỈ
 *   có hiệu lực với các route đăng ký BÊN TRONG plugin đó — KHÔNG tới được các route đăng ký
 *   ở gốc (`app.register(authRoutes)`).
 *
 *   Lỗi thật đã xảy ra vì thiếu `fp` ở đây: `securityPlugin` được đăng ký ở gốc, các route
 *   cũng ở gốc ⇒ hai ngữ cảnh ANH EM ⇒ mọi thứ dưới đây không hề chạy:
 *       • `reply.setCookie` không tồn tại  ⇒ đăng ký/đăng nhập trả 500 sau khi ĐÃ tạo tài khoản
 *       • `req.cookies` không tồn tại      ⇒ mọi request đều ẩn danh, phiên không bao giờ đọc được
 *       • helmet không gắn header bảo mật
 *       • rate-limit KHÔNG chạy            ⇒ mất hẳn lớp chống dò mật khẩu
 *       • kiểm Origin KHÔNG chạy           ⇒ mất hẳn lớp chống CSRF
 *
 *   Và đây là kiểu lỗi IM LẶNG: `typecheck` sạch, `lint` sạch, test đơn vị sạch (vì chúng
 *   gọi thẳng service, không đi qua HTTP). Chỉ có test ở TẦNG HTTP mới bắt được — xem
 *   `tests/unit/server/routes/auth-routes.test.ts`.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

/** Các method làm thay đổi dữ liệu ⇒ phải kiểm tra Origin. */
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const securityPlugin = fp(
  async function securityPlugin(app: FastifyInstance): Promise<void> {
    // --- Helmet: header bảo mật -------------------------------------------
    await app.register(helmet, {
      // CSP chặt: chỉ cho phép tài nguyên từ chính app.
      // Lưu ý: 'unsafe-inline' cho style là cần thiết vì Tailwind/Framer Motion chèn style động.
      contentSecurityPolicy: config.isProd
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:'],
              // Web Speech API dùng blob/mediastream cho audio
              mediaSrc: ["'self'", 'blob:', 'data:'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'", 'data:'],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
      // Cho phép tranh cảnh/âm thanh được tải cùng origin
      crossOriginResourcePolicy: { policy: 'same-origin' },
    });

    // --- Cookie -----------------------------------------------------------
    await app.register(cookie, {
      secret: config.SESSION_SECRET,
      hook: 'onRequest',
    });

    // --- Rate limit toàn cục (nới) + siết riêng ở route auth --------------
    await app.register(rateLimit, {
      global: true,
      max: 300,
      timeWindow: '1 minute',
      allowList: [],
      errorResponseBuilder: () => ({
        error: {
          code: 'RATE_LIMITED',
          message: 'Có quá nhiều yêu cầu. Bố mẹ thử lại sau một lát nhé.',
        },
      }),
      keyGenerator: (req: FastifyRequest) => {
        // Ưu tiên IP thật khi chạy sau Caddy (X-Forwarded-For).
        const fwd = req.headers['x-forwarded-for'];
        if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0]!.trim();
        return req.ip;
      },
    });

    // --- Kiểm tra Origin cho các request ghi (chống CSRF) -----------------
    app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
      if (!UNSAFE_METHODS.has(req.method)) return;

      const origin = req.headers.origin;
      // Request không có Origin (curl, app native) vẫn phải có cookie hợp lệ ⇒ không phải CSRF.
      if (!origin) return;

      const allowed = new Set([config.PUBLIC_ORIGIN]);
      // Ở dev, Vite chạy cổng 5173 còn API ở 3000 — nhưng Vite proxy nên Origin vẫn là 5173.
      if (config.isDev) {
        allowed.add('http://localhost:5173');
        allowed.add('http://127.0.0.1:5173');
      }

      if (!allowed.has(origin)) {
        logger.warn({ origin, url: req.url }, 'Chặn request có Origin không hợp lệ');
        return reply.status(403).send({
          error: { code: 'FORBIDDEN', message: 'Nguồn yêu cầu không hợp lệ' },
        });
      }
    });
  },
  // `name` để Fastify báo lỗi rõ ràng nếu plugin này bị đăng ký hai lần.
  { name: 'rubylingo-security' },
);

/**
 * Cấu hình rate-limit SIẾT cho các route xác thực (đăng nhập/đăng ký/đặt lại mật khẩu).
 * Dùng ở `app.register(routes, { config: { rateLimit: authRateLimit } })`.
 */
export const authRateLimit = {
  max: config.AUTH_RATE_LIMIT_MAX,
  timeWindow: config.AUTH_RATE_LIMIT_WINDOW,
  errorResponseBuilder: () => ({
    error: {
      code: 'RATE_LIMITED',
      message: 'Bố mẹ đã thử quá nhiều lần. Vui lòng chờ một lát rồi thử lại nhé.',
    },
  }),
} as const;

/**
 * Rate-limit SIẾT RIÊNG cho cổng PIN phụ huynh (`POST /api/parent/gate`, T072).
 *
 * ⚠️⚠️ VÌ SAO CỔNG PIN KHÔNG THỂ DÙNG CHUNG HẠN MỨC VỚI ĐĂNG NHẬP:
 *   PIN chỉ có 4 chữ số ⇒ **10.000 tổ hợp**. Mật khẩu thì dài tuỳ ý nên 10 lần/phút là đủ chặn
 *   dò; còn với PIN, 10 lần/phút cho phép quét hết không gian trong khoảng ~17 giờ, và nhanh hơn
 *   nhiều nếu kẻ tấn công đổi IP (key theo IP). Cổng PIN vì thế có hạn mức CHẶT HƠN: 5 lần/phút.
 *
 * ⭐ VÌ SAO KHÔNG ĐỂ VÀO `.env` NHƯ `AUTH_RATE_LIMIT_MAX`: đây là hằng số GẮN VỚI ĐỘ DÀI PIN
 *   (`PARENT_PIN_LENGTH = 4`). Nếu một ngày PIN dài lên 6 số (1.000.000 tổ hợp) thì con số này
 *   mới nên nới — và lúc đó ta muốn SỬA Ở ĐÂY, cạnh lý do, chứ không phải trong một biến môi
 *   trường mà không ai biết nó gắn với gì.
 *
 * ⚠️ Rate-limit là lớp chống dò BẮT BUỘC cho endpoint này, không phải tuỳ chọn — xem chú thích ở
 *    `server/routes/parent.ts`.
 */
export const parentGateRateLimit = {
  max: 5,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    error: {
      code: 'RATE_LIMITED',
      message: 'Bố mẹ đã thử quá nhiều lần. Vui lòng chờ một lát rồi thử lại nhé.',
    },
  }),
} as const;
