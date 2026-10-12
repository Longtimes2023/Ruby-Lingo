/**
 * RubyLingo — Bố cục "Góc phòng của bé" (`/pet`).
 *
 * ⭐ VÌ SAO TÁCH RA MỘT MODULE HÀM THUẦN, KHÔNG NHÉT VÀO `PetHousePage.tsx`:
 *   Chủ dự án phàn nàn đúng một chỗ: khung phòng GIÃN theo màn hình còn đồ trang trí thì
 *   KHÔNG (chúng bị ghim ở 24px), nên "màn càng lớn càng nhỏ xíu". Sửa được lỗi đó nghĩa là
 *   mọi kích thước phải là PHẦN TRĂM CỦA KHUNG, không phải px. Mà phần trăm thì tính sai rất
 *   dễ (lẫn %W với %H, quên trừ nửa chiều cao khi neo theo `bottom`, …) và sai thì KHÔNG có
 *   lỗi biên dịch nào báo — chỉ có một cái phòng trông lệch. Đưa toàn bộ số học vào đây để
 *   nó TEST ĐƯỢC bằng hàm thuần, thay vì phải mở trình duyệt ra đo mới biết mình sai.
 *
 * ⭐ HAI HỆ TRỤC, ĐỪNG LẪN:
 *   • `%W` — phần trăm BỀ RỘNG khung. Dùng cho vị trí ngang và bề rộng vật thể.
 *   • `%H` — phần trăm CHIỀU CAO khung. Dùng cho vị trí dọc, đường chân tường, đáy vật thể.
 *   Khung là 4:3 (W > H), nên 1%H ≠ 1%W. Bản thân một món 12%W chỉ cao 12×(3/4) = 9%H.
 *   Mọi trường trong tệp này ghi rõ đơn vị ở TÊN (`…PctW` vs `…PctH` vs `Pct` khi %W).
 *
 * ⭐ GỐC TOẠ ĐỘ LÀ TÂM VẬT THỂ, KHÔNG PHẢI GÓC TRÊN-TRÁI:
 *   Lý do là KÉO-THẢ. `PetHousePage` lưu `{x, y}` = vị trí con trỏ chuột tính theo % khung, và
 *   đặt vật thể bằng `left: x% / top: y% + translate(-50%, -50%)`. Nếu ở đây trả về góc trên-trái
 *   thì hai hệ toạ độ lệch nhau đúng nửa vật thể, và món bé vừa kéo sẽ nhảy đi một đoạn — một
 *   lỗi chỉ hiện ra khi có người thật kéo thật.
 *
 * ⭐ HÌNH DẠNG PHÒNG (mô hình "2 dải" của Webkinz / My Boo / Pou / Toca Boca):
 *   • Tường: [0, 61,8%H] — 61,8% là tỉ lệ vàng, và cũng là mốc mà mắt người đọc ra "chân tường".
 *   • Baseboard: [61,8%, 64,3%H] — dải 2,5%H ngay dưới đường chân tường. Thiếu dải này thì
 *     tường và sàn dán liền nhau thành một vệt màu, đọc ra là "phông nền" chứ không phải phòng.
 *   • Sàn: [64,3%, 100%H].
 */

// =============================================================================
// Kiểu dữ liệu
// =============================================================================

/** Dải mà món trang trí thuộc về, suy từ `DecorationSlot` của danh mục (`sky` → tường). */
export type DecorationBand = 'wall' | 'floor';

/**
 * Làn xa–gần cho đồ đứng dưới sàn.
 *
 * ⭐ VÌ SAO CÓ KHÁI NIỆM "LÀN" MÀ KHÔNG CHỈ CÓ `y`:
 *   Trên một mặt sàn phẳng, độ xa được đọc ra từ BA thứ cùng lúc: vật càng xa thì đáy càng cao
 *   (gần đường chân tường) và càng NHỎ. Nếu chỉ ràng buộc `y` mà bỏ ràng buộc cỡ, một cái lâu đài
 *   to bằng cái chậu cây sẽ nằm xa hơn nó — mắt bé đọc ngay ra là sai, dù từng món vẫn "đúng
 *   chỗ". Ghim cả làn LẪN bề rộng theo làn giữ cho phối cảnh tự nhất quán.
 */
export type FloorLane = 'far' | 'mid' | 'near';

