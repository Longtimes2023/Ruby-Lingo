/**
 * RubyLingo — chốt chặn cho bố cục "Góc phòng của bé" (`src/lib/roomLayout.ts`).
 *
 * ⚠️ VÌ SAO BỘ TEST NÀY TỒN TẠI, CHỨ KHÔNG CHỈ CÓ ẢNH CHỤP:
 *   Lỗi chủ dự án báo ("đồ trang trí nhỏ xíu, phòng chỉ là phông nền") là loại lỗi KHÔNG có lỗi
 *   biên dịch, KHÔNG có cảnh báo lint, và ảnh chụp ở 360px trông vẫn "tạm được" — nó chỉ lộ ra
 *   khi so TỈ LỆ giữa các viewport. Muốn CI bắt được nó thì phải khoá bằng con số: đồ treo tường
 *   phải nằm trong dải tường, đồ dưới sàn phải đứng đúng làn, bề rộng phải nằm trong khoảng, và
 *   bảng bố cục phải khớp danh mục cửa hàng thật.
 *
 * Bốn nhóm:
 *   1. Bảng ↔ danh mục: không thiếu món, không thừa món, dải khớp `slot`.
 *   2. Đồ treo tường: trong dải tường, đủ lề, đủ khoảng hở, bề rộng trong khoảng.
 *   3. Đồ dưới sàn: đúng làn, đáy nằm trên đường làn, bề rộng trong khoảng của làn.
 *   4. Hình học phòng + kẹp biên + thứ tự lớp.
 */

import { describe, expect, it } from 'vitest';

import {
  BASEBOARD_PCT,
  CLAMP_INSET_PCT,
  DECORATION_LAYOUT,
  FLOOR_TOP_PCT,
  LANE_BOTTOM_PCT,
  LANE_WIDTH_RANGE,
  PET_BOTTOM_PCT,
  PET_HEIGHT_PCT,
  WALL_GAP_PCT,
  WALL_LINE_PCT,
  WALL_MARGIN_PCT,
  WALL_RESERVED_X_PCT,
  WALL_WIDTH_RANGE,
  clampToRoom,
  decorationRenderSize,
  decorationSpec,
  defaultDecorationBox,
  pctHToCqw,
  placedDecorationBox,
  sortByBottom,
} from '../../../src/lib/roomLayout.js';
import { decorationSlotOf, shopItemsByCategory } from '../../../shared/content/shop.js';
import type { FloorLane } from '../../../src/lib/roomLayout.js';

const LANES: readonly FloorLane[] = ['far', 'mid', 'near'];

/** Dung sai cho phép khi so số thực — bố cục làm tròn 1 chữ số thập phân. */
const EPS = 0.15;

// =============================================================================
// Nhóm 1 — bảng bố cục phải khớp danh mục cửa hàng THẬT
// =============================================================================

describe('roomLayout — bảng phải khớp danh mục trang trí', () => {
  const catalogDecorations = shopItemsByCategory('decoration');

  it('mọi món trang trí trong cửa hàng đều CÓ bố cục (quên điền = món mua về vô hình)', () => {
    for (const item of catalogDecorations) {
      expect(decorationSpec(item.id), `${item.id} thiếu trong DECORATION_LAYOUT`).toBeDefined();
    }
  });

  it('bảng không có món "lạ" ngoài danh mục (id gõ sai = món không bao giờ hiện)', () => {
    const catalogIds = new Set(catalogDecorations.map((item) => item.id));
    for (const id of Object.keys(DECORATION_LAYOUT)) {
      expect(catalogIds.has(id), `${id} có trong bảng nhưng không có trong cửa hàng`).toBe(true);
    }
  });

  it('⚠️ dải (wall/floor) khớp với `slot` của danh mục — sky→wall, ground→floor', () => {
    for (const item of catalogDecorations) {
      const slot = decorationSlotOf(item);
      const spec = decorationSpec(item.id);
      expect(spec, item.id).toBeDefined();
      if (!spec) continue;

      const expectedBand = slot === 'sky' ? 'wall' : 'floor';
      expect(spec.band, `${item.id} (slot=${slot}) phải thuộc dải ${expectedBand}`).toBe(expectedBand);
      if (spec.band === 'wall') expect(spec.lane, `${item.id} treo tường thì không có làn`).toBeNull();
      if (spec.band === 'floor') expect(LANES).toContain(spec.lane);
    }
  });
});

