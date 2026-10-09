// @vitest-environment node
/**
 * RubyLingo — Test TẦNG HTTP cho BÁO CÁO PHỤ HUYNH (T073).
 *
 * ⭐ NHỮNG ĐIỀU CHỈ TẦNG HTTP MỚI BẤT ĐƯỢC:
 *   • route có được ĐĂNG KÝ hay không (quên ⇒ 404 cho tính năng đã viết xong);
 *   • BA TẦNG guard có gắn THẬT không: `requireParent`, `requireParentGate`, và SỞ HỮU (`parent_id`);
 *   • chặn TRẦN khoảng ngày ở tầng request.
 *
 * ⭐ VÀ NHỮNG ĐIỀU CHỈ TEST MỚI BẤT ĐƯỢC (lỗi IM LẶNG):
 *   1. **LỆCH NGÀY VÌ UTC.** Một bài xong lúc 00:30 giờ Việt Nam (= 17:30Z hôm trước) PHẢI thuộc
 *      NGÀY ĐỊA PHƯƠNG hôm nay. So chuỗi ISO trực tiếp sẽ xếp nó vào hôm trước — báo cáo, chuỗi
 *      ngày và nhiệm vụ sẽ nói ba con số khác nhau cho cùng một ngày.
 *   2. **`to` BAO GỒM ngày cuối** — sai một ngày ở đây làm mất/ thừa đúng ngày cuối tuần.
 *   3. **HAI DANH SÁCH TỪ RỜI NHAU** — một từ không thể vừa "hay nhầm" vừa "nhớ chắc".
 *   4. **BÉ KHÔNG CÓ DỮ LIỆU ⇒ số 0 + câu trung tính, KHÔNG phải lỗi.**
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';

import { buildApp, type AppInstance } from '../../../server/app.js';
import { config } from '../../../server/config.js';
import { closeDb, getDb } from '../../../server/db/connection.js';
import { STRUGGLING_MIN_WRONG } from '../../../shared/constants.js';
import type { ReportResponse } from '../../../shared/types/api.js';
import { clearAllData, setupTestDb } from './helpers/testDb.js';

let app: AppInstance;

const PASSWORD = 'matkhau-report-700';

let requestSeq = 0;
function withClient(headers: Record<string, string> = {}): Record<string, string> {
  requestSeq += 1;
  return { 'x-forwarded-for': `10.8.0.${requestSeq % 250}`, ...headers };
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

/** Gọi báo cáo. `query` ví dụ `?from=2026-10-01&to=2026-10-06` (bỏ trống = mặc định). */
function getReport(cookie: string, childId: string, query = ''): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'GET',
    url: `/api/children/${encodeURIComponent(childId)}/report${query}`,
    headers: withClient({ cookie }),
  });
}

function reportBody(res: LightMyRequestResponse): ReportResponse {
  return (res.json() as { data: ReportResponse }).data;
}

const AT = '2026-10-06T09:00:00.000Z';

/** Ghi một hàng `daily_stats` (khoá ngày địa phương, đúng như `dailyStats` vẫn ghi). */
function seedDailyStat(
  childId: string,
  date: string,
  d: { wordsLearned?: number; questionsAnswered?: number; starsEarned?: number; activeSeconds?: number },
): void {
  getDb()
    .prepare(
      `INSERT INTO daily_stats
         (child_id, date, words_learned, questions_answered, correct_count,
          stars_earned, acorns_earned, xp_earned, active_seconds, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, 0, 0, ?, ?)`,
    )
    .run(childId, date, d.wordsLearned ?? 0, d.questionsAnswered ?? 0, d.starsEarned ?? 0, d.activeSeconds ?? 0, AT);
}

