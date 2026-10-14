// @vitest-environment node
/**
 * Test khoá hành vi: **RATE-LIMIT TOÀN CỤC CHỈ ĐƯỢC CHẶN `/api/**` — KHÔNG BAO GIỜ CHẶN
 * TÀI NGUYÊN TĨNH.**
 *
 * ⭐ VÌ SAO TỆP NÀY TỒN TẠI — LỖI THẬT ĐÃ LÀM CI ĐỎ 11 LẦN LIÊN TIẾP (2026-10-11 → 2026-10-14)
 *
 *   Triệu chứng: job `e2e` đỏ ở bước "Chạy test đầu-cuối", KHÔNG phải ở bước build
 *   (`rubylingo-e2e-build.log` trong artifact cho thấy `vite build` + `esbuild` đều xanh).
 *   Bài đỏ đầu tiên là `04-bai-thi-cuoi-khoa.spec.ts` › "cổng KHOÁ" (viewport iPad):
 *
 *       Error: locator.fill: Test timeout of 60000ms exceeded.
 *       Call log:
 *         - waiting for getByLabel('Email của bố mẹ')
 *
 *   ⇒ React CHƯA BAO GIỜ MOUNT: không có form nào trong DOM suốt 60 giây, và KHÔNG có lỗi JS
 *     nào để đọc. Chỉ là khoảng trống.
 *
 *   Nguyên nhân — đọc được từ `trace.zip` của artifact CI (Playwright ghi lại MỌI request):
 *
 *       429 GET http://127.0.0.1:4173/assets/vendor-motion-C3HuGMvh.js
 *
 *   **Một TỆP TĨNH bị trả 429.** `@fastify/rate-limit` được đăng ký với `global: true` nên nó
 *   gắn hook `onRequest` vào MỌI route, kể cả route do `@fastify/static` sinh ra. Bundle chunk
 *   không nạp được ⇒ `index.js` không chạy ⇒ không có gì được render.
 *
 *   Số liệu khớp: CI chạy 15 bài trong 93s (~6,2s/bài); mỗi lần nạp trang kéo ~6 tệp tĩnh ⇒
 *   ～8 bài đầu đã chạm trần 300/phút ⇒ bài thứ 9 đỏ — và artifact chỉ có ĐÚNG MỘT bài đỏ,
 *   chính là bài thứ 9. Cửa sổ 1 phút trôi qua ⇒ các bài sau xanh lại.
 *
 * -----------------------------------------------------------------------------
 * VÌ SAO PHẢI CÓ CẢ HAI CHIỀU (đọc trước khi "dọn cho gọn")
 * -----------------------------------------------------------------------------
 *   Chỉ khẳng định "tài nguyên tĩnh KHÔNG bị 429" là chưa đủ: ai đó gỡ hẳn
 *   `app.register(rateLimit, …)` cũng làm khẳng định đó xanh — trong khi lớp chống dò mật khẩu
 *   biến mất hoàn toàn (đúng lỗi mà `securityPlugin` từng gây ra khi thiếu `fastify-plugin`).
 *   Nên tệp này khoá CẢ HAI CHIỀU:
 *     • CHIỀU ÂM — nhiều request tới đường dẫn KHÔNG phải `/api` ⇒ KHÔNG được có 429.
 *     • CHIỀU DƯƠNG — vượt trần trên `/api/**` ⇒ PHẢI có 429. Đây là ĐỐI CHỨNG chứng minh
 *       limiter vẫn đang chạy, và allow-list đang chọn đúng ranh giới.
 *   Thiếu chiều dương là một cổng chỉ kiểm được "không đỏ" chứ không kiểm được "còn bảo vệ".
 *
 * -----------------------------------------------------------------------------
 * ⚠️ BÀI NÀY KHÔNG PHỤ THUỘC `dist/` CÓ TỒN TẠI HAY KHÔNG
 * -----------------------------------------------------------------------------
 *   Job `ci` trên CI **không** chạy `build:client` ⇒ `dist/` không tồn tại, nên `@fastify/static`
 *   không được đăng ký và đường dẫn tĩnh rơi vào `setNotFoundHandler` (SPA fallback) ⇒ trả 404.
 *   Khẳng định vì thế được viết là **"không được là 429"** chứ không phải "phải là 200":
 *   200 (có `dist/`, phục vụ tệp thật) và 404 (không có `dist/`, SPA fallback) đều là bằng chứng
 *   hợp lệ cho bất biến đang kiểm. Chỉ 429 mới là vi phạm.
 *   → Nếu viết "phải 200" thì bài này sẽ ĐỎ OAN trên CI — một cổng đỏ oan là cổng bị người ta
 *     học cách bỏ qua.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import type { AppInstance } from '../../../server/app.js';

// ⚠️⚠️ PHẢI đặt TRƯỚC khi nạp `server/config.ts`. `import` thường bị ESM hoist lên trước mọi
//    câu lệnh, nên config sẽ chốt giá trị cũ trước khi dòng này chạy. Dùng `import type` (bị xoá
//    khi biên dịch) + `await import()` ĐỘNG bên trong `beforeAll`. Cùng kỹ thuật đã dùng ở
//    `rate-limit-response.test.ts` — xem ghi chú dài ở tệp đó.
//
//    Trần 4: đủ nhỏ để tái hiện cảnh vượt hạn mức trong vài request (thay vì gửi 300 request mỗi
//    lượt chạy), đủ lớn để 6 request tĩnh vượt qua nó một cách rõ ràng.
process.env['RATE_LIMIT_MAX'] = '4';

/** Số request gửi tới đường dẫn KHÔNG phải `/api` — cố ý NHIỀU HƠN trần 4. */
const STATIC_PROBES = 12;

