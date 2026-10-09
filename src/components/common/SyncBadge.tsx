/**
 * RubyLingo — `SyncBadge`: trạng thái đồng bộ tiến độ lên server.
 *
 * ⭐ VÌ SAO PHẢI HIỆN TRẠNG THÁI NÀY CHO NGƯỜI DÙNG:
 *   App hoạt động được cả khi mất mạng (tiến độ ghi vào hàng đợi trong máy rồi đẩy lên sau).
 *   Đó là điểm mạnh — nhưng nếu KHÔNG hiện gì, phụ huynh mở app trên máy khác thấy thiếu tiến
 *   độ và kết luận "app mất dữ liệu". Một biểu tượng nhỏ giải thích đúng chuyện đang xảy ra thì
 *   không ai phải đoán.
 *
 * ⭐ TÔNG GIỌNG KHI LỖI — QUAN TRỌNG:
 *   Bé có thể là người nhìn thấy badge này. Trạng thái thất bại KHÔNG được dùng màu đỏ báo
 *   động hay biểu tượng cảnh báo: mất mạng không phải lỗi của bé, và dữ liệu không mất. Dùng
 *   màu cam + câu trấn an ("đã được lưu và sẽ đồng bộ lại sau").
 *
 * ⚠️ `SyncStatus` ĐƯỢC KHAI Ở `SyncService`, KHÔNG Ở ĐÂY.
 *   Trạng thái đồng bộ là dữ liệu của tầng DỊCH VỤ; component chỉ vẽ nó. Khi kiểu sống ở
 *   file component, tầng dịch vụ buộc phải import ngược lên tầng giao diện — và đó là chiều
 *   phụ thuộc sai, sớm muộn dẫn tới vòng import.
 */

import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/cn.js';
import type { SyncStatus } from '../../services/SyncService.js';

export type { SyncStatus };

export interface SyncBadgeProps {
  status: SyncStatus;
  /** Số thay đổi đang chờ đẩy lên. Hiện kèm khi `status === 'pending'`. */
  pendingCount?: number;
  className?: string;
}

export function SyncBadge({ status, pendingCount, className }: SyncBadgeProps) {
  const { t } = useTranslation();

  // `idle` = không có gì để nói ⇒ không vẽ gì. Một biểu tượng "đang rảnh" chỉ làm rối màn hình.
  if (status === 'idle') return null;

  const { icon, text, tone } = describe(status, pendingCount, t);

  return (
    <span
      // `status` (live region, polite) để trình đọc màn hình báo khi đồng bộ xong — nhưng chỉ
      // khi nội dung THAY ĐỔI, nên không gây ồn ào.
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-kid-xs',
        tone,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('text-[16px] leading-none', status === 'syncing' && 'animate-spin')}
      >
        {icon}
      </span>
      <span className="font-bold">{text}</span>
    </span>
  );
}

function describe(
  status: Exclude<SyncStatus, 'idle'>,
  pendingCount: number | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): { icon: string; text: string; tone: string } {
  switch (status) {
    case 'syncing':
      return { icon: '🔄', text: t('error.syncPending'), tone: 'border-line bg-surface-raised text-ink-soft' };
    case 'synced':
      return { icon: '✅', text: t('error.syncDone'), tone: 'border-line bg-surface-raised text-success' };
    case 'pending':
      return {
        icon: '☁️',
        text:
          typeof pendingCount === 'number' && pendingCount > 0
            ? `${t('error.syncPending')} (${pendingCount})`
            : t('error.syncPending'),
        tone: 'border-line bg-surface-raised text-ink-soft',
      };
    case 'failed':
      // Cam, KHÔNG đỏ. Câu chữ trấn an — xem ghi chú đầu file.
      return { icon: '☁️', text: t('error.syncFailed'), tone: 'border-warn bg-surface-sunken text-warn-ink' };
  }
}
