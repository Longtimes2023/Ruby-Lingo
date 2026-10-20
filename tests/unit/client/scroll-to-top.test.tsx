/**
 * RubyLingo — test cho nút nổi "lên đầu trang" (`ScrollToTop`).
 *
 * ⭐ BÀI NÀY CHẶN GÌ (mỗi khẳng định ứng với một yêu cầu của chủ dự án):
 *   1. **Ở đầu trang thì nút KHÔNG có trong DOM.** Nút nổi là thứ dễ bấm nhầm nhất với tay trẻ;
 *      nếu nó lỡ hiện sẵn ở đầu trang thì mọi cú chạm lệch đều trúng nó.
 *   2. **Cuộn qua ngưỡng thì nút HIỆN.** Nếu không, cả tính năng vô dụng.
 *   3. **Bấm nút ⇒ `window.scrollTo({ top: 0 })`.** Đúng hành vi mong đợi của chủ dự án.
 *   4. **Bật "giảm chuyển động" ⇒ `behavior` KHÔNG phải `'smooth'`.** Bé nhạy cảm với chuyển
 *      động đã bật cài đặt hệ điều hành thì một cú cuộn mượt dài hàng nghìn px là thứ bé cần
 *      tránh — xem ghi chú đầu `ScrollToTop.tsx`.
 *   5. **Gỡ listener khi unmount.** Không gỡ thì trình nghe giữ cả cây component sống mãi và mỗi
 *      lần cuộn lại gọi `setState` lên một component đã chết.
 *
 * ⚠️⚠️ VÌ SAO KHÔNG KHẲNG ĐỊNH TOẠ ĐỘ Ở ĐÂY:
 *   jsdom KHÔNG có layout — `getBoundingClientRect()` LUÔN trả về 0 cho mọi phần tử. Một khẳng
 *   định kiểu `expect(rect.top).toBeGreaterThan(0)` ở đây sẽ XANH GIẢ (luôn đúng vì mọi số đều
 *   0, hoặc luôn đỏ vì không có layout thật). Việc đo "nút không đè `BottomNav`" PHẢI làm trên
 *   trình duyệt thật (Playwright) — xem `tests/e2e/05-nut-len-dau-trang.spec.ts`.
 *
 * ⚠️ jsdom không cài `matchMedia` đầy đủ. Ta TỰ đặt nó theo từng ca để kiểm được cả hai nhánh
 *    `prefers-reduced-motion` — nếu để mặc định thì chỉ kiểm được một nhánh và cái còn lại lọt.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import { SCROLL_THRESHOLD_PX, ScrollToTop } from '@/components/common/ScrollToTop.js';

/** Nhãn đọc của nút — khớp `nav.scrollToTop` trong `src/i18n/vi.ts`. */
const LABEL = 'Lên đầu trang';

/**
 * Đặt `window.scrollY` — jsdom luôn trả 0 và không cho gán thẳng, phải qua `defineProperty`.
 * (Cùng cách làm đã dùng ở `scroll-reset.test.tsx`.)
 */
function stubScrollY(value: number): void {
  Object.defineProperty(window, 'scrollY', { value, writable: true, configurable: true });
}

/**
 * Đặt `window.matchMedia` trả về kết quả mong muốn cho truy vấn `prefers-reduced-motion`.
 *
 * ⚠️ Không truyền tham số thứ hai thì trả `matches: false` — đúng mặc định của trình duyệt khi bé
 *    KHÔNG bật giảm chuyển động. Nhờ vậy ca "cuộn mượt" cũng kiểm được trên một `matchMedia` thật
 *    (thay vì dựa vào việc jsdom thiếu hẳn hàm này).
 */
