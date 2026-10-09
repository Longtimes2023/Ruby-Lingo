/**
 * RubyLingo — DTO cho REST API (dùng CHUNG client + server).
 *
 * Vì client và server cùng một định nghĩa kiểu, schema không bao giờ lệch.
 * Mọi response thành công bọc trong `ApiOk`; mọi lỗi bọc trong `ApiError`.
 */

import type {
  DailyStat,
  GameResultAward,
  GameResultSubmission,
  GameResultsResponse,
  LessonProgress,
  ProgressEvent,
  ProgressSnapshot,
  ThemeProgress,
  WordProgress,
} from './progress.js';
import type {
  EquipmentResult,
  FeedResult,
  PurchaseResult,
  QuestWithProgress,
  RewardSnapshot,
  ShopItem,
  StreakState,
  Wallet,
  XpState,
} from './reward.js';
import type { LevelBundle } from './content.js';

// =============================================================================
// Mã lỗi — dùng chung, UI dịch sang câu tiếng Việt thân thiện
// =============================================================================

export const API_ERROR_CODES = [
  // 400
  'VALIDATION_FAILED',
  'INVALID_CREDENTIALS',
  'WEAK_PASSWORD',
  'EMAIL_TAKEN',
  // 401 / 403
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'INVALID_PIN',
  'PARENT_GATE_REQUIRED',
  // 404
  'NOT_FOUND',
  'CHILD_NOT_FOUND',
  'ITEM_NOT_FOUND',
  'QUEST_NOT_FOUND',
  'EXERCISE_NOT_FOUND',
  // 409 / 422
  'INSUFFICIENT_FUNDS',
  'QUEST_NOT_COMPLETE',
  'ALREADY_CLAIMED',
  'NOT_ENOUGH_HAPPINESS',
  // 429
  'RATE_LIMITED',
  // 500
  'INTERNAL_ERROR',
  'DB_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Lỗi trả về từ server. `message` là tiếng Việt hiển thị được cho phụ huynh. */
export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Chi tiết theo từng trường khi code = VALIDATION_FAILED. */
    fields?: Record<string, string>;
  };
}

/** Bọc mọi response thành công. */
export interface ApiOk<T> {
  data: T;
}

export type ApiResult<T> = ApiOk<T> | ApiError;

/** Type guard: phân biệt thành công / lỗi. */
export function isApiError<T>(res: ApiResult<T>): res is ApiError {
  return typeof res === 'object' && res !== null && 'error' in res;
}

// =============================================================================
// Auth
// =============================================================================

export interface SignupRequest {
  email: string;
  password: string;
  /** Tên hiển thị của phụ huynh (không bắt buộc). */
  displayName?: string;
  /**
   * Bắt buộc = true — tuân thủ COPPA/GDPR-K.
   * Phụ huynh xác nhận đã đọc và đồng ý chính sách quyền riêng tư trẻ em.
   *
   * Kiểu là `boolean` (không phải `true`) vì giá trị đến từ một ô tick trong form. Ràng buộc
   * "phải là true" do `signupSchema` ép ở runtime — gửi `false` hoặc thiếu trường đều bị từ chối.
   */
  parentalConsent: boolean;
}

/**
 * Response của đăng ký = ĐÚNG hình dạng của phiên đăng nhập, cộng thêm `recoveryCode`.
 *
 * Vì sao kế thừa `SessionResponse` thay vì khai riêng `{ parent, recoveryCode }`: sau khi
 * đăng ký, client cần đúng thứ mà lúc tải lại trang nó cũng cần — phụ huynh + danh sách bé.
 * Trả cùng hình dạng ⇒ client dùng CHUNG một hàm xử lý cho cả ba đường (đăng ký, đăng nhập,
 * tải lại trang). Nếu khai thiếu `children` ở đây thì client buộc phải phân nhánh riêng cho
 * đăng ký — và nhánh riêng luôn là nhánh bị bỏ quên khi code thay đổi.
 */
