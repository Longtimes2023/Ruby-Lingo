#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RubyLingo — ĐẶC TẢ CHỦ THỂ cho 201 hình từ vựng (Starters).

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
    "chair": "a single simple child's chair with four straight legs and a plain slatted back, "
             "painted in a cheerful colour, side view, standing alone",
    "table": "a single cute chunky round wooden table with four short legs, side view",
    "lamp": "a single cute table lamp with a rounded base and a warm glowing lampshade",
    "sofa": "a single cute plump two-seat sofa in a soft pastel colour with round cushions, front view",
    "bed": "a single cute child's bed with a plump pillow and a neatly folded blanket, side view",
    "box": "a single cute open cardboard toy box with the lid tilted, a few rounded toys peeking out",
    # ⚠️ KHÔNG viết "hand mirror": `SOLO_CLAUSE` có vế *"no hands"*, hai mệnh lệnh ngược
    # nhau. (Phép kiểm 4 của `plan.py` đã bắt đúng ca này.) Tả bằng "cái móc treo".
    "mirror": "a single cute oval mirror with a rounded pastel frame and a small loop at the top for hanging",
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
    "computer": "a single cute rounded desktop computer: a monitor with a soft glowing blue screen and a small keyboard in front",
    "draw": "a cute little child character happily drawing with a big bright crayon on a sheet of paper, side view, concentrating with a smile",
    "drawing": "a single sheet of white paper showing a cheerful child's crayon drawing of a sun, a little house and a flower",
    "teacher": "a friendly smiling woman teacher character with glasses and a neat bun, holding a book, FULL BODY, standing",
    "classroom": "a cute miniature isometric doll-house room chunk of a small classroom: a blank chalkboard on the wall, "
                 "two little desks and a globe on a shelf, floating cut-away room slab",
    "letter": "a single bright colourful wooden alphabet block standing alone, with the capital letter A on its front face",
    "page": "a single open book with one page lifted and curling over, showing blank pages",
    "tick": "a single big chunky rounded green check-mark symbol standing alone, glossy and friendly",
    "cross": "a single big chunky rounded red X symbol standing alone, glossy and friendly",
    "keyboard": "a single cute pastel computer keyboard seen at a slight angle, keys completely blank",
    "mouse-computer": "a single cute pastel computer mouse with a scroll wheel and a short curly cable",

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
    "sing": "a cute little child character singing joyfully, mouth wide open, head tilted up, one musical note floating beside the head",
    "paint": "a cute little child character painting on a small canvas, holding a brush in one hand and a paint palette in the other",
    "take": "a cute little child character taking a photograph, holding a camera up to one eye with both hands",
    "guitar": "a single cute acoustic guitar in warm honey wood with a rounded body and visible strings",
    "piano": "a single cute upright piano with white and black keys and a small round stool in front",
    "camera": "a single cute compact camera with one big round lens and a small flash",
    "sand": "a single cute little mound of golden sand with a few scattered grains and one tiny shell resting on top",
    "sea": "a single cute stylised ocean wave: a rounded curling blue wave with white foam on the crest, toy-like and friendly",
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
    "red": "a single playful thick 3D paint blob of bright red paint with two small round droplets beside it, "
           "the ONLY colour in the image is bright red",
    "green": "a single playful thick 3D paint blob of fresh grass-green paint with two small round droplets beside it, "
             "the ONLY colour in the image is fresh grass green",

    # Quần áo (14)
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

    # Tính từ
    "angry": "a cute cartoon character's head and shoulders showing an angry expression: furrowed eyebrows, "
             "puffed cheeks, flushed red-orange face and two small steam puffs beside the head. "
             "Expressive and funny, absolutely NOT frightening or mean",

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
    "tree": "a single cute leafy tree with a thick rounded green crown and a sturdy brown trunk standing alone",
    "park": "a cute miniature isometric diorama of a little park on a rounded grass slab: a leafy tree, "
            "a small wooden bench, a tiny round pond and two flowers, floating cut-away scene",
    "shop": "a cute miniature isometric diorama of a small corner shop on a rounded base: a colourful shop front "
            "with a striped awning, a door, a display window with jars and a small hanging sign with no readable text",
    "bookshop": "a cute miniature isometric diorama of a small bookshop on a rounded base: a shop front with a blue awning, "
                "a stack of colourful books in the window and a hanging sign showing a simple book symbol",
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

    # ⚠️ BẪY: màu TRẮNG trên thẻ TRẮNG ⇒ hình vô hình. Phải có viền + bóng nhẹ,
    # nếu không bé chỉ thấy một khoảng trống và tưởng app lỗi.
    "white": {"style_extra": "Important: give the white paint blob a soft light-grey outline and a very subtle "
                             "soft drop shadow directly beneath it, so the white shape stays clearly visible "
                             "against a pure white background."},

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
}

# ---------------------------------------------------------------------------
# Từ ĐƯỢC PHÉP có sinh vật trong hình ⇒ KHÔNG nhận `SOLO_CLAUSE`.
#
# ⭐ VÌ SAO DANH SÁCH NÀY LIỆT KÊ CÁI **CÓ** CHỨ KHÔNG PHẢI CÁI **KHÔNG**:
#   Mặc định là "nhận SOLO" (đồ vật đứng một mình). Danh sách dưới đây là *ngoại lệ* —
#   nhỏ hơn nhiều (69 / 201), nên đọc lướt là kiểm được hết, và một từ MỚI thêm sau này
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
    "swim", "jump", "walk", "throw", "catch", "hit", "kick", "sing", "paint", "take",
    "fishing",
    "angry",
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
