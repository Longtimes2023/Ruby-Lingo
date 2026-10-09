// @vitest-environment node
/**
 * Test `server/services/XpService.ts` (T053).
 *
 * ⭐⭐ TEST QUAN TRỌNG NHẤT CỦA FILE: "một lần cộng XP nhảy qua nhiều cấp ⇒ quà của MỌI cấp bị
 *    nhảy qua đều được trao".
 *
 *   Đây là bug đắt nhất mà `XpService` tồn tại để chặn, và nó KHÔNG hiện ra ở bất kỳ cổng kiểm
 *   tự động nào:
 *     • typecheck sạch — `getLevelForXp` trả về đúng kiểu.
 *     • lint sạch.
 *     • Và nếu ta chỉ kiểm "cấp sau khi cộng XP là bao nhiêu", test cũng XANH — vì cấp thì đúng
 *       trong khi quà của cấp bị nhảy qua đã biến mất VĨNH VIỄN (bé đã ở trên mốc XP đó, nên
 *       không bao giờ "lên" cấp ấy nữa).
 *   Nên khẳng định phải nhìn vào VÍ và BỘ SƯU TẬP, không chỉ nhìn vào con số cấp.
 *
 * ⚠️ Các test ở đây chạy trên `xp-levels.json` THẬT, không phải một bảng cấp giả. Một bảng giả
 *   sẽ khiến test xanh trong khi app dùng bảng khác — và mốc XP chính là thứ hay bị chỉnh nhất.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthService } from '../../../server/services/AuthService.js';
import { ChildService } from '../../../server/services/ChildService.js';
import { XpService, levelRewardsToBundle } from '../../../server/services/XpService.js';
import { getDb, transaction } from '../../../server/db/connection.js';
import { MAX_LEVEL, XP_LEVELS } from '../../../shared/content/levels.js';
import { clearAllData, setupTestDb } from './helpers/testDb.js';

const auth = new AuthService();
const children = new ChildService();
const xp = new XpService();

const AT = '2026-10-06T09:00:00.000Z';

async function makeChild(email = 'bo@example.com'): Promise<string> {
  const { parent } = await auth.signup({ email, password: 'matkhau123', parentalConsent: true });
  return children.createChild(parent.id, { nickname: 'Bin', age: 7, avatarId: 'fox' }).id;
}

/** Cấp theo SỐ CẤP, không theo chỉ số mảng — để test không phụ thuộc thứ tự file JSON. */
function levelDef(level: number) {
  const found = XP_LEVELS.find((l) => l.level === level);
  if (!found) throw new Error(`Bảng cấp không có cấp ${level}`);
  return found;
}

function addXp(childId: string, amount: number) {
  return transaction((db) => xp.addXpInTx(db, childId, amount, AT));
}

function xpRow(childId: string): { xp: number; level: number } {
  return getDb().prepare('SELECT xp, level FROM xp_state WHERE child_id = ?').get(childId) as {
    xp: number;
    level: number;
  };
}

function wallet(childId: string): { stars: number; acorns: number } {
  return getDb().prepare('SELECT stars, acorns FROM wallet WHERE child_id = ?').get(childId) as {
    stars: number;
    acorns: number;
  };
}

function badges(childId: string): string[] {
  return (
    getDb().prepare('SELECT badge_id FROM badge_earned WHERE child_id = ? ORDER BY badge_id').all(
      childId,
    ) as { badge_id: string }[]
  ).map((r) => r.badge_id);
}

function itemIds(childId: string): string[] {
  return (
    getDb().prepare('SELECT item_id FROM inventory WHERE child_id = ? ORDER BY item_id').all(
      childId,
    ) as { item_id: string }[]
  ).map((r) => r.item_id);
}

