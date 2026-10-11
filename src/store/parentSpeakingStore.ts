/**
 * RubyLingo — STORE trạng thái xác nhận PHẦN NÓI của phụ huynh (TẦNG 4).
 *
 * ⭐ NHIỆM VỤ: giữ rubric 4 mục Nói của MỘT bé, đọc/ghi qua SERVER, và KHÔNG LÀM MẤT lựa chọn
 *   của bố mẹ khi mạng chập chờn. Mô hình ba lớp:
 *
 *   · **Bản cục bộ (`localStorage`, luôn ghi NGAY)** — bấm là ghi xuống máy trước tiên, nên một
 *     cú rớt mạng không làm mất lựa chọn vừa bấm. Cùng triết lý `roomPlacementStore` +
 *     `finalTestSession`.
 *   · **Server (`GET`/`PUT .../parent-speaking`, nguồn sự thật)** — để đổi máy vẫn thấy, và để
 *     báo cáo phụ huynh đọc được. Khi mạng OK, phản hồi của server là bản CHÍNH THỨC (`updatedAt`
 *     do server đóng dấu).
 *   · **Cờ `pending`** — bật khi có thay đổi cục bộ CHƯA đẩy được. Lần `load` kế tiếp (hoặc khi
 *     trình duyệt báo có mạng lại) sẽ gửi BÙ phần này lên server thay vì đọc đè.
 *
 * ⚠️ KHÔNG BAO GIỜ hiện mã lỗi kỹ thuật cho phụ huynh. Mọi lỗi mạng chỉ bật cờ `offline`; UI tự
 *   dịch thành câu trung tính ("giữ trên thiết bị này, sẽ tự đồng bộ lại").
 *
 * ⚠️ ĐÂY KHÔNG PHẢI ĐIỂM SỐ. Store chỉ giữ `{ id, done }[]` — ghi nhận quan sát của người lớn.
 */

import { create } from 'zustand';

import type { ParentSpeakingItem } from '@shared/schemas/parent-speaking.js';

import { parentSpeakingApi } from '../api/endpoints.js';
import { loadSpeakingCache, saveSpeakingCache } from '../lib/parentSpeakingMarks.js';

export interface ParentSpeakingStoreState {
  childId: string | null;
  items: ParentSpeakingItem[];
  /** Mốc cập nhật do SERVER đóng dấu (ISO UTC), hoặc `null` khi chưa từng đồng bộ. */
  updatedAt: string | null;
  loading: boolean;
  saving: boolean;
  /** Còn thay đổi cục bộ CHƯA đẩy được lên server. */
  pending: boolean;
  /** Lần đồng bộ gần nhất thất bại (thường là mất mạng) ⇒ UI hiện câu trung tính. */
  offline: boolean;
  load: (childId: string) => Promise<void>;
  save: (childId: string, items: ParentSpeakingItem[]) => Promise<void>;
  /** Thử đẩy phần đang chờ. Dùng khi trình duyệt báo có mạng lại. */
  flushPending: () => Promise<void>;
  reset: () => void;
}

type ParentSpeakingData = Pick<
  ParentSpeakingStoreState,
  'childId' | 'items' | 'updatedAt' | 'loading' | 'saving' | 'pending' | 'offline'
>;

function emptyState(): ParentSpeakingData {
  return {
    childId: null,
    items: [],
    updatedAt: null,
    loading: false,
    saving: false,
    pending: false,
    offline: false,
  };
}

export const useParentSpeakingStore = create<ParentSpeakingStoreState>((set, get) => ({
  ...emptyState(),

  load: async (childId) => {
    const cache = loadSpeakingCache(childId);
    set({
      ...emptyState(),
      childId,
      items: cache.items,
      updatedAt: cache.updatedAt,
      pending: cache.pending,
      loading: true,
    });

    // Có thay đổi chưa đẩy được (mất mạng hôm trước) ⇒ gửi BÙ, KHÔNG đọc đè từ server: bản cục
    // bộ mới hơn bản trên server.
    if (cache.pending) {
      await get().save(childId, cache.items);
      if (get().childId === childId) set({ loading: false });
      return;
    }

    try {
      const state = await parentSpeakingApi.get(childId);
      if (get().childId !== childId) return;
      saveSpeakingCache(childId, { items: state.items, updatedAt: state.updatedAt, pending: false });
      set({
        items: state.items,
        updatedAt: state.updatedAt,
        loading: false,
        pending: false,
        offline: false,
      });
    } catch {
      if (get().childId !== childId) return;
      // Mất mạng KHÔNG phải lỗi kỹ thuật cần báo. Giữ bản cục bộ (nếu có) và đánh dấu offline.
      set({ loading: false, offline: true });
    }
  },

  save: async (childId, items) => {
    if (get().childId !== childId) return;
    // Ghi cục bộ NGAY (không mất gì dù mạng rớt), rồi mới thử server.
    saveSpeakingCache(childId, { items, updatedAt: get().updatedAt, pending: true });
    set({ items, pending: true, saving: true });

    try {
      const saved = await parentSpeakingApi.save(childId, { items });
      if (get().childId !== childId) return;
      saveSpeakingCache(childId, { items: saved.items, updatedAt: saved.updatedAt, pending: false });
      set({
        items: saved.items,
        updatedAt: saved.updatedAt,
        pending: false,
        saving: false,
        offline: false,
      });
    } catch {
      if (get().childId !== childId) return;
      // Giữ NGUYÊN bản cục bộ + cờ `pending`; lần có mạng kế tiếp sẽ gửi bù.
      set({ saving: false, offline: true });
    }
  },

  flushPending: async () => {
    const { childId, items, pending } = get();
    if (childId === null || !pending) return;
    await get().save(childId, items);
  },

  reset: () => set(emptyState()),
}));

/** Dùng trong test: trả store về trạng thái rỗng. */
export function __resetParentSpeakingStoreForTests(): void {
  useParentSpeakingStore.setState(emptyState());
}
