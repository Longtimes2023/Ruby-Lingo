#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RubyLingo — lập kế hoạch sinh 201 hình từ vựng.

ĐỌC
  src/data/levels/starters/themes/*.json   (nguồn chân lý: danh sách từ)
  asset-src/words/subjects.py              (câu tả chủ thể, viết tay)

GHI
  asset-src/words/plan.json     danh sách có thứ tự: khoá, id, en, vi, chủ đề, prompt đầy đủ
  asset-src/words/ledger.json   tiến độ từng khoá (để chạy tiếp khi bị ngắt)

NGUYÊN TẮC
  1. Danh sách từ lấy từ JSON, KHÔNG viết tay ⇒ thêm từ mới là tự có việc.
  2. Thiếu câu tả ⇒ DỪNG NGAY (exit 1). Thà không chạy còn hơn sinh hình sai nghĩa.
  3. Thứ tự cố định (theo chủ đề rồi theo thứ tự trong tệp) ⇒ chạy lại cho cùng kết quả.
"""

import hashlib
import io
import json
import glob
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
THEMES = os.path.join(ROOT, "src", "data", "levels", "starters", "themes")

sys.path.insert(0, HERE)
from subjects import (  # noqa: E402
    SUBJECTS,
    OVERRIDES,
    NOT_SOLO,
    STYLE_HEAD,
    STYLE_HEAD_PLAIN,
    NO_FACE_CLAUSE,
    SOLO_CLAUSE,
    BANNED_TEXT,
    STYLE_TAIL,
)


def load_words():
    """Đọc mọi từ từ các tệp chủ đề, giữ nguyên thứ tự tệp + thứ tự trong tệp."""
    out = []
    for path in sorted(glob.glob(os.path.join(THEMES, "*.json"))):
        theme = os.path.basename(path)[: -len(".json")]
        with io.open(path, encoding="utf-8") as handle:
            data = json.load(handle)
        for word in data["words"]:
            word["_theme"] = theme
            out.append(word)
    return out


def select(words):
    """
    198 từ `picturable` + 3 từ `my-body` không vẽ được nhưng VẪN hiện trên thẻ
    từ vựng (hair/body/head) — đúng ba từ đã gây ra phàn nàn ban đầu.

    Vì sao không lấy hết 275: bảng chữ cái (A–Z) và số (one–twenty) KHÔNG được
    vẽ thành hình — thẻ của chúng phải hiện đúng CHỮ/số, đó mới là bài học.
    """
    chosen = [w for w in words if w.get("picturable")]
    extra = [
        w
        for w in words
        if not w.get("picturable") and w.get("primaryThemeId") == "my-body"
    ]
    return chosen + extra


def key_of(word):
    return word["id"].split(".", 1)[1]


def uses_solo(key):
    """
    Đồ vật có kèm câu "đứng một mình, không ai cầm" không?

    MẶC ĐỊNH LÀ CÓ. Chỉ những khoá nằm trong `subjects.NOT_SOLO` (con vật · người &
    hành động · xe có mặt · bộ phận cơ thể) mới được phép có sinh vật trong hình.
    Ngoại lệ đặt được theo từng khoá qua `OVERRIDES[key]["solo"]` khi cần.
    """
    override = OVERRIDES.get(key, {})
    if "solo" in override:
        return bool(override["solo"])
    return key not in NOT_SOLO


def build_prompt(key, subject):
    """
    Ghép prompt. Ba ngoại lệ theo từng khoá:
      · `no_text=False` → cho phép chữ, chỉ khi chính từ đó LÀ một chữ (vd `letter`).
      · `no_face=True`  → chủ thể là VẬT THỂ: đổi sang khối phong cách KHÔNG mặt và
        thêm câu cấm mặt. Xem lý do đầy đủ ở `subjects.OVERRIDES` — tóm tắt: bộ phận
        cơ thể mọc mặt thì bé đọc ra "face" thay vì "nose"/"ear".
      · `solo` (mặc định BẬT) → thêm câu "đồ vật đứng một mình, không ai cầm". Xem lý do
        ở `subjects.SOLO_CLAUSE` — tóm tắt: mô hình đọc `picture`/`painting` thành *hoạt
        động* rồi vẽ thêm một đứa bé, và thẻ từ vựng thì phải cho thấy ĐỒ VẬT.

    ⭐⭐ NHÃN ĐỨNG ĐẦU LÀ **KHOÁ**, KHÔNG PHẢI `en` — VÀ ĐÓ LÀ ĐIỀU KIỆN SỐNG CÒN.
      Công cụ sinh ảnh đặt tên tệp theo ~32 ký tự ĐẦU của prompt (đã quan sát:
      "chicken__a_cute_friendly_hen___…" · "Vivid_3D_animated_character__i_…"). Nếu mọi
      prompt đều mở bằng cùng một câu phong cách thì MỌI tệp nhận cùng một tên gốc, và
      hai lời gọi rơi vào cùng một giây sẽ GHI ĐÈ NHAU — đúng cái bẫy đã làm mất 2/8 ảnh
      mẫu (mọi lời gọi vẫn báo `completed`).

      Bản đầu dùng `word["en"]` làm nhãn. SAI, vì `en` KHÔNG duy nhất — đo được **3 nhóm
      trùng** trong 201 từ: `chicken` (→ chicken & chicken-meat), `mouse` (→ mouse &
      mouse-computer), `orange` (→ orange-adj & orange-n). Hậu quả không chỉ là ghi đè:
      `ingest.py` tách khoá ở đầu tên tệp, nên ảnh "chuột máy tính" sẽ được nạp với khoá
      `mouse` và bị coi là **đã có sẵn** ⇒ **bỏ qua trong im lặng**. Khoá thì duy nhất
      theo cấu trúc (201/201), không chứa `_`, dài nhất 14 ký tự ⇒ an toàn trong 32 ký tự.
    """
    override = OVERRIDES.get(key, {})
    banned = "" if override.get("no_text") is False else BANNED_TEXT + " "

    # ⭐ CHỌN KHỐI PHONG CÁCH — VÀ ĐÂY LÀ CHỖ SUÝT SINH RA MÂU THUẪN.
    # `STYLE_HEAD` mở đầu bằng *"Vivid 3D animated CHARACTER"* và có *"big expressive
    # friendly eyes"*. Với con vật / em bé thì đúng. Với ĐỒ VẬT thì nó mời mô hình vẽ
    # thêm một nhân vật — đúng cái đã xảy ra ở `picture` và `painting` (cả hai ra một đứa
    # bé đang cầm khung tranh / đang vẽ). Nay đồ vật còn nhận thêm `SOLO_CLAUSE`
    # (*"no people appear anywhere"*): để nguyên "character" bên cạnh "no people" là hai
    # mệnh lệnh ngược nhau — họ lỗi đã trả giá với `NO_FACE_CLAUSE`. Nên:
    #     · chủ thể là ĐỒ VẬT  (no_face hoặc solo) → `STYLE_HEAD_PLAIN`  → không mời nhân vật
    #     · chủ thể là SINH VẬT (còn lại)           → `STYLE_HEAD`        → có mắt to, dễ thương
    # Hai khối giữ NGUYÊN chất liệu, ánh sáng, bảng màu, và cùng cấm bóng nhựa ⇒ 201 ảnh
    # vẫn đồng bộ một phong cách; chỉ khác việc CÓ hay KHÔNG có đôi mắt to.
    #
    # ⚠️ CHỦ DỰ ÁN ĐÃ NÓI RÕ VỀ MẶT/MẮT TRÊN ĐỒ VẬT (2026-10-07):
    #    *"Nói chung có mặt mắt mà cute thì ọk, mà ghê quá thì bỏ qua vụ đó đi, chỉ hình
    #     ảnh là được"* ⇒ mặt trên đồ vật KHÔNG phải lỗi, nên:
    #      · 31 ảnh `at-home` đã sinh bằng `STYLE_HEAD` (lamp/box/armchair/television…
    #        CÓ mặt, dễ thương, chủ dự án đã duyệt) ⇒ GIỮ NGUYÊN, KHÔNG sinh lại chỉ để
    #        bỏ mặt đi. Đốt ~200 credit cho một thứ được phép có là lãng phí.
    #      · Nhưng với 101 từ đồ vật CÒN LẠI thì `STYLE_HEAD_PLAIN` vẫn đúng hơn, vì
    #        "character" chính là thứ đã đẻ ra nhân vật lạ, và bỏ mặt đi thì đồ vật
    #        cạnh nhau DỄ PHÂN BIỆT HƠN — đúng lỗi gốc chủ dự án phàn nàn.
    is_object = bool(override.get("no_face")) or uses_solo(key)
    style_head = STYLE_HEAD_PLAIN if is_object else STYLE_HEAD
    parts = ["%s: %s." % (key, subject), style_head]
    if override.get("no_face"):
        parts.append(NO_FACE_CLAUSE)
    if uses_solo(key):
        parts.append(SOLO_CLAUSE)
    if override.get("style_extra"):
        parts.append(override["style_extra"])
    parts.append(banned + STYLE_TAIL)
    return " ".join(part for part in parts if part)


def prompt_stem(prompt):
    """
    Mô phỏng cách công cụ sinh ảnh đặt tên gốc: 32 ký tự đầu, ký tự lạ hoá thành `_`.
    Dùng để TỰ KIỂM trước khi tiêu credit — xem `main()`.
    """
    return re.sub(r"[^A-Za-z0-9]+", "_", prompt.strip())[:32]


def prompt_sha(prompt):
    """
    Dấu vân tay của prompt — 12 ký tự đầu của SHA-256.

    ⭐ VÌ SAO CẦN: prompt đổi mà ảnh trên đĩa KHÔNG đổi là một trạng thái hoàn toàn im
    lặng. Đã xảy ra thật trong dự án này: sau khi sửa chủ thể `chair`, `ingest.py` vẫn
    chép ảnh CŨ vì nó lấy tệp ĐẦU TIÊN theo thứ tự tên — mọi cổng kiểm xanh, ảnh y nguyên.
    `ledger.json` ghi `prompt_sha` ngay lúc chuyển ảnh, nên lệch nhau là ĐẾM ĐƯỢC thay vì
    phải tin vào trí nhớ. Không lưu cả prompt: sổ chỉ cần trả lời "có khác không".
    """
    return hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:12]


def main():
    words = load_words()
    chosen = select(words)

    missing = sorted(key_of(w) for w in chosen if key_of(w) not in SUBJECTS)
    unused = sorted(k for k in SUBJECTS if k not in {key_of(w) for w in chosen})
    if unused:
        print("!! Co cau ta KHONG dung toi (go khoi subjects.py): " + ", ".join(unused))
    if missing:
        print("!! THIEU cau ta cho %d tu:" % len(missing))
        for key in missing:
            print("     " + key)
        print("   -> Them vao asset-src/words/subjects.py roi chay lai.")
        return 1

    plan = []
    for word in chosen:
        key = key_of(word)
        prompt = build_prompt(key, SUBJECTS[key])
        plan.append(
            {
                "key": key,
                "id": word["id"],
                "en": word["en"],
                "vi": word["vi"],
                "theme": word["_theme"],
                "subject": SUBJECTS[key],
                "prompt": prompt,
                "prompt_sha": prompt_sha(prompt),
            }
        )

    # ⭐ TỰ KIỂM 1 — NHÃN PHẢI ĐỨNG ĐẦU VÀ TÁCH KHỎI PHẦN CÒN LẠI.
    # `ingest.py` lấy khoá bằng cách tách tên tệp ở cụm `__` đầu tiên. Nếu khoá không
    # nằm ở đầu prompt thì tên tệp sẽ không suy ra được khoá ⇒ ảnh bị xếp vào "không
    # khớp khoá nào" (thấy được) hoặc tệ hơn: khớp NHẦM khoá khác (vd `mouse` nuốt
    # `mouse-computer`) rồi bị bỏ qua trong im lặng.
    for item in plan:
        expect = item["key"].replace("-", "_") + "_"
        if not prompt_stem(item["prompt"]).startswith(expect):
            print("!! NHAN KHONG DUNG DAU PROMPT: %s" % item["key"])
            print("     ten goc: %s" % prompt_stem(item["prompt"]))
            return 1

    # ⭐ TỰ KIỂM 2 — 201 prompt phải cho 201 TÊN GỐC KHÁC NHAU.
    # Trùng tên gốc ⇒ hai lời gọi cùng giây ghi đè nhau, mất ảnh mà vẫn báo thành công.
    stems = {}
    for item in plan:
        stems.setdefault(prompt_stem(item["prompt"]), []).append(item["key"])
    trung = {stem: keys for stem, keys in stems.items() if len(keys) > 1}
    if trung:
        print("!! %d TEN GOC TRUNG NHAU (nguy co ghi de):" % len(trung))
        for stem, keys in trung.items():
            print("     %-34s %s" % (stem, ", ".join(keys)))
        print("   -> Doi cau ta trong subjects.py cho khac ngay tu dau cau.")
        return 1

    # ⭐ TỰ KIỂM 3 — `en` TRÙNG THÌ PHẢI BIẾT (đây là lý do nhãn KHÔNG được dùng `en`).
    by_en = {}
    for item in plan:
        by_en.setdefault(item["en"], []).append(item["key"])
    for label, keys in sorted(by_en.items()):
        if len(keys) > 1:
            print("   (luu y) `en` trung: %-10s -> %s  (nen dung KHOA lam nhan, khong dung `en`)" % (label, ", ".join(keys)))

    # ⭐ TỰ KIỂM 4 — `SOLO_CLAUSE` CẤM "no hands", NÊN CHỦ THỂ KHÔNG ĐƯỢC NHẮC TỚI BÀN TAY.
    # Đây là bẫy ĐÃ TRẢ GIÁ một lần với `NO_FACE_CLAUSE` (bản nháp cấm "NO nose" trong khi
    # `nose` chính là chủ thể). Lần này gài phép kiểm TRƯỚC khi tiêu credit, để nếu sau này
    # ai bỏ `hand`/`arm` khỏi `NOT_SOLO` thì chương trình DỪNG chứ không sinh ảnh tự mâu thuẫn.
    # Khớp theo TỪ TRỌN VẸN: `handbag`/`handle` không bị coi là "hand".
    part_re = re.compile(r"\b(?:hands?|palms?|wrists?)\b", re.IGNORECASE)
    for item in plan:
        if uses_solo(item["key"]) and part_re.search(item["subject"]):
            print("!! TU MAU THUAN: `%s` nhan SOLO (cam \"no hands\") nhung chu the nhac toi"
                  " ban tay:" % item["key"])
            print("     %s" % item["subject"])
            print("   -> Them khoa nay vao subjects.NOT_SOLO, hoac bo chu 'hand' khoi chu the.")
            return 1

    # Tự kiểm 5 — gõ sai tên khoá trong `NOT_SOLO` (khoá không tồn tại) là lỗi im lặng:
    # khoá đó không bao giờ được dùng tới, còn khoá thật thì lặng lẽ nhận SOLO.
    all_keys = {item["key"] for item in plan}
    ghosts = sorted(k for k in NOT_SOLO if k not in SUBJECTS)
    if ghosts:
        print("!! NOT_SOLO co khoa KHONG TON TAI trong SUBJECTS: " + ", ".join(ghosts))
        return 1
    solo_keys = sorted(k for k in all_keys if uses_solo(k))
    print("   (luat hinh) %d tu nhan cau 'dung mot minh, khong ai cam'; %d tu duoc phep co"
          " sinh vat" % (len(solo_keys), len(all_keys) - len(solo_keys)))

    with io.open(os.path.join(HERE, "plan.json"), "w", encoding="utf-8") as handle:
        json.dump(plan, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    ledger_path = os.path.join(HERE, "ledger.json")
    ledger = {}
    if os.path.exists(ledger_path):
        with io.open(ledger_path, encoding="utf-8") as handle:
            ledger = json.load(handle)
    for item in plan:
        ledger.setdefault(item["key"], {"status": "pending", "file": None})
    with io.open(ledger_path, "w", encoding="utf-8") as handle:
        json.dump(ledger, handle, ensure_ascii=False, indent=2, sort_keys=True)
        handle.write("\n")

    done = sum(1 for v in ledger.values() if v.get("status") == "done")
    print("plan.json: %d tu" % len(plan))
    print("ledger   : %d da xong / %d tong" % (done, len(ledger)))

    # ⭐ BÁO CÁO LỆCH PROMPT — biến "chắc là ảnh cũ" thành một CON SỐ.
    # `prompt_sha` do `convert_words.py` ghi vào sổ ngay lúc chuyển ảnh, nên so sánh được.
    # Ảnh xong TRƯỚC khi có cơ chế này không có dấu ⇒ xếp riêng, không gộp vào "lệch".
    stale, unmarked = [], []
    for item in plan:
        entry = ledger.get(item["key"], {})
        if entry.get("status") != "done":
            continue
        recorded = entry.get("prompt_sha")
        if recorded is None:
            unmarked.append(item["key"])
        elif recorded != item["prompt_sha"]:
            stale.append(item["key"])
    if stale:
        print("   (luu y) %d anh da sinh bang PROMPT CU (chu the/phong cach da doi):" % len(stale))
        print("           " + ", ".join(sorted(stale)))
        print("           -> muon anh khop ban hien tai thi chay lai _verify/regen_prep.py <khoa>")
    if unmarked:
        print("   (luu y) %d anh sinh TRUOC khi co dau van tay prompt (khong do duoc lech)" % len(unmarked))

    by_theme = {}
    for item in plan:
        by_theme.setdefault(item["theme"], 0)
        by_theme[item["theme"]] += 1
    for theme, count in by_theme.items():
        print("   %-24s %3d" % (theme, count))
    return 0


if __name__ == "__main__":
    sys.exit(main())
