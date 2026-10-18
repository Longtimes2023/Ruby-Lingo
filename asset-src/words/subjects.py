#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RubyLingo — ĐẶC TẢ CHỦ THỂ cho 249 hình từ vựng (Starters).

⚠️ Con số trên là KẾT QUẢ ĐẾM, không phải mục tiêu: `plan.py` in ra số thật ở dòng
   "plan.json: N tu". Đừng sửa con số này bằng tay khi thêm/bớt từ — chạy `plan.py`
   rồi chép lại, hoặc bỏ hẳn con số đi nếu nó cứ lệch.

Lịch sử số lượng: 200 (bản gốc, 18/26 mục đã xong) → 239 → 249 (đợt 2026-10-15):
   · 28 từ trước đây `picturable: false` (bé đang thấy EMOJI mơ hồ) nay được vẽ thật;
   · 11 cụm "màu + đồ" (`purple glasses`, `black hat`…) cho bài mới
     `at-the-clothes-shop/l6`+`l7` — PDF Cambridge tr.9 in NGUYÊN CỤM, tách rời 11 màu
     và 14 món đồ thì bé không bao giờ học được trật tự `tính từ + danh từ`;
   · 10 từ còn THIẾU so với wordlist A–Z của PDF (mục 22): `playground`, `ball`,
     `boots`, `crayon`, `classmate`, `read`, `write`, `board-game` (at-school/l5) và
     `bike`, `skateboard` (my-street).

VÌ SAO CÓ TỆP NÀY
-----------------
Prompt tự động kiểu "a cute {word}" sinh hình mơ hồ: `swim` ra một đứa trẻ đứng,
`angry` ra một khuôn mặt chung chung, `hair` ra nguyên cái đầu. Với một app dạy
từ vựng, hình SAI nghĩa còn tệ hơn không có hình — bé học sai từ.

Nên mỗi từ có một câu tả riêng, viết tay, nói rõ: vẽ CÁI GÌ, ở TƯ THẾ nào, và
những từ dễ nhập nhằng thì phân biệt bằng gì (xem các cặp `mouth`/`smile`,
`face`/`head`, `picture`/`painting`, `draw`/`drawing`, `orange-adj`/`orange-n`).

`plan.py` sẽ BÁO LỖI nếu thiếu bất kỳ khoá nào ⇒ không từ nào lặng lẽ rơi về
prompt mặc định.

Quy ước chung (đã chốt với chủ dự án 2026-10-07):
  · Phong cách: 3D phim hoạt hình, mềm, màu tươi — KHÔNG bóng nhựa.
  · Nền: TRONG SUỐT (thẻ từ vựng là nền trắng, ô game đổi sang xanh/đỏ/vàng nhạt).
  · Con vật: TOÀN THÂN. Một chủ thể duy nhất, giữa khung, chừa lề.
