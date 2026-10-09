// @vitest-environment node
/**
 * Test danh mục THÚ CƯNG (`shared/content/pets.json` + `shared/content/pets.ts`) — T04.
 *
 * ⭐ ĐIỂM SỐ 2 CHỦ DỰ ÁN BÁO: *"Thú cưng không cho các bé chọn à, mặc định là trứng"*.
 *   File này khoá lại DANH MỤC mà màn chọn sẽ hiện ra: có những con nào, tên gì, hình gì ở mỗi
 *   bậc tiến hoá — và quan trọng nhất: **id lạ KHÔNG được làm sập màn của bé**.
 *
 * ⚠️ VÌ SAO `getPetDefinition` PHẢI KHÔNG NÉM — ĐÂY LÀ KHẲNG ĐỊNH QUAN TRỌNG NHẤT CỦA FILE:
 *   Hàm đó chạy trên DỮ LIỆU CŨ TRONG DB: `pet_state.pet_type` có thể là NULL (bé chưa từng chọn)
 *   hoặc một id của BẢN DEPLOY KHÁC (con vừa bị xoá khỏi `pets.json`, DB phục hồi từ sao lưu).
 *   Nếu nó ném, màn hình của bé TRẮNG vì một con thú cưng không còn tồn tại — hỏng một thứ phụ
 *   mà kéo cả app xuống. Đây là điểm KHÁC CÓ Ý so với `getShopItem`/`stageDefinition` (hai hàm
 *   kia ném, và đúng là nên ném — chúng chạy trên id do CLIENT gửi lên).
 *
 * ⚠️ "Emoji 1 codepoint" KHÔNG phải chi tiết mỹ thuật — đó là yêu cầu TƯƠNG THÍCH:
 *   emoji ghép (ZWJ sequence, cờ, tông da) hiển thị khác nhau — hoặc vỡ thành 2–3 ký tự — tuỳ
 *   phiên bản iOS/Android. Bé dùng tablet cũ sẽ thấy "con vật" của mình là hai ô vuông. Test
 *   dưới đây khoá đúng điều đó lại bằng `[...emoji].length === 1`.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PET_ID,
  PET_DEFINITIONS,
  getPetDefinition,
  isPetId,
  petEmojiFor,
  petNameVi,
} from '../../../shared/content/pets.js';
import { petsFileSchema, xpLevelsFileSchema } from '../../../shared/schemas/content.js';
import petsRaw from '../../../shared/content/pets.json';
import xpLevelsRaw from '../../../shared/content/xp-levels.json';

const SHARED_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../shared/content');

/** Danh sách id CHỐT của MVP — 6 con, đúng như PRD §4. */
const EXPECTED_IDS = ['monkey', 'cat', 'dog', 'tiger', 'pig', 'dragon'] as const;

/** Ba bậc tiến hoá, và emoji mỗi con PHẢI có cho từng bậc. */
const STAGES = ['baby', 'adult', 'super'] as const;