/** Ghi một bài đã hoàn thành với mốc `completed_at` cho trước (ISO UTC). */
function seedLessonCompleted(childId: string, lessonId: string, completedAt: string): void {
  getDb()
    .prepare(
      `INSERT INTO lesson_progress
         (child_id, lesson_id, best_score, stars_best, attempts, completed, completed_at, updated_at)
       VALUES (?, ?, 9, 3, 1, 1, ?, ?)
       ON CONFLICT (child_id, lesson_id) DO UPDATE SET completed = 1, completed_at = excluded.completed_at`,
    )
    .run(childId, lessonId, completedAt, completedAt);
}

function seedWord(
  childId: string,
  wordId: string,
  w: { correct: number; wrong: number; mastered: boolean },
): void {
  getDb()
    .prepare(
      `INSERT INTO word_progress
         (child_id, word_id, learned, mastered, correct_count, wrong_count, last_seen_at, updated_at)
       VALUES (?, ?, 1, ?, ?, ?, ?, ?)
       ON CONFLICT (child_id, word_id) DO UPDATE SET
         mastered = excluded.mastered,
         correct_count = excluded.correct_count,
         wrong_count = excluded.wrong_count`,
    )
    .run(childId, wordId, w.mastered ? 1 : 0, w.correct, w.wrong, AT, AT);
}

/** Mở cổng PIN cho phiên này (khi tài khoản CHƯA có PIN, mọi PIN 4 số đều mở — xem T072). */
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
// Guard
// =============================================================================

describe('báo cáo — ba tầng bảo vệ', () => {
  it('chưa đăng nhập ⇒ 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/children/chi_bat_ky/report',
      headers: withClient(),
    });
    expect(res.statusCode).toBe(401);
  });

  it('⚠️ cổng PIN ĐÓNG (đã đặt PIN, phiên mới) ⇒ 403 PARENT_GATE_REQUIRED', async () => {
    const cookie = await signup('rep-gate@example.com');
    const childId = await createChild(cookie, 'Na');

    // Đặt PIN ⇒ phiên cũ mở cổng; phiên MỚI (đăng nhập lại) thì cổng đóng.
    const setPin = await app.inject({
      method: 'PATCH',
      url: '/api/parent/pin',
      headers: withClient({ cookie }),
      payload: { pin: '1111' },
    });
    expect(setPin.statusCode, setPin.body).toBe(200);

    const fresh = await login('rep-gate@example.com');
    const res = await getReport(fresh, childId);
    expect(res.statusCode).toBe(403);
    expect((res.json() as { error: { code: string } }).error.code).toBe('PARENT_GATE_REQUIRED');
  });

  it('⭐ con NHÀ KHÁC ⇒ 404 CHILD_NOT_FOUND (ranh giới giữa các gia đình)', async () => {
    const cookieA = await signup('rep-a@example.com');
    const childA = await createChild(cookieA, 'Na');
    const cookieB = await signup('rep-b@example.com');
    // B CHƯA có PIN ⇒ cổng mở ⇒ request đi tới được tầng kiểm SỞ HỮU.
    expect((await openGate(cookieB)).statusCode).toBe(200);

    const res = await getReport(cookieB, childA);
    expect(res.statusCode).toBe(404);
    expect((res.json() as { error: { code: string } }).error.code).toBe('CHILD_NOT_FOUND');
  });

  it('bé không tồn tại ⇒ 404', async () => {
    const cookie = await signup('rep-missing@example.com');
    const res = await getReport(cookie, 'chi_khong_ton_tai');
    expect(res.statusCode).toBe(404);
  });
});

// =============================================================================
// Bé chưa có dữ liệu
// =============================================================================

