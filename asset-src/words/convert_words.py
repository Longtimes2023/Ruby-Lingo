#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RubyLingo — ảnh nguồn (PNG nền trong suốt) → webp dùng được trong app + manifest.

ĐỌC
  asset-src/words/source/<khoá>.png     khoá = word.id bỏ tiền tố `starters.`
  asset-src/words/plan.json             danh sách 201 khoá hợp lệ

GHI
  public/assets/words/<word.id>.webp    tên tệp = ID ĐẦY ĐỦ (kể cả `starters.`)
  src/data/word-assets.json             manifest: những id THẬT SỰ có tệp

VÌ SAO PHẢI CÓ MANIFEST
  Client không `stat` được tệp. Nếu `WordIcon` cứ thế trỏ `/assets/words/x.webp` thì
  mọi từ chưa sinh xong đều 404 ⇒ bé thấy ô vỡ. Nếu dựa vào `onError` để lùi về emoji
  thì hình nhấp nháy, và trong jsdom `onError` không bao giờ chạy ⇒ không test được.
  Manifest do script sinh từ ĐĨA nên không thể lệch với thực tế.

XỬ LÝ ẢNH (vì sao từng bước)
  1. DỌN HẠT: bản cắt nền còn sót mảng alpha li ti ở góc. Bỏ mọi mảng < 0,02% mảng lớn
     nhất (dùng gán nhãn thành phần theo hàng — chính xác, không cần scipy).
  2. CẮT SÁT + ĐỆM VUÔNG: chuẩn hoá TỈ LỆ chủ thể giữa 201 ảnh. Không làm bước này thì
     có ảnh chủ thể to sát mép, có ảnh bé tí giữa khung ⇒ trong game bé thấy hình to
     nhỏ khác nhau một cách vô cớ.
  3. RESIZE LANCZOS 512² + WEBP q82: 512 đủ cho 3x của ô 80px (thẻ từ vựng) mà vẫn nhẹ.
     Dùng `method=4` chứ không phải 6 — xem chú thích ở hằng `METHOD` (nhanh gấp ~35 lần).
