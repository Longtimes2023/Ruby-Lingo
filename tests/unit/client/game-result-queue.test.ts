// @vitest-environment node

/**
 * Test cho `GameResultService` (phía client) — dựng payload và hàng đợi ngoại tuyến.
 *
 * ⭐ VÌ SAO PHẢI TEST TẦNG NÀY, KHÔNG CHỈ TIN VÀO SERVER:
 *   Server đã có cổng chống ghi trùng theo `clientEventId` và bộ test riêng cho nó. Nhưng cổng
 *   đó CHỈ hoạt động nếu client gửi lại **đúng payload cũ**. Nếu hàng đợi này sinh một
 *   `clientEventId` mới ở mỗi lần thử, cổng phía server trở nên vô dụng — và vì `daily_stats`
 *   là CỘNG DỒN, số liệu của bé sẽ phồng lên mỗi lần thử lại, vĩnh viễn và không cách nào phát
 *   hiện. Đó chính là test quan trọng nhất trong file (nhóm "thử lại").
 *
 * ⭐ PHỤ THUỘC ĐƯỢC TIÊM VÀO (`GameResultQueueDeps`) nên mọi nhánh dưới đây chạy trong vài
 *   mili giây: không mạng, không `localStorage`, không React, không đồng hồ thật.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GAME_RESULT_QUEUE_VERSION,
  GameResultQueue,
  MAX_PENDING_GAME_RESULTS,
  buildGameResultSubmission,
  loadGameResultQueue,
  saveGameResultQueue,
  type GameResultQueueDeps,
  type GameRunContext,
  type QueuedGameResult,
} from '../../../src/services/GameResultService.js';
import type { GameResultAward, GameResultSubmission } from '../../../shared/types/progress.js';

/**
 * Chữ ký của `send`.
 *
 * ⚠️ Khai báo kiểu tường minh qua `vi.fn<SendFn>()`: nếu để `vi.fn(async () => AWARD)` suy kiểu
 *    từ phần thân, mock không có tham số ⇒ `send.mock.calls[i]` là mảng RỖNG, và mọi khẳng định
 *    trên payload đã gửi (`calls[i][1]`) hoặc không biên dịch được, hoặc tệ hơn là so sánh nhầm.
 */
type SendFn = (childId: string, body: GameResultSubmission) => Promise<GameResultAward>;

// =============================================================================
// Dữ liệu dựng sẵn
// =============================================================================

/** Một lượt chơi 3 câu, đúng hết. */
function context(overrides: Partial<GameRunContext> = {}): GameRunContext {
  return {
    childId: 'chi_na',
    exerciseId: 'at-the-zoo/z1/listen-tap',
    lessonId: 'at-the-zoo/z1',
    gameType: 'listen_tap',
    totalRounds: 3,
    durationSeconds: 41,
    answers: [
      { wordId: 'w.monkey', firstTry: true, wrongAttempts: 0 },
      { wordId: 'w.lion', firstTry: false, wrongAttempts: 2 },
      { wordId: 'w.zebra', firstTry: true, wrongAttempts: 0 },
    ],
    ...overrides,
  };
}

const AWARD: GameResultAward = {
  score: 7,
  stars: 3,
  bestScore: 7,
  bestStars: 3,
  isNewRecord: true,
  duplicate: false,
  xpGained: 0,
  starsGained: 0,
  acornsGained: 0,
  levelUp: null,
  questsCompleted: [],
  badgesEarned: [],
  stickerEarned: null,
};

