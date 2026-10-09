/**
 * RubyLingo — `GameResultService` (phía CLIENT): gửi kết quả một LƯỢT CHƠI lên server.
 *
 * ⭐ NHIỆM VỤ: dựng payload "sự thật thô" từ nhật ký của engine → đưa vào hàng đợi trong máy →
 *   gửi lên `POST /api/children/:id/game-result` → nhận phần thưởng server chấm.
 *
 * ⭐⭐ VÌ SAO PHẢI CÓ HÀNG ĐỢI TRONG MÁY, KHÔNG GỬI THẲNG:
 *   Bé chơi trên iPad ở nhà không có wifi, hoặc bố mẹ đóng app ngay sau khi bé chơi xong —
 *   cả hai đều là chuyện bình thường, không phải ca hiếm. Nếu gửi thẳng rồi quên, thành tích
 *   của bé biến mất và KHÔNG có gì để lần theo. Ghi vào hàng đợi trước, gửi sau — đúng
 *   `ARCHITECTURE.md` §10.3 ("lưu tạm `game-result` payload vào queue; khi có mạng gửi lại").
 *
 * ⚠️⚠️ GỬI LẠI PHẢI LÀ **ĐÚNG PAYLOAD CŨ**, KHÔNG DỰNG LẠI:
 *   `clientEventId` là cổng chống ghi trùng ở server (`game_result.client_event_id` UNIQUE).
 *   Hàng đợi lưu nguyên payload ĐÃ DỰNG, không lưu "thông tin để dựng lại". Nếu mỗi lần thử
 *   lại ta sinh một `clientEventId` mới, cổng đó vô hiệu và `daily_stats` (vốn CỘNG DỒN) sẽ
 *   phồng lên mỗi lần thử — vĩnh viễn, không cách nào phát hiện.
 *
 * ⚠️ HÀNG ĐỢI GHI VÀO `localStorage` NGAY KHI XẾP, TRƯỚC KHI GỬI.
 *   Thứ tự này là điều kiện để "đóng app giữa lúc đang gửi" vẫn không mất dữ liệu: payload
 *   đã nằm trong máy trước khi request đầu tiên được tạo ra.
 *
 * ⚠️ VÌ SAO KHÔNG DÙNG LẠI `SyncService`:
 *   `SyncService` đẩy `pendingEvents` (sự kiện tiến độ) qua `/progress/sync` — một endpoint
 *   KHÁC, một hình dạng dữ liệu KHÁC. Gộp hai thứ vào một hàng đợi sẽ buộc `SyncService` phải
 *   biết về hai endpoint, hai cách chống trùng và hai cách xử lý lỗi. Tách ra thì mỗi bên chỉ
 *   có một việc, và hỏng một bên không kéo bên kia xuống.
 */

import type { GameType } from '@shared/types/content.js';
import type {
  GameAnswerRecord,
  GameResultSubmission,
  GameResultAward,
} from '@shared/types/progress.js';
import { progressApi } from '../api/endpoints.js';
import { queryClient } from '../lib/queryClient.js';
import { gameResultsQueryKey } from '../lib/queryKeys.js';
import { useRewardStore } from '../store/rewardStore.js';
import { createClientEventId } from './ProgressService.js';

// =============================================================================
// Dựng payload — HÀM THUẦN
// =============================================================================

/** Mọi thứ `GamePage` biết về lượt chơi vừa kết thúc. */
export interface GameRunContext {
  childId: string;
  exerciseId: string;
  lessonId: string;
  gameType: GameType;
  /** Số câu theo `config.rounds` — có thể LỚN HƠN `answers.length` nếu bé hết mạng giữa chừng. */
  totalRounds: number;
  /** Số giây bé chơi. Chỉ để thống kê — xem ràng buộc cứng #3 ở `shared/game-scoring.ts`. */
  durationSeconds: number;
  /** Nhật ký từng câu, lấy từ `engine.state.answers`. */
  answers: readonly GameAnswerRecord[];
}

