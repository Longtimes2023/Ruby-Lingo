/**
 * RubyLingo — Hàm gọi từng endpoint, có kiểu.
 *
 * VÌ SAO TÁCH KHỎI `client.ts`: `client.ts` lo VẬN CHUYỂN (cookie, bóc vỏ, lỗi). File này lo
 * DANH MỤC API — mỗi endpoint một hàm với kiểu request/response lấy từ `shared/types/api.ts`.
 * Nhờ vậy khi server đổi hình dạng response, TypeScript báo lỗi ngay ở đây, chứ không phải
 * ở một component nào đó lúc chạy.
 *
 * Quy ước đặt tên: `authApi.login`, `childrenApi.create`... Không dùng chuỗi đường dẫn rải
 * rác trong component.
 */

import type {
  BuyItemRequest,
  BuyItemResponse,
  ChangePasswordRequest,
  ChildProfileDto,
  ClaimQuestResponse,
  CreateChildRequest,
  EquipItemRequest,
  EquipItemResponse,
  FeedPetRequest,
  FeedPetResponse,
  GameResultsGetResponse,
  HealthResponse,
  LoginRequest,
  ParentGateRequest,
  ParentGateResponse,
  ProgressGetResponse,
  ProgressSyncRequest,
  ProgressSyncResponse,
  QuestsGetResponse,
  ReportResponse,
  ResetPasswordRequest,
  ResetPinRequest,
  SessionResponse,
  SetPinRequest,
  SettingsDto,
  SignupRequest,
  SignupResponse,
  SubmitGameResultRequest,
  SubmitGameResultResponse,
  UpdateChildRequest,
  UpdateSettingsRequest,
} from '@shared/types/api.js';
import type { RewardSnapshot } from '@shared/types/reward.js';
import { api, type RequestOptions } from './client.js';

// =============================================================================
// Xác thực — `/api/auth/**`
// =============================================================================

export const authApi = {
  /**
   * Đăng ký. Server trả về ĐÚNG hình dạng phiên đăng nhập (kèm `children` rỗng) nên client
   * xử lý đăng ký và đăng nhập bằng chung một hàm.
   */
  signup: (body: SignupRequest): Promise<SignupResponse> => api.post('/auth/signup', body),

  login: (body: LoginRequest): Promise<SessionResponse> => api.post('/auth/login', body),

  /** Đăng xuất. Idempotent — gọi khi chưa đăng nhập vẫn thành công. */
  logout: (): Promise<{ ok: true }> => api.post('/auth/logout'),

  /**
   * Đọc phiên hiện tại. Dùng khi tải lại trang.
   *
   * Trả 401 (`UNAUTHENTICATED`) nếu chưa đăng nhập — đây là trường hợp BÌNH THƯỜNG, không
   * phải sự cố. Chỗ gọi phải bắt `ApiClientError` với mã này và coi như "chưa đăng nhập".
   */
  session: (options?: RequestOptions): Promise<SessionResponse> =>
    api.get('/auth/session', options),

  changePassword: (body: ChangePasswordRequest): Promise<{ ok: true }> =>
    api.post('/auth/password', body),

  /** Đặt lại mật khẩu bằng mã khôi phục. Server trả MÃ MỚI (mã cũ dùng một lần). */
  resetPassword: (body: ResetPasswordRequest): Promise<{ recoveryCode: string }> =>
    api.post('/auth/reset', body),
};

// =============================================================================
// Hồ sơ bé — `/api/children/**`
// =============================================================================

export const childrenApi = {
  list: (options?: RequestOptions): Promise<{ children: ChildProfileDto[] }> =>
    api.get('/children', options),

  create: (body: CreateChildRequest): Promise<{ child: ChildProfileDto }> =>
    api.post('/children', body),

  update: (childId: string, body: UpdateChildRequest): Promise<{ child: ChildProfileDto }> =>
    api.patch(`/children/${encodeURIComponent(childId)}`, body),

  /**
   * Xoá hồ sơ bé. Xoá là XOÁ THẬT — tiến độ, ví, túi đồ của bé bị dọn theo ở server.
   *
   * `encodeURIComponent` không thừa dù id do server sinh: nếu một ngày id đến từ nguồn khác,
   * một dấu `/` trong đó sẽ biến đường dẫn thành endpoint khác hẳn.
   */
  remove: (childId: string): Promise<{ ok: true }> =>
    api.del(`/children/${encodeURIComponent(childId)}`),
};

