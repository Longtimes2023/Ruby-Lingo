/**
 * Test cho `ProgressService` + `progressStore`.
 *
 * Ba thứ được kiểm kỹ nhất, vì cả ba đều hỏng IM LẶNG:
 *   1. Chưa nạp xong mà đã ghi ⇒ ĐÈ MẤT tiến độ thật trong máy.
 *   2. Hàng đợi phình quá trần ⇒ `localStorage` ném `QuotaExceededError` ⇒ không ghi được gì nữa.
 *   3. Mã sự kiện sinh ra không khớp schema ⇒ server trả 400 và hàng đợi kẹt vĩnh viễn.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  MAX_PENDING_EVENTS,
  __clearAllProgressForTests,
  clearProgress,
  createClientEventId,
  enqueueEvent,
  loadProgress,
  saveProgress,
} from '../../../src/services/ProgressService.js';
import { progressEventSchema } from '../../../shared/schemas/progress.js';
import { __resetProgressStoreForTests, useProgressStore } from '../../../src/store/progressStore.js';
import type { ProgressEvent } from '../../../shared/types/progress.js';

const CHILD = 'chi_abc';
const NOW = '2026-10-06T08:00:00.000Z';
const LATER = '2026-10-06T09:00:00.000Z';

function event(overrides: Partial<ProgressEvent> = {}): ProgressEvent {
  return {
    clientEventId: createClientEventId(),
    kind: 'word_answer',
    wordId: 'starters.cat',
    correct: true,
    occurredAt: NOW,
    ...overrides,
  };
}

beforeEach(() => {
  __clearAllProgressForTests();
  __resetProgressStoreForTests();
});

afterEach(() => {
  __clearAllProgressForTests();
});

// =============================================================================
// Mã sự kiện
// =============================================================================

describe('createClientEventId', () => {
  it('khớp schema mà SERVER dùng để kiểm — nếu không khớp, hàng đợi kẹt vĩnh viễn', () => {
    for (let i = 0; i < 50; i += 1) {
      const id = createClientEventId();
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(id.length).toBeLessThanOrEqual(64);
    }
  });

  it('không sinh trùng trong cùng một mili giây', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1_000; i += 1) ids.add(createClientEventId(1_700_000_000_000));
    expect(ids.size).toBe(1_000);
  });

  it('mã sinh ra lọt qua được `progressEventSchema` của server', () => {
    const result = progressEventSchema.safeParse(event());
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Đọc / ghi trong máy
// =============================================================================

describe('loadProgress', () => {
  it('trả trạng thái rỗng khi chưa từng lưu', () => {
    const loaded = loadProgress(CHILD, NOW);
    expect(loaded.snapshot.words).toEqual([]);
    expect(loaded.pendingEvents).toEqual([]);
    expect(loaded.lastSyncedAt).toBeNull();
  });

  it('đọc lại được những gì đã lưu', () => {
    saveProgress(CHILD, {
      version: 1,
      snapshot: { childId: CHILD, words: [], lessons: [], themes: [], dailyStats: [], serverTime: NOW },
      pendingEvents: [event()],
      lastSyncedAt: LATER,
    });
    const loaded = loadProgress(CHILD, NOW);
    expect(loaded.pendingEvents).toHaveLength(1);
    expect(loaded.lastSyncedAt).toBe(LATER);
  });

  it('BỎ dữ liệu khi phiên bản định dạng khác (bẫy: app vừa được cập nhật)', () => {
    localStorage.setItem(
      `rubylingo.progress.${CHILD}`,
      JSON.stringify({
        version: 999,
        snapshot: { childId: CHILD, words: [{ wordId: 'x' }], lessons: [], themes: [], dailyStats: [], serverTime: NOW },
        pendingEvents: [event()],
        lastSyncedAt: LATER,
      }),
    );
    const loaded = loadProgress(CHILD, NOW);
    expect(loaded.snapshot.words).toEqual([]);
    expect(loaded.pendingEvents).toEqual([]);
    expect(loaded.lastSyncedAt).toBeNull();
  });

  it('không ném lỗi khi JSON hỏng', () => {
    localStorage.setItem(`rubylingo.progress.${CHILD}`, '{ khong phai json');
    expect(() => loadProgress(CHILD, NOW)).not.toThrow();
    expect(loadProgress(CHILD, NOW).pendingEvents).toEqual([]);
  });

  it('loại bỏ sự kiện hỏng trong hàng đợi nhưng giữ sự kiện tốt', () => {
    localStorage.setItem(
      `rubylingo.progress.${CHILD}`,
      JSON.stringify({
        version: 1,
        snapshot: { childId: CHILD, words: [], lessons: [], themes: [], dailyStats: [], serverTime: NOW },
        pendingEvents: [event(), { kind: 'la-vao' }, null],
        lastSyncedAt: null,
      }),
    );
    expect(loadProgress(CHILD, NOW).pendingEvents).toHaveLength(1);
  });

  /**
   * ⭐ Ghi đè `childId` bằng giá trị thật: nếu không, một bản ghi lẫn id của bé khác sẽ làm
   *    tiến độ chảy sang hồ sơ sai khi gửi lên server.
   */
  it('ghi đè childId bằng giá trị thật truyền vào', () => {
    localStorage.setItem(
      `rubylingo.progress.${CHILD}`,
      JSON.stringify({
        version: 1,
        snapshot: { childId: 'chi_khac', words: [], lessons: [], themes: [], dailyStats: [], serverTime: NOW },
        pendingEvents: [],
        lastSyncedAt: null,
      }),
    );
    expect(loadProgress(CHILD, NOW).snapshot.childId).toBe(CHILD);
  });
});

