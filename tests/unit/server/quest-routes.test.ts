// @vitest-environment node
/**
 * RubyLingo — Test TẦNG HTTP cho routes nhiệm vụ (T059).
 *
 * ⚠️ VÌ SAO LẠI CẦN MỘT FILE NỮA, KHI ĐÃ CÓ `quest-service.test.ts` (46 test):
 *   `quest-service.test.ts` gọi thẳng `QuestService`, nên nó KHÔNG THỂ thấy được:
 *     • route có được ĐĂNG KÝ hay không (`app.register(questsRoutes)` bị quên ở `app.ts`
 *       ⇒ API trả 404 `NOT_FOUND` cho một tính năng đã viết xong hoàn chỉnh);
 *     • `preHandler: requireParent` có thật sự gắn vào HAI route này hay không;
 *     • hook toàn cục (kiểm `Origin`) có áp dụng cho route ĐĂNG KÝ Ở GỐC hay không;
 *     • tầng route có "tiện tay" gọi thẳng DB và bỏ qua phép kiểm quyền sở hữu hay không;
 *     • `:questId` trên URL có được đọc đúng tham số hay không (đọc sai ⇒ `''` ⇒ luôn 404).
 *   Đây đều là lỗi IM LẶNG: `typecheck`, `lint`, và mọi test đơn vị đều xanh.
 *
 * ⚠️ BA KHẲNG ĐỊNH QUAN TRỌNG NHẤT CỦA FILE, VÀ CHÚNG ĐỀU CHỐNG LỖI "NHÌN NHƯ ĐÚNG":
 *   1. `GET` KHÔNG GHI DB. Một `GET` lỡ tay UPSERT hàng `quest_progress`/`daily_stats` sẽ khiến
 *      mở màn hình Nhiệm vụ = dữ liệu thay đổi ⇒ mất khả năng phân biệt "bé vừa làm gì" với
 *      "bé vừa mở app", và mọi lần đồng bộ sau đó đều thấy "có gì đó mới".
 *   2. BẤM NHẬN THƯỞNG LẦN HAI KHÔNG TRAO THÊM QUÀ. Cổng chống nhận hai lần nằm trong `WHERE`
 *      của câu `UPDATE` (xem `QuestService.claim`), không phải một `if` ở tầng JS. Test ở đây
 *      khẳng định cả HAI vế: lần hai trả `ALREADY_CLAIMED` VÀ số dư ví không nhúc nhích —
 *      chỉ khẳng định mã lỗi là chưa đủ, vì một cổng đặt sai chỗ vẫn có thể trả đúng mã lỗi
 *      trong khi đã trao quà.
 *   3. SỐ ⭐ TRONG VÍ KHỚP TỔNG `stars_earned` CỦA `daily_stats`. Đây là hai con số nói về CÙNG
 *      một thứ: ví là thứ bé thấy, `daily_stats` là nguồn duy nhất của báo cáo phụ huynh. Lệch
 *      nhau thì không ai tin được con số nào — mà lệch thì rất dễ, chỉ cần quên một nguồn quà
 *      khi ghi `daily_stats` (ví dụ quà của CẤP vừa vượt trong lúc nhận thưởng nhiệm vụ).
 *
 * ⚠️ DỰNG DỮ LIỆU BẰNG DB TRỰC TIẾP LÀ CÓ Ý THỨC, KHÔNG PHẢI LƯỜI:
 *   - `qm-01` (`complete_lesson at-the-zoo/z1`) là tiêu chí SUY DIỄN: chỉ cần một hàng
 *     `lesson_progress` là server tự suy ra "đã xong". Đây đúng là đường thật — `ProgressService`
 *     ghi `lesson_progress` rồi mới bắn sự kiện, nên test chỉ cần làm phần thứ nhất.
 *   - `qd-01` là tiêu chí ĐẾM: `progress` chỉ cộng dồn được nhờ sự kiện do `ProgressService` /
 *     `GameResultService` bắn. Việc cộng dồn đó đã được `quest-service.test.ts` khoá kỹ (kèm 11
 *     đột biến kiểm chứng). Ở tầng HTTP, thứ cần kiểm là ĐƯỜNG ĐI của lệnh `claim`, nên hàng
 *     `quest_progress` được đặt thẳng làm dữ liệu nền.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';

import { buildApp, type AppInstance } from '../../../server/app.js';
import { config } from '../../../server/config.js';
import { closeDb, getDb, type Db } from '../../../server/db/connection.js';
import { dailyPeriodKey, localDateKey, weeklyPeriodKey } from '../../../server/lib/time.js';
import { activeQuests } from '../../../shared/content/quests.js';
import type { ClaimQuestResponse, QuestsGetResponse } from '../../../shared/types/api.js';
import { clearAllData, setupTestDb } from './helpers/testDb.js';

let app: AppInstance;

/** Cookie phiên của phụ huynh đang đăng nhập trong test hiện tại. */
let cookie: string;
/** Bé của phụ huynh đó. */
let childId: string;