// =============================================================================
// Tiến độ học — `/api/children/:id/progress**`
// =============================================================================

export const progressApi = {
  /**
   * Đọc ảnh chụp tiến độ. Dùng khi mở app trên thiết bị mới, hoặc sau khi cài lại.
   *
   * `since` (ISO UTC) chỉ là gợi ý LỌC BỚT cho server; server vẫn có thể trả về nhiều hơn.
   * Xem `resolveFloor` ở `server/services/ProgressService.ts` để hiểu vì sao không bao giờ
   * được lọc cứng theo giá trị này.
   */
  get: (childId: string, since?: string | null, options?: RequestOptions): Promise<ProgressGetResponse> => {
    const path = `/children/${encodeURIComponent(childId)}/progress`;
    const query = since ? `?since=${encodeURIComponent(since)}` : '';
    return api.get(`${path}${query}`, options);
  },

  /**
   * Gửi sự kiện lên và nhận ảnh chụp đã gộp.
   *
   * ⚠️ KHÔNG có hàm "đẩy ảnh chụp lên" — đây là quyết định thiết kế, không phải thiếu sót.
   *    Xem ghi chú ở cuối `shared/schemas/progress.ts`.
   */
  sync: (childId: string, body: ProgressSyncRequest): Promise<ProgressSyncResponse> =>
    api.post(`/children/${encodeURIComponent(childId)}/progress/sync`, body),

  /**
   * Gửi một LƯỢT CHƠI GAME đã kết thúc và nhận phần thưởng server chấm.
   *
   * ⚠️ Đây KHÔNG phải một sự kiện tiến độ, nên không đi qua `sync`. Một lượt chơi chỉ chấm
   *    được khi có ĐỦ các câu của nó (điểm phụ thuộc chuỗi đúng liên tiếp và tỉ lệ đúng ngay
   *    lần đầu), nên nó phải là request riêng mang theo cả lượt. Xem `GameResultService.ts`
   *    ở phía server.
   *
   * ⚠️ LŨY ĐẲNG theo `clientEventId`: gửi lại cùng payload KHÔNG cộng thưởng hai lần. Client
   *    vì thế cứ gửi lại thoải mái khi mất mạng — và phải gửi lại ĐÚNG payload cũ, không dựng
   *    payload mới, nếu không thì cổng chống trùng vô hiệu.
   */
  submitGameResult: (
    childId: string,
    body: SubmitGameResultRequest,
  ): Promise<SubmitGameResultResponse> =>
    api.post(`/children/${encodeURIComponent(childId)}/game-result`, body),

  /**
   * Đọc danh sách kết quả game ĐÃ CHƠI của một bé, gộp theo bài tập (T05).
   *
   * ⭐ KÊNH ĐỌC RIÊNG, KHÔNG PHẢI KÊNH GHI: client chỉ ĐỌC để tô chip trò chơi ở màn chủ đề.
   *   Nó KHÔNG bao giờ gửi ngược lên — vì thế nó không nằm trong ảnh chụp tiến độ
   *   (`progressSnapshotSchema` là kênh GHI hai chiều; nhét vào đó là phá "server là trọng tài").
   *
   * ⚠️ Route chỉ cần `requireParent` (KHÔNG cổng PIN): đây là màn hình CỦA BÉ, cùng nhóm với
   *    `/progress` và `/rewards`. Cổng PIN dành cho báo cáo phụ huynh (`/report`).
   */
  getGameResults: (childId: string, options?: RequestOptions): Promise<GameResultsGetResponse> =>
    api.get(`/children/${encodeURIComponent(childId)}/game-results`, options),
};

// =============================================================================
// Thưởng, cửa hàng & thú cưng — `/api/children/:id/{rewards,shop,pet,inventory}`
// =============================================================================
//
// ⚠️ BỐN ĐƯỜNG DẪN KHÁC NHAU NHƯNG **MỘT NHÓM**, VÀ ĐÓ LÀ CHỦ Ý.
//    Ở phía server, cả bốn endpoint nằm trong đúng một tệp (`server/routes/rewards.ts`) và gọi
//    đúng một service (`rewardService`) — vì cả bốn đọc/ghi trên cùng một tập bảng: `wallet`,
//    `inventory`, `pet_state`. Tách chúng thành `shopApi`/`petApi`/`inventoryApi` ở client sẽ
//    dựng lên một ranh giới mà server không hề có, và ranh giới sai chỗ là thứ khiến người sửa
//    sau này đi tìm "service nào giữ tiền" ở hai nơi. Xem ghi chú đầu `server/routes/rewards.ts`
//    về việc kế hoạch từng ghi `routes/shop.ts` + `ShopService.ts` và vì sao KHÔNG làm vậy.

