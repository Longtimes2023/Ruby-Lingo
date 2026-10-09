/**
 * RubyLingo — AudioSfxService: hiệu ứng âm thanh khi bé chạm / trả lời.
 *
 * ⭐ QUYẾT ĐỊNH KIẾN TRÚC: **TỔNG HỢP ÂM THANH BẰNG WEB AUDIO API, KHÔNG DÙNG FILE .mp3**
 *
 *   Vì sao không dùng file âm thanh:
 *     1. **Không cần tài nguyên nhị phân.** Dự án chưa có pipeline sinh/duyệt file âm thanh,
 *        và mỗi file thêm vào là một thứ phải tải, phải cache, phải xin bản quyền.
 *     2. **Không có độ trễ giải mã.** Âm thanh phản hồi khi bé chạm phải TỨC THÌ. File .mp3
 *        cần tải + giải mã, và trên mạng 3G của điện thoại thì tiếng "tách" sẽ đến sau cú
 *        chạm nửa giây — cảm giác app bị lag, không phải cảm giác được phản hồi.
 *     3. **Nhỏ hơn 1.000 lần.** Toàn bộ file này ~8 KB thay vì ~200 KB cho 8 file .mp3.
 *
 *   Cái giá phải trả: âm thanh tổng hợp "đơn giản" hơn file thu sẵn. Với app học từ vựng
 *   thì điều đó chấp nhận được — hiệu ứng ở đây chỉ để báo "đúng rồi", không phải để biểu
 *   diễn. Khi nào có nhu cầu làm âm thanh phong phú hơn, `play()` là CHỖ DUY NHẤT cần đổi.
 *
 * ⚠️ KHÔNG BAO GIỜ DÙNG `SpeechService` CHO HIỆU ỨNG.
 *   `SpeechService.speak()` từ chối mọi chuỗi không phải tiếng Anh (ràng buộc số 1). Dùng nó
 *   để "đọc" hiệu ứng sẽ hoặc bị chặn, hoặc tệ hơn: đọc một từ tiếng Anh vô nghĩa.
 *   Hai dịch vụ này phục vụ hai mục đích khác hẳn nhau và không được trộn.
 *
 * -----------------------------------------------------------------------------
 * BỐN CÁI BẪY
 * -----------------------------------------------------------------------------
 *
 * ⚠️ BẪY 1 — AudioContext KHỞI TẠO Ở TRẠNG THÁI `suspended`.
 *    Chính sách autoplay của mọi trình duyệt hiện đại chặn âm thanh cho tới khi người dùng
 *    có một thao tác thật. AudioContext tạo lúc tải trang sẽ nằm ở `suspended` và **im lặng
 *    vĩnh viễn**, không lỗi, không cảnh báo. Cách chữa: gọi `unlock()` bên trong chính trình
 *    xử lý cú chạm đầu tiên. Xem `useSfx`.
 *
 * ⚠️ BẪY 2 — iOS CẦN `resume()` TRONG CHÍNH LƯỢT XỬ LÝ SỰ KIỆN.
 *    Không phải "sau khi người dùng đã chạm một lần" là xong: `resume()` phải được gọi
 *    ĐỒNG BỘ bên trong handler. Gọi nó trong một `.then()` hay `setTimeout` là quá muộn và
 *    iOS từ chối. Vì vậy `unlock()` cố ý KHÔNG `async`.
 *
 * ⚠️ BẪY 3 — MỖI `new AudioContext()` LÀ MỘT TÀI NGUYÊN CỦA HỆ ĐIỀU HÀNH.
 *    Chrome giới hạn khoảng 6 context cho mỗi tab và sẽ ném lỗi khi vượt. Tạo một context
 *    cho mỗi tiếng động ⇒ sau vài chục cú chạm là app hỏng âm thanh. Vì vậy chỉ có MỘT
 *    context, tạo muộn (lazy) và dùng lại mãi.
 *
 * ⚠️ BẪY 4 — KHÔNG ĐƯỢC ĐỂ ÂM THANH "SAI" NGHE NHƯ TIẾNG MÁY HỎNG.
 *    Triết lý của app là KHÔNG KHIỂN TRÁCH TRẺ. Một tiếng "buzz" như game thua sẽ khiến bé
 *    7 tuổi hiểu ngay là "con làm sai" — đúng thứ ta tránh. Âm báo trả lời lại vì thế là
 *    hai nốt ĐI XUỐNG nhưng êm (nốt sine, âm lượng thấp), nghe như "hmm, thử lại nhé",
 *    không phải như còi báo lỗi. Xem `SFX_RECIPES.wrong`.
 */

