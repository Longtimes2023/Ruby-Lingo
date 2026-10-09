/**
 * RubyLingo — `useViewport()`: kích thước khung nhìn + bậc breakpoint hiện tại.
 *
 * ⚠️⚠️ ĐỌC TRƯỚC KHI DÙNG — QUY TẮC ƯU TIÊN CSS:
 *   **Bố cục phải làm bằng CSS (Tailwind breakpoint), KHÔNG bằng hook này.**
 *   Lý do: `useViewport` chỉ biết kích thước SAU khi JavaScript chạy. Nếu dùng nó để quyết
 *   định bố cục, lần vẽ đầu tiên luôn sai (chưa đo được) rồi mới nhảy sang đúng — trên
 *   điện thoại yếu, bé sẽ thấy giao diện "giật" một cái mỗi lần mở trang.
 *
 *   Hook này chỉ dành cho những việc CSS KHÔNG làm được:
 *     • biết chắc là thiết bị cảm ứng để tắt hiệu ứng hover (xem `hasTouchInput`)
 *     • đo kích thước thật của một vùng để chia lưới game theo pixel
 *     • biết bàn phím ảo đang che mất bao nhiêu màn hình (`visualViewport`)
 *
 * ⭐ BREAKPOINT Ở ĐÂY PHẢI KHỚP `tailwind.config.ts` TỪNG PIXEL MỘT.
 *   Nếu lệch (ví dụ Tailwind `md` = 768 mà ở đây ghi 767), JavaScript và CSS sẽ bất đồng:
 *   JS tưởng đang ở bậc `sm` còn CSS đã áp bậc `md`. Loại lỗi này rất khó truy vì mỗi bên
 *   nhìn đều "đúng". Vì vậy hằng số chỉ khai MỘT chỗ, dưới đây.
 */

import { useEffect, useState } from 'react';

/** Bậc breakpoint, khớp đúng `theme.screens` trong `tailwind.config.ts`. */
export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Ngưỡng dưới của từng bậc, tính bằng px. `xs` là mặc định (không có ngưỡng dưới).
 * Giữ nguyên thứ tự tăng dần — `resolveBreakpoint()` dựa vào thứ tự này.
 */
export const BREAKPOINTS: ReadonlyArray<readonly [Exclude<Breakpoint, 'xs'>, number]> = [
  ['sm', 480],
  ['md', 768],
  ['lg', 1024],
  ['xl', 1366],
] as const;

export interface Viewport {
  /** Chiều rộng khung nhìn, px. */
  width: number;
  /** Chiều cao khung nhìn, px (đã tính `visualViewport` nếu có). */
  height: number;
  breakpoint: Breakpoint;
  /** Hướng màn hình — quyết định bố cục lưới trong game. */
  orientation: 'portrait' | 'landscape';
  /**
   * Chiều cao bị bàn phím ảo che, px. `0` khi không có bàn phím.
   * Dùng để đẩy nút/nội dung lên trên bàn phím.
   */
  keyboardInset: number;
}

/** Suy ra bậc breakpoint từ chiều rộng. Tách riêng để test được mà không cần DOM. */
export function resolveBreakpoint(width: number): Breakpoint {
  let current: Breakpoint = 'xs';
  for (const [name, min] of BREAKPOINTS) {
    if (width >= min) current = name;
  }
  return current;
}

/**
 * Đọc kích thước hiện tại từ `visualViewport` nếu có, không thì `window`.
 *
 * ⭐ Vì sao ưu tiên `visualViewport`: trên iOS, khi bàn phím ảo mở, `window.innerHeight`
 *   KHÔNG đổi — nó vẫn báo chiều cao đầy đủ. Chỉ `visualViewport.height` mới co lại. Nếu
 *   đọc `window.innerHeight`, ta tưởng còn chỗ trống và để nút "Lưu" nằm sau bàn phím.
 */
function readViewport(): Viewport {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0, breakpoint: 'xs', orientation: 'portrait', keyboardInset: 0 };
  }

  const vv = window.visualViewport;
  const width = Math.round(vv?.width ?? window.innerWidth);
  const height = Math.round(vv?.height ?? window.innerHeight);

  // Bàn phím ảo: phần chênh lệch giữa chiều cao cửa sổ và chiều cao khung nhìn thị giác.
  // Kẹp về >= 0 vì khi phóng to (pinch-zoom) `visualViewport` có thể CAO HƠN `innerHeight`,
  // và một giá trị âm sẽ đẩy bố cục lên sai hướng.
  const keyboardInset = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;

  return {
    width,
    height,
    breakpoint: resolveBreakpoint(width),
    orientation: width >= height ? 'landscape' : 'portrait',
    keyboardInset,
  };
}

/**
 * Theo dõi kích thước khung nhìn.
 *
 * ⭐ VÌ SAO GOM VÀO `requestAnimationFrame`:
 *   Sự kiện `resize` bắn ra liên tục khi người dùng kéo giãn cửa sổ hoặc xoay iPad — có thể
 *   hàng trăm lần mỗi giây. Mỗi lần gọi `setState` là một lần React render lại cả cây. Gom
 *   lại theo nhịp vẽ (tối đa ~60 lần/giây, và chỉ MỘT lần cho mỗi khung hình) giữ được độ
 *   mượt mà không phải bỏ sự kiện.
 *
 * ⭐ VÌ SAO SO SÁNH TRƯỚC KHI `setState`:
 *   Trả về object mới mỗi lần sẽ làm React render lại vô ích ngay cả khi kích thước không
 *   đổi (`resize` cũng bắn khi thanh địa chỉ của Safari co giãn dù chiều rộng y nguyên).
 *   So sánh từng trường rồi giữ nguyên object cũ nếu không có gì đổi.
 */
export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(readViewport);

  useEffect(() => {
    let frame = 0;

    const commit = () => {
      frame = 0;
      setViewport((previous) => {
        const next = readViewport();
        const unchanged =
          next.width === previous.width &&
          next.height === previous.height &&
          next.breakpoint === previous.breakpoint &&
          next.orientation === previous.orientation &&
          next.keyboardInset === previous.keyboardInset;
        return unchanged ? previous : next;
      });
    };

    const schedule = () => {
      if (frame !== 0) return; // đã có một khung hình đang chờ ⇒ không xếp thêm
      frame = window.requestAnimationFrame(commit);
    };

    // Đọc lại ngay khi gắn: giữa lúc `useState` khởi tạo và lúc effect chạy, cửa sổ có thể
    // đã đổi kích thước (ví dụ người dùng mở DevTools). Không đọc lại thì giá trị đầu bị cũ.
    commit();

    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    // `visualViewport` bắn sự kiện riêng khi bàn phím ảo mở/đóng — `resize` của window không.
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);

    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
    };
  }, []);

  return viewport;
}
