/**
 * RubyLingo — Băm & kiểm tra mật khẩu, băm token phiên và mã khôi phục.
 *
 * ⚠️ HAI LOẠI "BĂM" KHÁC NHAU HOÀN TOÀN — đừng dùng lẫn:
 *
 *   1. MẬT KHẨU  → Argon2id (`hashPassword` / `verifyPassword`).
 *      Chậm có chủ đích (~50 ms) để kẻ tấn công có file DB cũng không dò nổi.
 *
 *   2. TOKEN PHIÊN & MÃ KHÔI PHỤC → SHA-256 (`sha256`).
 *      Nhanh, KHÔNG có salt. Lý do: hai thứ này do MÁY sinh ra với 256 bit ngẫu nhiên,
 *      không phải người chọn, nên không có không gian để dò từ điển. Mục đích của việc
 *      băm ở đây chỉ là: **file DB bị lộ thì kẻ tấn công không dùng được giá trị trong
 *      DB để giả mạo phiên** (cookie thật là bản gốc chưa băm).
 *
 * ⚠️ VÌ SAO KHÔNG DÙNG `Algorithm` / `Version` TỪ THƯ VIỆN:
 *    Chúng được khai báo là `const enum` trong file `.d.ts`. Với `isolatedModules: true`
 *    (đang bật trong tsconfig của dự án), TypeScript cấm truy cập const enum từ môi
 *    trường ambient: "Cannot access ambient const enums when 'isolatedModules' is enabled".
 *    ⇒ Truyền thẳng các THAM SỐ SỐ (memoryCost/timeCost/parallelism) và để thuật toán ở
 *    mặc định — đã kiểm chứng thực nghiệm: mặc định chính là Argon2id v19, m=19456, t=2, p=1.
 *    Test `password.test.ts` khẳng định chuỗi hash bắt đầu bằng `$argon2id$`, nên nếu một
 *    bản cập nhật thư viện đổi mặc định, test sẽ ĐỔ LÊN thay vì âm thầm hạ bảo mật.
 */

import { createHash, randomBytes } from 'node:crypto';
import { hash as argon2Hash, parseOptions, verify as argon2Verify } from '@node-rs/argon2';

import { AppError } from '../plugins/errors.js';

// =============================================================================
// Chính sách mật khẩu
// =============================================================================

/**
 * Độ dài tối thiểu 8. Đây là app cho PHỤ HUYNH (không phải cho bé), nên yêu cầu được
 * cao hơn một chút so với app cho trẻ.
 */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * ⚠️ CẦN CÓ TRẦN. Argon2id băm mật khẩu 10 MB cũng tốn thời gian và bộ nhớ tương ứng ⇒
 * kẻ tấn công gửi một request với mật khẩu khổng lồ là đủ làm nghẽn máy chủ (DoS).
 * 128 ký tự là quá đủ cho mật khẩu do người chọn.
 */
export const PASSWORD_MAX_LENGTH = 128;

/** Tham số Argon2id đang dùng — chuẩn OWASP khuyến nghị (19 MiB, 2 vòng, 1 luồng). */
const ARGON2_PARAMS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Hash "MỒI" để chống tấn công đo thời gian (timing attack) khi đăng nhập.
 *
 * Vấn đề: nếu email không tồn tại mà ta trả lỗi NGAY, còn email tồn tại thì ta mất ~50 ms
 * để băm mật khẩu, thì kẻ tấn công **đo thời gian phản hồi** là biết email nào có trong
 * hệ thống — dù thông báo lỗi giống hệt nhau.
 *
 * Cách chống: khi không tìm thấy tài khoản, vẫn gọi `verify` trên hash mồi này ⇒ tốn đúng
 * chừng ấy thời gian, và luôn trả về `false`.
 *
 * Đây là hash của một chuỗi ngẫu nhiên 24 byte đã bị vứt đi, KHÔNG phải hash của mật khẩu
 * nào — không có mật khẩu nào khớp được nó.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$d9UmLPJ59kyhPUMmmlwz5w$hu5t/IXizLOT0sLvnet4A9A+Kp7BdVIb8nM9xxDcpAg';

