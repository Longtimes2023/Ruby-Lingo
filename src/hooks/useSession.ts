/**
 * RubyLingo — Hook phiên đăng nhập: nối `services/AuthService` với `store/sessionStore`.
 *
 * ⭐ VÌ SAO CẦN LỚP NỐI NÀY (thay vì để component gọi thẳng service rồi tự ghi store):
 *   Mỗi thao tác xác thực đều phải làm đúng một chuỗi việc: gọi API → cập nhật store → xoá
 *   cache của tài khoản cũ. Nếu mỗi trang tự làm, chỉ cần một trang quên bước xoá cache là
 *   người dùng sau khi đăng xuất vẫn thấy dữ liệu của tài khoản trước. Gom vào đây thì chỉ
 *   có một chỗ để đúng.
 */

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ChildProfileDto, SessionResponse } from '@shared/types/api.js';
import { useSessionStore } from '../store/sessionStore.js';
import * as authService from '../services/AuthService.js';

/**
 * Gộp nhiều lần gọi khởi động thành MỘT request.
 *
 * Vì sao cần: React 18 ở chế độ dev chạy effect HAI lần (StrictMode) để phát hiện side effect
 * không idempotent. Không gộp thì mỗi lần mở app là hai request `/auth/session`.
 * Xoá cache khi lỗi để lần mở sau còn thử lại được (nếu giữ promise đã reject, app sẽ kẹt
 * ở trạng thái "chưa đăng nhập" mãi mãi cho tới khi tải lại trang).
 */
let inFlightRestore: Promise<SessionResponse | null> | null = null;

function restoreOnce(): Promise<SessionResponse | null> {
  if (!inFlightRestore) {
    inFlightRestore = authService.restoreSession().catch((err: unknown) => {
      inFlightRestore = null;
      throw err;
    });
  }
  return inFlightRestore;
}

/** Chỉ dùng trong test để cô lập giữa các ca. */
export function __resetSessionBootstrapForTests(): void {
  inFlightRestore = null;
}

/**
 * Nạp phiên một lần khi app khởi động. Gọi ở component gốc (xem `App.tsx`).
 *
 * Ba kết cục: có phiên → `authenticated`; server nói chưa đăng nhập → `anonymous`;
 * không gọi được server → cũng `anonymous` (app chưa có chế độ offline — xem ghi chú ở
 * `restoreSession`).
 */
export function useSessionBootstrap(): void {
  const applySession = useSessionStore((s) => s.applySession);
  const clearSession = useSessionStore((s) => s.clearSession);

  useEffect(() => {
    let cancelled = false;

    restoreOnce()
      .then((session) => {
        if (cancelled) return;
        if (session) applySession(session);
        else clearSession();
      })
      .catch(() => {
        if (!cancelled) clearSession();
      });

    return () => {
      cancelled = true;
    };
  }, [applySession, clearSession]);
}

/** Xoá toàn bộ cache dữ liệu server — BẮT BUỘC khi đổi tài khoản. */
function useDropServerCache(): () => void {
  const queryClient = useQueryClient();
  return () => queryClient.clear();
}

// =============================================================================
// Đăng ký / đăng nhập / đăng xuất
// =============================================================================

/**
 * Đăng ký tài khoản.
 *
 * ⚠️ CỐ TÌNH **KHÔNG** `applySession` Ở ĐÂY — ĐỌC KỸ TRƯỚC KHI "SỬA" CHO GIỐNG `useSignIn`:
 *
 *   Server chỉ trả `recoveryCode` ĐÚNG MỘT LẦN. Nếu đăng ký xong là nạp phiên vào store ngay
 *   thì `status` thành `authenticated`, và `RedirectIfAuthenticated` (đang bọc `/signup`)
 *   lập tức chuyển trang — màn hình hiện mã khôi phục bị đá đi trước khi phụ huynh kịp đọc.
 *   Lỗi này đã xảy ra thật và bị bắt bằng test luồng end-to-end, không phải bằng đọc code.
 *
 *   Vì vậy trang đăng ký giữ kết quả trong state riêng và chỉ nạp phiên khi phụ huynh bấm
 *   "Tôi đã lưu rồi". Trong khoảng giữa, app coi như CHƯA đăng nhập — đúng với thực tế: phụ
 *   huynh chưa hoàn tất bước cuối.
 */
export function useSignUp() {
  const dropCache = useDropServerCache();

  return useMutation({
    mutationFn: authService.signUp,
    onSuccess: () => {
      // Xoá cache của tài khoản trước (máy dùng chung) — vẫn phải làm ngay, vì cookie phiên
      // đã được server đặt trong chính request đăng ký.
      dropCache();
    },
  });
}

export function useSignIn() {
  const applySession = useSessionStore((s) => s.applySession);
  const dropCache = useDropServerCache();

  return useMutation({
    mutationFn: authService.signIn,
    onSuccess: (session) => {
      dropCache();
      applySession(session);
    },
  });
}

export function useSignOut() {
  const clearSession = useSessionStore((s) => s.clearSession);
  const dropCache = useDropServerCache();

  return useMutation({
    mutationFn: authService.signOut,
    // `onSettled` chứ không `onSuccess`: dù server lỗi, phía client VẪN phải thoát phiên
    // (xem ghi chú ở `authService.signOut`).
    onSettled: () => {
      clearSession();
      dropCache();
    },
  });
}

// =============================================================================
// Hồ sơ bé
// =============================================================================

export function useCreateChild() {
  const addChild = useSessionStore((s) => s.addChild);
  return useMutation({
    mutationFn: authService.createChildProfile,
    onSuccess: (child: ChildProfileDto) => addChild(child),
  });
}

export function useUpdateChild() {
  const updateChild = useSessionStore((s) => s.updateChild);
  return useMutation({
    mutationFn: ({ childId, input }: { childId: string; input: Parameters<typeof authService.updateChildProfile>[1] }) =>
      authService.updateChildProfile(childId, input),
    onSuccess: (child: ChildProfileDto) => updateChild(child),
  });
}

export function useDeleteChild() {
  const removeChild = useSessionStore((s) => s.removeChild);
  return useMutation({
    mutationFn: authService.deleteChildProfile,
    onSuccess: (_void: void, childId: string) => removeChild(childId),
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: authService.changePassword });
}

export function useRequestPasswordReset() {
  const clearSession = useSessionStore((s) => s.clearSession);
  const dropCache = useDropServerCache();

  return useMutation({
    mutationFn: authService.requestPasswordReset,
    // Server THU HỒI MỌI PHIÊN khi đặt lại mật khẩu (đây là tình huống "tài khoản có thể đã
    // bị chiếm"). Client phải phản ánh đúng điều đó ngay, nếu không người dùng sẽ thấy mình
    // vẫn "đang đăng nhập" trong khi mọi request sau đó đều bị trả 401.
    onSuccess: () => {
      clearSession();
      dropCache();
    },
  });
}
