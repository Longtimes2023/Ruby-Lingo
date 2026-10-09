/**
 * Test cho `QuestCard` — MỘT nhiệm vụ trên màn Nhiệm vụ (M9).
 *
 * Bốn nhóm được kiểm kỹ nhất, vì hỏng ở đây là NÓI SAI với bé:
 *
 *   1. **`reach_level` KHÔNG được hiện "1/3".** Với tiêu chí cấp bậc, `progress` là CẤP HIỆN TẠI
 *      và `target` là cấp CẦN ĐẠT. Bé ở cấp 1 đọc "1/3" sẽ hiểu thành "con mới làm được một phần
 *      ba" — trong khi sự thật là bé đã lên cấp 1. Thẻ phải nói **"Cấp 3"**. Đây là lý do tồn tại
 *      của `isQuestProgressCountable()`, và cũng là thứ dễ bị "sửa lại cho gọn" nhất.
 *
 *   2. **KHÔNG BAO GIỜ hiện "4/1".** `unlock_theme` đếm số chủ đề đã mở, nên một bé đã mở 4 chủ
 *      đề cho nhiệm vụ đòi 1 sẽ nhận `progress = 4, target = 1`. `ProgressBar` tự kẹp, nhưng nếu
 *      CHỮ không kẹp theo thì thẻ hiện một con số vô nghĩa và mâu thuẫn với chính thanh bên cạnh.
 *
 *   3. **Nút "Nhận thưởng" chỉ sáng khi XONG.** Chưa xong ⇒ khoá, và khoá một cách TRUNG TÍNH
 *      (không tô đỏ, không dấu ✗). Đây là cơ chế cảm xúc của cả màn hình: phần thưởng phải THUỘC
 *      VỀ BÉ vì bé tự bấm, không tự động.
 *
 *   4. **Nhiệm vụ MỘT-VIỆC không có con số nào để hiện.** "0/1" chỉ là cách viết khác của "chưa
 *      xong", và nó đứng đó ngay từ ngày đầu nên trông như thể bé đang thiếu một thứ gì.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import { QuestCard } from '@/components/common/QuestCard.js';
import type { QuestCriteria, QuestWithProgress } from '@shared/types/reward.js';

function quest(overrides: Partial<QuestWithProgress> = {}): QuestWithProgress {
  return {
    id: 'qd-01',
    tier: 'daily',
    description_vi: 'Học 1 bài mới',
    icon: '📖',
    criteria: { kind: 'complete_lessons', count: 1 },
    rewards: [{ kind: 'stars', amount: 10 }],
    phase: 'mvp',
    progress: 0,
    target: 1,
    completed: false,
    claimed: false,
    ...overrides,
  };
}

/** Nhiệm vụ ĐẾM được với tiến độ đang dở, để thấy rõ chữ "n/t" trên thẻ. */
function countableQuest(): QuestWithProgress {
  const criteria: QuestCriteria = { kind: 'play_games', count: 3 };
  return quest({
    id: 'qd-02',
    description_vi: 'Chơi 3 game',
    icon: '🎮',
    criteria,
    progress: 2,
    target: 3,
  });
}

function renderCard(props: Partial<Parameters<typeof QuestCard>[0]> = {}) {
  const onClaim = vi.fn();
  const utils = render(<QuestCard quest={quest()} onClaim={onClaim} {...props} />);
  return { onClaim, ...utils };
}

/** Nhãn ĐỌC của thanh tiến độ — `ProgressBar` nhận nó qua `aria-label`. */
function progressBarLabel(): string {
  return screen.getByRole('progressbar').getAttribute('aria-label') ?? '';
}

// =============================================================================
// Tiến độ hiển thị
// =============================================================================