/**
 * Đường dẫn KHÔNG phải `/api/**` — tài nguyên tĩnh hoặc SPA fallback, tuỳ `dist/` có hay không.
 * Cố ý dùng HAI dạng: một đường dẫn trông như tệp asset có hash (giống hệt thứ trình duyệt
 * thật tải), và đường dẫn gốc `/`.
 */
const NON_API_PATHS = [
  '/assets/vendor-motion-C3HuGMvh.js',
  '/assets/index-DppO1v5U.js',
  '/index.html',
  '/',
] as const;

describe('rate-limit toàn cục: chỉ chặn /api/**, miễn tài nguyên tĩnh', () => {
  let app: AppInstance;

  beforeAll(async () => {
    const { buildApp } = await import('../../../server/app.js');
    app = await buildApp();
    await app.ready();
  });

  it('ngưỡng đã được hạ xuống 4 (nếu không, các bài dưới không chứng minh được gì)', async () => {
    const { config } = await import('../../../server/config.js');
    expect(config.RATE_LIMIT_MAX).toBe(4);
  });

  // ===========================================================================
  // CHIỀU ÂM — tài nguyên tĩnh KHÔNG bị chặn
  // ===========================================================================
  it(`① ${STATIC_PROBES} request liên tiếp tới đường dẫn ngoài /api ⇒ KHÔNG có 429`, async () => {
    const codes: number[] = [];
    for (let i = 0; i < STATIC_PROBES; i += 1) {
      const url = NON_API_PATHS[i % NON_API_PATHS.length]!;
      const res = await app.inject({ method: 'GET', url });
      codes.push(res.statusCode);
    }

    const biChan = codes.filter((c) => c === 429);
    expect(
      biChan.length,
      `${biChan.length}/${STATIC_PROBES} request tới tài nguyên TĨNH bị chặn 429.\n` +
        `Mã thật: ${codes.join(', ')}\n` +
        'Đây chính là lỗi làm CI đỏ 11 lần: trình duyệt không nạp được bundle ⇒ React không\n' +
        'mount ⇒ form đăng ký không tồn tại ⇒ mọi bài e2e timeout ở dòng đầu tiên.\n' +
        'Đo được trong trace.zip của artifact CI: 429 GET /assets/vendor-motion-*.js',
    ).toBe(0);
  });

  it('② nạp một trang (nhiều tệp tĩnh) KHÔNG ăn vào hạn mức của API', async () => {
    // Một lần nạp trang thật kéo ~6 tệp tĩnh — nhiều hơn trần 4. Nếu chúng dùng chung bộ đếm
    // với API thì SAU MỘT lần nạp trang là API đã cạn; đó chính là cơ chế làm CI đỏ.
    for (let i = 0; i < 6; i += 1) {
      await app.inject({ method: 'GET', url: '/assets/index-DppO1v5U.js' });
    }

    const health = await app.inject({ method: 'GET', url: '/api/health' });
    expect(
      health.statusCode,
      'Sau khi trình duyệt nạp vài tài nguyên tĩnh, /api/health đã bị 429 ⇒ tài nguyên tĩnh ĐANG ăn chung hạn mức với API.',
    ).toBe(200);
  });

  // ===========================================================================
  // CHIỀU DƯƠNG — /api/** VẪN bị chặn (đối chứng: chứng minh limiter còn chạy)
  // ===========================================================================
  // ⚠️⚠️ BÀI NÀY KHÔNG ĐƯỢC XOÁ DÙ NÓ "KHÔNG LIÊN QUAN" TỚI LỖI ĐANG SỬA.
  //   Không có nó, cách "sửa" nhanh nhất — gỡ hẳn `app.register(rateLimit, …)` — cũng làm cả
  //   tệp này xanh, trong khi lớp chống dò mật khẩu biến mất (đúng thứ `securityPlugin` đã từng
  //   đánh mất khi thiếu `fastify-plugin`). Một cổng chỉ có chiều âm là cổng không kiểm gì cả.
  it('③ ĐỐI CHỨNG: vượt trần trên /api/** ⇒ PHẢI bị chặn 429', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const res = await app.inject({ method: 'GET', url: `/api/health?probe=${i}` });
      codes.push(res.statusCode);
    }

    const allowed = codes.filter((c) => c === 200).length;
    const blocked = codes.filter((c) => c === 429).length;

    // Đối chứng phải CÓ CẢ HAI: vài request đầu qua được (trần chưa chạm) rồi mới bị chặn.
    expect(
      allowed,
      `Không request /api nào qua được (mã: ${codes.join(', ')}) ⇒ đối chứng không dựng đúng hiện trạng.`,
    ).toBeGreaterThan(0);
    expect(
      blocked,
      `Đã gửi 10 request /api/health với trần 4 mà KHÔNG có request nào bị 429 ⇒ rate-limit ĐÃ BỊ GỠ hoặc allow-list đang miễn cả /api/** (mã: ${codes.join(', ')}).\n` +
        'Lớp chống dò mật khẩu / spam ghi dữ liệu đang KHÔNG hoạt động.',
    ).toBeGreaterThan(0);
  });
});
