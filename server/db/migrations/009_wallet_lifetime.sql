-- =============================================================================
-- 009 — WALLET: hai cột "TỔNG ĐÃ KIẾM" (nguồn dữ liệu cho huy hiệu `earn_currency`)
-- =============================================================================
-- ⭐ VÌ SAO CẦN HAI CỘT MỚI, KHI ĐÃ CÓ `stars`/`acorns` VÀ `daily_stats`:
--
--   Huy hiệu `earn_currency` ("Kiếm được 1000 Sao", "Kiếm được 50 Hạt dẻ") phải đo
--   **TỔNG ĐÃ KIẾM TRONG CẢ ĐỜI**, không phải số dư hiện có.
--
--   ⚠️⚠️ KHÔNG ĐƯỢC ĐO BẰNG `wallet.stars`/`wallet.acorns` — đó là SỐ DƯ, và số dư TỤT khi bé
--   tiêu. Huy hiệu là SƯU TẦM: đã đạt là VĨNH VIỄN (xem `005_collect.sql`, `shared/types/reward.ts`).
--   Nếu đo bằng số dư thì bé kiếm đủ 1000 ⭐, nhận huy hiệu, rồi mua một món 200 ⭐ ⇒ số dư về 800
--   ⇒ tiêu chí không còn đúng. Hai hậu quả, cả hai đều sai:
--     • nếu `BadgeService` chỉ trao MỘT LẦN thì bé đã có huy hiệu (đúng), nhưng bất kỳ lần đọc
--       lại nào suy từ số dư cũng sẽ nói "chưa đạt" — hai câu trả lời cho một sự thật;
--     • nếu ai đó "sửa" bằng cách trao lại mỗi lần đạt thì bé bị ăn mừng lặp vô hạn.
--   Cách duy nhất sạch: lưu một con số CHỈ TĂNG, không bao giờ giảm.
--
--   ⚠️ VÌ SAO KHÔNG DÙNG `SUM(daily_stats.stars_earned)`: đúng là bảng đó có ghi số ⭐ kiếm mỗi
--   ngày, nhưng nó KHÔNG phải một "tổng luỹ kế": muốn biết tổng phải quét TOÀN BỘ lịch sử mỗi
--   lần đánh giá huy hiệu, và con số đó phụ thuộc vào việc mọi nguồn thưởng trong tương lai có
--   nhớ ghi `daily_stats` hay không. Một cột luỹ kế, tăng ở ĐÚNG MỘT chỗ, không có hai nhược
--   điểm đó.
--
--   ⚠️ VÀ VÌ SAO KHÔNG SUY TỪ `progress_event`: bảng đó ghi TỪ VỰNG/BÀI HỌC, không ghi tiền.
--
-- ⭐ CHỖ TĂNG CON SỐ: `RewardService.addCurrencyInTx` — điểm nghẽn DUY NHẤT cộng tiền trong toàn
--    hệ thống (mọi nguồn thưởng — lượt chơi, quà nhiệm vụ, quà lên cấp — đều đi qua đó). Sửa
--    MỘT chỗ nghĩa là mọi đường cộng tiền trong tương lai cũng tự động được tính, không cần ai
--    nhớ thêm gì. `spendInTx` (nơi tiêu tiền) CỐ TÌNH không đụng tới hai cột này.
--
-- ✅ `ALTER TABLE ADD COLUMN` là thao tác CHỈ THÊM, không dựng lại bảng ⇒ không đụng dữ liệu đang
--    có. `DEFAULT 0` khiến mọi hàng cũ hợp lệ ngay. `CHECK (>= 0)` giữ cùng văn phong với
--    `stars`/`acorns` ở `004_reward.sql`: không có cột nào trong ví cho phép giá trị âm.
--    (Migration runner — `server/db/migrate.ts` — chạy CẢ tệp trong MỘT transaction, nên hoặc
--    cả hai cột + phần suy ngược bên dưới cùng thành công, hoặc không cột nào được thêm.)
-- =============================================================================

ALTER TABLE wallet ADD COLUMN stars_earned_total  INTEGER NOT NULL DEFAULT 0 CHECK (stars_earned_total >= 0);
ALTER TABLE wallet ADD COLUMN acorns_earned_total INTEGER NOT NULL DEFAULT 0 CHECK (acorns_earned_total >= 0);

-- -----------------------------------------------------------------------------
-- SUY NGƯỢC GIÁ TRỊ KHỞI TẠO CHO HÀNG CŨ — ĐIỂM PHẢI SUY NGHĨ, KHÔNG CÓ ĐÁP ÁN SẴN
-- -----------------------------------------------------------------------------
-- Hàng `wallet` cũ (tạo trước migration này) sẽ nhận `*_earned_total = 0` theo DEFAULT — SAI, vì
-- thực tế bé đã kiếm được ⭐/🌰 rồi. Con số thật cho quá khứ KHÔNG THỂ phục hồi chính xác (ví
-- chỉ lưu số dư, không lưu lịch sử từng lần cộng/trừ). Đây là ước lượng tốt nhất có thể, ghép từ
-- HAI tín hiệu, lấy giá trị LỚN HƠN:
--
--   • `wallet.stars` — SỐ DƯ hiện tại. Đây là CẬN DƯỚI CHẮC CHẮN: bé không thể giữ nhiều hơn
--     tổng đã kiếm (tiêu chỉ làm số dư giảm). Nó BỎ SÓT phần đã tiêu.
--   • `SUM(daily_stats.stars_earned)` — tiền kiếm theo TỪNG NGÀY. Cộng lại thì lấy về được cả
--     phần đã tiêu, nhưng CHỈ đúng từ lúc bảng đó bắt đầu ghi số thật (trước một thời điểm, cột
--     `stars_earned` toàn số 0 — xem lịch sử T054). Nên nó cũng có thể bỏ sót.
--
-- ⭐ CẢ HAI ĐỀU ≤ TỔNG ĐÃ KIẾM THẬT ⇒ `MAX` của chúng vẫn ≤ giá trị thật. Ta chọn sai theo hướng
--   AN TOÀN: ĐẾM THIẾU. Đếm thiếu nghĩa là huy hiệu "Kiếm được 1000 ⭐" chỉ nổ MUỘN hơn một
--   chút (khi bé kiếm thêm), chứ KHÔNG BAO GIỜ trao oan cho một bé chưa đủ. Chiều ngược lại
--   (đếm thừa) sẽ trao huy hiệu bé chưa xứng đáng — không có đường nào lấy lại.
--   Từ sau migration này, hai cột được cộng chính xác ở mọi lần thưởng nên sai số chỉ còn ở quá
--   khứ, và nó không bao giờ lớn thêm.
-- =============================================================================

UPDATE wallet
SET stars_earned_total = MAX(
      stars,
      COALESCE((SELECT SUM(ds.stars_earned) FROM daily_stats ds WHERE ds.child_id = wallet.child_id), 0)
    ),
    acorns_earned_total = MAX(
      acorns,
      COALESCE((SELECT SUM(ds.acorns_earned) FROM daily_stats ds WHERE ds.child_id = wallet.child_id), 0)
    );