/** Thông số CỐ ĐỊNH của một món trang trí — nguồn duy nhất cho mọi con số bố cục. */
export interface DecorationLayoutSpec {
  /** Dải món này thuộc về. */
  readonly band: DecorationBand;
  /** Làn (chỉ có nghĩa với `band === 'floor'`; đồ treo tường để `null`). */
  readonly lane: FloorLane | null;
  /** Bề rộng vật thể, tính bằng % bề rộng khung. */
  readonly widthPct: number;
  /** Chiều cao vật thể, tính bằng % chiều cao khung. */
  readonly heightPct: number;
}

/** Hộp đã tính xong cho MỘT món, đủ để `PetHousePage` vẽ thẳng ra CSS. */
export interface DecorationBox {
  readonly itemId: string;
  /** Tâm ngang, % bề rộng khung (`left`). */
  readonly leftPct: number;
  /** Tâm dọc, % chiều cao khung (`top`). */
  readonly topPct: number;
  /** Bề rộng, % bề rộng khung. */
  readonly widthPct: number;
  /** Chiều cao, % chiều cao khung. */
  readonly heightPct: number;
  /** Đáy vật thể, % chiều cao khung — dùng để sắp lớp (đáy nhỏ = xa = vẽ trước). */
  readonly bottomPct: number;
  readonly band: DecorationBand;
  readonly lane: FloorLane | null;
}

/** Một điểm trong khung, đơn vị % (x theo %W, y theo %H). */
export interface RoomPoint {
  readonly x: number;
  readonly y: number;
}

// =============================================================================
// Hằng số hình học của phòng (đơn vị ghi trong tên)
// =============================================================================

/** Khung phòng là 4:3 — dùng để quy đổi giữa %W và %H. */
export const ROOM_ASPECT = { w: 4, h: 3 } as const;

/** Đường chân tường: tường ở TRÊN mốc này, sàn ở DƯỚI. (%H) */
export const WALL_LINE_PCT = 61.8;

/** Chiều cao dải baseboard ngay dưới đường chân tường. (%H) */
export const BASEBOARD_PCT = 2.5;

/** Mép trên của sàn = đáy của baseboard. (%H) */
export const FLOOR_TOP_PCT = WALL_LINE_PCT + BASEBOARD_PCT;

/** Chiều cao dải sàn. (%H) */
export const FLOOR_HEIGHT_PCT = 100 - FLOOR_TOP_PCT;

/** Đáy (bàn chân) của thú cưng. (%H) — thấp hơn chân tường ⇒ chân ở trong dải sàn. */
export const PET_BOTTOM_PCT = 84;

/** Chiều cao thú cưng. (%H) — đầu ở 84 − 46 = 38%H ⇒ ở trong dải tường. */
export const PET_HEIGHT_PCT = 46;

/** Đường đáy của ba làn đồ dưới sàn. (%H) */
export const LANE_BOTTOM_PCT: Readonly<Record<FloorLane, number>> = {
  far: 66,
  mid: 75,
  near: 86,
};

/** Hệ số phóng theo làn — làn càng gần thì món càng to. */
export const LANE_SCALE: Readonly<Record<FloorLane, number>> = {
  far: 0.62,
  mid: 0.82,
  near: 1,
};

/** Lề tối thiểu từ mép khung cho đồ TREO TƯỜNG. (%W) */
export const WALL_MARGIN_PCT = 6;

/** Khoảng hở tối thiểu giữa hai món treo tường cạnh nhau. (%W) */
export const WALL_GAP_PCT = 4;

/** Bề rộng cho phép của đồ treo tường. (%W) */
export const WALL_WIDTH_RANGE: readonly [number, number] = [12, 18];

/** Bề rộng cho phép của đồ dưới sàn, theo làn. (%W) */
export const LANE_WIDTH_RANGE: Readonly<Record<FloorLane, readonly [number, number]>> = {
  far: [10, 16],
  mid: [12, 20],
  near: [14, 24],
};

/** Khoảng cách tối thiểu giữ món kéo tay khỏi mép khung. (% toạ độ) */
export const CLAMP_INSET_PCT = 1;

// =============================================================================
// Bảng bố cục 10 món trang trí
// =============================================================================

