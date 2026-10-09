// @vitest-environment node
/**
 * RubyLingo — Test TẦNG HTTP cho CỔNG PIN phụ huynh (T072).
 *
 * ⚠️ VÌ SAO PHẢI KIỂM Ở TẦNG HTTP, KHÔNG CHỈ Ở SERVICE:
 *   `ParentService` gọi thẳng thì không thấy được những thứ CHỈ hỏng khi đi qua HTTP:
 *     • `POST /api/parent/gate` có thật sự gắn RATE-LIMIT hay không (thiếu ⇒ dò được PIN trong
 *       vài phút — đây là yêu cầu an ninh số 1 của T072);
 *     • `PATCH /api/parent/pin` có thật sự bị `requireParentGate` chắn hay không;
 *     • route có được ĐĂNG KÝ ở `app.ts` hay không (quên ⇒ 404 cho tính năng đã viết xong);
 *     • `requireParent` có gắn thật không (quên ⇒ API phụ huynh mở cho người chưa đăng nhập).
 *   Tất cả đều là lỗi IM LẶNG: `typecheck`, `lint` và test đơn vị đều xanh.
 *
 * ⭐ HAI ĐIỀU AN NINH ĐƯỢC KHOÁ Ở ĐÂY:
 *   1. **PIN LƯU DẠNG HASH**, không phải bản rõ (đọc thẳng `parent_account.pin_hash`).
 *   2. **PHẢN HỒI KHÔNG TIẾT LỘ "CÓ PIN HAY CHƯA"**: `GET /gate` của tài khoản CHƯA có PIN phải
 *      GIỐNG HỆT tài khoản ĐÃ có PIN mà cổng đang đóng. Khác nhau dù chỉ một trường là rò rỉ.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';

import { buildApp, type AppInstance } from '../../../server/app.js';
import { config } from '../../../server/config.js';
import { closeDb, getDb } from '../../../server/db/connection.js';
import { sha256 } from '../../../server/lib/password.js';
import { PARENT_GATE_TTL_MS } from '../../../shared/constants.js';
import type { ParentGateResponse } from '../../../shared/types/api.js';
import { clearAllData, setupTestDb } from './helpers/testDb.js';

let app: AppInstance;

const PASSWORD = 'matkhau-gate-700-xyz';

/** Mỗi request một IP riêng để KHÔNG đụng rate-limit toàn cục (300/phút) — xem `quest-routes`. */
let requestSeq = 0;
function withClient(headers: Record<string, string> = {}): Record<string, string> {
  requestSeq += 1;
  return { 'x-forwarded-for': `10.7.0.${requestSeq % 250}`, ...headers };
}

function sessionCookieOf(res: LightMyRequestResponse): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = list.find((c) => c.startsWith(`${config.cookie.name}=`));
  if (!found) throw new Error(`Response KHÔNG đặt cookie phiên "${config.cookie.name}".`);
  return found.split(';')[0]!;
}

/** Token BẢN RÕ nằm trong cookie (`name=token`). */
function tokenOf(cookie: string): string {
  return cookie.slice(cookie.indexOf('=') + 1);
}

async function signup(email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    headers: withClient(),
    payload: { email, password: PASSWORD, parentalConsent: true },
  });
  expect(res.statusCode, res.body).toBe(201);
  return sessionCookieOf(res);
}

/** Phiên MỚI cho cùng tài khoản — để có một phiên "cổng đang đóng" sau khi đã đặt PIN. */
async function login(email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: withClient(),
    payload: { email, password: PASSWORD },
  });
  expect(res.statusCode, res.body).toBe(200);
  return sessionCookieOf(res);
}

function gateStatus(cookie: string): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'GET', url: '/api/parent/gate', headers: withClient({ cookie }) });
}

function gatePost(cookie: string, pin: unknown): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url: '/api/parent/gate',
    headers: withClient({ cookie }),
    payload: { pin },
  });
}

function pinPatch(cookie: string, pin: unknown): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'PATCH',
    url: '/api/parent/pin',
    headers: withClient({ cookie }),
    payload: { pin },
  });
}

function resetPinPost(
  cookie: string,
  body: object,
  hdrs: Record<string, string> = {},
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url: '/api/parent/pin/reset',
    headers: withClient({ cookie, ...hdrs }),
    payload: body,
  });
}

