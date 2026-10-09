// @vitest-environment node
/**
 * RubyLingo — chốt chặn cho `QuestService` (T058).
 *
 * ⭐⭐ VÌ SAO TỆP NÀY TỒN TẠI — BA LỖI IM LẶNG MÀ CHỈ TEST NÀY BẮT ĐƯỢC:
 *
 *  1. **ĐIỂM/QUÀ PHỒNG LÊN VĨNH VIỄN.** Nếu `advanceQuest` cộng dồn một tiêu chí SUY DIỄN
 *     (`learn_days`, `collect_stickers`, `unlock_theme`…), thì mỗi lần client gửi lại một sự
 *     kiện là tiến độ lại nhảy thêm. Bé mở app là xong nhiệm vụ tuần. Ví vẫn tăng "hợp lệ",
 *     không có exception nào, và màn hình chỉ hiện con số lớn hơn — không ai thấy sai.
 *  2. **NHẬN QUÀ HAI LẦN.** Cổng `claimed` phải nằm trong mệnh đề `WHERE` của câu `UPDATE`
 *     (giống `RewardService.spendInTx`). Nếu ai đó "dọn dẹp" nó thành một `if` ở tầng JS
 *     đọc-rồi-ghi thì hai lần bấm gần nhau cùng thấy `claimed = 0` và cùng trao quà. Test
 *     "nhận lần hai" bên dưới là thứ duy nhất bắt được điều đó.
 *  3. **BÁO CÁO PHỤ HUYNH LỆCH VỚI VÍ.** Quà nhiệm vụ mà không ghi vào `daily_stats` thì phụ
 *     huynh thấy tổng ⭐ nhỏ hơn số dư trong ví — hai con số nói về cùng một thứ, không ai
 *     tin được con số nào. Không có test nào khác kiểm đường ghi này của `QuestService`.
 *
 * ⚠️ TỆP NÀY CỐ Ý CHỐT CẢ NHỮNG HÀNH VI "TRÔNG LẠ" ĐÃ ĐƯỢC GHI TRONG MÃ:
 *   • `unlock_theme` (qw-03) XONG NGAY từ sự kiện đầu tiên của kỳ, vì nội dung Starters hiện
 *     có đúng một chủ đề chơi được (`at-the-zoo`). Đây là hệ quả ĐÃ CHẤP NHẬN, ghi rõ ở
 *     `countPlayableThemes()`. Test `⑥` ghi lại để nó không đổi trong im lặng.
 *   • `applyEventInTx` KHÔNG tự chống ghi trùng. Cổng chống trùng nằm ở NGƯỜI GỌI
 *     (`progress_event.client_event_id` / `game_result.client_event_id` — cả hai là khoá
 *     chính/UNIQUE). Test `⑧` ghim ranh giới đó: đổi nó đi là phải sửa CẢ hai đầu.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDb, getDb, transaction, type Db } from '../../../server/db/connection.js';
import { AppError } from '../../../server/plugins/errors.js';
import { authService } from '../../../server/services/AuthService.js';
import { childService } from '../../../server/services/ChildService.js';
import { applyDailyStatInTx } from '../../../server/services/dailyStats.js';
import {
  combineQuestProgress,
  isCounterCriteria,
  questEventDelta,
  questService,
  type QuestEvent,
} from '../../../server/services/QuestService.js';
import { rewardService } from '../../../server/services/RewardService.js';
import { xpService } from '../../../server/services/XpService.js';
import {
  dailyPeriodKey,
  localDateKey,
  periodKeyForTier,
  weeklyPeriodKey,
} from '../../../server/lib/time.js';
import { DEFAULT_CONTENT_LEVEL_ID, themeIdsWithGames } from '../../../shared/content/content-index.js';
import { QUESTS, getQuest, questTarget } from '../../../shared/content/quests.js';

import { clearAllData, setupTestDb } from './helpers/testDb.js';

// =============================================================================
// Bối cảnh dùng chung
// =============================================================================

/**
 * Mốc thời gian CỐ ĐỊNH cho mọi test — thứ Sáu, 2026-10-09 UTC.
 *
 * ⭐ Vì sao chọn THỨ SÁU: nhiệm vụ tuần `qw-02` cần BỐN ngày trong cùng một tuần ISO. Tuần
 *    chứa 2026-10-09 bắt đầu Thứ Hai 2026-10-05 và tới Chủ Nhật 2026-10-11, nên từ thứ Sáu
 *    ta lui được năm ngày vẫn trong tuần. Chọn giữa tuần sẽ chỉ có ba ngày ⇒ test không dựng
 *    được ca "đủ bốn ngày".
 *
 * ⚠️ Mọi lời gọi (`listForChild`, `claim`, `applyEventInTx`) đều nhận `now`/`at` tường minh,
 *    nên test không phụ thuộc ngày chạy. Một test đọc đồng hồ hệ thống sẽ đỏ vào đúng đêm
 *    giao thừa và xanh trở lại — loại test tệ nhất.
 */
const NOW = new Date('2026-10-09T09:00:00.000Z');
const AT = NOW.toISOString();

const PASSWORD = 'matkhau123';

let parentId = '';
let childId = '';

// `signup` là async (nó băm mật khẩu) và `createChild` là sync, nên dựng bối cảnh phải nằm
// trong `beforeEach` async. Mọi test đều đi qua đây ⇒ không test nào phải tự lo hồ sơ bé.
beforeAll(() => {
  setupTestDb();
});

beforeEach(async () => {
  clearAllData(getDb());
  parentId = (await authService.signup({ email: 'bo@example.com', password: PASSWORD, parentalConsent: true }))
    .parent.id;
  childId = childService.createChild(parentId, { nickname: 'Bin', age: 7, avatarId: 'fox' }).id;
});

afterAll(() => {
  closeDb();
});

// =============================================================================
// Tiện ích test
// =============================================================================

/**
 * Mã lỗi của một lời gọi ném lỗi. Trả chuỗi mô tả khi ném thứ KHÁC `AppError` hoặc không ném
 * gì — để thất bại đọc được ngay thay vì `undefined` khó hiểu.
 */
function errorCodeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof AppError ? error.code : `KHÔNG-PHẢI-AppError: ${String(error)}`;
  }
  return 'KHÔNG-NÉM-LỖI';
}

/** Bắn một sự kiện vào tiến độ nhiệm vụ, trong transaction như mọi người gọi thật. */
function fire(event: QuestEvent, at: string = AT): string[] {
  return transaction((db) => questService.applyEventInTx(db, childId, event, at));
}

function questRows(childIdArg: string = childId): Array<Record<string, unknown>> {
  return getDb()
    .prepare('SELECT * FROM quest_progress WHERE child_id = ? ORDER BY quest_id')
    .all(childIdArg) as Array<Record<string, unknown>>;
}

function questRow(questId: string, periodKey: string): Record<string, unknown> | undefined {
  return getDb()
    .prepare('SELECT * FROM quest_progress WHERE child_id = ? AND quest_id = ? AND period_key = ?')
    .get(childId, questId, periodKey) as Record<string, unknown> | undefined;
}

function dailyStatRow(dateKey: string): Record<string, number> | undefined {
  return getDb()
    .prepare('SELECT * FROM daily_stats WHERE child_id = ? AND date = ?')
    .get(childId, dateKey) as Record<string, number> | undefined;
}

/**
 * Đánh dấu một bài đã xong, ghi thẳng vào `lesson_progress`.
 *
 * ⚠️ Đây KHÔNG phải đường vòng để "làm giả" trạng thái: `QuestService` CHỈ ĐỌC bảng này
 *    (`ProgressService` mới là bên ghi). Test nào cần "bé đã xong bài X TRƯỚC khi service
 *    được gọi" thì phải tự dựng tiền đề đó — đúng như nhiệm vụ mốc `qm-01` mô tả.
 */
function markLessonComplete(lessonId: string): void {
  getDb()
    .prepare(
      `INSERT INTO lesson_progress
         (child_id, lesson_id, best_score, stars_best, attempts, completed, completed_at, updated_at)
       VALUES (?, ?, 100, 3, 1, 1, ?, ?)
       ON CONFLICT (child_id, lesson_id) DO UPDATE SET
         completed = 1, completed_at = excluded.completed_at, updated_at = excluded.updated_at`,
    )
    .run(childId, lessonId, AT, AT);
}

/** Tìm một nhiệm vụ trong kết quả `listForChild` — ném nếu không có (id gõ sai phải lộ ra). */
function questOf(quests: Array<{ id: string }>, questId: string): Record<string, unknown> {
  const found = quests.find((quest) => quest.id === questId);
  if (!found) throw new Error(`không có nhiệm vụ "${questId}" trong kết quả`);
  return found as unknown as Record<string, unknown>;
}

/**
 * Các khoá ngày (YYYY-MM-DD) thuộc CÙNG kỳ TUẦN với `now`, mới nhất trước.
 *
 * ⚠️ Tính bằng chính `periodKeyForTier` của hệ thống, KHÔNG tự suy ra lịch ISO trong test:
 *    nếu `weeklyPeriodKey` đổi luật thì test này đi theo nó, chứ không đỏ oan.
 */
function dateKeysInSameWeek(now: Date, count: number): string[] {
  const want = weeklyPeriodKey(now);
  const out: string[] = [];
  for (let back = 0; back < 14 && out.length < count; back += 1) {
    const key = localDateKey(new Date(now.getTime() - back * 86_400_000));
    if (periodKeyForTier('weekly', new Date(`${key}T00:00:00Z`)) === want) out.push(key);
  }
  return out;
}

// =============================================================================
// Luật THUẦN — không cần DB, chạy trong vài mili giây
// =============================================================================

describe('isCounterCriteria — tiêu chí ĐẾM hay SUY DIỄN', () => {
  it('ba tiêu chí ĐẾM đúng là đếm', () => {
    expect(isCounterCriteria({ kind: 'complete_lessons', count: 1 })).toBe(true);
    expect(isCounterCriteria({ kind: 'play_games', count: 3 })).toBe(true);
    expect(isCounterCriteria({ kind: 'correct_answers', count: 12 })).toBe(true);
  });

  it('sáu tiêu chí SUY DIỄN đúng là suy diễn', () => {
    expect(isCounterCriteria({ kind: 'complete_lesson', lessonId: 'at-the-zoo/z1' })).toBe(false);
    expect(isCounterCriteria({ kind: 'complete_theme', themeId: 'at-the-zoo' })).toBe(false);
    expect(isCounterCriteria({ kind: 'learn_days', count: 4 })).toBe(false);
    expect(isCounterCriteria({ kind: 'unlock_theme', count: 1 })).toBe(false);
    expect(isCounterCriteria({ kind: 'collect_stickers', count: 6 })).toBe(false);
    expect(isCounterCriteria({ kind: 'reach_level', level: 3 })).toBe(false);
  });

  it('LUẬT NÀY KHÔNG BAO GIỜ ĐƯỢC LỆCH VỚI DANH MỤC NHIỆM VỤ', () => {
    // Mọi tiêu chí đang dùng phải được hàm trên phân loại mà không cần nhánh `default`.
    // Thêm một `kind` mới rồi quên khai ở đây ⇒ nhiệm vụ đó âm thầm bị coi là SUY DIỄN và
    // `deriveProgress` trả 0 ⇒ không bao giờ xong. Test này biến lỗi im lặng thành lỗi đỏ.
    const counterKinds = new Set(['complete_lessons', 'play_games', 'correct_answers']);
    for (const quest of QUESTS) {
      expect(isCounterCriteria(quest.criteria), `${quest.id} (${quest.criteria.kind})`).toBe(
        counterKinds.has(quest.criteria.kind),
      );
    }
  });
});

