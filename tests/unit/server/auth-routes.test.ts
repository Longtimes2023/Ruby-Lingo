// @vitest-environment node
/**
 * Test TẦNG HTTP cho `/api/auth/**` và `/api/children/**`.
 *
 * ⭐ VÌ SAO PHẢI CÓ FILE NÀY — và vì sao nó KHÁC hẳn `auth-service.test.ts`:
 *
 *   Các test khác gọi THẲNG service, nên chúng kiểm được logic nhưng KHÔNG đi qua Fastify.
 *   Một lỗi thật đã lọt qua toàn bộ chúng: `securityPlugin`/`errorsPlugin`/`authPlugin` được
 *   `app.register()` mà không bọc `fastify-plugin`, nên Fastify ĐÓNG GÓI chúng. Decoration và
 *   hook bên trong không tới được các route đăng ký ở gốc. Hậu quả:
 *       • `reply.setCookie` không tồn tại  ⇒ đăng ký trả 500 SAU KHI đã tạo tài khoản
 *       • `req.cookies` không tồn tại      ⇒ mọi request ẩn danh, phiên không bao giờ đọc được
 *       • helmet, rate-limit, kiểm Origin  ⇒ KHÔNG chạy (mất lớp chống dò mật khẩu & CSRF)
 *
 *   `typecheck` sạch. `lint` sạch. 127 test đơn vị sạch. Tất cả đều xanh trong khi ứng dụng
 *   không đăng nhập được và không có rate-limit.
 *
 *   ⇒ Bài học: **test đơn vị KHÔNG thay thế được test ở tầng HTTP.** File này bổ sung đúng
 *     khoảng trống đó, và mỗi khẳng định dưới đây ứng với một thứ từng bị vô hiệu âm thầm.
 *
 * Dùng `app.inject()` của Fastify: chạy qua TOÀN BỘ chuỗi plugin/route/hook như thật nhưng
 * không cần mở cổng mạng ⇒ nhanh và không đụng cổng nào.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';

import { buildApp, type AppInstance } from '../../../server/app.js';
import { config } from '../../../server/config.js';
import { getDb } from '../../../server/db/connection.js';
import { clearAllData, setupTestDb } from './helpers/testDb.js';

const PASSWORD = 'matkhau123';

let app: AppInstance;

/** Lấy cookie phiên từ header `set-cookie` của response. */
function sessionCookieOf(res: LightMyRequestResponse): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = list.find((c) => c.startsWith(`${config.cookie.name}=`));
  if (!found) {
    throw new Error(
      `Response KHÔNG đặt cookie phiên "${config.cookie.name}". ` +
        'Đây chính là triệu chứng của plugin bị đóng gói (thiếu fastify-plugin).',
    );
  }
  // Chỉ lấy phần `name=value`; bỏ các thuộc tính (Path, HttpOnly, ...).
  return found.split(';')[0]!;
}

/** Đăng ký một tài khoản và trả cookie phiên của nó. */
async function signupAndGetCookie(email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email, password: PASSWORD, parentalConsent: true },
  });
  expect(res.statusCode, `đăng ký phải thành công, nhận được: ${res.body}`).toBe(201);
  return sessionCookieOf(res);
}

