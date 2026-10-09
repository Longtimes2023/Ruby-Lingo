/**
 * RubyLingo — cờ "bé đã bấm Để sau ở màn chọn bạn đồng hành trong PHIÊN này" (T04).
 *
 * ⭐ VÌ SAO NẰM RIÊNG MỘT TỆP, KHÔNG TRONG `ChoosePetPage.tsx`:
 *   Cờ này có HAI người dùng — `ChoosePetPage` (ghi khi bé bấm "Để sau") và `PetHousePage` (đọc
 *   trong `useEffect` để quyết định có tự mở màn chọn hay không). Nếu cả hai tự khai khoá riêng,
 *   chỉ cần một chỗ gõ sai là bé bị hỏi lại mỗi lần quay về `/pet`, và không có lỗi nào nổi lên.
 *   Để hai chỗ đọc CÙNG một khoá, khoá phải sống ở một tệp dùng chung.
 *
 * ⚠️ VÌ SAO KHÔNG ĐỂ HÀM NÀY TRONG `ChoosePetPage.tsx`:
 *   `ChoosePetPage.tsx` đã export một component. Trộn thêm hàm thường vào cùng tệp làm
 *   `react-refresh/only-export-components` cảnh báo (Fast Refresh không thể cập nhật nóng một tệp
 *   vừa có component vừa có hàm). Tách ra vừa hết cảnh báo, vừa đúng chỗ hơn về mặt ý nghĩa.
 *
 * ⚠️ `sessionStorage`, KHÔNG `localStorage`:
 *   Đây là "đừng hỏi lại trong PHIÊN này", không phải một cài đặt vĩnh viễn của bé. Ghi vào
 *   `localStorage` là biến một cú bấm "Để sau" thành "không bao giờ hỏi lại" — bé 7 tuổi có thể đã
 *   đổi ý, và lần sau mở app bé phải được mời chọn lại.
 */

/** Khoá lưu cờ. Xuất ra để test và hai màn dùng chung đúng một chuỗi. */
export const PET_CHOOSE_SKIP_KEY = 'rubylingo.pet.chooseSkipped';

/**
 * Ghi cờ "đừng hỏi lại trong phiên này".
 *
 * ⚠️ BỌC `try`: `sessionStorage` có thể không tồn tại hoặc bị chặn (chế độ riêng tư, cấu hình
 *    trình duyệt). Một lần ném ở đây — ngay trong `onClick` — là màn trắng của bé. Cái mất khi
 *    nuốt lỗi chỉ là "không nhớ đã bỏ qua", và bé sẽ được mời chọn lại: chấp nhận được.
 */
export function markPetChooseSkipped(): void {
  try {
    sessionStorage.setItem(PET_CHOOSE_SKIP_KEY, '1');
  } catch {
    // Không lưu được thì thôi — xem ghi chú trên.
  }
}

/**
 * Bé đã bấm "Để sau" trong phiên này chưa.
 *
 * ⚠️ ĐỌC ĐƯỢC GỌI TRONG `useEffect` (không phải lúc render) — xem `PetHousePage`. Bọc `try` vì
 *    cùng lý do như `markPetChooseSkipped`: một lần ném ở đây là màn trắng.
 */
export function wasPetChooseSkipped(): boolean {
  try {
    return sessionStorage.getItem(PET_CHOOSE_SKIP_KEY) === '1';
  } catch {
    return false;
  }
}
