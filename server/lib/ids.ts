/**
 * RubyLingo — Sinh id.
 *
 * Dùng `nanoid` với bảng chữ AN TOÀN CHO URL, không có ký tự dễ nhầm khi đọc lên
 * (bỏ 0/O, 1/l/I) — vì phụ huynh có thể phải đọc mã khôi phục qua điện thoại.
 */

import { customAlphabet } from 'nanoid';

/** Bảng chữ không có ký tự dễ nhầm khi đọc/viết tay. */
const SAFE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const id = customAlphabet(SAFE_ALPHABET, 21);

/** id thực thể: tài khoản phụ huynh, hồ sơ bé, phiên... */
export function newId(): string {
  return id();
}

/** id có tiền tố để đọc log dễ phân biệt: "par_xxx", "chi_xxx". */
export function newIdWithPrefix(prefix: string): string {
  return `${prefix}_${id()}`;
}

/**
 * Mã khôi phục mật khẩu — 4 nhóm 5 ký tự, ví dụ: "K7M2P-9XQR4-..."
 *
 * Vì sao dùng mã khôi phục thay vì email: ở giai đoạn MVP (dùng trong nhà) chưa cần
 * cấu hình SMTP. Mã được in MỘT LẦN khi tạo tài khoản; phụ huynh phải lưu lại.
 * Khi mở công khai (P1) sẽ bổ sung thêm luồng quên-mật-khẩu qua email.
 */
export function newRecoveryCode(): string {
  const chunk = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 5);
  return [chunk(), chunk(), chunk(), chunk()].join('-');
}

/** id sự kiện do client sinh — dùng để server chống ghi trùng khi client gửi lại. */
export function newClientEventId(): string {
  return `evt_${id()}`;
}

/** PIN phụ huynh 4 số (chỉ là rào UX, KHÔNG phải ranh giới bảo mật). */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}
