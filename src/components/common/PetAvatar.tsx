/**
 * RubyLingo — `PetAvatar`: con thú cưng bé CHỌN, bộ đồ đang mặc và "sân nhà" quanh nó
 * (M6, T065–T066 · T04).
 *
 * ⭐ QUYẾT ĐỊNH C3 — "ĐEO NGƯỜI + BÀY CẢNH" (chủ dự án chốt):
 *   Phụ kiện gắn lên ĐÚNG CHỖ trên người con vật (mũ lên đầu, khăn ở cổ, giày dưới chân…), còn
 *   trang trí được bày thành hai hàng: bầu trời ở trên, mặt đất ở dưới. Vì sao không toạ độ tuyệt
 *   đối cho từng món: trên laptop sẽ đẹp hơn, nhưng trên iPhone 320px thì chồng nhau và tràn ra
 *   ngoài — mà "vỡ trên máy của bé" là hỏng thật.
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
 *   nằm trên trời, giày nằm trên cỏ; (b) cỡ phụ kiện tính bằng **`em`**, con của ô vuông 200×200
 *   (mà `font-size` của nó ĐỔI THEO BẬC), nên phụ kiện phóng to cùng con vật.
 *
 * ⚠️⚠️ Ô VUÔNG 200×200 LÀ CỐ ĐỊNH, VÀ ĐÓ LÀ ĐIỀU KIỆN ĐỂ MỌI TOẠ ĐỘ `%` ĐÚNG.
 *   Neo phụ kiện là `left-[36%] top-[10%]` — phần trăm của KHUNG CHỨA. Nếu khung co giãn theo bề
 *   rộng màn hình, mũ vẫn nằm đúng theo tỉ lệ, nhưng CỠ phụ kiện (`em`) thì không, vì `em` ăn
 *   theo `font-size` chứ không theo bề rộng. Kết hợp lại: trên màn hẹp, mũ to quá; trên màn rộng,
 *   mũ bé quá. Một khung cố định khiến tỉ lệ `%` và cỡ `em` luôn khớp nhau ở mọi thiết bị.
 *
 * ⚠️ MỌI VỊ TRÍ ĐẾN TỪ DỮ LIỆU (`shop-items.json` → `slot`), KHÔNG TỪ MỘT BẢNG TRA TRONG TỆP NÀY.
 *   Tệp này chỉ trả lời "vị trí `head` nằm ở đâu trên khung vẽ" — câu hỏi THỊ GIÁC. Còn "mũ thuộc
 *   vị trí nào" là câu hỏi DỮ LIỆU, và nó nằm trong JSON, nơi `shopItemsFileSchema` từ chối một
 *   phụ kiện thiếu `slot`. Nhờ vậy thêm một chiếc mũ mới = sửa JSON, không sửa tệp này.
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
import { accessorySlotOf, decorationSlotOf } from '@shared/content/shop.js';
import { ACCESSORY_SLOTS, DECORATION_SLOTS } from '@shared/pet-slots.js';
import type {
  AccessorySlot,
  DecorationSlot,
  EvolutionStage,
  PetType,
  ShopItem,
} from '@shared/types/reward.js';

import { cn } from '../../lib/cn.js';

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
 * ⭐ HAI VIỆC TRONG MỘT DÒNG: `font-size` này vừa là cỡ của emoji con vật (nó thừa hưởng), vừa là
 *   ĐƠN VỊ GỐC cho cỡ phụ kiện (`text-[0.30em]` = 30% cỡ con vật). Đó là lý do phụ kiện tự lớn
 *   theo con vật mà không cần một phép tính nào.
 */
const STAGE_TEXT_SIZE: Record<EvolutionStage, string> = {
  baby: 'text-[84px]',
  adult: 'text-[104px]',
  super: 'text-[124px]',
};

/**
 * Vị trí của từng lớp phụ kiện, tính theo `%` của ô vuông 200×200.
 *
 * ⭐ MỌI VỊ TRÍ DÙNG `left-1/2 -translate-x-1/2` để tự căn giữa, TRỪ `back`: áo choàng / cánh /
 *   ba lô nằm LỆCH VỀ MỘT BÊN, vì chúng vẽ SAU con vật trong DOM (⇒ nằm trên) — để chính giữa thì
 *   chúng che mất mặt bạn ấy.
 *
 * ⚠️ Nhiều món cùng một vị trí ⇒ chúng nằm trong CÙNG một `<span class="absolute flex gap-0.5">`
 *    và tự xếp cạnh nhau. Đây là toạ độ của CẢ NHÓM, không phải của từng món — nhờ vậy không bao
 *    giờ có món nào bị bỏ rơi ngoài khung (bỏ món của bé = lấy đồ của bé, luật cấm số một).
 */
