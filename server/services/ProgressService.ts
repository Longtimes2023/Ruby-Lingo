/**
 * RubyLingo — ProgressService (server): đọc và cập nhật tiến độ học.
 *
 * ⭐ HAI NHIỆM VỤ, MỘT LUẬT:
 *   1. `getSnapshot()` — đọc toàn bộ tiến độ của một bé.
 *   2. `sync()` — áp một lô sự kiện do client gửi lên, rồi trả về ảnh chụp đã gộp.
 *   Cả hai dùng CÙNG luật gộp ở `shared/progress-merge.ts` — cùng một file mà client dùng.
 *   Đó là điều duy nhất bảo đảm hai bên không bao giờ lệch nhau.
 *
 * ⭐ MỌI TRUY VẤN ĐỀU KIỂM QUYỀN SỞ HỮU:
 *   `childId` đến từ URL. Không kiểm `parent_id` thì phụ huynh A chỉ cần đoán id là đọc và
 *   GHI được tiến độ của bé nhà phụ huynh B. Mọi phương thức công khai ở đây đều bắt đầu
 *   bằng `requireChild()`.
 *
 * ⚙️ RÀNG BUỘC: `transaction()` là ĐỒNG BỘ (better-sqlite3) ⇒ tuyệt đối không `await` bên
 *    trong. Ở file này không có thao tác bất đồng bộ nào nên không gặp vấn đề.
 *
 * -----------------------------------------------------------------------------
 * BA QUYẾT ĐỊNH CẦN HIỂU TRƯỚC KHI SỬA
 * -----------------------------------------------------------------------------
 *
 * ⚠️ 1. SỰ KIỆN LÀ NGUỒN SỰ THẬT DUY NHẤT VỀ THAY ĐỔI — KHÔNG NHẬN ẢNH CHỤP TỪ CLIENT.
 *    Client chỉ gửi sự kiện. Ảnh chụp trong máy bé là DẪN XUẤT (sự kiện + ảnh chụp server),
 *    nên gửi nó lên là gửi lại thứ server đã biết, kèm nguy cơ ghi đè bằng bản cũ hơn.
 *    Xem ghi chú đầy đủ ở cuối `shared/schemas/progress.ts`.
 *
 * ⚠️ 2. SỐ ĐẾM THÌ CỘNG, NHƯNG CHỈ KHI SỰ KIỆN CHƯA TỪNG ĐƯỢC ÁP.
 *    Mỗi sự kiện `word_answer` là một câu trả lời MỚI, nên server phải CỘNG vào số đếm —
 *    không thể "lấy theo bản mới hơn" như khi gộp hai ảnh chụp với nhau.
 *    Việc cộng đó chỉ an toàn vì `progress_event.client_event_id` chặn áp trùng. Hai cơ chế
 *    này phụ thuộc lẫn nhau: bỏ bảng `progress_event` là số đếm phồng lên mỗi lần client
 *    gửi lại. ĐỪNG BỎ CÁI NÀY MÀ GIỮ CÁI KIA.
 *
 * ⚠️ 3. `updated_at` CỦA BẢN GHI LÀ `max(cũ, occurredAt)`, KHÔNG BAO GIỜ LÙI.
 *    Một sự kiện đến muộn (bé chơi offline từ hôm qua) không được phép làm bản ghi "cũ đi" —
 *    nếu lùi, luật LWW ở client sẽ để bản trong máy thắng và xoá mất việc vừa đồng bộ.
 */

import type { Db } from '../db/connection.js';
import { getDb, transaction } from '../db/connection.js';
import { laterIso, localDateKey, nowIso } from '../lib/time.js';
import { errors } from '../plugins/errors.js';
import { childService } from './ChildService.js';
import type { ChildService } from './ChildService.js';
import { MASTERED_THRESHOLD } from '../../shared/progress-merge.js';
import { clampStarsBest, type StarRating } from '../../shared/game-scoring.js';
import type { ProgressSyncRequestInput } from '../../shared/schemas/progress.js';
import { progressSyncRequestSchema } from '../../shared/schemas/progress.js';
import type { ProgressSyncResponse } from '../../shared/types/api.js';
import type {
  LessonProgress,
  ProgressEvent,
  ProgressSnapshot,
  ThemeProgress,
  WordProgress,
} from '../../shared/types/progress.js';
/**
 * ⚠️ CÂU SQL GHI `daily_stats` NẰM Ở MODULE LÁ `dailyStats.ts`, KHÔNG Ở ĐÂY — xem ghi chú dài
 *    ở đầu file đó. Tóm tắt: `QuestService` cũng phải ghi vào bảng này khi bé bấm "Nhận thưởng",
 *    và nó KHÔNG THỂ `import` file này (hai module import nhau ⇒ server không khởi động được).
 *    Nên cả hai cùng trỏ xuống module lá. Phương thức `applyDailyStatInTx` bên dưới vẫn giữ
 *    nguyên chữ ký và chỉ uỷ quyền — mọi lời gọi hiện có không đổi.
 */
