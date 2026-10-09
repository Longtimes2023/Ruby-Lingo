/**
 * RubyLingo — SpeechService: phát âm TIẾNG ANH bằng Web Speech API.
 *
 * ⭐ HAI RÀNG BUỘC CỨNG, ĐỀU LÀ YÊU CẦU CỦA CHỦ DỰ ÁN:
 *
 *   1. **CHỈ ĐỌC TIẾNG ANH — KHÔNG BAO GIỜ ĐỌC TIẾNG VIỆT.**
 *      *"âm thanh thì chỉ đọc từ tiếng Anh thôi, đọc tiếng Việt chi?"*
 *      Lý do đầy đủ nằm ở đầu `SpeechCapability.ts`. Ở tầng này nó được CƯỠNG CHẾ, không
 *      chỉ ghi chú: `speak()` gọi `warnIfNotEnglish()` và **từ chối phát** nếu chuỗi không
 *      phải tiếng Anh. Nhờ vậy không có đường nào lọt tiếng Việt vào loa — kể cả khi một
 *      component trong tương lai truyền nhầm `t('kid.tryAgain')`.
 *
 *   2. **GIỌNG NỮ, TRẺ TRUNG, DỄ NGHE.** *"giọng nữ trẻ trung dễ nghe nhé"*
 *      Mặc định `voicePreference = 'female-young'`, ưu tiên `en-GB` (chuẩn Cambridge).
 *      Chi tiết cách quy đổi ý định này thành việc chọn giọng thật: xem `scoreVoice()`.
 *
 * ⚙️ THUẦN TYPESCRIPT — KHÔNG import React, KHÔNG đọc `localStorage`, KHÔNG gọi `fetch`.
 *    Nhờ vậy `pickVoice`/`scoreVoice` test được trên Node mà không cần trình duyệt thật.
 *
 * -----------------------------------------------------------------------------
 * BỐN CÁI BẪY ĐÃ TRẢ GIÁ, ĐỌC TRƯỚC KHI SỬA FILE NÀY
 * -----------------------------------------------------------------------------
 *
 * ⚠️ BẪY 1 — `getVoices()` TRẢ MẢNG RỖNG Ở LẦN GỌI ĐẦU (Chrome/Edge).
 *    Danh sách giọng được nạp BẤT ĐỒNG BỘ. Gọi `getVoices()` ngay lúc khởi động luôn nhận
 *    `[]` ⇒ `pickVoice` không tìm thấy gì ⇒ rơi về giọng mặc định của máy. Trên Windows,
 *    giọng mặc định thường là NAM (`Microsoft David`), tức là **yêu cầu "giọng nữ" bị vi
 *    phạm một cách im lặng** — không lỗi, không cảnh báo, chỉ là bé nghe giọng ông già.
 *    Cách chữa: `loadVoices()` chờ sự kiện `voiceschanged` (xem hàm đó).
 *
 * ⚠️ BẪY 2 — CHUỖI "Female" CHỨA CHUỗI "male".
 *    `"Google UK English Female".includes('male')` ⇒ **true**. Nếu kiểm giọng nam trước
 *    giọng nữ, giọng nữ của Chrome bị xếp nhầm thành nam và ta chọn đúng giọng SAI. Trong
 *    `voiceGender()` thứ tự kiểm là: nữ → nam. KHÔNG đảo lại.
 *
 * ⚠️ BẪY 3 — `cancel()` RỒI `speak()` NGAY TRONG CÙNG MỘT LƯỢT (Chrome).
 *    `cancel()` xoá hàng đợi nhưng việc xả hàng đợi xảy ra ở lượt sự kiện sau. Gọi `speak()`
 *    ngay lập tức có thể bị nuốt: bé bấm loa liên tục thì các lần bấm sau **không ra tiếng**.
 *    Cách chữa: sau `cancel()`, nhường một macrotask (`setTimeout 0`) rồi mới `speak()`.
 *    Đó là lý do `speak()` là hàm `async` dù bản thân API là đồng bộ.
 *
 * ⚠️ BẪY 4 — iOS/Safari CHỈ CHO PHÁT ÂM SAU MỘT THAO TÁC CỦA NGƯỜI DÙNG.
 *    Lần `speak()` đầu tiên phải nằm trong một lượt xử lý sự kiện thật (chạm nút). Nếu
 *    ta "hâm nóng" bằng cách đọc lúc tải trang, Safari sẽ chặn và **im lặng vĩnh viễn**
 *    cho tới khi tải lại. Vì vậy KHÔNG tự động đọc khi vào màn hình; mọi lời gọi phát âm
 *    đều xuất phát từ cú chạm của bé.
 */

