/**
 * RubyLingo — PHIÊN LÀM BÀI THI CUỐI KHOÁ (Giai đoạn 7 — client).
 *
 * ⭐ NHIỆM VỤ: giữ TIẾN ĐỘ ĐANG DỞ của MỘT phần thi, để bé thoát giữa phần rồi quay lại làm tiếp
 *   đúng câu còn dở. Lưu HAI nơi, vì hai lý do khác nhau:
 *
 *   · **localStorage** (BẮT BUỘC) — theo khoá `rubylingo:finaltest:{childId}:{section}`. Bé có thể
 *     mất mạng; tiến độ cục bộ phải sống sót mà KHÔNG cần server. Khoá có `childId` để hai bé
 *     trên cùng máy KHÔNG bao giờ nhìn thấy tiến độ của nhau.
 *
 *   · **server** (`PUT .../progress`, debounce) — để bé ĐỔI MÁY vẫn làm tiếp. Gửi nền, có debounce
 *     (không bắn một request mỗi câu), và CHỊU LỖI MẠNG: lỗi thì giữ nguyên bản cục bộ, KHÔNG chặn
 *     bé, KHÔNG hiện lỗi kỹ thuật. Cùng triết lý với hàng đợi của `progressStore`/`gameResultQueue`.
 *
 * ⚠️⚠️ STORE KHÔNG QUYẾT ĐỊNH ĐIỂM/KHIÊN. Nó chỉ giữ `{itemId, value, firstTry, wrongAttempts}` —
 *   đúng những trường client được phép biết. `firstTry` là dữ liệu THÔ gửi lên khi nộp; server
 *   chấm lại (B4). Khiên KHÔNG bao giờ đi qua store này.
 *
 * ⭐ VÌ SAO `clientEventId` CŨNG ĐƯỢC LƯU XUỐNG MÁY:
 *   Nếu lần nộp trước ghi được ở server nhưng PHẢN HỒI mất trên đường về, bé quay lại và app tự
 *   gửi lại. Nếu lần gửi lại sinh một `clientEventId` MỚI thì cổng chống trùng vô hiệu và server
 *   ghi thêm một lần thi nữa. Giữ nguyên mã giữa các lần gửi làm lần gửi lại LŨY ĐẲNG thật sự.
 */

import { create } from 'zustand';

import type { FinalTestSectionId } from '@shared/schemas/final-test.js';

import { finalTestApi } from '../api/endpoints.js';
import { createClientEventId } from '../services/ProgressService.js';

/** Tiền tố khoá lưu trữ — KHÁC mọi tiền tố khác của app để không đụng độ. */
const STORAGE_PREFIX = 'rubylingo:finaltest:';

/** Phiên bản bản lưu cục bộ. Đổi khi hình dạng đổi ⇒ bản cũ bị bỏ (không cố đọc "được gì đọc nấy"). */
const DRAFT_VERSION = 1;

/** Thời gian gộp các lần ghi tiến độ trước khi đẩy lên server (ms). */
export const PROGRESS_DEBOUNCE_MS = 900;

/** Một câu đã trả lời trong phiên đang dở. */
export interface FinalTestDraftAnswer {
  itemId: string;
  /**
   * Đáp án THÔ bé đã chọn (gửi lên server qua `PUT .../progress`).
   * ⚠️ Có thể là chuỗi RỖNG khi component không lộ ra giá trị bé chọn — server chỉ dùng trường
   *    này để biết "câu này đã làm rồi", không chấm điểm từ nó.
   */
  value: string;
  /** Đúng ngay lần đầu — dữ liệu THÔ cho lần nộp. */
  firstTry: boolean;
  /** Số lần chọn chưa đúng ở câu này. Không dùng để phạt. */
  wrongAttempts: number;
}

/** Tiến độ đang dở của một phần: các câu đã làm + mã sự kiện của lượt nộp (nếu đã bắt đầu). */
export interface FinalTestDraft {
  answers: FinalTestDraftAnswer[];
  clientEventId: string | null;
}

function draftKey(childId: string, section: FinalTestSectionId): string {
  return `${STORAGE_PREFIX}${childId}:${section}`;
}

/** Một bản ghi có đúng hình dạng một câu trả lời không (chịu được dữ liệu hỏng trong máy). */
function isAnswerShaped(value: unknown): value is FinalTestDraftAnswer {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record['itemId'] === 'string' &&
    typeof record['value'] === 'string' &&
    typeof record['firstTry'] === 'boolean' &&
    typeof record['wrongAttempts'] === 'number'
  );
}

/**
 * Đọc tiến độ đang dở của một phần từ máy.
 *
 * Trả bản rỗng (KHÔNG ném) khi: chưa từng lưu, JSON hỏng, phiên bản lạ, hoặc `localStorage` bị
 * chặn. Cả bốn trường hợp dẫn tới cùng một hành vi đúng: "coi như phần này chưa làm gì".
 */
