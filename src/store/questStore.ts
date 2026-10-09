/**
 * RubyLingo — `questStore`: danh sách nhiệm vụ + tiến độ + chuỗi ngày của bé đang chọn.
 *
 * ⭐ NHIỆM VỤ: giữ BẢN SAO trong bộ nhớ của thứ mà `GET /api/children/:id/quests` trả về, và
 *   điều phối một lần bé bấm "Nhận thưởng".
 *
 * ⚠️⚠️ KHÔNG CÓ BẢN LƯU TRONG MÁY — CÙNG LÝ DO NHƯ `rewardStore`, KHÁC `progressStore`.
 *   Tiến độ học phải nằm trong máy để bé chơi được khi mất mạng. NHIỆM VỤ thì không: "nhiệm vụ
 *   này đã xong chưa" là một câu hỏi mà chỉ SERVER trả lời được (nó cộng tiến độ từ
 *   `lesson_progress`, `daily_stats`, `progress_event`, túi sticker, cấp độ…). Nếu client tự
 *   giữ một bản rồi "tin" bản đó khi mất mạng, ta buộc phải trả lời câu hỏi không có đáp án
 *   đúng: khi nào bản trong máy thắng bản trên server? Kết cục xấu nhất không phải là hiện số
 *   cũ, mà là hiện nút "Nhận thưởng" SÁNG cho một nhiệm vụ chưa xong — bé bấm, bị 409
 *   `QUEST_NOT_COMPLETE`, và không hiểu vì sao. Bởi vậy: **server luôn thắng, chưa đọc được thì
 *   hiện trạng thái "đang tải"**, không hiện số đoán.
 *
 * ⭐ VÌ SAO `lastClaim` NẰM TRONG STORE, KHÔNG PHẢI STATE CỦA TRANG (khác `GamePage`):
 *   Ở `GamePage`, kết quả thưởng gắn với một lượt chơi diễn ra TẠI CHỖ, nên state cục bộ là đủ.
 *   Ở đây, bé có thể bấm "Nhận thưởng" rồi chuyển màn hình (hoặc app bị đưa xuống nền rồi quay
 *   lại) trong lúc `await` đang chạy. Màn ăn mừng khi đó phải vẫn hiện được — nếu kết quả nằm
 *   trong state của một component đã bị tháo ra lắp lại, phần thưởng bé vừa nhận sẽ BIẾN MẤT
 *   khỏi màn hình trong khi ví đã tăng. Store là chỗ sống lâu hơn component.
 *
 * ⚠️ ĐỒNG BỘ VÍ SAU KHI NHẬN: phản hồi `claim` có `wallet` + `xp` + `badgesEarned`, nhưng
 *   KHÔNG có danh sách huy hiệu/sticker ĐẦY ĐỦ. Cộng delta rồi thôi thì bé vừa nhận huy hiệu mới
 *   mà bộ sưu tập vẫn trống. Vì vậy sau mỗi lần nhận, ta gọi `rewardStore.reload()` để MỌI
 *   trường đuổi kịp — đúng tinh thần "server luôn thắng".
 */

import { create } from 'zustand';

import type { GameResultAward } from '@shared/types/progress.js';
import type { QuestWithProgress, StreakState } from '@shared/types/reward.js';
import { ApiClientError } from '../api/client.js';
import { claimQuest, loadQuests } from '../services/QuestService.js';
import { useRewardStore } from './rewardStore.js';

/** Màn ăn mừng của lần nhận thưởng gần nhất. */
export interface ClaimCelebration {
  questId: string;
  /** Nhiệm vụ SAU khi nhận (đã có `claimed = true`) — để thẻ tự chuyển sang trạng thái đã nhận. */
  quest: QuestWithProgress;
  /**
   * Có lên cấp không — `null` khi lượt nhận này không vượt cấp nào. Nhận thưởng nhiệm vụ CÓ THỂ
   * cộng XP (`quests.json` → `qd-01` thưởng 20 XP), và cộng XP có thể đẩy bé qua một cấp. Bỏ
   * qua trường này nghĩa là quà của cấp mới vẫn được trao nhưng bé không bao giờ thấy màn ăn
   * mừng — một lỗi im lặng, vì ví vẫn tăng đúng như mong đợi.
   */
  levelUp: GameResultAward['levelUp'];
  /**
   * Huy hiệu MỚI THỰC SỰ được trao ở lượt nhận này (phần chênh, không phải `quest.rewards`).
   * Lẫn hai thứ này là ăn mừng hai lần cho cùng một huy hiệu.
   */
  badgesEarned: string[];
  /**
   * Sticker MỚI THỰC SỰ mở được ở lượt nhận này (T069.2) — phần chênh, giống `badgesEarned`.
   *
   * ⭐ VÌ SAO PHẢI GIỮ LẠI: từ khi 3 sticker MVP được gắn vào quà nhiệm vụ mốc, bé có thể MỞ
   *   ĐƯỢC một sticker khi bấm "Nhận thưởng". Sticker là "phần thưởng BIẾN THIÊN: mở ra mới biết
   *   là con gì" — nếu không hiện ra thì bé không bao giờ biết mình vừa được con gì. `QuestsPage`
   *   đọc trường này để dựng dòng ăn mừng (icon + tên thật) trong túi quà.
   */
  stickerIds: string[];
}