/**
 * Đặt thẳng `session.gate_opened_at` — cách DUY NHẤT "đẩy thời gian" qua tầng HTTP.
 *
 * ⚠️ VÌ SAO KHÔNG GIẢ LẬP ĐỒNG HỒ: route dùng `new Date()` ở server. Sửa mốc trong DB rồi gọi
 *    route thật cho ta đúng hành vi thật (server tự tính "còn hạn hay không" khi đọc), thay vì
 *    tiêm `now` qua một đường mà sản phẩm không có.
 */
function setGateOpenedAt(cookie: string, iso: string): void {
  getDb()
    .prepare('UPDATE session SET gate_opened_at = ? WHERE token_hash = ?')
    .run(iso, sha256(tokenOf(cookie)));
}

function gateBody(res: LightMyRequestResponse): ParentGateResponse {
  return (res.json() as { data: ParentGateResponse }).data;
}

/** `pin_hash` của phụ huynh sở hữu cookie này (đọc thẳng DB — để chứng minh có băm). */
function pinHashOf(cookie: string): string | null {
  const row = getDb()
    .prepare(
      `SELECT pa.pin_hash AS pin_hash
         FROM parent_account pa
         JOIN session s ON s.parent_id = pa.id
        WHERE s.token_hash = ?`,
    )
    .get(sha256(tokenOf(cookie))) as { pin_hash: string | null } | undefined;
  return row?.pin_hash ?? null;
}

beforeAll(async () => {
  setupTestDb();
  app = await buildApp();
});

beforeEach(() => {
  clearAllData(getDb());
});

afterAll(async () => {
  await app.close();
  closeDb();
});

// =============================================================================
// Bảo vệ cơ bản
// =============================================================================

describe('cổng PIN — chưa đăng nhập', () => {
  it('GET/POST /api/parent/gate đều 401 khi không có phiên', async () => {
    const get = await app.inject({ method: 'GET', url: '/api/parent/gate', headers: withClient() });
    expect(get.statusCode).toBe(401);
    expect((get.json() as { error: { code: string } }).error.code).toBe('UNAUTHENTICATED');

    const post = await app.inject({
      method: 'POST',
      url: '/api/parent/gate',
      headers: withClient(),
      payload: { pin: '1234' },
    });
    expect(post.statusCode).toBe(401);
  });

  it('PATCH /api/parent/pin cũng 401 khi không có phiên', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/parent/pin',
      headers: withClient(),
      payload: { pin: '1234' },
    });
    expect(res.statusCode).toBe(401);
  });
});

// =============================================================================
// Luồng cổng
// =============================================================================

describe('cổng PIN — luồng mở cổng và đặt PIN', () => {
  it('tài khoản mới (CHƯA có PIN): cổng đang đóng', async () => {
    const cookie = await signup('gate1@example.com');
    const res = await gateStatus(cookie);
    expect(res.statusCode).toBe(200);
    expect(gateBody(res)).toEqual({ opened: false, expiresAt: null });
  });

  it('PIN hợp lệ mở cổng; cổng có HẠN (expiresAt) chứ không mở vĩnh viễn', async () => {
    const cookie = await signup('gate2@example.com');
    const res = await gatePost(cookie, '1234');
    expect(res.statusCode, res.body).toBe(200);

    const data = gateBody(res);
    expect(data.opened).toBe(true);
    expect(data.expiresAt).toBeTruthy();

    // Hạn = lúc mở + `PARENT_GATE_TTL_MS` (dung sai vài giây). Khẳng định để ngày ai đó đổi
    // thành "mở vĩnh viễn" thì test đỏ, chứ không âm thầm nới cổng.
    const ttl = Date.parse(data.expiresAt!) - Date.now();
    expect(ttl).toBeGreaterThan(PARENT_GATE_TTL_MS - 60_000);
    expect(ttl).toBeLessThanOrEqual(PARENT_GATE_TTL_MS + 5_000);

    expect(gateBody(await gateStatus(cookie)).opened).toBe(true);
  });

  it('đặt PIN ĐẦU TIÊN được: PATCH /pin khi chưa có PIN (cổng coi như mở)', async () => {
    const cookie = await signup('gate3@example.com');
    const res = await pinPatch(cookie, '4321');
    expect(res.statusCode, res.body).toBe(200);

    // ⚠️ LƯU DẠNG HASH, KHÔNG PHẢI BẢN RÕ — khẳng định an ninh, không phải chi tiết.
    const hash = pinHashOf(cookie);
    expect(hash).toBeTruthy();
    expect(hash).not.toBe('4321');
    expect(hash!.startsWith('$argon2id$')).toBe(true);

    // ⭐ VÀ CỔNG MỞ LUÔN cho phiên vừa đặt PIN: nếu không, phụ huynh bị đá ra ngay sau khi bấm Lưu.
    expect(gateBody(await gateStatus(cookie)).opened).toBe(true);
  });

  it('sai PIN ⇒ 403 INVALID_PIN; đúng PIN ⇒ mở cổng', async () => {
    const cookie = await signup('gate4@example.com');
    expect((await pinPatch(cookie, '1111')).statusCode).toBe(200);

    const fresh = await login('gate4@example.com'); // phiên mới: cổng đóng

    const wrong = await gatePost(fresh, '9999');
    expect(wrong.statusCode).toBe(403);
    expect((wrong.json() as { error: { code: string } }).error.code).toBe('INVALID_PIN');
    expect(gateBody(await gateStatus(fresh)).opened).toBe(false);

    const right = await gatePost(fresh, '1111');
    expect(right.statusCode, right.body).toBe(200);
    expect(gateBody(right).opened).toBe(true);
  });

  it('PIN sai định dạng (không phải 4 số) ⇒ 400 VALIDATION_FAILED', async () => {
    const cookie = await signup('gate5@example.com');
    for (const bad of ['12', 'abc', '12a4', '123456']) {
      const res = await gatePost(cookie, bad);
      expect(res.statusCode, `pin=${bad}`).toBe(400);
      expect((res.json() as { error: { code: string } }).error.code).toBe('VALIDATION_FAILED');
    }
  });
});

