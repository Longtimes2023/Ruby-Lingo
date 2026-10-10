/**
 * RubyLingo — câu dạng `story_answer` (Reading P5): tranh truyện + câu hỏi → viết 1 từ.
 *
 * Tối giản: câu hỏi tiếng Anh + Ô NHẬP + nút "Kiểm tra".
 *
 * ⚠️ KHÔNG hiện hình đáp án (`wordId`) vì sẽ LỘ câu trả lời — câu hỏi "Who is in the park?" mà vẽ
 *    sẵn hình cậu bé thì bé không cần trả lời nữa. Cũng KHÔNG tự dựng ảnh từ `imageKey`: asset truyện
 *    chưa có trong đề tự soạn, và một ảnh vỡ còn tệ hơn không ảnh. Giai đoạn sau gắn asset rồi nâng
 *    cấp phần hiển thị, không đổi luật trả lời.
 */

import { AnswerTextField, ContinueButton, ItemPrompt, RevealNote, TryAgainNote } from './parts.js';
import type { FinalTestItemProps } from './types.js';
import { useFinalTestItem } from './useFinalTestItem.js';

export function StoryAnswerGame({ item, onAnswered }: FinalTestItemProps) {
  const answer = 'answer' in item ? item.answer : '';
  const { submit, revealed, done, wrongAttempts, finish } = useFinalTestItem(
    item.id,
    answer,
    onAnswered,
  );

  if (item.interaction !== 'story_answer') return null;

  return (
    <div className="flex flex-col gap-4">
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