function stubMatchMedia(reducedMotion: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/** Có phần tử nào mang nhãn đọc của nút không. */
function queryButton(): HTMLElement | null {
  return screen.queryByRole('button', { name: LABEL });
}

beforeEach(() => {
  // Mặc định: ở đầu trang, không bật giảm chuyển động. Từng ca tự đổi nếu cần.
  stubScrollY(0);
  stubMatchMedia(false);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, 'scrollY');
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('ScrollToTop — ẩn/hiện theo vị trí cuộn', () => {
  it('ở đầu trang (scrollY = 0) ⇒ nút KHÔNG có trong DOM', () => {
    render(<ScrollToTop />);

    expect(queryButton()).not.toBeInTheDocument();
  });

  it(`chưa qua ngưỡng (scrollY = ${SCROLL_THRESHOLD_PX}) ⇒ vẫn KHÔNG hiện (dùng ">", không ">=")`, () => {
    render(<ScrollToTop />);

    stubScrollY(SCROLL_THRESHOLD_PX);
    fireEvent.scroll(window);

    expect(queryButton()).not.toBeInTheDocument();
  });

  it(`cuộn qua ngưỡng (scrollY = ${SCROLL_THRESHOLD_PX + 1}) ⇒ nút HIỆN`, () => {
    render(<ScrollToTop />);

    stubScrollY(SCROLL_THRESHOLD_PX + 1);
    fireEvent.scroll(window);

    expect(queryButton()).toBeInTheDocument();
  });

  it('cuộn xuống rồi về lại đầu trang ⇒ nút ẨN LẠI', () => {
    render(<ScrollToTop />);

    stubScrollY(1000);
    fireEvent.scroll(window);
    expect(queryButton()).toBeInTheDocument();

    stubScrollY(0);
    fireEvent.scroll(window);
    expect(queryButton()).not.toBeInTheDocument();
  });

  it('⚠️ khôi phục vị trí cuộn LÚC GẮN (không có sự kiện scroll) ⇒ nút vẫn hiện đúng', () => {
    // `useScrollResetOnNavigate` có thể đặt lại vị trí cuộn TRƯỚC khi component gắn, và lúc đó
    // không có sự kiện `scroll` nào phát ra. Nếu chỉ dựa vào listener, nút sẽ không hiện dù bé
    // đang ở lưng chừng trang.
    stubScrollY(1200);
    render(<ScrollToTop />);

    expect(queryButton()).toBeInTheDocument();
  });
});

describe('ScrollToTop — bấm nút', () => {
  it('bấm nút ⇒ gọi `window.scrollTo` với `top: 0`', () => {
    stubScrollY(1000);
    render(<ScrollToTop />);

    fireEvent.click(queryButton()!);

    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
  });

  it('KHÔNG bật giảm chuyển động ⇒ `behavior: "smooth"`', () => {
    stubMatchMedia(false);
    stubScrollY(1000);
    render(<ScrollToTop />);

    fireEvent.click(queryButton()!);

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('⚠️ BẬT "giảm chuyển động" ⇒ `behavior` KHÔNG phải `"smooth"` (nhảy tức thì)', () => {
    stubMatchMedia(true);
    stubScrollY(1000);
    render(<ScrollToTop />);

    fireEvent.click(queryButton()!);

    const options = vi.mocked(window.scrollTo).mock.calls[0]?.[0] as ScrollToOptions | undefined;
    expect(options).toBeDefined();
    expect(options?.behavior).not.toBe('smooth');
    expect(options?.top).toBe(0);
  });

  it('nút là `<button type="button">` — KHÔNG phải liên kết `href="#"`', () => {
    stubScrollY(1000);
    render(<ScrollToTop />);

    const button = queryButton()!;
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
  });
});

describe('ScrollToTop — vòng đời listener', () => {
  it('gắn listener `scroll` ở chế độ bị động (passive)', () => {
    const add = vi.spyOn(window, 'addEventListener');

    render(<ScrollToTop />);

    expect(add).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
  });

  it('⚠️ GỠ listener khi unmount (không để rò rỉ)', () => {
    const remove = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(<ScrollToTop />);
    unmount();

    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});
