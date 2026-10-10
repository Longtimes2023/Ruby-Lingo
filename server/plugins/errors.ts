/**
 * RubyLingo — Plugin xử lý lỗi.
 *
 * Mọi lỗi trả về client theo MỘT hình dạng duy nhất:
 *     { error: { code, message, fields? } }
 *
 * Vì sao cần chuẩn hoá: client chỉ phải viết một hàm `unwrap()` duy nhất, và `code`
 * là thứ UI dùng để dịch sang câu tiếng Việt thân thiện với bé/phụ huynh.
 *
 * Quan trọng: lỗi 500 KHÔNG bao giờ lộ chi tiết nội bộ ra ngoài (stack, câu SQL...)
 * — chỉ ghi vào log. Client chỉ nhận câu chung.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import type { ApiError, ApiErrorCode } from '../../shared/types/api.js';
import { API_ERROR_CODES } from '../../shared/types/api.js';
import { logger } from '../lib/logger.js';
import { config } from '../config.js';

/** Lỗi nghiệp vụ có mã lỗi xác định — service ném lỗi này. */
export class AppError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly statusCode: number = 400,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Tiện ích tạo lỗi nhanh — dùng ở tầng service. */
export const errors = {
  validation: (message: string, fields?: Record<string, string>) =>
    new AppError('VALIDATION_FAILED', message, 400, fields),
  invalidCredentials: () =>
    new AppError('INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng', 401),
  weakPassword: (message = 'Mật khẩu cần dài ít nhất 8 ký tự') =>
    new AppError('WEAK_PASSWORD', message, 400),
  emailTaken: () => new AppError('EMAIL_TAKEN', 'Email này đã được dùng để tạo tài khoản', 409),
  unauthenticated: () => new AppError('UNAUTHENTICATED', 'Bố mẹ cần đăng nhập lại nhé', 401),
  forbidden: () => new AppError('FORBIDDEN', 'Bố mẹ không có quyền xem dữ liệu này', 403),
  notFound: (what = 'Không tìm thấy dữ liệu') => new AppError('NOT_FOUND', what, 404),
  childNotFound: () => new AppError('CHILD_NOT_FOUND', 'Không tìm thấy hồ sơ của bé', 404),
  itemNotFound: () => new AppError('ITEM_NOT_FOUND', 'Không tìm thấy vật phẩm này', 404),
  /**
   * Nhiệm vụ không có trong `shared/content/quests.json`.
   *
   * ⚠️ Khác hẳn `questNotComplete()`: đây là "id gửi lên không tồn tại" (client cũ, URL gõ sai,
   *    hoặc một nhiệm vụ vừa bị xoá khỏi danh mục), KHÔNG phải "bé chưa làm xong". Gộp hai
   *    trường hợp này thành một câu sẽ khiến một lỗi lập trình hiện ra như một lời trách bé.
   */
  questNotFound: () => new AppError('QUEST_NOT_FOUND', 'Không tìm thấy nhiệm vụ này', 404),
  insufficientFunds: () =>
    new AppError('INSUFFICIENT_FUNDS', 'Bé chưa đủ tiền để mua món này', 409),
  alreadyClaimed: () => new AppError('ALREADY_CLAIMED', 'Phần thưởng này đã được nhận rồi', 409),
  questNotComplete: () => new AppError('QUEST_NOT_COMPLETE', 'Nhiệm vụ chưa hoàn thành', 409),
  /**
   * Cổng vào bài thi cuối khoá CHƯA MỞ (bé chưa học hết / chưa chơi hết).
   *
   * ⚠️ Câu chữ KHÔNG mắng bé và KHÔNG nói "con còn thiếu X" — client đã có `gate.requirement`
   *    để nói con số một cách nhẹ nhàng. Đây chỉ là câu chung khi ai đó gọi thẳng API.
   */
  finalTestLocked: () =>
    new AppError('FINAL_TEST_LOCKED', 'Khu vực thi chưa mở — bé cần học và chơi hết trước nhé', 409),
  invalidPin: () => new AppError('INVALID_PIN', 'Mã PIN không đúng', 403),
  parentGateRequired: () => new AppError('PARENT_GATE_REQUIRED', 'Cần nhập mã PIN phụ huynh', 403),
  rateLimited: () => new AppError('RATE_LIMITED', 'Bố mẹ thử lại sau một lát nhé', 429),
  /**
   * Lỗi nội bộ — dùng khi server phát hiện trạng thái KHÔNG THỂ XẢY RA.
   *
   * ⚠️ Dùng cho những nhánh mà "nếu chạy tới đây thì logic ở trên đã sai". Ném ra để lỗi nổi
   *    lên thành 500 và vào log, KHÔNG được nuốt thành một giá trị mặc định: một con số 0 hay
   *    một mảng rỗng trả về trong tình huống này sẽ che mất bug vĩnh viễn.
   *
   * `message` ở đây là tiếng Việt vì nó có thể tới tay phụ huynh qua thông báo lỗi chung; chi
   * tiết kỹ thuật để dành cho log.
   */
  internal: (message = 'Có lỗi xảy ra ở máy chủ, bố mẹ thử lại nhé') =>
    new AppError('INTERNAL_ERROR', message, 500),
} as const;

