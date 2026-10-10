# RubyLingo — TRẠNG THÁI BÀI THI CUỐI KHOÁ (phần CLIENT)

> **Loại tài liệu:** TRẠNG THÁI TRIỂN KHAI (Giai đoạn 7 — client; cập nhật Giai đoạn 10) ·
> **Ngày:** 2026-10-10.
> **Phạm vi:** chỉ mô tả phần CLIENT (trang / route / luồng cho bé). Server, nội dung đề, luật mở
> khoá và thang khiên thuộc Giai đoạn 4–6 (đã xong, đã khoá).
> **Thiết kế gốc:** `docs/ke-hoach/thiet-ke-bai-thi-cuoi-khoa.md` (đọc trước tài liệu này).

---

## 1. Route đã có

Đăng ký trong `src/router.tsx`, đều nằm trong **Tầng 3** (`RequireChild` + `AppShell`):

| Route | Trang | Vai trò |
|---|---|---|
| `/final-test` | `src/pages/final-test/FinalTestHomePage.tsx` | Khu vực thi: trạng thái cổng + ba phần + nút chứng nhận khi xong cả ba |
| `/final-test/certificate` | `src/pages/final-test/FinalTestCertificatePage.tsx` | Tổng khiên ba phần + huy chương tốt nghiệp + lời khen |
| `/final-test/:section` | `src/pages/final-test/FinalTestSectionPage.tsx` | Chơi MỘT phần (`listening`/`reading-writing`/`speaking`) |

⚠️ **KHÔNG thêm mục vào `BottomNav`** — 5 mục là trần của dự án. Điểm vào là thẻ **"🎓 Khu vực thi"**
ở cuối `JourneyMapPage` (`src/components/final-test/FinalTestGatewayCard.tsx`).

`react-router` v6 xếp đoạn **tĩnh** cao hơn đoạn **động**, nên `/final-test/certificate` không bao giờ
khớp `/final-test/:section`.

---

## 2. Ba endpoint đang dùng (client gọi)

Định nghĩa ở `src/api/endpoints.ts` → `finalTestApi`; DTO ở `shared/types/final-test.ts`;
schema ở `shared/schemas/final-test-api.ts`.

| Method | Đường dẫn | Việc |
|---|---|---|
| `GET` | `/api/children/:id/final-test` | Trạng thái cổng (`gate`) + tiến độ dở + khiên cao nhất từng phần |
| `POST` | `/api/children/:id/final-test/:section/submit` | Nộp MỘT phần. Body **chỉ sự thật thô** (`clientEventId`, `occurredAt`, `answers[]`) — server tự chấm khiên (B4) |
| `PUT` | `/api/children/:id/final-test/progress` | Lưu tiến độ đang dở (đổi máy làm tiếp) |

⚠️ Body nộp bài **KHÔNG có** `shields`/`score`/`section` — đó là chủ ý (một sự thật một chỗ khai,
client không tự quyết điểm). Thêm `"shields": 5` vào JSON sẽ bị schema cắt bỏ.

---

## 3. Thẻ cổng ở bản đồ hành trình — ba trạng thái

`FinalTestGatewayCard` đọc `GET .../final-test` qua `useFinalTestGate()` và KHÔNG tự tính lại luật
mở khoá (server là nguồn chân lý):

| `gate.kind` | Thẻ hiện gì | Bấm được? |
|---|---|---|
| `locked` | số **bài còn thiếu** hoặc số **trò chơi chưa thử** (câu hướng dẫn trẻ) | Không (là `<div>`) |
| `ready` / `done` | tổng khiên (nếu đã thi) | **Có** — `<Link>` vào `/final-test` |
| `pending` (chưa đồng bộ) | **"Đang kiểm tra..."** — TUYỆT ĐỐI không nói còn thiếu | Không |
| chưa đọc được (đang tải / **mạng lỗi** ⇒ `state = null`) | **"Đang kiểm tra..."** — trung tính | Không |

⭐ Lý do `pending`/mạng-lỗi phải TRUNG TÍNH: khi offline, dữ liệu "đã chơi" có thể trống; báo
"còn 20 trò nữa" cho một bé đã chơi hết là MẮNG OAN.

---

## 4. Lưu tiến độ (local + server) và chịu lỗi mạng

`src/store/finalTestSession.ts`:

- **localStorage (BẮT BUỘC)** — khoá `rubylingo:finaltest:{childId}:{section}`, lưu
  `{ version, answers: [{ itemId, value, firstTry, wrongAttempts }], clientEventId }`, ghi **sau MỖI câu**.
  Khoá có `childId` ⇒ hai bé cùng máy không thấy tiến độ của nhau. Bản ghi hỏng/phiên bản lạ ⇒ coi như rỗng.
