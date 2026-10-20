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
  /**
   * Hệ số phóng RIÊNG của món, nhân thêm vào `NOMINAL_WIDTH_PCT[band] × LANE_SCALE[lane]`.
   *
   * ⭐ VÌ SAO CÓ HỆ SỐ RIÊNG MÀ KHÔNG CHỈ MỘT `NOMINAL`: yêu cầu của chủ dự án là *"nhà trên cây,
   *   lâu đài, bong bóng, lồng đèn vẫn nhỏ, tăng tỷ lệ lên thêm gấp rưỡi"* — tức là phóng to BỐN
   *   MÓN CỤ THỂ, không phải cả bộ. Giữ `NOMINAL` chung rồi thêm hệ số riêng (thay vì bỏ `NOMINAL`
   *   và gõ tay 10 con số) là để quy tắc vẫn ĐỌC ĐƯỢC: "mọi món cùng một `NOMINAL`, cùng một
   *   `LANE_SCALE`; chỉ hệ số này là riêng". Hệ số 1 = "đúng chuẩn của dải", 1,5 = "to hơn chuẩn
   *   50%", 0,85 = "nhỏ hơn chuẩn 15% để nhường chỗ".
   *
   * ⚠️ HỆ SỐ NÀY CHỈ LÀ TÀI LIỆU + CÁCH SINH RA `widthPct` (xem `_verify/build-deco-layout.mjs`).
   *   Lúc chạy, `widthPct` mới là nguồn sự thật — không nơi nào nhân lại hệ số này.
   */
  readonly scale: number;
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
 *   (`boxW = NOMINAL_WIDTH_PCT[band] × LANE_SCALE[lane] × scale ÷ √(fracW · fracH · 4/3)`), ghi ra
 *   thành số cụ thể để đọc được ngay trên giấy và để test canh bằng số. Ai nhân thêm `LANE_SCALE`
 *   một lần nữa sẽ làm món ở làn `far` nhỏ đi 38% và món ở làn `near` phóng to gấp rưỡi — lỗi
 *   không có thông báo nào.
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

/**
 * Cỡ DANH NGHĨA của một món "chuẩn" trong mỗi dải. (%W của phần HÌNH, trước khi bù viền trong suốt)
 *
 * ⭐ ĐÂY LÀ "MỘT QUY TẮC" MÀ CHỦ DỰ ÁN CẦN: mọi món trong một dải dùng chung một cỡ chuẩn; cái
 *   làm chúng khác nhau chỉ là `LANE_SCALE` (phối cảnh) và `scale` (hệ số riêng từng món). Ba con
 *   số đó nhân lại rồi chia cho `√(fracW · fracH · 4/3)` là ra `widthPct` của hộp ảnh.
 *
 * ⚠️ Giá trị KHÔNG đổi trong đợt 2026-10-21 dù bốn món được phóng to: đổi `NOMINAL` là đổi CẢ 10
 *   món cùng lúc, mà yêu cầu là "bốn món này to lên, ba món kia nhỏ lại để nhường chỗ". Việc phóng
 *   thu từng món nằm ở `scale`.
 */
export const NOMINAL_WIDTH_PCT: Readonly<Record<DecorationBand, number>> = {
  floor: 25.5,
  wall: 13.4,
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
 *   `topPct`). Bố cục 2026-10-21 vẫn xếp 5 món thành 3 hàng, mỗi hàng đúng MỘT món mỗi cột ⇒ không
 *   còn cặp nào "cùng hàng", nên luật này hiện không có cặp nào để áp. Khe **DỌC** (giữa hai hàng
 *   trong cùng một cột) là chuyện khác và được canh bằng "hai hộp không chồng nhau", không bằng
 *   hằng này — hạ nó xuống 0 sẽ làm hỏng luật ngang mà không canh được gì thêm.
 *
 *   Số thật của bố cục 2026-10-21, để sau này khỏi phải đo lại: khe dọc giữa hai HỘP là 0,4 và
 *   0,2 %H (cột trái), 0,3 và 0,3 %H (cột phải); khe dọc giữa hai PHẦN HÌNH là 9,7 %H (tranh→cờ),
 *   4,7 + 1,5 %H (cầu vồng→bóng bay→đèn lồng). Tức là mắt luôn thấy khoảng trống, dù hộp ảnh
 *   gần chạm nhau — và ở cột phải thì CHỈ có thể như vậy: xem ghi chú "VÌ SAO BÓNG BAY VÀ ĐÈN
 *   LỒNG CHỈ ĐẠT 1,10×" trong khối `DECORATION_LAYOUT`.
 */
