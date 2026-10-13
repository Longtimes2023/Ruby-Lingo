# Phụ kiện "mặc vào trông tệ" — nguyên nhân gốc và các phương án

> Trả lời câu hỏi: *"hình cái khăn choàng, đôi giày mặc vào con khỉ hơi bị tệ, có thể xử lý như
> thế nào… (kiểu đổi hình đã tạo sẵn item mặc vào thì phải sinh n hình, quá tốn credit), bạn
> nghiên cứu dùm mình phương pháp nào khả thi"*.
>
> **Kết luận ngắn: KHÔNG cần sinh `n` hình. Hai món tệ nhất đã sửa xong với 0 credit. Nếu muốn
> đẹp thêm một bậc thì chỉ cần 2 ảnh (không phải 180).**

---

## 1. Nguyên nhân gốc — KHÔNG phải ở công thức đặt neo

Đã đo và nhìn ảnh phóng to 2× (`_verify/pet-probe/zoom_parts.py` → `out/zoom/`):

| | Ảnh thú cưng (18 ảnh) | Ảnh phụ kiện (10 ảnh) |
|---|---|---|
| Góc nhìn | **CHÍNH DIỆN**, phẳng, 2D cartoon | **3/4 TỪ TRÊN XUỐNG**, khối 3D bóng |
| Bố cục | con vật đứng giữa khung | một **vật thể độc lập** trên nền trong suốt |

Với **mũ, kính, vương miện, nơ, ba lô, áo choàng, cánh** thì lệch góc này *không sao* — chúng
vốn là vật thể đặt lên đầu/mặt/lưng, đúng bản chất ảnh.

Với **khăn quàng** và **giày** thì sai hẳn:

* **`acc-scarf.webp`** — ảnh là chiếc khăn len bị vắt chéo, chụp từ trên xuống, nên ta đang
  **nhìn vào MẶT TRONG của vòng khăn**. Mực ảnh **70,9%W × 69,5%H** (gần **VUÔNG**), mà công
  thức đặt lại canh cỡ theo **BỀ RỘNG** ⇒ hệ quả số học: khăn cao **0,437** hộp trong khi **thân**
  khỉ baby cao **0,424** hộp. Khăn **phủ kín ngực**, mắt đọc ra "cục len dẹt" chứ không ra
  "chiếc khăn quàng quanh cổ".
* **`acc-shoes.webp`** — ảnh chứa **CẢ ĐÔI** giày, nhưng `ACCESSORY_SCALE.feet = 0,675` là cỡ
  của **MỘT CHIẾC**. Bảng neo ghi rõ `feet.w` = bề rộng mực của **cả hai** bàn chân — đo lại
  18/18 ảnh xác nhận: khoảng cách hai mép ngoài bàn chân / `feet.w` = **0,958–1,000**
  (`_verify/pet-probe/probe_feet.py` → `out/split-feasibility.json`). ⇒ Cả đôi giày chỉ rộng
  **67,5%** khoảng cách hai bàn chân, mỗi chiếc **nhỏ hơn bàn chân** và cả đôi dồn vào **giữa**.

> ⭐ Đây là lý do **KHÔNG cần sinh `n` hình**: bảng neo theo từng con × bậc đã lo phần "khớp
> hình dáng con vật". Thứ còn thiếu **chỉ là ảnh phụ kiện được vẽ đúng góc nhìn** — mà ảnh phụ
> kiện thì **dùng chung cho mọi con** (1 ảnh/món), không phải 1 ảnh cho mỗi (con × bậc × món).

---

## 2. Các phương án — chi phí & chất lượng

| # | Phương án | Credit | Chất lượng | Trạng thái |
|---|---|---|---|---|
| **A** | **Sửa công thức đặt** (hệ số cỡ + ép dẹt dọc) | **0** | Giày: tốt. Khăn: tốt | ✅ **ĐÃ LÀM** |
| B | Vẽ lại **2 ảnh** (khăn ở chính diện, giày **một chiếc**) | **2 ảnh** | Rất tốt (đúng bản chất) | Chờ quyết định |
| C | Vẽ lại **cả 10 ảnh** phụ kiện ở góc chính diện | **10 ảnh** | Đồng nhất toàn bộ | Chưa cần |
| D | Sinh ảnh "con vật đang mặc món X" | **180 ảnh** (6×3×10) | Tốt nhất về hình | ❌ **Không nên** |
| E | Biến dạng ảnh phẳng cho khớp silhouette (matrix3d 4 điểm / warp từng dải) | 0 | Khá hơn A một chút | Đã thử, **chưa đáng** |

