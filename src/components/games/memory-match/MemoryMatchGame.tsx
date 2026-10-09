/**
 * RubyLingo — G7 `MemoryMatchGame` (Lật thẻ ghi nhớ).
 *
 * Các thẻ úp mặt. Bé lật hai thẻ mỗi lượt để ghép **từ ↔ hình** (hoặc từ ↔ nghĩa). Ghép đúng thì
 * cặp thẻ sáng lên và app đọc từ.
 *
 * ⚠️⚠️ LẬT HAI THẺ KHÔNG KHỚP **KHÔNG PHẢI** TRẢ LỜI SAI ⇒ KHÔNG GỌI `attempt(false)`.
 *   Đây là chỗ dễ làm hỏng trò này nhất. `GAME_HEARTS.memory_match = 0` vì lật thẻ không có "sai" —
 *   lật hai thẻ không khớp chỉ là CHƯA TÌM RA. Nếu gọi `attempt(false)`:
 *     • mạng ❤️ không giảm (vì `maxHearts = 0`), nhưng
 *     • `wrongThisRound` TĂNG, và sau 2 lần không khớp thì `hintVisible` bật lên ⇒ app tự chỉ ra
 *       cặp đúng. Bé chỉ cần lật bừa hai thẻ hai lần là được chỉ đáp án ⇒ trò chơi trí nhớ mất hết.
 *   Nên: không khớp thì chỉ úp lại. Không đếm, không phạt, không gợi ý.
 *
 * ⚠️ KHÔNG HIỆN "MỤC TIÊU ≤ N LƯỢT LẬT".
 *   Thiết kế có luật "+5 điểm nếu ghép xong trong ≤ `targetFlips` lượt", nhưng luật đó PHẢI do
 *   `shared/game-scoring.ts` chấm để client và server không lệch nhau (xem ghi chú đầu file đó).
 *   Hiện hàm chấm chưa có nhánh này, nên hiện một mục tiêu mà không ai chấm là nói dối bé.
 *   Khi T049 bổ sung luật vào `shared/`, thêm dòng hiển thị ở đây cùng lúc với luật.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { MemoryMatchConfig } from '@shared/types/content.js';

import { useSfx } from '../../../hooks/useSfx.js';
import { useSpeech } from '../../../hooks/useSpeech.js';
import { cn } from '../../../lib/cn.js';
import { WordIcon } from '../../common/WordIcon.js';
import type { GameComponentProps } from '../shared/types.js';
import { buildDeck, isPair, type MemoryCard } from './logic.js';

/** Thời gian giữ hai thẻ không khớp trước khi úp lại. Đủ để bé kịp nhìn thấy cả hai. */
const MISMATCH_HOLD_MS = 950;

