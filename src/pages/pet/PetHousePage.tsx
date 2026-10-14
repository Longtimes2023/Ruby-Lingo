/**
 * RubyLingo — `PetHousePage`: Nhà thú cưng (M6, T064) — nơi bé cho Momo ăn, mặc phụ kiện, mua đồ.
 *
 * ⭐ PHỤ KIỆN KHÔNG CÒN "MẶC LÊN NGƯỜI" TRONG PHÒNG (chủ dự án chốt sau nhiều vòng thử ghép lớp):
 *   *"bạn tách các đồ vật cho thú cưng ra đi, để tự do di chuyển cho rồi."* Vì vậy TRONG PHÒNG,
 *   phụ kiện là những VẬT THỂ TỰ DO bé kéo thả (y hệt đồ trang trí), và con vật đứng TRẦN. Phụ kiện
 *   nằm trong một KHAY RIÊNG dưới khung phòng: bấm một món ⇒ nó rơi xuống sàn, rồi bé tự kéo.
 *   Vị trí lưu lên server theo từng bé, dùng đúng cơ chế của đồ trang trí (`useRoomPlacements`).
 *   ⚠️ Thẻ `PetAvatar` ở ĐẦU TRANG (ngoài khung phòng) VẪN mặc bộ `equipped` như cũ — bé cần thấy
 *      "con vật đang mặc gì" ở thẻ hồ sơ. Chỉ TRONG PHÒNG mới tách rời.
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

import { accessorySlotOf, decorationSlotOf, getShopItem, isEquippable, isFood, shopItemsByCategory } from '@shared/content/shop.js';
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
 * Mảng rỗng DÙNG CHUNG cho con vật TRONG PHÒNG — bé đã tách phụ kiện ra khỏi người (xem ghi chú ở
 * `PetAvatar` trong khung phòng). Truyền một mảng mới mỗi lượt render cũng được, nhưng một hằng ở
 * cấp module giữ nguyên tham chiếu để các `useMemo` bên trong `PetAvatar` không dựng lại vô ích.
 */
const NO_ITEMS: readonly ShopItem[] = [];

/** Bề rộng một phụ kiện đặt tự do trong phòng, tính bằng `cqw` (= % bề rộng khung). */
const ROOM_ACCESSORY_WIDTH_CQW = 13;

/**
 * Vị trí NGANG MẶC ĐỊNH khi bé bấm một món trong khay — rải đều từ 25% đến 75%W.
 *
 * ⭐ VÌ SAO RẢI ĐỀU CHỨ KHÔNG DỒN VỀ MỘT ĐIỂM: bấm ba món liên tiếp mà món nào cũng nhảy vào đúng
 *   một chỗ thì chúng chồng khít lên nhau và bé không thấy mình vừa đặt được gì. Nhưng vị trí phải
 *   ỔN ĐỊNH THEO TỪNG MÓN (suy từ chỉ số trong danh sách bé sở hữu), không theo thứ tự bấm — nếu
 *   không, đặt xong món thứ nhất thì món thứ hai nhảy vào chỗ trống vừa bị bỏ lại.
 */
function accessoryDropX(index: number, count: number): number {
  if (count <= 1) return 50;
  return 25 + (50 * index) / (count - 1);
}

