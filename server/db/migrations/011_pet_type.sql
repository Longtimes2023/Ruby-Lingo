-- =============================================================================
-- 011 — HỆ THÚ CƯNG: bé CHỌN con đồng hành + bỏ bậc tiến hoá 'egg' (T04)
-- =============================================================================
-- ⭐ HAI VIỆC TRONG MỘT MIGRATION, VÌ CHÚNG CÙNG SỬA MỘT BẢNG:
--   1. Thêm cột `pet_type` — con thú cưng bé chọn (NULL = chưa chọn).
--   2. Bỏ giá trị `'egg'` khỏi CHECK của `evolution_stage` (đổi bậc 0 thành `'baby'`).
--
--   Làm gộp vì cả hai đều phải DỰNG LẠI bảng (SQLite không sửa được CHECK tại chỗ). Tách ra
--   thành hai migration nghĩa là dựng lại bảng hai lần cho cùng một kết quả — thêm rủi ro mà
--   không thêm giá trị.
--
-- -----------------------------------------------------------------------------
-- VÌ SAO `pet_type` NULLABLE, VÀ VÌ SAO **KHÔNG** CÓ `CHECK (pet_type IN (...))`
-- -----------------------------------------------------------------------------
--   ⚠️ NULLABLE: hàng `pet_state` được tạo LÚC ĐĂNG KÝ BÉ (xem `ChildService.createChild`), tức
--      TRƯỚC khi bé kịp chọn con. `pet_type = NULL` nghĩa đúng điều đó: "bé chưa chọn". Đây là
--      cột DUY NHẤT trong bảng cho phép NULL, và nó là TÍN HIỆU cho màn nhà thú cưng biết có
--      nên mở màn chọn con hay không (server trả về cờ `petChosen`).
--
--   ⚠️⚠️ KHÔNG CHECK ENUM TRÊN `pet_type` — ĐÂY LÀ QUYẾT ĐỊNH CỐ Ý, KHÁC HẲN `evolution_stage`:
--      "Có những con thú cưng nào" là DỮ LIỆU (`shared/content/pets.json`), không phải mã. Nếu
--      ghi cứng `CHECK (pet_type IN ('monkey','cat',...))` thì MỖI LẦN thêm một con mới phải
--      viết một migration để nới CHECK — và một bản deploy cũ sẽ coi con mới là "lạ", từ chối
--      lưu nó. Ngược lại, `evolution_stage` GIỮ CHECK (xem ghi chú bên dưới): 3 bậc đó gắn với
--      3 bộ hình vẽ của linh vật, thêm bậc là việc phải vẽ thêm tranh — buộc viết migration là
--      hợp lý.
--
--      Hệ quả của việc bỏ CHECK: DB có thể chứa một id KHÔNG có trong `pets.json` (bản deploy
--      khác, hoặc con vừa bị xoá). Đó KHÔNG phải lỗi dữ liệu chết người — server phân giải id lạ
--      về con mặc định khi ĐỌC (`RewardService.readPet` → `getPetDefinition`), còn khi GHI thì
--      `choosePet` chỉ nhận id có thật trong danh mục (`isPetId`). Xem `shared/content/pets.ts`.
--
-- -----------------------------------------------------------------------------
-- VÌ SAO BỎ `'egg'` (và vì sao đổi dữ liệu cũ 'egg' → 'baby')
-- -----------------------------------------------------------------------------
--   `003_progress.sql` (bản gốc) ghi `evolution_stage = 'egg'` cho MỌI bé, và `PetAvatar` vẽ 🥚
--   cho tới khi bé học đủ từ để lên 'baby'. Nhưng T04 cho bé CHỌN con mình muốn NGAY TỪ ĐẦU ⇒
--   giữ 'egg' nghĩa là bé vừa chọn "Rồng" xong lại thấy một quả trứng vô danh — chọn con mà
--   không thấy con. Nên bậc 0 nay là `'baby'` (con non bé vừa chọn).
--
--   ⚠️ Hàng cũ đang ở 'egg' được CHUYỂN thành 'baby' (xem `CASE` bên dưới) — KHÔNG bị mất, KHÔNG
--      bị chặn bởi CHECK mới. Đây là lý do phải COPY dữ liệu chứ không chỉ `ADD COLUMN`.
--
-- -----------------------------------------------------------------------------
-- VÌ SAO LÀ DỰNG-LẠI-BẢNG (drop + rename) — VÀ VÌ SAO AN TOÀN
-- -----------------------------------------------------------------------------
--   SQLite không cho `ALTER TABLE ... DROP CONSTRAINT`. Muốn đổi CHECK của `evolution_stage`
--   thì bắt buộc theo đúng quy trình 12 bước của SQLite: tạo bảng mới → copy → xoá bảng cũ →
--   đổi tên. Ta làm đúng các bước CẦN THIẾT:
--
--   ✅ AN TOÀN VÌ **KHÔNG có bảng nào tham chiếu `pet_state`** (đã kiểm: `004_reward.sql` chỉ
--      TẠO nó, không bảng nào `REFERENCES pet_state`). `child_profile` là bảng CHA, không phải
--      con của `pet_state` — nên `DROP TABLE pet_state` không vi phạm khoá ngoại nào.
--   ✅ `pet_state` KHÔNG có index ⇒ sau `RENAME` không phải dựng lại index nào.
--   ✅ Cả tệp chạy trong MỘT transaction (xem `server/db/migrate.ts`) với `foreign_keys = ON`
--      (xem `server/db/connection.ts`) ⇒ hoặc toàn bộ thành công, hoặc rollback sạch.
--   ⚠️ KHÔNG đặt `PRAGMA foreign_keys` trong tệp: migration runner ĐÃ mở transaction, mà
--      `PRAGMA foreign_keys` là NO-OP bên trong một transaction (SQLite bỏ qua lặng lẽ). Đặt vào
--      đây chỉ tạo ảo giác an toàn.
--
--   ⚠️ Thứ tự cột CỐ TÌNH đặt `pet_type` ngay sau `child_id` để đọc bảng bằng mắt là thấy ngay
--      "bé nào — con gì" ở đầu hàng; các cột còn lại giữ nguyên thứ tự cũ.
-- =============================================================================

