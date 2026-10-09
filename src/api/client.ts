/**
 * RubyLingo — ApiClient: lớp mỏng bọc `fetch` cho MỌI giao tiếp với server.
 *
 * ⭐ VÌ SAO CẦN LỚP NÀY (thay vì gọi `fetch` rải rác):
 *   Server luôn trả về một trong hai hình dạng cố định:
 *       thành công → { data: <payload> }
 *       thất bại   → { error: { code, message, fields? } }
 *   Nếu mỗi chỗ gọi tự `fetch` thì mỗi chỗ phải tự nhớ `credentials: 'include'`, tự kiểm
 *   `res.ok`, tự bóc `data`, tự đoán xem lỗi có phải JSON không. Chỉ cần MỘT chỗ quên là
 *   cookie phiên không được gửi và người dùng bị đăng xuất "ngẫu nhiên" — lỗi rất khó truy.
 *   Gói tất cả vào đây thì chỉ có một chỗ để đúng.
 *
 * ⭐ `credentials: 'include'` LÀ BẮT BUỘC, KHÔNG PHẢI TUỲ CHỌN:
 *   Phiên nằm trong cookie `httpOnly` do server đặt. Ở dev, client (5173) và server (3000)
 *   khác cổng; `fetch` mặc định KHÔNG gửi cookie qua request cross-origin ⇒ mọi request
 *   đều là ẩn danh. Vite proxy `/api` giúp cùng origin, nhưng vẫn phải khai `credentials`.
 *
 * ⚙️ KHÔNG CÓ `baseUrl` CẤU HÌNH ĐƯỢC — cố ý:
 *   Dev dùng Vite proxy `/api` → server; production server phục vụ luôn `dist/` nên cũng
 *   same-origin. Luôn là `/api`. Thêm biến môi trường chỉ tạo thêm một cách để cấu hình sai
 *   (và mở đường cho CORS, thứ kiến trúc này đang tránh).
 */

import type { ApiError, ApiErrorCode, ApiResult } from '@shared/types/api.js';
import { API_ERROR_CODES, isApiError } from '@shared/types/api.js';

const API_BASE = '/api';

/** Thời gian chờ mặc định cho một request. Xem ghi chú ở `request()`. */
const DEFAULT_TIMEOUT_MS = 15_000;

/** Tập mã lỗi hợp lệ, để phát hiện server trả về mã mà client chưa biết. */
const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set<string>(API_ERROR_CODES);

/**
 * Lỗi từ tầng API.
 *
 * `code` là thứ UI dùng để dịch sang câu tiếng Việt (`errorMessage()`), KHÔNG phải `message`
 * — vì `message` do server sinh và có thể đổi mà không báo trước.
 */
export class ApiClientError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fields: Record<string, string> | undefined;
  /**
   * `true` khi KHÔNG nhận được phản hồi nào từ server (mất mạng, server tắt, hết thời gian
   * chờ). Phân biệt với lỗi 4xx/5xx vì cách xử lý khác hẳn: mất mạng thì nên thử lại và
   * giữ dữ liệu tại chỗ, còn 4xx thì thử lại cũng vô ích.
   */
  readonly isNetworkError: boolean;

  constructor(
    code: ApiErrorCode,
    message: string,
    status: number,
    options: { fields?: Record<string, string>; isNetworkError?: boolean } = {},
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.fields = options.fields;
    this.isNetworkError = options.isNetworkError ?? false;
  }
}

export interface RequestOptions {
  /** Tín hiệu huỷ — React Query truyền vào để huỷ request khi component unmount. */
  signal?: AbortSignal | undefined;
  timeoutMs?: number | undefined;
}

/**
 * Gộp tín hiệu huỷ của người gọi với đồng hồ hết thời gian chờ.
 *
 * Dùng `addEventListener('abort')` thay vì `AbortSignal.any()`: `AbortSignal.any` chỉ có từ
 * Safari 17.4, mà iPad/iPhone cũ vẫn nằm trong nhóm thiết bị mục tiêu của app này.
 */
function withTimeout(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void; didTimeout: () => boolean } {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', onCallerAbort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    },
    didTimeout: () => timedOut,
  };
}

/** Ép một mã lỗi bất kỳ về `ApiErrorCode` — mã lạ ⇒ `INTERNAL_ERROR` (không tin server mù quáng). */
function toErrorCode(raw: unknown): ApiErrorCode {
  return typeof raw === 'string' && KNOWN_ERROR_CODES.has(raw)
    ? (raw as ApiErrorCode)
    : 'INTERNAL_ERROR';
}

/**
 * Đọc thân phản hồi thành JSON, chịu được cả trường hợp KHÔNG phải JSON.
 *
 * Vì sao không dùng `res.json()` thẳng: khi server sập hoặc bị proxy chặn, thân phản hồi có
 * thể là trang HTML của lỗi 502. `res.json()` khi đó ném `SyntaxError` — một lỗi trông như
 * bug của client, trong khi vấn đề thật nằm ở hạ tầng.
 */
async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (text === '') return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Gọi một endpoint và trả về `data` đã bóc vỏ. Ném `ApiClientError` cho mọi trường hợp lỗi. */
async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const { signal, cleanup, didTimeout } = withTimeout(
    options.signal,
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      // BẮT BUỘC: xem ghi chú đầu file. Thiếu dòng này là mọi request thành ẩn danh.
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal,
    });
  } catch (err) {
    // ⚠️ Huỷ do người gọi (unmount, đổi tham số) KHÔNG phải lỗi — phải ném nguyên trạng để
    // React Query nhận ra và bỏ qua. Nuốt nó thành ApiClientError sẽ biến việc huỷ bình
    // thường thành một lỗi hiển thị cho người dùng.
    if (err instanceof Error && err.name === 'AbortError') {
      if (didTimeout()) {
        throw new ApiClientError(
          'INTERNAL_ERROR',
          'Máy chủ phản hồi quá lâu',
          0,
          { isNetworkError: true },
        );
      }
      throw err;
    }
    throw new ApiClientError('INTERNAL_ERROR', 'Không kết nối được máy chủ', 0, {
      isNetworkError: true,
    });
  } finally {
    cleanup();
  }

  const payload = await readJson(res);

  // Lỗi có mã rõ ràng từ server.
  if (payload !== null && isApiError(payload as ApiResult<unknown>)) {
    const apiError = payload as ApiError;
    throw new ApiClientError(
      toErrorCode(apiError.error?.code),
      apiError.error?.message ?? 'Có lỗi xảy ra',
      res.status,
      { fields: apiError.error?.fields },
    );
  }

  // Phản hồi không đúng hình dạng (HTML của 502, thân rỗng khi 500...).
  if (!res.ok) {
    throw new ApiClientError(
      res.status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_FAILED',
      `Máy chủ trả về mã ${res.status}`,
      res.status,
      { isNetworkError: res.status >= 500 },
    );
  }

  const ok = payload as { data?: T } | null;
  if (ok === null || typeof ok !== 'object' || !('data' in ok)) {
    throw new ApiClientError('INTERNAL_ERROR', 'Máy chủ trả về dữ liệu không hợp lệ', res.status);
  }
  return ok.data as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions): Promise<T> =>
    request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    request<T>('POST', path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    request<T>('PATCH', path, body, options),
  del: <T>(path: string, options?: RequestOptions): Promise<T> =>
    request<T>('DELETE', path, undefined, options),
};

/** Type guard tiện dụng cho UI. */
export function isApiClientError(err: unknown): err is ApiClientError {
  return err instanceof ApiClientError;
}
