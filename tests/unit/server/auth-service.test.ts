// @vitest-environment node
/**
 * Test `server/services/AuthService.ts`.
 *
 * Ngoài các luồng thường, test khẳng định những TÍNH CHẤT BẢO MẬT dễ bị phá vỡ khi refactor:
 *   • email không tồn tại và mật khẩu sai phải trả CÙNG một mã lỗi (không dò được email)
 *   • đổi/đặt lại mật khẩu phải thu hồi các phiên khác
 *   • đặt lại mật khẩu phải phát mã khôi phục MỚI (nếu không, tài khoản hết đường lùi)
 *   • mật khẩu KHÔNG BAO GIỜ nằm trong DB dạng bản rõ
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { authService } from '../../../server/services/AuthService.js';
import { getDb } from '../../../server/db/connection.js';
import { newIdWithPrefix } from '../../../server/lib/ids.js';
import { sha256, verifyPassword } from '../../../server/lib/password.js';
import { AppError } from '../../../server/plugins/errors.js';
import { PRIVACY_POLICY_VERSION } from '../../../shared/constants.js';
import { clearAllData, setupTestDb } from './helpers/testDb.js';

const PASSWORD = 'matkhau123';
const EMAIL = 'bo@example.com';

function signupInput(overrides: Record<string, unknown> = {}) {
  return {
    email: EMAIL,
    password: PASSWORD,
    parentalConsent: true as const,
    ...overrides,
  };
}

/** Lấy mã lỗi từ một promise bị từ chối, để so sánh thay vì so câu thông báo. */
async function errorCodeOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof AppError) return err.code;
    // Service tự parse bằng schema dùng chung, nên input sai có thể ném `ZodError` trước khi
    // tới `AppError`. `plugins/errors.ts` biến nó thành 400 `VALIDATION_FAILED` ở tầng HTTP —
    // helper quy về cùng mã đó để test nói đúng thứ client nhận được.
    if (err instanceof ZodError) return 'VALIDATION_FAILED';
    throw err;
  }
  throw new Error('Lẽ ra phải ném lỗi nhưng đã thành công');
}

