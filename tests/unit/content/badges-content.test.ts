/**
 * Test cho danh mục **huy hiệu & sticker** (T068).
 *
 * ⭐ NHÓM QUAN TRỌNG NHẤT LÀ NHÓM 2 — ĐỐI CHIẾU TIÊU CHÍ VỚI NỘI DUNG THẬT.
 *
 *   Huy hiệu được trao bằng câu điều kiện dữ liệu: `{"kind":"complete_lesson","lessonId":"at-the-zoo/z1"}`.
 *   Gõ sai một ký tự (`at-the-zoo/z1` → `at-the-zoo/1`) thì:
 *     · `tsc` xanh (nó chỉ là string),
 *     · `badgesFileSchema` xanh (schema chỉ đòi `min(1)`),
 *     · server chạy bình thường,
 *     · và huy hiệu đó **KHÔNG BAO GIỜ trao được** — im lặng tuyệt đối.
 *   Với "Bước đầu tiên" treo ở đầu bộ sưu tập, đó là một ô vĩnh viễn xám mà bé không có cách nào
 *   hiểu tại sao. Cùng họ lỗi với ảnh từ vựng sai khoá.
 *
 *   Nhóm 2 vì thế đối chiếu MỌI tiêu chí với `content-index` (nguồn thật của bài/chủ đề) và với
 *   `MVP_GAME_TYPES`. Đây là chỗ DUY NHẤT trong hệ thống nhìn thấy cả hai bên cùng lúc.
 *
 * Nhóm 1 kiểm bất biến về EMICON: bé phân biệt bộ sưu tập bằng hình, nên một emoji trùng giữa
 * huy hiệu và vật phẩm là lỗi NHÌN THẤY ĐƯỢC mà không cổng tĩnh nào bắt.
 */

import { describe, expect, it } from 'vitest';

import {
  BADGES,
  ICON_OWNERS,
  STICKERS,
  badgesForPhase,
  getBadge,
  getSticker,
  stickerForLesson,
  stickersForPhase,
} from '@shared/content/badges.js';
import { levelThemeIds, themesForLevel } from '@shared/content/content-index.js';
import { MAX_LEVEL, XP_LEVELS } from '@shared/content/levels.js';
import { QUESTS } from '@shared/content/quests.js';
import { SHOP_CURRENCIES, SHOP_ITEMS } from '@shared/content/shop.js';
import { MVP_GAME_TYPES } from '@shared/types/content.js';

/** Mọi id bài học có thật, lấy từ chỉ mục nội dung (nguồn thật, không chép tay). */
function allLessonIds(): Set<string> {
  const ids = new Set<string>();
  for (const theme of themesForLevel()) {
    for (const lessonId of theme.lessonIds) ids.add(lessonId);
  }
  return ids;
}

/** Mọi id chủ đề có thật. */
function allThemeIds(): Set<string> {
  return new Set(levelThemeIds());
}

// =============================================================================
// 1. Emoji — mỗi hình chỉ thuộc MỘT bộ sưu tập
// =============================================================================

describe('danh mục sưu tầm — bất biến về emoji', () => {
  it('nạp được cả hai tệp và số lượng hợp lý', () => {
    expect(BADGES.length).toBeGreaterThanOrEqual(6);
    expect(STICKERS.length).toBeGreaterThanOrEqual(6);
  });

  it('⚠️ không emoji nào bị dùng ở hai bộ (kể cả tiền tệ và vật phẩm)', () => {
    // `ICON_OWNERS` được dựng lúc nạp module và NÉM nếu có trùng ⇒ chỉ cần chạm tới nó là bất
    // biến đã được kiểm. Khẳng định thêm để test nói rõ nó đang bảo vệ điều gì.
    const total =
      Object.keys(SHOP_CURRENCIES).length + SHOP_ITEMS.length + BADGES.length + STICKERS.length;
    expect(ICON_OWNERS.size).toBe(total);
  });

  it('⭐/🌰 (tiền tệ) không được dùng làm huy hiệu hay sticker', () => {
    // Trùng với tiền tệ là ca tệ nhất: bé tưởng mình vừa được cộng Sao.
    const currencyIcons = Object.values(SHOP_CURRENCIES).map((c) => c.icon);
    for (const icon of currencyIcons) {
      const reused = BADGES.some((b) => b.icon === icon) || STICKERS.some((s) => s.icon === icon);
      expect(reused, `tiền tệ ${icon} bị dùng lại`).toBe(false);
    }
  });
});

