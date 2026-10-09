/**
 * Test cho `JourneyMapPage` — "BẢN ĐỒ HÀNH TRÌNH", màn hình chính của bé (đường dẫn `/`).
 *
 * ⭐ LUẬT ĐƯỢC KHOÁ Ở ĐÂY: **MÀN HÌNH CỦA BÉ CHỈ CÓ VIỆC CỦA BÉ.**
 *
 *   Giai đoạn đầu, khi khu vực phụ huynh chưa tồn tại, màn này có một khối TẠM gồm "Thêm bé" và
 *   "Đăng xuất" — chỉ để luồng đăng nhập → hồ sơ bé → bản đồ → đăng xuất kiểm chứng được đầu-cuối.
 *   Khối đó đã được GỠ khi `ParentSettingsPage` có chức năng thêm bé.
 *
 *   ⚠️ VÌ SAO PHẢI CÓ TEST CHO MỘT VIỆC GỠ BỎ:
 *     Gỡ một khối UI không làm test nào đỏ — không có gì để đỏ. Rồi vài tuần sau, khi ai đó cần
 *     "một nút đăng xuất cho tiện", chỗ dễ nhất để đặt chính là màn hình bé đang mở. Lúc đó
 *     không có gì cản, và thao tác quản trị lặng lẽ quay lại TRƯỚC cổng PIN.
 *     Test này là thứ duy nhất cản việc đó.
 *
 *   ⚠️ VÀ ĐỂ TEST NÀY CÓ NGHĨA, PHẢI CHỨNG MINH TRANG **THẬT SỰ ĐÃ RENDER** (khẳng định điều
 *     đang CÓ), rồi mới khẳng định điều KHÔNG có. Một test "không có nút X" chạy trên một
 *     component render ra `null` sẽ luôn xanh và không bảo vệ được gì — đó là test giả.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import { JourneyMapPage } from '@/pages/JourneyMapPage.js';
import { useSessionStore } from '@/store/sessionStore.js';
import type * as ChildStatusHooks from '@/hooks/useChildStatus.js';
import type * as ContentHooks from '@/hooks/useContent.js';
import type * as ThemeAccessHooks from '@/hooks/useThemeAccess.js';
import type { ChildProfileDto } from '@shared/types/api.js';

/*
  Ba hook dữ liệu được THAY BẰNG GIÁ TRỊ GIẢ, nhưng theo kiểu "chỉ ghi đè cái cần" — giữ nguyên
  mọi export khác (`importOriginal`). Ghi đè cả module bằng một object thủ công sẽ làm module
  khác trong đồ thị import chết với "No export named …" và biến một lỗi của test thành vẻ như
  component hỏng.

  `useThemeMap` trả `[]` ⇒ không `ThemeCard` nào được vẽ ⇒ không cần `Router` cho `Link` bên trong
  chúng. `useThemeAccess` trả `isHydrated: true` + `summary` đủ trường mà trang đọc.

  ⚠️ Kiểu cho `importOriginal` lấy từ `import type * as …` ở trên, KHÔNG viết
  `importOriginal<typeof import('…')>()`: lint của dự án chặn `import()` trong type annotation
  (`@typescript-eslint/consistent-type-imports`). Lỗi này `tsc` và `vitest` đều KHÔNG bắt —
  chỉ `npm run lint` bắt. Và vì `import type` bị xoá hoàn toàn lúc chạy, việc `vi.mock` được
  hoist lên trên các import không ảnh hưởng gì.
*/
vi.mock('@/hooks/useContent.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ContentHooks>();
  return { ...actual, useThemeMap: () => [] };
});

vi.mock('@/hooks/useThemeAccess.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ThemeAccessHooks>();
  return {
    ...actual,
    useThemeAccess: () => ({
      access: [],
      byThemeId: new Map(),
      summary: { wordsLearned: 0, wordCount: 275 },
      isHydrated: true,
    }),
  };
});

vi.mock('@/hooks/useChildStatus.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ChildStatusHooks>();
  return { ...actual, useChildStatus: () => ({ status: null }) };
});

const CHILD: ChildProfileDto = {
  id: 'chi_na',
  nickname: 'Na',
  age: 7,
  avatarId: 'rabbit',
  createdAt: '2026-10-08T08:00:00.000Z',
};

function renderPage(): { container: HTMLElement } {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <JourneyMapPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useSessionStore.setState({ children: [CHILD], activeChildId: CHILD.id });
});

describe('JourneyMapPage — trang thật sự render (chốt chống test giả)', () => {
  it('vẽ thẻ chào với tên bé, dải tóm tắt tiến độ và khu bản đồ', () => {
    renderPage();

    // Khẳng định điều đang CÓ. Thiếu khối này, mọi khẳng định phía dưới là vô nghĩa.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Na');
    expect(screen.getByRole('status')).toBeInTheDocument();
    // `map.summary` = 'Bé đã học {{done}}/{{total}} từ'. Dùng `getAllBy…` vì cùng chuỗi này còn
    // xuất hiện ở nhãn đọc của `ProgressBar` — một test "chỉ có một" sẽ đỏ vì lý do vô nghĩa.
    expect(screen.getAllByText('Bé đã học 0/275 từ').length).toBeGreaterThan(0);
  });
});

describe('JourneyMapPage — KHÔNG có thao tác quản trị (phải nằm sau cổng PIN ở /parent)', () => {
  it('⚠️ không có nút/link ĐĂNG XUẤT — đăng xuất thuộc /parent', () => {
    renderPage();

    expect(screen.queryByRole('button', { name: /Đăng xuất/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Đăng xuất/ })).toBeNull();
  });

  it('⚠️ không có lối vào /children/new — đây là việc quản trị, thuộc /parent', () => {
    const { container } = renderPage();

    for (const anchor of Array.from(container.querySelectorAll('a'))) {
      expect(anchor.getAttribute('href')).not.toBe('/children/new');
    }
    expect(screen.queryByRole('link', { name: /Thêm bé/ })).toBeNull();
  });
});
