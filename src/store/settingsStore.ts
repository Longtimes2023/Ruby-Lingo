/**
 * RubyLingo — `settingsStore`: cài đặt của bé / phụ huynh, lưu trong máy.
 *
 * ⚠️ PHẠM VI HIỆN TẠI (Nhóm 3): chỉ có các cờ cần cho `SoundButton` và cho việc tôn trọng
 *   chuyển động. Nhóm 6 (T036) sẽ dùng chính store này cho `AudioSfxService` (nhạc nền, pool
 *   âm thanh) — khi đó CHỈ THÊM trường, KHÔNG đổi tên trường cũ, vì cài đặt đã lưu trong máy
 *   của bé sẽ không đọc được nữa nếu đổi tên.
 *
 * ⭐ VÌ SAO LƯU TRONG MÁY, KHÔNG LƯU LÊN SERVER:
 *   Đây là sở thích của THIẾT BỊ, không phải dữ liệu học tập. Bé dùng iPad ngoài phòng khách
 *   cần tắt tiếng, nhưng khi cắm tai nghe vào laptop thì vẫn muốn có tiếng. Đồng bộ lên server
 *   sẽ khiến hai thiết bị ghi đè lẫn nhau — hành vi gây khó chịu mà không ai hiểu vì sao.
 *   Hơn nữa, không gửi thêm dữ liệu lên server là điều đúng về quyền riêng tư trẻ em.
 *
 * ⭐ VÌ SAO KHÔNG DÙNG `zustand/persist`:
 *   Middleware đó tự đọc `localStorage` ngay lúc nạp module. Trong chế độ riêng tư của Safari,
 *   lệnh đọc đó NÉM lỗi ⇒ cả ứng dụng trắng màn hình trước khi React kịp chạy. Tự viết với
 *   `try/catch` (giống `sessionStore`) giữ quyền kiểm soát và không bao giờ làm sập app.
 */

import { create } from 'zustand';

import { SPEECH_RATE_MAX, SPEECH_RATE_MIN } from '@shared/constants.js';

/**
 * ⚠️ TÁI XUẤT, KHÔNG KHAI LẠI (sửa 2026-10-09, do T080 phát hiện).
 *
 *   Trước đây hai hằng số này được VIẾT LẠI ở đây với cùng giá trị `0.5` / `1.2`. Cùng một con số
 *   nằm ở BA nơi:
 *     • `shared/constants.ts` — bản chuẩn, được `shared/schemas/settings.ts` dùng;
 *     • tệp này — được `ParentSettingsPage` (thanh trượt) và `SpeechService` (kẹp) dùng;
 *     • `CHECK (speech_rate >= 0.5 AND speech_rate <= 1.2)` trong `migrations/002_child.sql`.
 *
 *   ⚠️ VÌ SAO ĐÓ LÀ LỖI CHỨ KHÔNG PHẢI CHUYỆN NHỎ: migration là BẤT BIẾN. Nếu ai đó nới khoảng ở
 *   hằng số mà không viết migration mới, thanh trượt sẽ cho phụ huynh chọn 1.3, schema cho qua,
 *   rồi SQLite từ chối ⇒ **500 cho một ô nhập trông hoàn toàn hợp lệ**. Không có thông báo nào chỉ
 *   ra nguyên nhân, vì ba nơi đều "đúng" theo cách riêng của chúng.
 *
 *   Nay `shared/constants.ts` là nguồn DUY NHẤT. Tệp này chỉ chuyển tiếp, để mọi nơi đang import
 *   từ đây không phải sửa — và để lần sau không còn chỗ thứ hai để lệch.
 */
export { SPEECH_RATE_MAX, SPEECH_RATE_MIN };

/** Mặc định 0.8 — bé 7 tuổi nghe vừa; người lớn thấy chậm nhưng bé cần. */
export const SPEECH_RATE_DEFAULT = 0.8;

const STORAGE_KEY = 'rubylingo.settings';

/**
 * Cài đặt "ba trạng thái" cho chuyển động:
 *   `null` = theo cài đặt hệ điều hành (mặc định — tôn trọng người dùng)
 *   `true` = luôn giảm hiệu ứng (phụ huynh bật tay cho bé nhạy cảm)
 *   `false` = luôn hiện đủ hiệu ứng (phụ huynh chủ động tắt)
 */
