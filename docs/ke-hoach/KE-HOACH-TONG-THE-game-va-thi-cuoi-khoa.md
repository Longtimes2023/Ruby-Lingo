# KẾ HOẠCH TỔNG THỂ — Phủ game mọi chủ đề + Bài thi cuối khoá Starters

> **Loại tài liệu:** KẾ HOẠCH TRIỂN KHAI (chưa thực thi). Ngày lập: 2026-10-10.
> **Yêu cầu của chủ dự án:** (1) *mỗi chủ đề đều phải có game để chơi*; (2) sau khi bé học hết và
> chơi hết game của **11 chủ đề Starters**, có **bài thi cuối khoá** dựng theo tinh thần bài thi
> Cambridge Pre A1 Starters.
>
> **Tài liệu này là bản tổng hợp.** Ba tài liệu chi tiết đi kèm:
> - `docs/nghien-cuu/cambridge-starters-va-de-thi-cuoi-khoa.md` — nghiên cứu đề thi & tài liệu
>   chính thức (có URL nguồn, ngày truy cập, ghi chú bản quyền).
> - `docs/ke-hoach/hien-trang-game-theo-chu-de.md` — báo cáo hiện trạng game (ma trận thật).
> - `docs/ke-hoach/game-phu-moi-chu-de.md` — kế hoạch phủ game chi tiết tới từng bài.
> - `docs/ke-hoach/thiet-ke-bai-thi-cuoi-khoa.md` — thiết kế kỹ thuật bài thi cuối khoá.
>
> **Phạm vi tài liệu này:** kế hoạch + cách thức thực hiện. **Chưa sửa một dòng code/dữ liệu nào.**

---

## 1. Mục tiêu

| # | Mục tiêu | Tiêu chí nghiệm thu (đo được) |
|---|---|---|
| A | **Mỗi chủ đề có game đa dạng** | 9 chủ đề có tranh đạt **≥ 4/5 loại game**; `alphabet` + `numbers-1-20` đạt **2/5** (ngoại lệ có lý do dữ liệu — §3.3); **mọi bài** đạt ≥ 2 loại |
| B | **Bài thi cuối khoá Starters** | Bé học hết 43 bài + chơi hết mọi exercise chơi được ⇒ mở cổng `/final-test`; làm 3 phần; nhận kết quả dạng **khiên 1–5** mỗi phần + huy chương tốt nghiệp |
| C | **Không phá luật dự án** | Không mắng trẻ, không trừ gì của bé, không hẹn giờ, không xếp hạng, server là trọng tài cuối, `npm run ci` xanh |

---

## 2. Căn cứ nghiên cứu (tóm tắt — chi tiết ở tài liệu nghiên cứu)

Nguồn: cambridgeenglish.org + cambridgeenglish.cn, truy cập 2026-10-10. Đã tải và đọc trực tiếp 6
PDF chính thức (Handbook for teachers 2024, Wordlist picture book, Wordlists 2025, Sample papers
volume 1, Can Do statements, Handbook Digital 2024).

1. Bài thi giấy: **3 paper, mỗi paper tối đa 5 khiên, KHÔNG có đỗ/trượt**, tổng ~45 phút.
   - **Listening** — 4 part / **20 câu** / ~20 phút.
   - **Reading & Writing** — 5 part / **25 câu** / 20 phút.
   - **Speaking** — 4 part / 3–5 phút (Part 1 không tính điểm).
2. Chi tiết 4 part Listening: P1 nối tên↔người trong tranh lớn (5c) · P2 nghe viết **tên hoặc số**
   (5c) · P3 5 hội thoại, chọn tranh **A/B/C** (5c) · P4 nghe **tô màu** 7 đồ vật cùng loại (5c).
   Bộ màu chuẩn: black/blue/brown/green/grey/orange/pink/purple/red/yellow.
3. Chi tiết 5 part Reading & Writing: P1 **tick/cross** theo câu "This is a …" (5c) · P2 tranh lớn
   ⇒ viết **yes/no** (5c) · P3 **xếp chữ cái xáo trộn** thành từ, có gạch gợi ý số chữ (5c) ·
   P4 **cloze**: đoạn văn có chỗ trống, chọn từ ở khung (5c) · P5 **3 tranh kể chuyện + câu hỏi**,
   viết **1 từ** (5c). ⚠️ Phải viết **đúng chính tả** mới tính đúng.
