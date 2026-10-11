# Kế hoạch: Phủ game cho MỌI chủ đề Starters

> **Loại tài liệu:** KẾ HOẠCH TRIỂN KHAI (chưa thực thi).
> **Phạm vi:** `src/data/levels/starters/themes/*.json` + `lesson.exerciseIds`.
> **Không thuộc phạm vi:** KHÔNG sửa code, KHÔNG sửa `content-index.json` bằng tay, KHÔNG commit, KHÔNG đụng DB.
> **Tiền đề (báo cáo hiện trạng):** `docs/ke-hoach/hien-trang-game-theo-chu-de.md`.
>
> Tài liệu này KHÔNG tự bịa dữ liệu. Mọi `gameType` đề xuất đều **đã có component đăng ký**
> trong `src/components/games/shared/registry.ts` (5 game MVP). Game ngoài MVP
> (`word_search`, `number_match`, `say_it`, `word_builder`, `sort_basket`, `count_tap`,
> `colour_learn`) **KHÔNG được khai** vì chưa có component ⇒ bấm vào sẽ dẫn tới hư không.

---

## 1. Mục tiêu

### 1.1 Mục tiêu chuẩn

**Mỗi chủ đề đạt 5/5 loại game MVP:**
`listen_tap` · `missing_letter` · `prepositions` · `memory_match` · `word_picture`.

### 1.2 Mục tiêu sàn (bắt buộc, không được thấp hơn)

| Nhóm chủ đề | Sàn số loại game / **chủ đề** | Sàn số loại game / **bài** |
|---|:--:|:--:|
| 9 chủ đề có tranh (`at-the-zoo`, `my-body`, `at-the-clothes-shop`, `my-friends-birthday`, `my-favourite-food`, `at-home`, `at-school`, `at-the-beach`, `my-street`) | **≥ 4** | **≥ 4** (bài đủ ≥ 4 picturable) |
| `alphabet`, `numbers-1-20` | **2** (ngoại lệ dữ liệu — xem §1.4) | **2** |
| Riêng bài `my-friends-birthday/l3` | — | **3** (chỉ 3 từ picturable) |

### 1.3 Vì sao chọn N = 5 (và sàn 4)

Vì mỗi loại game dạy một kỹ năng **khác nhau**, không thay thế nhau:

| Game | Kỹ năng bé luyện |
|---|---|
| `listen_tap` | Nghe từ tiếng Anh → chạm hình đúng |
| `missing_letter` | Chính tả / nhận diện mặt chữ |
| `memory_match` | Ghi nhớ + liên kết từ ↔ nghĩa/hình |
| `word_picture` | Đọc từ → nối với hình (đọc hiểu nghĩa) |
| `prepositions` | Nghe câu → hiểu vị trí (in/on/under/next to/behind/between) |

Nếu chỉ có `memory_match` thì bé chỉ luyện được **một** kỹ năng (ghi nhớ) — đó đúng là hiện trạng
của 10/11 chủ đề. Nên mục tiêu 5 loại là để **mỗi chủ đề đa dạng thật**, không phải "cho có".

Sàn là 4 (không phải 5) vì chủ đề `my-body` (bộ phận cơ thể) không hợp ngữ nghĩa với `prepositions`
("cái tai trốn trong hộp" là vô nghĩa). Các chủ đề còn lại đều có thể đạt 5.

### 1.4 Vì sao `alphabet` và `numbers-1-20` bị chặn ở 2 loại (không phải lỗi kế hoạch)

- 100% từ của 2 chủ đề này có `picturable = false` (chữ cái "A", số "one"… không "vẽ được hình"
  trong hệ thống). Validator **V11** yêu cầu game dạng hình phải có **≥ 4 từ picturable**.
  ⇒ `listen_tap`, `word_picture`, `memory_match(en_icon)` **bất khả thi về dữ liệu**.
- `prepositions` không hợp ngữ nghĩa với chữ cái / chữ số (không phải "con vật / đồ vật núp").
- Còn lại khả thi: `memory_match(en_vi)` (đang có) + `missing_letter` (không cần hình).
  ⇒ **Trần = 2 loại.** Đây là ngoại lệ được ghi rõ, KHÔNG dùng dữ liệu giả để lấp cho đủ 5.

---

## 2. Ma trận MỤC TIÊU (11 chủ đề × 5 loại game)

