/**
 * RubyLingo — sessionStore: nguồn chân lý DUY NHẤT về "ai đang đăng nhập, bé nào đang chọn".
 *
 * ⭐ VÌ SAO KHÔNG ĐỂ PHIÊN TRONG TANSTACK QUERY:
 *   Query cache được thiết kế để tái sử dụng dữ liệu theo khoá và có thể bị thu hồi
 *   (`gcTime`). Phiên đăng nhập là trạng thái SỐNG CÒN của cả ứng dụng: router, guard, và
 *   mọi màn hình đều đọc nó. Đặt nó trong cache nghĩa là có lúc "phiên biến mất" chỉ vì cache
 *   hết hạn — người dùng bị đá về trang đăng nhập giữa lúc đang học. Zustand giữ nó ngoài
 *   vòng đời đó, và chỉ có MỘT chỗ ghi vào.
 *
 * ⭐ `activeChildId` ĐƯỢC LƯU LẠI QUA `localStorage`:
 *   Bé mở app trên iPad rồi tắt đi mở lại phải vào đúng hồ sơ của mình, không phải chọn lại.
 *   Nhưng id lưu trong máy có thể KHÔNG còn hợp lệ (bố mẹ đã xoá hồ sơ đó, hoặc đăng nhập
 *   tài khoản khác) — nên `resolveActiveChildId()` luôn kiểm lại với danh sách bé thật.
 */

import { create } from 'zustand';

import type { ChildProfileDto, ParentAccountDto, SessionResponse } from '@shared/types/api.js';

/**
 * `loading` là trạng thái RIÊNG, không gộp vào `anonymous`.
 *
 * Vì sao quan trọng: lúc mới tải trang ta CHƯA biết đã đăng nhập chưa. Nếu coi "chưa biết"
 * là "chưa đăng nhập" thì mỗi lần F5, người dùng bị đá về trang đăng nhập trong tích tắc rồi
 * mới được đưa vào — một cái nháy mắt rất khó chịu. Guard dùng `loading` để hiện màn hình chờ.
 */
export type SessionStatus = 'loading' | 'anonymous' | 'authenticated';

const ACTIVE_CHILD_KEY = 'rubylingo.activeChildId';

/**
 * `localStorage` có thể NÉM lỗi: chế độ riêng tư của Safari, hết dung lượng, hoặc bị chặn
 * theo chính sách. Không bọc try/catch thì một lần ghi hỏng sẽ làm sập cả ứng dụng — trong
 * khi việc lưu "bé nào đang chọn" chỉ là tiện ích, không đáng để đánh đổi.
 */
function readStoredChildId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_CHILD_KEY);
  } catch {
    return null;
  }
}

function writeStoredChildId(childId: string | null): void {
  try {
    if (childId === null) localStorage.removeItem(ACTIVE_CHILD_KEY);
    else localStorage.setItem(ACTIVE_CHILD_KEY, childId);
  } catch {
    /* Không lưu được thì thôi — phiên vẫn chạy đúng trong tab hiện tại. */
  }
}

/**
 * Chọn bé đang hoạt động từ danh sách thật.
 *
 * Thứ tự ưu tiên: id đã lưu (nếu CÒN trong danh sách) → bé đầu tiên → `null` (chưa có bé nào).
 * Trả `null` là tín hiệu để guard đưa phụ huynh sang màn hình tạo hồ sơ bé.
 */
function resolveActiveChildId(children: ChildProfileDto[], preferred: string | null): string | null {
  if (preferred && children.some((c) => c.id === preferred)) return preferred;
  return children[0]?.id ?? null;
}

interface SessionState {
  status: SessionStatus;
  parent: ParentAccountDto | null;
  children: ChildProfileDto[];
  activeChildId: string | null;

  /** Nạp phiên sau khi đăng nhập / đăng ký / tải lại trang. */
  applySession: (session: SessionResponse) => void;
  /** Chuyển sang trạng thái chưa đăng nhập (đăng xuất, hoặc server trả 401). */
  clearSession: () => void;
  setActiveChild: (childId: string) => void;

  /** Thêm bé vừa tạo; tự chọn làm bé đang hoạt động nếu trước đó chưa có bé nào. */
  addChild: (child: ChildProfileDto) => void;
  updateChild: (child: ChildProfileDto) => void;
  /** Xoá bé khỏi state; nếu bé đó đang được chọn thì tự chọn bé khác. */
  removeChild: (childId: string) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'loading',
  parent: null,
  children: [],
  activeChildId: null,

  applySession: (session) => {
    const activeChildId = resolveActiveChildId(session.children, readStoredChildId());
    writeStoredChildId(activeChildId);
    set({
      status: 'authenticated',
      parent: session.parent,
      children: session.children,
      activeChildId,
    });
  },

  clearSession: () => {
    // Xoá cả id đã lưu: nếu để lại, lần đăng nhập sau (có thể bằng tài khoản khác) sẽ thấy
    // một hồ sơ bé "đang chọn" không thuộc về mình. Trạng thái mơ hồ kiểu đó rất khó truy.
    writeStoredChildId(null);
    set({ status: 'anonymous', parent: null, children: [], activeChildId: null });
  },

  setActiveChild: (childId) => {
    // Chỉ chấp nhận id CÓ THẬT trong danh sách: `setActiveChild` được gọi từ URL/tham số,
    // nên không được tin tưởng mù quáng.
    if (!get().children.some((c) => c.id === childId)) return;
    writeStoredChildId(childId);
    set({ activeChildId: childId });
  },

  addChild: (child) => {
    const children = [...get().children, child];
    const activeChildId = get().activeChildId ?? child.id;
    writeStoredChildId(activeChildId);
    set({ children, activeChildId });
  },

  updateChild: (child) => {
    set({ children: get().children.map((c) => (c.id === child.id ? child : c)) });
  },

  removeChild: (childId) => {
    const children = get().children.filter((c) => c.id !== childId);
    const activeChildId =
      get().activeChildId === childId ? (children[0]?.id ?? null) : get().activeChildId;
    writeStoredChildId(activeChildId);
    set({ children, activeChildId });
  },
}));

/** Bé đang hoạt động, hoặc `null`. */
export function useActiveChild(): ChildProfileDto | null {
  return useSessionStore(
    (s) => s.children.find((c) => c.id === s.activeChildId) ?? null,
  );
}

/** Đã đăng nhập chưa (chỉ `true` khi phiên đã nạp xong). */
export function useIsAuthenticated(): boolean {
  return useSessionStore((s) => s.status === 'authenticated');
}