4. Chi tiết 4 part Speaking: P1 làm theo chỉ dẫn (đặt thẻ đồ vật vào tranh) · P2 hỏi về tranh cảnh
   ("What is this?", "Tell me about …") · P3 hỏi về 4 thẻ đồ vật · P4 hỏi về **bản thân bé**
   (tuổi, gia đình, bạn, trường).
5. **Bản DIGITAL** (quan trọng — app của mình thi trên máy): Listening 5 task / 20 câu / tối đa
   40 phút; Reading & Writing 5 task / 25 câu / tối đa 25 phút. Tương tác màn hình: chọn 1/3,
   kéo–thả, tô màu bằng số, gõ 1 từ. ⇒ **RubyLingo đi theo cấu trúc Digital**, không phải giấy.
6. **Digital Speaking VẪN thi trực tiếp với giám khảo người thật.** ⇒ đây là phần **duy nhất
   không thể mô phỏng trung thực trên web**.
7. Word list chính thức: **~490–510 mục** (đếm thật trên bản 2025: 508 dòng, gồm ~20 tên riêng)
   + bảng chữ cái + số 1–20, nhóm theo **11 chương tranh** (my body, at the zoo, clothes shop,
   birthday/family, food, home, school, beach, street…) và theo thematic list.
8. Kết quả: 1 khiên = còn yếu; **5 khiên = rất tốt**; 4–5 khiên mỗi kỹ năng ⇒ sẵn sàng lên cấp kế.
   Không có khái niệm trượt. Có Statement of Results bản song ngữ tiếng Việt.
9. ⚠️ **Bản quyền:** wordlist/picture book © 2025 Cambridge; sample papers © 2024. **KHÔNG được
   copy nguyên văn wordlist, đề, ảnh, audio vào app.** Chỉ dùng để **đối chiếu phạm vi từ vựng**
   và **học dạng bài**. Đề của RubyLingo phải **tự soạn**.
10. ⚠️ **RubyLingo KHÔNG phải kỳ thi Cambridge.** Kết quả trong app **không có giá trị chứng nhận**.
    Phải ghi rõ điều này trong UI và không dùng nhãn/huy hiệu của Cambridge.

---

## 3. PHẦN A — Phủ game cho mọi chủ đề

### 3.1 Hiện trạng (số liệu thật, đọc trực tiếp JSON)

| Chỉ số | Giá trị |
|---|---|
| Chủ đề / bài / từ / exercise | 11 / 43 / 275 / **73** |
| Chủ đề có đủ **5/5** loại game MVP | **1** — `at-the-zoo` (3 bài × 5 game = 15 exercise) |
| Chủ đề **chỉ có mỗi `memory_match`** | **10** — my-body, at-the-clothes-shop, my-friends-birthday, my-favourite-food, at-home, at-school, at-the-beach, my-street, alphabet, numbers-1-20 |
| Bài ngoài `at-the-zoo` chỉ có **1 loại** game | **40 / 40 bài** |

`listen_tap`, `prepositions`, `word_picture` hiện **chỉ tồn tại trong `at-the-zoo`**.

### 3.2 Vì sao cần 5 loại chứ không phải 1

Mỗi loại dạy một kỹ năng khác nhau, không thay thế nhau:

| Game | Kỹ năng bé luyện |
|---|---|
| `listen_tap` (Nghe & Chạm) | Nghe từ tiếng Anh → chạm hình đúng |
| `missing_letter` (Điền chữ cái) | Chính tả / nhận diện mặt chữ |
| `prepositions` (Thú cưng trốn ở đâu?) | Nghe câu → hiểu vị trí (in/on/under/next to/behind/between) |
| `memory_match` (Lật thẻ ghi nhớ) | Ghi nhớ + liên kết từ ↔ nghĩa/hình |
| `word_picture` (Nối từ với hình) | Đọc từ → nối hình (đọc hiểu nghĩa) |

Chỉ có `memory_match` ⇒ bé chỉ luyện **một** kỹ năng. Đó đúng là hiện trạng 10/11 chủ đề.