Ký hiệu: `✓` = sẽ có; `•` = đã có sẵn; `—` = không áp dụng được (có lý do ở cột Ghi chú).

| Chủ đề | listen_tap | missing_letter | prepositions | memory_match | word_picture | Loại (sau) | Ghi chú |
|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| at-the-zoo | • | • | • | • | • | 5 | **Đã đạt — không đổi** |
| my-body | ✓ | ✓ | — | • | ✓ | 4 | Bỏ prepositions (bộ phận cơ thể) |
| at-the-clothes-shop | ✓ | ✓ | ✓ | • | ✓ | 5 | prepositions cho l3–l5 |
| my-friends-birthday | ✓ | ✓ | ✓ | • | ✓ | 5 | l3 chỉ đạt 3 (thiếu picturable) |
| my-favourite-food | ✓ | ✓ | ✓ | • | ✓ | 5 | |
| at-home | ✓ | ✓ | ✓ | • | ✓ | 5 | h1 đạt 4 (bỏ prepositions) |
| at-school | ✓ | ✓ | ✓ | • | ✓ | 5 | s3 đạt 4 (bỏ prepositions) |
| at-the-beach | ✓ | ✓ | ✓ | • | ✓ | 5 | b1 đạt 4 (bỏ prepositions) |
| my-street | ✓ | ✓ | ✓ | • | ✓ | 5 | m2 đạt 4 (bỏ prepositions) |
| alphabet | — | ✓ | — | • | — | 2 | Ngoại lệ: 0 picturable |
| numbers-1-20 | — | ✓ | — | • | — | 2 | Ngoại lệ: 0 picturable |

**Điểm cốt lõi:** thêm `missing_letter` cho **mọi bài chưa có** là bước "xương sống" — nó biến
mọi bài từ 1 loại → **2 loại**, áp dụng được cho cả `alphabet`/`numbers-1-20`, và không phụ thuộc
picturable.

---

## 3. Ràng buộc bắt buộc (đọc trước khi làm)

1. **Không khai game chưa có component.** Chỉ 5 game trong `registry.ts`. Game khác ⇒ link chết.
2. **V11 — ngưỡng picturable:** `listen_tap`, `word_picture`, `memory_match(en_icon)` phải có
   **≥ 4 từ `picturable = true`** trong `exercise.wordIds`.
3. **V9 — khớp kiểu:** `exercise.gameType` phải **bằng** `exercise.config.kind`.
4. **V9 — liên kết:** mọi id trong `lesson.exerciseIds` phải trỏ tới một exercise **tồn tại**;
   và ngược lại exercise phải được liệt kê trong `exerciseIds` của bài nó.
5. **V20 — phủ từ:** hợp `wordIds` của **mọi** exercise trong một bài phải phủ **hết**
   `lesson.wordIds`. Vì `memory_match` hiện đã phủ hết, và `missing_letter` mới sẽ lấy **toàn bộ**
   từ của bài, quy tắc này tự động thỏa — nhưng **không được** cắt bớt `wordIds` của bài.
6. **V7 — kích thước bài:** 4–8 từ/bài (không sửa `lesson.wordIds`, không thêm/bớt từ để "ép" đủ).
7. **V6 — emoji duy nhất trong chủ đề** (không liên quan khi thêm exercise, nhưng đừng thêm từ mới).
8. **V12 — tranh cảnh:** không đụng `sceneImage`/`sceneAlt`.
9. **`memory_match` hiện khai ≤ 6 cặp/exercise** (bài 7–8 từ đã tách sẵn 2 exercise
   `memory-match` + `memory-match-2`). Đây là **quy ước nội dung** cho vừa lưới thẻ, KHÔNG phải
   giới hạn cứng (schema cho phép tới 10). ⇒ **Giữ nguyên** cách tách này, không gộp lại.
10. **`prepositions` — 2 luật schema (`superRefine`):**
    - `slots[i].correctSlot` **phải nằm trong** `slots[i].slots`;
    - `slots[i].sentenceEn` **phải chứa** chuỗi `slots[i].preposition`.
    Ngoài ra chủ ngữ trong `sentenceEn` phải khớp `word.en` của một từ trong `wordIds`.
11. **Luật "không bao giờ mắng trẻ":** không có exercise nào thêm text trách móc; game chỉ báo
    đúng/sai trung tính. (Exercise chỉ là dữ liệu cấu hình — nội dung câu chữ do component lo,
    và các component hiện có đã tuân luật này.)
