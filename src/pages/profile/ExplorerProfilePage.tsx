/**
 * RubyLingo — `ExplorerProfilePage`: Hồ sơ nhà thám hiểm (M13, T071).
 *
 * ⭐ HAI THANH TIẾN ĐỘ ĐỘC LẬP — VÀ SỰ ĐỘC LẬP LÀ CẢ Ý NGHĨA CỦA MÀN HÌNH NÀY:
 *   • Thanh XP đo NỖ LỰC của bé (trả lời đúng, chơi game) → tăng nhanh. Dùng `XpBar` + `getXpProgress`.
 *   • Tiến hoá của linh vật đo SỐ TỪ ĐÃ HỌC → tăng chậm, không mua được bằng tiền.
 *   Hai nguồn động lực khác nhau: "hôm nay con giỏi" và "con đang lớn lên". Gộp chúng thành một
 *   thanh là xoá mất một trong hai. Xem ghi chú đầu `shared/content/levels.ts`.
 *
 * ⚠️⚠️ PHẦN LINH VẬT DÙNG `snapshot.pet.wordsLearned` — CON SỐ SERVER TRẢ, KHÔNG TỰ ĐẾM Ở CLIENT.
 *   Server ĐÃ dùng chính con số đó để suy ra `pet.evolutionStage` (xem `RewardService.readPet`),
 *   nên thanh tiến độ và hình dáng Momo KHÔNG THỂ nói khác nhau. Tự đếm từ ở client (từ
 *   `progressStore`) là NGUỒN SỰ THẬT THỨ HAI, và nó lệch đúng ở ca bé chơi offline rồi mới đồng
 *   bộ, hoặc mở app trên thiết bị thứ hai chưa có dữ liệu. Vì thế ô thống kê "Từ đã học" CŨNG lấy
 *   từ server — một màn hình không được có hai con số khác nhau cho cùng một thứ.
 *
 * ⚠️ ĐIỂM VÀO LÀ `TopBar`, KHÔNG PHẢI `BottomNav`:
 *   `BottomNav` đã đủ 5 mục và 5 là TRẦN của dự án (xem `BottomNav.tsx`). Thêm mục thứ sáu sẽ
 *   đẩy bề rộng mỗi mục trên màn 320px xuống dưới vùng chạm tối thiểu cho tay trẻ con. Nên nút
 *   Hồ sơ nằm ở `TopBar` (prop `profileTo`), tách hẳn khỏi nút "đổi hồ sơ bé" — hai việc khác nhau.
 *
 * ⚠️ KHÔNG NẠP GÌ Ở ĐÂY: ví/huy hiệu do `useRewardsLifecycle()` nạp ở `AppShell`, tiến độ do
 *    `useProgressLifecycle()`. Trang này chỉ ĐỌC. Không có lời gọi mạng mới, không endpoint mới.
 */

import { useTranslation } from 'react-i18next';

import { BADGES, badgesForPhase } from '@shared/content/badges.js';
import { EVOLUTION_STAGES, stageDefinition } from '@shared/content/levels.js';
import { completedLessonIds, masteredWordIds } from '@shared/progress-merge.js';

import { BadgeCard } from '../../components/common/BadgeCard.js';
import { BigButton } from '../../components/common/BigButton.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { ResponsiveGrid } from '../../components/common/ResponsiveGrid.js';
import { XpBar } from '../../components/common/XpBar.js';
import { getAvatar } from '../../data/avatars.js';
import { useProgress } from '../../hooks/useProgress.js';
import { useRewards } from '../../hooks/useRewards.js';
import { useRewardStore } from '../../store/rewardStore.js';
import { useActiveChild } from '../../store/sessionStore.js';

