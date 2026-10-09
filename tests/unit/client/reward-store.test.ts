/**
 * Test cho `rewardStore` — bản sao TRONG BỘ NHỚ của ví ⭐🌰, XP, linh vật, chuỗi ngày.
 *
 * Năm nhóm được kiểm kỹ nhất, vì cả năm đều hỏng IM LẶNG:
 *
 *   1. **Nạp lại phải XẾP HÀNG, không chạy song song.** Hàng đợi kết quả lượt chơi có thể gửi bù
 *      nhiều lượt một lúc (bé chơi offline cả buổi tối). Nếu mỗi lượt lại xin một lần nạp và các
 *      lần nạp chạy song song, một response CŨ có thể về SAU và ghi đè response MỚI ⇒ ví lùi về
 *      quá khứ. Không lỗi, không log — chỉ là số sai, và số sai về tiền.
 *
 *   2. **`awards` phải khoá theo `clientEventId`**, không phải một ô "phần thưởng gần nhất". Với
 *      một ô duy nhất, lượt gửi bù thứ hai ghi đè phần thưởng của lượt thứ nhất, và màn kết quả
 *      của lượt thứ nhất đột nhiên hiện phần thưởng của lượt khác.
 *
 *   3. **Ví KHÔNG được lưu xuống máy.** Đây là quyết định thiết kế, không phải thiếu sót: tiền là
 *      CỘNG DỒN và chỉ server được cộng. Một "cải tiến" thêm `localStorage` vào đây sẽ tạo ra
 *      nguồn sự thật thứ hai cho tiền, và không có câu trả lời an toàn cho "khi nào bản trong máy
 *      thắng bản trên server?".
 *
 *   4. **`load()` cùng một bé hai lần liền nhau chỉ tốn MỘT request.** `StrictMode` (dự án CÓ bật)
 *      gọi hiệu ứng hai lần; cổng chặn dựa vào cờ `loading`, nên nếu cờ đó không bao giờ được bật
 *      thì cổng là mã chết — đúng một lỗi đã có thật trong file này trước khi test này ra đời.
 *
 *   5. **`applyServerSnapshot` chỉ vá ĐÚNG bé đang chọn, và chỉ khi ĐÃ có ảnh chụp.** Bản vá lọt
 *      sang bé khác là hiện ví của bé này cho bé kia; một ảnh chụp dựng từ mảnh dữ liệu là mọi
 *      trường còn thiếu đọc ra `undefined`. Xem ghi chú ở khai báo trong `rewardStore`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { rewardsApi } from '@/api/endpoints.js';
import { __resetRewardStoreForTests, useRewardStore } from '@/store/rewardStore.js';
import type { GameResultAward, GameResultSubmission } from '@shared/types/progress.js';
import type { RewardSnapshot } from '@shared/types/reward.js';

/**
 * Thay cả module endpoint bằng một mock.
 *
 * `vi.mock` được vitest HOIST lên đầu file (trước cả import), nên vị trí ở đây không quan trọng —
 * nhưng vẫn đặt sau import cho eslint không phàn nàn `import/first`.
 */
vi.mock('@/api/endpoints.js', () => ({
  rewardsApi: { get: vi.fn() },
}));

const getMock = vi.mocked(rewardsApi.get);

const CHILD = 'chi_na';
const OTHER_CHILD = 'chi_em';
const NOW = '2026-10-07T08:00:00.000Z';

// =============================================================================
// Dữ liệu dựng sẵn
// =============================================================================

/**
 * Ảnh chụp ví đầy đủ.
 *
 * ⚠️ `xp: 140` là giá trị CỐ Ý: ngưỡng lên cấp 2 của bảng thật (`shared/content/xp-levels.json`)
 *    là **150 XP**. Cộng thêm 20 XP là vượt đúng ngưỡng ⇒ test kiểm được việc suy lại `level` bằng
 *    một con số thật, không phải một con số bịa.
 */