describe('bé chưa có dữ liệu ⇒ số 0 + câu trung tính, KHÔNG lỗi', () => {
  it('trả 200 với mọi số bằng 0 và một câu không phán xét', async () => {
    const cookie = await signup('rep-empty@example.com');
    const childId = await createChild(cookie, 'Na');

    const res = await getReport(cookie, childId, '?from=2026-10-01&to=2026-10-07');
    expect(res.statusCode, res.body).toBe(200);

    const data = reportBody(res);
    expect(data.child.id).toBe(childId);
    expect(data.range).toEqual({ from: '2026-10-01', to: '2026-10-07' });
    expect(data.dailyStats).toEqual([]);
    expect(data).toMatchObject({
      wordsLearned: 0,
      wordsMastered: 0,
      lessonsCompleted: 0,
      starsEarned: 0,
      strugglingWords: [],
      masteredWords: [],
    });

    // Câu phải có thật và KHÔNG mang tính phán xét (luật ngôn ngữ áp cả cho câu cho phụ huynh).
    expect(data.summary_vi.length).toBeGreaterThan(0);
    expect(data.summary_vi).not.toMatch(/kém|chưa đạt|thất bại|\bsai\b/i);
  });
});

// =============================================================================
// Biên ngày — localDateKey, và `to` bao gồm
// =============================================================================

describe('⭐ biên ngày theo `localDateKey`', () => {
  it('bài xong lúc 00:30 GIỜ VIỆT NAM (= 17:30Z hôm trước) thuộc NGÀY HÔM NAY, không lệch sang hôm trước', async () => {
    const cookie = await signup('rep-tz@example.com');
    const childId = await createChild(cookie, 'Na');

    // 2026-10-05T17:30Z ⇒ +7h = 2026-10-06T00:30 giờ địa phương ⇒ KHOÁ NGÀY phải là 2026-10-06.
    seedLessonCompleted(childId, 'at-the-zoo/z1', '2026-10-05T17:30:00.000Z');

    const inToday = reportBody(await getReport(cookie, childId, '?from=2026-10-06&to=2026-10-06'));
    expect(inToday.lessonsCompleted).toBe(1);

    const inYesterday = reportBody(await getReport(cookie, childId, '?from=2026-10-05&to=2026-10-05'));
    expect(inYesterday.lessonsCompleted).toBe(0);
  });

  it('`to` BAO GỒM ngày cuối: hàng đúng ngày `to` được tính, ngày kế tiếp thì không', async () => {
    const cookie = await signup('rep-incl@example.com');
    const childId = await createChild(cookie, 'Na');
    seedDailyStat(childId, '2026-10-06', { wordsLearned: 3, starsEarned: 10 });
    seedDailyStat(childId, '2026-10-07', { wordsLearned: 5, starsEarned: 20 });

    const upTo6 = reportBody(await getReport(cookie, childId, '?from=2026-10-01&to=2026-10-06'));
    expect(upTo6.wordsLearned).toBe(3);
    expect(upTo6.starsEarned).toBe(10);
    expect(upTo6.dailyStats.map((d) => d.date)).toEqual(['2026-10-06']);

    const upTo7 = reportBody(await getReport(cookie, childId, '?from=2026-10-01&to=2026-10-07'));
    expect(upTo7.wordsLearned).toBe(8);
    expect(upTo7.starsEarned).toBe(30);
    expect(upTo7.dailyStats.map((d) => d.date)).toEqual(['2026-10-06', '2026-10-07']);
  });

  it('hàng `daily_stats` toàn số 0 (bấm nhận quà) KHÔNG tính là một ngày học trong câu tóm tắt', async () => {
    const cookie = await signup('rep-zeroday@example.com');
    const childId = await createChild(cookie, 'Na');
    seedDailyStat(childId, '2026-10-06', { starsEarned: 10 }); // chỉ có ⭐, không có hoạt động học

    const data = reportBody(await getReport(cookie, childId, '?from=2026-10-06&to=2026-10-06'));
    // "chưa có buổi học nào" ⇔ không ngày nào có hoạt động học.
    expect(data.summary_vi).toMatch(/chưa có buổi học/);
  });
});

// =============================================================================
// Trần khoảng ngày
// =============================================================================

