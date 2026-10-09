// @vitest-environment node
/**
 * Test TẦNG HTTP cho `/api/children/:id/progress**`.
 *
 * ⭐ VÌ SAO PHẢI LÀ TEST HTTP, KHÔNG CHỈ TEST SERVICE:
 *   Ba thứ dưới đây CHỈ hỏng ở tầng HTTP và chỉ hiện ra khi đi qua Fastify thật:
 *     • Plugin bị đóng gói (thiếu `fastify-plugin`) ⇒ `req.parent` luôn null ⇒ mọi request
 *       401. Lỗi này từng xảy ra trong dự án và lọt qua toàn bộ test đơn vị.
 *     • Quyền sở hữu: phụ huynh A đọc/ghi được tiến độ của bé nhà phụ huynh B.
 *     • Hình dạng lỗi: client dựa vào `error.code` để dịch câu tiếng Việt. Nếu lỗi rơi vào
 *       handler mặc định của Fastify thì `code` biến mất và UI hiện câu chung chung.
 *
 * ⚠️ TEST QUAN TRỌNG NHẤT TRONG FILE: "gửi lại cùng mã sự kiện KHÔNG nhân đôi số đếm".
 *    Đây là kịch bản thật (phản hồi bị mất trên đường về) và hậu quả là số liệu phồng lên
 *    vĩnh viễn — không có cách nào sửa về sau vì không ai biết con số đúng là bao nhiêu.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';

import { buildApp, type AppInstance } from '../../../server/app.js';
import { config } from '../../../server/config.js';
import { getDb } from '../../../server/db/connection.js';
import { clearAllData, setupTestDb } from './helpers/testDb.js';
import type { ProgressSnapshot } from '../../../shared/types/progress.js';
import type { ProgressSyncResponse } from '../../../shared/types/api.js';

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

/**
 * Gửi một lô sự kiện đồng bộ.
 *
 * ⚠️ `payload` khai là `object`, KHÔNG phải `unknown`. `unknown` làm TypeScript không chọn
 *    được overload của `app.inject` và rơi về kiểu chuỗi (chain) — kết quả là lỗi biên dịch
 *    ở một dòng trông như không liên quan gì.
 */
async function sync(
  cookie: string,
  childId: string,
  payload: object,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url: `/api/children/${childId}/progress/sync`,
    headers: { cookie },
    payload,
  });
}

/** Đọc ảnh chụp tiến độ. */
async function getProgress(cookie: string, childId: string): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'GET',
    url: `/api/children/${childId}/progress`,
    headers: { cookie },
  });
}

/** Một sự kiện trả lời đúng, có mã cho trước. */
function answerEvent(id: string, wordId: string, correct = true, occurredAt = '2026-10-06T08:00:00.000Z') {
  return { clientEventId: id, kind: 'word_answer', wordId, correct, occurredAt };
}

