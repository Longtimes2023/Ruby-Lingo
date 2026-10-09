/**
 * RubyLingo — Bảng 7 cấp Nhà thám hiểm + 4 giai đoạn tiến hoá linh vật.
 * Đọc từ `shared/content/xp-levels.json`.
 *
 * ⚠️⚠️ VÌ SAO FILE NÀY NẰM Ở `shared/` CHỨ KHÔNG Ở `src/data/`:
 *   Cùng một số XP phải cho ra CÙNG một cấp ở CẢ HAI phía:
 *     • SERVER dùng nó để quyết định có trao quà của cấp mới hay không (`XpService`).
 *     • CLIENT dùng nó để vẽ thanh XP và hiện "Lv.5".
 *   Trước đây công thức chỉ nằm ở `src/data/xp-levels.ts`. Server KHÔNG import được `src/`
 *   (`tsconfig.server.json` chỉ gom `server/`, `shared/`, `scripts/`), nên bản sao ở server
 *   sẽ là bản sao CHÉP TAY — và hai bản chép tay luôn lệch nhau đúng lúc quan trọng nhất.
 *   Lệch ở đây nghĩa là: màn hình hiện "thanh XP đã đầy" mà server tưởng bé chưa lên cấp nên
 *   không trao huy hiệu — bé thấy mình bị lừa, và không có lỗi nào được ném ra.
 *   Một file, hai bên cùng đọc. `src/data/xp-levels.ts` giờ chỉ còn là lớp re-export.
 *
 * ⭐ XP VÀ TIẾN HOÁ LÀ HAI THANH ĐỘC LẬP — ĐÂY LÀ CHỦ Ý, KHÔNG PHẢI TRÙNG LẶP:
 *   XP đo NỖ LỰC của bé (trả lời đúng, chơi game) → tăng nhanh, đổi màu mỗi tuần.
 *   Tiến hoá đo SỐ TỪ ĐÃ HỌC → tăng chậm, không mua được bằng tiền.
 *   Hai nguồn động lực khác nhau: một cho "hôm nay con giỏi", một cho "con đang lớn lên".
 */

import raw from './xp-levels.json';
import { xpLevelsFileSchema } from '../schemas/content.js';
import type {
  EvolutionStage,
  EvolutionStageDefinition,
  XpLevelDefinition,
} from '../types/reward.js';

/**
 * Kiểm NGAY LÚC NẠP MODULE.
 *
 * File hỏng là lỗi lập trình, không phải tình huống người dùng gặp. Ném lỗi lúc khởi động thì
 * sửa được ngay; để tới lúc bé vừa chơi xong một game và chờ xem mình lên cấp chưa mới lộ thì
 * nguyên nhân đã nằm cách xa chỗ hiện lỗi.
 *
 * ⚠️ Bản kiểm này chạy ở CẢ server lẫn client — cố ý. Một file JSON hỏng phải làm server
 *    KHÔNG KHỞI ĐỘNG ĐƯỢC, chứ không phải chạy rồi âm thầm trao sai quà.
 */
const parsed = xpLevelsFileSchema.safeParse(raw);
if (!parsed.success) {
  throw new Error(
    'shared/content/xp-levels.json không hợp lệ: ' +
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  );
}

/**
 * Bảng cấp, ĐÃ SẮP THEO `xpRequired` TĂNG DẦN.
 *
 * ⭐ Vì sao sắp lại thay vì tin vào thứ tự trong file: `getLevelForXp()` bên dưới tìm cấp cao
 *   nhất mà bé đã đạt tới bằng cách duyệt xuôi. Nếu file bị sửa và vô tình đảo thứ tự (rất dễ
 *   xảy ra khi ai đó thêm một cấp mới vào giữa), hàm sẽ trả về cấp SAI mà không có gì báo lỗi.
 *   Sắp xếp ở đây khiến thứ tự file không còn quan trọng.
 */
export const XP_LEVELS: readonly XpLevelDefinition[] = [...parsed.data.levels].sort(
  (a, b) => a.xpRequired - b.xpRequired,
);

/** 4 giai đoạn tiến hoá, sắp theo số từ cần — cùng lý do như trên. */
export const EVOLUTION_STAGES: readonly EvolutionStageDefinition[] = [
  ...parsed.data.evolutionStages,
].sort((a, b) => a.wordsRequired - b.wordsRequired);

/** Cấp cao nhất trong bảng (7). */
export const MAX_LEVEL: number = XP_LEVELS.at(-1)?.level ?? 1;

/** Cấp khởi đầu (1). */
export const MIN_LEVEL: number = XP_LEVELS[0]?.level ?? 1;

