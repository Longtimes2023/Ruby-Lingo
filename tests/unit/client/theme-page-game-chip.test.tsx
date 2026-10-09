/**
 * RubyLingo — `ThemePage`: chip trò chơi ĐỔI MÀU khi trò đã chơi (T05).
 *
 * ⭐ VÌ SAO PHẢI TEST Ở TẦNG RENDER, KHÔNG CHỈ TEST `useGameResults`:
 *   `useGameResults` trả `Map` đúng mà `ThemePage` quên đọc `Map` đó, hoặc tra sai khoá
 *   (`exercise.id` vs `exercise.lessonId`), hoặc tô theo sao của BÀI thay vì của từng game —
 *   thì mọi unit test của hook vẫn xanh. Ba thứ đó nằm trong JSX. Chỉ render thật rồi soi DOM
 *   mới bắt được.
 *
 * ⭐ BA ĐIỀU FILE NÀY KHOÁ LẠI (đều là quy tắc cứng của app):
 *   ① Trò ĐÃ chơi ⇒ nhãn đọc nói rõ "đã được N sao" (đồng bộ với màu + huy hiệu ✓ + số ★ mà bé
 *      NHÌN thấy — trình đọc màn hình phải nghe được cùng thông tin).
 *   ② CHỈ chip của ĐÚNG bài tập đã chơi đổi trạng thái. Hai trò cùng loại ở bài KHÁC vẫn trung
 *      tính — nếu tô hết thì "một bài có 5 game, tô theo sao của bài" là nói dối.
 *   ③ Mạng LỖI ⇒ chip trung tính y như chưa chơi. KHÔNG thông báo lỗi cho bé, KHÔNG "0 ★"
 *      (0 sao là một LỜI NÓI DỐI CỤ THỂ — xem lập luận ở `useGameResults` / `useProgress`).
 *
 * ⚠️ Test này chạy trên NỘI DUNG THẬT (`at-the-zoo`) nên còn là bằng chứng `import.meta.glob`
 *    + `i18n` + `react-query` ghép được với nhau trong môi trường test.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Thay RIÊNG `progressApi.getGameResults`, giữ nguyên mọi thứ khác của module endpoint.
 * Dùng `importOriginal` (KHÔNG thay cả module) để `ThemePage` và các hook khác vẫn gọi được
 * những hàm thật chúng cần — thay cả module là mời gọi test đỏ vì lý do sai.
 */
const mocks = vi.hoisted(() => ({ getGameResults: vi.fn() }));

vi.mock('@/api/endpoints.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const actualProgress = (actual as { progressApi: Record<string, unknown> }).progressApi;
  return {
    ...actual,
    progressApi: { ...actualProgress, getGameResults: mocks.getGameResults },
  };
});

import '@/i18n/index.js';
import type { ChildProfileDto, GameResultsGetResponse } from '@shared/types/api.js';
import { ThemePage } from '@/pages/ThemePage.js';
import { useSessionStore } from '@/store/sessionStore.js';

const THEME_ID = 'at-the-zoo';
/** Bài tập ĐÃ CHƠI trong test — cùng loại với hai bài z2/z3 để chứng minh KHÔNG tô nhầm. */
const PLAYED_EX = 'at-the-zoo/z1/listen-tap';

const CHILD: ChildProfileDto = {
  id: 'chi_na',
  nickname: 'Na',
  age: 7,
  avatarId: 'fox',
  createdAt: '2026-10-01T00:00:00.000Z',
};

/** Đặt bé đang hoạt động — điều kiện để `useGameResults` BẬT truy vấn (`enabled: childId !== null`). */
function setActiveChild(): void {
  useSessionStore.setState({
    status: 'authenticated',
    parent: null,
    children: [CHILD],
    activeChildId: CHILD.id,
  });
}

function resetSession(): void {
  useSessionStore.setState({
    status: 'loading',
    parent: null,
    children: [],
    activeChildId: null,
  });
}

