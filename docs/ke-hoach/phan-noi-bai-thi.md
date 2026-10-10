# Phần Nói của bài thi cuối khoá — bốn tầng phản hồi (Giai đoạn 8)

> Trạng thái: **đã triển khai** (Giai đoạn 8). Tài liệu này giải thích *vì sao* phần Nói được
> thiết kế như hiện tại, đặc biệt là **vì sao KHÔNG chấm phát âm bằng máy** ở giai đoạn này, và
> **điều kiện kỹ thuật + chi phí** để chấm thật về sau.

Yêu cầu trực tiếp của chủ dự án (2026-10-10):

> *"nếu không ghi âm, không chấm máy thì sao biết giọng có chuẩn không?"*

Đây là câu hỏi đúng. Tài liệu trả lời bằng bốn tầng phản hồi, xếp từ **chắc chắn an toàn** đến
**tuỳ chọn**, và nói thẳng giới hạn của từng tầng.

---

## 1. Bốn tầng (tóm tắt)

| Tầng | Tên | Mặc định | Điều kiện hiển thị | Ghi âm? | Gửi lên server? | Ảnh hưởng khiên? |
|------|-----|----------|--------------------|---------|-----------------|------------------|
| 1 | Nghe mẫu en-GB → bé tự nói → "🎤 Nói rồi!" | LUÔN có | Mọi trình duyệt | Không | Không | Không (chỉ độ tham gia) |
| 2 | "🎧 Máy nghe thử" (Web Speech API) | Opt-in (chỉ khi bấm) | Chỉ khi `hasSpeechRecognition()` = true | Không lưu | **Có** (âm thanh gửi tới nhà cung cấp trình duyệt) | Không |
| 3 | "Nghe lại giọng con" (MediaRecorder) | **TẮT** | Chỉ khi phụ huynh bật cờ + có `MediaRecorder` | Có, **chỉ trong máy** | Không | Không |
| 4 | Phụ huynh xác nhận bằng rubric | LUÔN có (trong khu vực phụ huynh) | Sau cổng PIN | Không | Không (lưu `localStorage`) | Không |

**Hành vi mặc định:** nếu bé không đụng gì tới tầng 2/3, câu Nói vẫn kết thúc **chỉ** khi bé bấm
"🎤 Nói rồi!" — y như trước Giai đoạn 8. Tầng 2/3 không bao giờ tự bật.

---

## 2. Vì sao KHÔNG chấm phát âm bằng máy (ở giai đoạn này)

Ba lý do độc lập, mỗi lý do đủ để không làm:

1. **Chấm sai giọng trẻ em.** Các engine nhận dạng giọng nói được huấn luyện chủ yếu trên người
   lớn. Với bé 7 tuổi nói tiếng Anh (không phải tiếng mẹ đẻ), tỉ lệ nhận sai cao. Nói **đúng** mà
   bị đánh trượt là điều tệ nhất có thể xảy ra trong một app học cho trẻ.
2. **Không có đáp án đúng duy nhất.** Nhiều câu Nói là câu mở ("Tell me about your family.",
   "What colour is the hat?"). Chấm tự động cần một đáp án để so — mà ở đây không có.
3. **Quyền riêng tư trẻ em.** Ghi âm giọng trẻ và gửi lên server là vấn đề COPPA/GDPR-K. Việc này
   cần review pháp lý riêng, không được làm ngầm trong một tính năng game.

Vì vậy phần Nói **chỉ ghi nhận ĐỘ THAM GIA**: bé bấm "Nói rồi!" ⇒ câu này đã xong, khiên phần Nói
tính theo số câu đã làm (`shieldsForSpeaking`), KHÔNG theo chất lượng phát âm.

⚠️ **Câu miễn trừ bắt buộc hiển thị ở mọi màn của khu vực thi:**
*"RubyLingo không phải kỳ thi Cambridge; kết quả ở đây không có giá trị chứng nhận."*
Ẩn câu này là nói dối phụ huynh — không được bỏ.

---

## 3. Tầng 1 — Nghe mẫu rồi tự nói (không đổi)

`src/components/final-test/SpeakPromptGame.tsx`. Bé nghe câu mẫu en-GB (`ItemAudioButton`), tự nói
to, rồi bấm "🎤 Nói rồi!". Không micro, không ghi âm, không chấm.

---

## 4. Tầng 2 — "🎧 Máy nghe thử" (tuỳ chọn)

**Nút chỉ HIỆN khi `hasSpeechRecognition()` trả `true`** (Chrome / Edge / Samsung Internet). Trên
**Safari/iOS và Firefox**, nút bị **ẨN HẲN** — không hiện rồi báo lỗi.

