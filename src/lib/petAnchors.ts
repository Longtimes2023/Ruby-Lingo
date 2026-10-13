/**
 * RubyLingo — BẢNG NEO THEO TỪNG ẢNH THÚ CƯNG (`PetAnchor`).
 *
 * ⭐⭐ VÌ SAO TỆP NÀY TỒN TẠI (lỗi chủ dự án báo):
 *   *"mua cái mắt kính, đeo vào là sát vào mặt, như ở ngoài đời thực vậy, mua cái áo, cái quần là
 *   mặc vào gọn đẹp"*.
 *
 *   Bản cũ dùng **HAI BẢNG HẰNG SỐ DÙNG CHUNG CHO CẢ 18 ẢNH** (`ACCESSORY_ANCHOR` +
 *   `ACCESSORY_TEXT_SIZE` trong `PetAvatar.tsx`). Đo trên ảnh thật thì 18 con KHÔNG đồng nhất:
 *     • mực rộng 43,9% – 66,8% khung; tâm thân `cx` 0,4365 – 0,5566 ⇒ trên hộp `1em` = 84px,
 *       mỗi bên lệch tới ±5px so với "tâm chung";
 *     • đường MẮT nằm ở 9,1% – 27,0% chiều cao hộp, và khoảng cách hai mắt 6,0% – 13,6%.
 *   ⇒ Một con số `top-[-45%]` cho kính không thể đúng cho mọi con. Kết quả: kính nằm ngang MÁ
 *   hoặc trên TRÁN (lệch tới 44px ≈ 52% hộp), khăn rơi dưới cằm, giày lơ lửng, ba lô lệch trái.
 *
 * ⚠️ HỆ TOẠ ĐỘ: mọi số là 0..1 theo **HỘP ẢNH**. Ảnh nguồn 512×512 vuông, được vẽ bằng
 *   `object-contain` trong hộp `1em × 1em` (vuông) ⇒ hộp ảnh TRÙNG KHÍT hộp `1em` ⇒ số ở đây
 *   dùng thẳng làm neo CSS (`left: cx*100%`, `top: y*100%`, cỡ = `w*100%` của hộp `1em`).
 *   Hộp `1em` lại ăn theo `font-size` của bậc tiến hoá (84/104/124px) nên neo + cỡ cùng lớn lên.
 *
 * ⚠️⚠️ CÁCH ĐO — TÁI LẬP ĐƯỢC (`_verify/pet-probe/pet_anchors.py`, chạy lại được bất cứ lúc nào):
 *   • `head/torso/neck/feet` suy TỰ ĐỘNG từ alpha của chính ảnh nguồn:
 *       - 40 dải cao 2,5%; mỗi dải giữ các RUN (đoạn cột liền mạch có mực);
 *       - `head`   = mọi dải TRÊN cổ; bề rộng GOM CẢ TAI (bao ngoài cung của các dải);
 *       - `neck`   = điểm cực tiểu CỤC BỘ có độ sâu lớn nhất (độ sâu đối xứng = ngưỡng thấp hơn
 *                    của hai bên) nằm SAU điểm rộng nhất của đầu và trước 52% chiều cao mực;
 *       - `feet`   = vùng 12% dưới cùng; `feet.y` = tâm vùng; `feet.w` = bề rộng bao ngoài
 *                    (cả hai bàn chân);
 *       - `torso`  = giữa cổ và vùng chân; `torso.cx` = TRUNG VỊ tâm của run RỘNG NHẤT từng dải
 *                    (bỏ đuôi/chi rời để không kéo lệch trục thân — đuôi khỉ làm `cx` lệch 5%).
 *   • `eyes` — CỤM ĐIỂM TỐI (con ngươi), nhưng phải XÁC NHẬN BẰNG MẮT:
 *       - script cắt nửa trên ảnh, kẻ LƯỚI 2,5%, ghi ra `_verify/pet-probe/out/anchors-check/`;
 *       - người đọc trực tiếp các ảnh `FACE-*.png` để CHỐT `eyes.y` (đường mắt);
 *       - sau đó script "snap" về tâm con ngươi tối nhất trong cửa sổ ±3% quanh mỗi mắt,
 *         và vẽ lại marker để kiểm chứng lần hai (`VERIFY-*.png`).
 *     ⚠️ KHÔNG dùng "cụm tối đối xứng lớn nhất": MŨI của cún/mèo/heo cũng tối và đối xứng nhưng
 *        nằm dưới mắt — đo `dog-baby` đã ra `eyes.y = 0,246` (đúng là LỖ MŨI) trong khi mắt thật
 *        ở 0,147. Đó là lý do bước "đọc bằng mắt" là BẮT BUỘC, không phải trang trí.
 *
 * ⚠️ `eyesEstimated: true` = `eyes.cx`/`eyes.w` lấy từ ĐỌC BẰNG MẮT (ảnh snap của con đó không
 *    đủ tin cậy vì con ngươi quá nhỏ hoặc lệch sáng; xem `_areas` trong `anchors.raw.json`).
 *    `eyes.y` của các con này VẪN đo được (tâm con ngươi). Không con nào bị "đoán bừa".
 *
 * ⚠️ LÙI AN TOÀN: nếu một cặp (con × bậc) chưa có số, `petAnchorFor` trả `DEFAULT_PET_ANCHOR`
 *    (trung bình cộng 18 ảnh) — phụ kiện vẫn vẽ, chỉ kém chính xác. KHÔNG được ném lỗi: ném lỗi ở
 *    đây là trắng cả ô "Nhà thú cưng" của bé vì một bảng số nội bộ.
 */

