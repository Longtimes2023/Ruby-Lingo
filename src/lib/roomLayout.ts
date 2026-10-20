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
  /**
   * Mép dưới PHẦN HÌNH trong ảnh (0..1, đo từ đỉnh). Ảnh 512² có viền trong suốt nên đáy hộp ≠
   * đáy hình; dùng số này để neo đúng đường làn.
   */
  readonly inkBottom: number;
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
  /** Đáy PHẦN HÌNH (mép dưới mực), % chiều cao khung — sắp lớp: đáy nhỏ = xa = vẽ trước. */
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

/**
 * Hệ số phóng theo làn — làn càng gần thì món càng to.
 *
 * ⚠️ HỆ SỐ NÀY ĐÃ NẰM SẴN TRONG CỠ CỦA `DECORATION_LAYOUT`, KHÔNG NHÂN LẠI Ở ĐÂY HAY Ở CHỖ KHÁC.
 *   Bảng `DECORATION_LAYOUT` dưới đây là số đã tính sẵn
 *   (`boxW = NOMINAL × LANE_SCALE[lane] ÷ √(fracW · fracH · 4/3)`), ghi ra thành số cụ thể để đọc
 *   được ngay trên giấy và để test canh bằng số. Ai nhân thêm `LANE_SCALE` một lần nữa sẽ làm món
 *   ở làn `far` nhỏ đi 38% và món ở làn `near` phóng to gấp rưỡi — lỗi không có thông báo nào.
 *
 * ⭐ SỬA LỊCH SỬ: trước 2026-10-15 khối này là MÃ CHẾT (`grep -rn "LANE_SCALE" src/` chỉ ra đúng
 *   dòng khai báo). Phối cảnh xa–gần được mô tả trong tài liệu nhưng chưa bao giờ được áp dụng:
 *   cỡ món do một con số gõ tay khác quyết định, nên "làn gần" và "làn xa" không phân biệt được
 *   bằng cỡ. Nay hệ số này là nguồn của cột `widthPct` trong bảng đó.
 */
export const LANE_SCALE: Readonly<Record<FloorLane, number>> = {
  far: 0.62,
  mid: 0.82,
  near: 1,
};

/** Lề tối thiểu từ mép khung cho đồ TREO TƯỜNG. (%W) */
export const WALL_MARGIN_PCT = 6;

/**
 * Khoảng hở tối thiểu giữa hai món treo tường nằm CÙNG HÀNG. (%W) — **KHÔNG ĐỔI** trong đợt
 * phóng to 2026-10-20, và đây là lý do.
 *
 * ⚠️ Hạ từ 4 xuống 1 khi bố cục tường đổi từ MỘT hàng sang HAI CỘT (xem `WALL_SLOTS`): hai bên
 *   vùng giữa mỗi bên chỉ còn 26 %W, mà hai món nhỏ nhất đã chiếm 13 + 12 = 25 %W. 4 %W không còn
 *   chỗ để tồn tại. 1 %W là mức tối thiểu để mắt còn tách được hai vật rời nhau — và quan trọng
 *   hơn: hai vật KHÔNG chồng lên nhau, thứ mà test khoá lại.
 *
 * ⚠️⚠️ ĐỌC KỸ TRƯỚC KHI "SỬA CHO KHỚP BỐ CỤC 3 HÀNG": đây là khe **NGANG** (cùng hàng = cùng
 *   `topPct`). Bố cục 2026-10-20 xếp 5 món thành 3 hàng, mỗi hàng đúng MỘT món mỗi cột ⇒ không
 *   còn cặp nào "cùng hàng", nên luật này hiện không có cặp nào để áp. Khe **DỌC** (giữa hai hàng
 *   trong cùng một cột) là chuyện khác và được canh bằng "hai hộp không chồng nhau", không bằng
 *   hằng này — hạ nó xuống 0 sẽ làm hỏng luật ngang mà không canh được gì thêm.
 *
 *   Số thật của bố cục mới, để sau này khỏi phải đo lại: khe dọc giữa hai HỘP là 0,7 và 1,05 %H
 *   (cột phải), 4,6 %H (cột trái); khe dọc giữa hai PHẦN HÌNH là 5,4 và 2,2 %H (cột phải),
 *   15,1 %H (cột trái). Tức là mắt luôn thấy khoảng trống, dù hộp ảnh gần chạm nhau.
 */
export const WALL_GAP_PCT = 1;

