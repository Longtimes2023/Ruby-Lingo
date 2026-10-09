/**
 * QA XÁC MINH ĐỘC LẬP (client) — Nhóm 9 / T070: màn Bộ sưu tập.
 *
 * Tự dựng lại các ca tấn công:
 *   • E10 — ô CHƯA đạt: emoji THẬT không nằm ở BẤT KỲ đâu trong DOM (không chỉ `queryByText`).
 *   • E11 — LUẬT SỐ 1: quét DOM + MỌI `aria-label` cho cả 4 từ bị cấm ('sai','kém','chưa đạt',
 *     'thất bại') ở MỌI trạng thái: đã có hết, chưa có gì, đang nạp, nạp hỏng.
 *   • E12 — số ô khớp danh mục (đếm từ `badgesForPhase` / `stickersForPhase`, không hardcode).
 *   • E13 — tab là `<button>` gốc (Enter/Space hoạt động), có `aria-pressed`, có vùng chạm
 *     (`min-h-touch`), và toàn cục có luật `:focus-visible`.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import { rewardsApi } from '@/api/endpoints.js';
import { CollectionPage } from '@/pages/rewards/CollectionPage.js';
import { __resetRewardStoreForTests, useRewardStore } from '@/store/rewardStore.js';
import { badgesForPhase, stickersForPhase } from '@shared/content/badges.js';
import type { RewardSnapshot } from '@shared/types/reward.js';

vi.mock('@/api/endpoints.js', () => ({
  rewardsApi: { get: vi.fn() },
}));

const getMock = vi.mocked(rewardsApi.get);

const CHILD = 'chi_na';
const NOW = '2026-10-08T08:00:00.000Z';

const BADGES_MVP = badgesForPhase('mvp');
const STICKERS_MVP = stickersForPhase('mvp');

/** Bốn từ bị cấm theo luật của dự án (lead liệt kê cả `thất bại`). */
const BANNED = ['sai', 'kém', 'chưa đạt', 'thất bại'] as const;

beforeAll(() => {
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
});

function snap(overrides: Partial<RewardSnapshot> = {}): RewardSnapshot {
  return {
    childId: CHILD,
    wallet: { childId: CHILD, stars: 0, acorns: 0, updatedAt: NOW },
    xp: { childId: CHILD, xp: 0, level: 1, updatedAt: NOW },
    pet: {
      childId: CHILD,
      evolutionStage: 'baby',
      petType: 'monkey',
      petChosen: true,
      wordsLearned: 0,
      happiness: 3,
      equippedItemIds: [],
      lastFedAt: null,
      updatedAt: NOW,
    },
    streak: {
      childId: CHILD,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      milestonesClaimed: [],
      updatedAt: NOW,
    },
    inventory: [],
    badges: [],
    stickers: [],
    serverTime: NOW,
    ...overrides,
  };
}

function seed(overrides: Partial<RewardSnapshot> = {}): void {
  useRewardStore.setState({
    childId: CHILD,
    snapshot: snap(overrides),
    hydrated: true,
    loading: false,
    error: null,
  });
}

beforeEach(() => {
  __resetRewardStoreForTests();
  vi.clearAllMocks();
  getMock.mockResolvedValue(snap());
  seed();
});

/** Gộp text + MỌI aria-label thành một chuỗi để quét từ bị cấm (aria cũng là chuỗi HIỂN THỊ). */
function visibleText(container: HTMLElement): string {
  const own = container.textContent ?? '';
  const labels = Array.from(container.querySelectorAll('[aria-label]'))
    .map((el) => el.getAttribute('aria-label') ?? '')
    .join(' ');
  return `${own} ${labels}`;
}

function assertNoBanned(container: HTMLElement): void {
  const text = visibleText(container);
  for (const word of BANNED) {
    expect(text.includes(word), `DOM chứa từ bị cấm "${word}"`).toBe(false);
  }
}

// =============================================================================
// E10 — ô chưa đạt KHÔNG được lộ emoji
// =============================================================================