- **server (nền, debounce 900ms)** — gom nhiều câu rồi `PUT .../progress` một lần với `{itemId, value}`.
  ⚠️ Lỗi mạng chỉ ghi `console.warn`, **KHÔNG chặn bé, KHÔNG hiện lỗi kỹ thuật**; bản cục bộ giữ nguyên.
- **`clientEventId` cũng được lưu xuống máy** ⇒ lần gửi lại sau khi mất phản hồi dùng LẠI mã cũ ⇒
  server coi là trùng (`duplicate: true`) và không ghi thêm lần thi.

**Vào lại một phần đang dở:** trang tự làm tiếp từ câu kế (đọc bản trong máy; nếu máy trống thì dựng
lại từ `progress` server trả về — đổi máy làm tiếp). Hiện dòng "Mình làm tiếp nhé!".

**Nộp phần:** khi đã trả lời đủ số câu ⇒ `POST .../submit` **đúng một lần** (`clientEventId` cố định).
Kết quả hiện **khiên 1–5** (🛡️ + `aria-label`) + câu khen hướng trẻ; KHÔNG "đỗ/trượt", KHÔNG hiện % đúng.
Nếu nộp lỗi: hiện kết quả TẠM (tính bằng đúng hàm dùng chung `shieldsForSection`/`shieldsForSpeaking`) +
câu "Chưa gửi được kết quả. Bé bấm thử lại nhé!" + nút **Thử lại**; KHÔNG lộ mã lỗi kỹ thuật.

**Phần Nói:** màn "nghe mẫu tiếng Anh → bé tự nói → bấm 🎤 Nói rồi!"; **không micro, không ghi âm,
không chấm tự động**; hiện dòng miễn trừ *"RubyLingo không phải kỳ thi Cambridge..."*.

---

## 5. Hình của hai dạng câu tranh (Giai đoạn 10)

Trước đây hai dạng câu dưới đây chỉ hiện **NHÃN CHỮ** (hoặc không hình). Nay `choose_picture` hiện
**ảnh minh hoạ từ vựng đã có sẵn**; `story_answer` hiện **tranh truyện** — có sinh MỘT tranh truyện
(`story-park`) bằng AI cho mục đích này. KHÔNG tải ảnh từ mạng.

### `choose_picture` (Listening P3/P4) — chọn 1 trong 3 TRANH

- **Hình dạng THẬT của đề:** `options` là **MẢNG CHUỖI tiếng Anh** (`["kite","balloon","boat"]`),
  **KHÔNG** phải `wordId`. Đề hiện **không** dùng `imageKeys` (schema có cho phép nhưng nội dung không có).
- **Cách làm:** mỗi lựa chọn được TRA TỪ theo chữ (`en`) qua `src/components/final-test/optionWords.ts`
  (`buildWordsByEn` / `findWordForOption`), rồi vẽ bằng `WordIcon` (tái dùng `wordAssetUrlOrNull`).
  KHÔNG tự ghép `starters.<chữ>` — `orange-n` (quả) và `orange-adj` (màu) cùng viết "orange", ghép
  chuỗi sẽ gán nhầm hình; khoá MƠ HỒ bị loại khỏi bảng tra.
- **Hiển thị:** nút `PictureChoice` = **CHỈ HÌNH** của từ (khung `.wi-frame`/`.wi-fill`) + `aria-label`
  tiếng Việt (`"kite — cái diều"`) cho trình đọc màn hình (ảnh là `aria-hidden`).
  ⚠️ **KHÔNG hiện mặt chữ tiếng Anh** dưới hình (cố ý): đây là bài NGHE — hiện chữ thì bé đọc-đối-chiếu
  thay vì nghe, phá mục tiêu. Cùng lý do `listen-tap` không hiện chữ dưới hình.
- **Luật trả lời KHÔNG đổi:** vẫn `submit(option)` với ĐÚNG chuỗi của đề; `answer`/khiên không đụng.

### `story_answer` (Reading P5) — trả lời 1 từ về truyện

- **Hình dạng THẬT:** có `wordId` (bắt buộc) + `imageKey: "story-park"` cho CẢ 5 câu + `answer` = từ mục tiêu.
- **Cách làm:** hiện **TRANH TRUYỆN** theo `imageKey` (`public/assets/scenes/story-park.webp`) phía trên
  câu hỏi; ô nhập 1 từ giữ nguyên.
- ⚠️⚠️ **KHÔNG hiện hình của ĐÁP ÁN (`wordId`)** — đó là câu "viết 1 từ": vẽ sẵn hình đáp án thì bé chỉ
  việc chép lại hình, mất hẳn giá trị kiểm tra. Giai đoạn 10 từng thử hiện hình từ mục tiêu rồi **GỠ**;
  test `final-test-components.test.tsx` canh bất biến "không vẽ hình đáp án" chống tái phát.
