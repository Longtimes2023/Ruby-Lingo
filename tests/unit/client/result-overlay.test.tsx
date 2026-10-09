/**
 * Test cho `ResultOverlay` — màn hình kết quả sau một lượt chơi.
 *
 * Hai nhóm được kiểm kỹ nhất, vì cả hai đều là LỜI NÓI SAI với đứa trẻ nếu hỏng:
 *
 *   1. **Kỷ lục.** Trước T055 màn này luôn nhận `previousBestScore={null}` nên LUÔN nói "Kỷ lục
 *      mới của bé!" — kể cả ở lượt thứ mười. Bé 7 tuổi nhớ chính xác lần trước mình được mấy điểm,
 *      nên một lời khen sai kiểu đó làm mất giá trị của mọi lời khen khác. Test khoá lại: khi
 *      server đã trả lời, `isNewRecord`/`bestScore` của SERVER là sự thật cuối cùng — không tự so
 *      lại với con số trong máy.
 *
 *   2. **Khối phần thưởng.** Chỉ hiện khoản LỚN HƠN 0, và KHÔNG hiện gì khi chưa biết. Hiện
 *      "⭐ +0" là kể cho bé nghe về thứ bé không có; hiện khối thưởng khi chưa có phản hồi server
 *      là bịa ra một con số tiền.
 */

import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import { ResultOverlay, type ResultOverlayProps } from '@/components/games/shared/ResultOverlay.js';
import type { GameRunResult } from '@shared/game-scoring.js';
import type { GameResultAward } from '@shared/types/progress.js';

function run(overrides: Partial<GameRunResult> = {}): GameRunResult {
  return {
    stars: 3,
    score: 12,
    streakBonus: 0,
    correctFirstTry: 3,
    answered: 3,
    totalRounds: 3,
    completed: true,
    longestStreak: 3,
    ...overrides,
  };
}

function award(overrides: Partial<GameResultAward> = {}): GameResultAward {
  return {
    score: 12,
    stars: 3,
    bestScore: 12,
    bestStars: 3,
    isNewRecord: true,
    duplicate: false,
    xpGained: 20,
    starsGained: 5,
    acornsGained: 1,
    levelUp: null,
    questsCompleted: [],
    badgesEarned: [],
    stickerEarned: null,
    ...overrides,
  };
}

function renderOverlay(props: Partial<ResultOverlayProps> = {}) {
  return render(
    <MemoryRouter>
      <ResultOverlay
        result={run()}
        lessonName="Động vật"
        previousBestScore={null}
        previousBestStars={0}
        onPlayAgain={vi.fn()}
        exitTo="/"
        {...props}
      />
    </MemoryRouter>,
  );
}

// =============================================================================
// Khối phần thưởng
// =============================================================================

describe('ResultOverlay — khối phần thưởng server trả về', () => {
  /** Chưa có phản hồi (mất mạng, lượt chơi còn trong hàng đợi) ⇒ KHÔNG bịa con số nào. */
  it('chưa biết phần thưởng ⇒ KHÔNG hiện khối thưởng', () => {
    renderOverlay({ serverAward: null });
    expect(screen.queryByText('Bé nhận được')).not.toBeInTheDocument();
  });

  it('hiện đủ ba khoản bé thực sự nhận được', () => {
    renderOverlay({ serverAward: award({ starsGained: 5, acornsGained: 1, xpGained: 20 }) });

    expect(screen.getByText('Bé nhận được')).toBeInTheDocument();
    // Nhãn đọc đầy đủ — bé khiếm thị phải biết đó là SAO hay HẠT DẺ hay ĐIỂM KINH NGHIỆM.
    expect(screen.getByLabelText('Bé nhận thêm 5 sao')).toBeInTheDocument();
    expect(screen.getByLabelText('Bé nhận thêm 1 hạt dẻ')).toBeInTheDocument();
    expect(screen.getByLabelText('Bé nhận thêm 20 điểm kinh nghiệm')).toBeInTheDocument();
  });

  /** Hiện "+0" là nhắc bé về thứ bé KHÔNG có. Chỉ vẽ khoản thực sự lớn hơn 0. */
  it('khoản bằng 0 thì KHÔNG được vẽ', () => {
    renderOverlay({ serverAward: award({ starsGained: 5, acornsGained: 0, xpGained: 20 }) });

    expect(screen.queryByLabelText('Bé nhận thêm 0 hạt dẻ')).not.toBeInTheDocument();
    expect(screen.queryByText('+0')).not.toBeInTheDocument();
    expect(screen.queryByText('🌰')).not.toBeInTheDocument();
  });

  /**
   * ⚠️ `duplicate` = server đã ghi lượt này từ trước ⇒ mọi delta bằng 0. Không có gì để khoe, và
   *    quan trọng hơn: KHÔNG được hiện khối thưởng rỗng (một cái khung trống làm bé tưởng lỗi).
   */
  it('lượt chơi đã ghi từ trước (`duplicate`) ⇒ không có khối thưởng', () => {
    renderOverlay({
      serverAward: award({ duplicate: true, starsGained: 0, acornsGained: 0, xpGained: 0 }),
    });

    expect(screen.queryByText('Bé nhận được')).not.toBeInTheDocument();
  });
});

