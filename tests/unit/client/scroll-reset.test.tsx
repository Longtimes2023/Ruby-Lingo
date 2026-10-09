/**
 * RubyLingo — chốt chặn cho việc ĐẶT LẠI VỊ TRÍ CUỘN khi chuyển màn hình.
 *
 * ⭐ VÌ SAO CẦN TEST NÀY (lỗi đã xảy ra thật, không phải phòng xa):
 *   Ứng dụng là SPA nên trình duyệt KHÔNG tự đưa về đầu trang khi đổi màn hình. Đo trên bản
 *   chạy thật: bé cuộn trang chủ đề xuống 665px, bấm vào game của bài 3, và màn hình game mở ra
 *   ở `scrollY = 38` — tiêu đề game (`top = 49`) bị thanh trên cùng (tới `67`) che mất.
 *
 *   Lỗi này ẩn rất kỹ: trình duyệt KẸP vị trí cuộn vào chiều cao trang mới, mà mọi màn hình cũ
 *   đều thấp hơn khung nhìn nên vị trí cuộn bị kẹp về 0. Chỉ màn hình chơi game (cao hơn khung
 *   nhìn 38px) mới đủ đất để lộ ra. Bất kỳ màn hình dài nào thêm sau này cũng sẽ lộ.
 *
 *   Không cổng nào bắt được lỗi này: TypeScript không thấy gì (thiếu một lời gọi hàm là hợp lệ),
 *   eslint không có luật nào cho việc này, `npm run build` xanh, và ảnh chụp một màn hình đơn lẻ
 *   cũng không thấy — phải đi QUA một lần chuyển màn hình từ trang đã cuộn.
 *
 * ⚠️ HAI ĐIỀU PHẢI BIẾT VỀ MÔI TRƯỜNG TEST NÀY (đã trả giá khi viết):
 *   1. `jsdom` KHÔNG cài `history.scrollRestoration`. Hook có guard `in window.history` nên nó
 *      bỏ qua một cách hợp lệ. Muốn kiểm hành vi thật thì phải TỰ CÀI thuộc tính đó trước —
 *      xem `stubScrollRestoration()`. Nếu không, ta đang kiểm jsdom chứ không kiểm hook.
 *   2. Bấm bằng `element.click()` TRẦN KHÔNG đủ: cú bấm gây cập nhật state của React Router, và
 *      ngoài `act()` thì cập nhật đó chưa được áp dụng lúc ta assert. Phải dùng `fireEvent.click`
 *      của thư viện test (nó tự bọc `act`).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useScrollResetOnNavigate } from '@/hooks/useScrollResetOnNavigate.js';

/** Trang thử: gắn hook rồi cho phép điều hướng bằng nút bấm. */
function Probe() {
  useScrollResetOnNavigate();
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate('/b')}>
        sang-b
      </button>
      <button type="button" onClick={() => navigate('/b?tab=2')}>
        sang-b-cung-duong-dan
      </button>
    </>
  );
}

function renderProbe() {
  return render(
    <MemoryRouter initialEntries={['/a']}>
      <Routes>
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Giả lập khả năng mà jsdom thiếu — xem ghi chú (1) ở đầu file. */
function stubScrollRestoration(): void {
  Object.defineProperty(window.history, 'scrollRestoration', {
    value: 'auto',
    writable: true,
    configurable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(window.history, 'scrollRestoration');
});

describe('useScrollResetOnNavigate — SPA không tự đưa về đầu trang', () => {
  it('cuộn về đầu trang ngay khi màn hình được dựng', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    renderProbe();

    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('cuộn về đầu trang khi CHUYỂN sang đường dẫn khác (ca lỗi đã xảy ra thật)', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    renderProbe();
    scrollTo.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'sang-b' }));

    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('KHÔNG cuộn khi chỉ đổi query — vẫn đang ở cùng màn hình', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    renderProbe();
    fireEvent.click(screen.getByRole('button', { name: 'sang-b' }));
    scrollTo.mockClear();

    // Cùng `pathname`, chỉ khác query ⇒ bé đang lọc/xem trong cùng màn hình, không được nhảy.
    fireEvent.click(screen.getByRole('button', { name: 'sang-b-cung-duong-dan' }));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('tắt cơ chế khôi phục vị trí cuộn của trình duyệt để chỉ còn MỘT nguồn quyết định', () => {
    // Không tắt thì trình duyệt và hook cùng tranh nhau: hook cuộn về 0 rồi trình duyệt khôi
    // phục về chỗ cũ (hoặc ngược lại) ⇒ lúc đúng lúc sai, tuỳ thứ tự và thời điểm.
    stubScrollRestoration();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    renderProbe();

    expect(window.history.scrollRestoration).toBe('manual');
  });

  it('không nổ khi trình duyệt KHÔNG có `scrollRestoration` (guard phòng vệ)', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    // Cố tình KHÔNG gọi `stubScrollRestoration()` — giống Safari cũ / trình duyệt nhúng.
    expect('scrollRestoration' in window.history).toBe(false);

    // Điều duy nhất cần: hook vẫn chạy và vẫn cuộn, không ném lỗi.
    expect(() => renderProbe()).not.toThrow();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