// =============================================================================
// 2. Tiêu chí phải trỏ tới nội dung CÓ THẬT
// =============================================================================

describe('danh mục sưu tầm — tiêu chí trỏ tới nội dung thật', () => {
  it('mọi `complete_lesson` trỏ tới một bài CÓ THẬT trong chỉ mục', () => {
    const lessons = allLessonIds();
    expect(lessons.size).toBeGreaterThan(0);

    const missing = BADGES.filter(
      (b) => b.criteria.kind === 'complete_lesson' && !lessons.has(b.criteria.lessonId),
    ).map((b) => b.id);

    expect(missing).toEqual([]);
  });

  it('mọi `complete_theme` trỏ tới một CHỦ ĐỀ có thật', () => {
    const themes = allThemeIds();
    const missing = BADGES.filter(
      (b) => b.criteria.kind === 'complete_theme' && !themes.has(b.criteria.themeId),
    ).map((b) => b.id);
    expect(missing).toEqual([]);
  });

  it('mọi `win_game` dùng một loại game CÓ THẬT', () => {
    const known = new Set<string>(MVP_GAME_TYPES);
    const missing = BADGES.filter(
      (b) => b.criteria.kind === 'win_game' && !known.has(b.criteria.gameType),
    ).map((b) => b.id);
    expect(missing).toEqual([]);
  });

  it('⭐ mọi `reach_level` nằm trong thang cấp CÓ THẬT', () => {
    // "Đạt cấp 9" trong khi bảng XP chỉ có 7 cấp là một ô không bao giờ mở — và nó không hỏng gì.
    const missing = BADGES.filter(
      (b) => b.criteria.kind === 'reach_level' && b.criteria.level > MAX_LEVEL,
    ).map((b) => b.id);
    expect(missing).toEqual([]);
  });

  it('mọi `perfect_lessons` / `streak_days` / `earn_currency` có con số dương hợp lý', () => {
    for (const badge of BADGES) {
      const { criteria } = badge;
      if (criteria.kind === 'perfect_lessons') expect(criteria.count, badge.id).toBeGreaterThan(0);
      if (criteria.kind === 'streak_days') expect(criteria.days, badge.id).toBeGreaterThan(0);
      if (criteria.kind === 'earn_currency') expect(criteria.amount, badge.id).toBeGreaterThan(0);
      if (criteria.kind === 'win_game') expect(criteria.count, badge.id).toBeGreaterThan(0);
    }
  });

  it('mọi sticker gắn bài đều trỏ tới một bài CÓ THẬT', () => {
    const lessons = allLessonIds();
    const missing = STICKERS.filter(
      (s) => s.lessonId !== undefined && !lessons.has(s.lessonId),
    ).map((s) => s.id);
    expect(missing).toEqual([]);
  });
});

// =============================================================================
// 3. Tra cứu
// =============================================================================

describe('danh mục sưu tầm — tra cứu', () => {
  it('`getBadge` / `getSticker` trả đúng mục, `undefined` khi không có', () => {
    const badge = BADGES[0]!;
    expect(getBadge(badge.id)?.name_vi).toBe(badge.name_vi);
    expect(getBadge('badge-khong-ton-tai')).toBeUndefined();

    const sticker = STICKERS[0]!;
    expect(getSticker(sticker.id)?.icon).toBe(sticker.icon);
    expect(getSticker('sticker-khong-ton-tai')).toBeUndefined();
  });

  it('`badgesForPhase("mvp")` trả ĐÚNG 6 huy hiệu MVP theo kế hoạch', () => {
    expect(badgesForPhase('mvp').length).toBe(6);
  });

  it('`stickersForPhase` lọc đúng theo giai đoạn', () => {
    for (const phase of ['mvp', 'p1', 'p2'] as const) {
      expect(stickersForPhase(phase).every((s) => s.phase === phase)).toBe(true);
    }
  });

  it('`stickerForLesson` trả sticker của bài, và `null` khi bài không có sticker', () => {
    const withLesson = STICKERS.find((s) => s.lessonId !== undefined);
    expect(withLesson).toBeDefined();
    expect(stickerForLesson(withLesson!.lessonId!)?.id).toBe(withLesson!.id);
    // Bài không có sticker là chuyện BÌNH THƯỜNG ⇒ `null`, KHÔNG ném (hàm này chạy trong luồng
    // chấm điểm sau mỗi lượt chơi; ném ở đó là làm hỏng lượt chơi của bé vì một chuyện thường).
    expect(stickerForLesson('khong/co-bai-nay')).toBeNull();
  });

  it('mỗi id chỉ xuất hiện một lần', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    expect(new Set(STICKERS.map((s) => s.id)).size).toBe(STICKERS.length);
  });
});

