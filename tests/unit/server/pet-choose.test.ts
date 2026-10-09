// @vitest-environment node
/**
 * Test T04 — BÉ CHỌN (VÀ ĐỔI) CON THÚ CƯNG ĐỒNG HÀNH.
 *
 * ⭐ ĐIỂM SỐ 2 CHỦ DỰ ÁN BÁO: *"Thú cưng không cho các bé chọn à, mặc định là trứng"*.
 *   File này khoá lại hai điều đã sửa:
 *     1. KHÔNG còn quả trứng 🥚 — bậc 0 nay là `'baby'`, và bé CHỌN con mình muốn.
 *     2. Đổi bạn đồng hành là **MIỄN PHÍ · KHÔNG GIỚI HẠN · KHÔNG MẤT GÌ**.
 *
 * ⚠️⚠️ LUẬT CHI PHỐI FILE NÀY — "KHÔNG BAO GIỜ LẤY THỨ GÌ CỦA BÉ MÀ KHÔNG ĐỔI LẠI ĐƯỢC GÌ":
 *   Một thao tác *đổi hình* mà lại trừ ⭐, hoặc làm rơi mất chiếc nón bé đã mua, sẽ là một cú
 *   lấy-đồ sau lưng bé — và bé 7 tuổi không có cách nào hiểu chuyện gì vừa xảy ra. Vì vậy nhóm
 *   test "KHÔNG ĐỤNG VÍ / TÚI ĐỒ / ❤️" dưới đây là nhóm QUAN TRỌNG NHẤT.
 *
 * ⚠️ VÌ SAO PHẢI CHẠY MIGRATION `011` TRÊN MỘT DB RIÊNG (nhóm đầu tiên):
 *   `setupTestDb()` áp DỤNG HẾT migration rồi mới trả DB — nghĩa là trên DB đó, `011` đã chạy
 *   xong và KHÔNG còn hàng nào ở `'egg'` để mà kiểm việc DỊCH dữ liệu. Muốn chứng minh "hàng cũ
 *   `egg` ⇒ `baby`, không mất gì", ta phải tự dựng một DB dừng ở `010`, gieo dữ liệu cũ, RỒI mới
 *   chạy `011`. Đây là cách duy nhất kiểm được phần `INSERT … SELECT … CASE` của migration —
 *   thứ mà một lần `npm run migrate` trên DB sạch không bao giờ chạm tới.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import type { LightMyRequestResponse } from 'fastify';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { buildApp, type AppInstance } from '../../../server/app.js';
import { config } from '../../../server/config.js';
import { getDb, transaction } from '../../../server/db/connection.js';
import { AppError } from '../../../server/plugins/errors.js';
import { AuthService } from '../../../server/services/AuthService.js';
import { ChildService } from '../../../server/services/ChildService.js';
import { RewardService } from '../../../server/services/RewardService.js';
import { DEFAULT_PET_ID, PET_DEFINITIONS } from '../../../shared/content/pets.js';
import type { PetState } from '../../../shared/types/reward.js';
import { clearAllData, setupTestDb } from './helpers/testDb.js';

const auth = new AuthService();
const children = new ChildService();
const rewards = new RewardService();

async function makeParent(email: string): Promise<string> {
  const { parent } = await auth.signup({ email, password: 'matkhau123', parentalConsent: true });
  return parent.id;
}

function makeChild(parentId: string, nickname = 'Bin'): string {
  return children.createChild(parentId, { nickname, age: 7, avatarId: 'fox' }).id;
}

/**
 * Nạp tiền cho bé — ĐI QUA CHÍNH service, không viết SQL tay (cùng lý do như `reward-service.test.ts`:
 * dựng ví bằng một đường không dùng code đang được kiểm là dựng một cái ví giả).
 */
function fund(childId: string, amount: { stars?: number; acorns?: number }): void {
  transaction((db) => {
    rewards.applyGrantsInTx(db, childId, amount, new Date().toISOString());
  });
}

/** Mã lỗi quy về ĐÚNG thứ client nhận qua HTTP. */
function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    if (err instanceof AppError) return err.code;
    if (err instanceof ZodError) return 'VALIDATION_FAILED';
    throw err;
  }
  throw new Error('Lẽ ra phải ném lỗi nhưng đã thành công');
}

