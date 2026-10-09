/**
 * RubyLingo — Route kiểm tra sức khoẻ hệ thống.
 *
 * `GET /api/health` — dùng để:
 *   • kiểm tra server còn sống (script deploy, monitoring, Caddy health check)
 *   • phát hiện VPS CHƯA CHẠY `npm run migrate` (số migration lệch với số file trên đĩa)
 */

import type { FastifyInstance } from 'fastify';
import type { HealthResponse } from '../../shared/types/api.js';
import { pingDb } from '../db/connection.js';
import { countAppliedMigrations } from '../db/migrate.js';

/** Tăng khi có thay đổi đáng kể — hiển thị trong log và màn Cài đặt phụ huynh. */
const APP_VERSION = '0.1.0';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async (_req, reply) => {
    const dbOk = pingDb();

    if (!dbOk) {
      // Trả 503 để Caddy/monitoring biết là app chưa dùng được.
      return reply.status(503).send({
        error: {
          code: 'DB_ERROR',
          message: 'Không kết nối được cơ sở dữ liệu',
        },
      });
    }

    const body: HealthResponse = {
      status: 'ok',
      version: APP_VERSION,
      uptimeSeconds: Math.round(process.uptime()),
      migrationsApplied: countAppliedMigrations(),
    };
    return reply.send({ data: body });
  });
}