describe('questEventDelta — sự kiện này cộng thêm bao nhiêu', () => {
  it('hoàn thành bài: chỉ cộng cho `complete_lessons`, không cộng cho ai khác', () => {
    const event: QuestEvent = { kind: 'lesson_completed', lessonId: 'at-the-zoo/z1' };
    expect(questEventDelta({ kind: 'complete_lessons', count: 1 }, event)).toBe(1);
    expect(questEventDelta({ kind: 'play_games', count: 3 }, event)).toBe(0);
    expect(questEventDelta({ kind: 'correct_answers', count: 12 }, event)).toBe(0);
  });

  it('chơi game: mặc định 1, tôn trọng `count`', () => {
    expect(questEventDelta({ kind: 'play_games', count: 3 }, { kind: 'game_played' })).toBe(1);
    expect(questEventDelta({ kind: 'play_games', count: 3 }, { kind: 'game_played', count: 3 })).toBe(3);
  });

  it('chơi game: `count` âm hoặc 0 ⇒ 0, KHÔNG BAO GIỜ trừ tiến độ', () => {
    expect(questEventDelta({ kind: 'play_games', count: 3 }, { kind: 'game_played', count: 0 })).toBe(0);
    expect(questEventDelta({ kind: 'play_games', count: 3 }, { kind: 'game_played', count: -5 })).toBe(0);
  });

  it('chơi game: `count` lẻ bị cắt phần thập phân (không có "nửa ván game")', () => {
    expect(questEventDelta({ kind: 'play_games', count: 3 }, { kind: 'game_played', count: 2.9 })).toBe(2);
    expect(questEventDelta({ kind: 'correct_answers', count: 12 }, { kind: 'correct_answers', count: 4.7 })).toBe(4);
  });

  it('câu trả lời đúng: cộng theo `count`', () => {
    expect(questEventDelta({ kind: 'correct_answers', count: 12 }, { kind: 'correct_answers', count: 12 })).toBe(12);
    expect(questEventDelta({ kind: 'correct_answers', count: 12 }, { kind: 'correct_answers', count: -1 })).toBe(0);
  });

  it('TIÊU CHÍ SUY DIỄN KHÔNG BAO GIỜ NHẬN `delta` — kể cả khi sự kiện "khớp" về nghĩa', () => {
    // Đây là bất biến quan trọng nhất của tệp: một tiêu chí suy diễn mà cộng dồn thì đúng
    // lên gấp nhiều lần mỗi khi client gửi lại một sự kiện.
    const events: QuestEvent[] = [
      { kind: 'lesson_completed', lessonId: 'at-the-zoo/z1' },
      { kind: 'game_played', count: 5 },
      { kind: 'correct_answers', count: 9 },
    ];
    const derived = [
      { kind: 'complete_lesson', lessonId: 'at-the-zoo/z1' },
      { kind: 'complete_theme', themeId: 'at-the-zoo' },
      { kind: 'learn_days', count: 4 },
      { kind: 'unlock_theme', count: 1 },
      { kind: 'collect_stickers', count: 6 },
      { kind: 'reach_level', level: 3 },
    ] as const;

    for (const criteria of derived) {
      for (const event of events) {
        expect(questEventDelta(criteria, event), `${criteria.kind} × ${event.kind}`).toBe(0);
      }
    }
  });
});

describe('combineQuestProgress — luật gộp DUY NHẤT', () => {
  it('tiêu chí ĐẾM: cộng dồn, chưa tới `target` thì chưa xong', () => {
    expect(combineQuestProgress({ target: 3, prevProgress: 0, prevCompleted: false, delta: 1, derived: null })).toEqual({
      progress: 1,
      completed: false,
    });
  });

  it('tiêu chí ĐẾM: chạm `target` là xong', () => {
    expect(combineQuestProgress({ target: 3, prevProgress: 2, prevCompleted: false, delta: 1, derived: null })).toEqual({
      progress: 3,
      completed: true,
    });
  });

  it('`completed` KHÔNG BAO GIỜ quay về false', () => {
    // Nếu nó tụt được thì sẽ tồn tại hàng `claimed = 1` + `completed = 0` — trạng thái vô
    // nghĩa, và không sửa được mà không lấy lại quà của bé.
    expect(
      combineQuestProgress({ target: 3, prevProgress: 3, prevCompleted: true, delta: 0, derived: null }).completed,
    ).toBe(true);
    expect(
      combineQuestProgress({ target: 3, prevProgress: 1, prevCompleted: true, delta: 0, derived: 0 }).completed,
    ).toBe(true);
  });

  it('tiêu chí SUY DIỄN: lấy `max(hàng đã lưu, giá trị tính lại)`', () => {
    // Một sự kiện đến MUỘN có thể làm giá trị suy diễn nhỏ hơn hàng đã lưu của kỳ này.
    // Lấy thẳng `derived` sẽ làm tiến độ của kỳ TỤT xuống.
    expect(
      combineQuestProgress({ target: 6, prevProgress: 4, prevCompleted: false, delta: 0, derived: 2 }).progress,
    ).toBe(4);
    expect(
      combineQuestProgress({ target: 6, prevProgress: 2, prevCompleted: false, delta: 0, derived: 5 }).progress,
    ).toBe(5);
  });

  it('`delta` BỊ BỎ QUA khi có giá trị suy diễn (`derived !== null`)', () => {
    // Cổng chặn thật của bất biến này là `isCounterCriteria` ở hai chỗ gọi; đây là lớp thứ hai.
    expect(combineQuestProgress({ target: 6, prevProgress: 0, prevCompleted: false, delta: 99, derived: 0 })).toEqual({
      progress: 0,
      completed: false,
    });
  });

  it('số âm bị kẹp về 0: tiến độ không bao giờ âm, và `delta` âm không trừ ngược', () => {
    expect(combineQuestProgress({ target: 5, prevProgress: 5, prevCompleted: false, delta: -8, derived: null }).progress).toBe(0);
    expect(combineQuestProgress({ target: 5, prevProgress: -4, prevCompleted: false, delta: 1, derived: null }).progress).toBe(1);
    expect(combineQuestProgress({ target: 5, prevProgress: -4, prevCompleted: false, delta: 0, derived: -9 }).progress).toBe(0);
  });

  it('số thập phân bị cắt — `quest_progress.progress` là INTEGER', () => {
    expect(combineQuestProgress({ target: 5, prevProgress: 1.9, prevCompleted: false, delta: 1.9, derived: null }).progress).toBe(3);
  });
});