describe('API tiến độ — tầng HTTP', () => {
  beforeAll(async () => {
    setupTestDb();
    app = await buildApp();
    await app.ready();
  });

  beforeEach(() => {
    clearAllData(getDb());
  });

  // ===========================================================================
  describe('xác thực và quyền sở hữu', () => {
    it('từ chối đọc khi chưa đăng nhập', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/children/chi_bat_ky/progress' });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
    });

    it('từ chối đồng bộ khi chưa đăng nhập', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/children/chi_bat_ky/progress/sync',
        payload: { events: [], since: null },
      });
      expect(res.statusCode).toBe(401);
    });

    /**
     * ⭐ Không được để phụ huynh A đọc tiến độ bé nhà B. Trả 404 (không phải 403) là CÓ CHỦ
     *    ĐÍCH: 403 sẽ xác nhận "hồ sơ này có tồn tại", tức là rò rỉ thông tin.
     */
    it('KHÔNG đọc được tiến độ của bé nhà phụ huynh khác', async () => {
      const cookieA = await signup('a@example.com');
      const childA = await createChild(cookieA);

      const cookieB = await signup('b@example.com');

      const res = await getProgress(cookieB, childA);
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: { code: 'CHILD_NOT_FOUND' } });
    });

    it('KHÔNG ghi được tiến độ vào bé nhà phụ huynh khác', async () => {
      const cookieA = await signup('a@example.com');
      const childA = await createChild(cookieA);
      const cookieB = await signup('b@example.com');

      const res = await sync(cookieB, childA, {
        events: [answerEvent('evt_1', 'starters.cat')],
        since: null,
      });
      expect(res.statusCode).toBe(404);

      // Và quan trọng không kém: dữ liệu của bé A phải KHÔNG bị đụng tới.
      const check = await getProgress(cookieA, childA);
      expect((check.json() as { data: ProgressSnapshot }).data.words).toEqual([]);
    });

    it('báo lỗi khi id bé không tồn tại', async () => {
      const cookie = await signup('a@example.com');
      const res = await getProgress(cookie, 'chi_khong_ton_tai');
      expect(res.statusCode).toBe(404);
    });
  });

  // ===========================================================================
  describe('đọc ảnh chụp', () => {
    it('bé mới tạo có ảnh chụp rỗng', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const res = await getProgress(cookie, childId);
      expect(res.statusCode).toBe(200);

      const snapshot = (res.json() as { data: ProgressSnapshot }).data;
      expect(snapshot.childId).toBe(childId);
      expect(snapshot.words).toEqual([]);
      expect(snapshot.lessons).toEqual([]);
      expect(snapshot.serverTime).toMatch(/Z$/);
    });

    it('bé nhà phụ huynh này KHÔNG thấy dữ liệu của bé nhà phụ huynh khác', async () => {
      const cookieA = await signup('a@example.com');
      const childA = await createChild(cookieA);
      await sync(cookieA, childA, {
        events: [answerEvent('evt_a', 'starters.cat')],
        since: null,
      });

      const cookieB = await signup('b@example.com');
      const childB = await createChild(cookieB, 'Momo');

      const res = await getProgress(cookieB, childB);
      expect((res.json() as { data: ProgressSnapshot }).data.words).toEqual([]);
    });
  });

  // ===========================================================================
  describe('đồng bộ sự kiện', () => {
    it('áp sự kiện và trả về ảnh chụp đã cập nhật', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const res = await sync(cookie, childId, {
        events: [answerEvent('evt_1', 'starters.cat')],
        since: null,
      });
      expect(res.statusCode, res.body).toBe(200);

      const data = (res.json() as { data: ProgressSyncResponse }).data;
      expect(data.applied).toBe(1);
      expect(data.skipped).toBe(0);
      expect(data.snapshot.words).toHaveLength(1);
      expect(data.snapshot.words[0]).toMatchObject({
        wordId: 'starters.cat',
        correctCount: 1,
        wrongCount: 0,
        learned: true,
      });
    });

    /**
     * ⭐⭐ TEST QUAN TRỌNG NHẤT CỦA FILE.
     *
     * Kịch bản thật: bé trả lời khi mất mạng → hàng đợi gửi lên → server ghi xong nhưng PHẢN
     * HỒI bị mất → client gửi lại y nguyên. Nếu server không chống trùng, `correctCount`
     * thành 2 cho MỘT câu trả lời, và con số sai đó ở lại vĩnh viễn.
     */
    it('gửi lại CÙNG mã sự kiện KHÔNG nhân đôi số đếm', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);
      const event = answerEvent('evt_trung', 'starters.cat');

      const first = await sync(cookie, childId, { events: [event], since: null });
      expect((first.json() as { data: ProgressSyncResponse }).data.applied).toBe(1);

      const second = await sync(cookie, childId, { events: [event], since: null });
      const secondData = (second.json() as { data: ProgressSyncResponse }).data;
      expect(secondData.applied).toBe(0);
      expect(secondData.skipped).toBe(1);
      expect(secondData.snapshot.words[0]!.correctCount).toBe(1);
    });

    it('trong CÙNG một lô, mã trùng cũng chỉ được áp một lần', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);
      const event = answerEvent('evt_trung', 'starters.cat');

      const res = await sync(cookie, childId, { events: [event, event, event], since: null });
      const data = (res.json() as { data: ProgressSyncResponse }).data;
      expect(data.applied).toBe(1);
      expect(data.skipped).toBe(2);
      expect(data.snapshot.words[0]!.correctCount).toBe(1);
    });

    it('cộng dồn nhiều sự kiện KHÁC mã cho cùng một từ', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      await sync(cookie, childId, {
        events: [
          answerEvent('e1', 'starters.cat', true),
          answerEvent('e2', 'starters.cat', true),
          answerEvent('e3', 'starters.cat', false),
        ],
        since: null,
      });

      const res = await getProgress(cookie, childId);
      const word = (res.json() as { data: ProgressSnapshot }).data.words[0]!;
      expect(word.correctCount).toBe(2);
      expect(word.wrongCount).toBe(1);
    });

    it('đánh dấu "đã nhớ" sau đúng 3 lần trả lời đúng', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const res = await sync(cookie, childId, {
        events: [
          answerEvent('e1', 'starters.cat', true),
          answerEvent('e2', 'starters.cat', true),
          answerEvent('e3', 'starters.cat', true),
        ],
        since: null,
      });
      expect((res.json() as { data: ProgressSyncResponse }).data.snapshot.words[0]!.mastered).toBe(
        true,
      );
    });

    it('cờ "đã nhớ" DÍNH — trả lời sai sau đó không xoá nó', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      await sync(cookie, childId, {
        events: [answerEvent('e1', 'starters.cat'), answerEvent('e2', 'starters.cat'), answerEvent('e3', 'starters.cat')],
        since: null,
      });
      const res = await sync(cookie, childId, {
        events: [answerEvent('e4', 'starters.cat', false)],
        since: null,
      });

      const word = (res.json() as { data: ProgressSyncResponse }).data.snapshot.words[0]!;
      expect(word.mastered).toBe(true);
      expect(word.wrongCount).toBe(1);
    });

    it('sự kiện "đã học" tạo bản ghi mà không tăng số đếm', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const res = await sync(cookie, childId, {
        events: [
          { clientEventId: 'e1', kind: 'word_learned', wordId: 'starters.dog', occurredAt: '2026-10-06T08:00:00.000Z' },
        ],
        since: null,
      });
      const word = (res.json() as { data: ProgressSyncResponse }).data.snapshot.words[0]!;
      expect(word).toMatchObject({ learned: true, correctCount: 0, wrongCount: 0, mastered: false });
    });

    it('hoàn thành bài tạo bản ghi và tăng số lần thử', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const make = (id: string) => ({
        clientEventId: id,
        kind: 'lesson_completed',
        lessonId: 'at-the-zoo-1',
        occurredAt: '2026-10-06T08:00:00.000Z',
      });

      const first = await sync(cookie, childId, { events: [make('e1')], since: null });
      const lesson = (first.json() as { data: ProgressSyncResponse }).data.snapshot.lessons[0]!;
      expect(lesson).toMatchObject({ lessonId: 'at-the-zoo-1', completed: true, attempts: 1 });
      expect(lesson.completedAt).toBe('2026-10-06T08:00:00.000Z');

      const second = await sync(cookie, childId, { events: [make('e2')], since: null });
      expect(
        (second.json() as { data: ProgressSyncResponse }).data.snapshot.lessons[0]!.attempts,
      ).toBe(2);
    });

    it('lô rỗng vẫn trả về ảnh chụp hiện tại', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const res = await sync(cookie, childId, { events: [], since: null });
      expect(res.statusCode).toBe(200);
      const data = (res.json() as { data: ProgressSyncResponse }).data;
      expect(data.applied).toBe(0);
      expect(data.snapshot.words).toEqual([]);
    });

    /**
     * ⭐ Chứng minh `resolveFloor` hoạt động: sự kiện xảy ra TRƯỚC mốc `since` vẫn phải được
     *    trả về. Nếu lọc thuần theo `since`, một thiết bị vừa cài lại app sẽ không bao giờ
     *    nhận được tiến độ cũ — lỗi im lặng và cực khó truy.
     */
    it('trả về bản ghi của sự kiện cũ hơn `since` (chứng minh mốc sàn)', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      // Sự kiện xảy ra lúc 08:00, nhưng `since` lại là 09:00 (lần đồng bộ trước).
      const res = await sync(cookie, childId, {
        events: [answerEvent('e1', 'starters.cat', true, '2026-10-06T08:00:00.000Z')],
        since: '2026-10-06T09:00:00.000Z',
      });

      const data = (res.json() as { data: ProgressSyncResponse }).data;
      expect(data.applied).toBe(1);
      expect(data.snapshot.words).toHaveLength(1);
    });

    it('lọc được bản ghi cũ khi `since` mới hơn hẳn', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      await sync(cookie, childId, {
        events: [answerEvent('e1', 'starters.cat', true, '2026-10-06T08:00:00.000Z')],
        since: null,
      });

      // Lần này KHÔNG gửi sự kiện nào và `since` mới hơn ⇒ không bản ghi nào được trả về.
      const res = await sync(cookie, childId, {
        events: [],
        since: '2026-10-07T00:00:00.000Z',
      });
      expect((res.json() as { data: ProgressSyncResponse }).data.snapshot.words).toEqual([]);
    });

    it('giữ mốc "lần cuối gặp" MUỘN NHẤT khi sự kiện đến không theo thứ tự', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const res = await sync(cookie, childId, {
        events: [
          answerEvent('e1', 'starters.cat', true, '2026-10-06T10:00:00.000Z'),
          answerEvent('e2', 'starters.cat', true, '2026-10-06T08:00:00.000Z'),
        ],
        since: null,
      });
      const word = (res.json() as { data: ProgressSyncResponse }).data.snapshot.words[0]!;
      expect(word.lastSeenAt).toBe('2026-10-06T10:00:00.000Z');
      expect(word.updatedAt).toBe('2026-10-06T10:00:00.000Z');
    });
  });

  // ===========================================================================
  describe('kiểm dữ liệu vào', () => {
    it('từ chối sự kiện thiếu wordId', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const res = await sync(cookie, childId, {
        events: [{ clientEventId: 'e1', kind: 'word_answer', correct: true, occurredAt: '2026-10-06T08:00:00.000Z' }],
        since: null,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
    });

    it('từ chối sự kiện "word_answer" thiếu trường correct', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const res = await sync(cookie, childId, {
        events: [{ clientEventId: 'e1', kind: 'word_answer', wordId: 'starters.cat', occurredAt: '2026-10-06T08:00:00.000Z' }],
        since: null,
      });
      expect(res.statusCode).toBe(400);
    });

    /**
     * ⚠️ `occurredAt` KHÔNG có `Z` (giờ địa phương) phải bị từ chối. Luật gộp so sánh CHUỖI,
     *    nên một chuỗi lệch định dạng sẽ sắp xếp sai và phá cơ chế đồng bộ.
     */
    it('từ chối thời điểm không phải ISO-8601 UTC', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      for (const bad of ['2026-10-06T08:00:00', '06/10/2026', '2026-10-06 08:00:00Z']) {
        const res = await sync(cookie, childId, {
          events: [{ clientEventId: 'e1', kind: 'word_learned', wordId: 'starters.cat', occurredAt: bad }],
          since: null,
        });
        expect(res.statusCode, `phải từ chối "${bad}"`).toBe(400);
      }
    });

    it('từ chối mã sự kiện chứa ký tự lạ', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const res = await sync(cookie, childId, {
        events: [
          {
            clientEventId: 'evt co dau cach/va/gach-cheo',
            kind: 'word_learned',
            wordId: 'starters.cat',
            occurredAt: '2026-10-06T08:00:00.000Z',
          },
        ],
        since: null,
      });
      expect(res.statusCode).toBe(400);
    });

    /**
     * ⚠️ Chống tê liệt: không giới hạn số sự kiện thì một client hỏng (hoặc kẻ tấn công) gửi
     *    500.000 sự kiện trong một request sẽ khoá DB và làm sập app của mọi bé khác.
     */
    it('từ chối lô quá lớn', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const events = Array.from({ length: 201 }, (_, i) => answerEvent(`e${i}`, 'starters.cat'));
      const res = await sync(cookie, childId, { events, since: null });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
    });

    it('chấp nhận lô đúng bằng trần 200', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const events = Array.from({ length: 200 }, (_, i) => answerEvent(`e${i}`, 'starters.cat'));
      const res = await sync(cookie, childId, { events, since: null });
      expect(res.statusCode, res.body).toBe(200);
      expect((res.json() as { data: ProgressSyncResponse }).data.applied).toBe(200);
    });

    it('từ chối khi thiếu trường `since`', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const res = await sync(cookie, childId, { events: [] });
      expect(res.statusCode).toBe(400);
    });
  });

  // ===========================================================================
  describe('tính bền vững của dữ liệu', () => {
    it('tiến độ sống sót qua một request đọc mới', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      await sync(cookie, childId, {
        events: [answerEvent('e1', 'starters.cat'), answerEvent('e2', 'starters.dog')],
        since: null,
      });

      const res = await getProgress(cookie, childId);
      const words = (res.json() as { data: ProgressSnapshot }).data.words;
      expect(words.map((w) => w.wordId).sort()).toEqual(['starters.cat', 'starters.dog']);
    });

    it('xoá hồ sơ bé thì xoá luôn tiến độ (ON DELETE CASCADE)', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      await sync(cookie, childId, { events: [answerEvent('e1', 'starters.cat')], since: null });

      const del = await app.inject({
        method: 'DELETE',
        url: `/api/children/${childId}`,
        headers: { cookie },
      });
      expect(del.statusCode).toBe(200);

      const row = getDb()
        .prepare('SELECT COUNT(*) AS n FROM word_progress WHERE child_id = ?')
        .get(childId) as { n: number };
      expect(row.n).toBe(0);
    });
  });
});
