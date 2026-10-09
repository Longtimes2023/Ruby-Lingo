/**
 * RubyLingo — E2E ①: đường vào của bé, từ số 0.
 *
 *   Đăng ký tài khoản phụ huynh → xác nhận đã lưu mã khôi phục → tạo hồ sơ bé → bản đồ hành trình.
 *
 * ⭐ BÀI NÀY CHẶN LỖI GÌ (mà unit test KHÔNG chặn được):
 *   1. **Cookie phiên `httpOnly` không được set.** jsdom không có cookie thật, nên unit test
 *      không bao giờ đi qua bước này. Nếu `@fastify/cookie` bị tháo khỏi `securityPlugin`, đăng
 *      ký vẫn trả 201 nhưng mọi request sau đó là ẩn danh — và ta chỉ thấy nó ở đây.
 *   2. **Guard định tuyến dựng sai.** Sau khi tạo bé, `RequireChild` phải cho vào `/`. Nếu thứ
 *      tự/nhánh guard sai, bé rơi vào vòng lặp chuyển trang hoặc màn trắng.
 *   3. **Bản đồ không render dữ liệu thật.** Số chủ đề và dải tóm tắt tiến độ đến từ dữ liệu nội
 *      dung + tiến độ đọc từ server. Chỉ ở trình duyệt thật ta mới biết cả hai có tới nơi.
 */

import { expect, test } from '@playwright/test';

import { createChild, signUpParent, uniqueEmail } from './helpers/session.js';

test('đăng ký → tạo hồ sơ bé → vào được bản đồ hành trình', async ({ page }) => {
  const nickname = 'Bin E2E';

  // --- Bước 1: đăng ký phụ huynh ------------------------------------------
  await signUpParent(page, uniqueEmail());

  // --- Bước 2: tạo hồ sơ bé ------------------------------------------------
  await createChild(page, nickname);

  // --- Bước 3: bản đồ hành trình phải render THẬT -------------------------
  // Thẻ chào gọi đúng tên bé vừa tạo ⇒ hồ sơ đã được ghi ở server và đọc lại được.
  await expect(page.getByRole('heading', { name: `Chào ${nickname}!` })).toBeVisible();

  // Dải tóm tắt tiến độ: số từ đến từ `progressStore` SAU khi nạp xong từ server. Nếu tầng đồng
  // bộ/đọc tiến độ hỏng, dải này không bao giờ hiện (nó bị chặn sau cờ `isHydrated`).
  await expect(page.getByText(/Bé đã học \d+\/\d+ từ/)).toBeVisible();

  // Đủ 11 chủ đề của cấp Starters ⇒ registry nội dung (`import.meta.glob`) nạp đúng trong bản build.
  await expect(page.getByText('11 chủ đề')).toBeVisible();

  // Chủ đề đầu tiên (`at-the-zoo`) MỞ ⇒ thẻ của nó là một liên kết thật, bấm được.
  await expect(page.getByRole('link', { name: 'Vào chủ đề Ở sở thú' })).toBeVisible();

  /**
   * ⚠️ MÀN HÌNH CỦA BÉ KHÔNG ĐƯỢC CÓ LỐI THOÁT DÀNH CHO NGƯỜI LỚN.
   *
   *   Có test unit đang canh điều này trên cây component; ở đây ta canh nó trên DOM ĐÃ RENDER
   *   THẬT — nơi một `<Link to="/children/new">` lọt vào qua một component con, hay một nhãn
   *   "Đăng xuất" sót lại, sẽ lộ ra. Lối vào khu phụ huynh phải đi qua mục ⚙️ "Bố mẹ" (có cổng
   *   PIN), không phải một liên kết trần trên màn hình bé.
   */
  await expect(page.locator('a[href="/children/new"]')).toHaveCount(0);
  await expect(page.getByText('Đăng xuất')).toHaveCount(0);
});