- Dùng Web Speech API với `lang = 'en-GB'`.
- So khớp bằng hàm **THUẦN** `isSpeechMatch()` (`src/lib/speechMatch.ts`) — ngưỡng **RẤT DỄ** vì
  người nói là bé 7 tuổi (chuẩn hoá hoa/thường, bỏ dấu câu, khoảng trắng; cho phép sai vài ký tự;
  cho phép bé chỉ nói từ khoá trong câu dài).
- **Đúng HAI trạng thái hướng trẻ, không bao giờ dùng chữ "sai":**
  - nghe ra ⇒ **"Máy nghe thấy rồi! 🎉"**
  - chưa nghe ra ⇒ **"Máy chưa nghe rõ — bé thử nói to hơn một chút nhé!"**
- **KHÔNG lưu, KHÔNG gửi lên server RubyLingo, KHÔNG ảnh hưởng khiên, KHÔNG hiện điểm/%.**
- UI nói rõ: *"Đây là máy nghe giúp vui, không phải điểm phát âm của bé."*

### ⚠️ Quyền riêng tư của tầng 2 — đọc kỹ

Ở Chrome/Edge, **Web Speech API gửi âm thanh lên máy chủ của nhà cung cấp trình duyệt** để nhận
dạng. Vì vậy nút này là **opt-in**: không tự bật, chỉ chạy khi bé/phụ huynh bấm. Điều này được ghi
trong comment đầu `useSpeechCheck.ts` và trong tài liệu này.

---

## 5. Tầng 3 — "Nghe lại giọng con" (tuỳ chọn, MẶC ĐỊNH TẮT)

Cho phép ghi một đoạn **ngắn** bằng `MediaRecorder` ngay trong máy, **phát lại ngay** cho bé/phụ
huynh nghe, rồi **huỷ bản ghi**.

- **MẶC ĐỊNH TẮT.** Phụ huynh bật cờ `voicePlaybackEnabled` trong khu vực phụ huynh
  (Cài đặt → "Nghe lại giọng con (chỉ trên máy này)"). Cờ lưu **cục bộ** (`settingsStore`),
  **không đồng bộ server**.
- **KHÔNG ghi ra server, KHÔNG ghi vào `localStorage`/IndexedDB, KHÔNG tải file.** Bản ghi chỉ là
  `Blob` + URL tạm trong bộ nhớ, bị thu hồi khi bấm "Xoá" hoặc rời màn hình.
- Nếu trình duyệt không có `MediaRecorder` hoặc bé/phụ huynh từ chối quyền micro ⇒ **ẩn nhẹ nhàng**,
  không báo lỗi kỹ thuật.

### ⚠️ Vì sao mặc định TẮT (quyết định có ý thức)

Trước Giai đoạn 8, chủ dự án đã chốt **"không ghi âm"**. Tầng này KHÔNG lật ngược quyết định đó —
nó tồn tại như một lựa chọn phụ huynh **chủ động**, và bản ghi **không rời khỏi thiết bị**. Ghi lại
đây để người sau biết: mặc định TẮT không phải sơ suất mà là quyết định có ý thức. Đổi mặc định
thành `true` cần hỏi lại chủ dự án.

---

## 6. Tầng 4 — Phụ huynh/giáo viên xác nhận (ĐÁNG TIN NHẤT)

`src/components/final-test/ParentSpeakingChecklist.tsx`, nằm trong khu vực phụ huynh (sau cổng PIN),
mở từ nút **"Xác nhận phần Nói của con"** trong `/parent`.

- Danh sách **4 phần Nói** với **rubric HÀNH VI** (không phải điểm số):
  1. Bé làm theo chỉ dẫn: chỉ vào tranh hoặc đặt đồ vật đúng chỗ khi nghe tiếng Anh.
  2. Bé nói được một câu ngắn về bức tranh.
  3. Bé nói được tên đồ vật khi được hỏi.
  4. Bé trả lời được câu hỏi về bản thân (tuổi, gia đình, sở thích).
- Mỗi mục hai lựa chọn: **"Bé đã làm được"** / **"Mình ôn thêm nhé"** (vế sau là lời mời ôn cùng
  con, KHÔNG phải lời chê). Bấm lại lựa chọn cũ ⇒ bỏ đánh dấu.
- **Lưu cục bộ (`localStorage`), TÁCH THEO TỪNG BÉ** — khoá `rubylingo.parent.speaking-check.<childId>`.
- ⚠️ **CHƯA ĐỒNG BỘ LÊN SERVER.** Đồng bộ cần thêm bảng + route phía server (ngoài phạm vi giai
  đoạn này). UI NÓI THẬT điều đó với phụ huynh (`parent.speakingLocalNote`) — ẩn đi là nói dối họ.

