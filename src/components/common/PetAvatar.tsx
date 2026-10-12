/**
 * RubyLingo — `PetAvatar`: con thú cưng bé CHỌN, bộ đồ đang mặc và "sân nhà" quanh nó
 * (M6, T065–T066 · T04).
 *
 * ⭐ QUYẾT ĐỊNH C3 — "ĐEO NGƯỜI" (chủ dự án chốt):
 *   Phụ kiện gắn lên ĐÚNG CHỖ trên người con vật (mũ lên đầu, khăn ở cổ, giày dưới chân…).
 *   ⚠️ T04 CHỈ CÒN VẾ "ĐEO NGƯỜI". Vế "BÀY CẢNH" (trang trí xếp hai hàng trời/đất) đã được
 *      CHUYỂN sang khối "Góc phòng của bé" ở `PetHousePage` — nơi bé KÉO THẢ chúng thành vị trí
 *      tự do và vị trí được lưu lên server. `PetAvatar` không còn nhận/vẽ đồ trang trí; nó chỉ
 *      giữ HAI DẢI MÀU `bg-pet-sky`/`bg-pet-ground` làm đường chân trời cho con vật đứng.
 *
 * ⭐⭐ T04 — VÌ SAO VẼ LẠI, VÀ VÌ SAO LÀ BA DẢI (điểm #2 chủ dự án báo):
 *   *"các icon đeo vô con pet cũng khá là thô, lung tung chả đẹp tý nào."*
 *
 *   Bản cũ đặt phụ kiện theo toạ độ của một khung 150×150 TRẮNG TRƠN, cỡ tính bằng **px cứng**
 *   (26–34px). Hai hệ quả:
 *     • Không có gì để mắt bám vào. Một chiếc mũ "lơ lửng" giữa nền trắng đọc ra là một emoji bị
 *       rơi, không phải một chiếc mũ đang đội — vì không có ĐƯỜNG CHÂN TRỜI nào để so.
 *     • Cỡ px cứng không ăn theo cỡ con vật. Con non 84px đội một chiếc mũ 34px (40% thân), con
 *       siêu cấp 124px cũng đội chiếc mũ 34px (27%) ⇒ mũ "tụt" dần khi con lớn lên.
 *
 *   Nay: (a) hai dải `bg-pet-sky` / `bg-pet-ground` cho một đường chân trời để đọc vị trí — mũ
 *   nằm trên trời, giày nằm trên cỏ; (b) cỡ phụ kiện quy theo `em` của ô vuông 200×200
 *   (mà `font-size` của nó ĐỔI THEO BẬC), nên phụ kiện phóng to cùng con vật.
 *
 * ⚠️⚠️ NEO PHỤ KIỆN TÍNH THEO **HỘP `1em` CỦA CON VẬT**, KHÔNG theo khung 200×200 — ĐỌC KỸ.
 *
 *   Bản đầu tiên neo phụ kiện theo `%` của KHUNG 200×200. Sai, và sai theo HAI đường:
 *     ① Con vật là một `<span>` INLINE trong `<div>` thường ⇒ nó trôi về GÓC TRÊN-TRÁI. Đo trên
 *        trình duyệt thật: tâm con vật ở **28,8% / 31,3%** thay vì 50% / 50%. Mọi phụ kiện canh
 *        giữa KHUNG, không canh giữa CON VẬT ⇒ mũ lơ lửng cạnh tai, kính nằm ngang MÁ chứ không
 *        trên mắt, khăn rơi dưới cằm. Đã sửa bằng `flex items-center justify-center`.
 *     ② Kể cả sau khi căn giữa, `%`-của-khung vẫn sai khi con vật LỚN LÊN: `font-size` đổi
 *        (84 → 104 → 124px) nên con vật chiếm 42% → 52% → 62% chiều cao khung, trong khi các con
 *        số `%` đứng yên. Mũ đúng ở bậc `baby` sẽ tụt xuống ngang mắt ở bậc `super`.
 *
 *   Nay con vật sống trong một HỘP `1em × 1em` (chính là ô chữ của nó), và MỌI phụ kiện neo theo
 *   hộp đó. Neo bằng `%`-của-hộp-`1em` khiến **vị trí cùng lớn lên với con vật** — không cần một
 *   bảng tra nào theo bậc. Còn SỐ của `%` ấy là của TỪNG ẢNH (`petAnchors.ts`), không dùng chung.
 *
 * ⚠️ Khung 200×200 vẫn CỐ ĐỊNH, và vẫn cần: nó cho con vật một khoảng thở đủ rộng và giữ cho
 *   `1em` ổn định ở mọi bề rộng màn hình.
 *
 * ⚠️ MỌI VỊ TRÍ ĐẾN TỪ DỮ LIỆU (`shop-items.json` → `slot`), KHÔNG TỪ MỘT BẢNG TRA TRONG TỆP NÀY.
 *   Còn "mũ thuộc vị trí nào" là câu hỏi DỮ LIỆU, và nó nằm trong JSON, nơi `shopItemsFileSchema`
 *   từ chối một phụ kiện thiếu `slot`. Nhờ vậy thêm một chiếc mũ mới = sửa JSON, không sửa tệp này.
 *   ⚠️ Ba trục vẫn nằm trong tệp này vì chúng là câu hỏi THỊ GIÁC, không phải danh mục:
 *      `ACCESSORY_Z` (tầng chồng), thứ tự hai lượt vẽ quanh con vật, và cách canh hộp vào neo.
 *
 * ⚠️ COMPONENT "CÂM" — như `ShopItemCard`: nó không đọc store, không gọi mạng. Ba lý do:
 *     • Kiểm thử được mọi tổ hợp đồ mà không phải dựng `rewardStore` + mock mạng.
 *     • Không có đường nào để phần vẽ tự ý mua hay mặc đồ.
 *     • `PetAvatar` sẽ còn được dùng ở màn kết quả và màn Bộ sưu tập sau này — nơi không có
 *       `shopStore`.
 *
 * ⚠️ KHÔNG hiển thị mức ❤️ Ở ĐÂY: `HeartMeter` (thanh trên) là chủ duy nhất của "con vật đang vui
 *    thế nào". Vẽ lại ở đây là hai nguồn cho cùng một sự thật, và chúng sẽ lệch nhau đúng vào lúc
 *    bé vừa cho ăn.
 *
 * ⭐ T066 — GIAI ĐOẠN TIẾN HOÁ: component này **không tự suy** giai đoạn từ số từ (nó không có số
 *    từ, và không nên có). Server đếm từ rồi trả về một ID (`pet.evolutionStage`); ở đây chỉ tra
 *    ID đó ra `{ name_vi, icon }`. Client tự đếm từ là mở đường cho hai bên nói hai giai đoạn
 *    khác nhau.
 *
 * ⭐ T04 — CON NÀO: cùng khuôn mẫu, và cùng lý do. `petType` do SERVER phân giải (`readPet` biến
 *    `NULL`/id lạ thành `DEFAULT_PET_ID`), nên ở đây luôn có một con hợp lệ. Component KHÔNG nhận
 *    `petChosen` — "bé đã chọn chưa" là câu hỏi của MÀN NHÀ (`PetHousePage` dùng nó để mời bé
 *    chọn), không phải của phần vẽ. Một prop mà component không bao giờ đọc là một lời nói dối
 *    trong bản hợp đồng của nó.
 *
 * ⚠️⚠️ TÊN CON VẬT LẤY TỪ `petNameVi(petType)`, **KHÔNG** nhận qua prop.
 *   Bản cũ nhận `petName` từ người gọi, và người gọi truyền `t('pet.name')` = `"Momo"` — hằng số.
 *   Khi bé chọn "Mèo Miu" thì nhãn đọc lên vẫn nói "Momo đang dùng: …", vì không ai bắt được sự
 *   lệch đó. Suy từ `petType` ở đây khiến tên con vật và hình con vật **không thể** nói khác nhau.
 *
 * ⚠️ KHÔNG dùng `style={{ transform: … }}` để xê dịch các lớp: Tailwind đặt vị trí bằng chính
 *    thuộc tính `transform`, nên một `transform` inline sẽ ĐÈ SẠCH lớp `-translate-x-1/2` và mọi
 *    thứ lệch đi trong im lặng. Đúng cái bẫy đã trả giá ở T056. Nhiều món cùng một vị trí thì
 *    chúng tự xếp cạnh nhau bằng `flex` — không cần phép tính nào.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { stageDefinition } from '@shared/content/levels.js';
import { petEmojiFor, petNameVi } from '@shared/content/pets.js';
import { accessorySlotOf } from '@shared/content/shop.js';
import { ACCESSORY_SLOTS } from '@shared/pet-slots.js';
import type { AccessorySlot, EvolutionStage, PetType, ShopItem } from '@shared/types/reward.js';

import {
  accessoryBox,
  accessoryFitOf,
  DEFAULT_ACCESSORY_INK,
  defaultKindForSlot,
} from '../../lib/accessoryFit.js';
import { cn } from '../../lib/cn.js';
import { petArtworkUrl } from '../../lib/petArtwork.js';
import { petAnchorFor } from '../../lib/petAnchors.js';
import type { PetAnchor } from '../../lib/petAnchors.js';
import { ShopArtwork } from '../../lib/shopArtwork.js';

/**
 * Momo "mặc định" — dùng làm hình ĐẠI DIỆN cho trạng thái CHƯA BIẾT gì (đang nạp).
 *
 * ⚠️ KHÔNG còn là hình của linh vật khi đã có dữ liệu: `PetAvatar` vẽ theo `petType` (con bé chọn)
 *    × `evolutionStage` do server trả — xem `petEmojiFor`. Hằng này chỉ còn cho `EmptyState` lúc
 *    chưa nạp xong, khi CHƯA biết bé đang có con nào.
 *
 * Xuất ra ngoài để màn hình chỉ có MỘT chỗ biết mặt Momo: hai chỗ tự khai hai emoji là hai chỗ
 * để lệch nhau.
 */