describe('QuestCard — tiến độ hiển thị', () => {
  it('nhiệm vụ ĐẾM được: hiện đúng "2/3"', () => {
    renderCard({ quest: countableQuest() });

    expect(screen.getByText('2/3')).toBeInTheDocument();
    expect(progressBarLabel()).toContain('2');
  });

  it('⚠️ `reach_level`: hiện "Cấp 3", TUYỆT ĐỐI KHÔNG hiện "1/3"', () => {
    const criteria: QuestCriteria = { kind: 'reach_level', level: 3 };
    renderCard({
      quest: quest({
        id: 'qm-03',
        tier: 'milestone',
        description_vi: 'Nhà thám hiểm — đạt cấp 3',
        icon: '🧭',
        criteria,
        // Bé đang ở cấp 1, nhiệm vụ đòi cấp 3. Đúng dữ liệu server trả về.
        progress: 1,
        target: 3,
      }),
    });

    expect(screen.getByText('Cấp 3')).toBeInTheDocument();
    // Đây là phép kiểm quan trọng nhất của cả file: "1/3" đọc lên thành "con mới làm được một
    // phần ba", một lời nói sai về bé.
    expect(screen.queryByText('1/3')).not.toBeInTheDocument();
  });

  it('⚠️ KẸP chữ theo trần: `unlock_theme` progress 4 / target 1 ⇒ "1/1", KHÔNG "4/1"', () => {
    const criteria: QuestCriteria = { kind: 'unlock_theme', count: 1 };
    renderCard({
      quest: quest({
        id: 'qw-03',
        tier: 'weekly',
        description_vi: 'Mở khoá 1 chủ đề mới',
        icon: '🗺️',
        criteria,
        progress: 4,
        target: 1,
        completed: true,
      }),
    });

    expect(screen.getByText('1/1')).toBeInTheDocument();
    expect(screen.queryByText('4/1')).not.toBeInTheDocument();
  });

  it('nhiệm vụ MỘT-VIỆC: chưa xong thì chỉ có thanh, KHÔNG có chữ nào', () => {
    const criteria: QuestCriteria = { kind: 'complete_lesson', lessonId: 'at-the-zoo/z1' };
    renderCard({
      quest: quest({ id: 'qm-01', tier: 'milestone', criteria, progress: 0, target: 1 }),
    });

    expect(screen.queryByText('0/1')).not.toBeInTheDocument();
    // Nhưng thanh VẪN có mặt và vẫn đọc được cho trình đọc màn hình.
    expect(progressBarLabel()).toBe('Học 1 bài mới');
  });

  it('nhiệm vụ MỘT-VIỆC: xong rồi thì có chữ "Xong rồi!"', () => {
    const criteria: QuestCriteria = { kind: 'complete_theme', themeId: 'at-the-zoo' };
    renderCard({
      quest: quest({
        id: 'qm-02',
        tier: 'milestone',
        criteria,
        progress: 1,
        target: 1,
        completed: true,
      }),
    });

    expect(screen.getByText('Xong rồi!')).toBeInTheDocument();
  });

  it('nhãn đọc của thanh tiến độ KÈM TÊN nhiệm vụ (10 thanh giống nhau trên màn hình)', () => {
    renderCard({ quest: countableQuest() });

    expect(progressBarLabel()).toBe('Chơi 3 game — 2/3');
  });
});

// =============================================================================
// Nút "Nhận thưởng"
// =============================================================================

describe('QuestCard — nút "Nhận thưởng"', () => {
  it('chưa xong ⇒ nút KHOÁ (và không có lớp màu "lỗi" nào)', () => {
    const { onClaim } = renderCard({ quest: quest({ completed: false }) });

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();

    // Bấm vào nút khoá: không được gọi gì cả.
    fireEvent.click(button);
    expect(onClaim).not.toHaveBeenCalled();
  });

  it('⚠️ xong ⇒ nút MỞ, bấm vào gọi `onClaim` đúng một lần', () => {
    const { onClaim } = renderCard({ quest: quest({ completed: true, claimed: false }) });

    const button = screen.getByRole('button');
    expect(button).toBeEnabled();

    fireEvent.click(button);
    expect(onClaim).toHaveBeenCalledTimes(1);
  });

  it('đã nhận ⇒ nút khoá, nhãn "Đã nhận"', () => {
    renderCard({ quest: quest({ completed: true, claimed: true }) });

    const button = screen.getByRole('button', { name: /Đã nhận/ });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Đã nhận');
  });

  it('đang gửi ⇒ nút khoá và báo `aria-busy` (chặn chạm hai lần)', () => {
    renderCard({ quest: quest({ completed: true }), claiming: true });

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('nhãn đọc của nút KÈM TÊN nhiệm vụ — nếu không, bé nghe mười lần "Nhận thưởng"', () => {
    renderCard({ quest: quest({ completed: true }) });

    expect(
      screen.getByRole('button', { name: 'Nhận thưởng: Học 1 bài mới' }),
    ).toBeInTheDocument();
  });

  it('KHÔNG liệt kê phần thưởng trên thẻ — quà để dành cho lúc mở túi 🎁', () => {
    renderCard({ quest: quest({ completed: true, rewards: [{ kind: 'stars', amount: 10 }] }) });

    expect(screen.queryByText(/\+10/)).not.toBeInTheDocument();
  });
});
