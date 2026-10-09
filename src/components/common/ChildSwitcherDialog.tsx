/**
 * RubyLingo — `ChildSwitcherDialog`: đổi hồ sơ bé đang học.
 *
 * ⭐ VÌ SAO CẦN, VÀ VÌ SAO NÓ NẰM Ở TẦNG KHUNG CHỨ KHÔNG Ở MỘT TRANG:
 *   Nhà có hai bé dùng chung một iPad là chuyện thường. Nếu việc đổi bé chỉ có ở một trang nào
 *   đó, bé sẽ học hết một bài rồi mới phát hiện đang ghi vào hồ sơ của em mình. Đổi bé phải làm
 *   được từ BẤT KỲ màn hình nào — nên nó thuộc về thanh trên cùng.
 *
 * ⭐ VÌ SAO CHỈ HIỆN KHI NHÀ CÓ TỪ 2 BÉ:
 *   Nhà một bé thì nút này không có gì để làm. Một nút bấm mở ra danh sách chỉ có một mục là
 *   ma sát vô nghĩa — bé bấm vào, thấy đúng cái tên của mình, rồi phải tự đóng lại.
 *
 * ⭐ DÙNG RADIX DIALOG: khoá tiêu điểm + `aria-modal` + đóng bằng Esc. Chi tiết đầy đủ ở
 *   ghi chú đầu `effects/UnlockOverlay.tsx` — cùng lý do.
 */

import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { getAvatar } from '../../data/avatars.js';
import { cn } from '../../lib/cn.js';
import { useSessionStore } from '../../store/sessionStore.js';

export interface ChildSwitcherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChildSwitcherDialog({ open, onOpenChange }: ChildSwitcherDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const children = useSessionStore((s) => s.children);
  const activeChildId = useSessionStore((s) => s.activeChildId);
  const setActiveChild = useSessionStore((s) => s.setActiveChild);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-overlay bg-scrim backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-overlay w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2',
            'rounded-kid border-2 border-line bg-surface p-5 shadow-pop focus:outline-none',
          )}
        >
          <Dialog.Title className="text-kid-lg text-ink">{t('child.switchChild')}</Dialog.Title>
          {/* Radix yêu cầu có Description, hoặc phải khai báo tường minh là không có. Ở đây
              tiêu đề đã đủ rõ nên khai báo "không có mô tả" thay vì viết một câu thừa. */}
          <Dialog.Description className="sr-only-kid">
            {t('child.switchChild')}
          </Dialog.Description>

          <ul className="mt-4 flex flex-col gap-2">
            {children.map((child) => {
              const avatar = getAvatar(child.avatarId);
              const active = child.id === activeChildId;
              return (
                <li key={child.id}>
                  <button
                    type="button"
                    // `aria-current` là cách đúng để báo "đây là mục đang chọn" trong một danh
                    // sách lựa chọn — `aria-pressed` dành cho nút bật/tắt.
                    aria-current={active ? 'true' : undefined}
                    onClick={() => {
                      setActiveChild(child.id);
                      // Đóng ngay sau khi chọn: bé vừa bày ý định rõ ràng, giữ hộp thoại lại
                      // chỉ bắt bé thêm một thao tác nữa.
                      onOpenChange(false);
                    }}
                    className={cn(
                      'flex w-full min-h-touch items-center gap-3 rounded-kid border-2 px-4 text-left',
                      active
                        ? 'border-brand bg-brand-soft font-bold text-brand'
                        : 'border-line bg-surface-raised text-ink',
                    )}
                  >
                    <span aria-hidden="true" className="text-[28px] leading-none">
                      {avatar?.icon ?? '🐾'}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-kid-md">{child.nickname}</span>
                    {active && (
                      // Dấu ✓ là tầng phân biệt thứ hai ngoài màu — cần thiết vì bé có thể không
                      // phân biệt được màu (mù màu) hoặc màn hình đang bị chói nắng.
                      <span aria-hidden="true" className="shrink-0 text-kid-md text-brand">
                        ✓
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <Dialog.Close asChild>
            <button
              type="button"
              className="mt-4 min-h-touch w-full rounded-kid border-2 border-line bg-surface text-kid-md font-bold text-ink-soft"
            >
              {t('app.close')}
            </button>
          </Dialog.Close>

          {/*
            ⭐ LỐI VÀO KÍN ĐÁO SANG KHU VỰC PHỤ HUYNH (task #28) — CHỈ ĐIỀU HƯỚNG, KHÔNG hỏi PIN.

            Vì sao không đặt nút "Sửa/Xoá hồ sơ" ngay ở đây: sửa và xoá hồ sơ bé là việc QUẢN TRỊ, mà
            quản trị phải nằm SAU cổng PIN. Đặt chúng ở đây sẽ buộc phải dựng một UI nhập PIN thứ hai
            — và hai UI cổng là hai chỗ để lệch nhau (một chỗ quên kiểm, một chỗ lộ trạng thái).
            Nên ở đây chỉ có một lối đi; cổng nằm ở đúng một chỗ: khu vực phụ huynh.

            Vẫn giữ ĐỔI hồ sơ (switch) ở lại đây vì đó là việc BÌNH THƯỜNG của bé, không cần cổng.
          */}
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              navigate('/parent');
            }}
            className="mt-2 min-h-touch w-full rounded-kid px-4 text-center text-kid-sm font-bold text-brand underline"
          >
            {t('parent.editProfilesInParentArea')}
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
