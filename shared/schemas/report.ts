/**
 * RubyLingo — Zod schema cho BÁO CÁO PHỤ HUYNH (T073). Dùng chung client + server.
 *
 * ⚠️ CHỈ KIỂM **ĐỊNH DẠNG** Ở ĐÂY, KHÔNG kiểm khoảng ngày.
 *   Việc "khoảng ngày có hợp lệ và có vượt trần không" cần `localDateKey` / `daysBetweenDateKeys`
 *   — mà chúng là hàm của SERVER (`server/lib/time.ts`). `shared/` KHÔNG được import `server/`
 *   (và ngược lại thì được). Nên ở đây chỉ chặn ĐỊNH DẠNG sai (một chuỗi không phải ngày), còn
 *   luật khoảng ngày do `ReportService` áp bằng đúng các hàm thời gian của dự án — tránh dựng
 *   một bản sao phép tính ngày trong `shared/`.
 */

import { z } from 'zod';

/**
 * Một khoá NGÀY theo giờ ĐỊA PHƯƠNG của gia đình: `YYYY-MM-DD`.
 *
 * ⚠️ ĐÚNG định dạng mà `localDateKey` sinh ra và `daily_stats.date` lưu. Nhận cả `YYYY-MM-DD`
 *    "trông đúng" nhưng không có thật (vd `2026-13-40`) ở tầng này — việc chặn ngày vô nghĩa
 *    thuộc về so sánh khoảng (`from <= to`) ở service, nơi có ngữ cảnh.
 */
const dateKeySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo dạng YYYY-MM-DD');

/**
 * Tham số ngày trên query string. BỎ TRỐNG = dùng mặc định của server.
 *
 * ⚠️ `?from=&to=` (có tên nhưng giá trị rỗng) cho ra CHUỖI RỖNG, không phải `undefined`. Nếu để
 *    nguyên, một URL như vậy sẽ bị từ chối oan vì "không phải ngày hợp lệ" — trong khi ý người
 *    gọi rõ ràng là "để mặc định". Quy chuỗi rỗng về `undefined` ngay ở đây.
 */
const optionalDateKey = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : value),
  dateKeySchema.optional(),
);

/**
 * Query của `GET /api/children/:id/report`.
 *
 * `from`/`to` đều tuỳ chọn: thiếu thì server dùng khoảng mặc định (xem `ReportService`), nên
 * client mở báo cáo tuần chỉ cần gọi trần, không phải tự tính ngày.
 */
export const reportQuerySchema = z.object({
  from: optionalDateKey,
  to: optionalDateKey,
});

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
