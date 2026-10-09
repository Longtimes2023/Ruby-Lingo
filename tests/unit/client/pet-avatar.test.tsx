/**
 * Test cho `PetAvatar` (T065) — Momo, bộ đồ đang mặc và cảnh quanh nhà.
 *
 * ⭐ NHÓM QUAN TRỌNG NHẤT LÀ NHÓM 1 — và nó không kiểm component, nó kiểm DỮ LIỆU.
 *
 *   `PetAvatar` biết mũ nằm ở đâu là nhờ trường `slot` trong `shared/content/shop-items.json`.
 *   Nếu một phụ kiện thiếu `slot` (hoặc ghi nhầm sang vị trí của trang trí), mọi thứ vẫn biên
 *   dịch, `validate:content` vẫn xanh, app vẫn chạy — và món đồ bé vừa trả ⭐ để mua **biến mất
 *   khỏi người Momo**. Với một đứa trẻ 7 tuổi, "mua rồi mà không thấy đâu" là một lời nói dối,
 *   chứ không phải một bug.
 *
 *   Nhóm 1 chạy trên TOÀN BỘ 30 món THẬT trong danh mục: mọi phụ kiện phải có vị trí trên người,
 *   mọi trang trí phải có vị trí trong cảnh, và không món đồ ăn nào được có `slot`. Test sẽ đỏ
 *   ngay khi ai đó thêm một món mới mà quên — đúng lúc cần biết.
 *
 * Các nhóm sau kiểm phần VẼ và phần NHÃN ĐỌC LÊN. Nhãn quan trọng ngang phần vẽ: cả khung cảnh là
 * emoji đã `aria-hidden`, nên nếu nhãn sai thì bé khiếm thị không nghe được gì khi bé vừa mua cho
 * Momo một món đồ mới.
 */

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import '@/i18n/index.js';
import { PetAvatar } from '@/components/common/PetAvatar.js';
import { EVOLUTION_STAGES, stageDefinition } from '@shared/content/levels.js';
import { PET_DEFINITIONS, petEmojiFor } from '@shared/content/pets.js';
import { accessorySlotOf, decorationSlotOf, getShopItem, SHOP_ITEMS } from '@shared/content/shop.js';
import { shopItemsFileSchema } from '@shared/schemas/content.js';
import type { EvolutionStage, ShopItem } from '@shared/types/reward.js';

/** Vật phẩm THẬT đọc từ danh mục — cùng lý do như `shop-item-card.test.tsx`. */
function item(id: string): ShopItem {
  const found = getShopItem(id);
  if (!found) throw new Error(`shop-items.json thiếu "${id}" — fixture của test đã lệch dữ liệu`);
  return found;
}

/**
 * ⚠️ Mặc định `'monkey'` × `'baby'` (🐵) là CỐ Ý: các khẳng định cũ trong tệp này nói về "Momo"
 *    nói chung, và chúng phải tiếp tục kiểm đúng điều chúng định kiểm. `petEmojiFor('monkey',
 *    'baby')` = 🐵 — ĐÚNG con linh vật dẫn đường Momo, nên câu "chưa có gì ⇒ vẫn có Momo" vẫn nói
 *    đúng sự thật. Đổi mặc định sang một bậc khác sẽ làm chúng đỏ vì LÝ DO GIẢ (đang kiểm hình của
 *    một giai đoạn khác), đúng họ bẫy đã trả giá ở T061.
 *
 * ⚠️ TÊN con nay do `PetAvatar` tự suy từ `petType` (`petNameVi`) — component KHÔNG còn nhận prop
 *    `petName`. Với `monkey`, tên là "Khỉ Momo", nên các nhãn đọc lên trong tệp này dùng tên đó.
 */
function renderAvatar(
  items: readonly ShopItem[] = [],
  stage: EvolutionStage = 'baby',
  petType = 'monkey',
) {
  return render(<PetAvatar petType={petType} evolutionStage={stage} items={items} />);
}

// =============================================================================
// 1. Canh giữ DỮ LIỆU — không món nào được "biến mất" khỏi Momo
// =============================================================================

