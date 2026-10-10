/**
 * RubyLingo — câu dạng `pick_name` (Listening P1): nghe → chọn đúng từ/nhân vật.
 *
 * Tối giản: hiện câu lệnh + 🔊 + 2–6 nút lớn. Bé bấm trúng ⇒ xong; bấm chưa đúng ⇒ thử lại, và
 * sau `MAX_WRONG_PER_ROUND` lần thì app làm nổi bật đáp án để bé bấm cho hết câu (không bỏ câu).
 *
 * ⚠️ `answer` được tính TRƯỚC khi thu hẹp `item` vì hook phải chạy VÔ ĐIỀU KIỆN (rules-of-hooks);
 *    việc thu hẹp theo `interaction` chỉ để TS cho truy cập `options`/`promptEn` mà thôi.
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

export function PickNameGame({ item, onAnswered }: FinalTestItemProps) {
  const answer = 'answer' in item ? item.answer : '';
  const { submit, revealed, done, wrongPicks, wrongAttempts, finish } = useFinalTestItem(
    item.id,
    answer,
    onAnswered,
  );

  if (item.interaction !== 'pick_name') return null;

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
