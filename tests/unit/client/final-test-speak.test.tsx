/**
 * RubyLingo — Test component phần Nói BÀI THI CUỐI KHOÁ với BỐN TẦNG (Giai đoạn 8).
 *
 * ⭐ NHỮNG ĐIỀU FILE NÀY CANH (đều là lỗi hỏng IM LẶNG):
 *   1. **Trình duyệt KHÔNG hỗ trợ ⇒ nút "Máy nghe thử" KHÔNG TỒN TẠI.** Ở Safari/iOS/Firefox,
 *      `SpeechRecognition` thiếu ⇒ nút phải VẮNG HẲN, không phải hiện rồi báo lỗi khi bấm.
 *   2. **Có hỗ trợ ⇒ nút hiện, và HAI nhánh phản hồi đều dùng câu KHÔNG MẮNG** ("Máy nghe thấy
 *      rồi! 🎉" / "Máy chưa nghe rõ…"). Quét DOM để bắt cả chuỗi hardcode.
 *   3. **TẦNG 3 MẶC ĐỊNH BẬT — NHƯNG CHỈ HIỆN NÚT, KHÔNG tự ghi.** Có `MediaRecorder` + cờ mặc
 *      định ⇒ nút "Nghe lại giọng con" HIỆN SẴN; nhưng mở màn KHÔNG xin quyền micro — chỉ khi
 *      BẤM mới gọi `getUserMedia`/`MediaRecorder`. Vẫn TẮT ĐƯỢC (cờ `false` ⇒ nút ẩn), và thiếu
 *      `MediaRecorder` ⇒ nút ẩn bất kể cờ.
 *   4. **Tầng 2 KHÔNG gọi server, KHÔNG đụng khiên.** Bấm "Máy nghe thử" không gọi `fetch`, không
 *      gọi `onAnswered`. Chỉ "Nói rồi!" mới kết thúc câu — hành vi mặc định KHÔNG đổi.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import { SpeakPromptGame } from '@/components/final-test/SpeakPromptGame.js';
import { __resetSettingsForTests, useSettingsStore } from '@/store/settingsStore.js';
import { finalTestItemSchema, type FinalTestItem } from '@shared/schemas/final-test.js';

// =============================================================================
// Giả lập Web Speech API (nhận diện) và MediaRecorder (ghi âm cục bộ)
// =============================================================================

interface FakeAlternative {
  transcript: string;
  confidence: number;
}
interface FakeResult {
  length: number;
  isFinal: boolean;
  item(index: number): FakeAlternative | undefined;
  [index: number]: FakeAlternative;
}
interface FakeResultList {
  length: number;
  item(index: number): FakeResult | undefined;
  [index: number]: FakeResult;
}

/** Dựng `result`/`results` đúng hình dạng Web Speech trả về (chỉ phần ta đọc). */
function makeResults(transcripts: readonly string[]): FakeResultList {
  const results = transcripts.map((transcript): FakeResult => {
    const alternative: FakeAlternative = { transcript, confidence: 1 };
    return {
      length: 1,
      isFinal: true,
      0: alternative,
      item: (index) => (index === 0 ? alternative : undefined),
    };
  });
  const list = {
    length: results.length,
    item: (index: number) => results[index],
  } as FakeResultList;
  results.forEach((result, index) => {
    (list as unknown as Record<number, FakeResult>)[index] = result;
  });
  return list;
}

/** Bản giả `SpeechRecognition` — ghi lại instance để test tự phát sự kiện. */
class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onresult: ((event: { results: FakeResultList }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;

  constructor() {
    FakeRecognition.instances.push(this);
  }

  start(): void {
    this.onstart?.();
  }
  stop(): void {
    this.onend?.();
  }
  abort(): void {
    this.onend?.();
  }
}

class FakeMediaRecorder {
  state = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public readonly stream: unknown) {}
  start(): void {
    this.state = 'recording';
  }
  stop(): void {
    this.state = 'inactive';
    this.onstop?.();
  }
}

/** Cấp `SpeechRecognition` cho `window` — mô phỏng Chrome. */
function installSpeechRecognition(): void {
  (window as unknown as Record<string, unknown>)['SpeechRecognition'] = FakeRecognition;
  FakeRecognition.instances = [];
}

/** Cấp `MediaRecorder` + `getUserMedia` cho `window`/`navigator`. */
function installMediaRecorder(): void {
  (window as unknown as Record<string, unknown>)['MediaRecorder'] = FakeMediaRecorder;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }),
    },
  });
}

function uninstallBrowserApis(): void {
  delete (window as unknown as Record<string, unknown>)['SpeechRecognition'];
  delete (window as unknown as Record<string, unknown>)['webkitSpeechRecognition'];
  delete (window as unknown as Record<string, unknown>)['MediaRecorder'];
  // `mediaDevices` do jsdom cung cấp là undefined; khôi phục về undefined.
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: undefined,
  });
}