/**
 * Dựng payload gửi lên server.
 *
 * ⚠️ HÀM THUẦN: hai giá trị duy nhất không suy ra được từ `ctx` (`clientEventId`, `occurredAt`)
 *    được truyền vào thay vì đọc đồng hồ ở trong. Nhờ vậy test kiểm được payload một cách xác
 *    định, và hàng đợi có thể dựng payload MỘT LẦN rồi lưu lại đúng nguyên văn để thử lại.
 */
export function buildGameResultSubmission(
  ctx: GameRunContext,
  ids: { clientEventId: string; occurredAt: string },
): GameResultSubmission {
  return {
    clientEventId: ids.clientEventId,
    exerciseId: ctx.exerciseId,
    lessonId: ctx.lessonId,
    gameType: ctx.gameType,
    totalRounds: ctx.totalRounds,
    occurredAt: ids.occurredAt,
    durationSeconds: Math.max(0, Math.round(ctx.durationSeconds)),
    // Sao chép từng phần tử: `state.answers` là state của React, và hàng đợi sẽ giữ mảng này
    // qua nhiều lần render. Giữ nguyên tham chiếu là mời gọi một sửa đổi tại chỗ ở đâu đó
    // làm hỏng luôn payload đang chờ gửi.
    answers: ctx.answers.map((answer) => ({
      wordId: answer.wordId,
      firstTry: answer.firstTry,
      wrongAttempts: answer.wrongAttempts,
    })),
  };
}

// =============================================================================
// Lưu trong máy
// =============================================================================

/** Phiên bản định dạng hàng đợi. Tăng khi hình dạng đổi theo cách không tương thích ngược. */
export const GAME_RESULT_QUEUE_VERSION = 1;

/** Một mục trong hàng đợi: payload đã dựng, kèm bé mà nó thuộc về. */
export interface QueuedGameResult {
  childId: string;
  submission: GameResultSubmission;
}

/**
 * Trần số lượt chơi giữ trong hàng đợi.
 *
 * ⚠️ VÌ SAO PHẢI CÓ TRẦN — VÀ VÌ SAO BỎ MỤC CŨ NHẤT:
 *   `localStorage` có hạn (thường 5MB cho MỘT origin). Một hàng đợi phình vô hạn sẽ chiếm hết
 *   chỗ đó, và khi ghi được nữa thì **mọi thứ** trong máy hỏng theo — kể cả tiến độ học. 50
 *   lượt chơi là rất nhiều (một bé chơi liên tục cũng phải vài ngày mới tới); vượt qua đó
 *   nghĩa là việc gửi đã hỏng từ lâu và giữ thêm chỉ làm hỏng khả năng ghi.
 *   Bỏ mục CŨ NHẤT vì những lượt gần đây là những gì bé còn nhớ và còn muốn thấy.
 */
export const MAX_PENDING_GAME_RESULTS = 50;

/** Một khoá duy nhất cho MỌI bé: đổi hồ sơ bé không được làm mất lượt chơi chưa gửi. */
const QUEUE_KEY = 'rubylingo.gameResults';

interface StoredQueue {
  version: number;
  items: QueuedGameResult[];
}

/**
 * Kiểm một mục đọc từ `localStorage` có đúng hình dạng tối thiểu không.
 *
 * ⚠️ KHÔNG dùng Zod ở đây: mục này do CHÍNH APP ghi ra, và nếu nó hỏng thì việc đúng cần làm
 *    là BỎ QUA nó — không phải dựng một thông báo lỗi cho bé đọc. Kiểm tay đủ chặt để không
 *    đưa dữ liệu rác vào payload gửi lên server.
 */
