/**
 * RubyLingo — TỶ LỆ "MỰC THẬT / HỘP" CỦA 10 ẢNH PHỤ KIỆN + công thức đặt phụ kiện lên neo.
 *
 * ⭐ VẤN ĐỀ ĐƯỢC GIẢI Ở ĐÂY:
 *   10 ảnh phụ kiện đều 512×512 nhưng ĐỘ "ĐẦY" khác nhau rất xa:
 *     `acc-crown` mực chỉ chiếm 72,5%W × 50,4%H, trong khi `acc-star-glasses` chiếm 97,7% × 40,0%.
 *   Vẽ cùng một hộp `1em`, chiếc vương miện trông nhỏ hơn chiếc kính gần 1,3 lần — dù cùng một
 *   "cỡ". Vì vậy mọi cỡ ở đây là **CỠ MỰC NHÌN THẤY**, rồi quy ra cỡ hộp:
 *
 *     hộp = mục tiêu mực / tỷ lệ mực       (`fitSize`)
 *
 *   nhờ đó đổi ảnh phụ kiện (mực đầy hay thưa) KHÔNG làm món đồ to nhỏ khác đi.
 *
 * ⚠️ HỆ TOẠ ĐỘ: 0..1 theo HỘP ẢNH phụ kiện (= hộp vuông `1em` lúc render, vì `object-contain`
 *   trên ảnh vuông lấp đầy hộp). `ink.cx`/`ink.cy` là TÂM MỰC trong hộp ảnh — chúng khác 0,5
 *   (khăn 0,507; giày 0,509) nên phải trừ đi khi canh tâm mực vào neo.
 *
 * ⚠️ HỆ SỐ TỶ LỆ (lấy giữa dải chủ dự án chốt, trừ hai chỗ ghi rõ bên dưới):
 *   face  1,65 × `eyes.w` (dải 1,55–1,75)      — tâm = đường mắt
 *   hat   1,25 × `head.w` (dải 1,15–1,35)      — ĐÁY VÀNH = `head.top + 0,06`
 *   crown 1,15 × `head.w` (dải 1,05–1,25)      — như mũ
 *   bow   0,65 × `head.w` (dải 0,55–0,75)      — lệch sang TRÁI, cách mép 22,5% `head.w`
 *   neck  0,95 × `head.w` (dải 0,95–1,15)      — MÉP TRÊN mực = `neck.y − 0,04`
 *   feet  0,675 × `feet.w` (dải 0,60–0,75)     — tâm = `feet.y`
 *   back  1,425 × `torso.w` (dải 1,30–1,55)    — tâm x = `torso.cx` (sửa lỗi lệch trái 42%)
 *
 *   ⚠️ HAI CHỖ LỆCH SO VỚI "đáy vành = head.top + 0,03" VÀ "khăn: tâm y = neck.y" — có lý do, đo
 *      bằng cách dựng thử composite trước khi viết React (`_verify/pet-probe/compose_preview.py`):
 *      • MŨ `head.top + 0,03`: mực của `acc-hat` là 94,1%W × 54,7%H — vành nằm ở ĐÁY ảnh. Đo ở
 *        `head.top + 0,03` thì mũ bay lơ lửng trên đỉnh đầu (đo trên ảnh dựng thử: hở ~0,03 hộp).
 *        `+ 0,06` cho vành chạm đúng trán ở mọi con đã xem.
 *      • KHĂN "tâm y = neck.y": mực `acc-scarf` là 70,9%W × 69,5%H — KHĂN CÓ VÒNG ở trên và hai
 *        ĐUÔI rủ xuống. Canh TÂM mực vào cổ thì vòng khăn trùm lên MẶT (dựng thử: che hết mắt/mũi).
 *        Canh MÉP TRÊN mực vào cổ thì vòng khăn quàng đúng cổ, đuôi rủ xuống ngực.
 *   Hai con số còn lại vẫn nằm trong dải chủ dự án chốt.
 *
 * ⚠️ LÙI AN TOÀN: món chưa có số ⇒ mực coi như 100% hộp (`DEFAULT_ACCESSORY_INK`) và kiểu đặt
 *   suy từ `slot` (`defaultKindForSlot`). Món vẫn HIỆN, chỉ kém chuẩn — không được biến mất.
 */

import type { AccessorySlot } from '@shared/types/reward.js';

import type { PetAnchor } from './petAnchors.js';

/** Tỷ lệ mực (pixel không trong suốt) của ảnh phụ kiện, 0..1, theo hộp ảnh vuông. */
export interface AccessoryInk {
  /** mực rộng / hộp ảnh (nguồn: bbox alpha của chính ảnh 512×512). */
  w: number;
  /** mực cao / hộp ảnh. */
  h: number;
  /** tâm mực theo trục x / hộp ảnh (≈0,5 khi ảnh cân). */
  cx: number;
  /** tâm mực theo trục y / hộp ảnh. */
  cy: number;
}

