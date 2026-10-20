/**
 * RubyLingo — E2E: nút nổi "lên đầu trang" (`ScrollToTop`).
 *
 * ⭐ VÌ SAO PHẢI CÓ TẦNG NÀY (unit test jsdom đã xanh rồi mà):
 *   `jsdom` KHÔNG có layout — `getBoundingClientRect()` luôn trả 0 cho mọi phần tử. Ba câu hỏi
 *   quan trọng nhất của tính năng này CHỈ trả lời được trong trình duyệt thật:
 *     1. Nút có HIỆN sau khi cuộn và ẨN ở đầu trang không (cần `scroll` thật + `window.scrollY` thật)?
 *     2. Nút có ĐÈ lên `BottomNav` không (cần toạ độ thật của cả hai)?
 *     3. Vùng chạm có ĐỦ LỚN (≥ 64×64 CSS px) không (cần kích thước thật sau khi CSS chạy)?
 *   Và một câu nữa cũng chỉ đo được ở đây: nút có NẰM TRONG khung nhìn không (bé phải chạm tới được).
 *
 * ⚠️ ĐO TRÊN BẢN BUILD PRODUCTION: `playwright.config.ts` build `dist/` rồi phục vụ nó bằng
 *    Fastify trên cổng 4173 (xem `tests/e2e/serve.mjs`). Ảnh chụp vì thế là ảnh của ĐÚNG bản
 *    sẽ deploy, không phải của một `vite dev` có thể khác.
 *
 * ⚠️⚠️ ẢNH CHỤP RA `outputs/` (đã bị `.gitignore`) — KHÔNG commit. Đây là bằng chứng cho người
 *    duyệt, không phải tài sản của dự án. Tên theo BỀ RỘNG khung nhìn để ba project Playwright
 *    không ghi đè lên nhau.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { openKidSession } from './helpers/session.js';

/** Thư mục bằng chứng — tuyệt đối, nằm trong repo nhưng bị `.gitignore`. */
const OUTPUTS_DIR = join(process.cwd(), 'outputs');

/**
 * Màn DÀI để thử: trang một chủ đề (danh sách bài học + các khối trò chơi). Đây chính là màn mà
 * chủ dự án nói tới — "cuộn hết một bài dài" — và nó cao hơn khung nhìn ở cả ba viewport.
 */
const LONG_PAGE = '/theme/at-the-zoo';

/** Nhãn đọc của nút — khớp `nav.scrollToTop` trong `src/i18n/vi.ts`. */
const BUTTON_LABEL = 'Lên đầu trang';

/** Ngưỡng cuộn của nút (khớp `SCROLL_THRESHOLD_PX` trong `ScrollToTop.tsx`). */
const SCROLL_THRESHOLD_PX = 400;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Hai hình chữ nhật có GIAO nhau không (dùng để chứng minh nút không đè thanh điều hướng). */
function intersects(a: Rect, b: Rect): boolean {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

test('nút "lên đầu trang": ẩn ở đầu trang, hiện khi cuộn, không đè BottomNav', async ({ page }) => {
  mkdirSync(OUTPUTS_DIR, { recursive: true });

  await openKidSession(page);
  await page.goto(LONG_PAGE);
  await expect(page.getByRole('heading', { name: 'Ở sở thú', exact: true })).toBeVisible();

  const button = page.getByRole('button', { name: BUTTON_LABEL });
  const nav = page.getByRole('navigation', { name: 'Sang màn hình học' });

  // ---------------------------------------------------------------------------
  // ① Ở ĐẦU TRANG: nút KHÔNG có trong DOM
  // ---------------------------------------------------------------------------
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(button).toHaveCount(0);

  // ---------------------------------------------------------------------------
  // ② CUỘN QUA NGƯỠNG: nút HIỆN
  // ---------------------------------------------------------------------------
  const scrollable = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }));
  expect(scrollable.scrollHeight - scrollable.innerHeight).toBeGreaterThan(SCROLL_THRESHOLD_PX);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

  await expect(button).toBeVisible();
  await expect(nav).toBeVisible();

  // ---------------------------------------------------------------------------
  // ③ ĐO THẬT bằng getBoundingClientRect() — nút vs. thanh điều hướng vs. khung nhìn
  // ---------------------------------------------------------------------------
  const measured = await page.evaluate(() => {
    const buttonEl = document.querySelector<HTMLElement>('button[aria-label="Lên đầu trang"]');
    const navEl = document.querySelector<HTMLElement>('nav[aria-label="Sang màn hình học"]');
    if (!buttonEl || !navEl) return null;

    const toRect = (el: Element) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        left: r.left,
      };
    };

    return {
      button: toRect(buttonEl),
      nav: toRect(navEl),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      scrollY: window.scrollY,
    };
  });

  expect(measured).not.toBeNull();
  const { button: buttonRect, nav: navRect, viewport, scrollY } = measured!;

  // ④ Nút NẰM TRONG khung nhìn (bé phải chạm tới được).
  expect(buttonRect.top).toBeGreaterThanOrEqual(0);
  expect(buttonRect.left).toBeGreaterThanOrEqual(0);
  expect(buttonRect.bottom).toBeLessThanOrEqual(viewport.height + 0.5);
  expect(buttonRect.right).toBeLessThanOrEqual(viewport.width + 0.5);

  // ⑤ Nút KHÔNG đè `BottomNav` — khẳng định trung tâm của cả bài test này.
  expect(intersects(buttonRect, navRect)).toBe(false);

  // ⑥ Vùng chạm ≥ 64×64 CSS px. Dưới 480px `tokens.css` hạ `--sp-touch` xuống 56px, nên ngưỡng
  //    chung là 56 — bằng đúng sàn mà bài test `BottomNav` dùng. Ở hai viewport lớn hơn phải đạt 64.
  const minTouch = viewport.width < 480 ? 56 : 64;
  expect(buttonRect.width).toBeGreaterThanOrEqual(minTouch);
  expect(buttonRect.height).toBeGreaterThanOrEqual(minTouch);

  // ---------------------------------------------------------------------------
  // ⑦ ẢNH CHỤP — chụp LÚC ĐÃ CUỘN để thấy nút.
  // ---------------------------------------------------------------------------
  const shotPath = join(OUTPUTS_DIR, `scroll-${viewport.width}.png`);
  await page.screenshot({ path: shotPath });

  // Ghi lại số đo để người duyệt đọc được mà không phải mở trình duyệt.
  const reportPath = join(OUTPUTS_DIR, `scroll-${viewport.width}.json`);
  writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        viewport,
        scrollY,
        minTouchExpected: minTouch,
        button: buttonRect,
        bottomNav: navRect,
        overlap: intersects(buttonRect, navRect),
        gapToNavPx: Math.round((navRect.top - buttonRect.bottom) * 100) / 100,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  // In ra log để lượt chạy cũng là một bản ghi.
  // eslint-disable-next-line no-console
  console.log(
    `[scroll-to-top] viewport=${viewport.width}x${viewport.height} ` +
      `button=${Math.round(buttonRect.width)}x${Math.round(buttonRect.height)} ` +
      `@(${Math.round(buttonRect.left)},${Math.round(buttonRect.top)}) ` +
      `navTop=${Math.round(navRect.top)} navBottom=${Math.round(navRect.bottom)} ` +
      `gap=${Math.round(navRect.top - buttonRect.bottom)}px overlap=${intersects(buttonRect, navRect)} ` +
      `scrollY=${Math.round(scrollY)}`,
  );
});
