/**
 * Canh giữ BẢNG NEO THEO TỪNG ẢNH (`src/lib/petAnchors.ts`) + công thức đặt phụ kiện
 * (`src/lib/accessoryFit.ts`).
 *
 * ⭐⭐ VÌ SAO NHÓM 1 ĐỌC ĐĨA THẬT:
 *   Lỗi chủ dự án báo (*"mua cái mắt kính, đeo vào là sát vào mặt"*) có gốc là HAI BẢNG HẰNG SỐ
 *   DÙNG CHUNG cho 18 ảnh. Cách sửa là bảng theo TỪNG ẢNH — mà bảng đó chỉ đúng nếu nó **khớp
 *   từng tệp ảnh trên đĩa**. Thêm một con mới vào `public/assets/pets/` mà quên neo ⇒ phụ kiện của
 *   con đó rơi vào `DEFAULT_PET_ANCHOR` (vẫn vẽ, nhưng lệch) và KHÔNG có gì đỏ. Test dưới đối chiếu
 *   HAI CHIỀU với đĩa, đúng khuôn mẫu đã dùng cho manifest ảnh.
 *
 * ⭐ NHÓM 2 KIỂM "NEO CÓ TỰ NHẤT QUÁN KHÔNG" — những bất biến mà số đo sai sẽ vi phạm:
 *   `head.top < eyes.y < head.bottom` (mắt phải nằm trong đầu) và `feet.y > torso.bottom`
 *   (chân phải dưới thân). Một neo vi phạm hai điều này là một neo chép nhầm.
 *
 * ⭐ NHÓM 3 KIỂM CÔNG THỨC: `fitSize` là "cỡ hộp = mục tiêu mực / tỷ lệ mực" — nhờ nó món đồ nhìn
 *   đúng cỡ dù ảnh nền trong suốt nhiều hay ít. Và `torso.cx` phải là TÂM của món sau lưng (lỗi cũ:
 *   ba lô lệch trái 42% bề rộng hộp).
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ACCESSORY_FIT,
  ACCESSORY_MIRRORED,
  ACCESSORY_SCALE,
  ACCESSORY_SQUASH,
  CROWN_DROP,
  HEADPIECE_DROP,
  SCARF_TOP_DROP,
  accessoryBox,
  accessoryBoxes,
  accessoryFitOf,
  DEFAULT_ACCESSORY_INK,
  defaultKindForSlot,
  fitSize,
  type AccessoryFitKind,
} from '@/lib/accessoryFit.js';
import {
  DEFAULT_PET_ANCHOR,
  PET_ANCHORS,
  feetSplitFor,
  petAnchorFor,
  type PetAnchor,
} from '@/lib/petAnchors.js';
import { EVOLUTION_STAGES } from '@shared/content/levels.js';
import { PET_DEFINITIONS } from '@shared/content/pets.js';
import type { EvolutionStage, PetType } from '@shared/types/reward.js';

const PUBLIC_DIR = join(process.cwd(), 'public');
const PETS_DIR = join(PUBLIC_DIR, 'assets', 'pets');

/** Khoá neo suy TỪ ĐĨA: `monkey-baby.webp` ⇒ `monkey:baby`. */
function anchorKeysOnDisk(): string[] {
  return readdirSync(PETS_DIR)
    .filter((file) => file.endsWith('.webp'))
    .map((file) => file.replace(/\.webp$/, '').replace('-', ':'))
    .sort();
}

const KINDS: readonly AccessoryFitKind[] = ['face', 'hat', 'crown', 'bow', 'neck', 'feet', 'back'];

/** Tâm/bề rộng MỰC của một hộp phụ kiện (0..1 của hộp `1em`). */
/**
 * Hộp MỰC NHÌN THẤY suy từ hộp ảnh — dùng CHÍNH công thức mà component dùng.
 *
 * ⚠️ `squashY` phải có mặt: hộp không còn luôn vuông (khăn quàng bị ép dẹt dọc). Bỏ qua nó là
 *    test xanh trong khi mắt bé vẫn thấy cục len phủ kín ngực — đúng loại "test nói dối".
 */
function inkOf(
  box: { cx: number; cy: number; side: number; squashY?: number },
  ink: typeof DEFAULT_ACCESSORY_INK,
) {
  const sy = box.squashY ?? 1;
  const h = box.side * sy;
  return {
    cx: box.cx + (ink.cx - 0.5) * box.side,
    cy: box.cy + (ink.cy - 0.5) * h,
    w: ink.w * box.side,
    h: ink.h * h,
  };
}

