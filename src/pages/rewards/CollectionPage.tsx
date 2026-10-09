/**
 * RubyLingo — `CollectionPage`: Bộ sưu tập của bé (M9, T070) — tab Huy hiệu + tab Sticker.
 *
 * ⭐ MÀN HÌNH NÀY VẼ ĐỦ Ô CỦA GIAI ĐOẠN MVP, KHÔNG CHỈ NHỮNG Ô ĐÃ CÓ.
 *   Đây là điểm khác biệt cốt lõi so với một "danh sách thành tích". Nếu chỉ vẽ thứ bé đã kiếm
 *   được, một bé mới sẽ mở ra và thấy... trống trơn — đúng kiểu "hình như con làm sai rồi" mà
 *   `EmptyState` viết ra để tránh. Vẽ ĐỦ ô (kể cả ô chưa có) biến bộ sưu tập thành một TẤM BẢN
 *   ĐỒ: bé thấy mình đang ở đâu và còn gì phía trước. Ô chưa có mang dấu `?` và một lời hẹn.
 *
 * ⚠️ HAI TAB, CHỌN BẰNG `aria-pressed`, KHÔNG BẰNG `role="tab"`:
 *   Bám đúng khuôn của `PetHousePage` (tab Cửa hàng, T064). Một widget `role="tablist"`/`tab`
 *   đúng chuẩn ARIA phải có hợp đồng bàn phím (mũi tên trái/phải, `Home`/`End`, roving tabindex).
 *   Ta không cài hợp đồng đó, nên gọi nó là "tab" sẽ hứa với trình đọc màn hình một thứ không có
 *   — bé nghe "thẻ 1 trên 2" rồi bấm mũi tên mà không có gì xảy ra. Nút bật/tắt (`aria-pressed`)
 *   là mô tả ĐÚNG thứ đang có, và nút `<button>` mặc định bấm được bằng Enter/Space.
 *
 * ⚠️ NẠP VÍ KHÔNG NẰM Ở ĐÂY: `useRewardsLifecycle()` đã nạp ví/túi/huy hiệu ở `AppShell` cho MỌI
 *    màn hình. Trang này chỉ ĐỌC (`useRewards`) — thêm một lần nạp nữa là request thừa và một
 *    trạng thái "đang tải" thứ hai có thể lệch với `rewardStore`.
 *
 * ⚠️ DANH MỤC LÀ DỮ LIỆU, KHÔNG PHẢI HẰNG SỐ TRONG TỆP NÀY:
 *   `badgesForPhase('mvp')` / `stickersForPhase('mvp')` đọc thẳng `badges.json` / `stickers.json`
 *   (đã được `badges.ts` kiểm schema + bất biến emoji lúc nạp module). Thêm một huy hiệu mới =
 *   sửa JSON, không sửa tệp này — nên bộ sưu tập và bộ luật trao thưởng không thể lệch nhau.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { badgesForPhase, stickersForPhase } from '@shared/content/badges.js';

import { BadgeCard } from '../../components/common/BadgeCard.js';
import type { CollectionItemDefinition } from '../../components/common/BadgeCard.js';
import { BigButton } from '../../components/common/BigButton.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { ResponsiveGrid } from '../../components/common/ResponsiveGrid.js';
import { useRewards } from '../../hooks/useRewards.js';
import { cn } from '../../lib/cn.js';
import { useRewardStore } from '../../store/rewardStore.js';

/** Hai bộ sưu tập của MVP. Mảng cố định — thứ tự tab là thứ tự hiển thị. */
type CollectionTab = 'badges' | 'stickers';

const TABS: readonly CollectionTab[] = ['badges', 'stickers'];

/** Nhãn tab đã có sẵn ở `reward.*` — không khai lại chữ, chỉ trỏ tới khoá. */
const TAB_LABEL_KEY: Record<CollectionTab, string> = {
  badges: 'reward.badges',
  stickers: 'reward.stickers',
};

/**
 * Icon của nút tab (chỉ để nhận diện bằng hình, đã `aria-hidden`).
 * ⚠️ KHÔNG trùng emoji với bất kỳ huy hiệu/sticker/vật phẩm nào — bé học "mỗi hình là một thứ",
 *    nên icon điều hướng phải sống ở một chỗ riêng. Test `badges-content.test.ts` giữ luật đó
 *    cho các bộ dữ liệu; hai giá trị dưới đây được chọn để không đụng vào bộ nào.
 */
const TAB_ICON: Record<CollectionTab, string> = {
  badges: '🏅',
  stickers: '✨',
};