### 3.3 Ngoại lệ **có lý do dữ liệu** (không phải lười)

- `alphabet` (4 bài) và `numbers-1-20` (3 bài): **0 từ `picturable`** trên toàn bộ 7 bài. Validator
  **V11** yêu cầu game dạng hình (`listen_tap`, `word_picture`, `memory_match(en_icon)`) phải có
  **≥ 4 từ `picturable`** ⇒ **bất khả thi về dữ liệu**. `prepositions` không hợp ngữ nghĩa với chữ
  cái/chữ số. Trần thực tế = **2 loại**: `memory_match(en_vi)` (đang có) + `missing_letter`.
- `my-friends-birthday/l3`: chỉ **3** từ vẽ được (`boy`, `girl`, `family`; `miss`, `mr` không vẽ
  được) ⇒ bài này trần **3 loại**.
- 7 bài ở mức "vừa đủ" 4 picturable: my-body/l1, birthday/l4, food/l4, school/s3, school/s4,
  street/m2, street/m3 — vẫn mở được game hình nhưng **sát ngưỡng**, cần test kỹ khi làm.
- `my-body` (bộ phận cơ thể) không hợp ngữ nghĩa với `prepositions` ⇒ chủ đề này sàn **4 loại**.

### 3.4 Ma trận mục tiêu

| Chủ đề | listen_tap | missing_letter | prepositions | memory_match | word_picture | Loại sau |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| at-the-zoo | • | • | • | • | • | 5 (đã đạt) |
| my-body | ✓ | ✓ | — | • | ✓ | 4 |
| at-the-clothes-shop | ✓ | ✓ | ✓ | • | ✓ | 5 |
| my-friends-birthday | ✓ | ✓ | ✓ | • | ✓ | 5 (l3 = 3) |
| my-favourite-food | ✓ | ✓ | ✓ | • | ✓ | 5 |
| at-home | ✓ | ✓ | ✓ | • | ✓ | 5 |
| at-school | ✓ | ✓ | ✓ | • | ✓ | 5 |
| at-the-beach | ✓ | ✓ | ✓ | • | ✓ | 5 |
| my-street | ✓ | ✓ | ✓ | • | ✓ | 5 |
| alphabet | — | ✓ | — | • | — | 2 (ngoại lệ) |
| numbers-1-20 | — | ✓ | — | • | — | 2 (ngoại lệ) |

**Bước "xương sống" rủi ro thấp nhất:** thêm `missing_letter` cho **mọi bài chưa có** — biến mọi
bài từ 1 → 2 loại, áp dụng được cho **cả** alphabet/numbers, **không** phụ thuộc `picturable`.

### 3.5 Ràng buộc bắt buộc khi thêm exercise

1. **Chỉ khai 5 game có component** trong `src/components/games/shared/registry.ts`. Game chưa có
   component (`word_search`, `number_match`, `say_it`, `word_builder`, `sort_basket`, `count_tap`,
   `colour_learn`) **không được khai** — bấm vào là link chết.
2. **V9**: `exercise.gameType` **phải bằng** `exercise.config.kind`; mọi id trong
   `lesson.exerciseIds` phải trỏ tới exercise tồn tại (và ngược lại).
3. **V11**: game dạng hình cần **≥ 4 từ `picturable`**.
4. **V20**: hợp `wordIds` của mọi exercise trong một bài phải phủ **hết** `lesson.wordIds`.
5. **V7**: 4–8 từ/bài — **không** sửa `lesson.wordIds` để "ép" cho đủ điều kiện.
6. `prepositions` có 2 luật schema (`superRefine`): `correctSlot ∈ slots`, và `sentenceEn` phải
   **chứa** chuỗi `preposition`; chủ ngữ trong `sentenceEn` phải khớp `word.en` của một từ trong
   `wordIds`.
7. Id exercise: `{lessonId}/{game-slug}`; `game-slug` = kebab-case của `gameType`.
8. `memory_match` — **Cập nhật 2026-10-19**: mỗi bài ĐÚNG **một** exercise, `wordIds` = toàn bộ từ
   của bài, `pairs` = số từ. Quy ước cũ "≤ 6 cặp + tách đôi `memory-match`/`memory-match-2`" đã
   **bãi bỏ** (chủ dự án báo bé thấy hai trò "Lật thẻ ghi nhớ" giống nhau). Lưới thẻ canh giữa hàng
   cuối nên số thẻ 10/12/14/16 đều đẹp.
