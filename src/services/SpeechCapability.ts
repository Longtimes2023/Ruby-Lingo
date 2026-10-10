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
 * HÌNH DẠNG TỐI THIỂU của Web Speech API phần NHẬN DIỆN mà RubyLingo dùng.
 *
 * ⚠️ VÌ SAO TỰ KHAI THAY VÌ DÙNG KIỂU CÓ SẴN CỦA DOM:
 *   `SpeechRecognition` là API KHÔNG CHUẨN HOÁ. Tuỳ phiên bản TypeScript/lib.dom, nó có thể có
 *   hoặc KHÔNG có trong lib — dùng kiểu của lib sẽ khiến build đỏ ở phiên bản này và xanh ở
 *   phiên bản khác. Ta chỉ cần một hợp đồng nhỏ, tự khai, đúng bằng phần mình gọi (giống cách
 *   `AudioSfxService` tự khai `AudioContextLike`).
 */
export interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
  readonly confidence?: number;
}

export interface SpeechRecognitionResultLike {
  readonly length: number;
  readonly isFinal?: boolean;
  item(index: number): SpeechRecognitionAlternativeLike;
  readonly [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionResultListLike {
  readonly length: number;
  item(index: number): SpeechRecognitionResultLike;
  readonly [index: number]: SpeechRecognitionResultLike;
}

export interface SpeechRecognitionEventLike {
  readonly results: SpeechRecognitionResultListLike;
}

export interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/**
 * Lấy HÀM TẠO `SpeechRecognition` của trình duyệt, hoặc `null` nếu không có.
 *
 * ⚠️ TRẢ HÀM TẠO, KHÔNG PHẢI MỘT INSTANCE DÙNG CHUNG: mỗi lần bé bấm "Máy nghe thử" cần một
 *   phiên nhận diện MỚI. Tạo sẵn một instance ở tầng module sẽ khoá vòng đời của nó vào vòng đời
 *   của trang — bấm lần thứ hai sẽ lỗi `InvalidStateError` mà không rõ vì sao.
 *
 * Hàm này là NGUỒN DUY NHẤT của `hasSpeechRecognition()` (bên dưới) — để "có hỗ trợ hay không"
 * và "lấy được hàm tạo hay không" không bao giờ lệch nhau.
 */
export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  const ctor = w['SpeechRecognition'] ?? w['webkitSpeechRecognition'];
  return typeof ctor === 'function' ? (ctor as SpeechRecognitionCtor) : null;
}

/**
 * Trình duyệt có NHẬN DIỆN giọng nói không.
 *
 * Chrome/Edge/Samsung Internet: có (tiền tố `webkit`). Safari/iOS: KHÔNG.
 * Firefox: KHÔNG.
 */
export function hasSpeechRecognition(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

/**
 * HÌNH DẠNG TỐI THIỂU của `MediaRecorder` — dùng cho "Nghe lại giọng con" (hoàn toàn cục bộ).
 * Tự khai cùng lý do như `SpeechRecognitionLike`: giữ hợp đồng nhỏ và ổn định qua các phiên bản lib.
 */
export interface MediaRecorderLike {
  readonly state: string;
  start(): void;
  stop(): void;
  ondataavailable: ((event: { readonly data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: (() => void) | null;
}

export type MediaRecorderCtor = new (stream: MediaStream) => MediaRecorderLike;

/** Lấy hàm tạo `MediaRecorder` của trình duyệt, hoặc `null` nếu không có. */
export function getMediaRecorderCtor(): MediaRecorderCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  const ctor = w['MediaRecorder'];
  return typeof ctor === 'function' ? (ctor as MediaRecorderCtor) : null;
}

/**
 * Trình duyệt có GHI ÂM cục bộ được không (có `MediaRecorder` và API micro).
 * ⚠️ "Có" KHÔNG có nghĩa là nên bật: tầng "Nghe lại giọng con" vẫn MẶC ĐỊNH TẮT.
 */
export function hasMediaRecorder(): boolean {
  if (typeof navigator === 'undefined') return false;
  const mediaDevices = (navigator as Navigator & { mediaDevices?: unknown }).mediaDevices;
  return getMediaRecorderCtor() !== null && mediaDevices !== undefined;
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