export const MOMO_ICON = '🐵';

/**
 * Cỡ con vật theo bậc tiến hoá — đặt `font-size` lên chính ô vuông 200×200.
 *
 * ⭐ HAI VIỆC TRONG MỘT DÒNG: `font-size` này vừa là cỡ của ảnh con vật (nó cao `1em`), vừa là
 *   ĐƠN VỊ GỐC cho mọi thứ quanh nó: hộp `1em × 1em` (hệ toạ độ của neo), bóng dưới chân, tia ✨
 *   của bậc Siêu cấp. Neo trong `petAnchors.ts` là `%`-của-hộp-`1em`, nên vị trí VÀ kích cỡ phụ
 *   kiện cùng lớn lên với con vật mà không cần một bảng tra nào theo bậc.
 */
const STAGE_TEXT_SIZE: Record<EvolutionStage, string> = {
  baby: 'text-[84px]',
  adult: 'text-[104px]',
  super: 'text-[124px]',
};

/**
 * ⚠️ KHUNG `1em` LÀ HỆ TOẠ ĐỘ DUY NHẤT; CÒN "ĐẦU/CỔ/MẮT NẰM Ở ĐÂU **TRONG** KHUNG ĐÓ" LÀ DỮ LIỆU
 *    ĐO ĐƯỢC, nằm trong `src/lib/petAnchors.ts` — KHÔNG phải một bảng hằng số trong tệp này.
 *
 *   Bản trước giữ ở đây hai bảng dùng chung cho CẢ 18 ảnh (`ACCESSORY_ANCHOR` +
 *   `ACCESSORY_TEXT_SIZE`), kèm một chú thích SAI số liệu ảnh (ghi 1024×1024). Số đo thật của 18
 *   ảnh `public/assets/pets/*.webp`: **512×512**, mực (pixel không trong suốt) rộng **43,9%–66,8%**,
 *   cao **94,1%–98,8%** — KHÔNG đồng nhất. Cụ thể: tâm thân `cx` 0,4365–0,5566 (trên hộp 84px là
 *   lệch ±5px mỗi bên) và đường MẮT ở 9,1%–27,0% chiều cao hộp. Một con số `top-[-45%]` cho kính
 *   không thể đúng cho mọi con ⇒ kính nằm ngang MÁ hoặc trên TRÁN (lệch tới 44px ≈ 52% hộp) —
 *   đúng lời chủ dự án: *"mua cái mắt kính, đeo vào là sát vào mặt"*. Nay mỗi (con × bậc) có neo
 *   riêng, và cỡ món quy theo MỰC THẬT của chính ảnh phụ kiện (`src/lib/accessoryFit.ts`).
 *   Tệp này chỉ còn: tầng vẽ, thứ tự chồng, và "đặt hộp vào neo".
 */