**Đây là cách trả lời trực tiếp câu hỏi của chủ dự án:** người nghe tốt nhất — và duy nhất đáng tin
— là phụ huynh/giáo viên ngồi cạnh bé. Tầng 4 cho họ một rubric để quan sát và xác nhận.

---

## 7. Điều kiện để CHẤM THẬT (P2 — cần chủ dự án duyệt ngân sách)

Chấm phát âm tự động cho trẻ em là **khả thi về kỹ thuật** nhưng cần cả một chuỗi hạ tầng. Đây là
các lựa chọn và cái giá của chúng:

| Giải pháp | Loại | Ghi chú |
|-----------|------|---------|
| **Azure Pronunciation Assessment** | API trả phí | Có chế độ đánh giá theo âm vị + độ trôi chảy; cần gửi audio lên Azure. |
| **SpeechSuper** | API trả phí | Chuyên chấm phát âm học thuật, có hỗ trợ đánh giá trẻ em hơn. |
| **ELSA Speak API** | API trả phí | Chấm theo âm vị, mạnh với người học châu Á. |

Điều kiện kỹ thuật bắt buộc:

1. **Backend nhận audio.** Server RubyLingo hiện KHÔNG nhận file âm thanh. Cần thêm endpoint nhận
   `multipart/form-data`, giới hạn kích thước/thời lượng, và (quan trọng) **không lưu trữ**.
2. **Chi phí mỗi lượt.** Mỗi câu Nói của mỗi bé là một lần gọi API trả phí. Nhân với số bé × số
   lần làm lại ⇒ cần ước lượng ngân sách/tháng trước khi bật.
3. **Rủi ro chấm gắt với giọng trẻ.** Kể cả API "chuyên trẻ em" vẫn có thể cho điểm thấp oan. Nếu
   dùng để chấm điểm chính thức, cần ngưỡng rất rộng + cơ chế "chỉ phụ huynh thấy", và **tuyệt đối
   không** hiện điểm phát âm cho bé dưới dạng con số/điểm.
4. **Quyền riêng tư.** Gửi giọng trẻ lên bên thứ ba cần review pháp lý (COPPA/GDPR-K) + sự đồng ý
   rõ ràng của phụ huynh.

➡️ **Xếp P2.** Không làm ở giai đoạn này. Cần chủ dự án duyệt ngân sách + quyết định pháp lý trước.

---

## 8. Giới hạn trình duyệt (bảng tra nhanh)

| Trình duyệt | Tầng 2 "Máy nghe thử" | Tầng 3 "Nghe lại giọng con" |
|-------------|----------------------|----------------------------|
| Chrome / Edge / Samsung Internet | ✅ Có | ✅ Có (khi phụ huynh bật) |
| Safari / iOS (mọi trình duyệt trên iOS) | ❌ Không | ⚠️ Có thể có, nhưng mic iOS khác biệt |
| Firefox | ❌ Không | ✅ Có (khi phụ huynh bật) |

Nguồn dò: `src/services/SpeechCapability.ts` (`hasSpeechRecognition`, `getSpeechRecognitionCtor`,
`hasMediaRecorder`).

---

## 9. Ghi chú quyền riêng tư (tổng hợp)

- **Tầng 1:** không micro.
- **Tầng 2:** âm thanh tới nhà cung cấp trình duyệt (Chrome/Edge); opt-in; không lưu ở RubyLingo.
- **Tầng 3:** bản ghi ở lại thiết bị; bị xoá khi rời; opt-in; mặc định tắt.
- **Tầng 4:** chỉ lưu nhãn "đã làm được / ôn thêm" trong máy; không có dữ liệu âm thanh.
- **Không tầng nào** gửi dữ liệu tới server RubyLingo hay ảnh hưởng số khiên của bé.

---

## 10. Tệp liên quan

- `src/components/final-test/SpeakPromptGame.tsx` — tầng 1 + 2 + 3 trong một câu Nói.
- `src/components/final-test/useSpeechCheck.ts` — tầng 2 (Web Speech API, en-GB).
- `src/components/final-test/useVoicePlayback.ts` — tầng 3 (MediaRecorder, cục bộ).
- `src/components/final-test/ParentSpeakingChecklist.tsx` — tầng 4 (rubric phụ huynh).
- `src/lib/speechMatch.ts` — hàm thuần so khớp (ngưỡng dễ).
- `src/services/SpeechCapability.ts` — dò khả năng trình duyệt.
- `src/store/settingsStore.ts` — cờ `voicePlaybackEnabled` (mặc định TẮT).
- Test: `tests/unit/client/speech-match.test.ts`, `final-test-speak.test.tsx`,
  `parent-speaking-checklist.test.tsx`; e2e: `tests/e2e/04-bai-thi-cuoi-khoa.spec.ts`.