12. **Tiếng Anh chỉ để ĐỌC, tiếng Việt chỉ để HIỂN THỊ.** Với `prepositions`, `slots[].sentenceEn`
    là câu tiếng Anh để máy đọc; `correctSlot`/`slots[]` là giới từ tiếng Anh (đọc + hiện sau khi
    trả lời). Không viết nghĩa tiếng Việt vào `sentenceEn`.
13. **`content-index.json` là file dẫn xuất** — sinh lại bằng lệnh, không sửa tay.

---

## 4. Quy ước id & cách khai `lesson.exerciseIds`

### 4.1 Id exercise

```
{lessonId}/{game-slug}
```

`game-slug` (kebab-case) tương ứng `gameType`:

| gameType | slug |
|---|---|
| `listen_tap` | `listen-tap` |
| `missing_letter` | `missing-letter` |
| `prepositions` | `prepositions` |
| `memory_match` | `memory-match` |
| `word_picture` | `word-picture` |

Ví dụ: `my-body/l1/missing-letter`, `at-the-clothes-shop/l3/prepositions`.

Nếu **cùng một bài** có **hai** exercise cùng loại (chỉ xảy ra với `memory_match` do giới hạn 6 cặp),
thêm hậu tố `-2`: `my-body/l1/memory-match` + `my-body/l1/memory-match-2` (đã có sẵn — giữ nguyên).

### 4.2 Khai `lesson.exerciseIds`

- **Chỉ thêm**, không xóa/đổi thứ tự các id cũ.
- Thứ tự gợi ý trong mảng: giữ nhóm `memory_match` cũ ở vị trí hiện tại, **append** các game mới
  theo thứ tự dễ→khó: `missing-letter` → `listen-tap` → `word-picture` → `prepositions`.
- Mỗi id mới phải có đúng **một** object exercise trong mảng `exercises` với `lessonId` khớp bài.

Ví dụ (bài `my-body/l1` sau khi bổ sung):

```jsonc
"exerciseIds": [
  "my-body/l1/memory-match",
  "my-body/l1/memory-match-2",
  "my-body/l1/missing-letter",
  "my-body/l1/listen-tap",
  "my-body/l1/word-picture"
]
```

---

## 5. Config mẫu cho từng game (copy-paste được)

> Không tự nghĩ config mới; dùng đúng mẫu dưới đây để khớp kiểu (V9) và khớp component.

**`missing_letter`** (áp dụng MỌI bài; `wordIds` = TOÀN BỘ từ của bài):

```jsonc
{
  "id": "<lessonId>/missing-letter",
  "lessonId": "<lessonId>",
  "gameType": "missing_letter",
  "wordIds": [ /* toàn bộ lesson.wordIds */ ],
  "difficulty": 1,
  "config": { "kind": "missing_letter", "rounds": 6, "hideCount": 1, "hidePosition": "any", "showImageHint": true }
}
```

- `showImageHint`: `true` khi bài có ≥ 4 picturable; **`false`** cho `alphabet` và `numbers-1-20`
  (không có hình thật, tránh lộ đáp án qua emoji).

**`listen_tap`** (chỉ khi ≥ 4 picturable; `wordIds` = danh sách từ picturable của bài):

```jsonc
{
  "id": "<lessonId>/listen-tap",
  "lessonId": "<lessonId>",
  "gameType": "listen_tap",
  "wordIds": [ /* CHỈ các từ picturable */ ],
  "difficulty": 1,
  "config": { "kind": "listen_tap", "rounds": 10, "optionCount": 4, "distractorMode": "same_lesson", "speechRate": 0.8 }
}
```

- `distractorMode: "same_lesson"` — nhiễu lấy từ CHÍNH bài học (đúng chủ trương "nhiễu phải cùng bài").

**`word_picture`** (chỉ khi ≥ 4 picturable; `wordIds` = danh sách từ picturable):

```jsonc
{
  "id": "<lessonId>/word-picture",
  "lessonId": "<lessonId>",
  "gameType": "word_picture",
  "wordIds": [ /* CHỈ các từ picturable */ ],
  "difficulty": 1,
  "config": { "kind": "word_picture", "pairs": 6, "rightColumn": "word" }
}
```

- `pairs` = `min(6, số từ picturable)`. Nếu bài có 4 picturable ⇒ `pairs: 4`.

