/**
 * RubyLingo — `GameShell`: khung chung bao quanh MỌI game.
 *
 * ⭐ NHIỆM VỤ: bé chỉ phải học MỘT lần cách đọc màn hình chơi. Mạng ❤️, chuỗi 🔥, "Câu 3 / 10",
 *   nút thoát — luôn ở đúng chỗ đó ở cả 12 game. Game chỉ việc đưa phần nội dung vào giữa.
 *
 * ⚠️ VÌ SAO DÙNG `ProgressDots` Ở ĐÂY (mà `ThemePage`/`ThemeCard` lại dùng `ProgressBar`):
 *   `ProgressDots` vẽ một chấm TO cho "bước hiện tại" — đúng nghĩa "mình đang ở câu mấy".
 *   Còn tiến độ dạng tỉ lệ ("đã học 7/13 từ") thì chấm to đó bị đọc sai thành "đang ở từ số 8".
 *   Đây chính là lý do `ProgressBar` được tạo ra ở Nhóm 4. Game là ca dùng ĐÚNG của Dots.
 *
 * ⚠️ NÚT THOÁT KHÔNG PHẢI `<Link>` TRỰC TIẾP, VÀ KHÔNG HỎI "BÉ CÓ CHẮC KHÔNG?":
 *   Hộp thoại xác nhận với bé 7 tuổi là một câu đố — bé không đọc, bé bấm bừa. Thay vào đó
 *   nút thoát rời game luôn, và vì KHÔNG CÓ TRẠNG THÁI THUA nên rời giữa ván cũng không mất
 *   gì: tiến độ từ vựng đã được ghi theo từng câu, chỉ có điểm của ván dở là không được tính.
 *
 * ⚠️ KHÔNG ĐẶT `overflow-hidden` Ở ĐÂY. Vài game (nối từ bằng đường SVG) vẽ ra ngoài biên của
 *   ô nội dung trong lúc bé đang kéo. Cắt đi sẽ làm đường nối đứt giữa không trung.
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { GameType } from '@shared/types/content.js';
import { GAME_LABELS } from '@shared/types/content.js';

import type { GameEngineState } from '../../../hooks/useGameEngine.js';
import { cn } from '../../../lib/cn.js';
import { HeartMeter } from '../../common/HeartMeter.js';
import { ProgressDots } from '../../common/ProgressDots.js';

export interface GameShellProps {
  gameType: GameType;
  /** Tên bài học — để bé biết mình đang chơi từ của bài nào. */
  lessonName: string;
  /** Đường về khi bé bấm thoát (thường là trang chủ đề). */
  exitTo: string;
  state: GameEngineState;
  /** Câu đang chơi, đếm từ 1. */
  roundNumber: number;
  /** Phần nội dung của game. */
  children: ReactNode;
  /** Nút "Nghe lại" hoặc các nút phụ của game — đặt ở dưới cùng, trong vùng tay bé. */
  footer?: ReactNode;
  className?: string;
}

export function GameShell({
  gameType,
  lessonName,
  exitTo,
  state,
  roundNumber,
  children,
  footer,
  className,
}: GameShellProps) {
  const { t } = useTranslation();
  const label = GAME_LABELS[gameType];

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* --- Đầu màn: thoát + nhận diện game ------------------------------- */}
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Link
            to={exitTo}
            aria-label={t('game.exit')}
            className={cn(
              'inline-flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center gap-2',
              'rounded-kid border-2 border-line bg-surface px-3 text-kid-xs font-bold text-ink-soft',
            )}
          >
            <span aria-hidden="true">←</span>
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-kid-md leading-tight text-ink">
              <span aria-hidden="true" className="text-[22px] leading-none">
                {label.icon}
              </span>
              <span className="truncate">{label.name_vi}</span>
            </h1>
            <p className="truncate text-kid-xs text-ink-faint">{lessonName}</p>
          </div>
        </div>
      </header>

      {/* --- Thanh chỉ số: mạng ❤️ + chuỗi 🔥 + tiến độ câu ----------------- */}
      <div className="flex flex-col gap-2 rounded-kid border-2 border-line bg-surface p-3">
        <div className="flex items-center justify-between gap-3">
          {/*
            ⚠️ CHỈ HIỆN MẠNG KHI GAME CÓ KHÁI NIỆM "TRẢ LỜI SAI".
              `memory_match` có `maxHearts === 0`: lật hai thẻ không khớp là CHƯA TÌM RA, không
              phải sai. Hiện một dãy ❤️ không bao giờ giảm là nói dối bé; hiện dãy ❤️ có giảm
              thì biến trò trí nhớ thành trò may rủi có phạt.
          */}
          {state.maxHearts > 0 ? (
            <HeartMeter value={state.hearts} max={state.maxHearts} compact />
          ) : (
            <span className="text-kid-xs text-ink-faint">{t('game.noHearts')}</span>
          )}

          {/*
            Chuỗi 🔥 chỉ hiện khi ĐANG CÓ chuỗi. Hiện "chuỗi 0" là nhắc bé rằng nó vừa đứt —
            đúng kiểu nhắc không cần thiết mà triết lý của app muốn tránh.
          */}
          {state.streak >= 2 && (
            <span
              className="flex items-center gap-1 rounded-pill bg-surface-sunken px-2.5 py-1 text-kid-xs font-bold tabular-nums text-warn"
              aria-label={t('game.streakLabel', { count: state.streak })}
            >
              <span aria-hidden="true">🔥</span>
              {state.streak}
            </span>
          )}

          <span className="shrink-0 text-kid-xs font-bold tabular-nums text-ink-soft">
            {t('game.roundOf', { current: roundNumber, total: state.totalRounds })}
          </span>
        </div>

        <ProgressDots
          value={state.index}
          total={state.totalRounds}
          label={t('game.roundOf', { current: roundNumber, total: state.totalRounds })}
        />
      </div>

      {/* --- Nội dung game ------------------------------------------------- */}
      <div className="flex flex-col gap-4">{children}</div>

      {/* --- Nút phụ của game (Nghe lại...) -------------------------------- */}
      {footer && <div className="flex flex-col gap-3">{footer}</div>}
    </div>
  );
}