CREATE TABLE pet_state_new (
  child_id          TEXT PRIMARY KEY REFERENCES child_profile (id) ON DELETE CASCADE,
  -- Con thú cưng bé chọn. NULL = chưa chọn (bé mới tạo, màn nhà sẽ mời chọn). KHÔNG CHECK enum:
  -- danh mục nằm ở shared/content/pets.json (xem ghi chú đầu tệp).
  pet_type          TEXT,
  -- Bậc tiến hoá theo TỔNG SỐ TỪ ĐÃ HỌC. Bậc 0 nay là 'baby' (đã bỏ 'egg'). GIỮ CHECK enum vì
  -- 3 bậc này gắn với 3 bộ hình vẽ linh vật. PHẢI khớp `evolutionStages` trong
  -- shared/content/xp-levels.json (0 / 40 / 120 từ).
  evolution_stage   TEXT NOT NULL DEFAULT 'baby'
                    CHECK (evolution_stage IN ('baby', 'adult', 'super')),
  -- SÀN = 1: dù bé bỏ app nhiều ngày, linh vật cũng không buồn bã hoàn toàn.
  happiness         INTEGER NOT NULL DEFAULT 3 CHECK (happiness BETWEEN 1 AND 5),
  -- id vật phẩm đang mặc / đang trưng bày, lưu dạng JSON array.
  equipped_item_ids TEXT NOT NULL DEFAULT '[]',
  last_fed_at       TEXT,
  updated_at        TEXT NOT NULL
);

-- Copy TOÀN BỘ hàng cũ, đồng thời DỊCH 'egg' → 'baby'.
-- `pet_type` để NULL cho mọi hàng cũ: trước T04 chưa từng có khái niệm "bé chọn con", nên mặc
-- định đúng là "chưa chọn" (màn nhà sẽ mời bé chọn). Bé đang dùng trên VPS sẽ thấy Momo 🐵 như
-- cũ ngay khi mở app (server phân giải NULL về DEFAULT_PET_ID = 'monkey').
INSERT INTO pet_state_new (child_id, pet_type, evolution_stage, happiness, equipped_item_ids, last_fed_at, updated_at)
SELECT child_id,
       NULL,
       CASE WHEN evolution_stage = 'egg' THEN 'baby' ELSE evolution_stage END,
       happiness,
       equipped_item_ids,
       last_fed_at,
       updated_at
FROM pet_state;

DROP TABLE pet_state;

ALTER TABLE pet_state_new RENAME TO pet_state;
