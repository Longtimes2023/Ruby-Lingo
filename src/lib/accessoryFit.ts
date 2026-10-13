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

import type { PetAnchor, PetFeetAnchor } from './petAnchors.js';

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
  /*
    ⚠️⚠️ 5 DÒNG DƯỚI ĐÂY ĐÃ ĐO LẠI — vì 5 ẢNH đã được VẼ LẠI ở góc "đang mặc" (xem ghi chú
    `ACCESSORY_SCALE`). Số cũ không còn dùng được: mỗi ảnh mới có độ "đầy" khác, và `acc-shoes`
    nay là MỘT CHIẾC (không phải cả đôi) nên cũng đổi luôn cách đặt.
    Nguồn: `_verify/ref/new-ink.json` (đo trên chính tệp đã ghi vào `public/assets/pets/shop/`).
  */
  'acc-hat': { ink: { w: 1, h: 0.6133, cx: 0.5, cy: 0.5 }, kind: 'hat' },
  'acc-crown': { ink: { w: 0.7246, h: 0.5039, cx: 0.499, cy: 0.4922 }, kind: 'crown' },
  'acc-bow': { ink: { w: 0.9199, h: 0.5684, cx: 0.501, cy: 0.5049 }, kind: 'bow' },
  'acc-glasses': { ink: { w: 0.9336, h: 0.3691, cx: 0.5, cy: 0.4971 }, kind: 'face' },
  'acc-star-glasses': { ink: { w: 0.9766, h: 0.4004, cx: 0.5, cy: 0.4971 }, kind: 'face' },
  'acc-scarf': { ink: { w: 0.916, h: 1, cx: 0.499, cy: 0.5 }, kind: 'neck' },
  'acc-shoes': { ink: { w: 1, h: 0.5898, cx: 0.5, cy: 0.5 }, kind: 'feet' },
  'acc-backpack': { ink: { w: 1, h: 0.9492, cx: 0.5, cy: 0.5 }, kind: 'back' },
  'acc-cape': { ink: { w: 0.9277, h: 0.5488, cx: 0.501, cy: 0.4912 }, kind: 'back' },
  'acc-wings': { ink: { w: 1, h: 0.7617, cx: 0.5, cy: 0.5 }, kind: 'back' },
};

/** Mực coi như lấp đầy hộp — dùng cho món chưa khai tỷ lệ. */
export const DEFAULT_ACCESSORY_INK: AccessoryInk = { w: 1, h: 1, cx: 0.5, cy: 0.5 };

/**
 * ⭐ HỆ SỐ "CỠ MỰC NHÌN THẤY" so với neo, theo từng kiểu đặt. Xem bảng ở ghi chú đầu tệp.
 *
 * ⚠️⚠️ HAI DÒNG ĐÃ ĐỔI VÌ **5 ẢNH ĐÃ ĐƯỢC VẼ LẠI** Ở GÓC "ĐANG MẶC" (đúng như ảnh mẫu chủ dự án
 *    gửi), thay cho ảnh CHỤP SẢN PHẨM cũ. Lịch sử, để không ai "sửa lại cho gọn":
 *
 *    • `neck` 0,90 → **0,95**: ảnh khăn mới là dây len quấn quanh cổ (mực 91,6%W × 100%H), không
 *      còn là vòng khăn nhìn từ trên xuống (70,9% × 69,5%). Nhờ vậy `ACCESSORY_SQUASH.neck` về 1.
 *
 *    • `feet` 0,675 → 0,95 → **1,9**: bản 0,675 coi ảnh là MỘT CHIẾC trong khi ảnh cũ là CẢ ĐÔI
 *      (mỗi chiếc nhỏ hơn bàn chân, dồn vào giữa). Bản 0,95 kéo giãn cả đôi cho trùm hai bàn chân
 *      — đúng hơn nhưng vẫn là "một khối". Nay ảnh là **MỘT CHIẾC** và được VẼ HAI LẦN
 *      (`ACCESSORY_MIRRORED`), nên hệ số phải tính cho **MỘT bàn chân**: bề rộng mực một chiếc
 *      giày = 1,9 × bề rộng một bàn chân (giày phủ qua mắt cá, thừa ra hai bên như giày thật).
 */
export const ACCESSORY_SCALE: Readonly<Record<AccessoryFitKind, number>> = {
  face: 1.65,
  hat: 1.05,
  crown: 1.15,
  bow: 0.65,
  neck: 1.05,
  feet: 1.55,
  back: 1.425,
};