export const WALL_GAP_PCT = 1;

/**
 * Bề rộng cho phép của đồ treo tường. (%W)
 *
 * ⭐ SUY TỪ BẢNG, KHÔNG PHẢI SỐ ƯA MẮT (2026-10-21, đợt "bốn món vẫn nhỏ"):
 *   5 món treo tường hiện rộng **13,5 … 17,3 %W**. Hai biên lấy đúng hai đầu cực trị của bảng
 *   rồi chừa ~15% mỗi phía: `13,5 × 0,85 ≈ 11,5` và `17,3 × 1,15 ≈ 19,9`.
 *
 *   ⚠️ Khoảng NÀY RỘNG HƠN bảng là CÓ CHỦ Ý: nó là lưới an toàn cho một món mới thêm vào danh
 *      mục, không phải bản chép lại của bảng. Siết về đúng `[13,5, 17,3]` thì mọi món thêm sau
 *      này đều đỏ vì "không khớp NOMINAL", trong khi thứ cần bắt là "món to/nhỏ bất thường" —
 *      chênh 15% là mức mắt còn bỏ qua được.
 */
export const WALL_WIDTH_RANGE: readonly [number, number] = [12, 24];

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
 * ⭐ SUY TỪ BẢNG: mỗi biên = cực trị của làn × 0,85 (dưới) và × 1,15 (trên)
 *   (`_verify/build-deco-layout.mjs` in lại được từng con số):
 *
 *     • `far`  : 14,0 × 0,85 = 11,9  ; 23,3 × 1,15 = 26,8
 *     • `mid`  : 22,2 × 0,85 = 18,9  ; 25,0 × 1,15 = 28,8
 *     • `near` : 25,9 × 0,85 = 22,0  ; 25,9 × 1,15 = 29,8
 *
 *   ⚠️⚠️ BA KHOẢNG GIỜ GỐI NHAU NHIỀU, và đây là điều PHẢI BIẾT trước khi tin chúng: `far` lên
 *      tới 26,8 còn `near` xuống tới 22,0. Nguyên nhân: `dec-treehouse` là món làn `far` được
 *      phóng 1,5× (23,3 %W) theo yêu cầu chủ dự án, nên biên trên của `far` buộc phải vượt biên
 *      dưới của `near`. Nói cách khác: **khoảng bề rộng KHÔNG còn là thứ bảo đảm phối cảnh** —
 *      nó chỉ là lưới bắt "món to/nhỏ bất thường". Phối cảnh được canh bằng hai test so CỠ LỚN
 *      NHẤT của từng làn (`maxOf('far') < maxOf('mid') < maxOf('near')` — unit) và so CHIỀU CAO
 *      ĐO ĐƯỢC trong trình duyệt (e2e ③), chứ không bằng ba khoảng rời nhau.
 *
 *   Giữ nguyên tinh thần cũ (biên = cực trị ±15%) thay vì tự đặt số "cho đẹp": một món mới thêm
 *   vào danh mục chỉ cần cùng cỡ chuẩn của làn nó thuộc là tự rơi vào khoảng, không phải sửa hai
 *   nơi.
 */
