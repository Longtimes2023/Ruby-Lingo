/**
 * RubyLingo — `BottomNav`: điều hướng chính, nằm ở ĐÁY màn hình.
 *
 * ⭐ VÌ SAO ĐÁY CHỨ KHÔNG PHẢI TRÊN HAY BÊN TRÁI:
 *   • Điện thoại và iPad cầm bằng hai tay: ngón cái với tới đáy dễ hơn nhiều so với góc trên.
 *     Với tay trẻ con (nhỏ hơn tay người lớn), khoảng cách này càng quan trọng.
 *   • Ở ĐÁY thì không tranh chỗ với nội dung học — mắt bé nhìn vào giữa màn hình trước.
 *   • Giữ nguyên một vị trí trên MỌI thiết bị (điện thoại, iPad, laptop). Nếu laptop đổi sang
 *     thanh bên trái, bé phải học lại hai cách dùng khác nhau cho cùng một app.
 *
 * ⭐ "CO GIÃN" NGHĨA LÀ GÌ (yêu cầu trong đặc tả T027):
 *   Thanh luôn trải hết bề rộng màn hình (nền + đường kẻ trên), nhưng NỘI DUNG bên trong bị giới
 *   hạn ở `max-w-[880px]` và canh giữa — khớp đúng bề rộng cột nội dung. Trên laptop, các mục
 *   không bị dạt ra hai mép màn hình cách nhau 40cm, mà nằm gọn dưới cột nội dung.
 *
 * ⭐ NĂM MỤC — VÀ VÌ SAO "CỬA HÀNG" KHÔNG PHẢI MỤC THỨ SÁU:
 *   Cửa hàng theo kế hoạch là một TAB BÊN TRONG màn hình "Nhà thú cưng" (quyết định C2 trong
 *   `GAME-REWARD-DESIGN.md` §7.1). Lý do: bé mua đồ xong phải THẤY NGAY vật phẩm trên linh vật.
 *   Nếu cửa hàng là màn hình riêng, bé phải nhớ "vừa mua nơi", bấm về, rồi tự tìm — mất đi phản
 *   hồi liền mạch, mà đó chính là phần thưởng của việc mua.
 *
 * ⭐ VÌ SAO "📋 NHIỆM VỤ" ĐƯỢC THÊM VÀO ĐÂY (T061, màn M9):
 *   Đây là màn hình bé mở MỖI NGÀY — ba nhiệm vụ ngày reset lúc nửa đêm, và quà chỉ về tay khi bé
 *   tự bấm "Nhận thưởng". Giấu nó sau một nút trên bản đồ hành trình nghĩa là mỗi ngày bé phải
 *   nhớ thêm một đường, và quên một lần là mất luôn phần thưởng của hôm đó.
 *
 * ⚠️ NĂM LÀ MỨC TRẦN, KHÔNG PHẢI MỘT CHỖ ĐỂ NHÉT THÊM: `ARCHITECTURE.md` (bảng bố cục theo bậc
 *   màn hình) cho phép 3–5 mục. Mục thứ sáu sẽ đẩy bề rộng mỗi mục trên màn 320px xuống dưới
 *   64px — dưới vùng chạm tối thiểu cho tay trẻ con. Nếu sau này cần thêm màn hình cho bé, hãy
 *   đưa nó vào BÊN TRONG một mục đã có (như tab Cửa hàng trong Nhà thú cưng), đừng thêm mục mới.
 */

import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

import { cn } from '../../lib/cn.js';

interface NavItem {
  to: string;
  icon: string;
  /** Khoá từ điển cho nhãn hiển thị. */
  labelKey: string;
  /** Khoá từ điển cho nhãn đọc của screen reader (đầy đủ ngữ cảnh hơn nhãn hiển thị). */
  ariaKey: string;
  /**
   * `true` = chỉ khớp CHÍNH XÁC đường dẫn này.
   *
   * ⭐ Bắt buộc với mục "Học" (`/`): mặc định `NavLink` khớp theo tiền tố, nên `/` sẽ khớp với
   *   MỌI đường dẫn và mục "Học" luôn sáng — kể cả khi bé đang ở cửa hàng.
   */
  end?: boolean;
}