/** Vị trí DỌC mặc định của một phụ kiện: trên sàn, phía sau/dưới con vật. (%H) */
const ROOM_ACCESSORY_DROP_Y_PCT = 70;

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

  /**
   * Phụ kiện bé SỞ HỮU — nguồn cho KHAY ĐỒ (chủ dự án chốt: tách phụ kiện khỏi "mặc lên người",
   * để bé tự kéo vào phòng).
   *
   * ⚠️ Lọc qua `accessorySlotOf(item) !== null` (không phải `category === 'accessory'`): hàm đó
   *    đồng thời kiểm `slot` có nằm trong danh sách vị trí hợp lệ. Một phụ kiện thiếu/sai `slot`
   *    sẽ bị `shopItemsFileSchema` chặn từ lúc nạp module, nhưng đây là lưới an toàn thứ hai —
   *    cùng lý do như `ownedDecorations`.
   */
  const ownedAccessories = useMemo(() => {
    return inventory.flatMap((entry) => {
      if (entry.quantity <= 0) return [];
      const item = getShopItem(entry.itemId);
      return item && accessorySlotOf(item) !== null ? [item] : [];
    });
  }, [inventory]);

  useEffect(() => {
    if (!roomReady || room.placements === null || queuedSavesRef.current > 0) return;
    /*
      ⚠️ DANH SÁCH ĐƯỢC PHÉP phải gồm CẢ trang trí LẪN phụ kiện. Nếu chỉ lọc theo trang trí thì
      một placement `acc-*` đọc từ server sẽ bị BỎ NGAY khỏi `roomDraft`, rồi lượt lưu kế tiếp
      ghi đè lên server bằng danh sách đã mất món đó — phụ kiện bé vừa đặt biến mất sau khi tải
      lại, im lặng và không có lỗi nào nổi lên.
    */
    const allowed = new Set([...ownedDecorations, ...ownedAccessories].map((item) => item.id));
    const next = room.placements.filter((placement) => allowed.has(placement.itemId));
    roomDraftRef.current = next;
    setRoomDraft(next);
  }, [roomReady, room.placements, ownedDecorations, ownedAccessories, roomDraftVersion]);

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

  /**
   * Ghi bản nháp phòng và cho React vẽ lại.
   *
   * ⚠️⚠️ KHÔNG bump `roomDraftVersion` Ở ĐÂY — ĐÓ LÀ MỘT NỬA CỦA LỖI "KÉO THẢ RẤT LAG" (mục 26).
   *
   *   `roomDraftVersion` là KHOÁ để hiệu ứng ĐỒNG BỘ LẠI `roomDraft` từ `room.placements` (dữ
   *   liệu server) chạy lại — xem `useEffect` phía trên. Trong lúc bé ĐANG KÉO, `moveDecoration`
   *   được gọi với `persist = false` nên KHÔNG có lượt lưu nào xếp hàng, và hiệu ứng đó CHẠY ĐƯỢC
   *   ⇒ nó ghi đè vị trí bé vừa kéo bằng vị trí CŨ trên server ⇒ món đồ giật về chỗ cũ rồi lại
   *   nhảy tới con trỏ — mỗi sự kiện con trỏ một lần.
   *
   *   ⭐ `setRoomDraft(next)` MỘT MÌNH đã đủ để React vẽ lại. Chỉ `enqueueRoomSave().finally()`
   *     mới cần bump, vì đó là lúc dữ liệu server THẬT SỰ đã đổi và ta muốn đồng bộ lại.
   */
  const updateRoomDraft = (next: RoomPlacement[]) => {
    roomDraftRef.current = next;
    setRoomDraft(next);
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

  /**
   * ⭐ GỘP CẬP NHẬT KÉO-THẢ THEO KHUNG HÌNH — mục 26 (*"Thao tác kéo thả các item rất lag, không
   *    mượt mà gì cả"*).
   *
   * ⚠️ VÌ SAO CẦN: `pointermove` bắn nhanh hơn tốc độ vẽ của màn hình (chuột 125–1000 Hz, ngón
   *   tay ~120 Hz, màn hình 60–120 Hz). Bản cũ gọi `moveDecoration` cho MỖI sự kiện, và mỗi lượt
   *   là một `setState` ⇒ React hoà giải lại cả trang (khung phòng + mọi món đồ + cả khay đồ)
   *   hàng trăm lần mỗi giây. Phần lớn số lần đó bị trình duyệt vứt đi vì chưa tới khung hình kế.
   *
   *   Nay: chỉ GHI LẠI toạ độ mới nhất vào ref (rẻ), và hẹn ĐÚNG MỘT khung hình
   *   (`requestAnimationFrame`). Tới khung hình đó mới `setState` một lần ⇒ số lần React vẽ bằng
   *   số khung hình thật, không phụ thuộc tần số thiết bị.
   *
   * ⚠️ Toạ độ mới nhất LUÔN thắng (không hàng đợi): điều bé thấy phải là vị trí ngón tay HIỆN
   *   TẠI. Xếp hàng các điểm trung gian sẽ làm món đồ "đuổi theo" ngón tay chậm hơn nữa.
   */
  const dragPointRef = useRef<{ itemId: string; x: number; y: number } | null>(null);
  const dragFrameRef = useRef<number | null>(null);

  const scheduleDragMove = (itemId: string, x: number, y: number) => {
    dragPointRef.current = { itemId, x, y };
    if (dragFrameRef.current !== null) return;
    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = null;
      const point = dragPointRef.current;
      if (!point) return;
      moveDecoration(point.itemId, point.x, point.y, false);
    });
  };

  /** Huỷ khung hình đang hẹn — gọi khi kết thúc kéo hoặc khi rời màn hình. */
  const cancelScheduledDragMove = () => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    dragPointRef.current = null;
  };

  useEffect(() => cancelScheduledDragMove, []);

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

  /**
   * Phụ kiện đặt TỰ DO trong phòng — KHÔNG dùng `roomLayout.ts` (làn/band/hộp mặc định).
   *
   * ⭐ VÌ SAO KHÁC ĐỒ TRANG TRÍ: đồ trang trí có một BỐ CỤC MẶC ĐỊNH suy từ danh mục (treo tường
   *   hay đứng làn nào, cỡ bao nhiêu). Phụ kiện thì không — bé bấm một món trong khay là nó rơi
   *   xuống sàn ở một chỗ rải đều, rồi bé tự kéo. Vì vậy hộp của phụ kiện CHỈ có `x/y` thô bé kéo
   *   (đã kẹp biên) và một cỡ cố định — không có phép tra bảng nào.
   */
  const renderAccessoryNode = (
    item: ShopItem,
    placement: RoomPlacement,
    layer: 'back' | 'front',
  ): ReactNode => {
    // Ảnh phụ kiện là 512×512 vuông, và `cqw` = 1% bề rộng khung ⇒ cao = rộng (không méo).
    const side = ROOM_ACCESSORY_WIDTH_CQW;
    // Kẹp biên như đồ trang trí: một toạ độ hỏng (`NaN`) làm `left: NaN%` ⇒ bé mất món không báo.
    const point = clampToRoom(placement.x, placement.y);
    return (
      <button
        key={item.id}
        type="button"
        data-room-accessory={item.id}
        data-room-accessory-layer={layer}
        aria-label={`${item.name_vi}, vị trí ${Math.round(point.x)}%, ${Math.round(point.y)}%. Dùng phím mũi tên để di chuyển.`}
        /*
          ⚠️⚠️ HAI cơ chế cùng quyết định tầng lớp ở đây — đo bằng `elementsFromPoint` trên trình
             duyệt thật, KHÔNG phải suy luận:

             (a) THỨ TỰ CHÈN DOM — do `bottomPct` quyết (`back` = `PET_BOTTOM_PCT - 1` ⇒ vẽ trước;
                 `front` = `PET_BOTTOM_PCT + 1` ⇒ vẽ sau), xem hai vòng lặp dựng `floorNodes`.
             (b) `z-index` — con vật trong phòng nằm trong `<span>` mang `z-[2]` (`PET_Z` của
                 `PetAvatar`), nên nó **LUÔN thắng** `z: auto` của món `back` **bất kể thứ tự DOM**.
                 Chỉ món `front` có `z-10` mới thật sự nổi lên trên.

             ⇒ Hệ quả thực tế: món `back` ở dưới con vật (đúng, ba lô/cánh ở sau lưng); món `front`
               ở trên (đúng). Nhưng đừng tưởng "đổi thứ tự DOM là đổi được tầng" — muốn đổi thì
               phải đổi `z-index`. Đặt `z-10` cho CẢ hai là bẫy: ba lô sẽ đè lên bụng con vật.
        */
        className={cn(
          'absolute flex size-touch -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-kid focus-visible:outline focus-visible:outline-4 focus-visible:outline-brand',
          layer === 'front' && 'z-10',
        )}
        style={{ left: `${point.x}%`, top: `${point.y}%` }}
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
        {/* `shrink-0` + `max-w-none`: xem ghi chú dài trong `renderDecorationNode` — hai lớp đó
            chống đúng cái bệnh "ảnh bị bóp méo trong ô chạm 64px". */}
        <span
          aria-hidden="true"
          className="pointer-events-none block shrink-0"
          style={roomSizeStyle(side, side)}
        >
          <ShopArtwork item={item} className="block h-full w-full max-w-none object-contain" />
        </span>
      </button>
    );
  };

  /**
   * Phụ kiện đã đặt trong phòng, chia THEO THỨ TỰ VẼ quanh con vật.
   *
   * ⭐ VÌ SAO SLOT QUYẾT ĐỊNH LƯỢT VẼ: món ở slot `back` (ba lô, áo choàng, cánh) phải nằm SAU
   *   con vật — chúng ở sau lưng. Mọi slot khác (`head`/`face`/`neck`/`feet`) vẽ SAU con vật.
   *   Vẽ sai lượt thì ba lô đè lên bụng con vật, đọc ra là sai ngay.
   */
  const roomAccessories = ownedAccessories
    .map((item) => ({ item, placement: roomDraft.find((entry) => entry.itemId === item.id) }))
    .filter(
      (entry): entry is { item: ShopItem; placement: RoomPlacement } =>
        entry.placement !== undefined && !entry.placement.hidden,
    );
  const backAccessoryNodes = roomAccessories
    .filter(({ item }) => accessorySlotOf(item) === 'back')
    .map(({ item, placement }) => renderAccessoryNode(item, placement, 'back'));
  const frontAccessoryNodes = roomAccessories
    .filter(({ item }) => accessorySlotOf(item) !== 'back')
    .map(({ item, placement }) => renderAccessoryNode(item, placement, 'front'));

  /**
   * Phụ kiện CHƯA đặt trong phòng — nguồn của KHAY ĐỒ.
   *
   * "Chưa đặt" = KHÔNG có trong `roomDraft`, HOẶC có nhưng `hidden === true`. Nhờ vậy một món bị
   * ẩn vẫn quay lại được khay để bé đặt lại, thay vì kẹt vĩnh viễn ở trạng thái vô hình.
   */
  const trayAccessories = ownedAccessories.filter((item) => {
    const placement = roomDraft.find((entry) => entry.itemId === item.id);
    return placement === undefined || placement.hidden;
  });

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

  /**
   * Phụ kiện slot `back` (ba lô / áo choàng / cánh) nằm SAU lưng con vật ⇒ phải được vẽ TRƯỚC nó.
   *
   * ⭐ Dùng `bottomPct` nhỏ hơn đáy con vật một chút để `sortByBottom` (đáy nhỏ = xa = vẽ trước) tự
   *   đặt chúng vào lượt trước — đây là cách giữ cho khối "Góc phòng" chỉ có MỘT cơ chế sắp thứ tự
   *   chèn (thay vì rải `z-index` khắp nơi).
   *
   * ⚠️ NHƯNG thứ tự chèn KHÔNG phải là thứ duy nhất quyết định tầng lớp: con vật trong phòng nằm
   *    trong `<span>` mang `z-[2]` (`PET_Z` của `PetAvatar`), nên nó thắng `z: auto` của món `back`
   *    bất kể thứ tự DOM. Người kiểm chứng độc lập đã đo bằng `elementsFromPoint` và xác nhận cả
   *    hai cơ chế cùng có tác dụng. Đọc `renderAccessoryNode` để thấy toàn cảnh — đừng sửa một
   *    trong hai chỗ rồi tưởng chỗ kia vô dụng.
   */
  for (const node of backAccessoryNodes) {
    floorNodes.push({ bottomPct: PET_BOTTOM_PCT - 1, node });
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
          ⚠️⚠️ CON VẬT TRONG PHÒNG KHÔNG MẶC PHỤ KIỆN — `items={NO_ITEMS}` là CHỦ Ý (chủ dự án chốt).

          Phụ kiện đã tách ra thành các VẬT THỂ TỰ DO bé kéo thả trong phòng (xem `renderAccessoryNode`
          + khay đồ bên dưới khung). Con vật trong phòng vì thế đứng "trần" — bé tự quyết món nào
          đặt ở đâu, thay vì bị ghép cứng lên người. Thẻ `PetAvatar` ở ĐẦU TRANG (ngoài khung phòng)
          VẪN mặc bộ `equippedItems` như cũ: bé cần thấy "con vật đang mặc gì" ở thẻ hồ sơ; chỉ
          TRONG PHÒNG mới tách rời.

          Vẫn dùng chính `PetAvatar` (KHÔNG vẽ `<img>` trần) — nó là nguồn duy nhất của hình con
          vật theo (con × bậc), và `bare` bỏ thẻ/dải trời/dải cỏ vì khung phòng đã có tường/sàn.
        */}
        <PetAvatar
          petType={snapshot.pet.petType}
          evolutionStage={snapshot.pet.evolutionStage}
          items={NO_ITEMS}
          sizeEm="var(--room-pet-w)"
          frameClassName="size-full"
          bare
        />
      </div>
    ),
  });

  /**
   * Phụ kiện slot khác `back` (mũ / kính / khăn / giày) vẽ SAU con vật ⇒ `bottomPct` lớn hơn đáy
   * con vật. Một đơn vị là đủ để `sortByBottom` xếp chúng ra sau, mà vẫn giữ nguyên thứ tự tương
   * đối giữa các món với nhau (ổn định theo thứ tự danh sách).
   */
  for (const node of frontAccessoryNodes) {
    floorNodes.push({ bottomPct: PET_BOTTOM_PCT + 1, node });
  }

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
          aria-label="Phòng của thú cưng; kéo đồ trang trí và phụ kiện để sắp xếp"
          className="relative aspect-[4/3] w-full overflow-hidden rounded-card border-2 border-line bg-amber-50 [container-type:inline-size]"
          onPointerMove={(event) => {
            const draggingId = event.currentTarget.dataset.dragging;
            if (!draggingId) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const point = clampToRoom(
              ((event.clientX - rect.left) / rect.width) * 100,
              ((event.clientY - rect.top) / rect.height) * 100,
            );
            // ⚠️ `scheduleDragMove` (gộp theo khung hình) chứ KHÔNG `moveDecoration` trực tiếp —
            //    xem ghi chú "GỘP CẬP NHẬT KÉO-THẢ THEO KHUNG HÌNH" ở `scheduleDragMove`.
            scheduleDragMove(draggingId, point.x, point.y);
          }}
          aria-busy={!roomReady || room.isLoading}
          onPointerUp={(event) => {
            if (!event.currentTarget.dataset.dragging) return;
            delete event.currentTarget.dataset.dragging;
            dragStartRef.current = null;
            cancelScheduledDragMove();
            saveRoomDraft();
          }}
          onPointerCancel={(event) => {
            delete event.currentTarget.dataset.dragging;
            const start = dragStartRef.current;
            cancelScheduledDragMove();
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

        {/*
          KHAY ĐỒ — phụ kiện bé SỞ HỮU mà CHƯA đặt trong phòng (chủ dự án chốt: phụ kiện nằm trong
          khay, bé tự kéo vào phòng). Bấm một món ⇒ nó rơi xuống sàn ở vị trí rải đều, rồi bé kéo
          tiếp như đồ trang trí.

          ⚠️ ẨN CẢ KHAY khi rỗng: một khung trống có tiêu đề mà không có món nào đọc ra là "hỏng",
          không phải "bé đã đặt hết rồi". Bé sở hữu 0 phụ kiện cũng vào cùng nhánh này.
        */}
        {trayAccessories.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-kid-sm font-bold text-ink">{t('pet.roomAccessoryTray', { pet: petName })}</p>
            {/*
              ⚠️ `flex-wrap` + `overflow-x-auto`: ở 320px bề rộng, mỗi nút 64px nên ba món đã đầy
              một hàng — không xuống dòng thì khay tràn ngang và đẩy cả trang rộng ra.
            */}
            <div
              role="group"
              aria-label={t('pet.roomAccessoryTray', { pet: petName })}
              className="flex flex-wrap gap-2 overflow-x-auto"
            >
              {trayAccessories.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={!roomReady || room.isLoading || room.placements === null}
                  aria-label={t('pet.roomAccessoryPlace', { item: item.name_vi })}
                  onClick={() => {
                    // Vị trí ỔN ĐỊNH theo chỉ số trong danh sách bé sở hữu — xem `accessoryDropX`.
                    const index = ownedAccessories.findIndex((owned) => owned.id === item.id);
                    moveDecoration(
                      item.id,
                      accessoryDropX(index, ownedAccessories.length),
                      ROOM_ACCESSORY_DROP_Y_PCT,
                    );
                  }}
                  className="flex size-touch shrink-0 items-center justify-center rounded-kid border-2 border-line bg-surface disabled:opacity-60"
                >
                  <ShopArtwork item={item} className="size-9 object-contain" />
                </button>
              ))}
            </div>
          </div>
        )}

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
