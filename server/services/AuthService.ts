/**
 * RubyLingo — AuthService: đăng ký, đăng nhập, phiên, đặt lại mật khẩu.
 *
 * ⚙️ RÀNG BUỘC KỸ THUẬT QUAN TRỌNG — ĐỌC TRƯỚC KHI SỬA:
 *
 *   `transaction()` trong `db/connection.ts` dùng `db.transaction()` của better-sqlite3,
 *   và nó chỉ nhận hàm **ĐỒNG BỘ**. better-sqlite3 là thư viện đồng bộ nên điều này là
 *   đương nhiên — nhưng hệ quả là: **KHÔNG được `await` bên trong transaction**.
 *
 *   Vì vậy mọi việc bất đồng bộ (băm Argon2id ~50 ms) PHẢI hoàn tất TRƯỚC khi mở
 *   transaction. Nếu ai đó thêm `await` vào trong `transaction(...)` thì better-sqlite3
 *   sẽ ném lỗi hoặc (tệ hơn) transaction commit trước khi việc bất đồng bộ xong, để lại
 *   dữ liệu nửa vời. Trong file này, mọi `await` đều nằm NGOÀI `transaction(...)`.
 *
 * ⚠️ ĐĂNG NHẬP KHÔNG ĐƯỢC TIẾT LỘ EMAIL CÓ TỒN TẠI HAY KHÔNG:
 *   Email không tồn tại và mật khẩu sai phải trả về CÙNG một lỗi (`INVALID_CREDENTIALS`)
 *   và tốn CÙNG một khoảng thời gian (`verifyAgainstDummy`). Xem `lib/password.ts`.
 *
 * ⚠️ MỌI PHƯƠNG THỨC GHI ĐỀU TỰ PARSE BẰNG SCHEMA DÙNG CHUNG — ĐỪNG BỎ:
 *   Route (`server/routes/auth.ts`) đã gọi `signupSchema.parse(...)` trước khi vào đây, nên
 *   thoạt nhìn việc parse lại có vẻ thừa. Nó KHÔNG thừa, vì hai lý do khác nhau:
 *
 *     1. `emailSchema` có `.transform()` (trim + lowercase). Chuẩn hoá này là thứ duy nhất
 *        giữ cho `UNIQUE(email)` chống được trùng — nếu bỏ, "Bo@Gmail.com " và "bo@gmail.com"
 *        tạo ra HAI tài khoản cho cùng một người, và ràng buộc UNIQUE không cứu được vì
 *        hai chuỗi khác nhau về mặt byte.
 *     2. Service không chỉ được gọi từ route. `scripts/reset-password.ts`, script seed dữ
 *        liệu, và test đều gọi thẳng. Chỉ dựa vào route thì bảo đảm chuẩn hoá phụ thuộc vào
 *        việc "mọi người gọi đúng cách" — đúng kiểu giả định sẽ bị phá vỡ lúc không ngờ.
 *
 *   Parse hai lần KHÔNG thể lệch nhau vì cả hai dùng CHÍNH cùng một object schema. Chi phí
 *   là vài chục micro-giây, không đáng kể so với một phép băm Argon2id (~50 ms).
 *   `plugins/errors.ts` đã bắt `ZodError` → 400 `VALIDATION_FAILED` kèm `fields`, nên hành
 *   vi ở tầng HTTP không đổi.
 */

