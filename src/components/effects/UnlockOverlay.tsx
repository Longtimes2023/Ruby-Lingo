/**
 * RubyLingo — `UnlockOverlay`: màn hình ăn mừng khi bé MỞ KHOÁ được thứ gì đó.
 *
 * ⭐ VÌ SAO TÁCH KHỎI `RewardBurst` THAY VÌ DÙNG CHUNG:
 *   Hai sự kiện này khác nhau về BẢN CHẤT, không chỉ về kích thước:
 *     • `RewardBurst`  = phần thưởng thường xuyên (⭐ sau mỗi câu). Tự tắt, không cần bé làm gì.
 *     • `UnlockOverlay`= cột mốc hiếm (mở chủ đề mới, mở huy hiệu). KHÔNG tự tắt — đây là thành
 *       tựu bé đã cố gắng nhiều ngày để đạt. Tự tắt đi sau 4 giây là làm nhẹ đi khoảnh khắc đó,
 *       và bé đang mải nhìn thì màn hình đã biến mất.
 *
 * ⭐ VÌ SAO DÙNG RADIX DIALOG CHỨ KHÔNG TỰ VẼ `<div className="fixed">`:
 *   Một lớp phủ toàn màn hình tự vẽ sẽ để tiêu điểm bàn phím Ở LẠI phía sau. Bé hoặc phụ huynh
 *   dùng phím Tab sẽ tab được vào những nút không nhìn thấy, và trình đọc màn hình vẫn đọc
 *   được nội dung phía sau lớp phủ. Radix lo đúng ba việc mà bản tự vẽ hay quên:
 *     • khoá tiêu điểm trong hộp thoại
 *     • `aria-modal` + ẩn phần còn lại khỏi trình đọc màn hình
 *     • đóng bằng phím Esc
 *
 * ⚠️ `forceMount` + `AnimatePresence`: Radix tự gỡ nội dung khỏi DOM ngay khi đóng, nên animation
 *    thoát của Framer Motion sẽ không bao giờ chạy. `forceMount` giữ nó lại cho tới khi animation
 *    xong — đây là cặp bài trùng kinh điển khi ghép Radix với Framer Motion.
 */

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';

import { cn } from '../../lib/cn.js';
import { BigButton } from '../common/BigButton.js';
import { StarBurst } from './StarBurst.js';

export interface UnlockOverlayProps {
  open: boolean;
  /** Emoji lớn hiện ở giữa — chủ đề, huy hiệu, hoặc linh vật vừa tiến hoá. */
  icon: string;
  /** Tiêu đề, ví dụ tên chủ đề vừa mở khoá. */
  title: string;
  /** Một câu mô tả ngắn. Bỏ trống nếu tiêu đề đã đủ rõ. */
  description?: string;
  /** Nhãn nút. Mặc định lấy `effects.tapToContinue`. */
  actionLabel?: string;
  /** Gọi khi bé bấm nút, bấm Esc, hoặc bấm ra ngoài. */
  onClose: () => void;
}

export function UnlockOverlay({
  open,
  icon,
  title,
  description,
  actionLabel,
  onClose,
}: UnlockOverlayProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
                className="fixed inset-0 z-overlay bg-scrim backdrop-blur-sm"
              />
            </Dialog.Overlay>

            {/*
              ⚠️⚠️ CĂN GIỮA BẰNG BỐ CỤC, KHÔNG BẰNG `transform` — xem ghi chú dài ở
              `LevelUpOverlay.tsx` (lỗi y hệt, đã đo được: thẻ lệch đúng một nửa chiều rộng và
              tràn ra ngoài mép phải, vì `transform` inline do Framer Motion ghi đè lớp
              `-translate-x-1/2 -translate-y-1/2` của Tailwind). Mọi cổng kiểm tĩnh đều mù với
              loại lỗi này — chỉ ảnh chụp render thật mới lộ.

              `pointer-events-none` ở lớp ngoài + `pointer-events-auto` ở thẻ: giữ nguyên hành vi
              "bấm ra ngoài để đóng".
            */}
            <div className="pointer-events-none fixed inset-0 z-overlay grid place-items-center p-4">
              <Dialog.Content asChild forceMount>
                <motion.div
                  initial={reduceMotion ? false : { scale: 0.8, y: 40, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { scale: 0.9, y: 20, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                  className={cn(
                    'pointer-events-auto w-[min(92vw,440px)]',
                    'rounded-kid border-4 border-star bg-surface p-6 text-center shadow-pop',
                    // `focus:outline-none`: hộp thoại tự nhận tiêu điểm khi mở, và vòng viền focus
                    // quanh cả hộp thoại trông như lỗi. Nút bên trong VẪN có vòng focus riêng.
                    'focus:outline-none',
                  )}
                >
                  {/* Chùm hạt phía sau icon. Cần cha `relative` nên bọc trong một lớp. */}
                  <div className="relative mx-auto flex size-[132px] items-center justify-center">
                    <StarBurst burstKey={open ? `unlock-${title}` : null} count={16} />
                    <span aria-hidden="true" className="text-[96px] leading-none">
                      {icon}
                    </span>
                  </div>

                  {/*
                  `Dialog.Title` là BẮT BUỘC về mặt kỹ thuật: Radix cảnh báo (và trình đọc màn
                  hình mất ngữ cảnh) nếu hộp thoại không có tiêu đề. Không được bỏ để thay bằng
                  `<h2>` thường.
                */}
                  <Dialog.Title className="mt-3 text-kid-xl text-brand">{title}</Dialog.Title>

                  {description && (
                    <Dialog.Description className="mt-2 text-kid-sm text-ink-soft">
                      {description}
                    </Dialog.Description>
                  )}

                  {/* `text-star-ink` (nâu hổ phách) chứ không phải `text-star`: kể cả khi đây là
                    chữ lớn 28px (ngưỡng AA nới còn 3:1), hổ phách tươi vẫn chỉ đạt 2,15:1. */}
                  <p className="mt-3 text-kid-lg font-bold text-star-ink">
                    {t('effects.unlocked')}
                  </p>

                  <Dialog.Close asChild>
                    <BigButton variant="primary" size="lg" className="mt-5">
                      {actionLabel ?? t('effects.tapToContinue')}
                    </BigButton>
                  </Dialog.Close>
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
