/**
 * RubyLingo — Bộ avatar cho bé chọn, đọc từ `shared/content/avatars.json`.
 *
 * ⭐ VÌ SAO ĐỌC TỪ JSON DÙNG CHUNG, KHÔNG VIẾT MẢNG Ở ĐÂY:
 *   Server dùng CHÍNH file này để kiểm `avatarId` gửi lên (`ChildService`). Nếu client có
 *   mảng riêng thì sớm muộn hai bên lệch nhau: client hiện một avatar mà server từ chối,
 *   và bé nhận lỗi "Bạn đồng hành này không có trong danh sách" cho một lựa chọn trông hoàn
 *   toàn hợp lệ. Cùng một nguồn ⇒ không thể lệch.
 *
 * ⚠️ KHÔNG CÓ AVATAR DO NGƯỜI DÙNG TẢI LÊN — ràng buộc COPPA/GDPR-K, không phải lựa chọn
 *    kỹ thuật. Không lưu ảnh, tên thật, hay ngày sinh của bé.
 */

import raw from '@shared/content/avatars.json';
import { avatarsFileSchema, type AvatarOption } from '@shared/schemas/content.js';

/**
 * Kiểm NGAY LÚC NẠP MODULE, không kiểm khi dùng.
 *
 * Vì sao ném lỗi thay vì cảnh báo: file avatar hỏng là lỗi lập trình (sai schema, thiếu
 * trường), không phải tình huống người dùng gặp phải. Phát hiện lúc khởi động thì sửa được
 * ngay; để tới lúc bé bấm "Tạo hồ sơ" mới lộ thì lỗi nằm cách xa nguyên nhân rất khó truy.
 */
const parsed = avatarsFileSchema.safeParse(raw);
if (!parsed.success) {
  throw new Error(
    'shared/content/avatars.json không hợp lệ: ' +
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  );
}

/** Tất cả avatar, theo đúng thứ tự trong file (thứ tự này là thứ tự hiển thị cho bé). */
export const AVATARS: readonly AvatarOption[] = parsed.data.avatars;

const BY_ID = new Map<string, AvatarOption>(AVATARS.map((a) => [a.id, a]));

/** Tra avatar theo id. Trả `null` nếu id không có trong danh sách. */
export function getAvatar(id: string): AvatarOption | null {
  return BY_ID.get(id) ?? null;
}

/** Id mặc định cho hồ sơ mới — avatar đầu tiên. */
export const DEFAULT_AVATAR_ID: string = AVATARS[0]?.id ?? 'fox';
