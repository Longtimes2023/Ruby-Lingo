// @vitest-environment node
/**
 * Test TẦNG HTTP cho `POST /api/children/:id/game-result` (T049.3).
 *
 * ⭐ VÌ SAO PHẢI LÀ TEST HTTP, KHÔNG CHỈ TEST SERVICE:
 *   `game-result-service.test.ts` đã chứng minh phần CHẤM ĐIỂM và GHI SỔ. File này chứng minh
 *   ba thứ CHỈ hỏng khi đi qua Fastify thật:
 *     • `preHandler: requireParent` — nếu plugin auth bị đóng gói sai (thiếu `fastify-plugin`)
 *       thì `req.parent` luôn `null` ⇒ MỌI request 401, và unit test gọi service trực tiếp
 *       KHÔNG BAO GIỜ bắt được. Lỗi này đã từng xảy ra trong dự án.
 *     • Quyền sở hữu trên `:id` trong URL — phụ huynh A ghi được thành tích vào bé nhà B.
 *     • Hình dạng lỗi: client dựa vào `error.code` để dịch câu tiếng Việt. Lỗi rơi vào handler
 *       mặc định của Fastify thì `code` biến mất.
 *
 * ⚠️ TEST QUAN TRỌNG NHẤT TRONG FILE: "gửi lại cùng `clientEventId` không nhân đôi số đếm".
 *    Đây là kịch bản THẬT (mất mạng sau khi server đã ghi nhưng phản hồi chưa về tới client).
 *    Vì `daily_stats` là CỘNG DỒN, nếu cổng này thủng thì số liệu phồng lên vĩnh viễn — không
 *    cách nào phát hiện về sau vì không ai biết con số đúng là bao nhiêu.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';

import { buildApp, type AppInstance } from '../../../server/app.js';
import { config } from '../../../server/config.js';
import { getDb } from '../../../server/db/connection.js';
import { clearAllData, setupTestDb } from './helpers/testDb.js';
import type { GameResultAward } from '../../../shared/types/progress.js';

const PASSWORD = 'matkhau123';
const AVATAR = 'panda';

let app: AppInstance;

/** Lấy cookie phiên từ header `set-cookie`. */
function sessionCookieOf(res: LightMyRequestResponse): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = list.find((c) => c.startsWith(`${config.cookie.name}=`));
  if (!found) throw new Error('Response không đặt cookie phiên — plugin bị đóng gói?');
  return found.split(';')[0]!;
}

/** Đăng ký một tài khoản, trả cookie phiên. */
async function signup(email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email, password: PASSWORD, parentalConsent: true },
  });
  expect(res.statusCode, res.body).toBe(201);
  return sessionCookieOf(res);
}

/** Tạo một bé và trả id. */
async function createChild(cookie: string, nickname = 'Bông'): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/children',
    headers: { cookie },
    payload: { nickname, age: 7, avatarId: AVATAR },
  });
  expect(res.statusCode, res.body).toBe(201);
  return (res.json() as { data: { child: { id: string } } }).data.child.id;
}

/** Một lượt chơi 4 câu, đúng hết — `listen_tap` (2 điểm/câu). */
function run(overrides: Record<string, unknown> = {}): object {
  return {
    clientEventId: 'evt_http_0001',
    exerciseId: 'at-the-zoo/z1/listen-tap',
    lessonId: 'at-the-zoo/z1',
    gameType: 'listen_tap',
    totalRounds: 4,
    occurredAt: '2026-10-06T09:15:00.000Z', // 16:15 giờ Việt Nam ⇒ vẫn ngày 06
    durationSeconds: 42,
    answers: [
      { wordId: 'w.monkey', firstTry: true, wrongAttempts: 0 },
      { wordId: 'w.lion', firstTry: true, wrongAttempts: 0 },
      { wordId: 'w.elephant', firstTry: true, wrongAttempts: 0 },
      { wordId: 'w.zebra', firstTry: true, wrongAttempts: 0 },
    ],
    ...overrides,
  };
}

/**
 * Gửi một lượt chơi.
 *
 * ⚠️ `payload` khai là `object`, KHÔNG phải `unknown` — xem ghi chú ở `progress-routes.test.ts`.
 */
async function submit(
  cookie: string | null,
  childId: string,
  payload: object,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url: `/api/children/${childId}/game-result`,
    ...(cookie ? { headers: { cookie } } : {}),
    payload,
  });
}

