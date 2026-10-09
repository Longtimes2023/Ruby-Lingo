/**
 * RubyLingo — Ghi vào bảng `daily_stats` (thống kê theo NGÀY, nguồn của báo cáo phụ huynh).
 *
 * ⚠️⚠️ VÌ SAO TÁCH RA KHỎI `ProgressService` — ĐỌC TRƯỚC KHI GỘP LẠI:
 *
 *   `daily_stats` có HAI người ghi với hai lý do khác nhau:
 *     • `ProgressService.sync` — một lượt chơi game được gửi lên (câu trả lời, từ mới, thời gian).
 *     • `QuestService.claim`  — bé bấm "Nhận thưởng" ở màn Nhiệm vụ (⭐/🌰/XP đi thẳng vào ví).
 *
 *   Và nó có MỘT lý do để cả hai phải ghi: `daily_stats` là nguồn DUY NHẤT của báo cáo phụ
 *   huynh, nên nếu quà nhiệm vụ không được ghi vào đây thì phụ huynh mở báo cáo sẽ thấy tổng ⭐
 *   NHỎ HƠN số dư trong ví của con — hai con số nói về cùng một thứ mà lệch nhau, và không ai
 *   tin được con số nào nữa (xem ghi chú `starsEarned` ở `ProgressService`).
 *
 *   Nhưng `QuestService` KHÔNG THỂ `import` `ProgressService`: `ProgressService` lại cần gọi
 *   `QuestService` để báo "bé vừa hoàn thành một bài" (nhiệm vụ `complete_lessons`). Hai module
 *   import nhau ⇒ khi nạp, một trong hai singleton còn nằm trong vùng tạm (TDZ) và
 *   `new QuestService()` ném `ReferenceError: Cannot access 'progressService' before
 *   initialization` — nghĩa là SERVER KHÔNG KHỞI ĐỘNG ĐƯỢC, không phải một lỗi nhỏ.
 *
 *   Vậy nên: câu SQL ghi `daily_stats` nằm ở MODULE LÁ này (không import gì thuộc nghiệp vụ).
 *   `ProgressService` giữ nguyên phương thức `applyDailyStatInTx` như cũ và chỉ uỷ quyền xuống
 *   đây ⇒ mọi lời gọi hiện có (kể cả trong test) không đổi. Quan hệ phụ thuộc trở thành một
 *   chiều: `QuestService` → `dailyStats` và `ProgressService` → `dailyStats`.
 *
 * ⚠️ "MỘT CỘT, MỘT CHỦ": cả hai người ghi đều đi qua ĐÚNG hàm này. Không ai được tự viết một
 *    câu `UPDATE daily_stats` khác — hai bản SQL cho cùng một luật cộng dồn sẽ lệch nhau, và
 *    triệu chứng là số liệu của bé khác nhau tuỳ bé vào màn hình nào.
 */

import type { DailyStat } from '../../shared/types/progress.js';
import type { Db } from '../db/connection.js';
import { laterIso } from '../lib/time.js';
import { touchStreakInTx } from './streak.js';

/** Hình dạng hàng thô trong SQLite (snake_case). */
export interface DailyStatRow {
  child_id: string;
  date: string;
  words_learned: number;
  questions_answered: number;
  correct_count: number;
  stars_earned: number;
  acorns_earned: number;
  xp_earned: number;
  active_seconds: number;
  updated_at: string;
}

/** Hàng thô ⇒ DTO. Một chỗ duy nhất đổi tên cột, để không nơi nào phải nhớ `xp_earned`. */
export function dailyStatToDto(row: DailyStatRow): DailyStat {
  return {
    childId: row.child_id,
    date: row.date,
    wordsLearned: row.words_learned,
    questionsAnswered: row.questions_answered,
    correctCount: row.correct_count,
    starsEarned: row.stars_earned,
    acornsEarned: row.acorns_earned,
    xpEarned: row.xp_earned,
    activeSeconds: row.active_seconds,
    updatedAt: row.updated_at,
  };
}

/**
 * Phần tăng thêm của một ngày.
 *
 * ⚠️ BA TRƯỜNG TIỀN TỆ LÀ TUỲ CHỌN vì không phải người gọi nào cũng trao tiền: một câu trả lời
 *    trong flashcard không trao ⭐ nào. Bỏ trống = 0, KHÔNG phải "không xác định".
 */
export interface DailyStatDelta {
  wordsLearned: number;
  questionsAnswered: number;
  correctCount: number;
  activeSeconds: number;
  /**
   * ⭐ / 🌰 / XP THỰC SỰ được trao cho bé trong sự việc này.
   *
   * ⚠️ Phải là SỐ THỰC SỰ ĐƯỢC TRAO (kể cả quà lên cấp), không phải "phần thưởng lẽ ra được
   *    nhận". Một lượt chơi vượt 2 cấp làm ví tăng nhiều hơn phần thưởng của ván — báo cáo phải
   *    khớp với ví, nếu không thì không ai tin được cả hai con số.
   */
  starsEarned?: number;
  acornsEarned?: number;
  xpEarned?: number;
}