describe('chặn khoảng ngày', () => {
  it('⚠️ khoảng QUÁ LỚN (từ 1970) ⇒ 400, không quét cả bảng', async () => {
    const cookie = await signup('rep-span@example.com');
    const childId = await createChild(cookie, 'Na');

    const res = await getReport(cookie, childId, '?from=1970-01-01&to=2026-10-06');
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: { code: string } }).error.code).toBe('VALIDATION_FAILED');
  });

  it('`from` sau `to` ⇒ 400', async () => {
    const cookie = await signup('rep-order@example.com');
    const childId = await createChild(cookie, 'Na');
    const res = await getReport(cookie, childId, '?from=2026-10-07&to=2026-10-01');
    expect(res.statusCode).toBe(400);
  });

  it('thiếu cả `from` lẫn `to` ⇒ dùng mặc định (một tuần) và trả 200', async () => {
    const cookie = await signup('rep-default@example.com');
    const childId = await createChild(cookie, 'Na');
    const res = await getReport(cookie, childId);
    expect(res.statusCode, res.body).toBe(200);
    const { range } = reportBody(res);
    expect(range.from < range.to).toBe(true);
  });
});

// =============================================================================
// Hai danh sách từ
// =============================================================================

describe('⭐ hai danh sách từ: rời nhau, và gọi tên được từ', () => {
  it('từ "hay nhầm" và từ "nhớ chắc" RỜI NHAU, có đủ `en`/`vi`, `accuracy` đúng', async () => {
    const cookie = await signup('rep-words@example.com');
    const childId = await createChild(cookie, 'Na');

    // `starters.a` — sai nhiều, chưa nhớ chắc ⇒ "hay nhầm".
    seedWord(childId, 'starters.a', { correct: 1, wrong: STRUGGLING_MIN_WRONG, mastered: false });
    // `starters.afternoon` — nhớ chắc ⇒ "đã nhớ".
    seedWord(childId, 'starters.afternoon', { correct: 5, wrong: 0, mastered: true });
    // Nhiễu: một từ nhớ chắc mà CŨNG có vài lần sai ⇒ KHÔNG được lọt vào "hay nhầm".
    seedWord(childId, 'starters.alien', { correct: 4, wrong: 3, mastered: true });

    const data = reportBody(await getReport(cookie, childId, '?from=2026-10-01&to=2026-10-07'));

    expect(data.strugglingWords.map((w) => w.wordId)).toEqual(['starters.a']);
    expect(data.strugglingWords[0]).toMatchObject({ en: 'A', vi: 'chữ A', correctCount: 1, wrongCount: STRUGGLING_MIN_WRONG });
    expect(data.strugglingWords[0]!.accuracy).toBeCloseTo(1 / (1 + STRUGGLING_MIN_WRONG), 5);

    // Sắp theo `correct_count` GIẢM DẦN: afternoon (5) trước alien (4).
    expect(data.masteredWords.map((w) => w.wordId)).toEqual(['starters.afternoon', 'starters.alien']);

    // ⭐ GIAO PHẢI RỖNG: không từ nào vừa "hay nhầm" vừa "nhớ chắc".
    const strugglingIds = new Set(data.strugglingWords.map((w) => w.wordId));
    const masteredIds = new Set(data.masteredWords.map((w) => w.wordId));
    expect([...strugglingIds].filter((id) => masteredIds.has(id))).toEqual([]);
  });

  it('từ KHÔNG còn trong nội dung bị BỎ QUA — báo cáo vẫn mở được', async () => {
    const cookie = await signup('rep-orphan@example.com');
    const childId = await createChild(cookie, 'Na');
    seedWord(childId, 'starters.khong-co-trong-noi-dung', { correct: 0, wrong: 5, mastered: false });
    seedWord(childId, 'starters.a', { correct: 0, wrong: 5, mastered: false });

    const res = await getReport(cookie, childId, '?from=2026-10-01&to=2026-10-07');
    expect(res.statusCode, res.body).toBe(200);
    expect(reportBody(res).strugglingWords.map((w) => w.wordId)).toEqual(['starters.a']);
  });
});