// =============================================================================
// Mật khẩu (Argon2id)
// =============================================================================

/** Băm mật khẩu để lưu vào `parent_account.password_hash`. */
export async function hashPassword(plain: string): Promise<string> {
  assertPasswordLength(plain);
  return argon2Hash(plain, ARGON2_PARAMS);
}

/**
 * Kiểm tra mật khẩu.
 *
 * Trả `false` (không ném lỗi) khi hash hỏng/không đúng định dạng: dữ liệu hỏng không được
 * biến thành lỗi 500 — nó chỉ có nghĩa là "không đăng nhập được".
 */
export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  if (plain.length > PASSWORD_MAX_LENGTH) return false;
  try {
    return await argon2Verify(storedHash, plain);
  } catch {
    return false;
  }
}

/**
 * "Băm" mật khẩu giả để cân bằng thời gian khi tài khoản không tồn tại.
 * Luôn trả `false`. Xem ghi chú ở `DUMMY_HASH`.
 */
export async function verifyAgainstDummy(plain: string): Promise<false> {
  await verifyPassword(DUMMY_HASH, plain);
  return false;
}

// =============================================================================
// PIN phụ huynh (T072) — Argon2id, CÙNG thuật toán với mật khẩu
// =============================================================================

/**
 * Băm PIN phụ huynh (4 chữ số) để lưu vào `parent_account.pin_hash`.
 *
 * ⭐ VÌ SAO KHÔNG DÙNG LẠI `hashPassword` — ĐIỀU NÀY QUAN TRỌNG, KHÔNG PHẢI CHUYỆN GỌN GÀNG:
 *   `hashPassword` áp luôn CHÍNH SÁCH MẬT KHẨU (tối thiểu 8 ký tự). PIN là 4 chữ số ⇒ mọi PIN
 *   hợp lệ đều bị `assertPasswordLength` NÉM `WEAK_PASSWORD`, tức là không đặt được PIN nào.
 *
 *   Nhưng THUẬT TOÁN + THAM SỐ thì PHẢI giống hệt mật khẩu: hai cách băm khác nhau trong cùng
 *   một app là hai chỗ để lệch, và chỗ yếu hơn sẽ âm thầm hạ bảo mật của phần còn lại. Nên hàm
 *   này dùng ĐÚNG `ARGON2_PARAMS` và cùng thư viện (`@node-rs/argon2`), chỉ BỎ phần chính sách
 *   độ dài — PIN có schema riêng (`setPinSchema`: đúng `PARENT_PIN_LENGTH` chữ số).
 *
 * ⚠️ KHÔNG GIAN PIN CHỈ 10.000 TỔ HỢP ⇒ băm chậm KHÔNG đủ chống dò. Lớp chống dò THẬT là
 *    RATE-LIMIT ở route `POST /api/parent/gate` (xem `server/routes/parent.ts`). Băm Argon2id ở
 *    đây là lớp thứ hai: nếu file DB bị lộ, kẻ tấn công không đọc thẳng được PIN.
 */
export async function hashPin(plain: string): Promise<string> {
  return argon2Hash(plain, ARGON2_PARAMS);
}

/**
 * Kiểm PIN. Trả `false` (không ném) khi hash hỏng/không đúng định dạng — dữ liệu hỏng chỉ có
 * nghĩa là "không mở được cổng", không phải lỗi 500.
 */
export async function verifyPin(storedHash: string, plain: string): Promise<boolean> {
  try {
    return await argon2Verify(storedHash, plain);
  } catch {
    return false;
  }
}

