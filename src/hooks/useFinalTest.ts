/**
 * RubyLingo — Hook cho KHU VỰC THI CUỐI KHOÁ (Giai đoạn 7 — client).
 *
 * ⭐ HAI NHIỆM VỤ, HAI HÀM:
 *   • `useFinalTestGate()`    — ĐỌC trạng thái cổng + kết quả từng phần từ SERVER.
 *   • `useFinalTestSection()` — ĐỌC nội dung MỘT phần từ bundle (đề tĩnh trong `src/data/`).
 *
 * ⚠️⚠️ CỔNG DO SERVER QUYẾT (`gate.kind`), CLIENT KHÔNG TỰ TÍNH LẠI.
 *   `resolveFinalTestAccess` là hàm thuần DÙNG CHUNG, nhưng server mới là nơi có đủ dữ liệu thật
 *   (mọi bài đã học, mọi game đã chơi). Client tự tính lại là nguồn sự thật THỨ HAI, và hai bên
 *   sẽ lệch nhau đúng lúc bé vừa học xong mà chưa đồng bộ — cổng mở ở một màn, khoá ở màn khác.
 *
 * ⚠️ MẠNG LỖI ⇒ `state = null` + `isError = true`. UI PHẢI dịch nó thành trạng thái TRUNG TÍNH
 *    ("đang kiểm tra"), TUYỆT ĐỐI KHÔNG nói bé còn thiếu gì — mất mạng không phải là "chưa học
 *    hết". Cùng nguyên tắc đã áp ở `useGameResults` (Q-D1).
 */

import { useQuery } from '@tanstack/react-query';

import type { FinalTestSectionId } from '@shared/schemas/final-test.js';
import type { FinalTestGateState } from '@shared/types/final-test.js';
import type { FinalTestSectionFile } from '@shared/schemas/final-test.js';

import { finalTestApi } from '../api/endpoints.js';
import { readFinalTestSection } from '../data/final-test.js';
import { finalTestQueryKey } from '../lib/queryKeys.js';
import { useActiveChild } from '../store/sessionStore.js';

/** Nội dung đề là BẤT BIẾN trong suốt phiên ⇒ không bao giờ coi là "cũ". */
const CONTENT_STALE_TIME = Number.POSITIVE_INFINITY;

export interface UseFinalTestGateResult {
  /** Trạng thái cổng + mỗi phần. `null` khi đang tải HOẶC khi mạng lỗi (hai ca KHÁC nhau — xem `isError`). */
  state: FinalTestGateState | null;
  /** Đang tải lần đầu. */
  isLoading: boolean;
  /** Lần đọc gần nhất HỎNG (mạng). UI dịch thành "đang kiểm tra", KHÔNG phải "còn thiếu". */
  isError: boolean;
  /** Đọc lại từ server (nút "Thử lại", hoặc sau khi nộp một phần). */
  refetch: () => void;
}

/**
 * Trạng thái khu vực thi của bé đang chọn.
 *
 * `staleTime: 0` + `refetchOnMount: 'always'`: quay lại khu vực thi sau khi nộp một phần ⇒ đọc
 * lại ⇒ khiên cao nhất cập nhật. Đây là lưới an toàn cho ca MỞ MÁY KHÁC (máy kia vừa thi xong).
 */
export function useFinalTestGate(): UseFinalTestGateResult {
  const child = useActiveChild();
  const childId = child?.id ?? null;

  const query = useQuery({
    queryKey: finalTestQueryKey(childId),
    queryFn: () => finalTestApi.get(childId!),
    enabled: childId !== null,
    staleTime: 0,
    refetchOnMount: 'always',
    // Một lần thử lại là đủ cho mạng chập chờn; hỏng thì để UI hiện trạng thái trung tính.
    retry: 1,
  });

  return {
    state: query.data ?? null,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
}

/**
 * Nội dung MỘT phần thi (đọc từ bundle — có sẵn NGAY, không cần mạng).
 *
 * ⚠️ `section = null` (URL sai) ⇒ trả `null`; chỗ gọi phải hiện "không tìm thấy", KHÔNG render
 *    một màn trắng.
 */
export function useFinalTestSection(section: FinalTestSectionId | null): FinalTestSectionFile | null {
  return useQuery({
    queryKey: ['content', 'final-test-section', section],
    queryFn: () => (section === null ? null : readFinalTestSection(section)),
    initialData: () => (section === null ? null : readFinalTestSection(section)),
    staleTime: CONTENT_STALE_TIME,
    enabled: section !== null,
  }).data;
}
