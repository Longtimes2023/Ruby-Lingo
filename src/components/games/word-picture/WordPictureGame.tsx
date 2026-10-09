/**
 * RubyLingo — G9 `WordPictureGame` (Nối từ với hình).
 *
 * Cột trái là các HÌNH, cột phải là các TỪ (hoặc các nút nghe). Bé chọn một hình rồi chọn từ tương
 * ứng. Nối đúng thì đường nối chuyển màu xanh và app đọc từ.
 *
 * ⚠️⚠️ CHỌN–RỒI–CHỌN, KHÔNG PHẢI KÉO–THẢ.
 *   Thiết kế viết "bé kéo đường nối". Trên bốn thiết bị đích (laptop · iPhone · Android · iPad) thì
 *   kéo–thả là cử chỉ tệ nhất có thể chọn: ngón tay bé che mất chính điểm đang kéo, một chút rung
 *   là rơi, và trình đọc màn hình hoàn toàn không làm được. Chạm hai lần cho ra ĐÚNG kết quả mà
 *   thiết kế muốn (một đường nối giữa hai ô), hoạt động trên mọi thiết bị và cả bàn phím.
 *   Phần ĐƯỜNG NỐI vẫn được vẽ thật — đó mới là thứ bé nhìn thấy.
 *
 * ⚠️ ĐƯỜNG NỐI VẼ BẰNG SVG ĐO TỪ DOM, NÊN PHẢI CHỊU ĐƯỢC "ĐO RA 0".
 *   Trong jsdom (test) mọi `getBoundingClientRect()` trả 0 ⇒ không có đường nào được vẽ, và bài
 *   học vẫn phải chạy bình thường. Vì vậy phần vẽ nằm trong `try`-kiểu: đo được thì vẽ, không thì
 *   thôi — chứ không được để ném lỗi làm trắng màn hình.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Word, WordPictureConfig } from '@shared/types/content.js';

import { useSfx } from '../../../hooks/useSfx.js';
import { useSpeech } from '../../../hooks/useSpeech.js';
import { cn } from '../../../lib/cn.js';
import { WordIcon } from '../../common/WordIcon.js';
import { pickEncourage } from '../../../i18n/index.js';
import type { GameComponentProps } from '../shared/types.js';
import { buildColumns } from './logic.js';

interface Connector {
  wordId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Cạnh phải của ô hình → cạnh trái của ô từ, kèm hai điểm điều khiển cho đường cong nhẹ. */
function connectorPath(line: Connector): string {
  const midX = (line.x1 + line.x2) / 2;
  return `M ${line.x1} ${line.y1} C ${midX} ${line.y1}, ${midX} ${line.y2}, ${line.x2} ${line.y2}`;
}