const ITEMS: readonly NavItem[] = [
  { to: '/', icon: '🗺️', labelKey: 'nav.learn', ariaKey: 'nav.goToLearn', end: true },
  // Đứng ngay sau "Học" vì đây là màn bé quay lại mỗi ngày — xem ghi chú đầu file.
  { to: '/quests', icon: '📋', labelKey: 'nav.quests', ariaKey: 'nav.goToQuests' },
  { to: '/pet', icon: '🐵', labelKey: 'nav.pet', ariaKey: 'nav.goToPet' },
  { to: '/collection', icon: '🏅', labelKey: 'nav.collection', ariaKey: 'nav.goToCollection' },
  { to: '/parent', icon: '⚙️', labelKey: 'nav.parent', ariaKey: 'nav.goToParent' },
];

export interface BottomNavProps {
  className?: string;
}

export function BottomNav({ className }: BottomNavProps) {
  const { t } = useTranslation();

  return (
    <nav
      // `aria-label` phân biệt thanh này với các nhóm liên kết khác trên trang — nếu không có,
      // trình đọc màn hình chỉ nói "điều hướng" và bé không biết là điều hướng nào.
      aria-label={t('nav.goToLearn')}
      className={cn(
        // ⭐ `sticky` chứ KHÔNG `fixed` — cùng lý do như `TopBar`: thanh này nằm TRONG luồng bố
        //   cục nên không cần `padding-bottom` tính tay ở vùng nội dung. Xem ghi chú đầu TopBar.
        'sticky bottom-0 z-nav mt-auto border-t-2 border-line bg-surface pb-safe',
        className,
      )}
    >
      {/*
        ⭐ `md:max-w-[560px]`: trên laptop, nếu để dãy mục trải hết bề rộng cột nội dung (880px),
        mỗi mục rộng 220px và mục đang mở thành một viên thuốc khổng lồ trông như lỗi bố cục.
        Giới hạn 560px giữ các mục ở bề rộng quen thuộc của thanh điều hướng dưới (mỗi mục
        140px), vẫn canh giữa theo cột nội dung. Trên điện thoại, 560px > bề rộng màn hình nên
        giới hạn này không có tác dụng — thanh vẫn trải hết.
      */}
      <ul className="mx-auto flex w-full max-w-[880px] items-stretch justify-around px-2 md:max-w-[560px]">
        {ITEMS.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              aria-label={t(item.ariaKey)}
              className={({ isActive }) =>
                cn(
                  // `min-h-touch` (64px, còn 56px dưới 480px) — vùng chạm tối thiểu cho tay trẻ.
                  // `mx-auto` + `max-w-[168px]`: viên thuốc của mục đang mở không kéo hết bề rộng
                  // của ô, nên trông giống một nút hơn là một dải màu.
                  'mx-auto flex min-h-touch w-full max-w-[168px] flex-col items-center justify-center gap-0.5',
                  'rounded-kid px-1 py-1.5 transition-colors duration-kid',
                  isActive
                    ? 'bg-brand-soft text-brand'
                    : 'text-ink-faint hoverable:bg-surface-raised',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'text-[26px] leading-none transition-transform duration-kid',
                      // Mục đang mở phóng to nhẹ — dấu hiệu thứ hai ngoài màu, để bé phân biệt
                      // được kể cả khi không nhìn rõ màu (màn hình ngoài nắng, mù màu).
                      isActive && 'scale-110',
                    )}
                  >
                    {item.icon}
                  </span>
                  <span
                    className={cn(
                      'text-[13px] leading-tight',
                      // Nhãn mục đang mở in đậm: phân biệt thêm một tầng nữa ngoài màu và cỡ icon.
                      isActive ? 'font-bold' : 'font-semibold',
                    )}
                  >
                    {t(item.labelKey)}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