import type { EvolutionStage, PetType } from '@shared/types/reward.js';

/** Bốn hộp "thân" suy trực tiếp từ alpha của ảnh; `eyes` là đường mắt xác nhận bằng mắt. */
export interface PetAnchor {
  /** Đầu, GỒM CẢ TAI. `top`/`bottom` là mép trên/dưới vùng đầu; `bottom` = mép trên của cổ. */
  head: { cx: number; top: number; bottom: number; w: number };
  /** ĐƯỜNG MẮT: `y` = cao độ đường nối hai con ngươi; `w` = khoảng cách hai con ngươi. */
  eyes: { cx: number; y: number; w: number };
  /** Cổ: `y` = cao độ eo giữa đầu và thân; `w` = bề rộng mực tại eo đó. */
  neck: { cx: number; y: number; w: number };
  /** Thân: từ đáy cổ tới đỉnh vùng chân. `w` = bề rộng thân (bỏ đuôi rời). */
  torso: { cx: number; top: number; bottom: number; w: number };
  /** Chân: `y` = cao độ tâm vùng bàn chân; `w` = bề rộng mực của CẢ HAI bàn chân. */
  feet: { cx: number; y: number; w: number };
  /** `true` ⇒ `eyes.cx`/`eyes.w` đọc bằng mắt trên lưới (xem ghi chú đầu tệp). */
  eyesEstimated?: boolean;
}

/**
 * Bảng neo — 18 cặp (con × bậc), khoá `"<petType>:<evolutionStage>"`.
 *
 * ⚠️ Khoá PHẢI khớp từng ảnh trên đĩa `public/assets/pets/<pet>-<stage>.webp`. Có test canh giữ
 *    (`tests/unit/client/pet-anchors.test.ts`) đối chiếu hai chiều với đĩa thật.
 */
