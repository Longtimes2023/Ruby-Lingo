/**
 * RubyLingo — G5 `ListenTapGame` (Nghe & Chạm).
 *
 * App đọc một từ tiếng Anh, bé chạm 1 trong 4 hình. Nút 🔊 nghe lại luôn hiển thị.
 *
 * ⚠️⚠️ KHÔNG TỰ PHÁT ÂM KHI VÀO MÀN HÌNH, NHƯNG PHẢI TỰ PHÁT KHI SANG CÂU MỚI.
 *   Nghe mâu thuẫn, nhưng đây là hai tình huống khác nhau về mặt trình duyệt:
 *     • Vào màn hình = CHƯA có thao tác nào của người dùng ⇒ iOS/Safari chặn `speak()` và
 *       **im lặng vĩnh viễn** cho tới khi tải lại trang (bẫy 4 ở `SpeechService.ts`).
 *     • Sang câu mới = bé VỪA chạm vào một ô ⇒ đã có "user gesture", `speak()` chạy được.
 *   Nên: câu đầu tiên chờ bé bấm 🔊 (nút rất to, có chữ "Nghe"), các câu sau tự đọc.
 *
 * ⭐ VÌ SAO SỐ Ô CÓ THỂ ÍT HƠN 4:
 *   `pickDistractors` có ba điều kiện cứng để nhiễu không hỏng (không trùng icon, không trùng
 *   chữ, chỉ lấy từ vẽ được hình). Khi dữ liệu không đủ từ thoả mãn, nó trả ÍT HƠN số yêu cầu
 *   — và bên gọi PHẢI chấp nhận giảm số ô. Nới điều kiện để "cho đủ 4 ô" sẽ sinh ra hai ô
 *   hiện cùng một con voi, và bé chạm ô nào cũng bị tính sai. Đó là lỗi tệ hơn hẳn 3 ô.
 *
 * ⚠️ `optionsSeed` PHẢI ỔN ĐỊNH TRONG MỘT CÂU:
 *   Nếu seed đổi theo mỗi lần render, các ô sẽ ĐỔI CHỖ ngay dưới ngón tay bé (React render lại
 *   khi mạng ❤️ giảm, khi chuỗi 🔥 đổi...). Bé nhắm vào con hổ, chạm xuống thì đó đã thành con
 *   khỉ. Seed ở đây gắn với `index` của câu — đổi khi sang câu, bất biến trong câu.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ListenTapConfig, Word } from '@shared/types/content.js';

import { useDistractors } from '../../../hooks/useContent.js';
import { useSfx } from '../../../hooks/useSfx.js';
import { useSpeech } from '../../../hooks/useSpeech.js';
import { cn } from '../../../lib/cn.js';
import { shuffleSeeded } from '../../../lib/random.js';
import { BigButton } from '../../common/BigButton.js';
import { WordIcon } from '../../common/WordIcon.js';
import type { GameComponentProps } from '../shared/types.js';

export function ListenTapGame({ exercise, words, engine }: GameComponentProps) {
  const { t } = useTranslation();
  const { speak } = useSpeech({ stopOnUnmount: true });
  const { play } = useSfx();

  const config = exercise.config as ListenTapConfig;
  const { state, attempt, completeRound, hintVisible } = engine;

  /**
   * Thứ tự câu hỏi — trộn một lần cho cả lượt, KHÔNG trộn lại mỗi câu.
   *
   * ⭐ `rounds` (10) thường LỚN HƠN số từ của bài (7) ⇒ phải lặp lại từ. Lặp bằng cách nối
   *   nhiều lần bản đã trộn, mỗi lần trộn bằng seed khác, để bé không gặp đúng thứ tự cũ.
   */
  const queue = useMemo(() => {
    if (words.length === 0) return [];
    const out: Word[] = [];
    let pass = 0;
    while (out.length < config.rounds) {
      out.push(...shuffleSeeded(words, `${exercise.id}#${pass}`));
      pass += 1;
    }
    return out.slice(0, config.rounds);
  }, [words, config.rounds, exercise.id]);

  const target = queue[state.index];

  // Số ô nhiễu cần lấy: tổng số ô trừ đi ô đáp án.
  const distractors = useDistractors(
    target?.id ?? '',
    Math.max(0, config.optionCount - 1),
    config.distractorMode,
    `${exercise.id}#${state.index}`,
  );

  /** Các ô của câu hiện tại, đã trộn. Ổn định trong một câu — xem ghi chú đầu file. */
  const options = useMemo(() => {
    if (!target) return [];
    return shuffleSeeded([target, ...distractors], `${exercise.id}#opt#${state.index}`);
  }, [target, distractors, exercise.id, state.index]);

  /** Ô bé vừa chạm sai — để tô đỏ nhẹ rồi cho chạm lại. */
  const [wrongId, setWrongId] = useState<string | null>(null);
  /** Ô đáp án, hiện sau khi bé chạm đúng — để bé thấy mình đúng trước khi sang câu. */
  const [revealedId, setRevealedId] = useState<string | null>(null);

  const hear = useCallback(() => {
    if (!target) return;
    // CHỈ TIẾNG ANH. `word.vi` không bao giờ đi vào đây.
    void speak(target.en, { rate: config.speechRate });
  }, [target, speak, config.speechRate]);

  /**
   * Tự đọc khi SANG CÂU MỚI (không đọc ở câu đầu tiên).
   *
   * ⚠️ `hasInteracted` là điều kiện bắt buộc, không phải tối ưu: xem ghi chú đầu file về
   *   việc iOS chặn phát âm trước thao tác đầu tiên của người dùng.
   */
  const hasInteracted = useRef(false);
  useEffect(() => {
    if (!hasInteracted.current || !target) return;
    hear();
    // Chỉ chạy khi ĐỔI CÂU. `hear` đổi theo `target` nên đưa vào deps sẽ đọc lại không cần thiết.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index]);

  // Sang câu mới thì xoá dấu tô của câu trước.
  useEffect(() => {
    setWrongId(null);
    setRevealedId(null);
  }, [state.index]);

  const choose = useCallback(
    (word: Word) => {
      if (!target || revealedId) return;
      hasInteracted.current = true;

      if (word.id !== target.id) {
        play('wrong');
        setWrongId(word.id);
        attempt(false);
        return;
      }

      play('correct');
      setWrongId(null);
      setRevealedId(word.id);
      attempt(true);

      /**
       * ⚠️ CHỜ MỘT NHỊP TRƯỚC KHI SANG CÂU — KHÔNG gọi `completeRound()` ngay.
       *   Bé cần thấy ô mình chọn sáng xanh lên để biết "mình đúng rồi". Chuyển câu tức thì
       *   làm bé không kịp nhận ra điều gì vừa xảy ra, và câu mới hiện ra như thể màn hình
       *   tự nhảy. 650ms là đủ để thấy mà chưa đủ để sốt ruột.
       */
      window.setTimeout(() => {
        // Truyền TỪ của câu này: engine ghi vào nhật ký để T049 gửi lên server.
        completeRound(target.id);
      }, 650);
    },
    [target, revealedId, play, attempt, completeRound],
  );

  if (!target) {
    return <p className="text-kid-sm text-ink-soft">{t('game.noWords')}</p>;
  }

  return (
    <>
      {/* --- Nút nghe — to, luôn hiện, là trung tâm của game này ------------ */}
      <button
        type="button"
        onClick={() => {
          hasInteracted.current = true;
          hear();
        }}
        className={cn(
          'mx-auto flex min-h-touch-lg w-full max-w-[420px] items-center justify-center gap-3',
          'rounded-kid border-4 border-brand bg-brand-soft px-6 text-kid-lg font-bold text-brand',
          'shadow-kid transition-transform duration-kid active:translate-y-[2px] active:shadow-none',
          'select-none hoverable:brightness-105',
        )}
      >
        <span aria-hidden="true" className="text-[32px] leading-none">
          🔊
        </span>
        {t('game.listen')}
      </button>

      {/*
        ⭐ LƯỚI 2×2 Ở MỌI KHUNG MÀN HÌNH, KHÔNG PHẢI 1 CỘT Ở ĐIỆN THOẠI.
          Bốn hình xếp 2×2 thì cả bốn cùng nhìn thấy mà không phải cuộn — điều kiện bắt buộc
          để bé so sánh được các lựa chọn. Một cột dọc sẽ đẩy hai ô cuối xuống dưới màn hình,
          và bé sẽ chỉ chọn giữa hai ô đầu.
      */}
      <ul className="grid grid-cols-2 gap-3">
        {options.map((option) => {
          const isWrong = wrongId === option.id;
          const isRevealed = revealedId === option.id;
          const isHinted = hintVisible && option.id === target.id && !revealedId;

          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => choose(option)}
                aria-label={option.en}
                className={cn(
                  // `wi-frame` mở "container" để biểu tượng bên trong đo được BỀ RỘNG ô (T03).
                  'wi-frame flex aspect-square w-full flex-col items-center justify-center gap-1',
                  'rounded-kid border-4 bg-surface p-2 transition-transform duration-kid',
                  'select-none active:translate-y-[2px]',
                  isRevealed && 'border-success bg-success-soft',
                  isWrong && 'border-danger bg-danger-soft',
                  // Gợi ý sau 2 lần sai: viền nhấp nháy quanh đáp án. Bé vẫn phải tự chạm.
                  isHinted && 'animate-pulse border-star bg-star-soft',
                  !isRevealed && !isWrong && !isHinted && 'border-line hoverable:border-brand',
                )}
              >
                {/* `wi-fill`: cỡ biểu tượng = 82% bề rộng ô (cả ảnh lẫn emoji) — xem §B.2. */}
                <span aria-hidden="true" className="wi-fill">
                  <WordIcon wordId={option.id} fallback={option.icon} />
                </span>
                {/*
                  ⚠️ KHÔNG hiện chữ tiếng Anh dưới hình: game này luyện NGHE. Hiện chữ biến nó
                    thành bài đọc, và bé sẽ đối chiếu chữ thay vì nghe âm.
                */}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Chỉ hiện khi số ô ít hơn dự kiến — để người lớn biết là do dữ liệu, không phải lỗi. */}
      {options.length < config.optionCount && (
        <p className="text-center text-kid-xs text-ink-faint">
          {t('game.fewerOptions', { count: options.length })}
        </p>
      )}

      {/* Sau khi bé chạm đúng, hiện chữ để bé NỐI âm vừa nghe với mặt chữ. */}
      {revealedId && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-kid-lg font-bold text-success">{target.en}</p>
          <p className="text-kid-sm text-ink-soft">{target.vi}</p>
        </div>
      )}

      {hintVisible && !revealedId && (
        <p className="text-center text-kid-xs text-ink-soft">💡 {t('game.hintTapGlowing')}</p>
      )}

      {/* Nút nghe lại thứ hai, ở gần ngón tay — bé không phải với lên đầu màn hình. */}
      <BigButton
        variant="secondary"
        icon="🔊"
        onClick={() => {
          hasInteracted.current = true;
          hear();
        }}
      >
        {t('game.listenAgain')}
      </BigButton>
    </>
  );
}
