/**
 * RubyLingo — Danh mục NHIỆM VỤ, đọc từ `shared/content/quests.json`.
 *
 * ⚠️⚠️ VÌ SAO NẰM Ở `shared/`, KHÔNG Ở `server/`:
 *   Cùng lý do như `shop.ts` và `levels.ts`. Nhiệm vụ có HAI người dùng với hai nhu cầu khác nhau:
 *     • SERVER cần `criteria` để biết cộng tiến độ thế nào, và `rewards` để biết trao gì khi bé
 *       bấm "Nhận thưởng". Server PHẢI là bên quyết định — nếu tin `rewards` do client gửi lên
 *       thì bé tự khai một nhiệm vụ thưởng 9999 ⭐.
 *     • CLIENT cần `icon` + `description_vi` + `rewards` để VẼ thẻ nhiệm vụ và thanh tiến độ.
 *   Server KHÔNG import được `src/` (`tsconfig.server.json` chỉ gom `server/`, `shared/`,
 *   `scripts/`). Để danh mục ở `src/` nghĩa là server buộc phải có bản sao thứ hai — và bản
 *   sao thứ hai của PHẦN THƯỞNG là loại lệch nguy hiểm nhất.
 *
 * ⭐ THÊM NHIỆM VỤ = SỬA JSON, KHÔNG SỬA FILE NÀY (đúng tinh thần "data-driven": thêm
 *   Movers/Flyers sau này cũng chỉ là thêm dữ liệu).
 */

import raw from './quests.json';
import { questsFileSchema } from '../schemas/content.js';
import type { QuestCriteria, QuestDefinition, QuestTier } from '../types/reward.js';

/**
 * Kiểm NGAY LÚC NẠP MODULE — cùng lý do như `levels.ts` / `shop.ts`.
 *
 * Một danh mục hỏng phải làm server KHÔNG KHỞI ĐỘNG ĐƯỢC. Nếu để nó chạy, hậu quả là một
 * nhiệm vụ có `target` bằng `NaN` ⇒ không bao giờ hoàn thành (bé không bao giờ nhận được quà),
 * hoặc một nhiệm vụ có `criteria` không nhận ra ⇒ tiến độ đứng im mãi. Cả hai đều im lặng.
 */
const parsed = questsFileSchema.safeParse(raw);
if (!parsed.success) {
  throw new Error(
    'shared/content/quests.json không hợp lệ: ' +
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  );
}

/**
 * Toàn bộ nhiệm vụ, GIỮ NGUYÊN thứ tự trong file (file đã nhóm theo tầng: ngày → tuần → mốc).
 *
 * ⚠️ KHÔNG sắp xếp lại ở đây. Thứ tự này là thứ tự hiển thị trên màn hình Nhiệm vụ (M9), và
 *    nó là dữ liệu biên tập (bé nên thấy nhiệm vụ dễ trước), không phải một chi tiết kỹ thuật.
 *    Danh sách đã nhóm theo tầng nên không cần thêm trường `order` — một danh sách, một thứ tự
 *    (bài học đã trả giá cho hai nguồn thứ tự, xem `lessonSchema`).
 */
export const QUESTS: readonly QuestDefinition[] = parsed.data.quests;

/**
 * Bảng tra theo id, dựng MỘT LẦN.
 *
 * ⚠️ Kiểm trùng id ngay tại đây, dù `validate-content.ts` cũng kiểm: validator là một script
 *    riêng, có thể không chạy (test đơn vị import thẳng file này). Hai nhiệm vụ cùng id sẽ khiến
 *    `Map` im lặng giữ cái SAU ⇒ phần thưởng của một trong hai biến mất tuỳ theo thứ tự dòng
 *    trong file, tức là một bug chỉ đổi hành vi khi ai đó sắp xếp lại JSON. Tệ hơn: hai nhiệm
 *    vụ cùng id dùng CHUNG một hàng `quest_progress` (khoá chính là `(child_id, quest_id,
 *    period_key)`) ⇒ tiến độ của chúng trộn vào nhau và không ai phát hiện.
 */
const byId = new Map<string, QuestDefinition>();
for (const quest of QUESTS) {
  if (byId.has(quest.id)) {
    throw new Error(`shared/content/quests.json có hai nhiệm vụ cùng id: "${quest.id}"`);
  }
  byId.set(quest.id, quest);
}

/** Tra nhiệm vụ theo id. Trả `undefined` khi không có — người gọi tự quyết định ném lỗi gì. */
export function getQuest(questId: string): QuestDefinition | undefined {
  return byId.get(questId);
}