describe('XpService', () => {
  beforeAll(() => {
    setupTestDb();
  });

  beforeEach(() => {
    clearAllData(getDb());
  });

  // ===========================================================================
  describe('addXpInTx — cộng XP và lên cấp', () => {
    it('bé mới toanh: 0 XP, cấp 1', async () => {
      const childId = await makeChild();
      const result = addXp(childId, 0);

      expect(result).toMatchObject({
        xpBefore: 0,
        xpGained: 0,
        xpAfter: 0,
        levelBefore: 1,
        levelAfter: 1,
        levelsCrossed: [],
        levelUp: null,
      });
    });

    it('cộng chưa tới mốc cấp 2: XP tăng nhưng KHÔNG lên cấp, không có quà', async () => {
      const childId = await makeChild();
      const level2 = levelDef(2);

      const result = addXp(childId, level2.xpRequired - 1);

      expect(result).toMatchObject({ levelBefore: 1, levelAfter: 1, levelsCrossed: [], levelUp: null });
      expect(result.xpAfter).toBe(level2.xpRequired - 1);
      expect(badges(childId)).toEqual([]);
      expect(wallet(childId).stars).toBe(0);
    });

    /**
     * ⭐ BIÊN: đúng mốc phải LÊN CẤP. `xpRequired` là "XP tối thiểu để đạt cấp này" — dùng `>`
     *   thay vì `>=` sẽ khiến bé đứng ngay mốc mà vẫn ở cấp cũ, và thanh XP đầy 100% mà không
     *   có gì xảy ra.
     */
    it('ĐÚNG mốc cấp 2 thì lên cấp và nhận quà của cấp 2', async () => {
      const childId = await makeChild();
      const level2 = levelDef(2);

      const result = addXp(childId, level2.xpRequired);

      expect(result).toMatchObject({ levelBefore: 1, levelAfter: 2, levelUp: { from: 1, to: 2 } });
      expect(result.levelsCrossed.map((l) => l.level)).toEqual([2]);

      // Quà của cấp 2 (đọc từ chính bảng cấp, không hardcode) đã được trao THẬT.
      expect(result.rewards.badgeIds).toEqual(['badge-forest-friend']);
      expect(badges(childId)).toEqual(['badge-forest-friend']);
      expect(wallet(childId).stars).toBe(20);
    });

    /**
     * ⭐⭐ TEST QUAN TRỌNG NHẤT CỦA FILE.
     *
     *   Nhảy từ cấp 1 thẳng lên cấp 4 trong MỘT lần cộng XP. Quà của cấp 2, 3 VÀ 4 đều phải được
     *   trao. Nếu code chỉ so `cấp cũ`/`cấp mới` rồi trao quà của cấp 4, thì quà của cấp 2 và 3
     *   MẤT VĨNH VIỄN — và khẳng định "levelAfter === 4" vẫn XANH.
     */
    it('một lần cộng nhảy qua NHIỀU cấp: quà của MỌI cấp bị nhảy qua đều được trao', async () => {
      const childId = await makeChild();
      const level4 = levelDef(4);

      const result = addXp(childId, level4.xpRequired); // 0 → 900 XP, vượt cấp 2, 3, 4

      expect(result.levelAfter).toBe(4);
      expect(result.levelsCrossed.map((l) => l.level)).toEqual([2, 3, 4]);

      // --- Huy hiệu của CẢ BA cấp, không chỉ cấp 4 ---
      expect(result.rewards.badgeIds).toEqual(['badge-forest-friend', 'badge-explorer', 'badge-guide']);
      expect(badges(childId)).toEqual(['badge-explorer', 'badge-forest-friend', 'badge-guide']);

      // --- ⭐ cộng dồn: 20 (cấp 2) + 30 (cấp 3) + 40 (cấp 4) ---
      expect(result.rewards.starsGained).toBe(90);
      expect(wallet(childId).stars).toBe(90);

      // --- 🌰 chỉ cấp 3 cho 3 hạt dẻ ---
      expect(result.rewards.acornsGained).toBe(3);
      expect(wallet(childId).acorns).toBe(3);

      // --- Vật phẩm của cấp 4 đã vào túi ---
      expect(result.rewards.itemIds).toEqual(['acc-star-glasses']);
      expect(itemIds(childId)).toEqual(['acc-star-glasses']);
    });

    it('`levelsCrossed` sắp TĂNG DẦN, và `levelUp.rewards` gộp quà của mọi cấp', async () => {
      const childId = await makeChild();
      const result = addXp(childId, levelDef(5).xpRequired);

      expect(result.levelsCrossed.map((l) => l.level)).toEqual([2, 3, 4, 5]);
      // `levelUp.rewards` là ĐỊNH NGHĨA THÔ để overlay hiện đủ danh sách phần thưởng.
      expect(result.levelUp).toMatchObject({ from: 1, to: 5 });
      expect(result.levelUp!.rewards.length).toBe(
        [2, 3, 4, 5].reduce((n, lv) => n + levelDef(lv).rewards.length, 0),
      );
    });

    it('cấp được ghi vào cột `level` khớp với cấp suy ra từ `xp`', async () => {
      const childId = await makeChild();
      addXp(childId, levelDef(3).xpRequired + 7);

      const row = xpRow(childId);
      expect(row.xp).toBe(levelDef(3).xpRequired + 7);
      expect(row.level).toBe(3);
    });

    it('ở cấp TỐI ĐA: XP vẫn tăng tiếp, không bị kẹp lại', async () => {
      const childId = await makeChild();
      const top = levelDef(MAX_LEVEL);

      addXp(childId, top.xpRequired);
      const later = addXp(childId, 500);

      // Cấp đứng ở mức tối đa, nhưng XP PHẢI tiếp tục tăng — bé còn thấy mình đang tiến bộ.
      expect(later.levelAfter).toBe(MAX_LEVEL);
      expect(later.levelsCrossed).toEqual([]);
      expect(xpRow(childId).xp).toBe(top.xpRequired + 500);
    });
  });

  // ===========================================================================
  describe('XP chỉ TĂNG — không có hình phạt', () => {
    it('số âm và số 0 là NO-OP: không ghi gì, cấp không tụt', async () => {
      const childId = await makeChild();
      addXp(childId, levelDef(3).xpRequired);
      const before = xpRow(childId);

      const negative = addXp(childId, -100);
      const zero = addXp(childId, 0);

      expect(negative).toMatchObject({
        xpGained: 0,
        xpAfter: before.xp,
        levelBefore: 3,
        levelAfter: 3,
        levelsCrossed: [],
        levelUp: null,
      });
      expect(zero.xpAfter).toBe(before.xp);
      // Và QUAN TRỌNG: hàng trong DB không hề bị đụng tới.
      expect(xpRow(childId)).toEqual(before);
    });

    it('số thập phân bị cắt XUỐNG, không làm XP thành số lẻ', async () => {
      const childId = await makeChild();
      const result = addXp(childId, 10.9);
      expect(result.xpGained).toBe(10);
      expect(xpRow(childId).xp).toBe(10);
    });

    it('`NaN` / `Infinity` không phá được hàng XP', async () => {
      const childId = await makeChild();
      addXp(childId, 50);

      expect(addXp(childId, Number.NaN).xpGained).toBe(0);
      expect(addXp(childId, Number.POSITIVE_INFINITY).xpGained).toBe(0);
      expect(xpRow(childId).xp).toBe(50);
    });

    /**
     * ⭐ LŨY ĐẲNG THEO TỰ NHIÊN: một cấp chỉ bị vượt qua đúng MỘT LẦN trong đời hồ sơ bé.
     *   Nên cộng thêm XP (dù đã ở cấp 4) KHÔNG trao lại quà của cấp 2–4.
     */
    it('cộng thêm XP sau khi đã lên cấp KHÔNG trao lại quà cũ', async () => {
      const childId = await makeChild();
      addXp(childId, levelDef(4).xpRequired);
      const starsAfterLevel4 = wallet(childId).stars;

      const more = addXp(childId, 50); // vẫn ở cấp 4

      expect(more.levelsCrossed).toEqual([]);
      expect(more.rewards).toMatchObject({ starsGained: 0, acornsGained: 0, badgeIds: [], itemIds: [] });
      expect(wallet(childId).stars).toBe(starsAfterLevel4);
    });
  });

  // ===========================================================================
  describe('levelRewardsToBundle — hàm thuần', () => {
    it('gộp ⭐/🌰 và gom badge/sticker/vật phẩm', () => {
      const bundle = levelRewardsToBundle([
        { kind: 'badge', refId: 'badge-a' },
        { kind: 'stars', amount: 20 },
        { kind: 'acorns', amount: 3 },
        { kind: 'stars', amount: 30 },
        { kind: 'sticker', refId: 's-1' },
        { kind: 'item', refId: 'acc-bow' },
      ]);

      expect(bundle).toMatchObject({
        stars: 50,
        acorns: 3,
        badges: ['badge-a'],
        stickers: [{ stickerId: 's-1' }],
        items: [{ itemId: 'acc-bow' }],
      });
    });

    /**
     * ⚠️ CHỐNG VÒNG LẶP: quà `kind: 'xp'` bị BỎ QUA (và luật V16c trong validator cấm nó xuất
     *   hiện trong `xp-levels.json`). Nếu nó được cộng, một lần cộng XP sẽ sinh ra XP mới, XP đó
     *   lại có thể vượt cấp, cấp đó lại cho XP…
     */
    it('BỎ QUA quà `xp` — cộng XP không được sinh ra XP', () => {
      const bundle = levelRewardsToBundle([
        { kind: 'xp', amount: 1000 },
        { kind: 'stars', amount: 5 },
      ]);

      expect(bundle).toMatchObject({ stars: 5, acorns: 0, badges: [], stickers: [], items: [] });
    });

    it('quà thiếu `refId` bị bỏ qua thay vì trao một id rỗng', () => {
      const bundle = levelRewardsToBundle([{ kind: 'badge' }, { kind: 'item' }, { kind: 'sticker' }]);
      expect(bundle).toMatchObject({ badges: [], items: [], stickers: [] });
    });

    it('danh sách rỗng ⇒ gói rỗng (không có nhánh đặc biệt nào để quên)', () => {
      expect(levelRewardsToBundle([])).toMatchObject({
        stars: 0,
        acorns: 0,
        badges: [],
        stickers: [],
        items: [],
      });
    });
  });
});
