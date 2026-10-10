/**
 * RubyLingo — Test BA TRANG khu vực thi cuối khoá (Giai đoạn 7).
 *
 * ⭐ ĐIỀU FILE NÀY CANH (đọc kèm `FinalTestHomePage` / `FinalTestSectionPage` / `FinalTestCertificatePage`):
 *   1. Cổng `locked`  ⇒ màn khu vực thi hiện RÕ còn thiếu gì và KHÔNG có link vào phần thi.
 *   2. Cổng `pending` ⇒ trung tính ("Đang kiểm tra..."), KHÔNG nói còn thiếu.
 *   3. Cổng `ready`   ⇒ vào được, có đủ ba phần.
 *   4. Chơi HẾT một phần ⇒ hiện khiên và gọi `submit` ĐÚNG MỘT LẦN.
 *   5. Mạng lỗi khi nộp ⇒ KHÔNG lộ lỗi kỹ thuật, có nút thử lại, giữ kết quả tạm.
 *   6. Tiến độ dở được KHÔI PHỤC sau khi rời trang (localStorage).
 *   7. a11y: nút chính ≥ 64px (token `min-h-touch`), chữ ≥ 16px (token `text-kid-*`).
 *
 * ⚠️ Server là TRỌNG TÀI CUỐI nên `finalTestApi.submit` MOCK trả về kết quả đã chấm; trang chỉ
 *    HIỆN kết quả đó. Nội dung phần thi lấy NỘI DUNG THẬT (phần Nói — 11 câu, toàn nút bấm) để
 *    đồng thời chứng minh nội dung thật ghép được với `registry` component.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import type * as EndpointsModule from '@/api/endpoints.js';
import { finalTestApi } from '@/api/endpoints.js';
import { FinalTestCertificatePage } from '@/pages/final-test/FinalTestCertificatePage.js';
import { FinalTestHomePage } from '@/pages/final-test/FinalTestHomePage.js';
import { FinalTestSectionPage } from '@/pages/final-test/FinalTestSectionPage.js';
import { cancelFinalTestProgress, saveFinalTestDraft, __resetFinalTestSessionForTests } from '@/store/finalTestSession.js';
import { useSessionStore } from '@/store/sessionStore.js';
import type { FinalTestAccess } from '@shared/final-test-access.js';
import type { FinalTestGateState, FinalTestSectionStatus } from '@shared/types/final-test.js';

vi.mock('@/api/endpoints.js', async (importOriginal) => {
  const actual = await importOriginal<typeof EndpointsModule>();
  return {
    ...actual,
    finalTestApi: { get: vi.fn(), submit: vi.fn(), saveProgress: vi.fn() },
  };
});

const getMock = vi.mocked(finalTestApi.get);
const submitMock = vi.mocked(finalTestApi.submit);
const saveProgressMock = vi.mocked(finalTestApi.saveProgress);

const CHILD_ID = 'chi_na';

/** Số câu THẬT của phần Nói trong `src/data/levels/starters/final-test/speaking.json`. */
const SPEAKING_ITEM_COUNT = 11;

function sectionStatus(over: Partial<FinalTestSectionStatus> = {}): FinalTestSectionStatus {
  return {
    section: 'listening',
    autoScored: true,
    totalItems: 20,
    bestShields: null,
    completed: false,
    attempts: 0,
    lastAttemptAt: null,
    progress: null,
    ...over,
  };
}

function gate(over: Partial<FinalTestAccess> = {}): FinalTestAccess {
  return {
    kind: 'ready',
    enterable: true,
    requirement: null,
    lessonsCompleted: 43,
    lessonsTotal: 43,
    exercisesPlayed: 73,
    exercisesTotal: 73,
    ...over,
  };
}

function gateState(access: FinalTestAccess, sections: FinalTestSectionStatus[] = []): FinalTestGateState {
  return { childId: CHILD_ID, gate: access, sections, serverTime: '2026-10-10T09:00:00.000Z' };
}

