// @vitest-environment node
/**
 * RubyLingo — test tầng HTTP cho CỔNG PIN trên HỒ SƠ BÉ (T072.3).
 *
 * ⭐ VÌ SAO CẦN TỆP RIÊNG: `auth-routes.test.ts` đã phủ hồ sơ bé qua HTTP, nhưng nó KHÔNG (và
 *   không nên) phủ hành vi của cổng PIN trên hai route đó. Đây là một LUẬT AN NINH riêng, có hai
 *   vế đối lập cần khoá cùng lúc:
 *     • cổng ĐÓNG  ⇒ `PATCH`/`DELETE` phải bị chặn (403 PARENT_GATE_REQUIRED) và KHÔNG được đổi gì;
 *     • cổng MỞ    ⇒ hai route đó vẫn phải chạy (nếu không, ta vừa "vá" bằng cách KHOÁ LUÔN tính năng).
 *   Chỉ khẳng định vế đầu là chưa đủ: một `preHandler` chặn nhầm mọi request cũng sẽ làm test đầu
 *   xanh trong khi tính năng chết.
 *
 * ⚠️ VÌ SAO `DELETE` QUAN TRỌNG NHẤT: nó PHÁ HUỶ — xoá hồ sơ kéo theo toàn bộ tiến độ/ví/huy hiệu
 *   của bé (`ON DELETE CASCADE`) và không hoàn tác được. Trước T072.3 nó chỉ cần `requireParent`,
 *   tức là một phiên đang mở (bé với DevTools) xoá được hồ sơ mà không cần PIN.
 *
 * ✅ VÀ TÀI KHOẢN CHƯA CÓ PIN KHÔNG BỊ KHOÁ: `isGateOpen` trả `true` khi `pin_hash` NULL (ngoại lệ
 *   có chủ ý của T072) ⇒ phụ huynh vừa tạo tài khoản dùng được ngay. Test cuối khoá điều đó.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';

import { buildApp, type AppInstance } from '../../../server/app.js';
import { config } from '../../../server/config.js';
import { closeDb, getDb } from '../../../server/db/connection.js';
import type { ChildProfileDto } from '../../../shared/types/api.js';
import { clearAllData, setupTestDb } from './helpers/testDb.js';

let app: AppInstance;

const PASSWORD = 'matkhau-cong-ho-so-700';

let requestSeq = 0;
function withClient(headers: Record<string, string> = {}): Record<string, string> {
  requestSeq += 1;
  return { 'x-forwarded-for': `10.3.0.${requestSeq % 250}`, ...headers };
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

/** Đặt PIN ⇒ (theo T072) thao tác này CŨNG mở cổng cho chính phiên đang gọi. */
function setPin(cookie: string, pin: string): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'PATCH',
    url: '/api/parent/pin',
    headers: withClient({ cookie }),
    payload: { pin },
  });
}

function openGate(cookie: string, pin: string): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url: '/api/parent/gate',
    headers: withClient({ cookie }),
    payload: { pin },
  });
}

function patchChild(
  cookie: string,
  childId: string,
  body: Record<string, unknown>,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'PATCH',
    url: `/api/children/${encodeURIComponent(childId)}`,
    headers: withClient({ cookie }),
    payload: body,
  });
}

function deleteChild(cookie: string, childId: string): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'DELETE',
    url: `/api/children/${encodeURIComponent(childId)}`,
    headers: withClient({ cookie }),
  });
}

/** Danh sách bé — route này KHÔNG gated, nên dùng được để kiểm "có bị đổi gì không". */
async function listChildren(cookie: string): Promise<ChildProfileDto[]> {
  const res = await app.inject({
    method: 'GET',
    url: '/api/children',
    headers: withClient({ cookie }),
  });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { data: { children: ChildProfileDto[] } }).data.children;
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
// Cổng ĐÓNG ⇒ chặn, và KHÔNG được đổi gì
// =============================================================================

