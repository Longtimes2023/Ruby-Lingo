# RubyLingo — Hiện trạng game theo chủ đề (Starters)

> **Loại tài liệu:** BÁO CÁO HIỆN TRẠNG (read-only).
> **Nguồn dữ liệu:** `src/data/levels/starters/level.json` + `src/data/levels/starters/themes/*.json` (11 file).
> **Cách sinh:** đọc trực tiếp JSON bằng script đếm (không sửa JSON, không chạy `npm run ci`).
> **Ngày:** 2026-10-10.
>
> Tài liệu này CHỈ mô tả sự thật đang có trong dữ liệu. Kế hoạch khắc phục nằm ở
> `docs/ke-hoach/game-phu-moi-chu-de.md`.

---

## 0. Tóm tắt nhanh

| Chỉ số | Giá trị |
|---|---|
| Số chủ đề | 11 |
| Số bài (lesson) | 43 |
| Số từ | 275 |
| Tổng exercise | 73 |
| Số loại game MVP có component đăng ký | 5 (`registry.ts`) |
| Chủ đề có đủ 5 loại game | **1** (`at-the-zoo`) |
| Chủ đề CHỈ có mỗi `memory_match` | **10 / 11** |
| Chủ đề KHÔNG THỂ dùng game dạng hình (0 từ picturable) | **2** (`alphabet`, `numbers-1-20`) |

**Kết luận 1 dòng:** ngoài `at-the-zoo`, toàn bộ 10 chủ đề còn lại đang chỉ có đúng một loại
game `memory_match`; đây là đúng vấn đề chủ dự án nêu ("mỗi chủ đề đều phải có game").

---

## 1. Ma trận THẬT: 11 chủ đề × 5 loại game MVP

Ô = **số exercise** của loại game đó trong chủ đề. `0` = chủ đề chưa có loại game đó.

| Chủ đề (id) | listen_tap | missing_letter | prepositions | memory_match | word_picture | Bài | Exercise | Từ |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| at-the-zoo | 3 | 3 | 3 | 3 | 3 | 3 | 15 | 21 |
| my-body | 0 | 0 | 0 | 3 | 0 | 2 | 3 | 13 |
| at-the-clothes-shop | 0 | 0 | 0 | 5 | 0 | 5 | 5 | 27 |
| my-friends-birthday | 0 | 0 | 0 | 5 | 0 | 4 | 5 | 22 |
| my-favourite-food | 0 | 0 | 0 | 9 | 0 | 6 | 9 | 39 |
| at-home | 0 | 0 | 0 | 9 | 0 | 5 | 9 | 34 |
| at-school | 0 | 0 | 0 | 8 | 0 | 4 | 8 | 29 |
| at-the-beach | 0 | 0 | 0 | 4 | 0 | 4 | 4 | 24 |
| my-street | 0 | 0 | 0 | 4 | 0 | 3 | 4 | 20 |
| alphabet | 0 | 0 | 0 | 6 | 0 | 4 | 6 | 26 |
| numbers-1-20 | 0 | 0 | 0 | 5 | 0 | 3 | 5 | 20 |
| **TỔNG** | **3** | **3** | **3** | **61** | **3** | **43** | **73** | **275** |

### 1.1 Chủ đề thiếu loại game nào

- **10/11 chủ đề** (tất cả trừ `at-the-zoo`) **thiếu cả 4 loại**: `listen_tap`, `missing_letter`,
  `prepositions`, `word_picture`.
- `at-the-zoo` là chủ đề DUY NHẤT có đủ 5/5 loại game MVP, và cả 3 bài của nó đều có đủ 5 game.
- **Chủ đề chỉ có mỗi `memory_match`** (đúng yêu cầu cần nêu rõ):
  `my-body`, `at-the-clothes-shop`, `my-friends-birthday`, `my-favourite-food`, `at-home`,
  `at-school`, `at-the-beach`, `my-street`, `alphabet`, `numbers-1-20` → **10 chủ đề**.