/**
 * Bề rộng cho phép của đồ treo tường. (%W)
 *
 * ⭐ SUY TỪ BẢNG, KHÔNG PHẢI SỐ ƯA MẮT (2026-10-20, đợt "phóng to đồ trang trí"):
 *   5 món treo tường mới rộng **14,6 … 19,6 %W** (`NOMINAL` 13,4). Hai biên lấy đúng hai đầu
 *   cực trị của bảng rồi chừa ~15% mỗi phía: `14,6 × 0,85 ≈ 12,4` và `19,6 × 1,15 ≈ 22,5`.
 *
 *   ⚠️ Khoảng NÀY RỘNG HƠN bảng (12,4 … 22,5 so với 14,6 … 19,6) là CÓ CHỦ Ý: nó là lưới an toàn
 *      cho một món mới thêm vào danh mục, không phải bản chép lại của bảng. Siết về đúng
 *      `[14,6, 19,6]` thì mọi món thêm sau này đều đỏ vì "không khớp NOMINAL", trong khi thứ cần
 *      bắt là "món to/nhỏ bất thường" — chênh 15% là mức mắt còn bỏ qua được.
 */
export const WALL_WIDTH_RANGE: readonly [number, number] = [12.5, 22.5];

/**
 * VÙNG GIỮA CỦA BỨC TƯỜNG, CHỪA RIÊNG CHO THÚ CƯNG (VÀ MŨ CỦA NÓ). (%W)
 *
 * ⭐ VÌ SAO PHẢI CHỪA: đây là một lỗi đã ĐO ĐƯỢC trên trình duyệt thật, không phải phòng xa.
 *   Bản trước rải 5 món treo tường thành MỘT HÀNG NGANG từ lề trái (lề 6, hở 4), nên món thứ ba
 *   — cầu vồng — rơi đúng **47%W**, tức là ngay sau gáy thú cưng (thú cưng ở 32,75–67,25%W).
 *   Lúc thú cưng còn "trần truồng" trong phòng thì chỉ bị che một mẩu nhỏ ở đỉnh đầu; nhưng từ khi
 *   bản vá cho con vật TRONG PHÒNG mặc đủ phụ kiện, chiếc mũ nhô lên tới ~15%H và **che kín cả cầu
 *   vồng** — mắt đọc ra "cái mũ có hình cầu vồng".
 *
 * ⭐ SUY TỪ HÌNH HỌC THÚ CƯNG, KHÔNG PHẢI SỐ ƯA MẮT: hộp thú cưng rộng `pctHToCqw(PET_HEIGHT_PCT)`
 *   = 34,5%W, canh giữa ở 50%W ⇒ 32,75–67,25%W; `floor`/`ceil` để nới ra ngoài (an toàn hơn).
 *   Đổi `PET_HEIGHT_PCT` là vùng này tự đổi theo — không có hai nguồn sự thật.
 */
export const WALL_RESERVED_X_PCT: readonly [number, number] = [
  Math.floor(50 - pctHToCqw(PET_HEIGHT_PCT) / 2),
  Math.ceil(50 + pctHToCqw(PET_HEIGHT_PCT) / 2),
];

/**
 * Bề rộng cho phép của đồ dưới sàn, theo làn. (%W)
 *
 * ⭐ SUY TỪ `NOMINAL × LANE_SCALE ÷ khoảng bề rộng ink` (2026-10-20, đợt "phóng to đồ trang trí"),
 *   không còn là số gõ tay. Với `NOMINAL` sàn = 25,5, ba làn ra **15,5–16,5 / 22,0–26,1 / 30,5**
 *   %W (`_verify/build-deco-layout.mjs` in lại được từng con số). Mỗi biên chừa ~15%:
 *
 *     • `far`  : 15,5 × 0,85 = 13,2 → **13** ; 16,5 × 1,15 = 19,0 → **19**
 *     • `mid`  : 22,0 × 0,85 = 18,7 → **18,5** ; 26,1 × 1,15 = 30,0 → **30**
 *     • `near` : 30,5 × 0,85 = 25,9 → **26** ; 30,5 × 1,15 = 35,1 → **35**
 *
 *   ⚠️ Ba khoảng GỐI NHAU MỘT CHÚT (`far` cao nhất 19 so với `mid` thấp nhất 18,5 — lệch 0,5).
 *      Đó là dấu hiệu đúng của phối cảnh, không phải lỗi: một món ở làn `far` mà to gần bằng món
 *      nhỏ nhất của làn `mid` thì mắt vẫn đọc ra "hơi xa hơn", trong khi nếu ba khoảng rời hẳn
 *      nhau thì một món đặt lệch làn sẽ lộ ngay thành "món to đứng xa". Test
 *      `'làn càng gần thì món càng to'` vẫn canh được phối cảnh thật vì nó so cỡ LỚN NHẤT của
 *      từng làn trên bảng, chứ không so hai khoảng khai báo.
 */
export const LANE_WIDTH_RANGE: Readonly<Record<FloorLane, readonly [number, number]>> = {
  far: [13, 19],
  mid: [18.5, 30],
  near: [26, 35],
};

/** Khoảng cách tối thiểu giữ món kéo tay khỏi mép khung. (% toạ độ) */
export const CLAMP_INSET_PCT = 1;

// =============================================================================
// Bảng bố cục 10 món trang trí
// =============================================================================

