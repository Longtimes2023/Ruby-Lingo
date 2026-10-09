/**
 * RubyLingo — `StreakFlame`: chuỗi ngày học liên tiếp (🔥).
 *
 * ⭐ VÌ SAO KHÔNG BAO GIỜ HIỆN "0 🔥":
 *   Chuỗi ngày là cơ chế tạo thói quen, nhưng nó cũng là cơ chế DUY NHẤT trong app này có thể
 *   khiến bé cảm thấy có lỗi (vì bé đã "làm đứt" chuỗi). Hiện "0" to đùng là một lời trách móc
 *   bằng hình ảnh. Thay vào đó: khi chuỗi bằng 0, ngọn lửa mờ đi và KHÔNG có con số — chỉ còn
 *   một lời mời nhẹ nhàng. Bé quay lại sau một tuần nghỉ vẫn thấy app đang chờ mình, không phải
 *   đang tính sổ.
 *
 * ⭐ MỐC QUÀ 3 / 7 / 14 / 30 NGÀY:
 *   Chuỗi vô hạn thì không có đích để phấn đấu. Hiện "còn 2 ngày nữa tới mốc 7 ngày" biến một
 *   con số trừu tượng thành mục tiêu cụ thể mà bé hình dung được.
 */

import { useTranslation } from 'react-i18next';

import { STREAK_MILESTONES } from '@shared/constants.js';

import { cn } from '../../lib/cn.js';

export interface StreakFlameProps {
  /** Số ngày học liên tiếp hiện tại. */
  currentStreak: number;
  /** `true` = chỉ hiện lửa + số, dùng trong TopBar. */
  compact?: boolean;
  /**
   * Chưa tải xong dữ liệu.
   *
   * ⚠️ Phải phân biệt với chuỗi = 0: "chưa biết" và "biết là bằng 0" là hai chuyện khác nhau.
   *   Nếu gộp, một bé đang có chuỗi 12 ngày sẽ thấy app nói "học hôm nay để bắt đầu chuỗi" trong
   *   lúc dữ liệu đang tải — vừa sai vừa làm bé tưởng mình đã mất chuỗi.
   */
  pending?: boolean;
  className?: string;
}

/** Mốc kế tiếp chưa đạt, hoặc `null` nếu đã vượt mốc cao nhất. */
function nextMilestone(streak: number): number | null {
  return STREAK_MILESTONES.find((m) => m > streak) ?? null;
}

export function StreakFlame({
  currentStreak,
  compact = false,
  pending = false,
  className,
}: StreakFlameProps) {
  const { t } = useTranslation();

  // Chuỗi âm hoặc không phải số đều quy về 0 — dữ liệu xấu không được tạo ra giao diện lạ.
  const streak = Number.isFinite(currentStreak) ? Math.max(0, Math.trunc(currentStreak)) : 0;
  const hasStreak = streak > 0 && !pending;
  const milestone = nextMilestone(streak);

  const ariaLabel = pending
    ? `${t('kid.streak')}: đang tải`
    : hasStreak
      ? `${t('kid.streak')}: ${streak} ${t('kid.days')}`
      : `${t('kid.streak')}: ${t('kid.streakStart')}`;

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={cn(
        // Cỡ co theo màn hình — cùng lý do như `CounterChip`, xem ghi chú ở đó.
        'inline-flex items-center gap-1 rounded-pill border border-line px-2.5 py-1',
        'sm:gap-1.5 sm:px-3',
        hasStreak ? 'bg-surface-raised' : 'bg-surface-sunken',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('text-[18px] leading-none sm:text-[20px]', !hasStreak && 'opacity-30 grayscale')}
      >
        🔥
      </span>

      {hasStreak ? (
        <span className="text-kid-xs font-bold tabular-nums text-warn-ink sm:text-kid-sm">
          {streak}
        </span>
      ) : (
        // Không có con số nào cả — xem ghi chú đầu file.
        <span className="text-kid-xs text-ink-faint">
          {compact || pending ? '—' : t('kid.streakStart')}
        </span>
      )}

      {!compact && hasStreak && milestone !== null && (
        <span className="text-kid-xs text-ink-faint">
          · còn {milestone - streak} {t('kid.days')} tới mốc {milestone}
        </span>
      )}
    </span>
  );
}