/**
 * Bảng duy nhất: id món → dải + làn + cỡ.
 *
 * ⚠️ BẢNG NÀY PHẢI KHỚP DANH MỤC, VÀ CÓ TEST CANH. Một món trang trí mới thêm vào
 *    `shared/content/shop-items.json` mà quên điền ở đây thì bé mua xong sẽ **không thấy nó
 *    ở đâu cả** trên màn hình nhà — im lặng tuyệt đối. `pet-room-layout.test.ts` đối chiếu
 *    hai chiều với `decorationSlotOf()` của danh mục thật, nên quên là đỏ ngay.
 *
 * ⭐ CỠ ĐỒ DƯỚI SÀN ĐƯỢC SUY TỪ MỘT CỠ GỐC × HỆ SỐ LÀN, không phải gõ tay từng số — nếu không,
 *   chỉnh hệ số phóng sẽ phải sửa 5 dòng và dễ sửa lệch. Ghi chú dưới mỗi dòng là phép tính.
 *   Cỡ gốc = cỡ vật thể NẾU nó đứng ở làn gần nhất (hệ số 1,0).
 */
export const DECORATION_LAYOUT: Readonly<Record<string, DecorationLayoutSpec>> = {
  // --- Đồ TREO TƯỜNG (`slot: 'sky'`) — bề rộng 12–18%W, tâm y 22–32%H ---
  'dec-picture': { band: 'wall', lane: null, widthPct: 13, heightPct: 17.3 },
  'dec-flag': { band: 'wall', lane: null, widthPct: 12, heightPct: 16 },
  'dec-rainbow': { band: 'wall', lane: null, widthPct: 16, heightPct: 21.3 },
  'dec-balloon': { band: 'wall', lane: null, widthPct: 13, heightPct: 17.3 },
  'dec-lantern': { band: 'wall', lane: null, widthPct: 12, heightPct: 16 },

  // --- Đồ DƯỚI SÀN (`slot: 'ground'`) — cỡ = cỡ gốc × hệ số làn ---
  //     cỡ gốc 24 × 0,62 = 14,9
  'dec-treehouse': { band: 'floor', lane: 'far', widthPct: 14.9, heightPct: 19.9 },
  //     cỡ gốc 20 × 0,62 = 12,4
  'dec-plant': { band: 'floor', lane: 'far', widthPct: 12.4, heightPct: 16.5 },
  //     cỡ gốc 24 × 0,82 = 19,7
  'dec-castle': { band: 'floor', lane: 'mid', widthPct: 19.7, heightPct: 26.3 },
  //     cỡ gốc 20 × 0,82 = 16,4
  'dec-sunflower': { band: 'floor', lane: 'mid', widthPct: 16.4, heightPct: 21.9 },
  //     cỡ gốc 22 × 1,00 = 22,0
  'dec-aquarium': { band: 'floor', lane: 'near', widthPct: 22, heightPct: 29.3 },
};

/**
 * Thứ tự bày mặc định của đồ treo tường, TRÁI → PHẢI.
 *
 * ⭐ VÌ SAO CỐ ĐỊNH THỨ TỰ NÀY, KHÔNG SẮP THEO id HAY THEO TÚI ĐỒ:
 *   Vị trí mặc định phải ỔN ĐỊNH giữa các lần tải. Nếu sắp theo thứ tự túi đồ (thứ tự bé mua),
 *   thì mua thêm một món sẽ làm cả bức tường xếp lại — bé thấy tranh của mình nhảy chỗ mà không
 *   hiểu vì sao. Một danh sách cố định thì món nào cũng chỉ có MỘT chỗ, mãi mãi.
 */
const WALL_ORDER: readonly string[] = [
  'dec-picture',
  'dec-flag',
  'dec-rainbow',
  'dec-balloon',
  'dec-lantern',
];

/** Tâm y mặc định của từng món treo tường (%H) — giữ trong dải 22–32%H. */
const WALL_CENTER_Y_PCT: Readonly<Record<string, number>> = {
  'dec-picture': 26,
  'dec-flag': 24,
  'dec-rainbow': 31,
  'dec-balloon': 25,
  'dec-lantern': 27,
};

/**
 * Tâm x mặc định của từng món dưới sàn (%W).
 *
 * ⭐ VÌ SAO KHÔNG CHIA ĐỀU MỘT HÀNG NGANG Ở GIỮA: thú cưng đứng ở 50%W. Một cái bể cá đặt ngay
 *   giữa sẽ che mất con vật — mà che mất con vật là mất luôn phần thưởng của cả màn hình này.
 *   Đồ gần được đẩy về hai bên để hành lang giữa (khoảng 40–62%W) luôn trống cho bé ngắm con.
 */