9. `shared/content/content-index.json` là **file dẫn xuất** ⇒ sinh lại bằng
   `npm run gen:content-index -- --apply`, **không sửa tay**.
10. Luật dự án: không câu chữ trách móc; **tiếng Anh chỉ để ĐỌC, tiếng Việt chỉ để HIỂN THỊ**.

---

## 4. PHẦN B — Bài thi cuối khoá Starters

### 4.1 Cổng mở khoá — định nghĩa chính xác

Mở khi **và** chỉ khi:

- **(A)** **MỌI bài** của **MỌI chủ đề** trong `level.themeIds` có `LessonProgress.completed === true`; **và**
- **(B)** **MỌI exercise "chơi được"** (`isGamePlayable`) có `GameResultSummary.bestStars >= 1`.

⭐ Đọc từ `snapshot.lessons` + `snapshot.results`, **KHÔNG** đọc số tổng hợp
(`ThemeProgress.lessonsCompleted`) — vì số tổng hợp chỉ có sau khi đồng bộ: bé chơi offline xong bài
cuối sẽ thấy cổng vẫn khoá (bài học này đã trả giá ở `shared/theme-access.ts:36-43`).

**Ca biên:**
- Chủ đề 0 bài / 0 game ⇒ **bỏ qua**, không khoá, không hiện "0/0".
- Offline / chưa hydrate xong ⇒ cổng ở trạng thái **trung tính** ("đang kiểm tra"), **không** báo
  còn thiếu — tránh mắng oan.
- **Q1 (cần chốt):** khi Phần A thêm game cho 10 chủ đề, ngưỡng (B) sẽ nâng lên. Mặc định đề xuất:
  chấp nhận, nhưng **bé đã có kết quả thi thì luôn vào được** kể cả sau khi thêm game.

### 4.2 Hàm thuần dùng chung (khuôn `theme-access.ts`)

`shared/final-test-access.ts`

```ts
resolveFinalTestAccess(
  themes: readonly ThemeMapItem[],
  snapshot: ProgressSnapshot,
  playedExerciseIds: ReadonlySet<string>,
): FinalTestAccess
```

`FinalTestAccess = { kind: 'locked' | 'ready'; enterable: boolean; requirement: FinalTestRequirement | null; … }`
— `FinalTestRequirement` noi khuôn `ThemeRequirement` (`shared/theme-access.ts:64`) để UI dùng lại
đúng cách hiện câu "còn thiếu gì". Hàm thuần ⇒ test trực tiếp được, client và server **cùng đọc một
luật** (giống `theme-access.ts`).

### 4.3 Mô hình dữ liệu — chọn JSON tĩnh MỚI (không mở rộng `Exercise`)

`src/data/levels/starters/final-test/{manifest,listening,reading-writing,speaking}.json`

- **Bác bỏ** phương án mở rộng `Exercise`: nhét bài thi vào `lesson_progress` / `game_result` sẽ
  **làm bẩn** tiến độ bài học, nhiệm vụ, huy hiệu và chip "trò chơi đã chơi" — những thứ đang chạy
  đúng. Bài thi là **miền riêng**, xứng đáng có bảng riêng.
- Id: `starters.final-test.<section>.p<part>.q<n>`.
- Schema zod mới: `finalTestManifestSchema`, `finalTestSectionFileSchema` (discriminated union theo
  `interaction`).
- Validator thêm **V21–V27**, trong đó **V27** chặn chuỗi nhận dạng Cambridge trong đề (chống lẫn
  nội dung có bản quyền vào build).
- `gen:content-index` thêm khối `finalTest` + `requiredExerciseIds` cho server.

### 4.4 Ánh xạ đề thi → tương tác trong app

