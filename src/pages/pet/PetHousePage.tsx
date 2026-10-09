/**
 * RubyLingo — `PetHousePage`: Nhà thú cưng (M6, T064) — nơi bé cho Momo ăn, mặc phụ kiện, mua đồ.
 *
 * ⭐ CỬA HÀNG LÀ MỘT PHẦN CỦA MÀN HÌNH NÀY, KHÔNG PHẢI MỘT MỤC RIÊNG (quyết định C2):
 *   Bé mua một chiếc nón xong phải THẤY NGAY Momo đội nón. Nếu cửa hàng là màn hình riêng, bé
 *   phải nhớ "vừa mua ở đâu", bấm về, rồi tự tìm — mất đi phản hồi liền mạch, mà đó chính là phần
 *   thưởng của việc mua. Và `BottomNav` đã đủ 5 mục (trần cứng) — xem ghi chú đầu tệp đó.
 *
 * ⭐ BA NHÓM, MỘT HÀNG NÚT — CHỌN BẰNG `aria-pressed`, KHÔNG BẰNG `role="tab"`:
 *   Một widget `role="tablist"`/`role="tab"` đúng chuẩn ARIA phải có hợp đồng bàn phím (mũi tên
 *   trái/phải để chuyển tab, `Home`/`End`, và chỉ tab đang chọn nằm trong thứ tự tab). Ta không
 *   cài hợp đồng đó, nên gọi nó là "tab" sẽ hứa với trình đọc màn hình một thứ không tồn tại —
 *   bé dùng bàn phím nghe "thẻ 1 trên 3" rồi bấm mũi tên và không có gì xảy ra. Nút bật/tắt
 *   (`aria-pressed`) là mô tả ĐÚNG thứ đang có: ba nút, một nút đang bật.
 *
 * ⚠️ NẠP VÍ KHÔNG NẰM Ở ĐÂY: `useRewardsLifecycle()` đã nạp ví/túi/linh vật ở `AppShell` cho MỌI
 *    màn hình. Trang này chỉ ĐỌC (`useRewards`) — thêm một lần nạp nữa là request thừa và một
 *    trạng thái "đang tải" thứ hai có thể lệch với `rewardStore`.
 *
 * ⚠️ `useShopLifecycle()` CŨNG KHÔNG NẰM Ở ĐÂY — xem ghi chú đầu `useShop.ts` (đặt ở `AppShell`,
 *    nếu không thì mỗi lần rời màn rồi quay lại, thông báo bé đang đọc bị xoá sạch).
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { getShopItem, isEquippable, isFood, shopItemsByCategory } from '@shared/content/shop.js';
import { petNameVi } from '@shared/content/pets.js';
import type {
  CurrencyKind,
  InventoryItem,
  RewardSnapshot,
  ShopItem,
  ShopItemCategory,
} from '@shared/types/reward.js';

import { BigButton } from '../../components/common/BigButton.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { HeartMeter } from '../../components/common/HeartMeter.js';
import { MOMO_ICON, PetAvatar } from '../../components/common/PetAvatar.js';
import { ResponsiveGrid } from '../../components/common/ResponsiveGrid.js';
import { ShopItemCard } from '../../components/common/ShopItemCard.js';
import { useRewards } from '../../hooks/useRewards.js';
import { useShop } from '../../hooks/useShop.js';
import { cn } from '../../lib/cn.js';
import { wasPetChooseSkipped } from '../../lib/petChooseSkip.js';
import { useRewardStore } from '../../store/rewardStore.js';

/** Thứ tự ba nhóm — đồ ăn trước, vì đó là việc bé làm được NGAY (mua rồi cho ăn luôn). */
const TABS: readonly ShopItemCategory[] = ['food', 'accessory', 'decoration'];

const TAB_LABEL_KEY: Record<ShopItemCategory, string> = {
  food: 'shop.food',
  accessory: 'shop.accessory',
  decoration: 'shop.decoration',
};

const TAB_ICON: Record<ShopItemCategory, string> = {
  food: '🍎',
  accessory: '🎀',
  decoration: '🎈',
};

/**
 * Mảng rỗng DÙNG CHUNG cho trường hợp chưa có ảnh chụp.
 *
 * ⚠️ Nếu viết `snapshot?.inventory ?? []` ngay trong thân component thì mỗi lần render lại có một
 *    mảng mới ⇒ `useMemo` dựng lại `Map` và `ownsAnyFood` tính lại vô ích, mỗi lượt render. Một
 *    hằng ở cấp module giữ nguyên tham chiếu, nên `useMemo` chỉ chạy khi túi đồ THẬT SỰ đổi.
 */
