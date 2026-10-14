/**
 * RubyLingo — "chuyển câu SAU KHI tiếng đọc kết thúc" — dùng chung cho MỌI game.
 *
 * ⚠️⚠️ VÌ SAO CÓ TỆP NÀY (mục 6 và 7 chủ dự án báo, 2026-10-14):
 *
 *   Nguyên văn mục 6: *"câu cuối cùng khi trả lời xong, thường nếu có audio đọc từ đó, 1 là mất
 *   một khúc (không hoàn chỉnh), 2 là im re."*
 *   Nguyên văn mục 7: *"đoạn văn được đọc lại chưa xong đã nhảy qua câu khác, câu không hoàn
 *   chỉnh, xem lại thời gian hợp lý."*
 *
 *   NGUYÊN NHÂN — đọc thẳng từ mã cũ: cả 5 game đều chuyển câu bằng một HẰNG SỐ THỜI GIAN CỨNG:
 *
 *       window.setTimeout(() => completeRound(...), 650);   // listen_tap
 *       window.setTimeout(() => completeRound(...), 800);   // missing_letter
 *       window.setTimeout(() => completeRound(...), 900);   // prepositions
 *       completeRound(...);                                 // word_picture, memory_match — CẮT NGAY
 *
 *   Hằng số đó không liên quan gì tới ĐỘ DÀI câu đang đọc. Một từ ngắn đọc hết trong ~500 ms,
 *   nhưng câu "The bookcase is in the box." ở `rate 0.8` cần hơn 2 giây. Chuyển câu ở mốc 900 ms
 *   ⇒ **cắt ngang giữa câu**. Và ở CÂU CUỐI, `completeRound` làm game kết thúc ⇒ `GamePage` gỡ
 *   game khỏi DOM ⇒ `useSpeech({ stopOnUnmount: true })` gọi `stop()` ⇒ phần còn lại của tiếng
 *   đọc biến mất hoàn toàn. Đó chính là "mất một khúc", và khi tiếng chưa kịp phát thì là "im re".
 *
 *   ⭐ CÁCH CHỮA: thay hằng số thời gian bằng CHÍNH tiếng đọc — chờ nó kết thúc, RỒI mới chuyển,
 *     và vẫn giữ một nhịp phản hồi ngắn để bé kịp thấy ô mình chọn sáng lên.
 *
 *   ⚠️ VÌ SAO KHÔNG `await` NGAY TRONG TRÌNH XỬ LÝ CÚ CHẠM: trình xử lý đó phải trả về ngay để
 *     React vẽ trạng thái "đã chọn" (viền xanh, chữ hiện ra). Chờ tiếng đọc xong mới cập nhật thì
 *     bé chạm mà màn hình đứng im 2 giây — tệ hơn hẳn việc chuyển câu sớm.
 *
 *   ⚠️ `waitForSpeech()` (chờ tiếng ĐANG đọc) chứ không `speakAndWait(chuỗi)`: game đã gọi
 *     `speak()` khi bé trả lời đúng rồi. Gọi đọc LẦN NỮA ở đây sẽ khiến bé nghe hai lần liên tiếp.
 *
 *   ⚠️ An toàn khi máy không có giọng đọc / phụ huynh tắt tiếng: `waitForSpeech()` trả về ngay
 *     (không có gì đang đọc), nên game chỉ còn nhịp phản hồi — đúng như hành vi cũ.
 */

/**
 * Chờ tiếng đang đọc xong, rồi chờ thêm `feedbackMs` (để bé thấy phản hồi), rồi gọi `advance`.
 *
 * Trả về hàm HUỶ — gọi khi component bị gỡ để `advance` không chạy sau khi rời màn hình.
 */
export function afterSpeechThen(
  waitForSpeech: () => Promise<void>,
  feedbackMs: number,
  advance: () => void,
): () => void {
  let cancelled = false;
  let timer: number | undefined;

  void (async () => {
    await waitForSpeech();
    if (cancelled) return;
    timer = window.setTimeout(() => {
      if (cancelled) return;
      advance();
    }, feedbackMs);
  })();

  return () => {
    cancelled = true;
    if (timer !== undefined) window.clearTimeout(timer);
  };
}