// =============================================================================
// Nhóm 2 — đồ TREO TƯỜNG
// =============================================================================

describe('roomLayout — đồ treo tường', () => {
  const wallIds = Object.entries(DECORATION_LAYOUT)
    .filter(([, spec]) => spec.band === 'wall')
    .map(([id]) => id);

  it('có đúng 5 món treo tường (bóng bay, đèn lồng, tranh, cờ, cầu vồng)', () => {
    expect(wallIds.sort()).toEqual(
      ['dec-balloon', 'dec-flag', 'dec-lantern', 'dec-picture', 'dec-rainbow'].sort(),
    );
  });

  it('⚠️ hộp nằm TRỌN trong dải tường (trên ≥ 0, dưới < 61,8%H) và không chạm đường chân tường', () => {
    /*
      ⚠️⚠️ ĐỔI LUẬT 2026-10-20 — KHÔNG PHẢI "NỚI NGƯỠNG CHO TEST XANH". Đọc phần này trước khi
      hoàn nguyên về điều kiện cũ (`box.topPct` trong 20–45 %H):

        • Luật cũ ra đời khi đồ treo tường nhỏ (12,2–16,4 %W) và bố cục là **2 hàng**: tâm hàng
          trên ~24 %H, tâm hàng dưới ~44 %H, nên "tâm trong 20–45" vừa đúng vừa dễ đọc.
        • Đợt phóng to 1,2× (chủ dự án: *"nhìn nó nhỏ quá"*) làm 5 hộp cao tổng 106,6 %H — không
          xếp vừa 2 hàng trong dải 61,8 %H. Bố cục buộc phải thành **3 hàng một cột** (cột phải),
          tức là tâm hàng đầu ~10 %H và tâm hàng cuối ~52 %H. Giữ luật cũ thì nó ĐỎ dù bố cục
          đúng — một test khẳng định sai sự thật.
        • Ý ĐỊNH của luật cũ là "đồ treo tường phải nằm trên tường": không trôi lên quá mép khung,
          không xuyên xuống sàn. Ý định đó được phát biểu ĐÚNG bằng **mép của hộp** (top ≥ 0 và
          bottom < WALL_LINE_PCT), không bằng tâm — tâm chỉ là hệ quả của bố cục 2 hàng.

      Vẫn giữ nguyên `bottomPct < WALL_LINE_PCT` (đáy PHẦN HÌNH phải ở trên chân tường), nên
      không có ngưỡng nào bị bỏ: chỉ là ngưỡng "tâm y" được thay bằng ngưỡng chặt hơn về đúng thứ
      nó muốn nói.
    */
    for (const id of wallIds) {
      const box = defaultDecorationBox(id);
      expect(box, id).toBeDefined();
      if (!box) continue;
      const boxTop = box.topPct - box.heightPct / 2;
      const boxBottom = box.topPct + box.heightPct / 2;
      expect(boxTop, `${id} mép trên hộp`).toBeGreaterThanOrEqual(0 - EPS);
      expect(boxBottom, `${id} mép dưới hộp phải ở trên chân tường`).toBeLessThan(WALL_LINE_PCT);
      // Đáy PHẦN HÌNH cũng phải ở trên chân tường, nếu không món "xuyên" xuống sàn.
      expect(box.bottomPct, `${id} đáy`).toBeLessThan(WALL_LINE_PCT);
    }
  });

  it('⚠️ KHÔNG món treo tường nào lấn vào cột của thú cưng (vùng giữa bức tường)', () => {
    /*
      ⚠️⚠️ ĐÂY LÀ BẢN VÁ CỦA MỘT LỖI ĐÃ NHÌN THẤY TRÊN ẢNH CHỤP THẬT.
      Bản cũ rải 5 món thành MỘT hàng từ lề trái ⇒ cầu vồng rơi đúng 47%W, tức là sau gáy thú cưng.
      Khi con vật trong phòng bắt đầu mặc mũ (bản vá "phụ kiện trong phòng"), chiếc mũ nhô lên
      ~15%H và che kín cầu vồng — mắt đọc ra "cái mũ có hình cầu vồng". Test này khoá lại: bất kỳ
      món treo tường nào chồng lên hộp thú cưng là ĐỎ.
    */
    const [reservedLeft, reservedRight] = WALL_RESERVED_X_PCT;

    for (const id of wallIds) {
      const box = defaultDecorationBox(id);
      if (!box) continue;
      const left = box.leftPct - box.widthPct / 2;
      const right = box.leftPct + box.widthPct / 2;
      const overlapsReserved = right > reservedLeft + EPS && left < reservedRight - EPS;
      expect(overlapsReserved, `${id} lấn vào cột thú cưng (${left}–${right}%W)`).toBe(false);
    }
  });

  it('⚠️ vùng giữa chừa cho thú cưng ĐÚNG BẰNG hộp thú cưng (không phải số ưa mắt)', () => {
    // Vùng chừa phải SUY từ hình học thú cưng: rộng `pctHToCqw(PET_HEIGHT_PCT)` và canh giữa 50%W.
    const petWidthPct = pctHToCqw(PET_HEIGHT_PCT);
    const [reservedLeft, reservedRight] = WALL_RESERVED_X_PCT;

    expect(reservedLeft).toBeLessThanOrEqual(50 - petWidthPct / 2 + EPS);
    expect(reservedRight).toBeGreaterThanOrEqual(50 + petWidthPct / 2 - EPS);
    // Và không được rộng đến mức nuốt luôn hai bên tường (còn phải treo được đồ).
    expect(reservedRight - reservedLeft).toBeLessThanOrEqual(petWidthPct + 2);
  });

  it('⚠️ bề rộng trong khoảng 12,5–22,5%W (khoảng suy từ bảng: 14,6…19,6 ±15%)', () => {
    for (const id of wallIds) {
      const box = defaultDecorationBox(id);
      expect(box).toBeDefined();
      if (!box) continue;
      expect(box.widthPct, `${id} bề rộng`).toBeGreaterThanOrEqual(WALL_WIDTH_RANGE[0] - EPS);
      expect(box.widthPct, `${id} bề rộng`).toBeLessThanOrEqual(WALL_WIDTH_RANGE[1] + EPS);
    }
  });

  it('⚠️ mép cách lề ≥6%W (món không dính vào góc)', () => {
    for (const id of wallIds) {
      const box = defaultDecorationBox(id);
      if (!box) continue;
      const left = box.leftPct - box.widthPct / 2;
      const right = 100 - (box.leftPct + box.widthPct / 2);
      expect(left, `${id} lề trái`).toBeGreaterThanOrEqual(WALL_MARGIN_PCT - EPS);
      expect(right, `${id} lề phải`).toBeGreaterThanOrEqual(WALL_MARGIN_PCT - EPS);
    }
  });

  it('⚠️ hai món CÙNG HÀNG không chồng nhau, và hai món BẤT KỲ không chồng nhau', () => {
    const boxes = wallIds
      .map((id) => defaultDecorationBox(id))
      .filter((box): box is NonNullable<typeof box> => box !== undefined);

    /** Hộp theo 2 chiều, để so chồng lấn thật (không chỉ theo trục x như bản một-hàng cũ). */
    const extent = (box: NonNullable<(typeof boxes)[number]>) => ({
      left: box.leftPct - box.widthPct / 2,
      right: box.leftPct + box.widthPct / 2,
      top: box.topPct - box.heightPct / 2,
      bottom: box.topPct + box.heightPct / 2,
    });

    // (a) Không hai món nào chồng lên nhau — xét CẢ hai chiều.
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = extent(boxes[i]!);
        const b = extent(boxes[j]!);
        const overlaps =
          a.right > b.left + EPS && a.left < b.right - EPS && a.bottom > b.top + EPS && a.top < b.bottom - EPS;
        expect(overlaps, `${boxes[i]!.itemId} chồng ${boxes[j]!.itemId}`).toBe(false);
      }
    }

    // (b) Trong cùng một hàng, hai món cạnh nhau phải còn khoảng hở.
    //
    // ⚠️ Từ bố cục 3 hàng (2026-10-20) mỗi hàng chỉ còn MỘT món mỗi cột ⇒ vòng lặp dưới không
    //   gặp cặp nào, và khe DỌC (0,65 / 1,0 %H ở cột phải) do phép (a) canh — nó đòi hai hộp
    //   không chồng nhau theo CẢ hai chiều. Giữ nguyên vòng lặp: nó là luật NGANG thật, và sẽ có
    //   tác dụng trở lại nếu ai đó xếp lại thành 2 hàng (khi có màn hình cao hơn hoặc món nhỏ lại).
    //   KHÔNG hạ `WALL_GAP_PCT` xuống 0 để "cho khớp bố cục dọc" — hai đại lượng khác nhau.
    const rows = new Map<number, typeof boxes>();
    for (const box of boxes) {
      const key = box.topPct;
      rows.set(key, [...(rows.get(key) ?? []), box]);
    }
    for (const [, rowBoxes] of rows) {
      const sorted = [...rowBoxes].sort((a, b) => a.leftPct - b.leftPct);
      for (let i = 1; i < sorted.length; i += 1) {
        const prev = extent(sorted[i - 1]!);
        const next = extent(sorted[i]!);
        expect(next.left - prev.right, `${sorted[i - 1]!.itemId} → ${sorted[i]!.itemId}`).toBeGreaterThanOrEqual(
          WALL_GAP_PCT - EPS,
        );
      }
    }
  });
});

