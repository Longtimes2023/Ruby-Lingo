/**
 * RubyLingo — Hook rubric phần Nói của phụ huynh (TẦNG 4).
 *
 * ⭐ NHIỆM VỤ: nạp trạng thái xác nhận của một bé khi hook gắn, và TỰ ĐỘNG GỬI BÙ khi trình duyệt
 *   báo có mạng trở lại. Phần đọc/ghi nằm ở `parentSpeakingStore` — hook chỉ lo hai hiệu ứng
 *   vòng đời (nạp theo `childId`, nghe sự kiện `online`), cùng lối như `useRoomPlacements`.
 */

import { useEffect } from 'react';

import { useParentSpeakingStore } from '../store/parentSpeakingStore.js';
import type { ParentSpeakingStoreState } from '../store/parentSpeakingStore.js';

export function useParentSpeaking(childId: string): ParentSpeakingStoreState {
  const store = useParentSpeakingStore();

  // Nạp theo bé: đổi bé thì đọc lại rubric của bé đó (khoá lưu tách theo `childId`).
  useEffect(() => {
    void useParentSpeakingStore.getState().load(childId);
  }, [childId]);

  /**
   * Mạng trở lại ⇒ thử đẩy phần đang chờ. Không có hiệu ứng này thì thay đổi bấm lúc offline chỉ
   * nằm trong máy cho tới lần mở màn kế tiếp.
   */
  useEffect(() => {
    const onOnline = () => {
      void useParentSpeakingStore.getState().flushPending();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  return store;
}