// =============================================================================
// 4. MỌI MÓN SƯU TẦM MVP PHẢI CÓ MỘT "ĐƯỜNG KIẾM" THẬT
// =============================================================================

/**
 * ⭐⭐ VÌ SAO NHÓM NÀY TỒN TẠI (thêm sau lỗ hổng QA tìm ra ở T068.1):
 *   Một ô sưu tầm KHÔNG có đường kiếm là một ô VĨNH VIỄN `?` trong màn Bộ sưu tập: bé thấy nó,
 *   khao khát nó, và KHÔNG BAO GIỜ mở được. Nhóm 2 ở trên bắt được loại lỗi này cho sticker CÓ
 *   `lessonId` và cho huy hiệu, NHƯNG bỏ qua sticker KHÔNG có `lessonId`
 *   (`s.lessonId !== undefined && ...`) — đúng cái khe mà 3 sticker MVP (💫🦄🥇) rơi vào và
 *   không cổng nào bắt.
 *
 *   "Đường kiếm" được định nghĩa BẰNG CHÍNH CÁC CƠ CHẾ TRAO có trong hệ thống, để test không
 *   thể lệch khỏi mã sản phẩm:
 *     • STICKER: có `lessonId` (`stickerForLesson`, T069) HOẶC xuất hiện trong `rewards` của một
 *       nhiệm vụ / một cấp XP (`RewardGrant kind:'sticker'`, trao bởi `RewardService.applyGrantsInTx`).
 *     • HUY HIỆU: `BadgeService` đánh giá MỌI huy hiệu theo `criteria`, nên "đường kiếm" là một
 *       `criteria.kind` mà service XỬ LÝ ĐƯỢC. Thêm `kind` mới vào `badges.json` mà quên
 *       `BadgeService` ⇒ test này đỏ, thay vì một huy hiệu không bao giờ trao mà im lặng.
 *
 * ⚠️ PHẠM VI = MVP. Đây là giai đoạn ĐANG hiển thị trong màn Bộ sưu tập (`stickersForPhase('mvp')`).
 *    Sticker ĐẶC BIỆT của `p1`/`p2` (nếu có) sẽ được đưa vào cổng này khi giai đoạn đó ship cùng
 *    cơ chế trao của nó — kiểm chúng bây giờ là đòi một quyết định chưa tới lúc.
 */
