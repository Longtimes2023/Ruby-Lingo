/**
 * RubyLingo — Lắp ráp ứng dụng Fastify.
 *
 * Một server làm HAI việc (quyết định kiến trúc: 1 lần deploy duy nhất):
 *   1. Cung cấp REST API tại `/api/**`
 *   2. Phục vụ bản build frontend (`dist/`) và SPA fallback
 *
 * Vì cùng origin nên cookie phiên hoạt động với `SameSite=Lax` và KHÔNG cần CORS.
 */

import Fastify from 'fastify';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { logger } from './lib/logger.js';
import { securityPlugin } from './plugins/security.js';
import { errorsPlugin } from './plugins/errors.js';
import { authPlugin } from './plugins/auth.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { childrenRoutes } from './routes/children.js';
import { progressRoutes } from './routes/progress.js';
import { rewardsRoutes } from './routes/rewards.js';
import { questsRoutes } from './routes/quests.js';
import { parentRoutes } from './routes/parent.js';
import { reportsRoutes } from './routes/reports.js';
import { finalTestRoutes } from './routes/final-test.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT_DIST = join(ROOT, 'dist');
const ASSETS_DIR = join(ROOT, 'assets');

export async function buildApp() {
  const app = Fastify({
    // Fastify 4 chỉ đọc `logger`; `validateLogger()` trong lib/logger.js nhận diện
    // một logger instance đầy đủ (có info/error/debug/fatal/warn/trace/child).
    // KHÔNG dùng `loggerInstance` — khoá đó không tồn tại trong types lẫn runtime
    // của Fastify 4 ⇒ bị bỏ qua âm thầm và server chạy với logger rỗng.
    logger,
    // Caddy đứng trước ⇒ tin header X-Forwarded-* để lấy IP thật cho rate-limit.
    trustProxy: true,
    // Giới hạn body: app này không bao giờ nhận payload lớn.
    bodyLimit: 256 * 1024,
    disableRequestLogging: config.isProd,
  });

  // --- Plugin: bảo mật TRƯỚC, rồi mới tới xử lý lỗi ---------------------
  // Thứ tự có ràng buộc: `authPlugin` đọc `req.cookies`, mà `req.cookies` chỉ tồn tại sau
  // khi `@fastify/cookie` được đăng ký trong `securityPlugin`.
  //
  // ⚠️ CẢ BA PLUGIN DƯỚI ĐÂY ĐỀU ĐƯỢC BỌC `fastify-plugin` (fp) — ĐÓ LÀ ĐIỀU KIỆN BẮT BUỘC,
  //    KHÔNG PHẢI CHI TIẾT TRANG TRÍ.
  //
  //    Fastify ĐÓNG GÓI mọi thứ đăng ký qua `app.register()`. Decoration và hook thêm bên
  //    trong một plugin thường chỉ áp dụng cho các route NẰM TRONG plugin đó. Vì các route ở
  //    đây cũng đăng ký ở GỐC, chúng là ngữ cảnh ANH EM với ba plugin này ⇒ không nhận được gì.
  //
  //    Hậu quả thật đã xảy ra khi thiếu `fp`: `reply.setCookie` không tồn tại (đăng ký trả 500
  //    SAU KHI đã tạo tài khoản), `req.cookies` không tồn tại (mọi request ẩn danh), helmet
  //    không gắn header, rate-limit và kiểm Origin KHÔNG chạy. Và nó im lặng: typecheck, lint,
  //    test đơn vị đều sạch vì chúng không đi qua HTTP.
  await app.register(securityPlugin);
  await app.register(errorsPlugin);
  await app.register(authPlugin);

  // --- Routes -----------------------------------------------------------
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(childrenRoutes);
  await app.register(progressRoutes);
  await app.register(rewardsRoutes);
  await app.register(questsRoutes);
  await app.register(parentRoutes);
  await app.register(reportsRoutes);
  await app.register(finalTestRoutes);

  // --- Tài nguyên tĩnh --------------------------------------------------
  // Tranh cảnh / âm thanh: phục vụ riêng để không lẫn với bản build frontend.
  if (existsSync(ASSETS_DIR)) {
    const fastifyStatic = (await import('@fastify/static')).default;
    await app.register(fastifyStatic, {
      root: ASSETS_DIR,
      prefix: '/assets/',
      // Tranh cảnh ít đổi ⇒ cache dài, giảm tải cho mạng yếu của bé.
      maxAge: config.isProd ? '30d' : 0,
      immutable: config.isProd,
      decorateReply: false,
    });
  }

  // Bản build frontend (production). Ở dev, Vite phục vụ frontend ở cổng 5173.
  if (existsSync(CLIENT_DIST)) {
    const fastifyStatic = (await import('@fastify/static')).default;
    await app.register(fastifyStatic, {
      root: CLIENT_DIST,
      prefix: '/',
      // index.html KHÔNG cache để bản mới được nhận ngay; asset có hash thì cache dài.
      maxAge: 0,
      index: ['index.html'],
      decorateReply: true,
    });
    logger.info({ dir: CLIENT_DIST }, 'Đang phục vụ bản build frontend');
  } else if (config.isProd) {
    logger.warn(
      { dir: CLIENT_DIST },
      'Không tìm thấy thư mục dist/ — chưa chạy `npm run build:client`? API vẫn chạy nhưng frontend sẽ 404.',
    );
  }

  // --- SPA fallback -----------------------------------------------------
  // Route không khớp và KHÔNG phải /api/** ⇒ trả index.html để React Router xử lý.
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: `Không có API tại ${req.method} ${req.url}` },
      });
    }

    const indexHtml = join(CLIENT_DIST, 'index.html');
    if (existsSync(indexHtml)) {
      return reply.type('text/html').send(readFileSync(indexHtml, 'utf8'));
    }

    return reply
      .status(404)
      .type('text/html')
      .send(
        '<!doctype html><meta charset="utf-8"><h1>RubyLingo</h1>' +
          '<p>Chưa có bản build frontend. Chạy <code>npm run build:client</code> rồi khởi động lại, ' +
          'hoặc mở <code>http://localhost:5173</code> khi đang chạy <code>npm run dev</code>.</p>',
      );
  });

  return app;
}

/**
 * Kiểu instance THẬT của app.
 *
 * Không khai báo `Promise<FastifyInstance>` trực tiếp được: `FastifyInstance` mặc định
 * gắn `FastifyBaseLogger`, còn app này gắn pino `Logger` của dự án ⇒ hai kiểu không
 * gán được cho nhau. Suy ra từ chính hàm để luôn khớp.
 */
export type AppInstance = Awaited<ReturnType<typeof buildApp>>;
