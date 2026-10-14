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
  if (src === null) {
    /**
     * ⚠️⚠️ SỐ CÓ HAI CHỮ SỐ PHẢI NHỎ HƠN — nếu không, CHỮ SỐ CUỐI BỊ CẮT MẤT.
     *
     *   Chủ dự án báo (2026-10-14, mục 24): *"số 2 chữ số bị lệch (tỷ lệ không đúng) nên mất số
     *   ngoài sau"*. Nguyên nhân cũ là emoji keycap ghép đôi (`1️⃣1️⃣`) — đã bỏ ở tầng dữ liệu
     *   (`numbers-1-20.json` nay để `icon` là chữ số thật "11"…"20").
     *
     *   Nhưng bỏ keycap KHÔNG đủ: `.wi-fill` đặt cỡ chữ = 88% BỀ RỘNG KHUNG (đúng cho MỘT ký
     *   tự), nên chuỗi hai chữ số rộng ~2 lần khung và bị `overflow-x: clip` cắt mất chữ thứ
     *   hai — y hệt triệu chứng cũ, chỉ khác nguyên nhân. Hạ cỡ cho riêng nhánh này thì hai
     *   chữ số nằm gọn (đo: 0,68 × 88cqw ≈ 60cqw cỡ chữ ⇒ hai chữ số ≈ 66% bề rộng khung).
     *
     *   ⚠️ Chỉ áp cho CHUỖI TOÀN CHỮ SỐ, không áp cho emoji: emoji hai ký tự ("🚪🧭" của
     *     `hall`, "🟢🟢" của `peas`) cũng tràn khung, nhưng đó là vấn đề NỘI DUNG (từ đó phải
     *     có ảnh thật) — hạ cỡ ở đây sẽ che mất dấu hiệu cần sửa.
     */
    if (/^\d{2,}$/.test(fallback)) {
      return <span className="wi-text-narrow">{fallback}</span>;
    }
    return <>{fallback}</>;
  }

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