/**
 * Bảng duy nhất: id món → dải + làn + cỡ + mép dưới phần hình.
 *
 * ⚠️ BẢNG NÀY PHẢI KHỚP DANH MỤC, VÀ CÓ TEST CANH. Một món trang trí mới thêm vào
 *    `shared/content/shop-items.json` mà quên điền ở đây thì bé mua xong sẽ **không thấy nó
 *    ở đâu cả** trên màn hình nhà — im lặng tuyệt đối. `pet-room-layout.test.ts` đối chiếu
 *    hai chiều với `decorationSlotOf()` của danh mục thật, nên quên là đỏ ngay.
 *
 * -----------------------------------------------------------------------------
 * ⭐ QUY TẮC SUY RA MỌI CON SỐ DƯỚI ĐÂY (chủ dự án: *"Canh lại tỷ lệ của các đồ trang trí"*)
 * -----------------------------------------------------------------------------
 *   Ba nguyên nhân đã ĐO ĐƯỢC trên trình duyệt thật, không phải suy đoán:
 *
 *   1. **Đáy món không nằm trên đường làn.** Bản trước neo `bottomPct = topPct + heightPct / 2`,
 *      tức là đáy HỘP ảnh. Nhưng ảnh shop là 512×512 có VIỀN TRONG SUỐT, nên mép dưới phần hình
 *      (ink) nằm cao hơn đáy hộp: đo được món chìm **+7,4 … +10,4 %H** so với đường làn. Dải sàn
 *      chỉ cao 35,7 %H ⇒ lệch 10 %H là hơn 1/4 dải sàn, mắt đọc ra "món đồ lơ lửng".
 *   2. **Cỡ tuỳ tiện.** Phần hình trong ảnh chiếm 54–96 % bề ngang, nên hai món cùng `widthPct`
 *      trông rất khác cỡ: bề rộng THẤY ĐƯỢC trải 5,9 → 17,1 %W (2,89 lần).
 *   3. **`LANE_SCALE` là mã chết** — phối cảnh xa–gần chưa bao giờ được áp dụng (xem ghi chú ở
 *      khối `LANE_SCALE`).
 *
 *   Công thức dùng để tính bảng này, từ bbox alpha thật của từng ảnh (`fracW`, `fracH`,
 *   `inkBottom` — xem bảng `_verify/ink.json`), với ảnh VUÔNG đặt trong khung 4:3:
 *
 *     boxW = NOMINAL × LANE_SCALE[lane] ÷ √(fracW · fracH · 4/3)
 *     boxH = boxW × 4/3                 ← hộp VUÔNG theo cqw, ảnh không méo
 *     top  = LANE_BOTTOM_PCT[lane] + boxH × (0,5 − inkBottom)
 *
 *   `NOMINAL` = **25,5** cho đồ dưới sàn, **13,4** cho đồ treo tường (tường không có phối cảnh
 *   ⇒ hệ số làn = 1). `boxW` chia cho √(fracW·fracH·4/3) là để bù phần trong suốt: món có ít
 *   mực trong ảnh (hướng dương: 54 % × 89 %) phải được vẽ HỘP TO HƠN để phần HÌNH to đúng cỡ
 *   danh nghĩa. Nhờ vậy "cùng 17 %W danh nghĩa" = "cùng cỡ mắt nhìn thấy", không phụ thuộc ảnh.
 *
 * -----------------------------------------------------------------------------
 * ⭐ 2026-10-20 — PHÓNG TO 1,5× (sàn) / 1,2× (tường): `NOMINAL` 17,0 → 25,5 và 11,2 → 13,4
 * -----------------------------------------------------------------------------
 *   Chủ dự án: *"tỷ lệ đồ trang trí cho nó bự ra gấp đôi đi, nhìn nó nhỏ quá"*.
 *
 *   ⚠️ GẤP ĐÔI LÀ **BẤT KHẢ THI**, và đây là số chứng minh (không phải cảm tính):
 *     • Đồ DƯỚI SÀN: 5 món, bề rộng MỰC cộng lại ở 1× = **55,6 %W**. Nhân 2 ⇒ **111,2 %W**, trong
 *       khi cả khung chỉ có 100 %W và vùng dành cho đồ còn hẹp hơn nhiều (phải chừa cột của con
 *       vật ở giữa, xem `FLOOR_CENTER_X_PCT`). Ở 1,5× tổng là **83,2 %W** — vừa đủ để 5 món còn
 *       nhìn thấy nhau mà không món nào nuốt món nào.
 *     • Đồ TREO TƯỜNG: 5 món, tổng chiều cao HỘP ở 1× = **89,0 %H**, mà dải tường chỉ cao
 *       **61,8 %H** và chỉ có 2 cột (6…32 và 68…94 %W). Chia 2 cột thì cột nặng nhất (3 món thấp
 *       nhất) = **49,8 %H** ở 1× ⇒ hệ số tối đa = 61,8 ÷ 49,8 = **1,24**; chọn **1,20** để còn
 *       khe thở. Ở 1,2× cột đó cao 59,7 %H — vẫn còn 2,1 %H cho hai khe dọc.
 *
 *   ⚠️ VÌ SAO KHÔNG "CỨ PHÓNG TO RỒI CHO CHỒNG NHAU": chồng nhau ở đây không phải chi tiết nhỏ.
 *     Ở 2×, bể cá (mực 31,7 %W, cao 36,4 %H — bằng 2/3 con mèo) sẽ phủ kín hướng dương đứng
 *     cạnh nó, tức là bé mua hai món mà chỉ thấy một. Cỡ và khoảng cách là **một** ràng buộc,
 *     không phải hai.
 *
 *   Số dưới đây in lại được bằng `_verify/build-deco-layout.mjs` (đọc bbox alpha thật từ
 *   `_verify/ink.json`), nên lần sau muốn đổi hệ số chỉ cần chạy lại script rồi dán bảng.
 *
 *   ⚠️⚠️ `heightPct` KHÔNG phải "boxH làm tròn cho gần" — nó được CHỌN trong khoảng ±0,05 quanh
 *     `widthPct × 4/3` sao cho `pctHToCqw(heightPct) === widthPct` ĐÚNG BẰNG ở mức 1 chữ số thập
 *     phân. Ví dụ cờ: `19,6 × 4/3 = 26,133` ⇒ chọn **26,1** (26,1 × 0,75 = 19,575 → 19,6 ✓) chứ
 *     không phải 26,2 (26,2 × 0,75 = 19,65 → 19,7 ✗). Đây là điều kiện "HỘP VUÔNG, ảnh 1:1 không
 *     bị bóp méo", và có test canh (`--room-h` phải bằng `--room-w`); làm tròn theo kiểu thông
 *     thường sẽ làm nó lệch 0,1 cqw và test đỏ. Bóng bay là ca thứ hai: 14,8 × 4/3 = 19,733 ⇒
 *     19,7 (không phải 19,8).
 *
 * -----------------------------------------------------------------------------
 * ⚠️ VÌ SAO GHI SỐ CỤ THỂ CHỨ KHÔNG TÍNH LÚC CHẠY
 * -----------------------------------------------------------------------------
 *   Bảng này là DỮ LIỆU BỐ CỤC, không phải dữ liệu người dùng: 5 con số cho mỗi món, đổi rất ít,
 *   và phải ĐỌC ĐƯỢC để còn canh tỉ lệ bằng mắt. Tính lúc chạy từ `fracW/fracH` buộc phải nạp
 *   thuộc tính ảnh (hoặc chép lại 30 con số bbox) ở đây, rồi mỗi lần chỉnh một món lại phải chạy
 *   một script đo ảnh mới biết kết quả — trong khi thứ cần chỉnh là "món này trông hơi to".
 *   Test `room-layout.test.ts` khoá đúng những hệ quả mà mắt quan tâm (đáy trùng làn, bề rộng
 *   trong khoảng của làn, làn gần to hơn làn xa), nên ghi số vẫn được canh đầy đủ.
 */