describe('PetAvatar — canh giữ dữ liệu danh mục', () => {
  it('MỌI phụ kiện trong danh mục đều có một vị trí trên người Momo', () => {
    const accessories = SHOP_ITEMS.filter((i) => i.category === 'accessory');
    expect(accessories.length).toBeGreaterThan(0);
    const missing = accessories.filter((i) => accessorySlotOf(i) === null).map((i) => i.id);
    // Thiếu `slot` ⇒ món này KHÔNG BAO GIỜ hiện trên Momo. Không có lỗi nào khác báo điều đó.
    expect(missing).toEqual([]);
  });

  it('MỌI món trang trí đều có một vị trí trong cảnh', () => {
    const decorations = SHOP_ITEMS.filter((i) => i.category === 'decoration');
    expect(decorations.length).toBeGreaterThan(0);
    const missing = decorations.filter((i) => decorationSlotOf(i) === null).map((i) => i.id);
    expect(missing).toEqual([]);
  });

  it('KHÔNG món đồ ăn nào có vị trí (đồ ăn bị tiêu khi cho ăn, không phải để mặc)', () => {
    const food = SHOP_ITEMS.filter((i) => i.category === 'food');
    expect(food.length).toBeGreaterThan(0);
    const wrong = food
      .filter((i) => accessorySlotOf(i) !== null || decorationSlotOf(i) !== null)
      .map((i) => i.id);
    expect(wrong).toEqual([]);
  });

  it('vị trí đã gán đúng như thiết kế (đọc thẳng từ dữ liệu)', () => {
    expect(accessorySlotOf(item('acc-hat'))).toBe('head');
    expect(accessorySlotOf(item('acc-bow'))).toBe('head');
    expect(accessorySlotOf(item('acc-crown'))).toBe('head');
    expect(accessorySlotOf(item('acc-glasses'))).toBe('face');
    expect(accessorySlotOf(item('acc-star-glasses'))).toBe('face');
    expect(accessorySlotOf(item('acc-scarf'))).toBe('neck');
    expect(accessorySlotOf(item('acc-shoes'))).toBe('feet');
    expect(accessorySlotOf(item('acc-backpack'))).toBe('back');
    expect(accessorySlotOf(item('acc-cape'))).toBe('back');
    expect(accessorySlotOf(item('acc-wings'))).toBe('back');
  });

  it('trang trí: đồ trên cao vào hàng "sky", đồ dưới đất vào hàng "ground"', () => {
    expect(decorationSlotOf(item('dec-balloon'))).toBe('sky');
    expect(decorationSlotOf(item('dec-rainbow'))).toBe('sky');
    expect(decorationSlotOf(item('dec-lantern'))).toBe('sky');
    expect(decorationSlotOf(item('dec-plant'))).toBe('ground');
    expect(decorationSlotOf(item('dec-aquarium'))).toBe('ground');
    expect(decorationSlotOf(item('dec-castle'))).toBe('ground');
  });

  it('một món KHÔNG BAO GIỜ vừa là phụ kiện vừa là trang trí', () => {
    const both = SHOP_ITEMS.filter(
      (i) => accessorySlotOf(i) !== null && decorationSlotOf(i) !== null,
    ).map((i) => i.id);
    expect(both).toEqual([]);
  });

  it('món không thuộc nhóm ⇒ luôn trả `null`', () => {
    expect(accessorySlotOf(item('food-banana'))).toBeNull();
    expect(accessorySlotOf(item('dec-balloon'))).toBeNull();
    expect(decorationSlotOf(item('food-banana'))).toBeNull();
    expect(decorationSlotOf(item('acc-hat'))).toBeNull();
  });

  it('⚠️ vị trí SAI NHÓM ⇒ trả `null`, không được trả một vị trí dùng được', () => {
    // Kiểu dữ liệu này đã bị schema chặn, nhưng hàm tra cứu chạy TRONG lúc render — ném lỗi ở đó
    // là trắng cả màn hình của bé, nên nó phải tự vệ. Nếu phép kiểm `Set` biến mất, một cái lâu
    // đài bị dán nhãn sai sẽ được vẽ LÊN ĐẦU Momo.
    const wrongForAccessory: ShopItem = { ...item('acc-hat'), slot: 'sky' };
    expect(accessorySlotOf(wrongForAccessory)).toBeNull();

    const wrongForDecoration: ShopItem = { ...item('dec-balloon'), slot: 'head' };
    expect(decorationSlotOf(wrongForDecoration)).toBeNull();
  });
});

