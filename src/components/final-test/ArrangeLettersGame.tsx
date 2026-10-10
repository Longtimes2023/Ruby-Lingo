/**
 * RubyLingo — câu dạng `arrange_letters` (Reading P3): nhìn tranh → xếp các chữ cái xáo trộn thành từ.
 *
 * Tối giản: HÌNH + gạch gợi ý (`hintMask`, vd "c _ _") + bàn phím chữ cái to. Bé chạm lần lượt; khi
 * xếp đủ số chữ thì app kiểm tra. Xếp chưa đúng ⇒ xoá về đầu để thử lại (không mắng).
 *
 * ⚠️ CHỈ ĐỌC TIẾNG ANH: mọi chữ cái đều là ký tự tiếng Anh; không có chuỗi tiếng Việt nào vào hàng
 *    đợi phát âm. Gạch gợi ý (`hintMask`) do đề cung cấp, V24 bảo đảm khớp độ dài + chữ cái đầu.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/cn.js';
import { BigButton } from '../common/BigButton.js';
import { ContinueButton, ItemPrompt, RevealNote, TryAgainNote, WordPicture } from './parts.js';
import type { FinalTestItemProps } from './types.js';
import { useFinalTestItem } from './useFinalTestItem.js';

export function ArrangeLettersGame({ item, word, onAnswered }: FinalTestItemProps) {
  const { t } = useTranslation();
  const answer = 'answer' in item ? item.answer : '';
  const { submit, revealed, done, wrongAttempts, finish } = useFinalTestItem(
    item.id,
    answer,
    onAnswered,
  );
  const [picked, setPicked] = useState<number[]>([]);

  if (item.interaction !== 'arrange_letters') return null;

  const letters = item.options ?? [];
  const mask = item.hintMask ?? '';
  const finished = done || revealed;

  const pick = (index: number) => {
    if (finished || picked.includes(index)) return;

    const next = [...picked, index];
    // Chưa đủ số chữ ⇒ chỉ ghi nhận, chưa kiểm tra.
    if (next.length < item.answer.length) {
      setPicked(next);
      return;
    }

    const value = next.map((i) => letters[i] ?? '').join('');
    if (submit(value)) {
      setPicked(next); // giữ lại để bé thấy từ mình vừa xếp
    } else {
      setPicked([]); // xếp chưa đúng ⇒ xoá về đầu, thử lại
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <ItemPrompt text={item.promptEn} />
      <WordPicture wordId={item.wordId} fallback={word?.icon ?? '🖼️'} />

      {/* Gạch gợi ý số chữ: chữ đã xếp hiện lên trên các ô. */}
      <div
        className="flex flex-wrap items-center justify-center gap-1.5 rounded-kid border-2 border-line bg-surface px-3 py-4"
        role="img"
        aria-label={t('finalTest.arrangeWordLabel')}
      >
        {[...mask].map((char, index) => {
          const filled = index < picked.length;
          return (
            <span
              key={`slot-${index}`}
              aria-hidden="true"
              className={cn(
                'flex min-w-[38px] items-center justify-center rounded-kid border-b-4 text-kid-xl font-bold uppercase',
                filled ? 'border-success text-success' : 'border-brand text-ink-faint',
              )}
            >
              {filled ? (letters[picked[index]!] ?? char) : char}
            </span>
          );
        })}
      </div>

      {/* Bàn phím chữ cái xáo trộn. */}
      <ul className="grid grid-cols-4 gap-2.5">
        {letters.map((letter, index) => {
          const used = picked.includes(index);
          return (
            <li key={`${letter}-${index}`}>
              <button
                type="button"
                aria-label={t('game.letterName', { letter })}
                disabled={used || finished}
                onClick={() => {
                  pick(index);
                }}
                className={cn(
                  'flex min-h-touch w-full items-center justify-center rounded-kid border-4',
                  'text-kid-xl font-bold uppercase select-none active:translate-y-[2px]',
                  used
                    ? 'border-line bg-surface-sunken text-ink-faint opacity-40'
                    : 'border-line bg-surface text-ink hoverable:border-brand',
                )}
              >
                {letter}
              </button>
            </li>
          );
        })}
      </ul>

      {!finished && picked.length > 0 && (
        <BigButton variant="ghost" onClick={() => setPicked([])}>
          {t('finalTest.arrangeClear')}
        </BigButton>
      )}
      {!finished && (
        <p className="text-center text-kid-xs text-ink-soft">{t('finalTest.arrangeHint')}</p>
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