/** Bao lời gọi `send` cho tới khi test tự nhả — để kiểm trạng thái ĐANG gửi. */
function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Hàng đợi với "đĩa" giả trong bộ nhớ — kiểm được thứ tự ghi mà không cần `localStorage`. */
function makeQueue(
  overrides: Partial<GameResultQueueDeps> = {},
  seed: QueuedGameResult[] = [],
): {
  queue: GameResultQueue;
  /** Ảnh chụp hàng đợi HIỆN TẠI trên "đĩa". */
  disk: () => QueuedGameResult[];
  save: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
} {
  let items: QueuedGameResult[] = [...seed];
  let eventSeq = 0;

  const save = vi.fn((next: QueuedGameResult[]) => {
    items = [...next];
    return true;
  });
  const send = vi.fn<SendFn>(async () => AWARD);

  const deps: GameResultQueueDeps = {
    load: () => items,
    save,
    send,
    isOnline: () => true,
    now: () => 1_760_000_000_000, // cố định ⇒ `occurredAt` xác định
    // Bộ đếm, KHÔNG suy từ `now`: mỗi lượt chơi phải có mã RIÊNG, đúng như
    // `createClientEventId()` thật (có phần ngẫu nhiên). Nhờ vậy test khẳng định được cả hai
    // điều: mã không đổi khi THỬ LẠI, và mã khác nhau giữa hai LƯỢT CHƠI khác nhau.
    newEventId: () => `evt_${(eventSeq += 1)}`,
    ...overrides,
  };

  return { queue: new GameResultQueue(deps), disk: () => items, save, send };
}

// =============================================================================
// 1. Dựng payload — hàm thuần
// =============================================================================

describe('buildGameResultSubmission — dựng payload từ nhật ký của engine', () => {
  it('chép đủ các trường và nhật ký từng câu, ĐÚNG THỨ TỰ', () => {
    const payload = buildGameResultSubmission(context(), {
      clientEventId: 'evt_x',
      occurredAt: '2026-10-06T09:15:00.000Z',
    });

    expect(payload).toEqual({
      clientEventId: 'evt_x',
      exerciseId: 'at-the-zoo/z1/listen-tap',
      lessonId: 'at-the-zoo/z1',
      gameType: 'listen_tap',
      totalRounds: 3,
      occurredAt: '2026-10-06T09:15:00.000Z',
      durationSeconds: 41,
      answers: [
        { wordId: 'w.monkey', firstTry: true, wrongAttempts: 0 },
        { wordId: 'w.lion', firstTry: false, wrongAttempts: 2 },
        { wordId: 'w.zebra', firstTry: true, wrongAttempts: 0 },
      ],
    });
  });

  /**
   * ⚠️ Payload KHÔNG ĐƯỢC CHỨA `score`/`stars`. Đây là ranh giới chống gian lận: server tự
   *    chấm lại từ `answers`. Nếu một ngày ai đó "tiện tay" thêm hai trường đó vào, test này
   *    phải đỏ lên — vì hợp đồng đã đổi theo hướng nguy hiểm.
   */
  it('KHÔNG chứa `score`/`stars` — server tự chấm, client không được tự phong', () => {
    const payload = buildGameResultSubmission(context(), {
      clientEventId: 'evt_x',
      occurredAt: '2026-10-06T09:15:00.000Z',
    }) as unknown as Record<string, unknown>;

    expect(payload).not.toHaveProperty('score');
    expect(payload).not.toHaveProperty('stars');
    expect(Object.keys(payload).sort()).toEqual([
      'answers',
      'clientEventId',
      'durationSeconds',
      'exerciseId',
      'gameType',
      'lessonId',
      'occurredAt',
      'totalRounds',
    ]);
  });

  it('câu không gắn với từ nào (`wordId: null`) đi qua nguyên vẹn', () => {
    const payload = buildGameResultSubmission(
      context({
        gameType: 'prepositions',
        answers: [{ wordId: null, firstTry: true, wrongAttempts: 0 }],
      }),
      { clientEventId: 'evt_x', occurredAt: '2026-10-06T09:15:00.000Z' },
    );

    expect(payload.answers).toEqual([{ wordId: null, firstTry: true, wrongAttempts: 0 }]);
  });

  it('làm tròn `durationSeconds` và không để số âm', () => {
    const ids = { clientEventId: 'evt_x', occurredAt: '2026-10-06T09:15:00.000Z' };
    expect(
      buildGameResultSubmission(context({ durationSeconds: 41.7 }), ids).durationSeconds,
    ).toBe(42);
    expect(
      buildGameResultSubmission(context({ durationSeconds: -5 }), ids).durationSeconds,
    ).toBe(0);
  });

  it('KHÔNG giữ tham chiếu vào mảng `answers` của engine (state React)', () => {
    const ctx = context();
    const payload = buildGameResultSubmission(ctx, {
      clientEventId: 'evt_x',
      occurredAt: '2026-10-06T09:15:00.000Z',
    });

    expect(payload.answers).not.toBe(ctx.answers);
    expect(payload.answers[0]).not.toBe(ctx.answers[0]);
  });
});