### 1.2 Chế độ `memory_match` đang dùng

- `at-the-zoo`: `pairMode = "en_icon"` (ghép từ ↔ hình; **cần ≥ 4 từ picturable**).
- 10 chủ đề còn lại: `pairMode = "en_vi"` (ghép tiếng Anh ↔ tiếng Việt; **KHÔNG cần hình**).
  Đây là lý do 10 chủ đề này vẫn "chơi được" dù nhiều bài không đủ từ vẽ được hình.

### 1.3 Ràng buộc kỹ thuật ảnh hưởng trực tiếp tới ma trận

| Loại game | Cần ≥ 4 từ `picturable`? | Nguồn kiểm |
|---|:--:|---|
| `listen_tap` | **CÓ** | `PICTURE_GAME_TYPES` + validator **V11** |
| `word_picture` | **CÓ** | `PICTURE_GAME_TYPES` + validator **V11** |
| `memory_match` (`en_icon`) | **CÓ** | `PICTURE_GAME_TYPES` + **V11** (trừ khi `pairMode = en_vi`) |
| `missing_letter` | KHÔNG | không nằm trong `PICTURE_GAME_TYPES` |
| `prepositions` | KHÔNG | không nằm trong `PICTURE_GAME_TYPES` (chỉ cần chủ ngữ có trong `wordIds`) |

> **Hệ quả:** `alphabet` và `numbers-1-20` có **0 từ picturable** ⇒ về mặt dữ liệu **KHÔNG THỂ**
> khai `listen_tap` / `word_picture` / `memory_match(en_icon)` cho 2 chủ đề này. Trần của 2 chủ đề
> này chỉ là các game không cần hình: `missing_letter` + `memory_match(en_vi)` = **2 loại**.

---

## 2. Bảng đếm từ & từ `picturable` theo TỪNG BÀI

> Cột `picturable` dùng để quyết định bài có đủ điều kiện mở game dạng hình hay không (ngưỡng ≥ 4).
> Cột "Game đang có" = danh sách `gameType` đang được khai cho bài đó.

