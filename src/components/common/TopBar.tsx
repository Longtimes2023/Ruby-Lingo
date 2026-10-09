/**
 * RubyLingo — `TopBar`: thanh trên cùng, luôn hiện khi bé đã vào app.
 *
 * ⭐ NỘI DUNG ĐƯỢC CHỌN THEO CÂU HỎI "BÉ CẦN THẤY GÌ MỌI LÚC?":
 *   • Bé ĐANG LÀ AI (avatar + biệt danh) — bé có thể có anh chị em dùng chung máy. Nhìn thấy
 *     đúng avatar của mình là cách bé biết chắc mình đang ở đúng hồ sơ, tránh việc bé học hết
 *     bài rồi mới phát hiện đang ghi vào hồ sơ của em.
 *   • ⭐ và 🌰 — hai loại tiền tệ. Bé cần biết mình có bao nhiêu để quyết định vào cửa hàng.
 *   • ❤️ — linh vật có đang vui không. Đây là mối quan tâm tình cảm của bé, không phải số liệu.
 *   • 🔥 — chuỗi ngày. Nhắc nhẹ để bé muốn quay lại mỗi ngày.
 *   • Thanh XP — đặt ở MÉP DƯỚI thanh này, cao 4px. Luôn nhìn thấy tiến độ mà không chiếm thêm
 *     một dòng nào; trên điện thoại, mỗi dòng lấy đi chỗ của nội dung học.
 *
 * ⭐ VÌ SAO DƯỚI 480px CHỈ HIỆN ⭐ VÀ 🌰 (không hiện ❤️ và 🔥) — ĐÃ ĐO, KHÔNG PHẢI PHỎNG ĐOÁN:
 *   Trên khung 360px (vùng dùng được 328px sau khi trừ đệm), bốn viên số đếm cỡ đầy đủ rộng
 *   79+79+79+75 = 334px ⇒ viên thứ tư rớt xuống dòng. Ngay cả sau khi thu nhỏ viên xuống 71px
 *   và nút âm thanh xuống 44px, cả bộ vẫn cần 348px. Kết quả đo được: thanh trên cao **181px**,
 *   chiếm 23% màn hình điện thoại — chỗ đáng lẽ dành cho nội dung học.
 *
 *   Giữ lại hai loại TIỀN TỆ vì bé cần chúng ở MỌI màn hình (để biết mình vào cửa hàng được
 *   chưa). ❤️ và 🔥 là thông tin về linh vật và thói quen — quan trọng, nhưng không cần thiết
 *   trong từng khoảnh khắc.
 *
 * ⚠️ VÀ CHÚNG KHÔNG HỀ BỊ ẨN KHỎI BÉ: ở màn hình chính, thẻ chào hiển thị cả ❤️ (đủ 5 ô) và
 *   🔥 (kèm mốc quà kế tiếp) ở cỡ đầy đủ, có chỗ để nhìn rõ. Từ 480px trở lên, thanh trên đủ
 *   chỗ nên hiện đủ cả bốn. Đây là CHUYỂN CHỖ, không phải CẮT BỎ.
 *
 *   Nhờ vậy thanh trên trên điện thoại còn ~65px (8% màn hình) thay vì 181px (23%).
 */

import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import type { ChildProfileDto } from '@shared/types/api.js';

import { getAvatar } from '../../data/avatars.js';
import { getLevelForXp } from '../../data/xp-levels.js';
import type { ChildStatus } from '../../hooks/useChildStatus.js';
import { cn } from '../../lib/cn.js';
import { AcornCounter } from './AcornCounter.js';
import { HeartMeter } from './HeartMeter.js';
import { StarCounter } from './StarCounter.js';
import { StreakFlame } from './StreakFlame.js';
import { XpBar } from './XpBar.js';

export interface TopBarProps {
  /** Bé đang hoạt động. Bắt buộc — không có bé thì không nên hiện thanh này. */
  child: ChildProfileDto;
  /** Số liệu ví / linh vật / chuỗi ngày. `null` = chưa tải xong ⇒ hiện "—". */
  status: ChildStatus | null;
  /**
   * Nếu truyền vào, khối nhận diện bé trở thành nút bấm được (mở màn hình đổi bé).
   * Không truyền thì render dạng tĩnh — một nút bấm không làm gì còn tệ hơn không có nút.
   */
  onIdentityClick?: () => void;
  /**
   * Nếu truyền vào, hiện một nút RIÊNG dẫn tới Hồ sơ nhà thám hiểm (M13, T071).
   *
   * ⭐ VÌ SAO PHẢI LÀ NÚT RIÊNG, KHÔNG NỐI VÀO `onIdentityClick`:
   *   `onIdentityClick` đã mang nghĩa "ĐỔI HỒ SƠ BÉ" (gia đình có anh chị em). Gộp hai việc vào
   *   một nút là cướp mất đường đổi bé — và bé không có cách nào đoán ra mình vừa đổi chức năng
   *   của nút. Đây là điểm vào thay cho `BottomNav`: `BottomNav` đã đủ 5 mục và 5 là TRẦN của dự
   *   án (xem `BottomNav.tsx`), nên hồ sơ không thể là mục thứ sáu.
   */
  profileTo?: string;
  /**
   * Chỗ trống ở cuối dãy số đếm, ví dụ nút bật/tắt tiếng.
   *
   * ⭐ Vì sao đặt ở ĐÂY chứ không để `SoundButton` tự neo vào góc màn hình: nút nổi ở góc
   *   trên-phải sẽ ĐÈ LÊN số ⭐ và 🌰 — bé bấm nút tắt tiếng lại trúng chỗ hiển thị tiền.
   */
  trailing?: ReactNode;
  className?: string;
}