import {
  SPEECH_RATE_DEFAULT,
  SPEECH_RATE_MAX,
  SPEECH_RATE_MIN,
  type VoicePreference,
} from '../store/settingsStore.js';
import { hasSpeechSynthesis, warnIfNotEnglish } from './SpeechCapability.js';

// =============================================================================
// Kiểu dữ liệu
// =============================================================================

/**
 * Hình dạng tối thiểu của một giọng đọc.
 *
 * Cố ý KHÔNG dùng thẳng `SpeechSynthesisVoice`: kiểu đó chỉ tồn tại trong trình duyệt, nên
 * test sẽ phải giả lập cả `speechSynthesis`. Với kiểu cấu trúc này, test chỉ cần truyền vào
 * mảng object thuần — và `scoreVoice` trở thành hàm thuần kiểm được trên Node.
 */
export interface VoiceLike {
  name: string;
  lang: string;
  /** `true` = giọng cài sẵn trên máy (đọc được cả khi mất mạng). */
  localService?: boolean;
  /** Giọng mặc định của hệ điều hành. */
  default?: boolean;
}

/** Cài đặt ảnh hưởng tới việc phát âm. Được hook đồng bộ từ `settingsStore`. */
export interface SpeechSettings {
  enabled: boolean;
  rate: number;
  voicePreference: VoicePreference;
}

/**
 * `'replace'` = cắt tiếng đang đọc để đọc câu mới (mặc định — bé chạm loa liên tục).
 * `'queue'`   = xếp hàng chờ đọc xong (dùng cho chuỗi tự động phát của flashcard).
 */
export type SpeakMode = 'replace' | 'queue';

export interface SpeakOptions {
  mode?: SpeakMode;
  /** Ghi đè tốc độ cho riêng lần này (VD: đọc chậm hẳn một từ khó). */
  rate?: number;
  /** Ghi đè ngôn ngữ. Mặc định lấy theo giọng chọn được, không có giọng thì `en-GB`. */
  lang?: string;
}

/** Ngôn ngữ dùng khi máy KHÔNG có giọng tiếng Anh nào. */
export const FALLBACK_SPEECH_LANG = 'en-GB';

/** Bao lâu thì bỏ cuộc chờ `voiceschanged` (xem bẫy 1). */
const VOICES_TIMEOUT_MS = 1_500;

// =============================================================================
// Danh sách tên giọng nữ — theo từng hệ điều hành
// =============================================================================
//
// ⚠️ ĐÂY LÀ DỮ LIỆU CỦA THẾ GIỚI THẬT, KHÔNG PHẢI SUY ĐOÁN.
//   Mỗi hệ điều hành đặt tên giọng khác nhau và trình duyệt KHÔNG cho biết giới tính.
//   Muốn biết "giọng này nam hay nữ" thì chỉ có hai cách: (a) tra bảng tên, hoặc (b) đo
//   phổ tần số âm thanh — cách (b) không khả thi cho một app web.
//
//   Tên được CHUẨN HOÁ trước khi so: bỏ dấu, bỏ ký tự không phải chữ, viết thường.
//   Nên "Microsoft Hazel - English (United Kingdom)" ⇒ "microsofthazelenglishunitedkingdom",
//   và ta chỉ cần tìm thấy "hazel" ở trong đó.
//
//   Danh sách này KHÔNG cần đầy đủ — thiếu một tên chỉ làm ta chọn giọng kém ưu tiên hơn,
//   không làm hỏng gì (vì còn tầng dự phòng "bất kỳ giọng tiếng Anh nào").