/**
 * Cấp hiện tại suy ra từ tổng XP.
 *
 * ⚠️ PHẢI GIỐNG HỆT HAI PHÍA — giờ điều đó được BẢO ĐẢM bằng cấu trúc (một file), không còn
 *    là một lời hứa trong comment.
 *
 * Trả về phần tử cuối cùng khi XP vượt mốc cao nhất — KHÔNG kẹp XP lại, vì XP vẫn phải tiếp
 * tục tăng để bé thấy mình vẫn đang tiến bộ dù đã ở cấp cao nhất.
 */
export function getLevelForXp(xp: number): XpLevelDefinition {
  const safeXp = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  let current = XP_LEVELS[0]!;
  for (const level of XP_LEVELS) {
    if (safeXp >= level.xpRequired) current = level;
    else break; // đã sắp tăng dần ⇒ dừng sớm được, không cần duyệt hết
  }
  return current;
}

/** Cấp kế tiếp, hoặc `null` nếu đã ở cấp cao nhất. */
export function getNextLevel(xp: number): XpLevelDefinition | null {
  const current = getLevelForXp(xp);
  return XP_LEVELS.find((level) => level.level === current.level + 1) ?? null;
}

/**
 * Danh sách cấp đã VƯỢT QUA trong khoảng `(xpHết, xpMới]`.
 *
 * ⭐ VÌ SAO CẦN HÀM NÀY, KHÔNG CHỈ `getLevelForXp` TRƯỚC VÀ SAU:
 *   Một lần cộng XP có thể nhảy QUA NHIỀU cấp cùng lúc — ví dụ bé hoàn thành bài đầu tiên và
 *   nhận một lượt XP lớn, hoặc mốc chuỗi 7 ngày (+30 XP). Nếu server chỉ so `cấp cũ` với
 *   `cấp mới` rồi trao quà của cấp mới, thì **mọi cấp bị nhảy qua sẽ mất quà vĩnh viễn**: bé
 *   đã vượt mốc XP của cấp đó, nên lần sau có cộng thêm cũng không bao giờ "lên" cấp ấy nữa.
 *   Trả về DANH SÁCH để người gọi trao đủ quà, theo đúng thứ tự cấp tăng dần.
 */
export function getLevelsCrossed(fromXp: number, toXp: number): XpLevelDefinition[] {
  const from = Number.isFinite(fromXp) ? Math.max(0, fromXp) : 0;
  const to = Number.isFinite(toXp) ? Math.max(0, toXp) : 0;

  // Không tiến bộ (XP giảm hoặc đứng yên) ⇒ không vượt cấp nào. KHÔNG bao giờ trả về cấp thấp
  // hơn như một "sự kiện" — cấp không tụt, xem ghi chú ở `XpService`.
  if (to <= from) return [];

  const oldLevel = getLevelForXp(from).level;
  return XP_LEVELS.filter((level) => level.level > oldLevel && to >= level.xpRequired);
}

export interface XpProgress {
  /** Cấp hiện tại. */
  level: XpLevelDefinition;
  /** Cấp kế tiếp, `null` khi đã tối đa. */
  next: XpLevelDefinition | null;
  /** XP đã kiếm được TRONG cấp hiện tại (không phải tổng XP). */
  xpIntoLevel: number;
  /** XP cần để đi hết cấp hiện tại. `0` khi đã tối đa. */
  xpForLevel: number;
  /** Tỉ lệ 0–1 để vẽ thanh. `1` khi đã tối đa (thanh đầy trọn, không phải rỗng). */
  ratio: number;
  /** Còn bao nhiêu XP nữa thì lên cấp. `0` khi đã tối đa. */
  xpRemaining: number;
}

/**
 * Toàn bộ số liệu cần để vẽ thanh XP — tính MỘT LẦN, không rải phép tính ra component.
 *
 * ⭐ Vì sao gom vào đây: nếu component tự tính `xp - level.xpRequired`, mỗi nơi sẽ tự quyết
 *   định chuyện "đã tối đa thì thanh đầy hay rỗng" và "mẫu số là 0 thì sao". Gom lại thì chỉ có
 *   một câu trả lời, và nó kiểm thử được mà không cần render.
 */
