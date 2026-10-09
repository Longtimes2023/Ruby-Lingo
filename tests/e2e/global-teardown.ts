/**
 * RubyLingo — dọn dẹp CUỐI bộ test e2e (T081).
 *
 * ⚠️⚠️ VÌ SAO TỆP NÀY TỒN TẠI — ĐỌC TRƯỚC KHI SỬA
 *
 *   Trên Windows, Playwright tắt webServer bằng `spawnSync('taskkill …', { shell: true })` rồi CHỜ
 *   sự kiện `close` của tiến trình con (đọc `playwright-core/lib/coreBundle.js` hàm `launchProcess`).
 *   Trong môi trường agent của dự án, MỌI `spawnSync` tạo ống đều hỏng với `EBUSY` (đã đo 8/8 lần:
 *   `err=spawnSync …cmd.exe EBUSY`) — kể cả chính `taskkill`. Nghĩa là `taskkill` KHÔNG BAO GIỜ chạy,
 *   server không bao giờ bị giết, ống stdout/stderr không đóng, `close` không bắn, và Playwright
 *   TREO VÔ HẠN ở bước dọn — lượt chạy không bao giờ in dòng tổng kết dù mọi bài đã xanh.
 *
 *   Ta không sửa được mã Playwright, nên ta ĐẢO CHIỀU: SERVER TỰ THOÁT. Hook này ghi một "cờ dừng"
 *   vào thư mục tạm; `tests/e2e/serve.mjs` đang canh cờ đó sẽ `process.exit(0)`. Server chết ⇒ ống
 *   đóng ⇒ `close` bắn ⇒ Playwright dọn xong tức thì.
 *
 *   ⚙️ Vì sao là `globalTeardown` chứ không phải thứ khác: Playwright chạy các hook dọn theo thứ tự
 *      ĐẢO của lúc dựng (xem `createGlobalSetupTasks`), nên `globalTeardown` chạy TRƯỚC khi webServer
 *      bị tắt. Đó chính là thời điểm ta cần. Nếu để server tự thoát ở `onEnd` của reporter hay ở
 *      `afterAll`, thời điểm không đảm bảo và có thể vẫn treo.
 *
 *   ⚠️ Đường dẫn cờ PHẢI trùng `STOP_FILE` trong `tests/e2e/serve.mjs`. Đổi một bên là hỏng cả cơ chế.
 *
 *   Hook này KHÔNG phụ thuộc hệ điều hành: trên CI/Linux nó vẫn chạy vô hại (server thoát trước khi
 *   Playwright kịp gửi tín hiệu), nên hành vi nhất quán ở mọi nơi.
 */

import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default function globalTeardown(): void {
  writeFileSync(join(tmpdir(), 'rubylingo-e2e-stop'), 'stop', 'utf8');
}
