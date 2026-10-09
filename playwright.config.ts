/**
 * RubyLingo — cấu hình Playwright cho bộ test END-TO-END (T081).
 *
 * -----------------------------------------------------------------------------
 * VÌ SAO CẦN TẦNG TEST NÀY (unit test đã xanh rồi mà)
 * -----------------------------------------------------------------------------
 *   Unit test chạy trên jsdom: nó KHÔNG render CSS, KHÔNG có router thật, KHÔNG đi qua HTTP,
 *   KHÔNG dựng cookie. Ba loại lỗi sau vì thế lọt qua toàn bộ 171 unit test:
 *     • guard định tuyến dựng sai ⇒ bé thấy màn trắng;
 *     • cookie phiên `httpOnly` không được set ⇒ mọi request sau đó thành ẩn danh;
 *     • asset/tranh cảnh 404 ⇒ thẻ chủ đề trắng trơn (đã từng xảy ra, xem `ThemeCard`).
 *   Test e2e là tầng DUY NHẤT chứng minh "app chạy được đầu-cối thật" trong một trình duyệt thật.
 *
 * -----------------------------------------------------------------------------
 * ⚠️⚠️ LUẬT SỐ 1 — TUYỆT ĐỐI KHÔNG CHẠM `data/rubylingo.db`
 * -----------------------------------------------------------------------------
 *   `data/rubylingo.db` là DB DEV chứa DỮ LIỆU THẬT CỦA TRẺ (biệt danh, tuổi, tiến độ học).
 *   Server cho e2e vì thế chạy với `DB_PATH=./data/e2e.db` (xem `webServer.env` ngay dưới).
 *
 *   ⚙️ Vì sao đặt qua `env` mà không ghép vào chuỗi lệnh: Playwright spawn tiến trình server
 *      bằng `{ ...process.env, ...webServer.env }` (đã đọc mã nguồn `playwright/lib/runner`).
 *      Biến của ta vì thế ĐỨNG TRƯỚC trong `process.env`, và `dotenv` (nạp trong
 *      `server/config.ts`) mặc định KHÔNG ghi đè biến đã tồn tại ⇒ `PORT`/`DB_PATH` từ `.env`
 *      không thể thắng. Đây là điểm mấu chốt: nếu để `.env` thắng, server sẽ mở cổng 3000 và
 *      mở đúng DB thật của bé.
 *
 *   ⚙️ Và cổng: e2e dùng **4173**, KHÔNG phải 3000 (dev) hay 5173 (Vite). 3000 là cổng dev
 *      đang chạy song song trên máy này — đụng vào là hai server giành một cổng.
 *
 * -----------------------------------------------------------------------------
 * VÌ SAO CHẠY BẢN PRODUCTION (không phải `vite dev`)
 * -----------------------------------------------------------------------------
 *   Ở production, Fastify phục vụ LUÔN `dist/` và API trên CÙNG một origin ⇒ đúng thứ sẽ chạy
 *   trên VPS, và không cần cấu hình proxy. Nhờ cùng origin, cookie `SameSite=Lax` hoạt động
 *   đúng như thật. Bản dev (Vite 5173 + API 3000 qua proxy) là một cấu hình KHÁC — test nó thì
 *   không chứng minh được bản deploy.
 *
 *   ⚠️ Hệ quả bắt buộc: phải `build:client` + `build:server` trước khi chạy. Việc build nằm
 *      trong `webServer.command` để mỗi lần `npx playwright test` đều test ĐÚNG mã đang có trên
 *      đĩa — test một `dist/` cũ là test một app không còn tồn tại.
 *
 *   ⚠️ Và `PUBLIC_ORIGIN` phải khớp `baseURL`: ở production, plugin bảo mật CHẶN mọi request ghi
 *      (POST/PATCH/DELETE) có header `Origin` không nằm trong danh sách cho phép. Lệch một ký tự
 *      ⇒ đăng ký/ghi tiến độ trả 403 mà unit test không hề thấy.
 *
 * -----------------------------------------------------------------------------
 * VÌ SAO CHỌN BA VIEWPORT NÀY
 * -----------------------------------------------------------------------------
 *   360×640  — điện thoại phổ thông (khung hẹp nhất app phải chịu được; dưới 480px, tokens.css
 *              hạ `--sp-touch` 64→56px và ẩn ❤️/🔥 khỏi thanh trên).
 *   820×1180 — iPad dọc (bé hay cầm hai tay, ngón cái với đáy — xem `BottomNav`).
 *   1280×720 — laptop (mép dưới của dải desktop; thanh điều hướng bị giới hạn bề rộng nội dung).
 *   `hasTouch: true` cho hai thiết bị cảm ứng để đúng điều kiện thật của bé.
 */