| Phần thi (Digital) | Dạng bài | Tương tác RubyLingo | Component |
|---|---|---|---|
| **Listening** P1–P3 (15c) | nối tên↔tranh · nghe viết tên/số · chọn tranh A/B/C | chạm · gõ ngắn · chọn 1/3 | `listen_tap` + **ChoosePicture** (mới) |
| **Listening** P4 (5c) | nghe và tô màu | tạm thay bằng chọn tranh | **ChoosePicture** (mới) |
| **Reading & Writing** P1 (5c) | tick/cross đúng–sai | chạm 2 nút | **TickCross** (mới) |
| **R&W** P2 (5c) | viết yes/no | chạm 2 nút | **YesNo** (mới) |
| **R&W** P3 (5c) | xếp chữ cái thành từ | chạm chữ cái | ✅ `missing_letter` (đã có) |
| **R&W** P4 (5c) | cloze chọn từ | chọn từ ở khung | **GapFill** (mới) |
| **R&W** P5 (5c) | trả lời 1 từ về truyện tranh | gõ 1 từ | **GapFill** (mới) |
| **Speaking** 4 part | nói với giám khảo | **không chấm tự động** | xem §4.7 |

⇒ 5 game MVP hiện có phủ **3/4** dạng Listening và **1/5** dạng Reading & Writing. Cần **4
component mới tối giản**: `TickCross`, `YesNo`, `GapFill`, `ChoosePicture` (mỗi cái chỉ là 2–4 nút
hoặc 1 ô nhập — không phải engine nặng).

### 4.5 Thang "khiên" 1–5

`shared/final-test-scoring.ts` → `shieldsForSection(correctFirstTry, total): 1 | 2 | 3 | 4 | 5`

- **SÀN = 1 tuyệt đối** — không bao giờ 0 khiên (giữ luật "không bao giờ 0/1 sao oan" của dự án).
- Thang theo **tỉ lệ đúng + số lỗi**, mượt, noi khuôn `STAR_MAX_ERRORS` đang dùng cho game.
- Lưu theo **MAX** (thành tựu không bao giờ giảm). **Làm lại vô hạn.**
- **Không đỗ/trượt, không xếp hạng, không hẹn giờ.**
- Hiển thị cho bé 7+: "Con được **4 ⛨** phần Nghe!" + hình ảnh; báo cáo cho phụ huynh theo từng kỹ
  năng (nối vào `reports.ts` hiện có).
- **Q6:** không cần chốt cứng ngưỡng trước khi code — tinh chỉnh bằng dữ liệu chơi thật.

### 4.6 Luồng UX

- Route mới: `/final-test` · `/final-test/:section` · `/final-test/certificate`.
- **Không thêm mục vào BottomNav** (đang có trần 5 mục) ⇒ vào từ **thẻ "🎓 Khu vực thi"** trên
  JourneyMap, chỉ hiện khi cổng đã mở (trước đó hiện trạng thái "còn thiếu gì" như thẻ chủ đề khoá).
- **Chia 3 phiên** (Nghe / Đọc–Viết / Nói) — bé 7+ **không** nên làm liền 45 phút. Lưu tiến độ
  **từng câu** để bé nghỉ giữa chừng vẫn làm tiếp.
- Lưu ở **localStorage bắt buộc** + **server khuyến nghị** (xem Q2).
- Kết quả cuối: màn "Chứng nhận" trong app + huy chương tốt nghiệp.

### 4.7 Speaking — xử lý trung thực

**Digital Speaking vẫn thi với giám khảo người thật ⇒ không thể mô phỏng trung thực trên web.**

Đề xuất:
- Bé **nghe mẫu en-GB** rồi **tự nói theo**, bấm "🎤 Nói rồi".
- **KHÔNG ghi âm** (COPPA/GDPR-K — dự án chỉ lưu biệt danh + tuổi + avatar).
- **Không chấm phát âm tự động.** Không máy nào chấm đúng phát âm trẻ 7+ ⇒ chấm sai sẽ làm bé
  thất vọng — đúng thứ dự án cấm.
- Ghi rõ trong UI: *"Trò này bé tự luyện nói. RubyLingo không phải kỳ thi Cambridge và kết quả ở
  đây không có giá trị chứng nhận."*
- **Q3 (cần chốt):** mặc định = bé tự nói + ghi nhận hoàn thành; phụ huynh xác nhận là **tuỳ chọn
  bật** trong màn Phụ huynh.