// =============================================================================
// `listForChild` — màn hình Nhiệm vụ (M9)
// =============================================================================

describe('QuestService.listForChild', () => {
  it('① bé mới toanh: đủ 11 nhiệm vụ, và CHỈ nhiệm vụ "mở khoá chủ đề" đã xong', () => {
    const result = questService.listForChild(parentId, childId, NOW);
    expect(result.quests.map((quest) => quest.id)).toEqual(QUESTS.map((quest) => quest.id));

    // ⭐ VÌ SAO `qw-03` XONG TỪ ĐẦU: nội dung Starters hiện có đúng một chủ đề CÓ GAME
    //   (`at-the-zoo`), và `unlock_theme` đếm số chủ đề chơi được. Đây là hệ quả ĐÃ CHẤP NHẬN
    //   và đã ghi rõ ở `countPlayableThemes()` — test ghim lại để nó không đổi trong im lặng.
    const playable = themeIdsWithGames(DEFAULT_CONTENT_LEVEL_ID).length;
    expect(playable).toBeGreaterThan(0);

    const done = result.quests.filter((quest) => quest.completed).map((quest) => quest.id);
    expect(done).toEqual(playable >= 1 ? ['qw-03'] : []);

    // `target` của MỌI nhiệm vụ phải khớp `questTarget`: đây là con số được ghi vào
    // `quest_progress.target` rồi so với `progress` để quyết định "xong chưa". Hai bên suy ra
    // hai giá trị khác nhau thì thanh tiến độ hiện "3/3" mà nút "Nhận thưởng" vẫn mờ.
    for (const quest of result.quests) {
      expect(quest.target, quest.id).toBe(questTarget(quest.criteria));
      expect(quest.claimed, quest.id).toBe(false);
    }

    // Mọi nhiệm vụ đều 0/…, TRỪ hai ca đã giải thích ở trên/dưới:
    //   • `qw-03` — `unlock_theme` xong từ đầu vì nội dung đã có một chủ đề chơi được;
    //   • `qm-03` — `reach_level` lấy CẤP HIỆN TẠI làm tiến độ, và bé mới đang ở cấp 1.
    for (const quest of result.quests) {
      if (quest.id === 'qw-03' || quest.id === 'qm-03') continue;
      expect({ id: quest.id, progress: quest.progress, completed: quest.completed }).toEqual({
        id: quest.id,
        progress: 0,
        completed: false,
      });
    }
    expect(questOf(result.quests, 'qm-03')).toMatchObject({ progress: 1, target: 3, completed: false });
  });

  it('② `target` khớp `questTarget`; `reach_level` so CẤP với CẤP (không phải "số cấp đã lên")', () => {
    const result = questService.listForChild(parentId, childId, NOW);
    const level3 = questOf(result.quests, 'qm-03');
    expect(level3.target).toBe(3);
    expect(level3.progress).toBe(1); // bé mới ⇒ cấp 1, và 1 < 3 nên chưa xong
    expect(level3.completed).toBe(false);
  });

  it('③ `periodKeys` khớp kỳ HIỆN TẠI; chuỗi ngày khởi đầu rỗng', () => {
    const result = questService.listForChild(parentId, childId, NOW);
    expect(result.periodKeys).toEqual({
      daily: dailyPeriodKey(NOW),
      weekly: weeklyPeriodKey(NOW),
    });
    expect(result.streak.currentStreak).toBe(0);
    expect(result.streak.longestStreak).toBe(0);
    expect(result.streak.lastActiveDate).toBeNull();
  });

  it('④ GET KHÔNG GHI GÌ — không được sinh hàng chỉ vì bé mở màn hình', () => {
    // Một thao tác chỉ-đọc mà ghi được thì mọi lỗi ghi sẽ hiện ra ở màn hình bé đang mở.
    expect(questRows()).toHaveLength(0);
    questService.listForChild(parentId, childId, NOW);
    questService.listForChild(parentId, childId, NOW);
    expect(questRows()).toHaveLength(0);
  });

  it('⑤ KHÔNG đọc được hồ sơ bé nhà phụ huynh khác', () => {
    expect(errorCodeOf(() => questService.listForChild('phu-huynh-la', childId, NOW))).toBe('CHILD_NOT_FOUND');
  });
});

// =============================================================================
// `applyEventInTx` — đẩy tiến độ theo sự kiện
// =============================================================================

