/**
 * RubyLingo — SyncService: đẩy sự kiện tiến độ lên server và kéo về những gì server có.
 *
 * ⭐ TRIẾT LÝ: **ĐỒNG BỘ LÀ VIỆC PHỤ, KHÔNG BAO GIỜ LÀ ĐIỀU KIỆN ĐỂ HỌC.**
 *   Bé trả lời câu hỏi → tiến độ ghi xuống máy ngay (`progressStore`) → màn hình cập nhật
 *   ngay. Việc gửi lên server xảy ra sau đó, có thể muộn, có thể thất bại, và **không được
 *   phép** làm chậm hay chặn bất cứ thao tác nào của bé. Toàn bộ file này chạy nền.
 *
 * ⭐ SỰ KIỆN ĐƯỢC GỬI THEO LÔ, KHÔNG GỬI TỪNG CÁI.
 *   Một lượt chơi có thể sinh ra 20 câu trả lời trong 30 giây. Gửi từng cái nghĩa là 20
 *   request, 20 lần mở kết nối trên mạng 3G, và 20 dòng log. Gộp lại thành một lô, chờ 1,5
 *   giây sau thao tác cuối.
 *
 * -----------------------------------------------------------------------------
 * NĂM CÁI BẪY
 * -----------------------------------------------------------------------------
 *
 * ⚠️ BẪY 1 — CHỈ BỎ NHỮNG SỰ KIỆN ĐÃ THỰC SỰ GỬI.
 *    Trong lúc request đang bay, bé có thể trả lời thêm 3 câu nữa. Nếu gọi
 *    `dropPending(tất cả)` khi request xong, 3 sự kiện mới đó biến mất khỏi hàng đợi mà
 *    CHƯA từng được gửi lên — mất tiến độ vĩnh viễn, và không có lỗi nào để lần theo.
 *    Vì vậy: chụp lại ĐÚNG lô đã gửi, và chỉ bỏ đúng những mã trong lô đó.
 *
 * ⚠️ BẪY 2 — CHỐNG CHỒNG LẤN (`inFlight`).
 *    Nếu hai lượt đồng bộ chạy song song cùng gửi một sự kiện, server chống trùng được
 *    (nhờ `progress_event`), nhưng client sẽ bỏ sót sự kiện: lượt thứ nhất bỏ các mã của nó
 *    khỏi hàng đợi, lượt thứ hai chụp hàng đợi ĐÃ bị sửa ⇒ lô của nó hụt mất vài sự kiện.
 *    Một cờ `inFlight` rẻ hơn nhiều so với việc truy tìm lỗi mất tiến độ.
 *
 * ⚠️ BẪY 3 — `navigator.onLine` NÓI DỐI.
 *    Nó chỉ cho biết máy có kết nối mạng, KHÔNG cho biết có ra được internet: trong quán cà
 *    phê có trang đăng nhập wifi, hoặc khi VPS đang khởi động lại, `onLine === true` mà mọi
 *    request đều thất bại. Vì vậy: dùng nó để TRÁNH gửi khi chắc chắn offline (tiết kiệm
 *    pin), nhưng LUÔN xử lý được thất bại bằng lui dần, không tin nó là sự thật.
 *
 * ⚠️ BẪY 4 — KHÔNG GỬI LẠI NGAY KHI THẤT BẠI.
 *    Thử lại liên tục khi server sập sẽ làm hàng nghìn request trong một phút, và trên điện
 *    thoại thì đó là pin. Lui dần theo cấp số nhân, có trần.
 *
 * ⚠️ BẪY 5 — ĐỒNG BỘ KHI QUAY LẠI TAB.
 *    Bé chơi trên iPad rồi bố mẹ chuyển sang app khác; Safari tạm dừng tab. Khi quay lại,
 *    hàng đợi có thể đã đầy mà không ai gửi. Lắng nghe `visibilitychange` để đồng bộ ngay
 *    khi tab hiện lại — đó cũng là lúc mạng thường đã sẵn sàng.
 */

import type { ProgressEvent, ProgressSnapshot } from '@shared/types/progress.js';
import type { ProgressSyncResponse } from '@shared/types/api.js';
import { progressApi } from '../api/endpoints.js';
import { useProgressStore } from '../store/progressStore.js';

