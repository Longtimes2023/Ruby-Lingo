/**
 * RubyLingo — `RewardBurst`: màn hình ăn mừng khi bé nhận phần thưởng.
 *
 * ⭐ VÌ SAO PHẢI HIỆN RÕ "VỪA NHẬN ĐƯỢC GÌ":
 *   Phần thưởng im lặng (chỉ thấy số sao ở góc tăng lên) không tạo được cảm giác được thưởng.
 *   Bé cần một khoảnh khắc: "con vừa được 5 ⭐ và 1 🌰". Đây là phần "trả công" về mặt cảm xúc
 *   cho nỗ lực bé vừa bỏ ra, và là lý do bé muốn quay lại lần sau.
 *
 * ⚠️ BA RÀNG BUỘC BẮT BUỘC:
 *   1. KHÔNG tự tắt quá nhanh. 2,6 giây là quá ngắn để một bé 7 tuổi đọc xong "Bé vừa nhận
 *      được Huy hiệu mới". Mặc định 4 giây, và luôn có nút/chạm để tự tắt sớm — bé nào đọc
 *      nhanh thì không phải chờ.
 *   2. Chạm ở BẤT KỲ ĐÂU cũng tắt. Bé sẽ chạm vào chỗ nào tiện tay, không nhất thiết trúng nút.
 *   3. Có đường đọc cho screen reader. Hiệu ứng hình ảnh không đọc được, nên phải có một
 *      `role="status"` đọc đúng nội dung phần thưởng.
 *
 * ⭐ TÁCH KHỎI NGHIỆP VỤ:
 *   Component này KHÔNG biết tên huy hiệu/vật phẩm. Nó nhận `resolveLabel` từ bên ngoài; Nhóm 6
 *   sẽ truyền vào hàm tra tên thật. Nhờ vậy nhóm UI không phải phụ thuộc vào registry huy hiệu
 *   (chưa tồn tại), mà khi nó vào thì chỉ cần truyền thêm một prop.
 */

import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import type { RewardGrant } from '@shared/types/reward.js';

import { cn } from '../../lib/cn.js';
import { StarBurst } from './StarBurst.js';

/** Icon + nhãn dự phòng cho từng loại phần thưởng. */
const REWARD_META: Record<RewardGrant['kind'], { icon: string; label: string }> = {
  stars: { icon: '⭐', label: 'Sao' },
  acorns: { icon: '🌰', label: 'Hạt dẻ' },
  xp: { icon: '✨', label: 'Điểm kinh nghiệm' },
  badge: { icon: '🏅', label: 'Huy hiệu mới' },
  sticker: { icon: '🎨', label: 'Sticker mới' },
  item: { icon: '🎁', label: 'Vật phẩm mới' },
};

/** Tiền tệ hiện kèm số lượng ("+5 ⭐"); huy hiệu/vật phẩm chỉ hiện tên. */
const SHOWS_AMOUNT: ReadonlySet<RewardGrant['kind']> = new Set(['stars', 'acorns', 'xp']);

export interface RewardBurstProps {
  /** Danh sách phần thưởng. `null` hoặc mảng rỗng ⇒ không hiện gì. */
  rewards: readonly RewardGrant[] | null;
  /** Gọi khi bé chạm để tắt, hoặc khi hết thời gian tự tắt. */
  onDismiss: () => void;
  /** Tiêu đề tuỳ biến. Mặc định lấy từ từ điển (`reward.levelUp`). */
  title?: string;
  /** Tự tắt sau bao lâu, ms. Mặc định 4000 — xem ghi chú đầu file. */
  autoDismissMs?: number;
  /**
   * Tra tên hiển thị cho `refId` (huy hiệu / sticker / vật phẩm).
   * Không truyền ⇒ dùng nhãn dự phòng trong `REWARD_META`.
   */
  resolveLabel?: (grant: RewardGrant) => string | null;
  /**
   * Tra ICON hiển thị cho `refId` (huy hiệu / sticker / vật phẩm).
   * Không truyền ⇒ dùng icon dự phòng trong `REWARD_META`.
   *
   * ⭐ CÙNG LÝ DO NHƯ `resolveLabel`, VÀ CẦN CHO ĐÚNG MỘT VIỆC (T069.2): icon DỰ PHÒNG của
   *   sticker là 🎨 (một cái bảng pha màu) — nhưng cả ý nghĩa của sticker là *"mở ra mới biết là
   *   con gì"*. Bé vừa mở được con Voi mà màn hình chỉ hiện 🎨 thì bé KHÔNG biết mình vừa được
   *   con gì, và khoảnh khắc "mở quà" mất hết. Người gọi có danh mục (`stickers.json`) nên tra
   *   được icon thật; component này thì không, nên nó nhận qua prop — y như `resolveLabel`.
   */
  resolveIcon?: (grant: RewardGrant) => string | null;
  className?: string;
}