function snapshot(overrides: Partial<RewardSnapshot> = {}): RewardSnapshot {
  return {
    childId: CHILD,
    wallet: { childId: CHILD, stars: 10, acorns: 2, updatedAt: NOW },
    xp: { childId: CHILD, xp: 140, level: 1, updatedAt: NOW },
    pet: {
      childId: CHILD,
      evolutionStage: 'baby',
      petType: 'monkey',
      petChosen: true,
      wordsLearned: 0,
      happiness: 3,
      equippedItemIds: [],
      lastFedAt: null,
      updatedAt: NOW,
    },
    streak: {
      childId: CHILD,
      currentStreak: 2,
      longestStreak: 5,
      lastActiveDate: '2026-10-06',
      milestonesClaimed: [],
      updatedAt: NOW,
    },
    inventory: [],
    badges: [],
    stickers: [],
    serverTime: NOW,
    ...overrides,
  };
}

function award(overrides: Partial<GameResultAward> = {}): GameResultAward {
  return {
    score: 12,
    stars: 3,
    bestScore: 12,
    bestStars: 3,
    isNewRecord: true,
    duplicate: false,
    xpGained: 20,
    starsGained: 5,
    acornsGained: 1,
    levelUp: null,
    questsCompleted: [],
    badgesEarned: [],
    stickerEarned: null,
    ...overrides,
  };
}

function submission(clientEventId: string): GameResultSubmission {
  return {
    clientEventId,
    exerciseId: 'at-the-zoo/z1/listen-tap',
    lessonId: 'at-the-zoo/z1',
    gameType: 'listen_tap',
    totalRounds: 3,
    occurredAt: NOW,
    durationSeconds: 40,
    answers: [{ wordId: 'w.monkey', firstTry: true, wrongAttempts: 0 }],
  };
}

/** Bao lời gọi mạng cho tới khi test tự nhả — để kiểm trạng thái "đang nạp". */
function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  __resetRewardStoreForTests();
  getMock.mockReset();
  getMock.mockResolvedValue(snapshot());
  localStorage.clear();
});

afterEach(() => {
  __resetRewardStoreForTests();
  vi.restoreAllMocks();
});

// =============================================================================
// 1. Nạp
// =============================================================================

