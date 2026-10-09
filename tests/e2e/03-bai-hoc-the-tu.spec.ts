/**
 * RubyLingo — E2E ③: đi sâu vào việc học — mở chủ đề rồi hoàn thành một bài thẻ từ.
 *
 *   Bản đồ `/` → chủ đề `/theme/at-the-zoo` → bài học `/lesson/at-the-zoo%2Fz1/flashcards` → xong.
 *
 * ⭐ BÀI NÀY CHẶN LỖI GÌ:
 *   1. **`lessonId` chứa dấu `/` không được mã hoá.** `at-the-zoo/z1` phải thành
 *      `at-the-zoo%2Fz1` trong URL, nếu không `react-router` tách thành hai đoạn và route
 *      `/lesson/:lessonId/flashcards` KHÔNG BAO GIỜ khớp — bé bấm "Thẻ từ vựng" và thấy màn trắng.
 *      Không có lỗi biên dịch nào báo việc này (xem `lib/paths.ts`).
 *   2. **Nội dung học không tới được trình duyệt.** Số từ của bài (7) đến từ registry nội dung
 *      (`import.meta.glob`) đã đóng gói vào bản build. Đếm được đúng 7 thẻ mới chứng minh chuỗi
 *      "JSON → bundle → render" còn nguyên.
 *   3. **Nút điều hướng thẻ không chạy.** Chuỗi "Tiếp" → "Xong rồi!" là tương tác CHÍNH của việc
 *      học. Chỉ trình duyệt thật mới kiểm được nó, vì `usePointer`/sự kiện con trỏ không có trong
 *      jsdom theo cách trung thực.
 */

import { expect, test } from '@playwright/test';

import { openKidSession } from './helpers/session.js';

test('mở một chủ đề và hoàn thành một bài học thẻ từ', async ({ page }) => {
  await openKidSession(page);

  // --- ① Mở chủ đề `at-the-zoo` (chủ đề duy nhất đang mở ở giai đoạn này) ---
  await page.getByRole('link', { name: 'Vào chủ đề Ở sở thú' }).click();
  await expect(page).toHaveURL(/\/theme\/at-the-zoo$/);
  await expect(page.getByRole('heading', { name: 'Ở sở thú', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Các bài học', exact: true })).toBeVisible();

  // --- ② Vào bài học đầu tiên ---------------------------------------------
  await page.getByRole('link', { name: 'Thẻ từ vựng' }).first().click();
  // `%2F` là dấu `/` đã mã hoá trong `lessonId` — chính là điều mục ① ở đầu tệp nói tới.
  await expect(page).toHaveURL(/\/lesson\/at-the-zoo(%2F|\/)z1\/flashcards$/);
  await expect(
    page.getByRole('heading', { name: 'Động vật hoang dã to lớn', exact: true }),
  ).toBeVisible();

  /**
   * ⚠️ PHẢI TÌM THANH TIẾN ĐỘ THEO NHÃN ĐỌC, KHÔNG phải `getByRole('progressbar')` trần.
   *   Trên màn này có HAI `progressbar`: thanh XP 4px trong `TopBar` và chấm tiến độ của thẻ.
   *   Lấy trần sẽ vi phạm chế độ strict của Playwright. Nhãn "Thẻ N trên M" là duy nhất.
   */
  const cardProgress = page.getByRole('progressbar', { name: /^Thẻ \d+ trên \d+$/ });
  await expect(cardProgress).toHaveAttribute('aria-valuetext', 'Thẻ 1 trên 7');

  const total = Number(await cardProgress.getAttribute('aria-valuemax'));
  expect(total).toBe(7);

  // --- ③ Lật hết thẻ rồi kết thúc bài -------------------------------------
  for (let index = 1; index < total; index += 1) {
    await page.getByRole('button', { name: 'Tiếp', exact: true }).click();
    // Chốt lại rằng lượt lật đã được ghi nhận TRƯỚC khi bấm tiếp — không dựa vào may rủi về
    // thời điểm render. `aria-valuenow` là chỉ số thẻ (0-based), nên sau `index` lần lật là `index`.
    await expect(cardProgress).toHaveAttribute('aria-valuenow', String(index));
  }

  await page.getByRole('button', { name: 'Xong rồi!', exact: true }).click();

  // --- ④ Màn chúc mừng ----------------------------------------------------
  await expect(
    page.getByRole('heading', { name: 'Bé học xong bài rồi!', exact: true }),
  ).toBeVisible();
});
