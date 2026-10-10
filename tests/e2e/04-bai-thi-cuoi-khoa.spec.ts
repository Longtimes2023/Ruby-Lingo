/**
 * RubyLingo — E2E luồng BÀI THI CUỐI KHOÁ (Giai đoạn 7).
 *
 * ⭐ VÌ SAO CHẶN API BẰNG ROUTE INTERCEPTION (không seed DB thật):
 *   Điều kiện mở khoá ("học hết 43 bài + chơi hết 73 game") rất nặng để dựng thật trong DB e2e.
 *   Chặn `GET .../final-test` và trả về ĐÚNG hình dạng server trả cho phép kiểm ba trạng thái cổng
 *   (khoá / mở / đăng nhập xong) mà KHÔNG phụ thuộc dữ liệu. `POST .../submit` cũng chặn để trả về
 *   một kết quả đã chấm (khiên 5), đúng khuôn "server là trọng tài cuối".
 *
 * ⚠️ Phần đăng nhập + tạo bé (openKidSession) vẫn đi qua API THẬT — đây là tầng duy nhất chứng minh
 *    cookie phiên + guard định tuyến chạy được trong trình duyệt thật.
 */

import { expect, test, type Page } from '@playwright/test';

import { openKidSession } from './helpers/session.js';

/** Khớp cả `GET .../final-test` (không khớp `/submit` hay `/progress` — khác số đoạn đường dẫn). */
const GATE_URL = '**/api/children/*/final-test';
const PROGRESS_URL = '**/api/children/*/final-test/progress';
const SUBMIT_URL = '**/api/children/*/final-test/*/submit';

interface GateOverrides {
  kind: 'locked' | 'ready' | 'pending' | 'done';
  enterable: boolean;
  requirement: unknown;
  sections?: Array<Record<string, unknown>>;
}

function gateState({ kind, enterable, requirement, sections = [] }: GateOverrides) {
  return {
    childId: 'any',
    gate: {
      kind,
      enterable,
      requirement,
      lessonsCompleted: 43,
      lessonsTotal: 43,
      exercisesPlayed: 73,
      exercisesTotal: 73,
    },
    sections,
    serverTime: '2026-10-10T09:00:00.000Z',
  };
}

/** Chặn ba endpoint của khu vực thi bằng phản hồi giả — KHÔNG đụng DB thật. */
async function mockFinalTestApi(page: Page, state: unknown): Promise<void> {
  await page.route(GATE_URL, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ json: { data: state } });
  });
  await page.route(PROGRESS_URL, async (route) => {
    await route.fulfill({
      json: { data: { section: 'speaking', answered: 0, answers: [], updatedAt: '2026-10-10T09:00:00.000Z' } },
    });
  });
}

test.describe('Bài thi cuối khoá — cổng và luồng một phần', () => {
  test('cổng KHOÁ ⇒ thẻ ở bản đồ hiện "còn thiếu", không có lối vào khu vực thi', async ({ page }) => {
    await openKidSession(page);

    await mockFinalTestApi(
      page,
      gateState({
        kind: 'locked',
        enterable: false,
        requirement: {
          type: 'lessons_incomplete',
          lessonsMissing: 3,
          lessonsCompleted: 40,
          lessonsTotal: 43,
        },
      }),
    );

    // Nạp lại bản đồ để thẻ cổng đọc trạng thái vừa chặn.
    await page.goto('/');

    await expect(page.getByText(/còn 3 bài nữa/)).toBeVisible();
    // Thẻ khoá KHÔNG phải link vào khu vực thi.
    await expect(page.getByRole('link', { name: 'Vào khu vực thi Starters' })).toHaveCount(0);
  });

  test('cổng MỞ ⇒ vào khu vực thi, chơi hết phần Nói, tới màn kết quả', async ({ page }) => {
    await openKidSession(page);

    await mockFinalTestApi(
      page,
      gateState({
        kind: 'ready',
        enterable: true,
        requirement: null,
        sections: [
          { section: 'listening', autoScored: true, totalItems: 20, bestShields: null, completed: false, attempts: 0, progress: null },
          { section: 'reading-writing', autoScored: true, totalItems: 25, bestShields: null, completed: false, attempts: 0, progress: null },
          { section: 'speaking', autoScored: false, totalItems: 11, bestShields: null, completed: false, attempts: 0, progress: null },
        ],
      }),
    );

    await page.route(SUBMIT_URL, async (route) => {
      await route.fulfill({
        json: {
          data: {
            section: 'speaking',
            duplicate: false,
            totalItems: 11,
            correctFirstTry: 11,
            shields: 5,
            bestShields: 5,
            isNewRecord: true,
            firstCompletion: false,
            xpGained: 0,
            starsGained: 0,
            acornsGained: 0,
            levelUp: null,
            questsCompleted: [],
            badgesEarned: [],
          },
        },
      });
    });

    await page.goto('/');

    // Thẻ cổng là link vào khu vực thi.
    await page.getByRole('link', { name: 'Vào khu vực thi Starters' }).click();
    await expect(page.getByRole('heading', { name: 'Khu vực thi Starters' })).toBeVisible();

    // Chọn phần Nói (phần thứ ba — theo thứ tự manifest listening → reading-writing → speaking).
    await page.getByRole('link', { name: 'Bắt đầu' }).nth(2).click();
    await expect(page.getByText('Câu 1/11')).toBeVisible();

    // Chơi hết 11 câu: mỗi câu bấm "Nói rồi!".
    for (let index = 0; index < 11; index += 1) {
      await page.getByRole('button', { name: 'Bé đã nói xong câu này' }).click();
    }

    // Màn kết quả: khiên server trả về + câu khen.
    await expect(page.getByText('Bé làm xong phần này rồi!')).toBeVisible();
    await expect(page.getByLabel('Nói: bé được 5 khiên')).toBeVisible();
    await expect(page.getByText('Siêu sao!')).toBeVisible();
    // Dòng miễn trừ Cambridge bắt buộc hiện.
    await expect(
      page.getByText('RubyLingo không phải kỳ thi Cambridge; kết quả ở đây không có giá trị chứng nhận.'),
    ).toBeVisible();
  });
});
