/**
 * RubyLingo — Danh mục THÚ CƯNG bé chọn, đọc từ `shared/content/pets.json`.
 *
 * ⚠️⚠️ VÌ SAO FILE NÀY NẰM Ở `shared/` CHỨ KHÔNG Ở `server/` HAY `src/`:
 *   Cùng lý do như `shared/content/shop.ts` / `levels.ts`. Danh mục này có HAI người dùng:
 *     • SERVER cần nó để KIỂM id hợp lệ (`RewardService.choosePet`) và để PHÂN GIẢI `pet_type`
 *       đọc từ DB về một con có thật — kể cả khi DB ghi `NULL` hay một id của bản deploy khác.
 *     • CLIENT cần `name_vi` + 3 emoji (`iconBaby/Adult/Super`) để VẼ `PetAvatar` và màn chọn.
 *   Server KHÔNG import được `src/` (`tsconfig.server.json` chỉ gom `server/`, `shared/`,
 *   `scripts/`). Để danh mục ở `src/` nghĩa là server buộc phải có bản sao thứ hai — và hai bản
 *   sao của "con nào hợp lệ" sẽ lệch nhau đúng lúc bé vừa chọn một con mà server cho là lạ.
 *
 * ⭐ FILE NÀY LÀ MỘT **LÁ**: lúc chạy nó chỉ import JSON + schema + KIỂU. Không import
 *   `RewardService`, không import React, không import gì khác — nhờ vậy `server/` và `src/` đều
 *   dùng được mà không tạo vòng import.
 *
 * ⭐ "CÓ NHỮNG CON NÀO" LÀ **DỮ LIỆU**, KHÔNG PHẢI HẰNG SỐ CODE. Thêm một con thú cưng mới =
 *   thêm một mục JSON, KHÔNG sửa file này. Không có `CHECK (pet_type IN (...))` trong DB, cũng
 *   không có union `'monkey' | 'cat' | ...` trong TypeScript — cả hai đều sẽ buộc phải deploy
 *   code mỗi lần thêm một con, và bản deploy cũ sẽ coi con mới là "lạ".
 */

import raw from './pets.json';
import { petsFileSchema } from '../schemas/content.js';
import type { EvolutionStage, PetDefinition } from '../types/reward.js';

/**
 * Kiểm NGAY LÚC NẠP MODULE — cùng lý do như `shop.ts` / `levels.ts`.
 *
 * Một danh mục hỏng phải làm server KHÔNG KHỞI ĐỘNG ĐƯỢC. Nếu để nó chạy, hậu quả là màn chọn
 * thú cưng hiện một con thiếu tên hoặc thiếu hình, và `getPetDefinition` im lặng rơi về mặc định
 * cho một id mà bé vừa bấm — bé chọn "Rồng" mà nhận "Khỉ" và không có lỗi nào nổi lên.
 */
const parsed = petsFileSchema.safeParse(raw);
if (!parsed.success) {
  throw new Error(
    'shared/content/pets.json không hợp lệ: ' +
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  );
}

/** Toàn bộ thú cưng, GIỮ NGUYÊN thứ tự trong file (thứ tự này là thứ tự hiện trên màn chọn). */
export const PET_DEFINITIONS: readonly PetDefinition[] = parsed.data.pets;

/**
 * Con mặc định — cũng là con TRÙNG CÓ CHỦ Ý với linh vật dẫn đường Momo hiện tại (🐵).
 *
 * ⭐ Vì sao chọn nó làm mặc định: bé đang dùng trên VPS đã thấy con 🐵 từ trước tới nay. Khi bản
 *   này lên, một bé CHƯA từng chọn (`pet_type = NULL`) phải thấy ĐÚNG con cũ — không phải một
 *   con mới toanh khiến bé tưởng Momo của mình bị thay. Xem `note` trong `pets.json`.
 */
export const DEFAULT_PET_ID = 'monkey';

