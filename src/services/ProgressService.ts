/**
 * RubyLingo — ProgressService: giữ tiến độ học TRONG MÁY và hàng đợi chờ đồng bộ.
 *
 * ⭐ VÌ SAO TIẾN ĐỘ PHẢI NẰM TRONG MÁY TRƯỚC, KHÔNG CHỜ SERVER:
 *   Bé chơi trên iPad ở nhà, wifi chập chờn, hoặc bố mẹ chưa mở mạng. Nếu mỗi câu trả lời
 *   phải đợi server xác nhận thì app đứng im — với một đứa trẻ 7 tuổi, "đứng im" nghĩa là
 *   "app hỏng" và bé bỏ luôn. Vì vậy: ghi xuống máy NGAY, gửi lên server SAU.
 *
 *   Server vẫn là bên CHẤM ĐIỂM cuối cùng (sao, XP, phần thưởng — T049). Những gì ở đây chỉ
 *   là bản xem trước để bé thấy tiến độ tức thì.
 *
 * ⭐ VÌ SAO KHÔNG DÙNG `zustand/persist` (lần thứ ba trong dự án này):
 *   Middleware đó đọc `localStorage` ngay lúc nạp module. Trong chế độ riêng tư của Safari,
 *   lệnh đọc đó NÉM lỗi ⇒ trắng màn hình trước khi React kịp chạy. Tự viết với `try/catch`
 *   giữ quyền kiểm soát. Xem `settingsStore.ts` và `sessionStore.ts` — cùng một lý do.
 *
 * ⚙️ THUẦN TYPESCRIPT + `localStorage` — KHÔNG import React.
 *
 * -----------------------------------------------------------------------------
 * HAI CÁI BẪY
 * -----------------------------------------------------------------------------
 *
 * ⚠️ BẪY 1 — `localStorage` CHỈ CÓ ~5 MB CHO MỖI TÊN MIỀN, VÀ NÓ NÉM LỖI KHI ĐẦY.
 *    Hàng đợi sự kiện chỉ được xả khi đồng bộ thành công. Nếu bé chơi offline suốt một tháng
 *    (hoặc mạng hỏng âm thầm), hàng đợi phình ra cho tới khi `setItem` ném `QuotaExceededError`
 *    — và lúc đó TOÀN BỘ tiến độ không ghi được nữa, kể cả những thứ mới. Cách chữa: cắt bớt
 *    hàng đợi khi vượt trần, BỎ SỰ KIỆN CŨ NHẤT. Mất một sự kiện cũ là mất vài điểm số; mất
 *    khả năng ghi là mất tất cả.
 *
 * ⚠️ BẪY 2 — DỮ LIỆU TRONG MÁY DO BẢN CŨ CỦA APP GHI RA.
 *    Sau khi cập nhật app, hình dạng dữ liệu có thể đã đổi. Đọc ẩu một object cũ rồi dùng
 *    thẳng sẽ làm app crash ở một màn hình hoàn toàn khác. Cách chữa: mọi bản ghi đều mang
 *    `v` (phiên bản). Gặp phiên bản lạ ⇒ BỎ, coi như bé chưa học gì trong máy này. Dữ liệu
 *    thật vẫn còn trên server, nên mất bản trong máy không phải thảm hoạ.
 */

import type { ProgressEvent, ProgressSnapshot } from '@shared/types/progress.js';
import { emptySnapshot } from '@shared/progress-merge.js';

/**
 * Phiên bản định dạng lưu trong máy.
 *
 * Tăng số này khi hình dạng dữ liệu đổi theo cách KHÔNG tương thích ngược. Bản cũ trong máy
 * sẽ bị bỏ qua và bé tải lại từ server.
 */
export const PROGRESS_STORAGE_VERSION = 1;

const STORAGE_PREFIX = 'rubylingo.progress.';