export const rewardsApi = {
  /**
   * Đọc ảnh chụp ví ⭐🌰, XP, thú cưng, chuỗi ngày, túi đồ, huy hiệu.
   *
   * ⚠️ CHỈ CÓ `GET`. Không có hàm nào ở đây đẩy số dư ví lên server — và đó là quyết định
   *    thiết kế, không phải thiếu sót. Ví là CỘNG DỒN: cho client gửi số dư lên là cho nó tự
   *    tuyên bố "tôi có 9.999 ⭐", và vì không có cách nào phân biệt với số dư thật, con số đó
   *    ở lại vĩnh viễn. Tiền chỉ vào ví qua thưởng do server chấm (`game-result`), và chỉ ra
   *    qua `/shop/buy`. Xem ghi chú đầu `server/routes/rewards.ts`.
   *
   * ⚠️ Route này yêu cầu phiên phụ huynh (`requireParent`), nhưng app của bé CHẠY TRONG đúng
   *    phiên đó — mỗi tài khoản chỉ có MỘT phiên, không có phiên riêng cho bé. Nên gọi được.
   *    Quyền với bé cụ thể do server kiểm qua `parent_id` (xem `RewardService.requireChild`).
   */
  get: (childId: string, options?: RequestOptions): Promise<RewardSnapshot> =>
    api.get(`/children/${encodeURIComponent(childId)}/rewards`, options),

  /**
   * Mua một vật phẩm. Body CHỈ có `{ itemId }`.
   *
   * ⚠️ KHÔNG CÓ `price` TRONG BODY — và đó là quyết định thiết kế, không phải thiếu sót. Server
   *    tra giá trong `shared/content/shop-items.json`. Một trường `price` do client gửi sẽ bị
   *    `buyItemRequestSchema` cắt bỏ hoàn toàn, và test khoá đúng điều đó lại.
   *
   * ⚠️ Lỗi 409 `INSUFFICIENT_FUNDS` là kết quả **BÌNH THƯỜNG**, không phải sự cố. Hàm này VẪN
   *    ném nó ra (nó là lỗi HTTP thật) — việc dịch nó thành "chưa đủ tiền" thuộc về
   *    `ShopService.buyItem`, nơi có ngữ cảnh để quyết định.
   */
  buy: (childId: string, body: BuyItemRequest): Promise<BuyItemResponse> =>
    api.post(`/children/${encodeURIComponent(childId)}/shop/buy`, body),

  /**
   * Cho thú cưng ăn một món ĐÃ SỞ HỮU. Body CHỈ có `{ itemId }`.
   *
   * ⚠️ Không có nhánh lỗi "đã no": server trả **200 kèm trạng thái hiện có** khi ❤️ đã chạm trần
   *    5 (xem `RewardService.feed`). Đã no là một tình trạng bình thường của thế giới, không phải
   *    một mã lỗi.
   */
  feed: (childId: string, body: FeedPetRequest): Promise<FeedPetResponse> =>
    api.post(`/children/${encodeURIComponent(childId)}/pet/feed`, body),

  /**
   * Mặc / bỏ ra một vật phẩm đã sở hữu.
   *
   * ⚠️ `:itemId` NẰM TRÊN ĐƯỜNG DẪN, `equipped` nằm trong body — hai nguồn cho hai sự thật khác
   *    nhau, nên không có chỗ nào để chúng lệch. Xem `shared/schemas/reward.ts`.
   *
   * `encodeURIComponent` cho `itemId` không thừa dù id là slug do ta viết tay: một dấu `/` lọt
   * vào đó sẽ biến đường dẫn thành một endpoint khác hẳn (`…/inventory/a/equip/b`), và server sẽ
   * trả 404 cho một món có thật.
   */
  equip: (childId: string, itemId: string, body: EquipItemRequest): Promise<EquipItemResponse> =>
    api.post(
      `/children/${encodeURIComponent(childId)}/inventory/${encodeURIComponent(itemId)}/equip`,
      body,
    ),
};

// =============================================================================
// Nhiệm vụ — `/api/children/:id/quests**`
// =============================================================================