const FLOOR_CENTER_X_PCT: Readonly<Record<string, number>> = {
  'dec-treehouse': 18,
  'dec-plant': 82,
  'dec-castle': 26,
  'dec-sunflower': 74,
  'dec-aquarium': 70,
};

// =============================================================================
// Quy đổi đơn vị
// =============================================================================

/** Làm tròn 1 chữ số thập phân — mọi con số trong tệp này đi qua đây trước khi trả ra. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Đổi một độ dài đo bằng %H sang đơn vị `cqw` (1cqw = 1% bề rộng khung) khi khung là 4:3.
 *
 * ⭐ VÌ SAO CẦN: bề rộng của một vật nằm trong ô chạm 64px KHÔNG thể đo bằng `%` (nó sẽ ăn theo
 *   64px của ô chạm, không phải theo khung), mà `vw` thì lại phụ thuộc màn hình — đúng cái bệnh
 *   đang phải chữa. `cqw` là đơn vị duy nhất vừa độc lập viewport, vừa đo được theo khung phòng.
 *   Cần khung có `container-type: inline-size` (xem `PetHousePage`).
 */
export function pctHToCqw(pctH: number): number {
  return round1(pctH * (ROOM_ASPECT.h / ROOM_ASPECT.w));
}

/** Cỡ hiển thị của ảnh một món trang trí, tính bằng `cqw`. */
export interface DecorationRenderSize {
  readonly widthCqw: number;
  readonly heightCqw: number;
}

/**
 * Cỡ ảnh của một món, quy ra `cqw`.
 *
 * ⭐ VÌ SAO ẢNH VÀ Ô CHẠM LÀ HAI THỨ KHÁC NHAU: ô chạm phải ≥64px cho tay trẻ con, nhưng ở khung
 *   360px thì 12%W chỉ ~39px. Nếu bắt ô chạm co xuống 39px là vi phạm ngưỡng chạm; nếu để ô chạm
 *   phình lên 64px và cho ảnh ăn theo thì món trang trí lại thành 19,5%W — VƯỢT khoảng cho phép,
 *   tức là tỉ lệ lại phụ thuộc màn hình (đúng cái bệnh cũ). Nên: ô chạm giữ nguyên 64px, ảnh bên
 *   trong đo bằng `cqw` — hai thứ độc lập, ai lo việc nấy.
 */
export function decorationRenderSize(spec: DecorationLayoutSpec): DecorationRenderSize {
  return {
    widthCqw: round1(spec.widthPct),
    heightCqw: pctHToCqw(spec.heightPct),
  };
}

// =============================================================================
// Tính hộp
// =============================================================================

/** Dựng hộp từ tâm + cỡ. Mọi hàm bên dưới đều đi qua đây để `bottomPct` không thể lệch. */
function makeBox(
  itemId: string,
  spec: DecorationLayoutSpec,
  leftPct: number,
  topPct: number,
): DecorationBox {
  return {
    itemId,
    leftPct: round1(leftPct),
    topPct: round1(topPct),
    widthPct: spec.widthPct,
    heightPct: spec.heightPct,
    bottomPct: round1(topPct + spec.heightPct / 2),
    band: spec.band,
    lane: spec.lane,
  };
}

/** Tra thông số của một món. `undefined` = id lạ (không phải trang trí của dự án này). */
export function decorationSpec(itemId: string): DecorationLayoutSpec | undefined {
  return DECORATION_LAYOUT[itemId];
}

/**
 * Xếp đồ treo tường trái → phải theo `WALL_ORDER`, giữ lề và khoảng hở.
 *
 * Tính MỘT LẦN ở cấp module: bảng là hằng số, nên vị trí là hằng số.
 */
const WALL_CENTER_X_PCT: ReadonlyMap<string, number> = (() => {
  const centers = new Map<string, number>();
  let cursor = WALL_MARGIN_PCT;
  for (const itemId of WALL_ORDER) {
    const spec = DECORATION_LAYOUT[itemId];
    if (spec === undefined) continue;
    centers.set(itemId, round1(cursor + spec.widthPct / 2));
    cursor = cursor + spec.widthPct + WALL_GAP_PCT;
  }
  return centers;
})();

