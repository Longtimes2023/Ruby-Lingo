/**
 * RubyLingo — Tách một danh sách `RewardGrant` thành các loại quà cụ thể.
 *
 * ⚠️⚠️ VÌ SAO FILE NÀY NẰM Ở `shared/`:
 *   `RewardGrant[]` xuất hiện ở BA nơi và cả ba đều cần "gói này gồm những gì":
 *     • `xp-levels.json` — quà của một cấp (server trao: `XpService`).
 *     • `quests.json`    — quà của một nhiệm vụ (server trao khi bé bấm "Nhận thưởng").
 *     • client           — vẽ các chip quà "⭐10 · 🌰1 · 🎖️" trên thẻ nhiệm vụ / màn lên cấp.
 *   Nếu mỗi nơi tự viết một `switch`, ba bản sao sẽ lệch nhau ngay lần đầu ai đó thêm một
 *   `kind` mới — và triệu chứng là "quà hiện trên màn hình nhưng không vào ví", hoặc ngược
 *   lại. Một luật, một chỗ.
 *
 * ⭐ HÀM THUẦN, KHÔNG CHẠM DB. Nhờ vậy nó kiểm được trong vài mili giây, không cần dựng
 *   service, không cần migration — xem `tests/unit/shared/reward-split.test.ts`.
 *
 * ⚠️ `xp` Ở ĐÂY KHÁC `stars`/`acorns` Ở MỘT ĐIỂM QUAN TRỌNG: nó KHÔNG được trao qua
 *   `RewardService.applyGrantsInTx` mà phải đi qua `XpService.addXpInTx`. Lý do: cộng XP còn
 *   phải phát hiện ĐÃ VƯỢT CẤP NÀO và trao quà của (các) cấp đó. Vì vậy `toRewardBundle()`
 *   CỐ TÌNH bỏ `xp` ra — ai muốn trao XP phải tự gọi `XpService`, và đó là điều ta muốn nhìn
 *   thấy ngay trên chữ ký hàm. Xem quyết định 2 ở đầu `server/services/RewardService.ts`.
 */

import type { RewardGrant } from '../types/reward.js';

/**
 * Một danh sách quà đã được phân loại.
 *
 * `badgeIds`/`stickerIds`/`itemIds` là ID (đã lọc bỏ món thiếu `refId`), KHÔNG phải object —
 * vì đây là phần *dữ liệu* mà cả hai phía đều dùng để hiển thị và tra cứu.
 */
export interface RewardSplit {
  stars: number;
  acorns: number;
  xp: number;
  badgeIds: string[];
  stickerIds: string[];
  itemIds: string[];
}

/** Gói quà ở dạng mà `RewardService.applyGrantsInTx` nhận — KHÔNG có `xp`, xem ghi chú đầu file. */
export interface RewardBundleLike {
  stars: number;
  acorns: number;
  badges: string[];
  stickers: Array<{ stickerId: string; lessonId?: string | null }>;
  items: Array<{ itemId: string; quantity?: number }>;
}

function emptySplit(): RewardSplit {
  return { stars: 0, acorns: 0, xp: 0, badgeIds: [], stickerIds: [], itemIds: [] };
}

/**
 * Số tiền của một grant, đã kẹp về số nguyên ≥ 0.
 *
 * ⚠️ Vì sao kẹp thay vì tin `amount`: `amount` là `optional` trong kiểu, và một file nội dung
 *    sửa tay có thể có `amount: -5` hoặc `amount: 1.5`. `stars: -5` chảy xuống tận `UPDATE
 *    wallet SET stars = stars + ?` sẽ TRỪ tiền của bé — một hình phạt, đúng thứ app này cấm.
 *    Kẹp ở đây thì dù nội dung sai, bé cũng chỉ nhận 0 thay vì bị trừ.
 */
function amountOf(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value as number));
}

/**
 * Phân loại quà. Gộp `stars`/`acorns`/`xp` thành TỔNG; gom badge/sticker/vật phẩm thành ID.
 *
 * ⚠️ Quà thiếu `refId` (vd `{ kind: 'badge' }`) bị BỎ QUA thay vì trao một id rỗng. Một
 *    `badge_earned` với `badge_id = ''` sẽ là một ô trống trong bộ sưu tập của bé mà không có
 *    gì giải thích nó, và không có đường nào xoá đi.
 */
export function splitRewards(grants: readonly RewardGrant[]): RewardSplit {
  const split = emptySplit();

  for (const grant of grants) {
    switch (grant.kind) {
      case 'stars':
        split.stars += amountOf(grant.amount);
        break;
      case 'acorns':
        split.acorns += amountOf(grant.amount);
        break;
      case 'xp':
        split.xp += amountOf(grant.amount);
        break;
      case 'badge':
        if (grant.refId) split.badgeIds.push(grant.refId);
        break;
      case 'sticker':
        if (grant.refId) split.stickerIds.push(grant.refId);
        break;
      case 'item':
        if (grant.refId) split.itemIds.push(grant.refId);
        break;
    }
  }

  return split;
}

/** Đổi kết quả phân loại thành gói mà `RewardService.applyGrantsInTx` nhận. `xp` bị bỏ lại. */
export function toRewardBundle(split: RewardSplit): RewardBundleLike {
  return {
    stars: split.stars,
    acorns: split.acorns,
    badges: split.badgeIds,
    stickers: split.stickerIds.map((stickerId) => ({ stickerId })),
    items: split.itemIds.map((itemId) => ({ itemId })),
  };
}
