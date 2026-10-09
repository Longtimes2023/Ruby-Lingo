/**
 * RubyLingo — `ShopItemCard`: một thẻ vật phẩm trong cửa hàng (M6, T064).
 *
 * ⭐ THẺ NÀY LÀ MỘT COMPONENT "CÂM" — NÓ KHÔNG ĐỌC STORE, KHÔNG GỌI MẠNG.
 *   Mọi thứ nó cần đều vào qua props, và mọi hành động đều đi ra qua callback. Ba lý do:
 *     • Kiểm thử được từng trạng thái (thiếu tiền, đã có, đang mặc) mà không phải dựng cả
 *       `rewardStore` + `shopStore` + mock mạng.
 *     • Cùng một thẻ dùng được ở màn Cửa hàng hôm nay và ở màn "Nhà của Momo" sau này.
 *     • Không có đường nào để thẻ này tự ý sửa ví — giữ đúng luật "chỉ `shopStore` được tiêu tiền".
 *
 * ⭐ NÚT "MUA" MỜ ĐI KHI THIẾU TIỀN — VÀ ĐÓ LÀ TOÀN BỘ CÁCH XỬ LÝ "KHÔNG ĐỦ TIỀN" Ở ĐÂY.
 *   Không có hộp thoại, không có chữ đỏ, không có âm thanh báo lỗi. Bé thấy nút mờ và một câu
 *   mời nhẹ ("Mình cùng học thêm nhé!") — đúng luật "không bao giờ mắng trẻ" của dự án. Bé
 *   không làm gì sai khi chưa có đủ sao; bé chỉ chưa kiếm đủ.
 *
 *   ⚠️ ĐÂY LÀ CỔNG GIAO DIỆN, KHÔNG PHẢI CỔNG AN TOÀN. Server vẫn phải từ chối một request mua
 *      vượt số dư (`INSUFFICIENT_FUNDS`) — một phép kiểm chỉ ở UI là một phép kiểm không tồn tại
 *      (client cũ, request gõ tay, số dư trên màn hình đã cũ). Xem `RewardService.buy` và
 *      `ShopService.buyItem`.
 *
 * ⭐ ĐỒ ĂN LUÔN CÓ NÚT "MUA" — KỂ CẢ KHI ĐÃ CÓ SẴN TRONG TÚI, VÀ ĐÓ KHÔNG PHẢI SỰ BẤT NHẤT.
 *   `isStackable()` chỉ đúng cho đồ ăn: `inventory` có khoá chính `(child_id, item_id)` nên mua
 *   lần hai chỉ làm `quantity` thành 2. Bé mua 3 quả chuối là chuyện có nghĩa. Với một chiếc nón
 *   thì ngược lại — "2 chiếc nón" là vô nghĩa, nên phụ kiện đã sở hữu KHÔNG hiện nút "Mua" nữa,
 *   chỉ còn "Dùng ngay" / "Bỏ ra". Nếu vẫn hiện, server sẽ trả về nguyên trạng (không trừ tiền),
 *   nhưng bé vẫn phải chờ một vòng mạng để rồi không thấy gì xảy ra — một nút trông như hỏng.
 */

import { useTranslation } from 'react-i18next';

import { SHOP_CURRENCIES, isEquippable, isFood } from '@shared/content/shop.js';
import type { ShopItem } from '@shared/types/reward.js';

import { cn } from '../../lib/cn.js';
import { BigButton } from './BigButton.js';
import { CounterChip } from './CounterChip.js';

export interface ShopItemCardProps {
  item: ShopItem;
  /**
   * Số dư của bé theo ĐÚNG loại tiền tệ của món này (⭐ hoặc 🌰).
   *
   * ⚠️ BẮT BUỘC LÀ SỐ, KHÔNG PHẢI `null`: màn Cửa hàng chỉ vẽ thẻ khi ĐÃ có ảnh chụp ví (xem
   *    `PetHousePage`). Nhận `null` ở đây nghĩa là phải bịa ra một cách hiển thị "chưa biết số
   *    dư" cho từng thẻ — và mọi cách hiển thị đó đều dễ bị đọc thành "bé có 0 sao".
   */
  balance: number;
  /** Bé đang có món này trong túi (`quantity ≥ 1`). */
  owned: boolean;
  /** Số lượng đang có trong túi. Chỉ có nghĩa với đồ ăn (nhóm duy nhất xếp chồng được). */
  quantity: number;
  /** Món này đang được MẶC / TRƯNG lên Momo. Luôn `false` với đồ ăn. */
  equipped: boolean;
  /** Đang có một yêu cầu MUA chạy cho đúng món này. */
  buying?: boolean;
  /** Đang có một yêu cầu CHO ĂN chạy cho đúng món này. */
  feeding?: boolean;
  /** Đang có một yêu cầu MẶC / BỎ RA chạy cho đúng món này. */
  equipping?: boolean;
  onBuy: () => void;
  onFeed: () => void;
  /** `equipped` là TRẠNG THÁI ĐÍCH, không phải lệnh đảo — xem `UseShopResult.equip`. */
  onEquip: (equipped: boolean) => void;
}