/**
 * Trạng thái đồng bộ.
 *
 * ⭐ KHAI Ở ĐÂY, KHÔNG Ở COMPONENT: đây là dữ liệu của tầng dịch vụ. `SyncBadge` chỉ vẽ nó.
 *   Nếu kiểu sống trong file component thì tầng dịch vụ phải import ngược lên tầng giao diện
 *   — chiều phụ thuộc sai, và sớm muộn thành vòng import.
 */
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'pending' | 'failed';

/** Trần số sự kiện mỗi lô — PHẢI khớp `MAX_EVENTS_PER_SYNC` ở `shared/schemas/progress.ts`. */
export const SYNC_BATCH_SIZE = 200;

/** Chờ bao lâu sau thao tác cuối rồi mới gửi. Đủ lâu để gộp một lượt chơi, đủ ngắn để bé tắt app vẫn kịp. */
const DEBOUNCE_MS = 1_500;

/** Thời gian lui dần sau mỗi lần thất bại liên tiếp (ms). Phần tử cuối là trần. */
const BACKOFF_MS = [5_000, 15_000, 45_000, 120_000] as const;

/** Trạng thái đồng bộ hiển thị cho người dùng. */
export interface SyncState {
  status: SyncStatus;
  /** Số sự kiện còn chờ gửi. */
  pendingCount: number;
  lastSyncedAt: string | null;
  /** Câu mô tả lỗi gần nhất — CHỈ để ghi log, không hiển thị cho bé. */
  lastError: string | null;
}

/**
 * Phụ thuộc được TIÊM VÀO, không gọi trực tiếp.
 *
 * ⭐ VÌ SAO: nhờ vậy `SyncService` test được hoàn toàn mà không cần React, không cần mạng,
 *   không cần đồng hồ thật. Mọi cái bẫy ở trên đều trở thành một test chạy trong vài mili
 *   giây thay vì một buổi gỡ lỗi trên điện thoại thật.
 */
export interface SyncDeps {
  readState: () => {
    childId: string | null;
    hydrated: boolean;
    pendingEvents: ProgressEvent[];
    lastSyncedAt: string | null;
  };
  applyServerSnapshot: (snapshot: ProgressSnapshot) => void;
  dropPending: (clientEventIds: readonly string[]) => void;
  markSynced: (serverTime: string) => void;
  syncRequest: (childId: string, body: { events: ProgressEvent[]; since: string | null }) => Promise<ProgressSyncResponse>;
  isOnline: () => boolean;
  /** Lấy giờ hiện tại (ms). Tiêm vào để test điều khiển được thời gian. */
  now: () => number;
}

export class SyncService {
  private state: SyncState = {
    status: 'idle',
    pendingCount: 0,
    lastSyncedAt: null,
    lastError: null,
  };

  private readonly listeners = new Set<(state: SyncState) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Bẫy 2: chặn hai lượt đồng bộ chồng lên nhau. */
  private inFlight = false;
  /** Số lần thất bại liên tiếp — quyết định thời gian lui. */
  private failures = 0;
  private started = false;
  /** Huỷ đăng ký theo dõi `progressStore` — xem `attachStore`. */
  private detachStore: (() => void) | null = null;

  constructor(private readonly deps: SyncDeps) {}

  // --- Vòng đời ------------------------------------------------------------