export const DECORATION_LAYOUT: Readonly<Record<string, DecorationLayoutSpec>> = {
  // --- Đồ TREO TƯỜNG (`slot: 'sky'`) — NOMINAL 13,4 (= 11,2 × 1,2), hệ số làn = 1 ---
  'dec-picture': { band: 'wall', lane: null, widthPct: 15.5, heightPct: 20.7, inkBottom: 0.87 },
  'dec-flag': { band: 'wall', lane: null, widthPct: 19.6, heightPct: 26.1, inkBottom: 0.69 },
  'dec-rainbow': { band: 'wall', lane: null, widthPct: 15.4, heightPct: 20.5, inkBottom: 0.80 },
  'dec-balloon': { band: 'wall', lane: null, widthPct: 14.8, heightPct: 19.7, inkBottom: 0.97 },
  'dec-lantern': { band: 'wall', lane: null, widthPct: 14.6, heightPct: 19.4, inkBottom: 0.98 },

  // --- Đồ DƯỚI SÀN (`slot: 'ground'`) — NOMINAL 25,5 (= 17,0 × 1,5) × hệ số làn ---
  'dec-treehouse': { band: 'floor', lane: 'far', widthPct: 15.5, heightPct: 20.7, inkBottom: 0.94 },
  'dec-plant': { band: 'floor', lane: 'far', widthPct: 16.5, heightPct: 22.0, inkBottom: 0.95 },
  'dec-castle': { band: 'floor', lane: 'mid', widthPct: 22.0, heightPct: 29.3, inkBottom: 0.89 },
  'dec-sunflower': { band: 'floor', lane: 'mid', widthPct: 26.1, heightPct: 34.8, inkBottom: 0.95 },
  'dec-aquarium': { band: 'floor', lane: 'near', widthPct: 30.5, heightPct: 40.7, inkBottom: 0.84 },
};

