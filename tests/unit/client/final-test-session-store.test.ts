/**
 * RubyLingo — Test STORE PHIÊN THI (lưu tiến độ đang dở).
 *
 * ⭐ ĐIỀU FILE NÀY CANH:
 *   1. Tiến độ KHÔI PHỤC được sau khi rời trang (localStorage) — sống sót qua một phiên mới.
 *   2. Khoá lưu trữ có `childId` ⇒ hai bé cùng máy KHÔNG thấy tiến độ của nhau.
 *   3. `record` đẩy tiến độ lên server qua `saveProgress` (sau debounce), MAP đúng `{itemId, value}`.
 *   4. Lỗi mạng khi lưu KHÔNG ném ra ngoài (bé không thấy lỗi kỹ thuật; bản cục bộ vẫn còn).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as EndpointsModule from '@/api/endpoints.js';
import { finalTestApi } from '@/api/endpoints.js';
import {
  __flushFinalTestProgressForTests,
  cancelFinalTestProgress,
  clearFinalTestDraft,
  loadFinalTestDraft,
  saveFinalTestDraft,
  useFinalTestSessionStore,
  __resetFinalTestSessionForTests,
} from '@/store/finalTestSession.js';

vi.mock('@/api/endpoints.js', async (importOriginal) => {
  const actual = await importOriginal<typeof EndpointsModule>();
  return {
    ...actual,
    finalTestApi: { get: vi.fn(), submit: vi.fn(), saveProgress: vi.fn() },
  };
});

const saveProgressMock = vi.mocked(finalTestApi.saveProgress);

beforeEach(() => {
  localStorage.clear();
  saveProgressMock.mockReset();
  saveProgressMock.mockResolvedValue({
    section: 'listening',
    answered: 1,
    answers: [],
    updatedAt: '2026-10-10T09:00:00.000Z',
  });
  __resetFinalTestSessionForTests();
  cancelFinalTestProgress();
});

describe('finalTestSession — lưu/khôi phục tiến độ', () => {
  it('ghi rồi đọc lại được tiến độ (khôi phục sau khi rời trang)', () => {
    const answers = [
      { itemId: 'q1', value: 'boy', firstTry: true, wrongAttempts: 0 },
      { itemId: 'q2', value: '', firstTry: false, wrongAttempts: 2 },
    ];
    saveFinalTestDraft('chi_na', 'listening', { answers, clientEventId: 'ft_abc' });

    const loaded = loadFinalTestDraft('chi_na', 'listening');
    expect(loaded.answers).toEqual(answers);
    expect(loaded.clientEventId).toBe('ft_abc');
  });

  it('khoá theo childId ⇒ bé khác KHÔNG thấy tiến độ của bé này', () => {
    saveFinalTestDraft('chi_na', 'listening', {
      answers: [{ itemId: 'q1', value: '', firstTry: true, wrongAttempts: 0 }],
      clientEventId: null,
    });

    expect(loadFinalTestDraft('chi_na', 'listening').answers).toHaveLength(1);
    expect(loadFinalTestDraft('chi_bin', 'listening').answers).toHaveLength(0);
  });

  it('bản ghi phiên bản lạ ⇒ coi như rỗng (không cố đọc "được gì đọc nấy")', () => {
    localStorage.setItem(
      'rubylingo:finaltest:chi_na:listening',
      JSON.stringify({ version: 999, answers: [{ itemId: 'q1', value: '', firstTry: true, wrongAttempts: 0 }] }),
    );
    expect(loadFinalTestDraft('chi_na', 'listening').answers).toHaveLength(0);
  });

  it('clearFinalTestDraft xoá sạch', () => {
    saveFinalTestDraft('chi_na', 'listening', {
      answers: [{ itemId: 'q1', value: '', firstTry: true, wrongAttempts: 0 }],
      clientEventId: null,
    });
    clearFinalTestDraft('chi_na', 'listening');
    expect(loadFinalTestDraft('chi_na', 'listening').answers).toHaveLength(0);
  });
});

describe('finalTestSession — đẩy tiến độ lên server', () => {
  it('record ⇒ ghi máy NGAY + đẩy server khi flush, map đúng {itemId, value}', async () => {
    const start = useFinalTestSessionStore.getState().start;
    start('chi_na', 'listening', { answers: [], clientEventId: 'ft_evt' });

    useFinalTestSessionStore
      .getState()
      .record({ itemId: 'q1', value: 'boy', firstTry: true, wrongAttempts: 0 });

    // Ghi cục bộ NGAY (không chờ mạng).
    expect(loadFinalTestDraft('chi_na', 'listening').answers).toHaveLength(1);

    await __flushFinalTestProgressForTests();

    expect(saveProgressMock).toHaveBeenCalledTimes(1);
    const [childId, body] = saveProgressMock.mock.calls[0]!;
    expect(childId).toBe('chi_na');
    expect(body).toEqual({ section: 'listening', answers: [{ itemId: 'q1', value: 'boy' }] });
  });

  it('record trùng itemId ⇒ bỏ qua (không nhân đôi câu)', () => {
    useFinalTestSessionStore.getState().start('chi_na', 'listening', { answers: [], clientEventId: null });
    const record = useFinalTestSessionStore.getState().record;
    record({ itemId: 'q1', value: 'boy', firstTry: true, wrongAttempts: 0 });
    record({ itemId: 'q1', value: 'boy', firstTry: true, wrongAttempts: 0 });

    expect(useFinalTestSessionStore.getState().answers).toHaveLength(1);
  });

  it('lỗi mạng khi lưu ⇒ KHÔNG ném ra ngoài, bản cục bộ vẫn còn', async () => {
    saveProgressMock.mockRejectedValueOnce(new Error('NetworkError: failed to fetch'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    useFinalTestSessionStore.getState().start('chi_na', 'listening', { answers: [], clientEventId: null });
    useFinalTestSessionStore
      .getState()
      .record({ itemId: 'q1', value: 'boy', firstTry: true, wrongAttempts: 0 });

    await expect(__flushFinalTestProgressForTests()).resolves.toBeUndefined();
    expect(loadFinalTestDraft('chi_na', 'listening').answers).toHaveLength(1);

    warn.mockRestore();
  });
});
