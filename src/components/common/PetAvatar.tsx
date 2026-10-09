/**
 * RubyLingo — `PetAvatar`: Momo, bộ đồ đang mặc và cảnh quanh nhà (M6, T065–T066).
 *
 * ⭐ QUYẾT ĐỊNH C3 — "ĐEO NGƯỜI + BÀY CẢNH" (do chủ dự án chốt):
 *   Phụ kiện được gắn lên ĐÚNG CHỖ trên người Momo (mũ lên đầu, khăn quàng ở cổ, giày dưới chân…),
 *   còn trang trí được bày quanh khung cảnh thành hai hàng: bầu trời ở trên, mặt đất ở dưới.
 *   Vì sao không toạ độ tuyệt đối cho từng món: trên laptop sẽ đẹp hơn, nhưng trên iPhone 320px
 *   thì chồng nhau và tràn ra ngoài — mà "vỡ trên máy của bé" là hỏng thật. Hai HÀNG tự xuống
 *   dòng thì 10 món bật hết vẫn không bao giờ đè lên nhau.
 *
 * ⭐ MỌI VỊ TRÍ ĐẾN TỪ DỮ LIỆU (`shop-items.json` → `slot`), KHÔNG TỪ MỘT BẢNG TRA TRONG TỆP NÀY.
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
 * ⚠️ KHÔNG hiển thị mức ❤️ Ở ĐÂY: `HeartMeter` (thanh trên) là chủ duy nhất của "Momo đang vui
 *    thế nào". Vẽ lại ở đây là hai nguồn cho cùng một sự thật, và chúng sẽ lệch nhau đúng vào lúc
 *    bé vừa cho ăn.
 *
 * ⭐ T066 — GIAI ĐOẠN TIẾN HOÁ cũng vậy, và đi xa hơn một bước: component này **không tự suy**
 *    giai đoạn từ số từ (nó không có số từ, và không nên có). Server đếm từ rồi trả về một ID
 *    (`pet.evolutionStage`); ở đây chỉ tra ID đó ra `{ name_vi, icon }`. Client tự đếm từ là mở
 *    đường cho hai bên nói hai giai đoạn khác nhau.
 *
 * ⚠️ KHÔNG dùng `style={{ transform: … }}` để xê dịch các lớp: Tailwind đặt vị trí bằng chính
 *    thuộc tính `transform`, nên một `transform` inline sẽ ĐÈ SẠCH lớp `-translate-x-1/2` và mọi
 *    thứ lệch đi trong im lặng. Đúng cái bẫy đã trả giá ở T056. Nhiều món cùng một vị trí thì
 *    chúng tự xếp cạnh nhau bằng `flex` — không cần phép tính nào.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { stageDefinition } from '@shared/content/levels.js';
import { accessorySlotOf, decorationSlotOf } from '@shared/content/shop.js';
import { ACCESSORY_SLOTS, DECORATION_SLOTS } from '@shared/pet-slots.js';
import type {
  AccessorySlot,
  DecorationSlot,
  EvolutionStage,
  ShopItem,
} from '@shared/types/reward.js';

import { cn } from '../../lib/cn.js';

/**
 * Momo "mặc định" — dùng làm hình ĐẠI DIỆN cho trạng thái CHƯA BIẾT giai đoạn (đang nạp).
 *
 * ⚠️ KHÔNG còn là hình của linh vật khi đã có dữ liệu: từ T066, `PetAvatar` vẽ theo
 *    `evolutionStage` do server trả (`🥚 🐣 🐵 ✨` trong `xp-levels.json`) — xem `stageDefinition`.
 *    Hằng này chỉ còn cho `EmptyState` lúc chưa nạp xong, khi CHƯA biết bé đang ở giai đoạn nào.
 *
 * Xuất ra ngoài để màn hình chỉ có MỘT chỗ biết mặt Momo: hai chỗ tự khai hai emoji là hai chỗ
 * để lệch nhau.
 */
export const MOMO_ICON = '🐵';

/**
 * Vị trí của từng lớp phụ kiện trong khung 150×150.
 *
 * ⭐ MỌI VỊ TRÍ DÙNG `left-1/2 -translate-x-1/2` để tự căn giữa, TRỪ `back`: áo choàng / cánh /
 *   ba lô nằm LỆCH VỀ MỘT BÊN, vì chúng vẽ SAU Momo trong DOM (⇒ nằm trên) — để chính giữa thì
 *   chúng che mất mặt bạn ấy.
 *
 * Thứ tự vẽ = thứ tự trong `ACCESSORY_SLOTS`: `back` sớm nhất (nằm dưới cùng), `face` muộn nhất
 * (kính luôn nằm trên cùng).
 */
