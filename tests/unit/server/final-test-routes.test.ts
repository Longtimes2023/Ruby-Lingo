// @vitest-environment node
/**
 * RubyLingo — Test HTTP cho BÀI THI CUỐI KHOÁ (G6).
 *
 * ⚠️ ĐI QUA `app.inject()` (KHÔNG chỉ gọi service): cổng Fastify (auth, xử lý lỗi, mã trạng thái)
 *    là một phần của hợp đồng. Gọi thẳng service sẽ bỏ qua đúng những thứ dễ hỏng im lặng —
 *    quên `preHandler`, mã lỗi sai, hình dạng `{ error: { code } }` lệch.
 *
 * Những gì tệp này khoá lại:
 *   1. Cổng chưa mở ⇒ `FINAL_TEST_LOCKED` (409); đủ điều kiện ⇒ nộp được.
 *   2. Gửi lại CÙNG `clientEventId` ⇒ KHÔNG cộng thưởng hai lần (đọc lại hàng, `duplicate: true`).
 *   3. Hoàn thành cả bài (3 phần) ⇒ trao thưởng MỘT LẦN; làm lại ⇒ cập nhật khiên, KHÔNG cộng ví.
 *   4. Lỗi giữa transaction ⇒ KHÔNG có hàng attempt nào, ví/XP không đổi (rollback thật).
 *   5. `shields` LUÔN ∈ 1..5 (kể cả 0 câu đúng); phần Nói KHÔNG sinh khiên theo tỉ lệ đúng.
 *   6. Bé của phụ huynh KHÁC bị chặn (`CHILD_NOT_FOUND`).
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';
import { buildApp, type AppInstance } from '../../../server/app.js';
import { config } from '../../../server/config.js';
import { getDb } from '../../../server/db/connection.js';
import { clearAllData, setupTestDb } from './helpers/testDb.js';
import {
  getFinalTestMeta,
  levelRequiredExerciseIds,
  levelRequiredLessonIds,
} from '../../../shared/content/content-index.js';

const PASSWORD = 'matkhau123';
const AT = '2026-10-10T03:00:00.000Z';
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

/** Mở cổng thi bằng CÁCH GHI THẲNG SỰ THẬT vào DB: học hết bài + chơi hết exercise. */
function openGate(childId: string): void {
  const db = getDb();
  const insertLesson = db.prepare(
    `INSERT INTO lesson_progress
       (child_id, lesson_id, best_score, stars_best, attempts, completed, completed_at, updated_at)
     VALUES (?, ?, 0, 0, 1, 1, ?, ?)`,
  );
  for (const lessonId of levelRequiredLessonIds()) {
    insertLesson.run(childId, lessonId, AT, AT);
  }

  const insertGame = db.prepare(
    `INSERT INTO game_result
       (id, child_id, client_event_id, exercise_id, lesson_id, game_type,
        total_questions, correct_count, longest_streak, score, stars,
        duration_seconds, created_at, answered, wrong_attempts)
     VALUES (?, ?, ?, ?, ?, ?, 5, 5, 5, 50, 3, 30, ?, 5, 0)`,
  );
  let i = 0;
  for (const exerciseId of levelRequiredExerciseIds()) {
    insertGame.run(`gr-${i}`, childId, `evt-game-${i}`, exerciseId, 'l', 'listen_tap', AT);
    i += 1;
  }
}

const META = getFinalTestMeta();
if (!META) throw new Error('Cấp starters chưa có bài thi cuối khoá — test không thể chạy');

function sectionTotal(section: string): number {
  const summary = META!.sections.find((s) => s.section === section);
  if (!summary) throw new Error(`không có phần "${section}"`);
  return summary.itemCount;
}

/** Mảng đáp án đủ `count` câu. `firstTry` áp cho MỌI câu. */
function answers(count: number, firstTry: boolean): Array<{ itemId: string; firstTry: boolean; wrongAttempts: number }> {
  return Array.from({ length: count }, (_, index) => ({
    itemId: `item-${index}`,
    firstTry,
    wrongAttempts: firstTry ? 0 : 1,
  }));
}

function submit(cookie: string, childId: string, section: string, payload: object) {
  return app.inject({
    method: 'POST',
    url: `/api/children/${childId}/final-test/${section}/submit`,
    headers: { cookie },
    payload,
  });
}

