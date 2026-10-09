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
 *   5. **(T04) Màn CHỌN BẠN ĐỒNG HÀNH không mở ra được.** Bé mới chưa từng chọn con phải được
 *      MỜI chọn, và chọn xong phải về được nhà thú cưng. Đây là tầng DUY NHẤT chạm được luồng
 *      đó bằng HTTP + router thật.
 *
 * ⚠️ LƯU Ý VỀ NHÃN: mỗi mục có HAI nhãn — nhãn HIỂN THỊ ngắn ("Bố mẹ") và nhãn ĐỌC đầy đủ
 *   (`aria-label` = "Sang khu vực phụ huynh"). `getByRole(..., { name })` khớp theo tên trợ năng,
 *   tức là nhãn ĐỌC; còn nhãn hiển thị phải tìm bằng `getByText`. Bài test kiểm cả hai để chắc
 *   rằng không nhãn nào bị mất.
 *
 * ⚠️⚠️ MỤC "THÚ CƯNG" ĐI ĐƯỜNG KHÁC BỐN MỤC CÒN LẠI — ĐỌC TRƯỚC KHI "GỘP LẠI CHO GỌN":
 *   Từ T04, một bé CHƯA từng chọn con (`petChosen === false`) mà vào `/pet` sẽ được
 *   `PetHousePage` tự chuyển sang `/pet/chon`. Đó là hành vi CÓ CHỦ Ý — chủ dự án báo đúng:
 *   *"Thú cưng không cho các bé chọn à, mặc định là trứng"* — nên lần đầu vào nhà phải là một
 *   LỜI MỜI CHỌN, không phải một con vật bé chưa hề chọn. Vì vậy mục này KHÔNG nằm trong vòng
 *   lặp của bốn mục kia: nó có thêm một bước, và bài test phải đi qua bước đó.
 *
 *   ⚠️ Nếu một ngày ai đó "sửa" cho `/pet` hiện thẳng nhà thú cưng với bé mới, bài test này sẽ
 *      đỏ ở dòng `toHaveURL(/\/pet\/chon$/)` — và đó là điều đúng, vì nó báo rằng lời mời chọn
 *      con đã biến mất.
 */

import { expect, test } from '@playwright/test';

import { openKidSession } from './helpers/session.js';

/**
 * Bốn mục đi THẲNG tới màn đích của mình, theo đúng thứ tự hiển thị.
 *
 * ⚠️ "Thú cưng" không nằm ở đây — xem `PET_ITEM` và ghi chú đầu tệp.
 */
const NAV_ITEMS = [
  { aria: 'Sang màn hình học', label: 'Học', url: /\/$/, heading: 'Chào Bin E2E!' },
  { aria: 'Sang màn hình nhiệm vụ', label: 'Nhiệm vụ', url: /\/quests$/, heading: 'Nhiệm vụ' },
  { aria: 'Sang bộ sưu tập', label: 'Bộ sưu tập', url: /\/collection$/, heading: 'Bộ sưu tập' },
  {
    aria: 'Sang khu vực phụ huynh',
    label: 'Bố mẹ',
    url: /\/parent$/,
    heading: 'Khu vực phụ huynh',
  },
] as const;

/** Mục "Thú cưng" — tách riêng vì đường đi của nó có thêm bước chọn con (T04). */
const PET_ITEM = { aria: 'Sang nhà thú cưng', label: 'Thú cưng' } as const;

/** Tổng số mục của `BottomNav` — 5 là TRẦN của dự án, không phải một con số tuỳ ý. */
const NAV_COUNT = NAV_ITEMS.length + 1;

