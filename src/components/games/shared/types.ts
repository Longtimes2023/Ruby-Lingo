/**
 * RubyLingo — HỢP ĐỒNG CHUNG giữa `GamePage` và từng component game.
 *
 * ⭐ VÌ SAO CẦN MỘT HỢP ĐỒNG DUY NHẤT:
 *   `GamePage` chọn game bằng một bảng tra `gameType → component`. Để bảng đó kiểm được kiểu
 *   (và để thêm game mới KHÔNG phải sửa `GamePage`), mọi component game phải nhận ĐÚNG MỘT
 *   bộ props giống nhau. Nhờ vậy việc "thêm game thứ 13" chỉ là: thêm một giá trị vào
 *   `GameType` + viết component + thêm một dòng vào bảng tra. Đúng nguyên tắc data-driven.
 *
 * ⚠️ GAME KHÔNG TỰ QUẢN ĐIỂM, MẠNG, CHUỖI HAY SỐ CÂU.
 *   Game chỉ báo hai việc qua `engine`: `attempt(correct)` (bé vừa chọn) và `completeRound()`
 *   (bé vừa giải xong một câu). Mọi con số do `useGameEngine` giữ. Nếu game tự đếm, 12 game
 *   sẽ có 12 cách tính điểm hơi khác nhau và không ai phát hiện ra.
 *
 * ⚠️ GAME KHÔNG DỰNG `GameShell`, KHÔNG DỰNG `ResultOverlay`.
 *   `GamePage` lo cả hai. Game chỉ trả về phần nội dung ở giữa. Nếu game tự dựng khung, mỗi
 *   game sẽ có thanh chỉ số lệch nhau một chút — và bé phải học lại cách đọc ở mỗi trò.
 */

import type { Exercise, Word } from '@shared/types/content.js';

import type { UseGameEngineResult } from '../../../hooks/useGameEngine.js';

export interface GameComponentProps {
  exercise: Exercise;
  /**
   * Các từ của bài tập, ĐÚNG thứ tự trong `exercise.wordIds`.
   *
   * ⚠️ Có thể NGẮN HƠN `exercise.wordIds` nếu một id không tra được (dữ liệu lỗi). Game phải
   *   chịu được trường hợp đó — `GamePage` đã chặn trường hợp rỗng hoàn toàn, nhưng không
   *   chặn trường hợp thiếu một hai từ, vì chơi với 6 từ vẫn tốt hơn là báo lỗi.
   */
  words: Word[];
  engine: UseGameEngineResult;
}
