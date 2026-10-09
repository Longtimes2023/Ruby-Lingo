/**
 * Test cho `ShopItemCard` (T064) — thẻ vật phẩm trong cửa hàng.
 *
 * Bốn nhóm được kiểm kỹ nhất, vì cả bốn đều hỏng IM LẶNG (không lỗi, chỉ sai):
 *
 *   1. **Thiếu tiền ⇒ nút mờ, không mắng.** Đây là toàn bộ cách xử lý "không đủ tiền" ở tầng
 *      giao diện. Nếu nút vẫn sáng, bé bấm và nhận một vòng mạng vô ích rồi bị server từ chối —
 *      với một đứa trẻ 7 tuổi, "bấm mãi không được" đọc là "con làm sai gì rồi". Test này khoá cả
 *      hai vế: nút PHẢI mờ, và KHÔNG được có chữ trách móc nào.
 *
 *   2. **Đồ ăn xếp chồng được ⇒ luôn còn nút "Mua".** Bé có 1 quả chuối vẫn phải mua thêm được
 *      quả thứ hai. Ẩn nút "Mua" đi (theo thói quen "đã sở hữu thì thôi") là chặn một hành vi
 *      hoàn toàn hợp lệ, và bé sẽ đi tìm cách mua ở chỗ khác.
 *
 *   3. **Phụ kiện thì NGƯỢC LẠI: đã sở hữu ⇒ không còn "Mua".** `inventory` có khoá chính
 *      `(child_id, item_id)` nên "2 chiếc nón" là vô nghĩa; server sẽ trả nguyên trạng và bé chỉ
 *      thấy một nút như bị hỏng.
 *
 *   4. **`equip` nhận TRẠNG THÁI ĐÍCH, không phải lệnh đảo.** Bấm "Dùng ngay" phải xin `true`;
 *      bấm "Bỏ ra" phải xin `false`. Nếu component tự đảo (`!đang_mặc`), một cú bấm đúp — hành vi
 *      bình thường của trẻ — sẽ thành "mặc rồi lại bỏ ra", và bé thấy món đồ nhấp nháy.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import { ShopItemCard } from '@/components/common/ShopItemCard.js';
import type { ShopItemCardProps } from '@/components/common/ShopItemCard.js';
import { getShopItem } from '@shared/content/shop.js';
import type { ShopItem } from '@shared/types/reward.js';

/**
 * Vật phẩm THẬT đọc từ `shared/content/shop-items.json`.
 *
 * ⚠️ KHÔNG bịa một `ShopItem` tại chỗ. Giá và nhóm là dữ liệu sống: một fixture tự chế có giá 5
 *    sẽ vẫn xanh sau ngày ai đó đổi giá chuối thành 7, trong khi màn hình thật hiện số khác. Tra
 *    thẳng vào danh mục thì test đỏ ngay khi dữ liệu đổi — đúng lúc cần biết.
 */
function item(id: string): ShopItem {
  const found = getShopItem(id);
  if (!found) throw new Error(`shop-items.json thiếu "${id}" — fixture của test đã lệch dữ liệu`);
  return found;
}

interface Harness {
  onBuy: ReturnType<typeof vi.fn>;
  onFeed: ReturnType<typeof vi.fn>;
  onEquip: ReturnType<typeof vi.fn>;
}

/** Mặc định: món CHƯA sở hữu, ví dư tiền, không hành động nào đang chạy. */
function setup(overrides: Partial<ShopItemCardProps> = {}): Harness {
  const onBuy = vi.fn();
  const onFeed = vi.fn();
  const onEquip = vi.fn();

  const props: ShopItemCardProps = {
    item: item('food-banana'),
    balance: 100,
    owned: false,
    quantity: 0,
    equipped: false,
    onBuy,
    onFeed,
    onEquip,
    ...overrides,
  };

  render(<ShopItemCard {...props} />);
  return { onBuy, onFeed, onEquip };
}

// =============================================================================
// Nhóm 1 — Mua: đủ tiền / thiếu tiền
// =============================================================================

