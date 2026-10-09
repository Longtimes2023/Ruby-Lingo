/**
 * Test cho `SpeechService` — chốt lại HAI RÀNG BUỘC ÂM THANH bằng test chạy được.
 *
 * ⭐ VÌ SAO PHẢI TEST HAI ĐIỀU NÀY, KHÔNG CHỈ GHI CHÚ TRONG TÀI LIỆU:
 *   Cả hai lỗi đều KHÔNG gây crash, KHÔNG gây màn hình trắng, và trong môi trường phát triển
 *   (nơi máy thường không cài giọng đọc nào) thì còn KHÔNG PHÁT RA TIẾNG NÀO. Nghĩa là chúng
 *   lọt qua typecheck, lint, và mọi bài test chỉ kiểm "app có chạy không". Chỉ có test kiểm
 *   trực tiếp hành vi mới bắt được.
 *
 *   • Lỗi 1 — đọc tiếng Việt bằng giọng `en-GB`: bé nghe một tràng âm vô nghĩa.
 *   • Lỗi 2 — chọn nhầm giọng nam: KHÔNG lỗi, chỉ là bé nghe giọng ông già suốt ngày.
 *     Lỗi này đặc biệt dễ xảy ra vì `"Google UK English Female".includes('male') === true`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SpeechService,
  clampRate,
  normalizeVoiceName,
  pickVoice,
  scoreVoice,
  voiceGender,
  voiceLocale,
  type VoiceLike,
} from '../../../src/services/SpeechService.js';

// =============================================================================
// Giọng mẫu — dữ liệu THẬT lấy từ các hệ điều hành đang dùng
// =============================================================================

const V = (name: string, lang: string, extra: Partial<VoiceLike> = {}): VoiceLike => ({
  name,
  lang,
  ...extra,
});

/** Máy Windows: có cả giọng nam và nữ, cả Anh-Anh lẫn Anh-Mỹ. */
const WINDOWS_VOICES: VoiceLike[] = [
  V('Microsoft David - English (United States)', 'en-US', { localService: true, default: true }),
  V('Microsoft Zira - English (United States)', 'en-US', { localService: true }),
  V('Microsoft Hazel - English (United Kingdom)', 'en-GB', { localService: true }),
  V('Microsoft George - English (United Kingdom)', 'en-GB', { localService: true }),
];

/** Máy Chrome: tên giọng chứa chữ "Female"/"Male" — đây là bẫy số 2. */
const CHROME_VOICES: VoiceLike[] = [
  V('Google US English', 'en-US', { localService: false }),
  V('Google UK English Male', 'en-GB', { localService: false }),
  V('Google UK English Female', 'en-GB', { localService: false }),
];

/** Máy iOS: Samantha là giọng nữ mặc định. */
const IOS_VOICES: VoiceLike[] = [
  V('Samantha', 'en-US', { localService: true, default: true }),
  V('Daniel', 'en-GB', { localService: true }),
  V('Karen', 'en-AU', { localService: true }),
];

/** Máy chỉ có giọng Việt — trường hợp "không có giọng tiếng Anh nào". */
const VIETNAMESE_ONLY: VoiceLike[] = [
  V('Microsoft An - Vietnamese (Vietnam)', 'vi-VN', { localService: true }),
];

// =============================================================================
// Giả lập trình duyệt
// =============================================================================

