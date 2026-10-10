/**
 * RubyLingo — Câu khen theo số khiên, và nhãn phần thi.
 *
 * ⭐ VÌ SAO TÁCH RA MỘT HÀM THUẦN: màn kết thúc một phần và màn chứng nhận đều cần "khiên N thì
 *   khen gì". Nếu mỗi màn tự viết một bản, chỉ cần một bản sửa mà bản kia quên là hai màn hình
 *   nói hai giọng khác nhau về cùng một kết quả. Một chỗ khai, hai nơi gọi.
 *
 * ⚠️ KHÔNG có từ chê ở BẤT KỲ mức nào (B5). Mức 1 và 2 là LỜI MỜI thử lại, không phải lời nhắc lỗi.
 */

import type { FinalTestSectionId } from '@shared/schemas/final-test.js';

/** Khoá i18n của câu khen theo mức khiên 1–5. */
export function praiseKeyForShields(shields: number): string {
  switch (shields) {
    case 5:
      return 'finalTest.praiseFive';
    case 4:
      return 'finalTest.praiseFour';
    case 3:
      return 'finalTest.praiseThree';
    case 2:
      return 'finalTest.praiseTwo';
    default:
      return 'finalTest.praiseOne';
  }
}

/** Khoá i18n tên phần thi (Nghe / Đọc & Viết / Nói). */
export function sectionTitleKey(section: FinalTestSectionId): string {
  switch (section) {
    case 'listening':
      return 'finalTest.sectionListening';
    case 'reading-writing':
      return 'finalTest.sectionReadingWriting';
    case 'speaking':
      return 'finalTest.sectionSpeaking';
  }
}