// =============================================================================
// 2. Vẽ
// =============================================================================

describe('PetAvatar — vẽ', () => {
  it('chưa có gì ⇒ vẫn có Momo (không bao giờ là khung rỗng)', () => {
    renderAvatar();
    expect(screen.getByText('🐵')).toBeInTheDocument();
  });

  it('mặc mũ ⇒ chiếc mũ có mặt trong khung cảnh', () => {
    renderAvatar([item('acc-hat')]);
    expect(screen.getByText('🎩')).toBeInTheDocument();
  });

  it('nhiều món CÙNG một vị trí thì hiện ĐỦ (bé không bị mất món nào)', () => {
    // Server không cấm mặc hai món cùng vị trí, và cấm là trái luật "không lấy gì của bé".
    renderAvatar([item('acc-bow'), item('acc-crown')]);
    expect(screen.getByText('🎀')).toBeInTheDocument();
    expect(screen.getByText('👑')).toBeInTheDocument();
  });

  it('trang trí bầu trời và mặt đất cùng hiện', () => {
    renderAvatar([item('dec-balloon'), item('dec-plant')]);
    expect(screen.getByText('🎈')).toBeInTheDocument();
    expect(screen.getByText('🪴')).toBeInTheDocument();
  });

  it('đồ ăn truyền vào thì BỊ BỎ QUA (Momo không đội quả chuối)', () => {
    renderAvatar([item('food-banana')]);
    expect(screen.queryByText('🍌')).not.toBeInTheDocument();
  });
});

// =============================================================================
// 3. Nhãn đọc lên
// =============================================================================