interface QuestState {
  /** Bé mà dữ liệu dưới đây thuộc về. `null` = chưa nạp. */
  childId: string | null;
  /** Danh sách nhiệm vụ kèm tiến độ. `null` = CHƯA BIẾT ⇒ UI hiện trạng thái tải, không hiện rỗng. */
  quests: QuestWithProgress[] | null;
  /** Chuỗi ngày học — màn Nhiệm vụ hiện "🔥 n ngày". `null` = chưa biết. */
  streak: StreakState | null;
  /** Khoá kỳ hiện tại, để hiện "còn bao lâu thì reset". `null` = chưa biết. */
  periodKeys: { daily: string; weekly: string } | null;
  /** Đã THỬ nạp xong cho `childId` hiện tại chưa — thành công hay thất bại đều tính. */
  hydrated: boolean;
  /** Đang có một lần nạp chạy. Dùng để chặn StrictMode gọi hai lần. */
  loading: boolean;
  /**
   * Lỗi KỸ THUẬT của lần nạp/nhận hỏng gần nhất. **KHÔNG bao giờ hiển thị cho bé** — nút vẫn
   * sáng để bé thử lại, và một câu báo lỗi chỉ làm bé lo.
   */
  error: string | null;
  /**
   * `questId` → đang có một yêu cầu nhận thưởng chạy.
   *
   * ⭐ Chặn bấm hai lần Ở ĐÂY (phía client) SONG SONG với cổng ở server: server đã chống nhận
   *   hai lần bằng `AND claimed = 0` (xem `QuestService.claim`), nhưng để bé chờ một vòng mạng
   *   rồi nhận 409 mới biết là "đã nhận" thì nút nhấp nháy vô ích. Cờ này tắt nút NGAY khi bé
   *   chạm. Hai lớp không thay thế nhau: cờ này chỉ là phản hồi tức thì, nó KHÔNG phải cổng an
   *   toàn — client có thể bị can thiệp.
   */
  claiming: Record<string, boolean>;
  /** Màn ăn mừng của lần nhận gần nhất; `null` = không có gì để ăn mừng. */
  lastClaim: ClaimCelebration | null;

  /** Nạp danh sách nhiệm vụ của một bé. Đổi bé thì xoá dữ liệu bé cũ trước khi nạp. */
  load: (childId: string) => Promise<void>;
  /** Bé bấm "Nhận thưởng". Không bao giờ ném — lỗi được ghi vào `error`. */
  claim: (childId: string, questId: string) => Promise<void>;
  /** Đóng màn ăn mừng (sau khi bé đã xem xong). */
  dismissClaim: () => void;
  /** Xoá sạch (đăng xuất, hoặc bố mẹ đổi sang bé khác). */
  reset: () => void;
}

/** Trạng thái rỗng — cũng là trạng thái trong lúc chờ nạp xong. */
function emptyState(): Omit<
  QuestState,
  'load' | 'claim' | 'dismissClaim' | 'reset'
> {
  return {
    childId: null,
    quests: null,
    streak: null,
    periodKeys: null,
    hydrated: false,
    loading: false,
    error: null,
    claiming: {},
    lastClaim: null,
  };
}

/** Thay một nhiệm vụ trong danh sách; giữ nguyên vị trí (thứ tự là dữ liệu biên tập). */
function replaceQuest(
  quests: QuestWithProgress[],
  updated: QuestWithProgress,
): QuestWithProgress[] {
  return quests.map((quest) => (quest.id === updated.id ? updated : quest));
}

