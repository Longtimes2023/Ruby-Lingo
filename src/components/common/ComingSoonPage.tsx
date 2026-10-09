/**
 * RubyLingo — `ComingSoonPage`: màn hình tạm cho những khu vực chưa làm xong.
 *
 * ⭐ VÌ SAO CẦN, THAY VÌ ĐỂ ĐƯỜNG DẪN ĐÓ RƠI VÀO TRANG 404:
 *   `BottomNav` đã có 4 mục, và bé sẽ bấm vào đủ cả 4 ngay trong buổi đầu. Nếu ba trong bốn mục
 *   dẫn tới "Trang này không có ở đây", bé học được rằng các nút đó là hỏng — và sẽ ngừng bấm.
 *   Một màn hình nói rõ "sắp mở" giữ đúng lời hứa: nút có thật, chỉ là chưa tới lúc.
 *
 * ⚠️ ĐÂY LÀ MÀN HÌNH TẠM — sẽ bị thay khi các nhóm sau vào:
 *   `/parent` → Nhóm 11 (Khu vực phụ huynh, T072–T074)
 *
 * ✅ `/collection` ĐÃ ĐƯỢC THAY bằng `CollectionPage` ở T070 (Bộ sưu tập huy hiệu / sticker).
 * ✅ `/pet` ĐÃ ĐƯỢC THAY bằng `PetHousePage` ở T064 (Nhà thú cưng + cửa hàng). Nếu còn thấy
 *    "Nhà thú cưng sắp mở" ở đâu đó thì đó là một bản sao cũ chưa xoá — không phải trạng thái
 *    mong muốn.
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { BigButton } from './BigButton.js';
import { EmptyState } from './EmptyState.js';

export interface ComingSoonPageProps {
  /** Emoji lớn — nên trùng với icon của mục trong `BottomNav` để bé nhận ra mình vừa bấm gì. */
  icon: string;
  title: string;
  description: string;
}

export function ComingSoonPage({ icon, title, description }: ComingSoonPageProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center gap-4 pt-4">
      <EmptyState icon={icon} title={title} description={description} />

      <Link to="/" className="w-full max-w-[360px]">
        <BigButton variant="secondary" icon="🗺️">
          {t('nav.backToLearn')}
        </BigButton>
      </Link>
    </div>
  );
}
