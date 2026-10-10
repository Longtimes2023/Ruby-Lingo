/**
 * RubyLingo — Tra cứu TỪ theo CHỮ tiếng Anh, cho các LỰA CHỌN dạng tranh của bài thi cuối khoá.
 *
 * ⭐ VÌ SAO CẦN TRA CỨU NÀY (không tự ghép `starters.<en>`):
 *   Nội dung `choose_picture` (Listening P3/P4) khai `options` là MẢNG CHUỖI tiếng Anh ("kite",
 *   "balloon"…), KHÔNG phải `wordId`. Muốn vẽ HÌNH của từng lựa chọn thì phải biết chuỗi đó ứng
 *   với `Word` nào. Tự ghép id bằng `starters.` + chữ là SAI: `orange` có HAI từ (`starters.orange-n`
 *   quả cam và `starters.orange-adj` màu cam) — ghép chuỗi sẽ gán nhầm hình. Đây đúng cảnh báo ở
 *   đầu `src/data/index.ts` về `wordAssetUrlOrNull`.
 *
 * ⭐ VÌ SAO Ở FILE `.ts` RIÊNG (không để trong `parts.tsx`):
 *   Hai hàm dưới đây là hàm THUẦN, không phải component. Quy tắc lint `react-refresh/only-export-
 *   components` cấm một file `.tsx` có component vừa xuất hàm thường ⇒ cảnh báo, mà lint chạy
 *   `--max-warnings 0` ⇒ ĐỎ. Cùng lý do `choice.ts` đã tách khỏi `parts.tsx`.
 */

import type { LevelBundle, Word } from '@shared/types/content.js';

/**
 * Bảng tra `en` (đã chuẩn hoá chữ thường) → `Word` của một level.
 *
 * ⚠️ KHOÁ MƠ HỒ BỊ LOẠI BỎ, không "first wins": hai từ khác nhau cùng đọc một chữ (`orange-n` vs
 *    `orange-adj`) ⇒ tra theo chữ không đủ để quyết định. Khi ấy ta XOÁ khoá đó khỏi bảng (trả về
 *    "không biết") thay vì chọn bừa một từ rồi vẽ nhầm hình cho bé.
 *
 * Gộp cả biến thể viết khác (`forms.alt`, VD "gray" của "grey") — chuỗi lựa chọn trong đề có thể
 * dùng biến thể, và chúng vẫn trỏ về cùng một từ.
 */
export function buildWordsByEn(level: LevelBundle): Map<string, Word> {
  const byEn = new Map<string, Word>();
  const ambiguous = new Set<string>();

  const add = (raw: string, word: Word): void => {
    const key = raw.trim().toLowerCase();
    if (key.length === 0) return;

    const existing = byEn.get(key);
    if (existing === undefined) {
      byEn.set(key, word);
      return;
    }
    if (existing.id !== word.id) ambiguous.add(key);
  };

  for (const word of level.words) {
    add(word.en, word);
    for (const alt of word.forms?.alt ?? []) add(alt, word);
  }

  for (const key of ambiguous) byEn.delete(key);
  return byEn;
}

/**
 * Từ ứng với một LỰA CHỌN (chuỗi tiếng Anh), hoặc `null` nếu không tra được / mơ hồ.
 *
 * `byEn` có thể `undefined` (component chạy mà không được truyền bảng tra) ⇒ lùi về `null`; nơi gọi
 * khi ấy chỉ hiện chữ, KHÔNG vẽ ảnh — không bao giờ để bé thấy ô ảnh vỡ.
 */
export function findWordForOption(
  byEn: ReadonlyMap<string, Word> | undefined,
  option: string,
): Word | null {
  if (byEn === undefined) return null;
  return byEn.get(option.trim().toLowerCase()) ?? null;
}