describe('API tầng HTTP', () => {
  beforeAll(async () => {
    setupTestDb();
    app = await buildApp();
    await app.ready();
  });

  beforeEach(() => {
    clearAllData(getDb());
  });

  // ===========================================================================
  describe('⭐ plugin phải áp dụng cho route đăng ký ở GỐC (chống lỗi đóng gói)', () => {
    it('cookie plugin hoạt động: đăng ký đặt được cookie phiên', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: { email: 'bo@example.com', password: PASSWORD, parentalConsent: true },
      });
      expect(res.statusCode).toBe(201);
      // Không có dòng này ⇒ `reply.setCookie is not a function` ⇒ 500.
      expect(sessionCookieOf(res)).toContain(`${config.cookie.name}=`);
    });

    it('helmet hoạt động: response có header bảo mật', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/health' });
      expect(res.statusCode).toBe(200);
      // `x-content-type-options: nosniff` là header mặc định của helmet ⇒ có mặt = helmet đã chạy.
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('rate-limit hoạt động: response có header X-RateLimit', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/health' });
      // Không có ⇒ rate-limit KHÔNG chạy ⇒ mất lớp chống dò mật khẩu ở các route auth.
      expect(
        Object.keys(res.headers).some((h) => h.toLowerCase().startsWith('x-ratelimit')),
      ).toBe(true);
    });

    it('errorsPlugin hoạt động: lỗi trả ĐÚNG hình dạng { error: { code, fields } }', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: { email: 'khong-phai-email', password: PASSWORD, parentalConsent: true },
      });
      expect(res.statusCode).toBe(400);
      const body = res.json() as { error: { code: string; fields?: Record<string, string> } };
      expect(body.error.code).toBe('VALIDATION_FAILED');
      // `fields` là thứ form dùng để hiện lỗi dưới từng ô nhập.
      expect(body.error.fields?.['email']).toBeTruthy();
    });

    it('kiểm Origin hoạt động: request ghi từ origin lạ bị chặn 403', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'bo@example.com', password: PASSWORD },
        headers: { origin: 'https://ke-tan-cong.example' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ===========================================================================
  describe('phiên đăng nhập đi qua được HTTP (không chỉ trong service)', () => {
    it('cookie từ đăng ký dùng được cho GET /api/auth/session', async () => {
      const cookie = await signupAndGetCookie('bo@example.com');

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/session',
        headers: { cookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as { data: { parent: { email: string }; children: unknown[] } };
      expect(body.data.parent.email).toBe('bo@example.com');
      expect(body.data.children).toEqual([]);
    });

    it('KHÔNG có cookie ⇒ 401 UNAUTHENTICATED', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/auth/session' });
      expect(res.statusCode).toBe(401);
      expect((res.json() as { error: { code: string } }).error.code).toBe('UNAUTHENTICATED');
    });

    it('cookie RÁC ⇒ 401 (không phải 500)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/session',
        headers: { cookie: `${config.cookie.name}=token-bia-dat` },
      });
      expect(res.statusCode).toBe(401);
    });

    it('đăng nhập đặt cookie mới dùng được ngay', async () => {
      await signupAndGetCookie('bo@example.com');

      const login = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'bo@example.com', password: PASSWORD },
      });
      expect(login.statusCode).toBe(200);

      const session = await app.inject({
        method: 'GET',
        url: '/api/auth/session',
        headers: { cookie: sessionCookieOf(login) },
      });
      expect(session.statusCode).toBe(200);
    });

    it('mật khẩu sai ⇒ 401 INVALID_CREDENTIALS', async () => {
      await signupAndGetCookie('bo@example.com');
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'bo@example.com', password: 'saibet' },
      });
      expect(res.statusCode).toBe(401);
      expect((res.json() as { error: { code: string } }).error.code).toBe('INVALID_CREDENTIALS');
    });

    it('đăng xuất xoá phiên: cookie cũ KHÔNG dùng lại được', async () => {
      const cookie = await signupAndGetCookie('bo@example.com');

      const out = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { cookie },
      });
      expect(out.statusCode).toBe(200);

      const after = await app.inject({
        method: 'GET',
        url: '/api/auth/session',
        headers: { cookie },
      });
      expect(after.statusCode).toBe(401);
    });
  });

  // ===========================================================================
  describe('hồ sơ bé qua HTTP', () => {
    it('tạo bé rồi đọc lại danh sách — cần cookie hợp lệ', async () => {
      const cookie = await signupAndGetCookie('bo@example.com');

      const created = await app.inject({
        method: 'POST',
        url: '/api/children',
        headers: { cookie },
        payload: { nickname: '  Bin  ', age: 7, avatarId: 'fox' },
      });
      expect(created.statusCode).toBe(201);
      const child = (created.json() as { data: { child: { id: string; nickname: string } } }).data
        .child;
      // Chuẩn hoá ở tầng schema phải đi tới tận DB, không chỉ tới DTO.
      expect(child.nickname).toBe('Bin');

      const list = await app.inject({ method: 'GET', url: '/api/children', headers: { cookie } });
      expect(list.statusCode).toBe(200);
      expect((list.json() as { data: { children: unknown[] } }).data.children).toHaveLength(1);
    });

    it('KHÔNG có cookie ⇒ 401 cho MỌI thao tác hồ sơ bé', async () => {
      for (const [method, url] of [
        ['GET', '/api/children'],
        ['POST', '/api/children'],
        ['PATCH', '/api/children/chi_bat-ky'],
        ['DELETE', '/api/children/chi_bat-ky'],
      ] as const) {
        const res = await app.inject({ method, url, payload: {} });
        expect(res.statusCode, `${method} ${url} lẽ ra phải 401`).toBe(401);
      }
    });

    it('⭐ phụ huynh A KHÔNG sửa được bé nhà B qua HTTP', async () => {
      const cookieA = await signupAndGetCookie('a@example.com');
      const cookieB = await signupAndGetCookie('b@example.com');

      const created = await app.inject({
        method: 'POST',
        url: '/api/children',
        headers: { cookie: cookieB },
        payload: { nickname: 'Bé B', age: 7, avatarId: 'fox' },
      });
      const childId = (created.json() as { data: { child: { id: string } } }).data.child.id;

      const attack = await app.inject({
        method: 'PATCH',
        url: `/api/children/${childId}`,
        headers: { cookie: cookieA },
        payload: { nickname: 'Bị đổi' },
      });
      expect(attack.statusCode).toBe(404);
      expect((attack.json() as { error: { code: string } }).error.code).toBe('CHILD_NOT_FOUND');
    });

    it('avatar không có trong danh sách ⇒ 400 VALIDATION_FAILED', async () => {
      const cookie = await signupAndGetCookie('bo@example.com');
      const res = await app.inject({
        method: 'POST',
        url: '/api/children',
        headers: { cookie },
        payload: { nickname: 'Bin', age: 7, avatarId: 'rong' },
      });
      expect(res.statusCode).toBe(400);
      expect((res.json() as { error: { code: string } }).error.code).toBe('VALIDATION_FAILED');
    });
  });
});
