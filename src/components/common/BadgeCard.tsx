/**
 * RubyLingo — `BadgeCard`: một Ô trong Bộ sưu tập (T070) — một HUY HIỆU hoặc một STICKER.
 *
 * ⭐ MỘT THẺ CHO CẢ HAI BỘ SƯU TẬP, VÀ ĐÓ LÀ CHỦ Ý:
 *   Huy hiệu và sticker chia sẻ đúng ba thứ mà thẻ này cần: `id`, `name_vi`, `icon`, cùng một
 *   trạng thái "đã có hay chưa". Tách ra hai component sẽ nhân đôi LUẬT KHÓ NHẤT của màn hình —
 *   "ô chưa có thì không được để lộ hình thật" — và hai bản sao của một luật thì có ngày lệch
 *   nhau, đúng ở chỗ không ai kiểm.
 *
 * ⭐ Ô CHƯA CÓ: HÌNH BỊ THAY BẰNG `?`, KHÔNG PHẢI CHỈ LÀM MỜ.
 *   Làm mờ (`opacity` + `grayscale`) vẫn để emoji THẬT nằm trong DOM. Trên màn hình nhỏ, một
 *   emoji chỉ hơi mờ vẫn đọc ra được — và khi ấy phần thưởng tương lai mất hết bất ngờ, đúng thứ
 *   `stickers.json` gọi là "phần thưởng biến thiên: bé mở ra mới biết là con gì". Nên ô chưa có
 *   KHÔNG chứa emoji thật; nó chứa dấu `?`. Không có gì để lộ. Test chống hồi quy ở
 *   `tests/unit/client/collection-page.test.tsx` khẳng định `queryByText(icon)` là `null`.
 *
 * ⭐ CHỮ TRÊN Ô CHƯA CÓ LÀ TRUNG TÍNH VÀ HƯỚNG TƯƠNG LAI ("Sắp có rồi!").
 *   ⚠️ LUẬT SỐ 1 CỦA DỰ ÁN: KHÔNG BAO GIỜ MẮNG TRẺ. "chưa đạt" / "kém" là những từ bị cấm.
 *   Một ô trống phải là một LỜI HẸN, không phải một LỜI CHÊ. Cùng luật với `ShopItemCard`
 *   ("Mình cùng học thêm nhé!" khi thiếu ⭐).
 *
 * ⚠️ EMOJI `aria-hidden` + NHÃN ĐỌC Ở CẢ THẺ:
 *   Bé khiếm thị không thấy hình. Nếu thẻ chỉ có emoji `aria-hidden` thì bé nghe được đúng một
 *   dấu `?` vô nghĩa. Nhãn `role="img"` vì thế NÓI RA cả tên và trạng thái
 *   ("Bước đầu tiên: đã đạt" · "Voi con: Sắp có rồi!") — cùng cách `PetAvatar` làm.
 */

import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/cn.js';

/**
 * Phần định nghĩa tối thiểu mà thẻ cần.
 *
 * ⚠️ Cố ý KHÔNG import thẳng `Badge`/`StickerDefinition`: thẻ này chỉ dùng ba trường chung, và
 *    nhận đúng ba trường ấy cho phép truyền cả `Badge` lẫn `StickerDefinition` mà không phải
 *    ép kiểu. `description_vi` để TUỲ CHỌN vì chỉ huy hiệu có "cách kiếm"; sticker là phần
 *    thưởng biến thiên nên không có mô tả.
 */
export interface CollectionItemDefinition {
  id: string;
  name_vi: string;
  icon: string;
  /** Mô tả ngắn cách kiếm — chỉ huy hiệu có. Sticker không có. */
  description_vi?: string;
}

export interface BadgeCardProps {
  item: CollectionItemDefinition;
  /** Bé đã có huy hiệu/sticker này chưa — quyết định hình và chữ. */
  earned: boolean;
  className?: string;
}

export function BadgeCard({ item, earned, className }: BadgeCardProps) {
  const { t } = useTranslation();

  /**
   * Trạng thái đọc lên. ⚠️ KHÔNG dùng "chưa đạt" cho nhánh `false` — đó là từ bị cấm; dùng câu
   * hướng tương lai.
   */
  const status = earned ? t('reward.earned') : t('reward.upcoming');

  return (
    <div
      // `role="img"` gộp cả thẻ thành MỘT đối tượng có tên cho trình đọc màn hình — con của nó
      // bị coi là trang trí, nên emoji `aria-hidden` bên trong không bị đọc rời rạc.
      role="img"
      aria-label={t('reward.itemAria', { name: item.name_vi, status })}
      className={cn(
        'flex h-full flex-col items-center gap-2 rounded-card border-2 p-3 text-center',
        // Đã có: viền + nền nhấn (dấu hiệu thị giác thứ hai, để bé nhận ra mà không phải đọc chữ).
        // Chưa có: viền xám trung tính, KHÔNG dùng màu báo lỗi — trống không phải là sai.
        earned ? 'border-brand bg-brand-tint' : 'border-line bg-surface-raised',
        className,
      )}
    >
      {earned ? (
        // Icon ĐẦY MÀU khi đã có. `aria-hidden` — nhãn của thẻ đã nói tên rồi.
        <span aria-hidden="true" className="text-[48px] leading-none">
          {item.icon}
        </span>
      ) : (
        // Ô "bí mật": dấu `?` thay cho emoji THẬT — xem ghi chú đầu tệp về lý do không chỉ làm mờ.
        <span
          aria-hidden="true"
          className="flex size-[48px] items-center justify-center rounded-pill bg-surface-sunken text-kid-lg font-bold leading-none text-ink-faint"
        >
          ?
        </span>
      )}

      {/* Tên VẪN hiện ở cả hai trạng thái: bé cần biết mình SẼ kiếm được gì, không phải đoán. */}
      <p className={cn('text-kid-sm font-bold', earned ? 'text-ink' : 'text-ink-soft')}>
        {item.name_vi}
      </p>

      {/* "Cách kiếm" — chỉ huy hiệu có. Với ô chưa có, đây chính là lời mời hướng tới tương lai. */}
      {item.description_vi !== undefined && (
        <p className="text-kid-xs text-ink-faint">{item.description_vi}</p>
      )}

      {/* Lời hẹn cho ô chưa có — TRUNG TÍNH và HƯỚNG TƯƠNG LAI, không phải lời chê. */}
      {!earned && <p className="text-kid-xs font-semibold text-brand">{t('reward.upcoming')}</p>}
    </div>
  );
}