/** Tên giọng NỮ đã biết. Kiểm TRƯỚC tên nam — xem bẫy 2. */
const FEMALE_VOICE_NAMES: readonly string[] = [
  // macOS / iOS (Samantha là giọng nữ Mỹ mặc định của Apple)
  'samantha', 'karen', 'moira', 'tessa', 'fiona', 'serena', 'kate', 'alison', 'allison',
  'ava', 'susan', 'zoe', 'nicky', 'martha', 'catherine', 'audrey', 'stephanie', 'anna',
  'vicki', 'victoria', 'princess', 'agnes', 'kathy', 'veena', 'rishi_f', 'sinji',
  // Windows (Hazel/Susan/Sonia là en-GB; Zira/Michelle là en-US)
  'hazel', 'libby', 'sonia', 'zira', 'eva', 'clara', 'michelle', 'ana', 'jenny', 'aria',
  'maisie', 'kendra', 'salli', 'joanna', 'kimberly', 'ivy', 'amy', 'emma', 'olivia',
  // Chrome / Android / Edge neural
  'googleukenglishfemale', 'googleusenglish', 'emily', 'amber', 'ashley', 'cora',
  'elizabeth', 'monica', 'sara', 'nora',
  // Các tên trung tính thường là nữ ở một số hệ thống
  'linda', 'heather', 'crystal', 'shelby',
];

/** Tên giọng NAM đã biết. */
const MALE_VOICE_NAMES: readonly string[] = [
  // macOS / iOS
  'daniel', 'oliver', 'alex', 'fred', 'tom', 'aaron', 'arthur', 'gordon', 'rishi',
  'lee', 'junior', 'ralph',
  // Windows
  'george', 'mark', 'david', 'ryan', 'guy', 'james', 'brian', 'matthew', 'richard',
  'eric', 'christopher', 'roger', 'steffan', 'liam', 'connor', 'nathan', 'andrew',
  // Chrome / Android / Edge neural
  'googleukenglishmale', 'joey', 'justin', 'kevin', 'adam', 'thomas', 'william',
];

/**
 * Tên giọng được coi là "nghe tự nhiên, ít máy móc".
 *
 * ⭐ VÌ SAO CẦN: trình duyệt KHÔNG cho biết tuổi của giọng — không có thuộc tính nào nói
 *   "giọng này trẻ". Yêu cầu "trẻ trung" vì thế phải quy đổi thành hai thứ ĐO ĐƯỢC:
 *     (a) chọn giọng NỮ (đã làm ở trên),
 *     (b) ưu tiên giọng TỔNG HỢP THẦN KINH (neural) — nhóm `Natural`/`Online` của Edge và
 *         `Google` của Chrome. Các giọng này nghe mượt, trẻ và tự nhiên hơn hẳn giọng
 *         formant cũ (`Microsoft David`, `Zira`) vốn nghe như robot đọc.
 *   Cộng thêm tốc độ đọc chậm rãi (0.8) — giọng chậm, rõ, không "gằn" nghe gần gũi hơn.
 *   Đó là toàn bộ những gì một web app LÀM ĐƯỢC cho yêu cầu "giọng trẻ trung". Phần còn
 *   lại phụ thuộc giọng có sẵn trên máy của bé, không phải thứ code quyết định được.
 */
const NATURAL_VOICE_HINTS: readonly string[] = ['natural', 'neural', 'online', 'google'];

// =============================================================================
// Chọn giọng — hàm THUẦN, đây là phần được test kỹ nhất
// =============================================================================

/** Chuẩn hoá tên giọng để so khớp: bỏ dấu, bỏ ký tự lạ, viết thường. */
export function normalizeVoiceName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/** Giọng này là nam, nữ, hay không xác định. `null` = không có trong bảng tên. */
export function voiceGender(voice: VoiceLike): 'female' | 'male' | null {
  const n = normalizeVoiceName(voice.name);

  // ⚠️ BẪY 2: phải kiểm NỮ trước. "female" chứa "male", nên kiểm nam trước sẽ nhận nhầm
  // mọi giọng nữ có chữ "Female" trong tên (tức là toàn bộ giọng nữ của Chrome/Edge).
  if (FEMALE_VOICE_NAMES.some((x) => n.includes(x))) return 'female';
  if (MALE_VOICE_NAMES.some((x) => n.includes(x))) return 'male';

  // Dự phòng theo chữ trong tên. Thứ tự vẫn phải là female → male (bẫy 2).
  if (n.includes('female')) return 'female';
  if (n.includes('male')) return 'male';
  return null;
}

/** Giọng này có phải tiếng Anh không, và có phải tiếng Anh - ANH (`en-GB`) không. */
export function voiceLocale(voice: VoiceLike): { isEnglish: boolean; isBritishEnglish: boolean } {
  const lang = voice.lang.toLowerCase().replace('_', '-');
  return {
    isEnglish: lang.startsWith('en'),
    isBritishEnglish: lang.startsWith('en-gb'),
  };
}

