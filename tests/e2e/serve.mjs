/**
 * RubyLingo — khởi động app cho bộ test e2e, TRONG MỘT TIẾN TRÌNH NODE DUY NHẤT.
 *
 * ⚠️⚠️ VÌ SAO PHẢI LÀ MỘT TIẾN TRÌNH, KHÔNG PHẢI MỘT CHUỖI LỆNH SHELL
 *   `webServer.command` từng là một chuỗi `node -e … && npm run build:client && … && node
 *   dist-server/index.js`. Chuỗi đó chạy được, nhưng khi Playwright TẮT server ở cuối lượt, nó
 *   phải giết cả một CÂY tiến trình (cmd.exe → npm → node). Trên Windows, việc đó không hoàn tất:
 *   Playwright treo vô hạn ở bước dọn dẹp, lượt chạy **không bao giờ kết thúc** và không in dòng
 *   tổng kết — dù mọi bài test đã xanh. Triệu chứng đã gặp thật: test xong sau ~1 phút nhưng tiến
 *   trình còn sống 18 phút.
 *
 *   Gói tất cả vào MỘT tiến trình Node: Playwright chỉ phải giết đúng một tiến trình, và tiến
 *   trình đó CHÍNH LÀ server. Hết cây, hết treo.
 *
 * ⚠️⚠️ VÌ SAO SERVER TỰ THOÁT (đọc kỹ — đây là chỗ hiểm nhất của cả tầng e2e)
 *   Trên Windows, Playwright KHÔNG tắt êm được webServer (`attemptToGracefullyClose` ném
 *   "Graceful shutdown is not supported on Windows"), nên nó gọi `taskkill` qua
 *   `spawnSync('taskkill /pid … /T /F', { shell: true })` rồi CHỜ sự kiện `close` của tiến trình
 *   con (xem `playwright-core/lib/coreBundle.js` hàm `launchProcess`).
 *
 *   Trong môi trường agent của dự án, MỌI `spawnSync` tạo ống (pipe) đều hỏng với `EBUSY` — kể cả
 *   `spawnSync('taskkill', …)`. Đã đo: 8/8 lần đều `err=spawnSync …cmd.exe EBUSY`. Nghĩa là
 *   `taskkill` KHÔNG BAO GIỜ chạy ⇒ server không bao giờ bị giết ⇒ ống stdout/stderr của
 *   Playwright không bao giờ đóng ⇒ `close` không bao giờ bắn ⇒ Playwright TREO VÔ HẠN ở bước dọn.
 *
 *   Vì ta không sửa được mã Playwright, ta đảo chiều: SERVER TỰ THOÁT. Cuối lượt chạy,
 *   `globalTeardown` (chạy TRƯỚC khi webServer bị tắt — Playwright chạy teardown theo thứ tự đảo
 *   của setup) ghi một "cờ dừng" vào thư mục tạm; vòng lặp dưới đây thấy cờ thì `process.exit(0)`.
 *   Server chết ⇒ ống đóng ⇒ `close` bắn ⇒ Playwright dọn xong tức thì, không cần `taskkill`.
 *
 *   Cách này cũng đúng trên CI/Linux: ở đó `taskkill` không tồn tại nhưng cơ chế cờ dừng vẫn chạy,
 *   nên hành vi nhất quán ở mọi nơi.
 *
 * ⚠️ VÀ VÌ SAO BUILD GHI LOG RA TỆP, KHÔNG DÙNG `stdio: 'inherit'`
 *   `stdio: 'inherit'` khiến tiến trình cháu của build (đặc biệt là dịch vụ `esbuild.exe` do Vite
 *   sinh ra) thừa hưởng ống của Playwright và giữ nó mở lâu hơn cha. Ghi log ra TỆP thì không có
 *   ống nào để giữ. Vẫn giữ được log build để còn chẩn đoán khi build đỏ.
 *
 * ⚠️ VÀ VÌ SAO BUILD Ở ĐÂY (chứ không đòi người dùng build trước):
 *   e2e phải kiểm ĐÚNG mã đang có trên đĩa. Nếu dùng lại `dist/` cũ, ta đang kiểm một app không
 *   còn tồn tại — và mọi kết luận "xanh" đều vô nghĩa. Build nằm trong luồng khởi động để
 *   `npm run test:e2e` là đủ, không cần nhớ bước nào. (Không thể đẩy build sang `globalSetup`:
 *   Playwright chạy plugin webServer TRƯỚC globalSetup — xem `createGlobalSetupTasks`.)
 *
 * ⚠️⚠️ DB RIÊNG — LUẬT SỐ 1 (xem `playwright.config.ts`): biến môi trường do Playwright truyền
 *   vào (`DB_PATH=./data/e2e.db`, `PORT=4173`, `PUBLIC_ORIGIN=…`) có mặt trong `process.env`
 *   TRƯỚC khi `dotenv` chạy trong `server/config.ts`, và `dotenv` KHÔNG ghi đè biến đã tồn tại.
 *   Nhờ vậy server dùng DB e2e, không bao giờ chạm `data/rubylingo.db` (dữ liệu thật của trẻ).
 */

