// @vitest-environment node
/**
 * RubyLingo — chốt chặn cho việc GHI `streak_state` (T068.2).
 *
 * ⭐⭐ VÌ SAO TỆP NÀY TỒN TẠI:
 *   Trước T068.2, `streak_state` chỉ được `ChildService` INSERT MỘT LẦN với giá trị 0 và KHÔNG
 *   có chỗ nào cập nhật. Hệ quả: huy hiệu MVP `badge-streak-7` (`streak_days ≥ 7`) BẤT KHẢ THI —
 *   một ô xám vĩnh viễn trong màn Bộ sưu tập, y hệt lỗi 3 sticker. Cổng kiểm tĩnh của T068.1
 *   KHÔNG bắt được lớp lỗi này (nó kiểm "tiêu chí có được `BadgeService` xử lý", không kiểm
 *   "dữ liệu nền có bao giờ được ghi"). Chỉ một test HÀNH VI mới bắt được — tệp này.
 *
 * ⚠️ MỌI MỐC THỜI GIAN LÀ CỐ ĐỊNH, và ngày tính bằng `localDateKey` của chính hệ thống — không
 *    tự suy lịch trong test. Một test đọc đồng hồ hệ thống sẽ đỏ vào đúng đêm giao thừa.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDb, getDb, transaction } from '../../../server/db/connection.js';
import { authService } from '../../../server/services/AuthService.js';
import { badgeService } from '../../../server/services/BadgeService.js';
import { childService } from '../../../server/services/ChildService.js';
import { applyDailyStatInTx } from '../../../server/services/dailyStats.js';
import { progressService } from '../../../server/services/ProgressService.js';
import { localDateKey } from '../../../server/lib/time.js';

import { clearAllData, setupTestDb } from './helpers/testDb.js';

const PASSWORD = 'matkhau123';

/** 2026-10-01T09:00Z — 09:00Z ⇒ 16:00 giờ Việt Nam (UTC+7) ⇒ VẪN cùng ngày ⇒ khoá ngày ổn định. */
const BASE_MS = Date.UTC(2026, 9, 1, 9, 0, 0);

/** ISO của "ngày thứ `offset`" (offset 0 = 2026-10-01). Mỗi bước = đúng một NGÀY. */
function dayIso(offset: number): string {
  return new Date(BASE_MS + offset * 86_400_000).toISOString();
}

/** Khoá NGÀY ĐỊA PHƯƠNG của ngày thứ `offset` — dùng chính hàm của hệ thống. */
function dayKey(offset: number): string {
  return localDateKey(new Date(dayIso(offset)));
}

let parentId = '';
let childId = '';
let seq = 0;

beforeAll(() => {
  setupTestDb();
});

beforeEach(async () => {
  clearAllData(getDb());
  seq = 0;
  parentId = (
    await authService.signup({ email: 'bo@example.com', password: PASSWORD, parentalConsent: true })
  ).parent.id;
  childId = childService.createChild(parentId, { nickname: 'Bin', age: 7, avatarId: 'fox' }).id;
});

afterAll(() => {
  closeDb();
});

// =============================================================================
// Tiện ích test
// =============================================================================

/** Một hoạt động HỌC kiểu FLASHCARD trong ngày thứ `offset` (đi qua `ProgressService.sync`). */
function learnOn(offset: number): void {
  seq += 1;
  progressService.sync(parentId, childId, {
    events: [
      {
        clientEventId: `evt-${seq}`,
        kind: 'word_answer',
        wordId: `starters.w${seq}`,
        correct: true,
        occurredAt: dayIso(offset),
      },
    ],
    since: null,
  });
}

/** Một LƯỢT CHƠI GAME (có hoạt động học) trong một ngày — đi qua điểm nghẽn `dailyStats`. */
function playOn(offset: number): void {
  applyDailyStatInTx(
    getDb(),
    childId,
    dayKey(offset),
    { wordsLearned: 2, questionsAnswered: 6, correctCount: 5, activeSeconds: 90 },
    dayIso(offset),
  );
}