/**
 * MÓN NÀY VẼ **HAI LẦN** — một cho mỗi bàn chân (lần thứ hai lật gương).
 *
 * ⭐ VÌ SAO: ảnh `acc-shoes.webp` cũ là **một đôi giày trong một ảnh**, không thể đặt lên hai bàn
 *   chân ở hai vị trí khác nhau — cách duy nhất là kéo giãn cả đôi cho trùm hai chân, và kết quả
 *   luôn trông như "một khối dồn vào giữa" (đúng lời chủ dự án: *"đôi giày mặc vào con khỉ hơi bị
 *   tệ"*). Cách các game dress-up lớn làm: vẽ **MỘT chiếc**, rồi vẽ hai lần, lật gương cho bàn
 *   chân kia. Ảnh `acc-shoes.webp` nay đã được vẽ lại theo cách đó.
 *
 * ⚠️ Mọi món KHÁC vẽ một lần. Nếu sau này có món nào cần hai lần (găng tay, dép), thêm id vào đây
 *    — không cần sửa `PetAvatar`.
 */
export const ACCESSORY_MIRRORED: Readonly<Record<string, boolean>> = {
  'acc-shoes': true,
};

/**
 * ⭐⭐ TỈ LỆ CHIỀU CAO MỰC (tính từ ĐỈNH) được vẽ ở **LỚP SAU** con vật.
 *
 * ⚠️⚠️ ĐÂY LÀ THỨ TẠO RA "CẢM GIÁC PET MẶC ĐỒ" — CHỦ DỰ ÁN ĐÃ NÊU ĐÚNG HAI LẦN.
 *    Lần 1: *"hình cái khăn choàng, đôi giày mặc vào con khỉ hơi bị tệ"*.
 *    Lần 2: *"mình cần là cái CẢM GIÁC PET MẶC ĐỒ, không phải TREO ĐỒ LƠ LỬNG, hay để gần"*.
 *
 *    VÌ SAO CẦN: bản cũ vẽ mỗi món thành MỘT LỚP duy nhất — hoặc TRƯỚC con vật, hoặc SAU con
 *    vật. Nhưng một món ĐANG MẶC thì **luôn bị CƠ THỂ CHE MỘT PHẦN**, và chính phần bị che đó là
 *    thứ mắt dùng để phân biệt "đồ mặc trên người" với "đồ đặt trước người":
 *      • KHĂN QUẤN CỔ: vòng khăn đi RA SAU GÁY rồi mới quàng ra trước ⇒ phần trên của vòng bị
 *        cằm/cổ che. Vẽ cả vòng ở lớp trước thì nó thành "cái phao dán trước ngực".
 *      • GIÀY: miệng giày ở MẮT CÁ ⇒ ống chân chui VÀO giày, phần trên miệng giày bị chân che.
 *        Vẽ cả chiếc giày ở lớp trước thì nó thành "đôi giày đặt cạnh chân".
 *      • MŨ: không cần cắt lớp, nhưng phải LÚN xuống (`HEADPIECE_DROP`) để vành chạm trán và
 *        đỉnh đầu bị mũ che — xem ghi chú ở hằng số đó.
 *
 *    CÁCH VẼ (hai lượt, con vật ở GIỮA):
 *      [ phần TRÊN của món, z=1 ]  →  [ CON VẬT, z=2 ]  →  [ phần DƯỚI của món, z=3 ]
 *
 *    ⚠️ Số ở đây là **tỉ lệ CHIỀU CAO MỰC** (không phải chiều cao hộp, không phải % ảnh) — nên
 *    đổi ảnh phụ kiện (mực dày/thưa) không làm đường cắt lệch. 0 = tắt cắt lớp (vẽ một lượt).
 *    Dựng thử và chọn số bằng mắt: `_verify/ref/sweep_wrap.py` + `sweep_wear.py`.
 */
export const ACCESSORY_WRAP: Readonly<Record<string, number>> = {
  'acc-scarf': 0.4,
  'acc-shoes': 0.22,
};

