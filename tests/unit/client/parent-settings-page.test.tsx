/**
 * Test cho `ParentSettingsPage` (T074 + phần client của #28) — Cài đặt trong khu vực phụ huynh.
 *
 * Bốn luật của màn này được khoá lại, vì cả bốn đều hỏng IM LẶNG:
 *
 *   1. **`false` LÀ GIÁ TRỊ THẬT.** `soundEnabled/musicEnabled/reducedMotion = false` đều là Ý ĐỊNH
 *      của phụ huynh. Một dòng `x || true` (thay vì `x ?? true`) sẽ biến `false` thành `true` và
 *      KHÔNG ném lỗi nào: phụ huynh tắt tiếng mà app vẫn kêu. Test khẳng định cả `settingsStore`
 *      lẫn `aria-checked` đều là "tắt".
 *
 *   2. **PATCH CHỈ gửi trường VỪA ĐỔI.** Gửi cả cụm thì hai thiết bị đang mở sẽ ghi đè lẫn nhau.
 *
 *   3. **LỖI MẠNG KHÔNG làm mất giá trị đang hiển thị** (không tự bật ngược công tắc về giá trị cũ).
 *
 *   4. **SỬA/XOÁ hồ sơ là việc QUẢN TRỊ** ⇒ ở sau cổng, và hỏng vì cổng đóng (403) thì QUAY VỀ cổng
 *      chứ không hiện lỗi kỹ thuật.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import { ApiClientError } from '@/api/client.js';
import { authApi, childrenApi, settingsApi } from '@/api/endpoints.js';
import { ParentSettingsPage } from '@/pages/parent/ParentSettingsPage.js';
import { __resetSettingsForTests, useSettingsStore } from '@/store/settingsStore.js';
import { useSessionStore } from '@/store/sessionStore.js';
import type { ChildProfileDto, SettingsDto } from '@shared/types/api.js';

vi.mock('@/api/endpoints.js', () => ({
  settingsApi: { get: vi.fn(), update: vi.fn() },
  childrenApi: { update: vi.fn(), remove: vi.fn() },
  authApi: { logout: vi.fn() },
}));

const getMock = vi.mocked(settingsApi.get);
const updateMock = vi.mocked(settingsApi.update);
const childrenUpdateMock = vi.mocked(childrenApi.update);
const childrenRemoveMock = vi.mocked(childrenApi.remove);
const logoutMock = vi.mocked(authApi.logout);

const NOW = '2026-10-08T08:00:00.000Z';

const CHILD_A: ChildProfileDto = {
  id: 'chi_a',
  nickname: 'Na',
  age: 7,
  avatarId: 'rabbit',
  createdAt: NOW,
};
const CHILD_B: ChildProfileDto = {
  id: 'chi_b',
  nickname: 'Bin',
  age: 9,
  avatarId: 'fox',
  createdAt: NOW,
};

function settings(overrides: Partial<SettingsDto> = {}): SettingsDto {
  return {
    soundEnabled: true,
    musicEnabled: true,
    speechRate: 0.8,
    reducedMotion: false,
    ...overrides,
  };
}

function renderPage(): { onGateClosed: ReturnType<typeof vi.fn> } {
  const onGateClosed = vi.fn();
  const client = new QueryClient({
    // Không retry: một lần hỏng phải hiện ngay, không chờ vài vòng thử lại.
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    /*
      ⚠️ PHẢI CÓ `MemoryRouter`: màn này chứa một `<Link to="/children/new">` (lối vào "Thêm bé").
      Thiếu Router, `Link` ném `Cannot destructure property 'basename' of useContext(...)` — một
      lỗi của MÔI TRƯỜNG TEST bị đọc nhầm thành "trang hỏng", và nó làm đỏ CẢ 10 test của tệp này
      chứ không chỉ test liên quan. `AppShell` thật luôn có Router, nên đây mới là môi trường đúng.
    */
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ParentSettingsPage onGateClosed={onGateClosed} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { onGateClosed };
}

/** Như `renderPage` nhưng trả `container` — dùng cho nhóm test quét `innerHTML`. */
function renderForHtml(): { container: HTMLElement } {
  const client = new QueryClient();
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ParentSettingsPage onGateClosed={vi.fn()} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

/** Chờ màn nạp xong (công tắc đầu tiên xuất hiện). */
async function waitReady(): Promise<void> {
  await screen.findByRole('switch', { name: /Âm thanh/ });
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetSettingsForTests();
  useSessionStore.setState({ children: [CHILD_A, CHILD_B], activeChildId: CHILD_A.id });
  getMock.mockResolvedValue(settings());
  updateMock.mockResolvedValue(settings());
  childrenUpdateMock.mockResolvedValue({ child: CHILD_A });
  childrenRemoveMock.mockResolvedValue({ ok: true });
  logoutMock.mockResolvedValue({ ok: true });
});