test('thanh điều hướng dưới có đúng 5 mục và điều hướng thật', async ({ page }) => {
  await openKidSession(page);

  // Tìm đúng thanh điều hướng của bé bằng nhãn đọc của nó (chỉ có MỘT `<nav>` trong app).
  const nav = page.getByRole('navigation', { name: 'Sang màn hình học' });
  await expect(nav).toBeVisible();

  // --- ① Đúng 5 mục --------------------------------------------------------
  await expect(nav.getByRole('link')).toHaveCount(NAV_COUNT);

  // --- ② Nhãn hiển thị đúng như thiết kế ----------------------------------
  for (const item of [...NAV_ITEMS, PET_ITEM]) {
    await expect(nav.getByText(item.label, { exact: true })).toBeVisible();
  }

  // --- ③ Vùng chạm đủ lớn --------------------------------------------------
  // ⚠️ Ngưỡng 56px, KHÔNG phải 64px: `tokens.css` hạ `--sp-touch` xuống 56px dưới 480px (điện
  //    thoại) — đó là sàn thật của dự án. Lấy 56 làm ngưỡng chung cho cả ba viewport.
  for (const item of [...NAV_ITEMS, PET_ITEM]) {
    const box = await nav.getByRole('link', { name: item.aria }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(56);
  }

  // --- ④ Bốn mục đi thẳng: điều hướng thật + mục đang mở được đánh dấu -----
  for (const item of NAV_ITEMS) {
    const link = nav.getByRole('link', { name: item.aria });
    await link.click();

    await expect(page).toHaveURL(item.url);
    await expect(link).toHaveAttribute('aria-current', 'page');
    // Màn đích phải render THẬT — dùng `exact` để "Nhiệm vụ" không khớp nhầm "Nhiệm vụ hôm nay".
    await expect(page.getByRole('heading', { name: item.heading, exact: true })).toBeVisible();
  }

  // --- ⑤ Thú cưng: bé MỚI được MỜI CHỌN CON trước, rồi mới vào nhà ---------
  const petLink = nav.getByRole('link', { name: PET_ITEM.aria });
  await petLink.click();

  // Bé vừa tạo hồ sơ chưa từng chọn con ⇒ `/pet` tự mở màn chọn. Xem ghi chú đầu tệp.
  await expect(page).toHaveURL(/\/pet\/chon$/);
  await expect(
    page.getByRole('heading', { name: 'Chọn bạn đồng hành', exact: true }),
  ).toBeVisible();

  // Lưới sáu thẻ, và ĐÚNG MỘT thẻ đang được chọn (`aria-pressed`) — mặc định là con hiện tại.
  // ⚠️ Tìm qua `role="group"` có nhãn, KHÔNG `getByRole('button')` trần: trên màn còn nút loa
  //    của thanh trên, và một `getByRole` trần sẽ đếm lẫn nó.
  const grid = page.getByRole('group', { name: 'Các bạn đồng hành để bé chọn' });
  await expect(grid.getByRole('button')).toHaveCount(6);
  await expect(grid.getByRole('button', { pressed: true })).toHaveCount(1);

  // Bé chọn "Mèo Miu" — thao tác thật, không gọi API.
  const catCard = grid.getByRole('button', { name: 'Mèo Miu' });
  await catCard.click();
  await expect(catCard).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Chọn bạn này!' }).click();

  // Về nhà thú cưng, render THẬT, và tên con bé VỪA CHỌN phải hiện ra.
  // ⚠️ Không còn `aria-current` trên `/pet/chon` để mà kiểm — chỉ kiểm sau khi đã về `/pet`.
  await expect(page).toHaveURL(/\/pet$/);
  await expect(page.getByRole('heading', { name: 'Nhà thú cưng', exact: true })).toBeVisible();
  await expect(petLink).toHaveAttribute('aria-current', 'page');

  // ⭐ Tên con vật nay lấy từ `shared/content/pets.json` (`petNameVi`), KHÔNG phải hằng số
  //   `pet.name` = "Momo" như trước T04. Đây là khẳng định chống hồi quy cho đúng điểm đó:
  //   bé chọn Mèo thì nhãn phải nói "Mèo Miu".
  await expect(page.getByText('Mèo Miu', { exact: true }).first()).toBeVisible();
});
