/**
 * RubyLingo — `ParentService`: PIN phụ huynh & CỔNG PIN (T072, Nhóm 11).
 *
 * ⭐ NHIỆM VỤ: một chỗ DUY NHẤT biết "khu vực phụ huynh của PHIÊN này có đang mở không", và cách
 *   đặt/đổi mã PIN. Cổng PIN chỉ chắn khu vực phụ huynh (báo cáo, cài đặt, PIN) — nó KHÔNG chắn
 *   phần học của bé.
 *
 * -----------------------------------------------------------------------------
 * BA QUYẾT ĐỊNH CẦN HIỂU TRƯỚC KHI SỬA
 * -----------------------------------------------------------------------------
 *
 * ⚠️ 1. CỔNG THUỘC VỀ **PHIÊN**, KHÔNG THUỘC VỀ TÀI KHOẢN.
 *    Trạng thái "đã nhập PIN" nằm ở `session.gate_opened_at` (migration 010). Mở cổng trên máy
 *    này KHÔNG mở trên máy khác (phiên khác) — đúng ý nghĩa bảo vệ "bé cầm lại máy NÀY".
 *
 * ⚠️ 2. HÌNH DẠNG PHẢN HỒI KHÔNG ĐƯỢC TIẾT LỘ "TÀI KHOẢN CÓ PIN HAY CHƯA".
 *    `pin_hash` nullable. Nếu `describeGate` để lộ điều đó (qua cờ, qua `expiresAt`, hay qua câu
 *    chữ) thì người đang dò biết ngay tài khoản nào chưa được bảo vệ. Vì vậy `describeGate` CHỈ
 *    nhìn `gate_opened_at` của phiên — hoàn toàn KHÔNG đọc `pin_hash`. Việc "có PIN để kiểm hay
 *    không" chỉ xuất hiện ở `openGate` (nhánh xác thực) và `isGateOpen` (nhánh quyền), không bao
 *    giờ ở dữ liệu trả về.
 *
 * ⚠️ 3. CHƯA ĐẶT PIN ⇒ CHƯA CÓ GÌ ĐỂ CHẮN.
 *    Tài khoản mới chưa có PIN. Khi ấy `openGate` chấp nhận BẤT KỲ PIN hợp lệ (không có gì để
 *    đối chiếu) và `isGateOpen` trả `true` — nếu trả `false` thì phụ huynh không bao giờ đặt được
 *    PIN ĐẦU TIÊN (cổng chặn chính việc mở cổng). Nhờ vậy luồng onboarding chạy được mà vẫn không
 *    rò rỉ: `describeGate` vẫn đồng nhất (cổng đóng cho tới khi POST mở nó).
 */

import type { ParentGateResponse } from '../../shared/types/api.js';
import type { ResetPinInput, SetPinInput } from '../../shared/schemas/auth.js';
import { resetPinSchema, setPinSchema } from '../../shared/schemas/auth.js';
import { PARENT_GATE_TTL_MS } from '../../shared/constants.js';
import type { Db } from '../db/connection.js';
import { getDb, transaction } from '../db/connection.js';
import { hashPin, verifyPassword, verifyPin } from '../lib/password.js';
import { logger } from '../lib/logger.js';
import { errors } from '../plugins/errors.js';
import { authService } from './AuthService.js';
import type { AuthService } from './AuthService.js';

export class ParentService {
  /**
   * ⚠️ `auth` là phụ thuộc để ĐỌC/GHI `session.gate_opened_at` — bảng `session` có đúng một chủ
   *    sở hữu là `AuthService`. Xem `AuthService.openGate` / `readGateOpenedAt`.
   */
  constructor(
    private readonly db: Db = getDb(),
    private readonly auth: AuthService = authService,
  ) {}

  /**
   * Trạng thái cổng của PHIÊN hiện tại. **KHÔNG GHI GÌ** (dùng cho `GET`).
   *
   * ⚠️ Cố ý KHÔNG đọc `pin_hash` — xem quyết định 2 ở đầu tệp. Nên cũng KHÔNG cần `parentId`.
   */
  gateStatus(sessionToken: string, now: Date = new Date()): ParentGateResponse {
    return this.describeGate(sessionToken, now);
  }

