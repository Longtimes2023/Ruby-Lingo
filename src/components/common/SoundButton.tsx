/**
 * RubyLingo — `SoundButton`: nút bật/tắt tiếng, luôn nằm trong tầm tay.
 *
 * ⭐ VÌ SAO PHẢI LUÔN HIỆN Ở MỌI MÀN HÌNH:
 *   Bé hay mở app ở nơi không nên có tiếng (lớp học, xe buýt, lúc em đang ngủ). Nếu nút tắt
 *   tiếng nằm sâu trong "Cài đặt của bố mẹ", bé sẽ không tự xử lý được và người lớn phải vào
 *   can thiệp mỗi lần — đúng thứ mà thiết kế này muốn tránh.
 *
 * ⭐ TRẠNG THÁI LẤY TỪ `settingsStore`, KHÔNG PHẢI STATE CỤC BỘ:
 *   Cài đặt phải sống lâu hơn màn hình. Nếu để state cục bộ, bé tắt tiếng ở màn hình học rồi
 *   sang màn hình game là tiếng bật lại — hành vi không thể đoán trước.
 *
 * ⚠️ Nút này CHỈ ghi cờ. Việc thật sự im lặng do `SpeechService` (T035) và `AudioSfxService`
 *   (T036) đọc cùng cờ đó mà quyết định. Nhóm 3 chưa có hai service kia, nên hiện tại nút
 *   chưa làm gì im lặng được — nhưng trạng thái đã đúng và sẽ tự có tác dụng khi chúng vào.
 */

import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/cn.js';
import { useSettingsStore } from '../../store/settingsStore.js';

/** Góc neo nút khi ở chế độ nổi. */
export type SoundButtonPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

export interface SoundButtonProps {
  position?: SoundButtonPosition;
  /**
   * ⭐ `true` (mặc định) = NỔI, neo vào một góc màn hình. Dùng ở màn hình game — nơi không có
   *   thanh trên cùng, và bé cần với tới nút này bất cứ lúc nào.
   *
   * ⭐ `false` = NẰM TRONG LUỒNG, không tự định vị. Dùng khi `TopBar` đã chiếm góc trên-phải:
   *   hai thứ cùng neo vào một góc sẽ ĐÈ LÊN NHAU, và nút âm thanh sẽ che mất số ⭐ của bé.
   */
  floating?: boolean;
  /**
   * `md` = 56px (vùng chạm đầy đủ theo quy ước của app). Dùng khi nút nổi một mình.
   * `sm` = 44px. Dùng khi nút nằm trong thanh công cụ.
   *
   * ⭐ Vì sao có ngoại lệ 44px: quy ước "vùng chạm ≥ 56px" của app này dành cho NÚT HÀNH ĐỘNG
   *   mà bé bấm liên tục (Chọn, Tiếp, Nghe lại). Đây là công tắc cài đặt — bé bấm một lần rồi
   *   thôi, và 44px đã đạt WCAG 2.5.5 (AAA, tối thiểu 44×44 CSS px). Nếu để 56px, nút sẽ ép cả
   *   hàng số đếm cao thêm 12px và đẩy thanh trên cao thêm đúng 12px trên mọi màn hình.
   */
  size?: 'sm' | 'md';
  className?: string;
}

const POSITION_CLASSES: Record<SoundButtonPosition, string> = {
  // `env(safe-area-inset-*)` giữ nút không bị tai thỏ / thanh home của iPhone che.
  'top-right': 'fixed top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))]',
  'top-left': 'fixed top-[max(0.75rem,env(safe-area-inset-top))] left-[max(0.75rem,env(safe-area-inset-left))]',
  'bottom-right':
    'fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))]',
  'bottom-left':
    'fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))]',
};

export function SoundButton({
  position = 'top-right',
  floating = true,
  size = 'md',
  className,
}: SoundButtonProps) {
  const { t } = useTranslation();
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const toggleSound = useSettingsStore((s) => s.toggleSound);

  return (
    <button
      type="button"
      // `aria-pressed` biến nút thành công tắc hai trạng thái với screen reader — đúng ngữ
      // nghĩa hơn `aria-checked` (dành cho role="switch"/"checkbox").
      aria-pressed={!soundEnabled}
      aria-label={soundEnabled ? t('settings.muteSound') : t('settings.unmuteSound')}
      onClick={toggleSound}
      className={cn(
        floating ? POSITION_CLASSES[position] : undefined,
        // Trên cả TopBar (z-nav = 40) nhưng dưới overlay kết quả (z-overlay = 60):
        // overlay phải che được nút này, nếu không bé bấm nhầm khi đang xem kết quả.
        floating && 'z-[45]',
        'flex items-center justify-center rounded-full',
        size === 'md' ? 'size-touch' : 'size-11',
        'border-2 shadow-kid transition-transform duration-kid active:translate-y-[2px] active:shadow-none',
        'select-none',
        soundEnabled
          ? 'border-line bg-surface text-ink'
          : // Khi đã tắt tiếng: đổi màu để trạng thái nhìn thấy được từ xa, không phải chỉ
            // dựa vào emoji (emoji nhỏ và khó phân biệt ở cỡ 24px).
            'border-warn bg-surface-sunken text-warn',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('leading-none', size === 'md' ? 'text-[24px]' : 'text-[20px]')}
      >
        {soundEnabled ? '🔊' : '🔇'}
      </span>
    </button>
  );
}