describe('⚠️ cổng PIN ĐÓNG ⇒ PATCH/DELETE hồ sơ bị chặn', () => {
  it('PATCH ⇒ 403 PARENT_GATE_REQUIRED, và hồ sơ KHÔNG đổi', async () => {
    const cookie = await signup('gate-child-a@example.com');
    const childId = await createChild(cookie, 'Na');
    expect((await setPin(cookie, '1111')).statusCode).toBe(200);

    const fresh = await login('gate-child-a@example.com'); // phiên mới ⇒ cổng ĐÓNG

    const res = await patchChild(fresh, childId, { nickname: 'Bị đổi' });
    expect(res.statusCode).toBe(403);
    expect((res.json() as { error: { code: string } }).error.code).toBe('PARENT_GATE_REQUIRED');

    // ⚠️ Khẳng định cả VẾ "không có tác dụng phụ": mã 403 đúng là chưa đủ — nếu `preHandler` chạy
    //    SAU handler thì request đã đổi dữ liệu rồi mới bị chặn.
    const children = await listChildren(fresh);
    expect(children).toHaveLength(1);
    expect(children[0]!.nickname).toBe('Na');
  });

  it('⭐ DELETE (phá huỷ) ⇒ 403 PARENT_GATE_REQUIRED, và hồ sơ VẪN CÒN', async () => {
    const cookie = await signup('gate-child-b@example.com');
    const childId = await createChild(cookie, 'Bin');
    expect((await setPin(cookie, '1111')).statusCode).toBe(200);

    const fresh = await login('gate-child-b@example.com');

    const res = await deleteChild(fresh, childId);
    expect(res.statusCode).toBe(403);
    expect((res.json() as { error: { code: string } }).error.code).toBe('PARENT_GATE_REQUIRED');

    // Hồ sơ PHẢI còn nguyên — và còn nguyên cả dữ liệu con (CASCADE chưa hề chạy).
    const children = await listChildren(fresh);
    expect(children.map((c) => c.id)).toEqual([childId]);
  });
});

// =============================================================================
// Cổng MỞ ⇒ vẫn phải chạy (nếu không là "vá bằng cách khoá tính năng")
// =============================================================================

describe('cổng PIN MỞ ⇒ PATCH/DELETE vẫn chạy bình thường', () => {
  it('nhập PIN để mở cổng rồi PATCH/DELETE thành công', async () => {
    const cookie = await signup('gate-child-c@example.com');
    const childId = await createChild(cookie, 'Na');
    expect((await setPin(cookie, '1111')).statusCode).toBe(200);

    const fresh = await login('gate-child-c@example.com');
    // Trước khi mở cổng thì bị chặn…
    expect((await patchChild(fresh, childId, { nickname: 'X' })).statusCode).toBe(403);

    // …mở cổng bằng ĐÚNG PIN…
    const opened = await openGate(fresh, '1111');
    expect(opened.statusCode, opened.body).toBe(200);

    // …rồi cả hai route phải chạy.
    const patched = await patchChild(fresh, childId, { nickname: 'Momo' });
    expect(patched.statusCode, patched.body).toBe(200);
    expect((patched.json() as { data: { child: ChildProfileDto } }).data.child.nickname).toBe('Momo');

    const deleted = await deleteChild(fresh, childId);
    expect(deleted.statusCode, deleted.body).toBe(200);
    expect(await listChildren(fresh)).toHaveLength(0);
  });
});

// =============================================================================
// Không khoá người dùng MỚI (chưa có PIN)
// =============================================================================

describe('✅ tài khoản CHƯA có PIN không bị khoá', () => {
  it('chưa đặt PIN ⇒ PATCH/DELETE chạy được mà KHÔNG cần mở cổng', async () => {
    const cookie = await signup('gate-child-d@example.com');
    const childId = await createChild(cookie, 'Na');

    // KHÔNG đặt PIN, KHÔNG gọi /parent/gate. `isGateOpen` trả true khi `pin_hash` NULL.
    const patched = await patchChild(cookie, childId, { nickname: 'Bin' });
    expect(patched.statusCode, patched.body).toBe(200);

    const deleted = await deleteChild(cookie, childId);
    expect(deleted.statusCode, deleted.body).toBe(200);
  });
});
