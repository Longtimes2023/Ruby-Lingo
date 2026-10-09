/**
 * RubyLingo — `ThemeCard`: một chặng trên bản đồ hành trình.
 *
 * ⭐ THẺ CÓ BỐN DIỆN MẠO, VÀ DIỆN MẠO DO `ThemeAccess.kind` QUYẾT ĐỊNH:
 *
 *   `open`        🎮 Có game. Hiện ⭐ (sao là thứ bé kiếm được ở đây) + số bài đã xong.
 *   `study`       📖 Chưa có game, nhưng CÓ từ vựng. Hiện tiến độ TỪ, KHÔNG hiện ⭐.
 *   `locked`      🔒 Chưa đủ điều kiện. Hiện rõ CẦN GÌ để mở — không giấu sau một cú bấm.
 *   `coming_soon` ⏳ Chưa có nội dung. Không bấm vào được.
 *
 * ⚠️⚠️ VÌ SAO THẺ `study` KHÔNG HIỆN ⭐:
 *   Chủ đề chưa có game thì `starsEarned` LUÔN bằng 0. Hiện "⭐ 0/9" cho bé là hiện một con số
 *   không bao giờ nhúc nhích — bé sẽ đọc đó là "mình chưa làm được gì", trong khi thật ra bé có
 *   thể đã học hết 13 từ của chủ đề đó. Đếm TỪ là thứ bé luôn tiến bộ được ở mọi chủ đề.
 *
 * ⭐ VÌ SAO CẢ THẺ LÀ MỘT LIÊN KẾT, KHÔNG PHẢI MỘT NÚT NHỎ BÊN TRONG:
 *   Vùng chạm lớn nhất có thể. Bé 7 tuổi nhắm vào một nút 100×44px ở góc thẻ thì hay trượt; nhắm
 *   vào cả tấm thẻ (bề ngang ~180px, cao ngót 300px từ khi tranh thành banner) thì gần như không
 *   trượt. Đây cũng là lý do KHÔNG đặt một `<button>` "Chơi" bên trong `<Link>`: hai phần tử
 *   cùng nhận một cú chạm là lỗi HTML và làm trình đọc màn hình đọc hai lần.
 *
 * ⚠️ THẺ KHOÁ KHÔNG PHẢI LÀ LIÊN KẾT `disabled`:
 *   `react-router` không có khái niệm link bị khoá, và một `<Link>` trỏ tới chủ đề chưa mở sẽ
 *   đưa bé vào màn hình rồi bị đuổi ra — tệ hơn hẳn việc không bấm được. Nên thẻ khoá là một
 *   `<div>` thường: không có gì để bấm, và câu giải thích nằm ngay trên mặt thẻ.
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { ThemeAccess } from '@shared/theme-access.js';
import type { Theme } from '@shared/types/content.js';

import { cn } from '../../lib/cn.js';
import { themeAccentStyle } from '../../lib/themeAccent.js';
import { ProgressBar } from '../common/ProgressBar.js';
import { SceneImage } from './SceneImage.js';

export interface ThemeCardProps {
  access: ThemeAccess;
  theme: Theme;
  /** URL tranh cảnh, hoặc `null`. Xem `SceneImage` — có URL không có nghĩa là file đã tồn tại. */
  sceneUrl: string | null;
  /**
   * `true` khi `progressStore` chưa nạp xong.
   *
   * Hiện dấu "—" thay vì số 0: "0 từ" là một lời khẳng định SAI (bé có thể đã học 37 từ), còn
   * "—" là một lời thú nhận đúng ("chưa biết"). Xem ghi chú ở `useThemeAccess`.
   */
  pending?: boolean;
  className?: string;
}