/**
 * Thứ tự chồng lớp (`z-index`) — ĐÂY LÀ THỨ QUYẾT ĐỊNH "ĐEO LÊN TRÔNG CÓ THẬT KHÔNG".
 *
 * ⚠️⚠️ NẾU CON VẬT NẰM TRÊN MỌI PHỤ KIỆN THÌ KÍNH BỊ CHÔN SAU ĐẦU.
 *   Bản đầu tiên của T04 cho con vật `z-[1]` và để mọi phụ kiện không có `z` — nghĩa là kính
 *   `face` (món DUY NHẤT phải nằm TRƯỚC mặt) bị con vật che mất. Trên màn hình điều đó đọc ra là
 *   "bé mặc kính rồi mà không thấy kính", và không cổng nào bắt được: jsdom không tính `z-index`.
 *
 *   外层 stacking context 明确划分为：背部配饰 < 宠物 < 前景配饰；每个槽位内再由商品顺序
 *   决定遮挡关系。背部槽位本身不设 z-index，避免内层 z-index 越过背部 wrapper。
 */
const ACCESSORY_Z: Record<AccessorySlot, string> = {
  back: '',
  feet: 'z-[3]',
  head: 'z-[3]',
  neck: 'z-[3]',
  face: 'z-[4]',
};