export type ReducedMotionPreference = boolean | null;

/**
 * Kiểu giọng đọc mong muốn cho phần phát âm tiếng Anh.
 *
 * ⭐ YÊU CẦU CỦA CHỦ DỰ ÁN: **giọng NỮ, trẻ trung, dễ nghe** ⇒ mặc định `'female-young'`.
 *   Với app học từ vựng cho bé 7 tuổi, giọng nữ trẻ tạo cảm giác gần gũi như cô giáo; giọng
 *   nam trầm hoặc giọng tổng hợp quá "máy" làm bé ngại nhắc lại.
 *
 * ⚠️ TRÌNH DUYỆT KHÔNG CÓ KHÁI NIỆM "TUỔI" CỦA GIỌNG — xem `SpeechService` (T035) để biết
 *   cách quy đổi ý định này thành việc chọn giọng thật:
 *     1. Ưu tiên tiếng Anh **Anh** (`en-GB`) vì đây là từ vựng Cambridge Starters — bé học
 *        để thi theo chuẩn Anh, phát âm Mỹ sẽ lệch với băng nghe của đề thi.
 *     2. Trong cùng một locale, chọn giọng NỮ theo danh sách tên đã biết (mỗi hệ điều hành
 *        đặt tên khác nhau: `Samantha`/`Karen`/`Serena` trên iOS, `Hazel`/`Libby` trên
 *        Windows, `Google UK English Female` trên Chrome...).
 *     3. Không tìm được giọng nữ ⇒ dùng bất kỳ giọng tiếng Anh nào. KHÔNG bao giờ để im lặng.
 */
export type VoicePreference = 'female-young' | 'female' | 'male' | 'any';

export interface SettingsState {
  /**
   * Bật âm thanh của RubyLingo: giọng đọc TIẾNG ANH, hiệu ứng âm thanh, và nhạc nền.
   *
   * ⚠️ KHÔNG ẢNH HƯỞNG ĐẾN TRÌNH ĐỌC MÀN HÌNH của hệ điều hành. VoiceOver/TalkBack là cài đặt
   *    của máy và phải luôn giữ được — bé khiếm thị không được mất nó chỉ vì phụ huynh tắt tiếng
   *    trong app. Xem quy tắc "âm thanh chỉ đọc tiếng Anh" ở đầu `src/services/SpeechCapability.ts`.
   */
  soundEnabled: boolean;
  /** Nhạc nền. Tách khỏi `soundEnabled` để tắt nhạc mà vẫn nghe được phát âm. */
  musicEnabled: boolean;
  speechRate: number;
  /** Rung khi bé trả lời đúng. Không có tác dụng trên iOS (Safari không hỗ trợ Vibration API). */
  hapticsEnabled: boolean;
  reducedMotion: ReducedMotionPreference;
  /** Kiểu giọng đọc tiếng Anh mong muốn — mặc định giọng nữ trẻ trung. */
  voicePreference: VoicePreference;

  setSoundEnabled: (enabled: boolean) => void;
  toggleSound: () => void;
  setMusicEnabled: (enabled: boolean) => void;
  toggleMusic: () => void;
  setSpeechRate: (rate: number) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setReducedMotion: (preference: ReducedMotionPreference) => void;
  setVoicePreference: (preference: VoicePreference) => void;
  resetToDefaults: () => void;
}

const DEFAULTS = {
  soundEnabled: true,
  musicEnabled: true,
  speechRate: SPEECH_RATE_DEFAULT,
  hapticsEnabled: true,
  reducedMotion: null,
  voicePreference: 'female-young',
} as const satisfies Omit<
  SettingsState,
  | 'setSoundEnabled'
  | 'toggleSound'
  | 'setMusicEnabled'
  | 'toggleMusic'
  | 'setSpeechRate'
  | 'setHapticsEnabled'
  | 'setReducedMotion'
  | 'setVoicePreference'
  | 'resetToDefaults'
>;

const VOICE_PREFERENCES: readonly VoicePreference[] = ['female-young', 'female', 'male', 'any'];

/** Chỉ nhận bốn giá trị đã biết — giá trị lạ trong máy không được lọt vào tầng chọn giọng. */
function normalizeVoicePreference(value: unknown): VoicePreference {
  return VOICE_PREFERENCES.includes(value as VoicePreference)
    ? (value as VoicePreference)
    : DEFAULTS.voicePreference;
}

