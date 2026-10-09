// @vitest-environment node
/**
 * RubyLingo — Test TẦNG HTTP cho CÀI ĐẶT CỦA BÉ (T074).
 *
 * ⭐ HAI ĐIỀU QUAN TRỌNG NHẤT CỦA TỆP NÀY, VÀ CẢ HAI ĐỀU LÀ LỖI IM LẶNG:
 *
 *   1. ⚠️ **PATCH PHẢI LÀ CẬP NHẬT MỘT PHẦN THẬT.** Gửi MỘT trường ⇒ các trường khác GIỮ NGUYÊN.
 *      Nếu ai đó thêm `.default()` vào schema, hoặc dùng `||` thay `??` trong service, thì một
 *      request chỉnh tốc độ đọc sẽ ĐẶT LẠI âm thanh/nhạc về mặc định — phụ huynh chỉnh một thứ
 *      và mất một thứ khác, không có lỗi nào hiện ra. Test ⑥ và ⑦ khoá đúng hai đường đó.
 *   2. ⚠️ **`false` PHẢI CÓ TÁC DỤNG.** "Bé tắt tiếng" gửi `soundEnabled: false` — giá trị FALSY
 *      hợp lệ. `input.soundEnabled || current.soundEnabled` sẽ nuốt mất nó ⇒ không tắt được tiếng.
 *
 * ⭐ VÀ BA TẦNG GUARD: `requireParent` (đăng nhập) · `requireParentGate` (cổng PIN) · SỞ HỮU
 *   `parent_id` (ranh giới giữa các gia đình).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';

import { buildApp, type AppInstance } from '../../../server/app.js';
import { config } from '../../../server/config.js';
import { closeDb, getDb } from '../../../server/db/connection.js';
import { SPEECH_RATE_MAX, SPEECH_RATE_MIN } from '../../../shared/constants.js';
import type { SettingsDto } from '../../../shared/types/api.js';
import { clearAllData, setupTestDb } from './helpers/testDb.js';

let app: AppInstance;

const PASSWORD = 'matkhau-settings-700';

let requestSeq = 0;
function withClient(headers: Record<string, string> = {}): Record<string, string> {
  requestSeq += 1;
  return { 'x-forwarded-for': `10.4.0.${requestSeq % 250}`, ...headers };
}

function sessionCookieOf(res: LightMyRequestResponse): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = list.find((c) => c.startsWith(`${config.cookie.name}=`));
  if (!found) throw new Error(`Response KHÔNG đặt cookie phiên "${config.cookie.name}".`);
  return found.split(';')[0]!;
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

async function createChild(cookie: string, nickname: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/children',
    headers: withClient({ cookie }),
    payload: { nickname, age: 7, avatarId: 'fox' },
  });
  expect(res.statusCode, res.body).toBe(201);
  return (res.json() as { data: { child: { id: string } } }).data.child.id;
}

function getSettings(cookie: string, childId: string): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'GET',
    url: `/api/children/${encodeURIComponent(childId)}/settings`,
    headers: withClient({ cookie }),
  });
}

function patchSettings(
  cookie: string,
  childId: string,
  body: unknown,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'PATCH',
    url: `/api/children/${encodeURIComponent(childId)}/settings`,
    headers: withClient({ cookie }),
    payload: body as Record<string, unknown>,
  });
}

function settingsOf(res: LightMyRequestResponse): SettingsDto {
  return (res.json() as { data: SettingsDto }).data;
}

/** Mở cổng PIN cho phiên (tài khoản chưa có PIN ⇒ mọi PIN 4 số đều mở — xem T072). */
function openGate(cookie: string): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url: '/api/parent/gate',
    headers: withClient({ cookie }),
    payload: { pin: '1234' },
  });
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
// Ba tầng guard
// =============================================================================

