/**
 * RubyLingo — Plugin xác thực: đọc cookie phiên và gắn phụ huynh vào request.
 *
 * ⚙️ QUYẾT ĐỊNH THIẾT KẾ: hook này chạy cho MỌI request và **KHÔNG BAO GIỜ ném lỗi**.
 *
 * Vì sao: phần lớn request là ẩn danh (đăng nhập, đăng ký, health, tài nguyên tĩnh). Nếu
 * hook ném 401 khi thiếu phiên thì cả trang đăng nhập cũng không mở được. Việc "bắt buộc
 * phải đăng nhập" là quyết định của TỪNG ROUTE, thực hiện qua `requireParent`.
 *
 * Nhờ vậy chỉ có ĐÚNG MỘT chỗ trả lỗi 401 (`requireParent`) ⇒ không có route nào vô tình
 * quên kiểm quyền mà vẫn chạy.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ParentAccountDto } from '../../shared/types/api.js';
import { config } from '../config.js';
import { authService } from '../services/AuthService.js';
import { errors } from './errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Phụ huynh đang đăng nhập, hoặc `null` nếu request ẩn danh. */
    parent: ParentAccountDto | null;
    /** Token phiên BẢN RÕ (đọc từ cookie) — cần để `logout` biết xoá phiên nào. */
    sessionToken: string | null;
  }
}

/**
 * ⚠️ BỌC BẰNG `fastify-plugin` — xem ghi chú dài ở `plugins/security.ts`.
 *
 * Không bọc `fp` thì hook `onRequest` dưới đây KHÔNG chạy cho các route đăng ký ở gốc
 * (`authRoutes`, `childrenRoutes`) ⇒ `req.parent` luôn là `null` ⇒ mọi endpoint cần đăng nhập
 * trả 401 dù cookie hợp lệ. Và tệ hơn: nó trông y như "chưa đăng nhập", nên rất dễ bị chẩn
 * đoán nhầm thành lỗi ở phía client.
 */
export const authPlugin = fp(
  async function authPlugin(app: FastifyInstance): Promise<void> {
    app.decorateRequest('parent', null);
    app.decorateRequest('sessionToken', null);

    app.addHook('onRequest', async (req: FastifyRequest) => {
      const token = req.cookies[config.cookie.name];
      if (!token) return; // Ẩn danh: không tra DB, giữ request rẻ.

      const session = authService.getSession(token);
      if (!session) return;

      req.parent = session.parent;
      req.sessionToken = session.sessionToken;
    });
  },
  { name: 'rubylingo-auth' },
);

/**
 * `preHandler` bắt buộc đăng nhập. Gắn vào route bằng
 * `{ preHandler: requireParent }`.
 *
 * Trả về `req.parent` đã được thu hẹp kiểu (non-null) qua `AuthedRequest` — nếu không thì
 * mọi route đều phải viết `req.parent!` và mất hết tính an toàn của TypeScript.
 */
export async function requireParent(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!req.parent) throw errors.unauthenticated();
}

/** Kiểu request SAU khi đã qua `requireParent` — `parent` chắc chắn khác null. */
export interface AuthedRequest extends FastifyRequest {
  parent: ParentAccountDto;
  sessionToken: string;
}
