/**
 * Test cho `LevelUpOverlay` — màn ăn mừng khi bé LÊN CẤP Nhà thám hiểm.
 *
 * Hai nhóm được kiểm kỹ nhất, vì hỏng ở đây là NÓI SAI với bé:
 *
 *   1. **Nhảy nhiều cấp.** Một lượt chơi có thể vượt hai ngưỡng cấp cùng lúc. Khi đó bé phải
 *      nhận được quà của MỌI cấp đã vượt (tổng), và phải được nghe rằng mình vừa vượt mấy cấp —
 *      nếu chỉ hiện cấp cuối, bé thấy số ⭐ nhận được nhiều hơn quà của một cấp và không hiểu
 *      vì sao. Con số ở màn này là thứ bé đối chiếu với ví trên thanh trên cùng.
 *
 *   2. **Quà nào cũng phải đọc được.** Phần nhìn của mỗi khoản quà chỉ là icon + số. Nếu nhãn
 *      cho trình đọc màn hình thiếu hoặc sai, bé khiếm thị chỉ nghe "cộng một" mà không biết
 *      đó là huy hiệu, kính ngôi sao, hay điểm kinh nghiệm.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import {
  LevelUpOverlay,
  type LevelUpInfo,
  type LevelUpOverlayProps,
} from '@/components/effects/LevelUpOverlay.js';

/**
 * ⚠️ jsdom không cài đặt `matchMedia` đầy đủ, mà `useReducedMotion()` của Framer Motion đọc nó.
 *    Thiếu stub thì component ném `TypeError: window.matchMedia is not a function` — một lỗi
 *    của MÔI TRƯỜNG TEST bị hiểu nhầm thành "component hỏng". Trả `matches: false` để test chạy
 *    ở nhánh có hiệu ứng (nhánh thật mà bé thấy).
 */
beforeAll(() => {
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
});

function renderOverlay(props: Partial<LevelUpOverlayProps> = {}) {
  return render(<LevelUpOverlay levelUp={null} onClose={vi.fn()} {...props} />);
}

/** Cấp 1 → 2: một huy hiệu (🌿) + 20 ⭐. Số liệu lấy từ bảng thật `xp-levels.json`. */
const LEVEL_1_TO_2: LevelUpInfo = {
  from: 1,
  to: 2,
  rewards: [
    { kind: 'badge', refId: 'badge-forest-friend' },
    { kind: 'stars', amount: 20 },
  ],
};

/** Cấp 1 → 3: quà GỘP của hai cấp — 2 huy hiệu, 50 ⭐, 3 🌰. Dùng cho test nhảy nhiều cấp. */
const LEVEL_1_TO_3: LevelUpInfo = {
  from: 1,
  to: 3,
  rewards: [
    { kind: 'badge', refId: 'badge-forest-friend' },
    { kind: 'stars', amount: 20 },
    { kind: 'badge', refId: 'badge-explorer' },
    { kind: 'stars', amount: 30 },
    { kind: 'acorns', amount: 3 },
  ],
};

/** Cấp 3 → 4: có một VẬT PHẨM, không có 🌰. */
const LEVEL_3_TO_4: LevelUpInfo = {
  from: 3,
  to: 4,
  rewards: [
    { kind: 'badge', refId: 'badge-guide' },
    { kind: 'stars', amount: 40 },
    { kind: 'item', refId: 'acc-star-glasses' },
  ],
};

// =============================================================================
// Đóng / mở
// =============================================================================

describe('LevelUpOverlay — khi nào hiện', () => {
  it('`levelUp = null` ⇒ KHÔNG hiện gì (không có cột mốc nào để ăn mừng)', () => {
    renderOverlay({ levelUp: null });

    expect(screen.queryByText(/Bé lên cấp/)).not.toBeInTheDocument();
  });

  it('có `levelUp` ⇒ hiện tên cấp mới và danh hiệu mới', () => {
    renderOverlay({ levelUp: LEVEL_1_TO_2 });

    expect(screen.getByText('Bé lên cấp 2!')).toBeInTheDocument();
    // Danh hiệu lấy từ bảng cấp thật, không phải chuỗi viết cứng trong component.
    expect(screen.getByText('Danh hiệu mới: Người bạn của thú rừng')).toBeInTheDocument();
  });
});

// =============================================================================
// Quà
// =============================================================================

