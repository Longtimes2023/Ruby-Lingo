/**
 * RubyLingo — câu dạng `story_answer` (Reading P5): tranh truyện + câu hỏi → viết 1 từ.
 *
 * ⭐ GIAI ĐOẠN 10 — ĐÃ HIỆN HÌNH GỢI Ý (trước chỉ có câu hỏi + ô nhập):
 *   Trên câu hỏi có HÌNH của TỪ MỤC TIÊU (`item.wordId`) làm gợi ý, tái dùng ảnh minh hoạ từ vựng
 *   đã có qua `WordPicture`/`WordIcon`. Từ chưa có asset ⇒ lùi EMOJI (không bao giờ thấy ảnh vỡ).
 *
 * ⚠️ TRADE-OFF ĐÃ GHI NHẬN (báo lại team-lead + tài liệu): hình này là ĐÁP ÁN, nên nó gợi ý khá
 *    mạnh. Trước đây component cố tình KHÔNG vẽ để không lộ. Cách "đúng sư phạm" là vẽ TRANH TRUYỆN
 *    (`imageKey = "story-park"`), NHƯNG asset đó chưa có và KHÔNG có manifest cảnh để kiểm tồn tại
 *    ⇒ vẽ ra sẽ là ảnh vỡ 404. Vì vậy giai đoạn này dùng hình từ mục tiêu theo yêu cầu; khi có tranh
 *    truyện thật thì đổi NGUỒN HÌNH ở đây sang tranh đó (một chỗ), KHÔNG đổi luật trả lời.
 *
 * ⚠️ KHÔNG ĐỔI LUẬT TRẢ LỜI: vẫn ô nhập 1 từ + `submit` so khớp như cũ.
 */

import {
  AnswerTextField,
  ContinueButton,
  ItemPrompt,
  RevealNote,
  TryAgainNote,
  WordPicture,
} from './parts.js';
import type { FinalTestItemProps } from './types.js';
import { useFinalTestItem } from './useFinalTestItem.js';

export function StoryAnswerGame({ item, word, onAnswered }: FinalTestItemProps) {
  const answer = 'answer' in item ? item.answer : '';
  const { submit, revealed, done, wrongAttempts, finish } = useFinalTestItem(
    item.id,
    answer,
    onAnswered,
  );

  if (item.interaction !== 'story_answer') return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Hình gợi ý của từ mục tiêu — `WordPicture` tự lùi emoji khi từ chưa có asset. */}
      <WordPicture wordId={item.wordId} fallback={word?.icon ?? '🖼️'} />
      <ItemPrompt text={item.promptEn} />

      <AnswerTextField disabled={done || revealed} onSubmit={submit} />

      {!revealed && wrongAttempts > 0 && !done && <TryAgainNote />}
      {revealed && (
        <>
          <RevealNote answer={item.answer} />
          <ContinueButton onClick={finish} />
        </>
      )}
    </div>
  );
}
