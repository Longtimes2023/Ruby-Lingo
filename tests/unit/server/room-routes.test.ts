// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';
import { buildApp, type AppInstance } from '../../../server/app.js';
import { config } from '../../../server/config.js';
import { getDb } from '../../../server/db/connection.js';
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

const DECORATION_IDS = [
  'dec-balloon', 'dec-plant', 'dec-lantern', 'dec-picture', 'dec-sunflower',
  'dec-flag', 'dec-treehouse', 'dec-aquarium', 'dec-rainbow', 'dec-castle',
];

async function ownDecoration(cookie: string, childId: string): Promise<void> {
  getDb().prepare('UPDATE wallet SET stars = 100 WHERE child_id = ?').run(childId);
  const res = await app.inject({
    method: 'POST',
    url: `/api/children/${childId}/shop/buy`,
    headers: { cookie },
    payload: { itemId: 'dec-plant' },
  });
  expect(res.statusCode, res.body).toBe(200);
}

function ownAllDecorations(childId: string): void {
  const insert = getDb().prepare(
    'INSERT INTO inventory (child_id, item_id, quantity, equipped, acquired_at) VALUES (?, ?, 1, 0, ?)',
  );
  for (const itemId of DECORATION_IDS) insert.run(childId, itemId, new Date().toISOString());
}

function save(cookie: string, childId: string, payload: object): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'PUT',
    url: `/api/children/${childId}/room/placements`,
    headers: { cookie },
    payload,
  });
}