describe('API kết quả game — tầng HTTP', () => {
  beforeAll(async () => {
    setupTestDb();
    app = await buildApp();
    await app.ready();
  });

  beforeEach(() => {
    clearAllData(getDb());
  });

  // ===========================================================================
  describe('xác thực', () => {
    it('từ chối khi chưa đăng nhập', async () => {
      const res = await submit(null, 'chi_bat_ky', run());
      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
    });
  });

  // ===========================================================================
  describe('quyền sở hữu', () => {
    /**
     * ⭐ Trả 404 (không phải 403) là CÓ CHỦ ĐÍCH: 403 sẽ xác nhận "hồ sơ này có tồn tại", tức
     *    là rò rỉ thông tin về bé nhà người khác.
     */
    it('KHÔNG ghi được kết quả vào bé nhà phụ huynh khác', async () => {
      const cookieA = await signup('a@example.com');
      const childA = await createChild(cookieA);
      const cookieB = await signup('b@example.com');

      const res = await submit(cookieB, childA, run());
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: { code: 'CHILD_NOT_FOUND' } });

      // Và quan trọng không kém: sổ của bé A phải KHÔNG bị đụng tới.
      const count = getDb()
        .prepare('SELECT COUNT(*) AS n FROM game_result WHERE child_id = ?')
        .get(childA) as { n: number };
      expect(count.n).toBe(0);
    });

    it('báo 404 khi id bé không tồn tại', async () => {
      const cookie = await signup('a@example.com');
      const res = await submit(cookie, 'chi_khong_ton_tai', run());
      expect(res.statusCode).toBe(404);
    });
  });

  // ===========================================================================
  describe('ghi một lượt chơi hợp lệ', () => {
    it('trả 200 kèm kết quả đã chấm và ghi đủ dữ liệu', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const res = await submit(cookie, childId, run());
      expect(res.statusCode, res.body).toBe(200);

      const award = (res.json() as { data: GameResultAward }).data;
      // 4 câu × 2 điểm = 8, cộng 1 điểm thưởng chuỗi (`streakBonusFor(4)` = ⌊4/3⌋ = 1).
      expect(award).toMatchObject({
        score: 9,
        stars: 3,
        bestScore: 9,
        bestStars: 3,
        isNewRecord: true,
        duplicate: false,
        // ⭐ T054: phần thưởng thật, không còn là 0.
        //    ⭐ = 4×2 + 4×1 (từ mới) + 10 (chơi xong) = 22 ; XP = 4×2 + 4×5 + 10 = 38.
        xpGained: 38,
        starsGained: 22,
        acornsGained: 0,
        levelUp: null,
        badgesEarned: [],
      });

      // Dòng nhật ký lượt chơi đã được ghi.
      const logged = getDb()
        .prepare('SELECT * FROM game_result WHERE child_id = ? AND client_event_id = ?')
        .get(childId, 'evt_http_0001') as { score: number; stars: number; answered: number };
      expect(logged).toMatchObject({ score: 9, stars: 3, answered: 4 });

      // ⭐ VÍ VÀ XP THẬT (T054) — đi qua đủ stack Fastify, không phải gọi service trực tiếp.
      const wallet = getDb()
        .prepare('SELECT stars, acorns FROM wallet WHERE child_id = ?')
        .get(childId) as { stars: number; acorns: number };
      expect(wallet).toEqual({ stars: 22, acorns: 0 });

      const xp = getDb()
        .prepare('SELECT xp, level FROM xp_state WHERE child_id = ?')
        .get(childId) as { xp: number; level: number };
      expect(xp).toEqual({ xp: 38, level: 1 });

      // Thống kê ngày theo GIỜ ĐỊA PHƯƠNG (UTC+7), không phải UTC — VÀ ba cột tiền tệ phải
      // khớp đúng số dư ở trên, nếu không thì báo cáo phụ huynh nói dối.
      const daily = getDb()
        .prepare('SELECT * FROM daily_stats WHERE child_id = ? AND date = ?')
        .get(childId, '2026-10-06') as {
        words_learned: number;
        questions_answered: number;
        stars_earned: number;
        acorns_earned: number;
        xp_earned: number;
      };
      expect(daily).toMatchObject({
        words_learned: 4,
        questions_answered: 4,
        stars_earned: 22,
        acorns_earned: 0,
        xp_earned: 38,
      });
    });

    it('lượt chơi 0 câu vẫn được 1 sao (không bao giờ 0)', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const res = await submit(cookie, childId, run({ totalRounds: 6, answers: [] }));
      expect(res.statusCode, res.body).toBe(200);
      const award = (res.json() as { data: GameResultAward }).data;
      expect(award.stars).toBe(1);
    });
  });

  // ===========================================================================
  describe('lũy đẳng theo clientEventId', () => {
    /**
     * ⭐⭐ TEST QUAN TRỌNG NHẤT CỦA FILE.
     *
     * Kịch bản thật: bé chơi xong → server ghi xong → PHẢN HỒI mất trên đường về → client
     * không biết nên gửi lại y nguyên. Vì `daily_stats` CỘNG DỒN, một cổng chống trùng thủng
     * sẽ làm `questions_answered` thành 8 cho bốn câu trả lời — và con số sai đó ở lại VĨNH VIỄN.
     */
    it('gửi lại CÙNG clientEventId không nhân đôi số đếm', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);
      const payload = run();

      const first = await submit(cookie, childId, payload);
      expect(first.statusCode).toBe(200);
      expect((first.json() as { data: GameResultAward }).data.duplicate).toBe(false);

      const second = await submit(cookie, childId, payload);
      expect(second.statusCode).toBe(200);
      const award = (second.json() as { data: GameResultAward }).data;

      // Lần hai báo trùng lặp, KHÔNG có phần thưởng, nhưng vẫn trả kết quả của VÁN để màn hình
      // kết quả hiện đúng con số.
      expect(award).toMatchObject({
        duplicate: true,
        isNewRecord: false,
        xpGained: 0,
        starsGained: 0,
        acornsGained: 0,
        score: 9,
        stars: 3,
      });

      // Chỉ MỘT dòng nhật ký, và thống kê ngày KHÔNG bị cộng hai lần.
      const count = getDb()
        .prepare('SELECT COUNT(*) AS n FROM game_result WHERE child_id = ?')
        .get(childId) as { n: number };
      expect(count.n).toBe(1);

      const daily = getDb()
        .prepare('SELECT * FROM daily_stats WHERE child_id = ? AND date = ?')
        .get(childId, '2026-10-06') as {
        questions_answered: number;
        words_learned: number;
        stars_earned: number;
        xp_earned: number;
      };
      expect(daily).toMatchObject({
        questions_answered: 4,
        words_learned: 4,
        stars_earned: 22,
        xp_earned: 38,
      });

      // ⭐⭐ TIỀN LÀ CỘNG DỒN, KHÔNG LŨY ĐẲNG THEO TỰ NHIÊN NHƯ HUY HIỆU.
      //     Ví/XP cộng hai lần thì số dư sai VĨNH VIỄN và không có gì để đối chiếu về sau —
      //     đây là hậu quả nặng nhất của một cổng chống trùng thủng, nặng hơn cả số đếm ngày.
      const wallet = getDb()
        .prepare('SELECT stars, acorns FROM wallet WHERE child_id = ?')
        .get(childId) as { stars: number; acorns: number };
      expect(wallet).toEqual({ stars: 22, acorns: 0 });

      const xp = getDb()
        .prepare('SELECT xp FROM xp_state WHERE child_id = ?')
        .get(childId) as { xp: number };
      expect(xp.xp).toBe(38);
    });
  });

  // ===========================================================================
  describe('kiểm dữ liệu vào', () => {
    it('từ chối gameType không tồn tại', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const res = await submit(cookie, childId, run({ gameType: 'nấu_phở' }));
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
    });

    it('từ chối dữ liệu MÂU THUẪN: đúng ngay lần đầu mà lại có lần sai', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const res = await submit(
        cookie,
        childId,
        run({ totalRounds: 1, answers: [{ wordId: 'w1', firstTry: true, wrongAttempts: 3 }] }),
      );
      expect(res.statusCode).toBe(400);

      const count = getDb()
        .prepare('SELECT COUNT(*) AS n FROM game_result WHERE child_id = ?')
        .get(childId) as { n: number };
      expect(count.n).toBe(0);
    });

    it('từ chối khi số câu trả lời NHIỀU HƠN tổng số câu của ván', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const res = await submit(cookie, childId, run({ totalRounds: 2 }));
      expect(res.statusCode).toBe(400);
    });

    it('từ chối thân request thiếu trường bắt buộc', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const res = await submit(cookie, childId, { gameType: 'listen_tap' });
      expect(res.statusCode).toBe(400);
    });
  });
});
