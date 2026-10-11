/**
 * Test cho `ParentGatePage` (T072) — cổng PIN khu vực phụ huynh.
 *
 * Bốn luật của màn này được khoá lại ở đây, vì cả bốn đều hỏng IM LẶNG:
 *
 *   1. **KHÔNG tiết lộ "tài khoản đã đặt PIN hay chưa".** `parent_account.pin_hash` là nullable.
 *      Một câu như "Bố mẹ chưa đặt PIN" là rò rỉ cho người đang dò. Test khẳng định màn hình chỉ
 *      phản ánh trạng thái PHIÊN, không có nhánh nào nhận xét tài khoản.
 *
 *   2. **ĐỘ DÀI PIN lấy từ `PARENT_PIN_LENGTH`, KHÔNG ghim cứng.** Test đọc chính hằng số dùng
 *      chung để dựng kỳ vọng ⇒ hằng số đổi thì test vẫn đúng, và một câu ghim cứng "4" sẽ bị bắt.
 *
 *   3. **LỖI ĐỌC TRẠNG THÁI ⇒ mặc định ĐÓNG.** Mặc định "đã mở" khi mạng lỗi là cho vào khu vực
 *      phụ huynh mà không cần PIN.
 *
 *   4. **LUẬT TRẺ** (áp cho cả màn của người lớn): sai PIN thì câu TRUNG TÍNH mời thử lại, không
 *      phán xét. Quét DOM thật (kể cả `aria-label`) để bắt cả chuỗi hardcode.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import { ApiClientError } from '@/api/client.js';
import { parentApi, reportApi } from '@/api/endpoints.js';
import { ParentGatePage } from '@/pages/parent/ParentGatePage.js';
import { useSessionStore } from '@/store/sessionStore.js';
import { PARENT_PIN_LENGTH } from '@shared/constants.js';
import type { ChildProfileDto, ReportResponse } from '@shared/types/api.js';

vi.mock('@/api/endpoints.js', () => ({
  parentApi: { gateStatus: vi.fn(), openGate: vi.fn(), setPin: vi.fn(), resetPin: vi.fn() },
  reportApi: { get: vi.fn() },
}));

const gateStatusMock = vi.mocked(parentApi.gateStatus);
const openGateMock = vi.mocked(parentApi.openGate);
const setPinMock = vi.mocked(parentApi.setPin);
const resetPinMock = vi.mocked(parentApi.resetPin);
const reportGetMock = vi.mocked(reportApi.get);

/** PIN hợp lệ — độ dài lấy từ HẰNG SỐ dùng chung, test cũng không ghim cứng số 4. */
const PIN = '1'.repeat(PARENT_PIN_LENGTH);

const EXPIRES_AT = '2026-10-08T13:10:00.000Z';
const CHILD = 'chi_na';

/** Bé đang chọn — báo cáo là báo cáo của bé này (`useActiveChild`). */
const CHILD_PROFILE: ChildProfileDto = {
  id: CHILD,
  nickname: 'Na',
  age: 7,
  avatarId: 'rabbit',
  createdAt: EXPIRES_AT,
};

/** Báo cáo tối thiểu để màn báo cáo render được (chi tiết số liệu đã có `parent-report.test.tsx`). */
function reportFixture(): ReportResponse {
  return {
    child: CHILD_PROFILE,
    summary_vi: 'Bé Na đã học đều đặn trong tuần này.',
    range: { from: '2026-10-05', to: '2026-10-11' },
    dailyStats: [],
    wordsLearned: 0,
    wordsMastered: 0,
    lessonsCompleted: 0,
    starsEarned: 0,
    strugglingWords: [],
    masteredWords: [],
    finalTest: [],
    parentSpeaking: { items: [], updatedAt: null },
  };
}