export const useQuestStore = create<QuestState>((set, get) => {
  /** Một lần đọc danh sách. Không bao giờ ném — lỗi được ghi vào `error`. */
  const fetchQuests = async (childId: string): Promise<void> => {
    try {
      const { quests, streak, periodKeys } = await loadQuests(childId);
      // Bỏ kết quả nếu bé đã đổi trong lúc chờ: ghi vào bây giờ là gán nhiệm vụ của bé cũ cho bé mới.
      if (get().childId !== childId) return;
      set({ quests, streak, periodKeys, hydrated: true, loading: false, error: null });
    } catch (error) {
      if (get().childId !== childId) return;
      set({
        hydrated: true,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return {
    ...emptyState(),

    load: async (childId) => {
      const state = get();

      if (state.childId === childId) {
        // Đang nạp dồi (StrictMode gọi hiệu ứng hai lần) ⇒ không xếp thêm request.
        if (state.loading) return;
        // Đã có dữ liệu và lần trước không hỏng ⇒ không nạp lại.
        if (state.hydrated && state.quests && !state.error) return;
        /**
         * ⚠️ PHẢI BẬT `loading` Ở ĐÂY, TRƯỚC KHI `await`.
         *   `fetchQuests` chỉ TẮT nó khi xong. Không bật ở đây thì `state.loading` vĩnh viễn là
         *   `false`, cổng chặn ngay trên thành mã chết, và StrictMode gọi hiệu ứng hai lần liên
         *   tiếp ⇒ hai request cho cùng một bé. Lỗi im lặng: không sai kết quả, chỉ gấp đôi lưu
         *   lượng mà không ai thấy.
         */
        set({ loading: true });
      } else {
        /**
         * ⚠️ ĐỔI BÉ ⇒ XOÁ NGAY DỮ LIỆU BÉ CŨ, TRƯỚC KHI CHỜ MẠNG.
         *   Không xoá thì trong vài trăm mili giây chờ response, bé mới sẽ thấy danh sách nhiệm
         *   vụ CỦA BÉ CŨ — kèm nút "Nhận thưởng" đang sáng. Trẻ con không phân biệt được "số
         *   tạm" với "số thật".
         */
        set({ ...emptyState(), childId, loading: true });
      }

      await fetchQuests(childId);
    },

    claim: async (childId, questId) => {
      const state = get();

      // Không trộn dữ liệu giữa các bé.
      if (state.childId !== childId) return;
      // Đang gửi rồi ⇒ bỏ qua cú chạm thứ hai (bé 7 tuổi chạm rất nhanh).
      if (state.claiming[questId]) return;

      set({ claiming: { ...state.claiming, [questId]: true }, error: null });

      /** Chỉ ghi vào state nếu bé chưa đổi — nếu không thì ta đang sửa dữ liệu của bé khác. */
      const stillSameChild = (): boolean => get().childId === childId;

      try {
        const outcome = await claimQuest(childId, questId);
        if (!stillSameChild()) return;

        const current = get().quests ?? [];

        if (outcome.status === 'claimed') {
          const { quest, levelUp, badgesEarned, stickerIds } = outcome.result;
          set({
            quests: replaceQuest(current, quest),
            lastClaim: { questId, quest, levelUp, badgesEarned, stickerIds },
          });
          // Ví/huy hiệu/sticker: đọc lại — phản hồi `claim` không mang danh sách huy hiệu đầy đủ.
          useRewardStore.getState().reload(childId);
        } else {
          /**
           * ⚠️ `ALREADY_CLAIMED` LÀ ĐƯỜNG ĐI BÌNH THƯỜNG, KHÔNG PHẢI NHÁNH LỖI.
           *   Server xác nhận hàng `quest_progress` đã có `claimed = 1`. Ta biết CHẮC một điều
           *   (nhiệm vụ này đã được nhận) và đánh dấu đúng thế — nhờ đó nút chuyển sang "Đã nhận"
           *   ngay, không cần thêm một vòng mạng chỉ để hỏi lại điều server vừa nói.
           *   `lastClaim` CỐ Ý không được đặt: phần thưởng đã trao ở lượt TRƯỚC, ăn mừng lại là
           *   nói dối bé rằng bé vừa được thưởng thêm.
           */
          set({
            quests: current.map((quest) =>
              quest.id === questId ? { ...quest, completed: true, claimed: true } : quest,
            ),
          });
          /**
           * ⚠️ VẪN phải đồng bộ ví. Lý do: một lần bấm TRƯỚC ĐÓ đã thành công ở server nhưng
           *   phản hồi không về tới client (mất mạng, app bị đóng). Nếu không đọc lại, ví trên
           *   màn hình thiếu đúng phần thưởng ấy — mãi mãi, vì không có gì khác kích hoạt nạp lại.
           */
          useRewardStore.getState().reload(childId);
        }
      } catch (error) {
        if (!stillSameChild()) return;
        set({ error: error instanceof Error ? error.message : String(error) });
        /**
         * ⚠️ `QUEST_NOT_COMPLETE` NGHĨA LÀ DANH SÁCH CỦA TA ĐÃ CŨ: server vừa nói "nhiệm vụ này
         *   chưa xong", tức tiến độ trên màn hình khác với tiến độ thật. Nạp lại để bé thấy thanh
         *   tiến độ đúng — nếu không, nút sẽ tiếp tục sáng và bé bấm mãi mà không hiểu vì sao.
         */
        if (error instanceof ApiClientError && error.code === 'QUEST_NOT_COMPLETE') {
          void fetchQuests(childId);
        }
      } finally {
        if (stillSameChild()) {
          const { [questId]: _done, ...rest } = get().claiming;
          set({ claiming: rest });
        }
      }
    },

    dismissClaim: () => {
      set({ lastClaim: null });
    },

    reset: () => {
      set(emptyState());
    },
  };
});

/** Chỉ dùng trong test. */
export function __resetQuestStoreForTests(): void {
  useQuestStore.setState(emptyState());
}