function makeSpeakItem(): FinalTestItem {
  return finalTestItemSchema.parse({
    id: 'starters.final-test.speaking.p1.q1',
    interaction: 'speak_prompt',
    promptEn: 'Point to the door.',
    audioTextEn: 'Point to the door.',
    imageKey: 'home-scene',
    wordId: 'starters.door',
  });
}

/** Từ bị cấm trong MỌI chuỗi (kể cả aria-label) — luật ngôn ngữ của dự án. */
const BANNED_WORDS = ['sai', 'kém', 'chưa đạt', 'thất bại', 'ghi âm'] as const;

function assertNoBannedWords(container: HTMLElement): void {
  const html = container.innerHTML.toLowerCase();
  for (const word of BANNED_WORDS) {
    expect(html.includes(word)).toBe(false);
  }
}

beforeEach(() => {
  __resetSettingsForTests();
});

afterEach(() => {
  uninstallBrowserApis();
});

// =============================================================================
// Trình duyệt KHÔNG hỗ trợ nhận diện (mặc định jsdom = Safari/Firefox)
// =============================================================================

describe('phần Nói — trình duyệt KHÔNG hỗ trợ nhận diện', () => {
  it('⚠️ nút "Máy nghe thử" KHÔNG tồn tại (ẩn hẳn, không hiện rồi báo lỗi)', () => {
    const { container } = render(<SpeakPromptGame item={makeSpeakItem()} onAnswered={vi.fn()} />);

    expect(screen.queryByText('Máy nghe thử')).not.toBeInTheDocument();
    assertNoBannedWords(container);
  });

  it('⚠️ nút "Nghe lại giọng con" cũng KHÔNG tồn tại khi thiếu MediaRecorder', () => {
    render(<SpeakPromptGame item={makeSpeakItem()} onAnswered={vi.fn()} />);
    expect(screen.queryByText('Nghe lại giọng con')).not.toBeInTheDocument();
  });

  it('hành vi mặc định KHÔNG đổi: bấm "Nói rồi!" ⇒ báo lên trên (độ tham gia)', () => {
    const onAnswered = vi.fn();
    const item = makeSpeakItem();
    render(<SpeakPromptGame item={item} onAnswered={onAnswered} />);

    fireEvent.click(screen.getByRole('button', { name: 'Bé đã nói xong câu này' }));

    expect(onAnswered).toHaveBeenCalledWith({ itemId: item.id, firstTry: true, wrongAttempts: 0 });
  });
});

// =============================================================================
// TẦNG 2 — có hỗ trợ nhận diện (mô phỏng Chrome)
// =============================================================================

describe('phần Nói — TẦNG 2 "Máy nghe thử"', () => {
  it('⚠️ có hỗ trợ ⇒ nút hiện; nhánh NGHE RA dùng câu khen, KHÔNG có từ mắng', () => {
    installSpeechRecognition();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const onAnswered = vi.fn();
    const { container } = render(<SpeakPromptGame item={makeSpeakItem()} onAnswered={onAnswered} />);

    const button = screen.getByRole('button', {
      name: 'Bật máy nghe thử giọng bé (chỉ để vui, không phải điểm)',
    });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    const recognition = FakeRecognition.instances.at(-1);
    expect(recognition?.lang).toBe('en-GB');

    // Bé nói đúng câu mục tiêu.
    act(() => {
      recognition?.onresult?.({ results: makeResults(['Point to the door.']) });
    });

    expect(screen.getByText('Máy nghe thấy rồi! 🎉')).toBeInTheDocument();
    // Tầng 2 KHÔNG được kết thúc câu và KHÔNG gọi server.
    expect(onAnswered).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    assertNoBannedWords(container);
    vi.unstubAllGlobals();
  });

  it('⚠️ nhánh CHƯA NGHE RÕ dùng câu mời thử lại, KHÔNG có từ mắng', () => {
    installSpeechRecognition();
    const onAnswered = vi.fn();
    const { container } = render(<SpeakPromptGame item={makeSpeakItem()} onAnswered={onAnswered} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Bật máy nghe thử giọng bé (chỉ để vui, không phải điểm)',
      }),
    );
    const recognition = FakeRecognition.instances.at(-1);

    act(() => {
      recognition?.onresult?.({ results: makeResults(['banana']) });
    });

    expect(
      screen.getByText('Máy chưa nghe rõ — bé thử nói to hơn một chút nhé!'),
    ).toBeInTheDocument();
    expect(onAnswered).not.toHaveBeenCalled();
    assertNoBannedWords(container);
  });

  it('⚠️ lỗi micro (bị từ chối quyền) ⇒ câu hướng trẻ nhẹ nhàng, KHÔNG lộ mã lỗi kỹ thuật', () => {
    installSpeechRecognition();
    const { container } = render(<SpeakPromptGame item={makeSpeakItem()} onAnswered={vi.fn()} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Bật máy nghe thử giọng bé (chỉ để vui, không phải điểm)',
      }),
    );
    const recognition = FakeRecognition.instances.at(-1);

    act(() => {
      recognition?.onerror?.({ error: 'not-allowed' });
    });

    expect(
      screen.getByText('Máy chưa nghe rõ — bé thử nói to hơn một chút nhé!'),
    ).toBeInTheDocument();
    expect(container.textContent ?? '').not.toContain('not-allowed');
    assertNoBannedWords(container);
  });

  it('hiện câu miễn trừ Cambridge bắt buộc', () => {
    installSpeechRecognition();
    render(<SpeakPromptGame item={makeSpeakItem()} onAnswered={vi.fn()} />);
    expect(
      screen.getByText(
        'RubyLingo không phải kỳ thi Cambridge; kết quả ở đây không có giá trị chứng nhận.',
      ),
    ).toBeInTheDocument();
  });
});

