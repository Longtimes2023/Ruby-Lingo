/**
 * RubyLingo — `JourneyMapPage`: màn hình chính của bé (đường dẫn `/`).
 *
 * ⭐ ĐÂY LÀ "BẢN ĐỒ HÀNH TRÌNH" — MÀN HÌNH QUAN TRỌNG NHẤT CỦA ỨNG DỤNG.
 *   Bé mở app, thấy mình đang ở đâu trên hành trình, và biết bấm vào đâu tiếp theo. Mọi thứ
 *   khác (game, cửa hàng, thú cưng) đều bắt đầu từ đây.
 *
 * ⭐ BA KHỐI, THEO ĐÚNG THỨ TỰ BÉ CẦN:
 *   1. Bé là ai + đang có gì  (thẻ chào: avatar, cấp, XP, ⭐🌰❤️🔥)
 *   2. Bé đã đi được bao xa   (dải tóm tắt: số từ đã học)
 *   3. Đi tiếp ở đâu          (bản đồ: 11 chặng)
 *
 * ⭐ MÀN NÀY KHÔNG CÒN LỐI NÀO CHO BỐ MẸ — VÀ ĐÓ LÀ ĐÚNG.
 *   Trước đây có một khối TẠM (thêm bé + đăng xuất) vì khu vực phụ huynh chưa tồn tại. Nó đã được
 *   GỠ sau khi `ParentSettingsPage` có chức năng thêm bé: màn hình của bé giờ chỉ có việc của bé.
 *   Lối vào khu phụ huynh là mục ⚙️ "Bố mẹ" trong `BottomNav` (`/parent`, có cổng PIN) — cố định,
 *   nên không mất lối thoát.
 *
 * ⚠️ KHỐI 2 KHÔNG HIỆN GÌ KHI CHƯA NẠP XONG TIẾN ĐỘ.
 *   Xem ghi chú ở `useThemeAccess`: hiện "0 từ" rồi nhảy lên "37 từ" khiến bé tưởng mình vừa
 *   mất tiến độ. Thà không hiện gì trong vài chục mili giây còn hơn hiện một con số sai.
 *
 * ⚠️ KHỐI 1 VẪN HIỆN "—" CHO ⭐🌰❤️🔥 VÌ `useChildStatus()` CHƯA CÓ DỮ LIỆU THẬT.
 *   Ví và mức vui vẻ của linh vật thuộc Nhóm 6 (`GET /api/children/:id/rewards`). Các bộ đếm đã
 *   có sẵn chế độ "chưa biết" (hiện "—") nên không có số liệu giả nào bị hiện ra.
 */

import { useTranslation } from 'react-i18next';

import { getAvatar } from '../data/avatars.js';
import { getXpProgress } from '../data/xp-levels.js';
import { useChildStatus } from '../hooks/useChildStatus.js';
import { useThemeAccess } from '../hooks/useThemeAccess.js';
import { useThemeMap } from '../hooks/useContent.js';
import { HeartMeter } from '../components/common/HeartMeter.js';
import { ProgressBar } from '../components/common/ProgressBar.js';
import { ResponsiveGrid } from '../components/common/ResponsiveGrid.js';
import { StarCounter } from '../components/common/StarCounter.js';
import { StreakFlame } from '../components/common/StreakFlame.js';
import { XpBar } from '../components/common/XpBar.js';
import { ThemeCard } from '../components/journey/ThemeCard.js';
import { useActiveChild } from '../store/sessionStore.js';