// =============================================================================
// Nhóm 3 — đồ DƯỚI SÀN
// =============================================================================

describe('roomLayout — đồ dưới sàn', () => {
  const floorIds = Object.entries(DECORATION_LAYOUT)
    .filter(([, spec]) => spec.band === 'floor')
    .map(([id]) => id);

  it('có đúng 5 món dưới sàn (chậu cây, hướng dương, nhà cây, bể cá, lâu đài)', () => {
    expect(floorIds.sort()).toEqual(
      ['dec-aquarium', 'dec-castle', 'dec-plant', 'dec-sunflower', 'dec-treehouse'].sort(),
    );
  });

  it('mỗi món được ghim vào MỘT làn cố định (không đổi giữa các lần tải)', () => {
    for (const id of floorIds) {
      const first = defaultDecorationBox(id);
      const second = defaultDecorationBox(id);
      expect(first?.lane, id).not.toBeNull();
      expect(second?.lane, `${id} phải ổn định`).toBe(first?.lane);
    }
  });

  it('⚠️ đáy món nằm đúng trên đường làn (±2%H)', () => {
    for (const id of floorIds) {
      const box = defaultDecorationBox(id);
      if (!box || box.lane === null) continue;
      expect(
        Math.abs(box.bottomPct - LANE_BOTTOM_PCT[box.lane]),
        `${id} (làn ${box.lane}) đáy ${box.bottomPct} lệch khỏi làn ${LANE_BOTTOM_PCT[box.lane]}`,
      ).toBeLessThanOrEqual(2 + EPS);
    }
  });

  it('⚠️ làn xa nằm CAO hơn làn gần (đáy nhỏ hơn ⇒ xa hơn)', () => {
    expect(LANE_BOTTOM_PCT.far).toBeLessThan(LANE_BOTTOM_PCT.mid);
    expect(LANE_BOTTOM_PCT.mid).toBeLessThan(LANE_BOTTOM_PCT.near);
  });

  it('⚠️ bề rộng nằm trong khoảng của đúng làn đó', () => {
    for (const id of floorIds) {
      const box = defaultDecorationBox(id);
      if (!box || box.lane === null) continue;
      const [min, max] = LANE_WIDTH_RANGE[box.lane];
      expect(box.widthPct, `${id} bề rộng ở làn ${box.lane}`).toBeGreaterThanOrEqual(min - EPS);
      expect(box.widthPct, `${id} bề rộng ở làn ${box.lane}`).toBeLessThanOrEqual(max + EPS);
    }
  });

  it('⚠️ làn càng gần thì món càng to (hệ số phóng 0,62 / 0,82 / 1,00)', () => {
    const maxOf = (lane: FloorLane) =>
      Math.max(
        ...Object.entries(DECORATION_LAYOUT)
          .filter(([, spec]) => spec.lane === lane)
          .map(([, spec]) => spec.widthPct),
      );
    expect(maxOf('far')).toBeLessThan(maxOf('mid'));
    expect(maxOf('mid')).toBeLessThan(maxOf('near'));
  });

  it('đồ dưới sàn không đứng chắn ngay giữa khung (chỗ thú cưng đứng)', () => {
    // Thú cưng chiếm khoảng 40–62%W ở giữa. Món "gần" mà đặt đúng tâm là che mất con vật —
    // mất luôn phần thưởng của cả màn hình.
    const near = Object.entries(DECORATION_LAYOUT).find(([, spec]) => spec.lane === 'near');
    expect(near, 'phải có ít nhất một món ở làn gần').toBeDefined();
    const box = defaultDecorationBox(near![0]);
    expect(box).toBeDefined();
    const left = box!.leftPct - box!.widthPct / 2;
    expect(left, 'món làn gần phải lệch khỏi tâm 50%W').toBeGreaterThan(50);
  });
});