describe('cài đặt — ba tầng bảo vệ', () => {
  it('chưa đăng nhập ⇒ 401 (cả GET lẫn PATCH)', async () => {
    const get = await app.inject({
      method: 'GET',
      url: '/api/children/chi_bat_ky/settings',
      headers: withClient(),
    });
    expect(get.statusCode).toBe(401);

    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/children/chi_bat_ky/settings',
      headers: withClient(),
      payload: { soundEnabled: false },
    });
    expect(patch.statusCode).toBe(401);
  });

  it('⚠️ cổng PIN ĐÓNG ⇒ 403 PARENT_GATE_REQUIRED (cả GET lẫn PATCH)', async () => {
    const cookie = await signup('set-gate@example.com');
    const childId = await createChild(cookie, 'Na');

    // Đặt PIN (phiên này mở cổng), rồi dùng phiên MỚI (cổng đóng).
    const setPin = await app.inject({
      method: 'PATCH',
      url: '/api/parent/pin',
      headers: withClient({ cookie }),
      payload: { pin: '1111' },
    });
    expect(setPin.statusCode, setPin.body).toBe(200);

    const fresh = await login('set-gate@example.com');
    const get = await getSettings(fresh, childId);
    expect(get.statusCode).toBe(403);
    expect((get.json() as { error: { code: string } }).error.code).toBe('PARENT_GATE_REQUIRED');

    const patch = await patchSettings(fresh, childId, { soundEnabled: false });
    expect(patch.statusCode).toBe(403);
  });

  it('⭐ con NHÀ KHÁC ⇒ 404 (ranh giới giữa các gia đình), cho cả GET lẫn PATCH', async () => {
    const cookieA = await signup('set-a@example.com');
    const childA = await createChild(cookieA, 'Na');
    const cookieB = await signup('set-b@example.com');
    expect((await openGate(cookieB)).statusCode).toBe(200); // B chưa có PIN ⇒ cổng mở ⇒ tới được tầng sở hữu

    const get = await getSettings(cookieB, childA);
    expect(get.statusCode).toBe(404);
    expect((get.json() as { error: { code: string } }).error.code).toBe('CHILD_NOT_FOUND');

    const patch = await patchSettings(cookieB, childA, { soundEnabled: false });
    expect(patch.statusCode).toBe(404);
  });
});

// =============================================================================
// ①②③④⑤ — đọc/ghi cơ bản
// =============================================================================

describe('cài đặt — đọc và ghi', () => {
  it('① bé mới ⇒ trả GIÁ TRỊ MẶC ĐỊNH (khớp DEFAULT của bảng)', async () => {
    const cookie = await signup('set-default@example.com');
    const childId = await createChild(cookie, 'Na');

    const res = await getSettings(cookie, childId);
    expect(res.statusCode, res.body).toBe(200);
    expect(settingsOf(res)).toEqual({
      soundEnabled: true,
      musicEnabled: true,
      speechRate: 0.8,
      reducedMotion: false,
    });
  });

  it('② PATCH một trường ⇒ GET thấy thay đổi đó', async () => {
    const cookie = await signup('set-one@example.com');
    const childId = await createChild(cookie, 'Na');

    const patched = await patchSettings(cookie, childId, { speechRate: 1.0 });
    expect(patched.statusCode, patched.body).toBe(200);
    expect(settingsOf(patched).speechRate).toBe(1.0);
    expect(settingsOf(await getSettings(cookie, childId)).speechRate).toBe(1.0);
  });

  it('③ hai bé của CÙNG phụ huynh có cài đặt ĐỘC LẬP', async () => {
    const cookie = await signup('set-two@example.com');
    const childA = await createChild(cookie, 'Na');
    const childB = await createChild(cookie, 'Bin');

    await patchSettings(cookie, childA, { speechRate: 0.6 });

    expect(settingsOf(await getSettings(cookie, childA)).speechRate).toBe(0.6);
    expect(settingsOf(await getSettings(cookie, childB)).speechRate).toBe(0.8);
  });

  it('④ hàng `settings` thiếu (DB sửa tay) ⇒ trả MẶC ĐỊNH, KHÔNG ném 500', async () => {
    const cookie = await signup('set-missing@example.com');
    const childId = await createChild(cookie, 'Na');
    getDb().prepare('DELETE FROM settings WHERE child_id = ?').run(childId);

    const res = await getSettings(cookie, childId);
    expect(res.statusCode, res.body).toBe(200);
    expect(settingsOf(res).speechRate).toBe(0.8);
  });

  it('⑤ hàng thiếu rồi PATCH ⇒ TẠO lại hàng với giá trị đã trộn (upsert)', async () => {
    const cookie = await signup('set-upsert@example.com');
    const childId = await createChild(cookie, 'Na');
    getDb().prepare('DELETE FROM settings WHERE child_id = ?').run(childId);

    const res = await patchSettings(cookie, childId, { reducedMotion: true });
    expect(res.statusCode, res.body).toBe(200);
    expect(settingsOf(res)).toEqual({
      soundEnabled: true, // mặc định
      musicEnabled: true,
      speechRate: 0.8,
      reducedMotion: true, // trường được gửi
    });

    const count = getDb()
      .prepare('SELECT COUNT(*) AS n FROM settings WHERE child_id = ?')
      .get(childId) as { n: number };
    expect(count.n).toBe(1);
  });
});

// =============================================================================
// ⑥⑦ — CẬP NHẬT MỘT PHẦN THẬT (hai cái bẫy im lặng)
// =============================================================================