/** Hàng "nhận quà nhiệm vụ": có ⭐ nhưng KHÔNG có hoạt động học (đúng như `QuestService.claim`). */
function claimPayoutOn(offset: number): void {
  applyDailyStatInTx(
    getDb(),
    childId,
    dayKey(offset),
    { wordsLearned: 0, questionsAnswered: 0, correctCount: 0, activeSeconds: 0, starsEarned: 10 },
    dayIso(offset),
  );
}

function streakRow(): { current_streak: number; longest_streak: number; last_active_date: string | null } {
  return getDb()
    .prepare('SELECT current_streak, longest_streak, last_active_date FROM streak_state WHERE child_id = ?')
    .get(childId) as { current_streak: number; longest_streak: number; last_active_date: string | null };
}

// =============================================================================
// Luật chuỗi ngày
// =============================================================================

describe('streak — nối chuỗi ngày học', () => {
  it('⭐ học 7 NGÀY LIÊN TIẾP ⇒ chuỗi 7, và `badge-streak-7` ĐƯỢC TRAO', () => {
    for (let d = 0; d < 7; d += 1) learnOn(d);

    expect(streakRow()).toMatchObject({
      current_streak: 7,
      longest_streak: 7,
      last_active_date: dayKey(6),
    });

    // ⭐ ĐÂY là điều cả T068.2 tồn tại để làm: huy hiệu MVP này trở nên KIẾM ĐƯỢC.
    const earned = transaction((db) => badgeService.evaluate(db, childId, dayIso(6)));
    expect(earned).toContain('badge-streak-7');
  });

  it('⚠️ CÙNG một ngày nhiều hoạt động ⇒ KHÔNG đếm hai lần', () => {
    learnOn(0);
    learnOn(0);
    learnOn(0);

    expect(streakRow()).toMatchObject({ current_streak: 1, longest_streak: 1, last_active_date: dayKey(0) });
  });

  it('⚠️ NGHỈ một ngày ⇒ `current_streak` về 1 nhưng `longest_streak` GIỮ NGUYÊN', () => {
    learnOn(0);
    learnOn(1);
    expect(streakRow()).toMatchObject({ current_streak: 2, longest_streak: 2 });

    // Ngày 2 nghỉ. Ngày 3 học lại ⇒ đứt chuỗi.
    learnOn(3);

    expect(streakRow()).toMatchObject({
      current_streak: 1,
      longest_streak: 2, // ⭐ KHÔNG bị xoá — đây là chỗ huy hiệu sưu tầm vĩnh viễn dựa vào
      last_active_date: dayKey(3),
    });
  });

  it('sự kiện đến MUỘN (ngày cũ hơn) KHÔNG làm chuỗi lùi', () => {
    learnOn(5);
    expect(streakRow()).toMatchObject({ current_streak: 1, last_active_date: dayKey(5) });

    // Sự kiện của ngày 4 tới sau ⇒ bỏ qua, không "chữa lành ngược", không lùi `last_active_date`.
    learnOn(4);
    expect(streakRow()).toMatchObject({ current_streak: 1, last_active_date: dayKey(5) });
  });
});

describe('streak — đường GAME (daily_stats) và đường NHẬN QUÀ', () => {
  it('lượt chơi game nối chuỗi (đi qua điểm nghẽn `dailyStats`)', () => {
    playOn(0);
    playOn(1);
    playOn(2);

    expect(streakRow()).toMatchObject({
      current_streak: 3,
      longest_streak: 3,
      last_active_date: dayKey(2),
    });
  });

  it('⭐ hàng `daily_stats` TOÀN SỐ 0 (bấm "Nhận thưởng") KHÔNG tính là một ngày học', () => {
    claimPayoutOn(0);

    // Bấm nhận quà KHÔNG phải là học ⇒ chuỗi không được bắt đầu. Cùng định nghĩa mà nhiệm vụ
    // `learn_days` dùng — nếu tính, bé chỉ cần mở app bấm quà là "học" mỗi ngày.
    expect(streakRow()).toMatchObject({
      current_streak: 0,
      longest_streak: 0,
      last_active_date: null,
    });
  });

  it('hai ĐƯỜNG (flashcard + game) trên CÙNG một ngày vẫn là MỘT ngày', () => {
    learnOn(0);
    playOn(0);

    expect(streakRow()).toMatchObject({ current_streak: 1, longest_streak: 1, last_active_date: dayKey(0) });
  });
});