describe('房间装饰摆放 API', () => {
  beforeAll(async () => {
    setupTestDb();
    app = await buildApp();
    await app.ready();
  });

  beforeEach(() => clearAllData(getDb()));

  it('未登录不能读取或保存摆放', async () => {
    const read = await app.inject({ method: 'GET', url: '/api/children/chi_x/room/placements' });
    const write = await app.inject({
      method: 'PUT',
      url: '/api/children/chi_x/room/placements',
      payload: [],
    });
    expect(read.statusCode).toBe(401);
    expect(write.statusCode).toBe(401);
  });

  it('空列表可清空摆放，非空列表会完整替换旧列表', async () => {
    const cookie = await signup('replace@example.com');
    const childId = await createChild(cookie);
    ownAllDecorations(childId);

    const tenPlacements = DECORATION_IDS.map((itemId, index) => ({
      itemId,
      x: index * 10,
      y: 100 - index * 10,
      hidden: false,
    }));
    const first = await save(cookie, childId, tenPlacements);
    expect(first.statusCode, first.body).toBe(200);
    expect((first.json() as { data: unknown[] }).data).toHaveLength(10);

    const replacement = await save(cookie, childId, [
      { itemId: 'dec-plant', x: 37, y: 63, hidden: false },
    ]);
    expect(replacement.statusCode, replacement.body).toBe(200);
    expect(replacement.json()).toMatchObject({
      data: [{ itemId: 'dec-plant', x: 37, y: 63, hidden: false }],
    });

    const cleared = await save(cookie, childId, []);
    expect(cleared.statusCode, cleared.body).toBe(200);
    expect(cleared.json()).toMatchObject({ data: [] });
  });

  it('接受最多10项并拒绝第11项', async () => {
    const cookie = await signup('limit@example.com');
    const childId = await createChild(cookie);
    ownAllDecorations(childId);
    const ten = DECORATION_IDS.map((itemId) => ({ itemId, x: 0, y: 100, hidden: false }));
    expect((await save(cookie, childId, ten)).statusCode).toBe(200);
    expect((await save(cookie, childId, [...ten, { ...ten[0]!, x: 1 }])).statusCode).toBe(400);
  });

  it('校验期间遇到 quantity=0 时拒绝且回读时隐藏该摆放', async () => {
    const cookie = await signup('zero@example.com');
    const childId = await createChild(cookie);
    await ownDecoration(cookie, childId);
    await save(cookie, childId, [{ itemId: 'dec-plant', x: 10, y: 20, hidden: false }]);
    getDb()
      .prepare('UPDATE inventory SET quantity = 0 WHERE child_id = ? AND item_id = ?')
      .run(childId, 'dec-plant');

    const read = await app.inject({
      method: 'GET',
      url: `/api/children/${childId}/room/placements`,
      headers: { cookie },
    });
    expect(read.statusCode).toBe(200);
    expect(read.json()).toMatchObject({ data: [] });
    const update = await save(cookie, childId, [{ itemId: 'dec-plant', x: 30, y: 40, hidden: false }]);
    expect(update.statusCode).toBe(404);
  });

  it('数据库插入失败时回滚删除，原列表完整保留', async () => {
    const cookie = await signup('rollback@example.com');
    const childId = await createChild(cookie);
    ownAllDecorations(childId);
    await save(cookie, childId, [{ itemId: 'dec-plant', x: 12, y: 34, hidden: false }]);
    getDb().exec(`
      CREATE TRIGGER fail_room_placement_insert
      BEFORE INSERT ON room_decoration_placement
      WHEN NEW.item_id = 'dec-rainbow'
      BEGIN SELECT RAISE(ABORT, 'injected placement failure'); END;
    `);

    const failed = await save(cookie, childId, [
      { itemId: 'dec-plant', x: 90, y: 91, hidden: true },
      { itemId: 'dec-rainbow', x: 50, y: 50, hidden: false },
    ]);
    expect(failed.statusCode).toBe(500);
    const read = await app.inject({
      method: 'GET',
      url: `/api/children/${childId}/room/placements`,
      headers: { cookie },
    });
    expect(read.statusCode).toBe(200);
    expect(read.json()).toMatchObject({
      data: [{ itemId: 'dec-plant', x: 12, y: 34, hidden: false }],
    });
  });

  it('按孩子保存、读取位置和隐藏状态，不修改钱包及所有权', async () => {
    const cookie = await signup('room@example.com');
    const childId = await createChild(cookie);
    await ownDecoration(cookie, childId);
    const walletBefore = getDb().prepare('SELECT stars FROM wallet WHERE child_id = ?').get(childId);
    const inventoryBefore = getDb()
      .prepare('SELECT quantity, equipped FROM inventory WHERE child_id = ? AND item_id = ?')
      .get(childId, 'dec-plant');

    const saved = await save(cookie, childId, [{ itemId: 'dec-plant', x: 31.5, y: 72, hidden: true }]);
    expect(saved.statusCode, saved.body).toBe(200);
    expect(saved.json()).toMatchObject({ data: [{ itemId: 'dec-plant', x: 31.5, y: 72, hidden: true }] });

    const read = await app.inject({
      method: 'GET',
      url: `/api/children/${childId}/room/placements`,
      headers: { cookie },
    });
    expect(read.statusCode).toBe(200);
    expect(read.json()).toMatchObject({ data: [{ itemId: 'dec-plant', x: 31.5, y: 72, hidden: true }] });
    expect(getDb().prepare('SELECT stars FROM wallet WHERE child_id = ?').get(childId)).toEqual(walletBefore);
    expect(
      getDb().prepare('SELECT quantity, equipped FROM inventory WHERE child_id = ? AND item_id = ?').get(childId, 'dec-plant'),
    ).toEqual(inventoryBefore);
  });

  it('拒绝未拥有的物品、非装饰品和越界位置', async () => {
    const cookie = await signup('validation@example.com');
    const childId = await createChild(cookie);
    const unowned = await save(cookie, childId, [{ itemId: 'dec-plant', x: 10, y: 10, hidden: false }]);
    expect(unowned.statusCode).toBe(404);

    await ownDecoration(cookie, childId);
    const accessory = await save(cookie, childId, [{ itemId: 'acc-bow', x: 10, y: 10, hidden: false }]);
    const outOfBounds = await save(cookie, childId, [{ itemId: 'dec-plant', x: 100.01, y: 10, hidden: false }]);
    expect(accessory.statusCode).toBe(400);
    expect(outOfBounds.statusCode).toBe(400);
  });

  it('不允许另一位家长读取或覆盖孩子的摆放', async () => {
    const cookieA = await signup('owner@example.com');
    const childId = await createChild(cookieA);
    await ownDecoration(cookieA, childId);
    await save(cookieA, childId, [{ itemId: 'dec-plant', x: 20, y: 30, hidden: false }]);
    const cookieB = await signup('other@example.com');

    const read = await app.inject({
      method: 'GET',
      url: `/api/children/${childId}/room/placements`,
      headers: { cookie: cookieB },
    });
    const write = await save(cookieB, childId, []);
    expect(read.statusCode).toBe(404);
    expect(write.statusCode).toBe(404);
    expect(
      getDb().prepare('SELECT x, y FROM room_decoration_placement WHERE child_id = ? AND item_id = ?').get(childId, 'dec-plant'),
    ).toEqual({ x: 20, y: 30 });
  });
});
