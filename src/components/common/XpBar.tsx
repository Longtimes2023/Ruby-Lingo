/**
 * RubyLingo — `XpBar`: thanh XP + cấp Nhà thám hiểm.
 *
 * ⭐ VÌ SAO HIỆN TÊN CẤP CHỨ KHÔNG CHỈ HIỆN SỐ:
 *   "Lv.3" không nói lên điều gì với bé 7 tuổi. "Người chăm vườn thú 🧺" thì bé hiểu ngay và
 *   kể được với bố mẹ. Danh hiệu là phần thưởng tinh thần — nó phải nhìn thấy được, không chỉ
 *   là một con số tăng dần.
 *
 * ⭐ VÌ SAO LUÔN HIỆN "CÒN BAO NHIÊU NỮA":
 *   Một thanh tiến độ không có đích cụ thể gây hụt hẫng. Bé cần biết "còn 1 bài nữa là lên
 *   cấp" để có lý do bắt đầu bài tiếp theo. Đây là động lực, không phải áp lực — nên câu chữ
 *   không bao giờ mang tính thúc ép.
 */

import { useTranslation } from 'react-i18next';

import { getXpProgress } from '../../data/xp-levels.js';
import { cn } from '../../lib/cn.js';

export interface XpBarProps {
  /** Tổng XP tích luỹ. */
  xp: number;
  /**
   * `full`    — tên cấp + số cấp + thanh + câu "còn bao nhiêu nữa". Dùng ở hồ sơ, màn kết quả.
   * `compact` — icon + tên cấp + thanh. Dùng khi cần tiết kiệm chỗ nhưng vẫn muốn có chữ.
   * `strip`   — CHỈ thanh, cao 4px. Dùng ở mép dưới `TopBar`: luôn nhìn thấy tiến độ mà không
   *             tốn thêm một dòng nào trên màn hình điện thoại.
   */
  variant?: 'full' | 'compact' | 'strip';
  className?: string;
}

export function XpBar({ xp, variant = 'full', className }: XpBarProps) {
  const { t } = useTranslation();
  const progress = getXpProgress(xp);

  const ariaText = progress.next
    ? `${progress.level.title_vi}. ${t('kid.level')} ${progress.level.level}. Còn ${progress.xpRemaining} ${t('kid.xp')} để lên cấp ${progress.next.level}.`
    : `${progress.level.title_vi}. ${t('kid.level')} ${progress.level.level}. Đã đạt cấp cao nhất.`;

  // `strip` chỉ là một vạch — mọi nhãn chữ đều bỏ, chỉ còn ngữ nghĩa cho screen reader.
  if (variant === 'strip') {
    return (
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.xpForLevel || 1}
        aria-valuenow={progress.xpForLevel ? progress.xpIntoLevel : 1}
        aria-valuetext={ariaText}
        className={cn('h-1 w-full overflow-hidden bg-line', className)}
      >
        <div
          className="h-full bg-brand transition-[width] duration-500 ease-out"
          style={{ width: `${progress.ratio * 100}%` }}
        />
      </div>
    );
  }

  const compact = variant === 'compact';

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="shrink-0 text-[18px] leading-none">
          {progress.level.icon}
        </span>
        <span
          className={cn(
            'min-w-0 flex-1 truncate font-bold text-ink',
            compact ? 'text-kid-xs' : 'text-kid-sm',
          )}
        >
          {progress.level.title_vi}
        </span>
        {!compact && (
          <span className="shrink-0 text-kid-xs tabular-nums text-ink-faint">
            {t('kid.level')} {progress.level.level}
          </span>
        )}
      </div>

      <div
        // `progressbar` là role đúng ngữ nghĩa. `aria-valuetext` quan trọng hơn
        // `aria-valuenow` ở đây: "1500/1600" không nói được gì, còn câu đầy đủ thì có.
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.xpForLevel || 1}
        aria-valuenow={progress.xpForLevel ? progress.xpIntoLevel : 1}
        aria-valuetext={ariaText}
        className={cn(
          'mt-1.5 w-full overflow-hidden rounded-pill bg-line',
          compact ? 'h-2.5' : 'h-3.5',
        )}
      >
        <div
          className="h-full rounded-pill bg-brand transition-[width] duration-500 ease-out"
          style={{ width: `${progress.ratio * 100}%` }}
        />
      </div>

      {!compact && (
        <p className="mt-1.5 text-kid-xs text-ink-soft">
          {progress.next
            ? // Đây là ĐỘNG LỰC, không phải áp lực ⇒ câu khẳng định, không phải mệnh lệnh.
              `Còn ${progress.xpRemaining} ${t('kid.xp')} nữa là lên cấp ${progress.next.level} ${progress.next.icon}`
            : t('pet.maxStage')}
        </p>
      )}
    </div>
  );
}