describe('pets.json — danh mục 6 thú cưng', () => {
  it('có ĐÚNG 6 con, đúng bộ id đã chốt', () => {
    expect(PET_DEFINITIONS).toHaveLength(6);
    expect(PET_DEFINITIONS.map((p) => p.id)).toEqual([...EXPECTED_IDS]);
  });

  it('id KHÔNG trùng (id là khoá tra cứu, trùng là một con biến mất trong im lặng)', () => {
    const ids = PET_DEFINITIONS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('mỗi con có đủ tên VI/EN và 3 emoji (baby/adult/super), không rỗng', () => {
    for (const pet of PET_DEFINITIONS) {
      expect(pet.name_vi.length, `${pet.id}: thiếu tên tiếng Việt`).toBeGreaterThan(0);
      expect(pet.name_en.length, `${pet.id}: thiếu tên tiếng Anh`).toBeGreaterThan(0);
      for (const stage of STAGES) {
        const key = `icon${stage[0]!.toUpperCase()}${stage.slice(1)}` as
          | 'iconBaby'
          | 'iconAdult'
          | 'iconSuper';
        expect(pet[key].length, `${pet.id}: thiếu ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('⭐ mọi emoji là MỘT codepoint (tablet cũ không vỡ thành 2–3 ô vuông)', () => {
    for (const pet of PET_DEFINITIONS) {
      for (const key of ['iconBaby', 'iconAdult', 'iconSuper'] as const) {
        // `[...str]` duyệt theo CODE POINT (không phải UTF-16 code unit) ⇒ emoji 1 codepoint
        // cho đúng 1 phần tử. Một ZWJ sequence sẽ cho nhiều hơn.
        expect([...pet[key]].length, `${pet.id}.${key} = "${pet[key]}" không phải 1 codepoint`).toBe(1);
      }
    }
  });

  it('`phase` chỉ nhận mvp/p1/p2 (cho phép ra mắt dần mà không phải xoá dữ liệu)', () => {
    for (const pet of PET_DEFINITIONS) {
      expect(['mvp', 'p1', 'p2']).toContain(pet.phase);
    }
  });

  it('file thật trên đĩa khớp với module đã nạp (không có bản sao thứ hai)', () => {
    const onDisk = JSON.parse(readFileSync(join(SHARED_DIR, 'pets.json'), 'utf8')) as unknown;
    expect(petsFileSchema.safeParse(onDisk).success).toBe(true);
    expect(onDisk).toEqual(petsRaw);
  });
});

describe('pets.ts — tra cứu, và KHÔNG BAO GIỜ ném', () => {
  it('`DEFAULT_PET_ID` = monkey, và con đó CÓ trong danh mục', () => {
    expect(DEFAULT_PET_ID).toBe('monkey');
    expect(isPetId(DEFAULT_PET_ID)).toBe(true);
  });

  it('⭐ id lạ ⇒ rơi về mặc định, KHÔNG ném (dữ liệu cũ trong DB)', () => {
    expect(() => getPetDefinition('khong-co-con-nay')).not.toThrow();
    expect(getPetDefinition('khong-co-con-nay').id).toBe(DEFAULT_PET_ID);
    // Đúng loại dữ liệu mà một con vừa bị xoá khỏi `pets.json`, hoặc một DB phục hồi từ sao lưu
    // của phiên bản khác, để lại trong cột `pet_state.pet_type`.
    expect(getPetDefinition('con-cua-ban-deploy-khac').id).toBe(DEFAULT_PET_ID);
  });

  it('`null`/`undefined` ⇒ cũng về mặc định (bé CHƯA chọn)', () => {
    expect(getPetDefinition(null).id).toBe(DEFAULT_PET_ID);
    expect(getPetDefinition(undefined).id).toBe(DEFAULT_PET_ID);
    expect(getPetDefinition().id).toBe(DEFAULT_PET_ID);
  });

  it('id hợp lệ ⇒ trả ĐÚNG con đó (không rơi về mặc định)', () => {
    for (const id of EXPECTED_IDS) {
      expect(getPetDefinition(id).id).toBe(id);
    }
  });

  it('`isPetId` thu hẹp kiểu: chỉ `string` có trong danh mục mới là `true`', () => {
    expect(isPetId('cat')).toBe(true);
    expect(isPetId('khong-co')).toBe(false);
    expect(isPetId(null)).toBe(false);
    expect(isPetId(undefined)).toBe(false);
    expect(isPetId(123)).toBe(false);
    expect(isPetId({ id: 'cat' })).toBe(false);
  });

  it('`petEmojiFor` trả ĐÚNG emoji khai trong JSON, cho MỌI (con × bậc)', () => {
    for (const pet of PET_DEFINITIONS) {
      expect(petEmojiFor(pet.id, 'baby')).toBe(pet.iconBaby);
      expect(petEmojiFor(pet.id, 'adult')).toBe(pet.iconAdult);
      expect(petEmojiFor(pet.id, 'super')).toBe(pet.iconSuper);
    }
    // Ca cụ thể đã chốt trong tài liệu: Heo bậc 3 là con heo rừng 🐗, không phải heo nhà 🐖.
    expect(petEmojiFor('pig', 'super')).toBe('🐗');
    expect(petEmojiFor('pig', 'adult')).toBe('🐖');
  });

  it('`petEmojiFor` với id lạ ⇒ emoji của con MẶC ĐỊNH, không `undefined`', () => {
    // `undefined` lọt tới JSX là một ô trống — bé thấy "con vật" của mình biến mất.
    for (const stage of STAGES) {
      expect(petEmojiFor('khong-co', stage)).toBe(petEmojiFor(DEFAULT_PET_ID, stage));
      expect(petEmojiFor(null, stage)).toBe(petEmojiFor(DEFAULT_PET_ID, stage));
    }
  });

  it('`petNameVi` trả tên tiếng Việt; id lạ ⇒ tên con mặc định', () => {
    expect(petNameVi('dragon')).toBe('Rồng Long');
    expect(petNameVi('cat')).toBe('Mèo Miu');
    expect(petNameVi('khong-co')).toBe(getPetDefinition(DEFAULT_PET_ID).name_vi);
    expect(petNameVi(null)).toBe(getPetDefinition(DEFAULT_PET_ID).name_vi);
  });
});

describe('petsFileSchema — chặn danh mục hỏng NGAY LÚC NẠP', () => {
  const valid = {
    pets: [
      {
        id: 'monkey',
        name_vi: 'Khỉ Momo',
        name_en: 'Monkey',
        iconBaby: '🐵',
        iconAdult: '🐒',
        iconSuper: '🐒',
        phase: 'mvp',
      },
    ],
  };

  it('nhận một danh mục hợp lệ', () => {
    expect(petsFileSchema.safeParse(valid).success).toBe(true);
  });

  it('TỪ CHỐI khi thiếu `iconSuper`', () => {
    const { iconSuper: _drop, ...withoutSuper } = valid.pets[0]!;
    const res = petsFileSchema.safeParse({ pets: [withoutSuper] });
    expect(res.success).toBe(false);
  });

  it('⚠️ TỪ CHỐI hai thú cưng TRÙNG id', () => {
    // Hai mục cùng id ⇒ bảng tra (`Map` trong `pets.ts`) im lặng giữ mục SAU. Nghĩa là con nào
    // hiện ra phụ thuộc THỨ TỰ DÒNG trong file JSON — và chỉ đổi hành vi khi ai đó sắp xếp lại
    // file. Đây là loại lỗi im lặng dự án cấm, nên nó phải ồn ào.
    const res = petsFileSchema.safeParse({ pets: [valid.pets[0], valid.pets[0]] });
    expect(res.success).toBe(false);
  });

  it('TỪ CHỐI danh sách rỗng (màn chọn không được phép không có con nào)', () => {
    expect(petsFileSchema.safeParse({ pets: [] }).success).toBe(false);
  });

  it('TỪ CHỐI `phase` lạ', () => {
    const res = petsFileSchema.safeParse({ pets: [{ ...valid.pets[0], phase: 'mvp2' }] });
    expect(res.success).toBe(false);
  });
});

describe('xp-levels.json — bậc tiến hoá đã BỎ `egg`', () => {
  it('còn ĐÚNG 3 bậc, ngưỡng 0 / 40 / 120, tăng dần', () => {
    const parsed = xpLevelsFileSchema.parse(xpLevelsRaw);
    expect(parsed.evolutionStages.map((s) => s.stage)).toEqual([...STAGES]);
    expect(parsed.evolutionStages.map((s) => s.wordsRequired)).toEqual([0, 40, 120]);
  });

  it('⭐ TỪ CHỐI `stage: "egg"` (bậc đó đã bị bỏ ở T04)', () => {
    // Nếu để lọt, `xp-levels.json` cũ sẽ được chấp nhận trong khi `EvolutionStage` không còn
    // `'egg'` — và `stageDefinition('egg')` sẽ NÉM lúc chạy, tức màn của bé trắng.
    const res = xpLevelsFileSchema.safeParse({
      ...xpLevelsRaw,
      evolutionStages: [
        { stage: 'egg', name_vi: 'Trứng', icon: '🥚', wordsRequired: 0 },
        ...xpLevelsRaw.evolutionStages,
      ],
    });
    expect(res.success).toBe(false);
  });

  it('giữ nguyên `name_vi` — `PetAvatar` in chuỗi này dưới con thú cưng', () => {
    const parsed = xpLevelsFileSchema.parse(xpLevelsRaw);
    expect(parsed.evolutionStages.map((s) => s.name_vi)).toEqual([
      'Nhóc con',
      'Trưởng thành',
      'Siêu cấp',
    ]);
  });
});