describe('ShopItemCard — nút Mua', () => {
  it('đủ tiền ⇒ nút "Mua" BẤM ĐƯỢC, nhãn kèm tên món', () => {
    setup();

    const button = screen.getByRole('button', { name: 'Mua: Chuối' });
    expect(button).toBeEnabled();
  });

  it('tên và mô tả của món hiện trên thẻ', () => {
    setup();

    const banana = item('food-banana');
    expect(screen.getByText(banana.name_vi)).toBeInTheDocument();
    expect(screen.getByText(banana.description_vi)).toBeInTheDocument();
  });

  it('⚠️ THIẾU tiền ⇒ nút Mua MỜ, và có một câu mời nhẹ thay vì lời trách', () => {
    // Chuối giá 5 ⭐; ví còn 4 ⇒ thiếu đúng 1.
    setup({ balance: 4 });

    expect(screen.getByRole('button', { name: 'Mua: Chuối' })).toBeDisabled();
    expect(screen.getByText('Mình cùng học thêm nhé!')).toBeInTheDocument();
  });

  it('⚠️ KHÔNG có chữ nào trách móc bé — luật "không bao giờ mắng trẻ"', () => {
    const { container } = render(
      <ShopItemCard
        item={item('acc-crown')}
        balance={0}
        owned={false}
        quantity={0}
        equipped={false}
        onBuy={vi.fn()}
        onFeed={vi.fn()}
        onEquip={vi.fn()}
      />,
    );

    /**
     * ⚠️ Đây là test bắt LỖI TƯƠNG LAI, không phải kiểm một dòng code hiện có: nó không khẳng
     *    định "không có chữ X" vì ai đó vừa viết X, mà vì X là kiểu câu rất dễ được thêm vào khi
     *    ai đó thấy "nút mờ mà không giải thích gì". Bé không làm gì sai khi chưa đủ sao.
     */
    expect(container.textContent ?? '').not.toMatch(/sai|kém|chưa đạt|thất bại|không đủ|hết tiền/i);
    expect(screen.getByText('Mình cùng học thêm nhé!')).toBeInTheDocument();
  });

  it('VỪA ĐỦ tiền (biên) ⇒ vẫn mua được', () => {
    setup({ balance: item('food-banana').price });

    expect(screen.getByRole('button', { name: 'Mua: Chuối' })).toBeEnabled();
  });

  it('nhãn giá dùng ĐÚNG loại tiền tệ của món (⭐ cho sao, 🌰 cho hạt dẻ)', () => {
    setup();

    const banana = item('food-banana');
    expect(screen.getByRole('img', { name: `Sao: ${banana.price}` })).toBeInTheDocument();
  });

  it('món trả bằng hạt dẻ ⇒ nhãn giá nói "Hạt dẻ", không nói "Sao"', () => {
    setup({ item: item('acc-crown'), balance: 99 });

    const crown = item('acc-crown');
    expect(screen.getByRole('img', { name: `Hạt dẻ: ${crown.price}` })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: `Sao: ${crown.price}` })).not.toBeInTheDocument();
  });

  it('đang gửi yêu cầu mua ⇒ nút bị khoá và báo cho trình đọc màn hình', () => {
    setup({ buying: true });

    const button = screen.getByRole('button', { name: 'Mua: Chuối' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('bấm "Mua" ⇒ báo lên trên đúng MỘT lần', () => {
    const { onBuy } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Mua: Chuối' }));

    expect(onBuy).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// Nhóm 2 — Đồ ăn: xếp chồng được
// =============================================================================

describe('ShopItemCard — đồ ăn (xếp chồng được)', () => {
  it('⚠️ đã có 1 quả chuối ⇒ VẪN còn nút "Mua" (mua thêm quả nữa)', () => {
    setup({ owned: true, quantity: 1 });

    expect(screen.getByRole('button', { name: 'Mua: Chuối' })).toBeEnabled();
  });

  it('đã có chuối ⇒ có thêm nút "Cho ăn"', () => {
    setup({ owned: true, quantity: 1 });

    expect(screen.getByRole('button', { name: 'Cho ăn: Chuối' })).toBeInTheDocument();
  });

  it('⚠️ CHƯA có chuối ⇒ KHÔNG có nút "Cho ăn" (không cho ăn thứ không có trong túi)', () => {
    setup({ owned: false, quantity: 0 });

    expect(screen.queryByRole('button', { name: /^Cho ăn:/ })).not.toBeInTheDocument();
  });

  it('số lượng > 1 ⇒ hiện "Đang có N"', () => {
    setup({ owned: true, quantity: 3 });

    expect(screen.getByText('Đang có 3')).toBeInTheDocument();
  });

  it('số lượng = 1 ⇒ KHÔNG hiện "Đang có 1" (một món là chuyện thường, không cần nhấn)', () => {
    setup({ owned: true, quantity: 1 });

    expect(screen.queryByText(/Đang có/)).not.toBeInTheDocument();
  });

  it('⚠️ bấm "Cho ăn" ⇒ báo lên trên, KHÔNG phải báo "Mua"', () => {
    const { onBuy, onFeed } = setup({ owned: true, quantity: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Cho ăn: Chuối' }));

    expect(onFeed).toHaveBeenCalledTimes(1);
    expect(onBuy).not.toHaveBeenCalled();
  });

  it('⚠️ đồ ăn KHÔNG BAO GIỜ có nút mặc, kể cả khi cờ `equipped` bị bật nhầm', () => {
    /**
     * Đồ ăn bị TIÊU khi cho ăn (`consumeItemInTx`). Nếu cho "mặc", bé gắn một quả chuối lên Momo
     * rồi chính quả đó biến mất ở lần cho ăn sau — linh vật đang "đội" một thứ không còn tồn tại.
     * `isEquippable()` là danh sách trắng hai nhóm; test này khoá việc nó chặn đúng nhóm thứ ba.
     */
    setup({ owned: true, quantity: 1, equipped: true });

    expect(screen.queryByRole('button', { name: /^Dùng ngay:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Bỏ ra:/ })).not.toBeInTheDocument();
  });
});

// =============================================================================
// Nhóm 3 — Phụ kiện / trang trí: mặc - bỏ ra
// =============================================================================

describe('ShopItemCard — phụ kiện và trang trí', () => {
  it('⚠️ đã sở hữu, CHƯA mặc ⇒ chỉ có "Dùng ngay", KHÔNG còn "Mua"', () => {
    setup({ item: item('acc-hat'), owned: true, quantity: 1 });

    expect(screen.getByRole('button', { name: 'Dùng ngay: Mũ' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mua: Mũ' })).not.toBeInTheDocument();
  });

  it('chưa sở hữu ⇒ chỉ có "Mua", chưa có nút mặc', () => {
    setup({ item: item('acc-hat'), owned: false });

    expect(screen.getByRole('button', { name: 'Mua: Mũ' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Dùng ngay:/ })).not.toBeInTheDocument();
  });

  it('⚠️ ĐANG mặc ⇒ nút đổi thành "Bỏ ra" và có nhãn "Đang dùng"', () => {
    setup({ item: item('acc-hat'), owned: true, quantity: 1, equipped: true });

    expect(screen.getByRole('button', { name: 'Bỏ ra: Mũ' })).toBeInTheDocument();
    expect(screen.getByText(/Đang dùng/)).toBeInTheDocument();
  });

  it('⚠️ bấm "Dùng ngay" ⇒ xin trạng thái ĐÍCH `true`', () => {
    const { onEquip } = setup({ item: item('acc-hat'), owned: true, quantity: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Dùng ngay: Mũ' }));

    expect(onEquip).toHaveBeenCalledWith(true);
  });

  it('⚠️ bấm "Bỏ ra" ⇒ xin trạng thái ĐÍCH `false` (KHÔNG tự đảo)', () => {
    const { onEquip } = setup({
      item: item('acc-hat'),
      owned: true,
      quantity: 1,
      equipped: true,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Bỏ ra: Mũ' }));

    expect(onEquip).toHaveBeenCalledWith(false);
  });

  it('trang trí cũng mặc/trưng được (nhóm thứ hai trong danh sách trắng)', () => {
    setup({ item: item('dec-balloon'), owned: true, quantity: 1 });

    expect(screen.getByRole('button', { name: 'Dùng ngay: Bóng bay' })).toBeInTheDocument();
  });

  it('đang gửi yêu cầu mặc ⇒ nút mặc bị khoá', () => {
    setup({ item: item('acc-hat'), owned: true, quantity: 1, equipping: true });

    expect(screen.getByRole('button', { name: 'Dùng ngay: Mũ' })).toBeDisabled();
  });

  it('⚠️ thiếu tiền nhưng ĐÃ sở hữu phụ kiện ⇒ nút mặc vẫn bấm được', () => {
    /**
     * Tiền đã trả lúc mua. Một ví cạn không được phép khoá việc mặc lại món bé đã sở hữu — và
     * đây là đường thoát hiểm khi ví trên màn hình đã cũ: bé vẫn dùng được đồ của mình.
     */
    setup({ item: item('acc-hat'), balance: 0, owned: true, quantity: 1 });

    expect(screen.getByRole('button', { name: 'Dùng ngay: Mũ' })).toBeEnabled();
  });

  it('⚠️ thiếu tiền nhưng ĐÃ sở hữu đồ ăn ⇒ vẫn "Cho ăn" được', () => {
    setup({ balance: 0, owned: true, quantity: 1 });

    expect(screen.getByRole('button', { name: 'Cho ăn: Chuối' })).toBeEnabled();
    // Nút mua thêm thì mờ, và đó là chuyện khác — bé không mất quyền dùng món đang có.
    expect(screen.getByRole('button', { name: 'Mua: Chuối' })).toBeDisabled();
  });
});
