/**
 * RubyLingo — E2E: 10 phụ kiện đặt cùng lúc KHÔNG được chồng lên nhau.
 *
 * ⭐ VÌ SAO PHẢI CÓ TẦNG NÀY (unit test jsdom đã xanh rồi mà):
 *   `jsdom` KHÔNG có layout — `getBoundingClientRect()` luôn trả 0. Câu hỏi duy nhất quan trọng ở
 *   đây là **"bấm vào tâm món có trúng chính nó không"**, và nó chỉ trả lời được trong trình duyệt
 *   thật, với CSS thật và `elementFromPoint` thật.
 *
 * ⭐ LỖI ĐÃ SỬA (chủ dự án: *"Phụ kiện không di chuyển tự do được"*):
 *   `accessoryDropX` cũ rải 10 món trên MỘT hàng 25→75%W, cùng `y = 70`. Khung 328px ⇒ 50%W =
 *   164px ÷ 10 = **bước 18px**, mà ô chạm `size-touch` = **56px** ⇒ chồng **38px** mỗi cặp. Đo
 *   trên production: **7/10 món bấm trúng món KHÁC** — bé không kéo được món mình muốn.
 *   Nay `accessoryDropPoint` chia lưới HAI CHIỀU tính từ kích thước khung thật.
 *
 * ⚠️ BẪY ĐÃ TRẢ GIÁ: khay đồ **CO LẠI sau mỗi lần đặt**, nên vòng lặp phải bấm nút **ĐẦU TIÊN**
 *    liên tục (`while (count > 0)`). Viết `nth(i)` sẽ chết ở `nth(5)` vì lúc đó khay chỉ còn 5 nút.
 *
 * ⚠️ ĐO TRÊN BẢN BUILD PRODUCTION (cổng 4173), không phải `vite dev` — xem `playwright.config.ts`.
 */

import { expect, test } from '@playwright/test';
import Database from 'better-sqlite3';
import { resolve } from 'node:path';

import { createChild, signUpParent, uniqueEmail } from './helpers/session.js';

const DB = resolve('data/e2e.db');

/** Cả 10 phụ kiện của danh mục — đúng số `accessory` trong `shared/content/shop-items.json`. */
const ALL_ACCESSORIES = [
  'acc-bow',
  'acc-hat',
  'acc-glasses',
  'acc-scarf',
  'acc-shoes',
  'acc-backpack',
  'acc-crown',
  'acc-star-glasses',
  'acc-cape',
  'acc-wings',
] as const;

/**
 * Cấp thẳng phụ kiện cho bé qua DB e2e.
 *
 * ⭐ VÌ SAO KHÔNG MUA BẰNG UI: mua 10 món = 10 lượt gọi API có hoạt ảnh/thông báo, và mỗi lượt có
 *   thể làm hỏng phép đo (khay đổi bố cục giữa chừng). Ta chỉ cần TRẠNG THÁI CUỐI: túi đồ có 10 món.
 *   `equipped = 0` để chúng nằm trong khay (món đang mặc bị loại khỏi khay — xem `wornIds`).
 */
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

test('10 phụ kiện cùng đặt: bấm vào tâm món nào cũng trúng CHÍNH món đó', async ({ page }) => {
  await signUpParent(page, uniqueEmail());
  await createChild(page, 'Na Chồng Lấn');

  const session = await page.request.get('/api/auth/session');
  const childId = ((await session.json()) as { data: { children: { id: string }[] } }).data
    .children[0]!.id;

  // Vào nhà thú cưng (lần đầu phải chọn bạn đồng hành — guard định tuyến tự đưa sang `/pet/chon`).
  await page.goto('/pet');
  await expect(page).toHaveURL(/\/pet\/chon$/);
  await page
    .getByRole('group', { name: 'Các bạn đồng hành để bé chọn' })
    .getByRole('button', { name: 'Mèo Miu' })
    .click();
  await page.getByRole('button', { name: 'Chọn bạn này!' }).click();
  await expect(page).toHaveURL(/\/pet$/);

  grant(childId, 9999, ALL_ACCESSORIES);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Nhà thú cưng', exact: true })).toBeVisible();

  const room = page.getByRole('region', { name: 'Góc phòng của bé' });
  await page.evaluate(() => {
    const frame = document.querySelector('[data-room-wall]')!.parentElement as HTMLElement;
    frame.scrollIntoView({ block: 'center' });
  });

  // --- Đặt HẾT khay ---------------------------------------------------------
  const trayButtons = room.locator('div[role="group"] button');
  const initialCount = await trayButtons.count();
  expect(initialCount, 'phải có đủ 10 nút trong khay').toBe(ALL_ACCESSORIES.length);

  let remaining = initialCount;
  let guard = 0;
  while (remaining > 0 && guard < 30) {
    await trayButtons.first().click();
    await page.waitForTimeout(150);
    remaining = await trayButtons.count();
    guard += 1;
  }
  expect(remaining, 'khay phải rỗng sau khi đặt hết').toBe(0);

  // --- Đã đặt đủ 10 món -----------------------------------------------------
  const placed = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-room-accessory]')].map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        id: element.dataset.roomAccessory ?? '',
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    }),
  );
  expect(placed.length, 'phải đặt được cả 10 món').toBe(ALL_ACCESSORIES.length);

  // --- TÂM mỗi món phải bấm trúng CHÍNH NÓ ----------------------------------
  //
  // ⭐ ĐÂY LÀ KHẲNG ĐỊNH CHÍNH. `elementFromPoint` là phép duy nhất mô phỏng đúng câu hỏi của bé:
  //   "ngón tay chạm vào đây thì cái gì ăn cú chạm?" — nó đi qua đúng thứ tự xếp lớp của trình
  //   duyệt (`z-index`, thứ tự chèn DOM, `pointer-events`). Không có cách nào thay thế bằng phép
  //   so sánh toạ độ, vì hai món có thể không giao hình học mà vẫn che nhau qua `z-index`.
  const blocked: string[] = [];
  for (const item of placed) {
    const hit = await page.evaluate(
      ([x, y]) => {
        const element = document.elementFromPoint(x as number, y as number) as HTMLElement | null;
        const owner = element?.closest('[data-room-accessory]') as HTMLElement | null;
        return owner?.dataset.roomAccessory ?? '(không phải phụ kiện)';
      },
      [item.x + item.width / 2, item.y + item.height / 2],
    );
    if (hit !== item.id) blocked.push(`${item.id} → bấm trúng ${hit}`);
  }

  expect(
    blocked,
    `Các món sau bị món khác đè lên (bé không kéo được):\n${blocked.join('\n')}`,
  ).toEqual([]);

  // --- Vùng chạm đủ lớn -----------------------------------------------------
  //
  // Ngưỡng 56px, KHÔNG phải 64px: `tokens.css` hạ `--sp-touch` xuống 56px dưới 480px (điện thoại).
  // Đó là sàn THẬT của dự án — cùng ngưỡng với `02-dieu-huong-duoi.spec.ts`.
  for (const item of placed) {
    expect(item.width, `${item.id} rộng`).toBeGreaterThanOrEqual(56);
    expect(item.height, `${item.id} cao`).toBeGreaterThanOrEqual(56);
  }
});
