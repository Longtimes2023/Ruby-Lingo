/**
 * RubyLingo — Khoá truy vấn (query key) dùng chung cho TanStack Query.
 *
 * ⭐ VÌ SAO PHẢI CÓ MỘT NGUỒN DUY NHẤT CHO KHOÁ:
 *   Một khoá TanStack Query chỉ hữu ích khi MỌI nơi đọc/ghi nó dùng ĐÚNG cùng một chuỗi. Ở T05,
 *   có HAI nơi chạm vào "kết quả game của một bé":
 *     1. `useGameResults` — ĐỌC (dựng query).
 *     2. `gameResultQueue.onSent` (trong `src/services/GameResultService.ts`) — LÀM MỚI sau khi
 *        một lượt chơi đã tới server.
 *   Nếu mỗi nơi tự viết `['game-results', childId]` thì chỉ cần một bên đổi (thêm tiền tố, đổi
 *   tên) là bên kia LÀM MỚI MỘT KHOÁ KHÔNG TỒN TẠI — chip không đổi màu, và không có lỗi nào.
 *   Một hàm dựng khoá, hai nơi gọi.
 *
 * ⚠️ File này CHỈ chứa hàm thuần (không import React, không import store) để `GameResultService`
 *    — mã NGOÀI React — dùng được mà không kéo theo vòng import.
 */

/**
 * Khoá truy vấn cho danh sách kết quả game ĐÃ CHƠI của một bé.
 *
 * `childId` là `null` khi chưa chọn bé: query khi đó bị `enabled: false` nên không chạy, nhưng
 * khoá vẫn dựng được để `queryClient` không ném khi vô tình gọi.
 */
export function gameResultsQueryKey(
  childId: string | null,
): readonly ['game-results', string | null] {
  return ['game-results', childId] as const;
}

/**
 * Khoá truy vấn cho TRẠNG THÁI khu vực thi cuối khoá của một bé.
 *
 * ⭐ Cùng lý do như `gameResultsQueryKey`: có HAI nơi chạm vào "trạng thái khu vực thi":
 *   1. `useFinalTestGate` — ĐỌC (dựng truy vấn).
 *   2. `FinalTestSectionPage` — LÀM MỚI sau khi nộp một phần (khiên cao nhất đổi).
 *   Hai nơi tự viết chuỗi thì chỉ cần một bên đổi là bên kia làm mới một khoá không tồn tại —
 *   khiên trên màn khu vực thi không cập nhật, và không có lỗi nào.
 */
export function finalTestQueryKey(
  childId: string | null,
): readonly ['final-test', string | null] {
  return ['final-test', childId] as const;
}