/** Kẹp tốc độ đọc vào khoảng hợp lệ — giá trị hỏng trong máy không được làm app hành xử lạ. */
function clampSpeechRate(rate: unknown): number {
  if (typeof rate !== 'number' || !Number.isFinite(rate)) return SPEECH_RATE_DEFAULT;
  return Math.min(SPEECH_RATE_MAX, Math.max(SPEECH_RATE_MIN, rate));
}

type PersistedSettings = Pick<
  SettingsState,
  | 'soundEnabled'
  | 'musicEnabled'
  | 'speechRate'
  | 'hapticsEnabled'
  | 'reducedMotion'
  | 'voicePreference'
>;

/**
 * Đọc cài đặt đã lưu.
 *
 * ⭐ VÌ SAO KIỂM TỪNG TRƯỜNG THAY VÌ `JSON.parse` RỒI DÙNG LUÔN:
 *   Dữ liệu trong `localStorage` do BẢN CŨ của ứng dụng ghi ra, hoặc do người dùng sửa tay.
 *   Một trường `speechRate: "nhanh"` sẽ làm giọng đọc im lặng không rõ lý do. Kiểm từng trường
 *   rồi rơi về mặc định khiến bản cập nhật không bao giờ làm hỏng trải nghiệm của bé.
 */
function loadPersisted(): PersistedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULTS };
    const record = parsed as Record<string, unknown>;

    const reducedMotion =
      record['reducedMotion'] === true || record['reducedMotion'] === false
        ? record['reducedMotion']
        : null;

    return {
      soundEnabled:
        typeof record['soundEnabled'] === 'boolean' ? record['soundEnabled'] : DEFAULTS.soundEnabled,
      musicEnabled:
        typeof record['musicEnabled'] === 'boolean' ? record['musicEnabled'] : DEFAULTS.musicEnabled,
      speechRate: clampSpeechRate(record['speechRate']),
      hapticsEnabled:
        typeof record['hapticsEnabled'] === 'boolean'
          ? record['hapticsEnabled']
          : DEFAULTS.hapticsEnabled,
      reducedMotion,
      voicePreference: normalizeVoicePreference(record['voicePreference']),
    };
  } catch {
    // Chế độ riêng tư, JSON hỏng, hết dung lượng — tất cả đều dẫn về mặc định.
    return { ...DEFAULTS };
  }
}

function persist(state: SettingsState): void {
  try {
    const payload: PersistedSettings = {
      soundEnabled: state.soundEnabled,
      musicEnabled: state.musicEnabled,
      speechRate: state.speechRate,
      hapticsEnabled: state.hapticsEnabled,
      reducedMotion: state.reducedMotion,
      voicePreference: state.voicePreference,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* Không lưu được thì thôi — cài đặt vẫn đúng trong phiên hiện tại. */
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  /** Mọi thao tác ghi đều đi qua đây để bảo đảm luôn lưu lại — không có đường nào quên. */
  const write = (patch: Partial<PersistedSettings>) => {
    set(patch);
    // `get()` sau `set()` đã bao gồm `patch`, nên chỉ cần lưu nguyên trạng thái hiện tại.
    persist(get());
  };

  return {
    ...loadPersisted(),

    setSoundEnabled: (enabled) => write({ soundEnabled: enabled }),
    toggleSound: () => write({ soundEnabled: !get().soundEnabled }),

    setMusicEnabled: (enabled) => write({ musicEnabled: enabled }),
    toggleMusic: () => write({ musicEnabled: !get().musicEnabled }),

    setSpeechRate: (rate) => write({ speechRate: clampSpeechRate(rate) }),
    setHapticsEnabled: (enabled) => write({ hapticsEnabled: enabled }),
    setReducedMotion: (preference) => write({ reducedMotion: preference }),
    setVoicePreference: (preference) =>
      write({ voicePreference: normalizeVoicePreference(preference) }),

    resetToDefaults: () => {
      set({ ...DEFAULTS });
      persist(get());
    },
  };
});

/** Xoá cài đặt đã lưu và về mặc định. CHỈ dùng trong test. */
export function __resetSettingsForTests(): void {
  useSettingsStore.setState({ ...DEFAULTS });
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Không quan trọng trong test. */
  }
}
