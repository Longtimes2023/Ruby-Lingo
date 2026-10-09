/**
 * RubyLingo — G3 `MissingLetterGame` (Điền chữ cái còn thiếu).
 *
 * Một từ hiện ra với 1–2 ô trống (`_ L _ P H _ N T`). Bé CHẠM chữ cái trên bàn phím ảo chữ to để
 * điền vào ô trống kế tiếp. Điền xong thì app đọc cả từ và hiện hình.
 *
 * ⚠️⚠️ BÀN PHÍM ẢO LÀ 8 Ô, KHÔNG PHẢI 26.
 *   Thiết kế nói "bàn phím ảo chữ to". Bê nguyên A–Z vào thì ở 360px, mỗi ô còn ~28px — dưới cả
 *   ngưỡng chạm 64px, và bé 7 tuổi sẽ bấm trượt liên tục. Tám ô chia 4 cột cho ra ô ~78px, đủ to,
 *   vừa một màn hình, và vẫn đủ thử thách. Việc chọn 8 chữ nào nằm ở `logic.ts` — đó là chỗ chứa
 *   phần khó thật (đừng để một chữ nhiễu ghép ra một từ khác có thật).
 *
 * ⚠️ CHỈ ĐIỀN TỪ TRÁI SANG PHẢI. Không cho bé chọn ô trống nào để điền trước: với `hideCount = 1`
 *   (mọi bài hiện nay) hai cách là như nhau, nhưng với 2 ô thì "chữ này vào ô nào" là một câu hỏi
 *   KHÁC hẳn "chữ nào còn thiếu" — và nó biến bài chính tả thành bài suy luận vị trí.
 *
 * ⚠️ MỌI CHỮ NÀY CHỈ ĐỌC TIẾNG ANH. Nút 🔊 đọc `word.en`; nghĩa tiếng Việt (`word.vi`) chỉ hiện
 *   bằng CHỮ sau khi bé làm xong, không bao giờ đi vào hàng đợi phát âm — xem quy tắc số một của
 *   âm thanh ở `SpeechCapability.ts`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { MissingLetterConfig, Word } from '@shared/types/content.js';

import { useSfx } from '../../../hooks/useSfx.js';
import { useSpeech } from '../../../hooks/useSpeech.js';
import { cn } from '../../../lib/cn.js';
import { shuffleSeeded } from '../../../lib/random.js';
import { BigButton } from '../../common/BigButton.js';
import { WordIcon } from '../../common/WordIcon.js';
import type { GameComponentProps } from '../shared/types.js';
import { correctLetters, hiddenIndices, letterOptions } from './logic.js';

export function MissingLetterGame({ exercise, words, engine }: GameComponentProps) {
  const { t } = useTranslation();
  const { speak } = useSpeech({ stopOnUnmount: true });
  const { play } = useSfx();

  const config = exercise.config as MissingLetterConfig;
  const { state, attempt, completeRound, hintVisible } = engine;

  /**
   * Thứ tự các từ của lượt chơi — trộn MỘT lần cho cả lượt, và lặp lại từ khi `rounds` lớn hơn
   * số từ của bài (6 câu / 7 từ ở `z1` thì ít hơn, nhưng không được giả định như vậy).
   */
  const queue = useMemo(() => {
    if (words.length === 0) return [];
    const out: Word[] = [];
    let pass = 0;
    while (out.length < config.rounds) {
      out.push(...shuffleSeeded(words, `${exercise.id}#ml#${pass}`));
      pass += 1;
    }
    return out.slice(0, config.rounds);
  }, [words, config.rounds, exercise.id]);

  const target = queue[state.index];

  /** Ô trống của câu hiện tại. Ổn định trong một câu — xem ghi chú ở `ListenTapGame`. */
  const hidden = useMemo(
    () =>
      target
        ? hiddenIndices(
            target.en,
            config.hideCount,
            config.hidePosition,
            `${exercise.id}#hide#${state.index}`,
          )
        : [],
    [target, config.hideCount, config.hidePosition, exercise.id, state.index],
  );

  const answers = useMemo(
    () => (target ? correctLetters(target.en, hidden) : []),
    [target, hidden],
  );

  /** Các từ khác của bài — để loại chữ nhiễu ghép ra từ khác (xem `makesAnotherWord`). */
  const siblings = useMemo(
    () => words.filter((word) => word.id !== target?.id).map((word) => word.en),
    [words, target],
  );

  const options = useMemo(
    () =>
      target ? letterOptions(target.en, hidden, siblings, `${exercise.id}#letters#${state.index}`) : [],
    [target, hidden, siblings, exercise.id, state.index],
  );

  /** Chữ đã điền vào từng ô trống, theo VỊ TRÍ trong từ (không theo thứ tự điền). */
  const [filled, setFilled] = useState<Record<number, string>>({});
  /** Chữ bé vừa chạm sai — tô đỏ nhẹ trong một nhịp. */
  const [wrongLetter, setWrongLetter] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);

  // Sang câu mới thì xoá mọi dấu vết của câu trước.
  useEffect(() => {
    setFilled({});
    setWrongLetter(null);
    setSolved(false);
  }, [state.index]);

  /**
   * Ô trống KẾ TIẾP là ô trống thứ `filledCount` (điền từ trái sang phải).
   *
   * ⚠️ Phải là `hidden[filledCount]` chứ không phải `hidden.length - filledCount - 1`: cách thứ hai
   *   điền từ PHẢI sang TRÁI, và chỉ đúng khi có đúng một ô trống. Với hai ô, nó lặng lẽ sai thứ tự
   *   — đúng loại lỗi mà `hideCount > 1` (độ khó 2–3 của thiết kế) sẽ gặp.
   */
  const filledCount = Object.keys(filled).length;
  const nextIndex = hidden[filledCount];
  const nextLetter = answers[filledCount];

  const choose = useCallback(
    (letter: string) => {
      if (!target || solved || nextIndex === undefined) return;

      if (letter.toLowerCase() !== nextLetter) {
        play('wrong');
        setWrongLetter(letter);
        attempt(false);
        return;
      }

      play('correct');
      setWrongLetter(null);
      const done = { ...filled, [nextIndex]: letter.toLowerCase() };
      setFilled(done);

      // Điền hết các ô trống ⇒ xong câu. Đọc cả từ, rồi chờ một nhịp cho bé thấy từ hoàn chỉnh.
      if (Object.keys(done).length >= hidden.length) {
        setSolved(true);
        attempt(true);
        void speak(target.en, { rate: 0.8 });
        window.setTimeout(() => completeRound(target.id), 800);
      }
    },
    [target, solved, nextIndex, nextLetter, play, attempt, filled, hidden.length, speak, completeRound],
  );

  if (!target) {
    return <p className="text-kid-sm text-ink-soft">{t('game.noWords')}</p>;
  }

  const hear = () => {
    // CHỈ TIẾNG ANH.
    void speak(target.en, { rate: 0.8 });
  };

  // Ô trống thứ `order` đã có chữ khi bé đã điền đủ `order + 1` ô (điền từ trái sang phải).
  const filledInOrder = filledCount;

  return (
    <>
      {/* --- Hình gợi ý (tắt dần khi độ khó tăng) -------------------------------- */}
      {config.showImageHint ? (
        <div
          className={cn(
            // `wi-frame` (T03): mở "container" để biểu tượng bên trong đo được BỀ RỘNG ô.
            'wi-frame mx-auto flex size-[132px] items-center justify-center rounded-kid border-4',
            solved ? 'border-success bg-success-soft' : 'border-line bg-surface-raised',
          )}
        >
          {/* `wi-fill`: cỡ biểu tượng = 82% bề rộng ô — xem §B.2. */}
          <span aria-hidden="true" className="wi-fill">
            <WordIcon wordId={target.id} fallback={target.icon} />
          </span>
        </div>
      ) : null}

      {/* --- Từ đang điền: chữ hiện sẵn + ô trống ------------------------------- */}
      <div
        className="flex flex-wrap items-center justify-center gap-1.5 rounded-kid border-2 border-line bg-surface px-3 py-4"
        // Nhãn đọc gộp cả từ để screen reader đọc được đúng một lần, thay vì đọc từng chữ rời.
        aria-label={solved ? target.en : t('game.wordWithBlanks')}
        role="img"
      >
        {[...target.en].map((char, index) => {
          const isBlank = hidden.includes(index);
          if (!isBlank) {
            return (
              <span
                key={`${char}-${index}`}
                aria-hidden="true"
                className="text-kid-xl font-bold uppercase tracking-wide text-ink"
              >
                {char}
              </span>
            );
          }

          const order = hidden.indexOf(index);
          const hasLetter = order < filledInOrder;
          return (
            <span
              key={`blank-${index}`}
              aria-hidden="true"
              className={cn(
                'flex min-w-[38px] items-center justify-center rounded-kid border-b-4 text-kid-xl font-bold uppercase',
                hasLetter ? 'border-success text-success' : 'border-brand text-ink-faint',
              )}
            >
              {hasLetter ? filled[index]! : '_'}
            </span>
          );
        })}
      </div>

      {/* --- Bàn phím ảo chữ to -------------------------------------------------- */}
      <ul className="grid grid-cols-4 gap-2.5">
        {options.map((letter) => {
          const isWrong = wrongLetter === letter;
          const isHinted = hintVisible && !solved && letter === nextLetter;
          const isSpent = solved;

          return (
            <li key={letter}>
              <button
                type="button"
                onClick={() => choose(letter)}
                // Nhãn đọc là CHỮ CÁI ("chữ t"), không phải ký tự trơ — screen reader đọc "t" là
                // một tiếng vô nghĩa, đọc "chữ t" mới rõ đây là một phím.
                aria-label={t('game.letterName', { letter })}
                className={cn(
                  'flex min-h-touch w-full items-center justify-center rounded-kid border-4',
                  'text-kid-xl font-bold uppercase transition-transform duration-kid',
                  'select-none active:translate-y-[2px]',
                  isWrong && 'border-danger bg-danger-soft text-danger',
                  isHinted && 'animate-pulse border-star bg-star-soft text-ink',
                  !isWrong && !isHinted && 'border-line bg-surface text-ink hoverable:border-brand',
                  isSpent && 'opacity-40',
                )}
              >
                {letter}
              </button>
            </li>
          );
        })}
      </ul>

      {hintVisible && !solved && (
        <p className="text-center text-kid-xs text-ink-soft">💡 {t('game.hintLetterGlowing')}</p>
      )}

      {/* --- Khi xong: hiện cả từ + nghĩa (bằng CHỮ, không đọc tiếng Việt) -------- */}
      {solved && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-kid-xl font-bold tracking-wide text-success">{target.en}</p>
          <p className="text-kid-sm text-ink-soft">{target.vi}</p>
        </div>
      )}

      <BigButton variant="secondary" icon="🔊" onClick={hear}>
        {t('game.hearWord')}
      </BigButton>
    </>
  );
}
