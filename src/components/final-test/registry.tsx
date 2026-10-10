/**
 * RubyLingo — ĐĂNG KÝ COMPONENT cho từng DẠNG CÂU của bài thi cuối khoá.
 *
 * ⭐⭐ VÌ SAO CẦN BẢNG TRA NÀY, VÀ VÌ SAO LÀ `Record` ĐẦY ĐỦ (không `Partial`):
 *   `FinalTestSectionPage` (giai đoạn sau) chọn component bằng `interaction → component`. Bảng này
 *   là NGUỒN CHÂN LÝ DUY NHẤT: thêm dạng câu mới = thêm một dòng ở đây, KHÔNG sửa trang.
 *
 *   Khai kiểu `Record<FinalTestInteraction, …>` (đủ mọi khoá) biến việc "quên component cho dạng
 *   câu mới" thành LỖI BIÊN DỊCH: mở rộng union `FinalTestInteraction` mà không thêm component ⇒
 *   `tsc` ĐỎ ngay. Đó là cổng mạnh hơn một test, vì nó chặn trước cả khi chạy.
 *
 * ⚠️ NHƯNG CHỈ `Record` LÀ CHƯA ĐỦ: union là hợp đồng ở tầng MÃ, còn NỘI DUNG (`final-test/*.json`)
 *   là dữ liệu có thể chứa một `interaction` chưa từng có trong union (nếu ai đó sửa JSON trước khi
 *   cập nhật schema). Vì vậy còn một cổng thứ hai ở `tests/unit/client/final-test-registry.test.tsx`:
 *   đọc THẲNG mọi `interaction` trong `src/data/levels/starters/final-test/*.json` và bắt buộc mỗi
 *   cái phải tra được component. Thiếu ⇒ test ĐỎ, chứ không để bé bấm vào thấy MÀN HÌNH TRỐNG.
 *
 * ⚠️ BÀI THI LÀ MIỀN RIÊNG: bảng này KHÔNG gộp vào `GAME_COMPONENTS` và KHÔNG thêm gì vào `GameType`
 *   (union game đã chốt 12 giá trị). Dạng câu bài thi bám theo `FinalTestInteraction`.
 */

import type { FinalTestInteraction } from '@shared/schemas/final-test.js';

import { ArrangeLettersGame } from './ArrangeLettersGame.js';
import { ChoosePictureGame } from './ChoosePictureGame.js';
import { GapFillGame } from './GapFillGame.js';
import { PickNameGame } from './PickNameGame.js';
import { SpeakPromptGame } from './SpeakPromptGame.js';
import { StoryAnswerGame } from './StoryAnswerGame.js';
import { TickCrossGame } from './TickCrossGame.js';
import { WriteWordGame } from './WriteWordGame.js';
import { YesNoGame } from './YesNoGame.js';
import type { FinalTestItemProps } from './types.js';

/** Bảng tra `interaction → component`. ĐỦ mọi giá trị của union (xem ghi chú đầu file). */
export const FINAL_TEST_COMPONENTS: Record<
  FinalTestInteraction,
  (props: FinalTestItemProps) => JSX.Element | null
> = {
  pick_name: PickNameGame,
  write_word: WriteWordGame,
  choose_picture: ChoosePictureGame,
  tick_cross: TickCrossGame,
  yes_no: YesNoGame,
  arrange_letters: ArrangeLettersGame,
  gap_fill: GapFillGame,
  story_answer: StoryAnswerGame,
  speak_prompt: SpeakPromptGame,
};

/** Dạng câu này đã có component chơi được chưa. */
export function isInteractionSupported(interaction: FinalTestInteraction): boolean {
  return FINAL_TEST_COMPONENTS[interaction] !== undefined;
}

/** Lấy component của một dạng câu. Ném lỗi rõ ràng nếu chưa hỗ trợ (không trả `undefined` im lặng). */
export function getFinalTestComponent(
  interaction: FinalTestInteraction,
): (props: FinalTestItemProps) => JSX.Element | null {
  const component = FINAL_TEST_COMPONENTS[interaction];
  if (component === undefined) {
    // Không thể xảy ra khi union và Record khớp — nhưng để LỘ RA nếu ai đó phá bất biến đó,
    // thay vì render một màn hình trống.
    throw new Error(`Chưa có component cho dạng câu bài thi "${interaction}"`);
  }
  return component;
}
