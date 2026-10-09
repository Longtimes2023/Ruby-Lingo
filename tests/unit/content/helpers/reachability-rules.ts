/**
 * RubyLingo — LUẬT "món MVP phải TỚI ĐƯỢC", tách thành HÀM THUẦN (T068.5 / task #15).
 *
 * ⚠️ VÌ SAO TÁCH RA KHỎI FILE TEST:
 *   Cổng CI (`tests/unit/content/mvp-reachability.test.ts`) áp luật này lên DỮ LIỆU THẬT. Nhưng
 *   một cổng XANH có thể là cổng RỖNG (luật chưa bao giờ chạy đúng). Để chứng minh cổng KHÔNG
 *   rỗng, script `_verify/qa-gate-sensitivity.ts` nạp CHÍNH các hàm này rồi tiêm dữ liệu SAI và
 *   bắt buộc chúng phải kêu. Hai bên dùng CÙNG một mã ⇒ không thể lệch nhau.
 *
 * ⚠️ Chỉ nhận dữ liệu qua tham số (không import danh mục JSON) ⇒ import type-only ⇒ chạy được ở
 *    cả Vitest lẫn `tsx`, và không tạo nguồn sự thật thứ hai.
 */

import type { Badge, QuestDefinition } from '@shared/types/reward.js';

/** Các TRẦN suy từ dữ liệu — không con số nào hardcode trong luật. */
export interface ReachabilityCeilings {
  /** Số sticker MVP có ít nhất một đường kiếm. */
  reachableStickers: number;
  /** Số chủ đề có thật của cấp đang dùng. */
  realThemes: number;
  /** Số bài học có thật — trần cho `complete_lessons.count`. */
  realLessons: number;
  /** Cấp cao nhất của thang XP. */
  maxLevel: number;
}

/** Tiêu chí trỏ tới BÀI/CHỦ ĐỀ có thật (không thì nhiệm vụ không bao giờ xong). */
export function questReferenceViolations(
  quests: readonly QuestDefinition[],
  lessonIds: ReadonlySet<string>,
  themeIds: ReadonlySet<string>,
): string[] {
  const bad: string[] = [];
  for (const quest of quests) {
    const criteria = quest.criteria;
    if (criteria.kind === 'complete_lesson' && !lessonIds.has(criteria.lessonId)) {
      bad.push(`${quest.id}: complete_lesson "${criteria.lessonId}" không có thật`);
    }
    if (criteria.kind === 'complete_theme' && !themeIds.has(criteria.themeId)) {
      bad.push(`${quest.id}: complete_theme "${criteria.themeId}" không có thật`);
    }
  }
  return bad;
}

/**
 * Ngưỡng ĐẾM ĐƯỢC vượt trần nội dung.
 *
 * ⚠️ CỐ Ý BỎ QUA `play_games` / `correct_answers` / `learn_days`: bé CHƠI LẠI được vô hạn ⇒ trần
 *    theo nội dung là VÔ HẠN (chỉ bị chặn bởi thời gian thực). Đặt trần giả ở đây là bịa một con
 *    số. Ba loại này KHÔNG THỂ bất khả thi vì lý do nội dung.
 */
export function questCeilingViolations(
  quests: readonly QuestDefinition[],
  ceilings: ReachabilityCeilings,
): string[] {
  const bad: string[] = [];
  for (const quest of quests) {
    const criteria = quest.criteria;
    if (criteria.kind === 'complete_lessons' && criteria.count > ceilings.realLessons) {
      bad.push(`${quest.id}: complete_lessons ${criteria.count} > trần ${ceilings.realLessons}`);
    }
    if (criteria.kind === 'collect_stickers' && criteria.count > ceilings.reachableStickers) {
      bad.push(`${quest.id}: collect_stickers ${criteria.count} > trần ${ceilings.reachableStickers}`);
    }
    if (criteria.kind === 'unlock_theme' && criteria.count > ceilings.realThemes) {
      bad.push(`${quest.id}: unlock_theme ${criteria.count} > trần ${ceilings.realThemes}`);
    }
    if (criteria.kind === 'reach_level' && criteria.level > ceilings.maxLevel) {
      bad.push(`${quest.id}: reach_level ${criteria.level} > trần ${ceilings.maxLevel}`);
    }
  }
  return bad;
}

/**
 * Huy hiệu `win_game` trỏ tới một loại game KHÔNG gắn vào bài nào ⇒ bé không chơi được ⇒ bất khả thi.
 *
 * ⚠️ KHÔNG kiểm "gameType ∈ MVP_GAME_TYPES" ở đây — `badges-content.test.ts` đã kiểm. Ở đây chỉ
 *    kiểm điều cổng đó KHÔNG thấy: loại game tồn tại nhưng không bài nào có.
 */
export function winGameBadgeNotPlayable(
  badges: readonly Badge[],
  gameTypeLessons: ReadonlyMap<string, ReadonlySet<string>>,
): string[] {
  const bad: string[] = [];
  for (const badge of badges) {
    const criteria = badge.criteria;
    if (criteria.kind !== 'win_game') continue;
    const lessons = gameTypeLessons.get(criteria.gameType);
    if (lessons === undefined || lessons.size === 0) {
      bad.push(`${badge.id}: win_game "${criteria.gameType}" không gắn vào bài nào`);
    }
  }
  return bad;
}