describe('LevelUpOverlay — quà mừng cấp', () => {
  it('hiện đủ khoản quà với nhãn ĐỌC ĐƯỢC cho trình đọc màn hình', () => {
    renderOverlay({ levelUp: LEVEL_1_TO_2 });

    expect(screen.getByLabelText('Bé nhận thêm 20 sao')).toBeInTheDocument();
  });

  /**
   * ⭐⭐ TEST QUAN TRỌNG NHẤT CỦA NHÓM NÀY — quà phải là TỔNG của mọi cấp đã vượt.
   *
   *   Cấp 2 cho 20 ⭐, cấp 3 cho 30 ⭐ ⇒ lên thẳng từ 1 lên 3 phải là **50 ⭐**, không phải 30.
   *   Nếu chỉ lấy quà của cấp cuối, con số ở đây sẽ thấp hơn mức tăng thật của ví, và bé sẽ thấy
   *   app "nói một đằng trả một nẻo".
   */
  it('⭐ nhảy nhiều cấp ⇒ quà là TỔNG của MỌI cấp đã vượt (50 ⭐, 3 🌰, 2 huy hiệu)', () => {
    renderOverlay({ levelUp: LEVEL_1_TO_3 });

    expect(screen.getByLabelText('Bé nhận thêm 50 sao')).toBeInTheDocument();
    expect(screen.getByLabelText('Bé nhận thêm 3 hạt dẻ')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Bé được tặng một huy hiệu mới')).toHaveLength(2);
  });

  it('nhảy nhiều cấp ⇒ nói rõ bé vừa vượt mấy cấp', () => {
    renderOverlay({ levelUp: LEVEL_1_TO_3 });

    expect(screen.getByText(/Bé vượt 2 cấp trong một lượt/)).toBeInTheDocument();
  });

  it('lên MỘT cấp ⇒ KHÔNG có dòng "vượt mấy cấp" (nói thừa là làm bé rối)', () => {
    renderOverlay({ levelUp: LEVEL_1_TO_2 });

    expect(screen.queryByText(/vượt .* cấp/)).not.toBeInTheDocument();
  });

  it('số cấp đã vượt tính từ `from`→`to`, KHÔNG đếm theo số khoản quà', () => {
    // Vẫn là 1 → 3 (vượt 2 cấp) dù chỉ có MỘT khoản quà.
    renderOverlay({ levelUp: { from: 1, to: 3, rewards: [{ kind: 'stars', amount: 50 }] } });

    expect(screen.getByText(/Bé vượt 2 cấp trong một lượt/)).toBeInTheDocument();
  });

  it('quà VẬT PHẨM hiện đúng tên vật phẩm (tra từ danh mục cửa hàng thật)', () => {
    renderOverlay({ levelUp: LEVEL_3_TO_4 });

    expect(screen.getByLabelText('Bé nhận được Kính ngôi sao')).toBeInTheDocument();
  });

  it('quà VẬT PHẨM lạ (không có trong danh mục) bị BỎ QUA, không hiện id thô', () => {
    renderOverlay({
      levelUp: { from: 1, to: 2, rewards: [{ kind: 'item', refId: 'khong-ton-tai' }] },
    });

    expect(screen.queryByText(/khong-ton-tai/)).not.toBeInTheDocument();
    // Không có khoản nào vẽ được ⇒ không hiện khối quà rỗng.
    expect(screen.queryByText('Quà mừng cấp mới')).not.toBeInTheDocument();
  });

  /**
   * ⚠️ Cấp được TÍNH TỪ XP, nên quà `kind: 'xp'` là vòng lặp — nội dung bị cấm chứa nó
   *    (`validate-content.ts` luật V16c) và server cũng gỡ ra. Nếu có lọt, nó cũng không được
   *    hiện: bé sẽ thấy một món quà không bao giờ tới tay mình.
   */
  it('bỏ qua khoản quà `xp` (không hiện món quà không bao giờ tới tay)', () => {
    renderOverlay({ levelUp: { from: 1, to: 2, rewards: [{ kind: 'xp', amount: 7 }] } });

    expect(screen.queryByText('+7')).not.toBeInTheDocument();
    expect(screen.queryByText('Quà mừng cấp mới')).not.toBeInTheDocument();
  });

  it('quà rỗng ⇒ không có khối quà, nhưng màn ăn mừng vẫn hiện', () => {
    renderOverlay({ levelUp: { from: 1, to: 2, rewards: [] } });

    expect(screen.getByText('Bé lên cấp 2!')).toBeInTheDocument();
    expect(screen.queryByText('Quà mừng cấp mới')).not.toBeInTheDocument();
  });
});

// =============================================================================
// Không bao giờ mắng
// =============================================================================

describe('LevelUpOverlay — giọng nói', () => {
  it('KHÔNG chứa từ nào mang ý trách móc', () => {
    renderOverlay({ levelUp: LEVEL_1_TO_3 });

    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent ?? '').not.toMatch(/sai|kém|chưa đạt|thua|thất bại/i);
  });
});