export function ThemeCard({ access, theme, sceneUrl, pending = false, className }: ThemeCardProps) {
  const { t } = useTranslation();

  const dimmed = access.kind === 'locked' || access.kind === 'coming_soon';

  /**
   * TÔNG MÀU RIÊNG CỦA CHỦ ĐỀ — đặt 4 biến cục bộ lên phần tử GỐC để mọi phần tử con thừa hưởng.
   *
   * ⭐ "Mỗi chủ đề một tông màu riêng": nhìn bản đồ hành trình là bé phân biệt được ngay chặng
   *   nào là chặng nào. Bốn vai (xem `tokens.css`, mục "11 tông màu chủ đề"):
   *     `border-th`    — viền khi rê chuột / khi chạm
   *     `text-th-ink`  — chữ trên nền sáng (đạt AA 4,5:1)
   *     `bg-th-soft`   — nền chip
   *     `from-th-soft` / `to-th-tint` — dải nền
   *
   * ⚠️ KHÔNG viết `text-th`, `bg-th/10`… — xem ghi chú ở `themeAccent.ts` và `tokens.css`.
   */
  const accent = themeAccentStyle(theme.id);

  /**
   * ⚠️ KHÔNG dùng `bg-ink/45`, `from-ink/25`, `bg-surface/80`… cho lớp phủ.
   *   Tailwind sinh độ mờ bằng `rgb(var(--c-ink) / 0.45)`, nhưng các biến `--c-*` là mã hex
   *   (`#2b1420`) chứ không phải bộ ba kênh (`43 20 32`) ⇒ CSS sinh ra KHÔNG HỢP LỆ và lớp phủ
   *   trở nên trong suốt, im lặng. Đây là lý do `--c-scrim` phải là một `rgba()` khai sẵn.
   *   Trong thẻ này ta tránh hẳn vấn đề bằng cách đặt nhãn số thứ tự trên một chip ĐẶC
   *   (`bg-surface`) thay vì trên một lớp mờ đè lên tranh.
   */
  const cardClass = cn(
    'flex h-full flex-col overflow-hidden rounded-card border-2 text-left transition duration-kid',
    access.enterable
      ? 'border-line bg-surface shadow-kid hoverable:-translate-y-0.5 hoverable:border-th hoverable:shadow-brand active:translate-y-[1px] active:shadow-none'
      : // Thẻ chưa mở: nền chìm + viền đứt. Nhìn là biết "chưa tới lượt", không cần đọc chữ.
        'border-dashed border-line bg-surface-raised',
    className,
  );

  const body = (
    <>
      {/* --- Banner tranh ------------------------------------------------
          Tranh chiếm trọn bề ngang thay vì một ô 56px: đây là thứ khiến bản đồ "có hình",
          và cũng là chỗ duy nhất đủ rộng để tranh 1024×683 hiện ra rõ.
          `aspect-[3/2]` khớp đúng tỉ lệ tệp tranh nên không bị cắt mất chi tiết ở hai đầu. */}
      <div className="relative aspect-[3/2] w-full shrink-0 overflow-hidden bg-gradient-to-br from-th-soft to-th-tint">
        <SceneImage
          src={sceneUrl}
          fallbackIcon={theme.icon}
          iconClassName="text-kid-3xl"
          className={cn(
            // ⚠️ `absolute inset-0` LÀ BẮT BUỘC, KHÔNG PHẢI TRANG TRÍ.
            //   `SceneImage` vẽ cả emoji lẫn `<img>` bằng `absolute inset-0`, nên khung gốc của
            //   nó KHÔNG tự có chiều cao. Trước đây nơi gọi luôn truyền một cỡ đặc (`size-14`),
            //   nên khung có kích thước thật. Ở đây khung ngoài đã lo tỉ lệ 3:2, nếu không kéo
            //   `SceneImage` giãn kín khung thì nó cao 0px: ảnh VẪN tải xong, `naturalWidth` vẫn
            //   > 0, `document.images` vẫn đếm đủ, mà trên màn hình là một khoảng trắng.
            //   Đây là lỗi đã thực sự xảy ra ở lần dựng banner đầu tiên.
            'absolute inset-0',
            // Làm mờ tranh của thẻ chưa mở — tín hiệu thứ hai, ngoài màu nền.
            dimmed && 'opacity-55 grayscale',
          )}
        />

        {/* Số thứ tự chặng. Bé đếm được, và khớp với thứ tự trong `level.themeIds`.
            Nằm trên chip ĐẶC nên luôn đọc được, bất kể tranh phía dưới sáng hay tối. */}
        <span
          className={cn(
            'absolute top-2 right-2 rounded-pill border-2 px-2.5 py-0.5 text-kid-xs font-bold tabular-nums shadow-kid',
            access.enterable
              ? 'border-th-soft bg-surface text-th-ink'
              : 'border-line bg-surface text-ink-faint',
          )}
        >
          {access.index}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 bg-gradient-to-b from-th-tint to-surface p-3.5">
        <div className="min-w-0">
          <h3 className="text-kid-md leading-tight text-ink">{theme.name_vi}</h3>
          <p className="truncate text-kid-xs text-ink-faint">{theme.name_en}</p>
        </div>

        {/* --- Tiến độ ----------------------------------------------------- */}
        {access.kind === 'open' && (
          <div className="mt-auto flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-kid-xs font-bold tabular-nums text-star-ink">
                {pending
                  ? '—'
                  : t('map.starsOfMax', { stars: access.starsEarned, max: access.starsMax })}
              </span>
              <span className="text-kid-xs tabular-nums text-ink-faint">
                {t('map.lessonsDone', {
                  done: access.lessonsCompleted,
                  total: access.lessonCount,
                })}
              </span>
            </div>
            <ProgressBar
              value={access.lessonsCompleted}
              total={access.lessonCount}
              tone="accent"
              label={t('map.lessonsDone', {
                done: access.lessonsCompleted,
                total: access.lessonCount,
              })}
            />
          </div>
        )}

        {access.kind === 'study' && (
          <div className="mt-auto flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-kid-xs font-bold tabular-nums text-th-ink">
                {pending
                  ? '—'
                  : t('map.wordsOfMax', { done: access.wordsLearned, total: access.wordCount })}
              </span>
              <span className="text-kid-xs tabular-nums text-ink-faint">
                {t('map.lessonsDone', {
                  done: access.lessonsCompleted,
                  total: access.lessonCount,
                })}
              </span>
            </div>
            <ProgressBar
              value={access.lessonsCompleted}
              total={access.lessonCount}
              tone="accent"
              label={t('map.lessonsDone', {
                done: access.lessonsCompleted,
                total: access.lessonCount,
              })}
            />
          </div>
        )}

        {access.kind === 'locked' && (
          <p className="mt-auto text-kid-xs leading-snug text-ink-soft">
            {describeRequirement(access, t)}
          </p>
        )}

        {access.kind === 'coming_soon' && (
          <p className="mt-auto text-kid-xs leading-snug text-ink-faint">{t('map.noContent')}</p>
        )}

        {/* --- Nhãn trạng thái --------------------------------------------- */}
        <span
          className={cn(
            'inline-flex w-fit items-center gap-1.5 rounded-pill px-2.5 py-1 text-kid-xs font-bold',
            access.kind === 'open' && 'bg-th-soft text-th-ink',
            access.kind === 'study' && 'bg-surface-sunken text-th-ink',
            access.kind === 'locked' && 'bg-surface-sunken text-ink-faint',
            access.kind === 'coming_soon' && 'bg-surface-sunken text-ink-faint',
          )}
        >
          <span aria-hidden="true" className="text-[16px] leading-none">
            {access.kind === 'open' ? '🎮' : access.kind === 'study' ? '📖' : access.kind === 'locked' ? '🔒' : '⏳'}
          </span>
          {access.kind === 'open'
            ? t('map.play')
            : access.kind === 'study'
              ? t('map.study')
              : access.kind === 'locked'
                ? t('map.locked')
                : t('map.comingSoon')}
        </span>
      </div>
    </>
  );

  if (!access.enterable) {
    return (
      <div className={cardClass} style={accent}>
        {body}
      </div>
    );
  }

  return (
    <Link
      to={`/theme/${theme.id}`}
      // Nhãn đọc đầy đủ: trình đọc màn hình nghe "Vào chủ đề Ở sở thú" thay vì chỉ đọc một tràng
      // nội dung rồi không nói bấm vào sẽ ra đâu. Nội dung bên trong vẫn được đọc tiếp.
      aria-label={t('map.openTheme', { theme: theme.name_vi })}
      className={cardClass}
      // 4 biến tông màu đặt ở GỐC: mọi phần tử con (kể cả trong `body`) thừa hưởng.
      style={accent}
    >
      {body}
    </Link>
  );
}

/** Câu giải thích còn thiếu gì để mở khoá. Luôn là một câu ĐẦY ĐỦ, không phải "Khoá". */
function describeRequirement(
  access: ThemeAccess,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const requirement = access.requirement;
  if (!requirement) return t('map.locked');

  if (requirement.type === 'previous_theme') {
    return t('map.lockedByPrevious', { theme: requirement.themeName_vi });
  }
  return t('map.lockedByStars', { stars: requirement.stars, have: requirement.have });
}