/**
 * Thứ tự bày mặc định của đồ treo tường — món thứ N nhận ô thứ N trong `WALL_SLOTS`.
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

/**
 * Ô treo tường mặc định — TÂM của từng món, theo đúng thứ tự `WALL_ORDER`. (%W, %H)
 *
 * ⭐ VÌ SAO VIẾT TAY TỪNG Ô, KHÔNG CÒN "CHẠY CURSOR TỪ LỀ TRÁI":
 *   Thuật toán cursor cũ chỉ có MỘT hàng, nên không thể né vùng giữa — mà vùng giữa thì BẮT BUỘC
 *   phải né (xem `WALL_RESERVED_X_PCT`). Nhét thêm luật "nhảy qua vùng cấm" vào cursor thì kết quả
 *   lại là 3 hàng, mà 3 hàng thì hàng cuối rơi xuống dưới đường chân tường. Viết tay 5 ô là cách
 *   duy nhất vừa né được vùng giữa, vừa giữ mọi đáy trên chân tường, vừa ĐỌC ĐƯỢC ngay trên giấy.
 *
 * ⭐ VÌ SAO PHẢI LÀ HAI CỘT (chứ không phải một hàng): 5 món rộng 14,6–19,6 %W cần ~86 %W cho
 *   một hàng, mà hai bên vùng giữa chỉ còn 6–32 và 68–94 (26 %W mỗi bên). Vùng giữa là BẮT BUỘC
 *   né (xem `WALL_RESERVED_X_PCT`), nên mọi cách xếp đều phải dùng hai cột.
 *
 * ⭐ BỐ CỤC: cột trái = tranh (trên) + cờ (dưới); cột phải = cầu vồng + bóng bay + đèn lồng, ba
 *   món thấp nhất xếp chồng. Cân đối hai bên, và không món nào lấn vào cột của thú cưng.
 *
 * ⚠️ MỌI CON SỐ Ở ĐÂY CÓ TEST CANH (`room-layout.test.ts`): lề ≥6%W, không chồng nhau (xét CẢ
 *   hai chiều), không lấn vùng giữa, hộp nằm trọn trong dải tường. Sửa số mà quên chạy test là
 *   đỏ ngay.
 *
 * -----------------------------------------------------------------------------
 * ⭐ BỐ CỤC MỚI — 2026-10-20 (đồ treo tường phóng 1,2×): 2 cột × (2 + 3) hàng
 * -----------------------------------------------------------------------------
 *   Với `NOMINAL` 11,2 → 13,4, chiều cao HỘP của 5 món là 20,7 / 26,1 / 20,5 / 19,7 / 19,4 %H,
 *   tổng **106,4 %H** — mà dải tường chỉ cao 61,8 %H. Không có cách nào xếp thành 2 hàng như
 *   trước (2 hàng thì mỗi cột phải chứa ≥ 3 món, tức là 3 hàng; nói cách khác **5 món to hơn
 *   buộc phải thành 3 hàng**). Cách chia tốt nhất — cột 3 món dùng BA MÓN THẤP NHẤT:
 *
 *     • Cột TRÁI  (6…32 %W): tranh 20,7 + cờ 26,1           = 46,8 %H
 *     • Cột PHẢI (68…94 %W): cầu vồng 20,5 + bóng bay 19,7 + đèn lồng 19,4 = **59,6 %H** ✓ < 61,8
 *
 *   Cột phải chỉ còn **2,2 %H** cho hai khe dọc ⇒ khe hộp 0,7 và 1,05 %H. Nghe rất sát, nhưng
 *   đó là khe giữa HỘP ẢNH (512² có viền trong suốt), không phải khe giữa hai vật: mép dưới MỰC
 *   của cầu vồng ở 16,7 %H còn mép trên MỰC của bóng bay ở 22,1 %H ⇒ mắt thấy **5,4 %H** trống;
 *   bóng bay → đèn lồng là **2,2 %H** trống. Xem `WALL_GAP_PCT` (đó là khe NGANG, không đổi).
 *
 *   Số dưới đây chứng minh từng ràng buộc (toạ độ là TÂM, hộp = tâm ± nửa cỡ):
 *
 *     tranh     x 17,5 → hộp [ 9,8, 25,3]   y 12,0 → hộp [ 1,7, 22,4]   mực [11,5, 23,5] × [ 4,5, 19,6]
 *     cờ        x 20,5 → hộp [10,7, 30,3]   y 40,0 → hộp [27,0, 53,1]   mực [11,8, 29,2] × [34,6, 45,9]
 *     cầu vồng  x 81,0 → hộp [73,3, 88,7]   y 10,6 → hộp [ 0,4, 20,9]   mực [73,6, 88,4] × [ 4,5, 16,7]
 *     bóng bay  x 78,5 → hộp [71,1, 85,9]   y 31,4 → hộp [21,6, 41,3]   mực [73,7, 83,3] × [22,1, 40,7]
 *     đèn lồng  x 83,5 → hộp [76,2, 90,8]   y 52,0 → hộp [42,3, 61,7]   mực [78,6, 88,4] × [42,8, 61,2]
 *
 *     ✔ mọi hộp nằm trong dải tường: mép trên ≥ 0,4 và mép dưới ≤ 61,7 (< 61,8)
 *     ✔ lề ≥ 6 %W: trái nhất 9,8; phải nhất 90,8 (còn 9,2 tới mép khung)
 *     ✔ không lấn cột thú cưng: cột trái có mép phải ≤ 30,3 (< 32); cột phải có mép trái ≥ 71,1 (> 68)
 *     ✔ không hai hộp nào chồng nhau (cột khác nhau ⇒ tách hẳn; trong cùng cột ⇒ khe dọc ≥ 0,7 %H)
 *     ✔ đáy PHẦN HÌNH thấp nhất = đèn lồng 61,2 %H < chân tường 61,8 %H
 *
 * ⚠️ VÌ SAO CỜ Ở y = 40 MÀ KHÔNG PHẢI 45 (dùng hết dải): đồ DƯỚI SÀN to lên 1,5× nên mép TRÊN
 *   phần mực của chúng vươn lên tới 46,2 %H (chậu cây) và 48,1 %H (nhà cây) — chúng đứng TRƯỚC
 *   bức tường, nên món treo tường nào thấp hơn mốc đó sẽ bị che. Ở y = 45, cờ có mực xuống 49,9 %H
 *   ⇒ chậu cây che mất dải dưới của cờ (74 % bề rộng × 3,7 %H). Kéo cờ lên 5 %H thì mực dưới của
 *   nó là 45,9 %H < 46,2 %H ⇒ hết chồng. Đây là lý do DUY NHẤT khiến cột trái không dùng hết dải
 *   tường, và nó là ràng buộc thật giữa hai dải — không phải "cho cân".
 *
 * ⚠️ CHỖ CHỒNG CÒN LẠI — ĐÈN LỒNG × BỂ CÁ (2,7 %H × 9,8 %W): đo được, KHÔNG sửa được bằng số.
 *   Đèn lồng là món thấp nhất của cột phải (mực xuống 61,2 %H), bể cá là món làn `gần` duy nhất
 *   (mực lên 58,5 %H). Hai thứ cùng muốn góc dưới-phải; cột phải đã kín 59,6/61,8 %H nên không
 *   nhấc đèn lồng lên thêm được (nhấc 2,7 %H là chồng lên bóng bay), và bể cá không dịch sang
 *   phải được (hộp đã tới 99,3 %W). Chồng 2,7 %H ở ĐÁY đèn lồng — phần tua rua — trong khi cả
 *   thân đèn còn nguyên. Đây là chồng ĐÚNG CHIỀU SÂU (đồ treo tường nằm sau đồ đứng dưới sàn),
 *   không phải hai món cùng làn đè nhau. Muốn tuyệt đối không chồng thì phải hạ `NOMINAL` tường
 *   xuống ~12,4 (≈1,11× thay vì 1,20×) — đánh đổi không đáng, xem báo cáo.
 *
 * ⚠️ VÌ SAO KHÔNG CÒN "TÂM Y TRONG 20–45 %H": luật cũ chỉ đúng cho bố cục 2 hàng của cỡ cũ. Với
 *   3 hàng trong dải 61,8 %H thì tâm hàng đầu buộc phải ở ~10 %H và tâm hàng cuối ở ~52 %H —
 *   đúng như số ở trên. Luật ĐÚNG theo ý định ("đồ treo tường phải nằm trên tường, không xuyên
 *   xuống sàn, không trôi lên quá mép khung") là **hộp nằm trọn trong [0, 61,8)**, và đó là thứ
 *   `room-layout.test.ts` canh từ 2026-10-20.
 */