export const questsApi = {
  /**
   * Danh sách nhiệm vụ kèm tiến độ, chuỗi ngày, và khoá kỳ hiện tại.
   *
   * ⚠️ Đây là thao tác CHỈ-ĐỌC ở phía server (`GET` không ghi gì vào DB). Client gọi lại thoải
   *    mái mỗi lần quay về màn hình Nhiệm vụ — xem ghi chú đầu `server/routes/quests.ts`.
   */
  get: (childId: string, options?: RequestOptions): Promise<QuestsGetResponse> =>
    api.get(`/children/${encodeURIComponent(childId)}/quests`, options),

  /**
   * Bé bấm "Nhận thưởng" một nhiệm vụ.
   *
   * ⚠️ KHÔNG CÓ BODY — và đó là quyết định thiết kế, không phải thiếu sót. Client chỉ được phép
   *    nói *"bé muốn nhận nhiệm vụ này"*; tiến độ đã xong hay chưa và số quà là bao nhiêu đều do
   *    server tự tính. Xem ghi chú đầu `server/routes/quests.ts` để hiểu vì sao.
   *
   * ⚠️ Lỗi 409 `ALREADY_CLAIMED` là kết quả **BÌNH THƯỜNG**, không phải sự cố: bé 7 tuổi bấm
   *    nút hai lần. Hàm này VẪN ném lỗi đó ra (nó là lỗi HTTP thật) — việc dịch nó thành "đã
   *    nhận rồi" thuộc về `QuestService` phía client, nơi có ngữ cảnh để quyết định.
   */
  claim: (
    childId: string,
    questId: string,
    options?: RequestOptions,
  ): Promise<ClaimQuestResponse> =>
    api.post(
      `/children/${encodeURIComponent(childId)}/quests/${encodeURIComponent(questId)}/claim`,
      undefined,
      options,
    ),
};

// =============================================================================
// Khu vực phụ huynh — `/api/parent/**` (T072)
// =============================================================================
//
// ⚠️ Cổng PIN KHÔNG thay lớp đăng nhập: cả ba endpoint đều cần phiên phụ huynh (`requireParent`).
//    Cổng là lớp THỨ HAI, chỉ chắn khu vực phụ huynh. Ranh giới bảo mật thật là phiên — xem chú
//    thích `pin_hash` ở `server/db/migrations/001_account.sql`.

export const parentApi = {
  /**
   * Cổng PIN của PHIÊN hiện tại đang mở hay đóng. Dùng khi mở `/parent` (kể cả tải lại trang).
   *
   * ⚠️ KHÔNG đọc ra "tài khoản có PIN hay chưa" — cố ý (rò rỉ thông tin). Xem `ParentGateResponse`.
   */
  gateStatus: (options?: RequestOptions): Promise<ParentGateResponse> =>
    api.get('/parent/gate', options),

  /**
   * Nhập PIN để mở cổng.
   *
   * ⚠️ Lỗi 403 `INVALID_PIN` là kết quả **BÌNH THƯỜNG** (gõ nhầm), không phải sự cố — hàm này
   *    VẪN ném nó ra (đó là lỗi HTTP thật); việc dịch thành câu mời thử lại thuộc về trang.
   */
  openGate: (body: ParentGateRequest): Promise<ParentGateResponse> =>
    api.post('/parent/gate', body),

  /**
   * Đặt / đổi mã PIN. Server yêu cầu cổng đang mở ⇒ 403 `PARENT_GATE_REQUIRED` nếu chưa qua cổng.
   */
  setPin: (body: SetPinRequest): Promise<{ ok: true }> => api.patch('/parent/pin', body),

  /**
   * ĐẶT LẠI mã PIN khi phụ huynh QUÊN (T072.1) — đường LÙI duy nhất.
   *
   * ⚠️ VÌ SAO CẦN MẬT KHẨU Ở ĐÂY: cổng PIN chắn cả việc đổi PIN, nên nếu không có đường lùi khác
   *    thì quên PIN là **kẹt vĩnh viễn**. Mật khẩu tài khoản phụ huynh là ranh giới bảo mật THẬT;
   *    PIN chỉ là rào UX (xem `shared/constants.ts`). Vẫn cần phiên đăng nhập.
   *
   * ⚠️ Lỗi 403 `INVALID_CREDENTIALS` = sai mật khẩu, là kết quả **BÌNH THƯỜNG** (gõ nhầm). Dùng
   *    CHUNG mã với đăng nhập để chỉ có MỘT mã cho "sai mật khẩu" — không phát minh mã mới.
   *
   * ⚠️ Thành công KHÔNG mở cổng: `{ ok: true }` chứ không trả `ParentGateResponse`. Đặt lại PIN
   *    là chuyện của PHIÊN KHÁC (bố mẹ vừa chứng minh bằng mật khẩu), không phải một cú mở cổng.
   */
  resetPin: (body: ResetPinRequest): Promise<{ ok: true }> =>
    api.post('/parent/pin/reset', body),
};

