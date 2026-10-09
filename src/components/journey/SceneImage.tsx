/**
 * RubyLingo — `SceneImage`: tranh cảnh của chủ đề, kèm đường lùi về emoji.
 *
 * ⚠️⚠️ `theme.sceneImage` KHÁC CHUỖI RỖNG **KHÔNG** CÓ NGHĨA LÀ FILE TRANH ĐÃ TỒN TẠI.
 *
 *   `sceneAssetUrlOrNull()` chỉ suy ra một ĐƯỜNG DẪN từ một KHOÁ (`at-the-zoo` →
 *   `/assets/scenes/at-the-zoo.webp`). Nó không đọc đĩa và không thể biết file có thật hay
 *   không — tranh được phục vụ tĩnh, còn registry nội dung chỉ là JSON nhúng trong bundle.
 *
 *   Hiện tại 9/11 chủ đề đã có khoá tranh VÀ có tệp thật trong `public/assets/scenes/`
 *   (`alphabet` và `numbers-1-20` để khoá rỗng — chúng hiện emoji). Nhưng cơ chế phòng hờ vẫn
 *   phải giữ: đường dẫn chỉ được SUY RA từ khoá, không đọc đĩa, nên một tệp bị xoá hay một chủ
 *   đề mới thêm mà quên thả tranh sẽ khiến cả bản đồ hiện 9 biểu tượng "ảnh hỏng" của trình
 *   duyệt — trông như ứng dụng lỗi, và bé thì không đọc được gì.
 *
 *   Nên: emoji luôn được vẽ TRƯỚC và nằm dưới; tranh chỉ được chồng lên khi tải thành công.
 *   Khi nào thả file tranh vào `public/assets/scenes/` thì bản đồ tự có tranh, không phải sửa
 *   một dòng code nào.
 *
 * ⚠️ PHẢI RESET `failed` KHI ĐỔI `src`:
 *   Nếu không, một chủ đề có tranh lỗi sẽ làm MỌI chủ đề render sau đó cũng rơi về emoji, kể cả
 *   những chủ đề có tranh tải được — vì state `failed` sống lâu hơn lần đổi `src`.
 */

import { useEffect, useState } from 'react';

import { cn } from '../../lib/cn.js';

export interface SceneImageProps {
  /** URL tranh cảnh, hoặc `null` khi chủ đề chưa khai tranh (`sceneImage === ''`). */
  src: string | null;
  /** Emoji hiện khi không có tranh, hoặc khi tranh tải lỗi. */
  fallbackIcon: string;
  /**
   * Mô tả cho screen reader. Mặc định `''` (trang trí).
   *
   * ⭐ Vì sao mặc định là trang trí: ở mọi chỗ đang dùng component này, TÊN CHỦ ĐỀ đã nằm ngay
   *   cạnh tranh (thẻ bản đồ, tiêu đề màn hình). Đọc thêm `sceneAlt` chỉ làm trình đọc màn hình
   *   lặp lại cùng một thông tin hai lần.
   */
  alt?: string;
  /**
   * Cỡ chữ của emoji dự phòng. Mặc định 34px (ô vuông nhỏ).
   *
   * ⭐ Vì sao phải là tham số: emoji phải chiếm được chỗ của tranh. Khung tranh nay có hai cỡ
   *   rất khác nhau — ô 56px ở đầu màn chủ đề và tấm banner ngang ở thẻ bản đồ. Một cỡ cố định
   *   thì hoặc bé xíu trong banner, hoặc tràn ra khỏi ô nhỏ.
   */
  iconClassName?: string;
  className?: string;
}

export function SceneImage({
  src,
  fallbackIcon,
  alt = '',
  iconClassName = 'text-[34px]',
  className,
}: SceneImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const showImage = src !== null && src !== '' && !failed;

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Lớp dưới: emoji. Luôn có mặt nên không bao giờ có khoảng trống chờ tranh. */}
      <span
        aria-hidden="true"
        className={cn('absolute inset-0 flex items-center justify-center leading-none', iconClassName)}
      >
        {fallbackIcon}
      </span>

      {showImage && (
        <img
          src={src}
          alt={alt}
          // `lazy` + `async`: 11 thẻ cùng lúc, không cần tải hết ngay. Bản đồ vẫn dùng được
          // trong lúc tranh đang về.
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </div>
  );
}
