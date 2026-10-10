# RubyLingo — TRẠNG THÁI BÀI THI CUỐI KHOÁ (phần CLIENT)

> **Loại tài liệu:** TRẠNG THÁI TRIỂN KHAI (Giai đoạn 7 — client) · **Ngày:** 2026-10-10.
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

## 5. Điều CHƯA làm (và lý do)

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

## 6. Tự kiểm chứng

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

⚠️ Nếu môi trường **không chạy được trình duyệt**, E2E sẽ không chạy — khi đó phải báo TRUNG THỰC là
"chưa chạy được", KHÔNG nói đã xanh (xem báo cáo bàn giao).