/** Trường lỗi (để client tô đỏ đúng ô) — `undefined` nếu lỗi không mang `fields`. */
function fieldsOf(fn: () => unknown): Record<string, string> | undefined {
  try {
    fn();
  } catch (err) {
    if (err instanceof AppError) return err.fields;
    return undefined;
  }
  throw new Error('Lẽ ra phải ném lỗi nhưng đã thành công');
}

function petRowOf(childId: string): { pet_type: string | null; happiness: number } | undefined {
  return getDb()
    .prepare('SELECT pet_type, happiness FROM pet_state WHERE child_id = ?')
    .get(childId) as { pet_type: string | null; happiness: number } | undefined;
}

function walletOf(childId: string): { stars: number; acorns: number } {
  return getDb()
    .prepare('SELECT stars, acorns FROM wallet WHERE child_id = ?')
    .get(childId) as { stars: number; acorns: number };
}

/** id những món đang mặc, đọc THẲNG từ bảng — không tin response. */
function equippedIds(childId: string): string[] {
  const rows = getDb()
    .prepare('SELECT item_id FROM inventory WHERE child_id = ? AND equipped = 1')
    .all(childId) as { item_id: string }[];
  return rows.map((r) => r.item_id);
}

// =============================================================================
// 1. MIGRATION `011` — DỊCH DỮ LIỆU CŨ (`egg` → `baby`), KHÔNG MẤT GÌ
// =============================================================================

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../server/db/migrations');
const MIGRATION_011 = '011_pet_type.sql';

