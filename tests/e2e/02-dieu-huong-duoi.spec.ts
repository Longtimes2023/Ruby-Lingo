/**
 * RubyLingo — E2E ②: thanh điều hướng dưới (`BottomNav`) — màn bé dùng mỗi ngày.
 *
 * ⭐ BÀI NÀY CHẶN LỖI GÌ:
 *   1. **Số mục của `BottomNav` trôi khỏi 5.** 5 là TRẦN của dự án (xem chú thích đầu
 *      `BottomNav.tsx`): mục thứ sáu đẩy bề rộng mỗi mục trên màn 320–360px xuống dưới vùng
 *      chạm tối thiểu cho tay trẻ. Unit test đọc được mảng `ITEMS`; ở đây ta đếm trên DOM ĐÃ
 *      RENDER trong trình duyệt thật, nơi một mục bị ẩn bằng CSS vẫn lộ ra.
 *   2. **Vùng chạm nhỏ hơn quy ước.** Bé 7 tuổi nhắm trượt một mục cao 40px. Ta ĐO chiều cao
 *      thật của từng mục (đơn vị px thật của trình duyệt), không suy luận từ tên class.
 *   3. **Mục "đang mở" không được đánh dấu.** `NavLink` phải đặt `aria-current="page"` — nếu
 *      không, trình đọc màn hình không biết bé đang ở đâu, và ta mất tín hiệu "đang ở đâu" khi
 *      màu sắc bị bạc (màn hình ngoài nắng).
 *   4. **Điều hướng thật gãy.** Bấm mục phải đổi URL VÀ render ra màn đích — nếu chỉ đổi URL mà
 *      nội dung trắng, đó là lỗi mà unit test (không có router thật) không thấy.
 *
 * ⚠️ LƯU Ý VỀ NHÃN: mỗi mục có HAI nhãn — nhãn HIỂN THỊ ngắn ("Bố mẹ") và nhãn ĐỌC đầy đủ
 *   (`aria-label` = "Sang khu vực phụ huynh"). `getByRole(..., { name })` khớp theo tên trợ năng,
 *   tức là nhãn ĐỌC; còn nhãn hiển thị phải tìm bằng `getByText`. Bài test kiểm cả hai để chắc
 *   rằng không nhãn nào bị mất.
 */

import { expect, test } from '@playwright/test';

import { openKidSession } from './helpers/session.js';

/** Năm mục của `BottomNav`, theo đúng thứ tự hiển thị. */
const NAV_ITEMS = [
  { aria: 'Sang màn hình học', label: 'Học', url: /\/$/, heading: 'Chào Bin E2E!' },
  { aria: 'Sang màn hình nhiệm vụ', label: 'Nhiệm vụ', url: /\/quests$/, heading: 'Nhiệm vụ' },
  { aria: 'Sang nhà thú cưng', label: 'Thú cưng', url: /\/pet$/, heading: 'Nhà thú cưng' },
  { aria: 'Sang bộ sưu tập', label: 'Bộ sưu tập', url: /\/collection$/, heading: 'Bộ sưu tập' },
  {
    aria: 'Sang khu vực phụ huynh',
    label: 'Bố mẹ',
    url: /\/parent$/,
    heading: 'Khu vực phụ huynh',
  },
] as const;

test('thanh điều hướng dưới có đúng 5 mục và điều hướng thật', async ({ page }) => {
  await openKidSession(page);

  // Tìm đúng thanh điều hướng của bé bằng nhãn đọc của nó (chỉ có MỘT `<nav>` trong app).
  const nav = page.getByRole('navigation', { name: 'Sang màn hình học' });
  await expect(nav).toBeVisible();

  // --- ① Đúng 5 mục --------------------------------------------------------
  await expect(nav.getByRole('link')).toHaveCount(NAV_ITEMS.length);

  // --- ② Nhãn hiển thị đúng như thiết kế ----------------------------------
  for (const item of NAV_ITEMS) {
    await expect(nav.getByText(item.label, { exact: true })).toBeVisible();
  }

  // --- ③ Vùng chạm đủ lớn --------------------------------------------------
  // ⚠️ Ngưỡng 56px, KHÔNG phải 64px: `tokens.css` hạ `--sp-touch` xuống 56px dưới 480px (điện
  //    thoại) — đó là sàn thật của dự án. Lấy 56 làm ngưỡng chung cho cả ba viewport.
  for (const item of NAV_ITEMS) {
    const box = await nav.getByRole('link', { name: item.aria }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(56);
  }

  // --- ④ Điều hướng thật + mục đang mở được đánh dấu ----------------------
  for (const item of NAV_ITEMS) {
    const link = nav.getByRole('link', { name: item.aria });
    await link.click();

    await expect(page).toHaveURL(item.url);
    await expect(link).toHaveAttribute('aria-current', 'page');
    // Màn đích phải render THẬT — dùng `exact` để "Nhiệm vụ" không khớp nhầm "Nhiệm vụ hôm nay".
    await expect(page.getByRole('heading', { name: item.heading, exact: true })).toBeVisible();
  }
});