export function TopBar({
  child,
  status,
  onIdentityClick,
  profileTo,
  trailing,
  className,
}: TopBarProps) {
  const { t } = useTranslation();
  const avatar = getAvatar(child.avatarId);
  const pending = status === null;
  // Chưa biết XP thì hiện cấp 1 (0 XP) — thanh sẽ rỗng, đúng với "chưa có gì".
  const level = getLevelForXp(status?.xp ?? 0);

  const identity = (
    <>
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-brand-soft bg-surface-raised text-[24px] leading-none"
      >
        {avatar?.icon ?? '🐾'}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-kid-md font-bold leading-tight text-ink">
          {child.nickname}
        </span>
        <span className="block truncate text-kid-xs leading-tight text-ink-faint">
          {level.icon} {level.title_vi}
        </span>
      </span>
    </>
  );

  const identityClasses = cn(
    'flex min-w-0 flex-1 items-center gap-2.5 py-2 text-left',
    // Chỉ thêm hiệu ứng bấm khi thật sự bấm được.
    onIdentityClick && 'rounded-kid active:bg-surface-sunken',
  );

  return (
    <header
      className={cn(
        // ⭐ `sticky` chứ KHÔNG `fixed`.
        //
        //   `fixed` gỡ thanh này khỏi luồng bố cục, nên nội dung bên dưới sẽ nằm CHUI DƯỚI nó và
        //   phải tự chừa chỗ bằng `padding-top`. Nhưng chiều cao thanh này KHÔNG cố định: dãy số
        //   đếm tự xuống dòng trên màn hình hẹp (xem ghi chú đầu file), nên con số padding đúng
        //   thay đổi theo bề rộng màn hình và theo nội dung biệt danh dài hay ngắn. Mọi cách tính
        //   cứng đều sẽ sai ở một thiết bị nào đó.
        //
        //   `sticky` giữ thanh trong luồng bố cục ⇒ chiều cao tự đúng, không cần padding, không
        //   cần đo bằng JavaScript, không có nhịp giật lúc tải trang.
        'sticky top-0 z-nav border-b-2 border-line bg-surface pt-safe',
        className,
      )}
    >
      <div className="mx-auto flex max-w-[880px] flex-wrap items-center gap-x-3 gap-y-1 px-4">
        {onIdentityClick ? (
          <button
            type="button"
            onClick={onIdentityClick}
            // Nhãn đọc đầy đủ ngữ cảnh: screen reader nghe "Bin, Người chăm vườn thú" thay vì
            // chỉ "Bin" rồi không biết bấm vào sẽ ra gì.
            aria-label={`${t('child.switchChild')}: ${child.nickname}`}
            className={identityClasses}
          >
            {identity}
          </button>
        ) : (
          <div className={identityClasses}>{identity}</div>
        )}

        {/*
          Nút Hồ sơ nhà thám hiểm (T071) — điểm vào KHÔNG nằm ở `BottomNav` (đã đủ 5 mục).
          Hiện ICON CẤP của bé (🐾 → 🌿 → 🧺 …) nên nó vừa là điểm vào hồ sơ, vừa là một lời mời
          "xem mình đang ở cấp nào" — khớp với nội dung bên trong.

          ⚠️ `size-touch` (64px, còn 56px dưới 480px) chứ KHÔNG phải `size-11` như `SoundButton`:
             đây là ĐIỀU HƯỚNG bé bấm thường xuyên, không phải công tắc cài đặt hiếm dùng. Vùng
             chạm tối thiểu 64px là quy ước của app (xem `tokens.css`).
        */}
        {profileTo !== undefined && (
          <Link
            to={profileTo}
            aria-label={t('nav.goToProfile')}
            className={cn(
              'flex size-touch shrink-0 items-center justify-center rounded-full',
              'border-2 border-line bg-surface-raised text-[24px] leading-none',
              'transition-transform duration-kid active:translate-y-[2px]',
              'hoverable:bg-surface-sunken',
            )}
          >
            <span aria-hidden="true">{level.icon}</span>
          </Link>
        )}

        {/*
          Không còn `flex-wrap` ở đây: từ khi ❤️ và 🔥 chỉ hiện từ 480px trở lên (xem ghi chú đầu
          file), phần còn lại LUÔN vừa một dòng. Bỏ `flex-wrap` giúp số đếm không bao giờ tự tách
          thành hai hàng — nếu có tràn thì tràn ra ngoài, và điều đó sẽ lộ ra ngay khi kiểm chứng
          thay vì âm thầm làm thanh trên cao gấp ba.
        */}
        <div className="flex shrink-0 items-center justify-end gap-1.5 py-2">
          <StarCounter value={status?.stars ?? 0} pending={pending} />
          <AcornCounter value={status?.acorns ?? 0} pending={pending} />
          {/*
            `hidden sm:inline-flex` — `cn`/`twMerge` gộp đúng: `hidden` thắng `inline-flex` gốc,
            còn `sm:inline-flex` là biến thể khác nên được giữ lại.
          */}
          <HeartMeter
            compact
            value={status?.happiness ?? 1}
            pending={pending}
            className="hidden sm:inline-flex"
          />
          <StreakFlame
            compact
            currentStreak={status?.streakDays ?? 0}
            pending={pending}
            className="hidden sm:inline-flex"
          />
          {trailing}
        </div>
      </div>

      {/* Mép dưới: vạch tiến độ XP cao 4px, luôn nhìn thấy mà không tốn dòng nào. */}
      <XpBar xp={status?.xp ?? 0} variant="strip" />
    </header>
  );
}