// =============================================================================
// Đóng
// =============================================================================

describe('LevelUpOverlay — đóng', () => {
  it('bấm "Chạm để tiếp tục" ⇒ gọi `onClose`', () => {
    const onClose = vi.fn();
    renderOverlay({ levelUp: LEVEL_1_TO_2, onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Chạm để tiếp tục' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('icon của huy hiệu lấy từ CẤP đã định nghĩa nó (nội dung quy định badge dùng icon của cấp)', () => {
    renderOverlay({ levelUp: LEVEL_1_TO_3 });

    const badges = screen.getAllByLabelText('Bé được tặng một huy hiệu mới');
    const icons = badges.map((badge) => within(badge).getByText(/🌿|🧺/).textContent);
    expect(icons).toEqual(['🌿', '🧺']);
  });
});

// =============================================================================
// Vị trí hộp thoại — lỗi ĐÃ TỪNG xảy ra, và mọi cổng kiểm tĩnh đều mù với nó
// =============================================================================

/**
 * ⭐ VÌ SAO CÓ NHÓM NÀY, DÙ NÓ CHỈ ĐỌC TÊN LỚP.
 *
 *   Framer Motion chạy hiệu ứng bằng cách ghi `transform` vào `style` INLINE của phần tử, và
 *   style inline LUÔN thắng lớp CSS. Bản đầu của màn này vừa animate vừa căn giữa trên CÙNG một
 *   `motion.div` (`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`). Hệ quả: `transform`
 *   của Tailwind không bao giờ được áp, chỉ còn `left/top: 50%` ⇒ thẻ lệch ĐÚNG một nửa chiều
 *   rộng và tràn ra ngoài mép phải. Đo trên Chrome thật (430×932): `left: 215, right: 611` cho
 *   thẻ rộng 396 — lệch 198px, đúng bằng nửa chiều rộng.
 *
 *   ⚠️ `tsc`, `eslint`, `vite build` và mọi test jsdom đều XANH với lỗi đó: jsdom **không áp CSS**,
 *      nên không có bài test nào ở đây chứng minh được vị trí THẬT. Thứ jsdom kiểm được — và cũng
 *      là thứ đủ để chặn tái phát — là **đừng bao giờ đặt hai việc lên cùng một phần tử**: phần tử
 *      được animate thì không được mang lớp căn giữa bằng `transform`. Đó chính là điều hai khẳng
 *      định dưới đây ghim lại.
 *
 *   Vị trí thật được đo bằng browser thật: `_verify/t056-spec.mts` (đo `getBoundingClientRect`).
 */
describe('LevelUpOverlay — căn giữa bằng BỐ CỤC, không bằng `transform`', () => {
  it('thẻ hộp thoại KHÔNG mang lớp `-translate-*` (Framer Motion sẽ ghi đè `transform`)', () => {
    renderOverlay({ levelUp: LEVEL_1_TO_2 });

    // Nếu ai đó "gộp lại cho gọn" bằng cách đặt lại `-translate-x-1/2 -translate-y-1/2` lên chính
    // thẻ này, khẳng định dưới đây đỏ ngay — trước khi lỗi kịp ra tới tay bé.
    expect(screen.getByRole('dialog').className).not.toMatch(/-translate-[xy]-/);
  });

  it('cha của thẻ căn giữa bằng grid `place-items-center`, và cha cũng KHÔNG mang `transform`', () => {
    renderOverlay({ levelUp: LEVEL_1_TO_2 });

    const parent = screen.getByRole('dialog').parentElement;
    expect(parent).not.toBeNull();
    expect(parent!.className).toMatch(/place-items-center/);
    expect(parent!.className).toMatch(/inset-0/);
    expect(parent!.className).not.toMatch(/-translate-[xy]-/);
  });
});
