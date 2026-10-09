/**
 * RubyLingo — AuthService (phía client): logic gọi API xác thực & hồ sơ bé.
 *
 * ⚙️ FILE NÀY THUẦN TypeScript — KHÔNG import React, KHÔNG đọc/ghi store.
 *   Lý do tách: logic gọi API phải test được bằng Node thuần (không cần jsdom), và phải
 *   dùng lại được ở chỗ không có React (script, test, service worker sau này). Việc nối
 *   kết quả vào `sessionStore` là nhiệm vụ của `hooks/useSession.ts`.
 *
 * `endpoints.ts` chỉ khai ĐƯỜNG DẪN và KIỂU. File này thêm PHẦN LOGIC: xử lý 401, gộp
 * nhóm thao tác, và những quyết định mà tầng vận chuyển không nên biết.
 */

import type {
  ChangePasswordRequest,
  ChildProfileDto,
  CreateChildRequest,
  LoginRequest,
  ResetPasswordRequest,
  SessionResponse,
  SignupRequest,
  SignupResponse,
  UpdateChildRequest,
} from '@shared/types/api.js';
import { authApi, childrenApi } from '../api/endpoints.js';
import { isApiClientError } from '../api/client.js';

/**
 * Đọc phiên hiện tại khi tải trang. Trả `null` nếu CHƯA đăng nhập.
 *
 * ⭐ Vì sao 401 được nuốt ở đây mà không ném ra ngoài:
 *   "Chưa đăng nhập" là kết quả BÌNH THƯỜNG của việc hỏi "tôi là ai?", không phải sự cố.
 *   Nếu để nó ném lỗi thì mọi chỗ gọi đều phải viết `try/catch` chỉ để phân biệt hai trường
 *   hợp — và sớm muộn sẽ có chỗ quên, khiến người dùng thấy màn hình lỗi đỏ khi mở app lần đầu.
 *
 * ⚠️ Lỗi MẤT MẠNG thì KHÔNG nuốt: ném ra để chỗ gọi biết "không hỏi được server", khác hẳn
 *    "server nói chưa đăng nhập". Hiện chưa có chế độ offline nên chỗ gọi coi như chưa đăng
 *    nhập; khi làm `SyncService` (offline-first) thì đây chính là điểm cần xử lý lại.
 */
export async function restoreSession(signal?: AbortSignal): Promise<SessionResponse | null> {
  try {
    return await authApi.session(signal ? { signal } : undefined);
  } catch (err) {
    if (isApiClientError(err) && err.code === 'UNAUTHENTICATED') return null;
    throw err;
  }
}

/** Đăng ký. Trả về phiên dùng được ngay (server đặt cookie trong cùng request). */
export function signUp(input: SignupRequest): Promise<SignupResponse> {
  return authApi.signup(input);
}

/** Đăng nhập. */
export function signIn(input: LoginRequest): Promise<SessionResponse> {
  return authApi.login(input);
}

/**
 * Đăng xuất.
 *
 * Nuốt mọi lỗi: dù server trả gì, người dùng ĐÃ bấm đăng xuất và phải được đưa ra khỏi phiên
 * ở phía client. Báo lỗi "đăng xuất thất bại" rồi giữ nguyên trạng thái đăng nhập là hành vi
 * tệ hơn hẳn — đặc biệt khi họ đang đăng xuất trên máy dùng chung.
 */
export async function signOut(): Promise<void> {
  try {
    await authApi.logout();
  } catch {
    /* Cố tình bỏ qua — xem ghi chú trên. */
  }
}

export function requestPasswordReset(input: ResetPasswordRequest): Promise<{ recoveryCode: string }> {
  return authApi.resetPassword(input);
}

export function changePassword(input: ChangePasswordRequest): Promise<{ ok: true }> {
  return authApi.changePassword(input);
}

// =============================================================================
// Hồ sơ bé
// =============================================================================

export function createChildProfile(input: CreateChildRequest): Promise<ChildProfileDto> {
  return childrenApi.create(input).then((r) => r.child);
}

export function updateChildProfile(
  childId: string,
  input: UpdateChildRequest,
): Promise<ChildProfileDto> {
  return childrenApi.update(childId, input).then((r) => r.child);
}

export function deleteChildProfile(childId: string): Promise<void> {
  return childrenApi.remove(childId).then(() => undefined);
}

export function listChildProfiles(signal?: AbortSignal): Promise<ChildProfileDto[]> {
  return childrenApi
    .list(signal ? { signal } : undefined)
    .then((r) => r.children);
}
