// @vitest-environment node
/**
 * Test `server/lib/password.ts`.
 *
 * Đây là tầng bảo mật lõi: sai ở đây thì mọi thứ phía trên đều vô nghĩa. Vì vậy test không
 * chỉ kiểm "chạy được" mà còn khẳng định những TÍNH CHẤT phải luôn đúng:
 *   • hash sinh ra PHẢI là Argon2id (nếu thư viện đổi mặc định, test phải đổ lên)
 *   • cùng mật khẩu ⇒ hash KHÁC nhau (có salt) — nếu không, hai phụ huynh cùng mật khẩu sẽ
 *     có cùng hash và lộ thông tin
 *   • hash hỏng ⇒ trả `false`, KHÔNG ném lỗi (dữ liệu hỏng không được thành lỗi 500)
 */

import { describe, expect, it } from 'vitest';

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  assertPasswordLength,
  hashPassword,
  needsRehash,
  newSessionToken,
  normalizeRecoveryCode,
  sha256,
  verifyAgainstDummy,
  verifyPassword,
} from '../../../server/lib/password.js';
import { AppError } from '../../../server/plugins/errors.js';
import { newRecoveryCode } from '../../../server/lib/ids.js';

describe('hashPassword / verifyPassword', () => {
  it('hash sinh ra là Argon2id — nếu không, mật khẩu đang bị bảo vệ yếu hơn tưởng tượng', async () => {
    const h = await hashPassword('matkhau123');
    expect(h.startsWith('$argon2id$')).toBe(true);
  });

  it('hash dùng đúng tham số OWASP: m=19456, t=2, p=1', async () => {
    const h = await hashPassword('matkhau123');
    expect(h).toContain('m=19456,t=2,p=1');
  });

  it('mật khẩu đúng ⇒ true; mật khẩu sai ⇒ false', async () => {
    const h = await hashPassword('matkhau123');
    expect(await verifyPassword(h, 'matkhau123')).toBe(true);
    expect(await verifyPassword(h, 'matkhau124')).toBe(false);
  });

  it('CÙNG mật khẩu ⇒ hash KHÁC nhau (có salt ngẫu nhiên)', async () => {
    const a = await hashPassword('matkhau123');
    const b = await hashPassword('matkhau123');
    expect(a).not.toBe(b);
    // Nhưng cả hai đều phải kiểm đúng — salt khác không được làm hỏng việc xác minh.
    expect(await verifyPassword(a, 'matkhau123')).toBe(true);
    expect(await verifyPassword(b, 'matkhau123')).toBe(true);
  });

  it('phân biệt hoa/thường (không chuẩn hoá mật khẩu)', async () => {
    const h = await hashPassword('MatKhau123');
    expect(await verifyPassword(h, 'matkhau123')).toBe(false);
  });

  it('khoảng trắng ở đầu/cuối là ký tự hợp lệ trong mật khẩu', async () => {
    const h = await hashPassword('  matkhau123  ');
    expect(await verifyPassword(h, '  matkhau123  ')).toBe(true);
    expect(await verifyPassword(h, 'matkhau123')).toBe(false);
  });

  it('hash hỏng ⇒ false, KHÔNG ném lỗi', async () => {
    expect(await verifyPassword('khong-phai-hash', 'matkhau123')).toBe(false);
    expect(await verifyPassword('', 'matkhau123')).toBe(false);
  });
});