function renderPage(): ReturnType<typeof render> {
  // `MemoryRouter` vì trang có `<Link>` quay về trang học.
  return render(
    <MemoryRouter>
      <ParentGatePage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Có bé đang chọn — chủ trang đọc `useActiveChild()` để biết lập báo cáo cho ai.
  useSessionStore.setState({ children: [CHILD_PROFILE], activeChildId: CHILD });
  gateStatusMock.mockResolvedValue({ opened: false, expiresAt: null });
  openGateMock.mockResolvedValue({ opened: true, expiresAt: EXPIRES_AT });
  setPinMock.mockResolvedValue({ ok: true });
  resetPinMock.mockResolvedValue({ ok: true });
  reportGetMock.mockResolvedValue(reportFixture());
});

// =============================================================================
// Cổng đóng — ô nhập PIN
// =============================================================================

describe('ParentGatePage — cổng đóng', () => {
  it('hiện ô nhập PIN; độ dài + câu hướng dẫn suy từ HẰNG SỐ (không ghim cứng)', async () => {
    renderPage();

    const input = await screen.findByLabelText('Nhập mã PIN');
    expect(input).toHaveAttribute('maxlength', String(PARENT_PIN_LENGTH));
    expect(input).toHaveAttribute('inputmode', 'numeric');
    // Không để trình duyệt lưu/điền lại PIN.
    expect(input).toHaveAttribute('autocomplete', 'off');

    // ⚠️ Câu hướng dẫn phải NÓI ĐÚNG độ dài, và con số đó đến từ hằng số — không phải chuỗi "4".
    expect(screen.getByText(`Nhập mã PIN ${PARENT_PIN_LENGTH} số`)).toBeInTheDocument();
  });

  it('⚠️ nút gửi bật khi ĐỦ độ dài, và KHÔNG tự động gửi (không auto-submit)', async () => {
    renderPage();
    const input = await screen.findByLabelText('Nhập mã PIN');
    const submit = screen.getByRole('button', { name: 'Mở khoá' });

    expect(submit).toBeDisabled();
    fireEvent.change(input, { target: { value: PIN } });
    expect(submit).toBeEnabled();
    // Vừa đủ độ dài KHÔNG được tự gửi — bé/phụ huynh phải tự bấm.
    expect(openGateMock).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Nhập PIN
// =============================================================================

describe('ParentGatePage — nhập PIN', () => {
  it('nhập ĐÚNG ⇒ gọi API với `{ pin }` và MỞ cổng', async () => {
    renderPage();
    const input = await screen.findByLabelText('Nhập mã PIN');
    fireEvent.change(input, { target: { value: PIN } });
    fireEvent.click(screen.getByRole('button', { name: 'Mở khoá' }));

    await waitFor(() => expect(openGateMock).toHaveBeenCalledWith({ pin: PIN }));
    expect(await screen.findByText(/Khu vực phụ huynh đã mở/)).toBeInTheDocument();
  });

  it('⚠️ nhập SAI ⇒ câu TRUNG TÍNH mời thử lại, KHÔNG mở, KHÔNG lộ message của server', async () => {
    // Server trả 403 `INVALID_PIN` — kết quả BÌNH THƯỜNG (gõ nhầm), không phải sự cố.
    openGateMock.mockRejectedValue(new ApiClientError('INVALID_PIN', 'Mã PIN sai rồi', 403));
    renderPage();

    const input = await screen.findByLabelText('Nhập mã PIN');
    fireEvent.change(input, { target: { value: PIN } });
    fireEvent.click(screen.getByRole('button', { name: 'Mở khoá' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Mã PIN chưa đúng. Bố mẹ thử lại nhé.',
    );
    // Vẫn ở cổng, KHÔNG mở.
    expect(screen.queryByText(/Khu vực phụ huynh đã mở/)).not.toBeInTheDocument();
    // Câu của server KHÔNG được lộ — UI giữ câu ổn định của mình (và câu đó bắt đầu bằng "Mã PIN
    // sai…" — chính là một từ bị cấm, nên lộ ra là vỡ cả luật ngôn ngữ).
    expect(screen.queryByText('Mã PIN sai rồi')).not.toBeInTheDocument();
  });

  it('⚠️ LUẬT AN NINH: nhập sai KHÔNG tiết lộ tài khoản có PIN hay chưa', async () => {
    openGateMock.mockRejectedValue(new ApiClientError('INVALID_PIN', 'Mã PIN sai rồi', 403));
    const { container } = renderPage();

    const input = await screen.findByLabelText('Nhập mã PIN');
    fireEvent.change(input, { target: { value: PIN } });
    fireEvent.click(screen.getByRole('button', { name: 'Mở khoá' }));
    await screen.findByRole('alert');

    const text = container.textContent ?? '';
    for (const leak of ['chưa đặt', 'chưa có PIN', 'chưa tạo PIN', 'chưa thiết lập', 'không có PIN']) {
      expect(text.includes(leak)).toBe(false);
    }
  });
});

// =============================================================================
// Đọc trạng thái cổng
// =============================================================================

describe('ParentGatePage — đọc trạng thái cổng', () => {
  it('⚠️ đọc trạng thái LỖI ⇒ mặc định ĐÓNG (hiện ô nhập PIN), KHÔNG mở cổng', async () => {
    gateStatusMock.mockRejectedValue(
      new ApiClientError('INTERNAL_ERROR', 'boom', 500, { isNetworkError: true }),
    );
    renderPage();

    expect(await screen.findByLabelText('Nhập mã PIN')).toBeInTheDocument();
    expect(screen.queryByText(/Khu vực phụ huynh đã mở/)).not.toBeInTheDocument();
    // ⚠️ Vẫn ĐÓNG (fail-secure) NHƯNG nói ra lý do — im lặng thì người lớn không hiểu vì sao
    //    nhập mã đúng cũng không vào. Câu này chỉ nói về LẦN ĐỌC, không rò rỉ gì về tài khoản.
    expect(screen.getByRole('status')).toHaveTextContent('Chưa kiểm tra được cổng. Bố mẹ thử lại nhé.');
  });

  it('cổng đã mở ⇒ hiện trạng thái mở + form ĐẶT PIN, KHÔNG hỏi lại PIN cổng', async () => {
    gateStatusMock.mockResolvedValue({ opened: true, expiresAt: EXPIRES_AT });
    renderPage();

    expect(await screen.findByText(/Khu vực phụ huynh đã mở/)).toBeInTheDocument();
    // Form đặt/đổi PIN thuộc T072 (không phải T074) — phải còn.
    expect(screen.getByLabelText('Đặt mã PIN')).toBeInTheDocument();
    // KHÔNG hỏi lại PIN cổng khi đã mở.
    expect(screen.queryByLabelText('Nhập mã PIN')).not.toBeInTheDocument();
  });
});

// =============================================================================
// Đặt / đổi mã PIN
// =============================================================================

describe('ParentGatePage — đặt mã PIN', () => {
  it('lưu PIN mới ⇒ gọi API và báo đã lưu', async () => {
    gateStatusMock.mockResolvedValue({ opened: true, expiresAt: EXPIRES_AT });
    renderPage();

    const field = await screen.findByLabelText('Đặt mã PIN');
    fireEvent.change(field, { target: { value: PIN } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() => expect(setPinMock).toHaveBeenCalledWith({ pin: PIN }));
    expect(await screen.findByText('Đã lưu mã PIN.')).toBeInTheDocument();
  });
});

// =============================================================================
// Quên mã PIN — đặt lại bằng mật khẩu (T072.2)
// =============================================================================

const PASSWORD = 'mat-khau-cua-bo-me';

/** Mở đường lùi "Quên mã PIN" từ trạng thái cổng đóng. */
async function openForgotForm(): Promise<void> {
  renderPage();
  await screen.findByLabelText('Nhập mã PIN');
  fireEvent.click(screen.getByRole('button', { name: 'Quên mã PIN?' }));
  // Form đặt lại hiện ra (thay form nhập PIN).
  await screen.findByLabelText('Mật khẩu của bố mẹ');
}

describe('ParentGatePage — quên mã PIN', () => {
  it('bấm "Quên mã PIN?" ⇒ hiện form đặt lại (mật khẩu + PIN mới), ẩn form nhập PIN', async () => {
    await openForgotForm();

    expect(screen.getByLabelText('Mật khẩu của bố mẹ')).toBeInTheDocument();
    const newPinField = screen.getByLabelText('Mã PIN mới');
    expect(newPinField).toHaveAttribute('maxlength', String(PARENT_PIN_LENGTH));
    // Nhãn nhìn thấy của PIN mới cũng suy độ dài từ hằng số, không ghim cứng.
    expect(screen.getByText(`Mã PIN mới (${PARENT_PIN_LENGTH} số)`)).toBeInTheDocument();
    // KHÔNG còn ô nhập PIN của cổng.
    expect(screen.queryByLabelText('Nhập mã PIN')).not.toBeInTheDocument();
  });

  it('⚠️ đặt lại THÀNH CÔNG ⇒ gọi API, báo xong, và KHÔNG tự mở cổng', async () => {
    await openForgotForm();

    fireEvent.change(screen.getByLabelText('Mật khẩu của bố mẹ'), {
      target: { value: PASSWORD },
    });
    fireEvent.change(screen.getByLabelText('Mã PIN mới'), { target: { value: PIN } });
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại' }));

    await waitFor(() => expect(resetPinMock).toHaveBeenCalledWith({ password: PASSWORD, pin: PIN }));
    expect(await screen.findByText(/Đã đặt lại mã PIN/)).toBeInTheDocument();
    // ⚠️ Đặt lại PIN KHÔNG phải một cú mở cổng — bố mẹ vẫn phải nhập mã mới ở cổng.
    expect(screen.queryByText(/Khu vực phụ huynh đã mở/)).not.toBeInTheDocument();
  });

  it('⚠️ SAI mật khẩu ⇒ câu TRUNG TÍNH riêng, KHÔNG dùng câu của màn đăng nhập', async () => {
    resetPinMock.mockRejectedValue(new ApiClientError('INVALID_CREDENTIALS', 'Mật khẩu sai', 403));
    await openForgotForm();

    fireEvent.change(screen.getByLabelText('Mật khẩu của bố mẹ'), {
      target: { value: PASSWORD },
    });
    fireEvent.change(screen.getByLabelText('Mã PIN mới'), { target: { value: PIN } });
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Mật khẩu chưa đúng. Bố mẹ thử lại nhé.',
    );
    // Câu của màn ĐĂNG NHẬP nói về cả email lẫn mật khẩu ⇒ SAI ở đây (không có ô email).
    expect(screen.queryByText('Email hoặc mật khẩu không đúng')).not.toBeInTheDocument();
    // Vẫn chưa mở cổng, và không tiết lộ tài khoản có PIN hay chưa.
    expect(screen.queryByText(/Khu vực phụ huynh đã mở/)).not.toBeInTheDocument();
  });

  it('nút "Quay lại nhập mã PIN" ⇒ trở về cổng, KHÔNG đặt lại gì', async () => {
    await openForgotForm();

    fireEvent.click(screen.getByRole('button', { name: 'Quay lại nhập mã PIN' }));

    expect(await screen.findByLabelText('Nhập mã PIN')).toBeInTheDocument();
    expect(screen.queryByLabelText('Mật khẩu của bố mẹ')).not.toBeInTheDocument();
    expect(resetPinMock).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Báo cáo tuần — điểm vào (VIEW trong /parent, không route mới) — T073
// =============================================================================

describe('ParentGatePage — mở báo cáo tuần', () => {
  it('cổng mở ⇒ nút "Xem báo cáo tuần" hiện báo cáo, và quay lại được', async () => {
    gateStatusMock.mockResolvedValue({ opened: true, expiresAt: EXPIRES_AT });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Xem báo cáo tuần' }));

    expect(await screen.findByText('Bé Na đã học đều đặn trong tuần này.')).toBeInTheDocument();
    // Báo cáo là của BÉ ĐANG CHỌN.
    expect(reportGetMock).toHaveBeenCalledWith(CHILD);

    fireEvent.click(screen.getByRole('button', { name: 'Quay lại khu vực phụ huynh' }));
    expect(await screen.findByRole('button', { name: 'Xem báo cáo tuần' })).toBeInTheDocument();
  });

  it('⚠️ báo cáo trả 403 (cổng hết hạn) ⇒ QUAY VỀ màn nhập PIN, KHÔNG hiện lỗi kỹ thuật', async () => {
    gateStatusMock.mockResolvedValue({ opened: true, expiresAt: EXPIRES_AT });
    reportGetMock.mockRejectedValue(new ApiClientError('PARENT_GATE_REQUIRED', 'Cần mở cổng', 403));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Xem báo cáo tuần' }));

    // Cổng coi như ĐÓNG ⇒ hiện lại ô nhập PIN (đường đi bình thường khi cổng hết hạn 10 phút).
    expect(await screen.findByLabelText('Nhập mã PIN')).toBeInTheDocument();
    expect(screen.queryByText(/Chưa mở được báo cáo/)).not.toBeInTheDocument();
    // ⚠️ Và NÓI RA lý do — không thì phụ huynh thấy màn nhập PIN mà không hiểu vì sao.
    expect(screen.getByRole('status')).toHaveTextContent(
      'Thao tác này cần mở khu vực phụ huynh bằng mã PIN. Bố mẹ nhập mã PIN nhé!',
    );
  });
});

// =============================================================================
// ⭐ LUẬT TRẺ
// =============================================================================

/** Quét `innerHTML` ⇒ bắt cả `aria-label` lẫn chuỗi bị hardcode trong JSX. */
const BANNED_WORDS = ['sai', 'kém', 'chưa đạt', 'thất bại'] as const;

function assertNoBannedWords(container: HTMLElement): void {
  const html = container.innerHTML;
  for (const word of BANNED_WORDS) {
    expect(html.includes(word)).toBe(false);
  }
}

describe('ParentGatePage — LUẬT TRẺ: không phán xét', () => {
  it('trạng thái cổng ĐÓNG sạch từ bị cấm', async () => {
    const { container } = renderPage();
    await screen.findByLabelText('Nhập mã PIN');

    assertNoBannedWords(container);
  });

  it('trạng thái NHẬP SAI sạch từ bị cấm', async () => {
    openGateMock.mockRejectedValue(new ApiClientError('INVALID_PIN', 'Mã PIN sai rồi', 403));
    const { container } = renderPage();

    const input = await screen.findByLabelText('Nhập mã PIN');
    fireEvent.change(input, { target: { value: PIN } });
    fireEvent.click(screen.getByRole('button', { name: 'Mở khoá' }));
    await screen.findByRole('alert');

    assertNoBannedWords(container);
  });

  it('trạng thái cổng MỞ sạch từ bị cấm', async () => {
    gateStatusMock.mockResolvedValue({ opened: true, expiresAt: EXPIRES_AT });
    const { container } = renderPage();
    await screen.findByText(/Khu vực phụ huynh đã mở/);

    assertNoBannedWords(container);
  });

  it('màn "QUÊN mã PIN" (kể cả khi mật khẩu sai) sạch từ bị cấm', async () => {
    resetPinMock.mockRejectedValue(new ApiClientError('INVALID_CREDENTIALS', 'Mật khẩu sai', 403));
    const { container } = renderPage();
    await screen.findByLabelText('Nhập mã PIN');
    fireEvent.click(screen.getByRole('button', { name: 'Quên mã PIN?' }));
    fireEvent.change(await screen.findByLabelText('Mật khẩu của bố mẹ'), {
      target: { value: PASSWORD },
    });
    fireEvent.change(screen.getByLabelText('Mã PIN mới'), { target: { value: PIN } });
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại' }));
    await screen.findByRole('alert');

    assertNoBannedWords(container);
  });
});