export function RewardBurst({
  rewards,
  onDismiss,
  title,
  autoDismissMs = 4000,
  resolveLabel,
  resolveIcon,
  className,
}: RewardBurstProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();

  const visible = rewards !== null && rewards.length > 0;

  useEffect(() => {
    if (!visible) return;
    // `onDismiss` được gọi đúng một lần cho mỗi lần hiện. Phụ thuộc vào `rewards` (mảng mới
    // mỗi lần đổi) chứ không phải `visible`, để lần hiện thứ hai cũng có đồng hồ riêng.
    const timer = window.setTimeout(onDismiss, autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [visible, rewards, autoDismissMs, onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="reward-burst"
          // `role="status"` + `aria-live`: screen reader đọc nội dung phần thưởng ngay khi hiện.
          role="status"
          aria-live="polite"
          // Chạm ở đâu cũng tắt — xem ràng buộc 2 ở đầu file.
          onClick={onDismiss}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.18 }}
          className={cn(
            // `fixed inset-0` + `z-overlay` (60): che cả TopBar và BottomNav — đây là khoảnh
            // khắc riêng của bé, không nên tranh chấp với điều hướng.
            'fixed inset-0 z-overlay flex items-center justify-center bg-scrim p-5 backdrop-blur-sm',
            className,
          )}
        >
          {/* Chùm hạt bung ra phía sau tấm thẻ — `absolute inset-0` nên cần cha `relative`. */}
          <div className="relative flex w-full max-w-[420px] items-center justify-center">
            <StarBurst burstKey={visible ? rewards.length + rewards[0]!.kind : null} count={14} />

            <motion.div
              initial={reduceMotion ? false : { scale: 0.7, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 20 }}
              className="relative w-full rounded-kid border-4 border-brand bg-surface p-6 text-center shadow-pop"
            >
              <h2 className="text-kid-xl text-brand">{title ?? t('reward.levelUp')}</h2>

              <ul className="mt-4 flex flex-col gap-3">
                {rewards.map((grant, index) => {
                  const meta = REWARD_META[grant.kind];
                  const label = resolveLabel?.(grant) ?? meta.label;
                  // Icon tra được từ danh mục (sticker thật) thắng icon dự phòng — xem `resolveIcon`.
                  const icon = resolveIcon?.(grant) ?? meta.icon;
                  return (
                    <motion.li
                      key={`${grant.kind}-${grant.refId ?? index}`}
                      initial={reduceMotion ? false : { opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      // Hiện lần lượt từng phần thưởng: mắt bé theo kịp, thay vì bốn thứ cùng
                      // xuất hiện một lúc rồi không đọc được cái nào.
                      transition={{ delay: reduceMotion ? 0 : 0.12 * index + 0.1 }}
                      className="flex items-center justify-center gap-3 text-kid-lg font-bold"
                    >
                      <span aria-hidden="true" className="text-[32px] leading-none">
                        {icon}
                      </span>
                      <span>
                        {SHOWS_AMOUNT.has(grant.kind) && typeof grant.amount === 'number'
                          ? `+${grant.amount} ${label}`
                          : label}
                      </span>
                    </motion.li>
                  );
                })}
              </ul>

              <p className="mt-5 text-kid-xs text-ink-faint">{t('effects.tapToContinue')}</p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
