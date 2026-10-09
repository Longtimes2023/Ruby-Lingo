#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RubyLingo — dựng bảng ảnh để DUYỆT BẰNG MẮT sau mỗi lô ảnh.

VÌ SAO PHẢI CÓ BƯỚC NÀY (không thay thế được bằng test)
  `tsc`, `eslint`, test đơn vị đều xanh với một tấm ảnh SAI NGHĨA: `swim` ra đứa trẻ
  đứng yên, `crocodile` ra con cá sấu đáng sợ, `hair` ra nguyên cái đầu. Máy không
  đọc được nội dung ảnh — chỉ mắt người mới bắt được. Bảng này để mắt người duyệt
  nhanh 30–40 ảnh một lượt.

HAI MỤC, VÌ HAI CÂU HỎI KHÁC NHAU
  A. Cỡ lớn  — "hình này có ĐÚNG NGHĨA không?"       (bắt lỗi nội dung)
  B. Cỡ 44px — "thu nhỏ còn NHẬN RA không?"          (bắt lỗi đọc được)

DÙNG
  python contact_sheet.py --theme at-the-zoo
  python contact_sheet.py --keys elephant,giraffe,pencil
  python contact_sheet.py                       # mọi ảnh đã có
"""

import io
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
WORDS_DIR = os.path.join(ROOT, "public", "assets", "words")

COLS = 5
TILE = 168          # cạnh ô lớn
MINI = 44           # cỡ ô game nhỏ nhất (memory-match)
PAD = 14
LABEL_H = 40
BG = (246, 242, 244)
CARD = (255, 255, 255)
BORDER = (200, 30, 99)
INK = (43, 20, 32)
FAINT = (120, 102, 111)


def load_font(size):
    for name in ("arial.ttf", "segoeui.ttf", "calibri.ttf"):
        path = os.path.join("C:\\Windows\\Fonts", name)
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def read_plan():
    with io.open(os.path.join(HERE, "plan.json"), encoding="utf-8") as handle:
        return json.load(handle)


def paste_card(canvas, image, box, draw):
    """Vẽ một ô thẻ trắng viền hồng rồi dán ảnh vào giữa (giống thẻ từ vựng thật)."""
    left, top, size = box
    draw.rounded_rectangle(
        [left, top, left + size, top + size], radius=16, fill=CARD, outline=BORDER, width=3
    )
    if image is None:
        return
    inner = size - 2 * PAD
    thumb = image.copy()
    thumb.thumbnail((inner, inner), Image.LANCZOS)
    canvas.paste(
        thumb,
        (left + (size - thumb.width) // 2, top + (size - thumb.height) // 2),
        thumb if thumb.mode == "RGBA" else None,
    )


def main():
    theme = None
    keys = None
    for i, arg in enumerate(sys.argv):
        if arg == "--theme" and i + 1 < len(sys.argv):
            theme = sys.argv[i + 1]
        if arg == "--keys" and i + 1 < len(sys.argv):
            keys = [k.strip() for k in sys.argv[i + 1].split(",") if k.strip()]

    plan = read_plan()
    items = [item for item in plan if os.path.exists(os.path.join(WORDS_DIR, item["id"] + ".webp"))]
    if theme:
        items = [item for item in items if item["theme"] == theme]
    if keys:
        wanted = set(keys)
        items = [item for item in items if item["key"] in wanted]
    if not items:
        print("Không có ảnh nào để dựng bảng.")
        return 1

    font_label = load_font(13)
    font_small = load_font(11)
    font_h = load_font(20)

    rows = (len(items) + COLS - 1) // COLS
    cell_w = TILE + 24
    cell_h = TILE + LABEL_H
    mini_strip_h = MINI + 34
    width = COLS * cell_w + 24
    height = 70 + rows * cell_h + 40 + rows * mini_strip_h + 30

    canvas = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(canvas)

    title = "RubyLingo — duyệt ảnh từ vựng"
    if theme:
        title += " · chủ đề %s" % theme
    draw.text((16, 14), title, font=font_h, fill=INK)
    draw.text(
        (16, 42),
        "%d ảnh · mục A: cỡ lớn (đúng nghĩa?) · mục B: cỡ %dpx (còn nhận ra?)" % (len(items), MINI),
        font=font_small,
        fill=FAINT,
    )

    y_mini_base = 70 + rows * cell_h + 40
    draw.text((16, y_mini_base - 26), "B. Cỡ thật khi chơi (%dpx)" % MINI, font=font_label, fill=INK)

    for index, item in enumerate(items):
        row, col = divmod(index, COLS)
        x = 16 + col * cell_w
        y = 70 + row * cell_h

        image = Image.open(os.path.join(WORDS_DIR, item["id"] + ".webp")).convert("RGBA")
        paste_card(canvas, image, (x, y, TILE), draw)
        draw.text((x, y + TILE + 6), item["en"], font=font_label, fill=INK)
        draw.text((x, y + TILE + 22), item["vi"], font=font_small, fill=FAINT)

        # Mục B: cùng ảnh ở cỡ ô game
        my = y_mini_base + row * mini_strip_h
        paste_card(canvas, image, (x, my, MINI + 16), draw)
        draw.text((x + MINI + 22, my + 6), item["key"], font=font_small, fill=FAINT)

    out = os.path.join(HERE, "contact.jpg")
    canvas.save(out, "JPEG", quality=90)
    print("Bảng ảnh: %s  (%dx%d, %d ảnh)" % (out, width, height, len(items)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