export function WordPictureGame({ exercise, words, engine }: GameComponentProps) {
  const { t } = useTranslation();
  const { speak } = useSpeech({ stopOnUnmount: true });
  const { play } = useSfx();

  const config = exercise.config as WordPictureConfig;
  const { state, attempt, completeRound } = engine;

  /** Xáo hai cột khác nhau — xem ghi chú đầu `logic.ts`. */
  const [layoutSeed] = useState(() => Math.random());
  const columns = useMemo(
    () => buildColumns(words, config.pairs, `${exercise.id}#wp#${layoutSeed}`),
    [words, config.pairs, exercise.id, layoutSeed],
  );

  /** Hình đang được chọn (chờ nối với một từ). */
  const [selected, setSelected] = useState<string | null>(null);
  /** Các cặp đã nối xong, THEO THỨ TỰ — để đánh số "Cặp số 1, 2, 3…". */
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  /** Từ bé vừa chọn sai — tô đỏ trong một nhịp. */
  const [wrongId, setWrongId] = useState<string | null>(null);
  const [mismatchCount, setMismatchCount] = useState(0);

  const matchedSet = useMemo(() => new Set(matchedIds), [matchedIds]);
  const byId = useMemo(() => new Map(words.map((word) => [word.id, word])), [words]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const leftRefs = useRef(new Map<string, HTMLButtonElement>());
  const rightRefs = useRef(new Map<string, HTMLButtonElement>());
  const [lines, setLines] = useState<Connector[]>([]);
  const lineSignature = useRef('');

  /**
   * Đo lại vị trí các ô đã nối. Bỏ qua khi số đo vô nghĩa (jsdom, hoặc màn hình chưa bày ra).
   *
   * ⚠️ Chỉ `setLines` khi toạ độ THỰC SỰ ĐỔI (so bằng chữ ký). Không có chốt này thì `setLines`
   *   trong `useLayoutEffect` sẽ lặp vô hạn: đặt state ⇒ render ⇒ effect ⇒ đặt state…
   */
  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const box = container.getBoundingClientRect();
    if (box.width === 0) {
      if (lineSignature.current !== '') {
        lineSignature.current = '';
        setLines([]);
      }
      return;
    }

    const next: Connector[] = [];
    for (const wordId of matchedIds) {
      const left = leftRefs.current.get(wordId);
      const right = rightRefs.current.get(wordId);
      if (!left || !right) continue;

      const l = left.getBoundingClientRect();
      const r = right.getBoundingClientRect();
      next.push({
        wordId,
        x1: l.right - box.left,
        y1: l.top + l.height / 2 - box.top,
        x2: r.left - box.left,
        y2: r.top + r.height / 2 - box.top,
      });
    }

    const signature = next
      .map(
        (line) =>
          `${line.wordId}:${Math.round(line.x1)},${Math.round(line.y1)},${Math.round(line.x2)},${Math.round(line.y2)}`,
      )
      .join('|');
    if (signature === lineSignature.current) return;
    lineSignature.current = signature;
    setLines(next);
  }, [matchedIds]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  // Bàn phím ảo bật lên, xoay máy, đổi cỡ chữ… đều làm các ô đổi chỗ ⇒ vẽ lại đường.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    return () => observer.disconnect();
  }, [measure]);

  const chooseLeft = useCallback(
    (wordId: string) => {
      if (matchedSet.has(wordId)) return;
      play('tap');
      setWrongId(null);
      setSelected(wordId);
    },
    [matchedSet, play],
  );

  const chooseRight = useCallback(
    (word: Word) => {
      if (matchedSet.has(word.id)) return;

      // Chưa chọn hình nào ⇒ chỉ nhắc, KHÔNG tính là trả lời sai.
      if (!selected) {
        play('tap');
        // Chế độ chỉ-nghe: chạm vào nút nghe để nghe thử từ, dù chưa chọn hình.
        if (config.rightColumn === 'audio') void speak(word.en, { rate: 0.8 });
        return;
      }

      if (selected !== word.id) {
        play('wrong');
        setWrongId(word.id);
        setMismatchCount((count) => count + 1);
        attempt(false);
        return;
      }

      play('correct');
      setWrongId(null);
      setSelected(null);
      setMatchedIds((current) => [...current, word.id]);
      // CHỈ TIẾNG ANH.
      void speak(word.en, { rate: 0.8 });
      attempt(true);
      completeRound(word.id);
    },
    [matchedSet, selected, play, speak, config.rightColumn, attempt, completeRound],
  );

  if (columns.left.length === 0) {
    return <p className="text-kid-sm text-ink-soft">{t('game.noWords')}</p>;
  }

  const total = columns.left.length;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-kid-xs font-bold text-ink-soft">
          {selected ? t('game.nowTapWord') : t('game.tapPictureFirst')}
        </p>
        <span className="shrink-0 rounded-pill bg-surface-sunken px-3 py-1 text-kid-xs font-bold tabular-nums text-ink-soft">
          {t('game.pairsDone', { done: matchedIds.length, total })}
        </span>
      </div>

      {/*
        ⚠️ `relative` trên khung ngoài là điều kiện để `svg absolute inset-0` trùng hệ toạ độ với
          các ô. Bỏ `relative` đi thì đường nối sẽ lệch theo trang, không theo khung.
      */}
      <div ref={containerRef} className="relative">
        <svg
          aria-hidden="true"
          // Không `viewBox`: toạ độ SVG tính bằng px của khung, đúng bằng số đo từ DOM.
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
        >
          {lines.map((line) => (
            <path
              key={line.wordId}
              d={connectorPath(line)}
              fill="none"
              stroke="var(--c-success)"
              strokeWidth={6}
              strokeLinecap="round"
            />
          ))}
        </svg>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {/* --- Cột hình ------------------------------------------------------ */}
          <ul className="flex flex-col gap-2">
            {columns.left.map((word) => {
              const isMatched = matchedSet.has(word.id);
              const isSelected = selected === word.id;

              return (
                <li key={word.id}>
                  <button
                    type="button"
                    ref={(node) => {
                      if (node) leftRefs.current.set(word.id, node);
                      else leftRefs.current.delete(word.id);
                    }}
                    onClick={() => chooseLeft(word.id)}
                    disabled={isMatched}
                    aria-label={t('game.pictureOf', { word: word.en })}
                    className={cn(
                      'relative flex aspect-square w-full items-center justify-center rounded-kid border-4',
                      'bg-surface transition-transform duration-kid select-none active:translate-y-[2px]',
                      isMatched && 'border-success bg-success-soft',
                      isSelected && 'border-brand bg-brand-soft scale-[1.03]',
                      !isMatched && !isSelected && 'border-line hoverable:border-brand',
                    )}
                  >
                    <span aria-hidden="true" className="text-[44px] leading-none">
                      <WordIcon wordId={word.id} fallback={word.icon} />
                    </span>
                    {isMatched && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-2 -left-2 flex size-7 items-center justify-center rounded-full bg-success text-kid-xs font-bold text-ink-inverse"
                      >
                        {matchedIds.indexOf(word.id) + 1}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* --- Cột từ (hoặc nút nghe) ---------------------------------------- */}
          <ul className="flex flex-col gap-2">
            {columns.right.map((word) => {
              const isMatched = matchedSet.has(word.id);
              const isWrong = wrongId === word.id;

              return (
                <li key={word.id}>
                  <button
                    type="button"
                    ref={(node) => {
                      if (node) rightRefs.current.set(word.id, node);
                      else rightRefs.current.delete(word.id);
                    }}
                    onClick={() => chooseRight(word)}
                    disabled={isMatched}
                    aria-label={t('game.wordOf', { word: word.en })}
                    className={cn(
                      'relative flex aspect-square w-full items-center justify-center rounded-kid border-4 p-1.5',
                      'bg-surface transition-transform duration-kid select-none active:translate-y-[2px]',
                      isMatched && 'border-success bg-success-soft',
                      isWrong && 'border-danger bg-danger-soft',
                      !isMatched &&
                        !isWrong &&
                        (selected ? 'border-line hoverable:border-brand' : 'border-line'),
                    )}
                  >
                    {config.rightColumn === 'audio' ? (
                      <span aria-hidden="true" className="text-[34px] leading-none">
                        🔊
                      </span>
                    ) : (
                      <span
                        aria-hidden="true"
                        className={cn(
                          'break-words text-center text-kid-sm font-bold uppercase tracking-wide',
                          isMatched ? 'text-success' : 'text-ink',
                        )}
                      >
                        {word.en}
                      </span>
                    )}
                    {isMatched && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-success text-kid-xs font-bold text-ink-inverse"
                      >
                        {matchedIds.indexOf(word.id) + 1}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {wrongId && (
        <p className="text-center text-kid-sm text-ink-soft">{pickEncourage(mismatchCount)}</p>
      )}

      {matchedIds.length === total && (
        <p className="text-center text-kid-sm font-bold text-success">{t('game.allPairsDone')}</p>
      )}

      {/* Từ đang đọc được nhắc lại bằng CHỮ sau khi nối đúng — chỉ tiếng Anh, không đọc tiếng Việt. */}
      {matchedIds.length > 0 && (
        <p className="text-center text-kid-xs text-ink-faint">
          {matchedIds
            .map((id) => byId.get(id)?.en)
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      {state.wrongAttempts >= 3 && matchedIds.length < total && (
        <p className="text-center text-kid-xs text-ink-faint">💡 {t('game.connectHint')}</p>
      )}
    </>
  );
}
