/**
 * RubyLingo — `NotFoundPage`: màn hình khi đường dẫn không tồn tại.
 *
 * ⭐ VÌ SAO KHÔNG PHẢI "404 Not Found":
 *   Bé có thể gõ nhầm địa chỉ, hoặc bấm vào một liên kết cũ. Chuỗi "404" không nói được gì với
 *   bé 7 tuổi, và còn làm bé tưởng mình vừa làm sai điều gì. Màn hình này LUÔN đưa ra một lối
 *   thoát rõ ràng — bé không bao giờ bị mắc kẹt.
 *
 * ⭐ VÌ SAO CÓ HAI LỐI THOÁT KHÁC NHAU:
 *   Người vào đây thường là PHỤ HUYNH (gõ nhầm địa chỉ trên máy tính), không phải bé. Phụ huynh
 *   cần một nút "Về trang chủ" để tiếp tục công việc; bé đang cầm iPad thì cần một cái gì đó
 *   to, dễ bấm, và thân thiện. Một nút duy nhất phải phục vụ hai đối tượng rất khác nhau nên
 *   sẽ không phục vụ tốt ai cả.
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { BrandLogo } from '../BrandLogo.js';
import { BigButton } from './BigButton.js';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col items-center justify-center gap-5 p-6 text-center">
      {/* Logo thay cho con số 404: hình ảnh quen thuộc giúp bé hiểu "vẫn đang ở trong app". */}
      <BrandLogo size={88} decorative />

      <h1 className="text-kid-xl text-brand">Trang này không có ở đây</h1>

      <p className="text-kid-md text-ink-soft">
        Có thể bố mẹ gõ nhầm địa chỉ. Bé đừng lo nhé, mình quay về Nhà Vườn Thú thôi!
      </p>

      <Link to="/" className="w-full">
        <BigButton size="lg" variant="primary" icon="🏠">
          Về trang chủ
        </BigButton>
      </Link>

      <Link
        to="/login"
        className="text-kid-sm font-bold text-ink-soft underline decoration-2 underline-offset-4"
      >
        {t('auth.login')}
      </Link>
    </main>
  );
}
