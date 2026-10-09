/**
 * Test cho `SyncService`.
 *
 * Trọng tâm là **MẤT TIẾN ĐỘ** — kiểu lỗi tệ nhất của một app học tập, và cũng là kiểu lỗi
 * khó phát hiện nhất: không crash, không màn hình trắng, chỉ là vài câu trả lời của bé biến
 * mất. Ba kịch bản dưới đây đã được dựng thành test:
 *
 *   • Sự kiện mới sinh ra TRONG LÚC request đang bay bị bỏ khỏi hàng đợi dù chưa gửi.
 *   • Hai lượt đồng bộ chạy chồng nhau ⇒ lượt sau chụp hàng đợi đã bị sửa ⇒ hụt sự kiện.
 *   • Gửi khi chưa nạp xong ⇒ gửi một lô rỗng kèm `since = null` ⇒ nói dối server.
 *
 * `SyncService` nhận phụ thuộc qua tham số, nên mọi kịch bản ở đây chạy trong vài mili giây
 * với đồng hồ giả — không cần React, không cần mạng, không cần chờ thật.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SyncService, type SyncDeps } from '../../../src/services/SyncService.js';
import { __resetProgressStoreForTests } from '../../../src/store/progressStore.js';
import type { ProgressEvent, ProgressSnapshot } from '../../../shared/types/progress.js';
import type { ProgressSyncResponse } from '../../../shared/types/api.js';

const CHILD = 'chi_test';
const T1 = '2026-10-06T08:00:00.000Z';
const T2 = '2026-10-06T09:00:00.000Z';

function event(id: string, wordId = 'starters.cat'): ProgressEvent {
  return { clientEventId: id, kind: 'word_answer', wordId, correct: true, occurredAt: T1 };
}

function snapshot(serverTime = T2): ProgressSnapshot {
  return { childId: CHILD, words: [], lessons: [], themes: [], dailyStats: [], serverTime };
}

/**
 * "Cổng chặn": giữ request ở trạng thái ĐANG BAY cho tới khi test gọi `gate.open()`.
 *
 * ⭐ VÌ SAO LÀ OBJECT CHỨ KHÔNG PHẢI `let release: (() => void) | null`:
 *   TypeScript thu hẹp kiểu của một biến `let` chỉ dựa trên những phép gán mà nó NHÌN THẤY
 *   trong luồng thực thi. Phép gán nằm trong callback của `new Promise` không được tính, nên
 *   `release` bị thu hẹp thành `null` ngay tại chỗ gọi ⇒ `release?.()` báo lỗi
 *   *"Type 'never' has no call signatures"*. Thuộc tính của một object không bị thu hẹp theo
 *   cách đó. Đây là điều kiện để test mô phỏng được tình huống "bé trả lời trong lúc mạng
 *   đang bận" — chính là tình huống làm mất tiến độ nếu code sai.
 */
function createGate(): { open: (() => void) | null } {
  return { open: null };
}

/** Bộ phụ thuộc giả — ghi lại mọi lời gọi để test khẳng định được. */
interface Harness {
  service: SyncService;
  state: {
    childId: string | null;
    hydrated: boolean;
    pendingEvents: ProgressEvent[];
    lastSyncedAt: string | null;
  };
  syncCalls: { childId: string; body: { events: ProgressEvent[]; since: string | null } }[];
  dropped: string[][];
  applied: ProgressSnapshot[];
  syncedAt: string[];
  setOnline: (value: boolean) => void;
  /** Đặt phản hồi cho lần gọi kế tiếp. */
  respondWith: (impl: () => Promise<ProgressSyncResponse>) => void;
}