/**
 * KIỂU ĐẶT — "món này neo vào đâu và to bằng nào".
 *
 * ⚠️ VÌ SAO CẦN: slot `head` có BA món với ba luật thị giác KHÁC NHAU (mũ, vương miện, nơ).
 *    `slot` vẫn là dữ liệu (`shop-items.json`) và vẫn quyết định TẦNG VẼ; kiểu đặt chỉ là
 *    "hình dáng món này nằm thế nào trên đầu" — câu hỏi thị giác, không phải dữ liệu danh mục.
 *    Món `head` mới thêm mà chưa khai kiểu ⇒ rơi về `hat` (luật an toàn nhất: nằm trên đầu).
 */
export type AccessoryFitKind = 'face' | 'hat' | 'crown' | 'bow' | 'neck' | 'feet' | 'back';

export interface AccessoryFit {
  ink: AccessoryInk;
  kind: AccessoryFitKind;
}

/** 10 phụ kiện (mã `acc-*` = khoá trong `shopArtworkManifest.ts`). */
export const ACCESSORY_FIT: Readonly<Record<string, AccessoryFit>> = {
  // Ảnh đầy gần kín hộp (93–98%W): kính, kính sao, mũ, cánh, áo choàng.
  'acc-hat': { ink: { w: 0.9414, h: 0.5469, cx: 0.5, cy: 0.4883 }, kind: 'hat' },
  'acc-crown': { ink: { w: 0.7246, h: 0.5039, cx: 0.499, cy: 0.4922 }, kind: 'crown' },
  'acc-bow': { ink: { w: 0.9199, h: 0.5684, cx: 0.501, cy: 0.5049 }, kind: 'bow' },
  'acc-glasses': { ink: { w: 0.9336, h: 0.3691, cx: 0.5, cy: 0.4971 }, kind: 'face' },
  'acc-star-glasses': { ink: { w: 0.9766, h: 0.4004, cx: 0.5, cy: 0.4971 }, kind: 'face' },
  // Khăn và ba lô "đầy" vừa (71–78%) — không chuẩn hoá thì trông nhỏ hơn kính 1,3 lần.
  'acc-scarf': { ink: { w: 0.709, h: 0.6953, cx: 0.5068, cy: 0.5078 }, kind: 'neck' },
  'acc-shoes': { ink: { w: 0.8809, h: 0.5879, cx: 0.5088, cy: 0.5068 }, kind: 'feet' },
  'acc-backpack': { ink: { w: 0.7793, h: 0.8008, cx: 0.501, cy: 0.4941 }, kind: 'back' },
  'acc-cape': { ink: { w: 0.9277, h: 0.5488, cx: 0.501, cy: 0.4912 }, kind: 'back' },
  'acc-wings': { ink: { w: 0.9453, h: 0.5566, cx: 0.5, cy: 0.4854 }, kind: 'back' },
};

/** Mực coi như lấp đầy hộp — dùng cho món chưa khai tỷ lệ. */
export const DEFAULT_ACCESSORY_INK: AccessoryInk = { w: 1, h: 1, cx: 0.5, cy: 0.5 };

/** Hệ số "cỡ mực nhìn thấy" so với neo, theo từng kiểu đặt. Xem bảng ở ghi chú đầu tệp. */
export const ACCESSORY_SCALE: Readonly<Record<AccessoryFitKind, number>> = {
  face: 1.65,
  hat: 1.25,
  crown: 1.15,
  bow: 0.65,
  neck: 0.95,
  feet: 0.675,
  back: 1.425,
};

/** Hộp ảnh phụ kiện sau khi quy đổi: tâm + cạnh, đơn vị 0..1 của hộp `1em` của con vật. */
export interface AccessoryBox {
  cx: number;
  cy: number;
  side: number;
}

/** Món chưa khai ⇒ tra bảng là `undefined` (người gọi tự lùi về mặc định). */
export function accessoryFitOf(itemId: string): AccessoryFit | undefined {
  return ACCESSORY_FIT[itemId];
}

/**
 * ⭐ HÀM CỐT LÕI: cỡ HỘP để **mực nhìn thấy** đúng bằng `visibleTarget`.
 *
 * Vẽ hộp cỡ `S` thì mực rộng `S × inkW` ⇒ `S = visibleTarget / inkW`. Nhờ vậy ảnh nền trong suốt
 * nhiều hay ít KHÔNG làm món to nhỏ khác đi.
 *
 * `inkW <= 0` (dữ liệu hỏng) ⇒ trả `visibleTarget` (coi như mực đầy hộp) thay vì chia cho 0 ra
 * `Infinity` — một ô CSS `Infinity%` sẽ làm hỏng cả lớp vẽ.
 */