"""

# ---------------------------------------------------------------------------
# Nửa cố định của prompt.
# ---------------------------------------------------------------------------

STYLE_HEAD = (
    "Vivid 3D animated character, in the style of a modern animated children's "
    "feature film: appealing exaggerated cute proportions, soft cinematic lighting, "
    "rich saturated cheerful colours, big expressive friendly eyes, smooth shading "
    "with only gentle soft highlights (NOT glossy plastic, NOT a shiny toy, no harsh "
    "specular glints). Bright, warm and lively, appealing to children aged 7 and up."
)

# ⭐ VÌ SAO CÓ BẢN THỨ HAI CỦA KHỐI PHONG CÁCH
# Khối trên mở đầu bằng *"animated character"* và có *"big expressive friendly eyes"*.
# Với con vật / nhân vật thì đúng. Với ĐỒ VẬT và BỘ PHẬN CƠ THỂ thì nó biến chủ thể
# thành một sinh vật: lần sinh thử `my-body` cho ra `ear` và `nose` MỌC MẶT (mắt + miệng),
# `hand` có mặt trên lòng bàn tay, `leg` có mặt ở đầu gối. Với thẻ từ vựng thì cái mặt
# **tranh mất sự chú ý** khỏi chính bộ phận cần dạy — đúng lỗi chủ dự án phàn nàn
# ("bé nhìn cái là biết chính xác hair là gì"). Bản dưới giữ NGUYÊN chất liệu, ánh sáng,
# độ bóng và bảng màu; chỉ bỏ đúng mệnh đề "mắt to" và cặp chữ "character".
STYLE_HEAD_PLAIN = (
    "Vivid 3D animated style, in the style of a modern animated children's "
    "feature film: appealing exaggerated cute rounded proportions, soft cinematic "
    "lighting, rich saturated cheerful colours, smooth shading with only gentle "
    "soft highlights (NOT glossy plastic, NOT a shiny toy, no harsh specular "
    "glints). Bright, warm and lively, appealing to children aged 7 and up."
)

# Câu bắt buộc đi kèm `STYLE_HEAD_PLAIN`.
#
# ⚠️ ĐỪNG liệt kê "NO nose / NO mouth" như bản nháp đầu: với `nose` và `smile` thì cái
# mũi / cái miệng CHÍNH LÀ chủ thể, câu cấm sẽ tự mâu thuẫn và mô hình nhận được hai
# mệnh lệnh ngược nhau. Cách diễn đạt dưới đây không thể mâu thuẫn với bất kỳ chủ thể nào:
# cấm thêm thứ KHÔNG được tả ở trên, chứ không cấm tên bộ phận cụ thể.
NO_FACE_CLAUSE = (
    "IMPORTANT: this is a single plain OBJECT, NOT a living character. Do NOT add anything "
    "that is not described above: no extra face, no extra eyes, no extra mouth, no arms and no legs."
)

# ⭐⭐ CÂU LUẬT CHO **ĐỒ VẬT**: "một mình, không ai cầm".
#
# VÌ SAO CẦN (đã trả giá ở `picture` và `painting` của `at-home`):
#   Mô hình sinh ảnh hiểu "picture"/"painting" thành *HOẠT ĐỘNG* ⇒ vẽ thêm một đứa bé
#   đang cầm khung tranh / đang vẽ trước giá vẽ. Với thẻ từ vựng thì đó là lỗi nặng:
#   thẻ từ `picture` phải cho bé thấy **cái bức tranh**, không phải một đứa bé. Bé nhìn
#   vào sẽ học sai từ — đúng lỗi chủ dự án phàn nàn ("các icon không khớp với thẻ từ vựng").
#   Và vì mọi đồ vật khác đều có cùng nguy cơ (`jacket`, `shoe`, `bag`… rất dễ bị vẽ
#   thành "em bé đang cầm"), sửa từng từ một là cách chắc chắn sẽ sót.
#
# ⚠️ KHÔNG viết "no arms" như bản nháp đầu: `doll`, `robot`, `monster` vốn CÓ tay, và
#   câu cấm chung sẽ biến chúng thành cụt. Cái thực sự để lộ "có người" là BÀN TAY và
#   NGƯỜI, nên chỉ cấm đúng hai thứ đó. Danh sách `NOT_SOLO` bên dưới mới là nơi quyết
#   định từ nào ĐƯỢC PHÉP có sinh vật — và `plan.py` TỰ KIỂM rằng mọi khoá đều được
#   quyết định dứt khoát (không từ nào rơi vào trạng thái "không rõ").
SOLO_CLAUSE = (
    "IMPORTANT: the object is shown completely on its own, appearing by itself. "
    "Nobody is holding it: no hands and no people appear anywhere in the image."
)

BANNED_TEXT = (
    "No text, no letters, no numbers, no logo, no watermark, no frame, no border."
)

# Câu ép nhân vật NGƯỜI LỚN về đúng tông chibi của nhân vật trẻ em — dùng qua
# `OVERRIDES[key]["style_extra"]`, xem ghi chú ở `OVERRIDES`.
#
# ⭐ Vì sao phải nói cả ba vế "NOT realistic / NOT photorealistic / NOT a real person":
#    khối `STYLE_HEAD` đã có sẵn "appealing exaggerated cute proportions", mà 6 ảnh người lớn
#    vẫn ra tả thực. Với NGƯỜI LỚN, mô hình mặc định kéo về giải phẫu thật mạnh hơn nhiều so với
#    trẻ em. Nên câu này phải mô tả HÌNH DÁNG CỤ THỂ (đầu to, thân ngắn, tay chân mập) chứ không
#    chỉ nói "cute" — và phải cấm thẳng ba kiểu đầu ra sai.
ADULT_CHIBI_CLAUSE = (
    "IMPORTANT: draw this character with the SAME exaggerated cartoon proportions as a cute chibi "
    "child character: a big round head, big friendly eyes, a short chubby body and short stubby "
    "limbs. Clearly stylised and cartoonish, NOT realistic, NOT photorealistic, NOT a real person, "
    "NOT a 3D portrait of a human being."
)

STYLE_TAIL = (
    "BACKGROUND: fully transparent — clean cut-out edges, absolutely NO background, "
    "NO gradient, NO bubbles, NO floor, NO ground plane. A single subject only, "
    "centred, occupying about 80% of the frame with clear empty margin around it. "
    "Square 1:1 composition."
)

# ---------------------------------------------------------------------------
# Chủ thể từng từ. Khoá = `word.id` bỏ tiền tố `starters.`.
# ---------------------------------------------------------------------------

SUBJECTS = {
    # ===== at-home (31) =====================================================
    # Phòng ốc: KHÔNG thể là "một đồ vật" — `bed` đã là cái giường rồi. Dùng
    # diorama: một khối phòng nhỏ kiểu nhà búp bê, nổi, nền trong suốt. Đọc ở
    # 44px vẫn ra "cái phòng" nhờ silhouette khối hộp + mái.
    "bedroom": "a cute miniature isometric doll-house room chunk of a cosy child's bedroom: "
               "a small bed with a pillow and a folded blanket, a little glowing lamp on a round rug, "
               "shown as a floating cut-away room slab",
    "bathroom": "a cute miniature isometric doll-house room chunk of a small bathroom: "
                "a rounded white bathtub, a round mirror and a small wash basin, floating cut-away room slab",
    "kitchen": "a cute miniature isometric doll-house room chunk of a small kitchen: "
               "a little stove, a sink, a cupboard and a hanging pot, floating cut-away room slab",
    "living-room": "a cute miniature isometric doll-house room chunk of a small living room: "
                   "a plump sofa, a low table with a lamp, a round rug and a framed picture on the wall, "
                   "floating cut-away room slab",
    "dining-room": "a cute miniature isometric doll-house room chunk of a small dining room: "
                   "a round table with two chairs and two plates, a lamp hanging above, floating cut-away room slab",
    # ⚠️ `hall` / `room` — TRƯỚC ĐÂY `picturable: false` nên bé thấy EMOJI (🚪🧭 và 🏡), mơ hồ
    #    không kém gì nhau.
    #    · `hall` dùng ĐÚNG họ "miniature isometric doll-house room chunk" của bedroom/kitchen
    #      để các ảnh phòng nằm cạnh nhau vẫn là một bộ. PDF tr.15 vẽ hành lang có MÓC TREO
    #      QUẦN ÁO, CỬA, GƯƠNG và ĐIỆN THOẠI ⇒ tả đủ bốn thứ đó.
    "hall": "a cute miniature isometric doll-house room chunk of a narrow hallway inside a house: "
            "a closed door at the far end, a row of hooks on the wall holding one hanging coat, a small "
            "oval mirror and a wall telephone beside the door, and a small rug on the floor, "
            "floating cut-away room slab",
    # ⚠️⚠️ `room` — YÊU CẦU ĐÃ SỬA (chủ dự án, nguyên văn): *"Hình ảnh căn phòng (room) cũng
    #    không đúng. **Nên là hình ảnh toàn ngôi nhà và các phòng**."*
    #    Bản nháp đầu của tôi tả "một căn phòng TRỐNG" — SAI: đó là cách dạy `room` = "cái phòng
    #    trống", trong khi nghĩa cần dạy là "phòng (của một ngôi nhà)". Nay là **MẶT CẮT cả ngôi
    #    nhà**: bổ dọc, hở mái, nhìn thấy 4 phòng bên trong xếp thành 2 tầng.
    #    ⚠️ PHẢI KHÁC `house` — và đây là chỗ dễ hỏng nhất: `house` là *"a single cute little house
    #       with a pink roof, a round window, a yellow door"*, tức VỎ NHÀ NHÌN TỪ NGOÀI, không
    #       thấy phòng nào. Khác biệt được GHI THẲNG vào câu tả ("the front wall is open … the
    #       outer walls and roof still visible around them") thay vì để mô hình tự đoán.
    #    ⚠️ Cũng phải khác `bedroom`/`kitchen`/`living-room`: bốn ảnh đó là MỘT phòng, `room` là
    #       NHIỀU phòng trong MỘT ngôi nhà.
    "room": "a cut-away view of a whole little house: the front wall is open and the roof is lifted, "
            "so four rooms inside are all visible at once — a living room with a sofa, a bedroom with a "
            "bed, a kitchen with a stove and a bathroom with a bath — arranged in two rows inside one "
            "house-shaped block, with the outer walls and the roof still visible around them",
    "chair": "a single simple child's chair with four straight legs and a plain slatted back, "
             "painted in a cheerful colour, side view, standing alone",
    "table": "a single cute chunky round wooden table with four short legs, side view",
    "lamp": "a single cute table lamp with a rounded base and a warm glowing lampshade",
    "sofa": "a single cute plump two-seat sofa in a soft pastel colour with round cushions, front view",
    "bed": "a single cute child's bed with a plump pillow and a neatly folded blanket, side view",
    "box": "a single cute open cardboard toy box with the lid tilted, a few rounded toys peeking out",
    # ⚠️ `mirror` — ẢNH CŨ SAI NỘI DUNG (chủ dự án báo, 2026-10-15): ra **gương CẦM TAY có
    #    MẶT CƯỜI** — bé nhìn ra "cái mặt", không ra "cái gương". Hai lỗi cùng lúc:
    #      1. "hand mirror" bị vẽ thành đồ cầm tay CÓ MẶT (đúng cái bẫy `NO_FACE_CLAUSE` đã
    #         ghi ở đầu tệp: đồ vật mọc mặt thì bé đọc sai từ);
    #      2. mất hẳn ý "treo tường".
    #    Nay: gương TREO TƯỜNG (móc treo trên đỉnh) + TRONG GƯƠNG phản chiếu một căn phòng mờ.
    #    ⚠️ KHÔNG viết "hand mirror": `SOLO_CLAUSE` có vế *"no hands"*, hai mệnh lệnh ngược nhau
    #    (phép kiểm 4 của `plan.py` bắt đúng ca này). Tả bằng "cái móc treo".
    "mirror": "a single cute oval wall mirror with a rounded pastel frame and a small metal loop at the "
              "top for hanging on a hook, the glass softly reflecting a blurred little room with a window "
              "and a chair inside it",
    "bookcase": "a single cute small wooden bookcase with a few colourful books standing on its shelves",
    "cupboard": "a single cute wooden cupboard with two doors, one door slightly open showing folded towels",
    "armchair": "a single cute plump armchair with rounded armrests and a soft cushion, front view",
    "rug": "a single cute oval woven rug with a simple cheerful pattern, seen slightly from above at an angle",
    # ⚠️ Kim đồng hồ: tiếng Anh gọi là "hands" ⇒ đụng thẳng vế *"no hands"* của
    # `SOLO_CLAUSE`, và mô hình rất dễ vẽ hai BÀN TAY NGƯỜI trên mặt đồng hồ.
    # Gọi bằng "pointers" — đúng nghĩa, không đụng chữ cấm.
    "clock": "a single cute round wall clock with a friendly smiling face and two short rounded pointers",
    "radio": "a single cute retro portable radio with a round speaker grille and one large dial",
    "window": "a single cute open window with a rounded frame, white curtains at the sides and a small flower pot on the sill",
    "door": "a single cute closed wooden door with a round handle, a small round window and a tiny welcome mat",
    # `wall` — trước đây `picturable: false` (bé thấy 🧱, tức "viên gạch", SAI nghĩa: wall là
    # mặt tường, không phải gạch). Tả MỘT MẢNG TƯỜNG nhìn thẳng, có gờ chân tường ở dưới —
    # đó là chi tiết duy nhất khiến bé đọc ra "tường" thay vì "một hình chữ nhật màu kem".
    # ⚠️ 2026-10-15 — ẢNH ĐÃ SINH BỊ LOẠI DÙ ĐÚNG NGHĨA: bản trước chỉ có gờ chân tường nên
    #    ở cỡ 44px (thẻ hình trong game) bé đọc ra "thẻ trắng" — quá trống, không có điểm
    #    nhận dạng nào. Thêm CÔNG TẮC ĐÈN trắng nhỏ ở bên phải: một chi tiết nhỏ nhưng đủ
    #    để mắt bám vào và hiểu "đây là mặt tường trong nhà", không phải tờ giấy.
    "wall": "a single flat section of indoor wall seen straight on: a smooth pale cream plaster surface "
            "with a plain white skirting board along its bottom edge and one small white light-switch "
            "plate near the right side",
    # CẶP DỄ LẪN `picture` / `painting` / `drawing` — ba từ đều là "hình vẽ" trong tiếng
    # Việt nhưng ba thứ khác hẳn nhau trong tiếng Anh. Phân biệt bằng ĐỒ VẬT, không bằng
    # tính từ: KHUNG GỖ treo tường ↔ TOAN TRÊN GIÁ VẼ ↔ TỜ GIẤY có nét bút sáp.
    # ⚠️ Cả ba lần đầu đều bị vẽ thêm một đứa bé (mô hình đọc thành *hoạt động*). Tên gọi
    #    "a single framed picture" vẫn chưa đủ ⇒ mỗi câu phải nói rõ đây là TÁC PHẨM ĐÃ
    #    XONG, và `SOLO_CLAUSE` phủ thêm tầng thứ hai (xem `NOT_SOLO`).
    "picture": "a single FINISHED framed landscape picture, shown straight on and alone: a plain light "
               "wooden frame around a flat painted scene of a sunny green hill with one little tree",
    "painting": "a single FINISHED painting on a plain wooden easel: a stretched white canvas covered in "
                "thick bright rainbow paint strokes, with one small paintbrush resting on the easel ledge",
    "television": "a single cute rounded retro television set with two small feet and a soft glowing blue screen",
    "phone": "a single cute rounded mobile phone standing upright, blank glowing screen with no icons and no interface",
    "flower": "a single cute daisy flower with big rounded white petals, a yellow centre, a green stem and two leaves",
    "house": "a single cute little house with a pink roof, a round window, a yellow door and a small chimney",
    "apartment": "a single cute small apartment building with three stacked floors, several round windows, a pink roof and a little entrance",
    "garden": "a cute little garden patch on a rounded grass slab: a green hedge, three colourful flowers and a small watering can",
    "cat": "a cute friendly ginger kitten, FULL BODY, sitting down, facing the viewer, fluffy and round with big eyes",
    "doll": "a single cute rag doll with braided yellow hair and a pink dress, sitting upright",
    # ⚠️ `bath`: bản đầu tả "bathtub filled with fluffy soap bubbles" và bị bộ kiểm an
    # toàn CHẶN (báo sai `safety_violations=[sexual]`, lỗi 400 `moderation_blocked`).
    # Tả bồn tắm TRỐNG, không nước, không bọt ⇒ vẫn đúng nghĩa "bồn tắm" mà không bị chặn.
    "bath": "a single cute empty white bathtub with rounded feet, a shiny silver tap at one end "
            "and a small round drain inside, side view",

    # ===== at-school (21) ===================================================
    "pencil": "a single cute chunky yellow pencil with a pink eraser tip, standing upright at a slight angle",
    "pen": "a single cute blue ballpoint pen with its cap on, angled slightly",
    "ruler": "a single cute straight wooden ruler with simple black tick marks along one edge",
    "eraser": "a single cute chunky rounded pink eraser",
    "book": "a single cute closed storybook with a bright cover and a ribbon bookmark hanging out",
    "desk": "a single cute child's school desk with a slanted top and a little matching stool",
    "board": "a single cute classroom chalkboard in a wooden frame, completely blank, with a piece of chalk and an eraser on the ledge",
    "football": "a single cute round soccer ball with the classic black-and-white pentagon pattern",
    "basketball": "a single cute round orange basketball with black seam lines",
    "hockey": "a single cute field-hockey stick with a curved head and a small white ball beside it",
    # `music` — trước đây `picturable: false` (bé thấy 🎵, tức ký hiệu suông). "Âm nhạc" không
    # vẽ được thành một ĐỒ VẬT, nên mượn hình ảnh cụ thể: nốt nhạc bay lên trên một cái trống.
    "music": "three bright colourful musical notes floating upward above a small round drum, "
             "with a wooden drumstick resting on the drum skin",
    "computer": "a single cute rounded desktop computer: a monitor with a soft glowing blue screen and a small keyboard in front",
    "draw": "a cute little child character happily drawing with a big bright crayon on a sheet of paper, side view, concentrating with a smile",
    "drawing": "a single sheet of white paper showing a cheerful child's crayon drawing of a sun, a little house and a flower",
    # ⚠️ `teacher` — ẢNH CŨ SAI NỘI DUNG (chủ dự án báo, 2026-10-15): cô giáo đứng CHẮP TAY,
    #    không có gì nói lên "đang dạy" — ảnh đó đọc ra "một người phụ nữ" chứ không ra "teacher".
    #    Nay phải thấy HÀNH ĐỘNG: đứng cạnh bảng nhỏ có phấn, một tay (cánh tay) chỉ về phía
    #    bảng, hướng về phía bé. `teacher` nằm trong `NOT_SOLO` nên không bị cấm bàn tay, nhưng
    #    vẫn tả bằng "arm" cho khớp văn phong các từ hành động khác.
    "teacher": "a friendly smiling woman teacher character with glasses and a neat bun, standing beside a "
               "small chalkboard with a piece of chalk on its ledge, one arm raised toward the board as she "
               "teaches, turned toward the viewer, FULL BODY, standing",
    "classroom": "a cute miniature isometric doll-house room chunk of a small classroom: a blank chalkboard on the wall, "
                 "two little desks and a globe on a shelf, floating cut-away room slab",
    # `class` — trước đây `picturable: false` (bé thấy 👥, tức "hai cái đầu người" vô danh).
    # `classroom` là PHÒNG, `class` là NHÓM HỌC SINH — phải thấy nhiều bé cùng ngồi, nếu không
    # hai ảnh sẽ trùng nhau. ⚠️ Phải nằm trong `NOT_SOLO` (nhiều sinh vật ⇒ `SOLO_CLAUSE` cấm
    # "no people" sẽ xoá sạch chủ thể).
    "class": "a cheerful group of five little children sitting at small desks in a classroom, "
             "all facing forward and listening, seen from behind the desks",
    "letter": "a single bright colourful wooden alphabet block standing alone, with the capital letter A on its front face",
    # `alphabet` — trước đây `picturable: false` (bé thấy 🔠). Từ này BẢN THÂN là CHỮ, nên phải
    # mở `no_text` (xem `OVERRIDES`) — cấm chữ thì hình vô nghĩa.
    # ⚠️ PDF tr.17 vẽ một BẢNG A–Z treo tường, nhưng ở cỡ 44px thì 26 chữ thành một mớ nhoè —
    #    không đọc được chữ nào, tức là dạy hỏng. Nên giữ hướng "ba khối gỗ đứng CẠNH NHAU"
    #    (A, B, C) — đúng chất "bảng chữ cái" mà đọc được ở mọi cỡ.
    # ⚠️ Phải khác `letter` (MỘT khối, một chữ A): ba khối + ba chữ khác nhau là khác biệt nhìn thấy.
    "alphabet": "three chunky wooden blocks standing side by side, each with one big capital letter on "
                "its front face — the letters A, B and C in bright cheerful colours",
    "page": "a single open book with one page lifted and curling over, showing blank pages",
    # `line` — trước đây `picturable: false` (bé thấy ➖, một cái gạch ngang vô nghĩa).
    # ⚠️ Đây là "đường kẻ" (nghĩa trong bài học vẽ), KHÔNG phải "hàng người xếp hàng": nếu tả
    # một hàng người thì ảnh sẽ dạy sai nghĩa.
    # ⚠️ 2026-10-15 — ẢNH ĐÃ SINH BỊ LOẠI: bản trước tả *"a single straight thin dark line"* +
    #    "bút chì đặt cạnh". Hai lỗi cùng lúc: (1) chữ **thin** ⇒ mô hình vẽ nét quá nhạt trên
    #    nền giấy trắng, gần như vô hình; (2) cây bút chì to và đậm hơn nét kẻ nên nó TRANH
    #    mất vai chủ thể — ảnh dạy "tờ giấy" chứ không dạy "đường kẻ".
    #    ⇒ Bỏ hẳn bút chì, đổi **thin** → **thick bold**, và nói rõ nét chạy HẾT bề ngang tờ
    #    giấy (từ mép trái sang mép phải) để nét là hình dài nhất trong khung.
    "line": "a plain white sheet of paper seen flat from directly above, with one thick bold black line "
            "drawn straight across the middle of it from the left edge to the right edge; the line is "
            "wide and clearly visible",
    # ⚠️⚠️ CẶP `close` / `open` — HAI TRẠNG THÁI CỦA **CÙNG MỘT** CÁI CỬA, và đây là điều
    #    kiện sống còn để bé hiểu cặp từ:
    #      · cùng một khung cửa, cùng một tay nắm tròn ⇒ bé thấy "cùng một vật";
    #      · vòng cung chuyển động NGƯỢC CHIỀU nhau ⇒ bé thấy "hai hành động khác nhau".
    #    Cả hai đều phải KHÁC `door` (at-home): `door` là cánh cửa ĐÓNG có cửa sổ tròn + thảm
    #    chào mừng, KHÔNG có vòng cung chuyển động và KHÔNG có ai đẩy. Nếu `close` chỉ là "cửa
    #    đóng" thì nó trùng silhouette với `door` và bé học hai từ cho một thứ.
    #    ⇒ `close` bỏ hẳn cửa sổ tròn và thảm, thêm vòng cung + ánh sáng tắt; `open` thêm ánh
    #    sáng tràn ra và vòng cung ngược chiều. Không có người ⇒ vẫn nhận `SOLO_CLAUSE`.
    "close": "a single door being pushed shut: its leaf flush against the frame with a round knob, "
             "no gap and no light around the edges, and a small curved motion arc beside the knob "
             "showing the door swinging closed",
    "open": "the very same door standing wide open: its leaf swung far out from the frame with a round "
            "knob, warm golden light spilling out through the opening, and a small curved motion arc "
            "beside the knob curving the opposite way to show the door swinging open",
    "tick": "a single big chunky rounded green check-mark symbol standing alone, glossy and friendly",
    "cross": "a single big chunky rounded red X symbol standing alone, glossy and friendly",
    "keyboard": "a single cute pastel computer keyboard seen at a slight angle, keys completely blank",
    "mouse-computer": "a single cute pastel computer mouse with a scroll wheel and a short curly cable",
    # `floor` — trước đây `picturable: false` (bé thấy 🟫, một ô vuông nâu). Tả mảng sàn nhìn hơi
    # từ trên xuống để thấy CÁC TẤM VÁN — chi tiết duy nhất phân biệt "sàn" với "miếng gỗ".
    "floor": "a single section of wooden indoor floor seen slightly from above, with long clear planks "
             "and thin dark seams running between them",
    # ⚠️ `part` — CÂU TẢ ĐÃ VIẾT SẴN TỪ 2026-10-14, NAY ĐÃ DÙNG (2026-10-15).
    #    `en` của từ này là CỤM "a part of" (nghĩa "một phần của"), KHÔNG phải "miếng ghép" (icon
    #    cũ 🧩 khiến bé 7 tuổi đọc sai nghĩa). Từ đã đổi sang `picturable: true` trong
    #    `src/data/levels/starters/themes/at-school.json` ⇒ giờ nằm trong `plan.json`.
    #    Hình: biểu đồ tròn bốn phần bằng nhau, MỘT phần được nhấc ra và tô đỏ — đúng nghĩa
    #    "một phần của một tổng thể" mà không cần chữ nào.
    "part": "a single round pie chart shape divided into four equal wedge slices, one wedge "
            "lifted slightly out of the circle and coloured bright cheerful red while the other "
            "three wedges are soft pale grey, flat clean friendly illustration",

    # ===== at-school/l5 "Outdoor and play" (8) — 10 TỪ CÒN THIẾU CỦA MỤC 22 ===============
    # ⚠️ VÌ SAO CÓ KHỐI NÀY: chủ dự án nói *"Chủ đề ở trường thiếu các từ vựng liên quan đến
    #    hoạt động ngoài trời, thể thao… nên tốt nhất là bạn kiểm tra lại file pdf."* Đã đối
    #    chiếu wordlist A–Z của `wordlist-picture-book.pdf` với data: app ĐÃ CÓ `run`, `swim`,
    #    `ride`, `throw`, `catch`, `table tennis`, `tennis`, `sing`, `draw`. Còn thiếu đúng
    #    những từ dưới đây (cộng `bike`/`skateboard` bên my-street) ⇒ thêm mới.
    "playground": "an outdoor playground seen straight on: a slide with a ladder, a swing set with two "
                  "swings, and a sandbox, arranged together on a patch of green grass",
    "ball": "a single round ball in bright rainbow colours, with one simple stitched seam running around it",
    "boots": "a pair of tall rain boots standing side by side, one slightly behind the other, each with a "
             "rolled cuff at the top",
    "crayon": "a single chunky wax crayon with its paper wrapper still on and the tip showing bright red wax",
    # ⚠️ `classmate` / `read` / `write` — BA từ có NGƯỜI, nên cả ba phải nằm trong `NOT_SOLO`
    #    (nếu không, `SOLO_CLAUSE` *"no people appear anywhere"* sẽ xoá sạch chủ thể).
    #    `classmate` = HAI bé (một bé thì ảnh đó là `boy`/`girl`, và bé học sai từ).
    "classmate": "two little children standing side by side, each wearing a backpack, smiling at each "
                 "other like classmates",
    "read": "a cute little child sitting cross-legged and reading an open picture book, holding it with "
            "both hands and looking down at the pages",
    "write": "a cute little child sitting at a desk and writing in an exercise book, holding a pencil in "
             "one hand with the head bent over the page",
    "board-game": "a single colourful board game laid out flat: a square board with a winding path of "
                  "coloured squares, a few round playing pieces on it and two dice beside it",

    # ===== at-the-beach (23) ================================================
    # Động từ: PHẢI thấy hành động, không phải đứa trẻ đứng yên.
    "swim": "a cute happy little child character swimming, arms stretched forward in a swimming stroke, "
            "water splashes and small white waves around the arms",
    "jump": "a cute little child character jumping high in the air, both arms up and both legs bent up under the body",
    "walk": "a cute little child character walking cheerfully, one leg stepping forward, arms swinging naturally",
    "throw": "a cute little child character throwing a ball, one arm extended forward after the release, body leaning",
    "catch": "a cute little child character catching a ball, both arms raised and hands cupped around the ball",
    "hit": "a cute little child character swinging a bat and striking a ball, body twisted mid-swing",
    "kick": "a cute little child character kicking a soccer ball, one leg lifted high and swinging forward",
    "baseball": "a single white baseball with red stitching lying beside a small wooden baseball bat",
    "table-tennis": "a single red table-tennis paddle with a white ball bouncing just above its face",
    "badminton": "a single badminton racket with a white feathered shuttlecock flying above it",
    "tennis": "a single tennis racket with a bright yellow tennis ball in front of its strings",
    # `sport` — trước đây `picturable: false` (bé thấy 🏅, một tấm huy chương — SAI nghĩa: sport
    # là hoạt động/bộ môn, không phải giải thưởng). "Thể thao" không có một đồ vật đại diện duy
    # nhất, nên bày MỘT NHÓM dụng cụ của nhiều môn khác nhau — nhóm đó mới là "sport".
    "sport": "a small group of sports equipment gathered together: a soccer ball, a tennis racket, "
             "a feathered shuttlecock and a small referee whistle",
    "sing": "a cute little child character singing joyfully, mouth wide open, head tilted up, one musical note floating beside the head",
    "paint": "a cute little child character painting on a small canvas, holding a brush in one hand and a paint palette in the other",
    "take": "a cute little child character taking a photograph, holding a camera up to one eye with both hands",
    "guitar": "a single cute acoustic guitar in warm honey wood with a rounded body and visible strings",
    "piano": "a single cute upright piano with white and black keys and a small round stool in front",
    "camera": "a single cute compact camera with one big round lens and a small flash",
    # ⚠️⚠️ `sand` / `sea` — HAI ẢNH CŨ SAI NỘI DUNG (chủ dự án báo, 2026-10-15):
    #   · `sand` ra một ĐỐNG CÁT NHỎ như đống đường, có vỏ sò trên đỉnh ⇒ đọc ra "một nắm cát",
    #     không ra "bãi cát". Nay tả MẢNG cát rộng có gợn sóng + nhiều vỏ sò + sao biển.
    #   · `sea` ra một CON SÓNG **CÓ MẶT CƯỜI** ⇒ bé nhìn ra "nhân vật", không ra "mặt biển".
    #     Đây đúng cái bẫy `NO_FACE_CLAUSE` đã ghi ở đầu tệp, nhưng `sea` nhận `SOLO_CLAUSE`
    #     (đồ vật) chứ không nhận `NO_FACE_CLAUSE`, nên phải CẤM MẶT NGAY TRONG CÂU TẢ.
    #     Nay: nước xanh trải rộng với sóng lăn tăn, và câu "it is only water" để chặn hẳn mặt.
    "sand": "a wide flat stretch of golden beach sand with gentle ripple lines running across its surface, "
            "three scattered seashells and one little orange starfish resting on top of it",
    "sea": "a wide calm expanse of bright blue sea water seen straight on, with gentle rolling swells and "
           "small white foam crests spreading across the surface; it is only water, with no face, "
           "no eyes and no mouth anywhere",
    "sun": "a single cute smiling sun: a round golden ball with soft rounded rays and a warm friendly face",
    "shell": "a single cute spiral seashell in pale pink with a soft pearly sheen",
    "kite": "a single cute diamond-shaped kite in bright colours with a long wavy ribbon tail",
    "fishing": "a cute little child character fishing, holding a simple rod with a line, one small fish leaping at the end of the line",

    # ===== at-the-clothes-shop (26) =========================================
    # Màu sắc (11 từ): CÙNG một hình giọt sơn, chỉ ĐỔI MÀU. Bé nhìn hai thẻ cạnh
    # nhau là thấy ngay "khác nhau đúng ở màu" — đó chính là bài học. Khác hẳn
    # emoji 🔴🟠🔵 vốn chỉ là chấm tròn.
    "purple": "a single playful thick 3D paint blob of deep purple paint with two small round droplets beside it, "
              "the ONLY colour in the image is deep purple",
    "brown": "a single playful thick 3D paint blob of warm chocolate brown paint with two small round droplets beside it, "
             "the ONLY colour in the image is chocolate brown",
    "black": "a single playful thick 3D paint blob of black paint with two small round droplets beside it, "
             "the ONLY colour in the image is black",
    "blue": "a single playful thick 3D paint blob of bright sky-blue paint with two small round droplets beside it, "
            "the ONLY colour in the image is bright sky blue",
    "white": "a single playful thick 3D paint blob of pure white paint with two small round droplets beside it, "
             "the ONLY colour in the image is white",
    "pink": "a single playful thick 3D paint blob of bright pink paint with two small round droplets beside it, "
            "the ONLY colour in the image is bright pink",
    "grey": "a single playful thick 3D paint blob of soft grey paint with two small round droplets beside it, "
            "the ONLY colour in the image is soft grey",
    "yellow": "a single playful thick 3D paint blob of sunny yellow paint with two small round droplets beside it, "
              "the ONLY colour in the image is sunny yellow",
    "orange-adj": "a single playful thick 3D paint blob of bright orange paint with two small round droplets beside it, "
                  "the ONLY colour in the image is bright orange",
    # ⚠️ `red` — ẢNH CŨ SAI NỘI DUNG (chủ dự án báo, 2026-10-15): ra một VỆT SƠN ĐỎ hình
    #    khối méo, có TUA RUA như vết bắn, lệch hẳn 10 màu còn lại (blue/green ra khối tròn
    #    nhẵn). Câu tả cũ vốn giống 10 màu kia từng chữ — nên lỗi nằm ở chỗ KHÔNG có gì cấm
    #    "vệt bắn": mô hình tự do thêm tia/toé. Nay tả HÌNH DẠNG cụ thể (khối tròn nhẵn, gọn,
    #    viền sạch, một điểm sáng mềm) thay vì chỉ nói "blob".
    "red": "a single playful thick 3D paint blob of bright red paint: one smooth compact rounded "
           "dollop with a clean neat outline, one soft light reflection on its curve and two small "
           "round droplets beside it, no streaks and no splatter, "
           "the ONLY colour in the image is bright red",
    "green": "a single playful thick 3D paint blob of fresh grass-green paint with two small round droplets beside it, "
             "the ONLY colour in the image is fresh grass green",

    # Quần áo (14)
    # `clothes` — trước đây `picturable: false` (bé thấy 🧺, cái giỏ — SAI nghĩa). "Quần áo" là
    # một TẬP HỢP, nên hình phải là một CHỒNG quần áo gấp gọn; thêm hai cái móc áo để nói rõ
    # đây là quần áo treo/gấp, không phải "mấy miếng vải".
    "clothes": "a neat stack of folded children's clothes in cheerful colours, with two clothes hangers "
               "lying beside the stack",
    "jacket": "a single cute zip-up jacket in a warm colour with a hood, front view, held out as if on an invisible child",
    "skirt": "a single cute pleated skirt in a bright colour with a waistband, front view",
    "shirt": "a single cute buttoned shirt with a collar and two pockets, front view, held out as if on an invisible child",
    "dress": "a single cute little girl's dress with a bow at the waist and puffy sleeves, front view",
    "t-shirt": "a single cute plain short-sleeved t-shirt in a bright colour, front view, completely blank with no print",
    "trousers": "a single pair of cute trousers with a waistband, front view, held out as if on invisible legs",
    "jeans": "a single pair of cute blue denim jeans with a pocket and stitching, front view",
    "shoe": "a single cute pair of children's sneakers standing side by side, front view",
    "sock": "a single cute pair of striped socks standing side by side, upright",
    "hat": "a single cute sun hat with a wide brim and a ribbon band around the crown",
    "glasses": "a single cute pair of round children's glasses with a coloured frame, front view",
    "bag": "a single cute rounded kids' backpack with two shoulder straps and a front pocket",
    "handbag": "a single cute small woman's handbag with one handle and a shiny clasp",
    "watch": "a single cute wristwatch with a round face and a colourful strap, with two short pointers showing",

    # --- CỤM "MÀU + ĐỒ" (11) — bài `at-the-clothes-shop/l6` + `/l7` ---------------------
    # ⭐ VÌ SAO CẦN: PDF Cambridge tr.9 in NGUYÊN CỤM `purple glasses`, `black hat`,
    #    `blue jacket`… App tách rời 11 màu và 14 món đồ ⇒ bé học đúng từng mảnh nhưng KHÔNG
    #    BAO GIỜ thấy trật tự `tính từ + danh từ` của tiếng Anh (tiếng Việt nói ngược: "kính
    #    màu tím"). Mỗi ảnh dưới đây là CÙNG một món đồ đã có ảnh, CHỈ ĐỔI MÀU — nhờ vậy hai
    #    thẻ `glasses` và `purple glasses` nằm cạnh nhau là bé thấy ngay "khác đúng ở màu".
    #    ⚠️ Câu tả bám sát câu tả gốc của từng món (xem `glasses`, `hat`, `bag`… ngay trên),
    #       chỉ thêm màu — đổi cả hình dáng thì phép so sánh "khác ở màu" mất tác dụng.
    #    ⚠️ `white-skirt`: màu TRẮNG trên thẻ TRẮNG ⇒ hình vô hình. Cùng cách chữa với
    #       `OVERRIDES["white"]`: bắt buộc viền xám nhạt (xem `OVERRIDES`).
    "purple-glasses": "a single cute pair of round children's glasses with a bright purple frame, front view",
    "black-hat": "a single cute sun hat with a wide brim and a ribbon band around the crown, "
                 "entirely black",
    "brown-bag": "a single cute rounded kids' backpack with two shoulder straps and a front pocket, "
                 "in warm chocolate brown",
    "blue-jacket": "a single cute zip-up jacket with a hood and a front zip, in bright sky blue, "
                   "front view, held out as if on an invisible child",
    "pink-handbag": "a single cute small woman's handbag with one handle and a shiny clasp, in bright pink",
    "white-skirt": "a single cute pleated skirt with a waistband, pure white, front view",
    "grey-trousers": "a single pair of cute trousers with a waistband, in soft grey, front view, "
                     "held out as if on invisible legs",
    "orange-dress": "a single cute little girl's dress with a bow at the waist and puffy sleeves, "
                    "in bright orange, front view",
    "yellow-shirt": "a single cute buttoned shirt with a collar and two pockets, in sunny yellow, "
                    "front view, held out as if on an invisible child",
    "red-t-shirt": "a single cute plain short-sleeved t-shirt, bright red, front view, "
                   "completely blank with no print",
    "green-jeans": "a single pair of cute denim jeans with a pocket and stitching, in fresh grass green, "
                   "front view",

    # ===== at-the-zoo (19) ==================================================
    # Toàn thân, hướng về phía bé. Cá sấu / rắn / nhện phải DỄ THƯƠNG, không đáng sợ.
    "elephant": "a cute friendly baby elephant, FULL BODY, standing, trunk curled up and ears spread wide, facing the viewer",
    "giraffe": "a cute friendly baby giraffe, FULL BODY including the whole neck, standing, smiling, facing the viewer",
    "hippo": "a cute friendly baby hippo, FULL BODY, standing on four short legs, round and podgy, facing the viewer",
    "tiger": "a cute friendly baby tiger cub, FULL BODY, sitting, orange with soft black stripes and a happy face, facing the viewer",
    "crocodile": "a cute friendly baby crocodile, FULL BODY, standing on four legs with a rounded snout and a big happy smile, "
                 "chubby and harmless, absolutely NOT scary, facing the viewer",
    "monkey": "a cute friendly baby monkey, FULL BODY, sitting with a curled tail and a happy grin, facing the viewer",
    "snake": "a cute friendly little green snake, FULL BODY, coiled into a neat rounded spiral with the head lifted up "
             "and a happy smile, harmless and sweet, absolutely NOT scary",
    "dog": "a cute friendly puppy, FULL BODY, sitting down with its tail wagging, floppy ears and a happy face, facing the viewer",
    "cow": "a cute friendly baby cow, FULL BODY, standing on four legs with white-and-brown patches and a happy face, facing the viewer",
    "horse": "a cute friendly pony, FULL BODY, standing with a flowing mane and tail, facing the viewer",
    "sheep": "a cute friendly fluffy lamb, FULL BODY, standing on four short legs with a thick woolly coat, facing the viewer",
    "goat": "a cute friendly baby goat, FULL BODY, standing on four legs with little horns and a beard, facing the viewer",
    "duck": "a cute friendly duckling, FULL BODY, standing with a yellow beak and orange feet, facing the viewer",
    "chicken": "a cute friendly hen, FULL BODY, standing with a red comb, a yellow beak and a plump body, facing the viewer",
    "frog": "a cute friendly little frog, FULL BODY, sitting with big round eyes and a wide happy smile, facing the viewer",
    "lizard": "a cute friendly little green lizard, FULL BODY, standing on four small legs with a curled tail, facing the viewer",
    "spider": "a cute friendly round cartoon spider, FULL BODY, with a fat fuzzy body, eight short stubby legs "
              "and two big kind eyes, sweet and funny, absolutely NOT scary",
    "mouse": "a cute friendly little grey mouse, FULL BODY, sitting up on its hind legs with big round ears and a thin tail, facing the viewer",
    "bird": "a cute friendly little songbird, FULL BODY, perched with its wings folded, a round orange beak and a cheerful face",
    # ⚠️ `animal` / `tail` — TRƯỚC ĐÂY `picturable: false` (bé thấy 🐾 và 🐈, đều mơ hồ).
    #    · `animal` là TỪ CHUNG ⇒ phải thấy NHIỀU con vật khác loài đứng cạnh nhau, nếu chỉ một
    #      con thì ảnh đó là "dog"/"cat" và bé học sai. ⇒ Phải nằm trong `NOT_SOLO`.
    #    · `tail` là BỘ PHẬN ⇒ chủ thể phải CHÍNH LÀ cái đuôi, không phải cả con mèo (nếu cả con
    #      mèo thì ảnh trùng nghĩa với `cat` của at-home).
    #    ⚠️ 2026-10-15 — ẢNH ĐÃ SINH BỊ LOẠI: bản trước tả cái đuôi ĐỨNG MỘT MÌNH ("shown on its
    #      own"), không có con vật nào để so ⇒ mô hình vẽ ra một khối xù cam cong hình chữ C,
    #      nhìn như CÁI BÁNH SỪNG BÒ. Mất ngữ cảnh "đuôi CỦA CÁI GÌ" thì hình vô nghĩa.
    #      ⇒ Đổi sang NHÌN TỪ PHÍA SAU một con mèo đang đứng bốn chân, đuôi dựng cao và cong
    #      hình dấu hỏi; câu tả nói rõ ĐUÔI LÀ HÌNH LỚN NHẤT trong khung để mô hình không vẽ
    #      cả con mèo to hơn đuôi. Vẫn khác `cat` (at-home: mèo nhìn CHÍNH DIỆN, ngồi).
    #      ⚠️ Vì có con vật nên `tail` PHẢI nằm trong `NOT_SOLO` — xem ghi chú ở đó.
    "animal": "three friendly little animals standing side by side: a puppy, a kitten and a bunny rabbit, "
              "all cute and smiling, facing the viewer",
    "tail": "the back view of a cute fluffy orange cat standing on its four paws, seen from behind, with "
            "its long bushy tail held high and curling in a clear question-mark curve; the tail is the "
            "largest and most obvious shape in the picture",

    # ===== my-body (13) =====================================================
    # Từng bộ phận là MỘT VẬT THỂ RỜI (như emoji), không phải bé bị cắt cụt.
    # ⚠️ BỘ PHẬN CƠ THỂ ĐI KÈM `no_face` (xem OVERRIDES): lần sinh thử đầu cho ra
    #    ear/nose/leg mọc mặt ⇒ bé nhìn ra "một khuôn mặt" thay vì "cái tai/cái mũi".
    #    Ngoại lệ: `eye` (bản thân nó LÀ con mắt), `face`/`head`/`body` (bản thân
    #    chúng LÀ mặt/đầu/cả người nên phải có mặt).
    #
    # PHÂN BIỆT CÁC CẶP DỄ LẪN — mỗi cặp phải khác nhau ở THỂ LOẠI nhìn, không chỉ ở lời tả:
    #   mouth / smile : môi KHÉP mỉm cười  ↔  miệng cười TO lộ răng (cả hai chỉ có cái miệng)
    #   face  / head  : cận cảnh RIÊNG phần mặt, cắt trên lông mày & dưới cằm nên KHÔNG
    #                   thấy tóc  ↔  cả khối đầu 3/4 CÓ tóc, có tai, xuống tới cổ.
    #                   (Lần đầu cả hai đều ra "cái đầu có tóc" ⇒ bé không phân biệt được.)
    #   leg   / arm   : chân THẲNG ĐỨNG, dày, thấy đùi–gối–cổ chân  ↔  tay mảnh hơn,
    #                   GẬP ở khuỷu như đang vẫy, từ vai xuống cổ tay.
    #                   (Lần đầu cả hai là "một chi gập" ⇒ nhìn không ra cái nào.)
    "leg": "a single chubby child's leg standing upright and clearly vertical, thick and rounded "
           "from the top of the thigh down to the ankle, with a clear rounded knee, soft peach skin",
    "ear": "an isolated cute cartoon child's ear: a single rounded chunky ear shape with a soft "
           "inner fold, soft peach skin",
    "eye": "an isolated cute big cartoon eye: one large round eye with a shiny dark iris, a white highlight and soft lashes, "
           "alone as a single object",
    "face": "an EXTREME CLOSE-UP of only the front of a cute cartoon child's face, cropped just above "
            "the eyebrows and just below the chin so that NO hair and NO scalp are visible: two big round "
            "eyes, a small nose, rosy cheeks and a wide gentle smile filling the whole frame",
    "nose": "an isolated cute cartoon child's nose: one rounded button-shaped nose with two small "
            "nostrils and soft shading",
    "mouth": "an isolated cute cartoon mouth with soft pink lips in a gentle CLOSED smile, alone as a single object",
    "smile": "an isolated cute cartoon OPEN GRIN: ONLY the wide joyful mouth smiling with visible white "
             "teeth and pink lips, nothing above it",
    "arm": "a single child's arm raised and bent at the elbow as if waving, slimmer than a leg, from "
           "the shoulder down to the wrist, soft peach skin",
    "hand": "an isolated cute chubby 3D child's hand with the open palm facing the viewer and five rounded fingers spread, "
            "alone as a single object",
    "foot": "an isolated cute chubby 3D bare child's foot seen from the front-side, with five little toes, soft peach skin, "
            "alone as a single object",
    "hair": "an isolated cute 3D tuft of thick glossy brown hair, soft wavy strands with a small blue bow, "
            "alone as a single object",
    "body": "a cute little child character standing with arms slightly out, FULL BODY from head to toe, "
            "wearing simple bright clothes and smiling, facing the viewer",
    "head": "a cute cartoon child's whole head in three-quarter view: the complete rounded head shape with "
            "thick brown hair, one visible ear and a friendly smiling face, ending at a short neck, "
            "head only with no body",

    # ===== my-favourite-food (35) ===========================================
    # Món ăn bày trên KHÔNG có đĩa (nền trong suốt). Trừ những món vốn cần bát/ly.
    "apple": "a single glossy red apple with a green leaf and a short brown stalk",
    "banana": "a single ripe yellow banana with a soft curve and a brown tip, whole and unpeeled",
    "grapes": "a single small bunch of plump purple grapes with one green leaf and a stalk",
    "fish": "a single whole fresh fish seen from the side, silvery-blue with shiny scales, a rounded friendly eye and a tail fin",
    "beans": "a small neat pile of plump glossy dark-red kidney beans",
    "egg": "a single sunny-side-up fried egg with a bright round orange yolk and white frilly edges",
    "milk": "a single full glass of fresh white milk with a smooth white top, no straw",
    "tomato": "a single glossy bright red tomato with a small green stalk and two leaves",
    "onion": "a single golden-brown onion with dry papery skin and a small tuft of dried stalk on top",
    "rice": "a small white bowl filled with a fluffy mound of white steamed rice with one tiny green garnish on top",
    "peas": "a single open green pea pod with three round bright green peas spilling out beside it",
    "coconut": "a single brown hairy coconut cracked open, showing a ring of white flesh inside",
    "meat": "a single thick slice of cooked roast meat with a browned crust, sitting alone",
    "potato": "a single golden-brown potato with a few small dimples and one little sprout",
    "sausage": "a single plump cooked sausage, gently curved, with a browned shiny skin",
    "orange-n": "a single glossy bright orange with a small green leaf and a dimpled skin",
    "lemon": "a single bright yellow lemon with a slightly pointed tip and a dimpled skin",
    "lime": "a single small bright green lime with a glossy dimpled skin",
    "mango": "a single ripe mango with a smooth red-orange-yellow gradient skin and a short stalk",
    "pear": "a single ripe green pear with a soft blush and a short brown stalk",
    "pineapple": "a single pineapple with a golden diamond-patterned skin and a spiky green leafy crown",
    "water": "a single full clear glass of fresh water with a soft blue tint and a visible water line near the rim",
    "bread": "a single golden crusty loaf of bread with two slices already cut and leaning against it",
    "burger": "a single tall burger: a sesame bun, crisp lettuce, a red tomato slice, melted cheese and a brown patty",
    "cake": "a single slice of layered cake with pink frosting, a swirl of cream on top and one strawberry",
    "candy": "a single wrapped candy with twisted shiny ends and bright pink-and-white diagonal stripes",
    "carrot": "a single bright orange carrot with a tuft of fresh green leaves on top",
    "chips": "a small pile of golden crispy french fries standing in a red paper sleeve",
    "chocolate": "a single bar of milk chocolate with the wrapper peeled open, showing a grid of four squares",
    "lemonade": "a single tall glass of cloudy pale-yellow lemonade with a lemon slice on the rim and a striped straw",
    "ice-cream": "a single ice-cream cone with two scoops of pink and vanilla ice cream, a curly swirl on top and a wafer stick",
    "chicken-meat": "a single golden roasted chicken drumstick with a browned crispy skin, sitting alone",
    "watermelon": "a single wedge of watermelon showing bright red flesh, black seeds and a green rind",
    "drink": "a single tall colourful cup of fizzy soft drink with a striped straw and a slice of lemon on the rim",
    "juice": "a single glass of bright orange juice with a striped straw, a slice of orange on the rim and a few ice cubes",

    # --- Bữa ăn & từ chung (4) — trước đây đều `picturable: false`, bé thấy EMOJI ----------
    # ⚠️ BA BỮA PHẢI KHÁC NHAU RÕ, KHÔNG chỉ khác cái tên: cùng một "đĩa thức ăn" thì bé không
    #    phân biệt được breakfast/lunch/dinner và ba thẻ thành một. Mỗi bữa một BỘ MÓN riêng,
    #    theo đúng thói quen bé 7 tuổi nhận ra:
    #      breakfast = ngũ cốc + sữa + bánh mì phết mứt + trứng  (bữa sáng kiểu Âu)
    #      lunch     = bánh kẹp + salad + táo + nước             (bữa trưa gọn, nguội)
    #      dinner    = thịt gà + khoai nghiền + đậu Hà Lan       (bữa tối nóng, có thịt)
    #    `fruit` là TẬP HỢP ⇒ phải là một cái bát ĐẦY nhiều loại quả, không phải một quả.
    "breakfast": "a breakfast set laid out together: a bowl of cereal with a spoon, a glass of milk, "
                 "a slice of toast spread with jam and a boiled egg standing in a small egg cup",
    "lunch": "a lunch set laid out together: a plate holding a sandwich, a small bowl of green salad, "
             "a red apple and a glass of water",
    "dinner": "a dinner set laid out together: a plate holding a piece of cooked chicken, a scoop of "
              "mashed potato and a spoonful of green peas, beside a glass of water",
    "fruit": "a single wooden bowl filled with mixed fruit: a red apple, a yellow banana, a bunch of "
             "purple grapes, an orange and a strawberry",

    # ===== my-friends-birthday (19) =========================================
    # Người: nhân vật hoạt hình, không ai giống người thật. Quan hệ (sister/brother/
    # cousin) không thể tả bằng một người đơn lẻ ⇒ vẽ HAI đứa đứng cạnh nhau.
    "robot": "a friendly cute toy robot: a rounded head with a small antenna, two big kind eyes, a chunky body "
             "with a glowing blue heart panel and short arms, blue and white, FULL BODY, standing",
    "monster": "a friendly goofy little monster: a round fuzzy purple body, three big harmless eyes, "
               "two little stubby arms and a wide silly grin. Sweet and funny, absolutely NOT scary",
    "person": "a friendly cartoon person character standing upright, FULL BODY, with simple bright clothes and a warm smile",
    "man": "a cute chibi cartoon man: one oversized round head with big friendly eyes, a small tubby body "
           "and very short stubby arms and legs, standing upright, short hair, simple bright clothes and a warm smile",
    "woman": "a cute chibi cartoon woman: one oversized round head with big friendly eyes, a small tubby body "
             "and very short stubby arms and legs, standing upright, shoulder-length hair, "
             "a simple bright dress and a warm smile",
    "child": "a friendly cartoon little child character standing upright, FULL BODY, short hair, "
             "a bright t-shirt and shorts and a cheerful smile",
    "baby": "a cute cartoon baby character sitting up, chubby and round with a tiny tuft of hair, a soft romper "
            "and a happy gummy smile, FULL BODY",
    "boy": "a friendly cartoon little boy character standing upright, FULL BODY, short brown hair, "
           "a blue t-shirt and green shorts and a cheerful smile",
    "girl": "a friendly cartoon little girl character standing upright, FULL BODY, hair in two pigtails, "
            "a pink dress and a cheerful smile",
    "balloon": "a single bright red party balloon, plump and glossy, with a curly string hanging beneath it",
    "alien": "a friendly cute little green alien: a rounded head, two big kind almond eyes, a slim body "
             "in a small white-and-blue space suit, FULL BODY, standing, smiling warmly, NOT scary",
    "family": "a happy cartoon family of four standing together in a row and holding hands: "
              "a dad, a mum, a little boy and a little girl, all smiling, FULL BODIES",
    "dad": "a cute chibi cartoon dad: one oversized round head with big friendly eyes, a small tubby body "
           "and very short stubby arms and legs, standing upright, short dark hair, a jumper and jeans, smiling warmly",
    "mum": "a cute chibi cartoon mum: one oversized round head with big friendly eyes, a small tubby body "
           "and very short stubby arms and legs, standing upright, shoulder-length hair, a yellow top and a skirt, smiling warmly",
    "grandfather": "a cute chibi cartoon grandfather: one oversized round head with big friendly eyes, a small tubby body "
                   "and very short stubby arms and legs, standing upright, grey hair and a grey moustache, "
                   "round glasses, a cardigan and slippers, smiling warmly",
    "grandmother": "a cute chibi cartoon grandmother: one oversized round head with big friendly eyes, a small tubby body "
                   "and very short stubby arms and legs, standing upright, grey hair in a bun, "
                   "round glasses, a soft cardigan and an apron, smiling warmly",
    "sister": "two cute cartoon little girls standing side by side and holding hands, clearly sisters, "
              "different hair colours, both smiling, FULL BODIES",
    "brother": "two cute cartoon little boys standing side by side, clearly brothers, "
               "different hair colours, both smiling, FULL BODIES",
    "cousin": "two cute cartoon children standing side by side, a little boy and a little girl, clearly cousins, "
              "different hair colours, both smiling, FULL BODIES",

    # --- KÍNH NGỮ Mr / Mrs / Miss (3) — trước đây `picturable: false`, bé thấy EMOJI --------
    # ⚠️ BA TỪ NÀY LÀ BA NGƯỜI LỚN, và phải PHÂN BIỆT ĐƯỢC BẰNG MẮT. Nếu cả ba là "một người
    #    lớn đứng cười" thì bé học ba từ cho một hình — đúng lỗi "các icon không khớp với thẻ từ
    #    vựng" mà chủ dự án đã phàn nàn. Dấu hiệu phân biệt phải là thứ NHÌN THẤY ĐƯỢC:
    #      Miss = tóc dài xoã, áo váy, KHÔNG nhẫn
    #      Mr   = nam, áo sơ mi cài cúc
    #      Mrs  = tóc BÚI cao + NHẪN CƯỚI vàng trên tay
    #    ⚠️ Cả ba đều nằm trong `NOT_SOLO` (là người) và đều nhận `ADULT_CHIBI_CLAUSE` qua
    #       `OVERRIDES` — nếu thiếu, mô hình vẽ người lớn TẢ THỰC, lệch hẳn tông chibi của
    #       boy/girl/child trong cùng chủ đề (đã trả giá một lần với man/woman/dad/mum).
    "miss": "a friendly young woman teacher character with long loose hair and a simple bright dress, "
            "standing upright and smiling warmly, FULL BODY",
    "mr": "a friendly man teacher character in a buttoned shirt and trousers, with short neat hair, "
          "standing upright and smiling warmly, FULL BODY",
    "mrs": "a friendly married woman teacher character with her hair in a neat high bun and a gold "
           "wedding ring on one finger, wearing a simple dress, standing upright and smiling warmly, "
           "FULL BODY",

    # ===== my-street (14) ===================================================
    # ⚠️⚠️ BẢN CŨ: "a rounded red-and-blue engine with a friendly smiling face on the front" — VÀ
    #    NÓ RA MỘT ĐOÀN TÀU GẦN NHƯ LÀ "Thomas". Prompt không hề nêu tên nhân vật nào; đây là hệ
    #    quả của ĐÚNG BA chi tiết đó cộng lại (tông xanh-đỏ + mặt cười trên đầu máy + nhìn
    #    thẳng vào mặt đầu máy). Chủ dự án yêu cầu sinh lại để tránh rủi ro bản quyền
    #    (2026-10-08) ⇒ đổi CẢ BA: nhìn từ BÊN HÔNG, đổi sang tông xanh lá-vàng, và bỏ mặt.
    #    Kèm `no_face` ở `OVERRIDES` ⇒ dùng khối phong cách ĐỒ VẬT, tức là không còn mệnh đề
    #    "big expressive friendly eyes" — chính mệnh đề đó mời mô hình vẽ mắt lên đầu máy.
    "train": "a wooden toy train seen from the side: a small wooden locomotive with a red chimney and a "
             "grey smoke puff, pulling two little wooden wagons in green and yellow, each with four tiny "
             "wooden wheels, FULL VEHICLE visible",
    "bus": "a cute rounded little bus in bright red seen from the side, with three round windows, two round wheels and a friendly face on the front",
    "boat": "a cute little sailboat with a rounded blue hull, a tall white sail and a small flag on top, seen from the side",
    "helicopter": "a cute rounded little helicopter with a big spinning rotor on top, a small tail rotor, "
                  "a rounded glass cockpit and two landing skids, seen from a three-quarter angle",
    "motorbike": "a cute rounded little motorbike in bright colours seen from the side, with two round wheels, "
                 "a small headlight and a friendly face on the front",
    "lorry": "a cute rounded little lorry seen from the side: a bright cab with a big windscreen and a boxy load "
             "behind it, two round wheels, a friendly face on the front",
    "ride": "a cute little child character riding a small bicycle, seen from the side, both hands on the handlebars, pedalling happily",
    "fly": "a cute little child character flying a small red aeroplane high in the air, seen from the side, "
           "waving from the cockpit",
    "drive": "a cute little child character driving a small red car, seen from the side, both hands on the steering wheel, smiling",
    "run": "a cute little child character running fast, mid-stride with one leg forward and arms pumping, leaning forward happily",
    # ⚠️ `go` / `stop` — CẶP ĐỐI LẬP, trước đây đều `picturable: false` (bé thấy 🚦 và 🛑).
    #    Hai từ này KHÔNG vẽ được thành hành động của một đứa trẻ (bé 7 tuổi sẽ không hiểu "go"
    #    là đang đi), nên mượn ĐÚNG hai biển báo mà bé gặp ở ngã tư:
    #      go   = đèn GIAO THÔNG, đèn XANH sáng rực (hai đèn kia tắt) — "được đi"
    #      stop = biển bát giác ĐỎ có chữ STOP           — "phải dừng"
    #    ⇒ Hai ảnh khác nhau cả HÌNH DẠNG (cột đèn có 3 ô tròn ↔ tấm biển 8 cạnh) lẫn MÀU, nên
    #      không thể lẫn. `stop` cần `no_text` (xem `OVERRIDES`): chữ STOP CHÍNH LÀ từ cần dạy,
    #      cấm chữ thì tấm biển thành một hình bát giác vô nghĩa.
    "go": "a single traffic light standing on a short grey post, with three round lamps where only the "
          "bottom green lamp is lit up and glowing brightly while the other two stay dark",
    "stop": "a single red octagonal road sign on a short grey post, with the word STOP in large white "
            "capital letters across its face",
    # `bike` / `skateboard` — 2 từ còn thiếu của mục 22 (wordlist PDF có, data chưa có).
    # ⚠️ `bike` PHẢI khác `ride` (đang là 🚲 + "a cute little child character riding a bicycle") và
    #    khác `motorbike` (xe máy): đây là CHIẾC XE ĐẠP đứng một mình, KHÔNG có người, nhìn ngang,
    #    có bánh phụ — đó là chiếc xe của bé 7 tuổi.
    "bike": "a single child's bicycle seen from the side, with two wheels, a bell on the handlebar and "
            "two small training wheels at the back",
    "skateboard": "a single skateboard seen from the side, with a bright flat deck, four coloured wheels "
                  "underneath and a simple pattern on the top of the deck",
    "tree": "a single cute leafy tree with a thick rounded green crown and a sturdy brown trunk standing alone",
    # ⚠️⚠️ `park` / `shop` / `bookshop` — BA ẢNH CŨ SAI NỘI DUNG (chủ dự án báo, 2026-10-15):
    #    cả ba là "miniature isometric diorama … on a rounded base/slab" nên ra MÔ HÌNH ĐỒ CHƠI
    #    đặt trên một cái đế tròn — bé nhìn ra "đồ chơi", không ra "công viên"/"cửa hàng". Tệ hơn:
    #    `bookshop` và `shop` gần như TRÙNG SILHOUETTE (cùng một khối hộp + mái hiên trên đế tròn)
    #    ⇒ hai thẻ từ vựng nhìn như một.
    #    ⇒ Cả ba chuyển sang CẢNH NHÌN THẲNG MẶT TIỀN (front-facing scene), KHÔNG đế, KHÔNG nổi.
    #    ⚠️ KHÔNG thêm "no ground plane" vào câu tả: `STYLE_TAIL` đã lo phần nền trong suốt, và
    #       một câu cấm nền ở đây sẽ mâu thuẫn với chính `STYLE_TAIL`.
    #    ⚠️ `bookshop` phải KHÁC RÕ `shop`: chồng sách cao trong tủ kính + BIỂN HIỆU HÌNH CUỐN
    #       SÁCH là hai chi tiết không thể lẫn với "tủ kính bày lọ/hộp" của `shop`.
    "park": "a wide open park seen straight on: a broad green grass lawn, a curving path running through it, "
            "two leafy trees, a wooden bench beside the path and a small round pond",
    # --- BỐN BUỔI TRONG NGÀY (4) — trước đây đều `picturable: false`, bé thấy EMOJI -----------
    # ⚠️⚠️ BỐN ẢNH NÀY LÀ MỘT BỘ — CÙNG MỘT KHUÔN, CÙNG MỘT CÁI CÂY, CÙNG MỘT VÒNG CUNG.
    #
    #    ⭐ KHUÔN LẤY TỪ PDF TR.21 (đã đối chiếu, 2026-10-15): bốn hình vẽ CÙNG một phong cảnh
    #    nhìn ngang + MỘT VÒNG CUNG đường đi của mặt trời, và mặt trời nằm ở VỊ TRÍ KHÁC NHAU trên
    #    cung: `morning` thấp bên TRÁI · `afternoon` cao giữa · `evening` thấp bên PHẢI ·
    #    `day` mặt trời vàng rực ở ĐỈNH cung.
    #    ⚠️ VÌ SAO KHÔNG dùng "mặt trời / mặt trăng" đứng riêng (bản nháp đầu của tôi): một mặt
    #       trời lẻ và một mặt trăng lẻ KHÔNG dạy được "thời điểm trong ngày" — bé chỉ thấy hai
    #       hình khác màu. Chính vòng cung + vị trí trên cung mới là thứ dạy khái niệm đó, và đó
    #       là điều chủ dự án phàn nàn là thiếu.
    #    ⇒ Câu mở và các chi tiết nền (đồi cỏ, một cái cây, vòng cung) phải GIỐNG NHAU TỪNG CHỮ;
    #      chỉ đổi VỊ TRÍ MẶT TRỜI và MÀU TRỜI. Đó là toàn bộ khác biệt — và đó là điều làm bốn
    #      ảnh thành một bộ.
    #    ⚠️ KHÔNG tả "ngoài vòng cung trong suốt" — `STYLE_TAIL` đã lo nền.
    "day": "a small side-view landscape with one grassy green hill and one round leafy tree standing on it, "
           "and above the hill a long smooth arc curving up from the ground on the left, over the top and "
           "back down to the ground on the right, showing the path the sun travels: the bright golden sun "
           "sits right at the top of the arc, and the sky is a clear bright blue with no clouds at all",
    "morning": "a small side-view landscape with one grassy green hill and one round leafy tree standing on it, "
               "and above the hill a long smooth arc curving up from the ground on the left, over the top and "
               "back down to the ground on the right, showing the path the sun travels: the sun sits low near "
               "the far LEFT end of the arc just above the hill, and the sky is soft pink and orange with a "
               "little light mist",
    "afternoon": "a small side-view landscape with one grassy green hill and one round leafy tree standing on it, "
                 "and above the hill a long smooth arc curving up from the ground on the left, over the top and "
                 "back down to the ground on the right, showing the path the sun travels: the sun is high on the "
                 "arc just past the highest point, on its way down toward the right, and the sky is clear blue "
                 "with two or three small white clouds",
    "evening": "a small side-view landscape with one grassy green hill and one round leafy tree standing on it, "
               "and above the hill a long smooth arc curving up from the ground on the left, over the top and "
               "back down to the ground on the right, showing the path the sun travels: the sun sits low near "
               "the far RIGHT end of the arc, almost touching the ground, and the sky is deep purple fading to "
               "orange with one small star",
    "shop": "a small corner shop seen straight on from the front: a colourful shop front with a wide striped "
            "awning stretched over the door, a glass display window filled with jars, tins and boxes on two "
            "shelves, and a plain rectangular signboard above the awning showing a simple painted "
            "shopping-basket symbol",
    "bookshop": "a small bookshop seen straight on from the front: a shop front whose deep glass window is "
                "filled with tall stacks of colourful books, a narrow plain awning, and above it a large sign "
                "cut into the shape of an open book",
}

# ---------------------------------------------------------------------------
# NGOẠI LỆ theo từng khoá.
#   no_text=False  → CHO PHÉP chữ/số trong hình (chỉ khi chính từ đó LÀ chữ/số).
#   no_face=True   → đổi sang `STYLE_HEAD_PLAIN` + thêm `NO_FACE_CLAUSE`:
#                    chủ thể là VẬT THỂ, không được mọc mặt/mắt/miệng/tay/chân.
#   style_extra    → câu thêm vào cuối, cho ca đặc biệt.
# ---------------------------------------------------------------------------

OVERRIDES = {
    # `letter` = chữ cái; nếu cấm chữ thì hình vô nghĩa. Chỉ mở cho ĐÚNG từ này.
    "letter": {"no_text": False},

    # ⚠️ `alphabet` — cùng lý do với `letter`: từ này BẢN THÂN LÀ CHỮ. Hình là ba khối gỗ xếp
    #    chồng, mỗi khối một chữ IN HOA. Cấm chữ thì mô hình sẽ vẽ ba khối gỗ TRƠN ⇒ bé không có
    #    gì để đọc ra "bảng chữ cái". Mở `no_text` chỉ cho đúng khoá này.
    "alphabet": {"no_text": False},

    # ⚠️ `stop` — chữ "STOP" TRÊN BIỂN chính là từ cần dạy. Đây là ca duy nhất trong nhóm
    #    biển báo: cấm chữ thì tấm biển thành một hình bát giác đỏ vô nghĩa, bé học sai từ.
    "stop": {"no_text": False},

    # ⚠️ BẪY: màu TRẮNG trên thẻ TRẮNG ⇒ hình vô hình. Phải có viền + bóng nhẹ,
    # nếu không bé chỉ thấy một khoảng trống và tưởng app lỗi.
    "white": {"style_extra": "Important: give the white paint blob a soft light-grey outline and a very subtle "
                             "soft drop shadow directly beneath it, so the white shape stays clearly visible "
                             "against a pure white background."},

    # ⚠️ CÙNG CÁI BẪY, lần thứ hai — 2026-10-15: `white-skirt` là VÁY TRẮNG trên thẻ TRẮNG.
    #    Không có viền thì bé chỉ thấy một khoảng trống ở đúng chỗ đáng lẽ là món đồ cần học.
    #    Câu này nói rõ "along every edge" vì váy có nhiều đường viền (cạp, gấu, nếp ly) — chỉ
    #    viền ngoài thì các nếp gấp trắng vẫn tan vào nền.
    "white-skirt": {"style_extra": "Important: give the white skirt a soft light-grey outline along every "
                                   "edge and fold, plus a very subtle soft drop shadow directly beneath it, "
                                   "so the white garment stays clearly visible against a pure white "
                                   "background."},

    # ⚠️⚠️ BỘ PHẬN CƠ THỂ = VẬT THỂ, KHÔNG PHẢI SINH VẬT.
    # Lần sinh thử đầu tiên (khối phong cách mở bằng "animated character" + "big expressive
    # friendly eyes") cho ra: `ear` mọc mắt và miệng ngay trong vành tai, `nose` thành một
    # KHUÔN MẶT có mũi, `hand` có mặt trên lòng bàn tay, `leg` có mặt ở đầu gối, `smile` có
    # hai mắt phía trên. Bé 7 tuổi nhìn `nose` sẽ đọc ra "face" chứ không ra "nose" — đúng
    # lỗi chủ dự án phàn nàn. Bật `no_face` cho mọi bộ phận LÀ VẬT THỂ.
    #
    # KHÔNG đặt cho ba khoá sau, và đây là chủ ý:
    #   · `eye`  — bản thân nó LÀ con mắt; cấm "NO eyes" thì câu tự mâu thuẫn.
    #   · `face`, `head`, `body` — bản thân chúng LÀ mặt / đầu / cả em bé, PHẢI có mặt.
    "leg": {"no_face": True},
    "arm": {"no_face": True},
    "hand": {"no_face": True},
    "ear": {"no_face": True},
    "nose": {"no_face": True},
    "mouth": {"no_face": True},
    "smile": {"no_face": True},
    "foot": {"no_face": True},
    "hair": {"no_face": True},

    # ⚠️⚠️ `train` — TRÁNH TRÙNG HÌNH DUNG VỚI NHÂN VẬT CÓ BẢN QUYỀN (chủ dự án yêu cầu,
    #    2026-10-08). Xem ghi chú đầy đủ ở câu tả chủ thể: đã sửa cả ba chi tiết (hướng nhìn,
    #    tông màu, bỏ mặt), và bật `no_face` ở đây để CHẮC CHẮN — khối phong cách ĐỒ VẬT không
    #    có mệnh đề "big expressive friendly eyes".
    #    ⚠️ Đây là chiếc xe DUY NHẤT không có mặt (bus/boat/motorbike/lorry đều có, và chủ dự án
    #    đã duyệt). Đánh đổi có ý thức: một chiếc tàu không mặt vẫn đọc ra "train" ngay, còn rủi
    #    ro bản quyền thì không sửa được bằng CSS.
    "train": {"no_face": True},

    # ⚠️ NHÂN VẬT NGƯỜI LỚN PHẢI CÙNG TÔNG VỚI NHÂN VẬT TRẺ EM (chủ dự án yêu cầu, 2026-10-08).
    #    Đo trên bộ ảnh: `boy` / `girl` / `child` / `baby` ra kiểu chibi (đầu to, thân ngắn, mắt
    #    to) — nhưng `man` / `woman` / `dad` / `mum` / `grandfather` / `grandmother` ra TẢ THỰC:
    #    người lớn đúng giải phẫu, gần như ảnh chụp 3D. Mỗi ảnh vẫn đúng nghĩa, nhưng nằm cạnh
    #    nhau trong CÙNG một chủ đề thì lệch tông thấy rõ.
    #    Dùng `style_extra` (không phải khối phong cách mới) là đúng chỗ: nó chỉ THÊM một câu
    #    cho 6 khoá này, không đụng tới 195 ảnh còn lại.
    "man": {"style_extra": ADULT_CHIBI_CLAUSE},
    "woman": {"style_extra": ADULT_CHIBI_CLAUSE},
    "dad": {"style_extra": ADULT_CHIBI_CLAUSE},
    "mum": {"style_extra": ADULT_CHIBI_CLAUSE},
    "grandfather": {"style_extra": ADULT_CHIBI_CLAUSE},
    "grandmother": {"style_extra": ADULT_CHIBI_CLAUSE},

    # ⚠️ KÍNH NGỮ Mr / Mrs / Miss (2026-10-15) — cùng lý do với man/woman/dad/mum: đây là NGƯỜI
    #    LỚN, và mô hình mặc định kéo người lớn về giải phẫu thật rất mạnh. Nằm cạnh `boy`/`girl`/
    #    `child` trong CÙNG chủ đề `my-friends-birthday` nên lệch tông là thấy ngay.
    "miss": {"style_extra": ADULT_CHIBI_CLAUSE},
    "mr": {"style_extra": ADULT_CHIBI_CLAUSE},
    "mrs": {"style_extra": ADULT_CHIBI_CLAUSE},
}

# ---------------------------------------------------------------------------
# Từ ĐƯỢC PHÉP có sinh vật trong hình ⇒ KHÔNG nhận `SOLO_CLAUSE`.
#
# ⭐ VÌ SAO DANH SÁCH NÀY LIỆT KÊ CÁI **CÓ** CHỨ KHÔNG PHẢI CÁI **KHÔNG**:
#   Mặc định là "nhận SOLO" (đồ vật đứng một mình). Danh sách dưới đây là *ngoại lệ* —
#   nhỏ hơn nhiều (79 / 239), nên đọc lướt là kiểm được hết, và một từ MỚI thêm sau này
#   tự động rơi về đúng phía an toàn (không có người lạ trong thẻ từ vựng).
#
# Bốn nhóm, và lý do từng nhóm:
#   1. CON VẬT (20) — chính nó LÀ sinh vật, phải có mặt/mắt.
#   2. NGƯỜI & HÀNH ĐỘNG (33) — hình phải cho thấy hành động, không phải đồ vật.
#   3. XE CÓ MẶT (6) — thiết kế cố ý vẽ "khuôn mặt thân thiện" ở đầu xe; câu "no people"
#      sẽ đẩy mô hình bỏ luôn khuôn mặt đó.
#   4. `my-body` (13) — ⚠️⚠️ ĐÂY LÀ NHÓM BẮT BUỘC PHẢI LOẠI, KHÔNG PHẢI CHO ĐẸP.
#      `SOLO_CLAUSE` có vế *"no hands"*, mà chủ thể của `hand` CHÍNH LÀ bàn tay; `arm`
#      kết thúc ở cổ tay (ngầm có bàn tay). Đây ĐÚNG CÁI BẪY đã trả giá với
#      `NO_FACE_CLAUSE` (bản nháp cấm "NO nose" trong khi `nose` là chủ thể): hai mệnh
#      lệnh ngược nhau ⇒ mô hình vẽ ra thứ không ai muốn. `plan.py` có phép kiểm cứng
#      cho đúng ca này, để nó không thể tái diễn trong im lặng.
# ---------------------------------------------------------------------------
NOT_SOLO = {
    # 1. con vật — chính nó LÀ sinh vật
    "cat", "elephant", "giraffe", "hippo", "tiger", "crocodile", "monkey", "snake",
    "dog", "cow", "horse", "sheep", "goat", "duck", "chicken", "frog", "lizard",
    "spider", "mouse", "bird",

    # 2. người & hành động
    "draw", "teacher",
    # ⚠️ `class` là một NHÓM NĂM ĐỨA BÉ — nếu nhận `SOLO_CLAUSE` (*"no people appear anywhere"*)
    #    thì chính chủ thể bị xoá. Thêm 2026-10-15 cùng lúc với việc bật `picturable`.
    "class",
    # ⚠️ `animal` là BA CON VẬT đứng cạnh nhau (xem câu tả): "no people" không chạm tới chúng,
    #    nhưng "the object is shown completely on its own" thì SAI nghĩa — đây không phải đồ vật.
    "animal",
    # ⚠️ `tail` — 2026-10-15, khi câu tả đổi sang "NHÌN TỪ PHÍA SAU một con mèo đang đứng bốn
    #    chân" (bản cũ tả cái đuôi đứng một mình ⇒ ra cái bánh sừng bò). Có CON VẬT trong khung
    #    thì `SOLO_CLAUSE` sai ở vế ĐẦU, không phải vế "no people": *"the object is shown
    #    completely on its own, appearing by itself"* — một con mèo đang đứng không phải "an
    #    object shown on its own". `NOT_SOLO` bỏ ĐÚNG hai vế đó và KHÔNG đụng gì khác, nên
    #    không mâu thuẫn với câu tả: câu tả không hề nhắc `hand`/`palm`/`wrist` (tự kiểm 4 của
    #    `plan.py` chỉ cấm đúng ba chữ đó), và `paws` không nằm trong danh sách cấm.
    #    Hệ quả phụ CÓ LỢI: `uses_solo('tail')` thành False ⇒ `is_object` False ⇒ khối phong
    #    cách đổi từ `STYLE_HEAD_PLAIN` (dành cho ĐỒ VẬT) sang `STYLE_HEAD` (dành cho SINH VẬT,
    #    có mắt to dễ thương) — đúng thứ một con mèo cần.
    "tail",
    # ⚠️ Kính ngữ Mr / Mrs / Miss — ba NGƯỜI LỚN. Thêm 2026-10-15.
    "miss", "mr", "mrs",
    # ⚠️ `classmate` (HAI bé), `read` / `write` (một bé đang làm gì đó) — mục 22, thêm 2026-10-15.
    #    Thiếu ba khoá này ở đây thì `SOLO_CLAUSE` (*"no people appear anywhere"*) xoá đúng chủ thể.
    "classmate", "read", "write",
    "swim", "jump", "walk", "throw", "catch", "hit", "kick", "sing", "paint", "take",
    "fishing",
    "robot", "monster", "person", "man", "woman", "child", "baby", "boy", "girl",
    "alien", "family", "dad", "mum", "grandfather", "grandmother", "sister", "brother",
    "cousin",
    "ride", "fly", "drive", "run",

    # 3. xe có khuôn mặt ở đầu xe
    "train", "bus", "boat", "helicopter", "motorbike", "lorry",

    # 4. bộ phận cơ thể — xem cảnh báo ở đầu khối này
    "leg", "ear", "eye", "face", "nose", "mouth", "smile", "arm", "hand", "foot",
    "hair", "body", "head",
}
