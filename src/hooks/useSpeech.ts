/**
 * RubyLingo — Hook phát âm tiếng Anh.
 *
 * ⭐ NHIỆM VỤ DUY NHẤT: nối `settingsStore` (sở thích của bé/phụ huynh) với
 *    `SpeechService` (tài nguyên của thiết bị), và bảo đảm hai thứ đó KHÔNG BAO GIỜ lệch nhau.
 *
 * ⚠️ VÌ SAO PHẢI CÓ HOOK NÀY CHỨ KHÔNG GỌI THẲNG SERVICE:
 *    `SpeechService` là một instance dùng chung, không biết gì về React. Nếu mỗi component
 *    tự gọi `speechService.setSettings(...)`, thì hai component cùng tồn tại (VD: TopBar và
 *    FlashcardPage) sẽ ghi đè cài đặt của nhau theo thứ tự render — và triệu chứng là
 *    "tốc độ đọc lúc nhanh lúc chậm không rõ vì sao". Một chỗ đồng bộ thì chỉ có một sự thật.
 *
 * ⚠️ KHÔNG TỰ ĐỘNG PHÁT ÂM KHI VÀO MÀN HÌNH.
 *    iOS/Safari chỉ cho phát âm sau một thao tác thật của người dùng. Tự "hâm nóng" bằng
 *    cách đọc lúc tải trang sẽ khiến Safari chặn và IM LẶNG VĨNH VIỄN cho tới khi tải lại.
 *    Mọi lời gọi `speak()` phải xuất phát từ cú chạm của bé. Xem bẫy 4 ở `SpeechService.ts`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { speechService, type SpeakOptions } from '../services/SpeechService.js';
import { useSettingsStore } from '../store/settingsStore.js';

export interface UseSpeechOptions {
  /**
   * Dừng phát âm khi component bị gỡ.
   *
   * ⚠️ Mặc định `false` là CÓ CHỦ ĐÍCH: nếu mọi nơi dùng hook này đều dừng khi unmount,
   *    thì việc bé bấm loa ở thẻ từ vựng rồi màn hình cha (TopBar) render lại cũng đủ để
   *    cắt ngang tiếng đọc. Chỉ những MÀN HÌNH (nơi việc rời đi thật sự có nghĩa "con
   *    không nghe nữa") mới nên bật cờ này.
   */
  stopOnUnmount?: boolean;
}

export interface UseSpeechResult {
  /** Đọc một chuỗi TIẾNG ANH. Trả `false` nếu bị bỏ qua (tắt tiếng, sai ngôn ngữ...). */
  speak: (text: string, options?: SpeakOptions) => Promise<boolean>;
  /** Đọc lần lượt nhiều chuỗi tiếng Anh. */
  speakSequence: (texts: readonly string[]) => Promise<void>;
  stop: () => void;
  /** Trình duyệt có Web Speech API không. */
  isSupported: boolean;
  /**
   * Đã nạp xong danh sách giọng chưa.
   *
   * Dùng để nút loa không nhấp nháy trạng thái "đang đọc" sai trong ~1 giây đầu, và để
   * màn hình cài đặt không hiện danh sách giọng rỗng rồi đầy lên ngay sau đó.
   */
  voicesReady: boolean;
}

export function useSpeech(options: UseSpeechOptions = {}): UseSpeechResult {
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const speechRate = useSettingsStore((s) => s.speechRate);
  const voicePreference = useSettingsStore((s) => s.voicePreference);

  const [voicesReady, setVoicesReady] = useState(false);
  const { stopOnUnmount = false } = options;

  // --- Đồng bộ cài đặt: store → service -----------------------------------
  // Chạy ở `useEffect` (không phải trong thân render) vì đây là hiệu ứng phụ lên một đối
  // tượng nằm NGOÀI React. Ghi trong thân render sẽ khiến StrictMode chạy hai lần và làm
  // việc ghi phụ thuộc vào số lần render.
  useEffect(() => {
    speechService.setSettings({ enabled: soundEnabled, rate: speechRate, voicePreference });
  }, [soundEnabled, speechRate, voicePreference]);

  // --- Nạp danh sách giọng một lần cho cả phiên ---------------------------
  useEffect(() => {
    if (!speechService.isSupported()) {
      setVoicesReady(false);
      return;
    }
    let cancelled = false;
    void speechService.loadVoices().then(() => {
      // `cancelled` chặn setState sau khi component đã gỡ (React 18 không còn cảnh báo,
      // nhưng tránh được việc ghi state vô ích khi bé chuyển màn hình rất nhanh).
      if (!cancelled) setVoicesReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!stopOnUnmount) return;
    return () => {
      speechService.stop();
    };
  }, [stopOnUnmount]);

  // --- API ổn định tham chiếu --------------------------------------------
  // Bọc `useCallback` để `speak` không đổi tham chiếu mỗi lần render. Điều này quan trọng
  // với nút loa: nếu `speak` đổi mỗi render, mọi `useEffect([speak])` ở component con sẽ
  // chạy lại liên tục.
  const speak = useCallback(
    (text: string, speakOptions?: SpeakOptions) => speechService.speak(text, speakOptions),
    [],
  );

  const speakSequence = useCallback(
    (texts: readonly string[]) => speechService.speakSequence(texts),
    [],
  );

  const stop = useCallback(() => speechService.stop(), []);

  const isSupported = useMemo(() => speechService.isSupported(), []);

  return { speak, speakSequence, stop, isSupported, voicesReady };
}
