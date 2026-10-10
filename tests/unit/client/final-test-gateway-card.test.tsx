/**
 * RubyLingo — Test THẺ CỔNG "🎓 Khu vực thi" theo TỪNG trạng thái cổng.
 *
 * ⭐ ĐIỀU QUAN TRỌNG NHẤT FILE NÀY CANH (bất biến về cách đối xử với trẻ):
 *   · `locked`  ⇒ thẻ hiện RÕ còn thiếu gì, KHÔNG phải link (bấm vào rồi bị đuổi ra là tệ hơn).
 *   · `ready` / `done` ⇒ thẻ LÀ link vào khu vực thi, có nhãn đọc đầy đủ.
 *   · `pending` (chưa đồng bộ) ⇒ "Đang kiểm tra...", TUYỆT ĐỐI KHÔNG nói bé còn thiếu gì — mất
 *     mạng không phải là "chưa học hết", nói còn thiếu là MẮNG OAN.
 *   · chưa biết (`state = null`, mạng lỗi/đang tải) ⇒ cũng là trạng thái TRUNG TÍNH như `pending`.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import '@/i18n/index.js';
import { FinalTestGatewayCard } from '@/components/final-test/FinalTestGatewayCard.js';
import type { FinalTestAccess } from '@shared/final-test-access.js';
import type { FinalTestGateState, FinalTestSectionStatus } from '@shared/types/final-test.js';

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

function gateState(gate: FinalTestAccess, sections: FinalTestSectionStatus[] = []): FinalTestGateState {
  return {
    childId: 'chi_na',
    gate,
    sections,
    serverTime: '2026-10-10T09:00:00.000Z',
  };
}

function renderCard(state: FinalTestGateState | null) {
  return render(
    <MemoryRouter>
      <FinalTestGatewayCard state={state} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  // Không phụ thuộc dữ liệu cục bộ của test khác.
  localStorage.clear();
});

describe('FinalTestGatewayCard — trạng thái cổng', () => {
  it('locked (thiếu bài) ⇒ hiện còn thiếu mấy bài, KHÔNG có link vào', () => {
    renderCard(
      gateState({
        kind: 'locked',
        enterable: false,
        requirement: {
          type: 'lessons_incomplete',
          lessonsMissing: 3,
          lessonsCompleted: 40,
          lessonsTotal: 43,
        },
        lessonsCompleted: 40,
        lessonsTotal: 43,
        exercisesPlayed: 73,
        exercisesTotal: 73,
      }),
    );

    expect(screen.getByText(/còn 3 bài nữa/)).toBeInTheDocument();
    expect(screen.getByText(/đã xong 40\/43 bài/)).toBeInTheDocument();
    // KHÔNG phải link — không bấm vào được.
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('locked (thiếu game) ⇒ hiện còn thiếu mấy trò', () => {
    renderCard(
      gateState({
        kind: 'locked',
        enterable: false,
        requirement: { type: 'games_unplayed', gamesMissing: 5, gamesPlayed: 68, gamesTotal: 73 },
        lessonsCompleted: 43,
        lessonsTotal: 43,
        exercisesPlayed: 68,
        exercisesTotal: 73,
      }),
    );

    expect(screen.getByText(/Còn 5 trò chơi bé chưa thử/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('pending (chưa đồng bộ) ⇒ "Đang kiểm tra...", TUYỆT ĐỐI không nói còn thiếu', () => {
    renderCard(
      gateState({
        kind: 'pending',
        enterable: false,
        requirement: null,
        lessonsCompleted: 0,
        lessonsTotal: 43,
        exercisesPlayed: 0,
        exercisesTotal: 73,
      }),
    );

    expect(screen.getAllByText('Đang kiểm tra...').length).toBeGreaterThan(0);
    expect(screen.queryByText(/còn.*bài nữa/)).toBeNull();
    expect(screen.queryByText(/chưa thử/)).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('chưa biết (state = null, mạng lỗi/đang tải) ⇒ trạng thái trung tính, không link', () => {
    renderCard(null);

    expect(screen.getAllByText('Đang kiểm tra...').length).toBeGreaterThan(0);
    expect(screen.queryByText(/chưa thử/)).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('ready ⇒ thẻ LÀ link vào khu vực thi, có nhãn đọc đầy đủ', () => {
    renderCard(
      gateState({
        kind: 'ready',
        enterable: true,
        requirement: null,
        lessonsCompleted: 43,
        lessonsTotal: 43,
        exercisesPlayed: 73,
        exercisesTotal: 73,
      }),
    );

    const link = screen.getByRole('link', { name: 'Vào khu vực thi Starters' });
    expect(link).toHaveAttribute('href', '/final-test');
  });

  it('done ⇒ thẻ vẫn là link (bé được làm lại), hiện tổng khiên', () => {
    renderCard(
      gateState(
        {
          kind: 'done',
          enterable: true,
          requirement: null,
          lessonsCompleted: 43,
          lessonsTotal: 43,
          exercisesPlayed: 73,
          exercisesTotal: 73,
        },
        [
          sectionStatus({ section: 'listening', bestShields: 4, completed: true, attempts: 1 }),
          sectionStatus({ section: 'reading-writing', bestShields: 5, completed: true, attempts: 1 }),
          sectionStatus({ section: 'speaking', bestShields: 5, completed: true, attempts: 1 }),
        ],
      ),
    );

    expect(screen.getByRole('link', { name: 'Vào khu vực thi Starters' })).toHaveAttribute(
      'href',
      '/final-test',
    );
    expect(screen.getByText('Tổng khiên: 14')).toBeInTheDocument();
  });
});
