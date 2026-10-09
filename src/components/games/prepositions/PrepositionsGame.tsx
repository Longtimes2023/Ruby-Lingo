/**
 * RubyLingo — G4 `PrepositionsGame` (Thú cưng trốn ở đâu?).
 *
 * App đọc một câu tiếng Anh (*"The monkey is under the box."*). Bé CHẠM vào HÌNH thể hiện đúng vị
 * trí. Chỉ sau khi trả lời, câu chữ mới hiện ra để bé thấy cấu trúc câu.
 *
 * ⚠️⚠️ KHÔNG HIỆN CÂU CHỮ TRƯỚC KHI BÉ TRẢ LỜI (khi máy có giọng đọc).
 *   Đây là toàn bộ ý đồ sư phạm của trò: bé phải NGHE và hiểu vị trí. Hiện câu ra trước thì bé đọc
 *   chữ "under" rồi đi tìm hình — trò chơi biến thành bài tập đọc, và phần "nghe" mất hẳn.
 *   Ngoại lệ duy nhất: MÁY KHÔNG CÓ GIỌNG ĐỌC. Lúc đó hiện câu chữ là cách duy nhất để trò còn
 *   chơi được — thà lệch thiết kế một chút còn hơn đưa bé vào một câu đố không có dữ kiện nào.
 *
 * ⚠️ BỐN CẢNH, KHÔNG PHẢI BỐN NÚT CHỮ. Xem ghi chú đầu `logic.ts` — nếu bé chạm vào chữ
 *   "in/on/under/behind" thì trò này trùng hẳn với bài đọc, và không còn dạy nghe.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { PrepositionsConfig } from '@shared/types/content.js';

import { useSfx } from '../../../hooks/useSfx.js';
import { useSpeech } from '../../../hooks/useSpeech.js';
import { cn } from '../../../lib/cn.js';
import { pickEncourage } from '../../../i18n/index.js';
import { BigButton } from '../../common/BigButton.js';
import type { GameComponentProps } from '../shared/types.js';
import { sceneLayout, splitSentence, subjectIcon, type SceneLayout } from './logic.js';

/** Nhãn tiếng Việt của từng giới từ — CHỈ dùng cho `aria-label`, không hiện trên màn hình. */
const POSITION_KEYS: Readonly<Record<string, string>> = {
  in: 'game.position.in',
  on: 'game.position.on',
  under: 'game.position.under',
  behind: 'game.position.behind',
  'next to': 'game.position.nextTo',
  between: 'game.position.between',
  'in front of': 'game.position.inFrontOf',
};

function positionLabel(label: string, t: (key: string) => string): string {
  const key = POSITION_KEYS[label.trim().toLowerCase().replace(/\s+/g, ' ')];
  // Không có khoá dịch ⇒ trả chính nhãn tiếng Anh. Thà đọc một từ tiếng Anh còn hơn đọc ra
  // "game.position.xyz" (i18next trả nguyên khoá khi thiếu).
  return key ? t(key) : label;
}

/** Một khung cảnh: những cái hộp + con vật, xếp theo bố cục ở `logic.ts`. */
function Scene({ layout, petIcon }: { layout: SceneLayout; petIcon: string }) {
  return (
    // `aria-hidden` vì cảnh này là HÌNH TRANG TRÍ: ý nghĩa của nó đã nằm ở `aria-label` của nút
    // bao quanh. Để screen reader đọc thì bé chỉ nghe "📦 📦 🐵" — vô nghĩa và dài dòng.
    <div aria-hidden="true" className="relative size-full">
      {layout.boxes.map((box, index) => (
        <span
          key={index}
          className="absolute text-[34px] leading-none"
          style={{ left: `${box.left}%`, top: `${box.top}%`, zIndex: 1 }}
        >
          📦
        </span>
      ))}
      <span
        className="absolute text-[38px] leading-none"
        style={{
          left: `${layout.pet.left}%`,
          top: `${layout.pet.top}%`,
          transform: `scale(${layout.pet.scale})`,
          // `behind` cần con vật nằm SAU hộp; mọi giới từ khác nằm trước.
          zIndex: layout.pet.front ? 2 : 0,
        }}
      >
        {petIcon}
      </span>
    </div>
  );
}