/**
 * ⭐ ÉP DẸT THEO CHIỀU DỌC (1 = không ép), theo từng kiểu đặt.
 *
 * ⚠️⚠️ ĐÂY LÀ **DI SẢN CỦA MỘT BẢN VÁ ĐÃ QUA** — giữ lại cơ chế, nhưng nay MỌI KIỂU ĐỀU = 1.
 *
 *    Chuyện đã xảy ra: 10 ảnh phụ kiện cũ đều là ảnh CHỤP SẢN PHẨM ở góc **3/4 TỪ TRÊN XUỐNG**,
 *    còn 18 ảnh thú cưng vẽ **CHÍNH DIỆN**. Riêng khăn quàng thì sai hẳn: ảnh cho ta **nhìn vào
 *    MẶT TRONG của vòng khăn**, dán lên ngực con vật đọc ra "cục len dẹt" (mực 70,9%W × 69,5%H,
 *    gần VUÔNG, mà công thức canh cỡ theo BỀ RỘNG ⇒ khăn cao bằng 1,03 lần chiều cao thân).
 *    Bản vá rẻ nhất khi đó là `neck: 0,70` — ép dẹt vòng khăn thành dải ngang ôm cổ.
 *
 *    ⚠️ **NAY ẢNH KHĂN ĐÃ ĐƯỢC VẼ LẠI** ở góc đang mặc (chủ dự án gửi ảnh mẫu và duyệt) ⇒ ép dẹt
 *    không còn cần nữa, và GIỮ 0,7 LẠI SẼ LÀ SAI: nó bóp méo một ảnh vốn đã đúng.
 *
 *    ⇒ Giữ cơ chế để lần sau gặp lại tình huống "ảnh sai góc" thì chỉ cần điền một số, KHÔNG phải
 *      sửa `PetAvatar`. Nhưng ĐỪNG điền số nào khi art đã đúng góc.
 */
export const ACCESSORY_SQUASH: Readonly<Record<AccessoryFitKind, number>> = {
  face: 1,
  hat: 1,
  crown: 1,
  bow: 1,
  neck: 1,
  feet: 1,
  back: 1,
};