export function ShopItemCard({
  item,
  balance,
  owned,
  quantity,
  equipped,
  buying = false,
  feeding = false,
  equipping = false,
  onBuy,
  onFeed,
  onEquip,
}: ShopItemCardProps) {
  const { t } = useTranslation();

  /**
   * Tên + biểu tượng tiền tệ lấy từ NỘI DUNG (`shared/content/shop-items.json`), không từ i18n:
   * đó là nguồn sự thật duy nhất cho hai loại tiền tệ, và server cũng đọc đúng tệp đó để biết
   * phải trừ bao nhiêu ⭐. Khai lại ở đây là tạo nguồn thứ hai có thể lệch.
   */
  const currency = SHOP_CURRENCIES[item.currency];

  const affordable = balance >= item.price;
  const food = isFood(item);
  const equippable = isEquippable(item);

  /** Đồ ăn: luôn mua được thêm. Phụ kiện/trang trí: chỉ hiện "Mua" khi chưa sở hữu. */
  const showBuy = food || !owned;
  /** Chỉ cho ăn thứ đang thật sự có trong túi. `quantity > 0` là điều kiện thật, không thừa. */
  const showFeed = food && owned && quantity > 0;
  const showEquip = equippable && owned;

  return (
    <div
      className={cn(
        'flex h-full flex-col gap-3 rounded-card border-2 border-line bg-surface p-3',
        // Món đang được mặc có viền nhấn — dấu hiệu thứ hai ngoài nhãn chữ, để bé nhận ra ngay
        // mà không phải đọc (nhiều bé 7 tuổi đọc còn chậm).
        equipped && 'border-brand bg-brand-soft',
      )}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-[40px] leading-none">
          {item.icon}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-kid-md font-bold text-ink">{item.name_vi}</p>
          <p className="text-kid-xs text-ink-soft">{item.description_vi}</p>
        </div>

        {/*
          Nhãn giá là một `CounterChip` để nhãn ĐỌC được đúng ngữ cảnh: screen reader nghe
          "Sao: 40" thay vì "ngôi sao bốn mươi" — xem ghi chú đầu `CounterChip`.
        */}
        <CounterChip icon={currency.icon} value={item.price} label={currency.name_vi} />
      </div>

      {(equipped || (food && quantity > 1)) && (
        <p className="flex flex-wrap gap-2 text-kid-xs font-bold">
          {equipped && (
            <span className="rounded-pill bg-brand px-3 py-1 text-ink-inverse">
              ✨ {t('shop.equipped')}
            </span>
          )}
          {food && quantity > 1 && (
            <span className="rounded-pill border border-line bg-surface-raised px-3 py-1 text-ink-soft">
              {t('shop.ownedCount', { count: quantity })}
            </span>
          )}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-2">
        {showBuy && (
          <BigButton
            icon="🛒"
            loading={buying}
            // Khoá nút khi THIẾU TIỀN hoặc đang gửi. Cờ `loading` của `BigButton` tự khoá nút
            // và đặt `aria-busy`, nên không cần truyền `disabled` cho trường hợp đang gửi.
            disabled={!affordable}
            aria-label={`${t('shop.buy')}: ${item.name_vi}`}
            onClick={onBuy}
          >
            {t('shop.buy')}
          </BigButton>
        )}

        {showFeed && (
          <BigButton
            variant="success"
            icon="🍽️"
            loading={feeding}
            aria-label={`${t('shop.feed')}: ${item.name_vi}`}
            onClick={onFeed}
          >
            {t('shop.feed')}
          </BigButton>
        )}

        {showEquip && (
          <BigButton
            variant={equipped ? 'secondary' : 'primary'}
            icon={equipped ? '↩️' : '✨'}
            loading={equipping}
            aria-label={`${equipped ? t('shop.unequip') : t('shop.equip')}: ${item.name_vi}`}
            // TRẠNG THÁI ĐÍCH: đang mặc ⇒ xin bỏ ra; chưa mặc ⇒ xin mặc vào.
            onClick={() => onEquip(!equipped)}
          >
            {equipped ? t('shop.unequip') : t('shop.equip')}
          </BigButton>
        )}
      </div>

      {/*
        Câu mời nhẹ khi chưa đủ tiền. Đặt NGOÀI và DƯỚI nút vì hai lý do:
          • Nút đang `disabled` nên không nhận tiêu điểm bàn phím — nếu chỉ có `title` trên nút,
             bé dùng bàn phím sẽ không bao giờ nghe được lý do.
          • Đọc theo thứ tự tài liệu: "Chuối, 5 Sao, [Mua], Mình cùng học thêm nhé!" — lý do nằm
             ngay sau hành động mà nó nói tới.
      */}
      {showBuy && !affordable && (
        <p className="text-kid-xs font-semibold text-ink-soft">{t('shop.notEnough')}</p>
      )}
    </div>
  );
}