**`prepositions`** (chỉ khi bài có ≥ 3 danh từ làm chủ ngữ hợp lý; `wordIds` = các chủ ngữ đó):

```jsonc
{
  "id": "<lessonId>/prepositions",
  "lessonId": "<lessonId>",
  "gameType": "prepositions",
  "wordIds": [ /* các danh từ làm chủ ngữ, xuất hiện trong sentenceEn */ ],
  "difficulty": 1,
  "config": {
    "kind": "prepositions",
    "rounds": 4,
    "slots": [
      { "sentenceEn": "The dog is under the box.", "preposition": "under", "correctSlot": "under", "slots": ["in", "on", "under", "behind"] },
      { "sentenceEn": "The cat is in the box.",   "preposition": "in",    "correctSlot": "in",    "slots": ["in", "on", "under", "behind"] },
      { "sentenceEn": "The ball is on the box.",  "preposition": "on",    "correctSlot": "on",    "slots": ["in", "on", "under", "behind"] },
      { "sentenceEn": "The duck is behind the box.", "preposition": "behind", "correctSlot": "behind", "slots": ["in", "on", "under", "behind"] }
    ]
  }
}
```

- `subjectIcon` khớp chủ ngữ bằng cách dò `word.en` trong `sentenceEn` ⇒ **chủ ngữ trong câu PHẢI
  nằm trong `wordIds`** và là danh từ (động từ/tính từ không đóng vai "trốn" được).
- Luật schema bắt buộc: mỗi `slot` phải có `correctSlot ∈ slots` **và** `sentenceEn` phải chứa
  đúng chuỗi `preposition` (ví dụ `preposition: "next to"` ⇒ câu phải viết "... is next to the box.").
- Giới từ dùng đúng bộ đã có layout: `in`, `on`, `under`, `next to`, `behind`, `between`, `in front of`.

**`memory_match`**: **giữ nguyên** toàn bộ exercise hiện có (id, `pairMode`, `pairs`, `wordIds`).
Không đổi `en_vi` → `en_icon` ở 10 chủ đề kia (sẽ vỡ V11).

---

## 6. Chi tiết theo từng chủ đề / bài còn thiếu

> Cột "Thêm" liệt kê `slug` exercise mới. `wordIds` ghi nguồn cụ thể.
> "→ loại/bài" = số loại game của bài sau khi thêm.

### 6.1 `at-the-zoo` — ✅ ĐÃ ĐỦ (5 loại × 3 bài). Không thay đổi.

### 6.2 `my-body` (l1, l2) → 4 loại/chủ đề

| Bài | Thêm | `wordIds` lấy từ đâu | Điều kiện | → loại/bài |
|---|---|---|---|:--:|
| my-body/l1 | `missing-letter` | toàn bộ 7 từ của bài | OK | 4 |
| my-body/l1 | `listen-tap` | picturable: `leg, ear, eye, face` (đúng 4) | ✅ =4 | |
| my-body/l1 | `word-picture` (`pairs:4`) | như trên (4 từ) | ✅ =4 | |
| my-body/l2 | `missing-letter` | toàn bộ 6 từ | OK | 4 |
| my-body/l2 | `listen-tap` | toàn bộ 6 từ (đều picturable) | ✅ | |
| my-body/l2 | `word-picture` (`pairs:6`) | như trên | ✅ | |

**Bỏ `prepositions`** (bộ phận cơ thể không "núp hộp" tự nhiên).

### 6.3 `at-the-clothes-shop` (l1–l5) → 5 loại/chủ đề

| Bài | Thêm | `wordIds` | Điều kiện | → loại/bài |
|---|---|---|---|:--:|
| .../l1 (màu sắc, 6 từ) | `missing-letter` | toàn bộ 6 | OK | 4 |
| .../l1 | `listen-tap`, `word-picture(pairs:6)` | 6 từ picturable | ✅ | |
| .../l2 (màu sắc, 5 từ) | `missing-letter` | toàn bộ 5 | OK | 4 |
| .../l2 | `listen-tap`, `word-picture(pairs:5)` | 5 từ picturable | ✅ | |
| .../l3 (áo quần, 6 từ) | `missing-letter` | toàn bộ 6 | OK | **5** |
| .../l3 | `listen-tap`, `word-picture(pairs:5)` | `jacket, skirt, shirt, dress, t-shirt` (5 pic) | ✅ | |
| .../l3 | `prepositions` | chủ ngữ: `jacket, skirt, shirt, dress` (4) | ✅ | |
| .../l4 (5 từ) | `missing-letter` | toàn bộ 5 | OK | **5** |
| .../l4 | `listen-tap`, `word-picture(pairs:5)` | 5 từ picturable | ✅ | |
| .../l4 | `prepositions` | `trousers, shoe, sock, hat` (4) | ✅ | |
| .../l5 (5 từ) | `missing-letter` | toàn bộ 5 | OK | **5** |
| .../l5 | `listen-tap`, `word-picture(pairs:5)` | `glasses, bag, handbag, watch, angry` (5 pic) | ✅ | |
| .../l5 | `prepositions` | `glasses, bag, handbag, watch` (4) | ✅ | |