/** Hình dạng lỗi Fastify có `statusCode` sẵn. */
interface FastifyLikeError extends Error {
  statusCode?: number;
  code?: string;
}

/**
 * Mã lỗi ⇒ mã HTTP. Khai bằng `Record<ApiErrorCode, number>` để TypeScript BẮT BUỘC điền
 * đủ: thêm một mã lỗi mới vào `API_ERROR_CODES` mà quên ở đây sẽ là lỗi biên dịch, không
 * phải một lỗi 500 lúc chạy.
 */
const STATUS_BY_CODE: Readonly<Record<ApiErrorCode, number>> = {
  VALIDATION_FAILED: 400,
  WEAK_PASSWORD: 400,
  INVALID_CREDENTIALS: 401,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  INVALID_PIN: 403,
  PARENT_GATE_REQUIRED: 403,
  NOT_FOUND: 404,
  CHILD_NOT_FOUND: 404,
  ITEM_NOT_FOUND: 404,
  QUEST_NOT_FOUND: 404,
  EXERCISE_NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  INSUFFICIENT_FUNDS: 409,
  QUEST_NOT_COMPLETE: 409,
  ALREADY_CLAIMED: 409,
  NOT_ENOUGH_HAPPINESS: 409,
  FINAL_TEST_LOCKED: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  DB_ERROR: 500,
};

const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set<string>(API_ERROR_CODES);

/**
 * Nhận ra một giá trị ĐÃ MANG SẴN hình dạng response lỗi của RubyLingo:
 *     `{ error: { code: 'RATE_LIMITED', message: '...' } }`
 *
 * ⚠️⚠️ VÌ SAO CẦN HÀM NÀY — ĐÂY LÀ MỘT LỖI THẬT ĐÃ XẢY RA, KHÔNG PHẢI PHÒNG XA:
 *
 *   `@fastify/rate-limit` **THROW** kết quả của `errorResponseBuilder`, nó KHÔNG `send`
 *   (xem `node_modules/@fastify/rate-limit/index.js`, dòng 261:
 *   `throw params.errorResponseBuilder(req, respCtx)`).
 *
 *   `errorResponseBuilder` của dự án trả về một object thuần `{ error: { code, message } }`.
 *   Một object thuần KHÔNG có `.message`, KHÔNG có `.statusCode`, KHÔNG có `.code` — nên nó
 *   rơi xuống nhánh cuối của handler này và bị biến thành:
 *
 *       500 { error: { code: 'INTERNAL_ERROR', message: 'Lỗi nội bộ: undefined' } }
 *
 *   Nghĩa là: khi phụ huynh gõ sai mật khẩu quá 10 lần trong một phút, thay vì nhận câu
 *   "Bố mẹ đã thử quá nhiều lần. Vui lòng chờ một lát rồi thử lại nhé." (429), họ nhận
 *   "Có lỗi xảy ra ở máy chủ" (500). Câu trả lời đúng đã được viết ra, được gửi vào hàm
 *   builder, rồi bị chính handler này vứt đi.
 *
 *   Và nó còn làm log đầy lỗi 500 giả — loại nhiễu khiến người trực hệ thống bỏ qua lỗi
 *   500 thật.
 *
 *   Đây là kiểu lỗi mà `typecheck` và `lint` không thể bắt: hình dạng dữ liệu sai ở RUNTIME.
 *   `tests/unit/server/rate-limit-response.test.ts` khoá hành vi này lại.
 */
