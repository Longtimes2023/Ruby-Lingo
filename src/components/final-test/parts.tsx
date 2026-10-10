/**
 * RubyLingo — MẢNH DÙNG CHUNG của các component bài thi cuối khoá.
 *
 * Gồm những thứ xuất hiện ở gần như mọi dạng câu:
 *   • `ItemAudioButton` — nút 🔊 đọc câu mẫu TIẾNG ANH;
 *   • `ItemPrompt`      — câu lệnh tiếng Anh hiện bằng CHỮ;
 *   • `WordPicture`     — hình của từ (cho dạng tranh);
 *   • `PictureChoice`   — nút lựa chọn dạng TRANH (hình từ + nhãn chữ, dạng `choose_picture`);
 *   • `ChoiceButton` / `RevealNote` / `ContinueButton` — nút chọn + lời đưa đáp án + nút đi tiếp.
 *
 * ⚠️ TÁCH RA CHỨ KHÔNG COPY-PASTE 9 LẦN: đây là những chỗ mà một bản sao lệch sẽ tạo ra trải
 *   nghiệm không nhất quán (nút to nhỏ khác nhau, nhãn đọc khác nhau) — đúng loại lỗi khó thấy.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { Word } from '@shared/types/content.js';

import { useSpeech } from '../../hooks/useSpeech.js';
import { cn } from '../../lib/cn.js';
import { useSettingsStore } from '../../store/settingsStore.js';
import { BigButton } from '../common/BigButton.js';
import { WordIcon } from '../common/WordIcon.js';

/**
 * Nút ĐỌC CÂU MẪU — CHỈ tiếng Anh (`en-GB`), tốc độ chậm cho bé 7 tuổi.
 *
 * ⚠️ ẨN khi `soundEnabled === false` (tắt tiếng app). Nhưng đó KHÔNG phải tắt tiếng trình đọc màn
 *    hình: câu lệnh vẫn hiện bằng CHỮ và vẫn có `aria-label` — xem nguyên tắc âm thanh ở đầu
 *    `SpeechCapability.ts`. Bé khiếm thị không mất gì khi tắt tiếng app.
 *
 * ⚠️ Bé nghe lại TỰ DO, không giới hạn số lần (B3: không có đồng hồ, không tạo áp lực).
 */
export function ItemAudioButton({ text }: { text?: string | undefined }) {
  const { t } = useTranslation();
  const { speak } = useSpeech({ stopOnUnmount: true });
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);

  if (text === undefined || text.length === 0 || !soundEnabled) return null;

  return (
    <BigButton
      variant="secondary"
      icon="🔊"
      onClick={() => {
        // CHỈ TIẾNG ANH — `text` là `audioTextEn`; validator V25 chặn dấu tiếng Việt lọt vào đây.
        void speak(text, { rate: 0.8 });
      }}
    >
      {t('game.listenAgain')}
    </BigButton>
  );
}

/** Câu lệnh tiếng Anh của đề — hiện bằng CHỮ (không đọc tiếng Việt). */
export function ItemPrompt({ text }: { text?: string | undefined }) {
  if (text === undefined || text.length === 0) return null;
  return <p className="text-center text-kid-md font-bold leading-snug text-ink">{text}</p>;
}

/**
 * Hình của từ trong một khung vuông lớn. Dùng `wi-frame`/`wi-fill` (tokens.css) để cỡ biểu tượng
 * ăn theo BỀ RỘNG khung, không theo cỡ chữ — xem đầu `WordIcon`.
 */
export function WordPicture({ wordId, fallback }: { wordId: string; fallback: string }) {
  return (
    <div className="wi-frame mx-auto flex size-[132px] items-center justify-center rounded-kid border-4 border-line bg-surface-raised">
      <span aria-hidden="true" className="wi-fill">
        <WordIcon wordId={wordId} fallback={fallback} />
      </span>
    </div>
  );
}

/** Trạng thái hiển thị của một NÚT LỰA CHỌN. */
export type ChoiceState =
  /** Bình thường. */
  | 'idle'
  /** Bé vừa chọn sai nút này. */
  | 'wrong'
  /** Nút đúng (đã được chọn đúng, hoặc đang được làm nổi bật để lộ đáp án). */
  | 'correct'
  /** Bị làm mờ sau khi câu đã xong (không bấm được nữa). */
  | 'muted';

export interface ChoiceButtonProps {
  children: ReactNode;
  ariaLabel?: string;
  state: ChoiceState;
  onClick: () => void;
}

/**
 * Nút lựa chọn cỡ lớn (≥ 64px, dùng `BigButton`).
 *
 * ⚠️ Không phân biệt chỉ bằng MÀU: nút đúng còn đổi cả KIỂU (viền/nền `success`) và nhãn đọc có
 *    từ "đúng" — để bé mù màu vẫn nhận ra. Đây là yêu cầu a11y, không phải trang trí.
 */