// =============================================================================
// TẦNG 3 — "Nghe lại giọng con": MẶC ĐỊNH BẬT (chỉ hiện nút, không tự ghi)
// =============================================================================

/** Lấy spy `getUserMedia` đã cài trong `installMediaRecorder()`. */
function getUserMediaSpy(): ReturnType<typeof vi.fn> {
  const mediaDevices = navigator.mediaDevices as unknown as { getUserMedia: ReturnType<typeof vi.fn> };
  return mediaDevices.getUserMedia;
}

describe('phần Nói — TẦNG 3 "Nghe lại giọng con"', () => {
  it('⚠️ MẶC ĐỊNH BẬT: localStorage trống + có MediaRecorder ⇒ nút HIỆN SẴN', () => {
    installMediaRecorder();
    render(<SpeakPromptGame item={makeSpeakItem()} onAnswered={vi.fn()} />);

    expect(screen.getByText('Nghe lại giọng con')).toBeInTheDocument();
  });

  it('⚠️ KHÔNG tự ghi khi mở màn: chỉ khi BẤM mới xin quyền micro', async () => {
    installMediaRecorder();
    render(<SpeakPromptGame item={makeSpeakItem()} onAnswered={vi.fn()} />);

    // Vừa render xong: nút đã hiện nhưng micro CHƯA được xin.
    expect(getUserMediaSpy()).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Bắt đầu ghi giọng bé để nghe lại ngay trên máy này' }),
      );
    });

    expect(getUserMediaSpy()).toHaveBeenCalledWith({ audio: true });
  });

  it('⚠️ vẫn TẮT ĐƯỢC: đặt cờ false ⇒ nút KHÔNG tồn tại', () => {
    installMediaRecorder();
    useSettingsStore.setState({ voicePlaybackEnabled: false });

    render(<SpeakPromptGame item={makeSpeakItem()} onAnswered={vi.fn()} />);

    expect(screen.queryByText('Nghe lại giọng con')).not.toBeInTheDocument();
  });

  it('⚠️ trình duyệt KHÔNG có MediaRecorder ⇒ nút ẩn BẤT KỂ cờ (kể cả true)', () => {
    // Không cài MediaRecorder. Cờ đang là mặc định (true).
    expect(useSettingsStore.getState().voicePlaybackEnabled).toBe(true);
    render(<SpeakPromptGame item={makeSpeakItem()} onAnswered={vi.fn()} />);

    expect(screen.queryByText('Nghe lại giọng con')).not.toBeInTheDocument();
  });

  it('⚠️ cờ mặc định là TRUE trong settingsStore', () => {
    expect(useSettingsStore.getState().voicePlaybackEnabled).toBe(true);
  });

  it('cờ được LƯU vào localStorage (đọc lại vẫn đúng) — cài đặt của THIẾT BỊ', () => {
    useSettingsStore.getState().setVoicePlaybackEnabled(false);
    const raw = localStorage.getItem('rubylingo.settings');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toMatchObject({ voicePlaybackEnabled: false });
  });

  it('⚠️ GIỮ RÀNG BUỘC: bản ghi cục bộ được phát lại rồi xoá, không có API upload/lưu file', async () => {
    installMediaRecorder();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    // `localStorage` bị theo dõi để chắc KHÔNG có khoá nào của bản ghi được ghi thêm.
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    render(<SpeakPromptGame item={makeSpeakItem()} onAnswered={vi.fn()} />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Bắt đầu ghi giọng bé để nghe lại ngay trên máy này' }),
      );
    });

    // Ghi âm KHÔNG đụng mạng và KHÔNG ghi thêm khoá lạ nào vào localStorage.
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const [key] of setItemSpy.mock.calls) {
      expect(String(key).startsWith('rubylingo.parent.speaking-check.')).toBe(false);
    }

    setItemSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