describe('rewardStore — nạp ảnh chụp', () => {
  it('nạp xong thì `childId`, `snapshot`, `hydrated` đúng', async () => {
    await useRewardStore.getState().load(CHILD);

    const state = useRewardStore.getState();
    expect(state.childId).toBe(CHILD);
    expect(state.hydrated).toBe(true);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.snapshot?.wallet.stars).toBe(10);
  });

  /**
   * ⭐ Cổng chặn `loading` từng là MÃ CHẾT (không ai bật cờ lên), nên `StrictMode` gọi hiệu ứng
   *    hai lần sinh ra HAI request cho cùng một bé. Test này khoá lại điều đó.
   */
  it('hai lần `load` cùng bé liền nhau chỉ tốn MỘT request', async () => {
    const gate = deferred<RewardSnapshot>();
    getMock.mockImplementationOnce(() => gate.promise);

    const first = useRewardStore.getState().load(CHILD);
    // Lần thứ hai chạy TRONG LÚC lần đầu đang bay — đúng như StrictMode làm.
    const second = useRewardStore.getState().load(CHILD);

    await second;
    expect(getMock).toHaveBeenCalledTimes(1);

    gate.resolve(snapshot());
    await first;
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('nạp lại cùng bé khi đã có dữ liệu thì KHÔNG gọi mạng lần nữa', async () => {
    await useRewardStore.getState().load(CHILD);
    await useRewardStore.getState().load(CHILD);

    expect(getMock).toHaveBeenCalledTimes(1);
  });

  /**
   * ⚠️ Nạp hỏng KHÔNG được ném ra ngoài: chỗ gọi là một `useEffect`, và một promise bị từ chối
   *    ở đó biến thành lỗi không ai bắt. Bé phải thấy "—", không phải một màn hình trắng.
   */
  it('nạp hỏng ⇒ ghi `error`, KHÔNG ném, `snapshot` vẫn là "chưa biết"', async () => {
    getMock.mockRejectedValueOnce(new Error('mất mạng'));

    await expect(useRewardStore.getState().load(CHILD)).resolves.toBeUndefined();

    const state = useRewardStore.getState();
    expect(state.error).toBe('mất mạng');
    expect(state.hydrated).toBe(true);
    expect(state.snapshot).toBeNull();
  });

  /**
   * ⭐ ĐỔI BÉ: dữ liệu bé CŨ phải biến mất NGAY, không đợi mạng. Trong vài trăm mili giây chờ
   *    response, bé mới sẽ thấy ví của bé cũ và tưởng đó là ví của mình.
   */
  it('đổi bé ⇒ xoá ví bé cũ NGAY, trước khi response về', async () => {
    getMock.mockResolvedValueOnce(snapshot({ wallet: { childId: CHILD, stars: 999, acorns: 9, updatedAt: NOW } }));
    await useRewardStore.getState().load(CHILD);
    expect(useRewardStore.getState().snapshot?.wallet.stars).toBe(999);

    // Bé mới: response còn treo.
    const gate = deferred<RewardSnapshot>();
    getMock.mockImplementationOnce(() => gate.promise);
    const pending = useRewardStore.getState().load(OTHER_CHILD);

    // Ngay lập tức: không còn số của bé cũ.
    const midway = useRewardStore.getState();
    expect(midway.childId).toBe(OTHER_CHILD);
    expect(midway.snapshot).toBeNull();

    gate.resolve(snapshot({ childId: OTHER_CHILD, wallet: { childId: OTHER_CHILD, stars: 3, acorns: 0, updatedAt: NOW } }));
    await pending;
    expect(useRewardStore.getState().snapshot?.wallet.stars).toBe(3);
  });

  /**
   * ⚠️ Response của bé CŨ về muộn KHÔNG được ghi vào ví của bé MỚI. Không có phép kiểm này, ví
   *    của bé này sẽ mang số của bé kia — và không có lỗi nào được ném ra.
   */
  it('response của bé cũ về muộn thì bị BỎ QUA', async () => {
    const stale = deferred<RewardSnapshot>();
    getMock.mockImplementationOnce(() => stale.promise);
    const oldLoad = useRewardStore.getState().load(CHILD);

    getMock.mockResolvedValueOnce(
      snapshot({ childId: OTHER_CHILD, wallet: { childId: OTHER_CHILD, stars: 3, acorns: 0, updatedAt: NOW } }),
    );
    await useRewardStore.getState().load(OTHER_CHILD);

    // Giờ response cũ mới về.
    stale.resolve(snapshot({ wallet: { childId: CHILD, stars: 999, acorns: 9, updatedAt: NOW } }));
    await oldLoad;

    expect(useRewardStore.getState().snapshot?.wallet.stars).toBe(3);
  });

  /**
   * ⭐ QUYẾT ĐỊNH THIẾT KẾ, KHÔNG PHẢI THIẾU SÓT: ví không bao giờ được ghi xuống máy.
   *    Xem ghi chú đầu `rewardStore.ts`.
   */
  it('KHÔNG ghi gì xuống `localStorage` — ví là chuyện của server', async () => {
    await useRewardStore.getState().load(CHILD);
    expect(localStorage.length).toBe(0);
  });
});

// =============================================================================
// 2. Ghi nhận phần thưởng
// =============================================================================

describe('rewardStore — ghi nhận phần thưởng của một lượt chơi', () => {
  beforeEach(async () => {
    await useRewardStore.getState().load(CHILD);
  });

  it('cộng delta vào ví NGAY, không đợi nạp lại', () => {
    useRewardStore.getState().applyAward(CHILD, submission('evt_1'), award());

    const wallet = useRewardStore.getState().snapshot!.wallet;
    expect(wallet.stars).toBe(15); // 10 + 5
    expect(wallet.acorns).toBe(3); // 2 + 1
  });

  /**
   * ⚠️ Cấp PHẢI được suy lại từ XP mới, không được giữ nguyên. `TopBar` hiện tên cấp, và
   *    `LevelUpOverlay` (T056) so cấp trước/cấp sau để biết có ăn mừng không.
   *    Ngưỡng thật: 140 XP = cấp 1; 140 + 20 = 160 XP ⇒ cấp 2 (ngưỡng 150).
   */
  it('XP vượt ngưỡng ⇒ suy lại CẤP ngay', () => {
    expect(useRewardStore.getState().snapshot!.xp.level).toBe(1);

    useRewardStore.getState().applyAward(CHILD, submission('evt_1'), award({ xpGained: 20 }));

    const xp = useRewardStore.getState().snapshot!.xp;
    expect(xp.xp).toBe(160);
    expect(xp.level).toBe(2);
  });

  it('lưu phần thưởng theo `clientEventId` của lượt chơi', () => {
    const a = award({ starsGained: 5 });
    useRewardStore.getState().applyAward(CHILD, submission('evt_1'), a);

    expect(useRewardStore.getState().awards['evt_1']).toBe(a);
  });

  /**
   * ⭐ HAI LƯỢT GỬI BÙ KHÔNG ĐƯỢC GHI ĐÈ NHAU. Với một ô `lastAward` duy nhất, màn kết quả của
   *    lượt thứ nhất sẽ hiện phần thưởng của lượt thứ hai.
   */
  it('hai lượt chơi khác nhau giữ được hai phần thưởng riêng', () => {
    useRewardStore.getState().applyAward(CHILD, submission('evt_1'), award({ starsGained: 5 }));
    useRewardStore.getState().applyAward(CHILD, submission('evt_2'), award({ starsGained: 7 }));

    const { awards } = useRewardStore.getState();
    expect(awards['evt_1']?.starsGained).toBe(5);
    expect(awards['evt_2']?.starsGained).toBe(7);
  });

  /**
   * ⚠️ `duplicate` = server đã ghi lượt này từ trước (client gửi lại sau khi mất phản hồi). Mọi
   *    delta khi đó bằng 0. Cộng nhầm là cộng tiền hai lần cho cùng một lượt chơi.
   */
  it('`duplicate` ⇒ KHÔNG cộng gì vào ví, nhưng vẫn lưu lại phần thưởng để màn kết quả đọc', () => {
    useRewardStore.getState().applyAward(
      CHILD,
      submission('evt_1'),
      award({ duplicate: true, starsGained: 0, acornsGained: 0, xpGained: 0, levelUp: null }),
    );

    const state = useRewardStore.getState();
    expect(state.snapshot!.wallet.stars).toBe(10);
    expect(state.snapshot!.wallet.acorns).toBe(2);
    expect(state.snapshot!.xp.xp).toBe(140);
    expect(state.awards['evt_1']?.duplicate).toBe(true);
  });

  /** Lượt chơi của bé này không bao giờ được cộng vào ví bé kia. */
  it('`childId` không khớp ⇒ bỏ qua hoàn toàn', () => {
    useRewardStore.getState().applyAward(OTHER_CHILD, submission('evt_1'), award());

    const state = useRewardStore.getState();
    expect(state.snapshot!.wallet.stars).toBe(10);
    expect(state.awards['evt_1']).toBeUndefined();
  });

  it('chưa nạp xong (chưa có ảnh chụp) ⇒ vẫn lưu phần thưởng, chưa cộng delta', () => {
    __resetRewardStoreForTests();
    useRewardStore.getState().load(CHILD); // không await: giả lập "đang nạp"

    useRewardStore.getState().applyAward(CHILD, submission('evt_1'), award());

    const state = useRewardStore.getState();
    expect(state.snapshot).toBeNull();
    expect(state.awards['evt_1']).toBeDefined();
  });
});

// =============================================================================
// 3. Nạp lại — XẾP HÀNG, không song song
// =============================================================================

describe('rewardStore — nạp lại sau khi có thưởng', () => {
  it('mỗi phần thưởng xin một lần nạp lại', async () => {
    await useRewardStore.getState().load(CHILD);
    expect(getMock).toHaveBeenCalledTimes(1);

    useRewardStore.getState().applyAward(CHILD, submission('evt_1'), award());

    await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(2));
  });

  /**
   * ⭐⭐ TEST QUAN TRỌNG NHẤT CỦA NHÓM NÀY.
   *
   *   Bé chơi offline cả buổi tối ⇒ sáng hôm sau hàng đợi gửi bù 3 lượt liên tiếp. Mỗi lượt gọi
   *   `applyAward` ⇒ mỗi lượt xin một lần nạp lại. Nếu 3 lần nạp chạy SONG SONG, thứ tự response
   *   không được bảo đảm và một response cũ về sau có thể ghi đè response mới.
   *
   *   Cách chặn: chỉ một lần nạp chạy tại một thời điểm; các yêu cầu đến trong lúc đang chạy được
   *   GỘP thành ĐÚNG MỘT lần chạy nữa. Nhờ vậy 3 lượt ⇒ 2 request (1 đang bay + 1 xếp hàng), không
   *   phải 3. Và lần nạp CUỐI luôn bắt đầu sau khi mọi delta đã được cộng, nên nó đọc được trạng
   *   thái mới nhất.
   */
  it('nhiều phần thưởng về liên tiếp ⇒ gộp thành 2 lần nạp, KHÔNG chạy song song', async () => {
    await useRewardStore.getState().load(CHILD);
    expect(getMock).toHaveBeenCalledTimes(1);

    // Lần nạp lại ĐẦU TIÊN treo lại, để 2 phần thưởng sau rơi vào đúng lúc nó đang bay.
    const gate = deferred<RewardSnapshot>();
    getMock.mockImplementationOnce(() => gate.promise);
    getMock.mockResolvedValue(snapshot());

    useRewardStore.getState().applyAward(CHILD, submission('evt_1'), award());
    useRewardStore.getState().applyAward(CHILD, submission('evt_2'), award());
    useRewardStore.getState().applyAward(CHILD, submission('evt_3'), award());

    // 1 (nạp đầu) + 1 (đang bay) = 2. Chưa có lần thứ ba nào được phát đi.
    expect(getMock).toHaveBeenCalledTimes(2);

    gate.resolve(snapshot());

    // Xong lần đang bay ⇒ chạy thêm ĐÚNG MỘT lần cho các yêu cầu đã gộp.
    await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(3));
  });
});

