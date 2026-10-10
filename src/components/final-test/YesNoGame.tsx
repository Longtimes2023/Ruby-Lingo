/**
 * RubyLingo — câu dạng `yes_no` (Reading P2): tranh + câu → viết (chọn) "yes" hoặc "no".
 *
 * Tối giản: HÌNH lớn + câu tiếng Anh + HAI nút to (yes / no). Đáp án là chữ tiếng Anh nên hiện
 * thẳng trên nút; nhãn đọc cũng là chính chữ đó.
 */

import { choiceStateFor } from './choice.js';
import {
  ChoiceButton,
  ContinueButton,
  ItemPrompt,
  RevealNote,
  TryAgainNote,
  WordPicture,
} from './parts.js';
import type { FinalTestItemProps } from './types.js';
import { useFinalTestItem } from './useFinalTestItem.js';

const YES = 'yes';
const NO = 'no';

export function YesNoGame({ item, word, onAnswered }: FinalTestItemProps) {
  const answer = 'answer' in item ? item.answer : '';
  const { submit, revealed, done, wrongPicks, wrongAttempts, finish } = useFinalTestItem(
    item.id,
    answer,
    onAnswered,
  );

  if (item.interaction !== 'yes_no') return null;

  const finished = done || revealed;

  return (
    <div className="flex flex-col gap-4">
      <WordPicture wordId={item.wordId} fallback={word?.icon ?? '🖼️'} />
      <ItemPrompt text={item.promptEn} />

      <div className="flex items-center justify-center gap-4">
        <div className="flex-1">
          <ChoiceButton
            state={choiceStateFor(YES, item.answer, wrongPicks, finished)}
            onClick={() => {
              submit(YES);
            }}
          >
            {YES}
          </ChoiceButton>
        </div>
        <div className="flex-1">
          <ChoiceButton
            state={choiceStateFor(NO, item.answer, wrongPicks, finished)}
            onClick={() => {
              submit(NO);
            }}
          >
            {NO}
          </ChoiceButton>
        </div>
      </div>

      {!revealed && wrongAttempts > 0 && !done && <TryAgainNote />}
      {revealed && (
        <>
          <RevealNote answer={item.answer === YES ? YES : NO} />
          <ContinueButton onClick={finish} />
        </>
      )}
    </div>
  );
}