/** Thứ tự các tầng, từ "gần gũi nhất" tới "xa nhất" — dùng để nhóm trên màn hình M9. */
export const QUEST_TIERS: readonly QuestTier[] = ['daily', 'weekly', 'milestone'];

/** Nhiệm vụ của một tầng, giữ thứ tự trong file. */
export function questsByTier(tier: QuestTier): QuestDefinition[] {
  return QUESTS.filter((quest) => quest.tier === tier);
}

/**
 * Số đơn vị tiến độ cần để một nhiệm vụ được coi là XONG.
 *
 * ⭐ VÌ SAO PHẢI LÀ MỘT HÀM DÙNG CHUNG, KHÔNG ĐỂ MỖI NƠI TỰ SUY:
 *   Con số này được ghi vào `quest_progress.target` (có `CHECK (target > 0)`) và được so với
 *   `progress` để quyết định "xong chưa". Nếu tầng đọc và tầng ghi suy ra hai giá trị khác nhau,
 *   thanh tiến độ hiện "3/3" mà nút "Nhận thưởng" vẫn mờ — bé bấm mãi không được gì.
 *
 * ⚠️ ĐIỂM TINH TẾ VỀ HAI LOẠI TIÊU CHÍ:
 *   • Tiêu chí dạng ĐẾM (`count`): `target` = số cần đếm.
 *   • Tiêu chí dạng "MỘT VIỆC CỤ THỂ" (`complete_lesson`, `complete_theme`): chỉ có hai trạng
 *     thái — chưa làm được 0, làm rồi được 1. `target` LUÔN là 1, không phải `count`. Gán
 *     `count` ở đây sẽ tạo ra một nhiệm vụ không bao giờ xong (`count` là `undefined`).
 *   • `reach_level`: `target` = cấp cần đạt. `progress` là CẤP hiện tại, nên ta so sánh hai đại
 *     lượng cùng đơn vị (cấp với cấp), không phải "số cấp đã lên".
 */
export function questTarget(criteria: QuestCriteria): number {
  switch (criteria.kind) {
    case 'complete_lessons':
    case 'play_games':
    case 'correct_answers':
    case 'learn_days':
    case 'unlock_theme':
    case 'collect_stickers':
      return criteria.count;
    case 'complete_lesson':
    case 'complete_theme':
      return 1;
    case 'reach_level':
      return criteria.level;
  }
}

/**
 * Mô tả tiến độ để hiển thị, KHÔNG phải một con số trần.
 *
 * ⭐ VÌ SAO `reach_level` KHÔNG HIỆN "2/3 CẤP":
 *   Với nhiệm vụ cấp bậc, thanh tiến độ "0/3" ở đầu game là SAI về mặt cảm xúc: bé đang ở cấp 1
 *   và nhiệm vụ đòi cấp 3, nhưng "0/3" đọc lên thành "con chưa làm được gì cả" trong khi bé đã
 *   học được kha khá. Nó cũng trùng nghĩa với "số cấp còn phải lên", một đại lượng khác.
 *   Vì vậy loại này luôn hiện dạng "Cấp 3" — xem `QuestCard` (T061).
 */
export function isQuestProgressCountable(criteria: QuestCriteria): boolean {
  return criteria.kind !== 'reach_level' && criteria.kind !== 'complete_lesson'
    && criteria.kind !== 'complete_theme';
}

/**
 * Nhiệm vụ đang hoạt động trong giai đoạn phát triển hiện tại.
 *
 * ⚠️ HIỆN TRẢ VỀ **TẤT CẢ** — cố ý.
 *   `quests.json` có 3 tầng (`mvp` / `p1` / `p2`), và `GAME-REWARD-DESIGN.md` §9 mô tả màn M9
 *   ở MVP là "3 nhiệm vụ ngày + 2 mốc". Nhưng đó là MỨC TỐI THIỂU phải có, không phải một lệnh
 *   cấm hiển thị phần còn lại: các nhiệm vụ `p1` đều đã có định nghĩa đầy đủ và bộ máy theo dõi
 *   chúng không tốn thêm gì. Giấu chúng đi chỉ tạo ra hai chế độ hành vi (mvp/p1) mà không đổi
 *   lấy lợi ích nào — và app này dùng trong nhà, không có lý do "khoá tính năng".
 *   Hàm để riêng để ngày nào cần lọc theo giai đoạn thì sửa ở ĐÚNG MỘT CHỖ.
 */
export function activeQuests(): QuestDefinition[] {
  return [...QUESTS];
}