export function loadFinalTestDraft(childId: string, section: FinalTestSectionId): FinalTestDraft {
  const empty: FinalTestDraft = { answers: [], clientEventId: null };
  try {
    const raw = localStorage.getItem(draftKey(childId, section));
    if (!raw) return empty;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return empty;
    const record = parsed as { version?: unknown; answers?: unknown; clientEventId?: unknown };
    if (record.version !== DRAFT_VERSION) return empty;
    if (!Array.isArray(record.answers)) return empty;
    return {
      answers: record.answers.filter(isAnswerShaped),
      clientEventId: typeof record.clientEventId === 'string' ? record.clientEventId : null,
    };
  } catch {
    return empty;
  }
}

/** Ghi tiến độ đang dở xuống máy. Trả `false` nếu không ghi được (hết dung lượng, chế độ riêng tư). */
export function saveFinalTestDraft(
  childId: string,
  section: FinalTestSectionId,
  draft: FinalTestDraft,
): boolean {
  try {
    localStorage.setItem(
      draftKey(childId, section),
      JSON.stringify({
        version: DRAFT_VERSION,
        answers: draft.answers,
        clientEventId: draft.clientEventId,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Xoá tiến độ đang dở của một phần (phần đã nộp xong, hoặc bé chọn làm lại từ đầu). */
export function clearFinalTestDraft(childId: string, section: FinalTestSectionId): void {
  try {
    localStorage.removeItem(draftKey(childId, section));
  } catch {
    /* Không xoá được thì thôi. */
  }
}

// =============================================================================
// Đẩy tiến độ lên server — debounce + chịu lỗi mạng
// =============================================================================

/** Bộ đếm gộp các lần ghi. Module-level (một phiên thi tại một thời điểm). */
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function cancelScheduledFlush(): void {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

/**
 * Gửi tiến độ hiện có lên server. **Không bao giờ ném** — lỗi mạng chỉ ghi log, giữ nguyên bản
 * cục bộ (bé không mất gì, không thấy lỗi kỹ thuật).
 */
async function flushProgress(): Promise<void> {
  const { childId, section, answers } = useFinalTestSessionStore.getState();
  if (childId === null || section === null) return;

  try {
    await finalTestApi.saveProgress(childId, {
      section,
      answers: answers.map((answer) => ({ itemId: answer.itemId, value: answer.value })),
    });
  } catch (error) {
    console.warn('[rubylingo] Không lưu được tiến độ bài thi lên server, giữ bản trong máy:', error);
  }
}

function scheduleFlush(): void {
  cancelScheduledFlush();
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushProgress();
  }, PROGRESS_DEBOUNCE_MS);
}

// =============================================================================
// Store
// =============================================================================

interface FinalTestSessionState {
  childId: string | null;
  section: FinalTestSectionId | null;
  answers: FinalTestDraftAnswer[];
  /** Mã sự kiện của lượt nộp — ổn định giữa các lần gửi lại (xem ghi chú đầu file). */
  clientEventId: string | null;
  /** Bắt đầu (hoặc tiếp tục) một phiên với tiến độ ban đầu đã tính sẵn từ máy/server. */
  start: (childId: string, section: FinalTestSectionId, seed: FinalTestDraft) => void;
  /** Ghi thêm một câu đã trả lời: cập nhật bộ nhớ + máy NGAY, hẹn đẩy server. */
  record: (answer: FinalTestDraftAnswer) => void;
  reset: () => void;
}

type FinalTestSessionData = Pick<
  FinalTestSessionState,
  'childId' | 'section' | 'answers' | 'clientEventId'
>;

function emptyState(): FinalTestSessionData {
  return { childId: null, section: null, answers: [], clientEventId: null };
}

export const useFinalTestSessionStore = create<FinalTestSessionState>((set, get) => ({
  ...emptyState(),
  start: (childId, section, seed) => {
    // Đổi sang phần khác (hoặc bé khác) ⇒ huỷ lần đẩy đang hẹn để không gửi nhầm tiến độ cũ.
    cancelScheduledFlush();
    set({
      childId,
      section,
      answers: [...seed.answers],
      clientEventId: seed.clientEventId ?? createClientEventId(),
    });
  },
  record: (answer) => {
    const { childId, section, answers, clientEventId } = get();
    if (childId === null || section === null) return;
    if (answers.some((existing) => existing.itemId === answer.itemId)) return;

    const next = [...answers, answer];
    set({ answers: next });
    saveFinalTestDraft(childId, section, { answers: next, clientEventId });
    // Server là kênh phụ (đổi máy làm tiếp) — gửi nền, gộp lại, lỗi thì bỏ qua.
    scheduleFlush();
  },
  reset: () => {
    cancelScheduledFlush();
    set(emptyState());
  },
}));

/** Dùng trong test: chạy NGAY lần đẩy đang hẹn (thay vì chờ hết debounce). */
export async function __flushFinalTestProgressForTests(): Promise<void> {
  cancelScheduledFlush();
  await flushProgress();
}

/** Huỷ lần đẩy đang hẹn (gọi sau khi nộp xong — không cần gửi tiến độ dở nữa). */
export function cancelFinalTestProgress(): void {
  cancelScheduledFlush();
}

/** Dùng trong test: trả store về trạng thái rỗng. */
export function __resetFinalTestSessionForTests(): void {
  cancelScheduledFlush();
  useFinalTestSessionStore.setState(emptyState());
}
