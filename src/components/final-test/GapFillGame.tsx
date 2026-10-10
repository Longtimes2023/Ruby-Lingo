/**
 * RubyLingo — câu dạng `gap_fill` (Reading P4): câu có chỗ trống + khung từ → chọn từ đúng.
 *
 * Tối giản: câu tiếng Anh (chỗ trống `___` vẽ thành ô) + các nút từ trong `wordBox`. Bé chạm từ;
 * chưa đúng ⇒ thử lại; sau `MAX_WRONG_PER_ROUND` lần thì làm nổi bật từ đúng.
 */

import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { choiceStateFor } from './choice.js';
import { ChoiceButton, ContinueButton, RevealNote, TryAgainNote } from './parts.js';
import type { FinalTestItemProps } from './types.js';
import { useFinalTestItem } from './useFinalTestItem.js';

const BLANK = '___';

export function GapFillGame({ item, onAnswered }: FinalTestItemProps) {
  const { t } = useTranslation();
  const answer = 'answer' in item ? item.answer : '';
  const { submit, revealed, done, wrongPicks, wrongAttempts, finish } = useFinalTestItem(
    item.id,
    answer,
    onAnswered,
  );

  if (item.interaction !== 'gap_fill') return null;

  const words = item.wordBox ?? [];
  const finished = done || revealed;
  const parts = item.promptEn.split(BLANK);

  return (
    <div className="flex flex-col gap-4">
      {/* Câu có chỗ trống: `___` được vẽ thành một ô gạch chân để bé thấy chỗ cần điền. */}
      <p className="text-center text-kid-md font-bold leading-snug text-ink">
        {parts.map((part, index) => (
          <Fragment key={`part-${index}`}>
            {part}
            {index < parts.length - 1 && (
              <span
                aria-label={t('finalTest.gapBlank')}
                className="mx-1 inline-block min-w-[64px] border-b-4 border-brand align-bottom"
              >
                &nbsp;
              </span>
            )}
          </Fragment>
        ))}
      </p>

      <ul className="flex flex-col gap-3">
        {words.map((word) => (
          <li key={word}>
            <ChoiceButton
              state={choiceStateFor(word, item.answer, wrongPicks, finished)}
              onClick={() => {
                submit(word);
              }}
            >
              {word}
            </ChoiceButton>
          </li>
        ))}
      </ul>

      {!finished && (
        <p className="text-center text-kid-xs text-ink-soft">{t('finalTest.gapFillHint')}</p>
      )}

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