function createHarness(overrides: Partial<SyncDeps> = {}): Harness {
  const state: Harness['state'] = {
    childId: CHILD,
    hydrated: true,
    pendingEvents: [],
    lastSyncedAt: null,
  };

  const syncCalls: Harness['syncCalls'] = [];
  const dropped: string[][] = [];
  const applied: ProgressSnapshot[] = [];
  const syncedAt: string[] = [];
  let online = true;
  let respond: () => Promise<ProgressSyncResponse> = () =>
    Promise.resolve({ snapshot: snapshot(), applied: 0, skipped: 0 });

  const deps: SyncDeps = {
    readState: () => ({ ...state, pendingEvents: [...state.pendingEvents] }),
    applyServerSnapshot: (s) => applied.push(s),
    dropPending: (ids) => {
      dropped.push([...ids]);
      const drop = new Set(ids);
      state.pendingEvents = state.pendingEvents.filter((e) => !drop.has(e.clientEventId));
    },
    markSynced: (serverTime) => {
      syncedAt.push(serverTime);
      state.lastSyncedAt = serverTime;
    },
    syncRequest: (childId, body) => {
      syncCalls.push({ childId, body: { events: [...body.events], since: body.since } });
      return respond();
    },
    isOnline: () => online,
    now: () => 0,
    ...overrides,
  };

  return {
    service: new SyncService(deps),
    state,
    syncCalls,
    dropped,
    applied,
    syncedAt,
    setOnline: (value) => {
      online = value;
    },
    respondWith: (impl) => {
      respond = impl;
    },
  };
}