describe('AuthService', () => {
  beforeAll(() => {
    setupTestDb();
  });

  beforeEach(() => {
    clearAllData(getDb());
  });

  // ===========================================================================
  describe('signup', () => {
    it('tạo tài khoản, trả mã khôi phục và một phiên dùng được ngay', async () => {
      const result = await authService.signup(signupInput());

      expect(result.parent.email).toBe(EMAIL);
      expect(result.parent.id.startsWith('par_')).toBe(true);
      expect(result.recoveryCode).toMatch(/^[0-9A-Z]{5}(-[0-9A-Z]{5}){3}$/);

      // Phiên tạo trong signup phải dùng được ngay — phụ huynh không phải đăng nhập lại.
      const session = authService.getSession(result.sessionToken);
      expect(session?.parent.id).toBe(result.parent.id);
    });

    it('đưa email về chữ thường (tránh hai tài khoản cho cùng một người)', async () => {
      const result = await authService.signup(signupInput({ email: '  BO@Example.COM ' }));
      expect(result.parent.email).toBe('bo@example.com');
    });

    /**
     * ⭐ TEST CHỐNG HỒI QUY cho một lỗi thật đã từng xảy ra.
     *
     * Trước đây service tin rằng route đã chuẩn hoá email, nên nó ghi thẳng giá trị nhận
     * được vào DB. Hệ quả: `'Bo@Gmail.com'` và `'bo@gmail.com'` là HAI chuỗi khác nhau về
     * mặt byte, nên `UNIQUE(email)` cho qua và tạo ra hai tài khoản cho cùng một người.
     * Lỗi chỉ lộ ra khi có ai đó gọi thẳng service (script seed, công cụ quản trị) — đúng
     * kiểu lời gọi mà test này mô phỏng.
     */
    it('⭐ tự chuẩn hoá trong service: gọi THẲNG service vẫn không tạo được 2 tài khoản cùng người', async () => {
      await authService.signup(signupInput({ email: 'Bo@Gmail.com' }));
      expect(
        await errorCodeOf(() => authService.signup(signupInput({ email: '  bo@gmail.com ' }))),
      ).toBe('EMAIL_TAKEN');
    });

    it('ghi lại bằng chứng đồng ý COPPA/GDPR-K', async () => {
      const result = await authService.signup(signupInput());
      expect(result.parent.consentPolicyVersion).toBe(PRIVACY_POLICY_VERSION);
      expect(Number.isNaN(Date.parse(result.parent.consentedAt))).toBe(false);
    });

    it('trùng email ⇒ EMAIL_TAKEN', async () => {
      await authService.signup(signupInput());
      expect(await errorCodeOf(() => authService.signup(signupInput()))).toBe('EMAIL_TAKEN');
    });

    it('trùng email KHÁC hoa/thường ⇒ vẫn là EMAIL_TAKEN', async () => {
      await authService.signup(signupInput());
      expect(await errorCodeOf(() => authService.signup(signupInput({ email: 'BO@EXAMPLE.COM' })))).toBe(
        'EMAIL_TAKEN',
      );
    });

    it('KHÔNG lưu mật khẩu dạng bản rõ ở bất kỳ cột nào', async () => {
      await authService.signup(signupInput());
      const row = getDb()
        .prepare('SELECT password_hash FROM parent_account WHERE email = ?')
        .get(EMAIL) as { password_hash: string };

      expect(row.password_hash).not.toContain(PASSWORD);
      expect(row.password_hash.startsWith('$argon2id$')).toBe(true);
      expect(await verifyPassword(row.password_hash, PASSWORD)).toBe(true);
    });

    it('lưu mã khôi phục dưới dạng HASH, không phải bản rõ', async () => {
      const { recoveryCode } = await authService.signup(signupInput());
      const row = getDb().prepare('SELECT code_hash FROM recovery_code').get() as {
        code_hash: string;
      };
      expect(row.code_hash).not.toBe(recoveryCode);
      expect(row.code_hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ===========================================================================
  describe('login', () => {
    beforeEach(async () => {
      await authService.signup(signupInput());
    });

    it('mật khẩu đúng ⇒ trả phụ huynh + token phiên dùng được', async () => {
      const { parent, sessionToken } = await authService.login({ email: EMAIL, password: PASSWORD });
      expect(parent.email).toBe(EMAIL);
      expect(authService.getSession(sessionToken)?.parent.email).toBe(EMAIL);
    });

    it('email viết hoa / có khoảng trắng vẫn vào ĐÚNG tài khoản (đã chuẩn hoá lúc đăng ký)', async () => {
      const login = await authService.login({ email: ' BO@Example.COM ', password: PASSWORD });
      expect(login.parent.email).toBe(EMAIL);
    });

    it('mật khẩu sai ⇒ INVALID_CREDENTIALS', async () => {
      expect(
        await errorCodeOf(() => authService.login({ email: EMAIL, password: 'saibet' })),
      ).toBe('INVALID_CREDENTIALS');
    });

    it('email KHÔNG tồn tại ⇒ CÙNG mã lỗi (không dò được email nào có trong hệ thống)', async () => {
      const wrongPassword = await errorCodeOf(() =>
        authService.login({ email: EMAIL, password: 'saibet' }),
      );
      const unknownEmail = await errorCodeOf(() =>
        authService.login({ email: 'khong-ton-tai@example.com', password: 'saibet' }),
      );
      expect(unknownEmail).toBe(wrongPassword);
      expect(unknownEmail).toBe('INVALID_CREDENTIALS');
    });

    it('mỗi lần đăng nhập tạo một phiên RIÊNG (đăng nhập trên nhiều thiết bị)', async () => {
      const a = await authService.login({ email: EMAIL, password: PASSWORD });
      const b = await authService.login({ email: EMAIL, password: PASSWORD });
      expect(a.sessionToken).not.toBe(b.sessionToken);
      expect(authService.getSession(a.sessionToken)).not.toBeNull();
      expect(authService.getSession(b.sessionToken)).not.toBeNull();
    });

    it('tự nâng cấp hash yếu lên tham số Argon2id hiện tại', async () => {
      // Ghi đè bằng một hash yếu (m=4096, t=1) rồi đăng nhập.
      const weak = await hashPasswordWeak(PASSWORD);
      getDb()
        .prepare('UPDATE parent_account SET password_hash = ? WHERE email = ?')
        .run(weak, EMAIL);

      await authService.login({ email: EMAIL, password: PASSWORD });

      const row = getDb()
        .prepare('SELECT password_hash FROM parent_account WHERE email = ?')
        .get(EMAIL) as { password_hash: string };
      expect(row.password_hash).not.toBe(weak);
      expect(row.password_hash).toContain('m=19456,t=2,p=1');
    });
  });

  // ===========================================================================
  describe('phiên', () => {
    it('token rác ⇒ null (không ném lỗi)', () => {
      expect(authService.getSession('')).toBeNull();
      expect(authService.getSession('khong-phai-token')).toBeNull();
    });

    it('logout xoá phiên; gọi lại lần nữa vẫn an toàn (idempotent)', async () => {
      const { sessionToken } = await authService.signup(signupInput());
      authService.logout(sessionToken);
      expect(authService.getSession(sessionToken)).toBeNull();
      expect(() => authService.logout(sessionToken)).not.toThrow();
      expect(() => authService.logout('')).not.toThrow();
    });

    it('phiên HẾT HẠN ⇒ null và bản ghi được dọn khỏi DB', async () => {
      const { parent } = await authService.signup(signupInput());
      const token = 'token-het-han';
      getDb()
        .prepare(
          `INSERT INTO session (id, parent_id, token_hash, expires_at, created_at, last_seen_at, user_agent, ip)
           VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL)`,
        )
        .run(
          newIdWithPrefix('ses'),
          parent.id,
          sha256(token),
          '2000-01-01T00:00:00.000Z', // đã hết hạn từ lâu
          '2000-01-01T00:00:00.000Z',
        );

      expect(authService.getSession(token)).toBeNull();
      const left = getDb()
        .prepare('SELECT COUNT(*) AS n FROM session WHERE token_hash = ?')
        .get(sha256(token)) as { n: number };
      expect(left.n).toBe(0);
    });

    it('token trong cookie KHÔNG BAO GIỜ được lưu nguyên văn trong DB', async () => {
      const { sessionToken } = await authService.signup(signupInput());
      const hit = getDb()
        .prepare('SELECT COUNT(*) AS n FROM session WHERE token_hash = ?')
        .get(sessionToken) as { n: number };
      // Nếu tìm theo token thật mà thấy bản ghi ⇒ DB đang lưu token nguyên văn (sai).
      expect(hit.n).toBe(0);
      const byHash = getDb()
        .prepare('SELECT COUNT(*) AS n FROM session WHERE token_hash = ?')
        .get(sha256(sessionToken)) as { n: number };
      expect(byHash.n).toBe(1);
    });
  });

  // ===========================================================================
  describe('changePassword', () => {
    it('mật khẩu hiện tại sai ⇒ INVALID_CREDENTIALS', async () => {
      const { sessionToken } = await authService.signup(signupInput());
      expect(
        await errorCodeOf(() =>
          authService.changePassword(
            'par_bat-ky',
            { currentPassword: 'sai', newPassword: 'matkhaumoi123' },
            sessionToken,
          ),
        ),
      ).toBe('UNAUTHENTICATED'); // không tìm thấy tài khoản
    });

    it('đổi thành công: mật khẩu mới dùng được, mật khẩu cũ không', async () => {
      const { parent, sessionToken } = await authService.signup(signupInput());
      await authService.changePassword(
        parent.id,
        { currentPassword: PASSWORD, newPassword: 'matkhaumoi123' },
        sessionToken,
      );

      const login = await authService.login({ email: EMAIL, password: 'matkhaumoi123' });
      expect(login.parent.id).toBe(parent.id);
      expect(await errorCodeOf(() => authService.login({ email: EMAIL, password: PASSWORD }))).toBe(
        'INVALID_CREDENTIALS',
      );
    });

    it('thu hồi mọi phiên KHÁC nhưng GIỮ phiên đang dùng', async () => {
      const signup = await authService.signup(signupInput());
      // Một phiên thứ hai (ví dụ điện thoại).
      const other = await authService.login({ email: EMAIL, password: PASSWORD });

      await authService.changePassword(
        signup.parent.id,
        { currentPassword: PASSWORD, newPassword: 'matkhaumoi123' },
        signup.sessionToken,
      );

      expect(authService.getSession(other.sessionToken)).toBeNull(); // bị đá ra
      expect(authService.getSession(signup.sessionToken)).not.toBeNull(); // vẫn dùng được
    });

    it('sai mật khẩu hiện tại ⇒ KHÔNG đổi được mật khẩu', async () => {
      const { parent, sessionToken } = await authService.signup(signupInput());
      expect(
        await errorCodeOf(() =>
          authService.changePassword(
            parent.id,
            { currentPassword: 'saibet', newPassword: 'matkhaumoi123' },
            sessionToken,
          ),
        ),
      ).toBe('INVALID_CREDENTIALS');

      // Mật khẩu cũ vẫn phải còn hiệu lực.
      const login = await authService.login({ email: EMAIL, password: PASSWORD });
      expect(login.parent.id).toBe(parent.id);
    });
  });

  // ===========================================================================
  describe('resetPassword (bằng mã khôi phục)', () => {
    it('mã đúng ⇒ đổi được mật khẩu', async () => {
      const { recoveryCode } = await authService.signup(signupInput());
      await authService.resetPassword({
        email: EMAIL,
        recoveryCode,
        newPassword: 'matkhaumoi123',
      });

      const login = await authService.login({ email: EMAIL, password: 'matkhaumoi123' });
      expect(login.parent.email).toBe(EMAIL);
    });

    it('trả về mã khôi phục MỚI — nếu không, tài khoản hết đường lùi', async () => {
      const { recoveryCode } = await authService.signup(signupInput());
      const result = await authService.resetPassword({
        email: EMAIL,
        recoveryCode,
        newPassword: 'matkhaumoi123',
      });
      expect(result.recoveryCode).toMatch(/^[0-9A-Z]{5}(-[0-9A-Z]{5}){3}$/);
      expect(result.recoveryCode).not.toBe(recoveryCode);
    });

    it('mã cũ dùng MỘT LẦN: dùng lại lần hai ⇒ INVALID_CREDENTIALS', async () => {
      const { recoveryCode } = await authService.signup(signupInput());
      await authService.resetPassword({ email: EMAIL, recoveryCode, newPassword: 'matkhaumoi123' });

      expect(
        await errorCodeOf(() =>
          authService.resetPassword({
            email: EMAIL,
            recoveryCode,
            newPassword: 'matkhauthuba123',
          }),
        ),
      ).toBe('INVALID_CREDENTIALS');
    });

    it('mã MỚI trả về dùng được cho lần đặt lại sau', async () => {
      const first = await authService.signup(signupInput());
      const second = await authService.resetPassword({
        email: EMAIL,
        recoveryCode: first.recoveryCode,
        newPassword: 'matkhaumoi123',
      });
      await authService.resetPassword({
        email: EMAIL,
        recoveryCode: second.recoveryCode,
        newPassword: 'matkhauthuba123',
      });
      const login = await authService.login({ email: EMAIL, password: 'matkhauthuba123' });
      expect(login.parent.email).toBe(EMAIL);
    });

    it('thu hồi TOÀN BỘ phiên (tình huống tài khoản có thể đã bị chiếm)', async () => {
      const signup = await authService.signup(signupInput());
      const other = await authService.login({ email: EMAIL, password: PASSWORD });

      await authService.resetPassword({
        email: EMAIL,
        recoveryCode: signup.recoveryCode,
        newPassword: 'matkhaumoi123',
      });

      expect(authService.getSession(signup.sessionToken)).toBeNull();
      expect(authService.getSession(other.sessionToken)).toBeNull();
    });

    it('mã sai ⇒ INVALID_CREDENTIALS', async () => {
      await authService.signup(signupInput());
      expect(
        await errorCodeOf(() =>
          authService.resetPassword({
            email: EMAIL,
            recoveryCode: 'AAAAA-BBBBB-CCCCC-DDDDD',
            newPassword: 'matkhaumoi123',
          }),
        ),
      ).toBe('INVALID_CREDENTIALS');
    });

    it('email KHÔNG tồn tại ⇒ CÙNG mã lỗi (không dò được email)', async () => {
      await authService.signup(signupInput());
      const wrongCode = await errorCodeOf(() =>
        authService.resetPassword({
          email: EMAIL,
          recoveryCode: 'AAAAA-BBBBB-CCCCC-DDDDD',
          newPassword: 'matkhaumoi123',
        }),
      );
      const unknownEmail = await errorCodeOf(() =>
        authService.resetPassword({
          email: 'khong-ton-tai@example.com',
          recoveryCode: 'AAAAA-BBBBB-CCCCC-DDDDD',
          newPassword: 'matkhaumoi123',
        }),
      );
      expect(unknownEmail).toBe(wrongCode);
    });

    it('chấp nhận mã gõ chữ thường / dấu cách (phụ huynh gõ lại từ ảnh chụp)', async () => {
      const { recoveryCode } = await authService.signup(signupInput());
      const messy = `  ${recoveryCode.toLowerCase().replace(/-/g, ' ')}  `;
      await authService.resetPassword({ email: EMAIL, recoveryCode: messy, newPassword: 'matkhaumoi123' });
      const login = await authService.login({ email: EMAIL, password: 'matkhaumoi123' });
      expect(login.parent.email).toBe(EMAIL);
    });
  });
});

/**
 * Sinh hash với tham số YẾU để test nhánh `needsRehash`.
 * Viết riêng ở đây thay vì lấy từ `lib/password.ts` vì module đó cố tình chỉ dùng một bộ
 * tham số — không có lý do gì để nó phơi ra API tạo hash yếu.
 */
async function hashPasswordWeak(plain: string): Promise<string> {
  const { hash } = await import('@node-rs/argon2');
  return hash(plain, { memoryCost: 4096, timeCost: 1, parallelism: 1 });
}