describe('clearProgress', () => {
  it('xoá dữ liệu của một bé, không đụng bé khác', () => {
    saveProgress(CHILD, {
      version: 1,
      snapshot: { childId: CHILD, words: [], lessons: [], themes: [], dailyStats: [], serverTime: NOW },
      pendingEvents: [],
      lastSyncedAt: null,
    });
    saveProgress('chi_khac', {
      version: 1,
      snapshot: { childId: 'chi_khac', words: [], lessons: [], themes: [], dailyStats: [], serverTime: NOW },
      pendingEvents: [],
      lastSyncedAt: null,
    });
    clearProgress(CHILD);
    expect(loadProgress(CHILD, NOW).lastSyncedAt).toBeNull();
    expect(localStorage.getItem('rubylingo.progress.chi_khac')).not.toBeNull();
  });
});

describe('enqueueEvent', () => {
  it('cắt trần, bỏ sự kiện CŨ NHẤT', () => {
    let queue: ProgressEvent[] = [];
    for (let i = 0; i < MAX_PENDING_EVENTS + 10; i += 1) {
      queue = enqueueEvent(queue, event({ clientEventId: `evt_${i}` }));
    }
    expect(queue).toHaveLength(MAX_PENDING_EVENTS);
    expect(queue[0]!.clientEventId).toBe('evt_10');
    expect(queue.at(-1)!.clientEventId).toBe(`evt_${MAX_PENDING_EVENTS + 9}`);
  });

  it('không cắt khi còn dưới trần', () => {
    const queue = enqueueEvent([], event());
    expect(queue).toHaveLength(1);
  });
});

// =============================================================================
// Store
// =============================================================================

describe('progressStore — chặn ghi trước khi nạp xong', () => {
  /**
   * ⭐ BẪY QUAN TRỌNG NHẤT: một cú chạm ngay khi màn hình vừa hiện, trước khi `hydrate()`
   *    chạy, sẽ ghi vào ảnh chụp RỖNG rồi lưu đè lên dữ liệu thật trong máy.
   */
  it('KHÔNG ghi gì khi chưa nạp xong', () => {
    const store = useProgressStore.getState();
    expect(store.recordWordAnswer('starters.cat', true)).toBeNull();
    expect(useProgressStore.getState().pendingEvents).toHaveLength(0);
    expect(useProgressStore.getState().snapshot.words).toHaveLength(0);
  });

  it('KHÔNG ghi gì khi chưa có bé nào', () => {
    useProgressStore.getState().hydrate('');
    expect(useProgressStore.getState().recordWordAnswer('starters.cat', true)).toBeNull();
  });
});

describe('progressStore — sau khi nạp', () => {
  beforeEach(() => {
    useProgressStore.getState().hydrate(CHILD);
  });

  it('nạp xong thì `hydrated` bật và `childId` đúng', () => {
    expect(useProgressStore.getState().hydrated).toBe(true);
    expect(useProgressStore.getState().childId).toBe(CHILD);
  });

  it('ghi câu trả lời ⇒ cập nhật ảnh chụp VÀ xếp vào hàng đợi', () => {
    const created = useProgressStore.getState().recordWordAnswer('starters.cat', true);
    expect(created).not.toBeNull();
    const state = useProgressStore.getState();
    expect(state.snapshot.words[0]).toMatchObject({ wordId: 'starters.cat', correctCount: 1 });
    expect(state.pendingEvents).toHaveLength(1);
  });

  it('sự kiện sinh ra lọt qua schema của server', () => {
    const created = useProgressStore.getState().recordWordAnswer('starters.cat', false);
    expect(progressEventSchema.safeParse(created).success).toBe(true);
  });

  it('GHI XUỐNG MÁY ngay — tải lại trang vẫn còn tiến độ', () => {
    useProgressStore.getState().recordWordAnswer('starters.cat', true);
    const reloaded = loadProgress(CHILD, NOW);
    expect(reloaded.snapshot.words).toHaveLength(1);
    expect(reloaded.pendingEvents).toHaveLength(1);
  });

  it('sự kiện "đã học" và "hoàn thành bài" cũng được ghi', () => {
    useProgressStore.getState().markWordLearned('starters.dog');
    useProgressStore.getState().completeLesson('at-the-zoo-1');
    const state = useProgressStore.getState();
    expect(state.snapshot.words[0]!.learned).toBe(true);
    expect(state.snapshot.lessons[0]!.completed).toBe(true);
    expect(state.pendingEvents).toHaveLength(2);
  });

  it('nạp lại cùng một bé không xoá tiến độ đang có', () => {
    useProgressStore.getState().recordWordAnswer('starters.cat', true);
    useProgressStore.getState().hydrate(CHILD);
    expect(useProgressStore.getState().snapshot.words).toHaveLength(1);
  });

  it('đổi sang bé khác thì nạp tiến độ riêng của bé đó', () => {
    useProgressStore.getState().recordWordAnswer('starters.cat', true);
    useProgressStore.getState().hydrate('chi_khac');
    expect(useProgressStore.getState().childId).toBe('chi_khac');
    expect(useProgressStore.getState().snapshot.words).toHaveLength(0);
  });

  it('quay lại bé cũ thì tiến độ cũ vẫn còn trong máy', () => {
    useProgressStore.getState().recordWordAnswer('starters.cat', true);
    useProgressStore.getState().hydrate('chi_khac');
    useProgressStore.getState().hydrate(CHILD);
    expect(useProgressStore.getState().snapshot.words).toHaveLength(1);
  });
});

