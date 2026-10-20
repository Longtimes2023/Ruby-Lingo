/**
 * RubyLingo — E2E: tỉ lệ 10 món đồ trang trí trong "Góc phòng của bé".
 *
 * ⭐ VÌ SAO PHẢI CÓ TẦNG NÀY (unit test jsdom đã xanh rồi mà):
 *   `jsdom` KHÔNG có layout — mọi `getBoundingClientRect()` trả 0. Ba câu hỏi của lỗi chủ dự án báo
 *   (*"Canh lại tỷ lệ của các đồ trang trí"*) chỉ trả lời được trong trình duyệt thật:
 *     1. **Đáy phần hình có trùng đường làn không** (đo bằng ALPHA THẬT của ảnh, không lấy từ bảng —
 *        lấy từ bảng thì phép kiểm chỉ chứng minh bảng khớp chính nó).
 *     2. Cỡ các món có **suy được từ một quy tắc** không, hay mỗi món một cỡ.
 *     3. Có **phối cảnh xa–gần** không (làn `far` nhỏ hơn `near`).
 *
 * ⭐ LỖI ĐÃ SỬA:
 *   • `bottomPct` cũ = `topPct + heightPct/2` — đó là đáy **HỘP**, còn ảnh 512² có viền trong suốt
 *     nên mép dưới **phần hình** cao hơn ⇒ món chìm +7,4…+10,4 %H so với đường làn (dải sàn chỉ
 *     cao 35,7 %H, nên 10 %H là hơn 1/4 dải sàn).
 *   • Cỡ khai tay từng món ⇒ bề rộng nhìn thấy trải 5,9→17,1 %W (2,89 lần).
 *   • `LANE_SCALE` (0,62 / 0,82 / 1,00) là MÃ CHẾT — khai báo mà không nơi nào dùng, nên phối cảnh
 *     được mô tả trong tài liệu nhưng chưa bao giờ được áp dụng.
 *
 * ⚠️⚠️ ĐO THEO **PADDING BOX**, KHÔNG PHẢI BORDER BOX — đây là chỗ dễ ra "lệch ma" nhất.
 *   Khung phòng có `border-2` (2px mỗi bên). `left`/`top`/`height` tính bằng `%` của một phần tử
 *   `position:absolute` giải theo **padding box**, còn `getBoundingClientRect()` của khung trả
 *   **border box**. Trộn hai hệ cho ra lệch hệ thống ≈ −0,6 %H (đã đo: bể cá 85,3 thay vì 86,0).
 *   Nên phép đo dưới đây dùng `clientWidth`/`clientHeight` (padding box) và cộng bù viền.
 *
 * ⚠️ ĐO TRÊN BẢN BUILD PRODUCTION (cổng 4173), không phải `vite dev` — xem `playwright.config.ts`.
 */

import { expect, test } from '@playwright/test';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { createChild, signUpParent, uniqueEmail } from './helpers/session.js';

const DB = resolve('data/e2e.db');

/** Thư mục bằng chứng — tuyệt đối, nằm trong repo nhưng bị `.gitignore`. */
const OUTPUTS_DIR = join(process.cwd(), 'outputs');

/** Cả 10 món trang trí của danh mục — đúng số `decoration` trong `shared/content/shop-items.json`. */
const ALL_DECORATIONS = [
  'dec-picture',
  'dec-flag',
  'dec-rainbow',
  'dec-balloon',
  'dec-lantern',
  'dec-treehouse',
  'dec-plant',
  'dec-castle',
  'dec-sunflower',
  'dec-aquarium',
] as const;

/** Đường làn của 5 món dưới sàn (%H) — khớp `LANE_BOTTOM_PCT` trong `src/lib/roomLayout.ts`. */
const LANE_BOTTOM: Readonly<Record<string, number>> = {
  'dec-treehouse': 66,
  'dec-plant': 66,
  'dec-castle': 75,
  'dec-sunflower': 75,
  'dec-aquarium': 86,
};

/** Bề rộng cho phép theo làn (%W) — khớp `LANE_WIDTH_RANGE`. */
const LANE_WIDTH_RANGE: Readonly<Record<string, readonly [number, number]>> = {
  'dec-treehouse': [10, 16],
  'dec-plant': [10, 16],
  'dec-castle': [12, 20],
  'dec-sunflower': [12, 20],
  'dec-aquarium': [14, 24],
};

/**
 * Dung sai đáy, đơn vị %H.
 *
 * ⭐ 0,5 là mục tiêu lý thuyết. Ảnh được vẽ ở **pixel nguyên** (`drawImage` → layout snap), nên ở
 *   khung 328×246 sai số lượng tử hoá của phép đo là ~0,3 px mỗi trục ≈ 0,15 %H, cộng làm tròn
 *   1 chữ số của bảng (`round1`). 0,8 phủ được cả hai mà vẫn bắt được lỗi thật (lỗi cũ là 7,4–10,4).
 */
