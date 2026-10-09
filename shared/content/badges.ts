/**
 * RubyLingo — Huy hiệu & Sticker: **NGUỒN CHÂN LÝ DUY NHẤT** (T068).
 *
 * Đọc `badges.json` + `stickers.json`, kiểm bằng schema dùng chung, và kiểm thêm hai bất biến mà
 * schema KHÔNG diễn đạt được. Hỏng ⇒ NÉM NGAY LÚC NẠP MODULE ⇒ server không khởi động được.
 * Cùng luật với `shop.ts` / `quests.ts` / `content-index.ts`: một danh mục sai phải làm app
 * KHÔNG CHẠY, chứ không phải chạy rồi im lặng làm sai.
 *
 * ⚠️⚠️ VÌ SAO PHẢI KIỂM EMICON **Ở ĐÂY** CHỨ KHÔNG CHỈ GHI TRONG `note` CỦA JSON:
 *   Bé phân biệt ba bộ sưu tập bằng HÌNH. Nếu một sticker dùng trùng emoji với một vật phẩm trong
 *   cửa hàng, bé thấy cùng một hình ở hai chỗ và không biết mình đang có gì. Nếu trùng với icon
 *   tiền tệ (⭐ 🌰) thì tệ hơn: bé tưởng mình được cộng tiền. Đây là luật ĐÃ GHI trong `note` của
 *   cả hai tệp JSON — nhưng ghi trong `note` thì không ai thực thi. Máy đọc được `note` không?
 *   Không. Nên luật phải nằm ở đây.
 *
 * ⚠️ Và đây cũng là lý do phải kiểm TẠI THỜI ĐIỂM NẠP: bộ ba (tiền tệ · vật phẩm · huy hiệu ·
 *   sticker) nằm ở BỐN tệp khác nhau, do bốn lần sửa khác nhau. Không có chỗ nào khác trong hệ
 *   thống nhìn thấy cả bốn cùng lúc.
 */

import rawBadges from './badges.json';
import rawStickers from './stickers.json';
import { badgesFileSchema, stickersFileSchema } from '../schemas/content.js';
import type { Badge, StickerDefinition } from '../types/reward.js';
import { SHOP_CURRENCIES, SHOP_ITEMS } from './shop.js';

function parseOrThrow<T>(
  file: string,
  result: { success: true; data: T } | { success: false; error: { issues: { path: (string | number)[]; message: string }[] } },
): T {
  if (!result.success) {
    throw new Error(
      `${file} không hợp lệ: ` +
        result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  }
  return result.data;
}

const badgesParsed = parseOrThrow(
  'shared/content/badges.json',
  badgesFileSchema.safeParse(rawBadges),
);
const stickersParsed = parseOrThrow(
  'shared/content/stickers.json',
  stickersFileSchema.safeParse(rawStickers),
);

/** 18 huy hiệu, giữ thứ tự trong tệp (mvp trước, rồi p1, p2) — dùng cho lưới Bộ sưu tập. */
export const BADGES: readonly Badge[] = badgesParsed.badges;

/** Sticker — phần thưởng BIẾN THIÊN: bé mở ra mới biết là con gì. */
export const STICKERS: readonly StickerDefinition[] = stickersParsed.stickers;

export function getBadge(id: string): Badge | undefined {
  return BADGES.find((badge) => badge.id === id);
}

export function getSticker(id: string): StickerDefinition | undefined {
  return STICKERS.find((sticker) => sticker.id === id);
}

/** Huy hiệu của một giai đoạn ra mắt, giữ thứ tự tệp. */
export function badgesForPhase(phase: Badge['phase']): Badge[] {
  return BADGES.filter((badge) => badge.phase === phase);
}

/** Sticker của một giai đoạn ra mắt, giữ thứ tự tệp. */
export function stickersForPhase(phase: StickerDefinition['phase']): StickerDefinition[] {
  return STICKERS.filter((sticker) => sticker.phase === phase);
}

/**
 * Sticker rơi ra khi hoàn thành `lessonId`, hoặc `null` nếu bài đó không có sticker.
 *
 * ⚠️ Trả `null` chứ không ném: đây là hàm chạy trong LUỒNG CHẤM ĐIỂM sau mỗi lượt chơi, và một
 *    bài không có sticker là chuyện BÌNH THƯỜNG (hầu hết bài đều không có). Ném ở đây là làm hỏng
 *    cả lượt chơi của bé vì một chuyện bình thường.
 *    Còn "bài có sticker mà sticker đó gõ sai `lessonId`" — đó là lỗi NỘI DUNG, và nó bị bắt ở
 *    `badges-content.test.ts` (đối chiếu với chỉ mục nội dung), không phải ở đây.
 */
export function stickerForLesson(lessonId: string): StickerDefinition | null {
  return STICKERS.find((sticker) => sticker.lessonId === lessonId) ?? null;
}

// =============================================================================
// Bất biến về EMICON — kiểm ngay lúc nạp
// =============================================================================

/** Bảng "emoji nào đang thuộc bộ nào", để thông báo lỗi chỉ đúng chỗ đụng nhau. */
function iconOwners(): Map<string, string> {
  const owners = new Map<string, string>();
  const claim = (icon: string, owner: string): void => {
    const existing = owners.get(icon);
    if (existing !== undefined) {
      throw new Error(
        `Emoji "${icon}" bị dùng ở HAI bộ sưu tập: ${existing} và ${owner}. ` +
          'Bé phân biệt bộ sưu tập bằng hình, nên mỗi emoji chỉ được thuộc MỘT chỗ — ' +
          'xem luật trong `note` của badges.json / stickers.json / shop-items.json.',
      );
    }
    owners.set(icon, owner);
  };

  // Tiền tệ trước: trùng với ⭐/🌰 là lỗi nặng nhất (bé tưởng được cộng tiền).
  for (const [kind, currency] of Object.entries(SHOP_CURRENCIES)) {
    claim(currency.icon, `tiền tệ "${kind}"`);
  }
  for (const item of SHOP_ITEMS) {
    claim(item.icon, `vật phẩm "${item.id}"`);
  }
  for (const badge of BADGES) {
    claim(badge.icon, `huy hiệu "${badge.id}"`);
  }
  for (const sticker of STICKERS) {
    claim(sticker.icon, `sticker "${sticker.id}"`);
  }
  return owners;
}

/** Emoji → tên chủ sở hữu. Xuất ra để test đối chiếu được mà không phải dựng lại bảng. */
export const ICON_OWNERS: ReadonlyMap<string, string> = iconOwners();