// =============================================================================
// 1. Bảng neo khớp ĐĨA ẢNH (hai chiều) — không con nào bị bỏ quên
// =============================================================================

describe('petAnchors — canh giữ bảng neo theo từng ảnh', () => {
  it('⚠️ khoá neo KHỚP TỪNG TỆP ảnh thú cưng trên đĩa (không thừa, không thiếu)', () => {
    const onDisk = anchorKeysOnDisk();
    expect(onDisk.length).toBe(18);
    expect(Object.keys(PET_ANCHORS).sort()).toEqual(onDisk);
  });

  it('mọi cặp (con × bậc) của app đều có neo, và ảnh của nó CÓ THẬT', () => {
    const expected: string[] = [];
    for (const pet of PET_DEFINITIONS) {
      for (const stage of EVOLUTION_STAGES) {
        expected.push(`${pet.id}:${stage.stage}`);
        expect(
          existsSync(join(PETS_DIR, `${pet.id}-${stage.stage}.webp`)),
          `${pet.id}-${stage.stage}.webp thiếu`,
        ).toBe(true);
      }
    }
    expect(Object.keys(PET_ANCHORS).sort()).toEqual(expected.sort());
  });

  it('thiếu neo ⇒ LÙI về rig mặc định, KHÔNG ném lỗi', () => {
    // Ném lỗi ở đây là trắng cả ô "Nhà thú cưng" của bé vì một bảng số nội bộ.
    expect(petAnchorFor('monkey', 'baby')).toBe(PET_ANCHORS['monkey:baby']);
    expect(PET_ANCHORS['khong:ton-tai']).toBeUndefined();
    expect(petAnchorFor('cat', 'super')).toBe(PET_ANCHORS['cat:super']);
  });
});

// =============================================================================
// 2. Bất biến hình học — số chép nhầm sẽ vi phạm
// =============================================================================