describe('E10 — emoji thật của ô CHƯA đạt không có trong DOM', () => {
  it('KHÔNG đạt huy hiệu nào ⇒ không icon thật nào xuất hiện ở bất kỳ đâu trong DOM', () => {
    seed({ badges: [] });
    const { container } = render(<CollectionPage />);

    const html = container.innerHTML;
    for (const badge of BADGES_MVP) {
      expect(screen.queryByText(badge.icon)).not.toBeInTheDocument();
      expect(html.includes(badge.icon)).toBe(false);
    }
    // và có đúng N dấu ?
    expect(screen.getAllByText('?')).toHaveLength(BADGES_MVP.length);
  });

  it('KHÔNG đạt sticker nào ⇒ sang tab Sticker vẫn không lộ icon', () => {
    seed({ stickers: [] });
    const { container } = render(<CollectionPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Sticker' }));

    const html = container.innerHTML;
    for (const sticker of STICKERS_MVP) {
      expect(html.includes(sticker.icon)).toBe(false);
    }
    expect(screen.getAllByText('?')).toHaveLength(STICKERS_MVP.length);
  });

  it('đối chứng: ô ĐÃ đạt thì icon thật CÓ mặt', () => {
    const earned = BADGES_MVP[0]!;
    seed({ badges: [earned.id] });
    render(<CollectionPage />);
    expect(screen.getByText(earned.icon)).toBeInTheDocument();
  });
});

// =============================================================================
// E11 — LUẬT SỐ 1 của dự án
// =============================================================================

describe('E11 — không từ mang tính phán xét ở MỌI trạng thái', () => {
  it('tab Huy hiệu: có ô chưa đạt', () => {
    seed({ badges: [BADGES_MVP[0]!.id] });
    const { container } = render(<CollectionPage />);
    assertNoBanned(container);
  });

  it('tab Sticker: có ô chưa đạt', () => {
    seed({ stickers: [STICKERS_MVP[0]!.id] });
    const { container } = render(<CollectionPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Sticker' }));
    assertNoBanned(container);
  });

  it('trạng thái ĐANG NẠP', () => {
    __resetRewardStoreForTests();
    const { container } = render(<CollectionPage />);
    assertNoBanned(container);
  });

  it('trạng thái NẠP HỎNG (kèm lỗi kỹ thuật thô trong store)', () => {
    useRewardStore.setState({
      childId: CHILD,
      snapshot: null,
      hydrated: true,
      loading: false,
      error: 'NetworkError: failed to fetch',
    });
    const { container } = render(<CollectionPage />);
    assertNoBanned(container);
    // Lỗi thô của trình duyệt KHÔNG được lộ ra.
    expect(container.textContent ?? '').not.toContain('NetworkError');
  });
});

// =============================================================================
// E12 — số ô khớp DANH MỤC
// =============================================================================

describe('E12 — số ô khớp danh mục giai đoạn MVP', () => {
  it('tab Huy hiệu vẽ đúng `badgesForPhase("mvp").length` ô', () => {
    render(<CollectionPage />);
    expect(BADGES_MVP.length).toBeGreaterThan(0);
    expect(screen.getAllByRole('listitem')).toHaveLength(BADGES_MVP.length);
  });

  it('tab Sticker vẽ đúng `stickersForPhase("mvp").length` ô', () => {
    render(<CollectionPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Sticker' }));
    expect(STICKERS_MVP.length).toBeGreaterThan(0);
    expect(screen.getAllByRole('listitem')).toHaveLength(STICKERS_MVP.length);
  });
});

// =============================================================================
// E13 — bàn phím / focus / vùng chạm
// =============================================================================

describe('E13 — điều hướng bằng bàn phím & a11y', () => {
  it('tab là <button type="button"> (Enter/Space kích hoạt theo chuẩn HTML) + có aria-pressed', () => {
    render(<CollectionPage />);
    for (const label of ['Huy hiệu', 'Sticker']) {
      const btn = screen.getByRole('button', { name: label });
      expect(btn.tagName).toBe('BUTTON');
      expect(btn.getAttribute('type')).toBe('button');
      expect(btn).toHaveAttribute('aria-pressed');
    }
  });

  it('tab có vùng chạm tối thiểu (`min-h-touch`)', () => {
    render(<CollectionPage />);
    for (const label of ['Huy hiệu', 'Sticker']) {
      expect(screen.getByRole('button', { name: label }).className).toContain('min-h-touch');
    }
  });

  it('⭐ có luật `:focus-visible` toàn cục (vòng focus cho người dùng bàn phím)', () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../../src/styles/index.css'),
      'utf8',
    );
    expect(css).toMatch(/:focus-visible\s*\{/);
    expect(css).toMatch(/outline/);
  });

  it('token vùng chạm mặc định là 64px (luật dự án)', () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../../src/styles/tokens.css'),
      'utf8',
    );
    expect(css).toMatch(/--sp-touch:\s*64px/);
  });
});
