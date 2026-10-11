// @vitest-environment node
/**
 * RubyLingo — Test TẦNG HTTP cho xác nhận PHẦN NÓI của phụ huynh (TẦNG 4, Giai đoạn 11).
 *
 * ⭐ NHỮNG ĐIỀU CHỈ TẦNG HTTP MỚI BẤT ĐƯỢC:
 *   • route có được ĐĂNG KÝ hay không (quên ⇒ 404 cho tính năng đã viết xong);
 *   • guard đăng nhập (`requireParent`) và SỞ HỮU (`parent_id`) gắn THẬT;
 *   • lỗi validate trả đúng mã `VALIDATION_FAILED` (400);
 *   • GHI là MỘT transaction: lỗi giữa đường KHÔNG để lại hàng dở, và KHÔNG đụng ví/XP.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';

import { buildApp, type AppInstance } from '../../../server/app.js';
import { config } from '../../../server/config.js';
import { getDb } from '../../../server/db/connection.js';
import type { ParentSpeakingState } from '../../../shared/schemas/parent-speaking.js';
import { clearAllData, setupTestDb } from './helpers/testDb.js';

const PASSWORD = 'matkhau123';
let app: AppInstance;

function sessionCookieOf(res: LightMyRequestResponse): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = list.find((cookie) => cookie.startsWith(`${config.cookie.name}=`));
  if (!found) throw new Error('Response không đặt cookie phiên');
  return found.split(';')[0]!;
}

async function signup(email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email, password: PASSWORD, parentalConsent: true },
  });
  expect(res.statusCode, res.body).toBe(201);
  return sessionCookieOf(res);
}

async function createChild(cookie: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/children',
    headers: { cookie },
    payload: { nickname: 'Bông', age: 7, avatarId: 'panda' },
  });
  expect(res.statusCode, res.body).toBe(201);
  return (res.json() as { data: { child: { id: string } } }).data.child.id;
}

function getSpeaking(cookie: string | null, childId: string): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'GET',
    url: `/api/children/${childId}/parent-speaking`,
    ...(cookie ? { headers: { cookie } } : {}),
  });
}

function putSpeaking(
  cookie: string | null,
  childId: string,
  payload: object,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'PUT',
    url: `/api/children/${childId}/parent-speaking`,
    ...(cookie ? { headers: { cookie } } : {}),
    payload,
  });
}

function dataOf(res: LightMyRequestResponse): ParentSpeakingState {
  return (res.json() as { data: ParentSpeakingState }).data;
}

function countRows(childId: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS n FROM parent_speaking_confirm WHERE child_id = ?')
    .get(childId) as { n: number };
  return row.n;
}

describe('XÁC NHẬN PHẦN NÓI CỦA PHỤ HUYNH — API', () => {
  beforeAll(async () => {
    setupTestDb();
    app = await buildApp();
    await app.ready();
  });

  beforeEach(() => clearAllData(getDb()));

  it('chưa đăng nhập ⇒ chặn cả đọc lẫn ghi', async () => {
    const read = await getSpeaking(null, 'chi_x');
    const write = await putSpeaking(null, 'chi_x', { items: [] });
    expect(read.statusCode).toBe(401);
    expect(write.statusCode).toBe(401);
  });

  it('chưa xác nhận ⇒ trả mặc định hợp lệ { items: [], updatedAt: null }', async () => {
    const cookie = await signup('empty@example.com');
    const childId = await createChild(cookie);

    const res = await getSpeaking(cookie, childId);
    expect(res.statusCode, res.body).toBe(200);
    expect(dataOf(res)).toEqual({ items: [], updatedAt: null });
  });

  it('PUT rồi GET ⇒ đọc lại đúng trạng thái (kèm cả done:false)', async () => {
    const cookie = await signup('roundtrip@example.com');
    const childId = await createChild(cookie);

    const saved = await putSpeaking(cookie, childId, {
      items: [
        { id: 'p1', done: true },
        { id: 'p2', done: false },
      ],
    });
    expect(saved.statusCode, saved.body).toBe(200);
    expect(dataOf(saved).items).toEqual([
      { id: 'p1', done: true },
      { id: 'p2', done: false },
    ]);
    expect(dataOf(saved).updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/);

    const read = await getSpeaking(cookie, childId);
    expect(read.statusCode, read.body).toBe(200);
    expect(dataOf(read).items).toEqual([
      { id: 'p1', done: true },
      { id: 'p2', done: false },
    ]);
  });

  it('PUT ghi ĐÈ toàn bộ: mục bỏ ra khỏi payload bị xoá khỏi trạng thái', async () => {
    const cookie = await signup('overwrite@example.com');
    const childId = await createChild(cookie);

    await putSpeaking(cookie, childId, {
      items: [
        { id: 'p1', done: true },
        { id: 'p2', done: true },
        { id: 'p3', done: true },
      ],
    });
    await putSpeaking(cookie, childId, { items: [{ id: 'p4', done: true }] });

    const read = await getSpeaking(cookie, childId);
    expect(dataOf(read).items).toEqual([{ id: 'p4', done: true }]);
    expect(countRows(childId)).toBe(1); // một bé = một hàng
  });

  it('payload sai (id lạ / thiếu items / quá số mục) ⇒ 400 VALIDATION_FAILED', async () => {
    const cookie = await signup('invalid@example.com');
    const childId = await createChild(cookie);

    const badId = await putSpeaking(cookie, childId, { items: [{ id: 'p9', done: true }] });
    const missingItems = await putSpeaking(cookie, childId, {});
    const tooMany = await putSpeaking(cookie, childId, {
      items: [
        { id: 'p1', done: true },
        { id: 'p2', done: true },
        { id: 'p3', done: true },
        { id: 'p4', done: true },
        { id: 'p4', done: false },
      ],
    });

    for (const res of [badId, missingItems, tooMany]) {
      expect(res.statusCode, res.body).toBe(400);
      expect((res.json() as { error: { code: string } }).error.code).toBe('VALIDATION_FAILED');
    }
    expect(countRows(childId)).toBe(0);
  });

  it('bé của phụ huynh KHÁC ⇒ CHILD_NOT_FOUND cho cả đọc lẫn ghi, và không lộ dữ liệu', async () => {
    const cookieA = await signup('owner@example.com');
    const childId = await createChild(cookieA);
    await putSpeaking(cookieA, childId, { items: [{ id: 'p1', done: true }] });

    const cookieB = await signup('other@example.com');

    const read = await getSpeaking(cookieB, childId);
    const write = await putSpeaking(cookieB, childId, { items: [{ id: 'p2', done: true }] });
    expect(read.statusCode).toBe(404);
    expect(write.statusCode).toBe(404);
    expect((read.json() as { error: { code: string } }).error.code).toBe('CHILD_NOT_FOUND');

    // Dữ liệu của A KHÔNG bị B ghi đè.
    const stillA = await getSpeaking(cookieA, childId);
    expect(dataOf(stillA).items).toEqual([{ id: 'p1', done: true }]);
  });

  it('lỗi giữa transaction ⇒ rollback: KHÔNG có hàng dở, KHÔNG đổi ví/XP', async () => {
    const cookie = await signup('rollback@example.com');
    const childId = await createChild(cookie);

    const walletBefore = getDb().prepare('SELECT * FROM wallet WHERE child_id = ?').get(childId);
    const xpBefore = getDb().prepare('SELECT * FROM xp_state WHERE child_id = ?').get(childId);

    getDb().exec(`
      CREATE TRIGGER fail_parent_speaking_insert
      BEFORE INSERT ON parent_speaking_confirm
      BEGIN SELECT RAISE(ABORT, 'injected speaking failure'); END;
    `);

    const failed = await putSpeaking(cookie, childId, { items: [{ id: 'p1', done: true }] });
    expect(failed.statusCode).toBe(500);
    expect(countRows(childId)).toBe(0);

    expect(getDb().prepare('SELECT * FROM wallet WHERE child_id = ?').get(childId)).toEqual(walletBefore);
    expect(getDb().prepare('SELECT * FROM xp_state WHERE child_id = ?').get(childId)).toEqual(xpBefore);
  });
});