import type { Db } from '../db/connection.js';
import { getDb, transaction } from '../db/connection.js';
import { newIdWithPrefix, newRecoveryCode } from '../lib/ids.js';
import {
  hashPassword,
  needsRehash,
  newSessionToken,
  normalizeRecoveryCode,
  sha256,
  verifyAgainstDummy,
  verifyPassword,
} from '../lib/password.js';
import { nowIso, sessionExpiry } from '../lib/time.js';
import { errors } from '../plugins/errors.js';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { PRIVACY_POLICY_VERSION } from '../../shared/constants.js';
import {
  changePasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from '../../shared/schemas/auth.js';
import type { ChangePasswordInput, LoginInput, ResetPasswordInput, SignupInput } from '../../shared/schemas/auth.js';
import type { ParentAccountDto } from '../../shared/types/api.js';

/** Thông tin request dùng để ghi vết phiên (audit) — không dùng để xác thực. */
export interface SessionContext {
  userAgent?: string | undefined;
  ip?: string | undefined;
}

export interface SignupResult {
  parent: ParentAccountDto;
  /** Mã khôi phục dạng BẢN RÕ — chỉ trả về đúng một lần, ở response của signup. */
  recoveryCode: string;
  /**
   * Token phiên, tạo ngay trong `signup`.
   *
   * Vì sao không để route gọi `login()` sau khi đăng ký: `login()` sẽ băm lại mật khẩu
   * Argon2id lần nữa (~50 ms) cho một mật khẩu mà ta VỪA băm xong — lãng phí và làm chậm
   * đúng bước đầu tiên phụ huynh trải nghiệm.
   */
  sessionToken: string;
}

export interface LoginResult {
  parent: ParentAccountDto;
  /** Token thật để đặt vào cookie. DB chỉ giữ SHA-256 của nó. */
  sessionToken: string;
}

export interface SessionInfo {
  parent: ParentAccountDto;
  sessionToken: string;
}

export interface ResetPasswordResult {
  /**
   * Mã khôi phục MỚI. Xem ghi chú ở `resetPassword()` — mã cũ dùng một lần, nên nếu không
   * phát mã mới thì phụ huynh vừa đặt lại mật khẩu xong đã không còn đường lùi nào.
   */
  recoveryCode: string;
}

// =============================================================================
// Hàng dữ liệu thô từ SQLite (snake_case)
// =============================================================================

interface ParentRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  pin_hash: string | null;
  consent_policy_version: string;
  consented_at: string;
  created_at: string;
  updated_at: string;
}

interface SessionRow {
  id: string;
  parent_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  last_seen_at: string | null;
}

/** Số mili-giây tối thiểu giữa hai lần ghi `last_seen_at`. Xem `touchSession`. */
const LAST_SEEN_THROTTLE_MS = 60 * 60 * 1000;

function toParentDto(row: ParentRow): ParentAccountDto {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    consentPolicyVersion: row.consent_policy_version,
    consentedAt: row.consented_at,
    createdAt: row.created_at,
  };
}