describe('mọi món sưu tầm MVP phải có ĐƯỜNG KIẾM thật', () => {
  /** Id mọi sticker được trao qua QUÀ (nhiệm vụ hoặc quà lên cấp). */
  function stickerIdsGrantedViaRewards(): Set<string> {
    const ids = new Set<string>();
    const collect = (grants: readonly { kind: string; refId?: string }[]): void => {
      for (const grant of grants) {
        if (grant.kind === 'sticker' && grant.refId !== undefined) ids.add(grant.refId);
      }
    };
    for (const quest of QUESTS) collect(quest.rewards);
    for (const level of XP_LEVELS) collect(level.rewards);
    return ids;
  }

  it('mỗi sticker MVP: có `lessonId` HOẶC được trao qua quà nhiệm vụ/cấp', () => {
    const viaRewards = stickerIdsGrantedViaRewards();
    const orphans = stickersForPhase('mvp')
      .filter((sticker) => sticker.lessonId === undefined && !viaRewards.has(sticker.id))
      .map((sticker) => sticker.id);

    expect(
      orphans,
      `sticker MVP không có đường kiếm (ô vĩnh viễn không mở): ${orphans.join(', ')}`,
    ).toEqual([]);
  });

  it('mỗi huy hiệu MVP: có một loại tiêu chí mà `BadgeService` đánh giá được', () => {
    // 7 `kind` này PHẢI khớp union `BadgeCriteria` mà `BadgeService.meets` xử lý.
    const handled = new Set<string>([
      'complete_lesson',
      'complete_theme',
      'perfect_lessons',
      'streak_days',
      'reach_level',
      'earn_currency',
      'win_game',
    ]);
    const orphans = badgesForPhase('mvp')
      .filter((badge) => !handled.has(badge.criteria.kind))
      .map((badge) => badge.id);

    expect(orphans, `huy hiệu MVP dùng kind mà BadgeService không xử lý: ${orphans.join(', ')}`).toEqual(
      [],
    );
  });

  /**
   * ⭐⭐ NGƯỠNG phải nằm trong KHẢ NĂNG của nội dung MVP.
   *
   *   Hai test trên kiểm "món sưu tầm có KHAI một cơ chế trao không". Chúng KHÔNG bắt được một
   *   món khai ĐÚNG nhưng NGƯỠNG cao hơn thứ nội dung hiện có tạo ra được — và đúng lớp lỗi đó
   *   đã lọt HAI lần: `badge-streak-7` (không chỗ nào GHI `streak_state`) và `badge-perfect`
   *   (`count: 10` nhưng MVP chỉ có 3 bài chơi được). Test này canh NGƯỠNG theo nội dung.
   *
   *   Trần của từng loại tiêu chí — VÀ VÌ SAO có/không có trần:
   *     • `perfect_lessons` — CÓ trần = SỐ BÀI CÓ GAME. `stars_best = 3` chỉ sinh ra từ một LƯỢT
   *       CHƠI GAME (`ProgressService.applyGameScoreInTx`; luồng flashcard để `stars_best = 0`),
   *       nên bé KHÔNG THỂ đạt 3 sao ở một bài không có game. Trần lấy từ chỉ mục nội dung
   *       (`hasGames`), KHÔNG hardcode con số.
   *     • `win_game`, `earn_currency` — KHÔNG chặn: một game chơi lại được vô hạn, và mọi lượt
   *       chơi đều cộng ⭐/🌰 ⇒ không có trần theo nội dung.
   *     • `streak_days` — trần theo THỜI GIAN (số ngày), không theo nội dung; bị chặn bởi điều
   *       kiện KHÁC (phải có chỗ GHI `streak_state`) — canh ở `tests/unit/server/streak.test.ts`.
   *     • `reach_level` — đã có cổng riêng ở nhóm 2 (`level <= MAX_LEVEL`).
   *     • `complete_lesson`, `complete_theme` — trần = nội dung có thật, đã kiểm ở nhóm 2.
   */
  it('⭐ mọi `perfect_lessons.count` của huy hiệu MVP ≤ số bài CÓ GAME của nội dung', () => {
    // Số bài có game = tổng số bài của các chủ đề đã có game (chỉ mục chỉ gắn `hasGames` ở cấp
    // CHỦ ĐỀ). Với nội dung MVP hiện tại: `at-the-zoo` (3 bài).
    const lessonsWithGames = themesForLevel()
      .filter((theme) => theme.hasGames)
      .reduce((total, theme) => total + theme.lessonIds.length, 0);
    expect(lessonsWithGames).toBeGreaterThan(0);

    const impossible: string[] = [];
    for (const badge of badgesForPhase('mvp')) {
      const criteria = badge.criteria;
      if (criteria.kind === 'perfect_lessons' && criteria.count > lessonsWithGames) {
        impossible.push(
          `${badge.id}: cần ${criteria.count} bài 3 sao nhưng nội dung chỉ có ${lessonsWithGames} bài chơi được`,
        );
      }
    }
    expect(impossible, `ngưỡng vượt khả năng nội dung: ${impossible.join(' | ')}`).toEqual([]);
  });
});