const PASSWORD = 'matkhau-du-manh-123';

// =============================================================================
// Tiện ích
// =============================================================================

/**
 * ⚠️ VÌ SAO MỖI REQUEST MANG MỘT `x-forwarded-for` RIÊNG — KHÔNG PHẢI CHI TIẾT TRANG TRÍ:
 *   File này gọi ~60 request HTTP. `securityPlugin` giới hạn 300 request/phút cho MỖI khoá, mà
 *   `keyGenerator` ưu tiên `x-forwarded-for` và chỉ rơi về `req.ip` khi header vắng mặt. Mọi
 *   request `app.inject()` không có XFF đều mang CÙNG một IP ⇒ chạm trần sau vài chục request ⇒
 *   các request sau nhận 429 và test ĐỎ vì một lý do không liên quan gì tới điều nó đang kiểm.
 *
 *   Đây là loại flake độc hại nhất: nó trông y hệt một bug thật, và nó xuất hiện hay biến mất tuỳ
 *   theo thứ tự chạy. (Đã thật sự xảy ra: chạy cả bộ 19 đột biến liên tiếp thì lần chạy cuối đỏ.)
 *
 *   Gửi XFF còn SÁT THỰC TẾ hơn: Caddy đứng trước app luôn đặt header này. Việc kiểm chính sách
 *   rate-limit đã có file riêng (`rate-limit-response.test.ts`) — ở đây ta chủ động vô hiệu hoá nó
 *   để mỗi test chỉ còn đúng một lý do để đỏ.
 */
let requestSeq = 0;
function withClient(headers: Record<string, string> = {}): Record<string, string> {
  requestSeq += 1;
  return { 'x-forwarded-for': `10.9.0.${requestSeq % 250}`, ...headers };
}

/** Lấy cookie phiên từ header `set-cookie`. Ném lỗi nếu không có (dấu hiệu plugin bị đóng gói). */
function sessionCookieOf(res: LightMyRequestResponse): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = list.find((c) => c.startsWith(`${config.cookie.name}=`));
  if (!found) throw new Error(`Response KHÔNG đặt cookie phiên "${config.cookie.name}".`);
  return found.split(';')[0]!;
}

/** Đăng ký một tài khoản qua HTTP và trả cookie phiên của nó. */
async function signupViaHttp(email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    headers: withClient(),
    payload: { email, password: PASSWORD, parentalConsent: true },
  });
  expect(res.statusCode).toBe(201);
  return sessionCookieOf(res);
}

/** Tạo một bé qua HTTP (đúng đường thật mà client dùng). */
async function createChildViaHttp(parentCookie: string, nickname: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/children',
    headers: withClient({ cookie: parentCookie }),
    payload: { nickname, age: 7, avatarId: 'fox' },
  });
  expect(res.statusCode).toBe(201);
  return (res.json() as { data: { child: { id: string } } }).data.child.id;
}

