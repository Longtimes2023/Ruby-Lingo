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
 * ⭐ CỠ DO LỚP BỌC `.wi-fill` QUYẾT ĐỊNH — THEO BỀ RỘNG KHUNG, KHÔNG THEO CỠ CHỮ "THƯỜNG".
 *   Trước đây 5 chỗ gọi tự đặt `text-[80px]`/`text-[56px]`… và `<img h-[1em] w-[1em]>` ăn theo
 *   đúng `font-size` đó. Nhưng cỡ chữ ấy vốn chỉnh cho EMOJI, trong khi khung chứa lớn hơn 3–8
 *   lần ⇒ ảnh teo tí xíu so với khung (đúng lỗi chủ dự án báo).
 *
 *   Nay cả 5 chỗ gọi bọc biểu tượng trong `<span class="wi-fill">` (và khung trong `.wi-frame`
 *   — xem `src/styles/word-icon.css`, §B.2 của THIET-KE). `.wi-fill` đặt `font-size` theo đơn vị
 *   container-query (`--fs-icon-fill = 82cqw` = 82% bề rộng khung) nên CẢ `<img>` (vẫn `1em`)
 *   LẪN emoji đều = 82% bề rộng khung ⇒ hai nhánh tương đương, và không còn phụ thuộc cỡ chữ
 *   của nút. Vì vậy KHÔNG chỗ gọi nào truyền cỡ qua prop nữa.
 *
 * ⚠️ Component này KHÔNG đổi logic: vẫn trả emoji khi từ chưa có ảnh, vẫn `h-[1em] w-[1em]
 *    object-contain`. Chỉ khác là `1em` nay do `.wi-fill` quyết định.
 */

import { wordAssetUrlOrNull } from '../../data/index.js';
import { cn } from '../../lib/cn.js';

export interface WordIconProps {
  /** `Word.id` — quyết định có ảnh minh hoạ riêng hay không. */
  wordId: string;
  /** Emoji dùng khi từ CHƯA có ảnh (`Word.icon`). */
  fallback: string;
  /** Class thêm, hiếm khi cần — cỡ đã do lớp bọc `.wi-fill` quyết định theo bề rộng khung. */
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
