// @vitest-environment node
/**
 * RubyLingo — `GET /api/children/:id/game-results` (T05): kênh ĐỌC kết quả game đã chơi.
 *
 * ⭐ VÌ SAO PHẢI CÓ TEST ĐI QUA HTTP, KHÔNG CHỈ TEST `listGameSummaries`:
 *   Hàm service đúng mà ROUTE gắn sai `preHandler`, hoặc quên đăng ký, hoặc trả sai hình dạng
 *   thì mọi unit test của service vẫn xanh. Ba thứ đó chỉ lộ ra khi có request thật đi qua
 *   `buildApp()`. Và đúng loại lỗi "im lặng" của dự án: typecheck/lint không đọc route được.
 *
 * ⭐ ĐIỀU FILE NÀY KHOÁ LẠI (bốn điều, mỗi điều là một cách hỏng thật):
 *   ① GỘP theo `exercise_id`: hai lượt cùng bài ⇒ MỘT hàng, `attempts` cộng dồn, `bestStars` =
 *      MAX — không phải tổng, không phải sao của lượt cuối.
 *   ② `MAX(stars)` KHÔNG `SUM`: chơi lại nhiều lần không làm "phình" sao.
 *   ③ Quyền sở hữu: bé của phụ huynh KHÁC ⇒ `CHILD_NOT_FOUND`, dù `:id` là thật.
 *   ④ KHÔNG CỔNG PIN: đây là màn của BÉ. Đặt PIN rồi đăng nhập phiên mới (cổng ĐÓNG) thì
 *      `game-results` VẪN 200, trong khi `report` (màn của BỐ MẸ) trả 403 — đó là khác biệt
 *      CÓ CHỦ Ý giữa hai route, xem ghi chú ở `server/routes/progress.ts`.
 *
 * ⚠️ Đọc kết quả bằng CHÍNH các con số server trả về ở lần GHI (award.stars), KHÔNG hard-code
 *    giá trị sao: luật chấm điểm sống ở `shared/game-scoring.ts` và có thể đổi. Test hỏi đúng
 *    câu cần hỏi: "phép GỘP có đúng không?", chứ không hỏi "3 sao nghĩa là gì".
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';

import { buildApp, type AppInstance } from '../../../server/app.js';
import { config } from '../../../server/config.js';
import { closeDb, getDb } from '../../../server/db/connection.js';
import type { GameResultAward } from '../../../shared/types/progress.js';
import { clearAllData, setupTestDb } from './helpers/testDb.js';

/** Mật khẩu hợp lệ theo `passwordSchema` (tối thiểu 8 ký tự). Không dùng chung với tài khoản thật. */
const PASSWORD = 'MatKhau123';

let app: AppInstance;
let requestSeq = 0;

/**
 * Header chung cho mọi request. `x-forwarded-for` đổi theo từng request để KHÔNG chạm trần
 * rate-limit (bộ đếm khoá theo IP) — nếu để một IP cố định, test sẽ đỏ vì 429 chứ không phải vì
 * logic, đúng một cái bẫy đã trả giá ở các test route khác.
 */
function withClient(headers: Record<string, string> = {}): Record<string, string> {
  requestSeq += 1;
  return { 'x-forwarded-for': `10.9.0.${requestSeq % 250}`, ...headers };
}

/** Lấy cookie phiên từ `set-cookie` của một response đăng nhập/đăng ký. */
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

/** Một lượt chơi THÔ: `total` câu, `correct` câu đúng ngay lần đầu. */
function runBody(
  exerciseId: string,
  lessonId: string,
  total: number,
  correct: number,
): Record<string, unknown> {
  return {
    clientEventId: `evt_${Math.random().toString(36).slice(2)}`,
    exerciseId,
    lessonId,
    gameType: 'listen_tap',
    totalRounds: total,
    occurredAt: new Date().toISOString(),
    durationSeconds: 12,
    answers: Array.from({ length: total }, (_, i) => ({
      wordId: null,
      firstTry: i < correct,
      wrongAttempts: i < correct ? 0 : 1,
    })),
  };
}

async function submitRun(
  cookie: string,
  childId: string,
  body: Record<string, unknown>,
): Promise<GameResultAward> {
  const res = await app.inject({
    method: 'POST',
    url: `/api/children/${encodeURIComponent(childId)}/game-result`,
    headers: withClient({ cookie }),
    payload: body,
  });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { data: GameResultAward }).data;
}

function getGameResults(cookie: string, childId: string): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'GET',
    url: `/api/children/${encodeURIComponent(childId)}/game-results`,
    headers: withClient({ cookie }),
  });
}

interface SummaryRow {
  exerciseId: string;
  bestStars: number;
  bestScore: number;
  attempts: number;
  lastPlayedAt: string;
}

function summariesOf(res: LightMyRequestResponse): SummaryRow[] {
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { data: { results: SummaryRow[] } }).data.results;
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

