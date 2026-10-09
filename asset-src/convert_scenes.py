"""Đổi tên tranh nguồn theo khoá chủ đề + chuyển sang webp vào public/assets/scenes/.

⚠️ VÌ SAO PHẢI ĐỔI TÊN THEO KHOÁ CHỦ ĐỀ:
   `sceneAssetUrlOrNull('at-the-zoo')` suy ra ĐÚNG đường dẫn `/assets/scenes/at-the-zoo.webp`.
   Tên tệp do công cụ sinh ảnh đặt (`Keep_EXACTLY_the_same_art_styl_2026-…png`) không khớp, và
   cũng không ai đọc được. Bước đổi tên này chính là thứ nối ảnh vào nội dung.

⚠️ TÊN TỆP ẢNH DO CÔNG CỤ SINH RA CHỈ CHÍNH XÁC TỚI GIÂY: hai lời gọi song song trong cùng một
   giây sẽ GHI ĐÈ NHAU (đã mất 2 ảnh vì đúng lỗi này). Bảng dưới khoá theo ảnh nguồn, và script
   KHÔNG được phép im lặng nếu thiếu tệp — thiếu là báo lỗi.
"""

import io
import os
import sys

from PIL import Image

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scenes")
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
OUT = os.path.join(ROOT, "public", "assets", "scenes")

# Khoá chủ đề -> hậu tố tên tệp nguồn (phần sau mốc ngày, đủ để nhận diện duy nhất)
MAP = {
    "at-the-zoo": "Soft_3D_rendered_illustration__2026-10-07T01-57-53",
    "at-the-clothes-shop": "RubyLingo_childrens_clothes_sh_2026-10-07T02-02-04",
    "my-street": "RubyLingo_my_town_street_scene_2026-10-07T02-01-54",
    "my-favourite-food": "RubyLingo_favourite_food_scene_2026-10-07T02-01-56",
    "at-school": "Keep_EXACTLY_the_same_art_styl_2026-10-07T02-00-10",
    "my-body": "Keep_EXACTLY_the_same_art_styl_2026-10-07T02-00-14",
    "at-home": "Keep_EXACTLY_the_same_art_styl_2026-10-07T02-00-17",
    "at-the-beach": "Keep_EXACTLY_the_same_art_styl_2026-10-07T02-00-18",
    "my-friends-birthday": "Keep_EXACTLY_the_same_art_styl_2026-10-07T02-00-24",
}

# Ảnh lệch khung/thừa: bản nhuộm 1024x1024 của món ăn đã được sinh lại ở 1536x1024.
STALE = ["Keep_EXACTLY_the_same_art_styl_2026-10-07T01-59-04.png"]

WIDTH = 1024          # đủ cho 2x của dải tranh ~500px; ThemePage header dùng 80px
QUALITY = 82


def main() -> int:
    os.makedirs(OUT, exist_ok=True)

    for name in STALE:
        p = os.path.join(SRC, name)
        if os.path.exists(p):
            os.remove(p)
            print(f"  đã xoá bản thừa: {name}")

    thieu = [k for k, v in MAP.items() if not os.path.exists(os.path.join(SRC, v + ".png"))]
    if thieu:
        print(f"❌ THIẾU ẢNH NGUỒN cho: {', '.join(thieu)}", file=sys.stderr)
        return 1

    total = 0
    for key, stem in sorted(MAP.items()):
        src = os.path.join(SRC, stem + ".png")
        im = Image.open(src).convert("RGB")

        # Cắt về đúng 3:2 nếu lệch, để mọi thẻ có cùng tỉ lệ dải tranh.
        w, h = im.size
        want = w * 2 // 3
        if h > want:
            top = (h - want) // 2
            im = im.crop((0, top, w, top + want))

        if im.width != WIDTH:
            im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)

        dst = os.path.join(OUT, key + ".webp")
        im.save(dst, "WEBP", quality=QUALITY, method=6)
        size = os.path.getsize(dst)
        total += size
        print(f"  {key+'.webp':34s} {im.width}x{im.height}  {size / 1024:7.1f} KB")

        # Đổi tên luôn tệp nguồn cho dễ đọc về sau.
        os.replace(src, os.path.join(SRC, key + ".png"))

    print(f"\n  {len(MAP)} tệp webp, tổng {total / 1024:.1f} KB -> {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