export const PET_ANCHORS: Readonly<Record<string, PetAnchor>> = {
  'monkey:baby': {
    head: { cx: 0.4883, top: 0, bottom: 0.4004, w: 0.543 },
    eyes: { cx: 0.4917, y: 0.2703, w: 0.1312 },
    neck: { cx: 0.4834, y: 0.4131, w: 0.2363 },
    torso: { cx: 0.4941, top: 0.4258, bottom: 0.8496, w: 0.4023 },
    feet: { cx: 0.4941, y: 0.9121, w: 0.3906 },
  },
  'monkey:adult': {
    head: { cx: 0.4785, top: 0, bottom: 0.25, w: 0.3164 },
    eyes: { cx: 0.4739, y: 0.1123, w: 0.0973 },
    neck: { cx: 0.4824, y: 0.2627, w: 0.1797 },
    torso: { cx: 0.4736, top: 0.2754, bottom: 0.8496, w: 0.3516 },
    feet: { cx: 0.5059, y: 0.9121, w: 0.418 },
  },
  'monkey:super': {
    head: { cx: 0.5029, top: 0, bottom: 0.25, w: 0.3652 },
    eyes: { cx: 0.495, y: 0.1527, w: 0.1173 },
    neck: { cx: 0.4795, y: 0.2627, w: 0.3066 },
    torso: { cx: 0.5166, top: 0.2754, bottom: 0.8496, w: 0.3906 },
    feet: { cx: 0.5254, y: 0.9121, w: 0.4297 },
  },
  'cat:baby': {
    head: { cx: 0.498, top: 0, bottom: 0.375, w: 0.3789 },
    eyes: { cx: 0.5046, y: 0.2321, w: 0.1362 },
    neck: { cx: 0.5215, y: 0.3877, w: 0.2422 },
    torso: { cx: 0.5205, top: 0.4004, bottom: 0.8496, w: 0.377 },
    feet: { cx: 0.5156, y: 0.9121, w: 0.3438 },
  },
  'cat:adult': {
    head: { cx: 0.4912, top: 0, bottom: 0.2754, w: 0.3555 },
    eyes: { cx: 0.4725, y: 0.1663, w: 0.1216 },
    neck: { cx: 0.5254, y: 0.2881, w: 0.2422 },
    torso: { cx: 0.4844, top: 0.3008, bottom: 0.875, w: 0.3496 },
    feet: { cx: 0.501, y: 0.9375, w: 0.3613 },
  },
  'cat:super': {
    head: { cx: 0.5088, top: 0, bottom: 0.3008, w: 0.3223 },
    eyes: { cx: 0.5029, y: 0.1608, w: 0.1214 },
    neck: { cx: 0.4932, y: 0.3125, w: 0.2129 },
    torso: { cx: 0.4961, top: 0.3242, bottom: 0.8496, w: 0.4492 },
    feet: { cx: 0.5156, y: 0.9121, w: 0.3828 },
  },
  'dog:baby': {
    head: { cx: 0.5029, top: 0.0254, bottom: 0.375, w: 0.4355 },
    eyes: { cx: 0.492, y: 0.1475, w: 0.135 },
    eyesEstimated: true,
    neck: { cx: 0.4912, y: 0.3877, w: 0.2871 },
    torso: { cx: 0.5029, top: 0.4004, bottom: 0.8496, w: 0.4121 },
    feet: { cx: 0.5127, y: 0.9121, w: 0.3848 },
  },
  'dog:adult': {
    head: { cx: 0.5088, top: 0, bottom: 0.3008, w: 0.332 },
    eyes: { cx: 0.5039, y: 0.101, w: 0.1059 },
    neck: { cx: 0.5273, y: 0.3125, w: 0.25 },
    torso: { cx: 0.5283, top: 0.3242, bottom: 0.8496, w: 0.4121 },
    feet: { cx: 0.5293, y: 0.9121, w: 0.3203 },
  },
  'dog:super': {
    head: { cx: 0.5273, top: 0, bottom: 0.3008, w: 0.373 },
    eyes: { cx: 0.5019, y: 0.1207, w: 0.1313 },
    neck: { cx: 0.5088, y: 0.3125, w: 0.2637 },
    torso: { cx: 0.5029, top: 0.3242, bottom: 0.8496, w: 0.4629 },
    feet: { cx: 0.5205, y: 0.9121, w: 0.3691 },
  },
  'tiger:baby': {
    head: { cx: 0.5029, top: 0, bottom: 0.3496, w: 0.4688 },
    eyes: { cx: 0.4889, y: 0.1555, w: 0.1276 },
    neck: { cx: 0.5264, y: 0.3623, w: 0.2754 },
    torso: { cx: 0.5312, top: 0.375, bottom: 0.8496, w: 0.4336 },
    feet: { cx: 0.5186, y: 0.9121, w: 0.416 },
  },
  'tiger:adult': {
    head: { cx: 0.5186, top: 0, bottom: 0.2246, w: 0.2832 },
    eyes: { cx: 0.5022, y: 0.0969, w: 0.1186 },
    neck: { cx: 0.5088, y: 0.2373, w: 0.2324 },
    torso: { cx: 0.5059, top: 0.25, bottom: 0.875, w: 0.4258 },
    feet: { cx: 0.5205, y: 0.9375, w: 0.4004 },
  },
  'tiger:super': {
    head: { cx: 0.4932, top: 0, bottom: 0.2246, w: 0.2793 },
    eyes: { cx: 0.4875, y: 0.1118, w: 0.1076 },
    neck: { cx: 0.4912, y: 0.2373, w: 0.2168 },
    torso: { cx: 0.499, top: 0.25, bottom: 0.8496, w: 0.4434 },
    feet: { cx: 0.5146, y: 0.9121, w: 0.3926 },
  },
  'pig:baby': {
    head: { cx: 0.5186, top: 0, bottom: 0.4004, w: 0.5215 },
    eyes: { cx: 0.492, y: 0.2246, w: 0.115 },
    eyesEstimated: true,
    neck: { cx: 0.5459, y: 0.4131, w: 0.2676 },
    torso: { cx: 0.5479, top: 0.4258, bottom: 0.875, w: 0.3789 },
    feet: { cx: 0.5381, y: 0.9375, w: 0.3496 },
  },
  'pig:adult': {
    head: { cx: 0.4912, top: 0.0254, bottom: 0.3008, w: 0.4629 },
    eyes: { cx: 0.487, y: 0.1298, w: 0.1 },
    eyesEstimated: true,
    neck: { cx: 0.4941, y: 0.3125, w: 0.2773 },
    torso: { cx: 0.499, top: 0.3242, bottom: 0.8496, w: 0.5957 },
    feet: { cx: 0.5, y: 0.9121, w: 0.4023 },
  },
  'pig:super': {
    head: { cx: 0.4834, top: 0, bottom: 0.375, w: 0.4922 },
    eyes: { cx: 0.481, y: 0.2217, w: 0.11 },
    eyesEstimated: true,
    neck: { cx: 0.5176, y: 0.3877, w: 0.2773 },
    torso: { cx: 0.5225, top: 0.4004, bottom: 0.875, w: 0.459 },
    feet: { cx: 0.5146, y: 0.9375, w: 0.373 },
  },
  'dragon:baby': {
    head: { cx: 0.4961, top: 0, bottom: 0.3496, w: 0.5137 },
    eyes: { cx: 0.478, y: 0.225, w: 0.098 },
    eyesEstimated: true,
    neck: { cx: 0.499, y: 0.3623, w: 0.291 },
    torso: { cx: 0.5049, top: 0.375, bottom: 0.8496, w: 0.5527 },
    feet: { cx: 0.5107, y: 0.9121, w: 0.4395 },
  },
  'dragon:adult': {
    head: { cx: 0.5703, top: 0, bottom: 0.2246, w: 0.2266 },
    eyes: { cx: 0.5637, y: 0.091, w: 0.0599 },
    neck: { cx: 0.5635, y: 0.2373, w: 0.1465 },
    torso: { cx: 0.5664, top: 0.25, bottom: 0.8496, w: 0.418 },
    feet: { cx: 0.5742, y: 0.9121, w: 0.4258 },
  },
  'dragon:super': {
    head: { cx: 0.5557, top: 0, bottom: 0.25, w: 0.2871 },
    eyes: { cx: 0.5043, y: 0.2002, w: 0.0839 },
    neck: { cx: 0.5596, y: 0.2627, w: 0.2129 },
    torso: { cx: 0.541, top: 0.2754, bottom: 0.875, w: 0.4844 },
    feet: { cx: 0.5615, y: 0.9375, w: 0.4277 },
  },
};

