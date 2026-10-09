/**
 * RubyLingo — `progressStore`: tiến độ học của bé đang chọn, trong bộ nhớ + trong máy.
 *
 * ⭐ VÌ SAO LÀ ZUSTAND CHỨ KHÔNG PHẢI TANSTACK QUERY:
 *   Tiến độ có HAI nguồn: bản trong máy (tức thì, chơi được offline) và bản trên server
 *   (chậm nhưng là sự thật cuối cùng). TanStack Query chỉ giỏi phần thứ hai. Còn phần thứ
 *   nhất — ghi xuống máy ngay khi bé trả lời — là trạng thái sống còn của app và phải ở
 *   ngoài vòng đời cache. Xem `sessionStore.ts` cho cùng lập luận.
 *
 * ⭐ MỌI THAO TÁC GHI ĐỀU ĐI QUA `commit()`:
 *   Ghi state rồi lưu xuống máy, LUÔN LUÔN, trong một chỗ duy nhất. Nếu để mỗi action tự
 *   nhớ gọi `saveProgress`, chỉ cần một action quên là có một loại tiến độ không bao giờ
 *   được lưu — và nó sẽ là loại ít dùng nhất, tức là loại không ai phát hiện ra cho tới
 *   khi bé mất tiến độ thật.
 *
 * ⚠️ `nowIso()` ĐƯỢC GỌI Ở TẦNG NÀY, KHÔNG Ở TẦNG COMPONENT:
 *   Thời điểm phải là lúc SỰ KIỆN XẢY RA. Nếu component tự lấy giờ rồi truyền xuống, thời
 *   điểm sẽ là lúc render — sai lệch vài trăm mili giây, và tệ hơn: hai sự kiện trong cùng
 *   một lượt render sẽ mang CÙNG một thời điểm, làm luật "lần ghi sau thắng" mất khả năng
 *   phân xử.
 */

import { create } from 'zustand';

import type { ProgressEvent, ProgressSnapshot } from '@shared/types/progress.js';
import { applyEvent, emptySnapshot, mergeProgressSnapshots } from '@shared/progress-merge.js';
import {
  MAX_PENDING_EVENTS,
  createClientEventId,
  loadProgress,
  saveProgress,
  type StoredProgress,
} from '../services/ProgressService.js';
import { nowIso } from '../lib/time.js';

interface ProgressState {
  /** Bé mà dữ liệu dưới đây thuộc về. `null` = chưa nạp. */
  childId: string | null;
  snapshot: ProgressSnapshot;
  /** Sự kiện chưa gửi được lên server. */
  pendingEvents: ProgressEvent[];
  lastSyncedAt: string | null;
  /** Đã đọc xong dữ liệu trong máy chưa. Trước khi xong thì KHÔNG được ghi. */
  hydrated: boolean;

  /** Nạp tiến độ của một bé từ `localStorage`. Gọi lại cùng bé thì không làm gì. */
  hydrate: (childId: string) => void;
  /** Ghi một câu trả lời của bé. Trả về sự kiện vừa tạo để tầng đồng bộ gửi lên. */
  recordWordAnswer: (wordId: string, correct: boolean) => ProgressEvent | null;
  markWordLearned: (wordId: string) => ProgressEvent | null;
  completeLesson: (lessonId: string) => ProgressEvent | null;
  /** Gộp ảnh chụp từ server vào bản trong máy (luật gộp ở `shared/progress-merge.ts`). */
  applyServerSnapshot: (snapshot: ProgressSnapshot) => void;
  /** Bỏ các sự kiện đã gửi thành công khỏi hàng đợi. */
  dropPending: (clientEventIds: readonly string[]) => void;
  /** Ghi nhận lần đồng bộ thành công. */
  markSynced: (serverTime: string) => void;
  /** Xoá sạch (đăng xuất, hoặc chuyển sang bé khác). */
  reset: () => void;
}

/** Trạng thái rỗng — cũng là trạng thái trong lúc chờ nạp xong. */
function emptyState(): Pick<
  ProgressState,
  'childId' | 'snapshot' | 'pendingEvents' | 'lastSyncedAt' | 'hydrated'