import { applyDailyStatInTx as writeDailyStat } from './dailyStats.js';
import type { DailyStatRow } from './dailyStats.js';
import { dailyStatToDto } from './dailyStats.js';
import { questService } from './QuestService.js';
import type { QuestService } from './QuestService.js';
import { badgeService } from './BadgeService.js';
import type { BadgeService } from './BadgeService.js';
import { touchStreakInTx } from './streak.js';

// =============================================================================
// Hàng dữ liệu thô
// =============================================================================

interface WordRow {
  child_id: string;
  word_id: string;
  learned: number;
  mastered: number;
  correct_count: number;
  wrong_count: number;
  last_seen_at: string | null;
  updated_at: string;
}

interface LessonRow {
  child_id: string;
  lesson_id: string;
  best_score: number;
  stars_best: number;
  attempts: number;
  completed: number;
  completed_at: string | null;
  updated_at: string;
}

interface ThemeRow {
  child_id: string;
  theme_id: string;
  unlocked: number;
  unlocked_at: string | null;
  lessons_completed: number;
  stars_earned: number;
  updated_at: string;
}

/**
 * Hình dạng hàng `daily_stats` (snake_case) nay khai ở MODULE LÁ `dailyStats.ts` — `DailyStatRow`.
 *
 * ⭐ Vì sao KHÔNG giữ một interface riêng ở đây: bảng `daily_stats` có HAI người ghi
 *   (`ProgressService.sync` và `QuestService.claim`). Hai khai báo song song cho cùng một bảng
 *   sẽ lệch nhau ngay lần đầu ai đó thêm một cột, và triệu chứng là số liệu của bé khác nhau
 *   tuỳ bé vào màn hình nào. Một bảng, một hình dạng, một hàm đổi tên cột (`dailyStatToDto`).
 */
type DailyRow = DailyStatRow;

/** SQLite không có kiểu boolean ⇒ mọi cờ là 0/1 và phải đổi qua lại ở đúng một chỗ. */const toBool = (value: number): boolean => value !== 0;

function toWordProgress(row: WordRow): WordProgress {
  return {
    childId: row.child_id,
    wordId: row.word_id,
    learned: toBool(row.learned),
    mastered: toBool(row.mastered),
    correctCount: row.correct_count,
    wrongCount: row.wrong_count,
    lastSeenAt: row.last_seen_at,
    updatedAt: row.updated_at,
  };
}