function asPreShapedApiError(value: unknown): ApiError | null {
  if (typeof value !== 'object' || value === null) return null;

  const inner = (value as { error?: unknown }).error;
  if (typeof inner !== 'object' || inner === null) return null;

  const { code, message, fields } = inner as {
    code?: unknown;
    message?: unknown;
    fields?: unknown;
  };

  // Chỉ nhận mã lỗi mà client BIẾT. Một mã lạ sẽ làm `errorMessage()` ở client rơi về câu
  // chung chung — tốt hơn là để nó rơi xuống nhánh 500 và mất luôn cả `code`.
  if (typeof code !== 'string' || !KNOWN_ERROR_CODES.has(code)) return null;
  if (typeof message !== 'string') return null;

  return {
    error: {
      code: code as ApiErrorCode,
      message,
      ...(typeof fields === 'object' && fields !== null
        ? { fields: fields as Record<string, string> }
        : {}),
    },
  };
}

/**
 * Lấy câu mô tả lỗi một cách AN TOÀN.
 *
 * ⚠️ VÌ SAO KHÔNG DÙNG THẲNG `error.message`:
 *   Không phải mọi thứ được `throw` đều là `Error`. `@fastify/rate-limit` ném một object
 *   thuần, nên `error.message` là `undefined` — và đó chính là cách lỗi 429 trước đây biến
 *   thành câu vô nghĩa `"Lỗi nội bộ: undefined"`. Một thông báo lỗi không đọc được còn tệ
 *   hơn không có thông báo nào, vì nó khiến người đọc tin rằng đã có thông tin.
 */
function safeMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === 'string' && error.message !== '') {
    return error.message;
  }
  if (typeof error === 'string' && error !== '') return error;
  return 'Không xác định được nguyên nhân';
}

/** Ánh xạ mã lỗi nội bộ của Fastify sang mã lỗi của RubyLingo. */
function mapFastifyCode(code: string | undefined): ApiErrorCode | null {
  switch (code) {
    case 'FST_ERR_VALIDATION':
      return 'VALIDATION_FAILED';
    case 'FST_ERR_CTP_EMPTY_JSON_BODY':
    case 'FST_ERR_CTP_INVALID_JSON_BODY':
    case 'FST_ERR_CTP_INVALID_MEDIA_TYPE':
      return 'VALIDATION_FAILED';
    case 'FST_RATE_LIMIT':
    case 'FST_ERR_RATE_LIMIT':
      return 'RATE_LIMITED';
    default:
      return null;
  }
}

/**
 * ⚠️ BỌC BẰNG `fastify-plugin` — xem ghi chú dài ở `plugins/security.ts`.
 *
 * `setErrorHandler` đặt bên trong một plugin đã `register` chỉ áp dụng cho các route NẰM
 * TRONG plugin đó. Không bọc `fp` thì lỗi từ `authRoutes`/`childrenRoutes` (đăng ký ở gốc)
 * sẽ rơi vào handler mặc định của Fastify ⇒ client nhận hình dạng lỗi KHÁC, và `code` —
 * thứ UI dùng để dịch câu tiếng Việt — biến mất.
 */
