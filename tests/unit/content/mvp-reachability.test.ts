// @vitest-environment node
/**
 * RubyLingo — CỔNG CI: mọi món MVP phải TỚI ĐƯỢC bằng nội dung hiện có (T068.5 / task #15).
 *
 * ⭐⭐ VÌ SAO TỆP NÀY TỒN TẠI:
 *   Ba "ô xám vĩnh viễn" đã lọt ra ngoài mọi cổng kiểm: 3 sticker MVP không có đường kiếm,
 *   `badge-streak-7` (không ai GHI `streak_state`), và `badge-perfect` (`count: 10` mà MVP chỉ có
 *   3 bài chơi được). Chúng chỉ lộ ra vì QA TÌNH CỜ soi đúng chỗ. Tệp này biến lần soi đó thành
 *   một cổng TỰ ĐỘNG trong `npm run ci`, để hết phụ thuộc vào trí nhớ.
 *
 * ⚠️ TỆP NÀY CHỈ PHỦ NHỮNG GÌ `badges-content.test.ts` CHƯA PHỦ — KHÔNG lặp lại. Cổng đó đã kiểm:
 *   sticker MVP có đường kiếm; mỗi badge MVP có `criteria.kind` mà `BadgeService` xử lý; badge
 *   `complete_lesson`/`complete_theme`/`win_game`(loại ∈ `MVP_GAME_TYPES`)/`reach_level` trỏ tới
 *   nội dung thật; và `perfect_lessons.count` ≤ số bài có game.
 *
 *   Phần CÒN THIẾU (tệp này phủ):
 *     1. NHIỆM VỤ MVP: `complete_lesson.lessonId` / `complete_theme.themeId` phải CÓ THẬT; và các
 *        ngưỡng ĐẾM ĐƯỢC phải ≤ trần SUY TỪ DỮ LIỆU (`collect_stickers`, `unlock_theme`).
 *     2. HUY HIỆU MVP `win_game`: `gameType` phải GẮN VÀO ÍT NHẤT MỘT BÀI CÓ THẬT.
 *
 * ⚠️ MỌI TRẦN SUY TỪ DỮ LIỆU. KHÔNG hardcode con số nào.
 * ⚠️ CHỈ khẳng định cho `phase === 'mvp'`. Vi phạm ở `p1`/`p2` là "chưa làm tới", KHÔNG phải lỗi.
 *
 * 🔬 LUẬT thuần nằm ở `./helpers/reachability-rules.ts` và được `_verify/qa-gate-sensitivity.ts`
 *    tiêm dữ liệu SAI để chứng minh cổng KHÔNG rỗng (hai bên dùng CHUNG một mã).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { badgesForPhase, stickersForPhase } from '@shared/content/badges.js';
import { levelThemeIds } from '@shared/content/content-index.js';
import { XP_LEVELS } from '@shared/content/levels.js';
import { QUESTS } from '@shared/content/quests.js';
import { themeFileSchema } from '@shared/schemas/content.js';
import type { QuestDefinition } from '@shared/types/reward.js';

import {
  questCeilingViolations,
  questReferenceViolations,
  winGameBadgeNotPlayable,
} from './helpers/reachability-rules.js';

/**
 * Gốc repo. ⚠️ KHÔNG dùng `new URL(..., import.meta.url)`: dưới Vitest `import.meta.url` không
 * mang scheme `file:` ⇒ ném `TypeError`. Cùng bẫy đã trả giá ở `content-index.test.ts`.
 */
const ROOT = `${process.cwd()}/`;
const LEVELS_DIR = join(ROOT, 'src/data/levels');

