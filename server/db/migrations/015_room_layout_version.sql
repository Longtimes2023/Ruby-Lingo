-- 015 — Gắn phiên bản bố cục phòng cho từng vị trí đã lưu.
--
-- LÝ DO: bố cục mặc định 10 món trang trí đã đổi mạnh (món to lên và đổi chỗ). Vị trí bé đã KÉO
-- TAY từ trước được lưu theo bố cục CŨ, nên nếu vẫn đọc lên nguyên xi thì phòng của bé sẽ chồng
-- chéo so với bố cục mới. Cột này cho phép `RoomService.getPlacements` BỎ QUA (không xoá) những
-- dòng thuộc phiên bản cũ ⇒ bé thấy bố cục mặc định mới, và lần kéo tiếp theo ghi version mới.
--
-- DEFAULT 0 = "trước khi có khái niệm version" — mọi dòng đã tồn tại (nếu có) đều là bố cục cũ.
-- Dùng ALTER TABLE ... ADD COLUMN (KHÔNG dựng lại bảng) để chạy được trên DB đã có dữ liệu thật.
ALTER TABLE room_decoration_placement ADD COLUMN layout_version INTEGER NOT NULL DEFAULT 0;