/** better-sqlite3 ném lỗi có `code` khi vi phạm ràng buộc. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    String((err as { code: unknown }).code).startsWith('SQLITE_CONSTRAINT')
  );
}

// =============================================================================
// Service
// =============================================================================

export class AuthService {
  constructor(private readonly db: Db = getDb()) {}

  // --- Đăng ký -------------------------------------------------------------

  /**
   * Tạo tài khoản phụ huynh + mã khôi phục.
   *
   * Thứ tự có chủ đích:
   *   1. Kiểm email trùng (để báo lỗi thân thiện — KHÔNG thay thế cho ràng buộc UNIQUE)
   *   2. Băm mật khẩu + sinh/băm mã khôi phục  ← bất đồng bộ, phải xong trước bước 3
   *   3. Transaction đồng bộ: ghi `parent_account` + `recovery_code`
   *
   * Bước 1 vẫn phải có bước 3 làm chốt: giữa lúc kiểm và lúc ghi, một request khác có thể
   * đã tạo cùng email (TOCTOU). Ràng buộc UNIQUE trong DB mới là thứ đảm bảo thật.
   */
  async signup(rawInput: SignupInput, ctx: SessionContext = {}): Promise<SignupResult> {
    // Chuẩn hoá + kiểm lại (xem ghi chú đầu file). `input` là bản ĐÃ chuẩn hoá.
    const input = signupSchema.parse(rawInput);

    const existing = this.db
      .prepare('SELECT id FROM parent_account WHERE email = ?')
      .get(input.email) as { id: string } | undefined;
    if (existing) throw errors.emailTaken();

    // Băm TRƯỚC transaction (xem ghi chú đầu file).
    const passwordHash = await hashPassword(input.password);
    const recoveryCode = newRecoveryCode();
    const recoveryCodeHash = sha256(normalizeRecoveryCode(recoveryCode));

    const now = nowIso();
    const parentId = newIdWithPrefix('par');

    try {
      transaction((db) => {
        db.prepare(
          `INSERT INTO parent_account
             (id, email, password_hash, display_name, consent_policy_version, consented_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          parentId,
          input.email,
          passwordHash,
          input.displayName ?? null,
          PRIVACY_POLICY_VERSION,
          now,
          now,
          now,
        );

        db.prepare(
          'INSERT INTO recovery_code (id, parent_id, code_hash, used_at, created_at) VALUES (?, ?, ?, NULL, ?)',
        ).run(newIdWithPrefix('rec'), parentId, recoveryCodeHash, now);
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw errors.emailTaken();
      throw err;
    }

    logger.info({ parentId, ua: ctx.userAgent }, 'Đã tạo tài khoản phụ huynh');

    const row = this.db.prepare('SELECT * FROM parent_account WHERE id = ?').get(parentId) as ParentRow;
    // Tạo phiên luôn để phụ huynh đi thẳng sang bước tạo hồ sơ cho bé.
    const sessionToken = this.createSession(parentId, ctx);
    return { parent: toParentDto(row), recoveryCode, sessionToken };
  }

  // --- Đăng nhập -----------------------------------------------------------

  /**
   * Đăng nhập. Xem ghi chú đầu file về việc không tiết lộ email có tồn tại hay không.
   */
  async login(rawInput: LoginInput, ctx: SessionContext = {}): Promise<LoginResult> {
    // `loginSchema` cố tình LỎNG về mật khẩu (chỉ cần không rỗng) để không lộ chính sách
    // mật khẩu — nhưng nó vẫn chuẩn hoá email, nên tra cứu luôn khớp với lúc đăng ký.
    const input = loginSchema.parse(rawInput);

    const row = this.db.prepare('SELECT * FROM parent_account WHERE email = ?').get(input.email) as
      | ParentRow
      | undefined;

    if (!row) {
      // Không có tài khoản: vẫn tiêu tốn đúng chừng ấy thời gian rồi mới báo lỗi.
      await verifyAgainstDummy(input.password);
      throw errors.invalidCredentials();
    }

    const ok = await verifyPassword(row.password_hash, input.password);
    if (!ok) throw errors.invalidCredentials();

    // Nâng cấp hash cũ lên tham số hiện tại — xem `needsRehash` trong lib/password.ts.
    // Việc này bất đồng bộ nên làm TRƯỚC khi tạo phiên.
    if (needsRehash(row.password_hash)) {
      const upgraded = await hashPassword(input.password);
      this.db
        .prepare('UPDATE parent_account SET password_hash = ?, updated_at = ? WHERE id = ?')
        .run(upgraded, nowIso(), row.id);
      logger.info({ parentId: row.id }, 'Đã nâng cấp hash mật khẩu lên tham số Argon2id hiện tại');
    }

    const sessionToken = this.createSession(row.id, ctx);
    logger.info({ parentId: row.id }, 'Phụ huynh đăng nhập');

    return { parent: toParentDto(row), sessionToken };
  }

  /**
   * Tạo phiên mới. Trả về TOKEN BẢN RÕ (để đặt vào cookie); DB chỉ lưu SHA-256.
   *
   * Vì sao lưu hash chứ không lưu token: nếu file DB bị lộ (sao lưu nhầm, VPS bị chiếm),
   * kẻ tấn công có `token_hash` nhưng KHÔNG thể dùng nó làm cookie — vì server băm cookie
   * nhận được rồi so với `token_hash`, nên giá trị dùng được phải là bản gốc chưa băm.
   */
  private createSession(parentId: string, ctx: SessionContext): string {
    const token = newSessionToken();
    const now = nowIso();
    this.db
      .prepare(
        `INSERT INTO session (id, parent_id, token_hash, expires_at, created_at, last_seen_at, user_agent, ip)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newIdWithPrefix('ses'),
        parentId,
        sha256(token),
        sessionExpiry(config.sessionTtlMs),
        now,
        now,
        ctx.userAgent ?? null,
        ctx.ip ?? null,
      );
    return token;
  }

  // --- Phiên ---------------------------------------------------------------

  /**
   * Đọc phiên từ token trong cookie. Trả `null` nếu không có/không hợp lệ/hết hạn.
   *
   * ⚠️ KHÔNG ném lỗi ở đây: hàm này chạy trong hook `onRequest` cho MỌI request, kể cả
   * request ẩn danh (đăng nhập, đăng ký, health). Ném lỗi sẽ biến mọi trang công khai
   * thành lỗi 401. Việc "bắt buộc phải đăng nhập" là quyết định của TỪNG ROUTE.
   */
  getSession(token: string): SessionInfo | null {
    if (!token) return null;

    const session = this.db.prepare('SELECT * FROM session WHERE token_hash = ?').get(sha256(token)) as
      | SessionRow
      | undefined;
    if (!session) return null;

    // So sánh ISO-8601 UTC dạng chuỗi là so sánh được theo thứ tự từ điển, vì `nowIso()`
    // và `sessionExpiry()` đều sinh cùng một định dạng có độ dài cố định.
    if (session.expires_at <= nowIso()) {
      // Phiên hết hạn: xoá luôn để bảng không phình ra mãi.
      this.db.prepare('DELETE FROM session WHERE id = ?').run(session.id);
      return null;
    }

    const parent = this.db
      .prepare('SELECT * FROM parent_account WHERE id = ?')
      .get(session.parent_id) as ParentRow | undefined;
    // Tài khoản đã bị xoá nhưng phiên còn sót (ON DELETE CASCADE lẽ ra đã dọn).
    if (!parent) {
      this.db.prepare('DELETE FROM session WHERE id = ?').run(session.id);
      return null;
    }

    this.touchSession(session);
    return { parent: toParentDto(parent), sessionToken: token };
  }

  /**
   * Cập nhật `last_seen_at` — nhưng CÓ TIẾT CHẾ (tối đa 1 lần/giờ).
   *
   * Vì sao không ghi mỗi request: mỗi lần ghi là một transaction vào SQLite. Bé chơi game
   * có thể bắn hàng chục request mỗi phút; ghi `last_seen_at` mỗi lần là làm nghẽn ghi
   * (SQLite chỉ cho MỘT writer) mà chẳng thu được thông tin gì thêm — ta chỉ cần biết
   * "phiên này còn dùng gần đây".
   */
  private touchSession(session: SessionRow): void {
    const now = Date.now();
    if (session.last_seen_at) {
      const last = Date.parse(session.last_seen_at);
      if (!Number.isNaN(last) && now - last < LAST_SEEN_THROTTLE_MS) return;
    }
    this.db.prepare('UPDATE session SET last_seen_at = ? WHERE id = ?').run(nowIso(), session.id);
  }

  /** Đăng xuất: xoá phiên hiện tại. Gọi khi không có phiên cũng không sao (idempotent). */
  logout(token: string): void {
    if (!token) return;
    this.db.prepare('DELETE FROM session WHERE token_hash = ?').run(sha256(token));
  }

  // --- Cổng PIN phụ huynh (T072) --------------------------------------------

  /**
   * Ghi dấu "cổng PIN vừa được mở" cho PHIÊN này.
   *
   * ⭐ VÌ SAO Ở `AuthService` CHỨ KHÔNG Ở `ParentService`: bảng `session` có ĐÚNG MỘT chủ sở hữu
   *   là service này (tạo phiên, đọc phiên, gia hạn `last_seen_at`, xoá phiên). Nếu
   *   `ParentService` tự viết `UPDATE session ...` thì bảng đó có hai chủ, và đúng luật "một cột,
   *   một chủ" của dự án thì sớm muộn hai chỗ sẽ lệch. `ParentService` chỉ GỌI hai hàm dưới đây.
   */
  openGate(sessionToken: string, at: string): void {
    this.db
      .prepare('UPDATE session SET gate_opened_at = ? WHERE token_hash = ?')
      .run(at, sha256(sessionToken));
  }

  /**
   * Mốc "cổng PIN được mở" của phiên này, hoặc `null` nếu chưa từng mở.
   *
   * KHÔNG kiểm hạn ở đây — hạn là luật nghiệp vụ (`PARENT_GATE_TTL_MS`) và thuộc `ParentService`
   * (nơi biết cả `pin_hash`). `AuthService` chỉ đọc/ghi CỘT, không phán xét cổng còn hiệu lực hay
   * không — đúng ranh giới giữa "tầng phiên" và "tầng nghiệp vụ phụ huynh".
   */
  readGateOpenedAt(sessionToken: string): string | null {
    const row = this.db
      .prepare('SELECT gate_opened_at FROM session WHERE token_hash = ?')
      .get(sha256(sessionToken)) as { gate_opened_at: string | null } | undefined;
    return row?.gate_opened_at ?? null;
  }

  // --- Mật khẩu ------------------------------------------------------------

  /**
   * Đổi mật khẩu khi đã đăng nhập.
   *
   * Xoá mọi phiên KHÁC (giữ phiên đang dùng). Vì sao: nếu tài khoản đã bị người khác vào
   * bằng mật khẩu cũ, đổi mật khẩu mà không đá các phiên kia ra thì kẻ đó vẫn tiếp tục
   * dùng được — coi như đổi mật khẩu vô nghĩa.
   */
  async changePassword(
    parentId: string,
    rawInput: ChangePasswordInput,
    currentSessionToken: string,
  ): Promise<void> {
    const input = changePasswordSchema.parse(rawInput);

    const row = this.db
      .prepare('SELECT * FROM parent_account WHERE id = ?')
      .get(parentId) as ParentRow | undefined;
    if (!row) throw errors.unauthenticated();

    const ok = await verifyPassword(row.password_hash, input.currentPassword);
    if (!ok) throw errors.invalidCredentials();

    const newHash = await hashPassword(input.newPassword);
    const now = nowIso();

    transaction((db) => {
      db.prepare('UPDATE parent_account SET password_hash = ?, updated_at = ? WHERE id = ?').run(
        newHash,
        now,
        parentId,
      );
      db.prepare('DELETE FROM session WHERE parent_id = ? AND token_hash != ?').run(
        parentId,
        sha256(currentSessionToken),
      );
    });

    logger.info({ parentId }, 'Phụ huynh đổi mật khẩu');
  }

  /**
   * Đặt lại mật khẩu bằng mã khôi phục (khi đã quên mật khẩu).
   *
   * ⚠️ PHÁT MÃ KHÔI PHỤC MỚI — vì sao bắt buộc:
   *   Mã khôi phục dùng MỘT LẦN (`used_at`). Nếu đặt lại mật khẩu mà không phát mã mới thì
   *   phụ huynh vừa dùng xong mã duy nhất của mình ⇒ lần sau quên mật khẩu sẽ phải nhờ can
   *   thiệp thủ công vào DB. Trả mã mới ngay trong response là cách duy nhất giữ cho tài
   *   khoản luôn có đường lùi.
   *
   * ⚠️ XOÁ MỌI PHIÊN: đây chính là tình huống "tài khoản có thể đã bị chiếm". Đặt lại mật
   *   khẩu mà để phiên của kẻ tấn công còn sống thì việc đặt lại không có tác dụng.
   *
   * Không tiết lộ email có tồn tại hay không: sai email, sai mã, mã đã dùng — tất cả trả
   * cùng một lỗi `INVALID_CREDENTIALS`.
   *
   * ⚠️ CẢ BA NHÁNH ĐỀU TỐN ĐÚNG MỘT PHÉP ARGON2 — chống rò rỉ qua thời gian:
   *   • email không tồn tại      → `verifyAgainstDummy` (1 phép verify)
   *   • email có, mã SAI/đã dùng → `verifyAgainstDummy` (1 phép verify)  ← dễ bị bỏ sót
   *   • email có, mã ĐÚNG        → `hashPassword` cho mật khẩu mới (1 phép hash)
   *   Nếu nhánh "mã sai" trả về NGAY (không tốn argon2) thì nó nhanh hơn hẳn hai nhánh kia,
   *   và kẻ tấn công chỉ cần đo thời gian phản hồi là biết email nào có trong hệ thống —
   *   đúng thứ mà việc dùng chung lỗi `INVALID_CREDENTIALS` đang cố che.
   */
  async resetPassword(rawInput: ResetPasswordInput): Promise<ResetPasswordResult> {
    /**
     * Parse TRƯỚC mọi phép Argon2 — và đây không chỉ là chuyện gọn gàng.
     *
     * Trần 64 ký tự của `recoveryCode` trong schema là thứ giữ cho cơ chế chống rò rỉ qua
     * thời gian còn hiệu lực: `verifyPassword` bỏ qua luôn phép băm khi đầu vào vượt 128 ký
     * tự, nên một mã khôi phục dài 200 ký tự sẽ khiến `verifyAgainstDummy` trả về NGAY ⇒ nhánh
     * đó nhanh hơn hẳn hai nhánh kia ⇒ đo thời gian là biết email nào có trong hệ thống.
     * Chặn ở schema thì đầu vào đã nằm trong ngưỡng trước khi tới bất kỳ phép băm nào.
     */
    const input = resetPasswordSchema.parse(rawInput);

    const parent = this.db
      .prepare('SELECT * FROM parent_account WHERE email = ?')
      .get(input.email) as ParentRow | undefined;

    if (!parent) {
      await verifyAgainstDummy(input.recoveryCode);
      throw errors.invalidCredentials();
    }

    const codeHash = sha256(normalizeRecoveryCode(input.recoveryCode));
    const codeRow = this.db
      .prepare('SELECT id FROM recovery_code WHERE parent_id = ? AND code_hash = ? AND used_at IS NULL')
      .get(parent.id, codeHash) as { id: string } | undefined;

    if (!codeRow) {
      await verifyAgainstDummy(input.recoveryCode);
      throw errors.invalidCredentials();
    }

    const newHash = await hashPassword(input.newPassword);
    const freshRecoveryCode = newRecoveryCode();
    const now = nowIso();

    transaction((db) => {
      db.prepare('UPDATE parent_account SET password_hash = ?, updated_at = ? WHERE id = ?').run(
        newHash,
        now,
        parent.id,
      );
      // Đánh dấu mã cũ đã dùng — không xoá, để còn vết kiểm toán.
      db.prepare('UPDATE recovery_code SET used_at = ? WHERE id = ?').run(now, codeRow.id);
      db.prepare(
        'INSERT INTO recovery_code (id, parent_id, code_hash, used_at, created_at) VALUES (?, ?, ?, NULL, ?)',
      ).run(
        newIdWithPrefix('rec'),
        parent.id,
        sha256(normalizeRecoveryCode(freshRecoveryCode)),
        now,
      );
      // Đá toàn bộ phiên cũ ra.
      db.prepare('DELETE FROM session WHERE parent_id = ?').run(parent.id);
    });

    logger.warn({ parentId: parent.id }, 'Mật khẩu đã được đặt lại bằng mã khôi phục');
    return { recoveryCode: freshRecoveryCode };
  }
}

/** Dùng chung một instance — service không giữ trạng thái, chỉ giữ kết nối DB. */
export const authService = new AuthService();
