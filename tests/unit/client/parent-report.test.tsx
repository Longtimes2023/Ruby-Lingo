/**
 * Test cho `ParentReport` (T073) — báo cáo tuần cho phụ huynh.
 *
 * Bốn luật của màn này được khoá lại, vì cả bốn đều hỏng IM LẶNG:
 *
 *   1. **SERVER LÀ TRỌNG TÀI.** `summary_vi` + mọi con số lấy NGUYÊN từ server. Test cố ý dựng
 *      `dailyStats` có TỔNG KHÁC các con số tổng ⇒ nếu client lỡ tự cộng, con số hiện ra sẽ sai
 *      và test đỏ. (Đây là cách duy nhất bắt được "client tự tính" — nếu fixture khớp nhau thì cả
 *      hai cách viết đều xanh.)
 *
 *   2. **TRẠNG THÁI RỖNG trung tính, KHÔNG màn hình trắng**: tuần chưa học ⇒ vẫn hiện số 0 (từ
 *      server) + một câu trung tính.
 *
 *   3. **BIỂU ĐỒ ĐỌC ĐƯỢC**: mỗi cột có nhãn đọc (không thì phụ huynh khiếm thị nhận ZERO số liệu).
 *
 *   4. **⭐ LUẬT TRẺ**: phụ huynh đọc, nhưng không chuỗi nào được phán xét — quét DOM + `aria-label`.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import { ApiClientError } from '@/api/client.js';
import { reportApi } from '@/api/endpoints.js';
import { ParentReport } from '@/pages/parent/ParentReport.js';
import type { ChildProfileDto, ReportResponse } from '@shared/types/api.js';
import type { FinalTestSectionStatus } from '@shared/types/final-test.js';

vi.mock('@/api/endpoints.js', () => ({
  reportApi: { get: vi.fn() },
}));

const getMock = vi.mocked(reportApi.get);

const CHILD = 'chi_na';

const CHILD_PROFILE: ChildProfileDto = {
  id: CHILD,
  nickname: 'Na',
  age: 7,
  avatarId: 'rabbit',
  createdAt: '2026-10-08T08:00:00.000Z',
};

/** Một phần thi cuối khoá cho báo cáo — mặc định "chưa làm" (đúng trạng thái bé mới). */
function finalTestSection(
  over: Partial<FinalTestSectionStatus> = {},
): FinalTestSectionStatus {
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

/**
 * ⚠️ CÁC CON SỐ TỔNG CỐ Ý KHÁC TỔNG `dailyStats`.
 *   `dailyStats` cộng lại = 12 + 8 = 20 từ, nhưng `wordsLearned` = 999. Nếu component tự cộng
 *   `dailyStats` thì nó hiện 20 (hoặc 60) thay vì 999 ⇒ test bắt được ngay.
 */
function report(overrides: Partial<ReportResponse> = {}): ReportResponse {
  return {
    child: CHILD_PROFILE,
    summary_vi: 'Bé Na đã học đều đặn trong tuần này.',
    range: { from: '2026-10-05', to: '2026-10-11' },
    dailyStats: [
      {
        childId: CHILD,
        date: '2026-10-05',
        wordsLearned: 12,
        questionsAnswered: 20,
        correctCount: 18,
        starsEarned: 9,
        acornsEarned: 0,
        xpEarned: 40,
        activeSeconds: 600,
        updatedAt: '2026-10-05T20:00:00.000Z',
      },
      {
        childId: CHILD,
        date: '2026-10-07',
        wordsLearned: 8,
        questionsAnswered: 15,
        correctCount: 12,
        starsEarned: 6,
        acornsEarned: 1,
        xpEarned: 30,
        activeSeconds: 480,
        updatedAt: '2026-10-07T20:00:00.000Z',
      },
    ],
    wordsLearned: 999,
    wordsMastered: 77,
    lessonsCompleted: 5,
    starsEarned: 321,
    strugglingWords: [],
    masteredWords: [],
    finalTest: [
      finalTestSection({ section: 'listening' }),
      finalTestSection({ section: 'reading-writing', totalItems: 25 }),
      finalTestSection({ section: 'speaking', autoScored: false, totalItems: 11 }),
    ],
    ...overrides,
  };
}

function renderReport(): { onGateClosed: ReturnType<typeof vi.fn> } {
  const onGateClosed = vi.fn();
  render(<ParentReport childId={CHILD} onGateClosed={onGateClosed} />);
  return { onGateClosed };
}

beforeEach(() => {
  vi.clearAllMocks();
  getMock.mockResolvedValue(report());
});

// =============================================================================
// Nhóm 1 — server là trọng tài
// =============================================================================

describe('ParentReport — số liệu lấy NGUYÊN từ server', () => {
  it('hiện câu tóm tắt của server, nguyên văn', async () => {
    renderReport();

    expect(
      await screen.findByText('Bé Na đã học đều đặn trong tuần này.'),
    ).toBeInTheDocument();
  });

  it('⚠️ hiện ĐÚNG các con số tổng của server — KHÔNG tự cộng `dailyStats`', async () => {
    renderReport();
    await screen.findByText('Bé Na đã học đều đặn trong tuần này.');

    // Bốn thẻ thống kê: tìm theo NHÃN rồi đọc giá trị trong cùng thẻ.
    const valueOf = (label: string): string => {
      const card = screen.getByText(label).closest('li');
      if (card === null) throw new Error(`không thấy thẻ cho "${label}"`);
      // Giá trị là span thứ hai trong thẻ (icon, value, label).
      return (within(card).getAllByText(/^\d[\d.,]*$/)[0] ?? card).textContent ?? '';
    };

    expect(valueOf('Số từ đã học')).toBe('999');
    expect(valueOf('Tổng cộng đã nhớ chắc')).toBe('77');
    expect(valueOf('Số bài đã xong')).toBe('5');
    expect(valueOf('Sao đã nhận')).toBe('321');
    // Tổng `dailyStats.wordsLearned` là 20 ⇒ nếu client tự cộng, sẽ KHÔNG thấy '999' ở trên.
    expect(screen.queryByText('20')).not.toBeInTheDocument();
  });

  it('⚠️ `wordsMastered` mang nhãn "TỔNG CỘNG" — không để đọc lẫn với ba số theo tuần', async () => {
    /*
      `wordsMastered` là con số TÍCH LUỸ, ba con số còn lại theo KHOẢNG của báo cáo. Đứng cạnh nhau
      mà không có nhãn phân biệt thì phụ huynh đọc "tuần này con nhớ chắc được 77 từ".
      Test khoá ĐÚNG chữ "tổng cộng" ⇒ một bản sửa nào bỏ nhãn đi sẽ đỏ ngay.
    */
    renderReport();
    await screen.findByText('Bé Na đã học đều đặn trong tuần này.');

    const label = screen.getByText(/tổng cộng/i);
    expect(label).toBeInTheDocument();
    const card = label.closest('li');
    expect(card).not.toBeNull();
    // Nhãn này gắn với con số 77 (từ server), không phải con số theo tuần nào khác.
    expect((card as HTMLElement).textContent).toContain('77');
  });

  it('hiện tên bé + khoảng thời gian của báo cáo', async () => {
    renderReport();

    /*
      Khẳng định CẢ DÒNG tiêu đề (tên bé · khoảng thời gian) làm MỘT chuỗi: `/Na/` sẽ khớp cả câu
      tóm tắt ("Bé Na đã học…") nên truy vấn mơ hồ. Chuỗi đầy đủ cũng chứng minh ngày được định
      dạng `DD/MM` bằng CẮT CHUỖI (`05/10`), không qua `new Date` (thứ sẽ lệch ngày ở múi giờ âm).
    */
    expect(await screen.findByText('Na · Từ 05/10 đến 11/10')).toBeInTheDocument();
  });
});

// =============================================================================
// Nhóm 2 — biểu đồ đọc được
// =============================================================================

describe('ParentReport — biểu đồ cột', () => {
  it('⚠️ MỖI CỘT có nhãn đọc được bằng trình đọc màn hình (số liệu không bị mất)', async () => {
    renderReport();
    await screen.findByText('Bé Na đã học đều đặn trong tuần này.');

    // Nhãn nói ĐÚNG ngày + ĐÚNG số từ của ngày đó — lấy từ dữ liệu, không chép số vào test.
    expect(screen.getByRole('img', { name: 'Ngày 05/10: 12 từ' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ngày 07/10: 8 từ' })).toBeInTheDocument();
  });

  it('tuần CHƯA có ngày nào ⇒ câu trung tính, KHÔNG màn hình trắng', async () => {
    getMock.mockResolvedValue(
      report({
        dailyStats: [],
        wordsLearned: 0,
        wordsMastered: 0,
        lessonsCompleted: 0,
        starsEarned: 0,
        summary_vi: 'Bé Na chưa có hoạt động nào trong tuần này.',
      }),
    );
    renderReport();

    expect(
      await screen.findByText('Tuần này chưa có ngày nào học. Số liệu sẽ hiện khi bé bắt đầu học nhé!'),
    ).toBeInTheDocument();
    // Vẫn hiện SỐ 0 (từ server), không phải màn hình trắng.
    expect(screen.getByText('Số từ đã học')).toBeInTheDocument();
  });
});

// =============================================================================
// Nhóm 3 — danh sách từ
// =============================================================================

describe('ParentReport — từ hay nhầm / đã nhớ', () => {
  it('có từ hay nhầm ⇒ hiện chữ tiếng Anh + nghĩa', async () => {
    getMock.mockResolvedValue(
      report({
        strugglingWords: [
          { wordId: 'w-elephant', en: 'elephant', vi: 'con voi', correctCount: 2, wrongCount: 5, accuracy: 0.29 },
        ],
      }),
    );
    renderReport();

    expect(await screen.findByText('elephant')).toBeInTheDocument();
    expect(screen.getByText('con voi')).toBeInTheDocument();
  });

  it('không có từ hay nhầm / chưa nhớ chắc ⇒ câu trung tính cho CẢ hai danh sách', async () => {
    renderReport();

    expect(await screen.findByText('Chưa có từ nào bé hay nhầm — tốt lắm!')).toBeInTheDocument();
    expect(
      screen.getByText('Tuần này chưa có từ nào bé nhớ chắc. Bố mẹ ôn cùng con nhé!'),
    ).toBeInTheDocument();
  });
});

// =============================================================================
// Nhóm 3b — khối bài thi cuối khoá (Giai đoạn 9)
// =============================================================================

describe('ParentReport — khối bài thi cuối khoá', () => {
  it('⭐ bé CHƯA thi ⇒ câu trung tính, KHÔNG hiện khiên nào', async () => {
    renderReport();
    await screen.findByText('Bé Na đã học đều đặn trong tuần này.');

    expect(screen.getByText('Bài thi cuối khoá')).toBeInTheDocument();
    expect(screen.getByText('Bé chưa làm bài thi cuối khoá.')).toBeInTheDocument();

    // KHÔNG có dãy khiên/label khiên nào — "0 khiên" đọc lên như một lời chê.
    expect(screen.queryByLabelText(/bé được \d khiên/)).toBeNull();
  });

  it('⭐ đã thi một phần ⇒ hiện tên phần + khiên + ngày; phần chưa làm ⇒ "Chưa làm"', async () => {
    getMock.mockResolvedValue(
      report({
        finalTest: [
          finalTestSection({
            section: 'listening',
            bestShields: 4,
            completed: true,
            attempts: 1,
            lastAttemptAt: '2026-10-06T09:00:00.000Z',
          }),
          finalTestSection({ section: 'reading-writing', totalItems: 25 }),
          finalTestSection({ section: 'speaking', autoScored: false, totalItems: 11 }),
        ],
      }),
    );
    renderReport();
    await screen.findByText('Bé Na đã học đều đặn trong tuần này.');

    // Phần đã thi: tên + nhãn khiên đọc được + ngày gần nhất.
    expect(screen.getByText('Nghe')).toBeInTheDocument();
    expect(screen.getByLabelText('Nghe: bé được 4 khiên')).toBeInTheDocument();
    expect(screen.getByText(/Lần gần nhất: \d{1,2}\/\d{1,2}\/\d{4}/)).toBeInTheDocument();

    // Hai phần còn lại: trung tính "Chưa làm", KHÔNG có khiên.
    expect(screen.getAllByText('Chưa làm')).toHaveLength(2);
    expect(screen.queryByLabelText(/Đọc & Viết: bé được/)).toBeNull();
    expect(screen.queryByLabelText(/Nói: bé được/)).toBeNull();

    // Dòng miễn trừ Cambridge luôn có trong khối (một nguồn với màn thi).
    expect(
      screen.getByText('RubyLingo không phải kỳ thi Cambridge; kết quả ở đây không có giá trị chứng nhận.'),
    ).toBeInTheDocument();
  });

  it('⭐ làm lại điểm cao hơn ⇒ client hiện ĐÚNG khiên cao nhất server trả (không tự tính)', async () => {
    getMock.mockResolvedValue(
      report({
        finalTest: [
          finalTestSection({
            section: 'listening',
            // Hai lần: 3 rồi 5 khiên ⇒ server trả `bestShields = 5`, `attempts = 2`.
            bestShields: 5,
            completed: true,
            attempts: 2,
            lastAttemptAt: '2026-10-08T09:00:00.000Z',
          }),
          finalTestSection({ section: 'reading-writing', totalItems: 25 }),
          finalTestSection({ section: 'speaking', autoScored: false, totalItems: 11 }),
        ],
      }),
    );
    renderReport();
    await screen.findByText('Bé Na đã học đều đặn trong tuần này.');

    expect(screen.getByLabelText('Nghe: bé được 5 khiên')).toBeInTheDocument();
  });
});

// =============================================================================
// Nhóm 4 — cổng đóng / lỗi mạng
// =============================================================================

describe('ParentReport — cổng đóng và lỗi', () => {
  it('⚠️ cổng đã đóng (403 PARENT_GATE_REQUIRED) ⇒ BÁO cho chủ trang quay về cổng, KHÔNG hiện lỗi', async () => {
    getMock.mockRejectedValue(
      new ApiClientError('PARENT_GATE_REQUIRED', 'Cần mở cổng', 403),
    );
    const { onGateClosed } = renderReport();

    await waitFor(() => expect(onGateClosed).toHaveBeenCalled());
    // KHÔNG phải màn hình lỗi kỹ thuật — đây là chuyện bình thường (cổng hết hạn 10 phút).
    expect(screen.queryByText(/Chưa mở được báo cáo/)).not.toBeInTheDocument();
  });

  it('lỗi mạng ⇒ câu trung tính + nút Thử lại, KHÔNG lộ chi tiết kỹ thuật', async () => {
    getMock.mockRejectedValue(
      new ApiClientError('INTERNAL_ERROR', 'NetworkError: failed to fetch', 500, {
        isNetworkError: true,
      }),
    );
    renderReport();

    expect(await screen.findByText('Chưa mở được báo cáo. Bố mẹ thử lại nhé!')).toBeInTheDocument();
    expect(screen.queryByText(/NetworkError/)).not.toBeInTheDocument();

    // Nút "Thử lại" thật sự đọc lại.
    getMock.mockResolvedValue(report());
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2));
  });
});

// =============================================================================
// Nhóm 5 — ⭐ LUẬT TRẺ
// =============================================================================

/** Quét `innerHTML` ⇒ bắt cả `aria-label` lẫn chuỗi bị hardcode trong JSX. */
const BANNED_WORDS = ['sai', 'kém', 'chưa đạt', 'thất bại'] as const;

function assertNoBannedWords(container: HTMLElement): void {
  const html = container.innerHTML;
  for (const word of BANNED_WORDS) {
    expect(html.includes(word)).toBe(false);
  }
}

describe('ParentReport — LUẬT TRẺ: không phán xét (kể cả với phụ huynh)', () => {
  it('trạng thái CÓ dữ liệu sạch từ bị cấm', async () => {
    getMock.mockResolvedValue(
      report({
        strugglingWords: [
          { wordId: 'w-elephant', en: 'elephant', vi: 'con voi', correctCount: 1, wrongCount: 4, accuracy: 0.2 },
        ],
      }),
    );
    const { container } = render(<ParentReport childId={CHILD} onGateClosed={vi.fn()} />);
    await screen.findByText('Bé Na đã học đều đặn trong tuần này.');

    assertNoBannedWords(container);
  });

  it('trạng thái RỖNG (tuần chưa có gì) sạch từ bị cấm', async () => {
    getMock.mockResolvedValue(
      report({
        dailyStats: [],
        wordsLearned: 0,
        wordsMastered: 0,
        lessonsCompleted: 0,
        starsEarned: 0,
        summary_vi: 'Bé Na chưa có hoạt động nào trong tuần này.',
      }),
    );
    const { container } = render(<ParentReport childId={CHILD} onGateClosed={vi.fn()} />);
    await screen.findByText('Tuần này chưa có ngày nào học. Số liệu sẽ hiện khi bé bắt đầu học nhé!');

    assertNoBannedWords(container);
  });

  it('trạng thái LỖI sạch từ bị cấm', async () => {
    getMock.mockRejectedValue(new ApiClientError('INTERNAL_ERROR', 'boom', 500));
    const { container } = render(<ParentReport childId={CHILD} onGateClosed={vi.fn()} />);
    await screen.findByText('Chưa mở được báo cáo. Bố mẹ thử lại nhé!');

    assertNoBannedWords(container);
  });
});