const EMPTY_INVENTORY: readonly InventoryItem[] = [];

/**
 * Số dư của bé theo một loại tiền tệ.
 *
 * ⚠️ Dùng `Record<CurrencyKind, number>` chứ không `currency === 'stars' ? a : b`. Hôm nay
 *    `CurrencyKind` chỉ có hai giá trị nên hai cách viết cho cùng kết quả — nhưng ngày ai đó thêm
 *    loại tiền tệ thứ ba, phép tam phân sẽ LẶNG LẼ trả về số hạt dẻ cho loại tiền mới (nhãn giá
 *    của một món ăn bằng tiền mới hiện số sai, và bé bấm Mua rồi bị từ chối mà không hiểu vì sao).
 *    `Record` thì không biên dịch được cho tới khi có người điền đủ khoá. Giữa hai kiểu im lặng,
 *    chọn kiểu ồn ào.
 */
function balanceOf(snapshot: RewardSnapshot, currency: CurrencyKind): number {
  const balances: Record<CurrencyKind, number> = {
    stars: snapshot.wallet.stars,
    acorns: snapshot.wallet.acorns,
  };
  return balances[currency];
}

export function PetHousePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { childId, snapshot, isHydrated } = useRewards();
  const { buy, feed, equip, isBuying, isFeeding, isEquipping, lastNotice, dismissNotice } =
    useShop();
  const reload = useRewardStore((s) => s.reload);

  const [tab, setTab] = useState<ShopItemCategory>('food');

  /**
   * Tự mở màn chọn con khi bé CHƯA từng chọn con (`!petChosen`) và chưa bấm "Để sau" trong phiên.
   *
   * ⚠️⚠️ HOOK PHẢI NẰM TRƯỚC MỌI `return` SỚM Ở DƯỚI. React không cho gọi hook có điều kiện, nên
   *    `useNavigate()` và `useEffect` phải đứng TRÊN khối `if (!isHydrated)` — điều kiện thật nằm
   *    BÊN TRONG effect. Đặt effect xuống dưới là vi phạm thứ tự hook và React sẽ ném lỗi.
   *
   * ⚠️ `replace: true`: nút Back của bé không được kẹt trong vòng `/pet` ⇄ `/pet/chon` — bấm Back
   *    ở màn chọn phải về chỗ TRƯỚC khi vào nhà thú cưng, không phải nảy qua lại giữa hai màn.
   *
   * ⚠️ Cờ `sessionStorage` đọc TRONG effect (không phải lúc render) — đọc `sessionStorage` khi
   *    render là một hiệu ứng phụ trong thân render (StrictMode chạy hai lần), và ở môi trường
   *    không có `sessionStorage` nó ném ngay giữa render = màn trắng. `wasPetChooseSkipped()` đã
   *    tự bọc `try`.
   */
  useEffect(() => {
    if (!isHydrated || snapshot === null) return;
    if (snapshot.pet.petChosen) return;
    if (wasPetChooseSkipped()) return;
    navigate('/pet/chon', { replace: true });
  }, [isHydrated, snapshot, navigate]);

  const inventory = snapshot?.inventory ?? EMPTY_INVENTORY;

  /** Tra cứu túi đồ theo `itemId` — mỗi thẻ cần biết bé đã có món đó chưa, đang mặc chưa. */
  const ownedById = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    for (const owned of inventory) map.set(owned.itemId, owned);
    return map;
  }, [inventory]);

  /**
   * Bé có món ăn nào trong túi chưa.
   *
   * ⚠️ Phải tra qua danh mục (`getShopItem`) chứ KHÔNG đoán theo tiền tố id (`food-…`): id là
   *    dữ liệu, không phải hợp đồng. Một món ăn mới đặt tên `snack-…` sẽ làm phép đoán sai, và
   *    hậu quả là câu mời "Bé chưa có món ăn nào" hiện ra ngay trên túi đầy đồ ăn của bé.
   */
  const ownsAnyFood = useMemo(
    () =>
      inventory.some((owned) => {
        const item = getShopItem(owned.itemId);
        return item !== undefined && isFood(item) && owned.quantity > 0;
      }),
    [inventory],
  );

  /**
   * Những món đang MẶC / đang BÀY, để `PetAvatar` vẽ.
   *
   * ⚠️ Lọc qua `isEquippable` chứ không chỉ `equipped`: `equipped` là một cột trong túi đồ, còn
   *    "mặc được" là một luật của danh mục. Một món ăn lỡ có `equipped = true` (dữ liệu cũ, một
   *    lần ghi sai) sẽ không lọt vào đây — và kể cả có lọt thì `PetAvatar` vẫn bỏ qua, vì
   *    `accessorySlotOf` trả `null` cho đồ ăn. Hai lớp, vì đây là chỗ dễ sinh "Momo đội quả chuối".
   */
  const equippedItems = useMemo(() => {
    const list: ShopItem[] = [];
    for (const owned of inventory) {
      if (!owned.equipped) continue;
      const item = getShopItem(owned.itemId);
      if (item !== undefined && isEquippable(item)) list.push(item);
    }
    return list;
  }, [inventory]);

  // --- Chưa nạp xong ---------------------------------------------------------
  //
  // ⚠️ PHẢI PHÂN BIỆT "CHƯA ĐỌC ĐƯỢC" VỚI "ĐỌC RỒI VÀ KHÔNG CÓ GÌ" — cùng lý do như `QuestsPage`
  //    và `StreakFlame`. Cửa hàng cần VÍ; hiện giá và nút Mua trước khi biết bé có bao nhiêu sao
  //    nghĩa là hiện những con số sai (hoặc nút sáng cho một món bé không mua được).
  if (!isHydrated) {
    return <EmptyState icon={MOMO_ICON} title={t('app.loading')} />;
  }

  if (snapshot === null) {
    /**
     * ⚠️ `snapshot === null` sau khi `hydrated` CHỈ xảy ra khi lần nạp vừa rồi HỎNG — `rewardStore`
     *    luôn ghi đúng một trong hai: `snapshot` hoặc `error`. Nên nhánh này là "không đọc được
     *    ví", không cần đọc thêm `error`.
     *
     * ⚠️ KHÔNG hiện lỗi kỹ thuật cho bé. Bé không làm gì sai. Nút "Thử lại" có tác dụng thật vì
     *    `reload()` bỏ qua cổng "đã có dữ liệu thì thôi" của `load()`.
     */
    return (
      <EmptyState
        icon="📦"
        title={t('shop.loadErrorTitle')}
        description={t('shop.loadErrorHint')}
        action={
          <BigButton onClick={() => childId && reload(childId)}>{t('app.retry')}</BigButton>
        }
      />
    );
  }

  /**
   * Tên con bé ĐÃ CHỌN — tra từ DỮ LIỆU (`shared/content/pets.json` → `petNameVi`), KHÔNG từ i18n.
   *
   * ⚠️ Dùng CHUNG một biến cho cả tiêu đề phụ, nhãn `PetAvatar` lẫn hai câu thông báo bên dưới —
   *    nếu mỗi chỗ tự gọi một hàm, chúng có thể lệch nhau đúng lúc bé vừa đổi con. Trước T04 chỗ
   *    này là `t('pet.name')` = "Momo" cố định, nên bé chọn "Mèo Miu" mà nhãn vẫn nói "Momo".
   */
  const petName = petNameVi(snapshot.pet.petType);

  /**
   * Câu hiện ra sau hành động gần nhất.
   *
   * ⚠️ `null` = KHÔNG NÓI GÌ, và đó là câu trả lời đúng cho hai trường hợp:
   *    • chưa có hành động nào (`lastNotice === null`);
   *    • bé vừa cho ăn nhưng chưa đủ dữ kiện để biết Momo có ăn hay không (`classifyFeed` trả
   *      `null`) — đoán bừa ở đây là chọn giữa "ăn ngon quá!" và "đang no lắm rồi!", tức là có
   *      thể nói dối bé. Im lặng thì không nói dối.
   */
  let noticeText: string | null = null;
  if (lastNotice?.kind === 'bought') {
    const name = getShopItem(lastNotice.itemId)?.name_vi;
    // Không tra được tên (id lạ) ⇒ im lặng, thay vì đọc một câu khuyết chủ ngữ cho bé nghe.
    noticeText = name === undefined ? null : t('shop.buySuccess', { item: name });
  } else if (lastNotice?.kind === 'notEnough') {
    noticeText = t('shop.notEnough');
  } else if (lastNotice?.kind === 'fed') {
    noticeText = t('shop.feedSuccess', { pet: petName });
  } else if (lastNotice?.kind === 'full') {
    noticeText = t('shop.petFull', { pet: petName });
  }

  const items = shopItemsByCategory(tab);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-kid-xl text-ink">{t('pet.title')}</h1>
          <p className="text-kid-sm text-ink-soft">{petName}</p>
        </div>
        {/* ❤️ của con vật. `HeartMeter` tự kẹp sàn 1 — xem ghi chú đầu component đó. */}
        <HeartMeter value={snapshot.pet.happiness} className="ml-auto shrink-0" />
      </header>

      {/*
        Con bé đã chọn + bộ đồ đang mặc + cảnh quanh nhà (T065) + giai đoạn tiến hoá (T066). Nhãn
        đọc lên nằm TRONG component (nó tự đọc danh mục để gọi tên từng món), nên chỗ gọi không
        phải biết gì về phụ kiện.

        ⚠️ Truyền ID con + ID giai đoạn mà SERVER trả, không truyền emoji hay số từ: client không
           tự đếm từ và không tự quyết hình. Tên con cũng suy trong `PetAvatar` từ `petType`.
      */}
      <div className="flex flex-col gap-2">
        <PetAvatar
          petType={snapshot.pet.petType}
          evolutionStage={snapshot.pet.evolutionStage}
          items={equippedItems}
        />
        {/*
          Nút ĐỔI BẠN ĐỒNG HÀNH — ≥64px (`BigButton size="md"` ⇒ `min-h-touch`). Đổi con là MIỄN
          PHÍ và không giới hạn số lần, nên nút này luôn bấm được (không mờ vì thiếu tiền).
        */}
        <BigButton
          size="md"
          variant="secondary"
          icon="🐾"
          onClick={() => navigate('/pet/chon')}
        >
          {t('pet.changeCompanion')}
        </BigButton>
      </div>

      {noticeText !== null && (
        <div className="flex items-center gap-3 rounded-card border-2 border-brand bg-brand-soft px-4 py-3">
          {/*
            `role="status"` để trình đọc màn hình cũng nghe thấy — với bé khiếm thị, một khối
            xuất hiện mà không có gì báo thì coi như không có.
          */}
          <p role="status" className="min-w-0 flex-1 text-kid-md font-bold text-ink">
            {noticeText}
          </p>
          <button
            type="button"
            aria-label={t('app.close')}
            onClick={dismissNotice}
            className={cn(
              'inline-flex size-touch shrink-0 items-center justify-center rounded-kid',
              'text-kid-md font-bold text-ink-soft transition-colors duration-kid',
              'hoverable:bg-surface',
            )}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      )}

      <div role="group" aria-label={t('shop.title')} className="flex gap-2">
        {TABS.map((category) => {
          const active = tab === category;
          return (
            <button
              key={category}
              type="button"
              aria-pressed={active}
              onClick={() => setTab(category)}
              className={cn(
                'flex min-h-touch flex-1 flex-col items-center justify-center gap-0.5 rounded-kid',
                'border-2 px-1 py-1 font-bold transition-colors duration-kid',
                active
                  ? 'border-brand bg-brand-soft text-brand'
                  : 'border-line bg-surface text-ink-faint hoverable:bg-surface-raised',
              )}
            >
              <span aria-hidden="true" className="text-[22px] leading-none">
                {TAB_ICON[category]}
              </span>
              {/* Nhãn 16px — mức nhỏ nhất được phép trong app này; xem `tokens.css`. */}
              <span className="text-kid-xs leading-tight">{t(TAB_LABEL_KEY[category])}</span>
            </button>
          );
        })}
      </div>

      {tab === 'food' && !ownsAnyFood && (
        <p className="rounded-card border-2 border-line bg-surface-raised px-4 py-3 text-kid-sm text-ink-soft">
          {t('shop.noFoodYet', { pet: petName })}
        </p>
      )}

      {/*
        `minItemWidth` 240: thẻ có nhãn giá bên phải tên món và một nút toàn dòng. Hẹp hơn thì tên
        món xuống dòng liên tục trên điện thoại. Trên laptop 880px vẫn được 3 cột.
      */}
      <ResponsiveGrid as="ul" minItemWidth={240} gap={12}>
        {items.map((item) => {
          const owned = ownedById.get(item.id);
          return (
            <li key={item.id}>
              <ShopItemCard
                item={item}
                balance={balanceOf(snapshot, item.currency)}
                owned={owned !== undefined}
                quantity={owned?.quantity ?? 0}
                equipped={owned?.equipped ?? false}
                buying={isBuying(item.id)}
                feeding={isFeeding(item.id)}
                equipping={isEquipping(item.id)}
                // `void`: ba hàm này KHÔNG BAO GIỜ ném (lỗi được ghi vào `shopStore.error`), nhưng
                // chúng trả Promise — chỗ gọi là một `onClick`, không ai `await` được ở đó.
                onBuy={() => void buy(item.id)}
                onFeed={() => void feed(item.id)}
                onEquip={(equipped) => void equip(item.id, equipped)}
              />
            </li>
          );
        })}
      </ResponsiveGrid>
    </div>
  );
}