export function JourneyMapPage() {
  const { t } = useTranslation();
  const child = useActiveChild();
  const items = useThemeMap();
  const { access, summary, isHydrated } = useThemeAccess();
  const { status } = useChildStatus();

  // `RequireChild` đã bảo đảm có bé trước khi tới đây; nhánh này chỉ để TypeScript yên tâm và
  // để không bao giờ render ra màn hình trắng nếu guard bị gỡ nhầm.
  if (!child) return null;

  const avatar = getAvatar(child.avatarId);
  const level = getXpProgress(status?.xp ?? 0).level;
  const statusPending = status === null;

  return (
    <div className="flex flex-col gap-5">
      {/* --- 1. Thẻ chào: nhân vật + cấp + tiến độ ----------------------------
          ⭐ CHIỀU SÂU ĐẾN TỪ ÁNH SÁNG, KHÔNG TỪ BÓNG.
          Bài học rút ra từ ảnh tham chiếu: một tấm thẻ trắng có `box-shadow` vẫn phẳng. Thứ
          làm nó "nổi" là một vùng sáng mờ phía sau chủ thể (`.blur-2xl`) cộng với avatar được
          đóng khung tròn. Cả hai đều là hình khối, không phải bóng đổ — nên chúng không bị
          trình duyệt làm phẳng đi như bóng, và không tốn thêm ảnh nào.
          Vòng sáng là `pointer-events-none` + `aria-hidden`: nó chỉ để nhìn. */}
      <section className="relative overflow-hidden rounded-card border-2 border-line bg-gradient-to-b from-brand-soft via-brand-tint to-surface p-6 shadow-kid">
        <span
          aria-hidden="true"
          // `bg-brand-pop` (hồng tươi) chứ không phải `bg-brand-soft`: quầng sáng cần ĐẬM hơn
          // nền thẻ thì mới nhìn ra ánh sáng. Hạ `opacity` để nó không thành một mảng màu chỏi.
          className="pointer-events-none absolute -top-24 left-1/2 size-64 -translate-x-1/2 rounded-full bg-brand-pop opacity-30 blur-2xl"
        />

        <div className="relative flex flex-col items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-28 place-items-center rounded-full border-4 border-brand-soft bg-surface text-[72px] leading-none shadow-kid"
          >
            {avatar?.icon ?? '🐾'}
          </span>

          <h1 className="text-kid-xl text-ink">{t('kid.hello', { name: child.nickname })}</h1>

          <p className="text-kid-sm text-ink-soft">
            {level.icon} {level.title_vi} · {t('kid.level')} {level.level}
          </p>

          {/* Thanh XP bản đầy đủ: ở đây có chỗ nên hiện cả câu "còn bao nhiêu nữa". */}
          <XpBar xp={status?.xp ?? 0} variant="full" className="mt-1" />

          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <StarCounter value={status?.stars ?? 0} pending={statusPending} />
            <HeartMeter value={status?.happiness ?? 1} pending={statusPending} />
            <StreakFlame currentStreak={status?.streakDays ?? 0} pending={statusPending} />
          </div>
        </div>
      </section>

      {/* --- 2. Dải tóm tắt: bé đã đi được bao xa ----------------------------- */}
      {isHydrated && (
        <section
          // `role="status"` + `polite`: khi tiến độ vừa đổi (bé vừa học xong một bài rồi quay
          // về), trình đọc màn hình đọc con số mới. Không có nó thì thay đổi này im lặng.
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 rounded-card border-2 border-brand-soft bg-gradient-to-r from-brand-soft to-brand-tint px-4 py-3.5"
        >
          <span aria-hidden="true" className="text-[28px] leading-none">
            🌱
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-kid-md font-bold text-brand">
              {t('map.summary', { done: summary.wordsLearned, total: summary.wordCount })}
            </p>
            {/*
              Thanh tiến độ, KHÔNG phải chấm: 275 từ thì không có "bước hiện tại" nào để đánh dấu.
              Xem ghi chú đầu `ProgressBar` để biết vì sao hai thứ này không thay thế được nhau.
            */}
            <ProgressBar
              className="mt-2"
              value={summary.wordsLearned}
              total={summary.wordCount}
              label={t('map.summary', { done: summary.wordsLearned, total: summary.wordCount })}
            />
          </div>
        </section>
      )}

      {/* --- 3. Bản đồ hành trình ------------------------------------------- */}
      <section>
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 className="text-kid-lg text-ink">{t('map.title')}</h2>
          <span className="text-kid-xs text-ink-faint">
            {t('map.themeCount', { count: items.length })}
          </span>
        </div>

        <p className="mb-3 text-kid-sm text-ink-soft">{t('map.chooseTheme')}</p>

        {/*
          `minItemWidth` 210 (trước là 180): banner tranh cần bề ngang mới đủ rộng để nhìn ra
          hình. Ở 180px thì tỉ lệ 3:2 chỉ cao 120px — tranh bị ép thành một dải mỏng, quay lại
          đúng cảm giác "ô icon nhỏ" mà ta đang muốn bỏ.
        */}
        <ResponsiveGrid as="ul" minItemWidth={210} gap={14}>
          {items.map((item, position) => {
            const itemAccess = access[position];
            // Bất khả thi về mặt kiểu, nhưng nếu `items` và `access` lệch nhau thì bỏ qua thẻ
            // đó thay vì để cả màn hình trắng vì một `undefined`.
            if (!itemAccess) return null;
            return (
              <li key={item.theme.id}>
                <ThemeCard
                  access={itemAccess}
                  theme={item.theme}
                  sceneUrl={item.sceneUrl}
                  pending={!isHydrated}
                />
              </li>
            );
          })}
        </ResponsiveGrid>
      </section>
    </div>
  );
}
