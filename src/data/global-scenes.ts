/**
 * RubyLingo — Registry tranh cảnh TOÀN CỤC.
 *
 * Tranh cảnh toàn cục là tranh KHÔNG thuộc `Theme` nào — ví dụ nền màn hình M6
 * "Nhà thú cưng" (nơi 5 linh vật sống cùng nhau). Xem `GlobalSceneAsset`.
 *
 * Vì sao đọc từ `shared/content/global-scenes.json` thay vì viết thẳng mảng ở đây:
 *   - `scripts/validate-content.ts` đọc được file JSON bằng `fs` (giống xp-levels.json,
 *     quests.json...) nên kiểm được tranh có thật hay chưa (rule V17).
 *   - Nếu viết mảng thẳng trong .ts thì validator phải import module TS của client ⇒
 *     kéo theo cả `import.meta` của Vite, chạy bằng tsx sẽ vỡ.
 */

import raw from '@shared/content/global-scenes.json';
import type { GlobalSceneAsset } from '@shared/types/content.js';

/** Tất cả tranh cảnh toàn cục. */
export const GLOBAL_SCENES: readonly GlobalSceneAsset[] = raw.scenes;

const BY_KEY = new Map<string, GlobalSceneAsset>(GLOBAL_SCENES.map((s) => [s.key, s]));

/** Tra tranh theo khoá code (VD: "homeSceneImage"). Trả `null` nếu chưa khai báo. */
export function getGlobalScene(key: string): GlobalSceneAsset | null {
  return BY_KEY.get(key) ?? null;
}