**Bỏ `prepositions` cho l1, l2** (màu sắc không "núp").

### 6.4 `my-friends-birthday` (l1–l4) → 5 loại/chủ đề

| Bài | Thêm | `wordIds` | Điều kiện | → loại/bài |
|---|---|---|---|:--:|
| .../l1 (7 từ) | `missing-letter` | toàn bộ 7 | OK | **5** |
| .../l1 | `listen-tap`, `word-picture(pairs:6)` | 7 từ picturable | ✅ | |
| .../l1 | `prepositions` | `dad, mum, brother, sister` (4) | ✅ | |
| .../l2 (5 từ) | `missing-letter` | toàn bộ 5 | OK | **5** |
| .../l2 | `listen-tap`, `word-picture(pairs:5)` | 5 từ picturable | ✅ | |
| .../l2 | `prepositions` | `man, woman, child, baby` (4) | ✅ | |
| .../l3 (5 từ) | `missing-letter` | toàn bộ 5 | OK | **3** ⚠️ |
| .../l3 | `prepositions` | `boy, girl, family` (chỉ 3 pic) | ✅ (không cần 4) | |
| .../l3 | **KHÔNG** thêm `listen-tap`/`word-picture` | chỉ 3 picturable (<4) | ❌ V11 | |
| .../l4 (5 từ) | `missing-letter` | toàn bộ 5 | OK | **5** |
| .../l4 | `listen-tap`, `word-picture(pairs:4)` | `robot, monster, balloon, alien` (4 pic) | ✅ =4 | |
| .../l4 | `prepositions` | `robot, monster, alien` (3) | ✅ | |

### 6.5 `my-favourite-food` (l1–l6) → 5 loại/chủ đề

| Bài | Thêm | `wordIds` | Điều kiện | → loại/bài |
|---|---|---|---|:--:|
| .../l1 (6 từ) | `missing-letter` | toàn bộ 6 | OK | **5** |
| .../l1 | `listen-tap`, `word-picture(pairs:6)` | 6 từ picturable | ✅ | |
| .../l1 | `prepositions` | `apple, banana, lemon, pear` | ✅ | |
| .../l2 (6 từ, 5 pic) | `missing-letter` | toàn bộ 6 | OK | **5** |
| .../l2 | `listen-tap`, `word-picture(pairs:5)` | 5 từ picturable | ✅ | |
| .../l2 | `prepositions` | `lime, mango, pineapple, coconut` | ✅ | |
| .../l3 (7 từ) | `missing-letter` | toàn bộ 7 | OK | **5** |
| .../l3 | `listen-tap`, `word-picture(pairs:6)` | 7 từ picturable | ✅ | |
| .../l3 | `prepositions` | `tomato, onion, potato, carrot` | ✅ | |
| .../l4 (7 từ, 4 pic) | `missing-letter` | toàn bộ 7 | OK | **5** |
| .../l4 | `listen-tap`, `word-picture(pairs:4)` | `bread, egg, milk, water` (4 pic) | ✅ =4 | |
| .../l4 | `prepositions` | `bread, egg, water` (3) | ✅ | |
| .../l5 (7 từ) | `missing-letter` | toàn bộ 7 | OK | **5** |
| .../l5 | `listen-tap`, `word-picture(pairs:6)` | 7 từ picturable | ✅ | |
| .../l5 | `prepositions` | `fish, sausage, burger, cake` | ✅ | |
| .../l6 (6 từ) | `missing-letter` | toàn bộ 6 | OK | **5** |
| .../l6 | `listen-tap`, `word-picture(pairs:6)` | 6 từ picturable | ✅ | |
| .../l6 | `prepositions` | `candy, chocolate, juice, lemonade` | ✅ | |