function isQueuedItem(value: unknown): value is QueuedGameResult {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as { childId?: unknown; submission?: unknown };
  if (typeof item.childId !== 'string' || item.childId === '') return false;

  const submission = item.submission as { clientEventId?: unknown; answers?: unknown } | undefined;
  if (typeof submission !== 'object' || submission === null) return false;
  return (
    typeof submission.clientEventId === 'string' &&
    submission.clientEventId !== '' &&
    Array.isArray(submission.answers)
  );
}

/** Đọc hàng đợi từ `localStorage`. Trả mảng rỗng khi chưa có, JSON hỏng, hoặc bị chặn. */
export function loadGameResultQueue(): QueuedGameResult[] {
  try {
    const raw = globalThis.localStorage?.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredQueue>;
    if (parsed.version !== GAME_RESULT_QUEUE_VERSION || !Array.isArray(parsed.items)) return [];
    return parsed.items.filter(isQueuedItem);
  } catch {
    // `localStorage` bị chặn (chế độ riêng tư của Safari), hoặc JSON hỏng. Cả hai đều dẫn tới
    // cùng một hành vi đúng: "coi như hàng đợi rỗng".
    return [];
  }
}

/** Ghi hàng đợi xuống máy. Trả `false` nếu không ghi được (hết chỗ / bị chặn). */
export function saveGameResultQueue(items: QueuedGameResult[]): boolean {
  try {
    const payload: StoredQueue = { version: GAME_RESULT_QUEUE_VERSION, items };
    globalThis.localStorage?.setItem(QUEUE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/** Xoá hàng đợi. Chỉ dùng trong test, và khi đăng xuất. */
export function clearGameResultQueue(): void {
  try {
    globalThis.localStorage?.removeItem(QUEUE_KEY);
  } catch {
    /* không ghi được thì thôi — không có gì để làm tiếp */
  }
}

// =============================================================================
// Hàng đợi — logic gửi, có phụ thuộc TIÊM VÀO để test được
// =============================================================================

/**
 * Phụ thuộc được tiêm vào, không gọi trực tiếp.
 *
 * ⭐ Cùng lý do như `SyncDeps` ở `SyncService.ts`: nhờ vậy mọi nhánh (mất mạng, gửi hỏng, gửi
 *   lại, trần hàng đợi) kiểm được trong vài mili giây mà không cần mạng thật, không cần đồng
 *   hồ thật, không cần React.
 */
export interface GameResultQueueDeps {
  load: () => QueuedGameResult[];
  save: (items: QueuedGameResult[]) => boolean;
  send: (childId: string, body: GameResultSubmission) => Promise<GameResultAward>;
  isOnline: () => boolean;
  now: () => number;
  /** Sinh mã sự kiện. Tiêm vào để test kiểm được payload xác định. */
  newEventId: (now: number) => string;
  /** Nhận tin khi một lượt chơi đã tới được server. */
  onSent?: (childId: string, submission: GameResultSubmission, award: GameResultAward) => void;
  /** Ghi log lỗi. KHÔNG bao giờ hiển thị cho bé — xem `SyncService`. */
  onError?: (message: string, error: unknown) => void;
}

export class GameResultQueue {
  /** Bẫy chống chồng lấn — hai lượt gửi song song sẽ gửi trùng cùng một payload. */
  private inFlight = false;
  private readonly listeners = new Set<(pending: number) => void>();

  constructor(private readonly deps: GameResultQueueDeps) {}

  /** Số lượt chơi còn chờ gửi. */
  get pending(): number {
    return this.deps.load().length;
  }

  /** Theo dõi số lượt chơi đang chờ (để UI hiện được nếu cần). */
  subscribe(listener: (pending: number) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Dựng payload cho một lượt chơi vừa kết thúc, LƯU VÀO MÁY, rồi thử gửi.
   *
   * ⚠️ LƯU TRƯỚC, GỬI SAU — xem ghi chú đầu file. `Date.now()` lấy ở đây (không ở component)
   *    để `occurredAt` là lúc LƯỢT CHƠI KẾT THÚC, không phải lúc render.
   */
  enqueue(ctx: GameRunContext): QueuedGameResult {
    const now = this.deps.now();
    const submission = buildGameResultSubmission(ctx, {
      clientEventId: this.deps.newEventId(now),
      occurredAt: new Date(now).toISOString(),
    });

    const item: QueuedGameResult = { childId: ctx.childId, submission };
    const items = this.deps.load();

    // Trần hàng đợi: bỏ mục CŨ NHẤT — xem ghi chú ở `MAX_PENDING_GAME_RESULTS`.
    const next = [...items, item].slice(-MAX_PENDING_GAME_RESULTS);
    this.deps.save(next);
    this.notify();

    return item;
  }

  /**
   * Gửi lần lượt mọi mục đang chờ, theo thứ tự đã xếp.
   *
   * ⚠️ DỪNG NGAY Ở MỤC ĐẦU TIÊN GỬI HỎNG, KHÔNG NHẢY QUA.
   *   Nhảy qua rồi gửi mục sau là tự tạo ra thứ tự sai lệch, và với `bestScore`/`bestStars`
   *   lấy `Math.max` thì thứ tự không ảnh hưởng KẾT QUẢ — nhưng nó làm `daily_stats` (cộng
   *   dồn theo ngày) bị gán vào ngày của lượt chơi, mà lượt chơi thì bị gửi lệch thứ tự. Giữ
   *   đúng thứ tự là cách rẻ nhất để không phải suy nghĩ về chuyện đó.
   *
   * Trả về số mục đã gửi thành công trong lượt này.
   */
  async flush(): Promise<number> {
    if (this.inFlight) return 0;
    if (!this.deps.isOnline()) return 0;

    this.inFlight = true;
    let sent = 0;

    try {
      for (;;) {
        const items = this.deps.load();
        if (items.length === 0) break;

        const head = items[0]!;
        let award: GameResultAward;
        try {
          award = await this.deps.send(head.childId, head.submission);
        } catch (error) {
          // Còn mạng hay không thì cũng để nguyên phần còn lại cho lần sau. KHÔNG xoá gì.
          this.deps.onError?.(
            error instanceof Error ? error.message : String(error),
            error,
          );
          break;
        }

        // ⚠️⚠️ ĐỌC LẠI HÀNG ĐỢI **SAU** KHI GỬI XONG, RỒI XOÁ **ĐÚNG MỤC VỪA GỬI**.
        //    Trong lúc request đang bay, bé có thể vừa chơi xong một lượt nữa và `enqueue`
        //    vừa ghi thêm vào cuối hàng. Nếu ta ghi đè bằng `rest` — ảnh chụp lấy TRƯỚC khi
        //    `await` — thì lượt mới đó bị XOÁ MẤT, im lặng, không lỗi, không log.
        //    Xoá theo `clientEventId` (duy nhất cho mỗi lượt chơi) giữ nguyên mọi mục khác,
        //    kể cả mục được thêm vào trong lúc chờ.
        const after = this.deps.load();
        const headIndex = after.findIndex(
          (item) => item.submission.clientEventId === head.submission.clientEventId,
        );
        // Không tìm thấy ⇒ hàng đợi đã bị thay đổi từ bên ngoài. Dừng để không lặp vô hạn
        // trên cùng một mục.
        if (headIndex === -1) break;

        const remaining = [...after.slice(0, headIndex), ...after.slice(headIndex + 1)];
        // Ghi không được (hết chỗ / `localStorage` bị chặn) ⇒ mục vẫn nằm trong máy và sẽ
        // được gửi lại lần sau. Dừng vòng lặp: nếu không, ta gửi lại đúng mục đó mãi mãi.
        if (!this.deps.save(remaining)) break;

        sent += 1;
        this.notify();
        this.deps.onSent?.(head.childId, head.submission, award);
      }
    } finally {
      this.inFlight = false;
    }

    return sent;
  }

  private notify(): void {
    const pending = this.pending;
    for (const listener of this.listeners) listener(pending);
  }
}

// =============================================================================
// Instance dùng chung
// =============================================================================

export const gameResultQueue = new GameResultQueue({
  load: loadGameResultQueue,
  save: saveGameResultQueue,
  send: (childId, body) => progressApi.submitGameResult(childId, body),
  isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
  now: () => Date.now(),
  newEventId: (now) => createClientEventId(now),
  /**
   * ⭐ ĐÂY LÀ CHỖ DUY NHẤT PHẦN THƯỞNG CỦA MỘT LƯỢT CHƠI ĐI VÀO APP.
   *
   *   `flush()` gọi hook này SAU KHI response đã về và mục đã được bỏ khỏi hàng đợi — nghĩa là
   *   chỉ chạy đúng một lần cho mỗi lượt chơi, kể cả khi lượt đó phải gửi lại nhiều lần vì mất
   *   mạng. Nhờ vậy ví không bao giờ cộng hai lần cho cùng một lượt.
   *
   *   Đọc qua `getState()` (không qua hook) vì đây là mã ngoài React — cùng cách `SyncService`
   *   nối vào `progressStore`. Nhận `(childId, submission, award)`: `submission.clientEventId`
   *   là khoá để màn kết quả tìm lại đúng phần thưởng của lượt nó đang hiện, còn `childId` để
   *   `rewardStore` từ chối nếu bé đã đổi trong lúc request đang bay.
   */
  onSent: (childId, submission, award) => {
    useRewardStore.getState().applyAward(childId, submission, award);

    /**
     * ⭐⭐ ĐÂY LÀ NƠI DUY NHẤT BIẾT "LƯỢT CHƠI ĐÃ TỚI SERVER" (T05 — Chỉnh sửa bắt buộc #2).
     *
     *   Chip trò chơi ở màn chủ đề đổi màu khi đọc được kết quả game mới. Nhưng `flush()` gọi
     *   hook này CHỈ SAU khi response đã về và mục đã bỏ khỏi hàng đợi — nghĩa là `game_result`
     *   đã nằm trong DB. Chỉ tới lúc này việc đọc lại mới thấy dữ liệu mới.
     *
     *   ⚠️ VÌ SAO KHÔNG CHỈ DỰA VÀO `refetchOnMount: 'always'` Ở HOOK:
     *     Lượt chơi vừa xong còn nằm trong hàng đợi chờ gửi lên server. Nếu bé quay lại màn chủ đề
     *     TRƯỚC khi hàng đợi gửi xong thì `refetchOnMount` đọc lại cũng KHÔNG thấy gì ⇒ chip vẫn
     *     chưa đổi — đúng triệu chứng chủ dự án báo. Làm mới ĐÚNG LÚC này (khi dữ liệu đã lên
     *     server) là cách duy nhất chắc chắn.
     *
     *   ⚠️ Đây là mã NGOÀI React: đọc `queryClient` bằng instance dùng chung (không hook) — cùng
     *     mẫu với `useRewardStore.getState()` ngay trên. `void` vì `invalidateQueries` trả Promise
     *     và ta không chờ nó (không được để nó chặn `flush()`).
     *
     *   ⚠️ Khoá dựng qua `gameResultsQueryKey` — CÙNG hàm mà `useGameResults` dùng. Viết chuỗi khoá
     *     ở hai chỗ là mời gọi một bên đổi còn bên kia không ⇒ làm mới một khoá không tồn tại, im lặng.
     */
    void queryClient.invalidateQueries({ queryKey: gameResultsQueryKey(childId) });
  },
  onError: (message, error) => {
    // Chỉ ghi log. Bé không bao giờ thấy lỗi này — thành tích vẫn nằm trong hàng đợi.
    console.warn('[rubylingo] chưa gửi được kết quả lượt chơi:', message, error);
  },
});