// =============================================================================
// 2. Xếp hàng + gửi
// =============================================================================

describe('GameResultQueue — xếp hàng và gửi', () => {
  it('xếp vào hàng đợi thì LƯU XUỐNG MÁY ngay, trước cả khi gửi', () => {
    const { queue, disk, save } = makeQueue();

    const item = queue.enqueue(context());

    expect(save).toHaveBeenCalled();
    expect(disk()).toEqual([item]);
    expect(item.childId).toBe('chi_na');
    expect(item.submission.clientEventId).toBe('evt_1');
  });

  /**
   * Mã sự kiện là thứ duy nhất phân biệt hai lượt chơi ở server (cổng chống ghi trùng) VÀ ở
   * hàng đợi này (xoá đúng mục vừa gửi). Hai lượt chơi trùng mã nghĩa là lượt thứ hai bị server
   * coi là gửi lại và bị bỏ qua — bé chơi mà không được ghi nhận gì.
   */
  it('hai lượt chơi khác nhau nhận hai mã sự kiện KHÁC nhau', () => {
    const { queue } = makeQueue();

    const first = queue.enqueue(context());
    const second = queue.enqueue(context());

    expect(first.submission.clientEventId).not.toBe(second.submission.clientEventId);
  });

  it('gửi thành công thì bỏ khỏi hàng đợi', async () => {
    const { queue, disk, send } = makeQueue();
    queue.enqueue(context());

    const sent = await queue.flush();

    expect(sent).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('chi_na', expect.objectContaining({ gameType: 'listen_tap' }));
    expect(disk()).toEqual([]);
  });

  it('gửi theo ĐÚNG thứ tự đã xếp', async () => {
    const { queue, send } = makeQueue();
    queue.enqueue(context({ exerciseId: 'a/1/first' }));
    queue.enqueue(context({ exerciseId: 'a/1/second' }));
    queue.enqueue(context({ exerciseId: 'a/1/third' }));

    await queue.flush();

    expect(send.mock.calls.map((c) => c[1].exerciseId)).toEqual([
      'a/1/first',
      'a/1/second',
      'a/1/third',
    ]);
  });

  it('hàng đợi rỗng thì không gọi mạng', async () => {
    const { queue, send } = makeQueue();
    expect(await queue.flush()).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('đang offline thì để nguyên hàng đợi, không gọi mạng', async () => {
    const { queue, disk, send } = makeQueue({ isOnline: () => false });
    queue.enqueue(context());

    expect(await queue.flush()).toBe(0);
    expect(send).not.toHaveBeenCalled();
    expect(disk()).toHaveLength(1);
  });
});

// =============================================================================
// 2b. `onSent` — phần thưởng của server đi vào app (T055)
// =============================================================================

/**
 * ⭐ `onSent` là CHỖ DUY NHẤT phần thưởng của một lượt chơi đi vào app: nó được nối vào
 * `rewardStore.applyAward()`, hàm này cộng thẳng ⭐/🌰/XP vào bản sao ví trong bộ nhớ.
 *
 *   Vì sao phải khẳng định SỐ LẦN GỌI chứ không chỉ "có được gọi": gọi hai lần cho cùng một
 *   lượt ⇒ ví hiện số phồng lên, và vì ví chỉ được đồng bộ lại từ server ở lần nạp sau, sai
 *   lệch đó tồn tại cho tới khi bé tải lại trang. Nhìn màn hình kết quả thì không thấy gì bất
 *   thường — đúng kiểu lỗi im lặng của dự án.
 */
describe('GameResultQueue — `onSent` báo phần thưởng về cho app', () => {
  it('gửi thành công ⇒ `onSent` chạy ĐÚNG MỘT LẦN cho mỗi lượt, kèm phần thưởng của server', async () => {
    const onSent = vi.fn();
    const { queue } = makeQueue({ onSent });
    const item = queue.enqueue(context());

    await queue.flush();

    expect(onSent).toHaveBeenCalledTimes(1);
    expect(onSent).toHaveBeenCalledWith('chi_na', item.submission, AWARD);
  });

  it('gửi HỎNG ⇒ KHÔNG báo phần thưởng (chưa có gì để cộng vào ví)', async () => {
    const onSent = vi.fn();
    const send = vi.fn<SendFn>(async () => {
      throw new Error('mất mạng');
    });
    const { queue } = makeQueue({ send, onSent });
    queue.enqueue(context());

    expect(await queue.flush()).toBe(0);

    expect(onSent).not.toHaveBeenCalled();
  });

  /**
   * ⭐⭐ TEST QUAN TRỌNG NHẤT CỦA NHÓM NÀY.
   *
   *   Một lượt chơi có thể phải gửi lại nhiều lần (mất mạng rồi có mạng lại). Server chỉ trả
   *   phần thưởng ở lần thành công — nhưng chính `flush()` phải bảo đảm thông báo đó đi ra
   *   ĐÚNG MỘT lần. Nếu không, mỗi lần thử lại là một lần cộng ⭐ vào ví: bé thấy tiền của mình
   *   tăng vọt mà không hiểu vì sao, và màn kết quả thì vẫn hiện đúng một phần thưởng.
   */
  it('⭐ thử lại rồi mới thành công ⇒ `onSent` vẫn chỉ chạy MỘT LẦN (ví không cộng hai lần)', async () => {
    let attempt = 0;
    const send = vi.fn<SendFn>(async () => {
      attempt += 1;
      if (attempt < 3) throw new Error('mất mạng');
      return AWARD;
    });
    const onSent = vi.fn();
    const { queue, disk } = makeQueue({ send, onSent });
    queue.enqueue(context());

    await queue.flush(); // hỏng
    await queue.flush(); // hỏng
    await queue.flush(); // thành công

    expect(send).toHaveBeenCalledTimes(3);
    expect(disk()).toHaveLength(0);
    expect(onSent).toHaveBeenCalledTimes(1);
  });

  it('`onSent` nhận ĐÚNG `clientEventId` của lượt — khoá để màn kết quả tra lại phần thưởng', async () => {
    const onSent = vi.fn();
    const { queue } = makeQueue({ onSent });

    const first = queue.enqueue(context({ exerciseId: 'a/1/first' }));
    const second = queue.enqueue(context({ exerciseId: 'a/1/second' }));

    await queue.flush();

    expect(onSent.mock.calls.map((c) => c[1].clientEventId)).toEqual([
      first.submission.clientEventId,
      second.submission.clientEventId,
    ]);
  });

  it('không truyền `onSent` vẫn gửi bình thường (hàng đợi là tính năng độc lập)', async () => {
    const { queue, disk } = makeQueue();
    queue.enqueue(context());

    expect(await queue.flush()).toBe(1);
    expect(disk()).toHaveLength(0);
  });
});

// =============================================================================
// 3. Thử lại — NHÓM QUAN TRỌNG NHẤT
// =============================================================================

describe('GameResultQueue — thử lại sau khi hỏng', () => {
  /**
   * ⭐⭐⭐ TEST QUAN TRỌNG NHẤT CỦA FILE.
   *
   *   `clientEventId` là cổng chống ghi trùng duy nhất ở server. Hàng đợi PHẢI giữ nguyên
   *   payload đã dựng; nếu nó dựng lại payload mới ở mỗi lần thử thì cổng đó vô hiệu, và vì
   *   `daily_stats` CỘNG DỒN, số liệu của bé phồng lên mỗi lần thử — vĩnh viễn, không cách nào
   *   phát hiện. Test này khoá đúng điều đó.
   */
  it('⭐ thử lại dùng ĐÚNG `clientEventId` cũ, không sinh mã mới', async () => {
    let attempt = 0;
    const send = vi.fn<SendFn>(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('mất mạng');
      return AWARD;
    });

    const { queue, disk } = makeQueue({ send });
    const item = queue.enqueue(context());

    // Lần 1: hỏng ⇒ còn nguyên trong hàng đợi.
    expect(await queue.flush()).toBe(0);
    expect(disk()).toHaveLength(1);

    // Lần 2: thành công.
    expect(await queue.flush()).toBe(1);
    expect(disk()).toHaveLength(0);

    // ⭐ CẢ HAI lần gửi phải mang CÙNG một `clientEventId`.
    expect(send).toHaveBeenCalledTimes(2);
    const first = send.mock.calls[0]![1];
    const second = send.mock.calls[1]![1];
    expect(first.clientEventId).toBe(item.submission.clientEventId);
    expect(second.clientEventId).toBe(item.submission.clientEventId);
  });

  it('payload thử lại y hệt payload gốc, từng trường một', async () => {
    let attempt = 0;
    const send = vi.fn<SendFn>(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('hỏng');
      return AWARD;
    });

    const { queue } = makeQueue({ send });
    const item = queue.enqueue(context());

    await queue.flush();
    await queue.flush();

    expect(send.mock.calls[1]![1]).toEqual(item.submission);
  });

  it('gửi hỏng ở mục thứ hai thì DỪNG, mục thứ ba vẫn còn trong hàng đợi', async () => {
    let call = 0;
    const send = vi.fn<SendFn>(async () => {
      call += 1;
      if (call === 2) throw new Error('hỏng ở mục 2');
      return AWARD;
    });

    const { queue, disk } = makeQueue({ send });
    queue.enqueue(context());
    queue.enqueue(context());
    queue.enqueue(context());

    expect(await queue.flush()).toBe(1);
    expect(disk()).toHaveLength(2);
    // Không nhảy qua mục hỏng để gửi mục sau — thứ tự được giữ.
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('KHÔNG xoá gì khi gửi hỏng (mất mạng không được làm mất thành tích)', async () => {
    const send = vi.fn<SendFn>(async () => {
      throw new Error('offline');
    });

    const { queue, disk } = makeQueue({ send });
    const item = queue.enqueue(context());

    await queue.flush();

    expect(disk()).toEqual([item]);
  });

  it('ghi được log lỗi nhưng KHÔNG ném ra ngoài', async () => {
    const onError = vi.fn();
    const send = vi.fn<SendFn>(async () => {
      throw new Error('offline');
    });

    const { queue } = makeQueue({ send, onError });
    queue.enqueue(context());

    await expect(queue.flush()).resolves.toBe(0);
    expect(onError).toHaveBeenCalledWith('offline', expect.any(Error));
  });
});

// =============================================================================
// 4. Chống chồng lấn + trần hàng đợi
// =============================================================================

describe('GameResultQueue — chồng lấn và trần', () => {
  it('hai lượt gửi cùng lúc chỉ chạy MỘT (không gửi trùng)', async () => {
    const gate = deferred<GameResultAward>();
    const send = vi.fn<SendFn>(() => gate.promise);

    const { queue } = makeQueue({ send });
    queue.enqueue(context());

    const first = queue.flush();
    const second = queue.flush(); // gọi trong lúc lượt đầu đang bay

    expect(await second).toBe(0); // lượt thứ hai quay về ngay
    expect(send).toHaveBeenCalledTimes(1);

    gate.resolve(AWARD);
    expect(await first).toBe(1);
  });

  /**
   * ⚠️ Bé chơi xong một ván nữa TRONG LÚC ván trước đang được gửi. Nếu `flush` ghi đè hàng
   *    đợi bằng ảnh chụp cũ, lượt chơi mới đó biến mất mà không có lỗi nào.
   */
  it('lượt chơi mới xếp vào GIỮA LÚC đang gửi thì KHÔNG bị mất', async () => {
    const gate = deferred<GameResultAward>();
    const send = vi.fn<SendFn>()
      .mockImplementationOnce(() => gate.promise) // mục đầu: treo
      .mockImplementation(async () => AWARD); // mục sau: xong ngay

    const { queue, disk } = makeQueue({ send });
    queue.enqueue(context({ exerciseId: 'a/1/old' }));

    const flushing = queue.flush();
    // Trong lúc request đang bay, bé chơi xong một ván nữa:
    const fresh = queue.enqueue(context({ exerciseId: 'a/1/new' }));
    expect(disk()).toHaveLength(2);

    gate.resolve(AWARD);
    await flushing;

    // Cả hai đều đã được gửi, và hàng đợi rỗng.
    expect(send).toHaveBeenCalledTimes(2);
    // Khẳng định thẳng: lượt chơi MỚI có tới được server, không chỉ "hàng đợi rỗng".
    // (Nếu `flush` ghi đè bằng ảnh chụp cũ, hàng đợi cũng rỗng — nhưng vì mục mới bị XOÁ,
    //  nên chỉ kiểm `disk()` sẽ bỏ lọt lỗi.)
    expect(send.mock.calls.map((c) => c[1].clientEventId)).toEqual([
      'evt_1',
      'evt_2',
    ]);
    expect(disk()).toEqual([]);
    expect(fresh.submission.exerciseId).toBe('a/1/new');
  });

  it(`giữ tối đa ${MAX_PENDING_GAME_RESULTS} lượt, bỏ mục CŨ NHẤT`, () => {
    const { queue, disk } = makeQueue();

    for (let i = 0; i < MAX_PENDING_GAME_RESULTS + 5; i += 1) {
      queue.enqueue(context({ exerciseId: `a/1/run-${i}` }));
    }

    const items = disk();
    expect(items).toHaveLength(MAX_PENDING_GAME_RESULTS);
    // Mục đầu tiên còn lại là lượt thứ 5 (0..4 đã bị bỏ).
    expect(items[0]!.submission.exerciseId).toBe('a/1/run-5');
    // Và lượt MỚI NHẤT luôn được giữ.
    expect(items.at(-1)!.submission.exerciseId).toBe(`a/1/run-${MAX_PENDING_GAME_RESULTS + 4}`);
  });

  it('`pending` phản ánh số mục đang chờ', async () => {
    const { queue } = makeQueue();
    expect(queue.pending).toBe(0);

    queue.enqueue(context());
    queue.enqueue(context());
    expect(queue.pending).toBe(2);

    await queue.flush();
    expect(queue.pending).toBe(0);
  });
});

// =============================================================================
// 5. Lưu trong máy — hình dạng và khả năng chịu lỗi
// =============================================================================

describe('lưu / đọc hàng đợi trong `localStorage`', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    });
  });

  it('đi vòng qua `localStorage` mà không mất gì', () => {
    const items: QueuedGameResult[] = [
      {
        childId: 'chi_na',
        submission: buildGameResultSubmission(context(), {
          clientEventId: 'evt_1',
          occurredAt: '2026-10-06T09:15:00.000Z',
        }),
      },
    ];

    expect(saveGameResultQueue(items)).toBe(true);
    expect(loadGameResultQueue()).toEqual(items);
  });

  it('chưa có gì trong máy ⇒ mảng rỗng, không ném lỗi', () => {
    expect(loadGameResultQueue()).toEqual([]);
  });

  it('JSON hỏng ⇒ mảng rỗng (coi như chưa có gì)', () => {
    store.set('rubylingo.gameResults', '{không phải json');
    expect(loadGameResultQueue()).toEqual([]);
  });

  it('phiên bản lạ ⇒ bỏ qua, không cố đọc', () => {
    store.set('rubylingo.gameResults', JSON.stringify({ version: 99, items: [{}] }));
    expect(loadGameResultQueue()).toEqual([]);
  });

  it('bỏ những mục sai hình dạng, giữ những mục hợp lệ', () => {
    store.set(
      'rubylingo.gameResults',
      JSON.stringify({
        version: GAME_RESULT_QUEUE_VERSION,
        items: [
          { childId: 'chi_na', submission: { clientEventId: 'evt_ok', answers: [] } },
          { childId: '', submission: { clientEventId: 'evt_x', answers: [] } }, // childId rỗng
          { childId: 'chi_na', submission: { answers: [] } }, // thiếu clientEventId
          { childId: 'chi_na', submission: { clientEventId: 'evt_y' } }, // thiếu answers
          'rác',
          null,
        ],
      }),
    );

    const loaded = loadGameResultQueue();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.submission.clientEventId).toBe('evt_ok');
  });

  it('`localStorage` bị chặn ⇒ đọc ra rỗng, ghi trả `false` (không ném lỗi)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bị chặn');
      },
      setItem: () => {
        throw new Error('bị chặn');
      },
      removeItem: () => {
        throw new Error('bị chặn');
      },
    });

    expect(loadGameResultQueue()).toEqual([]);
    expect(saveGameResultQueue([])).toBe(false);
  });
});