export const errorsPlugin = fp(
  async function errorsPlugin(app: FastifyInstance): Promise<void> {
    // LƯU Ý: `setNotFoundHandler` KHÔNG đặt ở đây mà ở `app.ts`, vì nó cần biết
    // thư mục `dist/` để trả `index.html` cho SPA fallback. Tách ra như vậy để plugin
    // này chỉ lo một việc: chuẩn hoá lỗi.

    /**
     * ⚠️ THAM SỐ LÀ `unknown`, KHÔNG PHẢI `Error` — CỐ Ý.
     *
     * Không phải mọi thứ được `throw` đều là `Error`. `@fastify/rate-limit` ném một OBJECT
     * THUẦN (xem `asPreShapedApiError`). Khai `error: Error` ở đây là một lời hứa sai, và
     * TypeScript sẽ không cho ta kiểm `error instanceof ZodError` một cách trung thực.
     * Dùng `unknown` rồi thu hẹp dần là cách duy nhất đúng.
     */
    app.setErrorHandler((error: unknown, req: FastifyRequest, reply: FastifyReply) => {
      // 1. Lỗi validate từ Zod (dùng ở tầng service/DTO)
      if (error instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of error.issues) {
          const key = issue.path.join('.') || '_';
          if (!fields[key]) fields[key] = issue.message;
        }
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Dữ liệu gửi lên chưa hợp lệ',
            fields,
          },
        });
      }

      // 2. Lỗi nghiệp vụ có mã xác định
      if (error instanceof AppError) {
        // Lỗi 5xx mới cần log đầy đủ; 4xx là chuyện bình thường (nhập sai mật khẩu...).
        if (error.statusCode >= 500) {
          logger.error({ err: error.message, url: req.url }, 'Lỗi nghiệp vụ 5xx');
        }
        return reply.status(error.statusCode).send({
          error: {
            code: error.code,
            message: error.message,
            ...(error.fields ? { fields: error.fields } : {}),
          },
        });
      }

      // 3. Giá trị ĐÃ MANG SẴN hình dạng response của RubyLingo.
      //    Đây là nhánh chữa lỗi "429 thành 500" của rate-limit — xem `asPreShapedApiError`.
      //    PHẢI nằm TRƯỚC nhánh 4, nếu không nó lại rơi vào đó lần nữa.
      const preShaped = asPreShapedApiError(error);
      if (preShaped) {
        // Không log: đây là lỗi 4xx đã có câu trả lời đúng, không phải sự cố.
        return reply.status(STATUS_BY_CODE[preShaped.error.code]).send(preShaped);
      }

      // 4. Lỗi có sẵn mã của Fastify (validation schema...)
      const fastifyError = error as FastifyLikeError;
      const mapped = mapFastifyCode(fastifyError.code);
      if (mapped) {
        return reply.status(STATUS_BY_CODE[mapped]).send({
          error: { code: mapped, message: safeMessage(error) },
        });
      }
      if (
        typeof fastifyError.statusCode === 'number' &&
        fastifyError.statusCode >= 400 &&
        fastifyError.statusCode < 500
      ) {
        return reply.status(fastifyError.statusCode).send({
          error: { code: 'VALIDATION_FAILED', message: safeMessage(error) },
        });
      }

      // 5. Còn lại: lỗi không lường trước ⇒ log đầy đủ, trả câu chung chung.
      logger.error(
        {
          err: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          url: req.url,
          method: req.method,
        },
        'Lỗi không lường trước',
      );
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: config.isProd
            ? 'Có lỗi xảy ra ở máy chủ. Bố mẹ thử lại sau nhé.'
            : `Lỗi nội bộ: ${safeMessage(error)}`,
        },
      });
    });
  },
  { name: 'rubylingo-errors' },
);