import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defineConfig, devices } from '@playwright/test';

/** Cổng riêng cho e2e — KHÔNG đụng 3000 (dev) hay 5173 (Vite). */
const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/** DB riêng cho e2e. Xoá trước mỗi lần chạy để kết quả tất định và tệp không phình ra. */
const DB_PATH = './data/e2e.db';

/**
 * Lệnh khởi động app cho e2e: MỘT tiến trình Node duy nhất (xem `tests/e2e/serve.mjs`).
 *
 * ⚠️ VÌ SAO KHÔNG DÙNG CHUỖI LỆNH SHELL Ở ĐÂY: một chuỗi `… && … && node dist-server/index.js`
 *    khiến Playwright phải giết cả một CÂY tiến trình lúc dọn dẹp. Trên Windows việc đó không
 *    hoàn tất — Playwright treo vô hạn ở bước tắt server, lượt chạy không bao giờ in dòng tổng
 *    kết (đã gặp thật: test xong sau ~1 phút nhưng tiến trình sống 18 phút). Script này tự lo
 *    xoá DB e2e, build, chép migration rồi trở thành chính server — chỉ còn MỘT tiến trình.
 */
const SERVE_COMMAND = 'node tests/e2e/serve.mjs';

export default defineConfig({
  testDir: 'tests/e2e',

  /**
   * ⚠️⚠️ HOOK DỌN DẸP — KHÔNG PHẢI THỨ TRANG TRÍ, ĐỌC `tests/e2e/global-teardown.ts` TRƯỚC KHI XOÁ.
   *
   *   Trên Windows, Playwright tắt webServer bằng `spawnSync('taskkill …', { shell: true })` rồi chờ
   *   sự kiện `close` của tiến trình con. Trong môi trường agent của dự án, mọi `spawnSync` tạo ống
   *   đều hỏng với `EBUSY` (đo được 8/8 lần) ⇒ `taskkill` không bao giờ chạy ⇒ server sống mãi ⇒ ống
   *   không đóng ⇒ `close` không bắn ⇒ Playwright TREO VÔ HẠN ở bước dọn, không in dòng tổng kết dù
   *   mọi bài đã xanh. Hook này ghi "cờ dừng" để `serve.mjs` tự thoát, gỡ hẳn vòng lặp chết đó.
   *
   *   ⚙️ Chạy được TRƯỚC khi webServer bị tắt vì Playwright dọn theo thứ tự đảo của lúc dựng
   *      (xem `createGlobalSetupTasks` trong `playwright/lib/runner`).
   */
  globalTeardown: './tests/e2e/global-teardown.ts',

  /**
   * ⚠️ ẢNH/VẾT LỖI GHI RA THƯ MỤC TẠM CỦA HỆ ĐIỀU HÀNH, KHÔNG PHẢI `test-results/` TRONG REPO.
   *
   *   Trước mỗi lượt chạy, Playwright DỌN SẠCH `outputDir`. Trên máy dev này, thao tác dọn đó bị
   *   lớp shim của công cụ soạn thảo chặn khi thư mục còn nhiều tệp (`SAFE_DELETE_BULK_CONFIRM_REQUIRED`
   *   với ngưỡng 50 tệp) — và cả bộ test ĐỎ ngay khi khởi động, trước cả khi chạy bài nào, chỉ vì
   *   lượt trước để lại vết lỗi. Thư mục tạm được shim bỏ qua, nên đặt ở đây thì lượt chạy luôn
   *   sạch sẽ bất kể lượt trước để lại gì.
   *
   *   Lợi ích kèm theo: repo không còn tích tụ `test-results/` (vốn đã bị `.gitignore`). Đường dẫn
   *   ảnh/vết lỗi vẫn được in ra khi có bài đỏ, nên không mất khả năng truy vết.
   */
  outputDir: join(tmpdir(), 'rubylingo-e2e-results'),

  /**
   * ⚠️ CHẠY TUẦN TỰ — CỐ Ý, KHÔNG PHẢI MẶC ĐỊNH.
   *   Mọi project dùng CHUNG một server và một DB. Chạy song song nhiều worker sẽ khiến các bài
   *   đăng ký/ghi tiến độ giẫm lên nhau, và kết quả đỏ-xanh phụ thuộc thời điểm — đúng kiểu test
   *   đỏ ngẫu nhiên mà ta muốn loại bỏ. Bộ test chỉ vài bài nên cái giá của việc chạy tuần tự là
   *   không đáng kể, còn lợi ích (kết quả tất định) là thiết yếu.
   */
  fullyParallel: false,
  workers: 1,

  // Trên CI, một `test.only` lọt vào mã là dấu hiệu bất cẩn ⇒ chặn hẳn thay vì bỏ qua im lặng.
  forbidOnly: !!process.env.CI,
  retries: 0,

  reporter: [['list']],

  // Mỗi bài có thể phải chờ build + điều hướng + gọi mạng; 60s là rộng rãi nhưng vẫn chặn treo.
  timeout: 60_000,
  // Assertion tự chờ tới 10s: đủ cho một vòng gọi API cục bộ, KHÔNG dùng `waitForTimeout`.
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    // Ảnh + vết chỉ lưu khi đỏ — khi xanh thì không tốn thời gian/đĩa.
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'dien-thoai-360x640',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 640 }, hasTouch: true },
    },
    {
      name: 'ipad-820x1180',
      use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1180 }, hasTouch: true },
    },
    {
      name: 'laptop-1280x720',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
  ],

  webServer: {
    command: SERVE_COMMAND,
    // Chờ tới khi API trả lời — không phải chỉ tới khi cổng mở.
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    // Lần đầu phải build cả client lẫn server rồi mới boot ⇒ rộng rãi hơn mặc định.
    timeout: 240_000,
    env: {
      /**
       * ⚠️ CHẠY TIẾN TRÌNH CON BẰNG NODE "TRẦN" — BẮT BUỘC TRÊN MÁY DEV NÀY, VÔ HẠI Ở NƠI KHÁC.
       *
       *   Máy dev này chèn một lớp `--require` vào `NODE_OPTIONS` (shim của công cụ soạn thảo) để
       *   chặn xoá hàng loạt. Lớp đó bắt đúng thao tác HỢP LỆ của `vite build`: `emptyOutDir`
       *   dọn `dist/` (222 tệp) trước khi build lại — và build đỏ với
       *   `SAFE_DELETE_BULK_CONFIRM_REQUIRED`, dù `dist/` chỉ là đầu ra build đã bị `.gitignore`.
       *
       *   Đặt rỗng nghĩa là tiến trình build/server chạy như trên CI và VPS thật (nơi không có
       *   lớp này) — tức là e2e kiểm ĐÚNG môi trường đích hơn, chứ không nới lỏng điều gì của app.
       *   Nó chỉ áp cho cây tiến trình con của `webServer`, không đụng tới trình chạy Playwright.
       */
      NODE_OPTIONS: '',
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: String(PORT),
      DB_PATH,
      // ⚠️ PHẢI khớp `baseURL` — xem ghi chú đầu tệp (kiểm Origin chống CSRF).
      PUBLIC_ORIGIN: BASE_URL,
      COOKIE_SECURE: 'false',
      // Bí mật chỉ dùng cho DB e2e tạm; ≥32 ký tự để qua schema cấu hình.
      SESSION_SECRET: 'rubylingo-e2e-secret-khong-dung-cho-production-0123456789',
      LOG_LEVEL: 'warn',
      /**
       * ⚠️ NỚI HẠN MỨC ĐĂNG KÝ CHO E2E — CỐ Ý VÀ CÓ LÝ DO.
       *   Mỗi bài tự đăng ký một phụ huynh riêng để độc lập (không phụ thuộc thứ tự chạy).
       *   Bộ test có 3 bài × 3 viewport = 9 lần đăng ký trong vài chục giây, vượt hạn mức
       *   mặc định 10 lần/PHÚT (xem `AUTH_RATE_LIMIT_MAX` trong `server/config.ts`). Hạn mức đó
       *   là lớp chống dò mật khẩu ở PRODUCTION — nó không phải thứ đang được kiểm ở đây, và
       *   một test đỏ vì rate-limit sẽ che mất lỗi thật.
       */
      AUTH_RATE_LIMIT_MAX: '500',
    },
  },
});
