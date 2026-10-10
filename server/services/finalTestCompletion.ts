/**
 * RubyLingo — TRUY VẤN DÙNG CHUNG: "bé đã hoàn thành BÀI THI CUỐI KHOÁ chưa" (G6).
 *
 * ⭐ VÌ SAO LÀ MỘT MODULE LÁ RIÊNG, KHÔNG VIẾT THẲNG Ở HAI CHỖ:
 *   Cùng một câu hỏi ("đã nộp đủ MỌI phần chưa") được HAI service hỏi:
 *     • `BadgeService` — để trao huy chương tốt nghiệp (`criteria.kind: 'complete_final_test'`).
 *     • `QuestService` — để đánh xong nhiệm vụ mốc tốt nghiệp (cùng `kind`).
 *   Viết hai câu SQL gần giống nhau ở hai chỗ là tạo hai định nghĩa cho cùng một sự thật — và
 *   hai định nghĩa thì sớm muộn cũng lệch (ví dụ một bên quên đối chiếu với danh mục phần thi).
 *   Đây là module LÁ: nó chỉ đọc `content-index` + nhận `db`, KHÔNG import service nào ⇒ cả hai
 *   service trỏ xuống nó mà không tạo vòng import (cùng lối với `dailyStats.ts`).
 *
 * ⚠️ Danh mục phần thi lấy từ `getFinalTestMeta()` (chỉ mục nội dung), KHÔNG hardcode ba tên
 *    phần. Thêm/bớt một phần trong bài thi là đổi nội dung, không phải đổi tệp này.
 */

import type { Db } from '../db/connection.js';
import { getFinalTestMeta } from '../../shared/content/content-index.js';

/**
 * Bé đã hoàn thành cả bài thi cuối khoá chưa = mỗi phần có ÍT NHẤT một lần nộp.
 *
 * ⚠️ Hàm này KHÔNG tự mở transaction và KHÔNG kiểm quyền sở hữu: người gọi đã ở trong một
 *    transaction (nhận `db`) và đã kiểm quyền. `childId` đến từ URL của một bé thuộc phụ huynh
 *    đang đăng nhập.
 */
export function hasCompletedFinalTest(db: Db, childId: string): boolean {
  const meta = getFinalTestMeta();
  if (!meta || meta.sections.length === 0) return false;

  const rows = db
    .prepare('SELECT DISTINCT section FROM final_test_attempt WHERE child_id = ?')
    .all(childId) as Array<{ section: string }>;
  const present = new Set(rows.map((row) => row.section));

  return meta.sections.every((summary) => present.has(summary.section));
}