function toLessonProgress(row: LessonRow): LessonProgress {
  return {
    childId: row.child_id,
    lessonId: row.lesson_id,
    bestScore: row.best_score,
    starsBest: clampStarsBest(row.stars_best),
    attempts: row.attempts,
    completed: toBool(row.completed),
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

function toThemeProgress(row: ThemeRow): ThemeProgress {
  return {
    childId: row.child_id,
    themeId: row.theme_id,
    unlocked: toBool(row.unlocked),
    unlockedAt: row.unlocked_at,
    lessonsCompleted: row.lessons_completed,
    starsEarned: row.stars_earned,
    updatedAt: row.updated_at,
  };
}

// `toDailyStat` đã bị xoá: nay dùng `dailyStatToDto` của `dailyStats.ts` — xem ghi chú ở trên.

// =============================================================================
// Service
// =============================================================================

export class ProgressService {
  /**
   * ⚠️ `quests` là phụ thuộc THỨ BA, và nó có hướng MỘT CHIỀU — đây là điều kiện để server
   *    khởi động được: `ProgressService` → `QuestService`, không bao giờ ngược lại.
   *
   *    `QuestService` không được `import` file này. Nếu nó cần gì từ tầng tiến độ, thứ đó phải
   *    nằm ở một module LÁ (`dailyStats.ts`) mà cả hai cùng trỏ xuống. Chi tiết + hậu quả thật
   *    của việc vi phạm: xem ghi chú đầu `dailyStats.ts`.
   *
   * ⚠️ `badges` là phụ thuộc THỨ TƯ (T068), cũng MỘT CHIỀU: `ProgressService` → `BadgeService`.
   *    Nó cần thiết vì `applyLessonCompleted` là chỗ DUY NHẤT đặt `lesson_progress.completed = 1`
   *    — tức là chỗ duy nhất một bài trở thành "hoàn thành" theo định nghĩa mà `BadgeService`
   *    dùng. Không gọi ở đây thì các huy hiệu `complete_lesson`/`complete_theme` chỉ được trao
   *    LỎNG (lần chơi game kế tiếp mới bắt được) — hoặc không bao giờ, nếu bé học bằng thẻ rồi
   *    không chơi game nữa.
   */
  constructor(
    private readonly db: Db = getDb(),
    private readonly children: ChildService = childService,
    private readonly quests: QuestService = questService,
    private readonly badges: BadgeService = badgeService,
  ) {}

  /**
   * Ảnh chụp toàn bộ tiến độ của một bé.
   *
   * `since` (tuỳ chọn): chỉ lấy bản ghi có `updated_at >= since`. Truyền `null` để lấy hết.
   */
  getSnapshot(parentId: string, childId: string, since: string | null = null): ProgressSnapshot {
    this.requireChild(parentId, childId);
    return this.readSnapshot(childId, since);
  }

  /**
   * Áp một lô sự kiện rồi trả về ảnh chụp đã cập nhật.
   *
   * Trả về `applied`/`skipped` để client biết đã gửi thành công bao nhiêu — và để phát hiện
   * sớm nếu client đang gửi lại quá nhiều (dấu hiệu phản hồi bị mất liên tục).
   */
  sync(parentId: string, childId: string, rawInput: ProgressSyncRequestInput): ProgressSyncResponse {
    // Parse lại ở tầng service (không chỉ ở route) — xem ghi chú ở `ChildService`.
    const input = progressSyncRequestSchema.parse(rawInput);
    this.requireChild(parentId, childId);

    // ⚠️ MỌI thao tác đọc/ghi phải nằm trong MỘT transaction: nếu áp được 12/20 sự kiện rồi
    //    lỗi, client sẽ gửi lại 20 và 12 sự kiện kia bị chặn bởi `progress_event` (đúng),
    //    nhưng trạng thái trung gian đã lộ ra cho bất kỳ ai đọc cùng lúc. Một transaction
    //    biến "12/20" thành "hoặc 20, hoặc 0" — luôn là một trạng thái hiểu được.
    const result = transaction((db) => {
      let applied = 0;
      let skipped = 0;

      for (const event of input.events) {
        if (this.applyEventOnce(db, childId, event)) applied += 1;
        else skipped += 1;
      }

      return { applied, skipped };
    });

    // Mốc sàn cho ảnh chụp trả về — xem `resolveFloor`.
    const floor = resolveFloor(input.since, input.events);
    const snapshot = this.readSnapshot(childId, floor);

    return { snapshot, applied: result.applied, skipped: result.skipped };
  }

  // --- Nội bộ ---------------------------------------------------------------

  /**
   * Kiểm quyền sở hữu. Ném `CHILD_NOT_FOUND` nếu không phải con của phụ huynh này.
   */
  private requireChild(parentId: string, childId: string): void {
    const child = this.children.getChild(parentId, childId);
    if (!child) throw errors.childNotFound();
  }

  /** Đọc toàn bộ tiến độ của một bé (đã kiểm quyền ở tầng gọi). */
  private readSnapshot(childId: string, floor: string | null): ProgressSnapshot {
    const clause = floor === null ? '' : ' AND updated_at >= ?';
    const args: unknown[] = floor === null ? [childId] : [childId, floor];

    const words = this.db
      .prepare(`SELECT * FROM word_progress WHERE child_id = ?${clause} ORDER BY word_id`)
      .all(...args) as WordRow[];

    const lessons = this.db
      .prepare(`SELECT * FROM lesson_progress WHERE child_id = ?${clause} ORDER BY lesson_id`)
      .all(...args) as LessonRow[];

    const themes = this.db
      .prepare(`SELECT * FROM theme_progress WHERE child_id = ?${clause} ORDER BY theme_id`)
      .all(...args) as ThemeRow[];

    const dailyStats = this.db
      .prepare(`SELECT * FROM daily_stats WHERE child_id = ?${clause} ORDER BY date`)
      .all(...args) as DailyRow[];

    return {
      childId,
      words: words.map(toWordProgress),
      lessons: lessons.map(toLessonProgress),
      themes: themes.map(toThemeProgress),
      dailyStats: dailyStats.map(dailyStatToDto),
      serverTime: nowIso(),
    };
  }

  /**
   * Áp một sự kiện, ĐÚNG MỘT LẦN. Trả `false` nếu sự kiện này đã được áp trước đó.
   *
   * ⚠️ THỨ TỰ CÓ RÀNG BUỘC: ghi vào sổ `progress_event` TRƯỚC, rồi mới cập nhật tiến độ.
   *    Nếu làm ngược lại (cập nhật rồi mới ghi sổ), một lỗi giữa hai bước sẽ để lại tiến độ
   *    đã tăng mà sổ không ghi ⇒ lần gửi lại sẽ CỘNG THÊM LẦN NỮA. Ghi sổ trước thì lỗi giữa
   *    hai bước chỉ làm mất một sự kiện — và cả hai bước nằm trong cùng transaction nên kỳ
   *    thực tế không có trạng thái trung gian nào cả. Thứ tự này là lớp bảo vệ thứ hai.
   */
  private applyEventOnce(db: Db, childId: string, event: ProgressEvent): boolean {
    const inserted = db
      .prepare(
        `INSERT OR IGNORE INTO progress_event (client_event_id, child_id, kind, occurred_at, applied_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(event.clientEventId, childId, event.kind, event.occurredAt, nowIso());

    // `changes === 0` nghĩa là khoá chính đã tồn tại ⇒ sự kiện này đã được áp ở lần gửi trước.
    if (inserted.changes === 0) return false;

    switch (event.kind) {
      case 'word_answer':
        if (event.wordId) {
          this.applyWordAnswerInTx(db, childId, event.wordId, event.correct === true, event.occurredAt);
        }
        break;
      case 'word_learned':
        if (event.wordId) {
          this.applyWordLearned(db, childId, event.wordId, event.occurredAt);
        }
        break;
      case 'lesson_completed':
        if (event.lessonId) {
          this.applyLessonCompleted(db, childId, event.lessonId, event.occurredAt);
          /**
           * ⭐ BÁO CHO NHIỆM VỤ (T058) — trong CÙNG transaction này.
           *
           * ⚠️ VÌ SAO ĐẶT Ở ĐÂY, NGAY SAU `applyLessonCompleted`, CHỨ KHÔNG Ở ROUTE:
           *   Đây là chỗ DUY NHẤT biết chắc "bài này vừa được tính là hoàn thành", và nó nằm
           *   trong transaction đã mở của `sync()`. Gọi từ route (sau khi `sync` xong) sẽ tạo ra
           *   một khoảng thời gian mà `lesson_progress` đã ghi còn `quest_progress` thì chưa —
           *   bé học xong bài, nhiệm vụ "Học 1 bài mới" vẫn hiện 0/1, và nếu request thứ hai
           *   không bao giờ tới thì tiến độ nhiệm vụ MẤT cho tới lần học bài sau.
           *
           * ⚠️ VÀ CHỈ Ở NHÁNH NÀY. `applyEventOnce` đã chặn sự kiện trùng bằng khoá chính của
           *   `progress_event`, nên mỗi bài chỉ được báo cho nhiệm vụ ĐÚNG MỘT LẦN. Gọi nó ở
           *   ngoài `switch` (cho mọi loại sự kiện) sẽ khiến `word_answer` cũng cộng tiến độ
           *   nhiệm vụ "học 1 bài" — sai, và sai theo kiểu im lặng.
           */
          this.quests.applyEventInTx(
            db,
            childId,
            { kind: 'lesson_completed', lessonId: event.lessonId },
            event.occurredAt,
          );

          /**
           * ⭐ HUY HIỆU THEO THÀNH TÍCH (T068) — chấm NGAY TẠI ĐÂY, trong CÙNG transaction.
           *
           * ⚠️ VÌ SAO Ở ĐÂY: `applyLessonCompleted` vừa đặt `completed = 1` cho bài này — đó là
           *    định nghĩa "hoàn thành" duy nhất của dự án (xem quyết định 1 ở đầu `BadgeService`).
           *    Đây là thời điểm DUY NHẤT nó trở thành đúng, và đây là transaction duy nhất nó
           *    thuộc về. `badge_earned` được ghi (nếu có huy hiệu mới) trong cùng đơn vị công
           *    việc với `lesson_progress` — nên không bao giờ có huy hiệu cho một bài chưa thật sự
           *    được ghi (hay ngược lại).
           *
           * ⭐ GIÁ TRỊ TRẢ VỀ BỊ BỎ ĐI, VÀ ĐÓ LÀ CHỦ Ý: `ProgressSyncResponse` (hợp đồng HTTP của
           *    luồng này) KHÔNG có trường báo huy hiệu — nó chỉ trả ảnh chụp tiến độ. Huy hiệu vừa
           *    trao sẽ xuất hiện trong lần đọc `GET /api/children/:id/rewards` kế tiếp
           *    (`RewardSnapshot.badges`). Thêm một trường vào hợp đồng đồng bộ chỉ để báo một
           *    thông báo sẽ là mở rộng API ngoài phạm vi T068; màn hình Bộ sưu tập (T070) đọc
           *    ảnh chụp thưởng nên nó luôn thấy đúng.
           */
          this.badges.evaluate(db, childId, event.occurredAt);
        }
        break;
    }

    /**
     * ⭐ NỐI CHUỖI NGÀY (T068.2) — MỌI sự kiện tiến độ ở đây đều là hoạt động HỌC
     *    (`word_answer` / `word_learned` / `lesson_completed`), nên tất cả đều tính vào chuỗi.
     *    Cùng định nghĩa "ngày học" mà nhiệm vụ `learn_days` dùng: `countLearnDays` đếm một ngày
     *    là ngày học nếu có `progress_event` trong ngày đó — chính là chỗ này.
     *
     *    ⚠️ Đặt SAU `switch` và TRƯỚC `return true` (KHÔNG nằm trong một nhánh của `switch`): mọi
     *       `kind` đều là học, nên không có nhánh nào đúng hơn nhánh nào. Và `applyEventOnce` đã
     *       trả `false` sớm khi sự kiện TRÙNG ⇒ gửi lại không làm chuỗi nhảy hai lần.
     */
    touchStreakInTx(db, childId, localDateKey(new Date(event.occurredAt)), event.occurredAt);

    return true;
  }

  /**
   * Một câu trả lời mới ⇒ CỘNG vào số đếm (xem quyết định 2 ở đầu file).
   *
   * `mastered` dính: đã đạt ngưỡng thì không bao giờ mất, dù sau đó bé trả lời sai.
   *
   * ⚠️⚠️ HÀM NÀY LÀ **API CÔNG KHAI** CHO SERVICE KHÁC (T049 — `GameResultService`), KHÔNG
   *    PHẢI HÀM NỘI BỘ. Vì sao phải để công khai thay vì viết lại ở nơi gọi: đây là chỗ DUY
   *    NHẤT định nghĩa "một câu trả lời làm gì với sổ của bé" — cộng đúng/sai, đóng dấu
   *    `learned`, và chạm ngưỡng `MASTERED_THRESHOLD`. Nếu `GameResultService` tự viết một
   *    bản SQL tương tự, hai bản sẽ lệch nhau ngay lần đầu ai đó sửa ngưỡng "nhớ chắc", và
   *    triệu chứng là cùng một bé mà số từ "đã nhớ" khác nhau tuỳ bé vào từ màn hình nào.
   *
   * ⚠️ BẮT BUỘC gọi bên trong một transaction của BÊN GỌI: hàm này tự mở transaction riêng thì
   *    không gộp được với việc ghi `game_result` ở cùng lượt, và sẽ có lúc tiến độ đã cộng mà
   *    lượt chơi chưa được ghi.
   */
  applyWordAnswerInTx(
    db: Db,
    childId: string,
    wordId: string,
    correct: boolean,
    occurredAt: string,
  ): void {
    const row = db
      .prepare('SELECT * FROM word_progress WHERE child_id = ? AND word_id = ?')
      .get(childId, wordId) as WordRow | undefined;

    const prev = row ? toWordProgress(row) : null;
    const correctCount = (prev?.correctCount ?? 0) + (correct ? 1 : 0);
    const wrongCount = (prev?.wrongCount ?? 0) + (correct ? 0 : 1);
    const mastered = (prev?.mastered ?? false) || correctCount >= MASTERED_THRESHOLD;
    const updatedAt = laterIso(prev?.updatedAt ?? '', occurredAt);
    const lastSeenAt = laterIso(prev?.lastSeenAt ?? '', occurredAt);

    db.prepare(
      `INSERT INTO word_progress
         (child_id, word_id, learned, mastered, correct_count, wrong_count, last_seen_at, updated_at)
       VALUES (?, ?, 1, ?, ?, ?, ?, ?)
       ON CONFLICT (child_id, word_id) DO UPDATE SET
         learned       = 1,
         mastered      = excluded.mastered,
         correct_count = excluded.correct_count,
         wrong_count   = excluded.wrong_count,
         last_seen_at  = excluded.last_seen_at,
         updated_at    = excluded.updated_at`,
    ).run(
      childId,
      wordId,
      mastered ? 1 : 0,
      correctCount,
      wrongCount,
      lastSeenAt,
      updatedAt,
    );
  }

  /** Bé đánh dấu "đã học" một từ trong flashcard (không qua trả lời). */
  private applyWordLearned(db: Db, childId: string, wordId: string, occurredAt: string): void {
    const row = db
      .prepare('SELECT * FROM word_progress WHERE child_id = ? AND word_id = ?')
      .get(childId, wordId) as WordRow | undefined;

    const prev = row ? toWordProgress(row) : null;
    const updatedAt = laterIso(prev?.updatedAt ?? '', occurredAt);
    const lastSeenAt = laterIso(prev?.lastSeenAt ?? '', occurredAt);

    db.prepare(
      `INSERT INTO word_progress
         (child_id, word_id, learned, mastered, correct_count, wrong_count, last_seen_at, updated_at)
       VALUES (?, ?, 1, 0, 0, 0, ?, ?)
       ON CONFLICT (child_id, word_id) DO UPDATE SET
         learned      = 1,
         last_seen_at = excluded.last_seen_at,
         updated_at   = excluded.updated_at`,
    ).run(childId, wordId, lastSeenAt, updatedAt);
  }

  /** Bé hoàn thành một bài. Không tạo bản ghi nếu bài chưa từng được chơi. */
  private applyLessonCompleted(
    db: Db,
    childId: string,
    lessonId: string,
    occurredAt: string,
  ): void {
    const row = db
      .prepare('SELECT * FROM lesson_progress WHERE child_id = ? AND lesson_id = ?')
      .get(childId, lessonId) as LessonRow | undefined;

    const prev = row ? toLessonProgress(row) : null;
    const updatedAt = laterIso(prev?.updatedAt ?? '', occurredAt);
    const completedAt = laterIso(prev?.completedAt ?? '', occurredAt);

    db.prepare(
      `INSERT INTO lesson_progress
         (child_id, lesson_id, best_score, stars_best, attempts, completed, completed_at, updated_at)
       VALUES (?, ?, 0, 0, 1, 1, ?, ?)
       ON CONFLICT (child_id, lesson_id) DO UPDATE SET
         attempts     = attempts + 1,
         completed    = 1,
         completed_at = excluded.completed_at,
         updated_at   = excluded.updated_at`,
    ).run(childId, lessonId, completedAt, updatedAt);
  }

  // ===========================================================================
  // API CHO CÁC SERVICE KHÁC (T049 — `GameResultService`)
  // ===========================================================================
  //
  // ⚠️ MỌI HÀM DƯỚI ĐÂY PHẢI ĐƯỢC GỌI TRONG TRANSACTION CỦA BÊN GỌI.
  //   Chúng KHÔNG tự mở transaction. Lý do: một lượt chơi game phải được ghi TRỌN VẸN —
  //   dòng `game_result` (chống trùng) + tiến độ từng từ + kỷ lục bài + thống kê ngày. Nếu
  //   mỗi phần tự mở transaction riêng, một lỗi ở phần thứ ba sẽ để lại trạng thái nửa vời:
  //   lượt chơi đã bị đánh dấu là "đã ghi" (nên lần gửi lại sẽ bị chặn) nhưng điểm thì chưa
  //   cộng. Bé mất lượt chơi đó VĨNH VIỄN và không có cách nào phát hiện.
  //
  //   Đây cũng là lý do các hàm này nhận `db` làm tham số đầu: nó buộc người gọi phải đang
  //   ở trong một transaction (họ phải có `db` để truyền vào).

  /**
   * Áp một LÔ câu trả lời vào sổ từ vựng.
   *
   * Dùng bởi T049: một lượt chơi game được quy về danh sách "câu trả lời" y như trong
   * flashcard, nên nó đi đúng con đường cộng dồn như mọi câu trả lời khác.
   *
   * ⭐ VÌ SAO CẦN `newlyLearned`: mỗi câu trả lời đặt `learned = 1`. Nhưng thống kê ngày cần
   *   biết "HÔM NAY bé học được thêm bao nhiêu từ MỚI", chứ không phải "tổng số từ bé đã
   *   chạm". Hiệu số đó chỉ tính được NGAY TRƯỚC và NGAY SAU khi áp lô này — sau khi áp rồi
   *   thì mọi từ đều `learned = 1` và thông tin "từ này mới hay cũ" đã biến mất. Vì vậy hàm
   *   này đọc trạng thái cũ trước, áp, rồi đếm.
   */
  applyWordAttemptsInTx(
    db: Db,
    childId: string,
    attempts: ReadonlyArray<{ wordId: string; correct: boolean }>,
    occurredAt: string,
  ): { newlyLearned: number } {
    if (attempts.length === 0) return { newlyLearned: 0 };

    // Đọc trạng thái "đã học" TRƯỚC khi áp — xem ghi chú ở trên về lý do không thể làm sau.
    const distinctWordIds = [...new Set(attempts.map((a) => a.wordId))];
    const alreadyLearned = new Set<string>();
    const probe = db.prepare('SELECT learned FROM word_progress WHERE child_id = ? AND word_id = ?');
    for (const wordId of distinctWordIds) {
      const row = probe.get(childId, wordId) as { learned: number } | undefined;
      if (row?.learned) alreadyLearned.add(wordId);
    }

    for (const attempt of attempts) {
      this.applyWordAnswerInTx(db, childId, attempt.wordId, attempt.correct, occurredAt);
    }

    const newlyLearned = distinctWordIds.filter((wordId) => !alreadyLearned.has(wordId)).length;
    return { newlyLearned };
  }

  /**
   * Cập nhật KỶ LỤC của một bài học sau một lượt chơi game.
   *
   * ⚠️⚠️ HAI CỘT NÀY **KHÔNG BAO GIỜ GIẢM** — đó là lời hứa với bé, ghi rõ ở migration 003:
   *    *"chơi lại kém hơn không làm mất kỷ lục"*. Vì vậy dùng `Math.max(prev, score)`, KHÔNG
   *    phải LWW theo `updated_at`. Nếu dùng LWW, một lượt chơi lại điểm thấp sẽ xoá mất kỷ lục
   *    cũ chỉ vì nó xảy ra sau — và bé sẽ thấy số sao của mình tụt xuống.
   *
   * ⚠️ HÀM NÀY **KHÔNG** SỬA `attempts` VÀ `completed` — dù hai cột đó cũng nằm trong bảng này.
   *    Lý do: chúng đã có một chủ sở hữu duy nhất là `applyLessonCompleted()` (sinh ra từ sự
   *    kiện `lesson_completed` của luồng flashcard). Nếu ở đây cũng cộng `attempts`, số lần
   *    "chơi bài" và số lần "học xong bài" sẽ trộn vào nhau trong cùng một cột, và không ai
   *    còn biết con số đó đang đếm cái gì. **Một cột, một chủ sở hữu.**
   *
   * Trả về kỷ lục SAU khi cập nhật để route trả thẳng cho client (không phải đọc lại).
   */
  applyGameScoreInTx(
    db: Db,
    childId: string,
    lessonId: string,
    score: number,
    stars: StarRating,
    occurredAt: string,
  ): { bestScore: number; bestStars: 0 | 1 | 2 | 3; isNewRecord: boolean } {
    const row = db
      .prepare('SELECT * FROM lesson_progress WHERE child_id = ? AND lesson_id = ?')
      .get(childId, lessonId) as LessonRow | undefined;

    const prev = row ? toLessonProgress(row) : null;
    const prevBestScore = prev?.bestScore ?? 0;
    const prevBestStars = prev?.starsBest ?? 0;

    const bestScore = Math.max(prevBestScore, Math.max(0, score));
    const bestStars = clampStarsBest(Math.max(prevBestStars, stars));
    const isNewRecord = Math.max(0, score) > prevBestScore;
    const updatedAt = laterIso(prev?.updatedAt ?? '', occurredAt);

    db.prepare(
      `INSERT INTO lesson_progress
         (child_id, lesson_id, best_score, stars_best, attempts, completed, completed_at, updated_at)
       VALUES (?, ?, ?, ?, 0, 0, NULL, ?)
       ON CONFLICT (child_id, lesson_id) DO UPDATE SET
         best_score = excluded.best_score,
         stars_best = excluded.stars_best,
         updated_at = excluded.updated_at`,
    ).run(childId, lessonId, bestScore, bestStars, updatedAt);

    return { bestScore, bestStars, isNewRecord };
  }

  /**
   * Cộng dồn thống kê của MỘT NGÀY (bảng `daily_stats`).
   *
   * ⚠️ VÌ SAO Ở ĐÂY LÀ **CỘNG DỒN** TRONG KHI `mergeDailyStat` LẠI DÙNG LWW:
   *   Vì hai chỗ trả lời hai câu hỏi khác nhau.
   *     • `mergeDailyStat` gộp HAI ẢNH CHỤP của cùng một khoảng thời gian (client ↔ server).
   *       Cộng ở đó sẽ đếm hai lần cùng một sự việc.
   *     • Hàm này áp MỘT sự việc MỚI vào một ngày. Một lượt chơi mới thực sự làm tăng số câu
   *       bé đã trả lời, nên phải cộng.
   *   Điều kiện để phép cộng này an toàn là **chống ghi trùng**: `GameResultService` chỉ gọi
   *   hàm này SAU khi đã chèn được dòng `game_result` với `client_event_id` mới. Gửi lại cùng
   *   một lượt chơi sẽ dừng ở cổng đó và không bao giờ tới đây. Cùng cơ chế và cùng lý do như
   *   "quyết định 2" ở đầu file — **đừng bỏ cái này mà giữ cái kia**.
   *
   * ⭐ PHƯƠNG THỨC NÀY NAY CHỈ LÀ VỎ UỶ QUYỀN xuống `dailyStats.applyDailyStatInTx`.
   *   Câu SQL không còn nằm ở đây vì bảng `daily_stats` có NGƯỜI GHI THỨ HAI: `QuestService.claim`
   *   (quà nhiệm vụ cũng phải vào báo cáo phụ huynh). Mà `QuestService` không thể `import` file
   *   này (hai module import nhau ⇒ server không khởi động được — xem ghi chú đầu `dailyStats.ts`).
   *   Hai bản SQL cho cùng một luật cộng dồn sẽ lệch nhau, nên chỉ giữ MỘT bản, ở module lá.
   *
   *   Chữ ký và hành vi KHÔNG ĐỔI ⇒ mọi lời gọi hiện có (`GameResultService`, test) giữ nguyên.
   */
  applyDailyStatInTx(
    db: Db,
    childId: string,
    dateKey: string,
    delta: {
      wordsLearned: number;
      questionsAnswered: number;
      correctCount: number;
      activeSeconds: number;
      /**
       * ⭐ / 🌰 / XP THỰC SỰ được trao cho bé trong sự việc này — TÙY CHỌN, mặc định 0 (T054).
       *
       * ⚠️ VÌ SAO PHẢI CÓ BA TRƯỜNG NÀY Ở ĐÂY:
       *   `daily_stats` là NGUỒN DUY NHẤT cho báo cáo phụ huynh ("hôm nay con học được bao
       *   nhiêu?"). Trước T054, ba cột `stars_earned`/`acorns_earned`/`xp_earned` chỉ được ĐỌC
       *   (`dailyStatToDto`) mà KHÔNG AI GHI — chúng vĩnh viễn bằng 0. Điều đó vô hại khi ví chưa
       *   tồn tại, nhưng từ T054 ví bắt đầu tăng thật. Giữ nguyên hiện trạng nghĩa là phụ huynh
       *   mở báo cáo thấy 0 ⭐ trong khi số dư của con tăng đều — một con số SAI, không phải một
       *   tính năng còn thiếu.
       *
       * ⚠️ HỆ QUẢ CẦN BIẾT: giá trị truyền vào phải là SỐ THỰC SỰ ĐƯỢC TRAO (kể cả quà lên cấp),
       *   không phải "phần thưởng lẽ ra được nhận". Một lượt chơi vượt 2 cấp làm ví tăng nhiều
       *   hơn phần thưởng của ván — báo cáo phải khớp với ví, nếu không thì không ai tin được cả
       *   hai con số.
       */
      starsEarned?: number;
      acornsEarned?: number;
      xpEarned?: number;
    },
    occurredAt: string,
  ): void {
    writeDailyStat(db, childId, dateKey, delta, occurredAt);
  }
}

/**
 * Mốc sàn cho ảnh chụp trả về: `min(since, mọi occurredAt trong lô)`.
 *
 * ⭐ VÌ SAO KHÔNG DÙNG THẲNG `since`:
 *   Bé chơi offline từ 08:00, lần đồng bộ trước là 09:00, giờ bé gửi lên 20 sự kiện của lúc
 *   08:00. Server áp xong, các bản ghi có `updated_at = 08:00`. Lọc theo `since = 09:00` sẽ
 *   **KHÔNG trả về bản ghi nào** — client vẫn giữ bản của nó nên không mất dữ liệu, nhưng
 *   nếu bé vừa cài lại app (máy trống) thì nó sẽ không bao giờ nhận được tiến độ cũ.
 *   Đó là lỗi im lặng và cực khó truy.
 *
 * ⭐ VÌ SAO `min(...occurredAt)` LÀ AN TOÀN (chứng minh):
 *   Mọi bản ghi vừa được áp đều có `updated_at = max(updated_at cũ, occurredAt)`.
 *   ⇒ `updated_at >= occurredAt >= min(...occurredAt) = floor`.
 *   Vậy điều kiện `updated_at >= floor` BAO GỒM mọi bản ghi vừa áp, và cũng bao gồm mọi bản
 *   ghi mới hơn `since` mà thiết bị khác đã tạo. Không bản ghi nào bị bỏ sót.
 *
 * Trả `null` khi không có mốc nào (lần đồng bộ đầu tiên) ⇒ lấy toàn bộ.
 */
export function resolveFloor(
  since: string | null,
  events: readonly ProgressEvent[],
): string | null {
  let floor: string | null = since;
  for (const event of events) {
    if (floor === null || event.occurredAt < floor) floor = event.occurredAt;
  }
  return floor;
}

/** Dùng chung một instance. */
export const progressService = new ProgressService();
