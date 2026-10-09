/**
 * RubyLingo — Hook ghép NỘI DUNG với TIẾN ĐỘ thành trạng thái bản đồ hành trình.
 *
 * ⭐ VÌ SAO CẦN MỘT HOOK GHÉP, KHÔNG ĐỂ MỖI MÀN HÌNH TỰ GHÉP:
 *   Luật mở khoá (`shared/theme-access.ts`) cần ba thứ cùng lúc: danh sách chủ đề, danh sách id
 *   từ của từng chủ đề (nằm ở cấp LEVEL, không nằm trong `ThemeMapItem`), và ảnh chụp tiến độ.
 *   Ba nguồn đó đến từ hai tầng khác nhau (nội dung + tiến độ). Ghép ở một chỗ thì màn hình
 *   `JourneyMapPage` và màn hình `ThemePage` không thể cho ra hai kết quả khác nhau — nếu mỗi
 *   nơi tự ghép, sớm muộn một nơi quên truyền `wordIdsByTheme` và tiến độ từ lặng lẽ về 0.
 *
 * ⚠️ TRƯỚC KHI `progressStore` NẠP XONG, TIẾN ĐỘ LÀ RỖNG — KHÔNG PHẢI "BẰNG 0 THẬT".
 *   Bản đồ sẽ hiện 0/275 từ trong khoảng vài chục mili giây đầu. Đó là lý do hook trả thêm
 *   `isHydrated`: màn hình dùng nó để KHÔNG hiện con số nào cả trong lúc chờ, thay vì hiện một
 *   con số sai rồi nhảy lên. Bé nhìn thấy "0 từ" rồi thành "37 từ" sẽ tưởng mình vừa mất tiến độ.
 */

import { useMemo } from 'react';

import type { ThemeAccess, ThemeAccessSummary } from '@shared/theme-access.js';
import { resolveThemeAccess, summarizeThemeAccess, themeAccessById } from '@shared/theme-access.js';

import { useProgressStore } from '../store/progressStore.js';
import { useLevel, useThemeMap } from './useContent.js';

export interface UseThemeAccessResult {
  /** Trạng thái mở khoá của từng chủ đề, ĐÚNG thứ tự `level.themeIds`. */
  access: ThemeAccess[];
  /** Tra theo id — dùng ở `ThemePage` vì id đến từ URL. */
  byThemeId: ReadonlyMap<string, ThemeAccess>;
  summary: ThemeAccessSummary;
  /** Tiến độ đã nạp xong chưa. `false` ⇒ đừng hiện con số tiến độ. */
  isHydrated: boolean;
}

export function useThemeAccess(): UseThemeAccessResult {
  // Hai truy vấn này cùng đọc từ `contentRepository` nên dùng CHUNG cache; tham chiếu trả về
  // ổn định giữa các lượt render (`staleTime: Infinity`), nhờ vậy `useMemo` bên dưới chỉ chạy
  // lại khi TIẾN ĐỘ đổi — đúng thứ cần.
  const items = useThemeMap();
  const level = useLevel();
  const snapshot = useProgressStore((s) => s.snapshot);
  const isHydrated = useProgressStore((s) => s.hydrated);

  const access = useMemo(
    () => resolveThemeAccess(items, snapshot, { wordIdsByTheme: level.wordIdsByTheme }),
    [items, snapshot, level],
  );

  const byThemeId = useMemo(() => themeAccessById(access), [access]);
  const summary = useMemo(() => summarizeThemeAccess(access), [access]);

  return { access, byThemeId, summary, isHydrated };
}