/**
 * Điểm ưu tiên của một giọng. **Điểm cao hơn thì được chọn.** `-Infinity` = loại.
 *
 * Thang điểm được xếp theo đúng thứ tự ưu tiên của chủ dự án:
 *   • **Ngôn ngữ là điều kiện LOẠI, không phải điểm cộng.** Giọng không phải tiếng Anh
 *     không bao giờ được dùng: đọc từ tiếng Anh bằng giọng Việt sẽ ra âm vô nghĩa.
 *     (`-Infinity` chứ không phải điểm thấp — để không bao giờ thắng ở bất kỳ tổ hợp nào.)
 *   • **Giới tính nữ quan trọng hơn chất lượng giọng** (20 điểm so với tối đa 7). Bé nghe
 *     giọng nữ hơi máy vẫn tốt hơn nghe giọng nam rất mượt, vì yêu cầu là giọng nữ.
 *   • **`en-GB` hơn `en-US`** (40 so với 20): từ vựng Cambridge Starters thi theo chuẩn Anh,
 *     phát âm Mỹ sẽ lệch với băng nghe trong đề thi thật.
 *   • Chất lượng giọng và "là giọng mặc định" chỉ dùng để PHÂN XỬ khi các tiêu chí trên
 *     bằng nhau.
 */
export function scoreVoice(voice: VoiceLike, preference: VoicePreference): number {
  const { isEnglish, isBritishEnglish } = voiceLocale(voice);
  if (!isEnglish) return Number.NEGATIVE_INFINITY;

  let score = isBritishEnglish ? 40 : 20;

  const gender = voiceGender(voice);
  if (preference === 'any') {
    score += 10;
  } else if (preference === 'male') {
    if (gender === 'male') score += 20;
  } else {
    // 'female' và 'female-young' đều cần giọng nữ.
    // ⚠️ KHÔNG trừ điểm khi giọng là nam: nếu máy bé chỉ có giọng nam thì phải dùng nó
    //    (quy tắc "không bao giờ để im lặng"). Điểm 0 nghĩa là "kém ưu tiên", không phải
    //    "bị loại" — giọng nữ nếu có sẽ thắng nhờ 20 điểm.
    if (gender === 'female') score += 20;
  }

  // Chất lượng giọng — chỉ để phân xử, không lấn át tiêu chí giới tính/ngôn ngữ.
  const n = normalizeVoiceName(voice.name);
  if (NATURAL_VOICE_HINTS.some((h) => n.includes(h))) score += 4;
  // Giọng cài sẵn trên máy đọc được cả khi mất mạng — với bé dùng iPad offline là điểm cộng thật.
  if (voice.localService === true) score += 2;
  if (voice.default === true) score += 1;

  return score;
}

/**
 * Chọn giọng tốt nhất theo ý muốn. Trả `null` khi máy KHÔNG có giọng tiếng Anh nào.
 *
 * ⚠️ `null` KHÔNG có nghĩa là "không đọc được": `speak()` vẫn phát với `lang = 'en-GB'`
 *    và để trình duyệt tự xoay xở. Xem quy tắc "không bao giờ để im lặng" ở đầu file.
 *
 * ⚠️ Khi điểm bằng nhau, thứ tự được quyết định bởi TÊN GIỌNG (không phải thứ tự trong
 *    mảng). Nếu phụ thuộc vào thứ tự mảng, kết quả sẽ khác nhau giữa các lần chạy và giữa
 *    các máy — test sẽ chập chờn và không ai biết vì sao.
 */
export function pickVoice(
  voices: readonly VoiceLike[],
  preference: VoicePreference,
): VoiceLike | null {
  let best: VoiceLike | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const voice of voices) {
    const score = scoreVoice(voice, preference);
    if (score === Number.NEGATIVE_INFINITY) continue;
    if (score > bestScore || (score === bestScore && best !== null && voice.name < best.name)) {
      best = voice;
      bestScore = score;
    }
  }

  return best;
}

// =============================================================================
// Dịch vụ
// =============================================================================

/**
 * Hình dạng tối thiểu của `window.speechSynthesis` — đủ dùng, và giả lập được trong test.
 * Export để test dựng được synthesizer giả mà không phải chạm vào DOM thật.
 */
export interface SynthLike {
  getVoices(): VoiceLike[];
  speak(utterance: unknown): void;
  cancel(): void;
  readonly speaking: boolean;
  readonly pending: boolean;
  readonly paused: boolean;
  resume(): void;
}

