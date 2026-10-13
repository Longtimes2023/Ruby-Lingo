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

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { decorationSlotOf, getShopItem, isEquippable, isFood, shopItemsByCategory } from '@shared/content/shop.js';
import type { RoomPlacement } from '@shared/schemas/room.js';
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
import { useRoomPlacements } from '../../hooks/useRoomPlacements.js';
import { useShop } from '../../hooks/useShop.js';
import { cn } from '../../lib/cn.js';
import { ShopArtwork } from '../../lib/shopArtwork.js';
import {
  BASEBOARD_PCT,
  FLOOR_HEIGHT_PCT,
  PET_BOTTOM_PCT,
  PET_HEIGHT_PCT,
  WALL_LINE_PCT,
  clampToRoom,
  decorationRenderSize,
  defaultDecorationBox,
  pctHToCqw,
  placedDecorationBox,
  sortByBottom,
} from '../../lib/roomLayout.js';
import type { DecorationBox } from '../../lib/roomLayout.js';
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
 * Cỡ một vật thể trong phòng, đo theo BỀ RỘNG KHUNG (`cqw`) — xem khối chú thích ngay trên.
 *
 * ⚠️ VÌ SAO ĐI QUA BIẾN CSS THAY VÌ `width: '13cqw'`:
 *   `cqw` là đơn vị ĐÚNG ở đây (1cqw = 1% bề rộng khung), nhưng jsdom — môi trường chạy unit
 *   test — không hiểu `cqw` và XOÁ LUÔN khai báo khỏi `style`. Hệ quả: test đơn vị không thể
 *   khẳng định "cỡ đang bám theo khung", mà đây đúng là thứ vừa hỏng và cần canh giữ. Đi qua
 *   biến CSS thì giá trị nằm NGUYÊN trong `style` để khẳng định được, còn trình duyệt thật vẫn
 *   nhận đúng `13cqw` như trước. Đây là tệp duy nhất trong dự án cần mẹo này.
 */
function roomSizeStyle(widthCqw: number, heightCqw: number): CSSProperties {
  return {
    width: 'var(--room-w)',
    height: 'var(--room-h)',
    '--room-w': `${widthCqw}cqw`,
    '--room-h': `${heightCqw}cqw`,
  } as CSSProperties;
}

/**
 * Ảnh nền phòng, vẽ SAU ba dải CSS (tường / baseboard / sàn).
 *
 * ⭐ VÌ SAO VẪN GIỮ CẢ BA DẢI CSS DÙ ĐÃ CÓ ẢNH: ảnh là thứ có thể thiếu (404, mạng chậm, hoặc
 *   một bản deploy chưa kịp copy `public/`). Ba dải CSS là ĐƯỜNG LÙI: thiếu ảnh thì khung phòng
 *   vẫn đọc ra là một căn phòng có tường và sàn, chứ không sập về một mảng màu phẳng — đúng cái
 *   trạng thái mà chủ dự án vừa phàn nàn. Ảnh hỏng thì `onError` tự ẩn nó đi.
 */