/** Ghi `lesson_progress` như `ProgressService` vẫn làm — dựng dữ liệu nền cho tiêu chí suy diễn. */
function markLessonCompleted(db: Db, child: string, lessonId: string): void {
  const at = new Date().toISOString();
  db.prepare(
    `INSERT INTO lesson_progress (child_id, lesson_id, best_score, stars_best, attempts, completed, completed_at, updated_at)
     VALUES (?, ?, 9, 3, 1, 1, ?, ?)
     ON CONFLICT (child_id, lesson_id) DO UPDATE SET completed = 1, completed_at = excluded.completed_at, updated_at = excluded.updated_at`,
  ).run(child, lessonId, at, at);
}

/**
 * Đặt thẳng một hàng `quest_progress` cho nhiệm vụ ĐẾM (xem ghi chú đầu file).
 * `periodKey` phải là khoá kỳ HIỆN TẠI — route tự tính bằng `new Date()`.
 */
function seedCounterQuestRow(db: Db, child: string, questId: string, progress: number): void {
  const at = new Date().toISOString();
  db.prepare(
    `INSERT INTO quest_progress (child_id, quest_id, period_key, progress, target, completed, claimed, claimed_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, 0, NULL, ?)
     ON CONFLICT (child_id, quest_id, period_key) DO UPDATE SET progress = excluded.progress, completed = 1, updated_at = excluded.updated_at`,
  ).run(child, questId, dailyPeriodKey(new Date()), progress, progress, at);
}

/** Đặt số XP sẵn có (để test nhánh "nhận thưởng ⇒ vượt cấp"). */
function seedXp(db: Db, child: string, xp: number, level: number): void {
  db.prepare(
    `INSERT INTO xp_state (child_id, xp, level, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (child_id) DO UPDATE SET xp = excluded.xp, level = excluded.level, updated_at = excluded.updated_at`,
  ).run(child, xp, level, new Date().toISOString());
}

/** Số hàng của một bảng (không truyền tham số) — để chứng minh "GET không ghi gì". */
function countRows(db: Db, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}

/** Tổng một cột số của `daily_stats` cho một bé. */
function sumDailyStat(db: Db, child: string, column: string): number {
  const row = db
    .prepare(`SELECT COALESCE(SUM(${column}), 0) AS total FROM daily_stats WHERE child_id = ?`)
    .get(child) as { total: number };
  return row.total;
}

/** Gọi GET danh sách nhiệm vụ. */
function getQuests(c: string, id: string): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'GET',
    url: `/api/children/${id}/quests`,
    headers: withClient({ cookie: c }),
  });
}

/** Gọi POST nhận thưởng. */
function claimQuest(
  c: string,
  id: string,
  questId: string,
  headers: Record<string, string> = {},
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url: `/api/children/${id}/quests/${questId}/claim`,
    headers: withClient({ cookie: c, ...headers }),
  });
}

/** Nhiệm vụ theo id trong payload GET. */
function questById(body: { data: QuestsGetResponse }, questId: string) {
  const found = body.data.quests.find((q) => q.id === questId);
  if (!found) throw new Error(`Không thấy nhiệm vụ ${questId} trong payload`);
  return found;
}

// =============================================================================

