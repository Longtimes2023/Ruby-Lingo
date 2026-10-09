// @vitest-environment node
/**
 * Test TẦNG HTTP cho các route thưởng (T052 · T062): `GET /rewards`, `POST /shop/buy`,
 * `POST /pet/feed`, `POST /inventory/:itemId/equip`.
 *
 * ⭐ VÌ SAO PHẢI LÀ TEST HTTP, KHÔNG CHỈ TEST SERVICE:
 *   `reward-service.test.ts` đã chứng minh phần KINH TẾ (không âm, không mất đồ). File này
 *   chứng minh ba thứ CHỈ hỏng khi đi qua Fastify thật:
 *     • `preHandler: requireParent` — nếu plugin auth bị đóng gói sai (thiếu `fastify-plugin`)
 *       thì `req.parent` luôn `null` ⇒ MỌI request 401, và unit test gọi service trực tiếp
 *       KHÔNG BAO GIỜ bắt được. Lỗi này đã từng xảy ra trong dự án.
 *     • Quyền sở hữu trên `:id` trong URL — phụ huynh A tiêu tiền của bé nhà B.
 *     • Hình dạng lỗi: client dựa vào `error.code` để dịch câu tiếng Việt cho bé/phụ huynh.
 *       Lỗi rơi vào handler mặc định của Fastify thì `code` biến mất.
 *
 * ⚠️ TEST QUAN TRỌNG NHẤT TRONG FILE: "GIÁ DO CLIENT GỬI LÊN BỊ BỎ QUA HOÀN TOÀN".
 *    Client chỉ được nói MUA MÓN GÌ, không được nói TRẢ BAO NHIÊU. Nếu trường `price` lọt vào
 *    hợp đồng, một bé 9 tuổi biết mở DevTools mua được vương miện với 1 ⭐ — và vì ví là CỘNG
 *    DỒN, số dư sai đó ở lại vĩnh viễn, không cách nào phân biệt với một bé thật sự đã kiếm
 *    được ngần ấy tiền.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';

import { buildApp, type AppInstance } from '../../../server/app.js';
import { config } from '../../../server/config.js';
import { getDb } from '../../../server/db/connection.js';
import { getShopItem } from '../../../shared/content/shop.js';
import type {
  EquipmentResult,
  FeedResult,
  PurchaseResult,
  RewardSnapshot,
} from '../../../shared/types/reward.js';
import { clearAllData, setupTestDb } from './helpers/testDb.js';

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

async function signup(email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email, password: PASSWORD, parentalConsent: true },
  });
  expect(res.statusCode, res.body).toBe(201);
  return sessionCookieOf(res);
}

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
 * Nạp tiền cho bé bằng SQL trực tiếp.
 *
 * ⚠️ Ở TẦNG HTTP KHÔNG CÓ ENDPOINT NÀO NẠP TIỀN, và đó là điều ĐÚNG — ví chỉ vào tiền qua
 *    thưởng do server tự tính. Nên test phải dựng trạng thái đó ở tầng DB. Đây là bước
 *    "arrange" thuần tuý, không phải đang kiểm code nào.
 */
function fund(childId: string, stars: number, acorns = 0): void {
  getDb()
    .prepare('UPDATE wallet SET stars = ?, acorns = ? WHERE child_id = ?')
    .run(stars, acorns, childId);
}

function post(
  cookie: string | null,
  url: string,
  payload: object,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url,
    ...(cookie ? { headers: { cookie } } : {}),
    payload,
  });
}

function inventoryRow(
  childId: string,
  itemId: string,
): { quantity: number; equipped: number } | undefined {
  return getDb()
    .prepare('SELECT quantity, equipped FROM inventory WHERE child_id = ? AND item_id = ?')
    .get(childId, itemId) as { quantity: number; equipped: number } | undefined;
}

