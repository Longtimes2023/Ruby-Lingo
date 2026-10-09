/**
 * RubyLingo — trợ giúp dùng chung cho các bài test end-to-end.
 *
 * ⭐ VÌ SAO GOM VIỆC "ĐĂNG KÝ + TẠO HỒ SƠ BÉ" VÀO MỘT HÀM:
 *   Đây là ĐOẠN ĐƯỜNG VÀO của mọi bài test (không có phụ huynh + bé thì không màn nào của bé
 *   mở được). Nếu mỗi bài tự chép lại chuỗi thao tác này, chỉ cần form đăng ký đổi một nhãn là
 *   N bài cùng đỏ, và không ai biết bài nào thật sự hỏng. Một hàm ⇒ một chỗ phải sửa.
 *
 * ⚠️ MỖI BÀI DÙNG MỘT TÀI KHOẢN RIÊNG (`uniqueEmail`). Nhờ vậy các bài ĐỘC LẬP: chạy riêng
 *   từng bài, chạy cả bộ, hay chạy lại đều cho cùng kết quả — không bài nào phụ thuộc vào thứ
 *   tự hay vào dữ liệu bài khác để lại.
 */

import { expect, type Page } from '@playwright/test';

/** Mật khẩu dùng chung cho tài khoản e2e — chỉ sống trong DB e2e tạm. */
export const E2E_PASSWORD = 'MatKhauE2e123';

/** Bộ đếm để hai lần gọi trong CÙNG một mili-giây vẫn ra hai email khác nhau. */
let sequence = 0;

/** Sinh email duy nhất cho mỗi lần đăng ký — tránh đụng `emailTaken` khi chạy lại. */
export function uniqueEmail(): string {
  sequence += 1;
  const stamp = `${Date.now()}-${sequence}-${Math.random().toString(36).slice(2, 8)}`;
  return `phuhuynh.e2e.${stamp}@vidu.test`;
}

/**
 * Đăng ký một tài khoản phụ huynh qua ĐÚNG giao diện thật (không gọi thẳng API).
 *
 * ⭐ VÌ SAO PHẢI ĐI QUA GIAO DIỆN: cả bài test tồn tại để chứng minh luồng HTTP thật hoạt động —
 *   cookie phiên `httpOnly` được set, `RedirectIfAuthenticated` chuyển trang đúng, và màn mã
 *   khôi phục hiện ra. Gọi thẳng `POST /api/auth/signup` sẽ bỏ qua toàn bộ những thứ đó và biến
 *   bài test thành một bản sao của unit test.
 *
 * ⚠️ BƯỚC "TÔI ĐÃ LƯU RỒI" LÀ BẮT BUỘC, KHÔNG PHẢI CHỜ CHO ĐẸP:
 *   `SignupPage` cố ý KHÔNG nạp phiên ngay sau khi tạo tài khoản — mã khôi phục chỉ hiện MỘT
 *   LẦN, và `RedirectIfAuthenticated` sẽ đá phụ huynh đi trước khi họ đọc được nếu ta nạp phiên
 *   sớm. Chỉ sau cú bấm xác nhận thì phiên mới được nạp và trang mới chuyển sang `/children/new`.
 */
export async function signUpParent(page: Page, email: string): Promise<void> {
  await page.goto('/signup');

  await page.getByLabel('Email của bố mẹ').fill(email);
  await page.getByLabel('Mật khẩu').fill(E2E_PASSWORD);
  await page.getByLabel('Tên hiển thị (không bắt buộc)').fill('Bố mẹ E2E');

  // Đồng ý của phụ huynh là BẮT BUỘC (COPPA/GDPR-K) — không tick thì server từ chối.
  await page.getByRole('checkbox').check();

  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();

  // Bước 2: mã khôi phục. Assertion TỰ CHỜ — không `waitForTimeout`.
  await expect(page.getByRole('heading', { name: 'Lưu lại mã khôi phục này' })).toBeVisible();

  await page.getByRole('button', { name: 'Tôi đã lưu rồi' }).click();
}

/**
 * Tạo hồ sơ bé trên màn `/children/new` và đợi về bản đồ hành trình.
 *
 * ⭐ CHỌN MỘT TUỔI VÀ MỘT AVATAR KHÁC MẶC ĐỊNH: mặc định của form là tuổi 7 và avatar đầu tiên
 *   (`Cáo con`). Nếu bài test chỉ bấm "Gửi", nó sẽ KHÔNG chứng minh được hai bộ chọn này thật sự
 *   ghi giá trị — mà đó chính là phần tương tác chạm của bé. Bấm vào `9` và `Sư tử con` mới
 *   chứng minh được.
 */
export async function createChild(page: Page, nickname: string): Promise<void> {
  await expect(page).toHaveURL(/\/children\/new$/);

  await page.getByLabel('Biệt danh của bé').fill(nickname);
  // Tuổi là các nút to (không phải ô nhập số) — bấm đúng như bé sẽ bấm.
  await page.getByRole('button', { name: '9', exact: true }).click();
  // Avatar nhận diện bằng `aria-label` = tên tiếng Việt của bạn đồng hành.
  await page.getByRole('button', { name: 'Sư tử con' }).click();

  await page.getByRole('button', { name: 'Vào Nhà Vườn Thú!' }).click();
}

/**
 * Đưa trình duyệt tới trạng thái "đã đăng nhập VÀ đã có bé", dừng ở bản đồ hành trình `/`.
 *
 * Đây là điểm xuất phát của mọi bài test về màn hình của bé.
 */
export async function openKidSession(page: Page, nickname = 'Bin E2E'): Promise<void> {
  await signUpParent(page, uniqueEmail());
  await createChild(page, nickname);

  // Về tới bản đồ hành trình và màn hình đã render thật (không phải màn trắng).
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: `Chào ${nickname}!` })).toBeVisible();
}