/** Con vật nằm giữa: trên `back` (áo choàng/cánh ở sau lưng), dưới mọi thứ đeo trước người. */
const PET_Z = 'z-[2]';

export interface PetAvatarProps {
  /**
   * Con thú cưng bé đã chọn (`pet.petType`) — ĐÃ được server phân giải, **không bao giờ null**.
   *
   * ⚠️ Truyền ID, KHÔNG truyền emoji hay tên: hình và tên đều tra từ `shared/content/pets.json`
   *    qua `petEmojiFor`/`petNameVi`. Truyền emoji vào đây là mở đường cho màn hình vẽ một con
   *    trong khi nhãn đọc lên nói một con khác.
   */
  petType: PetType;
  /**
   * Giai đoạn tiến hoá do SERVER trả (`pet.evolutionStage`).
   *
   * ⚠️ Truyền ID, không truyền số từ: client **không** được tự đếm từ rồi tự suy giai đoạn — nếu
   *    làm vậy thì máy bé và server có thể nói hai giai đoạn khác nhau, và không có cách nào biết
   *    cái nào đúng. Server là trọng tài; component này chỉ tra id ra `{ name_vi, icon }`.
   */
  evolutionStage: EvolutionStage;
  /**
   * Các món ĐANG mặc / ĐANG bày — người gọi tự lọc `equipped === true`.
   *
   * Đồ ăn trong danh sách này bị BỎ QUA: `accessorySlotOf`/`decorationSlotOf` trả `null`. Đó là
   * chủ ý — đồ ăn bị tiêu khi cho ăn, nên "con vật đang đội một quả chuối" sẽ sớm thành một món
   * đồ không còn tồn tại.
   */
  items: readonly ShopItem[];
  className?: string;
}