/** Hộp ảnh phụ kiện sau khi quy đổi: tâm + cạnh, đơn vị 0..1 của hộp `1em` của con vật. */
export interface AccessoryBox {
  cx: number;
  cy: number;
  side: number;
  /**
   * Hệ số ép dẹt theo CHIỀU DỌC (1 = không ép). Chiều cao hộp lúc render = `side × squashY`.
   *
   * ⚠️ Có trường này vì hộp KHÔNG còn luôn vuông. Người vẽ phải dùng `squashY` cho chiều cao,
   *    và — quan trọng hơn — nếu muốn ép dẹt mà giữ MÉP TRÊN cố định (trường hợp khăn quàng, để
   *    vòng khăn vẫn ôm đúng cổ) thì `cy` đã được tính sẵn theo gốc đó, KHÔNG cần chỉnh thêm.
   */
  squashY: number;
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
 *
 * ⚠️ `squashY` phải đi kèm khi hộp bị ép dẹt: lệch tâm mực theo trục y tỷ lệ với CHIỀU CAO hộp
 *    (`side × squashY`), không phải với `side`. Quên ⇒ khăn (mực cao 69,5%) lệch lên đúng
 *    `(0,5078 − 0,5) × 0,3 × side` — nhỏ, nhưng lại là kiểu sai chỉ hiện ra trên một vài con.
 */
function boxAt(
  inkCenterX: number,
  inkCenterY: number,
  side: number,
  ink: AccessoryInk,
  squashY = 1,
): AccessoryBox {
  return {
    cx: inkCenterX - (ink.cx - 0.5) * side,
    cy: inkCenterY - (ink.cy - 0.5) * side * squashY,
    side,
    squashY,
  };
}

/**
 * Đáy vành mũ nằm dưới đỉnh đầu bao nhiêu — **TỈ LỆ CỦA CHIỀU CAO ĐẦU** (không phải số tuyệt đối).
 *
 * ⚠️⚠️ VÌ SAO PHẢI LÀ TỈ LỆ: 18 con có chiều cao đầu chênh nhau **1,8 lần** (`head.bottom −
 *   head.top` từ 0,225 ở rồng/tiger adult tới 0,400 ở khỉ/pig baby). Một số tuyệt đối không thể
 *   đúng cho cả hai đầu mút:
 *     • 0,06 (số cũ, cho ảnh sản phẩm) ⇒ mũ BAY LƠ LỬNG trên đầu con đầu to (khỉ baby hở 16,7%).
 *     • 0,10 (số vừa thử cho ảnh chính diện) ⇒ với `tiger:adult` (đầu cao 0,225, mắt ở 0,097)
 *       vành mũ **trùm xuống DƯỚI đường mắt** — che mắt bé.
 *   Tỉ lệ 0,25 cho khỉ baby đúng 0,10 (khớp ảnh mẫu), và với `tiger:adult` chỉ còn 0,056 — LUÔN
 *   nằm trên đường mắt (kiểm 18/18: tỉ lệ "vành còn trên mắt" nhỏ nhất là 0,336 > 0,25).
 *
 * ⚠️ HẰNG SỐ NÀY CHỈ ĐÚNG CHO ẢNH CHÍNH DIỆN. Quay lại ảnh sản phẩm thì phải hạ về 0,15.
 */
export const HEADPIECE_DROP = 0.32;

/**
 * Như `HEADPIECE_DROP` nhưng cho VƯƠNG MIỆN — và số này **VẪN LÀ TỈ LỆ CỦA BẢN CŨ (0,15)**.
 *
 * ⚠️ VÌ SAO TÁCH RA: `acc-crown.webp` **chưa** được vẽ lại, vẫn là ảnh chụp sản phẩm nhìn từ trên
 *    xuống (mực 72,5%W × 50,4%H). Dùng chung tỉ lệ 0,25 thì vương miện bị ấn sâu xuống đầu và
 *    biến mất sau trán — đúng loại lỗi mà việc tách hằng số này ngăn được.
 *    Khi nào vương miện được vẽ lại ở góc chính diện thì gộp hai hằng số làm một.
 */
export const CROWN_DROP = 0.15;

/**
 * Mép trên mực khăn quàng nằm **DƯỚI** cao độ cổ bao nhiêu (phần hộp `1em`).
 *
 * ⚠️⚠️ ĐÃ ĐỔI DẤU Ý NGHĨA: bản cũ là `SCARF_LIFT = 0,04` (mép trên mực NẰM TRÊN cổ 0,04) — đúng
 *    cho ảnh khăn cũ, vì ảnh đó nhìn từ trên xuống nên vòng khăn phải "nâng" lên mới trông như
 *    đang quàng. Ảnh khăn MỚI vẽ ở góc đang mặc, mép trên của mực CHÍNH LÀ mép trên của vòng khăn
 *    đang ôm cổ ⇒ đặt ngay dưới cao độ cổ một chút mới đúng.
 *
 * ⚠️ Export để TEST khoá được "mép trên khăn nằm đúng cổ" — xem `pet-anchors.test.ts`. Một hằng
 *    số thị giác quyết định khăn quàng hay trùm lên mặt mà không test nào chạm tới thì lần sau ai
 *    đó sửa dấu là mắt bé bị che, còn CI vẫn xanh.
 */
export const SCARF_TOP_DROP = -0.05;

/** Đáy mực giày nằm dưới `feet.y` bao nhiêu (phần hộp `1em`) — giày ôm bàn chân, thấp hơn một chút. */
export const SHOE_BOTTOM_DROP = 0.02;

/**
 * Đáy vành mũ/vương miện nằm dưới đỉnh đầu bao nhiêu, tính bằng phần HỘP `1em`.
 *
 * ⚠️ Là `tỉ lệ × chiều cao đầu` của ĐÚNG con đang hiện — không phải số tuyệt đối. Xem ghi chú ở
 *    `HEADPIECE_DROP`: chiều cao đầu của 18 con chênh nhau 1,8 lần, nên một số tuyệt đối hoặc làm
 *    mũ bay lơ lửng ở con đầu to, hoặc trùm xuống dưới đường mắt ở con đầu nhỏ.
 */
export function headpieceDrop(anchor: PetAnchor, ratio: number): number {
  return ratio * (anchor.head.bottom - anchor.head.top);
}

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
  const squashY = ACCESSORY_SQUASH[kind];
  switch (kind) {
    case 'face': {
      // Kính: tâm đúng ĐƯỜNG MẮT. Đây là lỗi chủ dự án báo ("đeo vào là sát vào mặt").
      const side = fitSize(scale * anchor.eyes.w, ink.w);
      return boxAt(anchor.eyes.cx, anchor.eyes.y, side, ink, squashY);
    }
    case 'hat': {
      const side = fitSize(scale * anchor.head.w, ink.w);
      return boxAt(
        anchor.head.cx,
        anchor.head.top + headpieceDrop(anchor, HEADPIECE_DROP) - (ink.h * side * squashY) / 2,
        side,
        ink,
        squashY,
      );
    }
    case 'crown': {
      const side = fitSize(scale * anchor.head.w, ink.w);
      return boxAt(
        anchor.head.cx,
        anchor.head.top + headpieceDrop(anchor, CROWN_DROP) - (ink.h * side * squashY) / 2,
        side,
        ink,
        squashY,
      );
    }
    case 'bow': {
      const side = fitSize(scale * anchor.head.w, ink.w);
      const cx = anchor.head.cx - anchor.head.w * (0.5 - BOW_INSET);
      const cy = anchor.head.top + BOW_DROP * (anchor.head.bottom - anchor.head.top);
      return boxAt(cx, cy, side, ink, squashY);
    }
    case 'neck': {
      /*
        ⚠️⚠️ KHĂN QUÀNG — HAI ĐIỀU CHỈNH SO VỚI CÁC KIỂU KHÁC:

        (1) NEO VÀO **`neck.w`**, KHÔNG phải `head.w`.
            Lấy `head.w` làm chuẩn thì con ĐẦU TO có khăn to gấp rưỡi con đầu nhỏ: khỉ baby
            `head.w = 0,543` còn mèo baby `head.w = 0,379` — trong khi CỔ hai con gần như bằng nhau
            (`neck.w` 0,236 và 0,242). Khăn quàng QUẤN QUANH CỔ, nên cổ mới quyết định cỡ khăn.
            Đo trên ảnh mẫu chủ dự án gửi: khăn rộng **0,26 hộp**, `neck.w` mèo = 0,242
            ⇒ hệ số **≈ 1,05 × `neck.w`** (`_verify/ref/measure_ref_ratios.py`).

        (2) MÉP TRÊN MỰC = `neck.y + SCARF_TOP_DROP` (KHÔNG phải tâm mực vào cổ).
            Canh TÂM mực vào cổ thì vòng khăn trùm lên MẶT. Canh mép trên thì vòng khăn quàng đúng
            cổ, đuôi rủ xuống ngực.

        ⚠️ `squashY` (nếu có) phải giữ mép trên ấy CỐ ĐỊNH (giống `transform-origin: top`) — nếu
           ép quanh TÂM thì vòng khăn tụt lên, hở cổ. Vì vậy `cy` tính bằng chiều cao ĐÃ ÉP.
      */
      const side = fitSize(scale * anchor.neck.w, ink.w);
      const inkTop = anchor.neck.y + SCARF_TOP_DROP;
      const cy = inkTop + (ink.h * side * squashY) / 2;
      return boxAt(anchor.neck.cx, cy, side, ink, squashY);
    }
    case 'feet': {
      /*
        ⚠️ MỘT CHIẾC GIÀY ⇒ phải có `feetSplit` mới đặt đúng hai bàn chân (xem `accessoryBoxes`).
        Nhánh này chỉ là ĐƯỜNG LÙI khi không có dữ liệu chân: đặt một chiếc vào giữa hai bàn chân,
        cỡ bằng nửa khoảng cách hai bàn chân — trông không đẹp, nhưng món KHÔNG BIẾN MẤT.
      */
      const side = fitSize(scale * (anchor.feet.w / 2), ink.w);
      return boxAt(anchor.feet.cx, anchor.feet.y + SHOE_BOTTOM_DROP - (ink.h * side * squashY) / 2,
        side, ink, squashY);
    }
    case 'back': {
      const side = fitSize(scale * anchor.torso.w, ink.w);
      const cy = (anchor.torso.top + anchor.torso.bottom) / 2;
      return boxAt(anchor.torso.cx, cy, side, ink, squashY);
    }
  }
}