describe('QuestService.applyEventInTx', () => {
  it('⑥ sự kiện ĐẦU TIÊN của kỳ chỉ báo `qw-03` là "vừa xong" — và không bao giờ báo lại', () => {
    expect(fire({ kind: 'game_played' })).toEqual(['qw-03']);
    expect(fire({ kind: 'game_played' })).toEqual([]);
  });

  it('⑦ hoàn thành bài: `qd-01` xong ngay, và CHỈ báo một lần', () => {
    // Thứ tự mảng theo thứ tự trong `quests.json` (qd-01 ở đầu, qw-03 ở vị trí thứ sáu).
    expect(fire({ kind: 'lesson_completed', lessonId: 'at-the-zoo/z1' })).toEqual(['qd-01', 'qw-03']);
    expect(questRow('qd-01', dailyPeriodKey(NOW))).toMatchObject({ progress: 1, target: 1, completed: 1, claimed: 0 });

    // Bài thứ hai: nhiệm vụ đã xong rồi nên KHÔNG báo lại. `progress` vẫn cộng lên 2 —
    // `qd-01` đếm số bài, còn `target` là NGƯỠNG để "xong", không phải trần.
    expect(fire({ kind: 'lesson_completed', lessonId: 'at-the-zoo/z2' })).toEqual([]);
    expect(questRow('qd-01', dailyPeriodKey(NOW))).toMatchObject({ progress: 2, completed: 1 });
  });

  it('⑧ `play_games` đếm DỒN tới `target` 3 rồi mới xong', () => {
    fire({ kind: 'game_played' });
    fire({ kind: 'game_played' });
    expect(questRow('qd-02', dailyPeriodKey(NOW))).toMatchObject({ progress: 2, completed: 0 });

    expect(fire({ kind: 'game_played' })).toEqual(['qd-02']);
    expect(questRow('qd-02', dailyPeriodKey(NOW))).toMatchObject({ progress: 3, completed: 1 });
  });

  it('⑨ `applyEventInTx` KHÔNG tự chống ghi trùng — cổng nằm ở NGƯỜI GỌI', () => {
    // ⚠️ RANH GIỚI CÓ Ý THỨC, KHÔNG PHẢI BUG: tính idempotent của cả hệ thống đến từ
    //    `progress_event.client_event_id` (khoá chính) và `game_result.client_event_id`
    //    (UNIQUE) — xem `ProgressService.applyEventOnce` / `GameResultService.submit`. Gửi lại
    //    một sự kiện MỚI về mặt kỹ thuật là một hành động MỚI, nên nó được tính.
    //    Test này ghim ranh giới: gỡ cổng ở tầng trên là hỏng CẢ HAI đầu, và ở đây không có
    //    lưới an toàn nào.
    fire({ kind: 'game_played', count: 3 });
    expect(questRow('qd-02', dailyPeriodKey(NOW))).toMatchObject({ progress: 3, completed: 1 });

    // Gửi lại một sự kiện "chơi xong một ván" nữa ⇒ tiêu chí ĐẾM lại cộng.
    fire({ kind: 'game_played', count: 1 });
    // `progress` vượt `target` là vô hại (so sánh là `>=`) và KHÔNG được kẹp: kẹp lại là một
    // phép biến đổi thừa phải bảo trì ở mọi nhánh.
    expect(questRow('qd-02', dailyPeriodKey(NOW))).toMatchObject({ progress: 4, completed: 1 });
    // Điều thật sự quan trọng: đã xong rồi thì KHÔNG báo lại lần nữa.
    expect(fire({ kind: 'game_played', count: 1 })).toEqual([]);
  });

  it('⑩ `correct_answers` cộng dồn theo số câu, và không đụng nhiệm vụ nào khác', () => {
    fire({ kind: 'correct_answers', count: 7 });
    expect(questRow('qd-03', dailyPeriodKey(NOW))).toMatchObject({ progress: 7, target: 12, completed: 0 });
    expect(questRow('qd-02', dailyPeriodKey(NOW))).toMatchObject({ progress: 0 });

    expect(fire({ kind: 'correct_answers', count: 5 })).toEqual(['qd-03']);
    expect(questRow('qd-03', dailyPeriodKey(NOW))).toMatchObject({ progress: 12, completed: 1 });
  });

  it('⑪ năm bài trong tuần ⇒ `qw-01` xong, và nó ghi vào KỲ TUẦN', () => {
    for (const lessonId of ['at-the-zoo/z1', 'at-the-zoo/z2', 'at-the-zoo/z3', 'my-body/l1']) {
      fire({ kind: 'lesson_completed', lessonId });
    }
    expect(questRow('qw-01', weeklyPeriodKey(NOW))).toMatchObject({ progress: 4, completed: 0 });

    expect(fire({ kind: 'lesson_completed', lessonId: 'my-body/l2' })).toEqual(['qw-01']);
    expect(questRow('qw-01', weeklyPeriodKey(NOW))).toMatchObject({ progress: 5, completed: 1 });
    // ⚠️ Nhánh `daily` KHÔNG được đụng tới: cùng một `quest_id` nhưng khác `period_key` là
    //    hai hàng khác nhau, và trộn chúng lại sẽ cho nhiệm vụ ngày tiến độ của cả tuần.
    expect(questRow('qw-01', dailyPeriodKey(NOW))).toBeUndefined();
  });

  it('⑫ sự kiện của NGÀY KHÁC không đụng tới nhiệm vụ ngày (reset không cần cron)', () => {
    const tomorrow = new Date('2026-10-10T09:00:00.000Z');
    fire({ kind: 'game_played', count: 3 }, tomorrow.toISOString());

    // Nhiệm vụ ngày của HÔM NAY vẫn trắng — không có job dọn dẹp nào chạy, khoá kỳ chỉ đơn
    // giản là không khớp.
    expect(questService.listForChild(parentId, childId, NOW).quests.find((q) => q.id === 'qd-02')).toMatchObject({
      progress: 0,
      completed: false,
    });
    expect(questService.listForChild(parentId, childId, tomorrow).quests.find((q) => q.id === 'qd-02')).toMatchObject({
      progress: 3,
      completed: true,
    });
  });
});

// =============================================================================
// Nhiệm vụ SUY DIỄN — tính lại từ dữ liệu bền vững
// =============================================================================