const ACCESSORY_ANCHOR: Record<AccessorySlot, string> = {
  back: 'left-[1%] top-[30%]',
  feet: 'bottom-[1%] left-1/2 -translate-x-1/2',
  head: 'top-0 left-1/2 -translate-x-1/2',
  neck: 'top-[62%] left-1/2 -translate-x-1/2',
  face: 'top-[37%] left-1/2 -translate-x-1/2',
};

/** Cỡ từng lớp. Mũ to hơn kính, giày nhỏ hơn — đọc theo hình dáng thật của món đồ. */
const ACCESSORY_TEXT_SIZE: Record<AccessorySlot, string> = {
  back: 'text-[30px]',
  feet: 'text-[26px]',
  head: 'text-[34px]',
  neck: 'text-[26px]',
  face: 'text-[28px]',
};

export interface PetAvatarProps {
  /** Tên linh vật, dùng cho nhãn đọc lên (`pet.name`). Truyền vào thay vì tự đọc i18n. */
  petName: string;
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
   * chủ ý — đồ ăn bị tiêu khi cho ăn, nên "Momo đang đội một quả chuối" sẽ sớm thành một món đồ
   * không còn tồn tại.
   */
  items: readonly ShopItem[];
  className?: string;
}

export function PetAvatar({ petName, evolutionStage, items, className }: PetAvatarProps) {
  const { t } = useTranslation();

  /** Hình + tên giai đoạn, tra từ DỮ LIỆU (`xp-levels.json`), không từ bảng tra trong tệp này. */
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

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/*
        Khối "khung cảnh" mang `role="img"` + nhãn đọc lên. ⚠️ Mọi thứ BÊN TRONG nó đều bị coi là
        trang trí (con của `role="img"` không được đọc), nên chú thích giai đoạn phải nằm NGOÀI
        khối này — xem thẻ `<p>` ngay dưới.
      */}
      <div
        role="img"
        aria-label={labelParts.join('. ')}
        className="relative flex flex-col rounded-card border-2 border-line bg-surface-raised px-3 py-2"
      >
        <SceneryRow items={scenery.get('sky')} />

        {/*
          Khung vẽ Momo. Kích thước CỐ ĐỊNH (150×150) là có chủ ý: các lớp phụ kiện định vị theo
          phần trăm của khung này, nên khung phải có một kích thước xác định thì mũ mới nằm đúng
          trên đầu ở mọi bề rộng màn hình.
        */}
        <div className="relative mx-auto flex size-[150px] shrink-0 items-center justify-center">
          {/* Hình của Momo ĐỔI THEO GIAI ĐOẠN (🥚 → 🐣 → 🐵 → ✨), tra từ `xp-levels.json`. */}
          <span aria-hidden="true" className="text-[96px] leading-none">
            {stage.icon}
          </span>

          {ACCESSORY_SLOTS.map((slot) => {
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
        </div>

        <SceneryRow items={scenery.get('ground')} />
      </div>

      {/*
        Chú thích giai đoạn — chữ THẬT, nằm NGOÀI khối `role="img"` (con của nó bị coi là trang trí
        nên sẽ không được đọc). Bé thấy chữ này, và trình đọc màn hình cũng đọc nó.

        ⚠️ Tên giai đoạn lấy từ `xp-levels.json` (`🥚 Trứng`, `🐣 Nhóc con`, `🐵 Trưởng thành`,
        `✨ Siêu cấp`), **KHÔNG** từ i18n — cùng lý do như tên tiền tệ ở màn Cửa hàng: khai lại là
        tạo nguồn sự thật thứ hai, và nó sẽ lệch nhau đúng vào ngày ai đó sửa JSON.
      */}
      <p className="text-center text-kid-xs font-bold text-ink-soft">{stage.name_vi}</p>
    </div>
  );
}

/**
 * Một hàng trang trí. Không có món nào thì không vẽ gì — KHÔNG vẽ một hàng rỗng giữ chỗ, vì như
 * vậy Momo luôn bị đẩy lệch khỏi giữa vì những thứ bé chưa mua.
 */
function SceneryRow({ items }: { items: readonly ShopItem[] | undefined }) {
  if (items === undefined || items.length === 0) return null;
  return (
    <ul aria-hidden="true" className="flex flex-wrap items-end justify-center gap-2">
      {items.map((item) => (
        <li key={item.id} className="text-[28px] leading-none">
          {item.icon}
        </li>
      ))}
    </ul>
  );
}