const READY_SECTIONS: FinalTestSectionStatus[] = [
  sectionStatus({ section: 'listening', totalItems: 20 }),
  sectionStatus({ section: 'reading-writing', totalItems: 25 }),
  sectionStatus({ section: 'speaking', autoScored: false, totalItems: SPEAKING_ITEM_COUNT }),
];

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<div>BẢN ĐỒ</div>} />
          <Route path="/final-test" element={<FinalTestHomePage />} />
          <Route path="/final-test/certificate" element={<FinalTestCertificatePage />} />
          <Route path="/final-test/:section" element={<FinalTestSectionPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Bấm "Nói rồi!" cho tới khi hết phần Nói. */
async function playSpeakingSection(): Promise<void> {
  for (let index = 0; index < SPEAKING_ITEM_COUNT; index += 1) {
    const button = await screen.findByRole('button', { name: 'Bé đã nói xong câu này' });
    fireEvent.click(button);
    // Chờ màn hình chuyển sang câu kế (câu cuối thì không còn câu nào để chờ).
    if (index < SPEAKING_ITEM_COUNT - 1) {
      await screen.findByText(`Câu ${index + 2}/${SPEAKING_ITEM_COUNT}`);
    }
  }
}

beforeEach(() => {
  localStorage.clear();
  __resetFinalTestSessionForTests();
  useSessionStore.setState({
    children: [
      {
        id: CHILD_ID,
        nickname: 'Na',
        age: 7,
        avatarId: 'rabbit',
        createdAt: '2026-10-08T08:00:00.000Z',
      },
    ],
    activeChildId: CHILD_ID,
  });

  getMock.mockReset();
  submitMock.mockReset();
  saveProgressMock.mockReset();
  saveProgressMock.mockResolvedValue({
    section: 'speaking',
    answered: 1,
    answers: [],
    updatedAt: '2026-10-10T09:00:00.000Z',
  });
  getMock.mockResolvedValue(gateState(gate(), READY_SECTIONS));
  submitMock.mockResolvedValue({
    section: 'speaking',
    duplicate: false,
    totalItems: SPEAKING_ITEM_COUNT,
    correctFirstTry: SPEAKING_ITEM_COUNT,
    shields: 5,
    bestShields: 5,
    isNewRecord: true,
    firstCompletion: true,
    xpGained: 200,
    starsGained: 300,
    acornsGained: 20,
    levelUp: null,
    questsCompleted: [],
    badgesEarned: [],
  });
});

afterEach(() => {
  cancelFinalTestProgress();
});

describe('FinalTestHomePage — ba trạng thái cổng', () => {
  it('locked ⇒ hiện còn thiếu gì, KHÔNG có link tới phần thi', async () => {
    getMock.mockResolvedValue(
      gateState(
        gate({
          kind: 'locked',
          enterable: false,
          requirement: {
            type: 'lessons_incomplete',
            lessonsMissing: 3,
            lessonsCompleted: 40,
            lessonsTotal: 43,
          },
        }),
      ),
    );

    renderAt('/final-test');

    expect(await screen.findByText(/còn 3 bài nữa/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Bắt đầu' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Làm tiếp' })).toBeNull();
  });

  it('pending ⇒ "Đang kiểm tra...", KHÔNG nói còn thiếu', async () => {
    getMock.mockResolvedValue(
      gateState(gate({ kind: 'pending', enterable: false, requirement: null })),
    );

    renderAt('/final-test');

    expect(await screen.findByText('Đang kiểm tra...')).toBeInTheDocument();
    expect(screen.queryByText(/còn.*bài nữa/)).toBeNull();
  });

  it('ready ⇒ có đủ ba phần, mỗi phần có nút bấm ≥ 64px và chữ ≥ 16px', async () => {
    renderAt('/final-test');

    // Ba nút "Bắt đầu" cho ba phần.
    const starts = await screen.findAllByRole('link', { name: 'Bắt đầu' });
    expect(starts).toHaveLength(3);

    expect(screen.getByRole('heading', { name: 'Nghe' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Đọc & Viết' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nói' })).toBeInTheDocument();

    for (const start of starts) {
      // a11y: vùng chạm dùng token `min-h-touch` (≥ 64px) và cỡ chữ `text-kid-md` (≥ 16px).
      expect(start.className).toContain('min-h-touch');
      expect(start.className).toMatch(/text-kid-/);
    }
  });
});