// =============================================================================
// Bản nhạc của từng hiệu ứng — hàm THUẦN, test được không cần trình duyệt
// =============================================================================

/** Một nốt trong hiệu ứng. */
export interface SfxNote {
  /** Tần số (Hz). */
  frequency: number;
  /** Thời lượng (giây). */
  duration: number;
  /** Dạng sóng. `sine` êm nhất, `triangle` sáng hơn, `square`/`sawtooth` chói — tránh. */
  wave: 'sine' | 'triangle' | 'square';
  /** Âm lượng đỉnh, 0–1. Giữ thấp: loa điện thoại khuếch đại mạnh hơn tai người nghĩ. */
  gain: number;
  /** Nghỉ bao lâu trước khi đánh nốt này (giây). */
  delay?: number;
}

/**
 * Tên hiệu ứng.
 *
 * ⚠️ `'wrong'` là TÊN KỸ THUẬT, KHÔNG phải từ hiển thị cho bé. Trong giao diện, âm này
 *    luôn đi kèm câu "Bé thử lại nhé!" — không bao giờ có chữ "sai". Xem triết lý ở đầu
 *    `docs/KE-HOACH.md`.
 */
export type SfxName =
  | 'tap'
  | 'pop'
  | 'correct'
  | 'wrong'
  | 'reward'
  | 'levelUp'
  | 'unlock'
  | 'swipe';

/**
 * Các nốt của từng hiệu ứng.
 *
 * Âm nhạc ở đây có chủ đích: các hợp âm ĐI LÊN (đúng, thưởng, mở khoá) tạo cảm giác tiến
 * bộ; hợp âm đi xuống nhẹ nhàng (thử lại) tạo cảm giác "chưa xong" mà không gây khó chịu.
 * Tất cả đều nằm ở quãng cao vừa phải (C5–C6, ~523–1047 Hz) — vùng tai trẻ nhạy nhất và
 * cũng là vùng loa điện thoại tái tạo tốt nhất.
 */
export const SFX_RECIPES: Readonly<Record<SfxName, readonly SfxNote[]>> = {
  /** Chạm một ô/nút bình thường. Rất ngắn, rất nhẹ — bé chạm hàng trăm lần mỗi buổi. */
  tap: [{ frequency: 660, duration: 0.06, wave: 'triangle', gain: 0.1 }],

  /** Bong bóng nổ — dùng khi mở một thứ nhỏ (thẻ, hộp quà). */
  pop: [{ frequency: 880, duration: 0.07, wave: 'sine', gain: 0.12 }],

  /** Trả lời ĐÚNG: ba nốt đi lên (C5–E5–G5). */
  correct: [
    { frequency: 523.25, duration: 0.09, wave: 'triangle', gain: 0.14 },
    { frequency: 659.25, duration: 0.09, wave: 'triangle', gain: 0.14 },
    { frequency: 783.99, duration: 0.14, wave: 'triangle', gain: 0.15 },
  ],

  /**
   * Trả lời CHƯA ĐÚNG: hai nốt đi xuống (G4–F4), sóng sine, âm lượng thấp.
   * ⭐ Cố ý KHÔNG dùng sóng vuông và KHÔNG dùng quãng nghịch — nghe như lời nhắc nhẹ,
   *    không phải như tiếng còi báo sai.
   */
  wrong: [
    { frequency: 392, duration: 0.12, wave: 'sine', gain: 0.09 },
    { frequency: 349.23, duration: 0.16, wave: 'sine', gain: 0.08 },
  ],

  /** Nhận thưởng: bốn nốt đi lên, kết thúc ở nốt dài (C5–E5–G5–C6). */
  reward: [
    { frequency: 523.25, duration: 0.1, wave: 'triangle', gain: 0.14 },
    { frequency: 659.25, duration: 0.1, wave: 'triangle', gain: 0.14 },
    { frequency: 783.99, duration: 0.1, wave: 'triangle', gain: 0.14 },
    { frequency: 1046.5, duration: 0.3, wave: 'sine', gain: 0.16 },
  ],

  /** Lên cấp / tiến hoá: dài hơn, có nốt lặp lại để nghe "trang trọng" hơn. */
  levelUp: [
    { frequency: 523.25, duration: 0.1, wave: 'triangle', gain: 0.13 },
    { frequency: 659.25, duration: 0.1, wave: 'triangle', gain: 0.13 },
    { frequency: 783.99, duration: 0.1, wave: 'triangle', gain: 0.13 },
    { frequency: 1046.5, duration: 0.12, wave: 'triangle', gain: 0.15 },
    { frequency: 783.99, duration: 0.12, wave: 'sine', gain: 0.12 },
    { frequency: 1046.5, duration: 0.4, wave: 'sine', gain: 0.16 },
  ],

  /** Mở khoá chủ đề/huy hiệu: chuỗi nốt cao, nhanh, nghe như tia sáng. */
  unlock: [
    { frequency: 783.99, duration: 0.07, wave: 'sine', gain: 0.11 },
    { frequency: 987.77, duration: 0.07, wave: 'sine', gain: 0.11 },
    { frequency: 1174.66, duration: 0.07, wave: 'sine', gain: 0.11 },
    { frequency: 1567.98, duration: 0.22, wave: 'sine', gain: 0.13 },
  ],

  /** Vuốt / chuyển thẻ. Rất khẽ — đây là âm nền, không phải âm báo. */
  swipe: [{ frequency: 440, duration: 0.05, wave: 'sine', gain: 0.07 }],
};