function renderThemePage(themeId: string = THEME_ID) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/theme/${themeId}`]}>
        <Routes>
          <Route path="/theme/:themeId" element={<ThemePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function responseWith(results: GameResultsGetResponse['results']): GameResultsGetResponse {
  return { childId: CHILD.id, results, serverTime: '2026-10-07T08:00:00.000Z' };
}

beforeEach(() => {
  mocks.getGameResults.mockReset();
  resetSession();
});

afterEach(() => {
  resetSession();
});

describe('ThemePage — chip trò chơi đã chơi (T05)', () => {
  it('⭐ trò ĐÃ chơi ⇒ nhãn đọc có trạng thái "đã được N sao"', async () => {
    setActiveChild();
    mocks.getGameResults.mockResolvedValue(
      responseWith([
        {
          exerciseId: PLAYED_EX,
          bestStars: 3,
          bestScore: 6,
          attempts: 2,
          lastPlayedAt: '2026-10-07T07:00:00.000Z',
        },
      ]),
    );

    renderThemePage();

    // Nhãn ĐỔI so với chip chưa chơi — đây là thứ trình đọc màn hình dùng để phân biệt.
    expect(
      await screen.findByRole('link', { name: 'Chơi trò Nghe & Chạm — đã được 3 sao' }),
    ).toBeInTheDocument();
  });

  it('⭐ CHỈ chip của ĐÚNG bài tập đã chơi đổi trạng thái; hai bài cùng loại ở bài khác vẫn trung tính', async () => {
    setActiveChild();
    mocks.getGameResults.mockResolvedValue(
      responseWith([
        {
          exerciseId: PLAYED_EX,
          bestStars: 2,
          bestScore: 4,
          attempts: 1,
          lastPlayedAt: '2026-10-07T07:00:00.000Z',
        },
      ]),
    );

    renderThemePage();

    // z1/listen-tap đã chơi ⇒ nhãn "đã được 2 sao".
    expect(
      await screen.findByRole('link', { name: 'Chơi trò Nghe & Chạm — đã được 2 sao' }),
    ).toBeInTheDocument();

    // z2/listen-tap và z3/listen-tap CÙNG LOẠI nhưng CHƯA chơi ⇒ nhãn trơ, đúng 2 link.
    expect(screen.getAllByRole('link', { name: 'Chơi trò Nghe & Chạm' })).toHaveLength(2);
  });

  it('⭐ mạng LỖI ⇒ chip trung tính, KHÔNG lỗi cho bé, KHÔNG "0 ★"', async () => {
    setActiveChild();
    mocks.getGameResults.mockRejectedValue(new Error('mất mạng'));

    renderThemePage();

    // Truy vấn đã thực sự chạy (và thất bại)…
    await waitFor(() => expect(mocks.getGameResults).toHaveBeenCalledWith(CHILD.id));

    // …nhưng cả 3 chip listen-tap vẫn ở trạng thái TRUNG TÍNH (không có chip "đã chơi" nào).
    expect(screen.getAllByRole('link', { name: 'Chơi trò Nghe & Chạm' })).toHaveLength(3);
    // KHÔNG bao giờ hiện "0 ★" — đó là lời nói dối (chưa biết ≠ chưa từng chơi).
    expect(screen.queryByText(/0 sao/)).toBeNull();
    expect(screen.queryByText(/0 ★/)).toBeNull();
  });

  it('chưa chọn bé ⇒ KHÔNG gọi endpoint (truy vấn bị tắt) và chip vẫn trung tính', async () => {
    // Không gọi `setActiveChild()` — `childId` là `null`.
    renderThemePage();

    expect(screen.getByRole('heading', { name: 'Các bài học' })).toBeInTheDocument();
    expect(mocks.getGameResults).not.toHaveBeenCalled();
    expect(screen.getAllByRole('link', { name: 'Chơi trò Nghe & Chạm' })).toHaveLength(3);
  });
});