export function PrepositionsGame({ exercise, words, engine }: GameComponentProps) {
  const { t } = useTranslation();
  const { speak, isSupported: speechSupported } = useSpeech({ stopOnUnmount: true });
  const { play } = useSfx();

  const config = exercise.config as PrepositionsConfig;
  const { state, attempt, completeRound, hintVisible } = engine;

  const slot = config.slots[state.index];

  const petIcon = useMemo(
    () => (slot ? subjectIcon(slot.sentenceEn, words) : '🐾'),
    [slot, words],
  );

  /** Câu đã cắt quanh giới từ — để hiện chỗ trống rồi điền sau khi bé đúng. */
  const parts = useMemo(
    () => (slot ? splitSentence(slot.sentenceEn, slot.preposition) : { before: '', after: '' }),
    [slot],
  );

  const [chosen, setChosen] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    setChosen(null);
    setSolved(false);
  }, [state.index]);

  const hear = useCallback(() => {
    if (!slot) return;
    // CHỈ TIẾNG ANH — cả câu. `slot` không có trường tiếng Việt nào.
    void speak(slot.sentenceEn, { rate: 0.8 });
  }, [slot, speak]);

  /**
   * Tự đọc khi SANG CÂU MỚI (không đọc ở câu đầu — iOS chặn phát âm trước thao tác đầu tiên).
   * Cùng lý do đã ghi ở `ListenTapGame`.
   */
  const hasInteracted = useRef(false);
  useEffect(() => {
    if (!hasInteracted.current || !slot) return;
    hear();
    // Chỉ chạy khi ĐỔI CÂU — `hear` đổi theo `slot` nên đưa vào deps sẽ đọc lại vô ích.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index]);

  const choose = useCallback(
    (label: string) => {
      if (!slot || solved) return;
      hasInteracted.current = true;

      if (label !== slot.correctSlot) {
        play('wrong');
        setChosen(label);
        attempt(false);
        return;
      }

      play('correct');
      setChosen(null);
      setSolved(true);
      attempt(true);
      // Đọc lại cả câu SAU khi bé đúng — lúc này bé đã nghe câu một lần, nghe lại lần hai gắn
      // âm thanh với cấu trúc câu vừa hiện ra trên màn hình.
      hear();
      // `null`: câu này dạy GIỚI TỪ, không dạy từ vựng — `PrepositionSlot` không có `wordId`.
      // Vẫn tính đủ điểm/sao/số câu; chỉ không ghi gì vào tiến độ TỪNG TỪ.
      // Xem `GameAnswerRecord.wordId` ở `shared/types/progress.ts`.
      window.setTimeout(() => completeRound(null), 900);
    },
    [slot, solved, play, attempt, hear, completeRound],
  );

  // `rounds` khai trong config có thể lệch với số `slots` thật — chặn ở đây thay vì render rỗng.
  if (!slot) {
    return <p className="text-kid-sm text-ink-soft">{t('game.noWords')}</p>;
  }

  // Máy không có giọng đọc ⇒ hiện câu chữ, nếu không bé không có dữ kiện nào để chọn hình.
  const showSentenceEarly = !speechSupported;

  return (
    <>
      <BigButton
        variant="secondary"
        icon="🔊"
        onClick={() => {
          hasInteracted.current = true;
          hear();
        }}
      >
        {t('game.hearSentence')}
      </BigButton>

      {/* Câu chữ — chỉ hiện khi bé đã trả lời xong, hoặc khi máy không đọc được. */}
      {(solved || showSentenceEarly) && (
        <p className="rounded-kid border-2 border-line bg-surface-raised px-4 py-3 text-center text-kid-md leading-snug text-ink">
          {parts.before}
          <span
            className={cn(
              'mx-1 inline-block rounded-pill px-3 font-bold',
              solved ? 'bg-success-soft text-success' : 'bg-brand-soft text-brand',
            )}
          >
            {solved ? slot.preposition : '_ _ _'}
          </span>
          {parts.after}
        </p>
      )}

      {!solved && (
        <p className="text-center text-kid-xs font-bold text-ink-soft">
          {t('game.tapTheRightPicture')}
        </p>
      )}

      <ul className="grid grid-cols-2 gap-3">
        {slot.slots.map((label) => {
          const isWrong = chosen === label && !solved;
          const isAnswer = solved && label === slot.correctSlot;
          const isHinted = hintVisible && !solved && label === slot.correctSlot;

          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => choose(label)}
                aria-label={positionLabel(label, t)}
                className={cn(
                  'relative flex aspect-square w-full items-center justify-center rounded-kid border-4 p-2',
                  'bg-surface transition-transform duration-kid select-none active:translate-y-[2px]',
                  isAnswer && 'border-success bg-success-soft',
                  isWrong && 'border-danger bg-danger-soft',
                  isHinted && 'animate-pulse border-star bg-star-soft',
                  !isAnswer && !isWrong && !isHinted && 'border-line hoverable:border-brand',
                )}
              >
                <Scene layout={sceneLayout(label)} petIcon={petIcon} />
              </button>
            </li>
          );
        })}
      </ul>

      {solved && (
        <p className="text-center text-kid-sm font-bold text-success">
          {t('game.petIsHere', { preposition: slot.preposition })}
        </p>
      )}

      {chosen && !solved && (
        <p className="text-center text-kid-sm text-ink-soft">
          {pickEncourage(state.wrongAttempts)}
        </p>
      )}
    </>
  );
}