describe('petAnchors — bất biến của từng neo', () => {
  const entries = Object.entries(PET_ANCHORS) as [string, PetAnchor][];

  it('mọi số nằm trong 0..1', () => {
    for (const [key, anchor] of entries) {
      for (const section of ['head', 'eyes', 'neck', 'torso', 'feet'] as const) {
        for (const [field, value] of Object.entries(anchor[section])) {
          expect(typeof value, `${key}.${section}.${field}`).toBe('number');
          expect(value, `${key}.${section}.${field}`).toBeGreaterThanOrEqual(0);
          expect(value, `${key}.${section}.${field}`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('⚠️ mắt nằm TRONG ĐẦU: head.top < eyes.y < head.bottom', () => {
    for (const [key, anchor] of entries) {
      expect(anchor.head.top, `${key}`).toBeLessThan(anchor.eyes.y);
      expect(anchor.eyes.y, `${key}`).toBeLessThan(anchor.head.bottom);
    }
  });

  it('⚠️ đầu nằm TRÊN cổ, cổ nằm TRÊN thân, chân nằm DƯỚI thân', () => {
    for (const [key, anchor] of entries) {
      expect(anchor.head.bottom, `${key}`).toBeLessThanOrEqual(anchor.neck.y);
      expect(anchor.neck.y, `${key}`).toBeLessThanOrEqual(anchor.torso.top);
      expect(anchor.torso.top, `${key}`).toBeLessThan(anchor.torso.bottom);
      expect(anchor.feet.y, `${key}`).toBeGreaterThan(anchor.torso.bottom);
    }
  });

  it('⚠️ bề rộng dương và tâm nằm trong khung — nếu không, hộp phụ kiện sẽ âm/rỗng', () => {
    for (const [key, anchor] of entries) {
      for (const section of ['head', 'eyes', 'neck', 'torso', 'feet'] as const) {
        expect(anchor[section].w, `${key}.${section}.w`).toBeGreaterThan(0);
        expect(anchor[section].cx, `${key}.${section}.cx`).toBeGreaterThan(0.2);
        expect(anchor[section].cx, `${key}.${section}.cx`).toBeLessThan(0.8);
      }
    }
  });

  it('⚠️ 18 con KHÁC NHAU thật — đó là lý do phải có bảng theo từng ảnh', () => {
    // Nếu tất cả `eyes.y` bằng nhau thì một bảng dùng chung đã đủ, và lời chủ dự án báo ("sát vào
    // mặt") sẽ không giải thích được. Đây là bằng chứng ngược lại: phương sai là THẬT.
    const eyeYs = entries.map(([, anchor]) => anchor.eyes.y);
    const eyeWs = entries.map(([, anchor]) => anchor.eyes.w);
    expect(Math.max(...eyeYs) - Math.min(...eyeYs)).toBeGreaterThan(0.1);
    expect(Math.max(...eyeWs) - Math.min(...eyeWs)).toBeGreaterThan(0.05);
  });
});

// =============================================================================
// 3. Công thức đặt phụ kiện
// =============================================================================

describe('accessoryFit — fitSize và accessoryBox', () => {
  it('fitSize: cỡ hộp = mục tiêu mực / tỷ lệ mực (mực đầy hộp ⇒ hộp = mục tiêu)', () => {
    expect(fitSize(0.5, 1)).toBeCloseTo(0.5, 10);
    expect(fitSize(0.5, 0.5)).toBeCloseTo(1, 10);
    // Vương miện "thưa" (72,5%) phải được phóng hộp to hơn kính "đầy" (93,4%) để MỰC bằng nhau.
    expect(fitSize(0.5, ACCESSORY_FIT['acc-crown']!.ink.w)).toBeGreaterThan(
      fitSize(0.5, ACCESSORY_FIT['acc-glasses']!.ink.w),
    );
  });

  it('⚠️ tỷ lệ mực 0 hoặc âm ⇒ KHÔNG chia cho 0 (ô CSS `Infinity%` phá cả lớp vẽ)', () => {
    expect(fitSize(0.5, 0)).toBe(0.5);
    expect(fitSize(0.5, -1)).toBe(0.5);
  });

  it('mọi món phụ kiện trong bảng đều 512px ⇒ tỷ lệ mực trong (0, 1]', () => {
    for (const [id, fit] of Object.entries(ACCESSORY_FIT)) {
      for (const field of ['w', 'h'] as const) {
        expect(fit.ink[field], `${id}.${field}`).toBeGreaterThan(0);
        expect(fit.ink[field], `${id}.${field}`).toBeLessThanOrEqual(1);
      }
      for (const field of ['cx', 'cy'] as const) {
        expect(fit.ink[field], `${id}.${field}`).toBeGreaterThan(0.2);
        expect(fit.ink[field], `${id}.${field}`).toBeLessThan(0.8);
      }
    }
  });

  it('⭐ KÍNH: tâm mực TRÙNG ĐƯỜNG MẮT và cỡ mực đúng hệ số đã chốt', () => {
    for (const [key, anchor] of Object.entries(PET_ANCHORS) as [string, PetAnchor][]) {
      const fit = ACCESSORY_FIT['acc-glasses']!;
      const ink = inkOf(accessoryBox('face', anchor, fit.ink), fit.ink);
      expect(ink.cx, key).toBeCloseTo(anchor.eyes.cx, 10);
      expect(ink.cy, key).toBeCloseTo(anchor.eyes.y, 10);
      expect(ink.w, key).toBeCloseTo(ACCESSORY_SCALE.face * anchor.eyes.w, 10);
    }
  });

  it('⭐ BA LÔ/ÁO CHOÀNG/CÁNH: tâm x = `torso.cx` (sửa lỗi lệch trái 42% hộp)', () => {
    for (const id of ['acc-backpack', 'acc-cape', 'acc-wings']) {
      const fit = accessoryFitOf(id)!;
      expect(fit.kind).toBe('back');
      for (const [key, anchor] of Object.entries(PET_ANCHORS) as [string, PetAnchor][]) {
        const ink = inkOf(accessoryBox('back', anchor, fit.ink), fit.ink);
        expect(ink.cx, `${id} trên ${key}`).toBeCloseTo(anchor.torso.cx, 10);
        expect(ink.w, `${id} trên ${key}`).toBeCloseTo(ACCESSORY_SCALE.back * anchor.torso.w, 10);
      }
    }
  });

  it('⭐ MŨ/VƯƠNG MIỆN: đáy vành theo TỈ LỆ chiều cao đầu, và LUÔN còn trên đường mắt', () => {
    /*
      ⚠️⚠️ HAI KHẲNG ĐỊNH, VÌ MỘT MÌNH KHẲNG ĐỊNH "theo tỉ lệ" LÀ KHÔNG ĐỦ:
      chiều cao đầu của 18 con chênh nhau **1,8 lần** (0,225 ở tiger/rồng adult → 0,400 ở khỉ
      baby). Một số TUYỆT ĐỐI không thể đúng cho cả hai đầu mút — đã thử cả hai và cả hai đều sai:
        • 0,06 (số cho ảnh sản phẩm) ⇒ mũ BAY LƠ LỬNG ở con đầu to;
        • 0,10 (số cho ảnh chính diện) ⇒ vành mũ TRÙM XUỐNG DƯỚI MẮT ở `tiger:adult`.
      Nên: đo bằng TỈ LỆ, và KHOÁ thêm điều kiện "vành còn trên mắt" để không tái diễn vế thứ hai.
    */
    for (const id of ['acc-hat', 'acc-crown']) {
      const fit = accessoryFitOf(id)!;
      const ratio = fit.kind === 'hat' ? HEADPIECE_DROP : CROWN_DROP;
      for (const [key, anchor] of Object.entries(PET_ANCHORS) as [string, PetAnchor][]) {
        const box = accessoryBox(fit.kind, anchor, fit.ink);
        const ink = inkOf(box, fit.ink);
        expect(ink.cx, `${id} trên ${key}`).toBeCloseTo(anchor.head.cx, 10);
        // Đáy vành = head.top + tỉ lệ × chiều cao đầu.
        const headH = anchor.head.bottom - anchor.head.top;
        expect(ink.cy + ink.h / 2, `${id} trên ${key}`).toBeCloseTo(
          anchor.head.top + ratio * headH,
          6,
        );
        // ⚠️ VÀ: vành phải CÒN TRÊN ĐƯỜNG MẮT — nếu không là mũ che mắt bé.
        expect(ink.cy + ink.h / 2, `${id} trên ${key} che mắt?`).toBeLessThan(anchor.eyes.y);
      }
    }
  });

  it('⚠️ MỌI kiểu đặt × MỌI neo: hộp phải HỮU HẠN và nằm quanh khung (-1..2)', () => {
    // Một `NaN`/`Infinity` lọt vào `style` là lớp vẽ biến mất trong im lặng. Neo lùi (`eyesEstimated`
    // hay món lạ) cũng phải đi qua lưới này.
    for (const anchor of [...Object.values(PET_ANCHORS), DEFAULT_PET_ANCHOR]) {
      for (const kind of KINDS) {
        const box = accessoryBox(kind, anchor, DEFAULT_ACCESSORY_INK);
        for (const value of [box.cx, box.cy, box.side]) {
          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThan(-1);
          expect(value).toBeLessThan(2);
        }
        expect(box.side).toBeGreaterThan(0.05);
      }
    }
  });

  it('món CHƯA KHAI tỷ lệ ⇒ vẫn có kiểu đặt theo slot (không món nào biến mất)', () => {
    expect(accessoryFitOf('acc-khong-ton-tai')).toBeUndefined();
    expect(defaultKindForSlot('head')).toBe('hat');
    expect(defaultKindForSlot('face')).toBe('face');
    expect(defaultKindForSlot('neck')).toBe('neck');
    expect(defaultKindForSlot('feet')).toBe('feet');
    expect(defaultKindForSlot('back')).toBe('back');
    // Hộp của một món lạ vẫn tính được bằng mực mặc định.
    const box = accessoryBox('hat', DEFAULT_PET_ANCHOR, DEFAULT_ACCESSORY_INK);
    expect(Number.isFinite(box.side)).toBe(true);
  });
});

// =============================================================================
// 4. Mặc phụ kiện lên con vật — hai lỗi chủ dự án báo, và cách sửa ĐÚNG
// =============================================================================

/**
 * ⚠️⚠️ NHÓM NÀY KHOÁ LẠI HAI LỖI ĐÃ NHÌN THẤY TRÊN ẢNH THẬT. Cả hai đều thuộc loại "không có lỗi
 *   biên dịch, không có cảnh báo lint, ảnh nhỏ thì trông tạm được".
 *
 *   Lịch sử sửa (ghi lại vì đã đi qua 2 vòng, đừng lặp lại vòng 1):
 *
 *   VÒNG 1 — vá CÔNG THỨC (vẫn giữ art cũ, ảnh CHỤP SẢN PHẨM góc 3/4 từ trên xuống):
 *     • giày: `ACCESSORY_SCALE.feet` 0,675 → 0,95 (đôi giày kéo giãn cho trùm hai bàn chân)
 *     • khăn: `ACCESSORY_SQUASH.neck = 0,70` (ép dẹt vòng khăn thành dải ôm cổ)
 *     Vá này CHẠY ĐƯỢC, nhưng chỉ là chữa triệu chứng: giày vẫn là "một khối dồn vào giữa", khăn
 *     vẫn là một tấm vải dẹt chứ không phải khăn quàng.
 *
 *   VÒNG 2 — VẼ LẠI ART (chủ dự án gửi ảnh mẫu và duyệt 5 ảnh): 5 ảnh được vẽ ở góc "ĐANG MẶC".
 *     • `acc-shoes` nay là **MỘT CHIẾC** ⇒ vẽ hai lần, lật gương (`ACCESSORY_MIRRORED`)
 *     • `acc-scarf` nay là dây len quấn quanh cổ ⇒ bỏ ép dẹt (`ACCESSORY_SQUASH.neck` về 1)
 *     • `acc-hat` chính diện, `acc-backpack` có quai, `acc-wings` chính diện
 */
describe('accessoryFit — mặc phụ kiện lên con vật', () => {
  it('⚠️ GIÀY: vẽ HAI LẦN, mỗi bàn chân một chiếc, lần thứ hai LẬT GƯƠNG', () => {
    // Giày phải nằm trong danh sách "vẽ hai lần" — thiếu dòng này thì bé chỉ có giày ở chân trái.
    expect(ACCESSORY_MIRRORED['acc-shoes']).toBe(true);

    for (const [key, anchor] of Object.entries(PET_ANCHORS) as [string, PetAnchor][]) {
      const fit = ACCESSORY_FIT['acc-shoes']!;
      const split = feetSplitFor(...(key.split(':') as [PetType, EvolutionStage]));
      const placements = accessoryBoxes('acc-shoes', 'feet', anchor, fit.ink, split);

      // Đúng HAI chiếc, một chiếc lật gương.
      expect(placements.length, key).toBe(2);
      expect(placements[0]!.mirror, key).toBe(false);
      expect(placements[1]!.mirror, key).toBe(true);

      const [l, r] = placements;
      const li = inkOf(l!.box, fit.ink);
      const ri = inkOf(r!.box, fit.ink);

      // ⭐ MỖI CHIẾC nằm trên ĐÚNG bàn chân của nó — không phải cả hai dồn vào giữa.
      expect(li.cx, `${key} giày trái`).toBeCloseTo(split.left.cx, 6);
      expect(ri.cx, `${key} giày phải`).toBeCloseTo(split.right.cx, 6);
      // Chiếc trái phải nằm BÊN TRÁI chiếc phải (nếu không, ảnh đã bị lật nhầm).
      expect(li.cx, `${key} thứ tự trái–phải`).toBeLessThan(ri.cx);

      /*
        ⚠️ HAI CHIẾC ĐƯỢC PHÉP CHỒNG NHAU MỘT CHÚT — đó là cách bàn chân thật trông ở góc chính
        diện, và cũng đúng như ảnh mẫu của chủ dự án. Thứ KHÔNG được phép là "cả hai dồn vào giữa"
        (lỗi cũ): khi đó hai chiếc trùng khít nhau. Khoá bằng TỈ LỆ chồng lấn.
      */
      const overlap = li.cx + li.w / 2 - (ri.cx - ri.w / 2);
      expect(overlap, `${key} chồng lấn`).toBeLessThan(0.4 * li.w);
      // Và hai chiếc phải CÁCH NHAU thật sự, không nằm đè lên nhau.
      expect(ri.cx - li.cx, `${key} khoảng cách hai giày`).toBeGreaterThan(0.4 * li.w);

      /*
        ⭐ CỠ: mỗi chiếc giày rộng 1,9 × bàn chân (giày phủ qua mắt cá, thừa ra hai bên như giày
        thật). Biên dưới 1,3 là CỐ Ý — dưới mức đó giày nhỏ hơn bàn chân, thấy ngay bằng mắt.
      */
      expect(li.w / split.left.w, `${key} cỡ giày`).toBeCloseTo(ACCESSORY_SCALE.feet, 6);
      expect(li.w / split.left.w, `${key} cỡ giày`).toBeGreaterThan(1.3);
      // Đáy giày phải nằm quanh bàn chân, không lơ lửng trên hay tụt xuống dưới hộp.
      expect(li.cy + li.h / 2, `${key} đáy giày`).toBeGreaterThan(anchor.feet.y - 0.05);
      expect(li.cy + li.h / 2, `${key} đáy giày`).toBeLessThan(anchor.feet.y + 0.15);
    }
  });

  it('⚠️ KHĂN: MÉP TRÊN nằm ngay dưới cao độ cổ, và KHÔNG ép dẹt nữa (art đã đúng góc)', () => {
    // Art mới vẽ ở góc đang mặc ⇒ ép dẹt là BÓP MÉO một ảnh vốn đã đúng.
    for (const kind of KINDS) {
      expect(ACCESSORY_SQUASH[kind], kind).toBe(1);
    }

    for (const [key, anchor] of Object.entries(PET_ANCHORS) as [string, PetAnchor][]) {
      const fit = ACCESSORY_FIT['acc-scarf']!;
      const ink = inkOf(accessoryBox('neck', anchor, fit.ink), fit.ink);
      // Mép TRÊN mực = `neck.y + SCARF_TOP_DROP` ⇒ vòng khăn quàng đúng cổ, không trùm lên mặt.
      expect(ink.cy - ink.h / 2, `${key} mép trên khăn`).toBeCloseTo(anchor.neck.y + SCARF_TOP_DROP, 6);
      // Mép trên phải THẤP HƠN đường mắt ⇒ khăn không bao giờ che mặt.
      expect(ink.cy - ink.h / 2, `${key} khăn che mặt?`).toBeGreaterThan(anchor.eyes.y);
    }
  });

  it('món KHÔNG khai "vẽ hai lần" ⇒ vẫn đúng MỘT hộp (không nhân đôi mũ, kính, ba lô)', () => {
    for (const [id, fit] of Object.entries(ACCESSORY_FIT)) {
      if (ACCESSORY_MIRRORED[id] === true) continue;
      const placements = accessoryBoxes(id, fit.kind, DEFAULT_PET_ANCHOR, fit.ink, {
        left: { cx: 0.4, w: 0.1 },
        right: { cx: 0.6, w: 0.1 },
      });
      expect(placements.length, id).toBe(1);
      expect(placements[0]!.mirror, id).toBe(false);
    }
  });

  it('⚠️ thiếu dữ liệu chân ⇒ giày VẪN HIỆN (lùi về tỉ lệ trung bình, không ném lỗi)', () => {
    // `feet` bỏ trống = đường lùi của người gọi. Món phải vẫn vẽ, chỉ kém chính xác.
    const placements = accessoryBoxes(
      'acc-shoes',
      'feet',
      DEFAULT_PET_ANCHOR,
      ACCESSORY_FIT['acc-shoes']!.ink,
      undefined,
    );
    expect(placements.length).toBe(1);
    for (const p of placements) {
      expect(Number.isFinite(p.box.cx)).toBe(true);
      expect(Number.isFinite(p.box.cy)).toBe(true);
      expect(p.box.side).toBeGreaterThan(0.05);
    }
  });

  it('⚠️ `feetSplitFor` phủ ĐỦ 18 con và tự lùi khi thiếu (không con nào mất giày)', () => {
    for (const key of Object.keys(PET_ANCHORS)) {
      const [petType, stage] = key.split(':') as [PetType, EvolutionStage];
      const split = feetSplitFor(petType, stage);
      expect(split.left.cx, `${key} chân trái`).toBeGreaterThan(0.2);
      expect(split.right.cx, `${key} chân phải`).toBeLessThan(0.8);
      expect(split.left.cx, `${key} trái < phải`).toBeLessThan(split.right.cx);
    }
    // Con không có trong bảng ⇒ suy từ `feet` (KHÔNG ném lỗi).
    const fallback = feetSplitFor('unicorn' as PetType, 'baby');
    expect(Number.isFinite(fallback.left.cx)).toBe(true);
    expect(Number.isFinite(fallback.right.cx)).toBe(true);
  });
});