### 6.6 `at-home` (h1–h5) → 5 loại/chủ đề

| Bài | Thêm | `wordIds` | Điều kiện | → loại/bài |
|---|---|---|---|:--:|
| .../h1 (7 từ, 5 pic) | `missing-letter` | toàn bộ 7 | OK | 4 |
| .../h1 | `listen-tap`, `word-picture(pairs:5)` | 5 từ picturable | ✅ | |
| .../h2 (7 từ) | `missing-letter` | toàn bộ 7 | OK | **5** |
| .../h2 | `listen-tap`, `word-picture(pairs:6)` | 7 từ picturable | ✅ | |
| .../h2 | `prepositions` | `chair, table, lamp, sofa` | ✅ | |
| .../h3 (7 từ) | `missing-letter` | toàn bộ 7 | OK | **5** |
| .../h3 | `listen-tap`, `word-picture(pairs:6)` | 7 từ picturable | ✅ | |
| .../h3 | `prepositions` | `bookcase, cupboard, clock, radio` | ✅ | |
| .../h4 (7 từ, 6 pic) | `missing-letter` | toàn bộ 7 | OK | **5** |
| .../h4 | `listen-tap`, `word-picture(pairs:6)` | 6 từ picturable | ✅ | |
| .../h4 | `prepositions` | `door, picture, phone, flower` | ✅ | |
| .../h5 (6 từ) | `missing-letter` | toàn bộ 6 | OK | **5** |
| .../h5 | `listen-tap`, `word-picture(pairs:6)` | 6 từ picturable | ✅ | |
| .../h5 | `prepositions` | `house, garden, cat, doll` | ✅ | |

**Bỏ `prepositions` cho h1** (phòng ốc không "núp").

### 6.7 `at-school` (s1–s4) → 5 loại/chủ đề

| Bài | Thêm | `wordIds` | Điều kiện | → loại/bài |
|---|---|---|---|:--:|
| .../s1 (7 từ) | `missing-letter` | toàn bộ 7 | OK | **5** |
| .../s1 | `listen-tap`, `word-picture(pairs:6)` | 7 từ picturable | ✅ | |
| .../s1 | `prepositions` | `pencil, pen, book, desk` | ✅ | |
| .../s2 (7 từ, 6 pic) | `missing-letter` | toàn bộ 7 | OK | **5** |
| .../s2 | `listen-tap`, `word-picture(pairs:6)` | 6 từ picturable | ✅ | |
| .../s2 | `prepositions` | `football, basketball, computer, drawing` | ✅ | |
| .../s3 (7 từ, 4 pic) | `missing-letter` | toàn bộ 7 | OK | 4 |
| .../s3 | `listen-tap`, `word-picture(pairs:4)` | `teacher, classroom, letter, page` (4 pic) | ✅ =4 | |
| .../s4 (8 từ, 4 pic) | `missing-letter` | toàn bộ 8 | OK | **5** |
| .../s4 | `listen-tap`, `word-picture(pairs:4)` | `tick, cross, keyboard, mouse-computer` (4 pic) | ✅ =4 | |
| .../s4 | `prepositions` | `tick, cross, keyboard, mouse-computer` (4) | ✅ | |

**Bỏ `prepositions` cho s3** (giáo viên/lớp học không "núp" tự nhiên).

### 6.8 `at-the-beach` (b1–b4) → 5 loại/chủ đề

| Bài | Thêm | `wordIds` | Điều kiện | → loại/bài |
|---|---|---|---|:--:|
| .../b1 (6 từ, động từ) | `missing-letter` | toàn bộ 6 | OK | 4 |
| .../b1 | `listen-tap`, `word-picture(pairs:6)` | 6 từ picturable | ✅ | |
| .../b2 (6 từ, 5 pic) | `missing-letter` | toàn bộ 6 | OK | **5** |
| .../b2 | `listen-tap`, `word-picture(pairs:5)` | 5 từ picturable | ✅ | |
| .../b2 | `prepositions` | `baseball, table-tennis, badminton, tennis` | ✅ | |
| .../b3 (6 từ) | `missing-letter` | toàn bộ 6 | OK | **5** |
| .../b3 | `listen-tap`, `word-picture(pairs:6)` | 6 từ picturable | ✅ | |
| .../b3 | `prepositions` | `guitar, piano, camera` (3) | ✅ | |
| .../b4 (6 từ) | `missing-letter` | toàn bộ 6 | OK | **5** |
| .../b4 | `listen-tap`, `word-picture(pairs:6)` | 6 từ picturable | ✅ | |
| .../b4 | `prepositions` | `sand, shell, kite, sea` | ✅ | |

