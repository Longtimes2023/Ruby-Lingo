/**
 * RubyLingo — `StarCounter`: bộ đếm ⭐ Sao.
 *
 * Sao là tiền tệ PHỔ THÔNG: kiếm nhanh, tiêu hằng ngày (đồ ăn cho thú cưng, phụ kiện rẻ).
 * Bé nhìn thấy nó ở gần như mọi màn hình nên nó phải gọn và không gây ồn ào thị giác.
 */

import { useTranslation } from 'react-i18next';

import { CounterChip } from './CounterChip.js';

export interface StarCounterProps {
  value: number;
  /** Chưa tải xong dữ liệu ví ⇒ hiện "—" thay vì số. Xem ghi chú ở `CounterChip`. */
  pending?: boolean;
  className?: string;
}

export function StarCounter({ value, pending = false, className }: StarCounterProps) {
  const { t } = useTranslation();
  // ⚠️ `text-star-ink`, KHÔNG phải `text-star`. Bản gốc dùng `--c-star` (#f59e0b) và ghi chú
  // ở đây từng nói "đủ tương phản trên nền sáng" — SAI: đo trên trình duyệt thật chỉ được
  // **2,15:1**, trượt ngưỡng AA 4,5:1. `--c-star-ink` (#9a5a08) đo được 5,47:1 mà vẫn giữ
  // đúng sắc hổ phách. Con số này đổi theo bảng màu, nên đừng chép vào test.
  return (
    <CounterChip
      icon="⭐"
      value={value}
      label={t('kid.stars')}
      pending={pending}
      toneClass="text-star-ink"
      className={className}
    />
  );
}
