# Phụ kiện "kiểu đang mặc" — kế hoạch vẽ lại (theo ảnh mẫu của chủ dự án)

> Ảnh mẫu chủ dự án gửi: `Gemini_Generated_Image_wvy7wawvy7wawvy7.png` (2080×2048) — **mèo con
> `cat-baby` của chính dự án**, đang mặc mũ + kính + khăn + ba lô + giày, **vẽ liền một khối**.
> Yêu cầu: *"mình cần kiểu hình như vậy, không phải kiểu tương đối của bạn"*.

---

## 1. Vì sao bản hiện tại không giống ảnh mẫu

Hai khác biệt, đo được:

| | Ảnh mẫu (chủ dự án muốn) | Bản hiện tại |
|---|---|---|
| **Cách dựng** | con vật + bộ đồ là **MỘT khối vẽ liền**, cùng ánh sáng, cùng góc nhìn | **ghép lớp**: 10 ảnh phụ kiện rời đặt lên con vật theo hệ toạ độ `%` |
| **Góc nhìn phụ kiện** | **chính diện, đang mặc** (mũ úp trên đầu, vành cong theo tai; khăn quấn quanh cổ; quai ba lô vắt qua vai; giày ôm hai bàn chân) | **ảnh chụp sản phẩm, góc 3/4 từ trên xuống** (mũ nhìn thấy đỉnh; khăn nhìn vào mặt trong vòng; ba lô là một cái túi; giày là cả đôi đặt cạnh nhau) |

⇒ Ghép lớp **không bao giờ** ra được ảnh mẫu, **chừng nào art phụ kiện vẫn là ảnh sản phẩm**.
Đây là kết luận đo được, không phải ý kiến: xem `_verify/ref/gap.png` (so trực tiếp) và
`_verify/pet-probe/out/zoom/acc-scarf-x2.png` (khăn: thấy rõ mặt trong của vòng).

---

## 2. Vì sao KHÔNG thể "sinh ảnh con vật mặc sẵn bộ đồ" cho mọi trường hợp

Bé tự chọn từng món. Số tổ hợp phải sinh nếu "nướng" bộ đồ vào ảnh:

* 5 vị trí: `head` (3 món: nơ / mũ / vương miện), `face` (2: kính / kính sao), `neck` (1: khăn),
  `feet` (1: giày), `back` (3: ba lô / áo choàng / cánh).
* Mỗi vị trí có thể chọn **không món nào**, hoặc **nhiều món cùng lúc** (dự án cố ý cho phép —
  lấy món bé đã mua ra là trái luật "không lấy gì của bé").
* ⇒ `2³ × 2² × 2¹ × 2¹ × 2³` = **1.024 tổ hợp** cho MỘT con × **18 ảnh (6 con × 3 bậc)**
  = **18.432 ảnh**. (Kể cả siết lại "mỗi vị trí chỉ 1 món" thì vẫn `4×3×2×2×4 = 192` × 18
  = **3.456 ảnh**.) Bất khả thi.

---

## 3. Phương án khả thi — vẽ lại **ART PHỤ KIỆN** ở góc "đang mặc"

Giữ nguyên hệ ghép lớp (mọi tổ hợp vẫn chạy, không phải sinh lại khi thêm món mới), nhưng
**vẽ lại ảnh phụ kiện cho đúng góc nhìn** — đúng như ảnh mẫu.

Ảnh phụ kiện **dùng chung cho cả 18 con** (hệ thống neo tự co giãn theo từng con), nên
**số ảnh cần sinh không phụ thuộc số con**.

### Danh sách cần vẽ lại

| # | Tệp | Vẽ thế nào | Vì sao |
|---|---|---|---|
| 1 | `acc-hat` | Mũ **chính diện**: thấy mặt trước chỏm mũ + vành cong xuống hai bên (như ảnh mẫu) | Bản hiện tại nhìn từ trên ⇒ thấy đỉnh mũ, dán lên đầu thành "cái nắp" |
| 2 | `acc-scarf` | Khăn **đang quấn**: một vòng ôm cổ + hai đuôi rủ xuống trước ngực, **nhìn thấy mặt NGOÀI** của len | Bản hiện tại nhìn vào **mặt trong** vòng ⇒ dán lên thành "cục len" |
| 3 | `acc-shoes` | **MỘT chiếc giày**, nhìn ngang/chếch chính diện, mũi hướng sang trái | Bản hiện tại là **cả đôi** trong một ảnh ⇒ không đặt được lên hai bàn chân riêng |
| 4 | `acc-backpack` | Ba lô **đang đeo**: thân túi + **hai quai vắt qua vai** (lớp trước) | Bản hiện tại chỉ có thân túi, không có quai ⇒ nằm sau lưng như dán |
| 5 | `acc-cape`, `acc-wings` | (kiểm tra lại) vẽ chính diện, phần vắt qua vai | Cùng lý do như ba lô |