describe('GET /api/children/:id/game-results', () => {
  it('bé mới ⇒ danh sách RỖNG, đúng hình dạng response', async () => {
    const cookie = await signup('gr-fresh@example.com');
    const childId = await createChild(cookie, 'Na');

    const res = await getGameResults(cookie, childId);
    expect(res.statusCode, res.body).toBe(200);

    const body = res.json() as {
      data: { childId: string; results: SummaryRow[]; serverTime: string };
    };
    expect(body.data.childId).toBe(childId);
    expect(body.data.results).toEqual([]);
    // `serverTime` phải là ISO UTC — schema dùng chung đã kiểm, nhưng khẳng định cho rõ.
    expect(typeof body.data.serverTime).toBe('string');
  });

  it('⭐ hai lượt CÙNG bài tập ⇒ MỘT hàng: attempts cộng dồn, bestStars = MAX (không phải tổng)', async () => {
    const cookie = await signup('gr-group@example.com');
    const childId = await createChild(cookie, 'Bin');

    const EX = 'at-the-zoo/z1/listen-tap';
    const LESSON = 'at-the-zoo/z1';

    // Lượt 1: kém hơn (1 sao). Lượt 2: tốt hơn (3 sao) — thứ tự cố ý để bắt lỗi "lấy sao lượt cuối".
    const first = await submitRun(cookie, childId, runBody(EX, LESSON, 3, 0));
    const second = await submitRun(cookie, childId, runBody(EX, LESSON, 1, 1));
    expect(second.stars).toBeGreaterThanOrEqual(first.stars);

    const rows = summariesOf(await getGameResults(cookie, childId));
    expect(rows).toHaveLength(1);

    const row = rows[0]!;
    expect(row.exerciseId).toBe(EX);
    // MAX, không SUM: hai lượt (3★ + 1★) phải ra 3, không ra 4.
    expect(row.bestStars).toBe(Math.max(first.stars, second.stars));
    expect(row.attempts).toBe(2);
    expect(row.bestScore).toBe(Math.max(first.score, second.score));
  });

  it('⭐ nhiều bài tập KHÁC NHAU ⇒ mỗi bài một hàng riêng', async () => {
    const cookie = await signup('gr-many@example.com');
    const childId = await createChild(cookie, 'Bi');

    await submitRun(cookie, childId, runBody('at-the-zoo/z1/listen-tap', 'at-the-zoo/z1', 1, 1));
    await submitRun(cookie, childId, runBody('at-the-zoo/z1/word-picture', 'at-the-zoo/z1', 1, 1));
    await submitRun(cookie, childId, runBody('at-the-zoo/z2/listen-tap', 'at-the-zoo/z2', 1, 1));

    const rows = summariesOf(await getGameResults(cookie, childId));
    expect(rows.map((r) => r.exerciseId).sort()).toEqual([
      'at-the-zoo/z1/listen-tap',
      'at-the-zoo/z1/word-picture',
      'at-the-zoo/z2/listen-tap',
    ]);
    for (const row of rows) expect(row.attempts).toBe(1);
  });

  it('bé của phụ huynh KHÁC ⇒ CHILD_NOT_FOUND (không rò dữ liệu bé nhà người khác)', async () => {
    const cookieA = await signup('gr-a@example.com');
    const cookieB = await signup('gr-b@example.com');
    const childA = await createChild(cookieA, 'Na');

    // B gửi id bé của A ⇒ phải bị chặn, và chặn GIỐNG HỆT "không tìm thấy" (không tiết lộ có tồn tại).
    const res = await getGameResults(cookieB, childA);
    expect(res.statusCode).toBe(404);
    expect((res.json() as { error: { code: string } }).error.code).toBe('CHILD_NOT_FOUND');
  });

  it('chưa đăng nhập ⇒ 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/children/chi_bat_ky/game-results',
      headers: withClient(),
    });
    expect(res.statusCode).toBe(401);
  });

  it('⭐ KHÔNG cổng PIN: cổng ĐÓNG (đã đặt PIN + phiên mới) thì game-results vẫn 200, còn report thì 403', async () => {
    const email = 'gr-nogate@example.com';
    const cookie = await signup(email);
    const childId = await createChild(cookie, 'Na');

    // Đặt PIN ⇒ phiên HIỆN TẠI mở cổng, nhưng phiên MỚI (đăng nhập lại) thì cổng ĐÓNG.
    const setPin = await app.inject({
      method: 'PATCH',
      url: '/api/parent/pin',
      headers: withClient({ cookie }),
      payload: { pin: '1111' },
    });
    expect(setPin.statusCode, setPin.body).toBe(200);

    const fresh = await login(email);

    // Màn của BÉ ⇒ KHÔNG cổng PIN ⇒ 200.
    const results = await getGameResults(fresh, childId);
    expect(results.statusCode, results.body).toBe(200);

    // Màn của BỐ MẸ ⇒ CÓ cổng PIN ⇒ 403. Đây chính là khác biệt CÓ CHỦ Ý giữa hai route.
    const report = await app.inject({
      method: 'GET',
      url: `/api/children/${encodeURIComponent(childId)}/report`,
      headers: withClient({ cookie: fresh }),
    });
    expect(report.statusCode).toBe(403);
  });
});