/**
 * Cộng dồn thống kê của MỘT NGÀY.
 *
 * ⚠️ VÌ SAO Ở ĐÂY LÀ **CỘNG DỒN** TRONG KHI `mergeDailyStat` LẠI DÙNG LWW:
 *   Vì hai chỗ trả lời hai câu hỏi khác nhau.
 *     • `mergeDailyStat` gộp HAI ẢNH CHỤP của cùng một khoảng thời gian (client ↔ server).
 *       Cộng ở đó sẽ đếm hai lần cùng một sự việc.
 *     • Hàm này áp MỘT sự việc MỚI vào một ngày. Một lượt chơi mới thực sự làm tăng số câu
 *       bé đã trả lời, nên phải cộng.
 *   Điều kiện để phép cộng này an toàn là **chống ghi trùng ở tầng trên**:
 *   `GameResultService` chỉ gọi hàm này SAU khi đã chèn được dòng `game_result` với
 *   `client_event_id` mới (xem quyết định 1 ở file đó), còn `QuestService.claim` chỉ gọi nó
 *   ĐÚNG MỘT LẦN cho mỗi kỳ (cột `claimed` là cổng). **Đừng gỡ một trong hai đầu.**
 *
 * ⚠️ PHẢI được gọi bên trong transaction của BÊN GỌI (giống mọi hàm `*InTx` khác): người gọi
 *    điều phối nhiều bảng trong cùng một đơn vị công việc, và một nửa công việc đã ghi là
 *    trạng thái không được phép tồn tại.
 */
export function applyDailyStatInTx(
  db: Db,
  childId: string,
  dateKey: string,
  delta: DailyStatDelta,
  occurredAt: string,
): void {
  const row = db
    .prepare('SELECT * FROM daily_stats WHERE child_id = ? AND date = ?')
    .get(childId, dateKey) as DailyStatRow | undefined;

  const prev = row ? dailyStatToDto(row) : null;

  // Kẹp mọi delta về >= 0: một giá trị âm (do lỗi tính toán) sẽ làm số liệu của bé TỤT xuống —
  // phụ huynh sẽ đọc đó là "con mình sao hôm nay ít hơn hôm qua". Không có đường nào để số liệu
  // giảm, kể cả khi có lỗi ở tầng trên.
  const add = (value: number): number => Math.max(0, Math.trunc(value));

  db.prepare(
    `INSERT INTO daily_stats
       (child_id, date, words_learned, questions_answered, correct_count,
        stars_earned, acorns_earned, xp_earned, active_seconds, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (child_id, date) DO UPDATE SET
       words_learned      = excluded.words_learned,
       questions_answered = excluded.questions_answered,
       correct_count      = excluded.correct_count,
       stars_earned       = excluded.stars_earned,
       acorns_earned      = excluded.acorns_earned,
       xp_earned          = excluded.xp_earned,
       active_seconds     = excluded.active_seconds,
       updated_at         = excluded.updated_at`,
  ).run(
    childId,
    dateKey,
    (prev?.wordsLearned ?? 0) + add(delta.wordsLearned),
    (prev?.questionsAnswered ?? 0) + add(delta.questionsAnswered),
    (prev?.correctCount ?? 0) + add(delta.correctCount),
    (prev?.starsEarned ?? 0) + add(delta.starsEarned ?? 0),
    (prev?.acornsEarned ?? 0) + add(delta.acornsEarned ?? 0),
    (prev?.xpEarned ?? 0) + add(delta.xpEarned ?? 0),
    (prev?.activeSeconds ?? 0) + add(delta.activeSeconds),
    laterIso(prev?.updatedAt ?? '', occurredAt),
  );

  /**
   * ⭐ NỐI CHUỖI NGÀY (T068.2) — nhưng CHỈ khi sự việc này là HOẠT ĐỘNG HỌC.
   *
   *   `QuestService.claim` cũng gọi hàm này, với MỌI delta học tập bằng 0 (chỉ có ⭐/🌰/XP — để
   *   báo cáo phụ huynh khớp ví). Bấm "Nhận thưởng" KHÔNG phải là học, nên nó không được làm
   *   chuỗi ngày tăng — đúng điều kiện mà nhiệm vụ `learn_days` đã áp (xem `countLearnDays`).
   *   Ba trường ở đây PHẢI khớp ba trường `countLearnDays` kiểm; thêm/bớt một trường là hai định
   *   nghĩa "ngày học" lệch nhau.
   */
  const learning =
    add(delta.wordsLearned) > 0 || add(delta.questionsAnswered) > 0 || add(delta.activeSeconds) > 0;
  if (learning) touchStreakInTx(db, childId, dateKey, occurredAt);
}