function getState(cookie: string, childId: string) {
  return app.inject({
    method: 'GET',
    url: `/api/children/${childId}/final-test`,
    headers: { cookie },
  });
}

function walletOf(childId: string) {
  return getDb()
    .prepare('SELECT stars, acorns FROM wallet WHERE child_id = ?')
    .get(childId) as { stars: number; acorns: number };
}

function xpOf(childId: string): number {
  return (getDb().prepare('SELECT xp FROM xp_state WHERE child_id = ?').get(childId) as { xp: number }).xp;
}

describe('bài thi cuối khoá — API', () => {
  beforeAll(async () => {
    setupTestDb();
    app = await buildApp();
    await app.ready();
  });

  beforeEach(() => clearAllData(getDb()));

  it('chưa đăng nhập thì cả ba endpoint đều 401', async () => {
    const read = await app.inject({ method: 'GET', url: '/api/children/chi_x/final-test' });
    const write = await app.inject({
      method: 'POST',
      url: '/api/children/chi_x/final-test/listening/submit',
      payload: {},
    });
    const prog = await app.inject({
      method: 'PUT',
      url: '/api/children/chi_x/final-test/progress',
      payload: { section: 'listening', answers: [] },
    });
    expect(read.statusCode).toBe(401);
    expect(write.statusCode).toBe(401);
    expect(prog.statusCode).toBe(401);
  });

  it('cổng chưa mở: GET báo locked, nộp bài và lưu tiến độ đều bị chặn FINAL_TEST_LOCKED', async () => {
    const cookie = await signup('locked@example.com');
    const childId = await createChild(cookie);

    const state = await getState(cookie, childId);
    expect(state.statusCode, state.body).toBe(200);
    const gate = (state.json() as { data: { gate: { kind: string; enterable: boolean; requirement: { type: string } | null } } }).data.gate;
    expect(gate.kind).toBe('locked');
    expect(gate.enterable).toBe(false);
    expect(gate.requirement?.type).toBe('lessons_incomplete');

    const submitRes = await submit(cookie, childId, 'listening', {
      clientEventId: 'evt-locked',
      occurredAt: AT,
      answers: answers(sectionTotal('listening'), true),
    });
    expect(submitRes.statusCode, submitRes.body).toBe(409);
    expect((submitRes.json() as { error: { code: string } }).error.code).toBe('FINAL_TEST_LOCKED');

    const progRes = await app.inject({
      method: 'PUT',
      url: `/api/children/${childId}/final-test/progress`,
      headers: { cookie },
      payload: { section: 'listening', answers: [{ itemId: 'i1', value: 'cat' }] },
    });
    expect(progRes.statusCode, progRes.body).toBe(409);
    expect((progRes.json() as { error: { code: string } }).error.code).toBe('FINAL_TEST_LOCKED');
  });

  it('đủ điều kiện: GET báo ready/done, lưu tiến độ đọc lại được', async () => {
    const cookie = await signup('ready@example.com');
    const childId = await createChild(cookie);
    openGate(childId);

    const state = await getState(cookie, childId);
    expect(state.statusCode, state.body).toBe(200);
    const data = (state.json() as { data: { gate: { kind: string }; sections: unknown[] } }).data;
    expect(data.gate.kind).toBe('ready');
    expect(data.sections).toHaveLength(3);

    const saved = await app.inject({
      method: 'PUT',
      url: `/api/children/${childId}/final-test/progress`,
      headers: { cookie },
      payload: { section: 'listening', answers: [{ itemId: 'i1', value: 'cat' }, { itemId: 'i2', value: 'dog' }] },
    });
    expect(saved.statusCode, saved.body).toBe(200);
    expect(saved.json()).toMatchObject({ data: { section: 'listening', answered: 2 } });

    const after = await getState(cookie, childId);
    const sections = (after.json() as { data: { sections: Array<{ section: string; progress: { answered: number } | null }> } }).data.sections;
    const listening = sections.find((s) => s.section === 'listening');
    expect(listening?.progress).toMatchObject({ answered: 2 });
  });

  it('shields LUÔN 1..5: 0 câu đúng ⇒ 1 khiên, đúng hết ⇒ 5 khiên', async () => {
    const cookie = await signup('shields@example.com');
    const childId = await createChild(cookie);
    openGate(childId);
    const total = sectionTotal('listening');

    const allWrong = await submit(cookie, childId, 'listening', {
      clientEventId: 'evt-wrong',
      occurredAt: AT,
      answers: answers(total, false),
    });
    expect(allWrong.statusCode, allWrong.body).toBe(200);
    const wrongRes = (allWrong.json() as { data: { shields: number; correctFirstTry: number } }).data;
    expect(wrongRes.correctFirstTry).toBe(0);
    expect(wrongRes.shields).toBe(1);

    const allRight = await submit(cookie, childId, 'reading-writing', {
      clientEventId: 'evt-right',
      occurredAt: AT,
      answers: answers(sectionTotal('reading-writing'), true),
    });
    expect(allRight.statusCode, allRight.body).toBe(200);
    const rightRes = (allRight.json() as { data: { shields: number } }).data;
    expect(rightRes.shields).toBe(5);
  });

  it('phần Nói không chấm tự động: đủ câu ⇒ 5 khiên; thiếu câu ⇒ 400', async () => {
    const cookie = await signup('speaking@example.com');
    const childId = await createChild(cookie);
    openGate(childId);
    const total = sectionTotal('speaking');

    const partial = await submit(cookie, childId, 'speaking', {
      clientEventId: 'evt-sp-partial',
      occurredAt: AT,
      answers: answers(total - 1, false),
    });
    expect(partial.statusCode, partial.body).toBe(400);

    // Gửi THỪA câu cũng bị chối: mẫu số là sự thật của server, không phải số câu client gửi.
    const extra = await submit(cookie, childId, 'speaking', {
      clientEventId: 'evt-sp-extra',
      occurredAt: AT,
      answers: answers(total + 1, true),
    });
    expect(extra.statusCode, extra.body).toBe(400);

    const full = await submit(cookie, childId, 'speaking', {
      clientEventId: 'evt-sp-full',
      occurredAt: AT,
      answers: answers(total, false),
    });
    expect(full.statusCode, full.body).toBe(200);
    expect((full.json() as { data: { shields: number } }).data.shields).toBe(5);
  });

  it('gửi lại CÙNG clientEventId: KHÔNG cộng thưởng hai lần', async () => {
    const cookie = await signup('dup@example.com');
    const childId = await createChild(cookie);
    openGate(childId);

    const payload = {
      clientEventId: 'evt-dup',
      occurredAt: AT,
      answers: answers(sectionTotal('listening'), true),
    };
    const first = await submit(cookie, childId, 'listening', payload);
    expect(first.statusCode, first.body).toBe(200);

    const afterFirst = walletOf(childId);
    const xpAfterFirst = xpOf(childId);

    const again = await submit(cookie, childId, 'listening', payload);
    expect(again.statusCode, again.body).toBe(200);
    const res = (again.json() as { data: { duplicate: boolean; starsGained: number; xpGained: number } }).data;
    expect(res.duplicate).toBe(true);
    expect(res.starsGained).toBe(0);
    expect(res.xpGained).toBe(0);

    expect(walletOf(childId)).toEqual(afterFirst);
    expect(xpOf(childId)).toBe(xpAfterFirst);
    expect(
      getDb().prepare('SELECT COUNT(*) AS n FROM final_test_attempt WHERE child_id = ?').get(childId),
    ).toEqual({ n: 1 });
  });

  it('hoàn thành cả bài ⇒ trao thưởng MỘT LẦN; làm lại ⇒ cập nhật khiên, KHÔNG cộng ví lần hai', async () => {
    const cookie = await signup('graduate@example.com');
    const childId = await createChild(cookie);
    openGate(childId);

    const before = walletOf(childId);
    const xpBefore = xpOf(childId);

    const r1 = await submit(cookie, childId, 'listening', {
      clientEventId: 'evt-l',
      occurredAt: AT,
      answers: answers(sectionTotal('listening'), true),
    });
    const r2 = await submit(cookie, childId, 'reading-writing', {
      clientEventId: 'evt-rw',
      occurredAt: AT,
      answers: answers(sectionTotal('reading-writing'), true),
    });
    expect((r1.json() as { data: { firstCompletion: boolean } }).data.firstCompletion).toBe(false);
    expect((r2.json() as { data: { firstCompletion: boolean } }).data.firstCompletion).toBe(false);

    const r3 = await submit(cookie, childId, 'speaking', {
      clientEventId: 'evt-sp',
      occurredAt: AT,
      answers: answers(sectionTotal('speaking'), false),
    });
    expect(r3.statusCode, r3.body).toBe(200);
    const third = (r3.json() as {
      data: { firstCompletion: boolean; starsGained: number; xpGained: number; badgesEarned: string[] };
    }).data;
    expect(third.firstCompletion).toBe(true);
    expect(third.starsGained).toBeGreaterThan(0);
    expect(third.xpGained).toBeGreaterThan(0);
    // Huy chương tốt nghiệp được trao (badge đi CUỐI, cùng transaction).
    expect(third.badgesEarned).toContain('badge-graduate');
    expect(walletOf(childId).stars).toBeGreaterThan(before.stars);
    expect(xpOf(childId)).toBeGreaterThan(xpBefore);

    const afterFull = walletOf(childId);
    const xpAfterFull = xpOf(childId);

    // Làm LẠI reading-writing — khiên thấp hơn nhưng KHÔNG cộng tiền tệ lần hai.
    const redo = await submit(cookie, childId, 'reading-writing', {
      clientEventId: 'evt-rw-2',
      occurredAt: AT,
      answers: answers(sectionTotal('reading-writing'), false),
    });
    expect(redo.statusCode, redo.body).toBe(200);
    const redoData = (redo.json() as {
      data: { duplicate: boolean; firstCompletion: boolean; shields: number; bestShields: number; starsGained: number; xpGained: number };
    }).data;
    expect(redoData.duplicate).toBe(false);
    expect(redoData.firstCompletion).toBe(false);
    expect(redoData.shields).toBe(1);
    expect(redoData.bestShields).toBe(5); // kỷ lục giữ nguyên
    expect(redoData.starsGained).toBe(0);
    expect(redoData.xpGained).toBe(0);

    expect(walletOf(childId)).toEqual(afterFull);
    expect(xpOf(childId)).toBe(xpAfterFull);
  });

  it('lỗi giữa transaction ⇒ KHÔNG có hàng attempt nào, ví và XP không đổi', async () => {
    const cookie = await signup('rollback@example.com');
    const childId = await createChild(cookie);
    openGate(childId);
    const before = walletOf(childId);
    const xpBefore = xpOf(childId);
    const questBefore = getDb()
      .prepare('SELECT COUNT(*) AS n FROM quest_progress WHERE child_id = ?')
      .get(childId) as { n: number };

    const db = getDb();
    db.exec(`
      CREATE TRIGGER fail_final_test_insert
      BEFORE INSERT ON final_test_attempt
      WHEN NEW.client_event_id = 'evt-rollback'
      BEGIN SELECT RAISE(ABORT, 'injected final-test failure'); END;
    `);

    try {
      const res = await submit(cookie, childId, 'listening', {
        clientEventId: 'evt-rollback',
        occurredAt: AT,
        answers: answers(sectionTotal('listening'), true),
      });
      expect(res.statusCode, res.body).toBe(500);
    } finally {
      db.exec('DROP TRIGGER IF EXISTS fail_final_test_insert');
    }

    expect(
      getDb().prepare('SELECT COUNT(*) AS n FROM final_test_attempt WHERE child_id = ?').get(childId),
    ).toEqual({ n: 0 });
    expect(walletOf(childId)).toEqual(before);
    expect(xpOf(childId)).toBe(xpBefore);
    expect(
      getDb().prepare('SELECT COUNT(*) AS n FROM quest_progress WHERE child_id = ?').get(childId),
    ).toEqual(questBefore);
  });

  it('bé của phụ huynh KHÁC bị chặn (CHILD_NOT_FOUND)', async () => {
    const cookieA = await signup('ownerA@example.com');
    const childId = await createChild(cookieA);
    openGate(childId);

    const cookieB = await signup('otherB@example.com');
    const read = await getState(cookieB, childId);
    const write = await submit(cookieB, childId, 'listening', {
      clientEventId: 'evt-other',
      occurredAt: AT,
      answers: answers(sectionTotal('listening'), true),
    });
    expect(read.statusCode).toBe(404);
    expect((read.json() as { error: { code: string } }).error.code).toBe('CHILD_NOT_FOUND');
    expect(write.statusCode).toBe(404);
    expect((write.json() as { error: { code: string } }).error.code).toBe('CHILD_NOT_FOUND');
    expect(
      getDb().prepare('SELECT COUNT(*) AS n FROM final_test_attempt WHERE child_id = ?').get(childId),
    ).toEqual({ n: 0 });
  });
});