interface FakeUtterance {
  text: string;
  lang: string;
  rate: number;
  pitch: number;
  voice: VoiceLike | null;
  onend: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

interface FakeSynth {
  getVoices(): VoiceLike[];
  speak(u: unknown): void;
  cancel(): void;
  readonly speaking: boolean;
  readonly pending: boolean;
  readonly paused: boolean;
  resume(): void;
  /** Test điều khiển được: danh sách giọng hiện có. */
  voices: VoiceLike[];
  /** Test đọc lại: mọi utterance đã được đưa vào. */
  spoken: FakeUtterance[];
  cancelCount: number;
  /** Số lần `addEventListener('voiceschanged')` được gọi — dùng để kiểm "chỉ chờ một lần". */
  listenerAdds: number;
  /** Bắn sự kiện `voiceschanged` như trình duyệt thật. */
  fireVoicesChanged(): void;
  /** Kết thúc lần đọc hiện tại (gọi `onend`). */
  finishSpeaking(): void;
}

function createFakeSynth(initialVoices: VoiceLike[] = []): FakeSynth {
  let speaking = false;
  const listeners = new Set<() => void>();
  const synth: FakeSynth = {
    voices: initialVoices,
    spoken: [],
    cancelCount: 0,
    listenerAdds: 0,
    getVoices: () => synth.voices,
    speak: (u) => {
      const utterance = u as FakeUtterance;
      synth.spoken.push(utterance);
      speaking = true;
    },
    cancel: () => {
      synth.cancelCount += 1;
      speaking = false;
    },
    get speaking() {
      return speaking;
    },
    get pending() {
      return false;
    },
    get paused() {
      return false;
    },
    resume: () => undefined,
    fireVoicesChanged: () => {
      for (const cb of listeners) cb();
    },
    finishSpeaking: () => {
      speaking = false;
      const last = synth.spoken.at(-1);
      last?.onend?.({});
    },
  };
  // `addEventListener`/`onvoiceschanged` được `SpeechService` đăng ký qua cast nội bộ.
  const target = synth as unknown as {
    addEventListener: (t: string, cb: () => void) => void;
    removeEventListener: (t: string, cb: () => void) => void;
    onvoiceschanged: (() => void) | null;
  };
  target.addEventListener = (type, cb) => {
    if (type === 'voiceschanged') {
      listeners.add(cb);
      synth.listenerAdds += 1;
    }
  };
  target.removeEventListener = (type, cb) => {
    if (type === 'voiceschanged') listeners.delete(cb);
  };
  target.onvoiceschanged = null;
  return synth;
}

/** Tạo utterance giả — không cần `SpeechSynthesisUtterance` của trình duyệt. */
function fakeUtteranceFactory(text: string): FakeUtterance {
  return { text, lang: '', rate: 1, pitch: 1, voice: null, onend: null, onerror: null };
}

/** Đọc lần đọc đã hoàn tất: chờ một macrotask cho `setTimeout(start, 0)`. */
async function settle(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

// =============================================================================
// Chuẩn hoá & phân loại giọng
// =============================================================================

describe('normalizeVoiceName', () => {
  it('bỏ dấu, bỏ ký tự không phải chữ và viết thường', () => {
    expect(normalizeVoiceName('Microsoft Hazel - English (United Kingdom)')).toBe(
      'microsofthazelenglishunitedkingdom',
    );
  });

  it('bỏ được dấu tiếng Việt', () => {
    expect(normalizeVoiceName('Giọng Nữ Trẻ')).toBe('giongnutre');
  });
});

describe('voiceGender', () => {
  it('nhận ra giọng nữ theo bảng tên của từng hệ điều hành', () => {
    expect(voiceGender(V('Samantha', 'en-US'))).toBe('female');
    expect(voiceGender(V('Microsoft Hazel - English (United Kingdom)', 'en-GB'))).toBe('female');
    expect(voiceGender(V('Karen', 'en-AU'))).toBe('female');
  });

  it('nhận ra giọng nam', () => {
    expect(voiceGender(V('Daniel', 'en-GB'))).toBe('male');
    expect(voiceGender(V('Microsoft David - English (United States)', 'en-US'))).toBe('male');
  });

  /**
   * ⭐ TEST QUAN TRỌNG NHẤT CỦA PHẦN NÀY.
   * `"Google UK English Female".includes('male')` là `true`. Nếu ai đó đảo thứ tự kiểm
   * trong `voiceGender` (kiểm nam trước nữ) thì giọng nữ của Chrome bị xếp thành nam, và
   * `pickVoice` sẽ chọn `Google UK English Male` — đúng giọng SAI mà không có lỗi nào.
   */
  it('KHÔNG nhầm giọng nữ của Chrome thành nam (bẫy "female" chứa "male")', () => {
    expect(voiceGender(V('Google UK English Female', 'en-GB'))).toBe('female');
    expect(voiceGender(V('Microsoft Aria Online (Natural) - English (United States)', 'en-US'))).toBe(
      'female',
    );
  });

  it('trả null khi tên không có trong bảng', () => {
    expect(voiceGender(V('Some Unknown Voice', 'en-GB'))).toBeNull();
  });
});

describe('voiceLocale', () => {
  it('phân biệt tiếng Anh Anh với tiếng Anh Mỹ', () => {
    expect(voiceLocale(V('x', 'en-GB'))).toEqual({ isEnglish: true, isBritishEnglish: true });
    expect(voiceLocale(V('x', 'en-US'))).toEqual({ isEnglish: true, isBritishEnglish: false });
    expect(voiceLocale(V('x', 'en_AU'))).toEqual({ isEnglish: true, isBritishEnglish: false });
  });

  it('loại tiếng Việt', () => {
    expect(voiceLocale(V('x', 'vi-VN')).isEnglish).toBe(false);
  });
});

// =============================================================================
// Chấm điểm & chọn giọng
// =============================================================================

describe('scoreVoice', () => {
  it('loại hoàn toàn giọng không phải tiếng Anh', () => {
    expect(scoreVoice(V('Microsoft An - Vietnamese (Vietnam)', 'vi-VN'), 'female-young')).toBe(
      Number.NEGATIVE_INFINITY,
    );
  });

  it('ưu tiên en-GB hơn en-US (Cambridge Starters thi theo chuẩn Anh)', () => {
    const gb = scoreVoice(V('Microsoft Hazel - English (United Kingdom)', 'en-GB'), 'female-young');
    const us = scoreVoice(V('Microsoft Zira - English (United States)', 'en-US'), 'female-young');
    expect(gb).toBeGreaterThan(us);
  });

  it('điểm giới tính nữ quan trọng hơn điểm chất lượng giọng', () => {
    const femalePlain = scoreVoice(V('Microsoft Hazel - English (United Kingdom)', 'en-GB'), 'female-young');
    const maleNatural = scoreVoice(
      V('Microsoft Ryan Online (Natural) - English (United Kingdom)', 'en-GB', { localService: false }),
      'female-young',
    );
    expect(femalePlain).toBeGreaterThan(maleNatural);
  });

  it('giọng nam KHÔNG bị loại — chỉ bị xếp sau (quy tắc "không bao giờ im lặng")', () => {
    const male = scoreVoice(V('Daniel', 'en-GB'), 'female-young');
    expect(male).toBeGreaterThan(Number.NEGATIVE_INFINITY);
  });

  it('ưu tiên giọng nghe tự nhiên (natural/neural/online/google) khi các tiêu chí khác bằng nhau', () => {
    const natural = scoreVoice(V('Microsoft Sonia Online (Natural) - English (United Kingdom)', 'en-GB'), 'female-young');
    const plain = scoreVoice(V('Microsoft Susan - English (United Kingdom)', 'en-GB'), 'female-young');
    expect(natural).toBeGreaterThan(plain);
  });
});

describe('pickVoice', () => {
  it('chọn giọng NỮ Anh-Anh trên máy Windows', () => {
    const picked = pickVoice(WINDOWS_VOICES, 'female-young');
    expect(picked?.name).toBe('Microsoft Hazel - English (United Kingdom)');
  });

  it('chọn đúng giọng nữ của Chrome (bẫy "female" chứa "male")', () => {
    const picked = pickVoice(CHROME_VOICES, 'female-young');
    expect(picked?.name).toBe('Google UK English Female');
  });

  it('chọn Samantha trên iOS', () => {
    const picked = pickVoice(IOS_VOICES, 'female-young');
    expect(picked?.name).toBe('Samantha');
  });

  it('KHÔNG BAO GIỜ trả null khi máy còn giọng tiếng Anh nào đó', () => {
    const onlyMale = [V('Daniel', 'en-GB'), V('Microsoft David - English (United States)', 'en-US')];
    const picked = pickVoice(onlyMale, 'female-young');
    expect(picked).not.toBeNull();
    expect(picked?.name).toBe('Daniel');
  });

  it('trả null khi máy KHÔNG có giọng tiếng Anh nào (máy chỉ có tiếng Việt)', () => {
    expect(pickVoice(VIETNAMESE_ONLY, 'female-young')).toBeNull();
  });

  it('trả null với mảng rỗng', () => {
    expect(pickVoice([], 'female-young')).toBeNull();
  });

  it('tôn trọng lựa chọn giọng nam của phụ huynh', () => {
    const picked = pickVoice(WINDOWS_VOICES, 'male');
    expect(picked?.name).toBe('Microsoft George - English (United Kingdom)');
  });

  it('quyết định theo TÊN khi điểm bằng nhau — kết quả không phụ thuộc thứ tự mảng', () => {
    const a = V('Microsoft Susan - English (United Kingdom)', 'en-GB');
    const b = V('Microsoft Hazel - English (United Kingdom)', 'en-GB');
    expect(pickVoice([a, b], 'female-young')?.name).toBe(pickVoice([b, a], 'female-young')?.name);
  });
});

// =============================================================================
// Cưỡng chế ràng buộc "chỉ đọc tiếng Anh"
// =============================================================================

describe('SpeechService — ràng buộc CHỈ ĐỌC TIẾNG ANH', () => {
  let synth: FakeSynth;
  let service: SpeechService;

  beforeEach(() => {
    synth = createFakeSynth(WINDOWS_VOICES);
    service = new SpeechService(synth as never, fakeUtteranceFactory);
  });

  it('TỪ CHỐI đọc tiếng Việt và không đưa gì vào loa', async () => {
    const started = await service.speak('Bé thử lại nhé!');
    expect(started).toBe(false);
    expect(synth.spoken).toHaveLength(0);
  });

  it('từ chối cả câu tiếng Việt không dấu có chữ "đ"', async () => {
    expect(await service.speak('doc lai nao')).toBe(true); // câu ASCII thì lọt (kiểm thô)
    expect(await service.speak('đọc lại nào')).toBe(false);
  });

  it('từ chối chuỗi rỗng và chuỗi chỉ có khoảng trắng', async () => {
    expect(await service.speak('')).toBe(false);
    expect(await service.speak('   ')).toBe(false);
  });

  it('ĐỌC được từ tiếng Anh thường gặp', async () => {
    expect(await service.speak('elephant')).toBe(true);
    await settle();
    expect(synth.spoken.map((u) => u.text)).toEqual(['elephant']);
  });

  it('đọc được câu tiếng Anh có dấu câu', async () => {
    expect(await service.speak("It's a big, grey elephant!")).toBe(true);
    await settle();
    expect(synth.spoken).toHaveLength(1);
  });
});

// =============================================================================
// Hành vi phát âm
// =============================================================================

describe('SpeechService — hành vi phát âm', () => {
  let synth: FakeSynth;
  let service: SpeechService;

  beforeEach(async () => {
    synth = createFakeSynth(WINDOWS_VOICES);
    service = new SpeechService(synth as never, fakeUtteranceFactory);
    // Nạp giọng trước để mọi test không phải chờ.
    await service.loadVoices();
    await service.getVoice();
  });

  it('gắn giọng NỮ Anh-Anh vào utterance', async () => {
    await service.speak('tiger');
    await settle();
    expect(synth.spoken[0]?.voice?.name).toBe('Microsoft Hazel - English (United Kingdom)');
  });

  it('đặt `lang` khớp với giọng đã chọn (không để mặc định của máy)', async () => {
    await service.speak('tiger');
    await settle();
    expect(synth.spoken[0]?.lang).toBe('en-GB');
  });

  it('dùng tốc độ chậm rãi mặc định 0.8 cho bé 7 tuổi', async () => {
    await service.speak('tiger');
    await settle();
    expect(synth.spoken[0]?.rate).toBeCloseTo(0.8);
  });

  it('kẹp tốc độ ghi đè vào khoảng hợp lệ', async () => {
    await service.speak('tiger', { rate: 9 });
    await settle();
    expect(synth.spoken[0]?.rate).toBeLessThanOrEqual(1.2);

    await service.speak('lion', { rate: 0.01 });
    await settle();
    expect(synth.spoken[1]?.rate).toBeGreaterThanOrEqual(0.5);
  });

  it('KHÔNG phát khi phụ huynh đã tắt tiếng', async () => {
    service.setSettings({ enabled: false });
    expect(await service.speak('tiger')).toBe(false);
    await settle();
    expect(synth.spoken).toHaveLength(0);
  });

  it('phát lại được sau khi bật tiếng trở lại', async () => {
    service.setSettings({ enabled: false });
    await service.speak('tiger');
    service.setSettings({ enabled: true });
    expect(await service.speak('tiger')).toBe(true);
    await settle();
    expect(synth.spoken).toHaveLength(1);
  });

  it('`stop()` huỷ tiếng đang đọc', async () => {
    await service.speak('tiger');
    await settle();
    const before = synth.cancelCount;
    service.stop();
    expect(synth.cancelCount).toBeGreaterThan(before);
    expect(service.isSpeaking()).toBe(false);
  });

  it('chế độ "replace" không cộng dồn — chỉ câu mới nhất được đọc', async () => {
    await service.speak('cat');
    await service.speak('dog');
    await settle();
    // Lần thứ hai có `cancel()` (vì lần đầu đang "speaking") rồi mới đọc.
    expect(synth.spoken.at(-1)?.text).toBe('dog');
  });

  it('chế độ "queue" đọc lần lượt theo đúng thứ tự', async () => {
    const first = service.speak('cat', { mode: 'queue' });
    const second = service.speak('dog', { mode: 'queue' });
    const third = service.speak('bird', { mode: 'queue' });
    await Promise.all([first, second, third]);
    await settle();

    expect(synth.spoken[0]?.text).toBe('cat');
    // Câu 2 chỉ được đọc SAU khi câu 1 kết thúc.
    expect(synth.spoken).toHaveLength(1);
    synth.finishSpeaking();
    await settle();
    expect(synth.spoken[1]?.text).toBe('dog');
  });

  it('bỏ qua câu tiếng Việt trong một chuỗi mà vẫn đọc các câu tiếng Anh', async () => {
    await service.speakSequence(['cat', 'Con mèo', 'dog']);
    await settle();
    synth.finishSpeaking();
    await settle();
    expect(synth.spoken.map((u) => u.text)).toEqual(['cat', 'dog']);
  });
});

// =============================================================================
// Nạp danh sách giọng — bẫy `getVoices()` trả mảng rỗng ở lần gọi đầu
// =============================================================================

describe('SpeechService.loadVoices', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('trả ngay khi trình duyệt đã có danh sách giọng', async () => {
    const synth = createFakeSynth(WINDOWS_VOICES);
    const service = new SpeechService(synth as never, fakeUtteranceFactory);
    await expect(service.loadVoices()).resolves.toHaveLength(WINDOWS_VOICES.length);
  });

  /**
   * ⭐ Đây là bẫy khiến yêu cầu "giọng nữ" bị vi phạm một cách im lặng trên Chrome:
   * danh sách giọng nạp bất đồng bộ, nên lần gọi đầu luôn rỗng.
   */
  it('CHỜ sự kiện `voiceschanged` khi danh sách còn rỗng', async () => {
    const synth = createFakeSynth([]);
    const service = new SpeechService(synth as never, fakeUtteranceFactory);

    const pending = service.loadVoices();
    // Danh sách về muộn, đúng như Chrome.
    synth.voices = CHROME_VOICES;
    synth.fireVoicesChanged();

    await expect(pending).resolves.toHaveLength(CHROME_VOICES.length);
  });

  it('sau khi chờ xong thì chọn được giọng NỮ (không rơi về giọng nam mặc định)', async () => {
    const synth = createFakeSynth([]);
    const service = new SpeechService(synth as never, fakeUtteranceFactory);
    const pending = service.loadVoices();
    synth.voices = CHROME_VOICES;
    synth.fireVoicesChanged();
    await pending;

    expect((await service.getVoice())?.name).toBe('Google UK English Female');
  });

  it('bỏ cuộc sau khi hết thời gian chờ — không treo vĩnh viễn', async () => {
    vi.useFakeTimers();
    const synth = createFakeSynth([]);
    const service = new SpeechService(synth as never, fakeUtteranceFactory);

    const pending = service.loadVoices();
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(pending).resolves.toEqual([]);
  });

  /**
   * ⚠️ KHÔNG so sánh `a === b` ở đây. `loadVoices` là hàm `async`, nên MỖI lần gọi trả về
   * một Promise bọc MỚI quanh cùng một lời hứa bên trong — `a === b` luôn sai dù hành vi
   * đúng. Thứ thật sự cần kiểm là: chỉ có MỘT lượt chờ được đăng ký, và cả hai lời gọi
   * cùng nhận một kết quả.
   */
  it('gọi nhiều lần chỉ chờ MỘT lần', async () => {
    const synth = createFakeSynth([]);
    const service = new SpeechService(synth as never, fakeUtteranceFactory);
    const a = service.loadVoices();
    const b = service.loadVoices();

    synth.voices = WINDOWS_VOICES;
    synth.fireVoicesChanged();

    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toHaveLength(WINDOWS_VOICES.length);
    expect(rb).toEqual(ra);
    expect(synth.listenerAdds).toBe(1);
  });
});

// =============================================================================
// Không có Web Speech API
// =============================================================================

describe('SpeechService — trình duyệt không hỗ trợ', () => {
  it('không ném lỗi và báo không hỗ trợ khi thiếu speechSynthesis', async () => {
    const service = new SpeechService(null, fakeUtteranceFactory);
    expect(service.isSupported()).toBe(false);
    expect(await service.speak('tiger')).toBe(false);
    expect(await service.loadVoices()).toEqual([]);
    expect(await service.getVoice()).toBeNull();
    expect(() => service.stop()).not.toThrow();
    expect(service.isSpeaking()).toBe(false);
  });
});

// =============================================================================
// Cài đặt
// =============================================================================

describe('SpeechService.setSettings', () => {
  it('kẹp tốc độ khi được đặt', () => {
    const service = new SpeechService(null, fakeUtteranceFactory);
    service.setSettings({ rate: 99 });
    expect(service.getSettings().rate).toBeLessThanOrEqual(1.2);
  });

  it('đổi ý muốn giọng đọc thì chọn lại giọng ở lần sau', async () => {
    const synth = createFakeSynth(WINDOWS_VOICES);
    const service = new SpeechService(synth as never, fakeUtteranceFactory);
    await service.loadVoices();
    expect((await service.getVoice())?.name).toContain('Hazel');

    service.setSettings({ voicePreference: 'male' });
    expect((await service.getVoice())?.name).toContain('George');
  });

  it('đặt lại cùng một ý muốn giọng không làm mất giọng đã chọn', async () => {
    const synth = createFakeSynth(WINDOWS_VOICES);
    const service = new SpeechService(synth as never, fakeUtteranceFactory);
    await service.loadVoices();
    const first = await service.getVoice();
    service.setSettings({ voicePreference: 'female-young' });
    expect(await service.getVoice()).toBe(first);
  });
});

describe('clampRate', () => {
  it('kẹp trong khoảng 0.5 – 1.2', () => {
    expect(clampRate(0.8)).toBeCloseTo(0.8);
    expect(clampRate(0.1)).toBe(0.5);
    expect(clampRate(5)).toBe(1.2);
  });

  it('giá trị không phải số ⇒ về mặc định 0.8', () => {
    expect(clampRate(Number.NaN)).toBeCloseTo(0.8);
    expect(clampRate(Number.POSITIVE_INFINITY)).toBeCloseTo(0.8);
  });
});
