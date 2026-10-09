// @vitest-environment node
/**
 * Test `server/services/RewardService.ts` (T052).
 *
 * ⭐ LUẬT CHI PHỐI TOÀN BỘ FILE NÀY:
 *
 *      "KHÔNG BAO GIỜ LẤY THỨ GÌ CỦA BÉ MÀ KHÔNG ĐỔI LẠI ĐƯỢC GÌ."
 *
 *   Mỗi nhóm test dưới đây là một cách luật đó có thể bị vi phạm, và cách nó được chặn:
 *
 *     • SỐ DƯ ÂM — nếu điều kiện `>=` không nằm trong `WHERE` của câu UPDATE, một cú bấm đúp
 *       (hoặc hai tab cùng lúc) sẽ trừ tiền hai lần cho một món đồ. Đây là test QUAN TRỌNG NHẤT.
 *     • MẤT ĐỒ KHI MUA LẠI MÓN ĐÃ CÓ — món dùng-mãi không được tính tiền lần thứ hai.
 *     • MẤT ĐỒ KHI CHO ĂN LÚC ĐÃ NO — tiêu một quả chuối mà Momo không vui hơn là mất trắng.
 *     • MẤT ĐỒ KHI THIẾU TIỀN — nhận đồ phải xảy ra SAU khi trừ tiền, và cả hai trong một
 *       transaction, nếu không bé có thể nhận đồ mà ví không bị trừ (hoặc ngược lại).
 *
 * ⚠️ VÌ SAO PHẢI KIỂM CẢ HÀNG TRONG DB, KHÔNG CHỈ GIÁ TRỊ TRẢ VỀ:
 *   Service trả về một object do nó tự dựng. Một hàm trả về `wallet.stars = 0` trong khi DB
 *   đang giữ `-5` sẽ qua được mọi khẳng định chỉ nhìn vào giá trị trả về. Chỗ đáng kiểm là
 *   TRẠNG THÁI THẬT trong bảng.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { AuthService } from '../../../server/services/AuthService.js';
import { ChildService } from '../../../server/services/ChildService.js';
import { RewardService } from '../../../server/services/RewardService.js';
import { getDb, transaction } from '../../../server/db/connection.js';
import { AppError } from '../../../server/plugins/errors.js';
import { XP_LEVELS } from '../../../shared/content/levels.js';
import { happinessGainOf, getShopItem } from '../../../shared/content/shop.js';
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
 * Nạp tiền cho bé — ĐI QUA CHÍNH service, không viết SQL tay.
 *
 * ⭐ Vì sao không `UPDATE wallet SET stars = 100` thẳng: nếu `applyGrantsInTx` hỏng (ví dụ ghi
 *   nhầm cột), test sẽ dựng được trạng thái "đúng" bằng một đường không dùng tới code đang
 *   được kiểm, và mọi test mua bán sau đó đều chạy trên một cái ví giả. Nạp tiền bằng đúng con
 *   đường thật thì mỗi test còn kiểm luôn cả đường nạp.
 */
function fund(childId: string, amount: { stars?: number; acorns?: number }): void {
  transaction((db) => {
    rewards.applyGrantsInTx(db, childId, amount, new Date().toISOString());
  });
}

function walletRow(childId: string): { stars: number; acorns: number } {
  return getDb()
    .prepare('SELECT stars, acorns FROM wallet WHERE child_id = ?')
    .get(childId) as { stars: number; acorns: number };
}

function inventoryRow(
  childId: string,
  itemId: string,
): { quantity: number; equipped: number } | undefined {
  return getDb()
    .prepare('SELECT quantity, equipped FROM inventory WHERE child_id = ? AND item_id = ?')
    .get(childId, itemId) as { quantity: number; equipped: number } | undefined;
}

function happinessOf(childId: string): number {
  return (
    getDb().prepare('SELECT happiness FROM pet_state WHERE child_id = ?').get(childId) as {
      happiness: number;
    }
  ).happiness;
}

/** Lấy mã lỗi quy về ĐÚNG thứ client nhận qua HTTP — xem ghi chú ở `child-service.test.ts`. */
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