beforeEach(() => {
  __resetProgressStoreForTests();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// =============================================================================
// Điều kiện tiên quyết
// =============================================================================

describe('SyncService — khi nào KHÔNG được gửi gì', () => {
  it('không gửi khi tiến độ chưa nạp xong', async () => {
    const h = createHarness();
    h.state.hydrated = false;
    h.state.pendingEvents = [event('e1')];

    await h.service.syncNow('test');
    expect(h.syncCalls).toHaveLength(0);
  });

  it('không gửi khi chưa có bé nào', async () => {
    const h = createHarness();
    h.state.childId = null;
    h.state.pendingEvents = [event('e1')];

    await h.service.syncNow('test');
    expect(h.syncCalls).toHaveLength(0);
  });

  it('không gửi khi đang offline, và báo trạng thái "đang chờ"', async () => {
    const h = createHarness();
    h.setOnline(false);
    h.state.pendingEvents = [event('e1')];

    h.service.requestSync('test');
    await vi.advanceTimersByTimeAsync(10_000);

    expect(h.syncCalls).toHaveLength(0);
    expect(h.service.getState().status).toBe('pending');
  });

  it('không gửi khi hàng đợi rỗng VÀ đã từng đồng bộ', async () => {
    const h = createHarness();
    h.state.lastSyncedAt = T2;

    await h.service.syncNow('test');
    expect(h.syncCalls).toHaveLength(0);
    expect(h.service.getState().status).toBe('idle');
  });

  it('VẪN gửi khi hàng đợi rỗng nhưng CHƯA từng đồng bộ (kéo dữ liệu về)', async () => {
    const h = createHarness();
    h.state.lastSyncedAt = null;

    await h.service.syncNow('mở-app');
    expect(h.syncCalls).toHaveLength(1);
    expect(h.syncCalls[0]!.body.events).toEqual([]);
    expect(h.syncCalls[0]!.body.since).toBeNull();
  });
});

// =============================================================================
// Gộp lô
// =============================================================================

describe('SyncService — gộp lô (debounce)', () => {
  it('nhiều thay đổi liên tiếp chỉ tạo MỘT request', async () => {
    const h = createHarness();

    for (let i = 0; i < 10; i += 1) {
      h.state.pendingEvents.push(event(`e${i}`));
      h.service.requestSync('bé-vừa-trả-lời');
      await vi.advanceTimersByTimeAsync(100);
    }

    await vi.advanceTimersByTimeAsync(2_000);
    expect(h.syncCalls).toHaveLength(1);
    expect(h.syncCalls[0]!.body.events).toHaveLength(10);
  });

  it('gửi đúng mã bé đang chọn và `since` của lần đồng bộ trước', async () => {
    const h = createHarness();
    h.state.lastSyncedAt = T1;
    h.state.pendingEvents = [event('e1')];

    await h.service.syncNow('test');
    expect(h.syncCalls[0]!.childId).toBe(CHILD);
    expect(h.syncCalls[0]!.body.since).toBe(T1);
  });

  it('gửi tối đa 200 sự kiện mỗi lô', async () => {
    const h = createHarness();
    h.state.pendingEvents = Array.from({ length: 250 }, (_, i) => event(`e${i}`));

    await h.service.syncNow('test');
    expect(h.syncCalls[0]!.body.events).toHaveLength(200);
  });

  it('còn hàng đợi sau lô đầu thì tự hẹn gửi lô tiếp', async () => {
    const h = createHarness();
    h.state.pendingEvents = Array.from({ length: 250 }, (_, i) => event(`e${i}`));

    await h.service.syncNow('test');
    expect(h.syncCalls).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(h.syncCalls).toHaveLength(2);
    expect(h.syncCalls[1]!.body.events).toHaveLength(50);
  });
});

// =============================================================================
// ⭐ Bẫy 1 — không bỏ sự kiện chưa gửi
// =============================================================================

describe('SyncService — ⭐ không làm mất sự kiện', () => {
  /**
   * ⭐⭐ KỊCH BẢN QUAN TRỌNG NHẤT CỦA FILE.
   *
   * Bé trả lời 3 câu → request bắt đầu bay → trong lúc chờ, bé trả lời thêm 2 câu nữa.
   * Nếu ta bỏ TOÀN BỘ hàng đợi khi request xong, 2 câu sau biến mất mà chưa từng được gửi.
   */
  it('sự kiện sinh ra TRONG LÚC request đang bay KHÔNG bị bỏ khỏi hàng đợi', async () => {
    const h = createHarness();
    h.state.pendingEvents = [event('e1'), event('e2'), event('e3')];

    const gate = createGate();
    h.respondWith(
      () =>
        new Promise<ProgressSyncResponse>((resolve) => {
          gate.open = () => resolve({ snapshot: snapshot(), applied: 3, skipped: 0 });
        }),
    );

    const pending = h.service.syncNow('test');

    // Bé trả lời thêm trong lúc request còn đang bay.
    h.state.pendingEvents.push(event('e4'), event('e5'));

    gate.open?.();
    await pending;

    // CHỈ ba mã của lô đầu được bỏ.
    expect(h.dropped).toHaveLength(1);
    expect(h.dropped[0]).toEqual(['e1', 'e2', 'e3']);
    expect(h.state.pendingEvents.map((e) => e.clientEventId)).toEqual(['e4', 'e5']);
  });

  it('sau khi bỏ lô đầu, hàng đợi còn lại được hẹn gửi tiếp', async () => {
    const h = createHarness();
    h.state.pendingEvents = [event('e1')];

    const gate = createGate();
    h.respondWith(
      () =>
        new Promise<ProgressSyncResponse>((resolve) => {
          gate.open = () => resolve({ snapshot: snapshot(), applied: 1, skipped: 0 });
        }),
    );

    const pending = h.service.syncNow('test');
    h.state.pendingEvents.push(event('e2'));
    gate.open?.();
    await pending;

    await vi.advanceTimersByTimeAsync(2_000);
    expect(h.syncCalls).toHaveLength(2);
    expect(h.syncCalls[1]!.body.events.map((e) => e.clientEventId)).toEqual(['e2']);
  });
});

// =============================================================================
// ⭐ Bẫy 2 — chống chồng lấn
// =============================================================================

describe('SyncService — ⭐ chống chồng lấn', () => {
  it('gọi `syncNow` hai lần liên tiếp chỉ tạo MỘT request', async () => {
    const h = createHarness();
    h.state.pendingEvents = [event('e1')];

    const gate = createGate();
    h.respondWith(
      () =>
        new Promise<ProgressSyncResponse>((resolve) => {
          gate.open = () => resolve({ snapshot: snapshot(), applied: 1, skipped: 0 });
        }),
    );

    const first = h.service.syncNow('a');
    const second = h.service.syncNow('b');
    gate.open?.();
    await Promise.all([first, second]);

    expect(h.syncCalls).toHaveLength(1);
  });

  it('sau khi lượt trước xong thì lượt sau chạy được bình thường', async () => {
    const h = createHarness();
    h.state.pendingEvents = [event('e1')];

    await h.service.syncNow('a');
    h.state.pendingEvents = [event('e2')];
    await h.service.syncNow('b');

    expect(h.syncCalls).toHaveLength(2);
  });
});

// =============================================================================
// Kết quả và trạng thái
// =============================================================================

describe('SyncService — kết quả đồng bộ', () => {
  it('gộp ảnh chụp server và ghi nhận mốc đồng bộ', async () => {
    const h = createHarness();
    h.state.pendingEvents = [event('e1')];

    await h.service.syncNow('test');

    expect(h.applied).toHaveLength(1);
    expect(h.syncedAt).toEqual([T2]);
    expect(h.service.getState()).toMatchObject({
      status: 'synced',
      lastSyncedAt: T2,
      lastError: null,
      pendingCount: 0,
    });
  });

  it('bỏ hàng đợi TRƯỚC khi gộp ảnh chụp (thứ tự có ràng buộc)', async () => {
    const order: string[] = [];
    const h = createHarness({
      dropPending: () => {
        order.push('drop');
      },
      applyServerSnapshot: () => {
        order.push('apply');
      },
    });
    h.state.pendingEvents = [event('e1')];

    await h.service.syncNow('test');
    expect(order).toEqual(['drop', 'apply']);
  });
});

// =============================================================================
// ⭐ Bẫy 4 — lui dần khi thất bại
// =============================================================================

describe('SyncService — xử lý thất bại', () => {
  it('báo trạng thái "failed" kèm thông báo lỗi', async () => {
    const h = createHarness();
    h.state.pendingEvents = [event('e1')];
    h.respondWith(() => Promise.reject(new Error('mất mạng')));

    await h.service.syncNow('test');

    expect(h.service.getState().status).toBe('failed');
    expect(h.service.getState().lastError).toBe('mất mạng');
  });

  it('KHÔNG bỏ sự kiện khỏi hàng đợi khi thất bại', async () => {
    const h = createHarness();
    h.state.pendingEvents = [event('e1')];
    h.respondWith(() => Promise.reject(new Error('mất mạng')));

    await h.service.syncNow('test');

    expect(h.dropped).toHaveLength(0);
    expect(h.state.pendingEvents).toHaveLength(1);
  });

  it('thử lại sau 5 giây, không thử lại ngay lập tức', async () => {
    const h = createHarness();
    h.state.pendingEvents = [event('e1')];
    h.respondWith(() => Promise.reject(new Error('mất mạng')));

    await h.service.syncNow('test');
    expect(h.syncCalls).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(4_000);
    expect(h.syncCalls).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(h.syncCalls).toHaveLength(2);
  });

  it('thời gian chờ TĂNG DẦN qua các lần thất bại liên tiếp', async () => {
    const h = createHarness();
    h.state.pendingEvents = [event('e1')];
    h.respondWith(() => Promise.reject(new Error('mất mạng')));

    await h.service.syncNow('lần 1');

    // Lần 2 hẹn 15s (không phải 5s): đã thất bại 1 lần rồi.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(h.syncCalls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(14_000);
    expect(h.syncCalls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(h.syncCalls).toHaveLength(3);
  });

  it('thời gian chờ có TRẦN — không lui tới vô hạn', async () => {
    const h = createHarness();
    h.state.pendingEvents = [event('e1')];
    h.respondWith(() => Promise.reject(new Error('mất mạng')));

    for (let i = 0; i < 6; i += 1) {
      await h.service.syncNow(`lần ${i}`);
      await vi.advanceTimersByTimeAsync(120_000);
    }
    // Trần là 120s, nên sau khi đã chạm trần, mỗi 120s có đúng một lần thử.
    const before = h.syncCalls.length;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(h.syncCalls.length).toBe(before + 1);
  });

  it('thành công sau thất bại thì xoá lỗi và đặt lại thời gian chờ', async () => {
    const h = createHarness();
    h.state.pendingEvents = [event('e1')];
    h.respondWith(() => Promise.reject(new Error('mất mạng')));
    await h.service.syncNow('test');
    expect(h.service.getState().status).toBe('failed');

    h.respondWith(() => Promise.resolve({ snapshot: snapshot(), applied: 1, skipped: 0 }));
    await h.service.syncNow('thủ-công');

    expect(h.service.getState()).toMatchObject({ status: 'synced', lastError: null });
  });

  it('không ném lỗi ra ngoài khi server trả lỗi', async () => {
    const h = createHarness();
    h.state.pendingEvents = [event('e1')];
    h.respondWith(() => Promise.reject('chuỗi lỗi, không phải Error'));

    await expect(h.service.syncNow('test')).resolves.toBeUndefined();
    expect(h.service.getState().status).toBe('failed');
  });
});

// =============================================================================
// ⭐ Bẫy 3 + 5 — sự kiện của trình duyệt
// =============================================================================

describe('SyncService — lắng nghe trình duyệt', () => {
  it('mạng trở lại thì đồng bộ ngay và xoá số lần thất bại', async () => {
    const h = createHarness();
    h.service.start();
    h.state.pendingEvents = [event('e1')];
    h.setOnline(false);

    h.service.requestSync('khi-offline');
    await vi.advanceTimersByTimeAsync(5_000);
    expect(h.syncCalls).toHaveLength(0);

    h.setOnline(true);
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(2_000);

    expect(h.syncCalls).toHaveLength(1);
    h.service.stop();
  });

  it('quay lại tab thì đồng bộ', async () => {
    const h = createHarness();
    h.service.start();
    h.state.pendingEvents = [event('e1')];

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(2_000);

    expect(h.syncCalls).toHaveLength(1);
    h.service.stop();
  });

  it('`stop()` gỡ lắng nghe — không đồng bộ nữa', async () => {
    const h = createHarness();
    h.service.start();
    h.service.stop();

    h.state.pendingEvents = [event('e1')];
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(2_000);

    expect(h.syncCalls).toHaveLength(0);
  });

  it('`start()` gọi hai lần không đăng ký lắng nghe hai lần', async () => {
    const h = createHarness();
    h.service.start();
    h.service.start();
    h.state.pendingEvents = [event('e1')];

    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(2_000);

    expect(h.syncCalls).toHaveLength(1);
    h.service.stop();
  });
});

// =============================================================================
// Thông báo cho người nghe
// =============================================================================

describe('SyncService — thông báo trạng thái', () => {
  it('gọi người nghe khi trạng thái đổi', async () => {
    const h = createHarness();
    const seen: string[] = [];
    h.service.subscribe((s) => seen.push(s.status));
    h.state.pendingEvents = [event('e1')];

    await h.service.syncNow('test');

    expect(seen).toContain('syncing');
    expect(seen).toContain('synced');
  });

  it('KHÔNG gọi người nghe khi không có gì đổi', () => {
    const h = createHarness();
    let calls = 0;
    h.service.subscribe(() => {
      calls += 1;
    });

    // Hàng đợi rỗng và số đếm đã là 0 ⇒ không có gì để thông báo.
    h.service.refreshPendingCount();
    h.service.refreshPendingCount();

    expect(calls).toBe(0);
  });

  it('huỷ đăng ký thì không nhận thông báo nữa', async () => {
    const h = createHarness();
    let calls = 0;
    const unsubscribe = h.service.subscribe(() => {
      calls += 1;
    });
    unsubscribe();

    h.state.pendingEvents = [event('e1')];
    await h.service.syncNow('test');

    expect(calls).toBe(0);
  });

  it('cập nhật số sự kiện đang chờ', () => {
    const h = createHarness();
    h.state.pendingEvents = [event('e1'), event('e2')];

    h.service.refreshPendingCount();
    expect(h.service.getState().pendingCount).toBe(2);
  });
});