describe('assertPasswordLength — chính sách độ dài', () => {
  it(`ngắn hơn ${PASSWORD_MIN_LENGTH} ký tự ⇒ ném WEAK_PASSWORD`, () => {
    expect(() => assertPasswordLength('a'.repeat(PASSWORD_MIN_LENGTH - 1))).toThrow(AppError);
  });

  it(`đúng ${PASSWORD_MIN_LENGTH} ký tự ⇒ hợp lệ (biên dưới)`, () => {
    expect(() => assertPasswordLength('a'.repeat(PASSWORD_MIN_LENGTH))).not.toThrow();
  });

  it(`dài hơn ${PASSWORD_MAX_LENGTH} ký tự ⇒ ném lỗi (chống DoS bằng mật khẩu khổng lồ)`, () => {
    expect(() => assertPasswordLength('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toThrow(AppError);
  });

  it('lỗi có mã WEAK_PASSWORD để client hiển thị đúng thông báo', () => {
    try {
      assertPasswordLength('a');
      expect.unreachable('lẽ ra phải ném lỗi');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('WEAK_PASSWORD');
    }
  });
});

describe('verifyAgainstDummy — chống đo thời gian khi đăng nhập', () => {
  it('luôn trả false với mọi đầu vào', async () => {
    expect(await verifyAgainstDummy('bat-ky')).toBe(false);
    expect(await verifyAgainstDummy('')).toBe(false);
    expect(await verifyAgainstDummy('matkhau123')).toBe(false);
  });

  it('thực sự tiêu tốn thời gian băm (không trả về tức thì)', async () => {
    const t0 = performance.now();
    await verifyAgainstDummy('bat-ky');
    const elapsed = performance.now() - t0;
    // Argon2id với m=19 MiB, t=2 mất hàng chục ms. Ngưỡng 5 ms rất thấp so với thực tế nên
    // không gây flaky, nhưng đủ để bắt trường hợp hàm này bị "tối ưu" thành `return false`.
    expect(elapsed).toBeGreaterThan(5);
  });
});

describe('needsRehash', () => {
  it('hash vừa sinh bằng tham số hiện tại ⇒ false', async () => {
    const h = await hashPassword('matkhau123');
    expect(needsRehash(h)).toBe(false);
  });

  it('hash hỏng/không đọc được ⇒ true (an toàn hơn là bỏ qua)', () => {
    expect(needsRehash('rac')).toBe(true);
  });

  it('hash có tham số yếu hơn ⇒ true (để tự nâng cấp ở lần đăng nhập sau)', () => {
    // Chuỗi PHC hợp lệ nhưng memoryCost thấp hơn chính sách.
    const weak = '$argon2id$v=19$m=4096,t=1,p=1$c29tZXNhbHQ$0000000000000000000000000000000000000000000';
    expect(needsRehash(weak)).toBe(true);
  });
});

describe('sha256 — dùng cho token phiên và mã khôi phục', () => {
  it('tất định: cùng đầu vào ⇒ cùng kết quả', () => {
    expect(sha256('abc')).toBe(sha256('abc'));
  });

  it('khác đầu vào ⇒ khác kết quả', () => {
    expect(sha256('abc')).not.toBe(sha256('abd'));
  });

  it('là chuỗi hex 64 ký tự (SHA-256)', () => {
    expect(sha256('abc')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('newSessionToken', () => {
  it('là chuỗi base64url, đủ dài (>= 40 ký tự cho 32 byte)', () => {
    const t = newSessionToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(40);
  });

  it('hai lần gọi liên tiếp ⇒ khác nhau (không dùng lại giá trị)', () => {
    const set = new Set(Array.from({ length: 50 }, () => newSessionToken()));
    expect(set.size).toBe(50);
  });
});

describe('normalizeRecoveryCode', () => {
  it('mã chuẩn hoá từ mã do hệ thống sinh ra (giữ nguyên)', () => {
    const code = newRecoveryCode();
    expect(normalizeRecoveryCode(code)).toBe(code);
  });

  it('chấp nhận chữ THƯỜNG', () => {
    expect(normalizeRecoveryCode('k7m2p-9xqr4-abcde-fghjk')).toBe('K7M2P-9XQR4-ABCDE-FGHJK');
  });

  it('chấp nhận dấu cách thay cho gạch ngang', () => {
    expect(normalizeRecoveryCode('K7M2P 9XQR4 ABCDE FGHJK')).toBe('K7M2P-9XQR4-ABCDE-FGHJK');
  });

  it('chấp nhận gõ liền không dấu phân cách', () => {
    expect(normalizeRecoveryCode('k7m2p9xqr4abcdefghjk')).toBe('K7M2P-9XQR4-ABCDE-FGHJK');
  });

  it('bỏ ký tự rác mà người dùng dán kèm', () => {
    expect(normalizeRecoveryCode('  K7M2P–9XQR4  ')).toBe('K7M2P-9XQR4');
  });

  it('KHÔNG "sửa" 0/O/1/I/L — bảng chữ không có các ký tự đó nên không có gì để ánh xạ', () => {
    // Đây là điều dễ làm sai: ánh xạ 0→O tạo ra ký tự KHÔNG nằm trong bảng chữ và chắc chắn
    // không khớp mã nào. Hàm này chỉ chuẩn hoá HÌNH THỨC, không đoán ý người dùng.
    expect(normalizeRecoveryCode('0O1IL')).toBe('0O1IL');
  });

  it('mã rỗng ⇒ chuỗi rỗng', () => {
    expect(normalizeRecoveryCode('')).toBe('');
    expect(normalizeRecoveryCode('   ---   ')).toBe('');
  });
});