const WALL_SLOTS: readonly RoomPoint[] = [
  { x: 17.5, y: 12 }, // tranh     — trái, hàng 1/2, hộp [ 9.8, 25.3] × [ 1.7, 22.4]
  { x: 20.5, y: 40 }, // cờ        — trái, hàng 2/2, hộp [10.7, 30.3] × [27.0, 53.1]
  { x: 81, y: 10.6 }, // cầu vồng  — phải, hàng 1/3, hộp [73.3, 88.7] × [ 0.4, 20.9]
  { x: 78.5, y: 31.4 }, // bóng bay — phải, hàng 2/3, hộp [71.1, 85.9] × [21.5, 41.3]
  { x: 83.5, y: 52 }, // đèn lồng  — phải, hàng 3/3, hộp [76.2, 90.8] × [42.3, 61.7]
];

/**
 * Tâm x mặc định của từng món dưới sàn (%W) — bố cục 1,5× (2026-10-20).
 *
 * ⭐ VÌ SAO KHÔNG CHIA ĐỀU MỘT HÀNG NGANG Ở GIỮA: thú cưng đứng ở 50%W. Một cái bể cá đặt ngay
 *   giữa sẽ che mất con vật — mà che mất con vật là mất luôn phần thưởng của cả màn hình này.
 *   Đồ gần được đẩy về hai bên để hành lang giữa luôn trống cho bé ngắm con.
 *
 * -----------------------------------------------------------------------------
 * ⚠️⚠️ HÀNH LANG GIỮA RỘNG BAO NHIÊU — ĐO TỪ ẢNH, KHÔNG PHẢI TỪ HỘP THÚ CƯNG
 * -----------------------------------------------------------------------------
 *   Hộp thú cưng rộng `pctHToCqw(46)` = 34,5 %W, canh giữa ⇒ 32,75–67,25 %W. Nhưng đó là hộp
 *   512² có VIỀN TRONG SUỐT: bé nhìn thấy phần MỰC, hẹp hơn nhiều. Đo alpha thật của ba ảnh mèo
 *   (`public/assets/pets/cat-*.webp`, cùng cách đo với `_verify/ink.json`):
 *
 *     cat-baby  fracW 44,3% ⇒ mực 42,4–57,7 %W      cat-adult fracW 54,3% ⇒ 41,1–59,8 %W
 *     cat-super fracW 55,7% ⇒ 38,2–57,4 %W  (đuôi/tia sáng thò sang trái)
 *
 *   ⇒ Cột của con vật mà đồ dưới sàn phải né là **38–60 %W** (hợp của cả ba bậc, làm tròn ra
 *   ngoài). Hành lang đó KHÔNG phải "số ưa mắt": nó là số đo, và hẹp hơn hộp 32,75–67,25 đúng
 *   5,7 %W ở mỗi bên — 5,7 %W đó là chỗ đồ trang trí được phép chạm vào mà không che con vật.
 *   (Cột 32–68 vẫn dùng cho đồ TREO TƯỜNG — xem `WALL_RESERVED_X_PCT`: đồ trên tường phải né cả
 *   hộp, vì mũ/phụ kiện đội trên đầu con vật vươn rộng hơn phần mực của con.)
 *
 * -----------------------------------------------------------------------------
 * ⭐ BỐ CỤC: 3 món bên trái (2,5 … 42,2) · hành lang 38–60 · 2 món bên phải (64,0 … 96,0)
 * -----------------------------------------------------------------------------
 *   Bề rộng MỰC ở 1,5× là 14,0 (nhà cây) · 12,7 (chậu cây) · 18,6 (lâu đài) · 14,1 (hướng
 *   dương) · 23,8 (bể cá) = **83,2 %W**; hai bên hành lang chỉ còn 38 + 40 = 78 %W. Nói thẳng:
 *   **không thể** xếp 5 món mà không chồng nhau — thiếu ~5 %W. Vì vậy chỗ chồng được CHỌN có ý
 *   thức: dồn hết vào bên trái (tổng 4,6 %W), nơi ba món khác làn nhau nên mắt đọc ra "món trước
 *   che mép món sau", chứ không phải "một đống đồ".
 *
 *   • Bên TRÁI — nhà cây 8,5 · chậu cây 19,9 · lâu đài 32,9:
 *        nhà cây  mực [ 1,5, 15,5]  hộp [ 0,8, 16,3]
 *        chậu cây mực [13,5, 26,2]  hộp [11,7, 28,2]   ← chồng nhà cây 2,0 %W (14% bề rộng nó)
 *        lâu đài mực [23,6, 42,2]  hộp [21,9, 43,9]   ← chồng chậu cây 2,6 %W (20%)
 *      Nhà cây và chậu cây cùng làn `far` (đáy 66 %H) nên chồng nhau đúng 2,0 %W là chấp nhận
 *      được; lâu đài làn `mid` (đáy 75 %H) đứng TRƯỚC nên mép phải của chậu cây bị nó che — đúng
 *      phối cảnh. Đáy lâu đài 75 %H < đáy thú cưng 84 %H ⇒ lâu đài vẫn ở SAU con vật.
 *      Hai mép ngoài: mực trái 1,5 %W (nhà cây đứng sát góc trái — nó là "nhà", đứng góc là đúng),
 *      hộp phải 43,9 %W < 50 ⇒ nửa trái không lấn tâm khung.
 *
 *   • Bên PHẢI — hướng dương 71,0 · bể cá 84,0:
 *        hướng dương mực [64,0, 78,1]  hộp [58,0, 84,1]
 *        bể cá       mực [72,1, 96,0]  hộp [68,8, 99,3]
 *      ⚠️ Bể cá là món DUY NHẤT vẽ TRƯỚC mặt con vật (đáy 86 %H > 84 %H) ⇒ nó là món duy nhất
 *        có thể che con vật, nên nó phải nằm ngoài hành lang 38–60 tuyệt đối: mực trái 72,1 %W.
 *      ⚠️ HƯỚNG DƯƠNG VẪN THẤY ĐẦU HOA: |71,0 − 84,0| = **13,0 %W** ≥ (14,1 + 23,8)/2 − 6 = 12,95
 *        ⇒ hai món chỉ chồng nhau 5,95 %W ở phần THÂN, không phải phần đầu. Và bằng số tuyệt đối:
 *        đầu hoa nằm ở 43,9–55 %H, còn mép TRÊN phần mực của bể cá là **58,6 %H** ⇒ đầu hoa ở
 *        TRÊN HẲN bể cá 3,6 %H, che được mới là lạ.
 *
 *   ⇒ Cả 5 món đều còn nhận ra được: món bị che nhiều nhất là chậu cây (20 % bề rộng) và nhà cây
 *     (14 %); ba món còn lại không bị che quá 15 %. Không món nào che con vật.
 */