// =============================================================================
// ⭐ HẠN của cổng (#24) — hết hạn thì cổng ĐÓNG, kể cả khi không ai đụng vào
// =============================================================================
//
// ⚠️⚠️ VÌ SAO HẠN LÀ **TUYỆT ĐỐI** (không gia hạn theo request) — ĐỌC TRƯỚC KHI "tiện tay" đổi:
//   Kịch bản thật: phụ huynh mở cổng trên máy tính bảng rồi ĐƯA MÁY CHO BÉ. Nếu mỗi request lại
//   gia hạn thêm `TTL` thì chỉ cần một tab đang mở (hoặc bé chạm vào màn hình vài lần) là cổng
//   SỐNG MÃI — đúng thứ cổng sinh ra để chặn. Hạn tuyệt đối tính TỪ LÚC MỞ khiến cổng tự đóng
//   sau `PARENT_GATE_TTL_MS` bất kể có bao nhiêu request trong lúc đó.
//
//   Bộ đột biến `t072` tìm ra rằng nhánh kiểm hạn này từng KHÔNG được test nào canh: bỏ nó đi thì
//   0/18 test đỏ. Hai test dưới đây là chốt chặn cho đúng nhánh đó.

describe('⭐ cổng PIN có HẠN TUYỆT ĐỐI', () => {
  it('QUA hạn ⇒ `opened === false` VÀ `PATCH /pin` bị 403 (cổng đã đóng)', async () => {
    const cookie = await signup('gate-expire@example.com');
    // Đặt PIN (thao tác này cũng mở cổng cho phiên hiện tại) ⇒ cổng đang MỞ.
    expect((await pinPatch(cookie, '1111')).statusCode).toBe(200);
    expect(gateBody(await gateStatus(cookie)).opened).toBe(true);

    // Đẩy mốc mở cổng về QUÁ KHỨ: đã quá hạn 1 giây.
    setGateOpenedAt(cookie, new Date(Date.now() - PARENT_GATE_TTL_MS - 1_000).toISOString());

    const status = gateBody(await gateStatus(cookie));
    expect(status.opened).toBe(false);
    // Cổng đã đóng thì KHÔNG còn hạn nào để báo — nếu vẫn trả `expiresAt` thì client sẽ hiện
    // một mốc "còn hiệu lực" cho một cổng đã đóng.
    expect(status.expiresAt).toBeNull();

    const patched = await pinPatch(cookie, '2222');
    expect(patched.statusCode).toBe(403);
    expect((patched.json() as { error: { code: string } }).error.code).toBe('PARENT_GATE_REQUIRED');
  });

  it('⭐ ĐÚNG RANH GIỚI: ngay TRƯỚC hạn còn MỞ, vừa QUA hạn ĐÓNG', async () => {
    const cookie = await signup('gate-boundary@example.com');
    expect((await pinPatch(cookie, '1111')).statusCode).toBe(200);

    // Còn 5 giây nữa mới hết hạn ⇒ phải CÒN MỞ. (Dung sai 5s là để bù độ trễ vài chục ms của
    // request — không phải để "nới" luật: điều được kiểm là CHIỀU của phép so.)
    setGateOpenedAt(cookie, new Date(Date.now() - PARENT_GATE_TTL_MS + 5_000).toISOString());
    expect(gateBody(await gateStatus(cookie)).opened).toBe(true);

    // Quá hạn 1 giây ⇒ phải ĐÓNG. (`describeGate` dùng `>=`, và độ trễ request chỉ làm mốc
    // "già" thêm ⇒ nằm chắc bên phía ĐÓNG, không thể flake sang phía mở.)
    setGateOpenedAt(cookie, new Date(Date.now() - PARENT_GATE_TTL_MS - 1_000).toISOString());
    expect(gateBody(await gateStatus(cookie)).opened).toBe(false);
  });

  it('hạn KHÔNG trượt: đọc trạng thái nhiều lần cũng KHÔNG kéo dài `expiresAt`', async () => {
    const cookie = await signup('gate-notsliding@example.com');
    expect((await pinPatch(cookie, '1111')).statusCode).toBe(200);

    const first = gateBody(await gateStatus(cookie)).expiresAt;
    await gateStatus(cookie);
    await gateStatus(cookie);
    const later = gateBody(await gateStatus(cookie)).expiresAt;

    // Cùng một mốc hết hạn — đây chính là "không gia hạn theo request".
    expect(later).toBe(first);
  });
});