  /**
   * Nhập PIN để mở cổng. Trả trạng thái cổng SAU khi mở.
   *
   * ⚠️ BẤT ĐỒNG BỘ vì `verifyPin` băm Argon2id (~50 ms). Vì vậy KHÔNG được gọi hàm này bên
   *    trong một `transaction(...)` (better-sqlite3 transaction phải đồng bộ — xem ghi chú đầu
   *    `AuthService.ts`). Ở đây chỉ có MỘT câu `UPDATE` sau khi băm xong nên không cần transaction.
   *
   * Sai PIN ⇒ `INVALID_PIN` (403): câu trung tính, mời thử lại — KHÔNG trách móc (luật ngôn ngữ
   * của dự án), dù người dùng ở đây là người lớn.
   */
  async openGate(
    parentId: string,
    sessionToken: string,
    rawInput: unknown,
    now: Date = new Date(),
  ): Promise<ParentGateResponse> {
    // Parse lại ở tầng service (không chỉ ở route) — cùng lý do như mọi service khác: route
    // không phải đường gọi duy nhất (test/script gọi thẳng), và `setPinSchema` là luật PIN duy
    // nhất của dự án.
    const input: SetPinInput = setPinSchema.parse(rawInput);

    const pinHash = this.readPinHash(parentId);
    // ⚠️ `pinHash === null` ⇒ CHƯA đặt PIN ⇒ không có gì để đối chiếu, mở cổng (quyết định 3).
    if (pinHash !== null && !(await verifyPin(pinHash, input.pin))) {
      logger.warn({ parentId }, 'Cổng PIN phụ huynh: nhập sai mã');
      throw errors.invalidPin();
    }

    this.auth.openGate(sessionToken, now.toISOString());
    return this.describeGate(sessionToken, now);
  }

  /**
   * Đặt / đổi mã PIN. **Không** kiểm quyền ở đây — route quyết định ai được gọi (xem
   * `requireParentGate` ở `routes/parent.ts`).
   *
   * ⭐ ĐẶT PIN XONG THÌ MỞ LUÔN CỔNG CHO PHIÊN NÀY. Không phải tiểu tiết: ngay khi `pin_hash`
   *    được ghi, một tài khoản TRƯỚC ĐÓ chưa có PIN sẽ bất ngờ "có cổng" ⇒ nếu không mở, chính
   *    phụ huynh vừa đặt PIN sẽ bị đá ra khỏi khu vực họ đang đứng, ngay sau một thao tác hợp lệ.
   *    Họ gõ đúng PIN vừa tạo cũng vào được, nhưng bị đá ra ngay sau khi vừa bấm "Lưu" là trải
   *    nghiệm vô lý.
   *
   * ⚠️ BẤT ĐỒNG BỘ vì `hashPin`. Không transaction (một câu `UPDATE` + một câu ghi cổng).
   */
  async setPin(
    parentId: string,
    sessionToken: string,
    rawInput: unknown,
    now: Date = new Date(),
  ): Promise<void> {
    const input: SetPinInput = setPinSchema.parse(rawInput);
    const hash = await hashPin(input.pin);
    const at = now.toISOString();

    this.db
      .prepare('UPDATE parent_account SET pin_hash = ?, updated_at = ? WHERE id = ?')
      .run(hash, at, parentId);
    this.auth.openGate(sessionToken, at);

    // ⚠️ KHÔNG log giá trị PIN — chỉ log sự kiện. `pin`/`pinHash` cũng nằm trong `redact` của
    //    pino (`lib/logger.ts`) như một lớp thứ hai, nhưng lớp đầu tiên là "đừng log nó".
    logger.info({ parentId }, 'Phụ huynh đặt/cập nhật mã PIN');
  }

