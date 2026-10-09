/**
 * RubyLingo — Hook hiệu ứng âm thanh.
 *
 * Nối `settingsStore` với `AudioSfxService`, và quan trọng hơn: lo việc **ĐÁNH THỨC ÂM THANH
 * Ở CÚ CHẠM ĐẦU TIÊN** — thứ mà nếu quên thì mọi tiếng động đều im lặng vĩnh viễn mà không
 * có lỗi nào (xem bẫy 1 và 2 ở `AudioSfxService.ts`).
 */

import { useCallback, useEffect, useMemo } from 'react';

import { audioSfxService, type SfxName } from '../services/AudioSfxService.js';
import { useSettingsStore } from '../store/settingsStore.js';

export interface UseSfxResult {
  /**
   * Phát hiệu ứng.
   *
   * ⭐ Tự gọi `unlock()` trước khi phát. Đây là chỗ ĐÚNG để đánh thức âm thanh: `play()`
   *    luôn được gọi từ trong một trình xử lý cú chạm, mà iOS yêu cầu `resume()` phải nằm
   *    đồng bộ trong chính lượt xử lý đó (bẫy 2).
   */
  play: (name: SfxName) => boolean;
  /** Đánh thức âm thanh mà không phát gì — dùng cho nút "Nghe thử" trong cài đặt. */
  unlock: () => void;
  isSupported: boolean;
}

export function useSfx(): UseSfxResult {
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);

  useEffect(() => {
    audioSfxService.setSettings({ enabled: soundEnabled, hapticsEnabled });
  }, [soundEnabled, hapticsEnabled]);

  const unlock = useCallback(() => audioSfxService.unlock(), []);

  const play = useCallback((name: SfxName) => {
    // Thứ tự có ràng buộc: đánh thức TRƯỚC, phát SAU. Nếu đảo lại, cú chạm đầu tiên trong
    // phiên sẽ không ra tiếng vì context còn `suspended`.
    audioSfxService.unlock();
    return audioSfxService.play(name);
  }, []);

  const isSupported = useMemo(() => audioSfxService.isSupported(), []);

  return { play, unlock, isSupported };
}

/**
 * Đánh thức âm thanh ở thao tác đầu tiên của người dùng trong CẢ ứng dụng.
 *
 * ⭐ VÌ SAO CẦN, KHI `useSfx().play()` ĐÃ TỰ ĐÁNH THỨC:
 *   Để tiếng động ĐẦU TIÊN không bị mất. Nếu bé chạm một ô và ta vừa `resume()` vừa phát
 *   trong cùng một lượt, một số trình duyệt vẫn nuốt nốt đầu tiên (context chưa kịp chuyển
 *   sang `running`). Nghe một tiếng "tách" rồi mới có tiếng động là trải nghiệm lỗi.
 *   Gắn một lắng nghe ở cấp ứng dụng giải quyết việc này sớm hơn: ngay khi bé chạm vào BẤT
 *   KỲ đâu (kể cả chạm để cuộn trang), âm thanh đã sẵn sàng trước khi bé chạm vào ô trả lời.
 *
 * ⚠️ GỠ LẮNG NGHE NGAY SAU LẦN CHẠM ĐẦU. Để lại thì mỗi cú chạm trong suốt phiên đều chạy
 *    thêm hai lệnh vô ích, và trên điện thoại yếu thì điều đó thấy được.
 */
export function useAudioUnlock(): void {
  useEffect(() => {
    if (!audioSfxService.isSupported()) return;

    let done = false;
    const unlockOnce = () => {
      if (done) return;
      done = true;
      audioSfxService.unlock();
      remove();
    };

    const remove = () => {
      window.removeEventListener('pointerdown', unlockOnce);
      window.removeEventListener('keydown', unlockOnce);
      window.removeEventListener('touchstart', unlockOnce);
    };

    // `passive: true` — ta không gọi `preventDefault()`, và khai báo này giúp trình duyệt
    // không phải chờ JS trước khi bắt đầu cuộn.
    window.addEventListener('pointerdown', unlockOnce, { passive: true });
    window.addEventListener('keydown', unlockOnce);
    // `touchstart` cho các trình duyệt cũ không bắn `pointerdown`.
    window.addEventListener('touchstart', unlockOnce, { passive: true });

    return remove;
  }, []);
}