export function PetAvatar({ petType, evolutionStage, items, className }: PetAvatarProps) {
  const { t } = useTranslation();

  /** Tên con vật — tra từ DỮ LIỆU, không nhận qua prop (xem ghi chú đầu tệp). */
  const petName = petNameVi(petType);

  /** Hình con vật theo (con × bậc) — tra từ DỮ LIỆU, không từ bảng tra trong tệp này. */
  const petIcon = petEmojiFor(petType, evolutionStage);

  /** Tên giai đoạn, tra từ DỮ LIỆU (`xp-levels.json`). */
  const stage = stageDefinition(evolutionStage);

  /**
   * Chia phụ kiện theo vị trí. Dùng `Map` để một vị trí có thể có NHIỀU món (bé mặc cả nơ và
   * vương miện — server không cấm, và CẤM là trái luật "không lấy gì của bé": tự bỏ chiếc nơ ra
   * khi bé đội vương miện chính là lấy đi một thứ bé đã mua).
   */
  const worn = useMemo(() => {
    const map = new Map<AccessorySlot, ShopItem[]>();
    for (const item of items) {
      const slot = accessorySlotOf(item);
      if (slot === null) continue;
      const list = map.get(slot);
      if (list === undefined) {
        map.set(slot, [item]);
      } else {
        list.push(item);
      }
    }
    return map;
  }, [items]);

  /**
   * Nhãn cho trình đọc màn hình.
   *
   * ⚠️ Toàn bộ ảnh/emoji bên trong đều `aria-hidden`, nên nếu không có nhãn này thì bé khiếm thị
   *    nghe được ĐÚNG MỘT chữ cái rời rạc hoặc không gì cả — trong khi cả màn hình vừa đổi vì bé
   *    vừa mua một món đồ mới. Sự thay đổi ấy phải nghe được.
   *
   * Thứ tự đọc theo `ACCESSORY_SLOTS` (không theo thứ tự túi đồ) để câu văn ổn định giữa các
   * lần mua.
   *
   * ⚠️ ĐỒ TRANG TRÍ KHÔNG CÒN ĐƯỢC ĐỌC Ở ĐÂY — và đó là sửa một lời nói dối. Trang trí nay nằm
   *    trong khối "Góc phòng của bé" (`PetHousePage`), nơi bé KÉO THẢ chúng; `PetAvatar` chỉ nhận
   *    phụ kiện (người gọi lọc `decorationSlotOf(item) === null`). Bản trước vẫn có nhánh nhãn
   *    "Quanh nhà có …" cho những món **không hề được vẽ** trong khối này — nhãn nói có mà mắt
   *    không thấy gì. Xem `scenery` đã bị xoá ở dưới.
   */
  const wearingNames = ACCESSORY_SLOTS.flatMap((slot) =>
    (worn.get(slot) ?? []).map((item) => item.name_vi),
  );

  const labelParts: string[] = [];
  if (wearingNames.length > 0) {
    labelParts.push(t('pet.sceneWearing', { pet: petName, items: wearingNames.join(', ') }));
  }
  if (labelParts.length === 0) {
    labelParts.push(t('pet.sceneBare', { pet: petName }));
  }

  /** Neo của ĐÚNG con × bậc đang hiện. Thiếu dữ liệu ⇒ `DEFAULT_PET_ANCHOR` (không ném lỗi). */
  const anchor = petAnchorFor(petType, evolutionStage);

  const isSuper = evolutionStage === 'super';

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/*
        Khối "sân nhà" mang `role="img"` + nhãn đọc lên. ⚠️ Mọi thứ BÊN TRONG nó đều bị coi là
        trang trí (con của `role="img"` không được đọc), nên chú thích giai đoạn phải nằm NGOÀI
        khối này — xem thẻ `<p>` ngay dưới.
      */}
      <div
        role="img"
        aria-label={labelParts.join('. ')}
        className={cn(
          // `bg-surface-raised` là nền của DẢI GIỮA (khoảng trời–đất mà con vật đứng trong đó).
          // Thiếu nó thì dải giữa trong suốt, và ba dải trông như hai mẩu giấy dán lên nền trang.
          'relative flex flex-col overflow-hidden rounded-card border-2 border-line bg-surface-raised',
          // Bậc "Siêu cấp" có quầng sáng quanh khung — dấu hiệu thị giác cho đỉnh tiến hoá, đọc
          // được cả khi bé chưa nhận ra emoji đã đổi.
          isSuper && 'shadow-super',
        )}
      >
        {/*
          DẢI 1 — TRỜI. Đường chân trời để mắt đọc được "mũ nằm ở trên".

          ⚠️ Đây chỉ còn là DẢI MÀU, không còn là hàng chứa đồ trang trí. Bản trước nó là
             `SceneryRow` — một `<ul>` LUÔN render 0 phần tử ở production, vì `PetHousePage` lọc
             `decorationSlotOf(item) !== null` ra khỏi `items` (trang trí nay nằm trong khối "Góc
             phòng của bé", nơi bé kéo thả). Cơ chế đó không vẽ được gì mà vẫn giữ cửa cho một
             đường vẽ thứ hai của cùng một dữ liệu; đã xoá hẳn. Dải màu GIỮ LẠI vì nó là đường
             chân trời — thứ đã được chốt ở "QUYẾT ĐỊNH C3" và không liên quan tới phụ kiện.
        */}
        <div aria-hidden="true" className="bg-pet-sky px-3 pt-2 pb-1" />

        {/*
          KHUNG CỐ ĐỊNH 200×200 — khoảng thở cho con vật, và giữ `1em` ổn định ở mọi bề rộng.
          Bên trong nó là HỘP `1em × 1em` của con vật, và đó mới là hệ toạ độ của phụ kiện.

          ⚠️⚠️ `flex items-center justify-center` LÀ BẮT BUỘC — KHÔNG ĐƯỢC GỠ.
            Con vật là một `<span>` INLINE. Trong một `<div>` thường nó trôi về GÓC TRÊN-TRÁI —
            đo trên trình duyệt thật (Playwright/Chromium): tâm con vật ở **28,8% / 31,3%** thay vì
            50% / 50%. Hệ quả đo được: mũ lơ lửng cạnh tai, kính nằm ngang MÁ chứ không trên mắt,
            khăn rơi dưới cằm, giày cách xa chân — đúng lời chủ dự án: *"các icon đeo vô con pet
            cũng khá là thô, lung tung"*. Tiêm `display:flex; align-items:center; justify-content:
            center` vào ô (chỉ sửa DOM sống) đưa tâm con vật về **50% / 50%** và mọi món rơi đúng
            người ngay lập tức.
        */}
        <div
          className={cn(
            'relative mx-auto flex size-[200px] shrink-0 items-center justify-center',
            STAGE_TEXT_SIZE[evolutionStage],
          )}
        >
          {/*
            HỘP `1em × 1em` — CHÍNH LÀ Ô CHỮ CỦA CON VẬT, và là HỆ TOẠ ĐỘ DUY NHẤT của phụ kiện.
            `1em` = `font-size` của khung cha (84 / 104 / 124px theo bậc), nên hộp này lớn lên cùng
            con vật; neo `%`-của-hộp vì thế cùng lớn lên. Số neo là **của riêng từng ảnh** — xem
            `petAnchorFor` trong `src/lib/petAnchors.ts` (KHÔNG còn bảng dùng chung ở tệp này).

            ⚠️ Không đặt `overflow: hidden` ở đây: mũ phải nhô lên trên đỉnh đầu và ba lô phải thò
               ra ngoài sườn (cả hai đều có toạ độ ÂM).
          */}
          <div className="relative flex size-[1em] items-center justify-center">
            {/*
              Bóng ellipse dưới chân — NEO thị giác, cho con vật một mặt đất để đứng lên.
              Cỡ tính bằng `em` (không phải px) để bóng lớn lên cùng con vật: một cái bóng 90px cố
              định dưới một con `super` 124px trông như một vết bẩn rời rạc.
            */}
            <span
              aria-hidden="true"
              className="absolute bottom-[0%] left-1/2 z-0 h-[0.10em] w-[1.05em] -translate-x-1/2 rounded-pill bg-pet-shadow"
            />

            {/*
              Wrapper duy nhất tạo stacking context cho phụ kiện sau lưng. Slot `back` bên trong
              không có z-index riêng, để z-index từng món chỉ quyết định thứ tự trong cùng slot.
            */}
            <div
              aria-hidden="true"
              data-accessory-layer="behind"
              className="pointer-events-none absolute inset-0 z-[1]"
            >
              <AccessoryLayers slots={ACCESSORY_SLOTS} worn={worn} only="behind" anchor={anchor} />
            </div>

            {/*
              Con vật. Cỡ = `font-size` của khung cha (84/104/124px), ảnh thừa hưởng qua `1em`.
              ⚠️ `relative` cần thiết: nó giữ con vật trong ngữ cảnh xếp lớp của hộp để `z-[2]` có
                 hiệu lực (trên `back`, dưới `feet/head/neck/face`).
            */}
            <span aria-hidden="true" className={cn('relative leading-none', PET_Z)}>
              <PetArtwork petType={petType} evolutionStage={evolutionStage} fallback={petIcon} />
            </span>

            {/* Phụ kiện ĐEO TRƯỚC NGƯỜI (giày, mũ, khăn, kính). */}
            <div
              aria-hidden="true"
              data-accessory-layer="front"
              className="pointer-events-none absolute inset-0 z-[3]"
            >
              <AccessoryLayers slots={ACCESSORY_SLOTS} worn={worn} only="inFront" anchor={anchor} />
            </div>

            {/* Dấu "Siêu cấp": tia sáng ở góc trên phải. Cỡ bằng `em` để lớn lên cùng con vật.
                `animate-pulse` đã bị tắt sẵn dưới `prefers-reduced-motion` (xem `tokens.css`). */}
            {isSuper && (
              <span
                aria-hidden="true"
                className="absolute right-[2%] top-[-4%] animate-pulse text-[0.34em] leading-none"
              >
                ✨
              </span>
            )}
          </div>
        </div>

        {/* DẢI 2 — ĐẤT / CỎ. Cùng lý do như DẢI 1: chỉ còn là dải màu, không còn hàng trang trí. */}
        <div aria-hidden="true" className="bg-pet-ground px-3 pt-1 pb-2" />
      </div>

      {/*
        Chú thích giai đoạn — chữ THẬT, nằm NGOÀI khối `role="img"` (con của nó bị coi là trang trí
        nên sẽ không được đọc). Bé thấy chữ này, và trình đọc màn hình cũng đọc nó.

        ⚠️ Tên giai đoạn lấy từ `xp-levels.json` (`🐣 Nhóc con`, `🐵 Trưởng thành`, `✨ Siêu cấp`),
        **KHÔNG** từ i18n — cùng lý do như tên tiền tệ ở màn Cửa hàng: khai lại là tạo nguồn sự
        thật thứ hai, và nó sẽ lệch nhau đúng vào ngày ai đó sửa JSON.
      */}
      <p className="text-center text-kid-xs font-bold text-ink-soft">{stage.name_vi}</p>
    </div>
  );
}

