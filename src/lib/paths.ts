/**
 * RubyLingo — dựng đường dẫn trong app.
 *
 * ⭐ VÌ SAO GOM VÀO MỘT CHỖ, KHÔNG NỐI CHUỖI TẠI CHỖ:
 *   Ba màn hình (`JourneyMapPage`, `ThemePage`, `FlashcardPage`, `GamePage`) đều dựng URL cho
 *   cùng vài khái niệm "chủ đề / bài học / bài tập". Nối chuỗi tại chỗ thì đổi hình dạng URL
 *   (`/flashcards` → `/cards`) trở thành một cuộc đi tìm: thiếu một chỗ là có một link chết,
 *   và **không có lỗi biên dịch nào báo** — chỉ có bé bấm vào rồi thấy màn hình trắng.
 *
 * ⚠️⚠️ `encodeURIComponent` LÀ BẮT BUỘC, KHÔNG PHẢI CHO ĐẸP:
 *   `lessonId` của dự án CÓ chứa dấu `/` — "at-the-zoo/z1". Dấu `/` nằm trần trong một đoạn
 *   đường dẫn sẽ bị React Router hiểu thành hai đoạn, và route `/lesson/:lessonId/...` không
 *   bao giờ khớp. Phải mã hoá thành `at-the-zoo%2Fz1`; `useParams` sẽ tự giải mã lại, nên
 *   phía đọc không cần làm gì. Cùng lý do đã ghi ở đầu `router.tsx`.
 */

import type { Exercise } from '@shared/types/content.js';

/** `/theme/:themeId` — danh sách bài của một chủ đề. */
export function themePath(themeId: string): string {
  return `/theme/${encodeURIComponent(themeId)}`;
}

/** `/lesson/:lessonId/flashcards` — màn hình học thẻ từ. */
export function flashcardsPath(lessonId: string): string {
  return `/lesson/${encodeURIComponent(lessonId)}/flashcards`;
}

/** `/lesson/:lessonId/game/:exerciseSlug` — màn hình chơi một bài tập cụ thể. */
export function gamePath(lessonId: string, exerciseSlug: string): string {
  return `/lesson/${encodeURIComponent(lessonId)}/game/${encodeURIComponent(exerciseSlug)}`;
}

/**
 * Phần đuôi của `exercise.id` dùng làm đoạn cuối trong URL game.
 *
 * ⚠️ Nhận `Pick<Exercise, 'id' | 'lessonId'>` chứ KHÔNG nhận cả `Exercise`: hàm chỉ đọc hai
 *   trường đó, nên kiểu hẹp hơn vừa nói đúng sự thật, vừa cho test dựng được dữ liệu tối thiểu
 *   mà không phải bịa ra cả một bài tập đầy đủ (`as never` — mùi code che mất lỗi thật).
 *
 * ⚠️ VÌ SAO KHÔNG ĐƯA CẢ `exercise.id` VÀO URL:
 *   `exercise.id` là `"at-the-zoo/z1/listen-tap"` — đã chứa `lessonId` ở trong. URL vốn đã có
 *   `/lesson/:lessonId/`, nên đưa cả id vào sẽ thành
 *   `/lesson/at-the-zoo%2Fz1/game/at-the-zoo%2Fz1%2Flisten-tap`: `lessonId` lặp hai lần và URL
 *   đầy `%2F` không ai đọc được. Xem ghi chú dài ở đầu `GamePage.tsx`.
 *
 * ⚠️ Có nhánh dự phòng vì `exercise.id` là DỮ LIỆU, không phải hằng số: schema quy ước
 *   `"{lessonId}/{slug}"`, nhưng nếu một file nội dung viết sai quy ước thì hàm này vẫn phải
 *   trả về một chuỗi dùng được (đoạn cuối cùng) thay vì ném lỗi làm trắng cả trang chủ đề.
 */
export function exerciseSlug(exercise: Pick<Exercise, 'id' | 'lessonId'>): string {
  const prefix = `${exercise.lessonId}/`;
  if (exercise.id.startsWith(prefix)) return exercise.id.slice(prefix.length);

  const segments = exercise.id.split('/');
  return segments[segments.length - 1] ?? exercise.id;
}

// =============================================================================
// Bài thi cuối khoá (Starters)
// =============================================================================
//
// Đặt cùng chỗ với các đường dẫn học vì cùng lý do: URL bài thi xuất hiện ở thẻ cổng trên bản đồ,
// ở màn khu vực thi, ở màn một phần, và ở màn chứng nhận. Nối chuỗi tại chỗ thì đổi hình dạng URL
// là một cuộc đi tìm, và một chỗ quên sẽ tạo link chết — KHÔNG có lỗi biên dịch nào báo.

/**
 * `/final-test` — khu vực thi: trạng thái cổng + ba phần.
 *
 * ⚠️ Đây KHÔNG phải một mục ở `BottomNav` — 5 mục là TRẦN của dự án (xem `router.tsx`). Điểm
 *    vào là thẻ "🎓 Khu vực thi" ở cuối bản đồ hành trình.
 */
export function finalTestHomePath(): string {
  return '/final-test';
}

/** `/final-test/:section` — màn chơi MỘT phần (`listening` | `reading-writing` | `speaking`). */
export function finalTestSectionPath(section: string): string {
  return `/final-test/${encodeURIComponent(section)}`;
}

/** `/final-test/certificate` — màn "chứng nhận" trong app: tổng khiên ba phần. */
export function finalTestCertificatePath(): string {
  return '/final-test/certificate';
}

