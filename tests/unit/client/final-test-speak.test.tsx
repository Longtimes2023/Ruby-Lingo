/**
 * RubyLingo — Test component phần Nói BÀI THI CUỐI KHOÁ với BỐN TẦNG (Giai đoạn 8).
 *
 * ⭐ NHỮNG ĐIỀU FILE NÀY CANH (đều là lỗi hỏng IM LẶNG):
 *   1. **Trình duyệt KHÔNG hỗ trợ ⇒ nút "Máy nghe thử" KHÔNG TỒN TẠI.** Ở Safari/iOS/Firefox,
 *      `SpeechRecognition` thiếu ⇒ nút phải VẮNG HẲN, không phải hiện rồi báo lỗi khi bấm.
 *   2. **Có hỗ trợ ⇒ nút hiện, và HAI nhánh phản hồi đều dùng câu KHÔNG MẮNG** ("Máy nghe thấy
 *      rồi! 🎉" / "Máy chưa nghe rõ…"). Quét DOM để bắt cả chuỗi hardcode.
 *   3. **TẦNG 3 MẶC ĐỊNH TẮT** — dù trình duyệt có `MediaRecorder`, nút "Nghe lại giọng con" chỉ
 *      hiện khi cờ `voicePlaybackEnabled` được phụ huynh bật.
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
// TẦNG 3 — "Nghe lại giọng con": MẶC ĐỊNH TẮT
// =============================================================================

describe('phần Nói — TẦNG 3 "Nghe lại giọng con"', () => {
  it('⚠️ có MediaRecorder nhưng cờ TẮT ⇒ nút KHÔNG hiện (mặc định là tắt)', () => {
    installMediaRecorder();
    render(<SpeakPromptGame item={makeSpeakItem()} onAnswered={vi.fn()} />);

    expect(screen.queryByText('Nghe lại giọng con')).not.toBeInTheDocument();
  });

  it('⚠️ phụ huynh bật cờ + có MediaRecorder ⇒ nút hiện, và chỉ ghi khi bé bấm', async () => {
    installMediaRecorder();
    useSettingsStore.setState({ voicePlaybackEnabled: true });

    render(<SpeakPromptGame item={makeSpeakItem()} onAnswered={vi.fn()} />);

    const startButton = screen.getByRole('button', {
      name: 'Bắt đầu ghi giọng bé để nghe lại ngay trên máy này',
    });
    expect(startButton).toBeInTheDocument();

    // Chưa bấm ⇒ chưa xin quyền micro.
    const getUserMedia = (navigator.mediaDevices as unknown as { getUserMedia: ReturnType<typeof vi.fn> })
      .getUserMedia;
    expect(getUserMedia).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(startButton);
    });
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
  });

  it('⚠️ cờ mặc định là false trong settingsStore', () => {
    expect(useSettingsStore.getState().voicePlaybackEnabled).toBe(false);
  });

  it('cờ được LƯU vào localStorage (đọc lại vẫn đúng) — cài đặt của THIẾT BỊ', () => {
    useSettingsStore.getState().setVoicePlaybackEnabled(true);
    const raw = localStorage.getItem('rubylingo.settings');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toMatchObject({ voicePlaybackEnabled: true });
  });
});
