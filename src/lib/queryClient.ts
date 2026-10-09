/**
 * RubyLingo — `QueryClient` dùng chung cho cả app.
 *
 * ⭐⭐ VÌ SAO TÁCH RA KHỎI `main.tsx` (T05 — Chỉnh sửa bắt buộc #2):
 *   `src/services/GameResultService.ts` (hàng đợi gửi kết quả lượt chơi) cần LÀM MỚI danh sách
 *   kết quả game NGAY khi một lượt chơi vừa tới server — nếu không, bé quay lại màn chủ đề trước
 *   khi hàng đợi gửi xong thì chip vẫn chưa đổi màu (đúng triệu chứng chủ dự án báo).
 *
 *   Nhưng `GameResultService` KHÔNG được `import` trực tiếp từ `main.tsx`: `main.tsx` import
 *   `App.tsx`, mà `App` kéo theo gần như cả cây component — và một trong số đó (gián tiếp) import
 *   `GameResultService`. Đó là VÒNG IMPORT, và vòng import ở ESM làm module rơi vào vùng tạm
 *   (TDZ) ⇒ `queryClient` là `undefined` lúc dùng ⇒ sập.
 *
 *   Tệp NÀY chỉ import `@tanstack/react-query` nên là một LÁ AN TOÀN: không vòng, không phụ thuộc
 *   component nào. `main.tsx` và `GameResultService.ts` cùng import từ đây.
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Cấu hình cho mạng yếu / tablet của bé:
 *   - retry 2 lần (không retry mãi gây treo UI)
 *   - không refetch khi cửa sổ được focus (bé hay chuyển app qua lại ⇒ tránh tải thừa)
 *   - `staleTime` 30s: dữ liệu tiến độ/thưởng không cần tươi từng giây
 *   - mutations retry 1 (một lần thử lại khi mạng chập chờn)
 *
 * ⚠️ Đây là cấu hình DUY NHẤT — đừng dựng `new QueryClient` ở chỗ khác cho app thật (test thì
 *    được, chúng cố ý dựng client riêng với `retry: false`).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
    mutations: {
      retry: 1,
    },
  },
});
