/**
 * RubyLingo — Zod schema cho CÀI ĐẶT CỦA BÉ (T074). Dùng chung client + server.
 *
 * ⚠️⚠️ TÊN TRƯỜNG LÀ camelCase, KHỚP `SettingsDto` ĐÃ ĐÓNG BĂNG (`shared/types/api.ts`), KHÔNG
 *    phải tên cột snake_case trong DB. Một hợp đồng API có hai cách gọi tên cho cùng một thứ là
 *    cách chắc chắn nhất để client và server lệch nhau — và ở đây còn tệ hơn: `settingsStore`
 *    phía client đã dùng camelCase từ trước.
 *
 * ⚠️ CHỈ 4 TRƯỜNG CÓ THẬT TRONG BẢNG `settings` (`migrations/002_child.sql`):
 *      soundEnabled · musicEnabled · speechRate · reducedMotion
 *    KHÔNG có `daily_time_limit_min` và KHÔNG có `timezone` — cố ý (xem `ReportService`/khoá ngày:
 *    thêm `timezone` là phải định nghĩa lại "ngày của bé" ở MỌI chỗ dùng `localDateKey`, còn
 *    `daily_time_limit_min` chưa có luật thực thi ⇒ sẽ là một cài đặt GIẢ).
 *
 *    ⚠️ Hệ quả của việc `z.object` CẮT khoá lạ: gửi `{ timezone: "…" }` KHÔNG bị bỏ qua im lặng —
 *    nó bị cắt thành `{}`, rồi `refine` bên dưới từ chối (vì "không có thay đổi nào"). Tức một
 *    trường không hỗ trợ bị TỪ CHỐI RÕ RÀNG, thay vì nhận 200 rồi không lưu gì.
 */

import { z } from 'zod';

import { SPEECH_RATE_MAX, SPEECH_RATE_MIN } from '../constants.js';

/**
 * Cập nhật cài đặt — MỌI trường tuỳ chọn, nhưng object rỗng bị từ chối.
 *
 * ⚠️⚠️ ĐÂY LÀ ĐIỂM QUAN TRỌNG NHẤT CỦA ENDPOINT PATCH NÀY — ĐỌC TRƯỚC KHI SỬA:
 *   Mọi trường đều `.optional()` và KHÔNG có `.default()`. Đó là điều kiện để tầng service làm
 *   được cập nhật MỘT PHẦN THẬT: "không gửi" phải phân biệt được với "gửi giá trị mặc định".
 *   Nếu ai đó thêm `.default(...)` vào bất kỳ trường nào, thì một request chỉ gửi `soundEnabled`
 *   sẽ vô tình ĐẶT LẠI các trường kia về mặc định — bé tắt tiếng xong mất luôn tốc độ đọc đã
 *   chỉnh. Lỗi đó không có thông báo nào; chỉ test "gửi MỘT trường ⇒ các trường khác giữ nguyên"
 *   mới bắt được.
 *
 * ⚠️ Từ chối object rỗng: cùng lý do như `updateChildSchema` — một `PATCH` không có gì để sửa
 *    thường là lỗi lập trình ở client (gửi state chưa khởi tạo). Trả 200 rồi không làm gì là
 *    "thành công giả", thứ khiến người ta mất hàng giờ để tìm nguyên nhân.
 */
export const updateSettingsSchema = z
  .object({
    soundEnabled: z
      .boolean({ invalid_type_error: 'Âm thanh chỉ nhận đúng/sai' })
      .optional(),
    musicEnabled: z
      .boolean({ invalid_type_error: 'Nhạc nền chỉ nhận đúng/sai' })
      .optional(),
    /**
     * Tốc độ đọc. Kẹp ĐÚNG khoảng `CHECK (speech_rate >= 0.5 AND speech_rate <= 1.2)` của bảng.
     * Ở đây lệch với SQLite thì lỗi hiện ra thành 500 ở một ô nhập trông hợp lệ — xem ghi chú
     * `SPEECH_RATE_MIN` trong `shared/constants.ts`.
     */
    speechRate: z
      .number({ invalid_type_error: 'Tốc độ đọc phải là một con số' })
      .min(SPEECH_RATE_MIN, `Tốc độ đọc thấp nhất là ${SPEECH_RATE_MIN}`)
      .max(SPEECH_RATE_MAX, `Tốc độ đọc cao nhất là ${SPEECH_RATE_MAX}`)
      .optional(),
    reducedMotion: z
      .boolean({ invalid_type_error: 'Giảm chuyển động chỉ nhận đúng/sai' })
      .optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'Không có thay đổi nào để lưu',
  });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