export interface SignupResponse extends SessionResponse {
  /** Mã khôi phục — CHỈ hiện một lần duy nhất, phụ huynh phải lưu lại. */
  recoveryCode: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ParentAccountDto {
  id: string;
  email: string;
  displayName: string | null;
  /** Phiên bản chính sách quyền riêng tư phụ huynh đã đồng ý. */
  consentPolicyVersion: string;
  consentedAt: string;
  createdAt: string;
}

export interface SessionResponse {
  parent: ParentAccountDto;
  children: ChildProfileDto[];
}

export interface ResetPasswordRequest {
  email: string;
  recoveryCode: string;
  newPassword: string;
}

/** Đổi mật khẩu khi đã đăng nhập. */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// =============================================================================
// Hồ sơ bé
// =============================================================================

export interface ChildProfileDto {
  id: string;
  nickname: string;
  age: number;
  /** id avatar chọn sẵn từ bộ 8 avatar dựng sẵn. KHÔNG lưu ảnh thật của bé. */
  avatarId: string;
  createdAt: string;
}

export interface CreateChildRequest {
  nickname: string;
  age: number;
  avatarId: string;
}

export interface UpdateChildRequest {
  nickname?: string;
  age?: number;
  avatarId?: string;
}

// =============================================================================
// Nội dung
// =============================================================================

export interface ContentResponse {
  /** Nội dung level đã lập chỉ mục — dựng index ở cấp LEVEL, không chỉ trong theme. */
  level: LevelBundle;
}

// =============================================================================
// Tiến độ
// =============================================================================

export interface ProgressSyncRequest {
  events: ProgressEvent[];
  /** Lần đồng bộ thành công gần nhất — server chỉ trả về bản ghi mới hơn. */
  since: string | null;
}

export interface ProgressSyncResponse {
  snapshot: ProgressSnapshot;
  /** Số event đã áp dụng; các event trùng `clientEventId` bị bỏ qua. */
  applied: number;
  skipped: number;
}

export type ProgressGetResponse = ProgressSnapshot;

/** Ghi tiến độ học flashcard (không qua game). */
export interface RecordWordAnswerRequest {
  wordId: string;
  correct: boolean;
  source: 'flashcard' | 'game';
}

export interface MarkWordLearnedRequest {
  wordId: string;
}

// =============================================================================
// Game & thưởng
// =============================================================================

export type SubmitGameResultRequest = GameResultSubmission;
export type SubmitGameResultResponse = GameResultAward;

/**
 * `GET /api/children/:id/game-results` (T05) — kết quả game ĐÃ CHƠI của một bé, gộp theo bài tập.
 *
 * ⭐ KÊNH ĐỌC RIÊNG, KHÔNG PHẢI KÊNH GHI: client chỉ ĐỌC để tô chip trò chơi ở màn chủ đề. Nó
 *   KHÔNG bao giờ gửi ngược lên (đó là lý do nó không nằm trong `ProgressSnapshot`).
 */
export type GameResultsGetResponse = GameResultsResponse;

export type RewardsGetResponse = RewardSnapshot;

export interface BuyItemRequest {
  itemId: string;
}

export type BuyItemResponse = PurchaseResult;

/**
 * `POST /api/children/:id/inventory/:itemId/equip` — mặc / bỏ ra một vật phẩm đã sở hữu.
 *
 * ⚠️⚠️ BẢN ĐẦU TIÊN CỦA KIỂU NÀY (T008) CÓ THÊM `itemId`, VÀ ĐÓ LÀ MỘT LỖI THIẾT KẾ.
 *   `:itemId` ĐÃ nằm trên đường dẫn. Giữ nó ở đây là hai nguồn nói cùng một sự thật — chúng chỉ
 *   cần lệch nhau một lần là mặc nhầm món. `equipItemRequestSchema` từ chối nhận nó (Zod cắt
 *   khoá lạ), và `reward-routes.test.ts` có test gửi kèm `itemId` sai để chứng minh đường dẫn
 *   luôn thắng. Xem ghi chú đầy đủ ở `shared/schemas/reward.ts`.
 */
export interface EquipItemRequest {
  equipped: boolean;
}

export type EquipItemResponse = EquipmentResult;

export interface FeedPetRequest {
  itemId: string;
}

export type FeedPetResponse = FeedResult;

export interface PetDto {
  pet: RewardSnapshot['pet'];
  wallet: Wallet;
  xp: XpState;
}

// =============================================================================
// Nhiệm vụ
// =============================================================================

export interface QuestsGetResponse {
  quests: QuestWithProgress[];
  streak: StreakState;
  /** Khoá kỳ hiện tại để client hiển thị "còn bao lâu thì reset". */
  periodKeys: { daily: string; weekly: string };
}

export interface ClaimQuestResponse {
  quest: QuestWithProgress;
  wallet: Wallet;
  xp: XpState;
  /**
   * Có lên cấp không — nếu có, client hiện overlay ăn mừng (`LevelUpOverlay`).
   *
   * ⚠️ VÌ SAO PHẢI CÓ MẶT Ở ĐÂY, KHÔNG CHỈ Ở `GameResultAward`:
   *   Quà của một nhiệm vụ có thể là XP (`quests.json` → `qd-01` thưởng 20 XP). Cộng XP có thể
   *   đẩy bé qua một cấp, mà mỗi cấp có quà riêng. Nếu phản hồi này không mang `levelUp` thì quà
   *   của cấp mới VẪN được trao (đúng) nhưng bé KHÔNG BAO GIỜ thấy màn ăn mừng (sai) — và không
   *   ai phát hiện, vì số dư ví vẫn tăng như mong đợi.
   *
   * `null` khi lượt nhận này không vượt cấp nào. Cùng hình dạng với `GameResultAward.levelUp`
   * (nhảy nhiều cấp một lúc là bình thường, và `rewards` liệt kê quà của MỌI cấp đã vượt).
   */
  levelUp: GameResultAward['levelUp'];
  /**
   * Huy hiệu MỚI THỰC SỰ được trao ở lượt nhận này (`quests.json` → `qw-01`, `qm-02`…).
   *
   * ⚠️ Là PHẦN CHÊNH, khác `quest.rewards` (định nghĩa thô, có thể chứa huy hiệu bé đã có từ
   *    đường khác). UI dùng danh sách NÀY để bật thông báo "huy hiệu mới"; dùng `quest.rewards`
   *    để vẽ các chip quà. Lẫn hai thứ là ăn mừng hai lần cho cùng một huy hiệu.
   */
  badgesEarned: string[];
  /**
   * Sticker MỚI THỰC SỰ được mở ở lượt nhận này (T069.1).
   *
   * ⭐ VÌ SAO PHẢI TRẢ VỀ: từ khi 3 sticker MVP được gắn vào quà nhiệm vụ mốc (`quests.json`),
   *   bé có thể MỞ ĐƯỢC một sticker khi bấm "Nhận thưởng". Mà cả ý nghĩa của sticker là "phần
   *   thưởng BIẾN THIÊN: bé mở ra mới biết là con gì" — trao âm thầm (chỉ vào sổ, không báo) phá
   *   đúng cái thú vị đó. Trường này là tín hiệu để client bật màn "Bé mở được sticker mới!".
   *
   * ⚠️ CHỈ ID MỚI (giống `badgesEarned`): nhận lại một nhiệm vụ (409) không báo lại; một sticker
   *    bé đã có từ đường khác cũng không tính là "vừa mở".
   */
  stickerIds: string[];
}

// =============================================================================
// Cửa hàng
// =============================================================================

export interface ShopListResponse {
  items: ShopItem[];
  wallet: Wallet;
  /** id vật phẩm bé đã sở hữu. */
  ownedItemIds: string[];
}

// =============================================================================
// Phụ huynh
// =============================================================================

export interface ParentGateRequest {
  pin: string;
}

/**
 * Trạng thái CỔNG PIN PHỤ HUYNH của PHIÊN hiện tại (T072) — dùng cho CẢ `GET` (đọc trạng thái)
 * lẫn `POST` (vừa nhập PIN xong).
 *
 * ⭐ VÌ SAO CHỈ MỘT HÌNH DẠNG CHO CẢ HAI ĐƯỜNG: sau khi nhập PIN, điều client cần biết cũng đúng
 *   bằng điều nó cần biết khi mở lại trang — "cổng có đang mở không, tới lúc nào". Một hình dạng
 *   ⇒ một hàm xử lý ở client, không phải hai nhánh dễ lệch nhau.
 *
 * ⚠️⚠️ HÌNH DẠNG NÀY ĐƯỢC THIẾT KẾ ĐỂ **KHÔNG TIẾT LỘ TÀI KHOẢN CÓ PIN HAY KHÔNG**:
 *   `parent_account.pin_hash` là nullable (có tài khoản chưa đặt PIN). Nếu phản hồi này nói ra
 *   điều đó (bằng câu chữ, bằng cờ, hay bằng `expiresAt` khác nhau) thì người đang dò biết ngay
 *   tài khoản nào chưa được bảo vệ. Nên `opened`/`expiresAt` CHỈ phản ánh trạng thái CỦA PHIÊN,
 *   hoàn toàn không phụ thuộc việc có PIN hay không — xem `ParentService.describeGate`.
 *
 * ⚠️ KHÔNG có `gateToken`: phiên đăng nhập ĐÃ là định danh (cookie), và trạng thái cổng nằm ngay
 *   trên hàng `session` (`gate_opened_at`, migration 010). Một token cổng riêng chỉ thêm một bí
 *   mật phải bảo vệ mà không tăng bảo mật — bản thiết kế đầu (T008) có ghi `gateToken` nhưng
 *   CHƯA từng có route nào dùng nó.
 */
export interface ParentGateResponse {
  /** Cổng đang mở cho PHIÊN này chưa (đã nhập PIN và còn trong hạn). */
  opened: boolean;
  /** Lúc cổng tự đóng (ISO UTC), hoặc `null` khi cổng đang đóng. */
  expiresAt: string | null;
}

export interface SetPinRequest {
  pin: string;
}

/**
 * `POST /api/parent/pin/reset` (T072.1) — ĐẶT LẠI mã PIN khi phụ huynh QUÊN.
 *
 * ⚠️ Kèm MẬT KHẨU tài khoản vì cổng PIN chắn cả việc đổi PIN ⇒ quên PIN sẽ kẹt vĩnh viễn nếu
 *    không có đường lùi. Mật khẩu là ranh giới thật; PIN chỉ là rào UX.
 */
export interface ResetPinRequest {
  password: string;
  pin: string;
}

export interface WordAccuracyDto {
  wordId: string;
  en: string;
  vi: string;
  correctCount: number;
  wrongCount: number;
  accuracy: number;
}

export interface ReportResponse {
  child: ChildProfileDto;
  /** Câu tóm tắt tiếng Việt cho phụ huynh đọc, không cần giải thích thêm. */
  summary_vi: string;
  range: { from: string; to: string };
  dailyStats: DailyStat[];
  wordsLearned: number;
  wordsMastered: number;
  lessonsCompleted: number;
  starsEarned: number;
  /** Từ bé hay sai nhất — gợi ý phụ huynh ôn cùng con. */
  strugglingWords: WordAccuracyDto[];
  /** Từ bé đã nhớ chắc. */
  masteredWords: WordAccuracyDto[];
}

export interface SettingsDto {
  soundEnabled: boolean;
  musicEnabled: boolean;
  speechRate: number;
  reducedMotion: boolean;
}

export interface UpdateSettingsRequest {
  soundEnabled?: boolean;
  musicEnabled?: boolean;
  speechRate?: number;
  reducedMotion?: boolean;
}

/** Xoá tài khoản + toàn bộ dữ liệu (GDPR right to erasure). Xoá là xoá THẬT. */
export interface DeleteAccountRequest {
  password: string;
  confirmPhrase: string;
}

// =============================================================================
// Health
// =============================================================================

export interface HealthResponse {
  status: 'ok';
  version: string;
  uptimeSeconds: number;
  /** Số migration đã áp dụng — giúp phát hiện VPS chưa chạy `npm run migrate`. */
  migrationsApplied: number;
}

// =============================================================================
// Re-export cho tiện dùng ở client
// =============================================================================

export type {
  DailyStat,
  GameResultAward,
  GameResultSubmission,
  LessonProgress,
  ProgressSnapshot,
  ThemeProgress,
  WordProgress,
};