describe('PetAvatar — nhãn cho trình đọc màn hình', () => {
  it('luôn là một ảnh có tên đọc được (role="img")', () => {
    renderAvatar();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('chưa có gì ⇒ nói Momo đang chơi trong nhà', () => {
    renderAvatar();
    expect(screen.getByRole('img')).toHaveAccessibleName('Khỉ Momo đang chơi trong nhà');
  });

  it('có mặc ⇒ đọc tên từng món đang dùng', () => {
    renderAvatar([item('acc-hat'), item('acc-scarf')]);
    expect(screen.getByRole('img')).toHaveAccessibleName('Khỉ Momo đang dùng: Mũ, Khăn quàng');
  });

  it('có trang trí ⇒ đọc tên từng món quanh nhà', () => {
    renderAvatar([item('dec-balloon')]);
    expect(screen.getByRole('img')).toHaveAccessibleName('Quanh nhà có Bóng bay');
  });

  it('cả hai ⇒ đọc cả hai vế', () => {
    renderAvatar([item('acc-hat'), item('dec-plant')]);
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Khỉ Momo đang dùng: Mũ. Quanh nhà có Chậu cây',
    );
  });

  it('thứ tự đọc theo VỊ TRÍ, không theo thứ tự túi đồ truyền vào', () => {
    // Truyền mũ trước giày, nhưng `ACCESSORY_SLOTS` xếp "feet" trước "head".
    // Câu văn phải ổn định giữa các lần mua — cùng bộ đồ thì luôn cùng một câu.
    renderAvatar([item('acc-hat'), item('acc-shoes')]);
    expect(screen.getByRole('img')).toHaveAccessibleName('Khỉ Momo đang dùng: Giày, Mũ');
  });

  it('mọi emoji bên trong đều aria-hidden (không bị đọc lặp)', () => {
    const { container } = renderAvatar([item('acc-hat'), item('dec-balloon')]);
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });
});

// =============================================================================
// 4. Tiến hoá (T066)
// =============================================================================

describe('PetAvatar — tiến hoá (T066 · T04)', () => {
  it('⭐ canh giữ DỮ LIỆU: MỌI con × MỌI bậc ⇒ đúng emoji khai trong `pets.json`', () => {
    // Nếu ai đó sửa `pets.json` (hoặc `petEmojiFor`) mà lệch bậc, test này đỏ NGAY — thay vì để
    // một bé nào đó thấy con mình "biến hình" sai. Chạy trên TOÀN BỘ danh mục, không chỉ một con.
    for (const pet of PET_DEFINITIONS) {
      for (const stage of EVOLUTION_STAGES) {
        const { unmount } = renderAvatar([], stage.stage, pet.id);
        expect(
          screen.getByText(petEmojiFor(pet.id, stage.stage)),
          `${pet.id} × ${stage.stage}`,
        ).toBeInTheDocument();
        unmount();
      }
    }
  });

  it('bậc "super" có ✨ — dấu hiệu thị giác cho đỉnh tiến hoá', () => {
    // ✨ là phần TRANG TRÍ do `PetAvatar` thêm, KHÔNG nằm trong `pets.json`. Nó phải hiện ở MỌI
    // con khi đạt bậc cuối — kể cả con có `iconSuper` trùng `iconAdult` (Khỉ, Mèo, Cún…).
    renderAvatar([], 'super');
    expect(screen.getByText('✨')).toBeInTheDocument();
  });

  it('hiện TÊN giai đoạn bằng chữ thật (bé và phụ huynh đều đọc được)', () => {
    renderAvatar([], 'baby');
    expect(screen.getByText('Nhóc con')).toBeInTheDocument();
  });

  it('⭐ canh giữ DỮ LIỆU: MỌI giai đoạn trong `xp-levels.json` đều tra được', () => {
    // BA bậc (baby/adult/super) — `'egg'` đã bị bỏ ở T04 (xem `shared/types/reward.ts`). Nếu ai
    // đó thêm giai đoạn thứ tư vào JSON mà quên luồng tra cứu, `stageDefinition` sẽ ném ngay ở đây.
    expect(EVOLUTION_STAGES.length).toBeGreaterThanOrEqual(3);
    for (const definition of EVOLUTION_STAGES) {
      expect(stageDefinition(definition.stage).name_vi).toBe(definition.name_vi);
    }
  });

  it('tên giai đoạn đến từ JSON, KHÔNG từ i18n (một nguồn sự thật duy nhất)', () => {
    // Khẳng định thẳng vào giá trị của giai đoạn cuối: nếu ai đó "tiện tay" khai lại tên giai đoạn
    // trong `vi.ts` rồi hiển thị bản i18n, chữ hiện ra sẽ lệch khi JSON đổi — test này bắt được.
    const last = EVOLUTION_STAGES[EVOLUTION_STAGES.length - 1];
    renderAvatar([], last!.stage);
    expect(screen.getByText(last!.name_vi)).toBeInTheDocument();
  });

  it('⚠️ chú thích nằm NGOÀI khối `role="img"` (con của nó bị coi là trang trí)', () => {
    renderAvatar([], 'adult');
    const scene = screen.getByRole('img');
    // Nếu chú thích bị đặt vào trong, trình đọc màn hình sẽ KHÔNG bao giờ đọc nó — mà đó chính là
    // lý do nó tồn tại.
    expect(within(scene).queryByText('Trưởng thành')).not.toBeInTheDocument();
    expect(screen.getByText('Trưởng thành')).toBeInTheDocument();
  });
});

// =============================================================================
// 5. Cổng DỮ LIỆU — danh mục SAI phải bị TỪ CHỐI, không phải bị bỏ qua
// =============================================================================

/**
 * ⚠️ VÌ SAO PHẢI KIỂM CẢ SCHEMA, KHÔNG CHỈ KIỂM DANH MỤC ĐANG CÓ:
 *   Nhóm 1 chứng minh dữ liệu HIỆN TẠI đúng. Nó KHÔNG chứng minh được rằng một món SAI sẽ bị
 *   chặn — mà đó mới là thứ bảo vệ bé vào ngày ai đó thêm món thứ 31. Nếu `superRefine` biến mất,
 *   nhóm 1 vẫn xanh (30 món hiện tại vẫn đủ `slot`), và món mới sẽ lặng lẽ vô hình trên Momo —
 *   bé trả ⭐ rồi không thấy gì. Đây là test canh giữ CỔNG, không phải canh giữ DỮ LIỆU.
 */
describe('PetAvatar — cổng dữ liệu: shopItemsFileSchema từ chối danh mục sai', () => {
  const CURRENCIES = {
    stars: { name_vi: 'Sao', icon: '⭐' },
    acorns: { name_vi: 'Hạt dẻ', icon: '🌰' },
  };

  /** Một danh mục tối thiểu, chỉ khác nhau ở `itemPatch` — để mỗi test chỉ nói MỘT điều. */
  function fileWith(itemPatch: Record<string, unknown>) {
    return {
      currencies: CURRENCIES,
      items: [
        {
          id: 'x-mon',
          name_vi: 'Món thử',
          icon: '🎩',
          category: 'accessory',
          price: 10,
          currency: 'stars',
          description_vi: 'mô tả',
          phase: 'mvp',
          ...itemPatch,
        },
      ],
    };
  }

  it('phụ kiện CÓ vị trí hợp lệ ⇒ qua', () => {
    expect(shopItemsFileSchema.safeParse(fileWith({ slot: 'head' })).success).toBe(true);
  });

  it('trang trí CÓ vị trí hợp lệ ⇒ qua', () => {
    expect(
      shopItemsFileSchema.safeParse(fileWith({ category: 'decoration', slot: 'sky' })).success,
    ).toBe(true);
  });

  it('⚠️ phụ kiện THIẾU vị trí ⇒ TỪ CHỐI, và lỗi phải nói ĐÚNG là THIẾU', () => {
    const result = shopItemsFileSchema.safeParse(fileWith({}));
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'items.0.slot');
      // Trỏ đúng chỗ là điều kiện để thông báo lỗi còn dùng được khi danh mục có 500 món.
      expect(issue).toBeDefined();

      /**
       * ⚠️ PHẢI KHẲNG ĐỊNH CẢ CÂU CHỮ, KHÔNG CHỈ "bị từ chối".
       *
       * Phép kiểm "vị trí phải thuộc ĐÚNG NHÓM" ở dưới cũng từ chối `undefined` (vì
       * `['back','feet',…].includes(undefined)` là `false`). Nghĩa là nếu nhánh "THIẾU slot" biến
       * mất, danh mục VẪN bị từ chối ⇒ test chỉ kiểm `success === false` vẫn xanh, và ta mất câu
       * thông báo đúng: người viết nội dung sẽ đọc "undefined không phải vị trí hợp lệ cho
       * accessory" thay vì câu họ cần — "phải có slot".
       *
       * Đây là bài học thật của lượt này: đột biến CSLOT1 đã LỌT LƯỚI đúng vì lý do đó.
       */
      expect(issue?.message).toContain('phải có "slot"');
    }
  });

  it('⚠️ trang trí THIẾU vị trí ⇒ TỪ CHỐI', () => {
    expect(shopItemsFileSchema.safeParse(fileWith({ category: 'decoration' })).success).toBe(false);
  });

  it('⚠️ phụ kiện gắn vị trí của TRANG TRÍ ⇒ TỪ CHỐI', () => {
    expect(shopItemsFileSchema.safeParse(fileWith({ slot: 'sky' })).success).toBe(false);
  });

  it('⚠️ trang trí gắn vị trí của PHỤ KIỆN ⇒ TỪ CHỐI', () => {
    expect(
      shopItemsFileSchema.safeParse(fileWith({ category: 'decoration', slot: 'head' })).success,
    ).toBe(false);
  });

  it('⚠️ đồ ăn có vị trí ⇒ TỪ CHỐI (quả chuối không đội lên đầu ai)', () => {
    expect(shopItemsFileSchema.safeParse(fileWith({ category: 'food', slot: 'head' })).success).toBe(
      false,
    );
  });

  it('đồ ăn KHÔNG có vị trí ⇒ qua (đó mới là trạng thái đúng)', () => {
    expect(shopItemsFileSchema.safeParse(fileWith({ category: 'food' })).success).toBe(true);
  });
});
