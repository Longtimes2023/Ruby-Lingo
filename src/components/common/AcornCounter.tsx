/**
 * RubyLingo — `AcornCounter`: bộ đếm 🌰 Hạt dẻ.
 *
 * Hạt dẻ là tiền tệ HIẾM: chỉ kiếm được từ cột mốc và nhiệm vụ tuần, dùng để mua vật phẩm
 * đặc biệt. Vì hiếm nên phải hiển thị RIÊNG, không gộp vào sao — nếu gộp, bé sẽ tiêu hết
 * hạt dẻ mà không nhận ra mình vừa mất thứ khó kiếm.
 *
 * Đây là bộ đếm MỚI so với bản kế hoạch đầu (T029 ghi rõ "AcornCounter (mới)").
 */

import { useTranslation } from 'react-i18next';

import { CounterChip } from './CounterChip.js';

export interface AcornCounterProps {
  value: number;
  /** Chưa tải xong dữ liệu ví ⇒ hiện "—" thay vì số. Xem ghi chú ở `CounterChip`. */
  pending?: boolean;
  className?: string;
}

export function AcornCounter({ value, pending = false, className }: AcornCounterProps) {
  const { t } = useTranslation();
  return (
    <CounterChip
      icon="🌰"
      value={value}
      label={t('kid.acorns')}
      pending={pending}
      toneClass="text-acorn"
      className={className}
    />
  );
}