interface CurriculumScan {
  /** Mọi id bài học CÓ THẬT (theo `theme.lessonIds` của từng tệp chủ đề). */
  lessonIds: Set<string>;
  /** `gameType` → tập bài học mà nó thực sự gắn vào (chỉ bài có thật). */
  gameTypeLessons: Map<string, Set<string>>;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

/** Quét `src/data/levels/**` dựng hai sự thật NỀN: bài có thật, và game gắn vào bài nào. */
function scanCurriculum(): CurriculumScan {
  if (!existsSync(LEVELS_DIR)) throw new Error(`không tìm thấy ${LEVELS_DIR}`);

  const lessonIds = new Set<string>();
  const exercises: { lessonId: string; gameType: string }[] = [];

  for (const levelDir of readdirSync(LEVELS_DIR).sort()) {
    const themesDir = join(LEVELS_DIR, levelDir, 'themes');
    if (!existsSync(themesDir)) continue;
    for (const fileName of readdirSync(themesDir).sort()) {
      if (!fileName.endsWith('.json')) continue;
      const file = themeFileSchema.parse(readJson(join(themesDir, fileName)));
      for (const lessonId of file.theme.lessonIds) lessonIds.add(lessonId);
      for (const exercise of file.exercises) {
        exercises.push({ lessonId: exercise.lessonId, gameType: exercise.gameType });
      }
    }
  }

  const gameTypeLessons = new Map<string, Set<string>>();
  for (const { lessonId, gameType } of exercises) {
    if (!lessonIds.has(lessonId)) continue; // bài không có thật ⇒ không tính là đường chơi
    const set = gameTypeLessons.get(gameType) ?? new Set<string>();
    set.add(lessonId);
    gameTypeLessons.set(gameType, set);
  }

  return { lessonIds, gameTypeLessons };
}

const curriculum = scanCurriculum();

/** Mọi sticker MVP có một "đường kiếm": có `lessonId`, HOẶC được trao qua quà nhiệm vụ/cấp. */
function reachableStickerIds(): Set<string> {
  const viaRewards = new Set<string>();
  const collect = (grants: readonly { kind: string; refId?: string }[]): void => {
    for (const grant of grants) {
      if (grant.kind === 'sticker' && grant.refId !== undefined) viaRewards.add(grant.refId);
    }
  };
  for (const quest of QUESTS) collect(quest.rewards);
  for (const level of XP_LEVELS) collect(level.rewards);

  const reachable = new Set<string>();
  for (const sticker of stickersForPhase('mvp')) {
    if (sticker.lessonId !== undefined || viaRewards.has(sticker.id)) reachable.add(sticker.id);
  }
  return reachable;
}

const mvpQuests: QuestDefinition[] = QUESTS.filter((quest) => quest.phase === 'mvp');
const mvpBadges = badgesForPhase('mvp');
const realThemeIds = new Set<string>(levelThemeIds());

const ceilings = {
  reachableStickers: reachableStickerIds().size,
  realThemes: realThemeIds.size,
  realLessons: curriculum.lessonIds.size,
  maxLevel: XP_LEVELS.length > 0 ? XP_LEVELS[XP_LEVELS.length - 1]!.level : 0,
};

// =============================================================================
// 0. Chống "test rỗng tự khen mình"
// =============================================================================

describe('cổng reachability MVP — có dữ liệu THẬT để kiểm', () => {
  it('nội dung + danh mục MVP không rỗng (nếu rỗng thì mọi khẳng định dưới là vô nghĩa)', () => {
    expect(curriculum.lessonIds.size).toBeGreaterThan(0);
    expect(mvpQuests.length).toBeGreaterThan(0);
    expect(mvpBadges.length).toBeGreaterThan(0);
    expect(stickersForPhase('mvp').length).toBeGreaterThan(0);
  });
});

// =============================================================================
// 1. NHIỆM VỤ MVP — trỏ tới mục CÓ THẬT, và ngưỡng ≤ trần SUY TỪ DỮ LIỆU
// =============================================================================

describe('nhiệm vụ MVP — tiêu chí trỏ tới mục có thật', () => {
  it('`complete_lesson.lessonId` và `complete_theme.themeId` phải CÓ THẬT', () => {
    const bad = questReferenceViolations(mvpQuests, curriculum.lessonIds, realThemeIds);
    expect(bad, `nhiệm vụ MVP trỏ tới nội dung không tồn tại: ${bad.join(' | ')}`).toEqual([]);
  });

  it('⭐ ngưỡng ĐẾM ĐƯỢC ≤ trần suy từ dữ liệu (complete_lessons / collect_stickers / unlock_theme / reach_level)', () => {
    const bad = questCeilingViolations(mvpQuests, ceilings);
    expect(bad, `nhiệm vụ MVP vượt trần nội dung: ${bad.join(' | ')}`).toEqual([]);
  });

  it('trần phải CÓ THẬT (nếu trần = 0 thì khẳng định trên là rỗng)', () => {
    expect(ceilings.reachableStickers).toBeGreaterThan(0);
    expect(ceilings.realThemes).toBeGreaterThan(0);
    expect(ceilings.realLessons).toBeGreaterThan(0);
    expect(ceilings.maxLevel).toBeGreaterThan(0);
  });
});

// =============================================================================
// 2. HUY HIỆU MVP `win_game` — loại game phải GẮN VÀO MỘT BÀI CÓ THẬT
// =============================================================================

describe('huy hiệu MVP `win_game` — loại game phải chơi được', () => {
  it('mỗi `win_game.gameType` của huy hiệu MVP phải gắn vào ≥ 1 bài có thật', () => {
    const bad = winGameBadgeNotPlayable(mvpBadges, curriculum.gameTypeLessons);
    expect(bad, `huy hiệu MVP gắn vào game không chơi được: ${bad.join(' | ')}`).toEqual([]);
  });

  it('⭐ nếu có huy hiệu MVP `win_game` thì phải có ít nhất một game chơi được (chống test rỗng)', () => {
    const winGameBadges = mvpBadges.filter((b) => b.criteria.kind === 'win_game');
    if (winGameBadges.length === 0) return;
    expect(curriculum.gameTypeLessons.size).toBeGreaterThan(0);
  });
});

// Nhắc lại phạm vi: chỉ `phase: 'mvp'`. Nội dung `p1`/`p2` (vd `qm-04`, `qw-03`, `badge-perfect`…)
// KHÔNG bị cổng này chặn — chúng là "chưa làm tới", và sẽ được đưa vào khi giai đoạn đó ship.
// `mvpQuests`/`mvpBadges` ở trên đã lọc theo phase; đó là lý do duy nhất cổng chỉ nói về MVP.