### Vì sao D là bẫy — và vì sao B đủ

`n` trong câu hỏi của bạn = `6 con × 3 bậc × 10 món = 180 ảnh`, và **mỗi lần thêm một món mới
lại phải sinh thêm 18 ảnh**, mỗi lần thêm một con lại 30 ảnh. Không có cách nào để bộ ảnh đó
tự đúng.

Cách các sản phẩm thật làm (đã tra, có nguồn):

* **Neopets** — mỗi món khai một tập "vùng ảnh hưởng" (Hat Front, Collar, Necklace, Jacket,
  Shirt, Trousers, Shoes, Wings, Left-hand Item, Right-hand Item…), **không** có ảnh riêng theo
  loài. <https://thedailyneopets.com/customization-wearables/zones>
* **Meiker** (công cụ làm game dress-up) — món đồ nằm trong **một file layer**, đặt tên layer
  đúng là engine tự sinh game, "no endless PNG exports".
  <https://meiker.io/articles/the-diy-revolution-of-dress-up-games>
* **Picrew** — mỗi "part" gồm nhiều **layer**; hướng dẫn chính thức nói tách tóc thành
  *Hair Front* + *Hair Back* để cùng đổi nhưng nằm khác lớp.
  <https://support.picrew.me/en/create_imagemaker/create_first_process>
* **Animal Jam "Fit Check"** — cho người chơi tự **scale / rotate / move** phụ kiện, vì một ảnh
  item **không khớp hoàn hảo mọi loài**. Đây là bằng chứng: game lớn cũng chấp nhận
  "một ảnh + chỉnh", chứ không vẽ lại theo loài.
  <https://help.animaljam.com/hc/en-us/articles/29167068684059>
* Lật gương (mirror) để sinh bên trái/phải từ một ảnh là cách tiết kiệm texture phổ biến.
  <https://deepwiki.com/mewamew/my_ai_town/6.3-character-paper-doll-pipeline>

---

## 3. Phương án A — đã làm, 0 credit

**File:** `src/lib/accessoryFit.ts` (+ `src/components/common/PetAvatar.tsx`).

1. `ACCESSORY_SCALE.feet` **0,675 → 0,95** — đôi giày trùm vừa hai bàn chân.
2. `ACCESSORY_SCALE.neck` **0,95 → 0,90**.
3. **MỚI `ACCESSORY_SQUASH`** — ép dẹt theo chiều dọc (`neck = 0,70`). Vòng khăn thành **dải
   ngang ôm cổ**. Ép quanh **MÉP TRÊN** (không phải tâm) nên vòng khăn vẫn nằm đúng cổ.
4. `AccessoryBox` thêm `squashY`; `PetAvatar` đặt `height: side × squashY`.

**Kết quả đo trên trình duyệt thật** (Playwright, 4×, 9 ca):

| Con | Cao khăn / hộp | Rộng giày / hộp |
|---|---|---|
| khỉ baby | 72,7% → **48,2%** | 29,9% → **42,1%** |
| mèo baby | 50,8% → **33,6%** | 26,3% → **37,1%** |
| rồng baby | 68,8% → **45,6%** | 33,7% → **47,4%** |
| khỉ trưởng thành | 42,4% → **28,1%** | 32,0% → **45,1%** |

Mũ / kính / ba lô **không đổi một số nào** (đúng: chỉ khăn bị ép).

**Ảnh so trước–sau:** `_verify/final/before-after-accessories.png`

### Đã loại bỏ bằng thực nghiệm (ghi lại để lần sau khỏi thử lại)