export function fitSize(visibleTarget: number, inkW: number): number {
  if (!(inkW > 0)) return visibleTarget;
  return visibleTarget / inkW;
}

/** Kiểu đặt mặc định theo slot — dùng khi món chưa khai `kind`. */
export function defaultKindForSlot(slot: AccessorySlot): AccessoryFitKind {
  switch (slot) {
    case 'face':
      return 'face';
    case 'neck':
      return 'neck';
    case 'feet':
      return 'feet';
    case 'back':
      return 'back';
    case 'head':
      return 'hat';
  }
}

/**
 * Căn tâm mực vào một điểm neo, trả về tâm HỘP ẢNH.
 *
 * `inkCenter = boxCenter + (ink.cx / ink.cy − 0,5) × side` ⇒ đảo lại. Bỏ bước này thì khăn (mực
 * lệch 0,7% sang phải) và giày (0,9%) sẽ lệch thêm một chút — nhỏ nhưng miễn phí để đúng.
 */
function boxAt(
  inkCenterX: number,
  inkCenterY: number,
  side: number,
  ink: AccessoryInk,
): AccessoryBox {
  return {
    cx: inkCenterX - (ink.cx - 0.5) * side,
    cy: inkCenterY - (ink.cy - 0.5) * side,
    side,
  };
}

/** Đáy vành mũ/vương miện nằm dưới đỉnh đầu bao nhiêu (phần hộp `1em`). Xem ghi chú đầu tệp. */
export const HEADPIECE_DROP = 0.06;

/** Vòng khăn nằm trên cao độ cổ bao nhiêu (dương = cao hơn). Xem ghi chú đầu tệp. */
const SCARF_LIFT = 0.04;

/** Nơ: cách mép trái đầu bao nhiêu phần `head.w`, và cách đỉnh đầu bao nhiêu phần chiều cao đầu. */
const BOW_INSET = 0.225;
const BOW_DROP = 0.3;

/**
 * ⭐ ĐẶT MỘT MÓN PHỤ KIỆN: neo của con vật + tỷ lệ mực ⇒ hộp ảnh (tâm + cạnh).
 *
 * Hàm THUẦN (không React, không DOM) nên test được bằng số, và mọi hằng số thị giác nằm ở một
 * chỗ — sửa "mũ cao bao nhiêu" không phải lục trong JSX.
 */
export function accessoryBox(
  kind: AccessoryFitKind,
  anchor: PetAnchor,
  ink: AccessoryInk,
): AccessoryBox {
  const scale = ACCESSORY_SCALE[kind];
  switch (kind) {
    case 'face': {
      // Kính: tâm đúng ĐƯỜNG MẮT. Đây là lỗi chủ dự án báo ("đeo vào là sát vào mặt").
      const side = fitSize(scale * anchor.eyes.w, ink.w);
      return boxAt(anchor.eyes.cx, anchor.eyes.y, side, ink);
    }
    case 'hat': {
      const side = fitSize(scale * anchor.head.w, ink.w);
      return boxAt(
        anchor.head.cx,
        anchor.head.top + HEADPIECE_DROP - (ink.h * side) / 2,
        side,
        ink,
      );
    }
    case 'crown': {
      const side = fitSize(scale * anchor.head.w, ink.w);
      return boxAt(
        anchor.head.cx,
        anchor.head.top + HEADPIECE_DROP - (ink.h * side) / 2,
        side,
        ink,
      );
    }
    case 'bow': {
      const side = fitSize(scale * anchor.head.w, ink.w);
      const cx = anchor.head.cx - anchor.head.w * (0.5 - BOW_INSET);
      const cy = anchor.head.top + BOW_DROP * (anchor.head.bottom - anchor.head.top);
      return boxAt(cx, cy, side, ink);
    }
    case 'neck': {
      const side = fitSize(scale * anchor.head.w, ink.w);
      const cy = anchor.neck.y - SCARF_LIFT + (ink.h * side) / 2;
      return boxAt(anchor.neck.cx, cy, side, ink);
    }
    case 'feet': {
      const side = fitSize(scale * anchor.feet.w, ink.w);
      return boxAt(anchor.feet.cx, anchor.feet.y, side, ink);
    }
    case 'back': {
      const side = fitSize(scale * anchor.torso.w, ink.w);
      const cy = (anchor.torso.top + anchor.torso.bottom) / 2;
      return boxAt(anchor.torso.cx, cy, side, ink);
    }
  }
}
