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
  ACCESSORY_SCALE,
  accessoryBox,
  accessoryFitOf,
  DEFAULT_ACCESSORY_INK,
  defaultKindForSlot,
  fitSize,
  type AccessoryFitKind,
} from '@/lib/accessoryFit.js';
import { DEFAULT_PET_ANCHOR, PET_ANCHORS, petAnchorFor, type PetAnchor } from '@/lib/petAnchors.js';
import { EVOLUTION_STAGES } from '@shared/content/levels.js';
import { PET_DEFINITIONS } from '@shared/content/pets.js';

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
function inkOf(box: { cx: number; cy: number; side: number }, ink: typeof DEFAULT_ACCESSORY_INK) {
  return {
    cx: box.cx + (ink.cx - 0.5) * box.side,
    cy: box.cy + (ink.cy - 0.5) * box.side,
    w: ink.w * box.side,
    h: ink.h * box.side,
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

  it('⭐ MŨ/VƯƠNG MIỆN: đáy vành nằm dưới `head.top` đúng một hằng số, tâm x = `head.cx`', () => {
    for (const id of ['acc-hat', 'acc-crown']) {
      const fit = accessoryFitOf(id)!;
      for (const [key, anchor] of Object.entries(PET_ANCHORS) as [string, PetAnchor][]) {
        const box = accessoryBox(fit.kind, anchor, fit.ink);
        const ink = inkOf(box, fit.ink);
        expect(ink.cx, `${id} trên ${key}`).toBeCloseTo(anchor.head.cx, 10);
        expect(ink.cy + ink.h / 2, `${id} trên ${key}`).toBeGreaterThan(anchor.head.top);
        expect(ink.cy + ink.h / 2, `${id} trên ${key}`).toBeLessThan(anchor.eyes.y);
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