/** Mọi file migration, theo thứ tự TÊN (đánh số 3 chữ số nên sort chuỗi là đúng thứ tự). */
function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/** DB trong bộ nhớ đã áp dụng `001`–`010` — tức TRẠNG THÁI TRƯỚC T04. */
function openDbBefore011(): Database.Database {
  const db = new Database(':memory:');
  // Cùng thiết lập như `server/db/connection.ts` — migration `011` dựa vào việc FK được bật.
  db.pragma('foreign_keys = ON');
  for (const file of migrationFiles()) {
    if (file >= MIGRATION_011) continue;
    db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  return db;
}

/**
 * Gieo một bé ĐÚNG NHƯ BẢN DEPLOY CŨ TẠO RA: `evolution_stage = 'egg'`, không có `pet_type`
 * (cột đó chưa tồn tại), và CÓ dữ liệu quý phải sống sót qua migration (❤️, đồ đang mặc).
 */
function seedLegacyEggChild(db: Database.Database): string {
  const now = '2026-01-01T00:00:00.000Z';
  db.prepare(
    `INSERT INTO parent_account
       (id, email, password_hash, consent_policy_version, consented_at, created_at, updated_at)
     VALUES ('par_old', 'cu@example.com', 'x', 'v1', ?, ?, ?)`,
  ).run(now, now, now);
  db.prepare(
    `INSERT INTO child_profile (id, parent_id, nickname, age, avatar_id, created_at, updated_at)
     VALUES ('chi_old', 'par_old', 'Na', 7, 'rabbit', ?, ?)`,
  ).run(now, now);
  db.prepare(
    `INSERT INTO pet_state (child_id, evolution_stage, happiness, equipped_item_ids, last_fed_at, updated_at)
     VALUES ('chi_old', 'egg', 4, '["acc-crown"]', ?, ?)`,
  ).run(now, now);
  return 'chi_old';
}

describe('migration 011 — dựng lại `pet_state`', () => {
  it('DỊCH mọi hàng đang ở `egg` thành `baby` (bậc 0 mới)', () => {
    const db = openDbBefore011();
    seedLegacyEggChild(db);

    // Trước: đúng trạng thái bản deploy cũ để lại.
    const before = db
      .prepare('SELECT evolution_stage FROM pet_state WHERE child_id = ?')
      .get('chi_old') as { evolution_stage: string };
    expect(before.evolution_stage).toBe('egg');

    db.exec(readFileSync(join(MIGRATIONS_DIR, MIGRATION_011), 'utf8'));

    const after = db
      .prepare('SELECT evolution_stage FROM pet_state WHERE child_id = ?')
      .get('chi_old') as { evolution_stage: string };
    expect(after.evolution_stage).toBe('baby');
  });

  it('KHÔNG MẤT GÌ: ❤️ và đồ đang mặc sống sót qua lần dựng lại bảng', () => {
    const db = openDbBefore011();
    seedLegacyEggChild(db);
    db.exec(readFileSync(join(MIGRATIONS_DIR, MIGRATION_011), 'utf8'));

    const row = db
      .prepare('SELECT happiness, equipped_item_ids FROM pet_state WHERE child_id = ?')
      .get('chi_old') as { happiness: number; equipped_item_ids: string };
    // ⚠️ Đây là lý do migration phải COPY dữ liệu chứ không chỉ `ADD COLUMN`: `DROP TABLE` +
    //    `RENAME` mà quên `INSERT … SELECT` là xoá sạch ví đồ của mọi bé đang dùng.
    expect(row.happiness).toBe(4);
    expect(row.equipped_item_ids).toBe('["acc-crown"]');
  });

  it('hàng cũ nhận `pet_type = NULL` — bé CŨ hiển thị mặc định Momo, không bị đổi con', () => {
    const db = openDbBefore011();
    seedLegacyEggChild(db);
    db.exec(readFileSync(join(MIGRATIONS_DIR, MIGRATION_011), 'utf8'));

    const row = db.prepare('SELECT pet_type FROM pet_state WHERE child_id = ?').get('chi_old') as {
      pet_type: string | null;
    };
    expect(row.pet_type).toBeNull();
  });

  it('CHECK mới TỪ CHỐI ghi `egg` trở lại cột `evolution_stage`', () => {
    const db = openDbBefore011();
    seedLegacyEggChild(db);
    db.exec(readFileSync(join(MIGRATIONS_DIR, MIGRATION_011), 'utf8'));

    // Nếu CHECK không được siết, một đường code cũ sót lại (hoặc một script sửa tay) sẽ âm thầm
    // đưa `'egg'` trở lại — và `PetAvatar` lại vẽ quả trứng cho bé vừa chọn Rồng.
    expect(() =>
      db.prepare('UPDATE pet_state SET evolution_stage = ? WHERE child_id = ?').run('egg', 'chi_old'),
    ).toThrow();
  });

  it('`pet_type` KHÔNG có CHECK enum: ghi id lạ vẫn được (danh mục là DỮ LIỆU, không phải mã)', () => {
    const db = openDbBefore011();
    seedLegacyEggChild(db);
    db.exec(readFileSync(join(MIGRATIONS_DIR, MIGRATION_011), 'utf8'));

    // ⭐ Đây là chủ ý: "có những con nào" nằm ở `shared/content/pets.json`. Nếu CHECK cứng ở đây,
    //   mỗi lần thêm một con mới phải viết một migration để nới CHECK — và bản deploy cũ sẽ TỪ
    //   CHỐI lưu con mới. Tầng đọc phân giải id lạ về mặc định; tầng ghi (`choosePet`) chỉ nhận
    //   id có thật. Hai tầng, hai trách nhiệm.
    expect(() =>
      db
        .prepare('UPDATE pet_state SET pet_type = ? WHERE child_id = ?')
        .run('rong-lua-tuong-lai', 'chi_old'),
    ).not.toThrow();
  });

  it('bảng `child_profile` không bị ảnh hưởng (không bảng nào tham chiếu `pet_state`)', () => {
    const db = openDbBefore011();
    seedLegacyEggChild(db);
    db.exec(readFileSync(join(MIGRATIONS_DIR, MIGRATION_011), 'utf8'));

    const child = db.prepare('SELECT nickname FROM child_profile WHERE id = ?').get('chi_old') as {
      nickname: string;
    };
    expect(child.nickname).toBe('Na');
  });
});

// =============================================================================
// 2. `RewardService.choosePet` — MIỄN PHÍ, KHÔNG MẤT GÌ
// =============================================================================

describe('RewardService.choosePet', () => {
  beforeAll(() => {
    setupTestDb();
  });

  beforeEach(() => {
    clearAllData(getDb());
  });

  it('bé mới toanh CHƯA chọn: `petType` = mặc định Momo, `petChosen` = false', async () => {
    const parentId = await makeParent('bo@example.com');
    const childId = makeChild(parentId);

    const pet = rewards.readPet(getDb(), childId);
    // Hai giá trị trả lời HAI câu hỏi khác nhau — xem ghi chú ở `readPet`.
    expect(pet.petType).toBe(DEFAULT_PET_ID);
    expect(pet.petChosen).toBe(false);
    expect(petRowOf(childId)?.pet_type).toBeNull();
  });

  it('chọn một con ⇒ lưu vào DB và trả về TRẠNG THÁI NHÌN THẤY ĐƯỢC', async () => {
    const parentId = await makeParent('bo@example.com');
    const childId = makeChild(parentId);

    const pet = rewards.choosePet(parentId, childId, { petType: 'cat' });

    expect(pet.petType).toBe('cat');
    expect(pet.petChosen).toBe(true);
    expect(petRowOf(childId)?.pet_type).toBe('cat');

    // ⚠️ Phải là `readPet`, KHÔNG phải `{ petType: input.petType }`: thiếu `evolutionStage`/
    //    `happiness`/`equippedItemIds` là mở đường cho hai hình dạng `PetState` lệch nhau.
    expect(pet).toEqual(rewards.readPet(getDb(), childId));
    expect(typeof pet.evolutionStage).toBe('string');
    expect(typeof pet.wordsLearned).toBe('number');
    expect(Array.isArray(pet.equippedItemIds)).toBe(true);
  });

  it('mọi con trong danh mục đều chọn được', async () => {
    const parentId = await makeParent('bo@example.com');
    const childId = makeChild(parentId);

    for (const definition of PET_DEFINITIONS) {
      const pet = rewards.choosePet(parentId, childId, { petType: definition.id });
      expect(pet.petType, `không chọn được "${definition.id}"`).toBe(definition.id);
    }
  });

  it('⚠️ id KHÔNG có trong danh mục ⇒ VALIDATION_FAILED kèm `fields.petType`', async () => {
    const parentId = await makeParent('bo@example.com');
    const childId = makeChild(parentId);

    expect(codeOf(() => rewards.choosePet(parentId, childId, { petType: 'khong-co-con-nay' }))).toBe(
      'VALIDATION_FAILED',
    );
    // `fields.petType` là thứ màn chọn dùng để tô đỏ ĐÚNG ô — thiếu nó, bé chỉ thấy một câu lỗi
    // chung chung mà không biết bấm lại vào đâu.
    expect(fieldsOf(() => rewards.choosePet(parentId, childId, { petType: 'khong-co' }))).toMatchObject({
      petType: expect.any(String),
    });
    // Và KHÔNG được ghi id rác xuống DB.
    expect(petRowOf(childId)?.pet_type).toBeNull();
  });

  it('body rỗng / thiếu `petType` ⇒ bị từ chối', async () => {
    const parentId = await makeParent('bo@example.com');
    const childId = makeChild(parentId);

    expect(codeOf(() => rewards.choosePet(parentId, childId, {}))).toBe('VALIDATION_FAILED');
    expect(codeOf(() => rewards.choosePet(parentId, childId, { petType: '   ' }))).toBe(
      'VALIDATION_FAILED',
    );
  });

  it('⭐⭐ KHÔNG ĐỤNG VÍ · TÚI ĐỒ · ❤️ — đổi bạn đồng hành là ĐỔI HÌNH, không phải giao dịch', async () => {
    const parentId = await makeParent('bo@example.com');
    const childId = makeChild(parentId);
    // ⚠️ Nạp CẢ HAI loại tiền: `acc-crown` có giá 10 🌰 (`currency: "acorns"`), không phải ⭐.
    //    Nạp mỗi ⭐ thì `buy` ném INSUFFICIENT_FUNDS và test đỏ vì lý do chẳng liên quan gì tới
    //    thứ đang được kiểm.
    fund(childId, { stars: 100, acorns: 100 });

    // Mua một món THẬT rồi mặc lên — để phép kiểm có thứ gì đó để mà mất.
    rewards.buy(parentId, childId, { itemId: 'acc-crown' });
    rewards.equip(parentId, childId, 'acc-crown', { equipped: true });

    const walletBefore = walletOf(childId);
    const equippedBefore = equippedIds(childId);
    const happinessBefore = petRowOf(childId)?.happiness;

    rewards.choosePet(parentId, childId, { petType: 'dragon' });

    expect(walletOf(childId)).toEqual(walletBefore);
    expect(equippedIds(childId)).toEqual(equippedBefore);
    expect(petRowOf(childId)?.happiness).toBe(happinessBefore);
    // Đồ vẫn thuộc về BÉ, không thuộc về con vật: nếu phụ kiện gắn với con thú cưng thì đổi con
    // là "lấy mất đồ của bé" — đúng thứ luật kinh tế của dự án cấm.
    expect(equippedIds(childId)).toContain('acc-crown');
  });

  it('đổi con BAO NHIÊU LẦN CŨNG ĐƯỢC (không giới hạn, không phí)', async () => {
    const parentId = await makeParent('bo@example.com');
    const childId = makeChild(parentId);

    for (let i = 0; i < 5; i += 1) {
      rewards.choosePet(parentId, childId, { petType: 'cat' });
      rewards.choosePet(parentId, childId, { petType: 'dog' });
    }

    expect(petRowOf(childId)?.pet_type).toBe('dog');
    // Ví chưa từng được tạo ⇒ vẫn 0/0 nghĩa là không có đồng nào bị trừ.
    expect(walletOf(childId)).toMatchObject({ stars: 0, acorns: 0 });
  });

  it('`pet_type` LẠ trong DB (bản deploy khác) ⇒ rơi về mặc định, KHÔNG ném', async () => {
    const parentId = await makeParent('bo@example.com');
    const childId = makeChild(parentId);

    // Đúng loại dữ liệu mà một con vừa bị xoá khỏi `pets.json`, hoặc một DB phục hồi từ sao lưu
    // của phiên bản khác, để lại. Ném ở đây là màn của bé TRẮNG vì một con thú cưng không còn
    // tồn tại — hỏng một thứ phụ mà kéo cả app xuống.
    getDb()
      .prepare('UPDATE pet_state SET pet_type = ? WHERE child_id = ?')
      .run('con-cua-ban-deploy-khac', childId);

    const pet = rewards.readPet(getDb(), childId);
    expect(pet.petType).toBe(DEFAULT_PET_ID);
    // ⚠️ Vẫn là `true`: bé ĐÃ từng chọn (cột có giá trị), chỉ là con đó nay không còn. Đây là
    //    khác biệt giữa "chưa chọn" và "chọn một con đã biến mất" — gộp hai thứ này lại là mời
    //    bé chọn lại mãi mãi.
    expect(pet.petChosen).toBe(true);
  });

  it('hàng `pet_state` bị xoá ⇒ vẫn trả về một con có thật, KHÔNG ném', async () => {
    const parentId = await makeParent('bo@example.com');
    const childId = makeChild(parentId);
    getDb().prepare('DELETE FROM pet_state WHERE child_id = ?').run(childId);

    const pet = rewards.readPet(getDb(), childId);
    expect(pet.petType).toBe(DEFAULT_PET_ID);
    expect(pet.petChosen).toBe(false);
  });

  it('⚠️ bé nhà phụ huynh khác ⇒ CHILD_NOT_FOUND', async () => {
    const parentA = await makeParent('a@example.com');
    const parentB = await makeParent('b@example.com');
    const childOfB = makeChild(parentB);

    expect(codeOf(() => rewards.choosePet(parentA, childOfB, { petType: 'cat' }))).toBe(
      'CHILD_NOT_FOUND',
    );
    expect(petRowOf(childOfB)?.pet_type).toBeNull();
  });
});

// =============================================================================
// 3. TẦNG HTTP — `POST /api/children/:id/pet/type`
// =============================================================================

const PASSWORD = 'matkhau123';

let app: AppInstance;

function sessionCookieOf(res: LightMyRequestResponse): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = list.find((c) => c.startsWith(`${config.cookie.name}=`));
  if (!found) throw new Error('Response không đặt cookie phiên — plugin bị đóng gói?');
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

async function createChildViaHttp(cookie: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/children',
    headers: { cookie },
    payload: { nickname: 'Bông', age: 7, avatarId: 'panda' },
  });
  expect(res.statusCode, res.body).toBe(201);
  return (res.json() as { data: { child: { id: string } } }).data.child.id;
}