// =============================================================================
// Báo cáo học tập — `/api/children/:id/report` (T073)
// =============================================================================

export const reportApi = {
  /**
   * Báo cáo học tập của MỘT bé trong một khoảng thời gian.
   *
   * ⭐ MỌI CON SỐ LẤY NGUYÊN TỪ SERVER — client KHÔNG tự cộng `dailyStats`, không tự đếm từ, không
   *   tự suy `wordsMastered`. Server là trọng tài; tự tính ở client là nguồn sự thật thứ hai, và
   *   nó sẽ lệch đúng lúc bé vừa học xong mà chưa đồng bộ. Cùng nguyên tắc như `rewardsApi.get`.
   *
   * ⚠️ `range` là TUỲ CHỌN: không truyền ⇒ server tự chọn kỳ mặc định (tuần hiện tại). Client cố ý
   *    KHÔNG tự tính mốc tuần — "tuần bắt đầu thứ Hai hay Chủ nhật, theo múi giờ nào" là câu hỏi
   *    mà chỉ server trả lời đúng được cho MỌI thiết bị của gia đình.
   *
   * ⚠️ Lỗi 403 `PARENT_GATE_REQUIRED` nghĩa là cổng PIN đã đóng (hết hạn 10 phút) — người gọi phải
   *    quay về màn nhập PIN, KHÔNG hiển thị như một lỗi kỹ thuật.
   */
  get: (
    childId: string,
    range?: { from: string; to: string },
    options?: RequestOptions,
  ): Promise<ReportResponse> => {
    const path = `/children/${encodeURIComponent(childId)}/report`;
    const query = range
      ? `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
      : '';
    return api.get(`${path}${query}`, options);
  },
};

// =============================================================================
// Cài đặt của bé — `/api/children/:id/settings` (T074)
// =============================================================================

export const settingsApi = {
  /**
   * Đọc cài đặt của MỘT bé (âm thanh / nhạc / tốc độ đọc / giảm chuyển động).
   *
   * ⚠️ Cài đặt này CÓ trên server (khác `settingsStore` trong máy): server lưu để bố mẹ đặt một
   *    lần rồi áp cho mọi thiết bị, còn `settingsStore` là bản trong máy cho tình huống offline.
   *    Màn Cài đặt đọc server rồi áp xuống store — xem `ParentSettingsPage`.
   */
  get: (childId: string, options?: RequestOptions): Promise<SettingsDto> =>
    api.get(`/children/${encodeURIComponent(childId)}/settings`, options),

  /**
   * Ghi cài đặt — **chỉ gửi TRƯỜNG VỪA ĐỔI** (`UpdateSettingsRequest` toàn bộ là tuỳ chọn).
   *
   * ⚠️ Gửi trọn cả 4 trường là mở đường cho "hai tab cùng ghi đè nhau": tab A vừa bật nhạc, tab B
   *    còn giữ giá trị cũ, B gửi cả cụm ⇒ nhạc của A bị tắt lại mà không ai hiểu vì sao. Gửi đúng
   *    trường vừa đổi thì mỗi lần ghi chỉ chạm đúng một sự thật.
   *
   * ⚠️ `false` LÀ GIÁ TRỊ HỢP LỆ: chỗ gọi phải dùng `??` chứ KHÔNG `||` khi ghép giá trị mặc định
   *    (dùng `||` thì `false` bị coi như "không có" và bị thay bằng `true`).
   */
  update: (childId: string, body: UpdateSettingsRequest): Promise<SettingsDto> =>
    api.patch(`/children/${encodeURIComponent(childId)}/settings`, body),
};

// =============================================================================
// Hệ thống
// =============================================================================

export const systemApi = {
  health: (options?: RequestOptions): Promise<HealthResponse> => api.get('/health', options),
};
