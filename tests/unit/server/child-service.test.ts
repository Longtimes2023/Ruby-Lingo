// @vitest-environment node
/**
 * Test `server/services/ChildService.ts`.
 *
 * Hai nhóm khẳng định quan trọng nhất:
 *
 *   1. TẠO HỒ SƠ BÉ PHẢI TẠO KÈM ĐỦ 5 BẢNG CON (wallet, xp_state, pet_state, streak_state,
 *      settings). Thiếu một bảng thì lỗi sẽ nổ ra ở một MÀN HÌNH KHÁC hẳn nơi gây ra nó
 *      ("NaN Sao" ở màn hình thưởng), nên rất khó truy. Test này chốt đúng tại nguồn.
 *
 *   2. MỌI THAO TÁC PHẢI KIỂM QUYỀN SỞ HỮU. `childId` do client gửi lên, nên nếu thiếu kiểm
 *      tra thì phụ huynh A đọc/sửa/xoá được hồ sơ bé nhà phụ huynh B chỉ bằng cách đoán id.
 *      Đây là lỗi bảo mật, không phải lỗi tính năng.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { AuthService } from '../../../server/services/AuthService.js';
import { ChildService } from '../../../server/services/ChildService.js';
import { getDb } from '../../../server/db/connection.js';
import { AppError } from '../../../server/plugins/errors.js';
import { CHILD_AGE_MAX, CHILD_AGE_MIN, MAX_CHILDREN_PER_ACCOUNT } from '../../../shared/constants.js';
import { clearAllData, setupTestDb, tablesWithRows } from './helpers/testDb.js';

const auth = new AuthService();
const children = new ChildService();

async function makeParent(email: string): Promise<string> {
  const { parent } = await auth.signup({
    email,
    password: 'matkhau123',
    parentalConsent: true,
  });
  return parent.id;
}

function validChild(overrides: Record<string, unknown> = {}) {
  return { nickname: 'Bin', age: 7, avatarId: 'fox', ...overrides };
}

/**
 * Lấy mã lỗi, quy về ĐÚNG thứ client sẽ nhận qua HTTP.
 *
 * Service tự parse bằng schema dùng chung, nên một input sai có thể ném `ZodError` (chưa
 * tới được `AppError`). Ở tầng HTTP, `plugins/errors.ts` biến `ZodError` thành 400
 * `VALIDATION_FAILED`. Helper này làm y hệt — nếu không, test sẽ thấy một ngoại lệ thô và
 * không nói được client thực sự nhận mã lỗi gì.
 */
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