describe('nhiệm vụ suy diễn', () => {
  it('⑬ `complete_lesson` (mốc): xong khi bài đã xong, dù chưa từng có sự kiện nào', () => {
    markLessonComplete('at-the-zoo/z1');
    expect(questOf(questService.listForChild(parentId, childId, NOW).quests, 'qm-01')).toMatchObject({
      progress: 1,
      target: 1,
      completed: true,
      claimed: false,
    });

    // Và khi sự kiện tới, nó báo "vừa xong" đúng một lần.
    expect(fire({ kind: 'lesson_completed', lessonId: 'at-the-zoo/z3' })).toContain('qm-01');
    expect(fire({ kind: 'lesson_completed', lessonId: 'at-the-zoo/z3' })).not.toContain('qm-01');
  });

  it('⑭ `complete_theme`: CHỈ xong khi MỌI bài của chủ đề đã xong', () => {
    const zoo = ['at-the-zoo/z1', 'at-the-zoo/z2', 'at-the-zoo/z3'];
    expect(zoo.length).toBeGreaterThan(1); // ca "xong một phần" phải có thật

    markLessonComplete(zoo[0] as string);
    expect(questOf(questService.listForChild(parentId, childId, NOW).quests, 'qm-02').completed).toBe(false);

    markLessonComplete(zoo[1] as string);
    // Xong 2/3 ⇒ vẫn CHƯA xong. Thanh tiến độ đã nói điều đó ("xa hơn" là một lời nói dối).
    expect(questOf(questService.listForChild(parentId, childId, NOW).quests, 'qm-02').completed).toBe(false);

    markLessonComplete(zoo[2] as string);
    expect(questOf(questService.listForChild(parentId, childId, NOW).quests, 'qm-02')).toMatchObject({
      progress: 1,
      completed: true,
    });
  });

  it('⑮ `complete_theme` xong nhờ MỘT sự kiện `lesson_completed` bình thường', () => {
    // Không có sự kiện riêng cho "xong chủ đề" — đây là lý do `applyEventInTx` phải duyệt
    // TẤT CẢ nhiệm vụ thay vì lọc trước theo `kind`.
    markLessonComplete('at-the-zoo/z2');
    markLessonComplete('at-the-zoo/z3');
    expect(questOf(questService.listForChild(parentId, childId, NOW).quests, 'qm-02').completed).toBe(false);

    // ⚠️ THỨ TỰ THẬT của người gọi: `ProgressService` ghi `lesson_progress` TRƯỚC rồi mới bắn
    //    sự kiện. Sự kiện chỉ đẩy tiêu chí ĐẾM; `complete_theme` xong vì DỮ LIỆU đã đủ.
    markLessonComplete('at-the-zoo/z1');
    expect(fire({ kind: 'lesson_completed', lessonId: 'at-the-zoo/z1' })).toContain('qm-02');
  });

  it('⑯ `reach_level`: cấp 3 (400 XP) — so CẤP với CẤP', () => {
    transaction((db: Db) => xpService.addXpInTx(db, childId, 399, AT));
    expect(questOf(questService.listForChild(parentId, childId, NOW).quests, 'qm-03').completed).toBe(false);

    transaction((db: Db) => xpService.addXpInTx(db, childId, 1, AT));
    expect(questOf(questService.listForChild(parentId, childId, NOW).quests, 'qm-03')).toMatchObject({
      progress: 3,
      target: 3,
      completed: true,
    });
  });

  it('⑰ `collect_stickers`: sáu sticker mới xong', () => {
    const grant = (ids: string[]): void => {
      transaction((db: Db) =>
        rewardService.applyGrantsInTx(
          db,
          childId,
          { stickers: ids.map((stickerId) => ({ stickerId })) },
          AT,
        ),
      );
    };

    grant(['s1', 's2', 's3', 's4', 's5']);
    expect(questOf(questService.listForChild(parentId, childId, NOW).quests, 'qm-04').completed).toBe(false);

    grant(['s6']);
    expect(questOf(questService.listForChild(parentId, childId, NOW).quests, 'qm-04')).toMatchObject({
      progress: 6,
      target: 6,
      completed: true,
    });
  });

  it('⑱ `learn_days`: đếm NGÀY HỌC, và BỎ QUA hàng `daily_stats` toàn số 0 của lần nhận quà', () => {
    const keys = dateKeysInSameWeek(NOW, 4);
    expect(keys, 'tuần này phải có đủ 4 ngày để dựng ca kiểm').toHaveLength(4);

    // Ba ngày có hoạt động học thật (như một ván game được gửi lên).
    for (const dateKey of keys.slice(0, 3)) {
      applyDailyStatInTx(
        getDb(),
        childId,
        dateKey,
        { wordsLearned: 2, questionsAnswered: 6, correctCount: 5, activeSeconds: 90 },
        AT,
      );
    }
    expect(questOf(questService.listForChild(parentId, childId, NOW).quests, 'qw-02')).toMatchObject({
      progress: 3,
      target: 4,
      completed: false,
    });

    // ⚠️ ĐÚNG hàng mà `QuestService.claim` sinh ra: toàn delta HỌC TẬP bằng 0, chỉ có ⭐.
    //    Bấm "Nhận thưởng" không phải là học. Nếu tính nó là một ngày học thì bé chỉ cần mở
    //    app bấm quà 4 ngày là xong nhiệm vụ "Học 4 ngày trong tuần" mà không học gì.
    const claimDay = keys[3] as string;
    applyDailyStatInTx(
      getDb(),
      childId,
      claimDay,
      { wordsLearned: 0, questionsAnswered: 0, correctCount: 0, activeSeconds: 0, starsEarned: 10 },
      AT,
    );
    expect(questOf(questService.listForChild(parentId, childId, NOW).quests, 'qw-02').progress).toBe(3);

    // Một NGÀY HỌC THẺ TỪ không ghi `daily_stats` (không có ván game nào để tổng kết) — nguồn
    // duy nhất là sổ sự kiện của `ProgressService.sync`. Không nhìn vào đó thì nhiệm vụ tuần
    // chỉ đếm được ngày chơi game.
    getDb()
      .prepare(
        `INSERT INTO progress_event (client_event_id, child_id, kind, occurred_at, applied_at)
         VALUES (?, ?, 'word_learned', ?, ?)`,
      )
      .run('evt-hoc-the-1', childId, `${claimDay}T05:00:00.000Z`, AT);

    expect(questOf(questService.listForChild(parentId, childId, NOW).quests, 'qw-02')).toMatchObject({
      progress: 4,
      completed: true,
    });
  });
});

// =============================================================================
// `claim` — bé bấm "Nhận thưởng"
// =============================================================================