export const LANE_WIDTH_RANGE: Readonly<Record<FloorLane, readonly [number, number]>> = {
  far: [12, 26],
  mid: [19, 38],
  near: [24, 28],
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
 *     boxW = NOMINAL_WIDTH_PCT[band] × LANE_SCALE[lane] × scale ÷ √(fracW · fracH · 4/3)
 *     boxH = boxW × 4/3                 ← hộp VUÔNG theo cqw, ảnh không méo
 *     top  = LANE_BOTTOM_PCT[lane] + boxH × (0,5 − inkBottom)
 *
 *   `NOMINAL_WIDTH_PCT` = **25,5** cho đồ dưới sàn, **13,4** cho đồ treo tường (tường không có phối
 *   cảnh ⇒ hệ số làn = 1). `boxW` chia cho √(fracW·fracH·4/3) là để bù phần trong suốt: món có ít
 *   mực trong ảnh (hướng dương: 54 % × 89 %) phải được vẽ HỘP TO HƠN để phần HÌNH to đúng cỡ
 *   danh nghĩa. Nhờ vậy "cùng 17 %W danh nghĩa" = "cùng cỡ mắt nhìn thấy", không phụ thuộc ảnh.
 *
 * -----------------------------------------------------------------------------
 * ⭐ 2026-10-20 — PHÓNG TO 1,5× (sàn) / 1,2× (tường) BẰNG CÁCH NÂNG `NOMINAL`
 * -----------------------------------------------------------------------------
 *   Chủ dự án: *"tỷ lệ đồ trang trí cho nó bự ra gấp đôi đi, nhìn nó nhỏ quá"*. Gấp đôi là BẤT
 *   KHẢ THI: 5 món sàn có tổng bề rộng MỰC 55,6 %W ở 1× ⇒ gấp đôi là 111,2 %W trong một khung
 *   100 %W còn phải chừa cột con vật. Nên chốt 1,5× (tổng 83,2 %W). Đồ treo tường bị chặn bởi
 *   chiều cao: 5 hộp cao tổng 89,0 %H ở 1×, dải tường chỉ 61,8 %H, chia 2 cột ⇒ tối đa 1,24×;
 *   chốt 1,20×.
 *
 * -----------------------------------------------------------------------------
 * ⭐ 2026-10-21 — PHÓNG TO RIÊNG 4 MÓN: "nhà trên cây, lâu đài, bong bóng, lồng đèn vẫn nhỏ, tăng
 *    tỷ lệ lên thêm gấp rưỡi". ĐÂY LÀ BẢNG SỐ CHỨNG MINH 1,5× CHO CẢ 4 LÀ BẤT KHẢ THI.
 * -----------------------------------------------------------------------------
 *   Trước đợt này: sàn 15,5 / 16,5 / 22,0 / 26,1 / 30,5 %W (nhà cây/chậu/lâu đài/hướng dương/bể
 *   cá), tường 15,5 / 19,6 / 15,4 / 14,8 / 14,6 %H-hộp (tranh/cờ/cầu vồng/bóng bay/đèn lồng).
 *
 *   Mức đạt được và ĐÚNG cái chặn từng món (mọi số đo lại được bằng
 *   `_verify/check-deco-placement.mjs`):
 *
 *     • NHÀ CÂY 15,5 → **23,3** = **1,50×** ✔ ĐẠT. Chặn trên nếu muốn hơn: bề rộng. Nó là món
 *       rộng nhất của làn `far` (mực 21,0 %W), đứng sát góc trái; rộng thêm 1 %W là bắt đầu ăn
 *       vào lâu đài.
 *     • LÂU ĐÀI 22,0 → **25,0** = **1,14×**. Chặn bởi **HAI** thứ, cả hai đều cứng:
 *         (a) `maxOf(mid) < maxOf(near)` (unit test "làn càng gần càng to") ⇒ hộp lâu đài phải
 *             NHỎ HƠN hộp bể cá. Bể cá bị chặn bởi (b) nên trần của nó là 25,9 ⇒ lâu đài ≤ 25,8.
 *         (b) Bể cá phải co lại, vì tổng bề rộng MỰC của 5 món sàn chỉ có 78,4 %W chỗ dùng được
 *             (100 − cột con vật 21,8). Ở bảng này tổng là **85,2 %W** ⇒ đã phải để 4,4 %W chồng
 *             lấn + 4,8 %W lâu đài nấp sau con vật. Bể cá giữ 30,5 thì không còn %W nào cho chậu
 *             cây và hướng dương.
 *       Nói gọn: lâu đài to lên được là NHỜ bể cá nhỏ lại, và bể cá nhỏ lại là điều kiện để cả
 *       hàng đồ vừa 78,4 %W. Muốn lâu đài 1,5× (33,0 %W hộp) thì bể cá phải ≥ 33,1 %W hộp ⇒ tổng
 *       mực 5 món thành 97,5 %W ⇒ phải để 19 %W chồng lấn — quá xa mức "không món nào bị che quá
 *       55% bề rộng" (và thực tế là hai món nuốt nhau).
 *     • BÓNG BAY 14,8 → **16,3** = **1,10×**, ĐÈN LỒNG 14,6 → **16,0** = **1,10×**. Chặn bởi
 *       **SỨC CHỨA CHIỀU CAO CỦA BỨC TƯỜNG**, không phải bề rộng (bề rộng mỗi cột còn thừa 10 %W).
 *       Đồ treo tường chỉ có 2 cột (6…32 và 68…94 %W, vì 32–68 là cột con vật), mỗi cột cao
 *       61,8 %H, và **hai hộp trong cùng cột không được chồng nhau** (test khoá). 5 món ⇒ một cột
 *       phải chứa 3 món. Ba món nhỏ nhất (tranh 18,1 + cờ 23,1 + cầu vồng 18,0 = 59,2 %H) đã
 *       chiếm gần kín cột, nên cột còn lại chỉ còn **61,8 − 0 = 61,8 %H cho 2 món** — mà món thứ
 *       ba (cầu vồng 18,0) BUỘC phải nằm cùng cột với bóng bay + đèn lồng, vì cột kia đã kín:
 *
 *         bóng bay + đèn lồng + cầu vồng ≤ 61,8 − 2 khe(0,3) = 61,2 ⇒ bóng bay + đèn lồng ≤ 43,2
 *         ⇒ chia theo tỉ lệ cũ 19,7 : 19,4 ⇒ 21,8 và 21,4 %H-hộp ⇒ 1,10× và 1,10×.
 *
 *       Vì sao KHÔNG xếp 2 món to vào một cột và 3 món nhỏ vào cột kia (như thế bóng bay + đèn
 *       lồng được 1,5×)? Vì cột TRÁI không dùng được hết 61,8 %H: nhà cây (mực đỉnh **39,1 %H**)
 *       và lâu đài (48,4 %H) đứng TRƯỚC bức tường, nên 3 món nhỏ (59,2 %H) không lọt vào 39,1 %H
 *       còn trống — đèn lồng rơi xuống dưới 39,1 %H là bị tán lá nhà cây che **67% bề rộng**. Đây
 *       là cái giá trực tiếp của việc nhà cây to 1,5×: nó cao thêm 10,4 %H và ăn đúng 10,4 %H đó
 *       của bức tường bên trên.
 *     ⇒ Nếu chủ dự án muốn bóng bay/đèn lồng 1,5× thì phải chọn một: (i) nhà cây về 1,0×, hoặc
 *       (ii) cho phép đèn lồng nấp sau tán nhà cây. Cả hai đều là đánh đổi, không phải lỗi.
 *
 *   ⚠️ VÌ SAO KHÔNG "CỨ PHÓNG TO RỒI CHO CHỒNG NHAU": chồng nhau ở đây không phải chi tiết nhỏ.
 *     Bể cá phủ kín hướng dương nghĩa là bé mua hai món mà chỉ thấy một. Cỡ và khoảng cách là
 *     **một** ràng buộc, không phải hai.
 *
 *   Số dưới đây in lại được bằng `_verify/build-deco-layout.mjs` (đọc bbox alpha thật từ
 *   `_verify/ink.json`), nên lần sau muốn đổi hệ số chỉ cần chạy lại script rồi dán bảng.
 *
 *   ⚠️⚠️ `heightPct` KHÔNG phải "boxH làm tròn cho gần" — nó được CHỌN trong khoảng ±0,05 quanh
 *     `widthPct × 4/3` sao cho `pctHToCqw(heightPct) === widthPct` ĐÚNG BẰNG ở mức 1 chữ số thập
 *     phân. Ví dụ cờ: `17,3 × 4/3 = 23,067` ⇒ chọn **23,1** (23,1 × 0,75 = 17,325 → 17,3 ✓) chứ
 *     không phải 23,0 (23,0 × 0,75 = 17,25 → 17,3 ✓ nhưng lệch về phía kia). Đây là điều kiện
 *     "HỘP VUÔNG, ảnh 1:1 không bị bóp méo", và có test canh (`--room-h` phải bằng `--room-w`);
 *     làm tròn theo kiểu thông thường sẽ làm nó lệch 0,1 cqw và test đỏ. Bể cá là ca thứ hai:
 *     25,9 × 4/3 = 34,533 ⇒ 34,5 (không phải 34,6).
 *
 * -----------------------------------------------------------------------------
 * ⚠️ VÌ SAO GHI SỐ CỤ THỂ CHỨ KHÔNG TÍNH LÚC CHẠY
 * -----------------------------------------------------------------------------
 *   Bảng này là DỮ LIỆU BỐ CỤC, không phải dữ liệu người dùng: 6 con số cho mỗi món, đổi rất ít,
 *   và phải ĐỌC ĐƯỢC để còn canh tỉ lệ bằng mắt. Tính lúc chạy từ `fracW/fracH` buộc phải nạp
 *   thuộc tính ảnh (hoặc chép lại 30 con số bbox) ở đây, rồi mỗi lần chỉnh một món lại phải chạy
 *   một script đo ảnh mới biết kết quả — trong khi thứ cần chỉnh là "món này trông hơi to".
 *   Test `room-layout.test.ts` khoá đúng những hệ quả mà mắt quan tâm (đáy trùng làn, bề rộng
 *   trong khoảng của làn, làn gần to hơn làn xa), nên ghi số vẫn được canh đầy đủ.
 */
/*
  ⭐ 2026-10-20 (đợt 3) — "tăng thêm gấp rưỡi" cho ĐÚNG BỐN MÓN: `dec-treehouse`, `dec-castle`,
     `dec-balloon`, `dec-lantern` đều `scale: 1.5`. Ba món kia phải NHƯỜNG chỗ (0,85) vì phòng
     không rộng thêm: tổng bề rộng phần hình của 5 món sàn phải ≤ ~78 %W (dải khả dụng, trừ cột
     thú cưng 38–60), và cột tường chỉ cao 61,8 %H cho 5 món.

  ⭐ ĐỔI BỐ CỤC TƯỜNG ĐỂ 2 MÓN TO CÓ CHỖ: cột PHẢI chỉ còn **2 món** (bóng bay + đèn lồng, mỗi món
     ~30 %H) ⇒ cầu vồng rời cột phải, treo ở DẢI TRÊN CÙNG giữa khung (0…18 %H, NẰM TRÊN đỉnh mũ
     của thú cưng ~15 %H — xem miễn trừ có ghi lý do ở `room-layout.test.ts` và e2e 07).
     Cột TRÁI giữ tranh + cờ (2 món) vì nhà trên cây cao 39,3 %H sẽ che món thứ ba.

  ⭐ ĐÈN LỒNG HẾT "CẮM TRÊN NẮP BỂ CÁ": cột phải dừng ở 58,9 %H ⇒ đáy mực đèn lồng 58,4 %H, thấp
     hơn đỉnh mực bể cá (62,7 %H với `scale` 0,85) — trước đây đèn lồng thấp hơn 61,2 %H nên tua
     rua nằm sau nắp bể.
*/
export const DECORATION_LAYOUT: Readonly<Record<string, DecorationLayoutSpec>> = {
  // --- Đồ TREO TƯỜNG (`slot: 'sky'`) — NOMINAL 13,4, hệ số làn = 1 ---
  'dec-picture': { band: 'wall', lane: null, scale: 0.88, widthPct: 13.6, heightPct: 18.1, inkBottom: 0.87 },
  'dec-flag': { band: 'wall', lane: null, scale: 0.88, widthPct: 17.3, heightPct: 23.1, inkBottom: 0.69 },
  'dec-rainbow': { band: 'wall', lane: null, scale: 0.88, widthPct: 13.5, heightPct: 18.0, inkBottom: 0.8 },
  'dec-balloon': { band: 'wall', lane: null, scale: 1.5, widthPct: 22.2, heightPct: 29.6, inkBottom: 0.97 },
  'dec-lantern': { band: 'wall', lane: null, scale: 1.5, widthPct: 21.9, heightPct: 29.2, inkBottom: 0.98 },

  // --- Đồ DƯỚI SÀN (`slot: 'ground'`) — NOMINAL 25,5 × hệ số làn ---
  'dec-treehouse': { band: 'floor', lane: 'far', scale: 1.5, widthPct: 23.3, heightPct: 31.1, inkBottom: 0.94 },
  'dec-plant': { band: 'floor', lane: 'far', scale: 0.85, widthPct: 14.0, heightPct: 18.7, inkBottom: 0.95 },
  'dec-castle': { band: 'floor', lane: 'mid', scale: 1.5, widthPct: 32.9, heightPct: 43.9, inkBottom: 0.89 },
  'dec-sunflower': { band: 'floor', lane: 'mid', scale: 0.85, widthPct: 22.2, heightPct: 29.6, inkBottom: 0.95 },
  'dec-aquarium': { band: 'floor', lane: 'near', scale: 0.85, widthPct: 25.9, heightPct: 34.5, inkBottom: 0.84 },
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
 * ⭐ VÌ SAO PHẢI LÀ HAI CỘT (chứ không phải một hàng): 5 món rộng 13,5–17,3 %W cần ~78 %W cho
 *   một hàng, mà hai bên vùng giữa chỉ còn 6–32 và 68–94 (26 %W mỗi bên). Vùng giữa là BẮT BUỘC
 *   né (xem `WALL_RESERVED_X_PCT`), nên mọi cách xếp đều phải dùng hai cột.
 *
 * ⭐ BỐ CỤC (giữ nguyên như 2026-10-20, chỉ đổi SỐ): cột trái = tranh (trên) + cờ (dưới); cột phải
 *   = cầu vồng + bóng bay + đèn lồng. Cân đối hai bên, và không món nào lấn vào cột thú cưng.
 *
 * ⚠️ MỌI CON SỐ Ở ĐÂY CÓ TEST CANH (`room-layout.test.ts`): lề ≥6%W, không chồng nhau (xét CẢ
 *   hai chiều), không lấn vùng giữa, hộp nằm trọn trong dải tường. Sửa số mà quên chạy test là
 *   đỏ ngay.
 *
 * -----------------------------------------------------------------------------
 * ⭐ BỐ CỤC 2026-10-21: 2 cột × (2 + 3) hàng — CỘT TRÁI KHÔNG DÙNG HẾT ĐƯỢC DẢI TƯỜNG
 * -----------------------------------------------------------------------------
 *   Chiều cao HỘP của 5 món bây giờ là 18,1 / 23,1 / 18,0 / 21,7 / 21,3 %H, tổng **102,2 %H**;
 *   hai cột chứa được 2 × 61,8 = 123,6 %H, nên về LƯỢNG thì thừa 21 %H. Nhưng cột TRÁI chỉ dùng
 *   được **41,7 %H** — không phải vì hết chỗ, mà vì đồ DƯỚI SÀN đứng trước nó:
 *
 *     • nhà cây (làn `far`, phóng 1,5×) có mực vươn lên **39,1 %H**, ở x [1,2, 22,2] %W
 *     • lâu đài (làn `mid`) có mực vươn lên **48,4 %H**, ở x [21,8, 43,0] %W
 *
 *   Cột trái là x [6, 32] %W ⇒ **toàn bộ** dải dưới 39,1 %H của nó nằm sau tán nhà cây. Vì vậy
 *   cột trái chỉ xếp được 2 món (tranh + cờ = 41,2 %H) và **phải** để trống 20 %H phía dưới —
 *   chỗ đó là rừng cây, không phải "khoảng trống chưa dùng". Đây là lý do toán học khiến bóng bay
 *   + đèn lồng không thể 1,5× (xem khối `DECORATION_LAYOUT`).
 *
 *   Số dưới đây chứng minh từng ràng buộc (toạ độ là TÂM, hộp = tâm ± nửa cỡ):
 *
 *     tranh     x 17,5 → hộp [10,7, 24,3]   y  9,1 → hộp [ 0,1, 18,2]   mực [12,3, 22,7] × [ 2,5, 15,7]
 *     cờ        x 20,5 → hộp [11,9, 29,2]   y 30,1 → hộp [18,6, 41,7]   mực [12,8, 28,2] × [25,4, 34,5]
 *     cầu vồng  x 83,5 → hộp [76,8, 90,3]   y  9,0 → hộp [ 0,0, 18,0]   mực [77,0, 90,0] × [ 3,7, 14,3]
 *     bóng bay  x 84,0 → hộp [75,9, 92,2]   y 29,2 → hộp [18,4, 40,1]   mực [78,7, 89,3] × [19,0, 39,4]
 *     đèn lồng  x 84,0 → hộp [76,0, 92,0]   y 51,0 → hộp [40,4, 61,7]   mực [78,7, 89,3] × [40,9, 61,2]
 *
 *     ✔ mọi hộp nằm trong dải tường: mép trên ≥ 0,0 và mép dưới ≤ 61,7 (< 61,8)
 *     ✔ lề ≥ 6 %W: trái nhất 10,7; phải nhất 92,2 (còn 7,8 tới mép khung)
 *     ✔ không lấn cột thú cưng: cột trái có mép phải ≤ 29,2 (< 32); cột phải có mép trái ≥ 75,9 (> 68)
 *     ✔ không hai hộp nào chồng nhau (cột khác nhau ⇒ tách hẳn; trong cùng cột ⇒ khe dọc ≥ 0,3 %H)
 *     ✔ đáy PHẦN HÌNH thấp nhất = đèn lồng 61,2 %H < chân tường 61,8 %H
 *     ✔ KHÔNG món treo tường nào bị đồ dưới sàn che (mực thấp nhất của chúng là 34,5 %H ở cột
 *       trái — trên tán nhà cây 39,1 %H; cột phải thấp nhất 61,2 %H nhưng đèn lồng nằm ở
 *       x [78,7, 89,3] còn chậu cây chỉ tới 78,4 %W ⇒ chồng 0,0 %W)
 *
 * ⚠️ VÌ SAO CỜ Ở y = 30,1 MÀ KHÔNG PHẢI ~50: mực của cờ là một DẢI MỎNG (9,1 %H) nằm giữa hộp
 *   của nó, nên hộp có thể thòng xuống 41,7 %H mà phần HÌNH vẫn chỉ tới 34,5 %H — vẫn trên tán
 *   nhà cây 39,1 %H. Nếu kéo cờ xuống nữa thì mực cờ chui vào tán cây: nhà cây che 15,3 %W ×
 *   phần dưới của cờ. Đây là lý do DUY NHẤT khiến cột trái dừng ở 41,7 %H, và nó là ràng buộc
 *   thật giữa hai dải — không phải "cho cân".
 *
 * ⭐ ĐÈN LỒNG × BỂ CÁ — LỖI "ĐÈN LỒNG CẮM TRÊN NẮP BỂ" ĐÃ HẾT (2026-10-21):
 *   Bản trước: đèn lồng mực xuống **61,2 %H**, bể cá mực lên **58,5 %H** ⇒ đuôi đèn nằm SAU mép
 *   trên bể cá 2,7 %H, mắt đọc ra "đèn lồng cắm trên nắp bể". Nay bể cá co về 25,9 %W (mực lên
 *   **62,7 %H**) nên đáy mực đèn lồng **61,2 %H** thấp hơn mép trên bể cá... theo trục dọc là
 *   **1,5 %H** — hai món TÁCH NHAU HẲN: `chồng y = −1,5 %H`. Chúng vẫn chồng nhau 10,6 %W theo
 *   trục x, nhưng không có điểm ảnh nào chung, nên không còn ảo giác "cắm trên nắp".
 *   (Kiểm lại: `_verify/check-deco-placement.mjs`, mục "ĐÈN LỒNG × BỂ CÁ".)
 *
 * ⚠️ VÌ SAO KHÔNG CÒN "TÂM Y TRONG 20–45 %H": luật cũ chỉ đúng cho bố cục 2 hàng của cỡ cũ. Với
 *   3 hàng trong dải 61,8 %H thì tâm hàng đầu buộc phải ở ~9 %H và tâm hàng cuối ở ~51 %H —
 *   đúng như số ở trên. Luật ĐÚNG theo ý định ("đồ treo tường phải nằm trên tường, không xuyên
 *   xuống sàn, không trôi lên quá mép khung") là **hộp nằm trọn trong [0, 61,8)**, và đó là thứ
 *   `room-layout.test.ts` canh từ 2026-10-20.
 */
const WALL_SLOTS: readonly RoomPoint[] = [
  { x: 20.5, y: 9.1 }, // tranh     — trái, hộp [13.7, 27.3] × [ 0.1, 18.1]
  { x: 20.5, y: 30.1 }, // cờ        — trái, hộp [11.9, 29.1] × [18.6, 41.7]
  { x: 50.0, y: 9.0 }, // cầu vồng  — GIỮA, TRÊN ĐẦU con vật, hộp [43.2, 56.8] × [ 0.0, 18.0]
  { x: 81.0, y: 14.9 }, // bóng bay — phải, hộp [69.9, 92.1] × [ 0.1, 29.7]
  { x: 81.0, y: 44.3 }, // đèn lồng  — phải, hộp [70.1, 91.9] × [29.7, 58.9]
];

/**
 * Tâm x mặc định của từng món dưới sàn (%W) — bố cục 2026-10-21.
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
 * ⭐ BỐ CỤC 2026-10-21: 2 món bên TRÁI (nhà cây + lâu đài) · hành lang 38–60 · 3 món bên PHẢI
 * -----------------------------------------------------------------------------
 *   Bề rộng MỰC: nhà cây 21,0 · lâu đài 21,2 · hướng dương 12,0 · chậu cây 10,8 · bể cá 20,2
 *   = **85,2 %W**; hai bên hành lang chỉ có 38,2 + 40,2 = **78,4 %W**. Thiếu 6,8 %W ⇒ vẫn phải
 *   chồng lấn, nhưng chỗ chồng thật (đo theo cặp) chỉ còn **5,5 %W** — ít hơn bản trước (4,6 %W
 *   dồn ở bên trái) TÍNH TRÊN MỖI MÓN, dù hai món to lên: chậu cây đã chuyển sang phải nên bên
 *   trái không còn ba món chen nhau nữa.
 *
 *   • Bên TRÁI — nhà cây 11,7 · lâu đài 32,4:
 *        nhà cây  mực [ 1,2, 22,2]  hộp [ 0,0, 23,4]
 *        lâu đài  mực [21,8, 43,0]  hộp [19,9, 44,9]   ← chồng nhà cây **0,4 %W** (2% bề rộng nó)
 *      Lâu đài làn `mid` (đáy 75 %H) đứng TRƯỚC nhà cây làn `far` (đáy 66 %H) ⇒ 0,4 %W chỉ là hai
 *      mép chạm nhau, mắt đọc ra "hai vật đứng cạnh nhau ở hai độ sâu khác nhau" — đúng phối
 *      cảnh. Đáy lâu đài 75 %H < đáy thú cưng 84 %H ⇒ lâu đài vẫn ở SAU con vật.
 *      Mép ngoài: mực trái 1,2 %W (nhà cây đứng sát góc trái — nó là "nhà", đứng góc là đúng);
 *      mực phải của lâu đài 43,0 %W lấn vào cột con vật 4,8 %W — nhưng con vật vẽ SAU nên che
 *      đúng phần đó, lâu đài còn nhìn thấy 16,4 %W (77% bề rộng của nó).
 *
 *   • Bên PHẢI — hướng dương 65,0 · chậu cây 73,0 · bể cá 86,8:
 *        hướng dương mực [59,0, 71,0]  hộp [53,9, 76,1]
 *        chậu cây    mực [67,6, 78,4]  hộp [66,0, 80,0]   ← chồng hướng dương 3,4 %W (31%)
 *        bể cá       mực [76,7, 96,9]  hộp [73,9, 99,8]   ← chồng chậu cây 1,7 %W (16%)
 *      ⚠️ Bể cá là món DUY NHẤT vẽ TRƯỚC mặt con vật (đáy 86 %H > 84 %H) ⇒ nó là món duy nhất
 *        có thể che con vật, nên nó phải nằm ngoài hành lang 38–60 tuyệt đối: mực trái **76,7 %W**
 *        (cách cột con vật 16,7 %W — rộng rãi hơn bản trước 4,6 %W).
 *      ⚠️ CHẬU CÂY LÀ MÓN BỊ CHE NHIỀU NHẤT: 31% bề rộng bởi hướng dương + 16% bởi bể cá — hai
 *        món KHÁC NHAU, nên không cặp nào vượt trần 55%. Nó là món nhỏ nhất, đứng giữa hai món
 *        to hơn ở hai làn gần hơn. Đây là chỗ đánh đổi ĐÃ BIẾT: muốn cả 5 món cùng to thì món
 *        nhỏ nhất phải chịu. Cách duy nhất để chậu cây không bị che là đưa nó sang bên trái — mà
 *        bên trái đã kín (nhà cây + lâu đài = 42,2 %W mực trên 42,2 %W dải).
 *
 *   ⇒ Cả 5 món đều còn nhận ra được; không món nào che con vật ở làn `near`; hướng dương chỉ
 *     chạm mực con vật 0,8 %W ở mép phải (mèo adult) và nó vẽ SAU con vật nên phần đó bị che,
 *     không phải nó che con.
 */
const FLOOR_CENTER_X_PCT: Readonly<Record<string, number>> = {
  'dec-treehouse': 11.7, // trái ngoài cùng — "nhà" đứng sát góc trái là đúng
  'dec-plant': 73.0, // phải giữa — chồng hướng dương 3,4 %W, bể cá 1,7 %W
  'dec-castle': 32.4, // trái trong — làn mid đứng trước, mép phải 43,0 %W nấp sau con vật 4,8 %W
  'dec-sunflower': 65.0, // phải, sát hành lang; mực trái 59,0 %W (chỉ chạm mép con vật 0,8 %W)
  'dec-aquarium': 86.8, // phải ngoài — làn GẦN duy nhất, phải né hẳn cột con vật (mực trái 76,7)
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