const ROOM_BACKGROUND_SRC = '/assets/rooms/room-default.webp';

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
  const room = useRoomPlacements();
  const activeChildIdRef = useRef(childId);
  activeChildIdRef.current = childId;
  const roomReady = childId !== null && room.childId === childId && room.placements !== null && !room.isLoading;
  const [roomDraft, setRoomDraft] = useState<RoomPlacement[]>([]);
  const roomDraftRef = useRef<RoomPlacement[]>([]);
  const saveChainRef = useRef(Promise.resolve());
  const queuedSavesRef = useRef(0);
  const [roomDraftVersion, setRoomDraftVersion] = useState(0);
  const dragStartRef = useRef<{ itemId: string; x: number; y: number } | null>(null);

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

  const ownedDecorations = useMemo(() => {
    return inventory.flatMap((entry) => {
      if (entry.quantity <= 0) return [];
      const item = getShopItem(entry.itemId);
      return item && decorationSlotOf(item) !== null ? [item] : [];
    });
  }, [inventory]);

  useEffect(() => {
    if (!roomReady || room.placements === null || queuedSavesRef.current > 0) return;
    const allowed = new Set(ownedDecorations.map((item) => item.id));
    const next = room.placements.filter((placement) => allowed.has(placement.itemId));
    roomDraftRef.current = next;
    setRoomDraft(next);
  }, [roomReady, room.placements, ownedDecorations, roomDraftVersion]);

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
      if (item !== undefined && isEquippable(item) && decorationSlotOf(item) === null) list.push(item);
    }
    return list;
  }, [inventory]);

  const updateRoomDraft = (next: RoomPlacement[]) => {
    roomDraftRef.current = next;
    setRoomDraft(next);
    setRoomDraftVersion((version) => version + 1);
  };

  const enqueueRoomSave = () => {
    const targetChildId = childId;
    if (!targetChildId) return;
    queuedSavesRef.current += 1;
    saveChainRef.current = saveChainRef.current
      .catch(() => undefined)
      .then(() => {
        if (activeChildIdRef.current !== targetChildId) return;
        return room.save(roomDraftRef.current, targetChildId);
      })
      .finally(() => {
        queuedSavesRef.current -= 1;
        if (queuedSavesRef.current === 0) setRoomDraftVersion((version) => version + 1);
      });
  };

  const saveRoomDraft = () => {
    if (roomReady) enqueueRoomSave();
  };

  const moveDecoration = (itemId: string, x: number, y: number, persist = true) => {
    const existing = roomDraftRef.current.find((placement) => placement.itemId === itemId);
    const next = existing
      ? roomDraftRef.current.map((placement) =>
          placement.itemId === itemId ? { ...placement, x, y } : placement,
        )
      : [...roomDraftRef.current, { itemId, x, y, hidden: false }];
    updateRoomDraft(next);
    if (persist && roomReady) enqueueRoomSave();
  };

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

  // ---------------------------------------------------------------------------
  // Dựng các lớp của "Góc phòng của bé"
  // ---------------------------------------------------------------------------

  /**
   * Một món đã đặt trong phòng, cùng hộp đã tính sẵn (đơn vị % khung — xem `roomLayout.ts`).
   *
   * ⭐ `left/top` của nút LÀ TÂM món, không phải góc: đúng hệ toạ độ mà `moveDecoration` lưu, nên
   *   kéo-thả và vẽ dùng chung một con số, không có phép đổi trục nào ở giữa.
   */
  const renderDecorationNode = (
    item: ShopItem,
    box: DecorationBox,
    placement: RoomPlacement,
  ): ReactNode => {
    // Ảnh và Ô CHẠM là hai thứ khác nhau: ô chạm giữ ≥64px cho tay trẻ con, còn ảnh đo theo
    // khung bằng `cqw`. Buộc ảnh ăn theo ô chạm là quay lại đúng lỗi "24px cố định".
    const renderSize = decorationRenderSize(box);
    return (
      <button
        key={item.id}
        type="button"
        aria-label={`${item.name_vi}, vị trí ${Math.round(placement.x)}%, ${Math.round(placement.y)}%. Dùng phím mũi tên để di chuyển.`}
        className="absolute z-10 flex size-touch -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-kid focus-visible:outline focus-visible:outline-4 focus-visible:outline-brand"
        style={{ left: `${box.leftPct}%`, top: `${box.topPct}%` }}
        onPointerDown={(event) => {
          if (!roomReady) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const current = roomDraftRef.current.find((entry) => entry.itemId === item.id);
          dragStartRef.current = current ? { itemId: item.id, x: current.x, y: current.y } : null;
          event.currentTarget.parentElement!.dataset.dragging = item.id;
        }}
        onKeyDown={(event) => {
          if (!roomReady) return;
          const step = event.shiftKey ? 10 : 2;
          const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
          if (!delta) return;
          event.preventDefault();
          const current = roomDraftRef.current.find((entry) => entry.itemId === item.id) ?? placement;
          const point = clampToRoom(current.x + (delta[0] ?? 0), current.y + (delta[1] ?? 0));
          moveDecoration(item.id, point.x, point.y, false);
          saveRoomDraft();
        }}
      >
        {/*
          ⚠️ `shrink-0` LÀ BẮT BUỘC, KHÔNG PHẢI CHO ĐẸP. Ô chạm chỉ rộng 64px, còn ảnh thì rộng
             tới ~22%W (≈190px ở khung 848px). Trong một flex container 64px, mặc định
             `flex-shrink: 1` sẽ BÓP ảnh về đúng 64px theo trục ngang — ảnh cao 190px mà rộng
             64px, tức là MÉO, và bề rộng thật lại rơi về tỉ lệ màn hình (đúng căn bệnh cũ).
             `max-w-none` để preflight `img { max-width: 100% }` không bóp thêm lần nữa.
        */}
        <span
          aria-hidden="true"
          className="pointer-events-none block shrink-0"
          style={roomSizeStyle(renderSize.widthCqw, renderSize.heightCqw)}
        >
          <ShopArtwork item={item} className="block h-full w-full max-w-none object-contain" />
        </span>
      </button>
    );
  };

  const wallNodes: ReactNode[] = [];
  const floorNodes: Array<{ bottomPct: number; node: ReactNode }> = [];

  if (roomReady) {
    for (const item of ownedDecorations) {
      const placement = roomDraft.find((entry) => entry.itemId === item.id);
      if (!placement || placement.hidden) continue;
      // Bé đã kéo thì tôn trọng `x/y` đã lưu (chỉ kẹp biên) — xem `placedDecorationBox`.
      const box = placedDecorationBox(item.id, placement.x, placement.y);
      if (!box) continue;

      const node = renderDecorationNode(item, box, placement);
      if (box.band === 'wall') wallNodes.push(node);
      else floorNodes.push({ bottomPct: box.bottomPct, node });
    }
  }

  /*
    Thú cưng đứng TRONG phòng, đo theo % khung: đáy (bàn chân) ở 84%H, cao 46%H ⇒ đầu ở 38%H
    (trong dải tường) còn chân trong dải sàn — đó là thứ khiến mắt đọc ra "đang đứng trong phòng"
    chứ không phải "dán lên phông nền". Bề rộng suy từ chiều cao (ảnh gốc vuông) nên con vật
    KHÔNG bị méo khi khung đổi tỉ lệ theo màn hình.
  */
  floorNodes.push({
    bottomPct: PET_BOTTOM_PCT,
    node: (
      <div
        key="__pet__"
        data-room-pet=""
        className="pointer-events-none absolute left-1/2 -translate-x-1/2"
        style={
          {
            // Neo theo ĐÁY (%H) — bàn chân ở 84%H ⇒ cách mép dưới 16%.
            bottom: `${100 - PET_BOTTOM_PCT}%`,
            height: `${PET_HEIGHT_PCT}%`,
            // Bề rộng suy từ chiều cao (ảnh gốc vuông 512×512) ⇒ 46%H = 34,5%W = 34,5cqw.
            width: 'var(--room-pet-w)',
            '--room-pet-w': `${pctHToCqw(PET_HEIGHT_PCT)}cqw`,
          } as CSSProperties
        }
      >
        {/*
          ⚠️⚠️ CON VẬT TRONG PHÒNG PHẢI MẶC ĐÚNG BỘ PHỤ KIỆN ĐANG MẶC — dùng chính `PetAvatar`,
             KHÔNG vẽ `<img>` trần.

          Bản trước vẽ một `<img src={petArtworkUrl(...)}>` ở đây. Đo trên trình duyệt thật
          (1280×800, bé mặc đủ 5 món): `[data-accessory-id]` TRONG khung phòng = **0** — kính/mũ/
          khăn/giày/ba lô chỉ hiện trên thẻ ở đầu trang, còn con vật trong "Nhà thú cưng" thì trần
          truồng. Đúng lời chủ dự án: *"mua cái mắt kính, đeo vào là sát vào mặt"*.

          `sizeEm` đặt hộp `1em` của con vật = `--room-pet-w` (34,5cqw) ⇒ con vật VÀ mọi phụ kiện
          cùng phóng theo khung phòng, vì neo trong `petAnchors.ts` là `%`-của-hộp-`1em`.

          `bare` là BẮT BUỘC ở đây: khối "Góc phòng của bé" đã có tường/baseboard/sàn riêng, nên
          nếu dùng thẻ đầy đủ thì bé thấy một cái thẻ lồng trong phòng — dải trời, dải cỏ, viền bo
          và dòng chữ "🐵 Trưởng thành" nằm chồng lên sàn gỗ.
        */}
        <PetAvatar
          petType={snapshot.pet.petType}
          evolutionStage={snapshot.pet.evolutionStage}
          items={equippedItems}
          sizeEm="var(--room-pet-w)"
          frameClassName="size-full"
          bare
        />
      </div>
    ),
  });

  /*
    Thứ tự vẽ (xa trước, gần sau). Đồ treo tường nằm TRÊN TƯỜNG nên luôn vẽ trước thú cưng; còn
    đồ dưới sàn và thú cưng sắp chung theo `đáy` tăng dần — xem `sortByBottom`.
  */
  const sortedFloorNodes = sortByBottom(floorNodes);

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

      <section aria-labelledby="pet-room-title" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id="pet-room-title" className="text-kid-md font-bold text-ink">Góc phòng của bé</h2>
          {(room.isLoading || room.isSaving) && (
            <span role="status" className="text-kid-xs text-ink-soft">
              {room.isLoading ? 'Đang tải vị trí…' : 'Đang lưu…'}
            </span>
          )}
        </div>
        {/*
          ⚠️ `[container-type:inline-size]` LÀ THỨ CHỐNG LỖI "KHUNG GIÃN, NỘI DUNG KHÔNG GIÃN".
             Khung này rộng theo màn hình (328px → 848px), nhưng mọi vật thể bên trong đo bằng
             `cqw` = 1% bề rộng khung ⇒ tỉ lệ vật/khung GIỮ NGUYÊN ở mọi viewport. Đổi sang px
             hay `vw` là quay lại đúng lỗi cũ (đồ trang trí nhỏ xíu trên màn lớn).
        */}
        <div
          aria-label="Phòng của thú cưng; kéo đồ trang trí để sắp xếp"
          className="relative aspect-[4/3] w-full overflow-hidden rounded-card border-2 border-line bg-amber-50 [container-type:inline-size]"
          onPointerMove={(event) => {
            const draggingId = event.currentTarget.dataset.dragging;
            if (!draggingId) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const point = clampToRoom(
              ((event.clientX - rect.left) / rect.width) * 100,
              ((event.clientY - rect.top) / rect.height) * 100,
            );
            moveDecoration(draggingId, point.x, point.y, false);
          }}
          aria-busy={!roomReady || room.isLoading}
          onPointerUp={(event) => {
            if (!event.currentTarget.dataset.dragging) return;
            delete event.currentTarget.dataset.dragging;
            dragStartRef.current = null;
            saveRoomDraft();
          }}
          onPointerCancel={(event) => {
            delete event.currentTarget.dataset.dragging;
            const start = dragStartRef.current;
            if (start) moveDecoration(start.itemId, start.x, start.y, false);
            dragStartRef.current = null;
          }}
        >
          {/*
            NỀN PHÒNG — ba dải, vẽ TRƯỚC mọi thứ khác:
              1. tường     [0 → 61,8%H]
              2. baseboard [61,8% → 64,3%H]  (dải 2,5%H)
              3. sàn       [64,3% → 100%H]
            Baseboard là chi tiết đắt giá nhất ở đây: thiếu nó thì tường và sàn dán liền nhau
            thành một vệt màu —— đó chính xác là "chỉ là cái phông nền" mà chủ dự án thấy.
          */}
          <div
            aria-hidden="true"
            data-room-wall=""
            className="absolute inset-x-0 top-0 bg-gradient-to-b from-sky-100 to-amber-50"
            style={{ height: `${WALL_LINE_PCT}%` }}
          />
          <div
            aria-hidden="true"
            data-room-baseboard=""
            className="absolute inset-x-0 bg-amber-200 shadow-[0_1px_2px_rgba(120,72,20,0.25)]"
            style={{ top: `${WALL_LINE_PCT}%`, height: `${BASEBOARD_PCT}%` }}
          />
          <div
            aria-hidden="true"
            data-room-floor=""
            className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-amber-100 to-amber-300"
            style={{ height: `${FLOOR_HEIGHT_PCT}%` }}
          />

          {/*
            Ảnh nền phòng (nếu có) phủ LÊN ba dải CSS ở trên — ba dải kia là đường lùi khi ảnh
            thiếu/hỏng (`onError` ẩn ảnh đi, không để lại ô ảnh vỡ trước mắt bé).
          */}
          <img
            src={ROOM_BACKGROUND_SRC}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />

          {/* Đồ TREO TƯỜNG — ở trên tường nên luôn nằm sau thú cưng. */}
          {wallNodes}

          {/* (Đồ DƯỚI SÀN + thú cưng) sắp theo đáy tăng dần — xa trước, gần sau. */}
          {sortedFloorNodes.map((layer) => layer.node)}
        </div>
        {ownedDecorations.length > 0 && (
          <div role="group" aria-label="Đồ trang trí đang có" className="flex flex-wrap gap-2">
            {ownedDecorations.map((item) => {
              const placed = roomDraft.some((entry) => entry.itemId === item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={placed || !roomReady || room.isLoading || room.placements === null}
                  aria-label={`Đặt ${item.name_vi} vào phòng`}
                  onClick={() => {
                    // Đặt vào ĐÚNG CHỖ MẶC ĐỊNH của món: đồ treo tường lên tường, đồ dưới sàn
                    // vào làn của nó — thay vì dồn hết về một điểm rồi bé phải tự kéo từng món.
                    const box = defaultDecorationBox(item.id);
                    moveDecoration(item.id, box?.leftPct ?? 50, box?.topPct ?? 50);
                  }}
                  className="min-h-touch rounded-kid border-2 border-line bg-surface px-3 text-kid-sm disabled:opacity-60"
                >
                  <ShopArtwork item={item} className="mr-1 inline-block size-6 align-middle object-contain" />{item.name_vi}
                </button>
              );
            })}
          </div>
        )}
        {room.error && (
          <div className="flex items-center gap-2 rounded-card border-2 border-danger bg-danger-soft px-3 py-2">
            <p role="alert" className="flex-1 text-kid-xs text-ink">Không lưu được cách sắp xếp. Vị trí vẫn được giữ trên màn hình.</p>
            <button type="button" onClick={saveRoomDraft} className="min-h-touch rounded-kid bg-surface px-3 text-kid-xs font-bold">Thử lưu lại</button>
            {room.placements === null && <button type="button" onClick={() => void room.reload()} className="min-h-touch rounded-kid bg-surface px-3 text-kid-xs font-bold">Tải lại</button>}
          </div>
        )}
      </section>

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
