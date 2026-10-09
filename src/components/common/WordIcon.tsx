/**
 * RubyLingo — `WordIcon`: hình đại diện của MỘT TỪ.
 *
 * ⭐ VÌ SAO CẦN LỚP TRUNG GIAN NÀY:
 *   Năm chỗ trong app vẽ hình của một từ (thẻ từ vựng, Nghe & Chạm, Nối từ với hình,
 *   Điền chữ cái, Lật thẻ ghi nhớ). Nếu mỗi chỗ tự quyết "ảnh hay emoji" thì sớm muộn
 *   cũng có chỗ quên, và bé sẽ gặp lại đúng cái emoji mơ hồ mà ta vừa bỏ.
 *   Gọi `<WordIcon>` ở mọi chỗ ⇒ **một** nơi quyết định, không thể lệch.
 *
 * ⚠️ CHỈ dùng cho chỗ cần HÌNH. Chỗ cần CHỮ (mặt chữ tiếng Anh của thẻ ghi nhớ, nhãn
 *    từ trong câu hỏi…) thì tuyệt đối không dùng: nó sẽ trả về ảnh ở nơi đang cần chữ.
 *
 * CỠ DO PHẦN TỬ CHA QUYẾT ĐỊNH: emoji ăn theo `font-size`; `<img>` ở đây dùng
 * `h-[1em] w-[1em]` nên cũng ăn theo đúng `font-size` đó. Nhờ vậy 5 điểm gọi giữ nguyên
 * class cỡ chữ sẵn có (`text-[80px]`, `text-[56px] sm:text-[64px]`, `text-[44px]`…),
 * không phải truyền thêm prop và không phải sửa gì cho màn hình nhỏ.
 */

import { wordAssetUrlOrNull } from '../../data/index.js';
import { cn } from '../../lib/cn.js';

export interface WordIconProps {
  /** `Word.id` — quyết định có ảnh minh hoạ riêng hay không. */
  wordId: string;
  /** Emoji dùng khi từ CHƯA có ảnh (`Word.icon`). */
  fallback: string;
  /** Class thêm, hiếm khi cần — cỡ đã ăn theo `font-size` của cha. */
  className?: string;
}

export function WordIcon({ wordId, fallback, className }: WordIconProps) {
  const src = wordAssetUrlOrNull(wordId);

  // Chưa sinh ảnh cho từ này ⇒ trả về đúng emoji cũ. Trong lúc 201 ảnh còn đang được
  // sinh dần theo chủ đề, app vẫn phải chạy bình thường chứ không được hiện ô vỡ.
  if (src === null) return <>{fallback}</>;

  return (
    <img
      src={src}
      // Trang trí: nghĩa của từ đã được đọc bằng chữ hoặc bằng `aria-label` ở nơi gọi.
      // `alt=""` + `aria-hidden` để trình đọc màn hình không đọc tên tệp.
      alt=""
      aria-hidden="true"
      // Bé kéo thả ảnh ra khỏi thẻ rất dễ; thẻ từ vựng lại còn bắt thao tác vuốt ngang.
      draggable={false}
      className={cn(
        'inline-block h-[1em] w-[1em] object-contain align-[-0.12em]',
        'select-none',
        className,
      )}
    />
  );
}