const ACCESSORY_ANCHOR: Record<AccessorySlot, string> = {
  back: 'left-[2%] top-[28%]',
  feet: 'bottom-[4%] left-1/2 -translate-x-1/2',
  head: 'top-[10%] left-1/2 -translate-x-1/2',
  neck: 'top-[66%] left-1/2 -translate-x-1/2',
  face: 'top-[40%] left-1/2 -translate-x-1/2',
};

/** Cỡ từng lớp, theo `em` của ô vuông (⇒ ăn theo bậc tiến hoá). Mũ to hơn kính, giày nhỏ hơn. */
const ACCESSORY_TEXT_SIZE: Record<AccessorySlot, string> = {
  back: 'text-[0.33em]',
  feet: 'text-[0.25em]',
  head: 'text-[0.30em]',
  neck: 'text-[0.25em]',
  face: 'text-[0.27em]',
};

/**
 * Thứ tự chồng lớp (`z-index`) — ĐÂY LÀ THỨ QUYẾT ĐỊNH "ĐEO LÊN TRÔNG CÓ THẬT KHÔNG".
 *
 * ⚠️⚠️ NẾU CON VẬT NẰM TRÊN MỌI PHỤ KIỆN THÌ KÍNH BỊ CHÔN SAU ĐẦU.
 *   Bản đầu tiên của T04 cho con vật `z-[1]` và để mọi phụ kiện không có `z` — nghĩa là kính
 *   `face` (món DUY NHẤT phải nằm TRƯỚC mặt) bị con vật che mất. Trên màn hình điều đó đọc ra là
 *   "bé mặc kính rồi mà không thấy kính", và không cổng nào bắt được: jsdom không tính `z-index`.
 *
 *   Bảng dưới đây chia 3 tầng: sau lưng con vật (`back`) < con vật < mọi thứ đeo TRƯỚC người
 *   (`feet`/`head`/`neck`), và `face` trên cùng (kính luôn phủ mặt).
 */