describe('RewardService', () => {
  beforeAll(() => {
    setupTestDb();
  });

  beforeEach(() => {
    clearAllData(getDb());
  });

  // ===========================================================================
  describe('getSnapshot — đọc trạng thái', () => {
    it('bé mới toanh: ví 0/0, cấp 1, trứng, ❤️ 3, túi rỗng', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);

      const snap = rewards.getSnapshot(parentId, childId);

      expect(snap.childId).toBe(childId);
      expect(snap.wallet).toMatchObject({ stars: 0, acorns: 0 });
      expect(snap.xp).toMatchObject({ xp: 0, level: 1 });
      expect(snap.pet).toMatchObject({ evolutionStage: 'egg', wordsLearned: 0, happiness: 3, lastFedAt: null });
      expect(snap.inventory).toEqual([]);
      expect(snap.badges).toEqual([]);
      expect(snap.stickers).toEqual([]);
    });

    it('KHÔNG đọc được hồ sơ bé nhà phụ huynh khác', async () => {
      const parentA = await makeParent('a@example.com');
      const childA = makeChild(parentA);
      const parentB = await makeParent('b@example.com');

      expect(codeOf(() => rewards.getSnapshot(parentB, childA))).toBe('CHILD_NOT_FOUND');
    });

    /**
     * ⭐ `level` LÀ BẢN GHI ĐỆM, KHÔNG PHẢI NGUỒN CHÂN LÝ.
     *
     *   Nếu ai đó sửa `xp-levels.json` (thêm cấp, đổi mốc XP) sau khi bé đã có XP, cột `level`
     *   trong DB sẽ lệch với bảng cấp. Đọc theo cột đó nghĩa là bé thấy cấp SAI — và tệ hơn,
     *   `getLevelsCrossed` sẽ tính sai phần quà của cấp bị bỏ qua.
     */
    it('tính LẠI cấp từ `xp`, không tin cột `level` đã lưu', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);

      const target = XP_LEVELS[1]!; // cấp 2 (bảng đã sắp theo xpRequired tăng dần)
      getDb()
        .prepare('UPDATE xp_state SET xp = ?, level = 1 WHERE child_id = ?')
        .run(target.xpRequired, childId);

      expect(rewards.getSnapshot(parentId, childId).xp.level).toBe(target.level);
      expect(target.level).not.toBe(1); // nếu bằng 1 thì test này không chứng minh được gì
    });

    /**
     * ⭐ `GET` KHÔNG ĐƯỢC GHI VÀO DB.
     *
     *   Mở app lên chỉ để xem không được làm thay đổi dữ liệu. Nếu `getSnapshot` tự tạo hàng
     *   khi thấy thiếu, mọi lần đồng bộ sau đó sẽ thấy "có gì đó mới" và ta mất khả năng phân
     *   biệt "bé vừa làm gì" với "bé vừa mở app".
     *
     *   Cách kiểm: XOÁ hàng ví (mô phỏng một bản phục hồi sao lưu cũ), rồi gọi `getSnapshot`.
     *   Sau đó hàng đó PHẢI vẫn không tồn tại.
     */
    it('GET không tạo hàng trong DB khi hàng chưa có', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      getDb().prepare('DELETE FROM wallet WHERE child_id = ?').run(childId);

      const snap = rewards.getSnapshot(parentId, childId);

      // Trả về giá trị mặc định đúng...
      expect(snap.wallet).toMatchObject({ stars: 0, acorns: 0 });
      // ...nhưng KHÔNG ghi gì vào DB.
      const row = getDb().prepare('SELECT COUNT(*) AS n FROM wallet WHERE child_id = ?').get(childId) as {
        n: number;
      };
      expect(row.n).toBe(0);
    });
  });

  // ===========================================================================
  describe('applyGrantsInTx — trao thưởng', () => {
    it('chỉ tính là "mới" với huy hiệu / sticker / vật phẩm chưa từng có', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      const at = new Date().toISOString();

      const first = transaction((db) =>
        rewards.applyGrantsInTx(
          db,
          childId,
          {
            stars: 10,
            acorns: 1,
            badges: ['b-first'],
            stickers: [{ stickerId: 's-momo' }],
            items: [{ itemId: 'acc-bow' }],
          },
          at,
        ),
      );

      expect(first).toMatchObject({
        starsGained: 10,
        acornsGained: 1,
        badgeIds: ['b-first'],
        stickerIds: ['s-momo'],
        itemIds: ['acc-bow'],
      });

      const second = transaction((db) =>
        rewards.applyGrantsInTx(
          db,
          childId,
          {
            stars: 10,
            // Trao lại y hệt — không có gì mới.
            badges: ['b-first'],
            stickers: [{ stickerId: 's-momo' }],
            items: [{ itemId: 'acc-bow' }],
          },
          at,
        ),
      );

      // ⭐ Đây là lý do phải trả về "cái gì MỚI": overlay không được ăn mừng lại một huy hiệu
      //   bé đã có từ tuần trước. Nhưng ⭐ thì vẫn cộng — tiền tệ là CỘNG DỒN, cố ý.
      expect(second).toMatchObject({
        starsGained: 10,
        badgeIds: [],
        stickerIds: [],
        itemIds: [],
      });
      expect(walletRow(childId).stars).toBe(20);
    });

    it('bỏ qua số âm thay vì trừ tiền (không có đường "cộng số âm")', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);

      transaction((db) => {
        rewards.applyGrantsInTx(db, childId, { stars: 10 }, new Date().toISOString());
        // Kể cả khi ai đó truyền số âm, ví KHÔNG được giảm. `addCurrencyInTx` kẹp về >= 0.
        rewards.applyGrantsInTx(db, childId, { stars: -100 }, new Date().toISOString());
      });

      expect(walletRow(childId).stars).toBe(10);
    });
  });

  // ===========================================================================
  describe('trừ tiền — SỐ DƯ KHÔNG BAO GIỜ ÂM', () => {
    /**
     * ⭐⭐ TEST QUAN TRỌNG NHẤT CỦA FILE.
     *
     *   Kịch bản thật, không phải ca hiếm: bé bấm "Mua" hai lần thật nhanh, hoặc mở hai tab.
     *   Nếu `spendInTx` đọc số dư rồi mới trừ, cả hai lần đọc đều thấy "đủ tiền" và ví bị trừ
     *   hai lần cho một món đồ. Điều kiện `>=` nằm TRONG `WHERE` khiến "kiểm" và "trừ" là một
     *   thao tác không thể chia cắt.
     *
     *   Đây cũng là điều mà `CHECK (stars >= 0)` trong migration chỉ là lưới thứ hai.
     */
    it('mua hai lần khi chỉ đủ tiền một lần: lần hai bị từ chối, ví KHÔNG âm', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      const banana = getShopItem('food-banana')!;
      fund(childId, { stars: banana.price }); // đúng đủ một quả chuối

      rewards.buy(parentId, childId, { itemId: banana.id });

      expect(codeOf(() => rewards.buy(parentId, childId, { itemId: banana.id }))).toBe(
        'INSUFFICIENT_FUNDS',
      );

      // ⭐ Nhìn vào BẢNG, không nhìn vào giá trị trả về.
      expect(walletRow(childId).stars).toBe(0);
      expect(inventoryRow(childId, banana.id)!.quantity).toBe(1);
    });

    /**
     * ⚠️ ĐIỀU KIỆN `WHERE` KIỂM CẢ HAI LOẠI TIỀN TỆ.
     *
     *   Một bé có 500 ⭐ nhưng 0 🌰 KHÔNG được mua món giá 3 🌰. Nếu câu UPDATE chỉ kiểm loại
     *   tiền tệ đang trả, bé sẽ mua được món bằng hạt dẻ mà ví hạt dẻ âm — hoặc (nếu CHECK chặn)
     *   giao dịch nổ với một lỗi SQLite thô thay vì `INSUFFICIENT_FUNDS`.
     */
    it('thiếu 🌰 thì KHÔNG trừ ⭐ và không nhận được món', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      const cake = getShopItem('food-cake')!; // trả bằng acorns
      fund(childId, { stars: 500 });

      expect(codeOf(() => rewards.buy(parentId, childId, { itemId: cake.id }))).toBe(
        'INSUFFICIENT_FUNDS',
      );

      expect(walletRow(childId)).toMatchObject({ stars: 500, acorns: 0 });
      expect(inventoryRow(childId, cake.id)).toBeUndefined();
    });
  });

  // ===========================================================================
  describe('buy — mua vật phẩm', () => {
    it('đồ ăn mua được NHIỀU LẦN: trừ tiền mỗi lần, số lượng cộng dồn', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      const banana = getShopItem('food-banana')!;
      fund(childId, { stars: banana.price * 3 });

      for (let i = 0; i < 3; i += 1) rewards.buy(parentId, childId, { itemId: banana.id });

      // Bé CỐ Ý mua 3 quả chuối ⇒ trừ 3 lần là ĐÚNG: có đổi lại đủ 3 quả.
      expect(inventoryRow(childId, banana.id)!.quantity).toBe(3);
      expect(walletRow(childId).stars).toBe(0);
    });

    it('món dùng-mãi đã sở hữu: lần hai KHÔNG trừ tiền', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      const bow = getShopItem('acc-bow')!;
      fund(childId, { stars: bow.price * 3 });

      const first = rewards.buy(parentId, childId, { itemId: bow.id });
      const starsAfterFirst = walletRow(childId).stars;
      const second = rewards.buy(parentId, childId, { itemId: bow.id });

      // Không ném lỗi (bé vừa làm đúng việc bấm "Mua"), nhưng cũng không lấy thêm tiền.
      expect(walletRow(childId).stars).toBe(starsAfterFirst);
      expect(second.inventoryItem.quantity).toBe(first.inventoryItem.quantity);
      expect(second.wallet.stars).toBe(starsAfterFirst);
    });

    it('không đủ tiền: túi KHÔNG bị đụng tới', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      const bow = getShopItem('acc-bow')!;
      fund(childId, { stars: bow.price - 1 });

      expect(codeOf(() => rewards.buy(parentId, childId, { itemId: bow.id }))).toBe(
        'INSUFFICIENT_FUNDS',
      );

      expect(inventoryRow(childId, bow.id)).toBeUndefined();
      expect(walletRow(childId).stars).toBe(bow.price - 1);
    });

    it('vật phẩm không có trong danh mục ⇒ ITEM_NOT_FOUND', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      fund(childId, { stars: 999 });

      expect(codeOf(() => rewards.buy(parentId, childId, { itemId: 'mon-do-khong-co' }))).toBe(
        'ITEM_NOT_FOUND',
      );
      expect(walletRow(childId).stars).toBe(999);
    });

    it('từ chối thân request thiếu itemId', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      expect(codeOf(() => rewards.buy(parentId, childId, {}))).toBe('VALIDATION_FAILED');
    });

    it('KHÔNG mua được vào hồ sơ bé nhà phụ huynh khác', async () => {
      const parentA = await makeParent('a@example.com');
      const childA = makeChild(parentA);
      const parentB = await makeParent('b@example.com');
      fund(childA, { stars: 100 });

      expect(codeOf(() => rewards.buy(parentB, childA, { itemId: 'food-banana' }))).toBe(
        'CHILD_NOT_FOUND',
      );
      expect(walletRow(childA).stars).toBe(100);
      expect(inventoryRow(childA, 'food-banana')).toBeUndefined();
    });
  });

  // ===========================================================================
  describe('feed — cho thú cưng ăn', () => {
    it('tiêu 1 đơn vị và cộng đúng số ❤️ của món', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      const banana = getShopItem('food-banana')!;
      fund(childId, { stars: banana.price });
      rewards.buy(parentId, childId, { itemId: banana.id });

      const before = happinessOf(childId);
      const result = rewards.feed(parentId, childId, { itemId: banana.id });

      expect(result.pet.happiness).toBe(before + happinessGainOf(banana));
      expect(happinessOf(childId)).toBe(result.pet.happiness);
      expect(inventoryRow(childId, banana.id)!.quantity).toBe(0);
    });

    /**
     * ⭐ SAO KHI ĂN KHÔNG ĐƯỢC TRỪ TIỀN — tiền đã trả lúc mua. Trừ thêm ở đây nghĩa là bé bị
     *   tính hai lần cho một quả chuối.
     */
    it('cho ăn KHÔNG trừ thêm tiền', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      const banana = getShopItem('food-banana')!;
      fund(childId, { stars: banana.price });
      rewards.buy(parentId, childId, { itemId: banana.id });
      const starsAfterBuy = walletRow(childId).stars;

      rewards.feed(parentId, childId, { itemId: banana.id });

      expect(walletRow(childId).stars).toBe(starsAfterBuy);
    });

    it('❤️ bị kẹp trần 5', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      const honey = getShopItem('food-honey')!; // +2 ❤️
      fund(childId, { stars: 999 });
      getDb().prepare('UPDATE pet_state SET happiness = 4 WHERE child_id = ?').run(childId);
      rewards.buy(parentId, childId, { itemId: honey.id });

      const result = rewards.feed(parentId, childId, { itemId: honey.id });

      expect(result.pet.happiness).toBe(5);
    });

    /**
     * ⭐⭐ "KHÔNG LẤY GÌ MÀ KHÔNG ĐỔI LẠI ĐƯỢC GÌ."
     *
     *   Momo đã no (❤️ = 5) mà vẫn tiêu một quả chuối là lấy mất 5 ⭐ của bé mà bé không nhận
     *   thêm được gì. Một bé 7 tuổi không thể hiểu vì sao quả chuối biến mất mà Momo không vui
     *   hơn — từ phía bé, đó là "app lấy mất đồ của mình".
     */
    it('đã no (❤️ = 5): KHÔNG tiêu đồ, KHÔNG đổi trạng thái', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      const banana = getShopItem('food-banana')!;
      fund(childId, { stars: banana.price });
      rewards.buy(parentId, childId, { itemId: banana.id });
      getDb().prepare('UPDATE pet_state SET happiness = 5 WHERE child_id = ?').run(childId);

      const result = rewards.feed(parentId, childId, { itemId: banana.id });

      expect(result.pet.happiness).toBe(5);
      expect(inventoryRow(childId, banana.id)!.quantity).toBe(1); // vẫn còn nguyên
      expect(walletRow(childId).stars).toBe(0); // và không trừ thêm gì
    });

    it('món không phải ĐỒ ĂN ⇒ VALIDATION_FAILED (và không tiêu mất phụ kiện)', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      const bow = getShopItem('acc-bow')!;
      fund(childId, { stars: bow.price });
      rewards.buy(parentId, childId, { itemId: bow.id });

      expect(codeOf(() => rewards.feed(parentId, childId, { itemId: bow.id }))).toBe(
        'VALIDATION_FAILED',
      );
      expect(inventoryRow(childId, bow.id)!.quantity).toBe(1);
    });

    it('chưa sở hữu món đó ⇒ ITEM_NOT_FOUND, ❤️ không đổi', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      const before = happinessOf(childId);

      expect(codeOf(() => rewards.feed(parentId, childId, { itemId: 'food-banana' }))).toBe(
        'ITEM_NOT_FOUND',
      );
      expect(happinessOf(childId)).toBe(before);
    });

    /**
     * ⭐ "ĐÃ TỪNG MUA" LÀ VĨNH VIỄN.
     *
     *   `quantity` về 0 nhưng HÀNG VẪN CÒN, nên cửa hàng biết bé đã từng sở hữu món đó. Xoá
     *   hàng khi hết hàng sẽ khiến món đồ "biến mất khỏi bộ sưu tập" — đúng thứ luật C2 cấm.
     */
    it('hàng trong túi KHÔNG bị xoá khi số lượng về 0', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      const banana = getShopItem('food-banana')!;
      fund(childId, { stars: banana.price });
      rewards.buy(parentId, childId, { itemId: banana.id });
      rewards.feed(parentId, childId, { itemId: banana.id });

      expect(inventoryRow(childId, banana.id)).toBeDefined();

      // Và vì đã từng sở hữu, mua lại KHÔNG bị coi là "mua lại món dùng-mãi" ⇒ vẫn trừ tiền
      // bình thường (đồ ăn xếp chồng được).
      expect(inventoryRow(childId, banana.id)!.quantity).toBe(0);
    });
  });

  // ===========================================================================
  describe('thú cưng — SÀN ❤️ = 1', () => {
    /**
     * ⭐ SÀN 1 LÀ QUYẾT ĐỊNH THIẾT KẾ, KHÔNG PHẢI CHI TIẾT.
     *
     *   Bé bỏ app nhiều ngày, `computeHappiness` (T066) trừ ❤️ — nhưng linh vật không bao giờ
     *   buồn bã hoàn toàn. Và quan trọng hơn: kẹp ở ĐÂY (thay vì để `CHECK` trong DB ném lỗi)
     *   khiến một phép tính sai ở tầng trên hạ xuống SÀN thay vì làm NỔ cả transaction — tức là
     *   bé không mất luôn phần thưởng của lượt chơi vừa rồi vì một lỗi ở chỗ khác.
     */
    it('kẹp ❤️ về [1, 5] thay vì ném lỗi ràng buộc', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      const at = new Date().toISOString();

      transaction((db) => {
        rewards.setPetHappinessInTx(db, childId, -50, at);
      });
      expect(happinessOf(childId)).toBe(1);

      transaction((db) => {
        rewards.setPetHappinessInTx(db, childId, 99, at);
      });
      expect(happinessOf(childId)).toBe(5);
    });
  });

  // ===========================================================================
  describe('túi đồ — sở hữu và tiêu thụ', () => {
    it('`consumeItemInTx` không tiêu được nhiều hơn số đang có', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      const banana = getShopItem('food-banana')!;
      fund(childId, { stars: 999 });
      rewards.buy(parentId, childId, { itemId: banana.id });

      expect(
        codeOf(() =>
          transaction((db) => rewards.consumeItemInTx(db, childId, banana.id, 5)),
        ),
      ).toBe('ITEM_NOT_FOUND');
      expect(inventoryRow(childId, banana.id)!.quantity).toBe(1);
    });

    it('`grantItemInTx` nói đúng "lần đầu sở hữu"', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      const at = new Date().toISOString();

      const results = transaction((db) => [
        rewards.grantItemInTx(db, childId, 'acc-bow', 1, at),
        rewards.grantItemInTx(db, childId, 'acc-bow', 1, at),
      ]);

      expect(results).toEqual([true, false]);
      expect(inventoryRow(childId, 'acc-bow')!.quantity).toBe(2);
    });
  });

  // ===========================================================================
  describe('equip — mặc / bỏ ra vật phẩm (T062)', () => {
    /** Một PHỤ KIỆN (35 ⭐) và một món TRANG TRÍ (20 ⭐) — hai nhóm mặc được. */
    const BOW = 'acc-bow';
    const BALLOON = 'dec-balloon';
    /** Đồ ăn — KHÔNG mặc được, cùng lý do `feed()` từ chối phụ kiện. */
    const BANANA = 'food-banana';

    /**
     * Cho bé SỞ HỮU một món, đi qua đúng đường thật (`rewards.buy`) thay vì `INSERT` tay vào
     * `inventory`.
     *
     * ⭐ Cùng lý do như `fund()`: nếu `grantItemInTx` ghi nhầm cột, một `INSERT` tay sẽ dựng
     *   được trạng thái "đúng" bằng một đường KHÔNG dùng tới code đang được kiểm — và mọi test
     *   mặc đồ sau đó đều chạy trên một cái túi giả.
     */
    function own(parentId: string, childId: string, itemId: string): void {
      fund(childId, { stars: 999, acorns: 999 });
      rewards.buy(parentId, childId, { itemId });
    }

    /** Danh sách đang mặc — đọc qua ĐÚNG đường mà `PetAvatar` sẽ dùng. */
    function equippedIdsOf(childId: string): string[] {
      return rewards.readPet(getDb(), childId).equippedItemIds;
    }

    /** Nội dung THÔ của cột `pet_state.equipped_item_ids` — để chứng minh nó không được dùng. */
    function petEquippedColumn(childId: string): string {
      return (
        getDb()
          .prepare('SELECT equipped_item_ids FROM pet_state WHERE child_id = ?')
          .get(childId) as { equipped_item_ids: string }
      ).equipped_item_ids;
    }

    it('mặc một phụ kiện: hàng `inventory` bật `equipped`, danh sách đang mặc có nó', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      own(parentId, childId, BOW);

      const result = rewards.equip(parentId, childId, BOW, { equipped: true });

      // ⚠️ Nhìn vào BẢNG, không chỉ giá trị trả về: service trả về object do chính nó dựng, nên
      //    một hàm trả `equipped: true` trong khi DB vẫn giữ 0 sẽ qua được mọi khẳng định chỉ
      //    nhìn vào kết quả trả về.
      expect(inventoryRow(childId, BOW)!.equipped).toBe(1);
      expect(equippedIdsOf(childId)).toEqual([BOW]);
      expect(result.pet.equippedItemIds).toEqual([BOW]);
      expect(result.inventory.find((i) => i.itemId === BOW)!).toMatchObject({ equipped: true });
    });

    it('BỎ RA: `equipped` về 0 và danh sách đang mặc trống', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      own(parentId, childId, BOW);
      rewards.equip(parentId, childId, BOW, { equipped: true });

      const result = rewards.equip(parentId, childId, BOW, { equipped: false });

      expect(inventoryRow(childId, BOW)!.equipped).toBe(0);
      expect(equippedIdsOf(childId)).toEqual([]);
      expect(result.pet.equippedItemIds).toEqual([]);
      // Món đồ VẪN CÒN trong túi: bỏ ra chỉ đổi cách hiển thị, không bao giờ thu hồi (C2).
      expect(inventoryRow(childId, BOW)!.quantity).toBe(1);
    });

    /**
     * ⭐⭐ TEST QUAN TRỌNG NHẤT CỦA NHÓM NÀY.
     *
     *   Bé 7 tuổi bấm "Dùng ngay" hai lần là chuyện bình thường. Nếu `equip` ĐẢO trạng thái
     *   (`equipped = 1 - equipped`) thì lần thứ hai BỎ món đồ ra — bé thấy thứ mình vừa chọn biến
     *   mất khỏi Momo, và không có cách nào bé hiểu vì sao. `equipped` phải là TRẠNG THÁI ĐÍCH.
     */
    it('bấm "Dùng ngay" HAI LẦN cho kết quả y hệt bấm một lần (không đảo trạng thái)', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      own(parentId, childId, BOW);

      rewards.equip(parentId, childId, BOW, { equipped: true });
      const second = rewards.equip(parentId, childId, BOW, { equipped: true });

      expect(inventoryRow(childId, BOW)!.equipped).toBe(1);
      expect(equippedIdsOf(childId)).toEqual([BOW]);
      expect(second.pet.equippedItemIds).toEqual([BOW]);
      // Và lần gửi thừa KHÔNG bị coi là lỗi — client có thể gửi lại thoải mái.
      expect(second.inventory.find((i) => i.itemId === BOW)!).toMatchObject({ equipped: true });
    });

    it('bỏ ra một món CHƯA từng mặc cũng là no-op, không phải lỗi', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      own(parentId, childId, BOW);

      const result = rewards.equip(parentId, childId, BOW, { equipped: false });

      expect(inventoryRow(childId, BOW)!.equipped).toBe(0);
      expect(result.pet.equippedItemIds).toEqual([]);
    });

    it('mặc được NHIỀU món cùng lúc (không có mô hình "ô" trên đầu)', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      own(parentId, childId, BOW);
      own(parentId, childId, BALLOON);

      rewards.equip(parentId, childId, BOW, { equipped: true });
      rewards.equip(parentId, childId, BALLOON, { equipped: true });

      // So sánh sau khi sắp xếp: thứ tự chỉ được chốt khi hai món được mua ở các mili-giây khác
      // nhau, nên khẳng định trên thứ tự nguyên bản sẽ là một test chập chờn.
      expect([...equippedIdsOf(childId)].sort()).toEqual([BOW, BALLOON].sort());
    });

    it('mặc / bỏ ra KHÔNG trừ một ⭐ nào', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      own(parentId, childId, BOW);
      const before = walletRow(childId);

      rewards.equip(parentId, childId, BOW, { equipped: true });
      rewards.equip(parentId, childId, BOW, { equipped: false });

      expect(walletRow(childId)).toEqual(before);
    });

    it('đồ ăn KHÔNG mặc được ⇒ VALIDATION_FAILED, hàng trong túi không bị đụng', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      own(parentId, childId, BANANA);

      expect(codeOf(() => rewards.equip(parentId, childId, BANANA, { equipped: true }))).toBe(
        'VALIDATION_FAILED',
      );
      expect(inventoryRow(childId, BANANA)).toMatchObject({ quantity: 1, equipped: 0 });
    });

    /**
     * ⭐ MẶC ĐỒ CHƯA MUA = ĐƯỢC CẤP KHÔNG MỘT MÓN ĐỒ — và lỗ hổng đó để lại DẤU VĨNH VIỄN.
     *
     *   Nếu `equip` tự tạo hàng `inventory` khi thiếu, bé mặc được vương miện mà chưa trả ⭐; và
     *   tệ hơn, hàng mới khiến cửa hàng hiển thị "Đã có" nên bé KHÔNG BAO GIỜ trả tiền cho nó
     *   nữa. Kiểm cả hai mặt: lỗi ném ra, VÀ không có hàng nào được ghi.
     */
    it('chưa sở hữu ⇒ ITEM_NOT_FOUND và KHÔNG ghi hàng nào vào túi', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);

      expect(codeOf(() => rewards.equip(parentId, childId, BOW, { equipped: true }))).toBe(
        'ITEM_NOT_FOUND',
      );
      expect(inventoryRow(childId, BOW)).toBeUndefined();
    });

    it('món không có trong danh mục ⇒ ITEM_NOT_FOUND', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);

      expect(
        codeOf(() => rewards.equip(parentId, childId, 'mon-do-khong-co', { equipped: true })),
      ).toBe('ITEM_NOT_FOUND');
    });

    /**
     * ⭐ HÀNG CÒN NHƯNG ĐÃ TIÊU HẾT ⇒ KHÔNG ĐƯỢC MẶC.
     *
     *   `grantItemInTx` cố ý KHÔNG xoá hàng khi số lượng về 0 ("đã từng mua" là vĩnh viễn), nên
     *   "có hàng trong `inventory`" và "đang sở hữu một món" là hai chuyện khác nhau.
     *
     *   ⚠️ Hôm nay chưa có đường nào tạo ra trạng thái này (chỉ đồ ăn tiêu được, mà đồ ăn đã bị
     *      chặn ngay trên), nhưng nó TỚI ĐƯỢC bằng phục hồi sao lưu hoặc sửa DB tay. Điều kiện
     *      nói về SỰ SỞ HỮU chứ không về nhóm, nên nó phải đúng ở đây — và test này là chỗ duy
     *      nhất chứng minh nó tồn tại.
     */
    it('hàng còn nhưng đã tiêu hết (`quantity = 0`) ⇒ ITEM_NOT_FOUND', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      own(parentId, childId, BOW);
      getDb()
        .prepare('UPDATE inventory SET quantity = 0 WHERE child_id = ? AND item_id = ?')
        .run(childId, BOW);

      expect(codeOf(() => rewards.equip(parentId, childId, BOW, { equipped: true }))).toBe(
        'ITEM_NOT_FOUND',
      );
      expect(inventoryRow(childId, BOW)!.equipped).toBe(0);
    });

    it('thiếu `equipped` ⇒ VALIDATION_FAILED', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      own(parentId, childId, BOW);

      expect(codeOf(() => rewards.equip(parentId, childId, BOW, {}))).toBe('VALIDATION_FAILED');
    });

    it('`equipped` không phải boolean ⇒ VALIDATION_FAILED', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      own(parentId, childId, BOW);

      expect(codeOf(() => rewards.equip(parentId, childId, BOW, { equipped: 'yes' }))).toBe(
        'VALIDATION_FAILED',
      );
      // Và trạng thái thật không đổi.
      expect(inventoryRow(childId, BOW)!.equipped).toBe(0);
    });

    it('KHÔNG mặc được vào hồ sơ bé nhà phụ huynh khác', async () => {
      const parentA = await makeParent('a@example.com');
      const childA = makeChild(parentA);
      const parentB = await makeParent('b@example.com');
      own(parentA, childA, BOW);

      expect(codeOf(() => rewards.equip(parentB, childA, BOW, { equipped: true }))).toBe(
        'CHILD_NOT_FOUND',
      );
      expect(inventoryRow(childA, BOW)!.equipped).toBe(0);
    });

    // =========================================================================
    // HAI TEST KHOÁ "QUYẾT ĐỊNH 4" — ĐANG MẶC GÌ CHỈ CÓ MỘT CHỦ
    // =========================================================================
    //
    //   Cột `pet_state.equipped_item_ids` có từ migration 004 và TRÔNG y hệt chỗ lưu đúng thứ
    //   này. Hai test dưới đây là thứ duy nhất ngăn người sửa sau "khôi phục" nó — và khôi phục
    //   nó nghĩa là có hai nguồn cho một sự thật, tức là một ngày chúng sẽ nói khác nhau.

    it('⭐ mặc đồ KHÔNG ghi vào cột `pet_state.equipped_item_ids`', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      own(parentId, childId, BOW);

      rewards.equip(parentId, childId, BOW, { equipped: true });

      expect(petEquippedColumn(childId)).toBe('[]');
      expect(equippedIdsOf(childId)).toEqual([BOW]);
    });

    it('⭐⭐ cột `pet_state.equipped_item_ids` KHÔNG được đọc — ghi rác vào cũng vô hiệu', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      own(parentId, childId, BOW);

      // Một giá trị HOÀN TOÀN HỢP LỆ về hình thức, chỉ là không đúng sự thật.
      getDb()
        .prepare('UPDATE pet_state SET equipped_item_ids = ? WHERE child_id = ?')
        .run('["acc-crown"]', childId);

      // Chưa mặc gì ⇒ danh sách TRỐNG, bất kể cột kia nói gì.
      expect(rewards.readPet(getDb(), childId).equippedItemIds).toEqual([]);
      expect(rewards.getSnapshot(parentId, childId).pet.equippedItemIds).toEqual([]);

      rewards.equip(parentId, childId, BOW, { equipped: true });

      // Chỉ đúng món THẬT SỰ đang mặc; "acc-crown" trong cột kia vẫn vô hình.
      expect(rewards.readPet(getDb(), childId).equippedItemIds).toEqual([BOW]);
    });

    /**
     * ⭐ PHẦN THƯỞNG CỦA VIỆC SUY TỪ `inventory`: hàng `pet_state` biến mất cũng không làm mất
     *   sự thật. Nếu `equipped_item_ids` là một cột được ghi song song, nhánh "chưa có hàng" sẽ
     *   trả `[]` — tức là xoá `pet_state` (một việc test HTTP `GET /rewards` LÀM THẬT) sẽ khiến
     *   Momo đột nhiên cởi hết đồ trong khi túi vẫn nói bé đang mặc.
     */
    it('hàng `pet_state` bị thiếu vẫn trả ĐÚNG danh sách đang mặc', async () => {
      const parentId = await makeParent('bo@example.com');
      const childId = makeChild(parentId);
      own(parentId, childId, BOW);
      rewards.equip(parentId, childId, BOW, { equipped: true });

      getDb().prepare('DELETE FROM pet_state WHERE child_id = ?').run(childId);

      expect(rewards.readPet(getDb(), childId).equippedItemIds).toEqual([BOW]);
    });
  });
});
