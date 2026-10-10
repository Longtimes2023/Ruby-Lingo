/**
 * RubyLingo — HỢP ĐỒNG CHUNG cho các component một câu của BÀI THI CUỐI KHOÁ.
 *
 * ⭐ VÌ SAO CẦN MỘT HỢP ĐỒNG DUY NHẤT (song song `games/shared/types.ts`):
 *   `FinalTestSectionPage` (giai đoạn sau) chọn component bằng bảng tra `interaction →
 *   component`. Để bảng đó kiểm được kiểu và để "thêm một dạng câu mới" chỉ là thêm một dòng vào
 *   registry, mọi component phải nhận ĐÚNG MỘT bộ props giống nhau.
 *
 * ⚠️ COMPONENT KHÔNG TỰ QUYẾT ĐỊNH ĐIỀU GÌ VỀ ĐIỂM/THỨ TỰ CÂU.
 *   Nó chỉ: (1) hiện câu hỏi, (2) cho bé trả lời có phản hồi, (3) báo LÊN TRÊN đúng một lần khi
 *   câu kết thúc qua `onAnswered`. Việc chuyển câu, lưu tiến độ, tính khiên là của tầng trên.
 *
 * ⚠️ BÀI THI LÀ MIỀN RIÊNG — không dùng `GameComponentProps` và không thêm gì vào `GameType`.
 *   `GameType` (12 giá trị) là union của GAME; dạng câu bài thi bám theo `FinalTestInteraction`.
 */

import type { FinalTestItem } from '@shared/schemas/final-test.js';
import type { Word } from '@shared/types/content.js';

/**
 * Kết quả MỘT câu, báo lên tầng trên — DỮ LIỆU THÔ, không có điểm/khiên.
 *
 * ⚠️ Chỉ chứa `firstTry` + `wrongAttempts`. Đây đúng là thứ được gửi lên server (server chấm lại
 *   từ dữ liệu thô). Điểm/khiên KHÔNG bao giờ do client quyết.
 */
export interface FinalTestItemResult {
  itemId: string;
  /** Đúng NGAY lần đầu (không phải sửa) — con số quyết định khiên. */
  firstTry: boolean;
  /** Số lần trả lời CHƯA đúng ở câu này. `0` nếu đúng ngay. Không dùng để phạt. */
  wrongAttempts: number;
}

export interface FinalTestItemProps {
  /** Câu hỏi của bài thi. */
  item: FinalTestItem;
  /**
   * Từ tương ứng (`item.wordId` tra được) — dùng để vẽ HÌNH ở các câu dạng tranh.
   * Có thể thiếu nếu id không tra được; component phải chịu được (`undefined`/`null`).
   */
  word?: Word | null;
  /**
   * Bảng tra `en` (chữ thường) → `Word` của level — dùng để vẽ HÌNH cho LỰA CHỌN chỉ là CHUỖI
   * tiếng Anh (dạng `choose_picture`; xem `optionWords.ts`). Là THAM SỐ CHỌN: thiếu ⇒ component
   * chỉ hiện chữ, không vẽ ảnh — không bao giờ để bé thấy ô ảnh vỡ.
   */
  wordsByEn?: ReadonlyMap<string, Word>;
  /** Gọi ĐÚNG MỘT LẦN khi câu kết thúc (đúng, hoặc đã lộ đáp án và bé bấm Tiếp). */
  onAnswered: (result: FinalTestItemResult) => void;
}