const FLOOR_CENTER_X_PCT: Readonly<Record<string, number>> = {
  'dec-treehouse': 8.5, // trái ngoài cùng — "nhà" đứng sát góc trái là đúng
  'dec-plant': 19.9, // trái giữa — chồng nhà cây 2,0 %W (cùng làn far)
  'dec-castle': 32.9, // trái trong — làn mid đứng trước, che mép phải chậu cây 2,6 %W
  'dec-sunflower': 71.0, // phải, sát hành lang; cách bể cá 13,0 %W để đầu hoa không bị che
  'dec-aquarium': 84.0, // phải ngoài — món làn GẦN duy nhất, phải né hẳn cột con vật (mực ≥ 72,1)
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
 * Phần thông số mà phép quy đổi cỡ CẦN — chỉ hai con số kích thước.
 *
 * ⚠️ VÌ SAO KHÔNG NHẬN CẢ `DecorationLayoutSpec`: hàm này còn được gọi với `DecorationBox` (kết quả
 *    đã tính, có `widthPct`/`heightPct` nhưng KHÔNG có `inkBottom` — ink chỉ dùng lúc neo đáy).
 *    Đòi hỏi cả spec ở đây buộc chỗ gọi phải bịa một `inkBottom` không có ý nghĩa gì, chỉ để qua
 *    kiểu. Khai báo đúng thứ mình dùng là cách nói rằng `inkBottom` KHÔNG tham gia tính cỡ.
 */
export interface DecorationSizeSpec {
  readonly widthPct: number;
  readonly heightPct: number;
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
export function decorationRenderSize(spec: DecorationSizeSpec): DecorationRenderSize {
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
    /*
      ⚠️ `bottomPct` là đáy PHẦN HÌNH, KHÔNG phải đáy hộp ảnh.
         Ảnh shop 512×512 có viền trong suốt: mép dưới mực nằm ở `inkBottom` (0..1 từ đỉnh), nên
         đáy hình = tâm + cao × (inkBottom − 0,5) — không phải tâm + cao/2. Đây không phải chi tiết
         làm đẹp: `sortByBottom` dùng đúng số này để quyết định món nào vẽ trước (vật có đáy thấp
         hơn đứng trước), và test `'đáy món nằm đúng trên đường làn'` canh nó trùng `LANE_BOTTOM_PCT`
         của làn. Dùng đáy hộp thì món chìm xuống 7–10%H so với đường làn đã định.
    */
    bottomPct: round1(topPct + spec.heightPct * (spec.inkBottom - 0.5)),
    band: spec.band,
    lane: spec.lane,
  };
}

/** Tra thông số của một món. `undefined` = id lạ (không phải trang trí của dự án này). */
export function decorationSpec(itemId: string): DecorationLayoutSpec | undefined {
  return DECORATION_LAYOUT[itemId];
}

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
    const slot = WALL_SLOTS[WALL_ORDER.indexOf(itemId)];
    if (slot === undefined) return undefined;
    return makeBox(itemId, spec, slot.x, slot.y);
  }

  const lane = spec.lane ?? 'near';
  const leftPct = FLOOR_CENTER_X_PCT[itemId];
  if (leftPct === undefined) return undefined;
  /*
    Neo theo MÉP DƯỚI PHẦN HÌNH (không phải đáy hộp): đáy hình nằm đúng đường làn, mà đáy hình
    lệch so với tâm một khoảng `heightPct × (inkBottom − 0,5)`. Suy ngược ra tâm:

      đáy hình = tâm + cao × (inkBottom − 0,5) = LANE_BOTTOM
      ⇒ tâm   = LANE_BOTTOM − cao × (inkBottom − 0,5)
              = LANE_BOTTOM + cao × (0,5 − inkBottom)

    Bản trước dùng `LANE_BOTTOM − cao/2` (đáy HỘP trên đường làn) ⇒ món có viền trong suốt dày
    ở đáy bị "chìm" 7–10%H, tức là lơ lửng giữa không trung thay vì đứng trên sàn. Đây là
    CÙNG một phép tính với `bottomPct` trong `makeBox`, viết theo hai chiều — đổi một chỗ mà
    quên chỗ kia là hai nguồn sự thật lệch nhau.
  */
  const topPct = LANE_BOTTOM_PCT[lane] + spec.heightPct * (0.5 - spec.inkBottom);
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