/**
 * ⭐⭐ ĐẶT **MỘT MÓN** LÊN CON VẬT — trả về MỘT HAY NHIỀU HỘP.
 *
 * ⚠️⚠️ VÌ SAO CẦN HÀM NÀY, CHỨ KHÔNG DÙNG `accessoryBox` TRỰC TIẾP:
 *   Món giày phải vẽ **HAI LẦN**, mỗi bàn chân một lần (lật gương cho chân phải). `accessoryBox`
 *   trả về MỘT hộp vì nó chỉ biết `anchor` — mà `anchor.feet` là neo của **cả hai bàn chân gộp**.
 *   Nhồi luật "hai hộp" vào `accessoryBox` sẽ làm hàm đó không còn là "một món ⇒ một hộp", và mọi
 *   test hiện có (kiểm `ink.cx` khớp neo) đều phải viết lại.
 *
 * ⇒ `accessoryBox` giữ nguyên nghĩa "hộp CHÍNH". `accessoryBoxes` là lớp mỏng biết món nào cần
 *   vẽ thêm bản thứ hai, và trả kèm cờ `mirror` để người vẽ lật ảnh.
 */
export interface AccessoryPlacement {
  /** Hộp ảnh — như cũ. */
  box: AccessoryBox;
  /** `true` ⇒ lật ngang ảnh khi vẽ (`scaleX(-1)`). */
  mirror: boolean;
  /**
   * ĐƯỜNG CẮT LỚP, tính bằng **% CHIỀU CAO HỘP** từ mép trên hộp. `null` = vẽ một lượt.
   *
   * ⚠️⚠️ Có trường này để món ĐANG MẶC bị CƠ THỂ CHE MỘT PHẦN — xem ghi chú dài ở `ACCESSORY_WRAP`.
   *    Người vẽ PHẢI cắt ảnh tại đúng đường này bằng `clip-path`:
   *      • phần TRÊN (`inset(0 0 (100−cut)% 0)`) → vẽ ở LỚP SAU con vật;
   *      • phần DƯỚI (`inset(cut% 0 0 0)`)      → vẽ ở LỚP TRƯỚC con vật.
   *    Bỏ qua nó (vẽ cả món ở một lớp) là quay lại đúng lỗi chủ dự án đã báo hai lần:
   *    *"treo đồ lơ lửng, hay để gần"* thay vì *"cảm giác PET mặc đồ"*.
   *
   * ⚠️ Đơn vị là % CHIỀU CAO HỘP (không phải % chiều cao mực) vì `clip-path` cắt theo hộp. Đã quy
   *    đổi sẵn ở đây — người vẽ KHÔNG phải biết `ink.cy`/`ink.h`/`squashY`.
   */
  wrapCutPct: number | null;
}

