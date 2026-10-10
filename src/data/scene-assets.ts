/**
 * RubyLingo — Khoá TRANH CẢNH có thật trong `public/assets/scenes/` + URL an toàn.
 *
 * ⭐ VÌ SAO CẦN MỘT DANH SÁCH (không cứ ghép `/assets/scenes/<khoá>.webp`):
 *   `sceneAssetUrlOrNull` (src/data/index.ts) chỉ kiểm khoá KHÁC RỖNG — nó KHÔNG biết tệp có tồn
 *   tại hay không, nên một khoá thiếu tệp vẫn sinh ra URL rồi 404 ⇒ bé thấy Ô ẢNH VỠ. Client không
 *   `stat` được tệp, và `onError` của `<img>` không chạy trong jsdom ⇒ không kiểm chứng được (cùng
 *   lý do đã dẫn tới manifest ảnh từ vựng). Danh sách dưới đây cho UI biết chắc chắn tệp nào CÓ.
 *
 * ⚠️ CÁCH GIỮ DANH SÁCH NÀY ĐÚNG: `tests/unit/client/scene-assets.test.ts` đọc THẲNG thư mục
 *    `public/assets/scenes/` và bắt buộc danh sách khớp đúng đĩa. Thêm/xoá một tranh mà quên cập
 *    nhật ở đây ⇒ test ĐỎ ngay. Nhờ vậy không cần bước sinh manifest riêng, mà vẫn không thể lệch.
 *
 * ⚠️ KHÔNG dùng `import.meta.glob('/public/...')` để quét: Vite coi mỗi tệp khớp là một module và
 *    ĐÓNG GÓI LẠI toàn bộ tranh cảnh (trùng với bản trong `public/`) ⇒ phình bundle vô ích. Một
 *    danh sách tĩnh + test đồng bộ là đủ và rẻ.
 */

/** Khoá (tên tệp không đuôi) của MỌI tranh cảnh có thật trong `public/assets/scenes/`. */
export const SCENE_KEYS: ReadonlySet<string> = new Set([
  'at-home',
  'at-school',
  'at-the-beach',
  'at-the-clothes-shop',
  'at-the-zoo',
  'home-scene',
  'my-body',
  'my-favourite-food',
  'my-friends-birthday',
  'my-street',
  'story-park',
]);

/**
 * URL tranh cảnh nếu tệp CÓ THẬT, ngược lại `null` (UI lùi về KHÔNG ảnh — không bao giờ ảnh vỡ).
 * Cùng hình dạng với `wordAssetUrlOrNull` để nơi gọi xử lý hai loại asset như nhau.
 */
export function sceneAssetUrlIfExistsOrNull(key: string): string | null {
  const trimmed = key.trim();
  if (trimmed.length === 0 || !SCENE_KEYS.has(trimmed)) return null;
  return `/assets/scenes/${trimmed}.webp`;
}
