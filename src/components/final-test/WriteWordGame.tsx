/**
 * RubyLingo — câu dạng `write_word` (Listening P2): nghe → viết 1 tên hoặc 1 số.
 *
 * Tối giản: câu lệnh + 🔊 + Ô NHẬP + nút "Kiểm tra". Vì là nghe, KHÔNG hiện hình đáp án (sẽ lộ).
 */

import {
  AnswerTextField,
  ContinueButton,
  ItemAudioButton,
  ItemPrompt,
  RevealNote,
  TryAgainNote,
} from './parts.js';
import type { FinalTestItemProps } from './types.js';
import { useFinalTestItem } from './useFinalTestItem.js';

export function WriteWordGame({ item, onAnswered }: FinalTestItemProps) {
  const answer = 'answer' in item ? item.answer : '';
  const { submit, revealed, done, wrongAttempts, finish } = useFinalTestItem(
    item.id,
    answer,
    onAnswered,
  );

  if (item.interaction !== 'write_word') return null;

  return (
    <div className="flex flex-col gap-4">
      <ItemPrompt text={item.promptEn} />
      <ItemAudioButton text={item.audioTextEn} />

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
