/**
 * RubyLingo — `QuestsPage`: BẢNG NHIỆM VỤ (màn hình M9).
 *
 * ⭐ BA TẦNG, THEO ĐÚNG THỨ TỰ "GẦN → XA" ĐÃ CHỐT TRONG NỘI DUNG:
 *   1. **Nhiệm vụ hôm nay** — 3 việc bé làm được ngay trong buổi này. Reset mỗi ngày.
 *   2. **Nhiệm vụ tuần này** — vài việc cần rải ra vài ngày. Reset đầu tuần.
 *   3. **Cột mốc** — những việc KHÔNG BAO GIỜ hết hạn (bài đầu tiên, cả chủ đề, đạt cấp…).
 *   Thứ tự này không phải để đẹp: nhiệm vụ ngày là thứ bé CÓ THỂ xong ngay, nên nó phải nằm
 *   trên cùng. Bé mở màn hình và thấy việc mình làm được — không phải việc còn xa.
 *
 * ⚠️⚠️ MÀN HÌNH NÀY KHÔNG TỰ ĐƯỢC CẬP NHẬT THEO TIẾN ĐỘ HỌC — ĐÓ LÀ RỦI RO LỚN NHẤT CỦA NÓ:
 *   Tiến độ nhiệm vụ do SERVER tính từ `lesson_progress` / `daily_stats` / túi sticker / cấp…
 *   (xem `server/services/QuestService.ts`). Client chỉ giữ một BẢN SAO của lần đọc gần nhất.
 *   Nên nếu bé học xong một bài rồi quay lại màn này trong cùng phiên, số trên màn hình CÓ THỂ
 *   đã cũ. Hai việc giữ cho nó không sai lâu:
 *     • `load()` **có** nạp lại khi lần trước hỏng (cổng "đã có dữ liệu thì thôi" chỉ đóng khi
 *       lần nạp trước thành công).
 *     • `QUEST_NOT_COMPLETE` (server nói "chưa xong") tự kích hoạt nạp lại — xem `questStore`.
 *   Nhưng nếu một ngày nào đó thấy nút sáng mà bấm không được, `questStore.load()` là chỗ sửa.
 *
 * ⚠️⚠️ HAI LỚP ĂN MỪNG, VÀ THỨ TỰ CỦA CHÚNG LÀ CHỦ Ý:
 *   1. `RewardBurst` — **túi quà** 🎁 của nhiệm vụ vừa nhận (⭐/🌰/XP/huy hiệu/**sticker mới**).
 *      Sticker mới (T069.2) hiện kèm ICON + TÊN THẬT (tra `getSticker`) — xem `celebrationRewards`.
 *   2. `LevelUpOverlay` — nếu XP của lượt nhận đó đẩy bé qua một cấp.
 *   Túi quà phải hiện TRƯỚC: nó là thứ bé vừa tự tay bấm lấy, còn lên cấp là hệ quả đi kèm. Đảo
 *   lại thì lời chúc mừng lên cấp đến trước phần quà bé đang chờ, và bé phải bấm hai lần mới
 *   thấy thứ mình vừa yêu cầu.
 *
 *   ⚠️ `lastClaim` là NGUỒN DUY NHẤT của `levelUp` (xem `ClaimCelebration`), và `dismissClaim()`
 *      xoá nó. Nên `levelUp` phải được CHUYỂN sang state của trang TRƯỚC khi xoá — xem
 *      `closeCelebration`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { QUEST_TIERS } from '@shared/content/quests.js';
import { getSticker } from '@shared/content/badges.js';
import type { QuestTier, RewardGrant } from '@shared/types/reward.js';

import { BigButton } from '../../components/common/BigButton.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { QuestCard } from '../../components/common/QuestCard.js';
import { ResponsiveGrid } from '../../components/common/ResponsiveGrid.js';
import { StreakFlame } from '../../components/common/StreakFlame.js';
import { LevelUpOverlay } from '../../components/effects/LevelUpOverlay.js';
import type { LevelUpInfo } from '../../components/effects/LevelUpOverlay.js';
import { RewardBurst } from '../../components/effects/RewardBurst.js';
import { useClaimQuest, useQuests, useQuestsLifecycle } from '../../hooks/useQuests.js';
import type { ClaimCelebration } from '../../store/questStore.js';
import { useQuestStore } from '../../store/questStore.js';

/** Khoá từ điển cho tiêu đề từng tầng. Tách khỏi `QUEST_TIERS` để hai thứ không lệch nhau. */
const TIER_LABEL_KEY: Record<QuestTier, string> = {
  daily: 'quest.daily',
  weekly: 'quest.weekly',
  milestone: 'quest.milestone',
};