// =============================================================================
// Nhóm 1 — giá trị từ server (kể cả `false`)
// =============================================================================

describe('ParentSettingsPage — giá trị từ server', () => {
  it('⚠️ áp ĐÚNG `false` từ server — không bị biến thành `true`', async () => {
    getMock.mockResolvedValue(
      settings({ soundEnabled: false, musicEnabled: false, reducedMotion: false }),
    );
    renderPage();
    await waitReady();

    /*
      ⚠️ ĐIỂM MẤU CHỐT: `settingsStore` là nơi `SoundButton`/`SpeechService` đọc. Nếu chỗ áp dụng
      viết `data.soundEnabled || true` thì hai dòng dưới thành `true` — và KHÔNG có lỗi nào ném ra.
    */
    expect(useSettingsStore.getState().soundEnabled).toBe(false);
    expect(useSettingsStore.getState().musicEnabled).toBe(false);
    expect(useSettingsStore.getState().reducedMotion).toBe(false);

    // Và trên màn hình công tắc phải ở trạng thái TẮT.
    expect(screen.getByRole('switch', { name: /Âm thanh/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('switch', { name: /Giảm hiệu ứng/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('bật lại được một công tắc đang tắt (false → true gửi đúng `true`)', async () => {
    getMock.mockResolvedValue(settings({ soundEnabled: false }));
    renderPage();
    await waitReady();
    updateMock.mockClear();

    fireEvent.click(screen.getByRole('switch', { name: /Âm thanh/ }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith('chi_a', { soundEnabled: true }));
  });
});

// =============================================================================
// Nhóm 2 — ghi lên server
// =============================================================================

describe('ParentSettingsPage — ghi cài đặt', () => {
  it('⚠️ PATCH CHỈ gửi trường vừa đổi (không gửi cả cụm)', async () => {
    renderPage();
    await waitReady();
    updateMock.mockClear();

    fireEvent.click(screen.getByRole('switch', { name: /Nhạc nền/ }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    // CHỈ `musicEnabled` — không kèm soundEnabled/speechRate/reducedMotion.
    expect(updateMock).toHaveBeenCalledWith('chi_a', { musicEnabled: false });
  });

  it('⚠️ lỗi mạng ⇒ GIỮ nguyên giá trị vừa chọn + câu trung tính (không hoàn tác)', async () => {
    renderPage();
    await waitReady();
    updateMock.mockRejectedValue(
      new ApiClientError('INTERNAL_ERROR', 'NetworkError: failed to fetch', 500, {
        isNetworkError: true,
      }),
    );

    fireEvent.click(screen.getByRole('switch', { name: /Âm thanh/ }));

    // Công tắc KHÔNG tự bật ngược lại — phụ huynh không phải làm lại từ đầu.
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: /Âm thanh/ })).toHaveAttribute(
        'aria-checked',
        'false',
      ),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Chưa lưu được. Bố mẹ thử lại nhé!');
    // Không lộ chi tiết kỹ thuật.
    expect(screen.queryByText(/NetworkError/)).not.toBeInTheDocument();
  });

  it('⚠️ cổng đã đóng (403) khi ĐỌC cài đặt ⇒ báo chủ trang quay về cổng', async () => {
    getMock.mockRejectedValue(new ApiClientError('PARENT_GATE_REQUIRED', 'Cần mở cổng', 403));
    const { onGateClosed } = renderPage();

    await waitFor(() => expect(onGateClosed).toHaveBeenCalled());
    // Không phải màn hình lỗi kỹ thuật.
    expect(screen.queryByText(/Chưa mở được cài đặt/)).not.toBeInTheDocument();
  });
});

// =============================================================================
// Nhóm 3 — hồ sơ các bé (quản trị, ở sau cổng)
// =============================================================================

describe('ParentSettingsPage — hồ sơ các bé', () => {
  it('sửa biệt danh ⇒ gọi API với CHỈ trường vừa đổi', async () => {
    renderPage();
    await waitReady();

    const row = screen.getByText('Na').closest('li');
    expect(row).not.toBeNull();
    const inRow = within(row as HTMLElement);

    fireEvent.click(inRow.getByRole('button', { name: 'Sửa hồ sơ' }));
    fireEvent.change(inRow.getByLabelText('Biệt danh của bé'), { target: { value: 'Na Mập' } });
    fireEvent.click(inRow.getByRole('button', { name: 'Lưu' }));

    await waitFor(() =>
      expect(childrenUpdateMock).toHaveBeenCalledWith('chi_a', { nickname: 'Na Mập' }),
    );
  });

  it('⚠️ xoá hồ sơ là HAI bước — chưa xác nhận thì KHÔNG gọi API', async () => {
    renderPage();
    await waitReady();

    const row = screen.getByText('Bin').closest('li') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Xoá hồ sơ' }));

    // Bước 1 chỉ hỏi lại (và nêu ĐÚNG TÊN bé) — chưa xoá gì.
    expect(childrenRemoveMock).not.toHaveBeenCalled();
    expect(within(row).getByText(/Xoá hồ sơ của Bin/)).toBeInTheDocument();

    fireEvent.click(within(row).getByRole('button', { name: 'Xoá hẳn' }));

    await waitFor(() => expect(childrenRemoveMock).toHaveBeenCalledWith('chi_b'));
  });

  it('đổi hồ sơ đang dùng ⇒ đổi bé đang chọn (KHÔNG gọi mạng — việc bình thường của bé)', async () => {
    renderPage();
    await waitReady();

    const row = screen.getByText('Bin').closest('li') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Đổi hồ sơ bé' }));

    expect(useSessionStore.getState().activeChildId).toBe('chi_b');
    expect(childrenUpdateMock).not.toHaveBeenCalled();
  });

  it('⚠️ sửa hồ sơ mà cổng đã đóng (403) ⇒ quay về cổng, không lộ lỗi', async () => {
    childrenUpdateMock.mockRejectedValue(
      new ApiClientError('PARENT_GATE_REQUIRED', 'Cần mở cổng', 403),
    );
    const { onGateClosed } = renderPage();
    await waitReady();

    const row = screen.getByText('Na').closest('li') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Sửa hồ sơ' }));
    fireEvent.click(within(row).getByRole('button', { name: 'Lưu' }));

    await waitFor(() => expect(onGateClosed).toHaveBeenCalled());
  });

  it('đăng xuất ⇒ gọi API đăng xuất', async () => {
    renderPage();
    await waitReady();

    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));

    await waitFor(() => expect(logoutMock).toHaveBeenCalled());
  });
});

// =============================================================================
// Nhóm 4 — ⭐ LUẬT TRẺ
// =============================================================================

/** Quét `innerHTML` ⇒ bắt cả `aria-label` lẫn chuỗi bị hardcode trong JSX. */
const BANNED_WORDS = ['sai', 'kém', 'chưa đạt', 'thất bại'] as const;

function assertNoBannedWords(container: HTMLElement): void {
  const html = container.innerHTML;
  for (const word of BANNED_WORDS) {
    expect(html.includes(word)).toBe(false);
  }
}

describe('ParentSettingsPage — LUẬT TRẺ: không phán xét', () => {
  it('trạng thái có dữ liệu sạch từ bị cấm', async () => {
    const { container } = renderForHtml();
    await waitReady();

    assertNoBannedWords(container);
  });

  it('trạng thái LỖI tải sạch từ bị cấm', async () => {
    getMock.mockRejectedValue(new ApiClientError('INTERNAL_ERROR', 'boom', 500));
    const { container } = renderForHtml();
    await screen.findByText('Chưa mở được cài đặt. Bố mẹ thử lại nhé!');

    assertNoBannedWords(container);
  });
});

// =============================================================================
// Nhóm 5 — ⭐ LỐI VÀO "THÊM BÉ"
// =============================================================================

describe('ParentSettingsPage — lối vào "Thêm bé"', () => {
  it('⚠️ có liên kết tới /children/new, và nó nằm TRONG mục "hồ sơ các bé"', async () => {
    renderPage();
    await waitReady();

    /*
      ⚠️ ĐÂY LÀ LỐI VÀO `/children/new` DUY NHẤT TRONG APP.
      Trước đây `JourneyMapPage` (màn hình của bé) giữ tạm một liên kết như vậy; nó đã bị gỡ.
      Nếu test này đỏ vì "không tìm thấy", hãy kiểm `JourneyMapPage` trước khi kết luận là mất
      chức năng — không được gỡ ở đây để "sửa" cho xanh.
    */
    const link = screen.getByRole('link', { name: /Thêm bé/ });
    expect(link).toHaveAttribute('href', '/children/new');

    // Thuộc ĐÚNG mục hồ sơ các bé, không phải một nút lạc ở cuối trang.
    const childrenSection = document.getElementById('parent-children-title')?.closest('section');
    expect(childrenSection).not.toBeNull();
    expect(within(childrenSection as HTMLElement).getByRole('link', { name: /Thêm bé/ })).toBe(link);
  });
});