/**
 * Hash này có được tạo bằng tham số YẾU HƠN chính sách hiện tại không?
 *
 * Dùng khi đăng nhập thành công: nếu `true` thì băm lại và ghi đè. Nhờ vậy khi ta nâng
 * tham số Argon2 trong tương lai, các tài khoản cũ tự nâng cấp dần ở lần đăng nhập kế tiếp
 * — thay vì mãi mãi nằm ở mức bảo mật cũ.
 */
export function needsRehash(storedHash: string): boolean {
  try {
    const o = parseOptions(storedHash);
    return (
      o.memoryCost !== ARGON2_PARAMS.memoryCost ||
      o.timeCost !== ARGON2_PARAMS.timeCost ||
      o.parallelism !== ARGON2_PARAMS.parallelism
    );
  } catch {
    // Không đọc được ⇒ coi như cần băm lại.
    return true;
  }
}

/** Kiểm tra độ dài theo chính sách; ném `WEAK_PASSWORD` nếu vi phạm. */
export function assertPasswordLength(plain: string): void {
  if (plain.length < PASSWORD_MIN_LENGTH) {
    throw new AppError(
      'WEAK_PASSWORD',
      `Mật khẩu cần dài ít nhất ${PASSWORD_MIN_LENGTH} ký tự`,
      400,
    );
  }
  if (plain.length > PASSWORD_MAX_LENGTH) {
    throw new AppError('WEAK_PASSWORD', `Mật khẩu không được dài quá ${PASSWORD_MAX_LENGTH} ký tự`, 400);
  }
}

// =============================================================================
// Token phiên & mã khôi phục (SHA-256)
// =============================================================================

/** SHA-256 dạng hex. Dùng cho token phiên và mã khôi phục — xem ghi chú đầu file. */
export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Sinh token phiên: 32 byte ngẫu nhiên (256 bit) mã hoá base64url.
 *
 * Vì sao không dùng `nanoid` của `lib/ids.ts`: token phiên là thứ bảo vệ tài khoản, nên
 * dùng nguồn ngẫu nhiên mật mã của hệ điều hành (`crypto.randomBytes`) là lựa chọn đúng.
 * `nanoid` phù hợp cho id hiển thị/đọc được, không phải cho bí mật.
 */
export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Chuẩn hoá mã khôi phục do người dùng gõ vào trước khi băm.
 *
 * Phụ huynh có thể gõ lại mã bằng chữ thường, kèm dấu cách, hoặc dán kèm ký tự thừa.
 * Nếu băm nguyên văn thì mã ĐÚNG vẫn bị báo sai — lỗi rất khó chịu vì không có manh mối nào.
 *
 * ⚠️ CỐ TÌNH KHÔNG "sửa" các ký tự dễ nhầm (0/O, 1/I/L).
 * Bảng chữ của `newRecoveryCode()` là `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` — nó ĐÃ loại bỏ
 * sẵn 0, 1, I, O, L. Nghĩa là mã hợp lệ không bao giờ chứa những ký tự đó, nên không tồn
 * tại "ký tự đúng" nào để ánh xạ tới. Ánh xạ 0→O sẽ tạo ra một ký tự KHÔNG nằm trong bảng
 * chữ và chắc chắn không khớp mã nào. Nếu người dùng gõ 0/O/1/I/L thì mã đúng là sai, và
 * báo sai là hành vi ĐÚNG.
 *
 * Vậy chỉ làm 3 việc: bỏ ký tự không phải chữ/số, đưa về chữ HOA, nhóm lại 5 ký tự một.
 * Nhờ vậy `"k7m2p 9xqr4"`, `"K7M2P-9XQR4"` và `"k7m2p9xqr4"` đều cho cùng một kết quả.
 */
export function normalizeRecoveryCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^0-9A-Z]/g, '');
  const chunks: string[] = [];
  for (let i = 0; i < raw.length; i += 5) chunks.push(raw.slice(i, i + 5));
  return chunks.join('-');
}
