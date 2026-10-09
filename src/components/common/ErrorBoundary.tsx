/**
 * RubyLingo — `ErrorBoundary`: lưới an toàn cuối cùng chống màn hình trắng.
 *
 * ⭐ VÌ SAO BẮT BUỘC PHẢI CÓ TRONG APP NÀY:
 *   React gỡ TOÀN BỘ cây component khi có lỗi không bắt được. Với người lớn, một màn hình trắng
 *   là khó chịu; với bé 7 tuổi đang giữa lượt chơi, đó là "con vừa làm hỏng cái gì đó" — bé sẽ
 *   tắt app và không dám mở lại. Một màn hình xin lỗi tử tế biến sự cố kỹ thuật thành một trục
 *   trặc nhỏ mà bé dám thử lại.
 *
 * ⚠️ PHẢI LÀ CLASS COMPONENT — KHÔNG CÓ CÁCH NÀO KHÁC.
 *   `componentDidCatch` / `getDerivedStateFromError` chưa có bản hook tương đương trong React 18.
 *   Thư viện bên ngoài cũng chỉ là lớp bọc quanh class này. Đây là ngoại lệ duy nhất của quy ước
 *   "dùng function component" trong dự án.
 *
 *   Màn hình hiển thị nằm ở file riêng `ErrorFallback.tsx` — trộn class với function component
 *   trong cùng một file làm mất fast-refresh. Xem ghi chú đầu file đó.
 *
 * ⭐ `resetKeys` — ĐIỀU QUAN TRỌNG NHẤT VÀ CŨNG DỄ QUÊN NHẤT:
 *   Không có nó, một khi boundary đã bắt lỗi thì nó GIỮ NGUYÊN màn hình lỗi mãi mãi, kể cả khi
 *   bé điều hướng sang trang khác đang hoạt động bình thường. Bé bị nhốt trong màn hình lỗi cho
 *   tới khi tải lại cả trang. Truyền `resetKeys={[location.pathname]}` để đổi trang là tự phục hồi.
 */

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

import { ErrorFallback } from './ErrorFallback.js';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Khi bất kỳ giá trị nào trong mảng này ĐỔI, boundary tự xoá trạng thái lỗi và thử render lại.
   * Thường truyền `[location.pathname]`.
   */
  resetKeys?: readonly unknown[];
  /** Màn hình thay thế tuỳ biến. Bỏ trống thì dùng `ErrorFallback`. */
  fallback?: ReactNode;
  /** Gọi khi bắt được lỗi — nơi gắn báo cáo lỗi sau này (chưa có dịch vụ nào ở MVP). */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // `console.error` là kênh duy nhất hiện có. Nhóm 11 (phụ huynh) sẽ thêm báo cáo lỗi.
    console.error('[RubyLingo] Lỗi không bắt được trong cây giao diện:', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  override componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (this.state.error === null) return;

    const previousKeys = previous.resetKeys ?? [];
    const currentKeys = this.props.resetKeys ?? [];
    const changed =
      previousKeys.length !== currentKeys.length ||
      currentKeys.some((key, index) => !Object.is(key, previousKeys[index]));

    if (changed) this.setState({ error: null });
  }

  /** Cho phép nút "Thử lại" phục hồi mà không cần tải lại cả trang. */
  private readonly handleRetry = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;

    return <ErrorFallback error={error} onRetry={this.handleRetry} />;
  }
}