export function ExplorerProfilePage() {
  const { t } = useTranslation();

  const child = useActiveChild();
  const { childId, snapshot, isHydrated } = useRewards();
  const reload = useRewardStore((s) => s.reload);
  const { snapshot: progress, isHydrated: progressHydrated } = useProgress();

  // --- Chưa nạp xong hồ sơ (ví/huy hiệu) ------------------------------------
  //
  // ⚠️ PHẢI PHÂN BIỆT "CHƯA ĐỌC ĐƯỢC" VỚI "ĐỌC RỒI VÀ RỖNG" — cùng lý do như `PetHousePage`.
  //    Vẽ hồ sơ khi chưa biết cấp/huy hiệu nghĩa là hiện toàn số 0 và "chưa có gì" trong tích
  //    tắc đầu — một lời nói dối cụ thể với bé vừa mở app.
  if (!isHydrated) {
    return <EmptyState icon="🧭" title={t('app.loading')} />;
  }

  if (snapshot === null) {
    /**
     * ⚠️ Hỏng khi nạp ⇒ chỉ hiện một lời thật + nút thử lại. KHÔNG lộ lỗi kỹ thuật cho bé (bé
     *    không làm gì sai). `reload()` bỏ qua cổng "đã có dữ liệu thì thôi" của `load()`, nên nút
     *    này có tác dụng thật.
     */
    return (
      <EmptyState
        icon="📦"
        title={t('profile.loadErrorTitle')}
        description={t('profile.loadErrorHint')}
        action={<BigButton onClick={() => childId && reload(childId)}>{t('app.retry')}</BigButton>}
      />
    );
  }

  // ---------------------------------------------------------------------------

  const avatar = child ? getAvatar(child.avatarId) : undefined;

  // --- Huy hiệu -------------------------------------------------------------
  //
  // ⭐ HIỆN ĐỦ Ô MVP (kể cả ô chưa kiếm) + MỌI HUY HIỆU ĐÃ KIẾM Ở GIAI ĐOẠN KHÁC.
  //   Vì sao không chỉ hiện những cái đã kiếm: một bé mới mở hồ sơ ra thấy trống trơn là điều
  //   `EmptyState` sinh ra để tránh. Vì sao không chỉ hiện MVP: huy hiệu cấp XP (Người bạn của
  //   thú rừng…) thuộc giai đoạn p1/p2 nhưng VẪN có thể đã được trao — giấu chúng đi là lấy mất
  //   thứ bé đã kiếm được, trái luật "không lấy gì của bé".
  const earnedIds = new Set(snapshot.badges);
  const badgeCatalogue = [
    ...badgesForPhase('mvp'),
    ...BADGES.filter((badge) => earnedIds.has(badge.id) && badge.phase !== 'mvp'),
  ];
  const badgesDone = badgeCatalogue.filter((badge) => earnedIds.has(badge.id)).length;

  // --- Tiến hoá linh vật -----------------------------------------------------
  //
  // `stageDefinition` tra id SERVER trả ra `{ name_vi, icon }` (và NÉM nếu id lạ — chủ ý, xem
  // `levels.ts`). Giai đoạn kế tiếp suy từ `EVOLUTION_STAGES` (đã sắp theo số từ tăng dần).
  const currentStage = stageDefinition(snapshot.pet.evolutionStage);
  const currentIndex = EVOLUTION_STAGES.findIndex((stage) => stage.stage === currentStage.stage);
  const nextStage = currentIndex >= 0 ? (EVOLUTION_STAGES[currentIndex + 1] ?? null) : null;

  /**
   * Số từ SERVER đếm — dùng cho CẢ thanh tiến độ lẫn ô thống kê "Từ đã học".
   * ⚠️ KHÔNG tự đếm lại ở client: xem ghi chú đầu tệp về vì sao đó là nguồn sự thật thứ hai.
   */
  const wordsLearned = snapshot.pet.wordsLearned;
  /** Số từ phải học để đi hết giai đoạn HIỆN TẠI (mẫu số của thanh). `0` khi đã ở đỉnh. */
  const stageSpan = nextStage ? nextStage.wordsRequired - currentStage.wordsRequired : 0;
  /** Số từ bé đã học TRONG giai đoạn hiện tại (tử số). Kẹp sàn 0 phòng dữ liệu lệch. */
  const wordsIntoStage = Math.max(0, wordsLearned - currentStage.wordsRequired);
  /** Còn bao nhiêu từ nữa thì Momo lớn hơn. */
  const wordsRemaining = nextStage ? Math.max(0, nextStage.wordsRequired - wordsLearned) : 0;
  // Đã ở giai đoạn cuối ⇒ thanh ĐẦY (không rỗng) — thanh rỗng ở đỉnh trông như vừa tụt hạng.
  const stageRatio = nextStage ? Math.min(1, Math.max(0, wordsIntoStage / stageSpan)) : 1;
  const stageText = nextStage ? t('pet.nextStage', { count: wordsRemaining }) : t('pet.maxStage');

  // --- Thống kê -------------------------------------------------------------
  //
  // ⚠️ "Bài đã xong" và "Từ đã nhớ chắc" chỉ có ở tiến độ trong máy ⇒ chưa nạp xong thì hiện "—"
  //    (`profile.unknown`), KHÔNG hiện 0. ("Từ đã học" lấy từ server — xem khối trên.)
  const showProgress = progressHydrated;
  const lessonsDone = showProgress ? completedLessonIds(progress).size : null;
  const wordsMastered = showProgress ? masteredWordIds(progress).size : null;

  const countText = (value: number | null): string =>
    value === null ? t('profile.unknown') : String(value);

  /**
   * ⚠️ ICON THỐNG KÊ KHÔNG ĐƯỢC TRÙNG ICON BỘ SƯU TẨM / VẬT PHẨM / GIAI ĐOẠN.
   *    Bé học "mỗi hình là một thứ" — một emoji vừa là huy hiệu vừa là ô thống kê sẽ làm bé
   *    tưởng mình đã có huy hiệu đó. Sáu icon dưới đây được chọn KHÔNG nằm trong
   *    `badges.json`, `stickers.json`, `shop-items.json` hay bốn giai đoạn linh vật.
   */
  const stats: readonly { icon: string; label: string; value: string }[] = [
    { icon: '🏅', label: t('profile.statBadges'), value: countText(snapshot.badges.length) },
    { icon: '🏷️', label: t('profile.statStickers'), value: countText(snapshot.stickers.length) },
    { icon: '📘', label: t('profile.statLessons'), value: countText(lessonsDone) },
    // "Từ đã học" lấy từ SERVER (`pet.wordsLearned`) — cùng con số với thanh tiến độ Momo ở trên.
    { icon: '📖', label: t('profile.statWords'), value: String(wordsLearned) },
    { icon: '🧠', label: t('profile.statMastered'), value: countText(wordsMastered) },
    {
      icon: '📅',
      label: t('profile.statStreak'),
      value: `${snapshot.streak.currentStreak} ${t('kid.days')}`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        {/* Avatar của bé — trang trí, tên bé đã ở ngay bên cạnh nên screen reader không cần đọc. */}
        <span
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-brand-soft bg-surface-raised text-[32px] leading-none"
        >
          {avatar?.icon ?? '🐾'}
        </span>
        <div className="min-w-0">
          {/* Bé là tiêu đề của hồ sơ — đây là HỒ SƠ CỦA BÉ, không phải một màn hình chung. */}
          <h1 className="truncate text-kid-xl text-ink">{child?.nickname ?? t('profile.title')}</h1>
          <p className="truncate text-kid-sm text-ink-soft">{t('profile.title')}</p>
        </div>
      </header>

      {/* --- Thanh XP của bé (thanh tiến độ thứ nhất) ------------------------- */}
      <section aria-labelledby="profile-xp-heading" className="flex flex-col gap-2">
        <h2 id="profile-xp-heading" className="text-kid-lg text-ink">
          {t('profile.xpSection')}
        </h2>
        {/* `full` variant: tên cấp + số cấp + thanh + câu "còn bao nhiêu nữa là lên cấp". */}
        <XpBar xp={snapshot.xp.xp} variant="full" />
      </section>

      {/* --- Tiến hoá linh vật (thanh tiến độ thứ hai, ĐỘC LẬP với XP) --------- */}
      <section aria-labelledby="profile-pet-heading" className="flex flex-col gap-2">
        <h2 id="profile-pet-heading" className="text-kid-lg text-ink">
          {t('profile.petSection', { pet: t('pet.name') })}
        </h2>

        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="text-[40px] leading-none">
            {currentStage.icon}
          </span>
          <div className="min-w-0 flex-1">
            {/*
              ⚠️ Tên giai đoạn lấy từ DỮ LIỆU (`xp-levels.json`), KHÔNG từ i18n — cùng lý do như
              `PetAvatar`: khai lại là tạo nguồn sự thật thứ hai, và nó lệch đúng ngày ai đó sửa JSON.
            */}
            <p className="text-kid-md font-bold text-ink">{currentStage.name_vi}</p>
            {/*
              Đích kế tiếp, để bé biết mình đang tiến tới đâu. Không có khi Momo đã ở giai đoạn cuối.
            */}
            {nextStage !== null && (
              <p className="text-kid-xs text-ink-soft">
                {t('profile.petNextLabel')}{' '}
                <span aria-hidden="true">{nextStage.icon}</span>{' '}
                <span>{nextStage.name_vi}</span>
              </p>
            )}
          </div>
        </div>

        {/*
          Thanh tiến độ tới giai đoạn kế tiếp — cùng khuôn với `XpBar`: `aria-valuetext` mang CÂU
          đầy đủ ("Trứng. Còn 20 từ nữa để lớn hơn"), vì "5/20" không nói được gì với bé 7 tuổi.
          ⚠️ `stageSpan` bằng 0 chỉ khi Momo đã ở giai đoạn cuối — lúc đó cố tình dùng `1` làm mẫu
          số để KHÔNG chia cho 0, và thanh đã đầy sẵn (`stageRatio = 1`).
        */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={stageSpan || 1}
          aria-valuenow={stageSpan ? wordsIntoStage : 1}
          aria-valuetext={`${currentStage.name_vi}. ${stageText}`}
          className="h-3.5 w-full overflow-hidden rounded-pill bg-line"
        >
          <div
            className="h-full rounded-pill bg-brand transition-[width] duration-500 ease-out"
            style={{ width: `${stageRatio * 100}%` }}
          />
        </div>

        <p className="text-kid-xs text-ink-soft">{stageText}</p>
      </section>

      {/* --- Huy hiệu đã kiếm ------------------------------------------------- */}
      <section aria-labelledby="profile-badges-heading" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="profile-badges-heading" className="text-kid-lg text-ink">
            {t('profile.badgesSection')}
          </h2>
          <span className="shrink-0 text-kid-xs font-bold text-ink-soft">
            {t('profile.badgesCount', { done: badgesDone, total: badgeCatalogue.length })}
          </span>
        </div>

        {/* Chưa kiếm được huy hiệu nào ⇒ một lời hẹn nhẹ, không trách. */}
        {badgesDone === 0 && (
          <p className="rounded-card border-2 border-line bg-surface-raised px-4 py-3 text-kid-sm text-ink-soft">
            {t('profile.badgesEmpty')}
          </p>
        )}

        {/*
          Dùng lại `BadgeCard` (T070): ô ĐÃ kiếm hiện icon đầy màu, ô CHƯA kiếm hiện `?` — emoji
          thật KHÔNG nằm trong DOM. Nhờ vậy hồ sơ không lộ phần thưởng tương lai.
        */}
        <ResponsiveGrid as="ul" minItemWidth={160} gap={12}>
          {badgeCatalogue.map((badge) => (
            <li key={badge.id}>
              <BadgeCard item={badge} earned={earnedIds.has(badge.id)} />
            </li>
          ))}
        </ResponsiveGrid>
      </section>

      {/* --- Thành tích ------------------------------------------------------- */}
      <section aria-labelledby="profile-stats-heading" className="flex flex-col gap-3">
        <h2 id="profile-stats-heading" className="text-kid-lg text-ink">
          {t('profile.statsSection')}
        </h2>
        <ResponsiveGrid as="ul" minItemWidth={150} gap={12}>
          {stats.map((stat) => (
            <li
              key={stat.label}
              className="flex flex-col items-center gap-1 rounded-card border-2 border-line bg-surface p-3 text-center"
            >
              <span aria-hidden="true" className="text-[32px] leading-none">
                {stat.icon}
              </span>
              <span className="text-kid-lg font-bold tabular-nums text-ink">{stat.value}</span>
              <span className="text-kid-xs text-ink-soft">{stat.label}</span>
            </li>
          ))}
        </ResponsiveGrid>
      </section>
    </div>
  );
}