### 4.8 Server & dữ liệu

| Hạng mục | Đề xuất |
|---|---|
| API | `GET /api/children/:id/final-test` · `POST …/final-test/:section/submit` · `PUT …/final-test/progress` |
| Payload | **chỉ sự thật thô** (`answers[]`, `totalRounds`, `clientEventId`, `occurredAt`) — **không có** trường `shields`. Server chấm lại toàn bộ |
| Service | `FinalTestService` tái dùng `XpService.addXpInTx` + `RewardService` + `QuestService` + `BadgeService` + `ProgressService`, **trong 1 transaction**, badge đi **cuối** |
| Chống gian lận | server tự kiểm điều kiện mở khoá, trả mã lỗi mới `FINAL_TEST_LOCKED`; client không tự khai điểm/sao/khiên |
| Idempotency | theo `clientEventId` (khi `changes === 0` thì đọc lại hàng cũ — noi `GameResultService.ts:37-42`) |
| Migration | **`013_final_test.sql`** (số tiếp theo sau `012_room_placement.sql`): `final_test_attempt` với `CHECK (shields BETWEEN 1 AND 5)` + `client_event_id UNIQUE`; thêm bảng nhỏ `final_test_progress` nếu Q2 = CÓ |

### 4.9 Phần thưởng

- **Huy chương tốt nghiệp** `badge-starters-graduate` — mở rộng `BadgeCriteria` (trong
  `shared/types/reward.ts:244`) thêm `{ kind: 'complete_final_test' }`.
- Sticker + quest mốc `qm-07` (thêm vào `shared/content/quests.json`).
- ⭐ / 🌰 / XP trao **1 LẦN** ở lần hoàn thành đầu (tránh farm — **Q4**).
- **Không trừ gì của bé** — chỉ cộng thêm. "Chứng nhận" render **trong app** (chưa xuất PDF — Q7).

---

## 5. Lộ trình thực hiện (7 giai đoạn)

Mỗi giai đoạn **phải kết thúc bằng lệnh kiểm chứng**, không nhận "đã xong" bằng lời.

| GĐ | Việc | File tạo/sửa | Nghiệm thu |
|---|---|---|---|
| **G1** | **Xương sống**: thêm `missing_letter` cho 40 bài chưa có (mọi chủ đề, kể cả alphabet/numbers) | `src/data/levels/starters/themes/*.json`, rồi `npm run gen:content-index -- --apply` | `npm run validate:content` = 0 lỗi; mỗi bài ≥ 2 loại game |
| **G2** | Thêm `listen_tap` + `word_picture` cho các bài **≥ 4 picturable** (bỏ `my-friends-birthday/l3`, alphabet, numbers) | như trên | validator xanh; `picturable` từng bài kiểm lại |
| **G3** | Thêm `prepositions` cho các bài hợp ngữ nghĩa (câu mẫu tự soạn, tự soạn chủ ngữ theo `word.en`) | như trên | 2 luật `superRefine` của `prepositions` phải qua |
| **G4** | **Nội dung bài thi + schema + validator** V21–V27 + `gen:content-index` khối `finalTest` | `src/data/levels/starters/final-test/*.json`, `shared/schemas/final-test.ts`, `scripts/validate-content.ts`, `scripts/gen-content-index.ts` | `npm run validate:content` xanh; V27 chặn được chuỗi Cambridge |
| **G5** | **Luật mở khoá + thang khiên + 4 component mới** | `shared/final-test-access.ts`, `shared/final-test-scoring.ts`, `src/components/final-test/*` | unit test: hàm thuần (ca biên offline/0 bài) + scoring sàn 1 |
| **G6** | **Server + migration 013 + thưởng** | `server/services/FinalTestService.ts`, `server/routes/final-test.ts`, `server/db/migrations/013_final_test.sql`, `shared/content/{badges,quests}.json` | test route qua `app.inject()`; rollback test; idempotency |
| **G7** | **UX/route + E2E + tài liệu** | `src/pages/finalTest/*`, `src/pages/JourneyMapPage.tsx`, i18n, `docs/` | `npm run ci` xanh; Playwright: luồng khoá → mở → làm → kết quả |