/** id những món đang mặc, đọc THẲNG từ bảng — không tin response. */
function equippedIds(childId: string): string[] {
  const rows = getDb()
    .prepare('SELECT item_id FROM inventory WHERE child_id = ? AND equipped = 1')
    .all(childId) as { item_id: string }[];
  return rows.map((r) => r.item_id);
}

describe('API thưởng — tầng HTTP', () => {
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
    it('từ chối GET rewards khi chưa đăng nhập', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/children/chi_bat_ky/rewards' });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
    });

    it('từ chối POST shop/buy khi chưa đăng nhập', async () => {
      const res = await post(null, '/api/children/chi_bat_ky/shop/buy', { itemId: 'food-banana' });
      expect(res.statusCode).toBe(401);
    });

    it('từ chối POST pet/feed khi chưa đăng nhập', async () => {
      const res = await post(null, '/api/children/chi_bat_ky/pet/feed', { itemId: 'food-banana' });
      expect(res.statusCode).toBe(401);
    });
  });

  // ===========================================================================
  describe('quyền sở hữu', () => {
    /**
     * ⭐ Trả 404 (không phải 403) là CÓ CHỦ ĐÍCH: 403 sẽ xác nhận "hồ sơ này có tồn tại", tức
     *    là rò rỉ thông tin về bé nhà người khác.
     */
    it('KHÔNG đọc được ví của bé nhà phụ huynh khác', async () => {
      const cookieA = await signup('a@example.com');
      const childA = await createChild(cookieA);
      const cookieB = await signup('b@example.com');

      const res = await app.inject({
        method: 'GET',
        url: `/api/children/${childA}/rewards`,
        headers: { cookie: cookieB },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: { code: 'CHILD_NOT_FOUND' } });
    });

    it('KHÔNG tiêu được tiền của bé nhà phụ huynh khác', async () => {
      const cookieA = await signup('a@example.com');
      const childA = await createChild(cookieA);
      const cookieB = await signup('b@example.com');
      fund(childA, 100);

      const res = await post(cookieB, `/api/children/${childA}/shop/buy`, {
        itemId: 'food-banana',
      });
      expect(res.statusCode).toBe(404);
      expect(inventoryRow(childA, 'food-banana')).toBeUndefined();

      const wallet = getDb()
        .prepare('SELECT stars FROM wallet WHERE child_id = ?')
        .get(childA) as { stars: number };
      expect(wallet.stars).toBe(100);
    });
  });

  // ===========================================================================
  describe('GET /rewards', () => {
    it('trả ảnh chụp đầy đủ cho một bé mới', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const res = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/rewards`,
        headers: { cookie },
      });
      expect(res.statusCode, res.body).toBe(200);

      const snap = (res.json() as { data: RewardSnapshot }).data;
      expect(snap.childId).toBe(childId);
      expect(snap.wallet).toMatchObject({ stars: 0, acorns: 0 });
      expect(snap.xp).toMatchObject({ xp: 0, level: 1 });
      expect(snap.pet).toMatchObject({
        evolutionStage: 'baby',
        happiness: 3,
        // ⭐ Bé mới toanh CHƯA chọn con (T04): `petType` đã phân giải về mặc định Momo 🐵 để bé
        //   thấy một con có thật ngay giây đầu, còn `petChosen: false` là tín hiệu để màn nhà
        //   thú cưng MỜI bé chọn. Hai giá trị này trả lời hai câu hỏi khác nhau — xem `readPet`.
        petType: 'monkey',
        petChosen: false,
      });
      expect(snap.inventory).toEqual([]);
      expect(typeof snap.serverTime).toBe('string');
    });

    /**
     * ⭐ `GET` KHÔNG ĐƯỢC GHI VÀO DB — kiểm ở tầng HTTP vì đây là đường client gọi nhiều nhất
     *   (mỗi lần mở app). Nếu nó tự tạo hàng, "mở app" trở thành một thay đổi dữ liệu.
     */
    it('GET không tạo hàng trong DB', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);
      getDb().prepare('DELETE FROM pet_state WHERE child_id = ?').run(childId);

      const res = await app.inject({
        method: 'GET',
        url: `/api/children/${childId}/rewards`,
        headers: { cookie },
      });
      expect(res.statusCode).toBe(200);
      /**
       * ⭐ HÀNG `pet_state` BỊ XOÁ ⇒ nhánh `!row` của `readPet` phải trả ĐỦ, không được ném.
       *   Đây là ca thật (phục hồi từ sao lưu cũ, DB sửa tay): bé vẫn phải thấy một con vật và
       *   vẫn phải được mời chọn, thay vì màn hình trắng vì một hàng không tồn tại.
       */
      const pet = (res.json() as { data: RewardSnapshot }).data.pet;
      expect(pet.evolutionStage).toBe('baby');
      expect(pet.petType).toBe('monkey');
      expect(pet.petChosen).toBe(false);

      const row = getDb()
        .prepare('SELECT COUNT(*) AS n FROM pet_state WHERE child_id = ?')
        .get(childId) as { n: number };
      expect(row.n).toBe(0);
    });
  });

  // ===========================================================================
  describe('POST /shop/buy', () => {
    /**
     * ⭐⭐ TEST QUAN TRỌNG NHẤT CỦA FILE.
     *
     *   Client gửi kèm `price: 1` và `currency: 'acorns'` — cả hai đều KHÔNG có trong hợp đồng.
     *   Server phải tra giá trong `shop-items.json` (nơi chiếc nơ giá 35 ⭐) và trừ ĐÚNG 35 ⭐.
     */
    it('GIÁ DO CLIENT GỬI LÊN BỊ BỎ QUA — server tra giá trong danh mục', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);
      const bow = getShopItem('acc-bow')!;
      fund(childId, 100, 0);

      const res = await post(cookie, `/api/children/${childId}/shop/buy`, {
        itemId: bow.id,
        // Dưới đây là những gì một client bị sửa sẽ cố gửi lên:
        price: 1,
        currency: 'acorns',
        happinessGain: 99,
      });
      expect(res.statusCode, res.body).toBe(200);

      const result = (res.json() as { data: PurchaseResult }).data;
      expect(result.item.id).toBe(bow.id);
      expect(result.item.price).toBe(bow.price);
      expect(result.wallet).toMatchObject({ stars: 100 - bow.price, acorns: 0 });
    });

    it('mua thành công: trừ tiền và thêm vào túi trong cùng một request', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);
      const banana = getShopItem('food-banana')!;
      fund(childId, banana.price);

      const res = await post(cookie, `/api/children/${childId}/shop/buy`, {
        itemId: banana.id,
      });
      expect(res.statusCode, res.body).toBe(200);

      const result = (res.json() as { data: PurchaseResult }).data;
      expect(result.wallet.stars).toBe(0);
      expect(result.inventoryItem).toMatchObject({ itemId: banana.id, quantity: 1, equipped: false });
      expect(inventoryRow(childId, banana.id)!.quantity).toBe(1);
    });

    it('không đủ tiền ⇒ 409 INSUFFICIENT_FUNDS, túi và ví KHÔNG đổi', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);
      const bow = getShopItem('acc-bow')!;
      fund(childId, bow.price - 1);

      const res = await post(cookie, `/api/children/${childId}/shop/buy`, { itemId: bow.id });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ error: { code: 'INSUFFICIENT_FUNDS' } });

      expect(inventoryRow(childId, bow.id)).toBeUndefined();
      const wallet = getDb()
        .prepare('SELECT stars FROM wallet WHERE child_id = ?')
        .get(childId) as { stars: number };
      expect(wallet.stars).toBe(bow.price - 1);
    });

    it('vật phẩm không tồn tại ⇒ 404 ITEM_NOT_FOUND', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);
      fund(childId, 500);

      const res = await post(cookie, `/api/children/${childId}/shop/buy`, {
        itemId: 'khong-co-mon-nay',
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: { code: 'ITEM_NOT_FOUND' } });
    });

    it('thân request thiếu itemId ⇒ 400 VALIDATION_FAILED', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const res = await post(cookie, `/api/children/${childId}/shop/buy`, {});
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
    });
  });

  // ===========================================================================
  describe('POST /pet/feed', () => {
    it('cho ăn: tiêu 1 đơn vị và tăng ❤️', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);
      const banana = getShopItem('food-banana')!;
      fund(childId, banana.price);
      await post(cookie, `/api/children/${childId}/shop/buy`, { itemId: banana.id });

      const res = await post(cookie, `/api/children/${childId}/pet/feed`, { itemId: banana.id });
      expect(res.statusCode, res.body).toBe(200);

      const result = (res.json() as { data: FeedResult }).data;
      expect(result.pet.happiness).toBe(4);
      expect(result.item.id).toBe(banana.id);
      expect(inventoryRow(childId, banana.id)!.quantity).toBe(0);
    });

    it('chưa sở hữu món đó ⇒ 404 ITEM_NOT_FOUND', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const res = await post(cookie, `/api/children/${childId}/pet/feed`, {
        itemId: 'food-banana',
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: { code: 'ITEM_NOT_FOUND' } });
    });

    it('món không phải đồ ăn ⇒ 400, và KHÔNG tiêu mất phụ kiện', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);
      const bow = getShopItem('acc-bow')!;
      fund(childId, bow.price);
      await post(cookie, `/api/children/${childId}/shop/buy`, { itemId: bow.id });

      const res = await post(cookie, `/api/children/${childId}/pet/feed`, { itemId: bow.id });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
      expect(inventoryRow(childId, bow.id)!.quantity).toBe(1);
    });
  });

  // ===========================================================================
  describe('POST /inventory/:itemId/equip', () => {
    const BOW = 'acc-bow'; // phụ kiện, 35 ⭐
    const CROWN = 'acc-crown'; // phụ kiện, 10 🌰
    const BANANA = 'food-banana'; // đồ ăn — không mặc được

    /** Cho bé sở hữu một món đi qua ĐÚNG hai bước thật: nạp ví rồi mua. */
    async function give(cookie: string, childId: string, itemId: string): Promise<void> {
      fund(childId, 999, 999);
      const res = await post(cookie, `/api/children/${childId}/shop/buy`, { itemId });
      expect(res.statusCode, res.body).toBe(200);
    }

    function equipUrl(childId: string, itemId: string): string {
      return `/api/children/${childId}/inventory/${itemId}/equip`;
    }

    it('từ chối khi chưa đăng nhập', async () => {
      const res = await post(null, equipUrl('chi_bat_ky', BOW), { equipped: true });
      expect(res.statusCode).toBe(401);
    });

    it('mặc thành công: trả về cả túi đồ và trạng thái linh vật', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);
      await give(cookie, childId, BOW);

      const res = await post(cookie, equipUrl(childId, BOW), { equipped: true });
      expect(res.statusCode, res.body).toBe(200);

      const result = (res.json() as { data: EquipmentResult }).data;
      expect(result.item.id).toBe(BOW);
      expect(result.pet.equippedItemIds).toEqual([BOW]);
      expect(result.inventory.find((i) => i.itemId === BOW)!).toMatchObject({ equipped: true });

      // Và trạng thái THẬT trong bảng cũng đổi — không chỉ hình dạng response.
      expect(equippedIds(childId)).toEqual([BOW]);
    });

    /**
     * ⭐⭐ TEST QUAN TRỌNG NHẤT CỦA NHÓM NÀY — cùng kiểu với "GIÁ BỊ BỎ QUA" ở `/shop/buy`.
     *
     *   `:itemId` đã nằm trên đường dẫn. Nếu body CŨNG được đọc (`body.itemId ?? path.itemId`,
     *   hoặc ngược lại), thì kết quả phụ thuộc vào thứ tự đọc thay vì vào sự thật — cùng một
     *   request có thể mặc hai món khác nhau ở hai phiên bản server khác nhau.
     *
     *   Khẳng định: món trên ĐƯỜNG DẪN được mặc, món trong BODY không hề bị đụng tới.
     */
    it('⭐ `itemId` GỬI TRONG BODY BỊ BỎ QUA — đường dẫn luôn thắng', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);
      await give(cookie, childId, BOW);
      await give(cookie, childId, CROWN);

      const res = await post(cookie, equipUrl(childId, BOW), {
        equipped: true,
        // Đây là thứ một bản thiết kế cũ (hoặc một client bị sửa) sẽ cố gửi lên:
        itemId: CROWN,
      });
      expect(res.statusCode, res.body).toBe(200);

      const result = (res.json() as { data: EquipmentResult }).data;
      expect(result.item.id).toBe(BOW);
      expect(result.pet.equippedItemIds).toEqual([BOW]);

      expect(equippedIds(childId)).toEqual([BOW]);
      expect(inventoryRow(childId, CROWN)!.equipped).toBe(0);
    });

    it('bỏ ra: `equipped` về 0 nhưng món đồ VẪN CÒN trong túi', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);
      await give(cookie, childId, BOW);
      await post(cookie, equipUrl(childId, BOW), { equipped: true });

      const res = await post(cookie, equipUrl(childId, BOW), { equipped: false });
      expect(res.statusCode, res.body).toBe(200);

      const result = (res.json() as { data: EquipmentResult }).data;
      expect(result.pet.equippedItemIds).toEqual([]);
      expect(inventoryRow(childId, BOW)).toMatchObject({ quantity: 1, equipped: 0 });
    });

    it('thiếu `equipped` ⇒ 400 VALIDATION_FAILED', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);
      await give(cookie, childId, BOW);

      const res = await post(cookie, equipUrl(childId, BOW), {});
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
      expect(inventoryRow(childId, BOW)!.equipped).toBe(0);
    });

    it('`equipped` không phải boolean ⇒ 400 VALIDATION_FAILED', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);
      await give(cookie, childId, BOW);

      const res = await post(cookie, equipUrl(childId, BOW), { equipped: 'co' });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
      expect(inventoryRow(childId, BOW)!.equipped).toBe(0);
    });

    it('chưa sở hữu món đó ⇒ 404 ITEM_NOT_FOUND, và KHÔNG được cấp không', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const res = await post(cookie, equipUrl(childId, BOW), { equipped: true });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: { code: 'ITEM_NOT_FOUND' } });
      expect(inventoryRow(childId, BOW)).toBeUndefined();
    });

    it('món không có trong danh mục ⇒ 404 ITEM_NOT_FOUND', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);

      const res = await post(cookie, equipUrl(childId, 'khong-co-mon-nay'), { equipped: true });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: { code: 'ITEM_NOT_FOUND' } });
    });

    it('đồ ăn ⇒ 400 VALIDATION_FAILED (và hàng trong túi không bị đụng)', async () => {
      const cookie = await signup('a@example.com');
      const childId = await createChild(cookie);
      await give(cookie, childId, BANANA);

      const res = await post(cookie, equipUrl(childId, BANANA), { equipped: true });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
      expect(inventoryRow(childId, BANANA)).toMatchObject({ quantity: 1, equipped: 0 });
    });

    it('KHÔNG mặc được đồ của bé nhà phụ huynh khác', async () => {
      const cookieA = await signup('a@example.com');
      const childA = await createChild(cookieA);
      const cookieB = await signup('b@example.com');
      await give(cookieA, childA, BOW);

      const res = await post(cookieB, equipUrl(childA, BOW), { equipped: true });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: { code: 'CHILD_NOT_FOUND' } });
      expect(inventoryRow(childA, BOW)!.equipped).toBe(0);
    });
  });
});