export function CollectionPage() {
  const { t } = useTranslation();

  const { childId, snapshot, isHydrated } = useRewards();
  const reload = useRewardStore((s) => s.reload);

  const [tab, setTab] = useState<CollectionTab>('badges');

  // --- Chưa nạp xong ---------------------------------------------------------
  //
  // ⚠️ PHẢI PHÂN BIỆT "CHƯA ĐỌC ĐƯỢC" VỚI "ĐỌC RỒI VÀ KHÔNG CÓ GÌ" — cùng lý do như `PetHousePage`
  //    và `QuestsPage`. Vẽ lưới khi chưa biết bé đã có gì nghĩa là mọi ô đều hiện `?` trong tích
  //    tắc đầu, rồi bật sáng sau — một nhịp "giật" nói dối bé rằng mình chưa có gì.
  if (!isHydrated) {
    return <EmptyState icon="🏅" title={t('app.loading')} />;
  }

  if (snapshot === null) {
    /**
     * ⚠️ `snapshot === null` sau khi `hydrated` CHỈ xảy ra khi lần nạp vừa rồi HỎNG — `rewardStore`
     *    luôn ghi đúng một trong hai: `snapshot` hoặc `error`. Đây là "không đọc được bộ sưu tập",
     *    không cần đọc thêm `error`.
     *
     * ⚠️ KHÔNG hiện lỗi kỹ thuật cho bé. Bé không làm gì sai. Nút "Thử lại" có tác dụng thật vì
     *    `reload()` bỏ qua cổng "đã có dữ liệu thì thôi" của `load()`.
     */
    return (
      <EmptyState
        icon="📦"
        title={t('reward.loadErrorTitle')}
        description={t('reward.loadErrorHint')}
        action={
          <BigButton onClick={() => childId && reload(childId)}>{t('app.retry')}</BigButton>
        }
      />
    );
  }

  // ---------------------------------------------------------------------------

  const earnedBadges = new Set(snapshot.badges);
  const earnedStickers = new Set(snapshot.stickers);

  const isBadges = tab === 'badges';

  /**
   * Ô của tab đang mở. Gán qua `CollectionItemDefinition[]` (thay vì để TS suy ra hợp của hai
   * mảng) để `map` bên dưới chắc chắn gọi được: `Badge[] | StickerDefinition[]` là một hợp, và
   * gọi phương thức trên hợp mảng dễ sinh lỗi biên dịch khó đọc.
   */
  const items: readonly CollectionItemDefinition[] = isBadges
    ? badgesForPhase('mvp')
    : stickersForPhase('mvp');
  const earnedIds = isBadges ? earnedBadges : earnedStickers;

  const total = items.length;
  const done = items.filter((item) => earnedIds.has(item.id)).length;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-kid-xl text-ink">{t('nav.collection')}</h1>
        <p className="text-kid-sm text-ink-soft">{t('reward.collectionIntro')}</p>
      </header>

      <div role="group" aria-label={t('nav.collection')} className="flex gap-2">
        {TABS.map((key) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setTab(key)}
              className={cn(
                'flex min-h-touch flex-1 flex-col items-center justify-center gap-0.5 rounded-kid',
                'border-2 px-1 py-1 font-bold transition-colors duration-kid',
                // Nút đang chọn: viền + nền nhấn, khớp đúng khuôn tab của `PetHousePage`.
                // Nút còn lại: viền xám trung tính. Vòng focus bàn phím do `:focus-visible` toàn cục
                // trong `index.css` lo — xem khối `@layer base`.
                active
                  ? 'border-brand bg-brand-soft text-brand'
                  : 'border-line bg-surface text-ink-faint hoverable:bg-surface-raised',
              )}
            >
              <span aria-hidden="true" className="text-[22px] leading-none">
                {TAB_ICON[key]}
              </span>
              {/* Nhãn 16px — mức nhỏ nhất được phép trong app này; xem `tokens.css`. */}
              <span className="text-kid-xs leading-tight">{t(TAB_LABEL_KEY[key])}</span>
            </button>
          );
        })}
      </div>

      {/*
        Số đã sưu tầm của tab đang mở. Bé thấy tiến độ ngay mà không phải đếm các ô — và khi đổi
        tab, con số đổi theo nên bé hiểu "mỗi bộ đếm riêng".
      */}
      <p className="rounded-card border-2 border-line bg-surface-raised px-4 py-2 text-kid-sm font-bold text-ink-soft">
        {t('reward.collected', { done, total })}
      </p>

      {/*
        ⚠️ Nhánh rỗng trên thực tế MVP không xảy ra (mỗi bộ đều có ô), nhưng vẫn phải có: nếu một
        ngày danh mục của giai đoạn bị rút hết, để trống trơn là dạy bé rằng màn hình bị hỏng.
        Dùng chung `EmptyState` nên vẫn có linh vật và một lời mời tử tế.
      */}
      {total === 0 ? (
        <EmptyState
          icon={isBadges ? TAB_ICON.badges : TAB_ICON.stickers}
          title={t(isBadges ? 'reward.badgesEmptyTitle' : 'reward.stickersEmptyTitle')}
          description={t(isBadges ? 'reward.badgesEmptyHint' : 'reward.stickersEmptyHint')}
        />
      ) : (
        /*
          `minItemWidth` 160: ô gồm icon lớn, tên và một dòng mô tả. Hẹp hơn thì tên huy hiệu dài
          ("Người bạn của thú rừng") xuống dòng liên tục trên điện thoại. Trên laptop vẫn được
          nhiều cột. `as="ul"` để các con là `li` — đúng ngữ nghĩa danh sách.
        */
        <ResponsiveGrid as="ul" minItemWidth={160} gap={12}>
          {items.map((item) => (
            <li key={item.id}>
              <BadgeCard item={item} earned={earnedIds.has(item.id)} />
            </li>
          ))}
        </ResponsiveGrid>
      )}
    </div>
  );
}
