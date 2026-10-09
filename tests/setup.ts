/**
 * Thiết lập môi trường test cho Vitest.
 *
 * 1. Nạp matcher của jest-dom (toBeInTheDocument, toHaveTextContent...) — cho test UI.
 * 2. Cấp giá trị MẶC ĐỊNH cho các biến môi trường bắt buộc — cho test server.
 *
 * ⚠️ VÌ SAO PHẢI CẤP MẶC ĐỊNH Ở ĐÂY:
 *   `server/config.ts` gọi `process.exit(1)` khi thiếu cấu hình bắt buộc. Trên máy dev thì
 *   `.env` có sẵn nên không sao, nhưng `.env` bị gitignore ⇒ trên CI (hoặc máy mới clone)
 *   KHÔNG có file đó. Khi ấy chỉ cần một test import `server/**` là cả tiến trình Vitest
 *   thoát ngay với mã 1, và thông báo lỗi trông như thể "test hỏng" chứ không phải
 *   "thiếu cấu hình".
 *
 * ⚠️ VÌ SAO GHI ĐÈ ĐƯỢC GIÁ TRỊ TRONG `.env`:
 *   `dotenv` mặc định KHÔNG ghi đè biến đã tồn tại trong `process.env`. Setup file chạy
 *   TRƯỚC khi test file được nạp ⇒ giá trị đặt ở đây thắng giá trị trong `.env`.
 *   Đây chính là điều ta muốn: test phải dùng DB riêng, không được đụng vào DB thật.
 *
 * ⚠️ `DB_PATH` trỏ vào file TẠM có tên ngẫu nhiên: nếu dùng chung `data/rubylingo.db` thì
 *   một lần chạy test sẽ xoá sạch dữ liệu học của các bé đang dùng app thật.
 */

import '@testing-library/jest-dom/vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Chỉ đặt nếu chưa có — cho phép người dùng ghi đè bằng biến môi trường khi cần gỡ lỗi. */
function defaultEnv(key: string, value: string): void {
  if (!process.env[key]) process.env[key] = value;
}

defaultEnv('NODE_ENV', 'test');
// Chuỗi mẫu 48 ký tự — chỉ dùng trong test, không bao giờ chạy ở production.
defaultEnv('SESSION_SECRET', 'test-only-session-secret-0123456789-abcdefghijklmnop');
defaultEnv('COOKIE_SECURE', 'false');
defaultEnv('PUBLIC_ORIGIN', 'http://localhost:5173');
// 'error' thay vì 'debug': log của pino trong test chỉ làm rối output.
defaultEnv('LOG_LEVEL', 'error');

/**
 * ⚠️⚠️ NỚI RATE-LIMIT ĐĂNG KÝ/ĐĂNG NHẬP TRONG TEST — ĐỌC TRƯỚC KHI "SỬA LẠI CHO ĐÚNG".
 *
 *   Giá trị thật là 10 lần/phút (xem `.env`). Một file test ở tầng HTTP thường phải đăng ký
 *   hàng chục tài khoản — mỗi test một tài khoản mới, vì `beforeEach` xoá sạch DB.
 *
 *   Hậu quả khi để nguyên 10: từ tài khoản thứ 11 trở đi, request bị chặn và trả về 429.
 *   Test sẽ đỏ ở những dòng KHÔNG LIÊN QUAN GÌ tới rate-limit (`expect(res.statusCode).toBe(201)`
 *   trong hàm `signup()`), và người đọc log rất dễ kết luận sai rằng "API đăng ký hỏng".
 *   Đây đúng là chuyện đã xảy ra khi viết `progress-routes.test.ts`.
 *
 *   Nới ở đây KHÔNG làm mất khả năng kiểm rate-limit: hành vi đó được kiểm riêng trong
 *   `tests/unit/server/rate-limit-response.test.ts`, nơi tự đặt lại giá trị nhỏ TRƯỚC khi
 *   nạp `server/config.ts`. Xem ghi chú ở file đó.
 */
defaultEnv('AUTH_RATE_LIMIT_MAX', '10000');

// Thư mục tạm riêng cho MỖI lần chạy test ⇒ không đụng DB thật, không đụng lần chạy trước.
const testDataDir = mkdtempSync(join(tmpdir(), 'rubylingo-test-'));
process.env['DB_PATH'] = join(testDataDir, 'test.db');