/** Âm lượng tổng của mọi hiệu ứng. Chỉnh một chỗ thay vì sửa từng nốt. */
const MASTER_GAIN = 0.9;

// =============================================================================
// Kiểu tối thiểu của Web Audio API — để giả lập được trong test
// =============================================================================

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, startTime: number): unknown;
  linearRampToValueAtTime(value: number, endTime: number): unknown;
  exponentialRampToValueAtTime(value: number, endTime: number): unknown;
}

export interface OscillatorLike {
  type: string;
  frequency: AudioParamLike;
  connect(dest: unknown): unknown;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface GainNodeLike {
  gain: AudioParamLike;
  connect(dest: unknown): unknown;
}

export interface AudioContextLike {
  readonly state: string;
  readonly currentTime: number;
  readonly destination: unknown;
  resume(): Promise<void>;
  createOscillator(): OscillatorLike;
  createGain(): GainNodeLike;
  close?(): Promise<void>;
}

/** Cài đặt ảnh hưởng tới hiệu ứng. Đồng bộ từ `settingsStore` qua `useSfx`. */
export interface SfxSettings {
  enabled: boolean;
  hapticsEnabled: boolean;
}

// =============================================================================
// Dịch vụ
// =============================================================================

export class AudioSfxService {
  private settings: SfxSettings = { enabled: true, hapticsEnabled: true };

  /** Tạo MUỘN (bẫy 3): chỉ tạo khi thật sự cần, và chỉ một lần. */
  private context: AudioContextLike | null = null;

  /** Số lần tạo context — test dùng để chứng minh "chỉ một context". */
  private contextCreations = 0;

  constructor(private readonly createContext: (() => AudioContextLike | null) | null = null) {}

  /** Trình duyệt có Web Audio API không. */
  isSupported(): boolean {
    return this.getContextFactory() !== null;
  }

  /** Số context đã tạo. Test dùng để chứng minh không rò rỉ tài nguyên. */
  contextCount(): number {
    return this.contextCreations;
  }

  setSettings(patch: Partial<SfxSettings>): void {
    this.settings = { ...this.settings, ...patch };
  }

  getSettings(): Readonly<SfxSettings> {
    return this.settings;
  }

