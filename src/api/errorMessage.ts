/**
 * RubyLingo — Dịch mã lỗi API sang câu tiếng Việt để hiển thị.
 *
 * ⭐ VÌ SAO DỊCH THEO `code` MÀ KHÔNG HIỂN THỊ THẲNG `message`:
 *   `message` do server sinh và có thể đổi bất cứ lúc nào (sửa câu chữ, đổi ngôn ngữ, thêm
 *   ngữ cảnh). UI cần chuỗi ỔN ĐỊNH. `code` là hợp đồng (`ApiErrorCode` trong shared) nên
 *   dựa vào nó thì đổi câu chữ ở server không làm vỡ giao diện.
 *
 *   Nhưng không phải mã nào cũng cần câu riêng: nhiều mã server đã gửi câu tiếng Việt cụ thể
 *   và hay hơn câu chung. Vì vậy đây là bảng GHI ĐÈ — mã không có trong bảng thì dùng
 *   `message` của server, và nếu cả hai đều không có thì mới tới `error.generic`.
 */

import type { TFunction } from 'i18next';

import type { ApiErrorCode } from '@shared/types/api.js';
import { isApiClientError } from './client.js';

/**
 * Mã lỗi → khoá i18n. Chỉ khai những mã cần câu RIÊNG cho giao diện.
 *
 * Cố ý KHÔNG khai `VALIDATION_FAILED` ở đây: lỗi đó luôn đi kèm `fields` (từng ô nhập một),
 * và form hiển thị lỗi ngay dưới ô nhập — xem `apiFieldErrors()`. Một câu chung ở đầu form
 * chỉ làm nhiễu thêm.
 */
const CODE_TO_KEY: Partial<Record<ApiErrorCode, string>> = {
  UNAUTHENTICATED: 'apiError.sessionExpired',
  INVALID_CREDENTIALS: 'auth.loginFailed',
  RATE_LIMITED: 'apiError.rateLimited',
  EMAIL_TAKEN: 'apiError.emailTaken',
  CHILD_NOT_FOUND: 'apiError.childNotFound',
  INTERNAL_ERROR: 'apiError.serverBusy',
  /**
   * Nhập sai PIN ở cổng phụ huynh (T072). Dùng câu của UI thay vì `message` của server để câu
   * luôn "mời thử lại", không trách móc — và ổn định dù server đổi câu chữ.
   */
  INVALID_PIN: 'parent.pinWrong',
};

/**
 * Câu thông báo cho người dùng, từ bất kỳ lỗi nào.
 *
 * Nhận `unknown` (không phải `ApiClientError`) vì React Query truyền lỗi dưới dạng `unknown`
 * — hàm này phải chịu được cả lỗi lập trình, không được ném tiếp.
 */
export function apiErrorMessage(err: unknown, t: TFunction): string {
  if (!isApiClientError(err)) {
    return t('error.generic');
  }

  // Mất mạng / hết thời gian chờ: câu riêng, vì cách xử lý khác hẳn (giữ dữ liệu, thử lại).
  if (err.isNetworkError) return t('error.network');

  const key = CODE_TO_KEY[err.code];
  if (key) return t(key);

  // `message` của server là tiếng Việt và cụ thể hơn câu chung ⇒ ưu tiên nó.
  if (err.message) return err.message;

  return t('error.generic');
}

/**
 * Lỗi theo từng ô nhập, để form hiển thị ngay dưới ô tương ứng.
 *
 * Trả `undefined` khi không có — chỗ gọi không phải kiểm `Object.keys().length`.
 */
export function apiFieldErrors(err: unknown): Record<string, string> | undefined {
  if (!isApiClientError(err) || !err.fields) return undefined;
  return Object.keys(err.fields).length > 0 ? err.fields : undefined;
}

/** `true` nếu lỗi nghĩa là "chưa đăng nhập" — trường hợp BÌNH THƯỜNG khi tải lại trang. */
export function isUnauthenticated(err: unknown): boolean {
  return isApiClientError(err) && err.code === 'UNAUTHENTICATED';
}
