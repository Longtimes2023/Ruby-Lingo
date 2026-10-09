/**
 * RubyLingo — Điểm khởi động server.
 *
 * Chạy ở dev:  npm run dev:server   (tsx watch)
 * Chạy ở prod: npm start            (node dist-server/index.js, do systemd quản lý)
 *
 * Server chỉ nghe trên `127.0.0.1` — Caddy mới là thứ lộ ra Internet và lo HTTPS.
 */

import { buildApp } from './app.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { runMigrations } from './db/migrate.js';
import { closeDb, getDb } from './db/connection.js';

async function main(): Promise<void> {
  // --- Áp dụng migration NGAY khi khởi động -----------------------------
  // Lý do chạy tự động: app tự host, quên `npm run migrate` sau khi deploy là lỗi
  // rất dễ xảy ra và hậu quả là app 500 hàng loạt. Runner có tính idempotent nên
  // chạy mỗi lần boot là an toàn.
  try {
    getDb();
    const { applied, total } = runMigrations();
    if (applied.length > 0) {
      logger.info({ applied: applied.length, total }, 'Đã áp dụng migration khi khởi động');
    } else {
      logger.info({ total }, 'Cơ sở dữ liệu đã cập nhật, không có migration mới');
    }
  } catch (e) {
    logger.fatal({ err: (e as Error).message }, 'Không thể chuẩn bị cơ sở dữ liệu — dừng khởi động');
    process.exit(1);
  }

  const app = await buildApp();

  // --- Tắt êm: đóng server rồi đóng DB ----------------------------------
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Nhận tín hiệu tắt — đang đóng kết nối');
    try {
      await app.close();
      closeDb();
      logger.info('Đã tắt sạch sẽ');
      process.exit(0);
    } catch (e) {
      logger.error({ err: (e as Error).message }, 'Lỗi khi tắt');
      process.exit(1);
    }
  };

  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => void shutdown(sig));
  }

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Promise bị từ chối mà không được xử lý');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err: err.message, stack: err.stack }, 'Lỗi không bắt được — thoát');
    process.exit(1);
  });

  try {
    await app.listen({ host: config.HOST, port: config.PORT });
    logger.info(
      {
        url: `http://${config.HOST}:${config.PORT}`,
        env: config.NODE_ENV,
        publicOrigin: config.PUBLIC_ORIGIN,
      },
      '🚀 RubyLingo đã sẵn sàng',
    );
    if (config.isDev) {
      logger.info('Frontend (Vite) chạy ở http://localhost:5173 — API được proxy sang cổng này');
    }
  } catch (e) {
    logger.fatal({ err: (e as Error).message }, 'Không thể lắng nghe cổng');
    process.exit(1);
  }
}

void main();