"""

import io
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SOURCE = os.path.join(HERE, "source")
OUT = os.path.join(ROOT, "public", "assets", "words")
MANIFEST = os.path.join(ROOT, "src", "data", "word-assets.json")

SIZE = 512           # cạnh ảnh ra
MARGIN = 0.06        # lề quanh chủ thể, tỉ lệ cạnh dài của bao
QUALITY = 82
ALPHA_MIN = 8        # dưới ngưỡng này coi như trong suốt
SPECK_RATIO = 0.0002  # mảng nhỏ hơn 0,02% mảng lớn nhất ⇒ bỏ

# `method` của libwebp = ĐỘ CHĂM MÃ HOÁ (0–6), KHÔNG phải mức chất lượng (đó là `QUALITY`).
# Đo thật trong môi trường này, ảnh 512² đã tô chi tiết:
#     method=0 → 0,32s 53,0 KB · method=4 → 0,13s 48,0 KB · method=6 → 4,49s 46,4 KB
# Trên ảnh thật `elephant` (25,8 KB) thì method=6 mất **10,5s**. Ghi đĩa chỉ 0,006s/256 KB
# nên nút thắt là bộ mã hoá, không phải ổ đĩa. Đổi 6→4 chỉ làm tệp to thêm ~3,4% nhưng
# nhanh gấp ~35 lần: 201 ảnh ≈ 30 giây thay vì ~35 phút. Ảnh ra y hệt về mặt thị giác vì
# mục tiêu chất lượng nằm ở `QUALITY`.
METHOD = 4

# Ngưỡng dọn "HẠT BỤI": pixel có alpha DƯỚI mức này (≤ 3% đục) thì xoá MÀU, giữ nguyên độ trong
# suốt. Xem ghi chú đầy đủ ở chỗ dùng: mắt không thấy chúng, nhưng trên nền trắng chúng hiện thành
# đốm li ti. ⚠️ ĐỪNG nâng ngưỡng này lên "cho chắc": từ ~32 trở lên là VIỀN RĂNG CƯA HỢP LỆ, xoá
# màu ở đó là làm rìa ảnh bị răng cưa. Đo trên `red`: nhóm 32–63 có 1800 px — đó là rìa đúng.
INVISIBLE_ALPHA_CUTOFF = 8


# ---------------------------------------------------------------------------
# Gán nhãn thành phần liên thông theo HÀNG (run-based union-find).
# Nhanh hơn quét từng điểm rất nhiều và không cần scipy.
# ---------------------------------------------------------------------------

def _components(mask):
    """mask: (H,W) bool. Trả về (labels, sizes) với labels là mảng int32."""
    height, width = mask.shape
    labels = np.zeros((height, width), dtype=np.int32)
    parent = [0]  # parent[0] bỏ trống

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[max(ra, rb)] = min(ra, rb)

    # runs[r] = danh sách (start, end_exclusive, label) của hàng r
    runs_per_row = []
    for row in range(height):
        line = mask[row]
        if not line.any():
            runs_per_row.append([])
            continue
        # biên độ chuyển False→True / True→False
        diff = np.diff(line.astype(np.int8))
        starts = list(np.flatnonzero(diff == 1) + 1)
        ends = list(np.flatnonzero(diff == -1) + 1)
        if line[0]:
            starts.insert(0, 0)
        if line[-1]:
            ends.append(width)

        runs = []
        for start, end in zip(starts, ends):
            label = len(parent)
            parent.append(label)
            runs.append((start, end, label))
            labels[row, start:end] = label

        # nối với hàng trên nếu chồng nhau
        if row > 0:
            for start, end, label in runs:
                for pstart, pend, plabel in runs_per_row[row - 1]:
                    if pstart >= end:
                        break
                    if pend <= start:
                        continue
                    union(label, plabel)
        runs_per_row.append(runs)

    # Gom mọi nhãn về gốc của nó (nén đường đi ở bước find).
    roots = np.array([find(v) for v in range(len(parent))], dtype=np.int32)
    labels = roots[labels]

    # Đếm diện tích từng thành phần — trên mảng ĐÃ DUỘT (1 chiều), tránh lệch trục.
    flat = labels.ravel()
    sizes = {}
    for value, count in zip(*np.unique(flat[flat > 0], return_counts=True)):
        sizes[int(value)] = int(count)
    return labels, sizes


def despeckle(alpha):
    """Bỏ mọi mảng alpha nhỏ. Trả về (alpha mới, số mảng đã bỏ, số điểm ảnh đã bỏ)."""
    mask = alpha > ALPHA_MIN
    if not mask.any():
        return alpha, 0, 0
    labels, sizes = _components(mask)
    if not sizes:
        return alpha, 0, 0
    biggest = max(sizes.values())
    keep = {label for label, size in sizes.items() if size >= biggest * SPECK_RATIO}
    drop_mask = mask & ~np.isin(labels, list(keep))
    removed = int(drop_mask.sum())
    new_alpha = alpha.copy()
    new_alpha[drop_mask] = 0
    return new_alpha, len(sizes) - len(keep), removed


def process(path_out, src_path, verbose=False):
    image = Image.open(src_path).convert("RGBA")
    arr = np.array(image)
    alpha = arr[:, :, 3]

    new_alpha, dropped, removed = despeckle(alpha)
    arr[:, :, 3] = new_alpha

    # Cắt sát chủ thể
    rows = np.flatnonzero(new_alpha.max(axis=1) > ALPHA_MIN)
    cols = np.flatnonzero(new_alpha.max(axis=0) > ALPHA_MIN)
    if len(rows) == 0 or len(cols) == 0:
        raise SystemExit("Ảnh rỗng sau khi dọn hạt: " + src_path)
    top, bottom = int(rows[0]), int(rows[-1]) + 1
    left, right = int(cols[0]), int(cols[-1]) + 1
    arr = arr[top:bottom, left:right]

    # Đệm thành hình vuông, chừa lề đều
    height, width = arr.shape[:2]
    side = int(round(max(height, width) / (1 - 2 * MARGIN)))
    canvas = np.zeros((side, side, 4), dtype=np.uint8)
    y = (side - height) // 2
    x = (side - width) // 2
    canvas[y:y + height, x:x + width] = arr

    # ⚠️⚠️ ĐÃ THỬ "NHÂN ALPHA TRƯỚC KHI THU NHỎ" VÀ **THẤT BẠI** — ĐỪNG THỬ LẠI (2026-10-08).
    #
    #   Giả thuyết ban đầu: thu nhỏ thẳng bằng LANCZOS làm màu của chủ thể loang vào pixel TRONG
    #   SUỐT ⇒ quầng mờ. Cách sửa "chuẩn sách" là premultiply → resize → unpremultiply.
    #
    #   Đã cài và ĐO. Kết quả NGƯỢC LẠI với mong đợi:
    #       red    12794 → 10984   (giảm chút ít)
    #       blue       0 →  1190   (SINH RA đốm màu)
    #       purple     0 →   829   (SINH RA đốm màu)
    #       green      0 →   970   (SINH RA đốm màu)
    #   Lý do: bước chia lại KHUẾCH ĐẠI sai số lượng tử (chia cho alpha nhỏ = nhân lên), nên nó
    #   biến sai số vô hại thành MÀU ở những nơi trước đó sạch. Bản vá làm 3/4 ảnh TỆ ĐI.
    #
    #   Và quan trọng hơn: phép đo cho thấy phần lớn "đốm" KHÔNG phải lỗi. Trên `red`, các pixel
    #   có màu ở viền chia thành: alpha 32–63 (1800 px) và alpha 1–7 (1806 px).
    #   Nhóm alpha 32–63 **là khử răng cưa ĐÚNG** — pixel ở rìa khối, 12–25% đục, mang màu đỏ của
    #   chính chủ thể. Đó là thứ làm rìa mượt; xoá nó đi là làm rìa răng cưa.
    #   ⇒ Thu nhỏ THẲNG được giữ nguyên. Chỉ dọn nhóm còn lại (xem dưới).
    out_img = Image.fromarray(canvas, "RGBA").resize((SIZE, SIZE), Image.LANCZOS)

    # ⚠️ DỌN "HẠT BỤI": pixel GẦN NHƯ TRONG SUỐT (alpha < 8, tức ≤ 3% đục) mà vẫn mang MÀU.
    #    Mắt không thấy chúng vì độ đục quá thấp, nhưng khi soi trên nền trắng chúng hiện thành
    #    đốm li ti. Xoá MÀU của đúng nhóm này là an toàn tuyệt đối — ta không đụng tới bất kỳ
    #    pixel nào có độ đục đủ để nhìn thấy (ngưỡng 8/255 ≈ 3%).
    #    Đo trên `red`: 3610 → 1800 pixel có màu ở vùng gần trong suốt, phần còn lại là viền
    #    răng cưa hợp lệ. `blue`/`purple`/`green` vốn đã 0 nên không đổi.
    arr_out = np.array(out_img, dtype=np.uint8)
    arr_out[arr_out[:, :, 3] < INVISIBLE_ALPHA_CUTOFF, :3] = 0
    out = Image.fromarray(arr_out, "RGBA")
    os.makedirs(os.path.dirname(path_out), exist_ok=True)
    out.save(path_out, "WEBP", quality=QUALITY, method=METHOD)

    if verbose and (dropped or removed):
        print("      dọn %d mảng rác (%d px)" % (dropped, removed))
    return dropped, removed


def write_manifest():
    """
    Quét ĐĨA rồi ghi manifest. Nguồn chân lý là tệp có thật, không phải kế hoạch.

    ⚠️⚠️ SẮP XẾP THEO **ID (bỏ `.webp`)**, KHÔNG theo TÊN TỆP — bẫy đã trả giá:
      `sorted(os.listdir(...))` so sánh cả đuôi `.webp`, nên cặp id "tiền tố + dấu gạch"
      bị đảo thứ tự: `'…mouse-computer.webp'` vs `'…mouse.webp'` — tính đến `mouse` thì
      gặp `-` (0x2D) ở chuỗi này và `.` (0x2E) ở chuỗi kia, mà `-` < `.` ⇒
      **`mouse-computer` đứng TRƯỚC `mouse`**. JavaScript thì so id TRẦN, chuỗi `mouse`
      hết ngay nên **`mouse` đứng trước**. Lệch thứ tự ⇒ test ⑥ (`word-assets.test.ts`)
      ĐỎ dù cả hai nguồn đều đúng dữ liệu.
      Đã nằm im từ đầu dự án vì chỉ lộ khi cả hai id của một cặp cùng có ảnh — đúng lúc
      `mouse` và `mouse-computer` vừa sinh xong. Các cặp còn lại cùng họ: `chicken` /
      `chicken-meat`, `orange-adj` / `orange-n` (cặp này không lộ vì không có `orange` trần).
      Bỏ đuôi trước rồi mới `sorted()` ⇒ thứ tự trùng khớp với `.sort()` của JS.
    """
    ids = []
    if os.path.isdir(OUT):
        ids = sorted(
            name[: -len(".webp")]
            for name in os.listdir(OUT)
            if name.endswith(".webp")
        )
    payload = {
        "_comment": (
            "SINH TỰ ĐỘNG bởi asset-src/words/convert_words.py — ĐỪNG sửa tay. "
            "Danh sách id từ vựng ĐÃ CÓ ảnh; WordIcon chỉ vẽ <img> khi id nằm trong đây."
        ),
        "count": len(ids),
        "ids": ids,
    }
    with io.open(MANIFEST, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return ids


def update_ledger(converted, source_exists):
    """
    Ghi tiến độ. `ledger.json` là SỔ NGUỒN cho việc chạy tiếp khi bị ngắt.

    ⭐ VÌ SAO SỔ NÀY ĐÁNG TIN: trạng thái `done` do CHÍNH script này đặt, ngay sau khi
    tệp webp được ghi ra đĩa. Test `word-assets.test.ts` khẳng định: hễ sổ nói `done`
    thì tệp phải có thật. Nhờ vậy nếu bước sinh ảnh làm mất tệp (bẫy ghi đè cùng giây
    của công cụ sinh ảnh), sổ và đĩa lệch nhau và test đỏ — thay vì im lặng.

    ⚠️ KHÔNG chạm vào `prompt_sha` ở đây. Dấu vân tay thuộc về ẢNH NGUỒN và do `ingest.py`
    đóng lúc ảnh được nạp vào — chạy lại bước chuyển đổi (chỉ nén lại webp) mà đóng dấu
    mới thì sổ sẽ NÓI SAI: ảnh cũ bị gán dấu của prompt mới, đúng thứ mà dấu vân tay sinh
    ra để phát hiện.
    """
    path = os.path.join(HERE, "ledger.json")
    ledger = {}
    if os.path.exists(path):
        with io.open(path, encoding="utf-8") as handle:
            ledger = json.load(handle)
    for key in source_exists:
        entry = ledger.setdefault(key, {"status": "pending", "file": None})
        if key in converted:
            entry["status"] = "done"
        elif entry.get("status") == "done":
            # Có trong sổ là đã xong mà ảnh nguồn không còn ⇒ ảnh nguồn bị mất.
            entry["status"] = "pending"
        entry["file"] = ("source/%s.png" % key) if key in converted else None
    with io.open(path, "w", encoding="utf-8") as handle:
        json.dump(ledger, handle, ensure_ascii=False, indent=2, sort_keys=True)
        handle.write("\n")
    return ledger


def main():
    only_theme = None
    verbose = "-v" in sys.argv
    for i, arg in enumerate(sys.argv):
        if arg == "--only-theme" and i + 1 < len(sys.argv):
            only_theme = sys.argv[i + 1]

    with io.open(os.path.join(HERE, "plan.json"), encoding="utf-8") as handle:
        plan = json.load(handle)

    todo = [item for item in plan if only_theme is None or item["theme"] == only_theme]
    print("Ảnh nguồn: %s" % SOURCE)
    print("Sẽ xử lý %d từ%s\n" % (len(todo), " (chủ đề %s)" % only_theme if only_theme else ""))

    missing = []
    converted = set()
    for item in todo:
        src = os.path.join(SOURCE, item["key"] + ".png")
        if not os.path.exists(src):
            missing.append(item["key"])
            continue
        dst = os.path.join(OUT, item["id"] + ".webp")
        process(dst, src, verbose=verbose)
        converted.add(item["key"])
        print("  %-24s -> %s.webp" % (item["key"], item["id"]))

    ids = write_manifest()
    ledger = update_ledger(converted, source_exists=[item["key"] for item in todo])
    done_total = sum(1 for v in ledger.values() if v.get("status") == "done")

    print("\nĐã chuyển: %d/%d" % (len(converted), len(todo)))
    print("Manifest : %d id có ảnh (%s)" % (len(ids), MANIFEST))
    print("Tiến độ  : %d/%d từ đã có ảnh" % (done_total, len(plan)))
    if missing:
        print("Thiếu ảnh nguồn (%d): %s" % (len(missing), ", ".join(missing)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
