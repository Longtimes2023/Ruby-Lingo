/**
 * RubyLingo — BỘ NHỚ CỤC BỘ cho rubric phần Nói của phụ huynh (TẦNG 4).
 *
 * ⭐ VÌ SAO VẪN CẦN MỘT BẢN CỤC BỘ DÙ ĐÃ CÓ SERVER:
 *   Bố mẹ có thể ngồi chỗ sóng yếu. Nếu mỗi lần bấm là một vòng gọi mạng thì một cú rớt mạng
 *   làm mất luôn lựa chọn vừa bấm. Bản cục bộ là ĐỆM: ghi NGAY xuống máy để không mất gì, rồi
 *   đẩy lên server ở chế độ nền; khi mạng trở lại, phần chưa đẩy sẽ được gửi bù.
 *
 * ⚠️ TÁCH KHỎI COMPONENT (`ParentSpeakingChecklist.tsx`): `.tsx` chỉ nên xuất COMPONENT (Fast
 *   Refresh của Vite), và logic đọc/ghi này cần TEST RIÊNG, không cần render React.
 *
 * ⚠️ KHOÁ LƯU TÁCH THEO TỪNG BÉ (`childId`): anh/chị/em trong nhà không ghi đè kết quả của nhau.
 *   Chế độ riêng tư của Safari ném lỗi khi đọc/ghi ⇒ mọi thao tác đều bọc `try/catch`, không bao
 *   giờ để lọt lỗi ra màn hình phụ huynh.
 *
 * ⚠️ ĐÂY KHÔNG PHẢI NGUỒN SỰ THẬT CUỐI CÙNG: server mới là. Bản cục bộ chỉ giữ hình dạng ĐÚNG
 *   như hợp đồng (`{ id, done }[]`) — cùng DANH MỤC id với `shared/schemas/parent-speaking.ts`,
 *   nên một mục lạ trong máy bị bỏ qua thay vì chảy lên server.
 */

import type { ParentSpeakingItem } from '@shared/schemas/parent-speaking.js';
import { parentSpeakingItemSchema } from '@shared/schemas/parent-speaking.js';

/** Bản đệm cục bộ: các mục đã chọn + mốc server (nếu biết) + cờ "còn thay đổi chưa đẩy được". */
export interface ParentSpeakingCache {
  items: ParentSpeakingItem[];
  /** Mốc cập nhật của SERVER (ISO UTC), hoặc `null` nếu chưa từng đồng bộ. */
  updatedAt: string | null;
  /** Có thay đổi cục bộ CHƯA đẩy lên server (mất mạng lúc bấm). */
  pending: boolean;
}

const STORAGE_PREFIX = 'rubylingo.parent.speaking-check.';
/** Phiên bản bản đệm. Đổi khi hình dạng đổi ⇒ bản cũ bị bỏ (không cố đọc "được gì đọc nấy"). */
const CACHE_VERSION = 2;

/** Khoá lưu của một bé. */
export function speakingCacheKey(childId: string): string {
  return `${STORAGE_PREFIX}${childId}`;
}

const EMPTY: ParentSpeakingCache = { items: [], updatedAt: null, pending: false };

/** Đọc lựa chọn đã lưu. Hỏng/không đọc được ⇒ coi như chưa xác nhận gì. */
export function loadSpeakingCache(childId: string): ParentSpeakingCache {
  try {
    const raw = localStorage.getItem(speakingCacheKey(childId));
    if (!raw) return { ...EMPTY };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...EMPTY };
    const record = parsed as { version?: unknown; items?: unknown; updatedAt?: unknown; pending?: unknown };
    if (record.version !== CACHE_VERSION) return { ...EMPTY };

    const items: ParentSpeakingItem[] = [];
    if (Array.isArray(record.items)) {
      for (const entry of record.items) {
        const item = parentSpeakingItemSchema.safeParse(entry);
        // Mục lạ / méo mó bị BỎ QUA — không để một hàng rác trong máy chảy lên server.
        if (item.success && !items.some((existing) => existing.id === item.data.id)) {
          items.push(item.data);
        }
      }
    }

    return {
      items,
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
      pending: record.pending === true,
    };
  } catch {
    return { ...EMPTY };
  }
}

/** Ghi bản đệm xuống máy. Không ghi được (hết dung lượng, chế độ riêng tư) ⇒ bỏ qua im lặng. */
export function saveSpeakingCache(childId: string, cache: ParentSpeakingCache): void {
  try {
    localStorage.setItem(
      speakingCacheKey(childId),
      JSON.stringify({
        version: CACHE_VERSION,
        items: cache.items,
        updatedAt: cache.updatedAt,
        pending: cache.pending,
      }),
    );
  } catch {
    /* Không lưu được thì thôi — lựa chọn vẫn đúng trong phiên hiện tại. */
  }
}

/** Xoá bản đệm của một bé. */
export function clearSpeakingCache(childId: string): void {
  try {
    localStorage.removeItem(speakingCacheKey(childId));
  } catch {
    /* Không quan trọng. */
  }
}

/** Dùng trong test: xoá bản đệm của một bé. */
export function __clearSpeakingCacheForTests(childId: string): void {
  clearSpeakingCache(childId);
}
