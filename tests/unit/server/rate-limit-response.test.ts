// @vitest-environment node
/**
 * Test khoá hành vi: **VƯỢT RATE-LIMIT PHẢI TRẢ 429 `RATE_LIMITED`, KHÔNG PHẢI 500.**
 *
 * ⭐ VÌ SAO CÓ FILE RIÊNG, KHÔNG GỘP VÀO `auth-routes.test.ts`:
 *
 *   `tests/setup.ts` nới `AUTH_RATE_LIMIT_MAX` lên 10000 để các file test khác không bị chặn
 *   giữa chừng (xem ghi chú ở đó). Nghĩa là KHÔNG file test nào còn chạm tới ngưỡng thật —
 *   và đó chính xác là điều kiện để lỗi này sống sót: nó chỉ xuất hiện ở lần vượt ngưỡng.
 *
 *   File này tự hạ ngưỡng xuống 2 rồi mới nạp `server/config.ts`. Phải dùng `await import()`
 *   ĐỘNG: `import` tĩnh bị hoist lên trước mọi câu lệnh, nên `process.env` sẽ được đọc SAU khi
 *   config đã chốt giá trị — và ngưỡng vẫn là 10000.
 *
 * -----------------------------------------------------------------------------
 * LỖI ĐÃ TỪNG XẢY RA (giữ lại để không ai vô tình tái tạo)
 * -----------------------------------------------------------------------------
 *
 *   `@fastify/rate-limit` **THROW** kết quả của `errorResponseBuilder`, chứ không `send`:
 *       node_modules/@fastify/rate-limit/index.js:261
 *       →  throw params.errorResponseBuilder(req, respCtx)
 *
 *   `errorResponseBuilder` của dự án trả về object thuần `{ error: { code, message } }`.
 *   Object thuần không có `.message`, không có `.statusCode`, không có `.code` ⇒ nó rơi
 *   xuống nhánh "lỗi không lường trước" của `errorsPlugin` và bị biến thành:
 *
 *       500 { error: { code: 'INTERNAL_ERROR', message: 'Lỗi nội bộ: undefined' } }
 *
 *   Hậu quả với người dùng thật: phụ huynh gõ sai mật khẩu 10 lần, lẽ ra được bảo
 *   "Bố mẹ đã thử quá nhiều lần. Vui lòng chờ một lát rồi thử lại nhé." thì lại nhận
 *   "Có lỗi xảy ra ở máy chủ" — và bấm thử lại tiếp, vì câu đó không nói gì về việc phải chờ.
 *   Câu trả lời đúng đã được viết ra, được truyền vào hàm builder, rồi bị chính handler vứt đi.
 *
 *   Ngoài ra nó còn làm ngập log bằng lỗi 500 GIẢ — loại nhiễu khiến người trực hệ thống
 *   bỏ qua lỗi 500 thật.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import type { AppInstance } from '../../../server/app.js';
import type { config as ConfigValue } from '../../../server/config.js';
import type { Db } from '../../../server/db/connection.js';

// ⚠️ PHẢI đặt TRƯỚC khi nạp config/app. `tests/setup.ts` đã chạy trước đó và đặt 10000;
//    dòng này ghi đè lại thành 2.
//
// ⭐ VÌ SAO DÙNG `import type` + `await import()`: `import type` bị XOÁ hoàn toàn khi biên
//    dịch nên nó KHÔNG kéo module vào lúc chạy — nhờ vậy dòng gán `process.env` ở trên vẫn
//    là thứ đầu tiên `server/config.ts` nhìn thấy. Nếu dùng `import` thường, ESM hoist nó
//    lên trước mọi câu lệnh và config sẽ chốt ngưỡng 10000 trước khi ta kịp hạ xuống.
process.env['AUTH_RATE_LIMIT_MAX'] = '2';

describe('vượt rate-limit trả 429 RATE_LIMITED (không phải 500)', () => {
  let app: AppInstance;
  let config: typeof ConfigValue;
  let db: Db;

  beforeAll(async () => {
    const { buildApp } = await import('../../../server/app.js');
    const { config: loadedConfig } = await import('../../../server/config.js');
    const { getDb } = await import('../../../server/db/connection.js');
    const { runMigrations } = await import('../../../server/db/migrate.js');

    runMigrations();
    config = loadedConfig;
    db = getDb();
    app = await buildApp();
    await app.ready();
  });

  it('ngưỡng đã được hạ xuống 2 (nếu không, test này vô nghĩa)', () => {
    expect(config.AUTH_RATE_LIMIT_MAX).toBe(2);
  });

  it('hai lần đầu qua được, lần thứ ba bị chặn', async () => {
    db.prepare('DELETE FROM parent_account').run();

    const payload = (n: number) => ({
      email: `rl${n}@example.com`,
      password: 'matkhau123',
      parentalConsent: true,
    });

    const first = await app.inject({ method: 'POST', url: '/api/auth/signup', payload: payload(1) });
    const second = await app.inject({ method: 'POST', url: '/api/auth/signup', payload: payload(2) });
    const third = await app.inject({ method: 'POST', url: '/api/auth/signup', payload: payload(3) });

    expect(first.statusCode, first.body).toBe(201);
    expect(second.statusCode, second.body).toBe(201);

    // ⭐ KHẲNG ĐỊNH CHÍNH: 429, không phải 500.
    expect(third.statusCode, `nhận được: ${third.body}`).toBe(429);

    const body = third.json() as { error: { code: string; message: string } };
    expect(body.error.code).toBe('RATE_LIMITED');
    // Câu này phải ĐỌC ĐƯỢC và phải nói cho phụ huynh biết là phải chờ — đó là toàn bộ
    // mục đích của việc trả 429 thay vì 500.
    expect(body.error.message).toContain('quá nhiều lần');
    expect(body.error.message).not.toContain('undefined');
  });

  it('có header Retry-After để client biết khi nào thử lại', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: { email: 'rl9@example.com', password: 'matkhau123', parentalConsent: true },
    });
    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });
});
