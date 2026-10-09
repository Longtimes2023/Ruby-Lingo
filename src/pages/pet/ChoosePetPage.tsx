/**
 * RubyLingo — `ChoosePetPage`: màn "Chọn bạn đồng hành" (T04, route `/pet/chon`).
 *
 * ⭐ VÌ SAO MÀN NÀY TỒN TẠI (điểm #2 chủ dự án báo):
 *   *"Thú cưng không cho các bé chọn à, mặc định là trứng."* Trước T04, mọi bé đều nhận một quả
 *   trứng 🥚 vô danh rồi mới "nở" thành con mặc định — bé không được chọn GÌ CẢ. Màn này trả lại
 *   cho bé quyền chọn con mình muốn đi cùng, và bậc tiến hoá đầu tiên nay là con bé đã chọn
 *   (`'baby'`, không còn `'egg'`).
 *
 * ⭐ VÌ SAO ĐỔI CON LÀ MIỄN PHÍ (không trừ ⭐/🌰/đồ/❤️):
 *   Đổi bạn đồng hành là ĐỔI HÌNH, không phải một giao dịch. `choosePetRequestSchema` cố ý KHÔNG
 *   có trường giá, và `RewardService.choosePet` không đụng ví/túi/❤️. Bắt bé trả tiền để đổi bạn,
 *   hoặc phạt bé vì đổi ý, là biến một lựa chọn vui thành một giao dịch có rủi ro — với một đứa
 *   trẻ 7 tuổi. Vì vậy ở đây KHÔNG có giá, KHÔNG có nút mờ vì thiếu tiền, KHÔNG giới hạn số lần.
 *
 * ⚠️ "ĐỂ SAU" LÀ `sessionStorage`, KHÔNG `localStorage`:
 *   Đây là "đừng hỏi lại trong PHIÊN này", không phải một cài đặt vĩnh viễn của bé. Ghi vào
 *   `localStorage` là biến một cú bấm "Để sau" thành "không bao giờ hỏi lại" — bé 7 tuổi có thể
 *   đã đổi ý, và lần sau mở app bé phải được mời chọn lại. Cờ này `PetHousePage` đọc trong
 *   `useEffect` để quyết định có tự mở màn này hay không.
 *
 * ⚠️ MỘT THẺ ĐƯỢC CHỌN TẠI MỘT THỜI ĐIỂM — `aria-pressed` đúng MỘT thẻ `true`:
 *   Dùng `<button aria-pressed>` chứ không `role="radio"`: một nhóm radio đúng chuẩn ARIA cần hợp
 *   đồng bàn phím (mũi tên để chuyển, roving tabindex) mà ta không cài — hứa với trình đọc màn
 *   hình một thứ không tồn tại là tệ hơn. Cùng khuôn mẫu với hàng nút nhóm ở `PetHousePage`.
 *
 * ⚠️ KHÔNG MỘT CHUỖI NÀO ĐƯỢC MẮNG TRẺ — kể cả trạng thái lỗi. Bé không làm gì sai khi mạng chậm;
 *   câu đúng là "Bé thử lại nhé!".
 *
 * ⚠️ KHÔNG NẠP GÌ Ở ĐÂY: ví/túi/linh vật đã được `useRewardsLifecycle()` nạp MỘT LẦN ở `AppShell`.
 *   Trang này chỉ ĐỌC (`useRewards`) và gọi hành động (`useShop`) — cùng lý do như `PetHousePage`.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { PET_DEFINITIONS, petEmojiFor } from '@shared/content/pets.js';

import { BigButton } from '../../components/common/BigButton.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { MOMO_ICON } from '../../components/common/PetAvatar.js';
import { ResponsiveGrid } from '../../components/common/ResponsiveGrid.js';
import { useRewards } from '../../hooks/useRewards.js';
import { useShop } from '../../hooks/useShop.js';
import { cn } from '../../lib/cn.js';
import { markPetChooseSkipped } from '../../lib/petChooseSkip.js';
import { useRewardStore } from '../../store/rewardStore.js';

export function ChoosePetPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { childId, snapshot, isHydrated } = useRewards();
  const { choosePet, isChoosing } = useShop();
  const reload = useRewardStore((s) => s.reload);

  /**
   * Con bé vừa chạm, hoặc `null` nếu chưa chạm gì.
   *
   * ⭐ KHÔNG khởi tạo bằng `snapshot.pet.petType` trong `useState`: lúc render đầu tiên `snapshot`
   *   có thể còn `null` (chưa nạp xong). Thay vào đó suy giá trị ĐANG chọn mỗi lượt render — nhờ
   *   vậy luôn có ĐÚNG MỘT thẻ `aria-pressed=true`, kể cả khi dữ liệu về sau.
   */
  const [selected, setSelected] = useState<string | null>(null);
  const active = selected ?? snapshot?.pet.petType ?? null;

  // --- Chưa nạp xong ---------------------------------------------------------
  //
  // ⚠️ PHẢI PHÂN BIỆT "CHƯA ĐỌC ĐƯỢC" VỚI "ĐỌC RỒI VÀ KHÔNG CÓ GÌ" — cùng lý do như `PetHousePage`
  //    và `ExplorerProfilePage`. Vẽ lưới khi chưa biết con hiện tại là gì nghĩa là tô sáng nhầm ô,
  //    hoặc không ô nào — và bé không biết mình đang đi cùng bạn nào.
  if (!isHydrated) {
    return <EmptyState icon={MOMO_ICON} title={t('app.loading')} />;
  }

  if (snapshot === null) {
    /**
     * ⚠️ `snapshot === null` sau khi `hydrated` CHỈ xảy ra khi lần nạp vừa rồi HỎNG. KHÔNG hiện
     *    lỗi kỹ thuật cho bé. Nút "Thử lại" có tác dụng thật vì `reload()` bỏ qua cổng "đã có dữ
     *    liệu thì thôi" của `load()`.
     */
    return (
      <EmptyState
        icon="📦"
        title={t('pet.chooseLoadErrorTitle')}
        description={t('pet.chooseLoadErrorHint')}
        action={
          <BigButton onClick={() => childId && reload(childId)}>{t('app.retry')}</BigButton>
        }
      />
    );
  }

  // ---------------------------------------------------------------------------

  /** Bé xác nhận con đang chọn. `choosePet` KHÔNG BAO GIỜ ném (lỗi ghi vào `shopStore.error`). */
  const confirm = async (): Promise<void> => {
    if (active === null) return;
    await choosePet(active);
    // `replace: true`: nút Back của bé không được kẹt trong vòng `/pet` ⇄ `/pet/chon`.
    navigate('/pet', { replace: true });
  };

  /** Bé chọn "Để sau": nhớ trong PHIÊN này rồi về nhà. */
  const skip = (): void => {
    markPetChooseSkipped();
    navigate('/pet', { replace: true });
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-kid-xl text-ink">{t('pet.chooseTitle')}</h1>
        <p className="text-kid-sm text-ink-soft">{t('pet.chooseIntro')}</p>
      </header>

      {/*
        ⚠️ `role="group"` + `aria-label` BỌC NGOÀI lưới: `ResponsiveGrid` không nhận `aria-label`,
        nên nhãn cho trình đọc màn hình phải nằm ở phần tử bao. Nhãn nói rõ ĐÂY LÀ GÌ ("Các bạn
        đồng hành để bé chọn") — nếu không, bé khiếm thị chỉ nghe sáu cái tên rời rạc mà không biết
        chúng là gì.
      */}
      <div role="group" aria-label={t('pet.chooseGridLabel')}>
        <ResponsiveGrid as="ul" minItemWidth={140} gap={12}>
          {PET_DEFINITIONS.map((pet) => {
            const isActive = active === pet.id;
            return (
              <li key={pet.id}>
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setSelected(pet.id)}
                  className={cn(
                    // `min-h-touch` = 64px — vùng chạm tối thiểu cho tay trẻ con.
                    'flex min-h-touch w-full flex-col items-center justify-center gap-1 rounded-kid',
                    'border-2 px-2 py-2 font-bold transition-colors duration-kid',
                    // Thẻ ĐANG chọn dùng đúng khuôn mẫu nút nhóm ở `PetHousePage`.
                    isActive
                      ? 'border-brand bg-brand-soft text-brand'
                      : 'border-line bg-surface text-ink-faint hoverable:bg-surface-raised',
                  )}
                >
                  {/* Emoji ở bậc `baby` — con bé vừa chọn, trước khi lớn lên. */}
                  <span aria-hidden="true" className="text-[40px] leading-none">
                    {petEmojiFor(pet.id, 'baby')}
                  </span>
                  <span className="text-kid-sm leading-tight">{pet.name_vi}</span>
                </button>
              </li>
            );
          })}
        </ResponsiveGrid>
      </div>

      {/* Nút chính (≥88px). `loading={isChoosing}` vừa làm mờ nút vừa chặn cú chạm thứ hai. */}
      <BigButton size="lg" loading={isChoosing} onClick={() => void confirm()}>
        {t('pet.chooseConfirm')}
      </BigButton>

      {/* Nút phụ — "Để sau". Không bao giờ chặn bé rời màn này. */}
      <BigButton size="md" variant="ghost" onClick={skip}>
        {t('pet.chooseLater')}
      </BigButton>
    </div>
  );
}