export function getXpProgress(xp: number): XpProgress {
  const level = getLevelForXp(xp);
  const next = getNextLevel(xp);
  const safeXp = Number.isFinite(xp) ? Math.max(0, xp) : 0;

  if (!next) {
    // Đã ở cấp cao nhất: thanh phải ĐẦY, không phải rỗng. Một thanh rỗng ở cấp tối đa trông
    // như bé vừa bị tụt xuống — ngược hoàn toàn với ý nghĩa "con đã đạt tới đỉnh".
    return {
      level,
      next: null,
      xpIntoLevel: safeXp - level.xpRequired,
      xpForLevel: 0,
      ratio: 1,
      xpRemaining: 0,
    };
  }

  const xpForLevel = next.xpRequired - level.xpRequired;
  const xpIntoLevel = safeXp - level.xpRequired;
  // `xpForLevel` không thể bằng 0 vì hai cấp khác nhau phải có mốc XP khác nhau (validator
  // của file đảm bảo điều đó). Vẫn kẹp để một file sửa sai không sinh ra `Infinity`.
  const ratio = xpForLevel > 0 ? Math.min(1, Math.max(0, xpIntoLevel / xpForLevel)) : 0;

  return {
    level,
    next,
    xpIntoLevel,
    xpForLevel,
    ratio,
    xpRemaining: Math.max(0, next.xpRequired - safeXp),
  };
}

/** Giai đoạn tiến hoá theo số từ đã học. Cùng lý do như `getLevelForXp`. */
export function getEvolutionStage(wordsLearned: number): EvolutionStageDefinition {
  const safeWords = Number.isFinite(wordsLearned) ? Math.max(0, wordsLearned) : 0;
  let current = EVOLUTION_STAGES[0]!;
  for (const stage of EVOLUTION_STAGES) {
    if (safeWords >= stage.wordsRequired) current = stage;
    else break;
  }
  return current;
}

/**
 * Định nghĩa của MỘT giai đoạn theo id (`'baby'` … `'super'`).
 *
 * ⚠️ BA bậc, KHÔNG còn `'egg'` (T04): bậc 0 nay là `'baby'` — xem `shared/types/reward.ts` và
 *    migration `011_pet_type.sql`. Bé CHỌN con mình muốn ngay từ đầu, nên giữ một quả trứng 🥚 vô
 *    danh làm bậc 0 nghĩa là bé vừa chọn "Rồng" xong lại thấy một quả trứng.
 *
 * ⭐ VÌ SAO CẦN, KHI ĐÃ CÓ `getEvolutionStage(wordsLearned)`:
 *   Server trả `pet.evolutionStage` dưới dạng **ID** (server là trọng tài — nó tự đếm từ, client
 *   không được tự suy). Client chỉ còn việc VẼ, nên nó phải tra id ra `{ name_vi, icon }`. Tên và
 *   icon thuộc về **DỮ LIỆU** (`xp-levels.json`), nên việc tra cứu nằm ở đây, cạnh dữ liệu — không
 *   phải một bảng tra trong component (bảng tra trong code thì thêm giai đoạn mới là sửa 2 chỗ).
 *   Đúng khuôn mẫu của `SHOP_CURRENCIES` ở màn Cửa hàng.
 *
 * ⚠️ NÉM khi id lạ, chứ không im lặng trả về một giai đoạn mặc định. Id này do server sinh ra từ
 *    chính `EVOLUTION_STAGES`, nên nó chỉ lạ khi client và server lệch phiên bản — và lúc đó ta
 *    MUỐN một lỗi ồn ào (test đỏ, log rõ) hơn là một con Momo lặng lẽ hiện sai hình.
 *    `pet-avatar.test.tsx` có phép kiểm chạy trên TOÀN BỘ `EVOLUTION_STAGES` thật.
 */
export function stageDefinition(stage: EvolutionStage): EvolutionStageDefinition {
  const found = EVOLUTION_STAGES.find((definition) => definition.stage === stage);
  if (!found) {
    throw new Error(`Không có giai đoạn tiến hoá "${stage}" trong xp-levels.json`);
  }
  return found;
}

/**
 * Giai đoạn tiến hoá đã vượt qua trong khoảng `(từ cũ, từ mới]`.
 *
 * ⚠️ Cùng lý do như `getLevelsCrossed`: một lần học có thể nhảy qua nhiều giai đoạn (bé học
 *    liền một mạch 20 từ đầu tiên ⇒ từ `egg` thẳng lên `baby`). Nếu chỉ so trước/sau rồi lấy
 *    giai đoạn mới, các giai đoạn bị nhảy qua sẽ không bao giờ được ăn mừng.
 */
export function getEvolutionStagesCrossed(
  fromWords: number,
  toWords: number,
): EvolutionStageDefinition[] {
  const from = Number.isFinite(fromWords) ? Math.max(0, fromWords) : 0;
  const to = Number.isFinite(toWords) ? Math.max(0, toWords) : 0;
  if (to <= from) return [];

  const oldStage = getEvolutionStage(from);
  return EVOLUTION_STAGES.filter(
    (stage) => stage.wordsRequired > oldStage.wordsRequired && to >= stage.wordsRequired,
  );
}