/**
 * Vẽ các lớp phụ kiện theo ĐÚNG một tầng chồng (`behind` = sau lưng, `inFront` = trước người).
 *
 * ⚠️ VÌ SAO TÁCH THÀNH HAI LƯỢT GỌI QUANH CON VẬT, thay vì một vòng lặp duy nhất:
 *    Thứ tự chồng lớp ở đây KHÔNG đi theo thứ tự trong `ACCESSORY_SLOTS` — con vật chen vào giữa.
 *    Một vòng lặp duy nhất sẽ phải biết "chèn con vật vào đâu", tức là logic vẽ bị trộn với logic
 *    dữ liệu. Hai lượt gọi nói thẳng ra thứ tự bằng chính cấu trúc DOM.
 *
 * ⚠️ MỘT `<span>` CHO MỖI VỊ TRÍ (không phải mỗi món) — giữ nguyên cơ chế cũ: slot wrapper là
 *    `absolute inset-0` phủ đúng hộp `1em`, và nó KHÔNG BAO GIỜ bỏ món nào của bé.
 *
 * ⚠️ NHƯNG MỖI MÓN có HỘP RIÊNG (`accessoryBox`): ba món của slot `head` (mũ / vương miện / nơ)
 *    có cỡ mực và cao độ khác nhau, và cả 10 ảnh phụ kiện có độ "đầy" khác nhau (72%–98%). Dùng
 *    chung một hộp `1,65em × 1,35em` như bản cũ là nguồn của "món to món nhỏ tuỳ ảnh".
 *    Cấu trúc DOM:
 *      slot wrapper (`absolute inset-0`, z theo slot)
 *        └ món (`data-accessory-id`, `absolute inset-0`, lệch nhẹ ổn định khi cùng slot)
 *            └ HỘP (`left/top/width/height` tính từ neo + tỷ lệ mực, canh tâm bằng translate)
 *                └ `ShopArtwork`
 *
 * ⚠️ Thứ tự lớp trong `back` KHÔNG được đặt z-index lên slot wrapper: nó sẽ nhốt z-index của các
 *    món con lại và phá hợp đồng "slot back nằm sau con vật". Xem `ACCESSORY_Z`.
 */
