/**
 * RubyLingo — Test `ParentSpeakingChecklist` (TẦNG 4 — phụ huynh xác nhận phần Nói).
 *
 * ⭐ NHỮNG ĐIỀU FILE NÀY CANH:
 *   1. **Rubric là HÀNH VI, không phải điểm.** Bốn mục, mỗi mục hai lựa chọn "Bé đã làm được" /
 *      "Mình ôn thêm nhé" — không có "đạt/trượt", không có từ chê.
 *   2. **Đọc/ghi qua SERVER** (Giai đoạn 11) — `parentSpeakingApi.get/save`.
 *   3. **Đường lùi khi mất mạng**: lựa chọn được giữ CỤC BỘ (cờ `pending`) và TỰ GỬI BÙ khi mạng
 *      trở lại (sự kiện `online` của trình duyệt).
 *   4. **Bấm lại lựa chọn cũ ⇒ bỏ đánh dấu** (về "chưa xác nhận") để phụ huynh sửa được.
 *   5. **Không còn câu "chỉ lưu trên thiết bị này"** — nay đã đồng bộ server, UI không nói sai.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import { parentSpeakingApi } from '@/api/endpoints.js';
import { ParentSpeakingChecklist } from '@/components/final-test/ParentSpeakingChecklist.js';
import { __clearSpeakingCacheForTests, loadSpeakingCache } from '@/lib/parentSpeakingMarks.js';
import { __resetParentSpeakingStoreForTests } from '@/store/parentSpeakingStore.js';

vi.mock('@/api/endpoints.js', () => ({
  parentSpeakingApi: { get: vi.fn(), save: vi.fn() },
}));

const getMock = vi.mocked(parentSpeakingApi.get);
const saveMock = vi.mocked(parentSpeakingApi.save);

const CHILD_A = 'chi_a';
const CHILD_B = 'chi_b';

beforeEach(() => {
  vi.clearAllMocks();
  __resetParentSpeakingStoreForTests();
  __clearSpeakingCacheForTests(CHILD_A);
  __clearSpeakingCacheForTests(CHILD_B);
  getMock.mockResolvedValue({ items: [], updatedAt: null });
  saveMock.mockImplementation(async (_childId, body) => ({
    items: body.items,
    updatedAt: '2026-10-06T09:00:00.000Z',
  }));
});

describe('ParentSpeakingChecklist', () => {
  it('hiện rubric 4 phần Nói và NÓI THẬT là đã đồng bộ (không còn câu "chỉ lưu trên máy")', async () => {
    render(<ParentSpeakingChecklist childId={CHILD_A} />);

    expect(
      await screen.findByText(
        'Bé làm theo chỉ dẫn: chỉ vào tranh hoặc đặt đồ vật đúng chỗ khi nghe tiếng Anh.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Bé nói được một câu ngắn về bức tranh.')).toBeInTheDocument();
    expect(screen.getByText('Bé nói được tên đồ vật khi được hỏi.')).toBeInTheDocument();
    expect(
      screen.getByText('Bé trả lời được câu hỏi về bản thân (tuổi, gia đình, sở thích).'),
    ).toBeInTheDocument();

    expect(screen.queryByText(/chỉ lưu trên thiết bị này/)).not.toBeInTheDocument();
  });

  it('⭐ nạp trạng thái TỪ SERVER cho đúng bé', async () => {
    getMock.mockResolvedValue({ items: [{ id: 'p2', done: true }], updatedAt: '2026-10-06T09:00:00.000Z' });
    render(<ParentSpeakingChecklist childId={CHILD_A} />);

    await waitFor(() => expect(getMock).toHaveBeenCalledWith(CHILD_A));
    const doneButtons = await screen.findAllByRole('button', { name: /Bé đã làm được/ });
    // Mục 2 (index 1) đã "làm được"; các mục khác chưa đánh dấu.
    await waitFor(() => expect(doneButtons[1]).toHaveAttribute('aria-pressed', 'true'));
    expect(doneButtons[0]).toHaveAttribute('aria-pressed', 'false');
  });

  it('đánh dấu "Bé đã làm được" cho mục 1 ⇒ GỬI LÊN SERVER đúng payload', async () => {
    render(<ParentSpeakingChecklist childId={CHILD_A} />);
    const doneButtons = await screen.findAllByRole('button', { name: /Bé đã làm được/ });

    fireEvent.click(doneButtons[0] as HTMLElement);

    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(saveMock).toHaveBeenCalledWith(CHILD_A, { items: [{ id: 'p1', done: true }] });
    expect(doneButtons[0]).toHaveAttribute('aria-pressed', 'true');
  });

  it('bấm lại lựa chọn cũ ⇒ BỎ đánh dấu (gửi lên server danh sách rỗng)', async () => {
    render(<ParentSpeakingChecklist childId={CHILD_A} />);
    const doneButton = (await screen.findAllByRole('button', { name: /Bé đã làm được/ }))[0] as HTMLElement;

    fireEvent.click(doneButton);
    await waitFor(() => expect(doneButton).toHaveAttribute('aria-pressed', 'true'));

    fireEvent.click(doneButton); // bấm lại chính nó
    await waitFor(() => expect(doneButton).toHaveAttribute('aria-pressed', 'false'));
    expect(saveMock).toHaveBeenLastCalledWith(CHILD_A, { items: [] });
  });

  it('⚠️ mất mạng khi lưu ⇒ GIỮ cục bộ (pending) + câu trung tính, rồi TỰ GỬI BÙ khi có mạng', async () => {
    saveMock.mockRejectedValueOnce(new Error('network down'));
    render(<ParentSpeakingChecklist childId={CHILD_A} />);
    const doneButton = (await screen.findAllByRole('button', { name: /Bé đã làm được/ }))[0] as HTMLElement;

    fireEvent.click(doneButton);

    // Lựa chọn KHÔNG mất: nằm trong bộ đệm cục bộ với cờ pending.
    await waitFor(() => expect(loadSpeakingCache(CHILD_A).pending).toBe(true));
    expect(loadSpeakingCache(CHILD_A).items).toEqual([{ id: 'p1', done: true }]);
    // Câu trung tính, KHÔNG lộ mã lỗi kỹ thuật.
    expect(await screen.findByText(/Chưa đồng bộ được lên máy chủ/)).toBeInTheDocument();

    // Mạng trở lại ⇒ trình duyệt phát sự kiện `online` ⇒ hook gửi bù.
    saveMock.mockImplementation(async (_childId, body) => ({
      items: body.items,
      updatedAt: '2026-10-06T10:00:00.000Z',
    }));
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(loadSpeakingCache(CHILD_A).pending).toBe(false));
    await waitFor(() =>
      expect(saveMock).toHaveBeenLastCalledWith(CHILD_A, { items: [{ id: 'p1', done: true }] }),
    );
  });

  it('⚠️ LUẬT TRẺ: không có từ phán xét nào trong màn hình', async () => {
    const { container } = render(<ParentSpeakingChecklist childId={CHILD_A} />);
    await screen.findByText(
      'Bé làm theo chỉ dẫn: chỉ vào tranh hoặc đặt đồ vật đúng chỗ khi nghe tiếng Anh.',
    );
    const html = container.innerHTML.toLowerCase();
    for (const word of ['sai', 'kém', 'chưa đạt', 'thất bại', 'trượt']) {
      expect(html.includes(word)).toBe(false);
    }
  });
});