describe('API nhiệm vụ — tầng HTTP (T059)', () => {
  beforeAll(async () => {
    setupTestDb();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    closeDb();
  });

  beforeEach(async () => {
    clearAllData(getDb());
    cookie = await signupViaHttp('bo@example.com');
    childId = await createChildViaHttp(cookie, 'Bin');
  });

  // ===========================================================================
  describe('⭐ route nằm dưới CÙNG chuỗi plugin/route ở gốc (chống lỗi đóng gói + quên đăng ký)', () => {
    it('route ĐÃ được đăng ký: GET trả 200 chứ không phải 404', async () => {
      const res = await getQuests(cookie, childId);

      // Nếu `app.register(questsRoutes)` bị quên trong `app.ts`, `setNotFoundHandler` trả 404
      // với `code: 'NOT_FOUND'` — tính năng hoàn chỉnh mà không ai gọi được.
      expect(res.statusCode).toBe(200);
      expect(Array.isArray((res.json() as { data: QuestsGetResponse }).data.quests)).toBe(true);
    });

    it('chưa đăng nhập ⇒ GET 401 UNAUTHENTICATED', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/quests`,
        headers: withClient(),
      });
      expect(res.statusCode).toBe(401);
      expect((res.json() as { error: { code: string } }).error.code).toBe('UNAUTHENTICATED');
    });

    it('chưa đăng nhập ⇒ POST claim 401 và KHÔNG ghi gì vào quest_progress', async () => {
      const db = getDb();
      markLessonCompleted(db, childId, 'at-the-zoo/z1');

      const res = await app.inject({
        method: 'POST',
        url: `/api/children/${childId}/quests/qm-01/claim`,
        headers: withClient(),
      });

      expect(res.statusCode).toBe(401);
      // Không có transaction nào được mở: nhiệm vụ vẫn chưa bị đánh dấu đã nhận.
      expect(countRows(db, 'quest_progress')).toBe(0);
    });

    it('hook Origin toàn cục áp dụng cho route mới: POST từ origin lạ bị chặn 403', async () => {
      const res = await claimQuest(cookie, childId, 'qm-01', { origin: 'https://evil.example' });
      // Thiếu dòng này ⇒ mất hẳn lớp chống CSRF riêng cho đường dẫn mới, mà không có gì báo.
      expect(res.statusCode).toBe(403);
      expect((res.json() as { error: { code: string } }).error.code).toBe('FORBIDDEN');
    });
  });

  // ===========================================================================
  describe('quyền sở hữu: :id trong URL KHÔNG thay được cho phép kiểm parent_id', () => {
    /** Tạo một phụ huynh khác + bé của họ, trả về id bé đó. */
    async function anotherFamilyChild(): Promise<string> {
      const otherCookie = await signupViaHttp('me@example.com');
      return createChildViaHttp(otherCookie, 'Bo');
    }

    it('GET với bé của phụ huynh khác ⇒ 404 CHILD_NOT_FOUND', async () => {
      const otherChild = await anotherFamilyChild();

      const res = await getQuests(cookie, otherChild);

      expect(res.statusCode).toBe(404);
      expect((res.json() as { error: { code: string } }).error.code).toBe('CHILD_NOT_FOUND');
    });

    it('POST claim với bé của phụ huynh khác ⇒ 404 và KHÔNG trao quà', async () => {
      const otherCookie = await signupViaHttp('me@example.com');
      const otherChild = await createChildViaHttp(otherCookie, 'Bo');
      const db = getDb();
      markLessonCompleted(db, otherChild, 'at-the-zoo/z1');

      const res = await claimQuest(cookie, otherChild, 'qm-01');

      expect(res.statusCode).toBe(404);
      expect((res.json() as { error: { code: string } }).error.code).toBe('CHILD_NOT_FOUND');
      // Ví nhà kia phải nguyên vẹn — nếu tầng route gọi thẳng service không kiểm quyền, dòng
      // này sẽ là 20 (hoặc tệ hơn: 404 nhưng đã trao quà rồi mới báo lỗi).
      const wallet = db
        .prepare('SELECT stars FROM wallet WHERE child_id = ?')
        .get(otherChild) as { stars: number } | undefined;
      expect(wallet?.stars ?? 0).toBe(0);
    });

    it('GET với :id không tồn tại ⇒ 404 CHILD_NOT_FOUND', async () => {
      const res = await getQuests(cookie, 'khong-co-be-nay');
      expect(res.statusCode).toBe(404);
      expect((res.json() as { error: { code: string } }).error.code).toBe('CHILD_NOT_FOUND');
    });
  });

  // ===========================================================================
  describe('GET /quests', () => {
    it('trả ĐỦ danh mục + chuỗi ngày + khoá kỳ đúng định dạng', async () => {
      const res = await getQuests(cookie, childId);
      expect(res.statusCode).toBe(200);

      const body = res.json() as { data: QuestsGetResponse };

      // Đối chiếu với chính danh mục, không khoá cứng số 11: thêm nhiệm vụ vào `quests.json`
      // không được làm test đỏ.
      expect(body.data.quests.map((q) => q.id).sort()).toEqual(
        activeQuests()
          .map((q) => q.id)
          .sort(),
      );

      expect(body.data.streak.childId).toBe(childId);
      // Khoá kỳ là DẪN XUẤT từ đồng hồ, nên kiểm ĐỊNH DẠNG (và tính đúng đắn của chính hàm sinh
      // khoá ở `lib/time.ts`), không so với một chuỗi cứng sẽ hỏng vào tuần sau.
      expect(body.data.periodKeys.daily).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(body.data.periodKeys.weekly).toMatch(/^\d{4}-W\d{2}$/);
      expect(body.data.periodKeys.weekly).toBe(weeklyPeriodKey(new Date()));
    });

    it('⚠️ KHÔNG ghi gì vào DB — mở màn hình Nhiệm vụ không được làm đổi dữ liệu', async () => {
      const db = getDb();
      const tables = ['quest_progress', 'daily_stats', 'wallet', 'xp_state', 'streak_state', 'badge_earned'];
      const before = Object.fromEntries(tables.map((t) => [t, countRows(db, t)]));

      // Gọi NHIỀU lần như một bé mở/đóng màn hình liên tục.
      for (let i = 0; i < 3; i += 1) {
        const res = await getQuests(cookie, childId);
        expect(res.statusCode).toBe(200);
      }

      const after = Object.fromEntries(tables.map((t) => [t, countRows(db, t)]));
      expect(after).toEqual(before);
      // Và cụ thể: chưa có hàng tiến độ nhiệm vụ nào được sinh ra.
      expect(countRows(db, 'quest_progress')).toBe(0);
    });

    it('bé mới: chưa nhận thưởng nhiệm vụ nào, và nhiệm vụ "bước đầu tiên" chưa xong', async () => {
      const body = (await getQuests(cookie, childId)).json() as { data: QuestsGetResponse };

      expect(body.data.quests.every((q) => q.claimed === false)).toBe(true);

      const firstStep = questById(body, 'qm-01');
      expect(firstStep).toMatchObject({ progress: 0, target: 1, completed: false });

      // `qm-03` (`reach_level 3`) là ngoại lệ có chủ ý: `progress` = CẤP HIỆN TẠI = 1.
      const reachLevel = questById(body, 'qm-03');
      expect(reachLevel).toMatchObject({ progress: 1, target: 3, completed: false });
    });

    it('bài z1 đã xong (ghi bởi luồng khác) ⇒ GET thấy qm-01 XONG mà không cần sự kiện nào', async () => {
      markLessonCompleted(getDb(), childId, 'at-the-zoo/z1');

      const body = (await getQuests(cookie, childId)).json() as { data: QuestsGetResponse };

      // Đây là bằng chứng cho luật "tiến độ SUY DIỄN": không có hàng `quest_progress` nào cả
      // (xem test trên), mà trạng thái vẫn đúng. Nếu `readForChild` đọc thẳng hàng thay vì lấy
      // `max(hàng, giá trị suy diễn)`, chỗ này sẽ trả `completed: false` và bé thấy nhiệm vụ
      // mình đã làm xong vẫn bị khoá.
      expect(countRows(getDb(), 'quest_progress')).toBe(0);
      expect(questById(body, 'qm-01')).toMatchObject({ progress: 1, target: 1, completed: true });
    });
  });

  // ===========================================================================
  describe('POST /quests/:questId/claim', () => {
    it('questId không có trong danh mục ⇒ 404 QUEST_NOT_FOUND', async () => {
      const res = await claimQuest(cookie, childId, 'khong-co-nhiem-vu-nay');

      expect(res.statusCode).toBe(404);
      // Khác hẳn `QUEST_NOT_COMPLETE`: đây là lỗi lập trình/URL sai, KHÔNG phải "bé chưa làm xong".
      // Gộp hai thứ này sẽ biến một bug thành một lời trách bé.
      expect((res.json() as { error: { code: string } }).error.code).toBe('QUEST_NOT_FOUND');
    });

    it('nhiệm vụ chưa hoàn thành ⇒ 409 QUEST_NOT_COMPLETE và không trao gì', async () => {
      const res = await claimQuest(cookie, childId, 'qm-01');

      expect(res.statusCode).toBe(409);
      expect((res.json() as { error: { code: string } }).error.code).toBe('QUEST_NOT_COMPLETE');
      expect(countRows(getDb(), 'daily_stats')).toBe(0);
      const wallet = getDb()
        .prepare('SELECT stars FROM wallet WHERE child_id = ?')
        .get(childId) as { stars: number } | undefined;
      expect(wallet?.stars ?? 0).toBe(0);
    });

    it('nhận thành công ⇒ 200, đánh dấu đã nhận, ví +20 ⭐, huy hiệu bước đầu tiên', async () => {
      markLessonCompleted(getDb(), childId, 'at-the-zoo/z1');

      const res = await claimQuest(cookie, childId, 'qm-01');

      expect(res.statusCode).toBe(200);
      const { data } = res.json() as { data: ClaimQuestResponse };

      expect(data.quest.id).toBe('qm-01');
      expect(data.quest).toMatchObject({ completed: true, claimed: true, progress: 1, target: 1 });
      // `qm-01` thưởng 20 ⭐ + huy hiệu, KHÔNG thưởng XP ⇒ không vượt cấp.
      expect(data.wallet.stars).toBe(20);
      expect(data.levelUp).toBeNull();
      expect(data.badgesEarned).toEqual(['badge-first-step']);
    });

    it('⚠️ bấm lần hai ⇒ 409 ALREADY_CLAIMED và ví KHÔNG tăng thêm', async () => {
      markLessonCompleted(getDb(), childId, 'at-the-zoo/z1');

      const first = await claimQuest(cookie, childId, 'qm-01');
      expect(first.statusCode).toBe(200);
      const starsAfterFirst = (first.json() as { data: ClaimQuestResponse }).data.wallet.stars;

      const second = await claimQuest(cookie, childId, 'qm-01');

      expect(second.statusCode).toBe(409);
      expect((second.json() as { error: { code: string } }).error.code).toBe('ALREADY_CLAIMED');
      // ⭐ Khẳng định then chốt: mã lỗi đúng KHÔNG chứng minh được là không trao thêm quà.
      //    Cổng phải nằm trong `WHERE` của câu UPDATE, không phải một `if` ở tầng JS.
      const wallet = getDb()
        .prepare('SELECT stars FROM wallet WHERE child_id = ?')
        .get(childId) as { stars: number };
      expect(wallet.stars).toBe(starsAfterFirst);
      expect(wallet.stars).toBe(20);
    });

    it('⚠️ số ⭐ trong ví KHỚP tổng stars_earned của daily_stats (báo cáo phụ huynh không lệch)', async () => {
      const db = getDb();
      markLessonCompleted(db, childId, 'at-the-zoo/z1');

      const res = await claimQuest(cookie, childId, 'qm-01');
      const { data } = res.json() as { data: ClaimQuestResponse };

      // Hai con số nói về CÙNG một thứ: ví là thứ bé thấy, `daily_stats` là nguồn duy nhất của
      // báo cáo phụ huynh. Quên ghi một nguồn quà vào đây là lệch ngay.
      expect(sumDailyStat(db, childId, 'stars_earned')).toBe(data.wallet.stars);
      expect(sumDailyStat(db, childId, 'acorns_earned')).toBe(data.wallet.acorns);
      expect(sumDailyStat(db, childId, 'xp_earned')).toBe(data.xp.xp);
    });

    it('bấm "Nhận thưởng" KHÔNG được tính là hoạt động học', async () => {
      markLessonCompleted(getDb(), childId, 'at-the-zoo/z1');

      const res = await claimQuest(cookie, childId, 'qm-01');
      expect(res.statusCode).toBe(200);

      const db = getDb();
      // Hàng `daily_stats` ở đây có thể toàn số 0 — đó là hệ quả CÓ CHỦ Ý. Nếu nhận quà được
      // tính là "ngày học", bé chỉ cần mở app bấm quà 4 ngày là xong nhiệm vụ tuần
      // "Học 4 ngày trong tuần" mà không học gì.
      expect(sumDailyStat(db, childId, 'questions_answered')).toBe(0);
      expect(sumDailyStat(db, childId, 'words_learned')).toBe(0);
      expect(sumDailyStat(db, childId, 'active_seconds')).toBe(0);

      // Và hàng đó mang NGÀY ĐỊA PHƯƠNG của hôm nay (UTC+7), không phải ngày UTC.
      const row = db
        .prepare('SELECT date FROM daily_stats WHERE child_id = ?')
        .get(childId) as { date: string };
      expect(row.date).toBe(localDateKey(new Date()));
    });

    it('⚠️ quà nhiệm vụ đẩy bé QUA CẤP ⇒ báo cả huy hiệu của cấp, và ví/daily_stats vẫn khớp', async () => {
      const db = getDb();
      // `qd-01` = "Học 1 bài mới" → 10 ⭐ + 20 XP. Đặt XP sát ngưỡng cấp 2 (150).
      seedCounterQuestRow(db, childId, 'qd-01', 1);
      seedXp(db, childId, 145, 1);

      const res = await claimQuest(cookie, childId, 'qd-01');

      expect(res.statusCode).toBe(200);
      const { data } = res.json() as { data: ClaimQuestResponse };

      expect(data.quest.id).toBe('qd-01');
      expect(data.xp.xp).toBe(165);
      expect(data.xp.level).toBe(2);

      // 1) CÓ lên cấp ⇒ client phải mở được `LevelUpOverlay`.
      expect(data.levelUp).not.toBeNull();

      // 2) ⭐ HAI NGUỒN HUY HIỆU: `qd-01` không thưởng huy hiệu nào, nên huy hiệu duy nhất ở đây
      //    đến từ quà của CẤP vừa vượt (`xp-levels.json` → cấp 2 tặng `badge-forest-friend`).
      //    Chỉ lấy `applied.badgeIds` (bỏ `xpGain.rewards`) sẽ trả `[]` — huy hiệu vào sổ đúng
      //    nhưng bé KHÔNG BAO GIỜ được thông báo, và không ai phát hiện vì ví vẫn tăng.
      expect(data.badgesEarned).toEqual(['badge-forest-friend']);

      // 3) Ví nhận CẢ HAI nguồn: 10 ⭐ của nhiệm vụ + 20 ⭐ của cấp 2 = 30.
      expect(data.wallet.stars).toBe(30);

      // 4) Và `daily_stats` phải ghi đúng 30 ⭐ / 20 XP — quên nguồn quà của cấp là lệch ngay.
      expect(sumDailyStat(db, childId, 'stars_earned')).toBe(30);
      expect(sumDailyStat(db, childId, 'xp_earned')).toBe(20);
    });
  });
});