describe('ChildService', () => {
  beforeAll(() => {
    setupTestDb();
  });

  beforeEach(() => {
    clearAllData(getDb());
  });

  // ===========================================================================
  describe('createChild — tạo kèm đủ 5 bảng con', () => {
    it('tạo ĐỦ 5 bảng con trong cùng một transaction', async () => {
      const parentId = await makeParent('bo@example.com');
      const child = children.createChild(parentId, validChild());

      const db = getDb();
      const wallet = db.prepare('SELECT * FROM wallet WHERE child_id = ?').get(child.id) as
        | { stars: number; acorns: number }
        | undefined;
      const xp = db.prepare('SELECT * FROM xp_state WHERE child_id = ?').get(child.id) as
        | { xp: number; level: number }
        | undefined;
      const pet = db.prepare('SELECT * FROM pet_state WHERE child_id = ?').get(child.id) as
        | { evolution_stage: string; happiness: number }
        | undefined;
      const streak = db.prepare('SELECT * FROM streak_state WHERE child_id = ?').get(child.id) as
        | { current_streak: number; milestones_claimed: string }
        | undefined;
      const settings = db.prepare('SELECT * FROM settings WHERE child_id = ?').get(child.id) as
        | { sound_enabled: number; speech_rate: number }
        | undefined;

      expect(wallet, 'thiếu wallet ⇒ màn hình thưởng sẽ hiện NaN Sao').toBeDefined();
      expect(xp, 'thiếu xp_state ⇒ không hiện được cấp Nhà thám hiểm').toBeDefined();
      expect(pet, 'thiếu pet_state ⇒ màn hình thú cưng trắng').toBeDefined();
      expect(streak, 'thiếu streak_state ⇒ không hiện được chuỗi ngày').toBeDefined();
      expect(settings, 'thiếu settings ⇒ không có tốc độ đọc cho Web Speech').toBeDefined();

      // Giá trị khởi tạo phải KHỚP DEFAULT trong migration — lệch nhau thì cùng một bé sẽ có
      // cấu hình khác nhau tuỳ theo đường tạo hồ sơ.
      expect(wallet).toMatchObject({ stars: 0, acorns: 0 });
      expect(xp).toMatchObject({ xp: 0, level: 1 });
      expect(pet).toMatchObject({
        // ⚠️ `'baby'`, KHÔNG phải `'egg'` (T04): bậc 0 nay là con non. Migration `011` đã siết
        //    CHECK của `evolution_stage` ⇒ ghi `'egg'` sẽ bị DB TỪ CHỐI.
        evolution_stage: 'baby',
        // ⭐ NULL = bé CHƯA chọn con đồng hành. Đây là TÍN HIỆU (màn nhà sẽ mời bé chọn), không
        //   phải dữ liệu thiếu — `ChildService.createChild` cố ý để trống cột này.
        pet_type: null,
        happiness: 3,
      });
      expect(streak).toMatchObject({ current_streak: 0, milestones_claimed: '[]' });
      expect(settings).toMatchObject({ sound_enabled: 1, speech_rate: 0.8 });
    });

    it('trả về DTO đúng hình dạng cho client', async () => {
      const parentId = await makeParent('bo@example.com');
      const child = children.createChild(parentId, validChild({ nickname: '  Bin  ' }));

      expect(child.id.startsWith('chi_')).toBe(true);
      expect(child.nickname).toBe('Bin'); // ⭐ service tự `.trim()` — xem test dưới
      expect(child.age).toBe(7);
      expect(child.avatarId).toBe('fox');
      expect(Number.isNaN(Date.parse(child.createdAt))).toBe(false);
    });

    /**
     * ⭐ CHỐNG HỒI QUY: biệt danh phải được cắt khoảng trắng NGAY TRONG SERVICE.
     *
     * Trước đây service tin rằng route đã parse, nên biệt danh `'  Bin  '` được ghi nguyên
     * vào DB. Test này gọi THẲNG service (bỏ qua route) để chốt rằng chuẩn hoá không phụ
     * thuộc vào việc "mọi người gọi đúng cách".
     */
    it('⭐ tự cắt khoảng trắng của biệt danh dù KHÔNG đi qua route', async () => {
      const parentId = await makeParent('bo@example.com');
      const child = children.createChild(parentId, validChild({ nickname: '  Bin  ' }));

      const stored = getDb()
        .prepare('SELECT nickname FROM child_profile WHERE id = ?')
        .get(child.id) as { nickname: string };
      expect(stored.nickname).toBe('Bin'); // kiểm cả giá trị THẬT trong DB, không chỉ DTO
    });

    it('biệt danh chỉ gồm khoảng trắng ⇒ VALIDATION_FAILED (không tạo bé không tên)', async () => {
      const parentId = await makeParent('bo@example.com');
      expect(codeOf(() => children.createChild(parentId, validChild({ nickname: '   ' })))).toBe(
        'VALIDATION_FAILED',
      );
      expect(children.listChildren(parentId)).toHaveLength(0);
    });

    it('avatar không có trong danh sách ⇒ VALIDATION_FAILED', async () => {
      const parentId = await makeParent('bo@example.com');
      expect(codeOf(() => children.createChild(parentId, validChild({ avatarId: 'rong' })))).toBe(
        'VALIDATION_FAILED',
      );
    });

    it('avatar rỗng cũng bị từ chối (không tạo hồ sơ thiếu bạn đồng hành)', async () => {
      const parentId = await makeParent('bo@example.com');
      expect(codeOf(() => children.createChild(parentId, validChild({ avatarId: '' })))).toBe(
        'VALIDATION_FAILED',
      );
    });

    it(`giới hạn ${MAX_CHILDREN_PER_ACCOUNT} hồ sơ mỗi tài khoản`, async () => {
      const parentId = await makeParent('bo@example.com');
      for (let i = 0; i < MAX_CHILDREN_PER_ACCOUNT; i++) {
        children.createChild(parentId, validChild({ nickname: `Bé ${i}` }));
      }
      expect(children.listChildren(parentId)).toHaveLength(MAX_CHILDREN_PER_ACCOUNT);
      expect(codeOf(() => children.createChild(parentId, validChild({ nickname: 'Bé thừa' })))).toBe(
        'VALIDATION_FAILED',
      );
    });

    it('tạo hồ sơ thất bại ⇒ KHÔNG để lại dữ liệu nửa vời', async () => {
      const parentId = await makeParent('bo@example.com');
      const before = tablesWithRows(getDb());
      expect(() => children.createChild(parentId, validChild({ avatarId: 'rong' }))).toThrow();
      // Kiểm trước cả khi transaction bắt đầu (avatar sai bị chặn sớm), nên không có gì được ghi.
      expect(tablesWithRows(getDb())).toEqual(before);
    });
  });

  // ===========================================================================
  describe('listChildren', () => {
    it('chỉ trả về bé của CHÍNH phụ huynh đó', async () => {
      const parentA = await makeParent('a@example.com');
      const parentB = await makeParent('b@example.com');
      children.createChild(parentA, validChild({ nickname: 'Bé A' }));
      children.createChild(parentB, validChild({ nickname: 'Bé B' }));

      const listA = children.listChildren(parentA);
      expect(listA).toHaveLength(1);
      expect(listA[0]?.nickname).toBe('Bé A');
    });

    it('sắp theo thời điểm tạo — bé tạo trước đứng trước', async () => {
      const parentId = await makeParent('bo@example.com');
      children.createChild(parentId, validChild({ nickname: 'Anh' }));
      children.createChild(parentId, validChild({ nickname: 'Em' }));
      expect(children.listChildren(parentId).map((c) => c.nickname)).toEqual(['Anh', 'Em']);
    });

    it('phụ huynh chưa có bé ⇒ mảng rỗng (không phải null)', async () => {
      const parentId = await makeParent('bo@example.com');
      expect(children.listChildren(parentId)).toEqual([]);
    });
  });

  // ===========================================================================
  describe('⭐ kiểm quyền sở hữu — phụ huynh A không được chạm vào bé nhà B', () => {
    it('getChild của bé nhà người khác ⇒ null (không tiết lộ hồ sơ có tồn tại)', async () => {
      const parentA = await makeParent('a@example.com');
      const parentB = await makeParent('b@example.com');
      const childOfB = children.createChild(parentB, validChild());

      expect(children.getChild(parentA, childOfB.id)).toBeNull();
      // Nhưng chủ sở hữu thật thì vẫn đọc được.
      expect(children.getChild(parentB, childOfB.id)?.id).toBe(childOfB.id);
    });

    it('updateChild của bé nhà người khác ⇒ CHILD_NOT_FOUND, và dữ liệu KHÔNG đổi', async () => {
      const parentA = await makeParent('a@example.com');
      const parentB = await makeParent('b@example.com');
      const childOfB = children.createChild(parentB, validChild({ nickname: 'Bé B' }));

      expect(codeOf(() => children.updateChild(parentA, childOfB.id, { nickname: 'Bị đổi' }))).toBe(
        'CHILD_NOT_FOUND',
      );
      expect(children.getChild(parentB, childOfB.id)?.nickname).toBe('Bé B');
    });

    it('deleteChild của bé nhà người khác ⇒ CHILD_NOT_FOUND, và bé VẪN CÒN', async () => {
      const parentA = await makeParent('a@example.com');
      const parentB = await makeParent('b@example.com');
      const childOfB = children.createChild(parentB, validChild());

      expect(codeOf(() => children.deleteChild(parentA, childOfB.id))).toBe('CHILD_NOT_FOUND');
      expect(children.getChild(parentB, childOfB.id)).not.toBeNull();
    });

    it('id không tồn tại ⇒ CHILD_NOT_FOUND', async () => {
      const parentId = await makeParent('bo@example.com');
      expect(codeOf(() => children.deleteChild(parentId, 'chi_khong-co'))).toBe('CHILD_NOT_FOUND');
    });
  });

  // ===========================================================================
  describe('updateChild', () => {
    it('sửa từng trường riêng lẻ, các trường khác giữ nguyên', async () => {
      const parentId = await makeParent('bo@example.com');
      const child = children.createChild(parentId, validChild());

      const renamed = children.updateChild(parentId, child.id, { nickname: 'Bông' });
      expect(renamed.nickname).toBe('Bông');
      expect(renamed.age).toBe(child.age);
      expect(renamed.avatarId).toBe(child.avatarId);
    });

    it('sửa tuổi và avatar', async () => {
      const parentId = await makeParent('bo@example.com');
      const child = children.createChild(parentId, validChild());
      const updated = children.updateChild(parentId, child.id, { age: 9, avatarId: 'panda' });
      expect(updated.age).toBe(9);
      expect(updated.avatarId).toBe('panda');
    });

    it('avatar không hợp lệ ⇒ VALIDATION_FAILED, dữ liệu không đổi', async () => {
      const parentId = await makeParent('bo@example.com');
      const child = children.createChild(parentId, validChild());
      expect(codeOf(() => children.updateChild(parentId, child.id, { avatarId: 'rong' }))).toBe(
        'VALIDATION_FAILED',
      );
      expect(children.getChild(parentId, child.id)?.avatarId).toBe('fox');
    });
  });

  // ===========================================================================
  describe('deleteChild — xoá là xoá THẬT, và dọn sạch mọi bảng con', () => {
    it('xoá hồ sơ bé ⇒ mọi bảng con bị dọn theo (ON DELETE CASCADE)', async () => {
      const parentId = await makeParent('bo@example.com');
      const child = children.createChild(parentId, validChild());

      // Trước khi xoá: các bảng con phải có dữ liệu (nếu không, test này vô nghĩa).
      const db = getDb();
      expect(
        (db.prepare('SELECT COUNT(*) AS n FROM wallet WHERE child_id = ?').get(child.id) as {
          n: number;
        }).n,
      ).toBe(1);

      children.deleteChild(parentId, child.id);

      for (const table of ['wallet', 'xp_state', 'pet_state', 'streak_state', 'settings']) {
        const n = (
          db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE child_id = ?`).get(child.id) as {
            n: number;
          }
        ).n;
        expect(n, `${table} chưa được dọn theo ⇒ dữ liệu rác tồn tại vĩnh viễn`).toBe(0);
      }
      expect(children.getChild(parentId, child.id)).toBeNull();
    });

    it('xoá tài khoản phụ huynh ⇒ dọn sạch cả bé lẫn mọi bảng con', async () => {
      const parentId = await makeParent('bo@example.com');
      children.createChild(parentId, validChild());

      getDb().prepare('DELETE FROM parent_account WHERE id = ?').run(parentId);

      expect(tablesWithRows(getDb()), 'còn dữ liệu rò rỉ sau khi xoá tài khoản').toEqual([]);
    });
  });

  // ===========================================================================
  describe('tuổi hợp lệ (biên)', () => {
    it(`tuổi ${CHILD_AGE_MIN} và ${CHILD_AGE_MAX} đều tạo được`, async () => {
      const parentId = await makeParent('bo@example.com');
      expect(children.createChild(parentId, validChild({ age: CHILD_AGE_MIN })).age).toBe(
        CHILD_AGE_MIN,
      );
      expect(children.createChild(parentId, validChild({ age: CHILD_AGE_MAX })).age).toBe(
        CHILD_AGE_MAX,
      );
    });
  });
});