import { spawnSync } from 'node:child_process';
import { closeSync, cpSync, existsSync, openSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Log build để NGOÀI repo (thư mục tạm HĐH) — không bẩn cây làm việc, không bị git thấy. */
const BUILD_LOG = resolve(tmpdir(), 'rubylingo-e2e-build.log');

/**
 * "Cờ dừng" — PHẢI trùng đường dẫn với `tests/e2e/global-teardown.ts` (đổi một bên là hỏng cả cơ chế).
 * Đặt ở thư mục tạm HĐH để không bao giờ lọt vào git và không đụng ai khác.
 */
const STOP_FILE = resolve(tmpdir(), 'rubylingo-e2e-stop');

/** Ngủ đồng bộ vài mili-giây (Node không có sẵn) — dùng cho việc thử lại khi tệp còn bị khoá. */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Xoá DB e2e cũ để mỗi lượt chạy bắt đầu sạch và tệp không phình ra.
 *
 * KHÔNG NÉM LỖI nếu tệp còn bị giữ: một server sót lại từ lượt bị hủy có thể đang giữ tệp
 * (`EBUSY` trên Windows). Thử lại vài lần rồi đi tiếp — SQLite vẫn mở được tệp đang dùng chung, và
 * mỗi bài tự đăng ký email riêng nên dữ liệu sót lại không làm test đỏ. Làm test đỏ vì dọn dẹp
 * hỏng còn tệ hơn là bỏ qua việc dọn.
 */
function resetE2eDb() {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = resolve(`data/e2e.db${suffix}`);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        rmSync(file, { force: true });
        break;
      } catch {
        if (attempt === 9) {
          process.stderr.write(`[e2e] Bỏ qua: không xoá được ${file} (có thể đang bị giữ).\n`);
        } else {
          sleepSync(200);
        }
      }
    }
  }
}

/**
 * Chạy một lệnh npm và DỪNG NGAY nếu lệnh đó đỏ — build hỏng thì không có gì để test.
 *
 * Ghi stdout/stderr vào TỆP (không phải ống) để không tiến trình cháu nào giữ được ống của
 * Playwright; xem khối chú thích đầu tệp. Khi lệnh đỏ, in log ra stderr để còn biết vì sao.
 */
function runOrExit(command) {
  const fd = openSync(BUILD_LOG, 'a');
  let result;
  try {
    result = spawnSync(command, { shell: true, stdio: ['ignore', fd, fd] });
  } finally {
    closeSync(fd);
  }
  if (result.status !== 0) {
    process.stderr.write(readFileSync(BUILD_LOG, 'utf8'));
    process.stderr.write(`\n[e2e] Lệnh build thất bại (exit ${result.status}): ${command}\n`);
    process.exit(result.status ?? 1);
  }
}

/** Dọn cờ dừng cũ TRƯỚC khi lên sóng — nếu không, server vừa bật đã tự tắt vì cờ của lượt trước. */
rmSync(STOP_FILE, { force: true });

resetE2eDb();

runOrExit('npm run build:client');
runOrExit('npm run build:server');

/**
 * Chép migration vào cạnh bundle — ĐÚNG như `Dockerfile` làm ở stage runtime.
 *
 * ⚠️ BẮT BUỘC: `server/db/migrate.ts` giải thư mục migration bằng
 *    `join(dirname(fileURLToPath(import.meta.url)), 'migrations')`, và esbuild GIỮ NGUYÊN
 *    `import.meta.url`. Khi chạy `node dist-server/index.js`, đường dẫn là `dist-server/migrations`.
 *    Thiếu nó ⇒ server DỪNG khi boot với "Không tìm thấy thư mục migration".
 */
cpSync(resolve('server/db/migrations'), resolve('dist-server/migrations'), { recursive: true });

/**
 * Vòng lặp canh cờ dừng. `unref()` để nó KHÔNG giữ tiến trình sống — chỉ có socket của server làm
 * điều đó; nếu server tự đóng, tiến trình vẫn thoát được ngay.
 */
setInterval(() => {
  if (existsSync(STOP_FILE)) {
    process.exit(0);
  }
}, 200).unref();

// Nạp bundle server TRONG CHÍNH tiến trình này ⇒ tiến trình này trở thành server.
await import(pathToFileURL(resolve('dist-server/index.js')).href);