/**
 * Bảng tra theo id, dựng MỘT LẦN.
 *
 * ⚠️ Kiểm trùng id ngay tại đây, dù `petsFileSchema` (`.superRefine`) cũng kiểm: schema là tầng
 *    kiểm DỮ LIỆU, còn `Map` là thứ thật sự tra cứu. Hai mục cùng id sẽ khiến `Map` im lặng giữ
 *    cái SAU — nghĩa là con nào hiện ra tuỳ theo thứ tự dòng trong file, và chỉ đổi hành vi khi
 *    ai đó sắp xếp lại JSON. Kiểm ở đây biến lỗi đó thành một lần nạp module thất bại, ồn ào.
 */
const byId = new Map<string, PetDefinition>();
for (const pet of PET_DEFINITIONS) {
  if (byId.has(pet.id)) {
    throw new Error(`shared/content/pets.json có hai thú cưng cùng id: "${pet.id}"`);
  }
  byId.set(pet.id, pet);
}

/**
 * `id` này có phải một thú cưng trong danh mục không.
 *
 * Type-predicate (`id is string`) chứ KHÔNG phải `boolean` suông: người gọi thường đang cầm một
 * giá trị `unknown` (một cột TEXT đọc từ DB), và sau phép kiểm này họ cần TypeScript thu hẹp nó
 * thành `string` để dùng tiếp — thay vì phải `as string` (một lời hứa không ai kiểm).
 */
export function isPetId(id: unknown): id is string {
  return typeof id === 'string' && byId.has(id);
}

/**
 * Định nghĩa của một con, tra theo id.
 *
 * ⚠️⚠️ HÀM NÀY **KHÔNG NÉM** — ĐÂY LÀ ĐIỂM KHÁC BIỆT CỐ Ý SO VỚI `getShopItem` / `stageDefinition`.
 *
 *   Nó chạy trên dữ liệu CŨ TRONG DB: `pet_state.pet_type` có thể là `NULL` (bé chưa từng chọn)
 *   hoặc một id của BẢN DEPLOY KHÁC (một con vừa bị xoá khỏi `pets.json`, hoặc DB phục hồi từ
 *   sao lưu của phiên bản khác). Ném ở đây nghĩa là **màn của bé trắng** vì một con thú cưng
 *   không còn tồn tại — hỏng một thứ phụ kéo cả app xuống, đúng thứ dự án này cấm.
 *
 *   Thay vào đó: id lạ ⇒ rơi về `DEFAULT_PET_ID` (Momo 🐵). Bé luôn thấy MỘT con có thật; server
 *   ghi log cảnh báo ở tầng trên (`RewardService.readPet`) để người vận hành biết mà dọn dữ liệu.
 */
export function getPetDefinition(id?: string | null): PetDefinition {
  const found = id != null ? byId.get(id) : undefined;
  return found ?? byId.get(DEFAULT_PET_ID)!;
}

/**
 * Emoji của một con ở một giai đoạn tiến hoá.
 *
 * ⚠️ `stage` là `EvolutionStage` = `'baby' | 'adult' | 'super'` — KHÔNG còn `'egg'` (T04). Ba bậc
 *    này gắn với ba emoji trong danh mục. Nhánh `default` là LƯỚI AN TOÀN cho dữ liệu lạ lọt qua
 *    kiểu (DB cũ, test tay): rơi về emoji "trưởng thành" thay vì `undefined` — một `undefined`
 *    lọt tới JSX sẽ hiện ô trống, còn "trưởng thành" thì bé vẫn thấy một con vật.
 */
export function petEmojiFor(id: string | null | undefined, stage: EvolutionStage): string {
  const pet = getPetDefinition(id);
  switch (stage) {
    case 'baby':
      return pet.iconBaby;
    case 'adult':
      return pet.iconAdult;
    case 'super':
      return pet.iconSuper;
    default:
      return pet.iconAdult;
  }
}

/** Tên tiếng Việt của một con — luôn có (id lạ rơi về mặc định, xem `getPetDefinition`). */
export function petNameVi(id: string | null | undefined): string {
  return getPetDefinition(id).name_vi;
}