// =============================================================================
// 4. Vá ảnh chụp bằng dữ liệu server VỪA trả về (T063)
// =============================================================================

describe('rewardStore — applyServerSnapshot', () => {
  it('khớp bé ⇒ vá ĐÚNG trường được đưa vào, các trường khác giữ nguyên', async () => {
    await useRewardStore.getState().load(CHILD);
    const before = useRewardStore.getState().snapshot;

    useRewardStore.getState().applyServerSnapshot(CHILD, {
      wallet: { childId: CHILD, stars: 3, acorns: 0, updatedAt: NOW },
    });

    const after = useRewardStore.getState().snapshot;
    expect(after?.wallet.stars).toBe(3);
    // ⚠️ Phép trải là NÔNG có chủ ý: trường không ai gửi phải giữ nguyên THAM CHIẾU cũ, không
    //    được dựng lại thành một object rỗng — dựng lại là xoá dữ liệu bé đang thấy.
    expect(after?.pet).toBe(before?.pet);
    expect(after?.xp).toBe(before?.xp);
    expect(after?.inventory).toBe(before?.inventory);
  });

  it('⚠️ KHÁC bé ⇒ KHÔNG vá gì (ví bé này không được ghi lên bản sao bé kia)', async () => {
    await useRewardStore.getState().load(CHILD);
    const before = useRewardStore.getState().snapshot;

    useRewardStore.getState().applyServerSnapshot(OTHER_CHILD, {
      wallet: { childId: OTHER_CHILD, stars: 999, acorns: 9, updatedAt: NOW },
    });

    // Không chỉ "giá trị không đổi": cả THAM CHIẾU phải y nguyên, tức không có lần `set` nào.
    expect(useRewardStore.getState().snapshot).toBe(before);
    expect(useRewardStore.getState().snapshot?.wallet.stars).toBe(10);
  });

  it('⚠️ chưa có ảnh chụp ⇒ BỎ QUA, KHÔNG dựng ảnh chụp rỗng từ mảnh dữ liệu', () => {
    // `childId` đã là bé này (ví đã được yêu cầu nạp) nhưng `snapshot` còn `null`.
    useRewardStore.setState({ childId: CHILD, snapshot: null });

    useRewardStore.getState().applyServerSnapshot(CHILD, {
      wallet: { childId: CHILD, stars: 3, acorns: 0, updatedAt: NOW },
    });

    // Một ảnh chụp chỉ có `wallet` mà thiếu `pet`/`xp`/`inventory` sẽ làm mọi màn hình đọc những
    // trường đó nhận `undefined` — tệ hơn hẳn việc chưa có gì và để `reload()` nạp đủ.
    expect(useRewardStore.getState().snapshot).toBeNull();
  });
});

// =============================================================================
// 5. Xoá
// =============================================================================

describe('rewardStore — reset', () => {
  it('xoá sạch ví và cả bảng phần thưởng', async () => {
    await useRewardStore.getState().load(CHILD);
    useRewardStore.getState().applyAward(CHILD, submission('evt_1'), award());

    useRewardStore.getState().reset();

    const state = useRewardStore.getState();
    expect(state.childId).toBeNull();
    expect(state.snapshot).toBeNull();
    expect(state.hydrated).toBe(false);
    expect(state.awards).toEqual({});
  });
});