describe('⭐ PATCH là CẬP NHẬT MỘT PHẦN THẬT', () => {
  it('⑥ gửi MỘT trường ⇒ MỌI trường khác GIỮ NGUYÊN (không bị đặt lại mặc định)', async () => {
    const cookie = await signup('set-partial@example.com');
    const childId = await createChild(cookie, 'Na');

    // Đặt trước một trạng thái KHÁC mặc định ở cả 3 trường còn lại.
    const before = await patchSettings(cookie, childId, {
      musicEnabled: false,
      speechRate: 1.1,
      reducedMotion: true,
    });
    expect(before.statusCode, before.body).toBe(200);

    // ⭐ Chỉ gửi `soundEnabled` — đúng một trường.
    const after = await patchSettings(cookie, childId, { soundEnabled: false });
    expect(after.statusCode, after.body).toBe(200);

    expect(settingsOf(after)).toEqual({
      soundEnabled: false, // trường được gửi
      musicEnabled: false, // 3 trường này PHẢI giữ nguyên, KHÔNG về mặc định (true/0.8/false)
      speechRate: 1.1,
      reducedMotion: true,
    });
  });

  it('⑦ `false` CÓ TÁC DỤNG (bẫy `||` thay vì `??` sẽ nuốt mất "tắt tiếng")', async () => {
    const cookie = await signup('set-false@example.com');
    const childId = await createChild(cookie, 'Na');

    const off = await patchSettings(cookie, childId, { soundEnabled: false });
    expect(settingsOf(off).soundEnabled).toBe(false);
    // Và đọc lại từ DB cũng phải là false (lưu 0, không phải 1).
    expect(settingsOf(await getSettings(cookie, childId)).soundEnabled).toBe(false);

    const on = await patchSettings(cookie, childId, { soundEnabled: true });
    expect(settingsOf(on).soundEnabled).toBe(true);
  });
});

// =============================================================================
// ⑧⑨⑩⑪ — Kiểm dữ liệu vào
// =============================================================================

describe('cài đặt — kiểm dữ liệu vào', () => {
  it('⑧ `speechRate` ngoài khoảng CHECK của bảng ⇒ 400 (biên hợp lệ thì qua)', async () => {
    const cookie = await signup('set-rate@example.com');
    const childId = await createChild(cookie, 'Na');

    for (const bad of [SPEECH_RATE_MIN - 0.1, SPEECH_RATE_MAX + 0.1, 0, 3]) {
      const res = await patchSettings(cookie, childId, { speechRate: bad });
      expect(res.statusCode, `speechRate=${bad}`).toBe(400);
      expect((res.json() as { error: { code: string } }).error.code).toBe('VALIDATION_FAILED');
    }

    // ⭐ BIÊN: đúng hai đầu khoảng phải QUA (khớp CHECK `>= 0.5 AND <= 1.2`).
    expect((await patchSettings(cookie, childId, { speechRate: SPEECH_RATE_MIN })).statusCode).toBe(200);
    expect((await patchSettings(cookie, childId, { speechRate: SPEECH_RATE_MAX })).statusCode).toBe(200);
  });

  it('⑨ object RỖNG ⇒ 400 (PATCH "thành công giả" không tồn tại)', async () => {
    const cookie = await signup('set-empty@example.com');
    const childId = await createChild(cookie, 'Na');
    const res = await patchSettings(cookie, childId, {});
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: { code: string } }).error.code).toBe('VALIDATION_FAILED');
  });

  it('⑩ sai KIỂU ⇒ 400 (không nhận "true"/"1" như chuỗi)', async () => {
    const cookie = await signup('set-type@example.com');
    const childId = await createChild(cookie, 'Na');

    expect((await patchSettings(cookie, childId, { soundEnabled: 'yes' })).statusCode).toBe(400);
    expect((await patchSettings(cookie, childId, { reducedMotion: 1 })).statusCode).toBe(400);
    expect((await patchSettings(cookie, childId, { speechRate: '1.0' })).statusCode).toBe(400);
  });

  it('⑪ trường KHÔNG hỗ trợ (vd `timezone`) bị TỪ CHỐI, không im lặng bỏ qua', async () => {
    const cookie = await signup('set-unknown@example.com');
    const childId = await createChild(cookie, 'Na');

    // `{ timezone }` bị `z.object` cắt thành `{}` ⇒ `refine` từ chối ⇒ 400. Một trường không có
    // thật phải ồn ào, KHÔNG được trả 200 rồi không lưu gì (phụ huynh tin là đã lưu).
    const res = await patchSettings(cookie, childId, { timezone: 'Asia/Ho_Chi_Minh' });
    expect(res.statusCode).toBe(400);

    // Còn khi trường hợp lệ ĐI KÈM trường lạ: phần hợp lệ vẫn được lưu, phần lạ bị cắt.
    const mixed = await patchSettings(cookie, childId, {
      soundEnabled: false,
      timezone: 'Asia/Ho_Chi_Minh',
    });
    expect(mixed.statusCode, mixed.body).toBe(200);
    expect(settingsOf(mixed).soundEnabled).toBe(false);
  });
});