const ACCESSORY_Z: Record<AccessorySlot, string> = {
  back: 'z-[1]',
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

  const scenery = useMemo(() => {
    const map = new Map<DecorationSlot, ShopItem[]>();
    for (const item of items) {
      const slot = decorationSlotOf(item);
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
   * ⚠️ Toàn bộ emoji bên trong đều `aria-hidden`, nên nếu không có nhãn này thì bé khiếm thị nghe
   *    được ĐÚNG MỘT chữ cái rời rạc hoặc không gì cả — trong khi cả màn hình vừa đổi vì bé vừa
   *    mua một món đồ mới. Sự thay đổi ấy phải nghe được.
   *
   * Thứ tự đọc theo `ACCESSORY_SLOTS`/`DECORATION_SLOTS` (không theo thứ tự túi đồ) để câu văn
   * ổn định giữa các lần mua.
   */
  const wearingNames = ACCESSORY_SLOTS.flatMap((slot) =>
    (worn.get(slot) ?? []).map((item) => item.name_vi),
  );
  const sceneryNames = DECORATION_SLOTS.flatMap((slot) =>
    (scenery.get(slot) ?? []).map((item) => item.name_vi),
  );

  const labelParts: string[] = [];
  if (wearingNames.length > 0) {
    labelParts.push(t('pet.sceneWearing', { pet: petName, items: wearingNames.join(', ') }));
  }
  if (sceneryNames.length > 0) {
    labelParts.push(t('pet.sceneScenery', { items: sceneryNames.join(', ') }));
  }
  if (labelParts.length === 0) {
    labelParts.push(t('pet.sceneBare', { pet: petName }));
  }

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
        {/* DẢI 1 — TRỜI. Đường chân trời để mắt đọc được "mũ nằm ở trên". */}
        <SceneryRow items={scenery.get('sky')} className="bg-pet-sky px-3 pt-2 pb-1" />

        {/*
          Ô VUÔNG CỐ ĐỊNH 200×200. Cỡ cố định là có chủ ý: neo phụ kiện tính theo `%` của ô này,
          còn cỡ phụ kiện tính theo `em` (⇒ theo `font-size` của ô). Hai đơn vị khác nhau chỉ khớp
          nhau khi ô có một kích thước xác định — xem ghi chú đầu tệp.

          ⚠️⚠️ `flex items-center justify-center` LÀ BẮT BUỘC — KHÔNG ĐƯỢC GỠ.
            Mọi phụ kiện neo bằng `left-1/2 -translate-x-1/2` / `top-[…%]`, tức là canh giữa Ô.
            Nếu con vật KHÔNG được canh giữa Ô thì hai hệ toạ độ lệch nhau và mọi món đồ rơi sai
            chỗ — đúng lời chủ dự án: *"các icon đeo vô con pet cũng khá là thô, lung tung"*.

            Đo trên trình duyệt thật (Playwright/Chromium) khi ô chỉ là `<div>` thường: con vật
            là một `<span>` INLINE, nên nó trôi về GÓC TRÊN-TRÁI — tâm con vật ở **28,8% / 31,3%**
            thay vì 50% / 50%. Hệ quả đo được: mũ lệch phải ~40px (lơ lửng cạnh tai), kính nằm
            ngang MÁ chứ không trên mắt, khăn rơi dưới cằm, giày cách xa chân. Tiêm
            `display:flex; align-items:center; justify-content:center` vào ô (chỉ sửa DOM sống)
            đưa tâm con vật về **50% / 50%** và mọi món rơi đúng người ngay lập tức.

            ⚠️ `relative` trên con vật vẫn cần: nó giữ con vật trong ngữ cảnh xếp lớp của ô để
               `z-[2]` có hiệu lực (trên `back`, dưới `feet/head/neck/face`).
        */}
        <div
          className={cn(
            'relative mx-auto flex size-[200px] shrink-0 items-center justify-center',
            STAGE_TEXT_SIZE[evolutionStage],
          )}
        >
          {/* Bóng ellipse dưới chân — NEO thị giác, cho con vật một mặt đất để đứng lên. */}
          <span
            aria-hidden="true"
            className="absolute bottom-[6%] left-1/2 z-0 h-[10px] w-[90px] -translate-x-1/2 rounded-pill bg-pet-shadow"
          />

          {/* Phụ kiện ĐEO SAU LƯNG (áo choàng / cánh / ba lô) — vẽ trước con vật. */}
          <AccessoryLayers slots={ACCESSORY_SLOTS} worn={worn} only="behind" />

          {/* Con vật. Cỡ = `font-size` của ô (84/104/124px), emoji thừa hưởng. */}
          <span aria-hidden="true" className={cn('relative leading-none', PET_Z)}>
            {petIcon}
          </span>

          {/* Phụ kiện ĐEO TRƯỚC NGƯỜI (giày, mũ, khăn, kính). */}
          <AccessoryLayers slots={ACCESSORY_SLOTS} worn={worn} only="inFront" />

          {/* Dấu "Siêu cấp": tia sáng ở góc trên phải. `animate-pulse` đã bị tắt sẵn dưới
              `prefers-reduced-motion` (xem `tokens.css`) — không cần xử lý riêng ở đây. */}
          {isSuper && (
            <span
              aria-hidden="true"
              className="absolute right-[8%] top-[8%] animate-pulse text-[28px] leading-none"
            >
              ✨
            </span>
          )}
        </div>

        {/* DẢI 2 — ĐẤT / CỎ. */}
        <SceneryRow items={scenery.get('ground')} className="bg-pet-ground px-3 pt-1 pb-2" />
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
 * ⚠️ Một `<span>` cho MỖI VỊ TRÍ (không phải mỗi món): nhiều món cùng vị trí thì `flex gap-0.5`
 *    tự xếp cạnh nhau — giữ nguyên cơ chế cũ, và KHÔNG BAO GIỜ bỏ món nào của bé.
 */
function AccessoryLayers({
  slots,
  worn,
  only,
}: {
  slots: readonly AccessorySlot[];
  worn: Map<AccessorySlot, ShopItem[]>;
  only: 'behind' | 'inFront';
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
            className={cn(
              // `absolute` + `flex`: nhiều món cùng vị trí tự xếp cạnh nhau, không tính toán.
              'absolute flex items-center justify-center gap-0.5 leading-none',
              ACCESSORY_ANCHOR[slot],
              ACCESSORY_TEXT_SIZE[slot],
              ACCESSORY_Z[slot],
            )}
          >
            {list.map((item) => (
              <span key={item.id} className="leading-none">
                {item.icon}
              </span>
            ))}
          </span>
        );
      })}
    </>
  );
}

/**
 * Một hàng trang trí, nằm trong dải `sky` hoặc `ground`.
 *
 * Không có món nào thì KHÔNG vẽ gì bên trong — nhưng dải nền vẫn còn, vì dải nền là "sân nhà" của
 * con vật (đường chân trời), không phải chỗ giữ cho món đồ. Vẽ một hàng rỗng giữ chỗ thì con vật
 * luôn bị đẩy lệch khỏi giữa vì những thứ bé chưa mua.
 */
function SceneryRow({
  items,
  className,
}: {
  items: readonly ShopItem[] | undefined;
  className?: string;
}) {
  return (
    <ul
      aria-hidden="true"
      className={cn('flex flex-wrap items-end justify-center gap-2', className)}
    >
      {(items ?? []).map((item) => (
        <li key={item.id} className="text-[28px] leading-none">
          {item.icon}
        </li>
      ))}
    </ul>
  );
}
