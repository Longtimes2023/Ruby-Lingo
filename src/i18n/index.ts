/**
 * RubyLingo — Cấu hình i18next.
 *
 * Hiện chỉ có tiếng Việt (giao diện), nhưng dùng i18next ngay từ đầu để:
 *   • nội suy biến ({{count}}, {{item}}) không phải nối chuỗi thủ công
 *   • chọn câu khen ngẫu nhiên theo chỉ số (xem `pickPraise`)
 *   • sau này thêm tiếng Anh/tiếng khác chỉ cần thêm file, không sửa component
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { vi } from './vi.js';

export const defaultNS = 'translation';

void i18n.use(initReactI18next).init({
  resources: {
    vi: { translation: vi },
  },
  lng: 'vi',
  fallbackLng: 'vi',
  defaultNS,
  interpolation: {
    // React đã tự escape ⇒ không escape lần nữa (nếu không bé sẽ thấy &amp;)
    escapeValue: false,
  },
  returnNull: false,
});

/**
 * Chọn ngẫu nhiên một câu khen.
 *
 * Vì sao cần: khen mãi một câu thì bé nhàm và mất tác dụng. Dùng chỉ số câu hỏi làm
 * hạt giống để câu khen **ổn định trong một lượt chơi** (không đổi mỗi lần render lại
 * gây nhấp nháy), nhưng vẫn khác nhau giữa các câu.
 */
export function pickPraise(seed: number): string {
  const list = vi.kid.praise;
  return list[Math.abs(seed) % list.length]!;
}

/** Chọn ngẫu nhiên một câu động viên khi bé trả lời chưa đúng. */
export function pickEncourage(seed: number): string {
  const list = vi.kid.encourage;
  return list[Math.abs(seed) % list.length]!;
}

export default i18n;