/**
 * Hộp MẶC ĐỊNH của một món khi bé chưa tự kéo nó.
 *
 * ⚠️ Trả `undefined` (không ném) khi id không có trong bảng: hàm này chạy trong lúc render, và
 *    ném ở đó là trắng cả màn hình của bé vì một dòng dữ liệu. Người gọi bỏ qua món đó.
 */
export function defaultDecorationBox(itemId: string): DecorationBox | undefined {
  const spec = DECORATION_LAYOUT[itemId];
  if (spec === undefined) return undefined;

  if (spec.band === 'wall') {
    const leftPct = WALL_CENTER_X_PCT.get(itemId);
    const topPct = WALL_CENTER_Y_PCT[itemId];
    if (leftPct === undefined || topPct === undefined) return undefined;
    return makeBox(itemId, spec, leftPct, topPct);
  }

  const lane = spec.lane ?? 'near';
  const leftPct = FLOOR_CENTER_X_PCT[itemId];
  if (leftPct === undefined) return undefined;
  // Neo theo ĐÁY: đáy món nằm đúng đường làn, nên tâm nằm cao hơn nửa chiều cao.
  const topPct = LANE_BOTTOM_PCT[lane] - spec.heightPct / 2;
  return makeBox(itemId, spec, leftPct, topPct);
}

/**
 * Hộp của một món BÉ ĐÃ TỰ KÉO — tôn trọng `x/y` đã lưu, chỉ kẹp lại cho nằm trong khung.
 *
 * ⭐ VÌ SAO KHÔNG "SỬA LẠI CHO ĐÚNG LÀN": bé kéo quả bóng bay xuống sát sàn là một lựa chọn của
 *   bé, không phải lỗi dữ liệu. Bố cục theo làn chỉ là ĐIỂM XUẤT PHÁT; sau khi bé chạm vào thì
 *   ý của bé thắng. Kẹp biên thì khác: một món nằm ngoài khung là món bé KHÔNG THỂ kéo lại được
 *   (không bấm vào được), nên kẹp là bắt buộc.
 */
export function placedDecorationBox(
  itemId: string,
  xPct: number,
  yPct: number,
): DecorationBox | undefined {
  const spec = DECORATION_LAYOUT[itemId];
  if (spec === undefined) return undefined;
  const point = clampToRoom(xPct, yPct);
  return makeBox(itemId, spec, point.x, point.y);
}

/**
 * Kẹp một toạ độ vào trong khung, chừa `CLAMP_INSET_PCT` ở mỗi mép.
 *
 * ⚠️ Đầu vào là DỮ LIỆU TỪ SERVER (`room.placements`), có thể là `NaN` nếu một bản ghi cũ hỏng.
 *    `Math.min/max` với `NaN` trả về `NaN`, và `left: NaN%` làm phần tử biến mất — bé mất món đồ
 *    mà không có thông báo nào. Nên giá trị không hữu hạn bị coi là "về mép an toàn".
 */
export function clampToRoom(xPct: number, yPct: number): RoomPoint {
  return {
    x: clampAxis(xPct),
    y: clampAxis(yPct),
  };
}

function clampAxis(value: number): number {
  if (!Number.isFinite(value)) return CLAMP_INSET_PCT;
  const low = CLAMP_INSET_PCT;
  const high = 100 - CLAMP_INSET_PCT;
  return round1(Math.min(high, Math.max(low, value)));
}

/**
 * Sắp lớp vẽ: ĐÁY TĂNG DẦN (đáy nhỏ = xa hơn = vẽ trước).
 *
 * ⭐ VÌ SAO SẮP THEO ĐÁY MÀ KHÔNG THEO LÀN HAY THEO `z-index` GÕ TAY: khi bé tự kéo, món nào cũng
 *   có thể ở bất kỳ đâu, nên "xa/gần" phải được SUY RA từ hình học chứ không từ một con số ai đó
 *   gán. Đáy là mốc duy nhất mà mắt dùng để đọc thứ tự chồng: vật có đáy thấp hơn đứng trước.
 *   Sắp theo đáy thì tự khắc đúng, kể cả với vị trí bé vừa kéo.
 */
export function sortByBottom<T extends { bottomPct: number }>(nodes: readonly T[]): T[] {
  return [...nodes].sort((a, b) => a.bottomPct - b.bottomPct);
}