describe('progressStore — gộp ảnh chụp từ server', () => {
  beforeEach(() => {
    useProgressStore.getState().hydrate(CHILD);
  });

  it('gộp chứ không ghi đè — không nuốt mất việc bé vừa làm', () => {
    useProgressStore.getState().recordWordAnswer('starters.cat', true);
    useProgressStore.getState().applyServerSnapshot({
      childId: CHILD,
      words: [
        {
          childId: CHILD,
          wordId: 'starters.dog',
          learned: true,
          mastered: false,
          correctCount: 2,
          wrongCount: 0,
          lastSeenAt: NOW,
          updatedAt: NOW,
        },
      ],
      lessons: [],
      themes: [],
      dailyStats: [],
      serverTime: LATER,
    });
    const words = useProgressStore.getState().snapshot.words.map((w) => w.wordId).sort();
    expect(words).toEqual(['starters.cat', 'starters.dog']);
  });

  it('KHÔNG gộp khi chưa nạp xong', () => {
    __resetProgressStoreForTests();
    useProgressStore.getState().applyServerSnapshot({
      childId: CHILD,
      words: [],
      lessons: [],
      themes: [],
      dailyStats: [],
      serverTime: LATER,
    });
    expect(useProgressStore.getState().snapshot.serverTime).not.toBe(LATER);
  });
});

describe('progressStore — hàng đợi', () => {
  beforeEach(() => {
    useProgressStore.getState().hydrate(CHILD);
  });

  it('bỏ đúng những sự kiện đã gửi thành công', () => {
    const a = useProgressStore.getState().recordWordAnswer('starters.cat', true);
    useProgressStore.getState().recordWordAnswer('starters.dog', true);
    useProgressStore.getState().dropPending([a!.clientEventId]);
    const pending = useProgressStore.getState().pendingEvents;
    expect(pending).toHaveLength(1);
    expect(pending[0]!.wordId).toBe('starters.dog');
  });

  it('bỏ mã không tồn tại không làm hỏng hàng đợi', () => {
    useProgressStore.getState().recordWordAnswer('starters.cat', true);
    useProgressStore.getState().dropPending(['khong-co']);
    expect(useProgressStore.getState().pendingEvents).toHaveLength(1);
  });

  it('ghi nhận lần đồng bộ thành công', () => {
    useProgressStore.getState().markSynced(LATER);
    expect(useProgressStore.getState().lastSyncedAt).toBe(LATER);
    expect(loadProgress(CHILD, NOW).lastSyncedAt).toBe(LATER);
  });

  it('hàng đợi sống sót qua tải lại trang', () => {
    for (let i = 0; i < 5; i += 1) {
      useProgressStore.getState().recordWordAnswer(`starters.w${i}`, true);
    }
    __resetProgressStoreForTests();
    useProgressStore.getState().hydrate(CHILD);
    expect(useProgressStore.getState().pendingEvents).toHaveLength(5);
    expect(useProgressStore.getState().snapshot.words).toHaveLength(5);
  });
});

describe('progressStore — reset', () => {
  it('xoá sạch trạng thái trong bộ nhớ khi không còn bé nào', () => {
    useProgressStore.getState().hydrate(CHILD);
    useProgressStore.getState().recordWordAnswer('starters.cat', true);
    useProgressStore.getState().reset();
    const state = useProgressStore.getState();
    expect(state.childId).toBeNull();
    expect(state.hydrated).toBe(false);
    expect(state.snapshot.words).toHaveLength(0);
    expect(state.pendingEvents).toHaveLength(0);
  });
});
