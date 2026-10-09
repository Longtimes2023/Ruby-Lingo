/**
 * RubyLingo — Cầu nối tới bảng cấp dùng chung.
 *
 * ⚠️ LOGIC ĐÃ CHUYỂN SANG `shared/content/levels.ts`. File này KHÔNG còn định nghĩa gì —
 *    nó chỉ re-export, để ~10 component đang `import { getXpProgress } from '@/data/xp-levels'`
 *    không phải sửa.
 *
 * ⭐ VÌ SAO PHẢI CHUYỂN:
 *   Trước đây công thức cấp nằm ở đây, kèm một comment tự nhắc *"PHẢI GIỐNG HỆT công thức ở
 *   server"* — nhưng server KHÔNG import được `src/` (`tsconfig.server.json` chỉ gom `server/`,
 *   `shared/`, `scripts/`). Nghĩa là lời nhắc đó chỉ có thể được thực hiện bằng cách CHÉP TAY
 *   công thức sang server, và hai bản chép tay sẽ lệch nhau. Chuyển sang `shared/` thì cả hai
 *   phía cùng đọc một file, và sự lệch nhau trở thành **không thể xảy ra** thay vì "được nhắc
 *   nhở là đừng làm".
 *
 * ⚠️ ĐỪNG thêm logic mới vào file này. Cần sửa công thức cấp ⇒ sửa `shared/content/levels.ts`.
 */

export {
  EVOLUTION_STAGES,
  MAX_LEVEL,
  MIN_LEVEL,
  XP_LEVELS,
  getEvolutionStage,
  getEvolutionStagesCrossed,
  getLevelForXp,
  getLevelsCrossed,
  getNextLevel,
  getXpProgress,
} from '@shared/content/levels.js';

export type { XpProgress } from '@shared/content/levels.js';