/**
 * Những loại quà mà `RewardBurst` hiện kèm SỐ LƯỢNG ("+10 Sao").
 * Huy hiệu / sticker / vật phẩm chỉ hiện tên, nên chúng đi đường khác — xem `celebrationRewards`.
 */
const COUNTABLE_GRANT_KINDS: ReadonlySet<RewardGrant['kind']> = new Set([
  'stars',
  'acorns',
  'xp',
]);

/**
 * Danh sách quà để mở túi quà, dựng từ thứ THẬT SỰ được trao ở lượt này.
 *
 * ⚠️⚠️ KHÔNG ĐƯỢC LẤY NGUYÊN `quest.rewards`. Đây là chỗ dễ ăn mừng sai nhất của cả màn hình.
 *   `quest.rewards` là DANH MỤC khai báo (nội dung tĩnh), còn `badgesEarned` là phần CHÊNH thật
 *   sự mới được trao ở lượt này. Một nhiệm vụ tuần khai báo thưởng huy hiệu "Chăm chỉ"; nếu bé
 *   đã có huy hiệu đó từ tuần trước, server KHÔNG trao lại (đã có rồi) và `badgesEarned` rỗng —
 *   nhưng `quest.rewards` vẫn liệt kê nó. Lấy nguyên `quest.rewards` nghĩa là mở túi quà và nói
 *   *"Bé nhận được Huy hiệu mới!"* cho một huy hiệu bé đã có từ lâu. Bé sẽ đi tìm nó trong bộ
 *   sưu tập và không thấy gì mới — một lời nói dối nhỏ, nhưng đúng loại lời nói dối làm trẻ mất
 *   tin vào phần thưởng.
 *
 *   ⭐ Tiền tệ và XP thì ngược lại: chúng LUÔN được trao đúng như khai báo (server cộng thẳng từ
 *   `quest.rewards`), nên lấy từ đó là chính xác.
 *
 * ⭐ STICKER MỚI (T069.2) ĐI CÙNG ĐƯỜNG: lấy từ `claim.stickerIds` (phần CHÊNH thật sự vừa mở),
 *   KHÔNG từ `quest.rewards`. Cùng cái bẫy như huy hiệu ở trên — xem ghi chú trong thân hàm.
 *   Và cả ý nghĩa của sticker là "mở ra mới biết là con gì", nên nó PHẢI được ăn mừng: trao âm
 *   thầm (chỉ ghi vào sổ) phá đúng cái thú vị đó.
 */
function celebrationRewards(claim: ClaimCelebration): RewardGrant[] {
  const earned = claim.quest.rewards.filter((grant) => COUNTABLE_GRANT_KINDS.has(grant.kind));
  const badges: RewardGrant[] = claim.badgesEarned.map((refId) => ({ kind: 'badge', refId }));
  /**
   * ⚠️⚠️ KHÔNG lấy sticker từ `claim.quest.rewards`.
   *   `quest.rewards` là ĐỊNH NGHĨA (một nhiệm vụ mốc KHAI BÁO thưởng sticker), còn `stickerIds`
   *   là sticker MỚI THỰC SỰ vừa mở ở lượt này. Lấy từ `quest.rewards` sẽ:
   *     • ăn mừng lại một sticker bé đã có từ đường khác (nói dối bé rằng vừa được thêm), VÀ
   *     • khiến túi quà "có gì đó" ngay cả khi thật ra chẳng mở được gì — phá luôn cổng tự-đóng
   *       cho ca nhiệm vụ chỉ-thưởng-sticker (xem `useEffect` tự đóng bên dưới).
   */
  const stickers: RewardGrant[] = claim.stickerIds.map((refId) => ({ kind: 'sticker', refId }));
  return [...earned, ...badges, ...stickers];
}

