#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RubyLingo — nạp ảnh vừa sinh vào `asset-src/words/source/<khoá>.png`.

VÌ SAO PHẢI TỰ ĐỘNG HOÁ BƯỚC NÀY
  Tên tệp do công cụ sinh ảnh đặt là `<khoá>__<mấy chữ đầu>__<ngày-giờ>.png`. Với 201
  ảnh, sao chép bằng tay 201 lần là chắc chắn có lần gán nhầm (nhất là các cặp dễ lẫn:
  `mouse` / `mouse-computer`, `orange-adj` / `orange-n`, `chicken` / `chicken-meat`).
  Script đọc thẳng `<khoá>` ở đầu tên tệp ⇒ không thể gán nhầm, và BÁO LẠI mọi tệp
  không khớp khoá nào để không có tệp nào biến mất trong im lặng.

DÙNG
  python ingest.py                # nạp mọi tệp khớp, bỏ qua cái đã có
  python ingest.py --dry-run      # chỉ xem sẽ làm gì
  python ingest.py --dir <đường-dẫn>   # thêm thư mục nguồn khác

CÒN GHI
  asset-src/words/ledger.json     đóng dấu `prompt_sha` cho ảnh VỪA nạp (xem
                                  `stamp_prompt_sha`) — để `plan.py` phát hiện được
                                  "prompt đã đổi mà ảnh chưa sinh lại".
"""

import io
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SOURCE = os.path.join(HERE, "source")
LEDGER = os.path.join(HERE, "ledger.json")

# Thư mục mặc định công cụ sinh ảnh ghi vào. Nó BỎ QUA `output_dir` (bẫy đã trả giá),
# nên mọi ảnh đều rơi vào đây.
DEFAULT_DIRS = [os.path.join(ROOT, "..", "generated-images")]


def key_from_filename(name):
    """`mouse_computer__a_single_cute__2026-….png` -> `mouse-computer`."""
    if not name.endswith(".png"):
        return None
    stem = name[: -len(".png")]
    head = stem.split("__", 1)[0]
    return head.replace("_", "-") if head else None


def stamp_prompt_sha(added, plan):
    """
    Đóng dấu vân tay prompt vào `ledger.json` cho ĐÚNG những ảnh vừa được nạp.

    ⭐ VÌ SAO Ở ĐÂY, KHÔNG PHẢI Ở `convert_words.py`:
      Dấu vân tay phải trả lời câu "ảnh nguồn này do PROMPT NÀO sinh ra". Chỉ `ingest.py`
      biết thời điểm ảnh nguồn ra đời (nó là bước duy nhất GHI ảnh nguồn). Nếu
      `convert_words.py` đóng dấu (nó chỉ nén lại webp) thì mỗi lần chạy lại bước chuyển
      đổi, ảnh CŨ sẽ bị gán dấu của prompt MỚI — sổ nói dối, và cơ chế phát hiện lệch mất
      hết giá trị. Test `word-assets.test.ts` không đọc trường này nên không bị ảnh hưởng.
    """
    if not added:
        return
    sha_of = {item["key"]: item.get("prompt_sha") for item in plan}
    ledger = {}
    if os.path.exists(LEDGER):
        with io.open(LEDGER, encoding="utf-8") as handle:
            ledger = json.load(handle)
    for key in added:
        ledger.setdefault(key, {"status": "pending", "file": None})["prompt_sha"] = sha_of.get(key)
    with io.open(LEDGER, "w", encoding="utf-8") as handle:
        json.dump(ledger, handle, ensure_ascii=False, indent=2, sort_keys=True)
        handle.write("\n")


def main():
    dry = "--dry-run" in sys.argv
    dirs = list(DEFAULT_DIRS)
    for i, arg in enumerate(sys.argv):
        if arg == "--dir" and i + 1 < len(sys.argv):
            dirs.append(sys.argv[i + 1])

    with io.open(os.path.join(HERE, "plan.json"), encoding="utf-8") as handle:
        plan = json.load(handle)
    valid = {item["key"] for item in plan}

    os.makedirs(SOURCE, exist_ok=True)
    added, skipped, unmatched = [], [], []

    for directory in dirs:
        if not os.path.isdir(directory):
            print("(bỏ qua thư mục không có: %s)" % directory)
            continue
        for name in sorted(os.listdir(directory)):
            key = key_from_filename(name)
            if key is None:
                continue
            if key not in valid:
                unmatched.append((directory, name))
                continue
            dst = os.path.join(SOURCE, key + ".png")
            if os.path.exists(dst):
                skipped.append(key)
                continue
            if not dry:
                shutil.copy2(os.path.join(directory, name), dst)
            added.append(key)

    print("Đã nạp : %d %s" % (len(added), "(chạy thử)" if dry else ""))
    if added:
        print("   " + ", ".join(sorted(added)))
    print("Đã có sẵn: %d" % len(skipped))
    if skipped:
        print("   " + ", ".join(sorted(skipped)))
    if unmatched:
        print("!! KHÔNG khớp khoá nào (%d) — kiểm tra tay:" % len(unmatched))
        for directory, name in unmatched:
            print("   %s/%s" % (os.path.basename(directory), name))

    total = len([f for f in os.listdir(SOURCE) if f.endswith(".png")])
    print("\nTrong source/: %d/%d ảnh" % (total, len(plan)))

    if not dry:
        stamp_prompt_sha(added, plan)
        if added:
            print("Đã đóng dấu vân tay prompt cho %d ảnh vừa nạp vào ledger.json" % len(added))
    return 0


if __name__ == "__main__":
    sys.exit(main())