/** Hình dạng tối thiểu của một `SpeechSynthesisUtterance`. */
export interface UtteranceLike {
  text: string;
  lang: string;
  rate: number;
  pitch: number;
  voice: VoiceLike | null;
  onend: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

export class SpeechService {
  private settings: SpeechSettings = {
    enabled: true,
    rate: SPEECH_RATE_DEFAULT,
    voicePreference: 'female-young',
  };

  /** Lời hứa nạp danh sách giọng — dùng chung để nhiều nơi gọi không chờ nhiều lần. */
  private voicesPromise: Promise<VoiceLike[]> | null = null;

  /** Giọng đã chọn cho lần phát gần nhất, tính lại khi cài đặt giọng đổi. */
  private resolvedVoice: VoiceLike | null | undefined = undefined;

  /** Hàng đợi cho chế độ `'queue'` (chuỗi tự động phát). */
  private queue: Array<{ text: string; options: SpeakOptions }> = [];
  private draining = false;

  constructor(
    private readonly synth: SynthLike | null = getSynth(),
    private readonly createUtterance: (text: string) => UtteranceLike = defaultCreateUtterance,
  ) {}

  /** Trình duyệt có Web Speech API không. */
  isSupported(): boolean {
    return this.synth !== null;
  }

  /** Cập nhật cài đặt. Đổi `voicePreference` sẽ xoá giọng đã chọn để lần sau chọn lại. */
  setSettings(patch: Partial<SpeechSettings>): void {
    const prev = this.settings.voicePreference;
    this.settings = { ...this.settings, ...patch };
    if (patch.rate !== undefined) {
      this.settings.rate = clampRate(this.settings.rate);
    }
    if (patch.voicePreference !== undefined && patch.voicePreference !== prev) {
      this.resolvedVoice = undefined;
    }
  }

  getSettings(): Readonly<SpeechSettings> {
    return this.settings;
  }

  /**
   * Nạp danh sách giọng, CHỜ tới khi trình duyệt sẵn sàng (bẫy 1).
   *
   * Thứ tự thử:
   *   1. `getVoices()` đã có dữ liệu ⇒ xong ngay (trường hợp thường gặp ở lần gọi thứ hai).
   *   2. Chờ sự kiện `voiceschanged`, đồng thời hẹn giờ `VOICES_TIMEOUT_MS`.
   *
   * ⚠️ VÌ SAO PHẢI CÓ HẸN GIỜ: Firefox và một số bản Chrome trên Linux **không bao giờ**
   *    phát `voiceschanged` khi máy không cài giọng nào. Không có hẹn giờ thì lời hứa này
   *    treo vĩnh viễn và mọi lời gọi phát âm sau đó cũng treo theo — app "đứng" mà không
   *    có lỗi nào để lần theo.
   */
  async loadVoices(): Promise<VoiceLike[]> {
    if (!this.synth) return [];
    const immediate = this.synth.getVoices();
    if (immediate.length > 0) return immediate;

    if (this.voicesPromise) return this.voicesPromise;

    this.voicesPromise = new Promise<VoiceLike[]>((resolve) => {
      const synth = this.synth;
      if (!synth) {
        resolve([]);
        return;
      }

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        removeVoicesChangedListener(synth, onChanged);
        // Đọc lại lần cuối: sự kiện có thể bắn trước khi danh sách thật sự có dữ liệu.
        resolve(synth.getVoices());
      };
      const onChanged = () => finish();
      const timer = setTimeout(finish, VOICES_TIMEOUT_MS);

      addVoicesChangedListener(synth, onChanged);
    });

    return this.voicesPromise;
  }

  /** Giọng đang được dùng, hoặc `null` nếu máy không có giọng tiếng Anh nào. */
  async getVoice(): Promise<VoiceLike | null> {
    if (this.resolvedVoice !== undefined) return this.resolvedVoice;
    const voices = await this.loadVoices();
    this.resolvedVoice = pickVoice(voices, this.settings.voicePreference);
    return this.resolvedVoice;
  }