// =============================================================================
// Nhóm 4 — hình học phòng, kẹp biên, thứ tự lớp
// =============================================================================

describe('roomLayout — hình học phòng', () => {
  it('⚠️ chân tường ở 61,8%H và baseboard cao 2,5%H ngay dưới nó', () => {
    expect(WALL_LINE_PCT).toBeCloseTo(61.8, 5);
    expect(BASEBOARD_PCT).toBeCloseTo(2.5, 5);
    expect(FLOOR_TOP_PCT).toBeCloseTo(WALL_LINE_PCT + BASEBOARD_PCT, 5);
  });

  it('⚠️ thú cưng: đáy 84%H, cao 46%H ⇒ đầu ở 38%H (trong tường), chân trong sàn', () => {
    expect(PET_BOTTOM_PCT).toBeCloseTo(84, 5);
    expect(PET_HEIGHT_PCT).toBeCloseTo(46, 5);

    const headPct = PET_BOTTOM_PCT - PET_HEIGHT_PCT;
    expect(headPct, 'đầu phải nằm trong dải tường').toBeLessThan(WALL_LINE_PCT);
    expect(headPct, 'đầu phải ở dưới mép trên khung').toBeGreaterThan(0);
    expect(PET_BOTTOM_PCT, 'chân phải nằm trong dải sàn').toBeGreaterThan(FLOOR_TOP_PCT);
    expect(PET_BOTTOM_PCT, 'chân phải ở trên mép dưới khung').toBeLessThan(100);
  });

  it('quy đổi %H → cqw đúng cho khung 4:3', () => {
    // 1%H của khung 4:3 = 0,75%W = 0,75cqw.
    expect(pctHToCqw(100)).toBeCloseTo(75, 5);
    expect(pctHToCqw(PET_HEIGHT_PCT)).toBeCloseTo(34.5, 5);
  });

  it('ảnh trang trí giữ đúng tỉ lệ khung: bề rộng cqw = %W khai báo', () => {
    for (const [id, spec] of Object.entries(DECORATION_LAYOUT)) {
      const size = decorationRenderSize(spec);
      expect(size.widthCqw, `${id} bề rộng`).toBeCloseTo(spec.widthPct, 1);
      // Ảnh gốc là hình VUÔNG (512×512), nên chiều cao quy ra cqw phải bằng bề rộng ⇒ không
      // méo, không hộp chữ nhật thừa. Đây là chốt chặn cho lúc ai đó thêm ảnh không vuông.
      expect(size.heightCqw, `${id} phải giữ tỉ lệ vuông như ảnh gốc`).toBeCloseTo(size.widthCqw, 0);
    }
  });
});