// =============================================================================
// Kỷ lục
// =============================================================================

describe('ResultOverlay — kỷ lục', () => {
  /**
   * ⭐⭐ TEST QUAN TRỌNG NHẤT CỦA FILE.
   *
   *   `previousBestScore` = `null` nghĩa là "chưa biết kỷ lục cũ" (bài này chưa có trong ảnh chụp
   *   tiến độ trong máy). Trước T055, gặp `null` là màn hình LUÔN khoe "Kỷ lục mới của bé!".
   *   Server thì biết rõ: bé đã từng được 12 điểm, lượt này 9 điểm, KHÔNG phá kỷ lục. Khi server
   *   đã trả lời, phải nghe server.
   */
  it('server nói KHÔNG phá kỷ lục ⇒ hiện "Kỷ lục trước", dù trong máy chưa biết gì', () => {
    renderOverlay({
      result: run({ score: 9, stars: 2 }),
      previousBestScore: null,
      previousBestStars: 0,
      serverAward: award({ score: 9, stars: 2, bestScore: 12, bestStars: 3, isNewRecord: false }),
    });

    expect(screen.queryByText(/Kỷ lục mới/)).not.toBeInTheDocument();
    expect(screen.getByText('Kỷ lục trước')).toBeInTheDocument();
    // `bestScore` của server CHÍNH LÀ kỷ lục cũ khi lượt này không vượt được nó.
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('server nói có phá kỷ lục ⇒ mừng "Kỷ lục mới"', () => {
    renderOverlay({
      result: run({ score: 15, stars: 3 }),
      previousBestScore: null,
      previousBestStars: 0,
      serverAward: award({ score: 15, bestScore: 15, bestStars: 3, isNewRecord: true }),
    });

    expect(screen.getByText(/Kỷ lục mới/)).toBeInTheDocument();
    expect(screen.queryByText('Kỷ lục trước')).not.toBeInTheDocument();
  });

  /**
   * ⚠️ MÁY KHÔNG ĐƯỢC "THẮNG" SERVER. Số trong máy có thể CAO hơn thực tế (dữ liệu cũ, hoặc lần
   *    đồng bộ trước để lại). Nếu tự so với nó, một lượt thực sự phá kỷ lục sẽ bị giấu mất.
   */
  it('số trong máy cao hơn nhưng server nói phá kỷ lục ⇒ vẫn mừng', () => {
    renderOverlay({
      result: run({ score: 15, stars: 3 }),
      previousBestScore: 999,
      previousBestStars: 3,
      serverAward: award({ score: 15, bestScore: 15, bestStars: 3, isNewRecord: true }),
    });

    expect(screen.getByText(/Kỷ lục mới/)).toBeInTheDocument();
    expect(screen.queryByText('999')).not.toBeInTheDocument();
  });

  /**
   * Khi CHƯA có phản hồi từ server (mất mạng), màn hình vẫn phải dùng được — rơi về hiểu biết
   * trong máy, đúng như hành vi trước T055.
   */
  it('chưa có phản hồi server ⇒ rơi về số trong máy', () => {
    renderOverlay({ previousBestScore: 7, previousBestStars: 2, serverAward: null, result: run({ score: 9, stars: 3 }) });

    expect(screen.getByText(/Kỷ lục mới/)).toBeInTheDocument();
  });

  it('chưa có phản hồi server và điểm thấp hơn kỷ lục trong máy ⇒ hiện "Kỷ lục trước"', () => {
    renderOverlay({
      previousBestScore: 20,
      previousBestStars: 3,
      serverAward: null,
      result: run({ score: 9, stars: 2 }),
    });

    expect(screen.queryByText(/Kỷ lục mới/)).not.toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });
});

// =============================================================================
// Những điều TUYỆT ĐỐI không được xuất hiện
// =============================================================================

describe('ResultOverlay — những điều không bao giờ được có', () => {
  it('không có chữ nào mang tính phán xét, kể cả khi chỉ được 1 sao', () => {
    renderOverlay({
      result: run({ stars: 1, score: 2, correctFirstTry: 1, answered: 3, completed: false }),
      serverAward: award({ starsGained: 2, acornsGained: 0, xpGained: 5 }),
    });

    const text = document.body.textContent ?? '';
    for (const word of ['sai', 'kém', 'chưa đạt', 'thua', 'thất bại']) {
      expect(text.toLowerCase()).not.toContain(word);
    }
  });

  it('luôn có đủ ba ô sao — để bé biết còn gì để phấn đấu', () => {
    renderOverlay({ result: run({ stars: 1, score: 2 }), serverAward: null });

    /**
     * ⚠️ PHẢI KHOANH VÙNG, KHÔNG ĐẾM CẢ TRANG.
     *   `StarBurst` cũng vẽ emoji ⭐ (hạt bung ra), nên `screen.getAllByText('⭐')` sẽ đếm lẫn cả
     *   hạt bay — con số phụ thuộc số hạt, không phải số ô sao. Dãy ô sao có `aria-label` riêng,
     *   nên neo vào đó rồi đếm bên trong.
     */
    const rating = screen.getByLabelText('Bé được 1 sao');
    expect(within(rating).getAllByText('⭐')).toHaveLength(3);
  });
});