// =============================================================================
// PATCH /pin bị cổng chắn
// =============================================================================

describe('PATCH /api/parent/pin — BẮT BUỘC qua cổng', () => {
  it('⚠️ khi cổng ĐÓNG: 403 PARENT_GATE_REQUIRED và KHÔNG đổi PIN', async () => {
    const cookie = await signup('gate6@example.com');
    expect((await pinPatch(cookie, '1111')).statusCode).toBe(200);
    const hashAfterSet = pinHashOf(cookie);

    const fresh = await login('gate6@example.com'); // cổng đóng
    const res = await pinPatch(fresh, '2222');
    expect(res.statusCode).toBe(403);
    expect((res.json() as { error: { code: string } }).error.code).toBe('PARENT_GATE_REQUIRED');

    expect(pinHashOf(cookie)).toBe(hashAfterSet);
  });

  it('mở cổng rồi thì PATCH đổi được PIN, và PIN CŨ thôi hiệu lực', async () => {
    const cookie = await signup('gate7@example.com');
    expect((await pinPatch(cookie, '1111')).statusCode).toBe(200);

    const fresh = await login('gate7@example.com');
    expect((await gatePost(fresh, '1111')).statusCode).toBe(200); // mở cổng bằng PIN cũ
    expect((await pinPatch(fresh, '5555')).statusCode).toBe(200); // đổi PIN

    const another = await login('gate7@example.com');
    expect((await gatePost(another, '1111')).statusCode).toBe(403); // PIN cũ hết hiệu lực
    expect((await gatePost(another, '5555')).statusCode).toBe(200); // PIN mới dùng được
  });
});

// =============================================================================
// KHÔNG RÒ RỈ
// =============================================================================

describe('⭐ không tiết lộ "đã đặt PIN hay chưa"', () => {
  it('GET /gate: tài khoản CHƯA có PIN giống HỆT tài khoản ĐÃ có PIN (cổng đóng)', async () => {
    const noPin = await signup('leak-a@example.com');
    const noPinBody = gateBody(await gateStatus(noPin));

    const withPin = await signup('leak-b@example.com');
    expect((await pinPatch(withPin, '1111')).statusCode).toBe(200);
    const freshWithPin = await login('leak-b@example.com');
    const withPinBody = gateBody(await gateStatus(freshWithPin));

    expect(noPinBody).toEqual({ opened: false, expiresAt: null });
    expect(withPinBody).toEqual(noPinBody); // ⇐ HAI tài khoản khác nhau, MỘT hình dạng
  });
});

// =============================================================================
// Rate-limit — BẮT BUỘC cho cổng PIN
// =============================================================================