/**
 * Trần số sự kiện giữ trong hàng đợi. Xem bẫy 1.
 *
 * 500 sự kiện ≈ một tháng chơi offline của một bé. Vượt qua đó thì việc đồng bộ đã hỏng từ
 * lâu rồi, và giữ thêm chỉ làm hỏng khả năng ghi.
 */
export const MAX_PENDING_EVENTS = 500;

/** Dữ liệu lưu trong máy cho một bé. */
export interface StoredProgress {
  version: number;
  snapshot: ProgressSnapshot;
  pendingEvents: ProgressEvent[];
  /** Lần đồng bộ thành công gần nhất (ISO UTC), hoặc `null`. */
  lastSyncedAt: string | null;
}

/** Khoá lưu trữ của một bé. */
function storageKey(childId: string): string {
  return `${STORAGE_PREFIX}${childId}`;
}

/**
 * Sinh mã sự kiện phía client.
 *
 * ⚠️ PHẢI khớp `clientEventIdSchema` trong `shared/schemas/progress.ts`: chỉ chữ, số, `_`, `-`.
 *    Dùng `crypto.randomUUID()` cho phần ngẫu nhiên khi có (mọi trình duyệt hiện đại), và
 *    `getRandomValues` khi không — `randomUUID` yêu cầu ngữ cảnh bảo mật (HTTPS hoặc
 *    `localhost`), mà lúc thử nghiệm trên mạng LAN bằng `http://192.168.x.x` thì nó KHÔNG có.
 */
export function createClientEventId(now: number = Date.now()): string {
  const random = randomToken(8);
  return `evt_${now.toString(36)}_${random}`;
}

function randomToken(length: number): string {
  const bytes = new Uint8Array(length);
  const cryptoObj = globalThis.crypto;

  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes);
  } else {
    // Dự phòng cuối cùng. KHÔNG dùng cho bảo mật — mã sự kiện chỉ cần không trùng nhau
    // trong hàng đợi của một bé, nên `Math.random` là đủ ở đây.
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }

  let out = '';
  for (const byte of bytes) out += (byte % 36).toString(36);
  return out;
}

/**
 * Đọc tiến độ đã lưu của một bé.
 *
 * Trả về trạng thái rỗng (KHÔNG ném lỗi) khi: chưa từng lưu, JSON hỏng, phiên bản lạ, hoặc
 * `localStorage` bị chặn. Cả bốn trường hợp đều dẫn tới cùng một hành vi đúng: "coi như bé
 * chưa học gì trong máy này" rồi tải lại từ server.
 */
export function loadProgress(childId: string, now: string): StoredProgress {
  const fallback: StoredProgress = {
    version: PROGRESS_STORAGE_VERSION,
    snapshot: emptySnapshot(childId, now),
    pendingEvents: [],
    lastSyncedAt: null,
  };

  try {
    const raw = localStorage.getItem(storageKey(childId));
    if (!raw) return fallback;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return fallback;
    const record = parsed as Partial<StoredProgress>;

    // Bẫy 2: phiên bản lạ ⇒ bỏ toàn bộ. Không cố "đọc được bao nhiêu thì đọc".
    if (record.version !== PROGRESS_STORAGE_VERSION) return fallback;

    const snapshot = isSnapshotShaped(record.snapshot) ? record.snapshot : fallback.snapshot;
    const pendingEvents = Array.isArray(record.pendingEvents)
      ? record.pendingEvents.filter(isEventShaped)
      : [];

    return {
      version: PROGRESS_STORAGE_VERSION,
      // Ghi đè `childId` bằng giá trị THẬT truyền vào, không tin dữ liệu trong máy: khoá lưu
      // trữ đã là id rồi, và một bản ghi lẫn id của bé khác sẽ làm tiến độ chảy sang hồ sơ sai.
      snapshot: { ...snapshot, childId },
      pendingEvents,
      lastSyncedAt: typeof record.lastSyncedAt === 'string' ? record.lastSyncedAt : null,
    };
  } catch {
    return fallback;
  }
}