- **Tranh `story-park`:** sinh bằng AI (khung cảnh công viên — cây, ghế đá, bãi cỏ, bầu trời; KHÔNG
  người/kite/chữ/logo để không lộ đáp án), 1280×853 WebP (~161 KB).

### Chống ảnh vỡ (bắt buộc, đã kiểm bằng test)

- Từ **chưa có asset** ⇒ `WordIcon` trả **EMOJI** (`word.icon`), KHÔNG render `<img>`.
- Chuỗi lựa chọn **không tra được từ** ⇒ hiện CHUỖI của đề làm chữ, KHÔNG vẽ ảnh.
- Tranh truyện **thiếu tệp** ⇒ `sceneAssetUrlIfExistsOrNull` (src/data/scene-assets.ts) trả `null` ⇒
  KHÔNG vẽ ảnh. Danh sách khoá tranh cảnh khớp đĩa được test `scene-assets.test.ts` ép (lệch ⇒ ĐỎ).
- Test `final-test-components.test.tsx` canh: `choose_picture` có/không asset tương ứng `<img>`/emoji;
  `story_answer` KHÔNG vẽ hình đáp án, vẽ tranh truyện khi có, không vẽ khi `imageKey` thiếu tệp; và
  DUYỆT MỌI câu `choose_picture` THẬT, khẳng định mọi `<img>` có `src = wordAssetUrlOrNull(id)`.

---

## 6. Điều CHƯA làm (và lý do)

- **Xuất PDF "Chứng nhận":** KHÔNG làm. Cần review bản quyền/nhãn hiệu riêng (Q7) — chưa được duyệt.
  Trang `/final-test/certificate` chỉ render TRONG APP.
- **Khối "Bài thi cuối khoá" ở báo cáo PHỤ HUYNH:** **CHƯA làm.** Hai lý do:
  1. `ReportResponse` (`shared/types/api.ts`) **không có** trường `finalTest`, và hợp đồng
     `FinalTestSectionStatus` hiện **không mang `lastAttemptAt`** (ngày làm) ⇒ muốn hiện "khiên mỗi
     phần + ngày làm" phải SỬA SERVER (`ReportService` + DTO) — ngoài phạm vi Giai đoạn 7 (server đã khoá).
  2. Khu vực phụ huynh nằm sau cổng PIN; thêm một lượt gọi mạng thứ hai ở đó là rủi ro không cần thiết
     khi chưa có hợp đồng dữ liệu đầy đủ.
  ⇒ Ghi nhận LÀ CHƯA LÀM, không nhét bừa một khối nửa vời. Bé vẫn thấy đủ khiên ở `/final-test`.

---

## 7. Tự kiểm chứng

```bash
npx vitest run tests/unit/client          # unit/component cho 3 trang + store + thẻ cổng
npm run ci                                # typecheck + lint + validate:content + index + test
npx playwright test tests/e2e/04-bai-thi-cuoi-khoa.spec.ts   # E2E (chặn API bằng route interception)
```

**Test khoá các bất biến quan trọng** (đọc để biết cái gì đã được canh):
- `tests/unit/client/final-test-gateway-card.test.tsx` — 3 trạng thái cổng; `pending` không nói còn thiếu.
- `tests/unit/client/final-test-pages.test.tsx` — cổng khoá/pending/ready; nộp **đúng một lần**;
  lỗi mạng không lộ chi tiết kỹ thuật; **khôi phục tiến độ dở** từ localStorage; a11y (`min-h-touch`, `text-kid-*`).
- `tests/unit/client/final-test-session-store.test.ts` — lưu/đọc theo `childId`, phiên bản lạ ⇒ rỗng,
  `record` đẩy server đúng `{itemId, value}`, lỗi mạng không ném.
- `tests/unit/client/final-test-components.test.tsx` — **Giai đoạn 10**: `choose_picture` có asset ⇒
  `<img>` đúng `src` + nhãn đọc tiếng Việt; thiếu asset ⇒ emoji + 0 `<img>`; `story_answer` **KHÔNG vẽ
  hình đáp án**, vẽ tranh truyện khi `imageKey` có tệp, không vẽ khi thiếu tệp; **duyệt mọi câu
  `choose_picture` THẬT** khẳng định không `<img>` nào trỏ tới từ thiếu asset.
- `tests/unit/client/scene-assets.test.ts` — danh sách khoá tranh cảnh PHẢI khớp đĩa `public/assets/scenes/`;
  `sceneAssetUrlIfExistsOrNull` trả `null` cho khoá thiếu/rỗng (không ảnh vỡ).

⚠️ Nếu môi trường **không chạy được trình duyệt**, E2E sẽ không chạy — khi đó phải báo TRUNG THỰC là
"chưa chạy được", KHÔNG nói đã xanh (xem báo cáo bàn giao).