**Lệnh kiểm chứng bắt buộc:**
`npm run validate:content` · `npm run gen:content-index -- --apply` · `npm run ci` (typecheck + lint +
validator + index + theme-colors + **1486 test** có kiểm đếm) · `npx playwright test` (E2E).

> **Lưu ý thứ tự:** nên làm **G1–G3 (Phần A)** trước **G4–G7 (Phần B)**, vì cổng mở khoá của bài
> thi phụ thuộc tập exercise "chơi được" — làm Phần B trước sẽ phải sửa lại ngưỡng.

---

## 6. Rủi ro & cách xử lý

| Rủi ro | Mức | Cách xử lý |
|---|---|---|
| Thêm game làm **nâng ngưỡng mở khoá** ⇒ bé đã gần đủ bỗng thấy cổng khoá lại | Trung bình | Mặc định Q1: đã có kết quả thi ⇒ luôn vào được |
| 4 component mới có thể **lệch chuẩn giao diện** (chữ ≥ 16px, chạm ≥ 64px, token màu) | Trung bình | Dùng `src/styles/tokens.css`; test responsive 320×640 như G4 đã làm |
| **Bản quyền Cambridge** | **Cao** | Đề **tự soạn**; `manifest.source = 'original'` **bắt buộc**; V27 chặn chuỗi nhận dạng; ghi chú trong schema và trong UI |
| Bé hiểu lầm đây là **thi thật** ⇒ áp lực | Trung bình | Không đỗ/trượt, không hẹn giờ, không xếp hạng; câu chữ hướng trẻ; ghi rõ "không phải kỳ thi Cambridge" |
| Thang khiên bị **chấm sai** (chấm Speaking bằng máy) | Cao | Không chấm tự động phần Nói (§4.7) |
| `Validate:content` **thêm luật mới** có thể vỡ dữ liệu cũ | Thấp | Thêm luật ở G4, chạy validator ngay; luật cho bài thi tách khỏi luật nội dung học |
| Migration trên **DB thật** | **Cao** | Chỉ viết migration; **không** tự chạy trên `data/rubylingo.db`; test trên DB cách ly; backup trước khi lên production |

---

## 7. Quyết định cần chủ dự án chốt

| # | Câu hỏi | Khuyến nghị mặc định |
|---|---|---|
| Q1 | Phần A thêm game ⇒ ngưỡng "chơi hết" nâng lên. Bé đã thi có bị khoá lại không? | **Không** — đã có kết quả thì luôn vào được |
| **Q2** | Lưu tiến độ **đang làm dở** của bài thi lên **server** (đổi máy làm tiếp)? | **CÓ** (migration 013 thêm bảng nhỏ). Nếu không: chỉ localStorage |
| **Q3** | Phần **Nói**: bé tự nói, hay chờ phụ huynh xác nhận? | Bé **tự nói** + ghi nhận hoàn thành; phụ huynh xác nhận = tuỳ chọn |
| **Q4** | Thưởng ⭐/🌰/XP mỗi lần làm lại, hay chỉ lần đầu? | **Chỉ lần đầu** (tránh farm) |
| **Q5** | Listening P4 (tô màu): làm engine tô màu, hay thay bằng chọn tranh? | **Thay bằng chọn tranh** ở GĐ đầu; làm engine tô màu sau nếu muốn |
| Q6 | Có cần chốt cứng ngưỡng khiên trước khi code? | **Không** — chỉnh bằng dữ liệu chơi thật |
| Q7 | Xuất **PDF "Chứng nhận"** để in? | **Chưa** — cần rà lại bản quyền/nhãn hiệu trước |

---

## 8. Trạng thái & bước tiếp theo

- **Chưa có thay đổi code/dữ liệu nào** cho Phần A và Phần B. Toàn bộ nội dung trên là **kế hoạch**.
- 4 tài liệu kế hoạch/nghiên cứu đã nằm trong `docs/` và **chưa commit** (repo đang có nhiều thay
  đổi chưa commit từ các việc trước — cần rà trước khi push).
- **Sau khi chủ dự án chốt Q1–Q7**, việc tiếp theo là chạy **G1** (thêm `missing_letter` cho 40
  bài) rồi kiểm chứng bằng `npm run validate:content`.
