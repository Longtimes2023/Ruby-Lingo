/**
 * RubyLingo — `rewardStore`: ví ⭐🌰, XP, linh vật, chuỗi ngày của bé đang chọn.
 *
 * ⭐ NHIỆM VỤ: giữ một BẢN SAO trong bộ nhớ của thứ mà `GET /api/children/:id/rewards` trả về,
 *   để `TopBar` hiện được số thật thay vì dấu "—", và để màn kết quả hiện được phần thưởng
 *   vừa nhận.
 *
 * ⚠️⚠️ KHÁC HẲN `progressStore`: Ở ĐÂY **KHÔNG CÓ BẢN LƯU TRONG MÁY**, VÀ ĐÓ LÀ CỐ Ý.
 *   Tiến độ học được lưu xuống `localStorage` vì bé phải chơi được khi mất mạng. Ví thì KHÔNG:
 *   tiền là CỘNG DỒN, và luật duy nhất giữ cho nó đúng là "chỉ server được cộng". Nếu ta lưu
 *   số dư xuống máy rồi cho nó "tự tin" khi mất mạng, ta phải trả lời câu hỏi không có đáp án
 *   đúng: khi nào thì bản trong máy thắng bản trên server? Không có câu trả lời nào an toàn —
 *   nên câu trả lời ở đây là **server luôn thắng, và khi chưa đọc được thì hiện "—"**.
 *   `TopBar` đã có cách hiển thị "chưa biết" (xem `pending` trong `TopBar.tsx`).
 *
 * ⭐ VÌ SAO `applyAward()` CỘNG DELTA RỒI **VẪN PHẢI NẠP LẠI**:
 *   `GameResultAward` chỉ mang phần CHÊNH của những gì nó chạm tới (`starsGained`,
 *   `acornsGained`, `xpGained`). Nó KHÔNG mang `happiness` (cho ăn mới đổi), KHÔNG mang
 *   `streak.currentStreak`, KHÔNG mang `badges`/`inventory`. Nếu chỉ cộng delta rồi thôi, bản
 *   sao sẽ ĐỨNG YÊN ở những trường đó mãi mãi — bé chơi xong thấy 🔥 không tăng dù hôm nay là
 *   ngày thứ 3 liên tiếp. Đúng họ lỗi "im lặng" của dự án: không lỗi, chỉ là số sai.
 *   Nên: cộng delta để bé thấy ⭐ tăng NGAY, rồi nạp lại ảnh chụp thật để mọi trường còn lại
 *   đuổi kịp.
 *
 * ⚠️ VÌ SAO LẦN NẠP LẠI PHẢI XẾP HÀNG, KHÔNG CHẠY SONG SONG:
 *   Hàng đợi kết quả lượt chơi có thể gửi BÙ nhiều lượt một lúc (bé chơi offline cả buổi tối,
 *   sáng hôm sau mở app). Mỗi lượt gửi xong lại gọi `applyAward` ⇒ mỗi lượt lại xin một lần
 *   nạp lại. Nếu các lần nạp đó chạy song song, một response CŨ có thể về SAU và ghi đè lên
 *   response MỚI — ví lùi về quá khứ. Cách chặn: chỉ một lần nạp chạy tại một thời điểm, và
 *   nếu có yêu cầu mới trong lúc đang chạy thì chạy thêm ĐÚNG MỘT lần nữa sau khi xong. Nhờ
 *   vậy lần nạp CUỐI LUÔN bắt đầu sau khi mọi delta đã được cộng, nên nó đọc được trạng thái
 *   mới nhất của server.
 */

import { create } from 'zustand';

import { getLevelForXp } from '@shared/content/levels.js';
import type { GameResultAward, GameResultSubmission } from '@shared/types/progress.js';
import type { RewardSnapshot } from '@shared/types/reward.js';
import { rewardsApi } from '../api/endpoints.js';