/** Ghi tiến độ xuống máy. Trả `false` nếu không ghi được (hết dung lượng, chế độ riêng tư). */
export function saveProgress(childId: string, state: StoredProgress): boolean {
  try {
    localStorage.setItem(storageKey(childId), JSON.stringify(state));
    return true;
  } catch {
    // Bẫy 1: hết dung lượng. Thử lại một lần với hàng đợi đã cắt ngắn — giữ được tiến độ
    // quan trọng hơn giữ được sự kiện cũ.
    try {
      const trimmed: StoredProgress = {
        ...state,
        pendingEvents: state.pendingEvents.slice(-Math.floor(MAX_PENDING_EVENTS / 4)),
      };
      localStorage.setItem(storageKey(childId), JSON.stringify(trimmed));
      return true;
    } catch {
      return false;
    }
  }
}

/** Xoá tiến độ trong máy của một bé (bố mẹ xoá hồ sơ, hoặc đăng xuất). */
export function clearProgress(childId: string): void {
  try {
    localStorage.removeItem(storageKey(childId));
  } catch {
    /* Không xoá được thì thôi. */
  }
}

/**
 * Thêm sự kiện vào hàng đợi, có cắt trần (bẫy 1).
 *
 * ⚠️ KHÔNG chống trùng ở đây. Trùng `clientEventId` là chuyện của SERVER (chỉ mục UNIQUE
 *    trên `game_result.client_event_id`): client có thể gửi lại một sự kiện sau khi request
 *    thành công nhưng phản hồi bị mất, và lúc đó nó KHÔNG biết là đã gửi. Cố chống trùng ở
 *    client sẽ tạo cảm giác an toàn giả — vì client không thể biết server đã nhận hay chưa.
 */
export function enqueueEvent(
  pending: readonly ProgressEvent[],
  event: ProgressEvent,
): ProgressEvent[] {
  const next = [...pending, event];
  if (next.length <= MAX_PENDING_EVENTS) return next;
  // Bỏ sự kiện CŨ NHẤT: sự kiện mới phản ánh việc bé vừa làm, và đó là thứ bé sẽ nhớ.
  return next.slice(next.length - MAX_PENDING_EVENTS);
}

// =============================================================================
// Kiểm hình dạng — chỉ đủ để không crash, KHÔNG phải kiểm đầy đủ
// =============================================================================
//
// ⚠️ VÌ SAO KHÔNG DÙNG ZOD Ở ĐÂY:
//   Kiểm đầy đủ bằng Zod cho hàng nghìn bản ghi trên mỗi lần tải trang là quá đắt so với lợi
//   ích: dữ liệu này do chính app ghi ra, không phải đầu vào từ bên ngoài. Một phép kiểm
//   hình dạng rẻ tiền đủ để không crash; nếu có gì đó hỏng sâu hơn, server sẽ là bên phát
//   hiện và trả về ảnh chụp đúng (route T039 kiểm bằng Zod đầy đủ).

function isSnapshotShaped(value: unknown): value is ProgressSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ProgressSnapshot>;
  return (
    Array.isArray(v.words) &&
    Array.isArray(v.lessons) &&
    Array.isArray(v.themes) &&
    Array.isArray(v.dailyStats) &&
    typeof v.serverTime === 'string'
  );
}

function isEventShaped(value: unknown): value is ProgressEvent {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ProgressEvent>;
  return (
    typeof v.clientEventId === 'string' &&
    typeof v.occurredAt === 'string' &&
    (v.kind === 'word_answer' || v.kind === 'word_learned' || v.kind === 'lesson_completed')
  );
}

/** Chỉ dùng trong test: xoá mọi khoá tiến độ khỏi `localStorage`. */
export function __clearAllProgressForTests(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    /* Không quan trọng trong test. */
  }
}
