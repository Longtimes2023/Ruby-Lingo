/**
 * RubyLingo — Dò khả năng của trình duyệt.
 *
 * ⚠️ VÌ SAO PHẢI DÒ THAY VÌ CỨ HIỂN THỊ HẾT:
 *    `SpeechRecognition` (nhận diện giọng nói) **KHÔNG có trên Safari/iOS**. Nếu cứ hiện
 *    game "Bé nói theo" thì với bé dùng iPad, nút đó bấm vào là hỏng — mà theo triết lý
 *    của app thì KHÔNG được để bé gặp màn hình lỗi. Nên game đó phải được ẨN ĐI trước khi
 *    bé kịp thấy, không phải báo lỗi sau khi bấm.
 *
 * Phần còn lại của service này (chọn giọng đọc, hàng đợi phát âm) thuộc nhóm task Speech.
 */

import type { GameRuntime } from './ContentRepository.js';

// =============================================================================
// ⭐⭐ QUY TẮC SỐ MỘT CỦA ÂM THANH: CHỈ ĐỌC TIẾNG ANH — KHÔNG BAO GIỜ ĐỌC TIẾNG VIỆT
// =============================================================================
//
// Yêu cầu của chủ dự án (2026-10-06): *"âm thanh thì chỉ đọc từ tiếng Anh thôi, đọc tiếng
// Việt chi?"* — và đây là quy tắc ĐÚNG, vì ba lý do độc lập:
//
//   1. **Sai về ngữ âm.** Web Speech API chọn giọng theo `utterance.lang`. Ta LUÔN đặt
//      `en-GB`/`en-US` để bé nghe đúng phát âm chuẩn Anh. Nếu đưa một chuỗi tiếng Việt vào
//      giọng đó, máy sẽ đọc "Bé thử lại nhé!" theo quy tắc chính tả tiếng Anh — nghe như một
//      tràng âm vô nghĩa. Tệ hơn cả việc không đọc gì.
//
//   2. **Sai về sư phạm.** Bé đang học TIẾNG ANH. Mỗi lần phát âm thanh phải là một mẫu tiếng
//      Anh để bé bắt chước. Tiếng Việt trong app là *hướng dẫn*, không phải *bài học* — đọc
//      lên chỉ làm loãng tín hiệu.
//
//   3. **Đã có sẵn kênh đúng cho tiếng Việt.** Trình đọc màn hình của hệ điều hành
//      (VoiceOver trên iOS, TalkBack trên Android) đọc tiếng Việt bằng giọng Việt chuẩn, và
//      phụ huynh/bé khiếm thị đã quen dùng nó. Ta không cần — và không nên — chen vào.
//
// ⚠️ HỆ QUẢ CẦN NHỚ:
//   • `SpeechService.speak()` (T035) chỉ được nhận CHUỖI TIẾNG ANH.
//   • Nút bật/tắt tiếng CHỈ tắt âm thanh của RubyLingo (giọng đọc tiếng Anh, hiệu ứng, nhạc
//     nền). Nó KHÔNG tắt trình đọc màn hình — đó là cài đặt của hệ điều hành, và bé khiếm
//     thị phải luôn giữ được nó.
//   • Thông báo phần thưởng, câu khen, câu động viên (đều là tiếng Việt) KHÔNG bao giờ được
//     đưa vào hàng đợi phát âm. Chúng chỉ hiện trên màn hình.

/**
 * Kiểm một chuỗi có phải là TIẾNG ANH để phát âm hay không.
 *
 * ⭐ VÌ SAO CẦN HÀM NÀY CHỨ KHÔNG CHỈ DẶN NHAU TRONG TÀI LIỆU:
 *   Lỗi "đọc nhầm tiếng Việt" không gây crash, không gây màn hình trắng, và trong môi trường
 *   phát triển (nơi giọng đọc thường không có sẵn) nó còn KHÔNG PHÁT RA TIẾNG NÀO. Nghĩa là
 *   nó lọt qua mọi cổng kiểm tra tự động và chỉ lộ ra khi bé đã ngồi trước máy. Một phép kiểm
 *   chạy được thì mới bắt được nó.
 *
 * Cách kiểm: chữ tiếng Việt có DẤU (ế, ộ, ữ, đ...). Chữ tiếng Anh thì không.
 *   `đ` bị tính là ký tự ngoài ASCII (U+0111) nên bắt được cả từ không dấu như "đọc".
 *
 * ⚠️ Đây là phép kiểm THÔ theo thiết kế. Nó không phân biệt được "hello" với "xin chao" (đều
 *    là ASCII). Nó tồn tại để bắt lỗi LẬP TRÌNH hay gặp nhất — vô tình truyền một chuỗi giao
 *    diện tiếng Việt vào — chứ không phải để nhận diện ngôn ngữ.
 */
export function isEnglishPronounceable(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed === '') return false;
  // Cho phép chữ cái Latin không dấu, số, khoảng trắng và dấu câu cơ bản của tiếng Anh
  // (' - . , ! ? : ; ( ) ").
  return /^[A-Za-z0-9\s'\-.,!?:;()"/]+$/.test(trimmed);
}

/**
 * Cảnh báo khi có ai đó truyền chuỗi KHÔNG PHẢI tiếng Anh vào hàng đợi phát âm.
 *
 * Chỉ ồn ào ở môi trường phát triển: ở production, một `console.warn` trên máy của bé không
 * giúp ai, còn việc bỏ qua âm thanh sai thì vẫn phải làm. Xem `SpeechService` (T035).
 */
export function warnIfNotEnglish(text: string, where: string): boolean {
  const ok = isEnglishPronounceable(text);
  if (!ok && import.meta.env.DEV) {
    console.warn(
      `[RubyLingo] ${where}: chuỗi "${text}" không phải tiếng Anh nên sẽ KHÔNG được đọc.\n` +
        'Quy tắc: âm thanh chỉ đọc từ tiếng Anh. Tiếng Việt hiển thị trên màn hình — trình đọc ' +
        'màn hình của hệ điều hành lo phần đó.',
    );
  }
  return ok;
}


/** Trình duyệt có Web Speech API để ĐỌC không. Hầu hết trình duyệt hiện đại đều có. */
export function hasSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Trình duyệt có NHẬN DIỆN giọng nói không.
 *
 * Chrome/Edge/Samsung Internet: có (tiền tố `webkit`). Safari/iOS: KHÔNG.
 * Firefox: KHÔNG.
 */
export function hasSpeechRecognition(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w['SpeechRecognition'] ?? w['webkitSpeechRecognition']);
}

/** Trình duyệt có rung được không (phản hồi khi bé chạm đúng). */
export function hasVibration(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Gói khả năng để truyền vào `ContentRepository.getExercisesForLesson`.
 * Gọi MỘT LẦN khi app khởi động rồi truyền xuống — không dò lại mỗi lần render.
 */
export function detectGameRuntime(): GameRuntime {
  return { hasSpeechRecognition: hasSpeechRecognition() };
}
