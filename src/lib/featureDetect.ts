/**
 * RubyLingo — Dò khả năng của trình duyệt (phần KHÔNG liên quan giọng nói).
 *
 * Phần dò giọng nói nằm ở `src/services/SpeechCapability.ts` vì nó gắn với nghiệp vụ
 * (ẩn game luyện nói khi thiếu `SpeechRecognition`). Ở đây chỉ là khả năng nền của
 * trình duyệt/thiết bị.
 *
 * ⚠️ VÌ SAO PHẢI DÒ THAY VÌ ĐOÁN:
 *   Thiết bị đích là laptop, iPhone, Android, iPad — tức là cả Safari/iOS (nơi nhiều API
 *   thiếu hoặc hành xử khác) lẫn Chrome/Android. Mọi thứ "chắc là có" đều phải kiểm.
 *
 * ⚠️ MỌI HÀM Ở ĐÂY PHẢI CHỊU ĐƯỢC MÔI TRƯỜNG TEST (jsdom):
 *   jsdom KHÔNG có `matchMedia`, `visualViewport`, `navigator.vibrate`... nên mọi truy cập
 *   đều phải qua kiểm tra tồn tại, không được để ném lỗi. Nếu không, một bài test import
 *   gián tiếp file này sẽ đổ ngay khi chạy.
 */

// =============================================================================
// Khả năng riêng lẻ
// =============================================================================

/**
 * Có Pointer Events không (nền tảng của mọi thao tác kéo/thả trong game).
 *
 * Hầu hết trình duyệt hiện đại đều có, kể cả Safari 13+. Vẫn phải dò vì nếu thiếu thì
 * phải quay về chuột/cảm ứng riêng, chứ không được để game im lặng không phản hồi.
 */
export function hasPointerEvents(): boolean {
  return typeof window !== 'undefined' && 'PointerEvent' in window;
}

/**
 * Thiết bị có màn hình cảm ứng không.
 *
 * ⭐ Dùng `maxTouchPoints`, KHÔNG dùng `'ontouchstart' in window`:
 *   `'ontouchstart' in window` trả `true` cả trên Chrome desktop khi bật chế độ mô phỏng
 *   thiết bị, và `false` trên một số máy hybrid. `maxTouchPoints > 0` phản ánh đúng phần
 *   cứng. Điều này quyết định có tắt hiệu ứng `:hover` hay không — đoán sai thì bé dùng
 *   iPad sẽ thấy nút "dính" trạng thái hover sau khi chạm.
 */
export function hasTouchInput(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (navigator.maxTouchPoints ?? 0) > 0;
}

/**
 * Người dùng có bật "giảm chuyển động" ở hệ điều hành không.
 *
 * Quan trọng với trẻ nhạy cảm với chuyển động (rối loạn tiền đình, tự kỷ...). Khi bật,
 * hiệu ứng phải giảm về gần như tức thời — KHÔNG được biến mất hoàn toàn, vì mất phản hồi
 * thị giác cũng làm bé khó hiểu chuyện gì vừa xảy ra.
 *
 * ⚠️ Giá trị này là ảnh chụp tại thời điểm gọi. Trong component React, dùng
 *    `useReducedMotion()` của framer-motion để có giá trị TỰ CẬP NHẬT khi người dùng đổi
 *    cài đặt giữa chừng.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** App đang chạy ở chế độ đã cài lên màn hình chính (PWA) hay trong tab trình duyệt. */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const mql = window.matchMedia?.('(display-mode: standalone)');
  if (mql?.matches) return true;
  // Safari/iOS không hỗ trợ `display-mode` đầy đủ — nó có cờ riêng này.
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

/**
 * Có `visualViewport` không.
 *
 * Cần cho việc tránh bàn phím ảo che mất ô nhập liệu trên điện thoại. Trên iOS, bàn phím
 * ảo KHÔNG làm `window.innerHeight` đổi, nên chỉ `visualViewport` mới biết được.
 */
export function hasVisualViewport(): boolean {
  return typeof window !== 'undefined' && 'visualViewport' in window;
}

/**
 * `localStorage` có dùng được thật không (không chỉ là "có tồn tại").
 *
 * ⭐ Phải GHI THỬ mới biết: ở chế độ riêng tư của Safari, `window.localStorage` vẫn tồn tại
 *   nhưng mọi lệnh ghi đều ném `QuotaExceededError`. Chỉ kiểm `'localStorage' in window`
 *   sẽ trả `true` sai.
 */
export function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const probe = '__rubylingo_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Dung lượng RAM ước lượng (GB), hoặc `null` nếu trình duyệt không cho biết.
 *
 * Dùng để quyết định có tải ảnh cảnh nét cao hay không — máy yếu thì tải bản nhẹ hơn
 * thay vì để bé ngồi chờ. Chrome/Edge có; Safari/Firefox thì không ⇒ luôn xử lý `null`.
 */
export function getDeviceMemoryGb(): number | null {
  if (typeof navigator === 'undefined') return null;
  const value = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof value === 'number' && value > 0 ? value : null;
}

/** Máy có đang ở chế độ tiết kiệm pin không (nếu trình duyệt cho biết). */
export function isBatterySaving(): boolean {
  if (typeof navigator === 'undefined') return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

// =============================================================================
// Ảnh chụp tổng hợp
// =============================================================================

export interface CapabilitySnapshot {
  pointerEvents: boolean;
  touch: boolean;
  reducedMotion: boolean;
  standalone: boolean;
  visualViewport: boolean;
  localStorage: boolean;
  deviceMemoryGb: number | null;
  saveData: boolean;
}

/**
 * Ảnh chụp toàn bộ khả năng, tính MỘT LẦN rồi ghi nhớ.
 *
 * ⭐ VÌ SAO GHI NHỚ (cache) THAY VÌ DÒ LẠI MỖI LẦN GỌI:
 *   `isLocalStorageAvailable()` có GHI vào localStorage để thử. Gọi nó trong thân
 *   component (mỗi lần render) nghĩa là mỗi lần render lại ghi/ xoá một khoá — vừa chậm,
 *   vừa gây nhiễu cho các công cụ theo dõi. Ảnh chụp cũng đúng về mặt ngữ nghĩa: phần cứng
 *   và trình duyệt không đổi giữa phiên.
 *
 * ⚠️ `reducedMotion` trong ảnh chụp là giá trị LÚC KHỞI ĐỘNG. Component cần tự cập nhật
 *    thì dùng `useReducedMotion()`, đừng đọc từ đây.
 */
let snapshot: CapabilitySnapshot | null = null;

export function getCapabilities(): CapabilitySnapshot {
  snapshot ??= {
    pointerEvents: hasPointerEvents(),
    touch: hasTouchInput(),
    reducedMotion: prefersReducedMotion(),
    standalone: isStandalonePwa(),
    visualViewport: hasVisualViewport(),
    localStorage: isLocalStorageAvailable(),
    deviceMemoryGb: getDeviceMemoryGb(),
    saveData: isBatterySaving(),
  };
  return snapshot;
}

/**
 * Xoá ảnh chụp đã ghi nhớ. CHỈ dùng trong test — không gọi trong mã sản phẩm.
 *
 * Có hàm này vì nếu không, bài test đầu tiên chạy sẽ "đóng băng" khả năng của jsdom cho
 * mọi bài test sau, khiến các bài test giả lập thiết bị yếu không kiểm được gì.
 */
export function __resetCapabilitiesForTests(): void {
  snapshot = null;
}