export function MemoryMatchGame({ exercise, words, engine }: GameComponentProps) {
  const { t } = useTranslation();
  const { speak, stop } = useSpeech({ stopOnUnmount: true });
  const { play } = useSfx();

  const config = exercise.config as MemoryMatchConfig;
  const { attempt, completeRound } = engine;

  /**
   * Hạt giống xáo bài, sinh MỘT LẦN cho mỗi lần component được dựng.
   *
   * ⚠️ `useState` với hàm khởi tạo (không phải `useState(Math.random())`) là điều kiện bắt buộc:
   *   gọi `Math.random()` trong thân render thì mỗi lần React render lại là bộ bài xáo lại — thẻ
   *   đổi chỗ ngay dưới ngón tay bé. Hàm khởi tạo chỉ chạy một lần cho mỗi lần dựng.
   *   Vì "Chơi lại" gỡ rồi dựng lại component, mỗi ván mới có một bộ bài mới — đúng ý đồ.
   */
  const [layoutSeed] = useState(() => Math.random());

  const deck = useMemo(
    () => buildDeck(words, config, `${exercise.id}#mm#${layoutSeed}`),
    [words, config, exercise.id, layoutSeed],
  );

  /** Hai thẻ đang mở mà chưa ghép được (tối đa 2). */
  const [open, setOpen] = useState<string[]>([]);
  /** `wordId` của những cặp đã ghép. */
  const [matched, setMatched] = useState<ReadonlySet<string>>(() => new Set());
  /** Đang giữ hai thẻ không khớp — chặn mọi cú lật khác cho tới khi úp lại. */
  const [locked, setLocked] = useState(false);
  const [flips, setFlips] = useState(0);

  // Rời màn hình giữa lúc giữ hai thẻ thì dừng đọc — bé không nghe nữa.
  useEffect(() => stop, [stop]);

  const byId = useMemo(() => new Map(deck.map((card) => [card.id, card])), [deck]);

  const flip = useCallback(
    (card: MemoryCard) => {
      if (locked || matched.has(card.wordId) || open.includes(card.id)) return;

      // Thẻ đầu tiên của lượt — chỉ mở lên, chưa kết luận gì.
      if (open.length === 0) {
        play('tap');
        setOpen([card.id]);
        return;
      }

      const first = byId.get(open[0]!);
      setFlips((count) => count + 1);

      if (isPair(first, card)) {
        play('correct');
        setOpen([]);
        setMatched((current) => new Set(current).add(card.wordId));
        // Đọc từ tiếng Anh — CHỈ tiếng Anh. Thẻ tiếng Việt (`en_vi`) cũng đọc từ tiếng Anh.
        void speak(card.spokenEn, { rate: 0.8 });
        attempt(true);
        completeRound(card.wordId);
        return;
      }

      // Không khớp: KHÔNG gọi `attempt(false)` — xem ghi chú đầu file.
      play('pop');
      setOpen([open[0]!, card.id]);
      setLocked(true);
      window.setTimeout(() => {
        setOpen([]);
        setLocked(false);
      }, MISMATCH_HOLD_MS);
    },
    [locked, matched, open, byId, play, speak, attempt, completeRound],
  );

  if (deck.length === 0) {
    return <p className="text-kid-sm text-ink-soft">{t('game.noWords')}</p>;
  }

  const totalPairs = deck.length / 2;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-kid-xs font-bold text-ink-soft">{t('game.matchThePairs')}</p>
        <span className="shrink-0 rounded-pill bg-surface-sunken px-3 py-1 text-kid-xs font-bold tabular-nums text-ink-soft">
          {t('game.pairsDone', { done: matched.size, total: totalPairs })}
        </span>
      </div>

      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {deck.map((card) => {
          const isMatched = matched.has(card.wordId);
          const isOpen = isMatched || open.includes(card.id);
          // Thẻ vừa mở mà chưa ghép được — tô viền cảnh báo nhẹ để bé biết đây là hai thẻ đang xét.
          const isPendingPair = !isMatched && open.includes(card.id) && open.length === 2;

          return (
            <li key={card.id}>
              <button
                type="button"
                onClick={() => flip(card)}
                disabled={isMatched}
                aria-label={
                  isOpen
                    ? t('game.cardFaceUp', {
                        /*
                          Thẻ HÌNH phải đọc TỪ TIẾNG ANH, không đọc `card.face`: từ khi chủ đề
                          `my-body` vẽ bằng SVG, `face` của thẻ hình là emoji — trình đọc màn hình
                          sẽ đọc tên emoji ("scissors", "flexed biceps") thay vì đọc từ bé đang
                          học. `card.spokenEn` luôn là từ tiếng Anh của thẻ.
                        */
                        content: card.kind === 'icon' ? card.spokenEn : card.face,
                      })
                    : t('game.cardFaceDown')
                }
                className={cn(
                  // `aspect-[4/5]`: thẻ đủ cao cho từ dài ("crocodile") xuống dòng gọn, mà vẫn thấp
                  // hơn thẻ vuông nên bàn ít phải cuộn hơn.
                  'flex aspect-[4/5] w-full items-center justify-center rounded-kid border-4 p-1.5',
                  'text-center transition-transform duration-kid select-none active:translate-y-[2px]',
                  isMatched && 'border-success bg-success-soft',
                  isPendingPair && 'border-warn bg-warn-soft',
                  !isMatched && !isPendingPair && 'border-line bg-surface hoverable:border-brand',
                )}
              >
                {isOpen ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'break-words',
                      card.kind === 'icon'
                        ? 'text-[38px] leading-none'
                        : 'text-kid-xs font-bold uppercase tracking-wide',
                      isMatched ? 'text-success' : 'text-ink',
                    )}
                  >
                    {card.kind === 'icon' ? (
                      /*
                        Thẻ HÌNH: có thể là hình vẽ tay (chủ đề `my-body`) hoặc emoji. `WordIcon`
                        quyết định, còn `card.face` là emoji dự phòng. Cỡ ăn theo `text-[38px]` ở
                        lớp cha nên không phải truyền cỡ riêng.
                      */
                      <WordIcon wordId={card.wordId} fallback={card.face} />
                    ) : (
                      card.face
                    )}
                  </span>
                ) : (
                  // Mặt úp: một dấu hỏi lớn, KHÔNG phải ảnh con vật — nếu không bé nhìn thấy nội dung.
                  <span aria-hidden="true" className="text-[34px] leading-none text-brand-strong">
                    ？
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="text-center text-kid-xs text-ink-faint">{t('game.flipCount', { count: flips })}</p>
    </>
  );
}