  /** Bắt đầu lắng nghe mạng, tab, và thay đổi tiến độ. Gọi một lần cho cả ứng dụng. */
  start(): void {
    if (this.started) return;
    this.started = true;

    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOffline);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.attachStore();
  }

  /**
   * Theo dõi `progressStore`: mỗi khi hàng đợi có sự kiện mới thì hẹn đồng bộ.
   *
   * ⭐ VÌ SAO ĐĂNG KÝ TỪ ĐÂY, KHÔNG GỌI TỪ `progressStore.commit()`:
   *   `progressStore` không được biết tới `SyncService`. Nếu nó gọi ngược lên, ta có vòng
   *   import `SyncService → progressStore → SyncService` — chạy được trên máy nhưng rất dễ
   *   vỡ khi thứ tự nạp module thay đổi, và triệu chứng là `undefined is not a function` ở
   *   một chỗ hoàn toàn không liên quan. Đăng ký theo dõi giữ chiều phụ thuộc một hướng.
   *
   * ⚠️ CHỈ PHẢN ỨNG KHI `pendingEvents` ĐỔI DANH TÍNH. `commit()` cũng ghi cả ảnh chụp; nếu
   *    ta phản ứng với mọi thay đổi thì mỗi lần gộp ảnh chụp từ server lại tự kích hoạt một
   *    lượt đồng bộ mới — thành vòng lặp vô hạn.
   */
  private attachStore(): void {
    this.detachStore = useProgressStore.subscribe((state, prev) => {
      if (state.pendingEvents === prev.pendingEvents) return;
      if (state.pendingEvents.length > prev.pendingEvents.length) {
        this.requestSync('bé-vừa-trả-lời');
        return;
      }
      // Hàng đợi ngắn đi (vừa gửi xong, hoặc vừa nạp lại từ máy) — chỉ cập nhật con số.
      this.refreshPendingCount();
    });
  }

  /** Gỡ mọi lắng nghe và huỷ hẹn giờ. Dùng khi đăng xuất hoặc trong test. */
  stop(): void {
    if (!this.started) return;
    this.started = false;

    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('offline', this.onOffline);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.detachStore?.();
    this.detachStore = null;
    this.clearTimer();
  }

  // --- Trạng thái ----------------------------------------------------------

  getState(): Readonly<SyncState> {
    return this.state;
  }

  /** Đăng ký nhận thông báo khi trạng thái đổi. Trả về hàm huỷ đăng ký. */
  subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Cập nhật số sự kiện đang chờ — `progressStore` gọi mỗi khi hàng đợi đổi. */
  refreshPendingCount(): void {
    const { pendingEvents } = this.deps.readState();
    if (this.state.pendingCount === pendingEvents.length) return;
    this.patch({
      pendingCount: pendingEvents.length,
      // Không có gì chờ gửi và lần trước đã thành công ⇒ hiện "đã đồng bộ", không phải "đang chờ".
      status: pendingEvents.length === 0 && this.state.status === 'pending' ? 'idle' : this.state.status,
    });
  }

  // --- Đồng bộ -------------------------------------------------------------

  /**
   * Lên lịch đồng bộ sau một khoảng chờ (gộp nhiều thao tác liên tiếp).
   *
   * Gọi hàm này SAU MỖI thay đổi tiến độ. Nó rẻ: chỉ đặt lại một hẹn giờ.
   */
  requestSync(reason: string): void {
    this.refreshPendingCount();
    this.clearTimer();

    // Đang offline thì không hẹn giờ: hẹn rồi thất bại chỉ tốn pin và làm log ồn. Sự kiện
    // `online` sẽ tự kích hoạt đồng bộ khi mạng trở lại.
    if (!this.deps.isOnline()) {
      this.patch({ status: 'pending' });
      return;
    }

    // ⚠️ CHỈ hiện "đang chờ" khi THẬT SỰ có gì để gửi.
    //    Lượt đồng bộ đầu tiên khi mở app không có sự kiện nào (nó chỉ KÉO dữ liệu về). Nếu
    //    cứ đặt `status = 'pending'`, bé sẽ thấy "☁️ Đang chờ đồng bộ" mỗi lần mở app mà
    //    chẳng có gì đang chờ — một lời nói dối nhỏ nhưng lặp lại mỗi ngày.
    if (this.state.pendingCount > 0 && this.state.status !== 'syncing') {
      this.patch({ status: 'pending' });
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.syncNow(reason);
    }, DEBOUNCE_MS);
  }

  /**
   * Đồng bộ ngay, không chờ.
   *
   * An toàn khi gọi nhiều lần: lượt gọi thứ hai trong lúc lượt đầu đang chạy sẽ quay về ngay
   * (bẫy 2), và lượt đầu sẽ tự hẹn một lượt nữa nếu hàng đợi vẫn còn.
   */
  async syncNow(reason: string): Promise<void> {
    if (this.inFlight) return;

    const state = this.deps.readState();
    // Chưa nạp xong thì `pendingEvents` chưa phải sự thật — gửi lúc này là gửi thiếu.
    if (!state.hydrated || !state.childId) return;
    if (!this.deps.isOnline()) {
      this.patch({ status: 'pending' });
      return;
    }

    // Không có gì để gửi VÀ đã từng đồng bộ ⇒ không cần gọi mạng.
    if (state.pendingEvents.length === 0 && state.lastSyncedAt !== null) {
      this.patch({ status: 'idle' });
      return;
    }

    this.inFlight = true;
    this.patch({ status: 'syncing', pendingCount: state.pendingEvents.length });

    // BẪY 1: chụp lại ĐÚNG lô sắp gửi. Hàng đợi có thể thay đổi trong lúc request đang bay.
    const batch = state.pendingEvents.slice(0, SYNC_BATCH_SIZE);
    const sentIds = batch.map((e) => e.clientEventId);

    try {
      const response = await this.deps.syncRequest(state.childId, {
        events: batch,
        since: state.lastSyncedAt,
      });

      // ⚠️ THỨ TỰ QUAN TRỌNG: bỏ khỏi hàng đợi TRƯỚC, rồi mới gộp ảnh chụp.
      //    Nếu gộp trước, `applyServerSnapshot` có thể ghi xuống máy một trạng thái vẫn còn
      //    chứa các sự kiện đã gửi — và nếu app bị đóng ngay sau đó, lần mở tới sẽ gửi lại
      //    (server chống trùng được, nhưng đó là công vô ích và log ồn).
      this.deps.dropPending(sentIds);
      this.deps.applyServerSnapshot(response.snapshot);
      this.deps.markSynced(response.snapshot.serverTime);

      this.failures = 0;
      this.patch({
        status: 'synced',
        lastSyncedAt: response.snapshot.serverTime,
        lastError: null,
      });
      this.refreshPendingCount();

      // Còn nhiều hơn một lô (bé chơi offline rất lâu) ⇒ hẹn gửi tiếp ngay.
      // `requestSync` chỉ ĐẶT HẸN GIỜ chứ không gọi `syncNow` ngay, nên cờ `inFlight` (vẫn
      // đang bật trong `try` này) không chặn nó: tới lúc hẹn giờ chạy thì `finally` đã nhả cờ.
      if (this.deps.readState().pendingEvents.length > 0) {
        this.requestSync(`${reason}+còn-hàng-đợi`);
      }
    } catch (error) {
      this.failures += 1;
      const message = error instanceof Error ? error.message : String(error);
      this.patch({ status: 'failed', lastError: message });
      this.scheduleRetry(reason);
    } finally {
      this.inFlight = false;
    }
  }

  // --- Nội bộ --------------------------------------------------------------

  /** Bẫy 4: lui dần theo cấp số nhân, có trần. */
  private scheduleRetry(reason: string): void {
    this.clearTimer();
    const delay = BACKOFF_MS[Math.min(this.failures - 1, BACKOFF_MS.length - 1)]!;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.syncNow(`${reason}+thử-lại`);
    }, delay);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private patch(partial: Partial<SyncState>): void {
    const next = { ...this.state, ...partial };
    // So sánh từng trường trước khi thông báo: `refreshPendingCount` được gọi rất thường
    // xuyên, và một thông báo giả sẽ làm `SyncBadge` render lại vô ích.
    if (
      next.status === this.state.status &&
      next.pendingCount === this.state.pendingCount &&
      next.lastSyncedAt === this.state.lastSyncedAt &&
      next.lastError === this.state.lastError
    ) {
      return;
    }
    this.state = next;
    for (const listener of this.listeners) listener(next);
  }

  private readonly onOnline = (): void => {
    // Mạng trở lại ⇒ thử ngay, không chờ hết thời gian lui.
    this.failures = 0;
    this.requestSync('có-mạng-lại');
  };

  private readonly onOffline = (): void => {
    this.patch({ status: 'pending' });
  };

  /** Bẫy 5: quay lại tab thì đồng bộ. */
  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.failures = 0;
      this.requestSync('quay-lại-tab');
    }
  };
}

// =============================================================================
// Instance dùng chung
// =============================================================================

/**
 * Kết nối thật với `progressStore` và API.
 *
 * ⭐ VÌ SAO `readState` ĐỌC QUA `useProgressStore.getState()` CHỨ KHÔNG QUA HOOK:
 *   `SyncService` chạy ngoài React (trong `setTimeout`, trong trình xử lý sự kiện `window`).
 *   `getState()` là API chính thức của Zustand cho đúng tình huống này — nó đọc trạng thái
 *   hiện tại mà không cần một lượt render nào.
 */
export const syncService = new SyncService({
  readState: () => {
    const s = useProgressStore.getState();
    return {
      childId: s.childId,
      hydrated: s.hydrated,
      pendingEvents: s.pendingEvents,
      lastSyncedAt: s.lastSyncedAt,
    };
  },
  applyServerSnapshot: (snapshot) => useProgressStore.getState().applyServerSnapshot(snapshot),
  dropPending: (ids) => useProgressStore.getState().dropPending(ids),
  markSynced: (serverTime) => useProgressStore.getState().markSynced(serverTime),
  syncRequest: (childId, body) => progressApi.sync(childId, body),
  isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
  now: () => Date.now(),
});