const BOTTOM_TOLERANCE_PCT = 0.8;

interface Measurement {
  id: string;
  widthPct: number;
  heightPct: number;
  /** Đáy PHẦN HÌNH, %H so với padding box của khung. */
  inkBottomPct: number;
  /** Mép trái/phải/trên của HỘP, % so với padding box — để chứng minh món nằm TRONG khung. */
  leftPct: number;
  rightPct: number;
  topPct: number;
}

/** Cấp thẳng 10 món trang trí cho bé qua DB e2e (mua 10 món bằng UI chỉ làm nhiễu phép đo). */
function grant(childId: string, stars: number, items: readonly string[]): void {
  const db = new Database(DB);
  db.pragma('busy_timeout = 5000');
  db.prepare('UPDATE wallet SET stars = ? WHERE child_id = ?').run(stars, childId);
  for (const id of items) {
    db.prepare(
      'INSERT OR REPLACE INTO inventory (child_id, item_id, quantity, equipped, acquired_at) VALUES (?, ?, 1, 0, ?)',
    ).run(childId, id, new Date().toISOString());
  }
  db.close();
}

test('tỉ lệ 10 món trang trí: đáy trùng đường làn, cỡ suy được, có phối cảnh', async ({ page }) => {
  mkdirSync(OUTPUTS_DIR, { recursive: true });

  await signUpParent(page, uniqueEmail());
  await createChild(page, 'Na Tỉ Lệ');

  const session = await page.request.get('/api/auth/session');
  const childId = ((await session.json()) as { data: { children: { id: string }[] } }).data
    .children[0]!.id;

  await page.goto('/pet');
  await expect(page).toHaveURL(/\/pet\/chon$/);
  await page
    .getByRole('group', { name: 'Các bạn đồng hành để bé chọn' })
    .getByRole('button', { name: 'Mèo Miu' })
    .click();
  await page.getByRole('button', { name: 'Chọn bạn này!' }).click();
  await expect(page).toHaveURL(/\/pet$/);

  grant(childId, 99999, ALL_DECORATIONS);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Nhà thú cưng', exact: true })).toBeVisible();

  const room = page.getByRole('region', { name: 'Góc phòng của bé' });
  await page.evaluate(() => {
    const frame = document.querySelector('[data-room-wall]')!.parentElement as HTMLElement;
    frame.scrollIntoView({ block: 'center' });
  });

  /*
    Đặt hết khay trang trí. Nút bị `disabled` sau khi món đã vào phòng, nên bám vào
    `button:not([disabled])` — đếm theo chỉ số `nth(i)` sẽ trượt khi khay co lại.
  */
  const decorGroup = room.locator('div[role="group"][aria-label="Đồ trang trí đang có"]');
  for (let guard = 0; guard < 20; guard += 1) {
    const next = decorGroup.locator('button:not([disabled])').first();
    if ((await next.count()) === 0) break;
    await next.click();
    await page.waitForTimeout(120);
  }

  const frame = page.locator('[aria-label^="Phòng của thú cưng"]');
  await expect(frame.locator(':scope > button')).toHaveCount(ALL_DECORATIONS.length);

  // --- Bằng chứng cho người duyệt (bị .gitignore, không commit) --------------
  //
  // ⚠️ Dùng `page.screenshot({ clip })` với hộp của khung, KHÔNG `frame.screenshot()`: bản trước
  //    cho ra ảnh lẫn cả thanh tiêu đề phía trên (Playwright cắt theo gốc trang), nên ảnh bằng
  //    chứng trông như "mất hàng đồ trên cùng" trong khi phép đo vẫn đúng. Cắt theo `clip` là
  //    xác định.
  const viewportWidth = page.viewportSize()!.width;
  await frame.scrollIntoViewIfNeeded();
  const frameBox = await frame.boundingBox();
  expect(frameBox, 'phải đo được hộp khung phòng').not.toBeNull();
  // ⚠️ `clip` của Playwright tính theo TOẠ ĐỘ KHUNG NHÌN của trang chính ⇒ dùng thẳng `boundingBox()`
  //    sau khi đã cuộn khung vào tầm nhìn. Cộng `scrollY` (toạ độ tài liệu) sẽ lệch đúng phần cuộn.
  await page.screenshot({
    path: resolve(OUTPUTS_DIR, `room-proportions-${viewportWidth}.png`),
    clip: frameBox!,
  });

  // --- Đo thật --------------------------------------------------------------
  const measurements = await page.evaluate((): Measurement[] => {
    const wall = document.querySelector('[data-room-wall]') as HTMLElement;
    const frameElement = wall.parentElement as HTMLElement;
    const style = getComputedStyle(frameElement);
    const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
    const frameRect = frameElement.getBoundingClientRect();
    const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
    // Padding box: `clientWidth`/`clientHeight` đã trừ viền; cộng bù gốc toạ độ.
    const padLeft = frameRect.left + borderLeft;
    const padTop = frameRect.top + borderTop;
    const padWidth = frameElement.clientWidth;
    const padHeight = frameElement.clientHeight;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const out: Measurement[] = [];
    if (padWidth <= 0 || padHeight <= 0) return out;

    for (const button of Array.from(frameElement.querySelectorAll<HTMLElement>(':scope > button'))) {
      if (button.dataset.roomAccessory !== undefined) continue; // phụ kiện, không phải trang trí
      const span = button.querySelector<HTMLElement>(':scope > span');
      const image = span?.querySelector('img') ?? null;
      if (span === null || image === null || context === null) continue;

      const id = (image.src.split('/').pop() ?? '').replace(/\.webp$/, '');

      // Mép dưới PHẦN HÌNH: dò hàng pixel cuối cùng có alpha đáng kể trong chính tệp ảnh.
      let inkBottomFraction = 0.5;
      try {
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        let lastRow = -1;
        for (let y = canvas.height - 1; y >= 0 && lastRow < 0; y -= 1) {
          for (let x = 0; x < canvas.width; x += 1) {
            if ((data[(y * canvas.width + x) * 4 + 3] ?? 0) > 8) {
              lastRow = y;
              break;
            }
          }
        }
        if (lastRow >= 0) inkBottomFraction = (lastRow + 1) / canvas.height;
      } catch {
        // Canvas bị chặn đọc (tainted) ⇒ giữ 0,5; cột "lệch" sẽ tự lộ ra.
      }

      const spanRect = span.getBoundingClientRect();
      out.push({
        id,
        widthPct: (spanRect.width / padWidth) * 100,
        heightPct: (spanRect.height / padHeight) * 100,
        inkBottomPct:
          ((spanRect.top + inkBottomFraction * spanRect.height - padTop) / padHeight) * 100,
        leftPct: ((spanRect.left - padLeft) / padWidth) * 100,
        rightPct: ((spanRect.right - padLeft) / padWidth) * 100,
        topPct: ((spanRect.top - padTop) / padHeight) * 100,
      });
    }
    return out;
  });

  expect(measurements, 'phải đo được cả 10 món').toHaveLength(ALL_DECORATIONS.length);

  // ---------------------------------------------------------------------------
  // ① ĐÁY PHẦN HÌNH trùng đường làn (±0,8 %H) — khẳng định chính của "tỉ lệ"
  // ---------------------------------------------------------------------------
  const bottomOffenders = measurements
    .filter((row) => LANE_BOTTOM[row.id] !== undefined)
    .map((row) => ({ ...row, deviation: row.inkBottomPct - LANE_BOTTOM[row.id]! }))
    .filter((row) => Math.abs(row.deviation) > BOTTOM_TOLERANCE_PCT);

  expect(
    bottomOffenders.map((row) => `${row.id}: đáy ${row.inkBottomPct.toFixed(1)} %H, lệch ${row.deviation.toFixed(1)}`),
    `Đáy phần hình lệch quá ${BOTTOM_TOLERANCE_PCT} %H so với đường làn (món bị "chìm" hoặc "lơ lửng")`,
  ).toEqual([]);

  // ---------------------------------------------------------------------------
  // ② Bề rộng nằm trong khoảng của đúng làn nó thuộc
  // ---------------------------------------------------------------------------
  const widthOffenders = measurements
    .filter((row) => LANE_WIDTH_RANGE[row.id] !== undefined)
    .filter((row) => {
      const [min, max] = LANE_WIDTH_RANGE[row.id]!;
      return row.widthPct < min - 0.5 || row.widthPct > max + 0.5;
    });

  expect(
    widthOffenders.map((row) => `${row.id}: ${row.widthPct.toFixed(1)} %W`),
    'bề rộng ra ngoài khoảng cho phép của làn',
  ).toEqual([]);

  // ---------------------------------------------------------------------------
  // ②b MỌI MÓN PHẢI NẰM TRONG KHUNG — nằm ngoài là món không nhìn thấy được
  // ---------------------------------------------------------------------------
  //
  // ⭐ Phép đo toạ độ KHÔNG tự bắt được lỗi này: `getBoundingClientRect()` vẫn trả số dương cho
  //   một món nằm ngoài khung (khung có `overflow: hidden` nên nó bị CẮT, không bị ẩn khỏi DOM).
  //   Một món trôi ra ngoài là "mất" với bé mà mọi test khác vẫn xanh.
  const outsideOffenders = measurements
    .filter(
      (row) =>
        row.leftPct < -0.5 ||
        row.rightPct > 100.5 ||
        row.topPct < -0.5 ||
        row.inkBottomPct > 100.5,
    )
    .map(
      (row) =>
        `${row.id}: trái ${row.leftPct.toFixed(1)} · phải ${row.rightPct.toFixed(1)} · trên ${row.topPct.toFixed(1)} · đáy ${row.inkBottomPct.toFixed(1)}`,
    );

  expect(outsideOffenders, 'món trôi ra ngoài khung phòng (bị overflow ẩn đi)').toEqual([]);

  // ---------------------------------------------------------------------------
  // ②c ĐỒ TREO TƯỜNG phải nằm TRỌN trên tường (`inkBottom ≤ 61,8 %H`) và không lấn cột thú cưng
  // ---------------------------------------------------------------------------
  //
  // ⭐ Vì sao phải kiểm riêng: 5 món treo tường KHÔNG có "đường làn" để neo, nên không phép đo nào
  //   ở trên chạm tới chúng. Một bức tranh trôi xuống dưới chân tường (hoặc lấn vào cột con vật ở
  //   32–68 %W) vẫn làm mọi phép kiểm khác xanh — mà mắt thì thấy ngay là sai.
  const WALL_LINE_PCT = 61.8;
  const PET_COLUMN: readonly [number, number] = [32, 68];
  const wallOffenders = measurements
    .filter((row) => LANE_BOTTOM[row.id] === undefined) // = đồ treo tường
    .flatMap((row) => {
      const issues: string[] = [];
      if (row.inkBottomPct > WALL_LINE_PCT) {
        issues.push(`${row.id}: đáy ${row.inkBottomPct.toFixed(1)} %H vượt chân tường ${WALL_LINE_PCT}`);
      }
      if (row.rightPct > PET_COLUMN[0] && row.leftPct < PET_COLUMN[1]) {
        issues.push(
          `${row.id}: [${row.leftPct.toFixed(1)}, ${row.rightPct.toFixed(1)}] lấn cột thú cưng ${PET_COLUMN.join('–')}`,
        );
      }
      return issues;
    });

  expect(wallOffenders, 'đồ treo tường sai chỗ').toEqual([]);

  // ---------------------------------------------------------------------------
  // ③ PHỐI CẢNH: làn càng gần thì món càng to (`LANE_SCALE` phải được áp thật)
  // ---------------------------------------------------------------------------
  // ⚠️ So theo CHIỀU CAO đo được, không theo `widthPct` khai báo: nếu chỉ đọc bảng thì test này
  //    vẫn xanh dù `LANE_SCALE` là mã chết — đúng thứ đã xảy ra trước 2026-10-20.
  const heightOf = (id: string) => measurements.find((row) => row.id === id)?.heightPct ?? 0;
  const farMax = Math.max(heightOf('dec-treehouse'), heightOf('dec-plant'));
  const midMax = Math.max(heightOf('dec-castle'), heightOf('dec-sunflower'));
  const nearHeight = heightOf('dec-aquarium');

  expect(farMax, 'làn far phải nhỏ hơn làn mid (phối cảnh)').toBeLessThan(midMax);
  expect(midMax, 'làn mid phải nhỏ hơn làn near (phối cảnh)').toBeLessThan(nearHeight);

  // ---------------------------------------------------------------------------
  // ④ Không món nào bị bóp méo: hộp phải VUÔNG (ảnh gốc 1:1, khung 4:3)
  // ---------------------------------------------------------------------------
  //
  // Hộp đo bằng `cqw` nên `widthPct` (%W) và `heightPct` (%H) khác đơn vị; quy về cùng đơn vị
  // bằng tỉ lệ khung 4:3 rồi so với 1,0.
  const aspectOffenders = measurements
    .map((row) => {
      const widthCqw = row.widthPct; // %W = cqw
      const heightCqw = row.heightPct * 0.75; // %H → cqw
      return { id: row.id, ratio: heightCqw / widthCqw };
    })
    .filter((row) => Math.abs(row.ratio - 1) > 0.03);

  expect(
    aspectOffenders.map((row) => `${row.id}: cao/rộng = ${row.ratio.toFixed(3)} cqw`),
    'hộp không vuông ⇒ ảnh 1:1 bị bóp méo',
  ).toEqual([]);
});