/** Trung bình cộng 18 neo — "rig mặc định" khi thiếu dữ liệu (xem ghi chú đầu tệp). */
export const DEFAULT_PET_ANCHOR: PetAnchor = {
  head: { cx: 0.5076, top: 0.0028, bottom: 0.3071, w: 0.3865 },
  eyes: { cx: 0.4957, y: 0.1622, w: 0.1121 },
  neck: { cx: 0.5122, y: 0.3196, w: 0.2454 },
  torso: { cx: 0.5132, top: 0.332, bottom: 0.8567, w: 0.4333 },
  feet: { cx: 0.5207, y: 0.9192, w: 0.3904 },
};

/** Bàn chân TRÁI và PHẢI của một con × bậc (`cx` + `w` riêng từng bàn chân). */
export interface PetFeetAnchor {
  left: { cx: number; w: number };
  right: { cx: number; w: number };
}

/**
 * TÂM VÀ BỀ RỘNG TỪNG BÀN CHÂN — 18 cặp (con × bậc), khoá `"<petType>:<evolutionStage>"`.
 *
 * ⭐ VÌ SAO CẦN, DÙ ĐÃ CÓ `feet.w`:
 *   `feet.w` là bề rộng của **CẢ HAI** bàn chân gộp lại — đúng cho một món "một khối" (đôi giày
 *   trong cùng một ảnh). Nhưng khi ảnh giày là **MỘT CHIẾC** (để vẽ hai lần, lật gương cho chân
 *   kia — cách các game dress-up lớn làm), thì phải biết **từng bàn chân nằm ở đâu**.
 *
 * ⚠️ ĐO THẾ NÀO (`_verify/pet-probe/probe_feet.py` → `out/split-feasibility.json`):
 *   trong vùng chân (12% dưới cùng của mực), tìm hàng NGANG có **hai blob tách rời** rộng nhất;
 *   `cx`/`w` là tâm và bề rộng từng blob chia cho bề rộng ảnh. Cả **18/18 con** đều tách được
 *   (17–21 hàng có hai blob), nên bảng này KHÔNG có lỗ hổng.
 *
 * ⚠️ LÙI AN TOÀN: thiếu dữ liệu ⇒ `feetSplitFor` suy từ `feet` (hai bàn chân cách nhau ±22% `feet.w`,
 *   mỗi bàn rộng 28% `feet.w`) — giày vẫn HIỆN, chỉ kém chính xác. KHÔNG được ném lỗi.
 */