interface RewardState {
  /** Bé mà dữ liệu dưới đây thuộc về. `null` = chưa nạp. */
  childId: string | null;
  /** Ảnh chụp ví/XP/gốc từ server. `null` = chưa biết ⇒ UI hiện "—". */
  snapshot: RewardSnapshot | null;
  /** Đã THỬ nạp xong cho `childId` hiện tại chưa — thành công hay thất bại đều tính. */
  hydrated: boolean;
  /** Đang có một lần nạp đầu tiên chạy. Dùng để chặn StrictMode gọi hai lần. */
  loading: boolean;
  /**
   * Thông báo lỗi KỸ THUẬT của lần nạp hỏng gần nhất. **KHÔNG bao giờ hiển thị cho bé** —
   * `TopBar` hiện "—" là đủ, và một câu báo lỗi về tiền bạc chỉ làm bé lo.
   */
  error: string | null;
  /**
   * Phần thưởng server chấm cho từng lượt chơi, khoá theo `submission.clientEventId`.
   *
   * ⭐ VÌ SAO KHOÁ THEO `clientEventId` CHỨ KHÔNG PHẢI MỘT Ô `lastAward`:
   *   Màn kết quả cần biết phần thưởng của ĐÚNG lượt chơi nó đang hiện. Với một ô `lastAward`,
   *   lượt chơi thứ hai được gửi bù sẽ ghi đè phần thưởng của lượt thứ nhất, và màn kết quả
   *   của lượt thứ nhất đột nhiên hiện phần thưởng của lượt khác. `clientEventId` là duy nhất
   *   cho mỗi lượt (chính là cổng chống ghi trùng ở server), nên nó là khoá đúng.
   */
  awards: Record<string, GameResultAward>;

  /** Nạp ảnh chụp của một bé. Đổi bé thì xoá dữ liệu bé cũ trước khi nạp. */
  load: (childId: string) => Promise<void>;
  /**
   * Ghi nhận phần thưởng của một lượt chơi vừa tới được server: lưu lại cho màn kết quả, cộng
   * delta vào bản sao, rồi nạp lại ảnh chụp. Xem ghi chú đầu file.
   */
  applyAward: (childId: string, submission: GameResultSubmission, award: GameResultAward) => void;
  /**
   * Ghi NGAY những trường mà server vừa trả về trong phản hồi của một hành động tiêu tiền
   * (`/shop/buy`, `/pet/feed`, `/inventory/:itemId/equip`), rồi `reload()` vẫn chạy tiếp.
   *
   * ⭐ VÌ SAO CẦN, KHI ĐÃ CÓ `reload()`:
   *   `reload()` là một vòng mạng nữa. Giữa lúc bé bấm "Mua" và lúc ví trên `TopBar` đổi số có
   *   một khoảng trống vài trăm mili giây — và nếu vòng mạng đó HỎNG (wifi chập đúng lúc), con số
   *   cũ Ở LẠI vĩnh viễn: bé vừa mất 30 ⭐ mà màn hình vẫn khoe 50 ⭐, nút "Mua" vẫn sáng, bé bấm
   *   lại và nhận `INSUFFICIENT_FUNDS` mà không hiểu vì sao. Ghi thẳng con số server vừa trả về
   *   làm khoảng trống ấy biến mất và làm hỏng-vòng-nạp trở thành vô hại.
   *
   * ⚠️⚠️ CHỈ ĐƯỢC ĐƯA VÀO ĐÂY DỮ LIỆU **SERVER VỪA TRẢ VỀ**. Đây không phải chỗ để vá số dư theo
   *    phỏng đoán (`stars: stars - price`) — dù phép trừ ấy có vẻ đúng. Ví là CỘNG DỒN: một con số
   *    đoán được ghi vào bản sao sẽ nằm lại vĩnh viễn, và không có cách nào phân biệt nó với con
   *    số thật. Cùng lý do tệp này KHÔNG có hàm "đẩy ví lên server".
   *
   * ⚠️ BỎ QUA khi chưa có `snapshot`: không có gì để vá vào, và `reload()` ở tầng gọi vẫn sẽ nạp
   *    đủ. Im lặng ở đây là an toàn — khác hẳn việc bịa ra một ảnh chụp rỗng.
   */
  applyServerSnapshot: (
    childId: string,
    patch: Partial<Omit<RewardSnapshot, 'childId'>>,
  ) => void;
  /**
   * ĐỌC LẠI ảnh chụp từ server, bỏ qua cổng "đã có dữ liệu rồi thì thôi" của `load()`.
   *
   * ⭐ VÌ SAO CẦN, KHI ĐÃ CÓ `load()`:
   *   `load()` được thiết kế để KHÔNG nạp lại khi đã có dữ liệu (nó chạy ở `AppShell`, tức ở
   *   mọi màn hình). Nhưng có những việc xảy ra NGOÀI luồng lượt chơi mà vẫn đổi ví: bé bấm
   *   "Nhận thưởng" một nhiệm vụ. Phản hồi `claim` mang `wallet` + `xp` + `badgesEarned`, nhưng
   *   KHÔNG mang danh sách huy hiệu/sticker ĐẦY ĐỦ — nên nếu chỉ cộng delta rồi thôi, bé vừa
   *   nhận huy hiệu mới mà bộ sưu tập vẫn trống. Gọi `reload()` sau khi nhận thưởng là cách
   *   khiến MỌI trường đuổi kịp, đúng tinh thần "server luôn thắng" của file này.
   *
   * ⚠️ KHÔNG ghi `childId` vào state — hàm này chỉ đọc lại cho bé HIỆN TẠI. Đang chọn bé khác
   *    thì bỏ qua: nạp ví của bé A trong lúc màn hình đang là bé B là lỗi trộn dữ liệu.
   */
  reload: (childId: string) => void;
  /** Xoá sạch (đăng xuất, hoặc bố mẹ đổi sang bé khác). */
  reset: () => void;
}