export function QuestsPage() {
  const { t } = useTranslation();

  /**
   * ⭐ NẠP Ở ĐÂY, KHÔNG Ở `AppShell` — màn Nhiệm vụ là màn DUY NHẤT dùng danh sách này, nên nạp ở
   *   `AppShell` sẽ tốn một request mỗi lần bé mở app chỉ để chơi một game. Xem `useQuests.ts`.
   */
  useQuestsLifecycle();

  const { childId, quests, streak, isHydrated } = useQuests();
  const { claim, isClaiming, lastClaim, dismissClaim } = useClaimQuest();
  const load = useQuestStore((s) => s.load);

  /**
   * Cấp vừa lên, đang chờ hiện nốt sau khi bé đóng lớp túi quà.
   *
   * ⚠️ PHẢI LÀ STATE CỦA TRANG, VÀ PHẢI ĐƯỢC ĐẶT **TRƯỚC** `dismissClaim()` — xem ghi chú đầu file.
   */
  const [pendingLevelUp, setPendingLevelUp] = useState<LevelUpInfo | null>(null);

  const burstRewards = useMemo(
    () => (lastClaim ? celebrationRewards(lastClaim) : null),
    [lastClaim],
  );

  /**
   * Tra TÊN + ICON cho một khoản quà, để túi quà nói được "vừa mở được con gì".
   *
   * ⚠️ CHỈ tra cho STICKER — cố ý KHÔNG đụng tới huy hiệu. Huy hiệu vẫn hiện nhãn chung
   *    ("Huy hiệu mới") y như trước; đổi nhãn đó là thay hành vi đã được duyệt ở T069 và làm lệch
   *    các test hiện có. Việc của T069.2 là LÀM STICKER HIỆN RA, không phải viết lại huy hiệu.
   *
   * ⭐ Vì sao cần ICON THẬT: icon dự phòng của `RewardBurst` cho sticker là 🎨 (bảng pha màu) —
   *    bé mở được con Voi mà thấy 🎨 thì không biết mình vừa được con gì. Tra `getSticker` cho
   *    đúng hình + tên, đúng tinh thần "mở ra mới biết là con gì".
   */
  const resolveStickerLabel = (grant: RewardGrant): string | null => {
    if (grant.kind !== 'sticker' || !grant.refId) return null;
    const sticker = getSticker(grant.refId);
    return sticker ? t('reward.gotStickerName', { name: sticker.name_vi }) : null;
  };
  const resolveStickerIcon = (grant: RewardGrant): string | null => {
    if (grant.kind !== 'sticker' || !grant.refId) return null;
    return getSticker(grant.refId)?.icon ?? null;
  };

  const closeCelebration = useCallback(() => {
    // Đọc `levelUp` TRƯỚC khi xoá `lastClaim` — sau đó nó không còn tồn tại ở đâu nữa.
    const levelUp = lastClaim?.levelUp ?? null;
    dismissClaim();
    if (levelUp) setPendingLevelUp(levelUp);
  }, [lastClaim, dismissClaim]);

  /**
   * ⚠️ PHÒNG THỦ: `RewardBurst` KHÔNG hiện gì khi danh sách rỗng, và khi đó `onDismiss` không bao
   *    giờ được gọi ⇒ `lastClaim` không bao giờ được xoá, và màn lên cấp (nếu lượt nhận đó có lên
   *    cấp) KẸT LẠI VĨNH VIỄN. Nội dung hiện tại không thể rơi vào đây — `questsFileSchema` buộc
   *    `rewards` có ít nhất một phần tử, và cả 10 nhiệm vụ đều thưởng ⭐ — nhưng một nhiệm vụ chỉ
   *    thưởng huy hiệu trong tương lai sẽ rơi đúng vào đó. Tự đóng để không bao giờ mắc kẹt.
   */
  useEffect(() => {
    if (lastClaim && burstRewards !== null && burstRewards.length === 0) closeCelebration();
  }, [lastClaim, burstRewards, closeCelebration]);

  const allDailyClaimed =
    quests !== null && quests.some((q) => q.tier === 'daily')
      ? quests.filter((q) => q.tier === 'daily').every((q) => q.claimed)
      : false;

  const celebration = (
    <>
      {/*
        Lớp 1 — TÚI QUÀ. `RewardBurst` nhận `rewards = null` nghĩa là "không có gì để ăn mừng";
        nó tự tắt sau 4 giây HOẶC khi bé chạm vào bất kỳ đâu (xem ghi chú đầu `RewardBurst`).
      */}
      <RewardBurst
        rewards={burstRewards}
        title={t('quest.claimTitle')}
        onDismiss={closeCelebration}
        resolveLabel={resolveStickerLabel}
        resolveIcon={resolveStickerIcon}
      />

      {/* Lớp 2 — LÊN CẤP (nếu lượt nhận vừa rồi đẩy bé qua một cấp). */}
      <LevelUpOverlay levelUp={pendingLevelUp} onClose={() => setPendingLevelUp(null)} />
    </>
  );

  // --- Chưa đọc xong danh sách lần nào --------------------------------------
  //
  // ⚠️ PHẢI PHÂN BIỆT "CHƯA ĐỌC ĐƯỢC" VỚI "ĐỌC RỒI VÀ KHÔNG CÓ GÌ" — cùng lý do như `StreakFlame`
  //    và `CounterChip`: hiện một màn hình trống cho bé trong lúc dữ liệu đang về khiến bé tưởng
  //    mình không có nhiệm vụ nào. Nên: chưa đọc được ⇒ "đang chuẩn bị", không phải "rỗng".
  if (!isHydrated) {
    return <EmptyState icon="🐵" title={t('app.loading')} description={t('quest.loadingHint')} />;
  }

  if (quests === null) {
    /**
     * ⚠️ `questStore` bảo đảm: sau khi `hydrated`, `quests` là mảng HOẶC `null` — và `null` chỉ
     *    xảy ra khi lần nạp vừa rồi HỎNG (mỗi lần nạp ghi đúng một trong hai: `quests` hoặc
     *    `error`). Nên nhánh này chính là nhánh "không đọc được danh sách", không cần đọc thêm
     *    `error`. Nếu một ngày `questStore` đổi quy ước đó, chỗ này là chỗ phải sửa theo.
     *
     * ⚠️ KHÔNG hiện `error` cho bé. Đây là lỗi kỹ thuật (mạng chậm, server bận) — bé không làm gì
     *    sai và không cần biết mã lỗi. Chỉ cần một lời nói thật + một nút thử lại.
     *    `load()` chấp nhận nạp lại sau khi hỏng (cổng "đã có dữ liệu" chỉ đóng khi thành công),
     *    nên nút này thật sự có tác dụng.
     */
    return (
      <EmptyState
        icon="📋"
        title={t('quest.loadErrorTitle')}
        description={t('quest.loadErrorHint')}
        action={
          <BigButton onClick={() => childId && void load(childId)}>{t('app.retry')}</BigButton>
        }
      />
    );
  }

  if (quests.length === 0) {
    return <EmptyState icon="📋" title={t('quest.emptyTitle')} description={t('quest.emptyHint')} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="text-kid-xl text-ink">{t('quest.title')}</h1>
        <p className="text-kid-sm text-ink-soft">{t('quest.intro')}</p>
        {/*
          🔥 Chuỗi ngày đặt NGAY DƯỚI tiêu đề, không nhét vào một thẻ riêng: nó là bối cảnh cho
          toàn bộ danh sách ("hôm nay là ngày thứ mấy"), không phải một mục để bấm vào.
        */}
        {streak && <StreakFlame currentStreak={streak.currentStreak} className="self-start" />}
      </header>

      {/*
        🎉 Xong hết nhiệm vụ ngày ⇒ một lời khen. `role="status"` để trình đọc màn hình cũng nghe
        thấy — với bé khiếm thị, khối này xuất hiện mà không có gì báo thì coi như không có.
      */}
      {allDailyClaimed && (
        <p
          role="status"
          className="rounded-card border-2 border-success bg-success-soft px-4 py-3 text-kid-md font-bold text-ink"
        >
          🎉 {t('quest.allDone')}
        </p>
      )}

      {QUEST_TIERS.map((tier) => {
        const tierQuests = quests.filter((quest) => quest.tier === tier);
        // Tầng không có nhiệm vụ nào ⇒ không vẽ tiêu đề rỗng. Một tiêu đề đứng một mình trông
        // như app bị thiếu dữ liệu.
        if (tierQuests.length === 0) return null;

        return (
          <section key={tier}>
            <h2 className="mb-3 text-kid-lg text-ink">{t(TIER_LABEL_KEY[tier])}</h2>

            {/*
              `minItemWidth` 300: thẻ nhiệm vụ có một nút toàn dòng ("Nhận thưởng"). Dưới 300px thì
              nhãn nút xuống dòng và thẻ cao gấp rưỡi — trên laptop 880px vẫn chỉ được 2 cột, đúng
              như mong muốn.
            */}
            <ResponsiveGrid as="ul" minItemWidth={300} gap={12}>
              {tierQuests.map((quest) => (
                <li key={quest.id}>
                  <QuestCard
                    quest={quest}
                    claiming={isClaiming(quest.id)}
                    // `void`: `claim` không bao giờ ném (lỗi được ghi vào store), nhưng nó trả
                    // Promise — chỗ gọi là một `onClick`, không ai `await` được ở đó.
                    onClaim={() => void claim(quest.id)}
                  />
                </li>
              ))}
            </ResponsiveGrid>
          </section>
        );
      })}

      {/*
        ⚠️ KHÔNG có đồng hồ đếm ngược, và đó là chủ ý — `GAME-REWARD-DESIGN.md` §6.5: *"Không có
        đếm ngược gây áp lực. Reset nhiệm vụ ngày diễn ra lặng lẽ (không thông báo 'sắp hết giờ!')"*.
        Đây là câu duy nhất nói về việc reset, và nó nói về TƯƠNG LAI (ngày mai có việc mới), không
        phải về một hạn chót đang tới gần.
      */}
      <p className="text-center text-kid-xs text-ink-faint">{t('quest.resetHint')}</p>

      {celebration}
    </div>
  );
}