describe('roomLayout — kẹp toạ độ vào khung', () => {
  it('giữ nguyên toạ độ đã nằm trong khung', () => {
    expect(clampToRoom(50, 40)).toEqual({ x: 50, y: 40 });
  });

  it('⚠️ kéo quá mép ⇒ kẹp vào trong, chừa 1% lề (món không trôi mất khỏi khung)', () => {
    expect(clampToRoom(-50, -20)).toEqual({ x: CLAMP_INSET_PCT, y: CLAMP_INSET_PCT });
    expect(clampToRoom(200, 500)).toEqual({ x: 100 - CLAMP_INSET_PCT, y: 100 - CLAMP_INSET_PCT });
  });

  it('mọi kết quả luôn nằm trong 0..100 (schema server yêu cầu)', () => {
    for (const [x, y] of [
      [0, 0],
      [100, 100],
      [-999, 999],
      [50.4, 12.6],
    ]) {
      const point = clampToRoom(x!, y!);
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(100);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(100);
    }
  });

  it('⚠️ toạ độ hỏng (NaN/Infinity) ⇒ về mép an toàn, KHÔNG để `left: NaN%` làm món biến mất', () => {
    expect(clampToRoom(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({
      x: CLAMP_INSET_PCT,
      y: CLAMP_INSET_PCT,
    });
  });

  it('món đã kéo tay: tôn trọng x/y đã lưu, chỉ kẹp biên', () => {
    const box = placedDecorationBox('dec-balloon', 30, 40);
    expect(box).toBeDefined();
    expect(box!.leftPct).toBe(30);
    expect(box!.topPct).toBe(40);
    // Cỡ vẫn theo bảng: bé đổi vị trí, không đổi cỡ.
    expect(box!.widthPct).toBe(decorationSpec('dec-balloon')!.widthPct);

    const clamped = placedDecorationBox('dec-balloon', 500, -500);
    expect(clamped!.leftPct).toBe(100 - CLAMP_INSET_PCT);
    expect(clamped!.topPct).toBe(CLAMP_INSET_PCT);
  });

  it('id lạ ⇒ `undefined` (không ném trong lúc render)', () => {
    expect(decorationSpec('dec-khong-co')).toBeUndefined();
    expect(defaultDecorationBox('dec-khong-co')).toBeUndefined();
    expect(placedDecorationBox('dec-khong-co', 50, 50)).toBeUndefined();
  });
});

describe('roomLayout — thứ tự vẽ', () => {
  it('⚠️ sắp theo ĐÁY tăng dần: xa vẽ trước, gần vẽ sau (không đổi mảng gốc)', () => {
    const input = [{ bottomPct: 86 }, { bottomPct: 66 }, { bottomPct: 84 }, { bottomPct: 75 }];
    const sorted = sortByBottom(input);

    expect(sorted.map((node) => node.bottomPct)).toEqual([66, 75, 84, 86]);
    expect(sorted).not.toBe(input);
    expect(input.map((node) => node.bottomPct)).toEqual([86, 66, 84, 75]);
  });

  it('thú cưng đứng giữa làn giữa và làn gần trong thứ tự vẽ', () => {
    const floorBoxes = Object.keys(DECORATION_LAYOUT)
      .filter((id) => DECORATION_LAYOUT[id]!.band === 'floor')
      .map((id) => defaultDecorationBox(id)!)
      .map((box) => ({ id: box.itemId, bottomPct: box.bottomPct }));
    const layers = sortByBottom([...floorBoxes, { id: '__pet__', bottomPct: PET_BOTTOM_PCT }]);

    const petIndex = layers.findIndex((layer) => layer.id === '__pet__');
    const nearIndex = layers.findIndex((layer) => layer.id === 'dec-aquarium');
    // Bể cá (làn gần, đáy 86%H) phải vẽ SAU thú cưng (đáy 84%H).
    expect(nearIndex).toBeGreaterThan(petIndex);
    // Mọi món làn xa/giữa (đáy ≤ 75%H) phải vẽ TRƯỚC thú cưng.
    for (const layer of layers.slice(0, petIndex)) {
      expect(layer.bottomPct).toBeLessThanOrEqual(PET_BOTTOM_PCT);
    }
  });
});