describe('⚠️ POST /api/parent/gate có RATE-LIMIT', () => {
  it('thử liên tục từ CÙNG một IP ⇒ bị chặn 429 (không dò được PIN 4 số thoải mái)', async () => {
    const cookie = await signup('gate8@example.com');
    expect((await pinPatch(cookie, '1111')).statusCode).toBe(200);

    const ip = { 'x-forwarded-for': '10.6.6.6' }; // CÙNG một IP cho mọi lần thử
    const statuses: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/parent/gate',
        headers: { cookie, ...ip },
        payload: { pin: '9999' },
      });
      statuses.push(res.statusCode);
    }

    // Lần đầu CHƯA chạm trần (sai PIN ⇒ 403) — để chắc 429 là do rate-limit, không phải chặn bừa.
    expect(statuses[0]).toBe(403);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// T072.1 — đặt lại PIN khi QUÊN (xác thực bằng MẬT KHẨU)
// =============================================================================

describe('POST /api/parent/pin/reset — đường lùi khi quên PIN', () => {
  it('mật khẩu ĐÚNG ⇒ PIN đổi; PIN CŨ thôi hiệu lực, PIN MỚI dùng được', async () => {
    const cookie = await signup('reset1@example.com');
    expect((await pinPatch(cookie, '1111')).statusCode).toBe(200);

    const fresh = await login('reset1@example.com'); // cổng đóng
    const res = await resetPinPost(fresh, { password: PASSWORD, pin: '9090' });
    expect(res.statusCode, res.body).toBe(200);

    const another = await login('reset1@example.com');
    expect((await gatePost(another, '1111')).statusCode).toBe(403); // PIN cũ hết hiệu lực
    expect((await gatePost(another, '9090')).statusCode).toBe(200); // PIN mới dùng được
  });

  it('⚠️ đặt lại PIN KHÔNG mở cổng — cổng CHỈ mở bằng cách NHẬP PIN', async () => {
    const cookie = await signup('reset2@example.com');
    expect((await pinPatch(cookie, '1111')).statusCode).toBe(200);

    const fresh = await login('reset2@example.com');
    expect((await resetPinPost(fresh, { password: PASSWORD, pin: '9090' })).statusCode).toBe(200);

    // CÙNG phiên vừa đặt lại: cổng vẫn ĐÓNG (nếu tự mở thì có hai đường vào khu vực phụ huynh).
    expect(gateBody(await gateStatus(fresh)).opened).toBe(false);
  });

  it('mật khẩu SAI ⇒ 401 INVALID_CREDENTIALS (câu trung tính), PIN KHÔNG đổi', async () => {
    const cookie = await signup('reset3@example.com');
    expect((await pinPatch(cookie, '1111')).statusCode).toBe(200);
    const before = pinHashOf(cookie);

    const fresh = await login('reset3@example.com');
    const res = await resetPinPost(fresh, { password: 'khong-phai-mat-khau', pin: '9090' });
    expect(res.statusCode).toBe(401);
    expect((res.json() as { error: { code: string } }).error.code).toBe('INVALID_CREDENTIALS');
    expect(pinHashOf(cookie)).toBe(before);
  });

  it('chạy được cả khi CHƯA từng có PIN (không lộ "có PIN hay chưa")', async () => {
    const cookie = await signup('reset4@example.com');
    const res = await resetPinPost(cookie, { password: PASSWORD, pin: '7070' });
    expect(res.statusCode, res.body).toBe(200);

    const another = await login('reset4@example.com');
    expect((await gatePost(another, '7070')).statusCode).toBe(200);
  });

  it('PIN sai định dạng / thiếu mật khẩu ⇒ 400 VALIDATION_FAILED', async () => {
    const cookie = await signup('reset5@example.com');
    expect((await resetPinPost(cookie, { password: PASSWORD, pin: '12' })).statusCode).toBe(400);
    expect((await resetPinPost(cookie, { password: '', pin: '1234' })).statusCode).toBe(400);
  });

  it('chưa đăng nhập ⇒ 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/parent/pin/reset',
      headers: withClient(),
      payload: { password: PASSWORD, pin: '1234' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('⚠️ có RATE-LIMIT (đây là endpoint ĐOÁN mật khẩu)', async () => {
    const cookie = await signup('reset6@example.com');
    const ip = { 'x-forwarded-for': '10.5.5.5' };
    const statuses: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/parent/pin/reset',
        headers: { cookie, ...ip },
        payload: { password: 'sai-mat-khau', pin: '1234' },
      });
      statuses.push(res.statusCode);
    }
    expect(statuses[0]).toBe(401); // mật khẩu sai ⇒ 401 (chưa chạm trần)
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1);
  });
});
