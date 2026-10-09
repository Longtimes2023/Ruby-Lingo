/**
 * RubyLingo — `ThemePage`: chip trò chơi phải là LINK THẬT, dẫn tới ĐÚNG bài tập.
 *
 * ⭐ VÌ SAO CẦN TEST Ở TẦNG RENDER, KHÔNG CHỈ TEST HÀM THUẦN:
 *   `tests/unit/client/game-routing.test.ts` đã chứng minh `gamePath()` dựng ra URL đúng. Nhưng
 *   nó KHÔNG chứng minh `ThemePage` có gọi hàm đó, có gắn kết quả vào `<Link>`, hay có lọc đúng
 *   trò chơi được. Ba việc đó nằm rải trong JSX — và kiểu sai ở đây là:
 *     • quên gọi `isGamePlayable` ⇒ chip xám bấm không ra gì (đúng thứ cần tránh),
 *     • ghép sai `lessonId` với `exerciseSlug` ⇒ link dẫn sang bài khác,
 *     • dựng `<div>` thay vì `<Link>` ⇒ bé bấm không có gì xảy ra, KHÔNG có lỗi nào được ném.
 *   Không cổng nào bắt được ba thứ đó. Chỉ có render thật rồi soi DOM.
 *
 * ⚠️ Test này chạy trên NỘI DUNG THẬT (`at-the-zoo` — chủ đề đầu tiên nên luôn mở được), nên nó
 *   còn là bằng chứng `import.meta.glob` + `i18n` + `react-query` ghép được với nhau trong test.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import '@/i18n/index.js';
import { listLevelIds, readLevelBundle } from '@/data/index.js';
import { ThemePage } from '@/pages/ThemePage.js';

/** Chủ đề đầu tiên của cấp Starters — luôn mở được, và là chủ đề DUY NHẤT có bài tập hiện nay. */
const THEME_ID = 'at-the-zoo';

function renderThemePage(themeId: string = THEME_ID) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

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

/** Mẫu URL của route game — phải khớp `router.tsx`. */
const GAME_HREF_RE = /^\/lesson\/([^/]+)\/game\/([^/]+)$/;

/** Mọi `exercise.id` có thật trên đĩa, để đối chiếu link dựng ra. */
function realExerciseIds(): Set<string> {
  const ids = new Set<string>();
  for (const levelId of listLevelIds()) {
    for (const exercise of readLevelBundle(levelId).exercises) ids.add(exercise.id);
  }
  return ids;
}

describe('ThemePage — chip trò chơi đã chơi được', () => {
  it('render được tới danh sách bài học (không rơi vào màn hình khoá / không tìm thấy)', () => {
    renderThemePage();

    expect(screen.getByRole('heading', { name: 'Các bài học' })).toBeInTheDocument();
  });

  it('mỗi bài có một link "Chơi trò ..." cho trò đã làm — và trỏ tới bài tập CÓ THẬT', () => {
    renderThemePage();

    const gameLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.includes('/game/'));

    /**
     * `at-the-zoo` có 3 bài × 5 trò MVP = 15 link.
     *
     * ⚠️ Con số này là ĐIỂM GÃY CÓ CHỦ Ý của Nhóm 5: khi mới có `listen_tap` nó là 3, mỗi lần
     *   làm xong thêm một trò nó phải nhảy lên đúng +3. Test sẽ đỏ ngay nếu một trò bị bỏ quên
     *   khỏi `GAME_COMPONENTS`, hoặc nếu `isGamePlayable`/`isExercisePlayable` lọc nhầm.
     */
    expect(gameLinks.length).toBe(15);

    const known = realExerciseIds();

    for (const link of gameLinks) {
      const href = link.getAttribute('href') ?? '';

      // 1. Đúng mẫu route (không thừa đoạn, không thiếu đoạn).
      const match = GAME_HREF_RE.exec(href);
      expect(match, `href không khớp mẫu route: ${href}`).not.toBeNull();

      // 2. Giải mã ngược ra một bài tập CÓ THẬT — đây là điều bé quan tâm: bấm vào là chơi được.
      const exerciseId = `${decodeURIComponent(match![1]!)}/${decodeURIComponent(match![2]!)}`;
      expect(known.has(exerciseId), `link dẫn tới bài tập không tồn tại: ${exerciseId}`).toBe(true);
    }
  });

  it('cả 5 trò MVP đều là link — mỗi bài một link cho mỗi trò', () => {
    renderThemePage();

    /**
     * Đối chiếu với `GAME_LABELS`: cả 5 trò MVP phải là LINK THẬT. Nếu một trò bị rơi khỏi
     * `GAME_COMPONENTS`, `isGamePlayable` trả `false` ⇒ chip biến mất (hoặc thành chữ thường),
     * và test này đỏ ngay ở trò đó — không cần đọc DOM bằng mắt.
     *
     * `getAllByRole` (KHÔNG phải `queryByRole`): ném lỗi khi không tìm thấy, đúng thứ ta cần —
     * "trò đã làm mà không có link" là hỏng, chứ không phải một trạng thái hợp lệ.
     */
    const MVP_LABELS = [
      'Nghe & Chạm',
      'Điền chữ cái còn thiếu',
      'Thú cưng trốn ở đâu?',
      'Lật thẻ ghi nhớ',
      'Nối từ với hình',
    ];

    // Mỗi trò có mặt ở CẢ 3 bài ⇒ 3 link/trò.
    for (const label of MVP_LABELS) {
      expect(
        screen.getAllByRole('link', { name: `Chơi trò ${label}` }),
        `thiếu link cho trò "${label}"`,
      ).toHaveLength(3);
    }
  });

  it('nhãn đọc của link nói rõ đây là HÀNH ĐỘNG, đủ ngữ cảnh cho screen reader', () => {
    renderThemePage();

    // "Chơi trò Nghe & Chạm" — không phải một danh từ trơ ("Nghe & Chạm").
    expect(screen.getAllByRole('link', { name: 'Chơi trò Nghe & Chạm' })).toHaveLength(3);
  });

  it('KHÔNG còn dòng "trò chơi khác đang được làm" — cả 5 trò MVP đã chơi được', () => {
    renderThemePage();

    /**
     * ⚠️ Dùng bộ khớp tự viết thay vì `getAllByText('...')`:
     *   Ô đó render ra `🎮 {chuỗi}`, tức HAI text node trong cùng một `<p>`. Khớp theo chuỗi sẽ
     *   so với `textContent` đã gộp ("🎮 2 trò chơi khác đang được làm") nên trượt; còn khớp bằng
     *   regex thì mọi tổ tiên của `<p>` cũng chứa chuỗi đó và RTL báo "tìm thấy nhiều phần tử".
     *   Khoá vào đúng thẻ `<p>` là cách nói chính xác điều đang muốn kiểm.
     *
     * Nhóm 5 đã làm xong cả 5 trò MVP ⇒ mỗi bài có `pendingCount = 0` ⇒ KHÔNG dòng nào được vẽ.
     * Nếu một trò bị rơi khỏi `GAME_COMPONENTS`, dòng "1 trò chơi khác đang được làm" xuất hiện
     * lại và test này đỏ — đúng lúc cần biết.
     */
    const notes = screen.queryAllByText(
      (_content, element) =>
        element?.tagName === 'P' &&
        (element.textContent ?? '').includes('trò chơi khác đang được làm'),
    );

    expect(notes).toHaveLength(0);
  });
});