| Bài (id) | Tên bài | Số từ | **picturable** | Đủ ≥4 để chơi game hình? | Game đang có |
|---|---|:--:|:--:|:--:|---|
| at-the-zoo/z1 | Động vật hoang dã to lớn | 7 | 7 | ✅ | listen_tap, missing_letter, prepositions, memory_match, word_picture |
| at-the-zoo/z2 | Vật nuôi & bạn nhỏ | 7 | 7 | ✅ | listen_tap, missing_letter, prepositions, memory_match, word_picture |
| at-the-zoo/z3 | Bò sát, côn trùng & từ chung | 7 | 5 | ✅ | listen_tap, missing_letter, prepositions, memory_match, word_picture |
| my-body/l1 | Các bộ phận cơ thể | 7 | **4** | ✅ (vừa đủ) | memory_match ×2 |
| my-body/l2 | Mặt mũi và tay chân | 6 | 6 | ✅ | memory_match |
| at-the-clothes-shop/l1 | Màu sắc 1 | 6 | 6 | ✅ | memory_match |
| at-the-clothes-shop/l2 | Màu sắc 2 | 5 | 5 | ✅ | memory_match |
| at-the-clothes-shop/l3 | Áo quần của bé | 6 | 5 | ✅ | memory_match |
| at-the-clothes-shop/l4 | Quần, giày và mũ | 5 | 5 | ✅ | memory_match |
| at-the-clothes-shop/l5 | Đồ dùng | 5 | 5 | ✅ | memory_match |
| my-friends-birthday/l1 | Gia đình của bé | 7 | 7 | ✅ | memory_match ×2 |
| my-friends-birthday/l2 | Mọi người quanh bé | 5 | 5 | ✅ | memory_match |
| my-friends-birthday/l3 | Bạn bè và thầy cô | 5 | **3** | ❌ (thiếu 1) | memory_match |
| my-friends-birthday/l4 | Đồ chơi và khách mời | 5 | **4** | ✅ (vừa đủ) | memory_match |
| my-favourite-food/l1 | Trái cây ngon | 6 | 6 | ✅ | memory_match |
| my-favourite-food/l2 | Trái cây nhiệt đới | 6 | 5 | ✅ | memory_match |
| my-favourite-food/l3 | Rau củ tươi | 7 | 7 | ✅ | memory_match ×2 |
| my-favourite-food/l4 | Bữa ăn trong ngày | 7 | **4** | ✅ (vừa đủ) | memory_match ×2 |
| my-favourite-food/l5 | Đồ ăn ngon | 7 | 7 | ✅ | memory_match ×2 |
| my-favourite-food/l6 | Đồ ngọt và đồ uống | 6 | 6 | ✅ | memory_match |
| at-home/h1 | Các phòng trong nhà | 7 | 5 | ✅ | memory_match ×2 |
| at-home/h2 | Đồ đạc trong nhà | 7 | 7 | ✅ | memory_match ×2 |
| at-home/h3 | Đồ đạc quanh bé | 7 | 7 | ✅ | memory_match ×2 |
| at-home/h4 | Trang trí trong nhà | 7 | 6 | ✅ | memory_match ×2 |
| at-home/h5 | Ngôi nhà và khu vườn | 6 | 6 | ✅ | memory_match |
| at-school/s1 | Đồ dùng học tập | 7 | 7 | ✅ | memory_match ×2 |
| at-school/s2 | Môn học và thể thao | 7 | 6 | ✅ | memory_match ×2 |
| at-school/s3 | Trong lớp học | 7 | **4** | ✅ (vừa đủ) | memory_match ×2 |
| at-school/s4 | Học và chơi | 8 | **4** | ✅ (vừa đủ) | memory_match ×2 |
| at-the-beach/b1 | Vận động ở biển | 6 | 6 | ✅ | memory_match |
| at-the-beach/b2 | Chơi thể thao | 6 | 5 | ✅ | memory_match |
| at-the-beach/b3 | Âm nhạc và sáng tạo | 6 | 6 | ✅ | memory_match |
| at-the-beach/b4 | Cảnh bãi biển | 6 | 6 | ✅ | memory_match |
| my-street/m1 | Phương tiện đi lại | 6 | 6 | ✅ | memory_match |
| my-street/m2 | Đi lại và vận động | 6 | **4** | ✅ (vừa đủ) | memory_match |
| my-street/m3 | Quanh khu phố | 8 | **4** | ✅ (vừa đủ) | memory_match ×2 |
| alphabet/a1 | Chữ A đến chữ G | 7 | **0** | ❌ | memory_match ×2 |
| alphabet/a2 | Chữ H đến chữ N | 7 | **0** | ❌ | memory_match ×2 |
| alphabet/a3 | Chữ O đến chữ T | 6 | **0** | ❌ | memory_match |
| alphabet/a4 | Chữ U đến chữ Z | 6 | **0** | ❌ | memory_match |
| numbers-1-20/n1 | Số 1 đến 7 | 7 | **0** | ❌ | memory_match ×2 |
| numbers-1-20/n2 | Số 8 đến 14 | 7 | **0** | ❌ | memory_match ×2 |
| numbers-1-20/n3 | Số 15 đến 20 | 6 | **0** | ❌ | memory_match |

### 2.1 Con số picturable tối thiểu tìm thấy

Trong số 33 bài của 9 chủ đề "có hình" (toàn bộ trừ `alphabet` + `numbers-1-20`):

- **Giá trị thấp nhất = 3** — chỉ duy nhất bài `my-friends-birthday/l3` (từ vẽ được: `boy`, `girl`,
  `family`; từ KHÔNG vẽ được: `miss`, `mr`). Vì ngưỡng của game hình là **≥ 4**, bài này
  **KHÔNG đủ điều kiện** mở `listen_tap` / `word_picture` / `memory_match(en_icon)`.