function postPetType(
  cookie: string | null,
  childId: string,
  payload: object,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url: `/api/children/${childId}/pet/type`,
    ...(cookie ? { headers: { cookie } } : {}),
    payload,
  });
}

describe('API `/pet/type` — tầng HTTP', () => {
  beforeAll(async () => {
    setupTestDb();
    app = await buildApp();
    await app.ready();
  });

  beforeEach(() => {
    clearAllData(getDb());
  });

  it('chưa đăng nhập ⇒ 401 (plugin auth được bọc đúng)', async () => {
    const res = await postPetType(null, 'chi_bat_ky', { petType: 'cat' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
  });

  it('đổi con ⇒ 200 + `PetState` mới, và DB đã đổi theo', async () => {
    const cookie = await signup('bo@example.com');
    const childId = await createChildViaHttp(cookie);

    const res = await postPetType(cookie, childId, { petType: 'tiger' });

    expect(res.statusCode, res.body).toBe(200);
    const pet = (res.json() as { data: PetState }).data;
    expect(pet.petType).toBe('tiger');
    expect(pet.petChosen).toBe(true);
    expect(petRowOf(childId)?.pet_type).toBe('tiger');
  });

  it('id lạ ⇒ 400 `VALIDATION_FAILED` + `fields.petType` (client tô đỏ được đúng ô)', async () => {
    const cookie = await signup('bo@example.com');
    const childId = await createChildViaHttp(cookie);

    const res = await postPetType(cookie, childId, { petType: 'khong-co' });

    expect(res.statusCode, res.body).toBe(400);
    const body = res.json() as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.fields).toMatchObject({ petType: expect.any(String) });
  });

  it('⚠️ client gửi kèm `price` ⇒ BỊ BỎ QUA HOÀN TOÀN (không có giá để mà nói dối)', async () => {
    const cookie = await signup('bo@example.com');
    const childId = await createChildViaHttp(cookie);

    const res = await postPetType(cookie, childId, { petType: 'cat', price: 0, stars: 999 });

    expect(res.statusCode, res.body).toBe(200);
    // `z.object` mặc định cắt khoá lạ ⇒ hai khoá kia không tới được service. Và kể cả có tới,
    // `choosePet` cũng không đọc chúng: đổi bạn đồng hành là MIỄN PHÍ.
    expect((res.json() as { data: PetState }).data.petType).toBe('cat');
    expect(walletOf(childId)).toMatchObject({ stars: 0, acorns: 0 });
  });

  it('bé nhà phụ huynh khác ⇒ 404 `CHILD_NOT_FOUND`', async () => {
    const cookieA = await signup('a@example.com');
    const cookieB = await signup('b@example.com');
    const childOfB = await createChildViaHttp(cookieB);

    const res = await postPetType(cookieA, childOfB, { petType: 'cat' });

    expect(res.statusCode, res.body).toBe(404);
    expect(res.json()).toMatchObject({ error: { code: 'CHILD_NOT_FOUND' } });
    expect(petRowOf(childOfB)?.pet_type).toBeNull();
  });

  it('`GET /rewards` phản ánh con vừa chọn (một nguồn sự thật, không cache lệch)', async () => {
    const cookie = await signup('bo@example.com');
    const childId = await createChildViaHttp(cookie);
    await postPetType(cookie, childId, { petType: 'pig' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/children/${childId}/rewards`,
      headers: { cookie },
    });

    expect(res.statusCode, res.body).toBe(200);
    const pet = (res.json() as { data: { pet: PetState } }).data.pet;
    expect(pet.petType).toBe('pig');
    expect(pet.petChosen).toBe(true);
  });
});