describe('FinalTestSectionPage — chơi hết một phần', () => {
  it('nộp ĐÚNG MỘT LẦN và hiện khiên server trả về', async () => {
    renderAt('/final-test/speaking');

    await screen.findByRole('button', { name: 'Bé đã nói xong câu này' });
    await playSpeakingSection();

    // Chờ nộp xong và màn kết quả hiện ra.
    expect(await screen.findByText('Bé làm xong phần này rồi!')).toBeInTheDocument();
    expect(screen.getByLabelText('Nói: bé được 5 khiên')).toBeInTheDocument();
    expect(screen.getByText('Siêu sao!')).toBeInTheDocument();

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    const [, section, body] = submitMock.mock.calls[0]!;
    expect(section).toBe('speaking');
    expect(body.answers).toHaveLength(SPEAKING_ITEM_COUNT);
    expect(typeof body.clientEventId).toBe('string');
  });

  it('mạng lỗi khi nộp ⇒ KHÔNG lộ lỗi kỹ thuật, có nút thử lại, giữ kết quả tạm', async () => {
    submitMock.mockRejectedValueOnce(new Error('NetworkError: failed to fetch'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderAt('/final-test/speaking');

    await screen.findByRole('button', { name: 'Bé đã nói xong câu này' });
    await playSpeakingSection();

    expect(await screen.findByText('Chưa gửi được kết quả. Bé bấm thử lại nhé!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();

    // KHÔNG có chuỗi lỗi kỹ thuật nào lộ ra cho bé.
    const body = document.body.textContent ?? '';
    expect(body).not.toContain('NetworkError');
    expect(body).not.toContain('fetch');
    expect(body).not.toContain('Error');

    warn.mockRestore();
  });

  it('khôi phục tiến độ dở sau khi rời trang (localStorage)', async () => {
    // Giả lập bé đã làm 3 câu rồi thoát.
    saveFinalTestDraft(CHILD_ID, 'speaking', {
      answers: [
        { itemId: 'starters.final-test.speaking.p1.q1', value: '', firstTry: true, wrongAttempts: 0 },
        { itemId: 'starters.final-test.speaking.p1.q2', value: '', firstTry: true, wrongAttempts: 0 },
        { itemId: 'starters.final-test.speaking.p1.q3', value: '', firstTry: true, wrongAttempts: 0 },
      ],
      clientEventId: 'ft_resume',
    });

    renderAt('/final-test/speaking');

    // Câu kế tiếp là câu 4.
    expect(await screen.findByText(`Câu 4/${SPEAKING_ITEM_COUNT}`)).toBeInTheDocument();
    expect(screen.getByText('Mình làm tiếp nhé!')).toBeInTheDocument();
  });
});

/** Ba phần ĐÃ hoàn thành — dùng cho màn chứng nhận. */
function completedSections(): FinalTestSectionStatus[] {
  return [
    sectionStatus({ section: 'listening', totalItems: 20, bestShields: 4, completed: true, attempts: 1, lastAttemptAt: '2026-10-05T09:00:00.000Z' }),
    sectionStatus({ section: 'reading-writing', totalItems: 25, bestShields: 5, completed: true, attempts: 1, lastAttemptAt: '2026-10-06T09:00:00.000Z' }),
    sectionStatus({ section: 'speaking', autoScored: false, totalItems: 11, bestShields: 5, completed: true, attempts: 1, lastAttemptAt: '2026-10-07T09:00:00.000Z' }),
  ];
}

describe('FinalTestCertificatePage', () => {
  it('đủ ba phần ⇒ hiện tên bé, tổng khiên, nhãn RubyLingo và dòng miễn trừ Cambridge', async () => {
    getMock.mockResolvedValue(gateState(gate({ kind: 'done' }), completedSections()));

    renderAt('/final-test/certificate');

    expect(await screen.findByText('Chứng nhận nhỏ của bé')).toBeInTheDocument();
    // Nhãn hiệu RUBYLINGO — KHÔNG phải Cambridge, KHÔNG "chứng chỉ".
    expect(screen.getByText('Chứng nhận của RubyLingo')).toBeInTheDocument();
    expect(screen.getByText('Na')).toBeInTheDocument();
    expect(screen.getByText('Tổng cộng 14 khiên')).toBeInTheDocument();
    expect(
      screen.getByText('RubyLingo không phải kỳ thi Cambridge; kết quả ở đây không có giá trị chứng nhận.'),
    ).toBeInTheDocument();
  });

  it('⭐ dòng miễn trừ Cambridge LUÔN được render (khoá lại để không ai xoá mất)', async () => {
    getMock.mockResolvedValue(gateState(gate({ kind: 'done' }), completedSections()));
    renderAt('/final-test/certificate');

    expect(
      await screen.findByText('RubyLingo không phải kỳ thi Cambridge; kết quả ở đây không có giá trị chứng nhận.'),
    ).toBeInTheDocument();
  });

  it('⭐ nút "In chứng nhận": đủ lớn (≥64px), aria-label tiếng Việt, bấm ⇒ gọi window.print', async () => {
    getMock.mockResolvedValue(gateState(gate({ kind: 'done' }), completedSections()));
    const printMock = vi.fn();
    vi.stubGlobal('print', printMock);

    renderAt('/final-test/certificate');

    const button = await screen.findByRole('button', { name: 'In chứng nhận ra giấy' });
    // a11y: vùng chạm `min-h-touch` (≥ 64px).
    expect(button.className).toContain('min-h-touch');

    fireEvent.click(button);
    expect(printMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('chưa xong cả ba phần ⇒ LỜI MỜI làm nốt, không phải lời chê', async () => {
    getMock.mockResolvedValue(
      gateState(gate({ kind: 'ready' }), [
        sectionStatus({ section: 'listening', totalItems: 20, bestShields: 4, completed: true, attempts: 1 }),
        sectionStatus({ section: 'reading-writing', totalItems: 25 }),
        sectionStatus({ section: 'speaking', autoScored: false, totalItems: 11 }),
      ]),
    );

    renderAt('/final-test/certificate');

    expect(await screen.findByText(/Bé còn phần/)).toBeInTheDocument();
    expect(screen.getByText(/Đọc & Viết, Nói/)).toBeInTheDocument();
  });
});
