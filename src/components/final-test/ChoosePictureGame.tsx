/**
 * RubyLingo — câu dạng `choose_picture` (Listening P3/P4): nghe → chọn 1 trong 3 tranh A/B/C.
 *
 * Giai đoạn này hiện NHÃN CHỮ của tranh (đề tự soạn chưa gắn khoá ảnh cho từng lựa chọn). Bé nghe
 * câu mẫu tiếng Anh rồi chọn đúng từ — vẫn đúng bản chất "nghe hiểu", và không phụ thuộc asset
 * chưa có. Khi đề gắn `imageKeys`, chỉ cần nâng cấp phần hiển thị, không đổi luật trả lời.
 */

import { choiceStateFor } from './choice.js';
import {
  ChoiceButton,
  ContinueButton,
  ItemAudioButton,
  ItemPrompt,
  RevealNote,
  TryAgainNote,
} from './parts.js';
import type { FinalTestItemProps } from './types.js';
import { useFinalTestItem } from './useFinalTestItem.js';

export function ChoosePictureGame({ item, onAnswered }: FinalTestItemProps) {
  const answer = 'answer' in item ? item.answer : '';
  const { submit, revealed, done, wrongPicks, wrongAttempts, finish } = useFinalTestItem(
    item.id,
    answer,
    onAnswered,
  );

  if (item.interaction !== 'choose_picture') return null;

  const options = item.options ?? [];
  const finished = done || revealed;

  return (
    <div className="flex flex-col gap-4">
      <ItemPrompt text={item.promptEn} />
      <ItemAudioButton text={item.audioTextEn} />

      <ul className="flex flex-col gap-3">
        {options.map((option) => (
          <li key={option}>
            <ChoiceButton
              state={choiceStateFor(option, item.answer, wrongPicks, finished)}
              onClick={() => {
                submit(option);
              }}
            >
              {option}
            </ChoiceButton>
          </li>
        ))}
      </ul>

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
