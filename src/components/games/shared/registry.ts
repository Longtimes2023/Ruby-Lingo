/**
 * RubyLingo — ĐĂNG KÝ CÁC GAME ĐÃ CÓ COMPONENT.
 *
 * ⭐⭐ VÌ SAO FILE NÀY TỒN TẠI, VÀ VÌ SAO KHÔNG DÙNG `MVP_GAME_TYPES`:
 *
 *   `MVP_GAME_TYPES` (ở `shared/types/content.ts`) nói "5 game NÀY thuộc phạm vi MVP" — đó là
 *   một tuyên bố về KẾ HOẠCH. Còn `ThemePage` cần biết "game nào BẤM VÀO ĐƯỢC NGAY BÂY GIỜ" —
 *   một sự thật về MÃ NGUỒN. Hai điều đó khác nhau trong suốt thời gian Nhóm 5 đang làm dở:
 *   khi mới có `listen_tap`, `MVP_GAME_TYPES` vẫn liệt kê cả 5.
 *
 *   Nếu `ThemePage` dùng `MVP_GAME_TYPES` để vẽ link, bé sẽ bấm vào "Lật thẻ ghi nhớ" và rơi
 *   vào màn hình "trò này đang được làm" — một nút bấm được mà dẫn tới hư không, đúng thứ ghi
 *   chú đầu `ThemePage` đã cấm.
 *
 * ⚠️⚠️ ĐÂY LÀ NGUỒN CHÂN LÝ DUY NHẤT. Bảng `GAME_COMPONENTS` CHỈ được khai ở file này:
 *   • `GamePage` import bảng để biết dựng component nào.
 *   • `ThemePage` import `isGamePlayable` để biết chip nào được phép là `<Link>`.
 *   Trước đây bảng bị khai HAI LẦN (một ở `GamePage`, một ở đây) — hai bản sao luôn lệch nhau
 *   vào đúng lúc quan trọng nhất: thêm game mới vào một bản, bản kia vẫn báo "sắp mở", và bé
 *   thấy chip xám cho một trò đã chơi được.
 *
 * 🔒 LÀM XONG MỘT GAME = thêm ĐÚNG MỘT DÒNG vào `GAME_COMPONENTS` dưới đây. Không sửa
 *   `GamePage`, không sửa `ThemePage` — cả hai đều đọc từ bảng này.
 */

import type { GameType } from '@shared/types/content.js';

import { ListenTapGame } from '../listen-tap/ListenTapGame.js';
import { MemoryMatchGame } from '../memory-match/MemoryMatchGame.js';
import { MissingLetterGame } from '../missing-letter/MissingLetterGame.js';
import { PrepositionsGame } from '../prepositions/PrepositionsGame.js';
import { WordPictureGame } from '../word-picture/WordPictureGame.js';
import type { GameComponentProps } from './types.js';

/**
 * Bảng tra `gameType → component`.
 *
 * `Partial` là CỐ Ý: chỉ các game đã làm có mặt ở đây. Game chưa làm sẽ không có link trên
 * màn chủ đề, và nếu ai gõ URL tay thì `GamePage` hiện "đang được làm".
 */
export const GAME_COMPONENTS: Partial<
  Record<GameType, (props: GameComponentProps) => JSX.Element>
> = {
  listen_tap: ListenTapGame,
  missing_letter: MissingLetterGame,
  prepositions: PrepositionsGame,
  memory_match: MemoryMatchGame,
  word_picture: WordPictureGame,
};

/** Game đã chơi được NGAY BÂY GIỜ — suy ra từ bảng trên, không khai lại bằng tay. */
export function isGamePlayable(gameType: GameType): boolean {
  return GAME_COMPONENTS[gameType] !== undefined;
}