export const PET_FEET: Readonly<Record<string, PetFeetAnchor>> = {
  'cat:baby': { left: { cx: 0.3994, w: 0.1094 }, right: { cx: 0.6299, w: 0.1133 } },
  'cat:adult': { left: { cx: 0.374, w: 0.1094 }, right: { cx: 0.624, w: 0.1133 } },
  'cat:super': { left: { cx: 0.3799, w: 0.1094 }, right: { cx: 0.6484, w: 0.1152 } },
  'dog:baby': { left: { cx: 0.3877, w: 0.1328 }, right: { cx: 0.6377, w: 0.1289 } },
  'dog:adult': { left: { cx: 0.4209, w: 0.1016 }, right: { cx: 0.6377, w: 0.1016 } },
  'dog:super': { left: { cx: 0.3916, w: 0.1094 }, right: { cx: 0.6455, w: 0.1094 } },
  'pig:baby': { left: { cx: 0.4121, w: 0.0996 }, right: { cx: 0.6572, w: 0.1016 } },
  'pig:adult': { left: { cx: 0.3594, w: 0.1074 }, right: { cx: 0.6396, w: 0.1094 } },
  'pig:super': { left: { cx: 0.3779, w: 0.0977 }, right: { cx: 0.6445, w: 0.1035 } },
  'tiger:baby': { left: { cx: 0.3877, w: 0.1523 }, right: { cx: 0.6475, w: 0.1523 } },
  'tiger:adult': { left: { cx: 0.3867, w: 0.1348 }, right: { cx: 0.6504, w: 0.1387 } },
  'tiger:super': { left: { cx: 0.3877, w: 0.1328 }, right: { cx: 0.6387, w: 0.1426 } },
  'dragon:baby': { left: { cx: 0.3701, w: 0.1562 }, right: { cx: 0.6484, w: 0.1543 } },
  'dragon:adult': { left: { cx: 0.4297, w: 0.1348 }, right: { cx: 0.7031, w: 0.166 } },
  'dragon:super': { left: { cx: 0.4287, w: 0.1562 }, right: { cx: 0.6914, w: 0.166 } },
  'monkey:baby': { left: { cx: 0.377, w: 0.1543 }, right: { cx: 0.6113, w: 0.1543 } },
  'monkey:adult': { left: { cx: 0.3779, w: 0.1445 }, right: { cx: 0.6357, w: 0.1406 } },
  'monkey:super': { left: { cx: 0.3867, w: 0.127 }, right: { cx: 0.6514, w: 0.1719 } },
};

/**
 * Hai bàn chân của một cặp (con × bậc). Thiếu dữ liệu ⇒ suy từ `feet` (KHÔNG ném lỗi).
 *
 * ⚠️ Tỉ lệ lùi (0,22 / 0,28) lấy từ TRUNG BÌNH 18 neo đã đo: hai tâm cách nhau ≈ 0,44 `feet.w`,
 *    mỗi bàn rộng ≈ 0,28 `feet.w` ⇒ nửa khoảng cách 0,22. Nhờ vậy món giày một-chiếc vẫn nằm
 *    đúng chỗ ngay cả khi bảng trên thiếu một khoá.
 */
export function feetSplitFor(petType: PetType, evolutionStage: EvolutionStage): PetFeetAnchor {
  const found = PET_FEET[`${petType}:${evolutionStage}`];
  if (found !== undefined) return found;
  const { w } = petAnchorFor(petType, evolutionStage).feet;
  return {
    left: { cx: 0.5 - 0.22 * w, w: 0.28 * w },
    right: { cx: 0.5 + 0.22 * w, w: 0.28 * w },
  };
}

/**
 * Neo của một cặp (con × bậc). Thiếu dữ liệu ⇒ `DEFAULT_PET_ANCHOR` (KHÔNG ném lỗi).
 *
 * `petType`/`evolutionStage` đã được server phân giải, nhưng hàm vẫn tự vệ: một bảng tra thiếu
 * một khoá không được phép làm trắng màn hình của bé.
 */
export function petAnchorFor(petType: PetType, evolutionStage: EvolutionStage): PetAnchor {
  return PET_ANCHORS[`${petType}:${evolutionStage}`] ?? DEFAULT_PET_ANCHOR;
}
