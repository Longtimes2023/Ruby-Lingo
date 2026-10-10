/**
 * RubyLingo — Câu "còn thiếu gì" để mở khu vực thi, và các câu trạng thái cổng.
 *
 * ⭐ VÌ SAO TÁCH RA KHỎI `FinalTestGatewayCard.tsx`: tệp `.tsx` chỉ nên export COMPONENT (quy tắc
 *   fast-refresh của Vite). Một hàm thuần export cạnh component làm React Fast Refresh mất khả
 *   năng cập nhật nóng, và cảnh báo đó là LỖI ở cổng `lint --max-warnings 0`. Hàm này cũng được
 *   dùng ở MÀN KHU VỰC THI và MÀN MỘT PHẦN nữa, nên nó thuộc về một module riêng.
 *
 * ⚠️ Luôn trả về một câu ĐẦY ĐỦ, hướng dẫn trẻ — không bao giờ chỉ một chữ "Khoá". Và KHÔNG có
 *    từ phán xét ("chưa đạt", "kém"): còn thiếu bài/game là chuyện bình thường của hành trình.
 */

import type { FinalTestAccess } from '@shared/final-test-access.js';

export function finalTestRequirementText(
  gate: FinalTestAccess,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const requirement = gate.requirement;
  // `pending` (chưa đồng bộ) có `requirement === null` ⇒ trung tính, KHÔNG nói còn thiếu.
  if (!requirement) return t('finalTest.checking');

  if (requirement.type === 'lessons_incomplete') {
    return t('finalTest.lockedLessons', {
      missing: requirement.lessonsMissing,
      done: requirement.lessonsCompleted,
      total: requirement.lessonsTotal,
    });
  }
  return t('finalTest.lockedGames', { missing: requirement.gamesMissing });
}
