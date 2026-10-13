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

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import '@/i18n/index.js';
import { PetAvatar } from '@/components/common/PetAvatar.js';
import { petArtworkUrl } from '@/lib/petArtwork.js';
import {
  ACCESSORY_SQUASH,
  accessoryFitOf,
  DEFAULT_ACCESSORY_INK,
  HEADPIECE_DROP as HAT_DROP,
} from '@/lib/accessoryFit.js';
import { petAnchorFor } from '@/lib/petAnchors.js';
import { EVOLUTION_STAGES, stageDefinition } from '@shared/content/levels.js';
import { PET_DEFINITIONS, petEmojiFor } from '@shared/content/pets.js';
import {
  accessorySlotOf,
  decorationSlotOf,
  getShopItem,
  SHOP_ITEMS,
} from '@shared/content/shop.js';
import { shopItemsFileSchema } from '@shared/schemas/content.js';
import type { EvolutionStage, ShopItem } from '@shared/types/reward.js';
import { shopArtworkOf } from '@/lib/shopArtworkManifest.js';

/** Vật phẩm THẬT đọc từ danh mục — cùng lý do như `shop-item-card.test.tsx`. */
function item(id: string): ShopItem {
  const found = getShopItem(id);
  if (!found) throw new Error(`shop-items.json thiếu "${id}" — fixture của test đã lệch dữ liệu`);
  return found;
}

/**
 * Đọc hộp MỰC NHÌN THẤY của một món từ DOM, quy về hệ 0..1 của hộp `1em` như `petAnchors.ts`.
 *
 * ⚠️ jsdom KHÔNG tính layout, nên không đo được `getBoundingClientRect`. Nhưng component đặt neo
 *    bằng `style` inline (`left/top/width/height` theo `%`) — đọc lại chính các số đó rồi quy đổi
 *    ra tâm/bề rộng MỰC cho ta bài kiểm chứng ĐÚNG THỨ cần: "kính có nằm trên đường mắt không",
 *    độc lập với việc component tính bằng công thức nào.
 */
