-- =============================================================================
-- 007 — SỔ SỰ KIỆN TIẾN ĐỘ ĐÃ ÁP DỤNG
-- =============================================================================
-- Bảng này tồn tại vì MỘT lý do duy nhất: **chống áp dụng trùng**.
--
-- ⚠️ VÌ SAO KHÔNG DÙNG LẠI `game_result.client_event_id`:
--    Bảng đó ghi NHỮNG LƯỢT CHƠI GAME (có điểm, số sao, thời lượng). Sự kiện tiến độ ở đây
--    là chuyện khác: một câu trả lời đơn lẻ trong flashcard, một từ được đánh dấu đã học.
--    Gộp hai loại vào một bảng sẽ buộc mọi cột của `game_result` phải cho phép NULL, và
--    những ràng buộc `CHECK` đang có (stars BETWEEN 0 AND 3, total_questions >= 0) mất hết
--    ý nghĩa — vì một sự kiện flashcard không có "tổng số câu".
--
-- ⚠️ VÌ SAO CHỐNG TRÙNG Ở SERVER, KHÔNG Ở CLIENT:
--    Kịch bản thật: bé trả lời 20 câu khi mất mạng, hàng đợi gửi lên, server ghi xong nhưng
--    PHẢN HỒI bị mất trên đường về. Client không biết là đã gửi nên gửi lại y nguyên.
--    Client KHÔNG THỂ tự phân biệt "chưa gửi" với "đã gửi nhưng mất phản hồi" — nên nó
--    không thể là bên chống trùng. Chỉ server biết chắc, vì server có sổ.
--
-- `client_event_id` là PRIMARY KEY ⇒ mọi lần gửi lại cùng một mã đều bị từ chối ở tầng
-- ràng buộc, không cần kiểm tra trước (tránh cả khe hở thời gian giữa SELECT và INSERT).
--
-- Bảng này cũng là NHẬT KÝ để truy vết: khi phụ huynh hỏi "sao tiến độ con tôi khác lúc
-- nãy", đây là chỗ duy nhất trả lời được "sự kiện nào đã được áp dụng, lúc nào".
-- =============================================================================

CREATE TABLE IF NOT EXISTS progress_event (
  -- Mã do CLIENT sinh. Xem `createClientEventId` trong `src/services/ProgressService.ts`.
  client_event_id TEXT PRIMARY KEY,
  child_id        TEXT NOT NULL REFERENCES child_profile (id) ON DELETE CASCADE,
  -- 'word_answer' | 'word_learned' | 'lesson_completed'
  kind            TEXT NOT NULL,
  -- Thời điểm SỰ KIỆN xảy ra (do client ghi), KHÔNG phải thời điểm server nhận.
  -- Hai mốc này khác nhau khi bé chơi offline — và khi ấy mốc của client mới là mốc đúng
  -- để so "lần ghi sau thắng".
  occurred_at     TEXT NOT NULL,
  -- Thời điểm server áp dụng. Chỉ dùng để truy vết, không dùng cho luật gộp.
  applied_at      TEXT NOT NULL
);

-- Truy vấn "bé này đã áp bao nhiêu sự kiện, gần đây nhất là khi nào".
CREATE INDEX IF NOT EXISTS idx_progress_event_child ON progress_event (child_id, applied_at DESC);