/** Trạng thái rỗng — cũng là trạng thái trong lúc chờ nạp xong. */
function emptyState(): Omit<
  RewardState,
  'load' | 'applyAward' | 'applyServerSnapshot' | 'reload' | 'reset'
> {
  return {
    childId: null,
    snapshot: null,
    hydrated: false,
    loading: false,
    error: null,
    awards: {},
  };
}

export const useRewardStore = create<RewardState>((set, get) => {
  /**
   * Chỉ một lần nạp lại chạy tại một thời điểm — xem ghi chú đầu file về lý do.
   *
   * `refreshRequested` là "còn một yêu cầu nữa đang chờ": nó được đặt trong lúc đang nạp và
   * tiêu thụ ngay sau khi lần nạp hiện tại xong, nên số lần gọi thừa KHÔNG làm số request tăng
   * theo (100 lượt gửi bù cùng lúc vẫn chỉ tốn 2 request, không phải 100).
   */
  let refreshInFlight = false;
  let refreshRequested = false;

  /** Một lần đọc ảnh chụp. Không bao giờ ném — lỗi được ghi vào `error`. */
  const fetchSnapshot = async (childId: string): Promise<void> => {
    try {
      const snapshot = await rewardsApi.get(childId);
      // Bỏ kết quả nếu bé đã đổi trong lúc chờ: ghi vào bây giờ là gán ví của bé cũ cho bé mới.
      if (get().childId !== childId) return;
      set({ snapshot, hydrated: true, loading: false, error: null });
    } catch (error) {
      if (get().childId !== childId) return;
      set({
        hydrated: true,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /** Nạp lại theo hàng đợi một-lần-chạy — xem ghi chú đầu file. */
  const refreshQueued = async (childId: string): Promise<void> => {
    if (refreshInFlight) {
      refreshRequested = true;
      return;
    }

    refreshInFlight = true;
    try {
      do {
        refreshRequested = false;
        await fetchSnapshot(childId);
        // Bé đã đổi ⇒ vòng lặp này không còn nghĩa lý gì.
      } while (refreshRequested && get().childId === childId);
    } finally {
      refreshInFlight = false;
    }
  };

  return {
    ...emptyState(),

    load: async (childId) => {
      const state = get();

      if (state.childId === childId) {
        // Đang nạp dồi (StrictMode gọi hiệu ứng hai lần) ⇒ không xếp thêm request.
        if (state.loading) return;
        // Đã có dữ liệu và lần trước không hỏng ⇒ không nạp lại. `TopBar` gọi hook này ở mọi
        // màn hình nhờ `AppShell`, nên nạp lại mỗi lần là một request thừa mỗi lần chuyển trang.
        if (state.hydrated && state.snapshot && !state.error) return;
        /**
         * ⚠️ PHẢI BẬT `loading` Ở ĐÂY, TRƯỚC KHI `await`.
         *   `fetchSnapshot` chỉ TẮT nó khi xong. Nếu chỗ này không bật thì `state.loading` vĩnh
         *   viễn là `false`, cổng chặn ngay trên thành mã chết, và `StrictMode` (dự án CÓ bật)
         *   gọi hiệu ứng hai lần liên tiếp ⇒ hai request cho cùng một bé. Đúng kiểu lỗi im lặng:
         *   không sai kết quả, chỉ gấp đôi lưu lượng mà không ai thấy.
         */
        set({ loading: true });
      } else {
        /**
         * ⚠️ ĐỔI BÉ ⇒ XOÁ NGAY DỮ LIỆU BÉ CŨ, TRƯỚC KHI CHỜ MẠNG.
         *   Không xoá thì trong vài trăm mili giây chờ response, bé mới sẽ thấy ví CỦA BÉ CŨ.
         *   Trẻ con không phân biệt được "số tạm" với "số thật" — bé sẽ tưởng mình có ngần ấy ⭐.
         *   Dùng `set` trực tiếp (không qua `reset()`) để giữ nguyên `awards` đã có: chúng khoá
         *   theo `clientEventId` nên không thể lẫn giữa các bé.
         */
        set({ ...emptyState(), childId, loading: true });
      }

      await fetchSnapshot(childId);
    },

    applyAward: (childId, submission, award) => {
      const state = get();

      // Không trộn dữ liệu giữa các bé: lượt chơi của bé này không được cộng vào ví bé kia.
      if (state.childId !== childId) return;

      set({ awards: { ...state.awards, [submission.clientEventId]: award } });

      // `duplicate` = server đã ghi lượt này từ trước (client gửi lại sau khi mất phản hồi).
      // Mọi delta khi đó đều bằng 0, nên cộng vào là vô nghĩa — nhưng vẫn phải nạp lại, vì có
      // thể lần gửi lại này là lần đầu ta BIẾT về lượt đó (lần trước hỏng trước khi nhận phản hồi).
      const snapshot = state.snapshot;
      if (!award.duplicate && snapshot) {
        const xp = snapshot.xp.xp + award.xpGained;
        set({
          snapshot: {
            ...snapshot,
            wallet: {
              ...snapshot.wallet,
              stars: snapshot.wallet.stars + award.starsGained,
              acorns: snapshot.wallet.acorns + award.acornsGained,
            },
            // Cấp phải suy lại từ XP mới, không được giữ nguyên: `TopBar` hiện tên cấp và
            // `LevelUpOverlay` (T056) so cấp trước/cấp sau để biết có ăn mừng không.
            xp: { ...snapshot.xp, xp, level: getLevelForXp(xp).level },
          },
        });
      }

      void refreshQueued(childId);
    },

    applyServerSnapshot: (childId, patch) => {
      const state = get();

      // Không trộn dữ liệu giữa các bé: ví của bé này không được vá vào bản sao của bé kia.
      if (state.childId !== childId) return;

      const snapshot = state.snapshot;
      // Chưa nạp xong ⇒ không có gì để vá. `reload()` ở tầng gọi vẫn nạp đủ — xem ghi chú ở
      // khai báo trong `RewardState`.
      if (!snapshot) return;

      // `childId` không nằm trong `patch` (xem kiểu), nên phép trải này không thể ghi đè nó.
      set({ snapshot: { ...snapshot, ...patch } });
    },

    reload: (childId) => {
      if (get().childId !== childId) return;
      void refreshQueued(childId);
    },

    reset: () => {
      set(emptyState());
    },
  };
});

/** Chỉ dùng trong test. */
export function __resetRewardStoreForTests(): void {
  useRewardStore.setState(emptyState());
}