describe('QuestService.claim', () => {
  it('⑲ nhiệm vụ CHƯA XONG ⇒ `QUEST_NOT_COMPLETE`, và KHÔNG ghi gì cả', () => {
    expect(errorCodeOf(() => questService.claim(parentId, childId, 'qd-01', NOW))).toBe('QUEST_NOT_COMPLETE');
    // Không có "một nửa công việc đã ghi": hàng nhiệm vụ và ví đều phải nguyên vẹn.
    expect(questRows()).toHaveLength(0);
    expect(rewardService.readWallet(getDb(), childId).stars).toBe(0);
  });

  it('⑳ id nhiệm vụ không có trong danh mục ⇒ `QUEST_NOT_FOUND` (khác hẳn "chưa xong")', () => {
    expect(errorCodeOf(() => questService.claim(parentId, childId, 'khong-co-nhiem-vu-nay', NOW))).toBe('QUEST_NOT_FOUND');
  });

  it('㉑ KHÔNG nhận được thưởng vào hồ sơ bé nhà phụ huynh khác', () => {
    expect(errorCodeOf(() => questService.claim('phu-huynh-la', childId, 'qd-01', NOW))).toBe('CHILD_NOT_FOUND');
  });

  it('㉒ nhận `qd-01`: ví +10⭐, XP +20, và `daily_stats` khớp ĐÚNG số đã trao', () => {
    fire({ kind: 'lesson_completed', lessonId: 'at-the-zoo/z1' });

    const result = questService.claim(parentId, childId, 'qd-01', NOW);

    expect(result.quest).toMatchObject({ id: 'qd-01', progress: 1, target: 1, completed: true, claimed: true });
    expect(result.wallet.stars).toBe(10);
    expect(result.xp.xp).toBe(20);
    expect(result.levelUp).toBeNull();
    expect(result.badgesEarned).toEqual([]);

    // Trả về ĐÚNG bằng những gì đã ghi — không phải một con số tính lại bằng đường khác.
    expect(rewardService.readWallet(getDb(), childId).stars).toBe(result.wallet.stars);
    expect(rewardService.readXp(getDb(), childId).xp).toBe(result.xp.xp);

    // ⭐ Nguồn duy nhất của báo cáo phụ huynh phải khớp ví, nếu không thì không ai tin được
    //   cả hai con số. Mọi delta HỌC TẬP ở đây phải bằng 0: bấm nhận quà không phải là học.
    expect(dailyStatRow(localDateKey(NOW))).toMatchObject({
      stars_earned: 10,
      acorns_earned: 0,
      xp_earned: 20,
      words_learned: 0,
      questions_answered: 0,
      correct_count: 0,
      active_seconds: 0,
    });
  });

  it('㉓ nhận LẦN HAI ⇒ `ALREADY_CLAIMED` và ví KHÔNG tăng thêm', () => {
    fire({ kind: 'lesson_completed', lessonId: 'at-the-zoo/z1' });
    questService.claim(parentId, childId, 'qd-01', NOW);
    const afterFirst = rewardService.readWallet(getDb(), childId).stars;

    expect(errorCodeOf(() => questService.claim(parentId, childId, 'qd-01', NOW))).toBe('ALREADY_CLAIMED');
    expect(rewardService.readWallet(getDb(), childId).stars).toBe(afterFirst);
    // Báo cáo cũng không bị cộng đôi.
    expect(dailyStatRow(localDateKey(NOW))?.stars_earned).toBe(afterFirst);
  });

  it('㉔ nhận được nhiệm vụ MỐC đã xong TỪ TRƯỚC, chưa từng có hàng nào', () => {
    // ⚠️ Đây là lý do `claim` phải GHI HÀNG TRƯỚC KHI mở cổng `UPDATE`. Không ghi trước thì
    //    câu UPDATE khớp 0 hàng và bé nhận được `ALREADY_CLAIMED` cho một nhiệm vụ chưa ai
    //    nhận — một lời nói sai, và không có cách nào thoát ra.
    markLessonComplete('at-the-zoo/z1');

    const result = questService.claim(parentId, childId, 'qm-01', NOW);
    expect(result.quest).toMatchObject({ id: 'qm-01', claimed: true, completed: true });
    expect(result.wallet.stars).toBe(20);
    expect(result.badgesEarned).toEqual(['badge-first-step']);
    expect(questRow('qm-01', 'all')).toMatchObject({ claimed: 1, completed: 1 });
  });

  // ===========================================================================
  // T069.1 — sticker mở ra từ QUÀ NHIỆM VỤ phải được BÁO VỀ, không trao âm thầm
  // ===========================================================================

  it('㉛ sticker trong quà nhiệm vụ được báo về qua `stickerIds` (T069.1)', () => {
    markLessonComplete('at-the-zoo/z1');
    const result = questService.claim(parentId, childId, 'qm-01', NOW);

    expect(result.stickerIds).toEqual(['sticker-medal']);
    // Và nó thật sự vào sổ.
    const rows = getDb()
      .prepare('SELECT sticker_id FROM sticker_earned WHERE child_id = ? ORDER BY sticker_id')
      .all(childId) as { sticker_id: string }[];
    expect(rows.map((r) => r.sticker_id)).toEqual(['sticker-medal']);
  });

  it('㉜ nhiệm vụ KHÔNG thưởng sticker ⇒ `stickerIds` rỗng', () => {
    fire({ kind: 'lesson_completed', lessonId: 'at-the-zoo/z1' });
    const result = questService.claim(parentId, childId, 'qd-01', NOW);

    expect(result.stickerIds).toEqual([]);
  });

  it('㉝ sticker ĐÃ có từ trước ⇒ `stickerIds` rỗng (chỉ báo "vừa mở")', () => {
    markLessonComplete('at-the-zoo/z1');
    // Bé đã có sticker này từ đường khác (vd rơi ra ở luồng game) TRƯỚC khi nhận nhiệm vụ.
    transaction((db: Db) => rewardService.grantStickerInTx(db, childId, 'sticker-medal', 'at-the-zoo/z1', AT));

    const result = questService.claim(parentId, childId, 'qm-01', NOW);
    expect(result.stickerIds).toEqual([]);
    // Và trong sổ vẫn chỉ MỘT hàng.
    const rows = getDb()
      .prepare("SELECT COUNT(*) AS n FROM sticker_earned WHERE child_id = ? AND sticker_id = 'sticker-medal'")
      .get(childId) as { n: number };
    expect(rows.n).toBe(1);
  });

  it('㉕ nhiệm vụ chỉ xong nhờ SUY DIỄN cũng nhận được (unlock_theme)', () => {
    // `qw-03` chưa từng có hàng nào ở đầu kỳ — tiến độ của nó suy ra từ nội dung.
    const result = questService.claim(parentId, childId, 'qw-03', NOW);
    expect(result.wallet.stars).toBe(80);
    expect(result.wallet.acorns).toBe(5);
    expect(result.badgesEarned).toEqual(['badge-explorer']);
    expect(questRow('qw-03', weeklyPeriodKey(NOW))).toMatchObject({ claimed: 1, completed: 1 });
  });

  it('㉖ `badgesEarned` CHỈ gồm huy hiệu MỚI — trao lại huy hiệu đã có không tính là "vừa nhận"', () => {
    for (const lessonId of ['at-the-zoo/z1', 'at-the-zoo/z2', 'at-the-zoo/z3', 'my-body/l1', 'my-body/l2']) {
      fire({ kind: 'lesson_completed', lessonId });
    }
    // Bé đã có huy hiệu này từ đường khác (vd quà lên cấp) TRƯỚC khi nhận nhiệm vụ.
    transaction((db: Db) => rewardService.grantBadgeInTx(db, childId, 'badge-diligent', AT));

    const result = questService.claim(parentId, childId, 'qw-01', NOW);
    expect(result.wallet.stars).toBe(60);
    expect(result.badgesEarned).toEqual([]);
    // Nhưng huy hiệu vẫn chỉ có MỘT hàng trong bộ sưu tập.
    const rows = getDb()
      .prepare("SELECT COUNT(*) AS n FROM badge_earned WHERE child_id = ? AND badge_id = 'badge-diligent'")
      .get(childId) as { n: number };
    expect(rows.n).toBe(1);
  });

  it('㉗ nhiệm vụ thưởng XP đẩy bé QUA CẤP ⇒ `levelUp` được trả về, và báo cáo gồm CẢ quà lên cấp', () => {
    // 140 XP ⇒ cấp 1; quà `qd-01` là 20 XP ⇒ 160 XP ⇒ cấp 2 (mốc 150).
    transaction((db: Db) => xpService.addXpInTx(db, childId, 140, AT));
    fire({ kind: 'lesson_completed', lessonId: 'at-the-zoo/z1' });

    const result = questService.claim(parentId, childId, 'qd-01', NOW);

    // Bỏ trường này thì quà vẫn được trao (đúng) mà bé không bao giờ thấy màn ăn mừng (sai)
    // — và không ai phát hiện, vì ví vẫn tăng.
    expect(result.levelUp).toMatchObject({ from: 1, to: 2 });
    expect(result.xp).toMatchObject({ xp: 160, level: 2 });

    // Quà cấp 2: badge-forest-friend + 20⭐. Vậy ví = 10 (nhiệm vụ) + 20 (lên cấp) = 30.
    expect(result.wallet.stars).toBe(30);
    expect(result.badgesEarned).toEqual(['badge-forest-friend']);

    // Và `daily_stats` ghi SỐ THỰC SỰ ĐƯỢC TRAO (kể cả quà lên cấp) — khớp đúng ví.
    expect(dailyStatRow(localDateKey(NOW))).toMatchObject({ stars_earned: 30, xp_earned: 20 });
    expect(rewardService.readWallet(getDb(), childId).stars).toBe(30);
  });

  it('㉘ XP KHÔNG đi qua `RewardService` — ví ⭐ và điểm XP là hai đường riêng', () => {
    fire({ kind: 'lesson_completed', lessonId: 'at-the-zoo/z1' });
    const result = questService.claim(parentId, childId, 'qd-01', NOW);

    expect(result.wallet.stars).toBe(10);
    expect(result.wallet.acorns).toBe(0);
    expect(result.xp.xp).toBe(20);
    // `rewardService.readSnapshot()` có cả ví lẫn XP; cả hai phải khớp cái `claim` vừa trả.
    const snapshot = rewardService.readSnapshot(getDb(), childId);
    expect(snapshot.wallet.stars).toBe(10);
    expect(snapshot.xp.xp).toBe(20);
  });

  it('㉙ `claimed` không bị sự kiện sau đó ghi đè (chỉ `claim` được sửa cột này)', () => {
    fire({ kind: 'lesson_completed', lessonId: 'at-the-zoo/z1' });
    questService.claim(parentId, childId, 'qd-01', NOW);
    expect(questRow('qd-01', dailyPeriodKey(NOW))).toMatchObject({ claimed: 1 });

    // Bé học tiếp bài khác ⇒ câu UPSERT chạy cho MỌI nhiệm vụ. Nếu `claimed`/`claimed_at` có
    // mặt trong mệnh đề `DO UPDATE` thì một lần tính nhầm là bé mất dấu "đã nhận" ⇒ nhận lần hai.
    fire({ kind: 'lesson_completed', lessonId: 'at-the-zoo/z2' });
    const row = questRow('qd-01', dailyPeriodKey(NOW));
    expect(row).toMatchObject({ claimed: 1, completed: 1 });
    expect(row?.claimed_at).toBe(AT);
  });
});

// =============================================================================
// Toàn vẹn tổng thể
// =============================================================================

describe('toàn vẹn của cả sổ nhiệm vụ', () => {
  it('㉚ không có nhiệm vụ nào xong mà `target` sai, và không hàng nào lệch danh mục', () => {
    fire({ kind: 'game_played', count: 3 });
    fire({ kind: 'correct_answers', count: 12 });
    fire({ kind: 'lesson_completed', lessonId: 'at-the-zoo/z1' });

    const rows = questRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const quest = getQuest(row.quest_id as string);
      expect(quest, `hàng mồ côi cho nhiệm vụ "${String(row.quest_id)}"`).toBeDefined();
      expect(row.target, String(row.quest_id)).toBe(questTarget(quest!.criteria));
      expect((row.progress as number) >= (row.target as number), String(row.quest_id)).toBe(
        row.completed === 1,
      );
      // `claimed = 1` chỉ được tồn tại cùng `completed = 1`.
      if (row.claimed === 1) expect(row.completed, String(row.quest_id)).toBe(1);
    }
  });
});