export function accessoryBoxes(
  itemId: string,
  kind: AccessoryFitKind,
  anchor: PetAnchor,
  ink: AccessoryInk,
  feet?: PetFeetAnchor,
): AccessoryPlacement[] {
  const wrap = ACCESSORY_WRAP[itemId] ?? 0;
  /**
   * Quy đổi "tỉ lệ chiều cao MỰC" → "% chiều cao HỘP" cho `clip-path`.
   *
   * Mực bắt đầu ở `ink.cy − ink.h/2` (đơn vị: cạnh hộp ngang) và cao `ink.h`. Đường cắt nằm ở
   * `ink.cy − ink.h/2 + ink.h × wrap`. Chia cho `squashY` vì hộp có thể bị ép dẹt theo chiều dọc.
   */
  const cutPct = (box: AccessoryBox): number | null => {
    if (!(wrap > 0)) return null;
    const fromTop = (ink.cy - ink.h / 2 + ink.h * wrap) / box.squashY;
    return Math.max(0, Math.min(1, fromTop)) * 100;
  };

  if (ACCESSORY_MIRRORED[itemId] === true && feet !== undefined) {
    const scale = ACCESSORY_SCALE[kind];
    const squashY = ACCESSORY_SQUASH[kind];
    const boxes: AccessoryPlacement[] = [];
    for (const [side, mirror] of [['left', false], ['right', true]] as const) {
      const foot = feet[side];
      // Ảnh giày vẽ ở TƯ THẾ NGHIÊNG, đáy mực là ĐẾ GIÀY ⇒ neo theo ĐÁY, không theo tâm.
      const sideLen = fitSize(scale * foot.w, ink.w);
      const cy =
        anchor.feet.y + SHOE_BOTTOM_DROP - (ink.h * sideLen * squashY) / 2;
      const box = boxAt(foot.cx, cy, sideLen, ink, squashY);
      boxes.push({ box, mirror, wrapCutPct: cutPct(box) });
    }
    return boxes;
  }
  const box = accessoryBox(kind, anchor, ink);
  return [{ box, mirror: false, wrapCutPct: cutPct(box) }];
}
