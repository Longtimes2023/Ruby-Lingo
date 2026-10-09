/**
 * RubyLingo — CHỈ MỤC NỘI DUNG, đọc từ `shared/content/content-index.json`.
 *
 * ⚠️ Tệp JSON đó SINH TỰ ĐỘNG (`scripts/gen-content-index.ts`) và có cổng kiểm đối chiếu
 *    `src/data/` (`tests/unit/content/content-index.test.ts`). ĐỪNG sửa tay. Lý do đầy đủ —
 *    vì sao server cần nó, vì sao nó không phải "nguồn chân lý thứ hai" — nằm ở đầu
 *    `scripts/gen-content-index.ts` và ở `contentIndexFileSchema` trong `shared/schemas/content.ts`.
 *
 * ⭐ VÌ SAO NẰM Ở `shared/`: hai bên cần nó. Server chấm nhiệm vụ `complete_theme`/`unlock_theme`;
 *   client có thể dùng để vẽ bản đồ mà không phải nạp cả `words`/`exercises`. Mà `src/` thì
 *   server KHÔNG import được (`tsconfig.server.json` chỉ gom `server/`, `shared/`, `scripts/`).
 *
 * ⭐ `words` (id + en + vi) ĐƯỢC THÊM Ở T073 — cho BÁO CÁO PHỤ HUYNH. Server phải gọi tên một từ
 *   ("*elephant* — con voi") mà chữ của từ chỉ nằm ở `src/data/`, thứ server không đọc được. Nên
 *   nó đi qua cùng đường bắc cầu này (`getWordText`), có cổng đối chiếu TỪNG TỪ với `src/data/`.
 *   `exercises` vẫn KHÔNG chép — vẫn không ai đọc.
 *
 * ⚠️ Kiểm NGAY LÚC NẠP MODULE — cùng lý do như `quests.ts`/`shop.ts`: một chỉ mục hỏng phải làm
 *    server KHÔNG KHỞI ĐỘNG ĐƯỢC. Nếu để nó chạy, `complete_theme` sẽ so với một danh sách bài
 *    rỗng ⇒ luôn "chưa xong" (bé không bao giờ nhận được quà) hoặc luôn "đã xong" (quà miễn phí).
 *    Cả hai đều im lặng.
 */

import raw from './content-index.json';
import { contentIndexFileSchema } from '../schemas/content.js';
import type { UnlockCondition } from '../types/content.js';

const parsed = contentIndexFileSchema.safeParse(raw);
if (!parsed.success) {
  throw new Error(
    'shared/content/content-index.json không hợp lệ: ' +
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') +
      ' — chạy `npx tsx scripts/gen-content-index.ts --apply` để sinh lại.',
  );
}

/** Một chủ đề trong chỉ mục — đúng những gì logic nhiệm vụ cần, không hơn. */
export interface ThemeIndexEntry {
  id: string;
  levelId: string;
  /** Vị trí trên bản đồ, bắt đầu từ 1 (khớp `ThemeMapItem.index`). */
  index: number;
  lessonIds: string[];
  wordCount: number;
  /** Chủ đề đã có bài tập game chưa. */
  hasGames: boolean;
  unlock: UnlockCondition;
}

const LEVELS = parsed.data.levels;
const THEMES: ThemeIndexEntry[] = parsed.data.themes;

/**
 * Cấp học đang dùng. Một chỗ khai báo cho cả server lẫn client.
 *
 * ⚠️ Trùng giá trị với `DEFAULT_LEVEL_ID` trong `src/data/index.ts`, nhưng KHÔNG import được
 *    từ đó (`src/` dùng `import.meta.glob`). Khi có Movers/Flyers, cả hai chỗ này phải cùng
 *    được thay bằng cơ chế chọn cấp — không phải bằng cách sửa một trong hai.
 */
export const DEFAULT_CONTENT_LEVEL_ID = 'starters';

/** Tra chủ đề theo id. `undefined` khi không có — người gọi tự quyết định (thường là trả 0). */
const themeById = new Map<string, ThemeIndexEntry>(THEMES.map((theme) => [theme.id, theme]));

export function getThemeIndex(themeId: string): ThemeIndexEntry | undefined {
  return themeById.get(themeId);
}

// =============================================================================
// Chữ của từ — cho báo cáo phụ huynh (T073)
// =============================================================================

/** Chữ của một từ: `id` + nghĩa tiếng Anh + nghĩa tiếng Việt. */
export interface WordTextEntry {
  id: string;
  en: string;
  vi: string;
}

/**
 * Bảng tra chữ của từ, dựng MỘT LẦN từ chỉ mục. Khử trùng theo `id` đã xảy ra ở bộ sinh — bộ
 * sinh NÉM LỖI nếu hai nơi định nghĩa cùng `id` với chữ khác nhau, nên ở đây mỗi `id` là duy nhất.
 */
const wordById = new Map<string, WordTextEntry>(parsed.data.words.map((word) => [word.id, word]));

/**
 * Tra chữ của một từ theo `id`. Trả `undefined` khi chỉ mục KHÔNG có từ đó.
 *
 * ⚠️ TRẢ `undefined`, KHÔNG ném — và đây là chủ ý. Người gọi là BÁO CÁO: một `word_id` nằm trong
 *    `word_progress` của bé mà không còn trong nội dung (từ đã bị gỡ khỏi `src/data/`) KHÔNG được
 *    làm hỏng cả báo cáo. Nơi gọi tự quyết định bỏ qua từ đó (báo cáo vẫn phải mở được — xem
 *    `ReportService`). `scripts/validate-content.ts` mới là chỗ bắt lỗi gõ sai id, lúc build.
 */
export function getWordText(wordId: string): WordTextEntry | undefined {
  return wordById.get(wordId);
}

/** Thứ tự chủ đề của một cấp (theo bản đồ). Mảng rỗng nếu cấp không có trong chỉ mục. */
export function levelThemeIds(levelId: string = DEFAULT_CONTENT_LEVEL_ID): string[] {
  return LEVELS.find((level) => level.id === levelId)?.themeIds ?? [];
}

/**
 * Các chủ đề của một cấp, theo ĐÚNG thứ tự bản đồ.
 *
 * ⚠️ Lọc theo `levelThemeIds` chứ không lọc theo `theme.levelId`: thứ tự là dữ liệu biên tập
 *    nằm ở `level.themeIds`, giống hệt `src/data/index.ts`. Một chủ đề có mặt trong chỉ mục
 *    nhưng không được level khai báo thì KHÔNG hiển thị (validator V2 coi đó là lỗi).
 */
export function themesForLevel(levelId: string = DEFAULT_CONTENT_LEVEL_ID): ThemeIndexEntry[] {
  const out: ThemeIndexEntry[] = [];
  for (const themeId of levelThemeIds(levelId)) {
    const theme = themeById.get(themeId);
    if (theme) out.push(theme);
  }
  return out;
}

/** Id các chủ đề của một cấp ĐÃ có bài tập game. */
export function themeIdsWithGames(levelId: string = DEFAULT_CONTENT_LEVEL_ID): string[] {
  return themesForLevel(levelId)
    .filter((theme) => theme.hasGames)
    .map((theme) => theme.id);
}