**Bỏ `prepositions` cho b1** (động từ `swim/jump/...` không làm chủ ngữ).

### 6.9 `my-street` (m1–m3) → 5 loại/chủ đề

| Bài | Thêm | `wordIds` | Điều kiện | → loại/bài |
|---|---|---|---|:--:|
| .../m1 (6 từ) | `missing-letter` | toàn bộ 6 | OK | **5** |
| .../m1 | `listen-tap`, `word-picture(pairs:6)` | 6 từ picturable | ✅ | |
| .../m1 | `prepositions` | `train, bus, boat, lorry` | ✅ | |
| .../m2 (6 từ, 4 pic) | `missing-letter` | toàn bộ 6 | OK | 4 |
| .../m2 | `listen-tap`, `word-picture(pairs:4)` | `ride, fly, drive, run` (4 pic) | ✅ =4 | |
| .../m3 (8 từ, 4 pic) | `missing-letter` | toàn bộ 8 | OK | **5** |
| .../m3 | `listen-tap`, `word-picture(pairs:4)` | `tree, park, shop, bookshop` (4 pic) | ✅ =4 | |
| .../m3 | `prepositions` | `tree, park, shop, bookshop` (4) | ✅ | |

**Bỏ `prepositions` cho m2** (động từ `ride/fly/...` không làm chủ ngữ).

### 6.10 `alphabet` (a1–a4) → 2 loại/chủ đề (NGOẠI LỆ DỮ LIỆU)

| Bài | Thêm | `wordIds` | → loại/bài |
|---|---|---|:--:|
| a1, a2, a3, a4 | `missing-letter` (`showImageHint:false`, `hideCount:1`) | toàn bộ từ của bài | **2** |

- **KHÔNG** thêm `listen-tap` / `word-picture` / `memory_match(en_icon)`: 0 picturable ⇒ V11 fail.
- **KHÔNG** thêm `prepositions`: chữ cái không phải "con vật/đồ vật núp".

### 6.11 `numbers-1-20` (n1–n3) → 2 loại/chủ đề (NGOẠI LỆ DỮ LIỆU)

| Bài | Thêm | `wordIds` | → loại/bài |
|---|---|---|:--:|
| n1, n2, n3 | `missing-letter` (`showImageHint:false`, `hideCount:1`) | toàn bộ từ của bài | **2** |

- Lý do chặn giống `alphabet` (§6.10).

---

## 7. Thứ tự thực hiện theo giai đoạn

> Sau **MỖI** giai đoạn phải chạy lệnh kiểm chứng ở §7.0 mới được sang giai đoạn sau.

### §7.0 Lệnh kiểm chứng (bắt buộc sau mỗi giai đoạn)

```bash
# 1) Sinh lại chỉ mục nội dung (file dẫn xuất — KHÔNG sửa tay)
npm run gen:content-index -- --apply

# 2) Kiểm tra nội dung (nhanh: V9, V11, V20, V12...)
npm run validate:content
```

- `validate:content` phải in **0 LỖI**. Có cảnh báo `V12`/`V17` về `.webp` thiếu là bình thường
  (ảnh do AI sinh sau), nhưng **lỗi** thì phải sửa trước khi đi tiếp.
- Cuối giai đoạn 4 (hoặc trước khi bàn giao) mới chạy full:

```bash
npm run ci   # typecheck + lint + validate + gen index + gen theme-colors + test:ci
```

- **Lưu ý:** `npm run ci` mất ~7 phút — chỉ chạy ở mốc chốt, không chạy sau từng theme.

### Giai đoạn 1 — "Xương sống": `missing_letter` cho MỌI bài