function PetArtwork({
  petType,
  evolutionStage,
  fallback,
}: {
  petType: PetType;
  evolutionStage: EvolutionStage;
  fallback: string;
}) {
  const source = petArtworkUrl(petType, evolutionStage);
  if (!source) return <>{fallback}</>;

  return (
    <>
      <img
        src={source}
        alt=""
        draggable={false}
        className="pointer-events-none h-[1em] w-[1em] select-none object-contain"
        onError={(event) => {
          event.currentTarget.hidden = true;
          event.currentTarget.nextElementSibling?.removeAttribute('hidden');
        }}
      />
      <span hidden>{fallback}</span>
    </>
  );
}

function AccessoryLayers({
  slots,
  worn,
  only,
  anchor,
}: {
  slots: readonly AccessorySlot[];
  worn: Map<AccessorySlot, ShopItem[]>;
  only: 'behind' | 'inFront';
  /** Neo của con × bậc đang hiện (`petAnchorFor`) — nguồn toạ độ duy nhất. */
  anchor: PetAnchor;
}) {
  return (
    <>
      {slots.map((slot) => {
        const isBehind = slot === 'back';
        if (only === 'behind' ? !isBehind : isBehind) return null;

        const list = worn.get(slot);
        if (list === undefined || list.length === 0) return null;

        return (
          <span
            key={slot}
            aria-hidden="true"
            data-accessory-slot={slot}
            className={cn('absolute inset-0 leading-none', ACCESSORY_Z[slot])}
          >
            {list.map((item, index) => {
              const offset = index - (list.length - 1) / 2;
              const zIndex = list.length - index;
              /**
               * ⚠️ Món chưa khai tỷ lệ mực ⇒ `DEFAULT_ACCESSORY_INK` (mực đầy hộp) + kiểu đặt suy
               *    từ `slot`. Món vẫn HIỆN, chỉ kém chuẩn — không được biến mất khỏi người bé.
               */
              const fit = accessoryFitOf(item.id);
              const kind = fit?.kind ?? defaultKindForSlot(slot);
              const box = accessoryBox(kind, anchor, fit?.ink ?? DEFAULT_ACCESSORY_INK);
              return (
                <span
                  key={item.id}
                  aria-hidden="true"
                  data-accessory-id={item.id}
                  data-accessory-kind={kind}
                  /*
                   * ⚠️ Neo CSS đặt bằng `style` (số đo được, khác nhau từng con × bậc), nhưng
                   *    KHÔNG được đặt `transform` ở đây: hộp con canh tâm bằng lớp
                   *    `-translate-x-1/2 -translate-y-1/2`, và một `transform` inline sẽ ĐÈ SẠCH nó
                   *    (đúng cái bẫy đã trả giá ở T056). Lệch nhẹ khi cùng slot nằm ở lớp NGOÀI
                   *    CÙNG của món — nơi `transform` đứng một mình.
                   */
                  className="absolute inset-0 leading-none"
                  style={{
                    transform: `translateX(${offset * 0.16}em) translateY(${Math.abs(offset) * 0.08}em)`,
                    zIndex,
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="absolute block -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${box.cx * 100}%`,
                      top: `${box.cy * 100}%`,
                      width: `${box.side * 100}%`,
                      height: `${box.side * 100}%`,
                    }}
                  >
                    <ShopArtwork item={item} className="h-full w-full object-contain" />
                  </span>
                </span>
              );
            })}
          </span>
        );
      })}
    </>
  );
}
