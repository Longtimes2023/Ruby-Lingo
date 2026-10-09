/**
 * RubyLingo — Hook đồng bộ tiến độ.
 *
 * ⭐ HAI HOOK, HAI NHIỆM VỤ KHÁC NHAU — ĐỪNG GỘP:
 *   • `useSyncLifecycle()` — chỉ gọi MỘT LẦN cho cả ứng dụng (`App`). Bật/tắt `SyncService`.
 *   • `useSync()`           — gọi ở bất kỳ component nào cần ĐỌC trạng thái (badge, cài đặt).
 *   Gộp lại thì mỗi component hiển thị badge sẽ bật/tắt dịch vụ dùng chung, và component nào
 *   unmount trước sẽ tắt đồng bộ cho toàn bộ ứng dụng.
 */

import { useCallback, useEffect, useState } from 'react';

import { syncService, type SyncState } from '../services/SyncService.js';
import { gameResultQueue } from '../services/GameResultService.js';
import { useProgressStore } from '../store/progressStore.js';
import { useIsAuthenticated } from '../store/sessionStore.js';

export interface UseSyncResult extends SyncState {
  /** Đồng bộ ngay, không chờ hết thời gian gộp. Dùng cho nút "thử lại". */
  syncNow: () => void;
}

/** Đọc trạng thái đồng bộ và theo dõi thay đổi. */
export function useSync(): UseSyncResult {
  // `getState()` trong hàm khởi tạo để lượt render ĐẦU TIÊN đã có dữ liệu thật — nếu để
  // trạng thái rỗng rồi cập nhật trong `useEffect`, badge sẽ nháy một lần vô ích.
  const [state, setState] = useState<SyncState>(() => ({ ...syncService.getState() }));

  useEffect(() => {
    // `subscribe` trả về hàm huỷ đăng ký — chính là thứ `useEffect` cần trả về.
    return syncService.subscribe((next) => setState({ ...next }));
  }, []);

  const syncNow = useCallback(() => {
    void syncService.syncNow('thủ-công');
  }, []);

  return { ...state, syncNow };
}

/**
 * Bật `SyncService` khi bé đã sẵn sàng, tắt khi đăng xuất.
 *
 * ⚠️ ĐIỀU KIỆN `isHydrated` LÀ BẮT BUỘC, KHÔNG PHẢI CHO CHẮC:
 *   Trước khi `progressStore` nạp xong, `pendingEvents` là mảng RỖNG — nhưng đó là "chưa
 *   biết", không phải "không có gì". Đồng bộ lúc này sẽ gửi một lô rỗng kèm `since = null`,
 *   tức là nói với server "tôi chưa từng đồng bộ và không có gì mới". Server trả về ảnh chụp
 *   đầy đủ, và `applyServerSnapshot` sẽ bị chặn vì `hydrated` còn false — nên dữ liệu không
 *   hỏng, nhưng ta vừa gọi mạng vô ích và làm chậm đúng lượt tải quan trọng nhất.
 *
 * ⭐ HOOK NÀY CŨNG ĐẨY HÀNG ĐỢI KẾT QUẢ GAME (`gameResultQueue`).
 *   Hai hàng đợi, hai endpoint, nhưng CÙNG một vòng đời: chỉ chạy khi đã đăng nhập và tiến
 *   độ trong máy đã nạp xong. Tách ra thành hai hook riêng thì phải nhân đôi đúng hai điều
 *   kiện đó ở hai nơi — và một nơi quên là một hàng đợi nằm im vĩnh viễn.
 */
export function useSyncLifecycle(): void {
  const isAuthenticated = useIsAuthenticated();
  const isHydrated = useProgressStore((s) => s.hydrated);

  useEffect(() => {
    if (!isAuthenticated || !isHydrated) return;

    syncService.start();
    // Kéo dữ liệu từ server ngay khi mở app: máy mới, hoặc thiết bị khác đã chơi.
    syncService.requestSync('mở-app');

    /**
     * Đẩy những lượt chơi chưa gửi được (bé chơi lúc mất mạng, hoặc đóng app ngay sau khi
     * chơi xong). Gọi lúc mở app là chỗ DUY NHẤT chắc chắn chạy được trên mọi thiết bị —
     * sự kiện `online` không bắn nếu mạng chưa từng mất.
     */
    void gameResultQueue.flush();

    /**
     * ⚠️ `navigator.onLine` chỉ nói máy có kết nối mạng, KHÔNG nói ra được internet (bẫy 3 ở
     *    `SyncService.ts`). Nên đây chỉ là một GỢI Ý để thử sớm; thất bại vẫn phải chịu được.
     */
    const onOnline = (): void => {
      void gameResultQueue.flush();
    };
    window.addEventListener('online', onOnline);

    return () => {
      window.removeEventListener('online', onOnline);
      syncService.stop();
    };
  }, [isAuthenticated, isHydrated]);
}
