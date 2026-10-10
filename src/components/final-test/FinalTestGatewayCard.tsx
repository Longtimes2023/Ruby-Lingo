/**
 * RubyLingo — Thẻ "🎓 Khu vực thi" ở cuối BẢN ĐỒ HÀNH TRÌNH.
 *
 * ⭐ ĐÂY LÀ ĐIỂM VÀO DUY NHẤT của khu vực thi cuối khoá (KHÔNG có mục trong `BottomNav` — 5 mục
 *   là TRẦN của dự án). Thẻ này là một `<Link>` khi cổng đã mở, và một `<div>` khi chưa — vì
 *   "thẻ khoá không phải là link `disabled`" (cùng lý do đã ghi ở đầu `ThemeCard.tsx`): bấm vào
 *   rồi bị đuổi ra còn tệ hơn là không bấm được.
 *
 * ⚠️⚠️ BA TRẠNG THÁI, VÀ TRẠNG THÁI THỨ BA LÀ ĐIỀU QUAN TRỌNG NHẤT:
 *   · `ready` / `done` — cổng mở, thẻ là link.
 *   · `locked`         — cổng khoá, thẻ hiện RÕ còn thiếu gì (số bài / số game), bằng câu hướng
 *                        dẫn trẻ chứ không phải lời chê.
 *   · chưa biết (đang tải hoặc MẠNG LỖI) — thẻ ở trạng thái TRUNG TÍNH "Đang kiểm tra...", TUYỆT
 *                        ĐỐI KHÔNG nói bé còn thiếu gì. Mất mạng KHÔNG phải là "chưa học hết":
 *                        báo "còn 20 trò nữa" cho một bé đã chơi hết là MẮNG OAN.
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { FinalTestGateState } from '@shared/types/final-test.js';

import { cn } from '../../lib/cn.js';
import { finalTestHomePath } from '../../lib/paths.js';
import { finalTestRequirementText } from './gate.js';

export interface FinalTestGatewayCardProps {
  /** Trạng thái cổng + mỗi phần. `null` = CHƯA BIẾT (đang tải / mạng lỗi). */
  state: FinalTestGateState | null;
  className?: string;
}

export function FinalTestGatewayCard({ state, className }: FinalTestGatewayCardProps) {
  const { t } = useTranslation();

  const gate = state?.gate ?? null;
  const enterable = gate?.enterable === true;
  const known = gate !== null;

  const completedSections = (state?.sections ?? []).filter((section) => section.completed);
  const totalShields = completedSections.reduce((sum, section) => sum + (section.bestShields ?? 0), 0);

  /** Dòng trạng thái dưới tiêu đề + nhãn trạng thái — khác nhau theo TỪNG trạng thái cổng. */
  let statusText: string;
  let badge: { icon: string; label: string };
  if (!known || gate.kind === 'pending') {
    // Chưa biết HOẶC chưa đồng bộ xong ⇒ TRUNG TÍNH. Tuyệt đối không nói còn thiếu.
    statusText = t('finalTest.checking');
    badge = { icon: '⏳', label: t('finalTest.checking') };
  } else if (gate.kind === 'locked') {
    statusText = finalTestRequirementText(gate, t);
    badge = { icon: '🔒', label: t('finalTest.lockedTitle') };
  } else if (completedSections.length === 0) {
    statusText = t('finalTest.bestShieldsNone');
    badge = { icon: '🎓', label: t('finalTest.enter') };
  } else {
    statusText = t('finalTest.totalShields', { count: totalShields });
    badge = { icon: '🎓', label: t('finalTest.enter') };
  }

  const body = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'grid size-16 shrink-0 place-items-center rounded-kid border-2 text-[36px] leading-none',
          enterable ? 'border-brand-soft bg-brand-tint' : 'border-line bg-surface-raised',
        )}
      >
        🎓
      </span>

      <div className="min-w-0 flex-1">
        <h3 className="text-kid-lg leading-tight text-ink">{t('finalTest.title')}</h3>
        <p
          className={cn(
            'mt-1 text-kid-sm leading-snug',
            enterable || !known ? 'text-ink-soft' : 'text-ink-soft',
          )}
        >
          {statusText}
        </p>
        <span
          className={cn(
            'mt-2 inline-flex w-fit items-center gap-1.5 rounded-pill px-2.5 py-1 text-kid-xs font-bold',
            enterable ? 'bg-brand-soft text-brand' : 'bg-surface-sunken text-ink-faint',
          )}
        >
          <span aria-hidden="true" className="text-[16px] leading-none">
            {badge.icon}
          </span>
          {badge.label}
        </span>
      </div>
    </>
  );

  const cardClass = cn(
    'flex items-center gap-4 rounded-card border-2 p-4 transition duration-kid',
    enterable
      ? 'border-brand bg-gradient-to-r from-brand-tint to-surface shadow-kid hoverable:-translate-y-0.5 hoverable:shadow-brand active:translate-y-[1px] active:shadow-none'
      : 'border-dashed border-line bg-surface-raised',
    className,
  );

  if (!enterable) {
    // Thẻ khoá / chưa biết: KHÔNG phải link (xem ghi chú đầu file).
    return <div className={cardClass}>{body}</div>;
  }

  return (
    <Link to={finalTestHomePath()} aria-label={t('finalTest.enterLabel')} className={cardClass}>
      {body}
    </Link>
  );
}