**Chi phí: 3–5 ảnh × 5–10 credit ≈ 15–50 credit.** (Không phải 180, không phải 3.456.)

### Cách sinh để chắc chắn đúng style

Dùng **image-to-image** với ảnh mẫu của chủ dự án (hoặc ảnh cắt từ nó) làm ảnh dẫn style:
`image1 = <ảnh mẫu hoặc ảnh cắt món đó>`, `input_fidelity` cao, `background = transparent`.

Prompt mẫu (khăn):

> Cùng phong cách 3D matte clay, cùng ánh sáng mềm như ảnh tham chiếu: **chỉ chiếc khăn len đỏ
> đang quấn quanh một cái cổ vô hình** — vòng khăn ôm tròn, hai đuôi rủ xuống phía trước, nhìn
> thấy MẶT NGOÀI của len. **Không có con vật, không đầu, không thân, không mặt.** Chính diện,
> nền trong suốt, khung vuông, vật chiếm 75–90% khung.

---

## 4. Sau khi có ảnh mới phải sửa gì trong mã

Ít, và đã có sẵn chỗ:

| Tệp | Sửa |
|---|---|
| `src/lib/accessoryFit.ts` | `ACCESSORY_SQUASH.neck` → `1` (khăn mới không cần ép dẹt) |
| `src/lib/accessoryFit.ts` | `ACCESSORY_SCALE.feet` → `~0,5` **+ thêm trường "vẽ hai lần, lật gương"** |
| `src/lib/accessoryFit.ts` | Thêm **lớp trước/sau** cho ba lô (quai vắt vai nằm TRƯỚC con vật) |
| `src/components/common/PetAvatar.tsx` | Vẽ món có `mirror: true` thêm một bản `scaleX(-1)` |
| `src/lib/petAnchors.ts` | Thêm `feet.left` / `feet.right` (đã đo được cho **18/18 con**: `_verify/pet-probe/out/split-feasibility.json`) |

Không đổi schema dữ liệu, không đổi server, không đổi luật kinh tế.

---

## 5. Bằng chứng đã thu thập (0 credit)

| Việc | Tệp |
|---|---|
| So trực tiếp "bản hiện tại" ↔ "ảnh mẫu" | `_verify/ref/gap.png` |
| Tách bộ đồ khỏi ảnh mẫu (chứng minh hình dạng "đang mặc" là khác hẳn) | `_verify/ref/extracted-sheet.png`, `_verify/ref/extracted2/` |
| Ảnh phóng to chứng minh góc nhìn sai | `_verify/pet-probe/out/zoom/acc-scarf-x2.png`, `acc-shoes-x2.png` |
| Đo hai bàn chân của 18 con (để đặt giày trái/phải riêng) | `_verify/pet-probe/out/split-feasibility.json` |
| Script tách màu từ ảnh mẫu | `_verify/ref/extract_clean.py` |

⚠️ **Không dùng được bộ đồ tách từ ảnh mẫu làm art chính thức**: phần bị con vật che (ba lô sau
lưng, giày sau bàn chân) bị khuyết. Ảnh tách chỉ để **chứng minh hình dạng đúng**, art chính thức
phải **sinh lại sạch** bằng ImageGen.

---

## 6. Cần chủ dự án duyệt

1. **Duyệt hướng**: vẽ lại 3–5 ảnh phụ kiện ở góc "đang mặc" (thay vì nướng bộ đồ vào ảnh).
2. **Duyệt ngân sách**: ~15–50 credit cho 3–5 ảnh.
3. (Tuỳ chọn) có muốn sinh **1 ảnh mẫu trước** (khăn — món tệ nhất, ~5–10 credit) để duyệt style
   rồi mới làm phần còn lại hay không.