  /**
   * Đọc một chuỗi TIẾNG ANH.
   *
   * Trả `true` nếu đã đưa vào hàng đợi phát, `false` nếu bỏ qua. **Bỏ qua là hành vi ĐÚNG**
   * trong ba trường hợp, và cả ba đều im lặng có chủ đích:
   *   • trình duyệt không hỗ trợ,
   *   • phụ huynh đã tắt tiếng,
   *   • chuỗi KHÔNG phải tiếng Anh (ràng buộc số 1 — có cảnh báo ở môi trường phát triển).
   *
   * ⚠️ KHÔNG ném lỗi trong cả ba trường hợp trên. Bé đang chạm loa để nghe từ vựng; một
   *    `throw` ở đây sẽ làm sập màn hình học chỉ vì máy không có giọng đọc.
   */
  async speak(text: string, options: SpeakOptions = {}): Promise<boolean> {
    if (!this.synth) return false;
    if (!this.settings.enabled) return false;
    // ⭐ RÀNG BUỘC SỐ 1 — cưỡng chế bằng code, không chỉ bằng tài liệu.
    if (!warnIfNotEnglish(text, 'SpeechService.speak')) return false;

    const mode: SpeakMode = options.mode ?? 'replace';

    if (mode === 'queue') {
      this.queue.push({ text, options });
      if (!this.draining) void this.drain();
      return true;
    }

    this.queue = [];
    // ⚠️ Chế độ `'replace'` KHÔNG chờ tiếng đọc kết thúc — chỉ chờ tới lúc nó BẮT ĐẦU.
    //    Chờ tới `onend` sẽ khiến mọi `await speak(...)` trong một trình xử lý cú chạm treo
    //    cho tới khi đọc xong cả câu (hoặc treo VĨNH VIỄN nếu trình duyệt không bắn `onend`,
    //    chuyện đã gặp trên một số bản Chrome khi tab bị ẩn). Chỉ chế độ `'queue'` mới cần
    //    biết lúc kết thúc, vì nó phải chờ mới đọc câu kế tiếp.
    await this.flushAndSpeak(text, options, false);
    return true;
  }

  /** Đọc một chuỗi câu, lần lượt — dùng cho flashcard tự động phát. */
  async speakSequence(texts: readonly string[]): Promise<void> {
    for (const text of texts) {
      await this.speak(text, { mode: 'queue' });
    }
  }

  /** Dừng ngay mọi âm thanh đang đọc và xoá hàng đợi. */
  stop(): void {
    this.queue = [];
    this.draining = false;
    this.synth?.cancel();
  }

  /** Có đang đọc (hoặc còn hàng đợi) không — dùng để đổi biểu tượng nút loa. */
  isSpeaking(): boolean {
    if (!this.synth) return false;
    return this.synth.speaking || this.synth.pending || this.queue.length > 0;
  }

  // --- Nội bộ ---------------------------------------------------------------

  /**
   * Xả hàng đợi tuần tự: đọc câu đầu, chờ `onend`, rồi sang câu kế.
   * `draining` chặn việc xả chồng lên nhau khi `speak()` được gọi nhiều lần liên tiếp.
   */
  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        const next = this.queue.shift();
        if (!next) break;
        // Đã tắt tiếng giữa chừng ⇒ bỏ phần còn lại thay vì đọc tiếp trong im lặng.
        if (!this.settings.enabled) {
          this.queue = [];
          break;
        }
        await this.flushAndSpeak(next.text, next.options, true);
      }
    } finally {
      this.draining = false;
    }
  }

  /**
   * `cancel()` rồi `speak()` — có nhường một macrotask ở giữa (bẫy 3).
   *
   * `waitForEnd = false` ⇒ hoàn tất ngay khi utterance đã được giao cho synthesizer.
   * `waitForEnd = true`  ⇒ hoàn tất khi tiếng đọc KẾT THÚC (hoặc lỗi). Chỉ `drain()` cần
   *                        chế độ này, vì nó phải biết câu trước đã đọc xong mới đi tiếp.
   */
  private flushAndSpeak(text: string, options: SpeakOptions, waitForEnd: boolean): Promise<void> {
    const synth = this.synth;
    if (!synth) return Promise.resolve();

    // Chỉ `cancel()` khi thật sự có gì đó đang chạy: `cancel()` vô cớ trên một số bản
    // Chrome đặt synthesizer vào trạng thái cần một cú chạm mới thoát ra được.
    const needFlush = synth.speaking || synth.pending;
    if (needFlush) synth.cancel();

    return new Promise<void>((resolve) => {
      const start = () => {
        if (!this.synth) {
          resolve();
          return;
        }

        const utterance = this.createUtterance(text);
        utterance.voice = this.resolvedVoice ?? null;
        utterance.lang = options.lang ?? this.resolvedVoice?.lang ?? FALLBACK_SPEECH_LANG;
        utterance.rate = clampRate(options.rate ?? this.settings.rate);
        // ⚠️ `pitch` cố ý để 1.0. Nâng lên 1.2 để "nghe trẻ hơn" là mẹo phổ biến nhưng
        //    làm giọng méo và the thé trên loa điện thoại — nghe như đồ chơi hỏng, không
        //    phải cô giáo trẻ. Độ "trẻ trung" đến từ việc chọn giọng (scoreVoice), không
        //    phải từ việc bẻ giọng.
        utterance.pitch = 1;

        let done = false;
        const settle = () => {
          if (done) return;
          done = true;
          resolve();
        };
        utterance.onend = settle;
        // Lỗi cũng phải `resolve`: nếu không, `drain()` kẹt vĩnh viễn ở câu hỏng và mọi
        // câu sau không bao giờ được đọc.
        utterance.onerror = settle;

        try {
          this.synth.speak(utterance);
        } catch {
          settle();
          return;
        }

        if (!waitForEnd) settle();
      };

      if (needFlush) {
        // BẪY 3: nhường một macrotask cho Chrome xả xong hàng đợi cũ.
        setTimeout(start, 0);
      } else {
        start();
      }
    });
  }
}