  /**
   * ĐẶT LẠI mã PIN khi phụ huynh QUÊN — xác thực bằng MẬT KHẨU tài khoản (T072.1).
   *
   * ⭐ VÌ SAO CÓ HÀM NÀY: `PATCH /api/parent/pin` bị `requireParentGate` chắn (đổi được PIN nghĩa
   *   là mở được khu vực phụ huynh mãi mãi). Nên nếu phụ huynh QUÊN PIN, không còn đường nào đổi
   *   — kể cả đăng nhập lại, vì phiên mới vẫn bị cổng chắn. Hàm này là đường LÙI duy nhất, và nó
   *   xác thực bằng MẬT KHẨU (ranh giới bảo mật THẬT) thay vì bằng PIN (rào UX).
   *
   * ⚠️ KHÔNG MỞ CỔNG SAU KHI ĐẶT LẠI — và đây là quyết định, không phải thiếu sót.
   *    Giữ MỘT ngữ nghĩa duy nhất: "cổng chỉ mở bằng cách NHẬP PIN". Nếu hàm này tự mở cổng thì
   *    có hai đường vào khu vực phụ huynh (một bằng PIN, một bằng mật khẩu) — và đường bằng mật
   *    khẩu sẽ mở luôn cổng của một phiên mà phụ huynh CÓ THỂ đang để chung với bé. Client đưa
   *    phụ huynh về màn nhập PIN với thông báo đã đổi.
   *
   * ⚠️ BẤT ĐỒNG BỘ (`verifyPassword` + `hashPin` đều băm Argon2id) ⇒ hai phép băm chạy TRƯỚC,
   *    `transaction(...)` chỉ còn một câu `UPDATE` đồng bộ (đúng luật better-sqlite3 ở đầu
   *    `AuthService.ts`: KHÔNG `await` bên trong transaction).
   *
   * ⚠️ LŨY ĐẲNG: gửi lại CÙNG payload chỉ đặt lại ĐÚNG mã PIN cũ (hash mới vì salt mới, nhưng giá
   *    trị PIN không đổi) ⇒ không có "bất ngờ" nào. Không cần cổng chống trùng theo `clientEventId`
   *    vì đây không phải sự kiện cộng dồn — cùng đầu vào luôn cho cùng kết quả.
   *
   * ⚠️ KHÔNG tiết lộ "tài khoản có PIN hay chưa": hàm chạy y hệt dù `pin_hash` đang NULL hay có.
   */
  async resetPin(parentId: string, rawInput: unknown, now: Date = new Date()): Promise<void> {
    const input: ResetPinInput = resetPinSchema.parse(rawInput);

    const row = this.db
      .prepare('SELECT password_hash FROM parent_account WHERE id = ?')
      .get(parentId) as { password_hash: string } | undefined;
    // Không thể xảy ra (route đã `requireParent`), nhưng nếu có thì là 401 chứ không phải 500.
    if (!row) throw errors.unauthenticated();

    // Xác minh mật khẩu bằng ĐÚNG hàm của luồng đăng nhập — KHÔNG có đường xác minh thứ hai.
    const ok = await verifyPassword(row.password_hash, input.password);
    if (!ok) {
      // Câu TRUNG TÍNH, không trách móc, không lộ tài khoản có PIN hay chưa. Dùng lại mã lỗi
      // "thông tin đăng nhập sai" có sẵn — đúng ngữ nghĩa (mật khẩu sai), và KHÔNG phải
      // `UNAUTHENTICATED` (mã đó client hiểu là "phiên hết hạn" ⇒ sẽ đá phụ huynh về đăng nhập
      // chỉ vì gõ nhầm một ký tự).
      logger.warn({ parentId }, 'Đặt lại PIN: mật khẩu không đúng');
      throw errors.invalidCredentials();
    }

    const hash = await hashPin(input.pin);
    const at = now.toISOString();

    transaction((db) => {
      db.prepare('UPDATE parent_account SET pin_hash = ?, updated_at = ? WHERE id = ?').run(
        hash,
        at,
        parentId,
      );
    });

    // ⚠️ KHÔNG log PIN. `logger.warn` vì đây là một thao tác an ninh đáng ghi vết (khác nhịp với
    //    những lần đặt PIN thường).
    logger.warn({ parentId }, 'Đã ĐẶT LẠI mã PIN phụ huynh bằng mật khẩu');
  }

  /**
   * Cổng đang mở cho phiên này chưa — dùng cho `requireParentGate` (quyền đổi PIN).
   *
   * ⚠️ KHÁC `describeGate` ở đúng một điểm: tài khoản CHƯA có PIN thì coi như cổng mở (quyết
   *    định 3), còn `describeGate` (dữ liệu trả về client) thì không quan tâm `pin_hash`.
   */
  isGateOpen(parentId: string, sessionToken: string, now: Date = new Date()): boolean {
    if (this.readPinHash(parentId) === null) return true;
    return this.describeGate(sessionToken, now).opened;
  }

  // --- Nội bộ ---------------------------------------------------------------

  /**
   * Mô tả cổng CHỈ từ `gate_opened_at` của phiên (quyết định 2).
   *
   * ⚠️ Hạn TUYỆT ĐỐI tính từ lúc mở, không gia hạn theo mỗi request — xem `PARENT_GATE_TTL_MS`.
   */
  private describeGate(sessionToken: string, now: Date): ParentGateResponse {
    const openedAt = this.auth.readGateOpenedAt(sessionToken);
    if (openedAt === null) return { opened: false, expiresAt: null };

    const expiresMs = Date.parse(openedAt) + PARENT_GATE_TTL_MS;
    if (!Number.isFinite(expiresMs) || now.getTime() >= expiresMs) {
      // Hết hạn (hoặc `gate_opened_at` hỏng): coi như cổng đóng. KHÔNG xoá cột — lần đọc sau
      // cũng ra kết quả cũ, và việc dọn dẹp không cần thiết cho một giá trị vô hại.
      return { opened: false, expiresAt: null };
    }
    return { opened: true, expiresAt: new Date(expiresMs).toISOString() };
  }

  /** `pin_hash` của phụ huynh, hoặc `null` nếu chưa đặt PIN. */
  private readPinHash(parentId: string): string | null {
    const row = this.db
      .prepare('SELECT pin_hash FROM parent_account WHERE id = ?')
      .get(parentId) as { pin_hash: string | null } | undefined;
    return row?.pin_hash ?? null;
  }
}

/** Dùng chung một instance. */
export const parentService = new ParentService();
