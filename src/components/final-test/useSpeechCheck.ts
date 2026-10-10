/**
 * RubyLingo — `useSpeechCheck`: "MÁY NGHE THỬ" cho phần Nói (TẦNG 2, TUỲ CHỌN).
 *
 * ⭐ NHIỆM VỤ: cho bé bấm nghe thử một lần — Web Speech API (`en-GB`) nghe bé nói MỤC TIÊU của
 *   câu, rồi báo ĐÚNG HAI trạng thái hướng trẻ (không bao giờ "sai"):
 *      • nghe ra      ⇒ "Máy nghe thấy rồi! 🎉"
 *      • chưa nghe ra ⇒ "Máy chưa nghe rõ — bé thử nói to hơn một chút nhé!"
 *
 * ⚠️⚠️ QUYỀN RIÊNG TƯ — ĐỌC KỸ TRƯỚC KHI SỬA:
 *   Ở Chrome/Edge, Web Speech API **gửi âm thanh lên máy chủ của nhà cung cấp trình duyệt** để
 *   nhận dạng. Vì vậy tầng này là **OPT-IN**: KHÔNG tự bật, chỉ chạy khi bé/phụ huynh bấm nút.
 *   Nút chỉ HIỆN khi `hasSpeechRecognition()` trả `true` (Chrome/Edge/Samsung Internet). Trên
 *   Safari/iOS và Firefox, nút bị ẨN HẲN — không hiện rồi báo lỗi.
 *
 * ⚠️⚠️ TẦNG NÀY KHÔNG LƯU, KHÔNG GỬI, KHÔNG CHẤM:
 *   • Không gọi API nào của RubyLingo (không `fetch`, không server);
 *   • Không ảnh hưởng số khiên, không tạo `firstTry`/`wrongAttempts`, không đụng `onAnswered`;
 *   • Kết quả ("nghe ra"/"chưa nghe rõ") chỉ nằm trong state của component, mất khi rời câu.
 *   Đây là "máy nghe giúp vui", KHÔNG phải điểm phát âm — UI phải nói rõ điều đó.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { isSpeechMatch } from '../../lib/speechMatch.js';
import {
  getSpeechRecognitionCtor,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionLike,
} from '../../services/SpeechCapability.js';

/** Hai kết quả HƯỚNG TRẺ. Không có giá trị nào mang nghĩa "sai". */
export type SpeechCheckOutcome = 'heard' | 'unclear';

export interface UseSpeechCheckResult {
  /** Trình duyệt có Web Speech API không. `false` ⇒ component ẩn HẲN nút "Máy nghe thử". */
  supported: boolean;
  /** Đang trong một phiên nghe. */
  listening: boolean;
  /** Kết quả lần nghe gần nhất, hoặc `null` nếu chưa nghe lần nào. */
  outcome: SpeechCheckOutcome | null;
  /** Bắt đầu nghe cho một câu mục tiêu (tiếng Anh). Bỏ qua nếu trình duyệt không hỗ trợ. */
  start: (target: string) => void;
  /** Xoá kết quả cũ (ví dụ khi đổi câu). */
  reset: () => void;
}

/** Gom transcript của MỌI kết quả trong sự kiện (Web Speech có thể trả nhiều mảnh). */
function collectTranscript(event: SpeechRecognitionEventLike): string {
  const parts: string[] = [];
  const results = event.results;
  for (let i = 0; i < results.length; i += 1) {
    const result = results[i];
    if (result === undefined) continue;
    const alternative = result[0] ?? result.item(0);
    if (alternative?.transcript) parts.push(alternative.transcript);
  }
  return parts.join(' ');
}

export function useSpeechCheck(): UseSpeechCheckResult {
  // Dò MỘT LẦN cho cả phiên: trình duyệt không đổi giữa chừng, nên không cần dò lại mỗi render.
  const [supported] = useState<boolean>(() => getSpeechRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const [outcome, setOutcome] = useState<SpeechCheckOutcome | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  /** Dừng và bỏ phiên nghe đang chạy (nếu có) — an toàn khi gọi lúc không có gì. */
  const abortCurrent = useCallback(() => {
    const current = recognitionRef.current;
    recognitionRef.current = null;
    if (current === null) return;
    // `abort()` có thể ném nếu phiên đã kết thúc — không để lọt ra ngoài.
    try {
      current.abort();
    } catch {
      /* Phiên đã dừng — không có gì để làm. */
    }
  }, []);

  // Rời màn hình khi micro còn mở ⇒ tắt ngay, không để micro treo chạy nền.
  useEffect(() => abortCurrent, [abortCurrent]);

  const reset = useCallback(() => {
    setOutcome(null);
    setListening(false);
  }, []);

  const start = useCallback(
    (target: string) => {
      const Ctor = getSpeechRecognitionCtor();
      if (Ctor === null) return;

      // Một phiên tại một lần: bấm lại khi đang nghe ⇒ huỷ phiên cũ, mở phiên mới.
      abortCurrent();
      setOutcome(null);

      const recognition = new Ctor();
      recognitionRef.current = recognition;
      recognition.lang = 'en-GB'; // Cùng chuẩn Anh-Anh như phần phát âm mẫu — xem SpeechService.
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 3; // Lấy tối đa 3 khả năng, càng dễ "nghe ra" cho bé.

      recognition.onstart = () => setListening(true);
      recognition.onresult = (event) => {
        const heard = collectTranscript(event);
        setOutcome(isSpeechMatch(heard, target) ? 'heard' : 'unclear');
      };
      /*
        ⚠️ MỌI lỗi (bị từ chối quyền micro, mất mạng, không nhận được tiếng) đều quy về CÙNG một
        câu hướng trẻ "Máy chưa nghe rõ…". Không lộ mã lỗi kỹ thuật cho bé — đó là việc của người
        lớn đọc log, còn bé chỉ cần một lời mời thử lại nhẹ nhàng.
      */
      recognition.onerror = () => {
        setOutcome('unclear');
        setListening(false);
      };
      recognition.onend = () => setListening(false);

      try {
        recognition.start();
        setListening(true);
      } catch {
        // `start()` ném khi phiên trước chưa đóng. Không làm bé thấy lỗi — coi như chưa nghe rõ.
        setListening(false);
        setOutcome('unclear');
        recognitionRef.current = null;
      }
    },
    [abortCurrent],
  );

  return { supported, listening, outcome, start, reset };
}