function inkBoxOf(container: HTMLElement, itemId: string) {
  const layer = container.querySelector(`[data-accessory-id="${itemId}"]`);
  const box = layer?.querySelector('span');
  if (!(box instanceof HTMLElement)) throw new Error(`không thấy hộp của "${itemId}"`);
  const pct = (value: string) => Number.parseFloat(value) / 100;
  // ⚠️ `left`/`top` là TÂM hộp (hộp canh tâm bằng `-translate-x-1/2 -translate-y-1/2`), KHÔNG phải
  //    mép trên-trái. Cộng thêm `side/2` ở đây là tự lừa mình.
  const cx0 = pct(box.style.left);
  const cy0 = pct(box.style.top);
  const side = pct(box.style.width);
  /*
    ⚠️⚠️ `height` KHÔNG còn bằng `width`. Khăn quàng bị ép dẹt theo chiều dọc
    (`ACCESSORY_SQUASH.neck = 0,7`) nên hộp là hình chữ nhật. Đọc `height` từ chính DOM —
    suy nó ra từ `width` là bỏ qua đúng thứ vừa được sửa, và test sẽ xanh trong khi mắt bé
    vẫn thấy cục len phủ kín ngực.
  */
  const height = pct(box.style.height);
  const squashY = side > 0 ? height / side : 1;
  const ink = accessoryFitOf(itemId)?.ink ?? DEFAULT_ACCESSORY_INK;
  const cy = cy0 + (ink.cy - 0.5) * height;
  return {
    side,
    height,
    squashY,
    cx: cx0 + (ink.cx - 0.5) * side,
    cy,
    w: ink.w * side,
    h: ink.h * height,
    top: cy - (ink.h * height) / 2,
    bottom: cy + (ink.h * height) / 2,
  };
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
  it('ánh xạ đủ mọi phụ kiện và đồ trang trí sang WebP; đồ ăn tiếp tục dùng emoji', () => {
    const artItems = SHOP_ITEMS.filter(
      (shopItem) => shopItem.category === 'accessory' || shopItem.category === 'decoration',
    );
    expect(artItems).toHaveLength(20);
    for (const shopItem of artItems) {
      const artwork = shopArtworkOf(shopItem);
      expect(artwork, `${shopItem.id} artwork mapping`).toContain('/assets/pets/shop/');
      expect(existsSync(join(process.cwd(), 'public', artwork!.slice(1))), artwork).toBe(true);
    }
    const foodItems = SHOP_ITEMS.filter((shopItem) => shopItem.category === 'food');
    expect(foodItems.length).toBeGreaterThan(0);
    for (const foodItem of foodItems) expect(shopArtworkOf(foodItem)).toBeUndefined();
    const expectedBehind = ['acc-backpack', 'acc-cape', 'acc-wings'];
    for (const id of expectedBehind) expect(accessorySlotOf(item(id))).toBe('back');
    for (const shopItem of artItems.filter(
      (candidate) => candidate.id.startsWith('acc-') && !expectedBehind.includes(candidate.id),
    )) {
      expect(accessorySlotOf(shopItem)).not.toBe('back');
    }
  });

  it('đủ ảnh đứng cho mọi pet × stage và component dùng đúng từng URL', () => {
    const publicDir = join(process.cwd(), 'public');
    for (const pet of PET_DEFINITIONS) {
      for (const stage of EVOLUTION_STAGES) {
        const url = petArtworkUrl(pet.id, stage.stage);
        expect(url, `${pet.id} × ${stage.stage} URL`).toBeDefined();
        expect(existsSync(join(publicDir, url!.slice(1))), url).toBe(true);
        const { container, unmount } = renderAvatar([], stage.stage, pet.id);
        expect(
          container.querySelector(`img[src="${url}"]`),
          `${pet.id} × ${stage.stage}`,
        ).toBeInTheDocument();
        expect(container.querySelector('span[hidden]')).toBeInTheDocument();
        unmount();
      }
    }
  });

  it('图片载入失败时保留表情符号回退', () => {
    const { container } = renderAvatar();
    const image = container.querySelector<HTMLImageElement>(
      'img[src="/assets/pets/monkey-baby.webp"]',
    );
    expect(image).toBeInTheDocument();
    image!.dispatchEvent(new Event('error'));
    expect(image).toHaveProperty('hidden', true);
    expect(container.querySelector('span[hidden]')).not.toBeInTheDocument();
    expect(screen.getByText(petEmojiFor('monkey', 'baby'))).toBeInTheDocument();
  });

  it('mặc mũ ⇒ ảnh WebP được vẽ ở slot head, đáy vành chạm đúng trán', () => {
    const { container } = renderAvatar([item('acc-hat')]);
    const artwork = container.querySelector('img[src="/assets/pets/shop/acc-hat.webp"]');
    expect(artwork).toBeInTheDocument();
    expect(container.querySelector('span[hidden]')).toBeInTheDocument();

    // ⚠️ KHẲNG ĐỊNH THEO NEO, KHÔNG THEO MỘT CON SỐ CỨNG. Bản trước khoá vào `top-[-60%]` — đúng
    //    cho MỘT bảng dùng chung, và chính con số đó là lỗi chủ dự án báo ("mũ lơ lửng"). Nay mũ
    //    phải neo vào `head.top` của ĐÚNG con đang hiện ⇒ đỏ ngay nếu ai đó lắp lại bảng cứng.
    const box = inkBoxOf(container, 'acc-hat');
    const anchor = petAnchorFor('monkey', 'baby');
    expect(Math.abs(box.bottom - (anchor.head.top + HAT_DROP))).toBeLessThanOrEqual(0.02);
    expect(box.w).toBeGreaterThanOrEqual(1.15 * anchor.head.w);
    expect(box.w).toBeLessThanOrEqual(1.35 * anchor.head.w);
  });

  it('⭐ kính nằm ĐÚNG ĐƯỜNG MẮT và đúng cỡ — trên 3 con lệch nhau nhất', () => {
    // ⚠️ VÌ SAO BA CON NÀY: `monkey-baby` (cx 0,488 / mực rộng 60,7%), `cat-super` (cx 0,509),
    //    `dragon-baby` (cx 0,496 / mực rộng 66,8%) — bộ ba lệch nhau nhiều nhất về tâm thân và bề
    //    rộng mực. Một bảng neo DÙNG CHUNG sẽ trượt ở ít nhất một trong ba; bảng theo TỪNG ẢNH thì
    //    cả ba đều đúng. Đây là bài kiểm chứng trực tiếp cho lời chủ dự án: "đeo vào là sát vào mặt".
    for (const [petType, stage] of [
      ['monkey', 'baby'],
      ['cat', 'super'],
      ['dragon', 'baby'],
    ] as const) {
      const { container, unmount } = renderAvatar([item('acc-glasses')], stage, petType);
      const anchor = petAnchorFor(petType, stage);
      const box = inkBoxOf(container, 'acc-glasses');

      // Tâm kính trùng đường mắt / trục mắt, sai số ≤ 3% khoảng cách hai mắt.
      expect(
        Math.abs(box.cy - anchor.eyes.y),
        `${petType}: tâm kính lệch đường mắt`,
      ).toBeLessThanOrEqual(0.03 * anchor.eyes.w);
      expect(
        Math.abs(box.cx - anchor.eyes.cx),
        `${petType}: tâm kính lệch trục mắt`,
      ).toBeLessThanOrEqual(0.03 * anchor.eyes.w);
      // Cỡ MỰC nhìn thấy nằm trong dải chủ dự án chốt (1,55–1,75 × khoảng cách hai mắt).
      expect(box.w, `${petType}: kính quá nhỏ`).toBeGreaterThanOrEqual(1.55 * anchor.eyes.w);
      expect(box.w, `${petType}: kính quá to`).toBeLessThanOrEqual(1.75 * anchor.eyes.w);
      unmount();
    }
  });

  it('cả 9 ảnh đều hiện và wrapper stacking giữ mọi món back sau pet, slot trước pet', () => {
    const accessoryIds = [
      'acc-bow',
      'acc-hat',
      'acc-glasses',
      'acc-scarf',
      'acc-shoes',
      'acc-backpack',
      'acc-crown',
      'acc-cape',
      'acc-wings',
    ];
    for (const pet of PET_DEFINITIONS) {
      const wornItems = accessoryIds.map(item);
      for (const stage of EVOLUTION_STAGES) {
        const { container, unmount } = renderAvatar(wornItems, stage.stage, pet.id);
        expect(container.querySelectorAll('img[src^="/assets/pets/shop/acc-"]').length).toBe(9);
        const backWrapper = container.querySelector('[data-accessory-layer="behind"]');
        const frontWrapper = container.querySelector('[data-accessory-layer="front"]');
        const petLayer = container.querySelector('.z-\\[2\\]');
        expect(backWrapper).toHaveClass('absolute', 'inset-0', 'z-[1]');
        expect(frontWrapper).toHaveClass('absolute', 'inset-0', 'z-[3]');
        expect(petLayer).toHaveClass('relative', 'z-[2]');
        expect(backWrapper?.querySelector('.z-\\[1\\]')).toBeNull();
        expect(backWrapper?.contains(petLayer)).toBe(false);
        unmount();
      }
    }
  });

  it('nhiều món CÙNG một vị trí thì chồng lệch có giới hạn và giữ đủ nội dung', () => {
    renderAvatar([item('acc-bow'), item('acc-hat'), item('acc-crown')]);
    const headLayers = document.querySelectorAll('[data-accessory-id^="acc-"]');
    expect(headLayers).toHaveLength(3);
    expect(document.querySelector('[data-accessory-id="acc-bow"]')).toBeInTheDocument();
    expect(document.querySelector('[data-accessory-id="acc-hat"]')).toBeInTheDocument();
    expect(document.querySelector('[data-accessory-id="acc-crown"]')).toBeInTheDocument();
    for (const layer of headLayers) {
      expect(layer).toHaveClass('absolute', 'inset-0');
    }
    expect(screen.getByRole('img')).toHaveAccessibleName('Khỉ Momo đang dùng: Nơ, Mũ, Vương miện');
  });

  it('đồ trang trí truyền vào thì BỊ BỎ QUA (trang trí nay nằm trong "Góc phòng của bé")', () => {
    // ⚠️ ĐÃ XOÁ TEST CŨ: `renderAvatar([dec-balloon, dec-plant]); getByText('🎈')`.
    //    Nó KHÔNG chứng minh trang trí được VẼ — `ShopArtwork` luôn render một `<span hidden>` chứa
    //    emoji làm bản dự phòng khi ảnh lỗi, và `getByText` tìm được cả chữ trong `<span hidden>`.
    //    Nghĩa là test xanh kể cả khi hàng trang trí vẽ ra 0 phần tử — đúng trạng thái thật ở
    //    production (`PetHousePage` lọc `decorationSlotOf(item) !== null` khỏi `items`).
    //    Hành vi ĐÚNG nay là: PetAvatar không nhận/vẽ trang trí, và KHÔNG được nhắc tới chúng
    //    trong nhãn đọc lên (nhãn nói có mà mắt không thấy gì là một lời nói dối).
    renderAvatar([item('dec-balloon'), item('dec-plant')]);
    expect(screen.getByRole('img')).toHaveAccessibleName('Khỉ Momo đang chơi trong nhà');
    expect(screen.queryByText('🎈')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-accessory-id]')).toHaveLength(0);
  });

  it('đồ ăn truyền vào thì BỊ BỎ QUA (Momo không đội quả chuối)', () => {
    renderAvatar([item('food-banana')]);
    expect(screen.queryByText('🍌')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-accessory-id]')).toHaveLength(0);
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

  it('⚠️ đồ trang trí KHÔNG được đọc lên (không vẽ thì không được nói là có)', () => {
    // Trang trí nay nằm trong "Góc phòng của bé" — nhãn cũ "Quanh nhà có Bóng bay" nói về những
    // món KHÔNG hề được vẽ trong khối này. Nhãn sai chỗ này là bịa ra một sự thật thị giác.
    renderAvatar([item('dec-balloon')]);
    expect(screen.getByRole('img')).toHaveAccessibleName('Khỉ Momo đang chơi trong nhà');
  });

  it('cả phụ kiện lẫn trang trí ⇒ CHỈ đọc phần phụ kiện', () => {
    renderAvatar([item('acc-hat'), item('dec-plant')]);
    expect(screen.getByRole('img')).toHaveAccessibleName('Khỉ Momo đang dùng: Mũ');
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
  it('⭐ 每个pet × stage仍保留正确的表情回退', () => {
    for (const pet of PET_DEFINITIONS) {
      for (const stage of EVOLUTION_STAGES) {
        const { container, unmount } = renderAvatar([], stage.stage, pet.id);
        expect(container.querySelector('span[hidden]')).toHaveTextContent(
          petEmojiFor(pet.id, stage.stage),
        );
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
    expect(
      shopItemsFileSchema.safeParse(fileWith({ category: 'food', slot: 'head' })).success,
    ).toBe(false);
  });

  it('đồ ăn KHÔNG có vị trí ⇒ qua (đó mới là trạng thái đúng)', () => {
    expect(shopItemsFileSchema.safeParse(fileWith({ category: 'food' })).success).toBe(true);
  });
});

// =============================================================================
// 6. Canh giữ TỆP ẢNH — manifest và đĩa phải khớp NHAU theo CẢ HAI CHIỀU
// =============================================================================

/**
 * ⚠️ VÌ SAO KHÔNG CHỈ "existsSync trên manifest là đủ":
 *   `existsSync` bắt được "manifest trỏ tới tệp không tồn tại", nhưng KHÔNG bắt được chiều ngược
 *   lại — thêm một tệp ảnh mới vào đĩa mà quên khai vào manifest (ảnh không bao giờ hiện trên Momo),
 *   hoặc xoá tệp nhưng manifest còn sót. Hai lượt kiểm dưới so khớp TẬP HỢP hai chiều, nên mọi
 *   sai lệch đều ĐỎ. Chúng cũng chốt định dạng `.webp`: quay lại `.png` là đỏ ngay, vì app đã
 *   chuyển sang WebP 512px (trước đây PNG 1024px nặng ~48 MB cho 38 ảnh).
 */
describe('PetAvatar — canh giữ tệp ảnh trên đĩa (WebP 512px)', () => {
  const publicDir = join(process.cwd(), 'public');
  const abs = (url: string) => join(publicDir, url.slice(1));
  const basenamesIn = (dir: string, ext: string) =>
    readdirSync(join(publicDir, dir))
      .filter((f) => f.endsWith(ext))
      .sort();

  function petArtworkUrls(): string[] {
    const urls: string[] = [];
    for (const pet of PET_DEFINITIONS) {
      for (const stage of EVOLUTION_STAGES) {
        const url = petArtworkUrl(pet.id, stage.stage);
        expect(url, `${pet.id} × ${stage.stage} thiếu URL`).toBeDefined();
        urls.push(url!);
      }
    }
    return urls;
  }

  function shopArtworkUrls(): string[] {
    return SHOP_ITEMS.filter((i) => i.category === 'accessory' || i.category === 'decoration').map(
      (i) => {
        const url = shopArtworkOf(i);
        expect(url, `${i.id} thiếu URL artwork`).toBeDefined();
        return url!;
      },
    );
  }

  it('MỌI URL thú cưng là .webp và trỏ tới tệp CÓ THẬT', () => {
    const urls = petArtworkUrls();
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url, `${url} phải là .webp`).toMatch(/\.webp$/);
      expect(existsSync(abs(url)), `${url} KHÔNG tồn tại trên đĩa`).toBe(true);
    }
  });

  it('MỌI URL cửa hàng là .webp và trỏ tới tệp CÓ THẬT', () => {
    const urls = shopArtworkUrls();
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url, `${url} phải là .webp`).toMatch(/\.webp$/);
      expect(existsSync(abs(url)), `${url} KHÔNG tồn tại trên đĩa`).toBe(true);
    }
  });

  it('⚠️ đĩa và manifest KHỚP từng tên (không thừa, không thiếu)', () => {
    const petManifest = petArtworkUrls()
      .map((u) => u.split('/').pop()!)
      .sort();
    expect(basenamesIn('assets/pets', '.webp')).toEqual(petManifest);

    const shopManifest = shopArtworkUrls()
      .map((u) => u.split('/').pop()!)
      .sort();
    expect(basenamesIn('assets/pets/shop', '.webp')).toEqual(shopManifest);
  });

  it('⚠️ KHÔNG còn tệp .png sót lại trong thư mục pets (đã chuyển hẳn sang WebP)', () => {
    expect(basenamesIn('assets/pets', '.png')).toEqual([]);
    expect(basenamesIn('assets/pets/shop', '.png')).toEqual([]);
  });
});

// =============================================================================
// 7. Khăn quàng bị ÉP DẸT — hộp không còn luôn vuông
// =============================================================================

/**
 * ⚠️⚠️ TEST NÀY KHOÁ MỘT CHI TIẾT DỄ BỊ "SỬA LẠI CHO GỌN".
 *
 * `accessoryBox('neck', …)` trả `squashY` (0,7 cho khăn). Component PHẢI dùng nó cho chiều cao hộp.
 * Ai đó "dọn dẹp" đổi `height: side * squashY` về `height: side` (cho khớp `width`) thì:
 *   • test này ĐỎ ngay, thay vì
 *   • mắt bé thấy cục len phủ kín ngực như trước bản vá, và CI vẫn xanh.
 *
 * Đọc `height` THẲNG TỪ DOM (không suy từ `width`) — vì đúng cái cần kiểm là hai số đó KHÁC nhau.
 */
describe('PetAvatar — khăn quàng bị ép dẹt theo chiều dọc', () => {
  it('⚠️ hộp khăn có `height` = `width × squashY` (không phải hộp vuông)', () => {
    const { container } = renderAvatar([item('acc-scarf')]);
    const box = inkBoxOf(container, 'acc-scarf');

    expect(box.squashY).toBeCloseTo(ACCESSORY_SQUASH.neck, 6);
    expect(box.height).toBeLessThan(box.side);
  });

  it('mọi kiểu đặt KHÁC vẫn giữ hộp VUÔNG (không méo mũ, kính, giày, ba lô)', () => {
    const square = ['acc-hat', 'acc-glasses', 'acc-shoes', 'acc-backpack', 'acc-crown', 'acc-bow'];
    const { container } = renderAvatar(square.map(item));

    for (const id of square) {
      const box = inkBoxOf(container, id);
      expect(box.squashY, `${id} phải vuông`).toBeCloseTo(1, 6);
      expect(box.height, `${id} cao = rộng`).toBeCloseTo(box.side, 6);
    }
  });
});