export function ChoiceButton({ children, ariaLabel, state, onClick }: ChoiceButtonProps) {
  const variant = state === 'correct' ? 'success' : 'secondary';

  return (
    <BigButton
      variant={variant}
      aria-label={ariaLabel}
      disabled={state === 'muted'}
      onClick={onClick}
      className={cn(
        state === 'wrong' && 'border-danger bg-danger-soft text-danger',
        state === 'muted' && 'opacity-40',
      )}
    >
      {children}
    </BigButton>
  );
}

/**
 * Nút lựa chọn dạng TRANH: HÌNH của từ + NHÃN CHỮ tiếng Anh ở dưới.
 *
 * ⭐ VÌ SAO CẦN RIÊNG MỘT BIẾN THỂ CỦA `ChoiceButton` (không nhồi vào `ChoiceButton`):
 *   `ChoiceButton` chỉ nhận `children` là chữ. Tranh cần thêm hai thứ mà nút chữ không có: khung
 *   `.wi-frame`/`.wi-fill` để HÌNH ăn theo BỀ RỘNG khung (xem `WordIcon`), và một `aria-label` mô
 *   tả ý nghĩa tiếng Việt — vì ảnh là `aria-hidden`, trình đọc màn hình không "thấy" nó.
 *
 * ⚠️ ĐƯỜNG LÙI KHI KHÔNG CÓ HÌNH (bắt buộc): `word === null` (không tra được từ / chuỗi lựa chọn
 *    mơ hồ) ⇒ CHỈ hiện nhãn chữ, KHÔNG vẽ `<img>`. `WordIcon` tự lo nhánh "từ có thật nhưng chưa
 *    sinh ảnh" ⇒ trả emoji. Cả hai nhánh đều KHÔNG bao giờ để bé thấy biểu tượng ảnh hỏng.
 */
export function PictureChoice({
  option,
  word,
  state,
  onClick,
}: {
  option: string;
  word: Word | null;
  state: ChoiceState;
  onClick: () => void;
}) {
  // Nhãn đọc: có nghĩa tiếng Việt của từ ⇒ bé khiếm thị hiểu mình đang chọn gì. Kèm cả chữ tiếng
  // Anh để nhãn đọc vẫn CHỨA mặt chữ đang hiện (yêu cầu 2.5.3 "nhãn trong tên" của WCAG).
  const ariaLabel = word !== null ? `${option} — ${word.vi}` : option;

  return (
    <ChoiceButton ariaLabel={ariaLabel} state={state} onClick={onClick}>
      <span className="flex flex-col items-center gap-1">
        {word !== null && (
          <span
            aria-hidden="true"
            className="wi-frame flex size-[96px] items-center justify-center"
          >
            <span className="wi-fill">
              <WordIcon wordId={word.id} fallback={word.icon} />
            </span>
          </span>
        )}
        <span className="text-kid-xs font-bold">{option}</span>
      </span>
    </ChoiceButton>
  );
}

/** Lời đưa đáp án sau khi bé đã thử đủ số lần — KHÔNG mắng, chỉ cho xem đáp án. */
export function RevealNote({ answer }: { answer: string }) {
  const { t } = useTranslation();
  return (
    <p className="text-center text-kid-sm text-ink-soft">
      {t('finalTest.showAnswer', { answer })}
    </p>
  );
}

/** Nút "Tiếp" để đi sang câu kế — nút HÀNH ĐỘNG CHÍNH nên dùng cỡ `lg` (≥ 88px). */
export function ContinueButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <BigButton size="lg" onClick={onClick}>
      {t('app.next')}
    </BigButton>
  );
}

/** Lời động viên ngắn khi bé vừa trả lời CHƯA đúng (chưa lộ đáp án). */
export function TryAgainNote() {
  const { t } = useTranslation();
  return <p className="text-center text-kid-sm text-warn-ink">{t('finalTest.tryAgain')}</p>;
}

/**
 * Ô NHẬP 1 TỪ + nút "Kiểm tra" — dùng cho dạng "viết 1 từ" (`write_word`, `story_answer`).
 *
 * ⚠️ Bé 7+ gõ trên điện thoại còn khó, nên đây là ô nhập ĐƠN GIẢN NHẤT có thể: tắt tự sửa chính tả,
 *    tắt gợi ý của hệ điều hành (`autoCorrect`/`spellCheck`), và nút to. Không bàn phím ảo riêng để
 *    tránh một engine phức tạp — đúng tinh thần "tối giản" của giai đoạn này.
 */
export function AnswerTextField({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (value: string) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled) return;
        onSubmit(value);
      }}
    >
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        aria-label={t('finalTest.answerInputLabel')}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        // Chữ TO, viền đậm, canh giữa — để bé đọc lại được từ mình vừa gõ.
        className="min-h-touch w-full rounded-kid border-2 border-line bg-surface px-4 text-center text-kid-lg font-bold lowercase text-ink outline-none focus-visible:border-brand"
      />
      <BigButton type="submit" size="lg" disabled={disabled}>
        {t('finalTest.checkAnswer')}
      </BigButton>
    </form>
  );
}
