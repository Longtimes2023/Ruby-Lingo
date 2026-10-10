/**
 * RubyLingo — câu dạng `tick_cross` (Reading P1): tranh + câu "This is a …" → đánh ✓ hoặc ✗.
 *
 * Tối giản: HÌNH lớn + câu tiếng Anh + HAI nút to (✓ / ✗). Nhãn đọc (aria-label) nói rõ "đánh dấu
 * đúng" / "đánh dấu không đúng" — vì ký hiệu ✓/✗ đọc lên là vô nghĩa với trình đọc màn hình.
 */

import { useTranslation } from 'react-i18next';

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

const TICK = 'tick';
const CROSS = 'cross';

export function TickCrossGame({ item, word, onAnswered }: FinalTestItemProps) {
  const { t } = useTranslation();
  const answer = 'answer' in item ? item.answer : '';
  const { submit, revealed, done, wrongPicks, wrongAttempts, finish } = useFinalTestItem(
    item.id,
    answer,
    onAnswered,
  );

  if (item.interaction !== 'tick_cross') return null;

  const finished = done || revealed;

  return (
    <div className="flex flex-col gap-4">
      <WordPicture wordId={item.wordId} fallback={word?.icon ?? '🖼️'} />
      <ItemPrompt text={item.promptEn} />

      <div className="flex items-center justify-center gap-4">
        <div className="flex-1">
          <ChoiceButton
            ariaLabel={t('finalTest.tickYes')}
            state={choiceStateFor(TICK, item.answer, wrongPicks, finished)}
            onClick={() => {
              submit(TICK);
            }}
          >
            <span aria-hidden="true" className="text-kid-xl">
              ✓
            </span>
          </ChoiceButton>
        </div>
        <div className="flex-1">
          <ChoiceButton
            ariaLabel={t('finalTest.tickNo')}
            state={choiceStateFor(CROSS, item.answer, wrongPicks, finished)}
            onClick={() => {
              submit(CROSS);
            }}
          >
            <span aria-hidden="true" className="text-kid-xl">
              ✗
            </span>
          </ChoiceButton>
        </div>
      </div>

      {!revealed && wrongAttempts > 0 && !done && <TryAgainNote />}
      {revealed && (
        <>
          <RevealNote
            answer={item.answer === TICK ? t('finalTest.tickYes') : t('finalTest.tickNo')}
          />
          <ContinueButton onClick={finish} />
        </>
      )}
    </div>
  );
}
