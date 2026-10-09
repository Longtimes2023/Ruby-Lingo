/**
 * RubyLingo — Cập nhật `streak_state` (chuỗi ngày học) — T068.2.
 *
 * ⭐ NHIỆM VỤ: một chỗ DUY NHẤT biết cách biến "bé vừa HỌC hôm nay" thành một bước tiến của
 *   chuỗi ngày. `streak_state` là nguồn của hai thứ dùng chung:
 *     • huy hiệu `badge-streak-7` (`BadgeService` đọc `longest_streak` — xem quyết định 2 ở đó);
 *     • chỉ số 🔥 hiển thị trên thanh trên cùng và màn Nhiệm vụ (`RewardService.readStreak`).
 *
 * ⚠️ VÌ SAO LÀ MODULE LÁ, KHÔNG NẰM TRONG `ProgressService`:
 *   Có HAI đường tạo ra "một ngày học", và chúng ở HAI module khác nhau:
 *     • `dailyStats.applyDailyStatInTx` — lượt chơi game (có số câu / từ mới / thời gian).
 *     • `ProgressService.applyEventOnce` — flashcard (`progress_event`), KHÔNG ghi `daily_stats`.
 *   Nếu luật chuỗi nằm trong `ProgressService` thì đường game phải import `ProgressService` —
 *   mà `ProgressService` ĐÃ import `QuestService`, còn `QuestService` import `dailyStats`… một
 *   vòng import ở đây là SERVER KHÔNG KHỞI ĐỘNG ĐƯỢC (xem ghi chú đầu `dailyStats.ts`). Nên luật
 *   chuỗi sống ở module lá này, và cả hai đường cùng trỏ xuống — đúng khuôn `dailyStats.ts`.
 *
 * ⚠️ ĐỊNH NGHĨA "MỘT NGÀY HỌC" — DÙNG CHUNG, KHÔNG PHÁT MINH CÁI THỨ HAI:
 *   Một ngày được tính là ngày học nếu CÙNG điều kiện mà nhiệm vụ `learn_days` dùng
 *   (`QuestService.countLearnDays`): có `daily_stats` với `words_learned`/`questions_answered`/
 *   `active_seconds` > 0, HOẶC có một `progress_event` trong ngày đó. Vì vậy:
 *     • `dailyStats.applyDailyStatInTx` chỉ gọi hàm này khi delta có HOẠT ĐỘNG HỌC (bỏ qua hàng
 *       toàn số 0 mà `QuestService.claim` ghi — bấm "Nhận thưởng" KHÔNG phải là học);
 *     • `ProgressService.applyEventOnce` gọi hàm này cho MỌI sự kiện (mọi `kind` ở đó đều là học).
 *   Nhờ vậy tập "ngày học" của chuỗi trùng KHÍT với tập ngày mà nhiệm vụ đếm.
 *
 * ⚠️ HÀM NÀY PHẢI ĐƯỢC GỌI **BÊN TRONG** MỘT TRANSACTION ĐÃ MỞ (nhận `db`, KHÔNG tự mở) — cùng
 *    lý do như mọi hàm `*InTx` khác: chuỗi phải rollback theo lượt chơi nếu lượt chơi hỏng.
 */

import type { Db } from '../db/connection.js';
import { daysBetweenDateKeys } from '../lib/time.js';

/** Hình dạng hàng `streak_state` cần cho phép tính — chỉ ba cột. */
interface StreakRow {
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
}

/**
 * Ghi nhận "bé có hoạt động học trong ngày `dateKey`" vào chuỗi.
 *
 * @param dateKey Ngày theo GIỜ ĐỊA PHƯƠNG (YYYY-MM-DD) — cùng loại khoá với `daily_stats.date`
 *                và `streak_state.last_active_date`. KHÔNG dùng ngày UTC: buổi học tối ở Việt
 *                Nam (UTC+7) sẽ bị tính sang hôm sau, và chuỗi đếm sai ngay ở múi giờ nhà bé.
 * @param at      Mốc ISO để ghi `updated_at` (chỉ để truy vết).
 *
 * ⭐ CHỒNG NGÀY LÀ NO-OP: gọi nhiều lần trong cùng một ngày KHÔNG làm chuỗi tăng — nếu không,
 *   một buổi học 20 câu flashcard sẽ biến "học 1 ngày" thành chuỗi 20.
 *
 * ⚠️ CHỈ ĐI TỚI, KHÔNG BAO GIỜ LÙI: một sự kiện đến MUỘN (bé chơi offline hôm kia, hôm nay mới
 *   đồng bộ) mang `dateKey` CŨ HƠN `last_active_date` ⇒ bỏ qua. "Chữa lành ngược" một chuỗi quá
 *   khứ là bất khả (đã mất thông tin về các ngày xen giữa), và lùi `last_active_date` sẽ khiến
 *   hoạt động hôm nay bị tính lại lần nữa. Bỏ qua là hướng an toàn: chỉ ĐẾM THIẾU, không bao giờ
 *   đếm thừa — và huy hiệu `badge-streak-7` chỉ có thể tới muộn hơn, không bao giờ trao oan.
 */
export function touchStreakInTx(db: Db, childId: string, dateKey: string, at: string): void {
  const row = db
    .prepare(
      'SELECT current_streak, longest_streak, last_active_date FROM streak_state WHERE child_id = ?',
    )
    .get(childId) as StreakRow | undefined;

  // Chưa có hàng: hoạt động đầu tiên của bé ⇒ chuỗi = 1. (`ChildService` thường tạo hàng lúc tạo
  // hồ sơ, nhưng nhánh này phải đúng cho DB phục hồi từ sao lưu hoặc sửa tay.)
  if (!row) {
    db.prepare(
      `INSERT INTO streak_state
         (child_id, current_streak, longest_streak, last_active_date, milestones_claimed, updated_at)
       VALUES (?, 1, 1, ?, '[]', ?)`,
    ).run(childId, dateKey, at);
    return;
  }

  const last = row.last_active_date;
  // Cùng ngày (đã tính) HOẶC sự kiện cũ hơn ngày đã ghi ⇒ không đụng gì. So sánh chuỗi là đủ vì
  // mọi khoá ngày là ISO `YYYY-MM-DD` cùng định dạng.
  if (last !== null && last >= dateKey) return;

  const gap = last === null ? Number.POSITIVE_INFINITY : daysBetweenDateKeys(last, dateKey);
  // Liền kề (cách đúng 1 ngày) ⇒ nối chuỗi; ngược lại (đứt quãng, hoặc chưa từng học) ⇒ bắt đầu lại từ 1.
  const current = gap === 1 ? row.current_streak + 1 : 1;
  // `longest_streak` CHỈ TĂNG — đây là điều kiện để huy hiệu sưu tầm vĩnh viễn đứng vững khi bé đứt chuỗi.
  const longest = Math.max(row.longest_streak, current);

  db.prepare(
    `UPDATE streak_state
        SET current_streak   = ?,
            longest_streak   = ?,
            last_active_date = ?,
            updated_at       = ?
      WHERE child_id = ?`,
  ).run(current, longest, dateKey, at, childId);
}