  /**
   * Đánh thức âm thanh. **PHẢI gọi trong chính trình xử lý cú chạm đầu tiên** (bẫy 1, 2).
   *
   * ⚠️ Cố ý KHÔNG `async`: xem bẫy 2. Trả về `void` để không ai lỡ `await` nó rồi vô tình
   *    đẩy `resume()` ra khỏi lượt xử lý sự kiện.
   */
  unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      // Nuốt lỗi có chủ đích: nếu trình duyệt từ chối, lần chạm sau sẽ thử lại. Ném lỗi ở
      // đây sẽ làm sập trình xử lý cú chạm — tức là nút bấm không hoạt động chỉ vì âm thanh.
      void ctx.resume().catch(() => undefined);
    }
  }

  /**
   * Phát một hiệu ứng. Trả `false` nếu bỏ qua (tắt tiếng, không hỗ trợ).
   *
   * Không bao giờ ném lỗi: âm thanh là thứ KÈM THEO, không phải thứ bé cần để học. Một
   * tiếng động không phát được không được phép chặn việc bé trả lời câu hỏi.
   */
  play(name: SfxName): boolean {
    if (!this.settings.enabled) return false;
    const ctx = this.ensureContext();
    if (!ctx) return false;

    // Context còn `suspended` ⇒ bé chưa chạm lần nào, hoặc `unlock()` chưa chạy. Vẫn thử
    // `resume()` (rẻ) rồi đánh nốt; nếu trình duyệt chặn thì lần sau tiếng sẽ ra.
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined);
    }

    const notes = SFX_RECIPES[name];
    const startAt = ctx.currentTime;

    try {
      for (const note of notes) {
        this.scheduleNote(ctx, note, startAt + (note.delay ?? 0));
      }
      this.vibrate(name);
      return true;
    } catch {
      // Trình duyệt hết tài nguyên node, hoặc context đã bị đóng sau khi tab ngủ.
      return false;
    }
  }

  /** Rung khi trả lời đúng. Không có tác dụng trên iOS — Safari không hỗ trợ Vibration API. */
  vibrate(name: SfxName): void {
    if (!this.settings.hapticsEnabled) return;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    const pattern = HAPTIC_PATTERNS[name];
    if (!pattern) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      /* Không rung được thì thôi. */
    }
  }

  /** Đóng context — chỉ dùng khi gỡ app hoặc trong test. */
  async dispose(): Promise<void> {
    const ctx = this.context;
    this.context = null;
    if (ctx?.close) {
      try {
        await ctx.close();
      } catch {
        /* Đã đóng rồi. */
      }
    }
  }

  // --- Nội bộ ---------------------------------------------------------------

  private getContextFactory(): (() => AudioContextLike | null) | null {
    if (this.createContext) return this.createContext;
    if (typeof window === 'undefined') return null;
    const w = window as unknown as {
      AudioContext?: new () => AudioContextLike;
      webkitAudioContext?: new () => AudioContextLike;
    };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;
    return () => new Ctor();
  }

  private ensureContext(): AudioContextLike | null {
    if (this.context) return this.context;
    const factory = this.getContextFactory();
    if (!factory) return null;
    try {
      const created = factory();
      // Factory có thể trả `null` khi trình duyệt từ chối tạo context (Safari cũ hết tài
      // nguyên). Đếm cả lần THẤT BẠI sẽ làm con số này vô nghĩa — nó phải là "số context
      // đang tồn tại", tức là thứ dùng để phát hiện rò rỉ tài nguyên.
      if (!created) return null;
      this.context = created;
      this.contextCreations += 1;
      return created;
    } catch {
      // Safari cũ ném lỗi khi tạo quá nhiều context, hoặc khi bị chặn hoàn toàn.
      return null;
    }
  }

  /**
   * Đánh một nốt: dao động → gain (bao hình) → loa.
   *
   * Bao hình (envelope) là thứ quyết định nốt nghe "sạch" hay "tạch":
   *   • Lên nhanh (10 ms) để không có tiếng "cụp" ở đầu.
   *   • Xuống dần về gần 0 để không có tiếng "tách" ở cuối.
   *
   * ⚠️ `exponentialRampToValueAtTime` KHÔNG nhận giá trị 0 (sẽ ném lỗi) — phải dùng một
   *    số rất nhỏ. Đây là lỗi kinh điển khiến tiếng động im lặng không rõ lý do.
   */
  private scheduleNote(ctx: AudioContextLike, note: SfxNote, startAt: number): void {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = note.wave;
    oscillator.frequency.setValueAtTime(note.frequency, startAt);

    const peak = Math.max(0.0001, note.gain * MASTER_GAIN);
    const attackEnd = startAt + 0.01;
    const end = startAt + note.duration;

    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.linearRampToValueAtTime(peak, attackEnd);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(startAt);
    // Dừng muộn hơn một chút so với đỉnh bao hình: nếu dừng đúng lúc, nốt bị cắt cụt.
    oscillator.stop(end + 0.02);
  }
}

/**
 * Kiểu rung cho từng hiệu ứng.
 *
 * Chỉ những hiệu ứng ĐÁNG chú ý mới rung. Rung ở mọi cú chạm sẽ nhanh chóng thành phiền và
 * tốn pin — và trên điện thoại Android đặt trong túi áo, nó còn gây giật mình.
 */
const HAPTIC_PATTERNS: Partial<Record<SfxName, number | number[]>> = {
  correct: 18,
  reward: [14, 40, 14],
  levelUp: [18, 50, 18, 50, 30],
  unlock: [12, 30, 12],
  wrong: 10,
};

/** Instance dùng chung — context âm thanh là tài nguyên của THIẾT BỊ (bẫy 3). */
export const audioSfxService = new AudioSfxService();