// =============================================================================
// Tiện ích cấp module
// =============================================================================

/** Kẹp tốc độ đọc — giá trị ngoài khoảng làm giọng đọc méo hoặc không đọc được. */
export function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return SPEECH_RATE_DEFAULT;
  return Math.min(SPEECH_RATE_MAX, Math.max(SPEECH_RATE_MIN, rate));
}

/** Lấy `speechSynthesis` từ window, an toàn cả khi chạy trên Node (test). */
function getSynth(): SynthLike | null {
  if (!hasSpeechSynthesis()) return null;
  return window.speechSynthesis as unknown as SynthLike;
}

/** Tạo utterance. Trên Node (test) không có lớp này ⇒ trả object rỗng đúng hình dạng. */
function defaultCreateUtterance(text: string): UtteranceLike {
  const Ctor = (globalThis as { SpeechSynthesisUtterance?: new (t: string) => unknown })
    .SpeechSynthesisUtterance;
  if (typeof Ctor === 'function') {
    return new Ctor(text) as unknown as UtteranceLike;
  }
  return {
    text,
    lang: FALLBACK_SPEECH_LANG,
    rate: 1,
    pitch: 1,
    voice: null,
    onend: null,
    onerror: null,
  };
}

/**
 * Nghe sự kiện `voiceschanged`.
 *
 * ⚠️ Đăng ký CẢ HAI đường: `addEventListener` (chuẩn) và `onvoiceschanged` (Safari cũ chỉ
 *    có thuộc tính này). Chỉ dùng một đường thì trên một nửa số thiết bị sẽ không bao giờ
 *    nhận được sự kiện ⇒ quay lại đúng bẫy 1 (chọn nhầm giọng nam mặc định).
 */
function addVoicesChangedListener(synth: SynthLike, handler: () => void): void {
  const target = synth as unknown as {
    addEventListener?: (type: string, cb: () => void) => void;
    onvoiceschanged?: (() => void) | null;
  };
  if (typeof target.addEventListener === 'function') {
    target.addEventListener('voiceschanged', handler);
  }
  target.onvoiceschanged = handler;
}

function removeVoicesChangedListener(synth: SynthLike, handler: () => void): void {
  const target = synth as unknown as {
    removeEventListener?: (type: string, cb: () => void) => void;
    onvoiceschanged?: (() => void) | null;
  };
  if (typeof target.removeEventListener === 'function') {
    target.removeEventListener('voiceschanged', handler);
  }
  if (target.onvoiceschanged === handler) {
    target.onvoiceschanged = null;
  }
}

/**
 * Instance dùng chung — giọng đọc là tài nguyên của THIẾT BỊ, không phải của component.
 *
 * ⚠️ KHÔNG tạo instance thứ hai ở bất kỳ đâu trong `src/`. Hai instance cùng gọi
 *    `speechSynthesis.speak()` sẽ chồng tiếng lên nhau và `cancel()` của bên này không
 *    dừng được tiếng của bên kia. Test tự dựng instance riêng qua `new SpeechService(...)`
 *    là trường hợp duy nhất được phép.
 */
export const speechService = new SpeechService();