| Ý tưởng | Kết quả | Vì sao |
|---|---|---|
| Cắt đôi ảnh giày, lật gương cho chân kia | ❌ Thất bại nặng | Ảnh là **một blob liền** (hai chiếc chồng lên nhau). Cột "khe" dày **136px** so với trung vị **97px** — **không phải khe**. Cắt 50% ra một nửa của cả hai chiếc. |
| Làm mờ dần đuôi khăn | ❌ Tệ hơn | Khăn trông như bị lỗi render. |
| Cắt ngang khăn thành 2 dải, dải trên ra sau gáy | ❌ Không đỡ | Dải bị con vật che, khăn trông đứt khúc. |
| Ép dẹt + thu hẹp hàng trên (matrix3d 4 điểm) | ⚠️ Hơn A một chút | Cần ma trận tính runtime; **chưa đáng** cho quy mô này. Giữ làm phương án dự phòng. |

---

## 4. Phương án B — nếu muốn đẹp thêm một bậc: **2 ảnh**

Không phải 180. Vì ảnh phụ kiện **dùng chung cho mọi con**, chỉ cần vẽ lại **đúng 2 tệp**:

| Tệp | Yêu cầu vẽ | Sau khi có ảnh |
|---|---|---|
| `acc-scarf.webp` | Khăn quàng **CHÍNH DIỆN**: một dải ngang ôm cổ + hai đuôi rủ xuống, nền trong suốt, khung vuông | Đặt `ACCESSORY_SQUASH.neck = 1` |
| `acc-shoes.webp` | **MỘT CHIẾC** giày, nhìn **ngang/chính diện**, mũi hướng sang trái | `ACCESSORY_SCALE.feet ≈ 0,5` + thêm trường "vẽ hai lần, lật gương cho chân kia" |

Cả hai đều **không phải sinh lại** mỗi khi thêm con vật hay thêm món khác.

---

## 5. Hợp đồng cho món mới (áo / quần — bạn đã nhắc)

Món "mặc lên thân" (áo, quần, váy, giày, khăn) **phải** vẽ theo quy ước:

1. **Chính diện**, phẳng — không 3/4, không nhìn từ trên xuống.
2. **Đối xứng trái–phải** (trừ khi cố ý bất đối xứng).
3. **Một chiếc**, không phải một đôi — đôi thì không đặt được lên hai chân riêng.
4. **Mép trên của ảnh = đường sẽ nằm trên cơ thể** (cổ / eo / mắt cá), không phải "trần ảnh".
5. Khung **vuông**, nền trong suốt, mực **chiếm 70–95%** khung (đủ chỗ nhưng không phí pixel).

Món "vật thể đặt lên người" (mũ, kính, ba lô, vương miện) thì quy ước hiện tại **đang đúng**,
không cần đổi.

---

## 6. Cách kiểm chứng (chạy lại được bất cứ lúc nào)

```bash
# Đo khả thi tách ảnh + tìm tâm hai bàn chân (0 phụ thuộc mạng)
python _verify/pet-probe/probe_feet.py
python _verify/pet-probe/probe_parts.py
python _verify/pet-probe/zoom_parts.py            # ảnh phóng to 2x

# Dựng thử composite bằng PIL, so nhiều phương án TRƯỚC khi viết code
python _verify/pet-probe/whatif_accessories.py   # A0 / A1 / A2 (giày)
python _verify/pet-probe/whatif2_accessories.py  # cắt dải, tách lớp
python _verify/pet-probe/whatif3_perspective.py  # warp phối cảnh 4 điểm
python _verify/pet-probe/sweep_shoes.py          # quét hệ số giày
python _verify/pet-probe/sweep_scarf.py          # quét ép dẹt khăn

# Đo trên trình duyệt THẬT (sau khi vite build --outDir …)
node _verify/v11-accessory-live.mjs http://127.0.0.1:4193
```

Test khoá lại: `tests/unit/client/pet-anchors.test.ts` (nhóm "bản vá khăn quàng + giày") và
`tests/unit/client/pet-avatar.test.tsx` (nhóm "khăn quàng bị ép dẹt").
**Mutation test:** trả `feet` về 0,675 và `neck` về 1 ⇒ 2 test ĐỎ ngay.