> {
  return {
    childId: null,
    snapshot: emptySnapshot('', nowIso()),
    pendingEvents: [],
    lastSyncedAt: null,
    hydrated: false,
  };
}

export const useProgressStore = create<ProgressState>((set, get) => {
  /**
   * Ghi state + lưu xuống máy trong MỘT chỗ.
   *
   * Không lưu khi chưa `hydrated`: lúc đó `snapshot` còn rỗng, và ghi nó xuống sẽ ĐÈ MẤT dữ
   * liệu thật đang nằm trong máy. Đây là kiểu mất dữ liệu tệ nhất — nó xảy ra đúng vào lần
   * tải trang đầu tiên, trước khi `hydrate()` kịp chạy.
   */
  const commit = (
    patch: Partial<ProgressState>,
    options: { persist?: boolean } = {},
  ): void => {
    set(patch);
    const state = get();
    if (options.persist === false) return;
    if (!state.childId || !state.hydrated) return;

    const stored: StoredProgress = {
      version: 1,
      snapshot: state.snapshot,
      pendingEvents: state.pendingEvents,
      lastSyncedAt: state.lastSyncedAt,
    };
    saveProgress(state.childId, stored);
  };

  /** Tạo sự kiện từ một hành động của bé và áp ngay vào bản trong máy. */
  const record = (
    build: (occurredAt: string) => Omit<ProgressEvent, 'clientEventId' | 'occurredAt'>,
  ): ProgressEvent | null => {
    const state = get();
    // Chưa nạp xong thì KHÔNG ghi: `snapshot.childId` còn rỗng, và một sự kiện áp vào đó sẽ
    // thuộc về không ai.
    if (!state.childId || !state.hydrated) return null;

    const occurredAt = nowIso();
    const event: ProgressEvent = {
      clientEventId: createClientEventId(),
      occurredAt,
      ...build(occurredAt),
    };

    commit({
      snapshot: applyEvent(state.snapshot, event),
      pendingEvents: capQueue([...state.pendingEvents, event]),
    });

    return event;
  };

  return {
    ...emptyState(),

    hydrate: (childId) => {
      const state = get();
      if (state.childId === childId && state.hydrated) return;

      const stored = loadProgress(childId, nowIso());
      set({
        childId,
        snapshot: stored.snapshot,
        pendingEvents: stored.pendingEvents,
        lastSyncedAt: stored.lastSyncedAt,
        hydrated: true,
      });
    },

    recordWordAnswer: (wordId, correct) =>
      record((occurredAt) => ({
        kind: 'word_answer',
        wordId,
        correct,
        occurredAt,
      })),

    markWordLearned: (wordId) => record((occurredAt) => ({ kind: 'word_learned', wordId, occurredAt })),

    completeLesson: (lessonId) =>
      record((occurredAt) => ({ kind: 'lesson_completed', lessonId, occurredAt })),

    applyServerSnapshot: (incoming) => {
      const state = get();
      if (!state.hydrated) return;
      // Gộp chứ không ghi đè: bản trong máy có thể chứa những gì bé vừa làm mà server chưa
      // biết (vừa trả lời xong, hàng đợi chưa gửi). Ghi đè sẽ nuốt mất chúng.
      commit({ snapshot: mergeProgressSnapshots(state.snapshot, incoming) });
    },

    dropPending: (clientEventIds) => {
      const drop = new Set(clientEventIds);
      const state = get();
      const pendingEvents = state.pendingEvents.filter((e) => !drop.has(e.clientEventId));
      if (pendingEvents.length === state.pendingEvents.length) return;
      commit({ pendingEvents });
    },

    markSynced: (serverTime) => {
      commit({ lastSyncedAt: serverTime });
    },

    reset: () => {
      set(emptyState());
    },
  };
});

/** Cắt hàng đợi về trần, bỏ sự kiện CŨ NHẤT. Xem bẫy 1 ở `ProgressService.ts`. */
function capQueue(events: ProgressEvent[]): ProgressEvent[] {
  if (events.length <= MAX_PENDING_EVENTS) return events;
  return events.slice(events.length - MAX_PENDING_EVENTS);
}

/** Chỉ dùng trong test. */
export function __resetProgressStoreForTests(): void {
  useProgressStore.setState(emptyState());
}
