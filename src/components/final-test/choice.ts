/**
 * RubyLingo — Luật hiển thị NÚT LỰA CHỌN của câu bài thi cuối khoá.
 *
 * ⭐ VÌ SAO TÁCH RA FILE `.ts` RIÊNG (không để trong `parts.tsx`):
 *   Quy tắc `react-refresh/only-export-components` coi một hàm thường xuất ra từ file có component
 *   là "xuất lẫn lộn" ⇒ cảnh báo, và lint chạy với `--max-warnings 0` ⇒ ĐỎ. Hàm thuần này không
 *   phải component, nên nó ở file `.ts` riêng.
 */

import type { ChoiceState } from './parts.js';

/**
 * Trạng thái hiển thị của một nút lựa chọn, suy từ tiến độ của câu.
 *
 * Luật:
 *   • Câu đã xong (đúng HOẶC đã lộ đáp án) + đây là đáp án ⇒ `correct` (tô xanh, kèm nhãn "đúng").
 *   • Bé đã chọn sai nút này ⇒ `wrong` (tô đỏ nhẹ) — giữ lại để bé thấy mình đã thử gì.
 *   • Câu đã xong nhưng nút không phải đáp án ⇒ `muted` (mờ, không bấm được).
 *   • Còn lại ⇒ `idle`.
 */
export function choiceStateFor(
  option: string,
  answer: string,
  wrongPicks: ReadonlySet<string>,
  finished: boolean,
): ChoiceState {
  if (finished && option === answer) return 'correct';
  if (wrongPicks.has(option)) return 'wrong';
  if (finished) return 'muted';
  return 'idle';
}