- Thêm `missing-letter` cho **40 bài** đang thiếu (tất cả trừ 3 bài `at-the-zoo`).
- Với `alphabet`/`numbers-1-20`: `showImageHint:false`. Các bài còn lại: `showImageHint:true`.
- **Kết quả:** mỗi bài từ 1 → **2 loại game**; mỗi chủ đề ≥ 2 loại. Chạm được sàn của §1.2.
- ⚠️ Đây là bước rủi ro thấp nhất, giá trị cao nhất ⇒ **làm đầu tiên và kiểm chứng ngay**.
- Kiểm: `validate:content` (chú ý V7 không bị đổi, V20 vẫn phủ, V9 khớp).

### Giai đoạn 2 — Game dạng HÌNH: `listen_tap` + `word_picture`

- Áp dụng cho mọi bài **có ≥ 4 picturable** (xem bảng §6). Bỏ qua `my-friends-birthday/l3`,
  `alphabet`, `numbers-1-20`.
- `wordIds` = **đúng danh sách từ picturable** đã liệt kê; `pairs = min(6, số picturable)`.
- **Kết quả:** 9 chủ đề có hình đạt **≥ 4 loại/bài**.
- Kiểm: `validate:content` (V11 là trọng tâm — mọi workout hình phải ≥ 4 picturable).

### Giai đoạn 3 — `prepositions` cho bài có chủ ngữ là danh từ

- Áp dụng theo §6 (bỏ các bài mà chủ ngữ là động từ/màu/phòng ốc: `my-body`, clothes l1–l2,
  `at-home/h1`, `at-school/s3`, `at-the-beach/b1`, `my-street/m2`, `alphabet`, `numbers`).
- Mỗi exercise 4 `slots`, dùng giới từ có layout sẵn; chủ ngữ **phải nằm trong `wordIds`** và
  trùng `word.en` trong `sentenceEn`.
- **Kết quả:** 8 chủ đề đạt **5 loại/chủ đề** (`my-body` dừng ở 4 — có lý do).
- Kiểm: `validate:content`.

### Giai đoạn 4 — Chốt & kiểm chứng toàn cục

1. Đối chiếu lại **ma trận THẬT** sau khi sửa với **ma trận MỤC TIÊU** (§2) — mọi ô phải khớp,
   ngoại lệ `alphabet`/`numbers-1-20` = 2 loại, `my-friends-birthday/l3` = 3 loại.
2. `npm run gen:content-index -- --apply` rồi `npm run ci`.
3. Cập nhật lại `docs/ke-hoach/hien-trang-game-theo-chu-de.md` cho khớp trạng thái mới
   (hoặc ghi chú "đã hoàn thành" kèm ngày).

---

## 8. Rủi ro & kiểm soát

| Rủi ro | Dấu hiệu | Kiểm soát |
|---|---|---|
| Khai game ngoài MVP (`word_builder`…) | Link chết "đang được làm" | Chỉ 5 `gameType` trong `registry.ts` |
| `word_picture`/`listen_tap` thiếu picturable | **V11** đỏ | `wordIds` = chỉ từ picturable, ≥ 4 |
| `config.kind` ≠ `gameType` | **V9** đỏ | Dùng đúng config mẫu §5 |
| Id exercise không nằm trong `exerciseIds` (hoặc ngược lại) | **V9** đỏ | Ghi id vào `lesson.exerciseIds` |
| Thêm exercise mà làm mất phủ từ | **V20** đỏ | `missing_letter` luôn lấy **toàn bộ** từ bài |
| Gộp 2 `memory_match` của bài 7–8 từ | Mất phủ từ / vượt 6 cặp | **Giữ nguyên** tách 2 exercise |
| Đổi `memory_match` sang `en_icon` ở chủ đề ít hình | **V11** đỏ | **Không đổi** `pairMode` hiện có |
| Chạy `npm run ci` quá nhiều | Mất thời gian | Chỉ chạy `validate:content` giữa các giai đoạn |

---

## 9. Checklist tổng (để theo dõi tiến độ)

- [ ] **GĐ1** `missing_letter` cho 40 bài (tất cả trừ `at-the-zoo`).
- [ ] **GĐ2** `listen_tap` + `word_picture` cho mọi bài ≥ 4 picturable.
- [ ] **GĐ3** `prepositions` cho các bài có chủ ngữ danh từ (theo §6).
- [ ] **GĐ4** Đối chiếu ma trận + `gen:content-index` + `ci`.
- [ ] Ngoại lệ đã ghi rõ: `alphabet` = 2 loại, `numbers-1-20` = 2 loại,
      `my-friends-birthday/l3` = 3 loại, `my-body` chủ đề = 4 loại.