- `= 4` (vừa đủ ngưỡng): **7 bài** — `my-body/l1`, `my-friends-birthday/l4`,
  `my-favourite-food/l4`, `at-school/s3`, `at-school/s4`, `my-street/m2`, `my-street/m3`.
- Còn lại đều ≥ 5 ⇒ mở game hình thoải mái.
- `alphabet` (4 bài) và `numbers-1-20` (3 bài): picturable = **0** trên toàn bộ 7 bài.

---

## 3. Danh sách chủ đề / bài đang thiếu game

### 3.1 Thiếu ở cấp CHỦ ĐỀ (chỉ có `memory_match`)

`my-body`, `at-the-clothes-shop`, `my-friends-birthday`, `my-favourite-food`, `at-home`,
`at-school`, `at-the-beach`, `my-street` → **8 chủ đề** thiếu cả 4 loại game phi-memory.

### 3.2 Thiếu nhưng BỊ CHẶN bởi dữ liệu (không thể mở game hình)

`alphabet` (4 bài), `numbers-1-20` (3 bài) → 7 bài có **0 từ picturable**. Về mặt dữ liệu, các
bài này chỉ có thể nhận `missing_letter` (không cần hình) và `memory_match(en_vi)` (đang có).
`prepositions` không phù hợp ngữ nghĩa với chữ cái / chữ số (không phải "con vật / đồ vật núp").
⇒ Trần của 2 chủ đề này là **2 loại game/bài**, cần ghi rõ là ngoại lệ có lý do dữ liệu.

### 3.3 Thiếu nhưng BỊ CHẶN cục bộ (1 bài)

`my-friends-birthday/l3`: chỉ **3** từ picturable ⇒ bài này không thể nhận `listen_tap` /
`word_picture` / `memory_match(en_icon)`. Trần của bài là 3 loại: `memory_match(en_vi)` (đang có)
+ `missing_letter` + `prepositions`.

### 3.4 Bảng "số loại game/bài" đang có

- `at-the-zoo`: 5 loại/bài × 3 bài.
- **33 bài** còn lại trong 9 chủ đề "có hình": mỗi bài **1 loại** (`memory_match`).
- 7 bài của `alphabet` + `numbers-1-20`: mỗi bài **1 loại** (`memory_match`).

⇒ **Tất cả 40 bài ngoài `at-the-zoo` đều đang chỉ có 1 loại game.** Đây là gốc rễ của yêu cầu
"mỗi chủ đề đều phải có game để chơi".

---

## 4. Ghi chú kiểm chứng

- Bảng trên sinh trực tiếp từ JSON, không suy diễn. Mọi exercise hiện có đều qua validator
  (V9 khớp `config.kind` ↔ `gameType`, V11 ngưỡng picturable, V20 phủ hết `lesson.wordIds`).
- `shared/content/content-index.json` là **file dẫn xuất** (sinh bằng
  `npm run gen:content-index -- --apply`) — KHÔNG sửa tay, nên báo cáo này chỉ đọc JSON nguồn.
- ⚠️ **Cập nhật 2026-10-19 — quy ước cũ "tách đôi" đã bị bãi bỏ.** Trước đây các bài 7–8 từ bị
  chẻ thành 2 exercise `memory-match` + `memory-match-2` (mỗi cái `pairs` ≤ 6) cho vừa lưới thẻ.
  Chủ dự án báo bé thấy **HAI trò "Lật thẻ ghi nhớ" giống hệt nhau** trong cùng một bài ⇒ nay mỗi
  bài chỉ có **ĐÚNG MỘT** `memory_match`: `wordIds` = toàn bộ từ của bài, `pairs` = số từ. Lưới thẻ
  đổi sang **canh giữa hàng cuối** (`flex flex-wrap justify-center`, `MemoryMatchGame.tsx`) nên số
  thẻ 10/12/14/16 đều đẹp. Schema `memory_match` vẫn cho phép tới 10 cặp (`shared/schemas/content.ts`).
