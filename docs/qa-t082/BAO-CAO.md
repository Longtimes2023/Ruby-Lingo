# T082 — QA khả năng tiếp cận (a11y) + responsive

**Người thực hiện:** qa-a11y · **Ngày:** 2026-10-09
**Môi trường:** API riêng `DB_PATH=./data/qa.db`, cổng **4310**; frontend phục vụ bằng **Vite dev cổng 5199**
(`docs/qa-t082/vite.qa.config.mts`, KHÔNG sửa `vite.config.ts`). **Không ghi vào `data/rubylingo.db`.**
**Bằng chứng:** `docs/qa-t082/shots/*.png` (42 ảnh đã đăng nhập + 12 ảnh công khai) và số đo thô
`docs/qa-t082/shots/results.json` + `shots/public/results.json`.

> ⚠️ **Vì sao dùng Vite dev thay vì `dist/`:** trong lúc audit, một teammate chạy `vite build` (T081) và
> `emptyOutDir` **xoá `dist/`** giữa lượt đo — server trả về trang *"Chưa có bản build frontend"*
> (ảnh `public/ipad-820x1180__signup.png` của lượt chạy đầu). Chuyển sang Vite dev (đọc trực tiếp
> `src/`) để kết quả không phụ thuộc `dist/` của người khác. **Đây là lỗi của quy trình, không phải lỗi app.**

---

## 1. Bảng lỗi

| # | Mô tả | Mức độ | Bằng chứng (ảnh + số đo thật) | Xử lý |
|---|---|---|---|---|
| L1 | **Tương phản chữ dưới ngưỡng AA**: số chuỗi ngày 🔥 dùng `text-warn` (`#d97706`) trên nền `--c-surface-raised` (`#fff7fa`) ⇒ **3.02:1** (cần 4.5:1), cỡ 16px | **Khó chịu** (đọc được nhưng mờ; trẻ nhìn màn hình ngoài nắng sẽ vất vả) | 360px: `phone-360x640__home.png` (thẻ chào, dòng "🔥 1 · còn 2 ngày tới mốc 3") và `phone-360x640__quests.png`. Selector `... > span.inline-flex.items-center.gap-1 > span.text-kid-xs.font-bold.tabular-nums`. Số đo: `rgb(217,119,6)` trên `rgb(255,247,250)` = **3.02** (cần 4.5) | ⚠️ **CHỈ BÁO CÁO** — xem §4 |
| L2 | **Vùng chạm dưới quy ước 64px** (56px ở <480px): nút âm thanh **44×44**, link "← Bản đồ hành trình" **191×48**, "← Về chủ đề" **131×48**, "Thoát trò chơi" **48×48**, link "Đăng nhập" ở trang 404 **102×28** | **Nhỏ** (đều ≥44px ⇒ đạt WCAG 2.5.5 AAA; `SoundButton` có ghi chú giải thích 44px là chủ ý) | Cả 3 viewport, xem `results.json` → `small[]`. Đo được: 44×44 (mọi màn hình có `TopBar`), 191×48 (`phone-360x640__lesson_at_the_zoo_z1_flashcards.png`), 48×48 (`..._game_listen_tap.png`), 102×28 (`phone-360x640__trang_khong_ton_tai.png`) | ⚠️ **CHỈ BÁO CÁO** — xem §4 |
| L3 | **Chữ 13px < quy ước "không bao giờ nhỏ hơn 16px"**: nhãn 5 mục `BottomNav` (`text-[13px]`). Cùng cỡ 13px ở tên avatar `ChildProfileSetupPage` (route `/children/new`, chưa đo) | **Nhỏ** (mỗi mục còn có icon 26px + `aria-label`) | `results.json` → `tiny[]`, 5 mục × 3 viewport. Selector `ul.mx-auto.flex.w-full > li.flex-1 > a.mx-auto.flex.min-h-touch > span.text-[13px].leading-tight` | ⚠️ **CHỈ BÁO CÁO** — sửa 13→16px làm nhãn xuống 2–3 dòng ở 360px ⇒ cần quyết định thiết kế |
| L4 | **Nút đang tắt mờ khó đọc**: nút "Nhận thưởng" (`disabled:opacity-60`) gần như chìm vào nền | **Nhỏ — KHÔNG phải lỗi WCAG** (1.4.3 miễn trừ thành phần không hoạt động) | `laptop-1280x720__quests.png` | Ghi nhận, không sửa |

**KHÔNG tìm thấy lỗi ở các mục sau (đã đo, không suy đoán):**
- **Tràn ngang:** `scrollWidth − clientWidth = 0px` ở **cả 3 viewport, mọi route** (14 route × 3).
- **Thuộc tính a11y:** 0 nút/link thiếu tên đọc · 0 `<img>` thiếu hẳn thuộc tính `alt`
  (9 ảnh bìa chủ đề dùng `alt=""` — **đúng** cho ảnh trang trí) · 0 `role="switch"` thiếu `aria-checked`
  · 0 lỗi thứ tự heading · `<html lang="vi">` ✓ · có `<title>` ✓.
- **Bàn phím:** Tab 22 lần × 3 màn hình × 3 viewport — **mọi** phần tử nhận focus đều có vòng focus
  nhìn thấy được (`outline: solid 3px`, từ `:focus-visible` toàn cục), thứ tự hợp lý, không kẹt tiêu điểm.

---

## 2. Số đo thật theo viewport

| Chỉ số | 360×640 | 820×1180 | 1280×720 |
|---|---|---|---|
| `--sp-touch` / `--sp-touch-lg` (đo từ DOM) | **56px / 72px** | **64px / 88px** | **64px / 88px** |
| Tràn ngang (delta) | **0px** ✅ | **0px** ✅ | **0px** ✅ |
| Phần tử chạm dưới ngưỡng | 5 loại (44–48px) | 5 loại | 5 loại |
| Chữ < 16px | 5 nhãn `BottomNav` (13px) | 5 | 5 |
| Lỗi tương phản | **1** (L1) | 0 đo được* | 0 đo được* |
| Nút **chính** (`lg`, nền `--c-brand`) | "Về trang chủ" **72px**, "Mở khoá" **72px** ✅ = ngưỡng | **88px** ✅ | **88px** ✅ |

\* L1 chỉ lộ ở 360px vì ở màn rộng hơn phần tử đó nằm trong khối có `background-image` (gradient) —
`contrast_probe` chủ động **bỏ qua** phần tử nền gradient để tránh báo động giả. Lỗi **có mặt ở mọi
kích thước** (xác nhận bằng mã: `StreakFlame.tsx:82` luôn dùng `text-warn`).

Các nút `BigButton size="md"` (Thẻ từ vựng, Tiếp, Mua…) cao **56/64px** — đúng cỡ `md` đã khai trong
`BigButton.tsx`, không phải vi phạm.

---

## 3. Tệp đã sửa

**KHÔNG sửa tệp mã nguồn nào.** Lý do ở §4. Đã chạy `npx tsc -p tsconfig.app.json --noEmit` ⇒ **exit 0**.
Không chạy eslint vì không có tệp `.ts/.tsx` nào bị thay đổi.

Tệp **mới** (chỉ trong `docs/qa-t082/`, không nằm trong `tsconfig.app.json`):
`audit.mjs` (bộ đo CDP), `vite.qa.config.mts` (Vite dev riêng), `flow-signup.json`, `shots/`, `BAO-CAO.md`.
Bổ sung ở lượt T082b: `seed-report.mjs` (§7) và `shots-parent/` + `shots-parent-filled/`.

---

## 4. Vì sao KHÔNG tự sửa L1–L3

- **L1** — cách sửa đúng là thêm token `--c-warn-ink` (theo đúng khuôn `--c-star-ink` / `--c-heart-ink`
  đã có trong dự án) rồi đổi `text-warn` → `text-warn-ink` ở 4 chỗ đặt **chữ** trên nền sáng
  (`StreakFlame.tsx:82`, `GameShell.tsx:111`, `SyncBadge.tsx:87`, `AuthLayout.tsx:191`).
  **`src/styles/tokens.css` nằm trong danh sách CẤM sửa** ⇒ không tự thêm token.
  *Đề xuất bản vá:* `--c-warn-ink: #9a5a08;` — đo được **5.19:1** trên `--c-surface-raised` và
  **4.94:1** trên `--c-surface-sunken` (đạt AA ở mọi nền nó từng đứng).
- **L2** — 48px là lựa chọn thiết kế cho nút điều hướng một lần (khác "nút hành động bé bấm liên tục"
  mà quy ước 64px nhắm tới — chính `SoundButton.tsx` viết rõ điều này), và mọi mục đều ≥44px (AAA).
  Đổi kích thước là thay đổi bố cục ⇒ cần lead/design quyết.
- **L3** — tăng 13→16px làm nhãn `BottomNav` xuống 2–3 dòng ở 360px (5 mục trong 328px) ⇒ đổi bố cục
  thanh điều hướng ⇒ cần quyết định thiết kế.

---

## 5. Điều KHÔNG kiểm được (nói thẳng, không suy đoán)

1. ~~**Khu vực sau cổng PIN**~~ ✅ **ĐÃ ĐO ĐƯỢC ở lượt mở rộng T082b — xem §7.**
   Lượt đầu không đo được vì `/parent` **không có route riêng** cho báo cáo/cài đặt (chúng chỉ là `view`
   trong state của `ParentGatePage`). T082b mở cổng thật rồi bấm vào từng view ⇒ đã đo đủ
   **5 view × 3 viewport = 15 lượt**. Kết quả: **sạch**, trừ một điểm chạm ở thanh trượt (L5).
2. **`ChildSwitcherDialog`** — cần tài khoản có ≥2 bé; tài khoản QA chỉ có 1 nên nút đổi bé không hiện.
3. **Chữ trên nền gradient**: mọi phần tử có tổ tiên `background-image` bị bộ đo **bỏ qua** (chống báo
   động giả). Nghĩa là **thẻ chủ đề ở bản đồ hành trình chưa được đo tương phản** (nền `from-th-tint to-surface`).
4. **Tương phản có pha `opacity`**: bộ đo dùng `getComputedStyle` nên **không** mô phỏng được việc lớp
   `opacity` trộn màu. Đã rà bằng mã: mọi chỗ dùng `opacity-*` đều là **trạng thái tắt** (WCAG miễn trừ)
   hoặc **emoji trang trí `aria-hidden`** ⇒ không có lỗi bị bỏ sót, nhưng bộ đo **không tự chứng minh** được.
5. **Zoom / phóng to chữ 200%**, **`prefers-reduced-motion: reduce`**, **trình đọc màn hình thật**
   (NVDA/VoiceOver) — chưa chạy.
6. **`/children/new`** (tạo hồ sơ bé) — chỉ đo được qua luồng `drive_flow` (ảnh `flow-flow-01/02`),
   chưa đo số ở 3 viewport.

---

## 6. Cách chạy lại

```bash
# 1. API riêng (KHÔNG đụng rubylingo.db)
DB_PATH=./data/qa.db PORT=4310 NODE_ENV=production PUBLIC_ORIGIN=http://localhost:5199 \
  npx tsx server/index.ts
# 2. Frontend riêng (không phụ thuộc dist/)
npx vite --config docs/qa-t082/vite.qa.config.mts
# 3. Đo (2 lượt: đã đăng nhập + công khai)
node docs/qa-t082/audit.mjs --base http://localhost:5199 \
  --email qa.a11y.4310@example.com --password Matkhau12345 --out docs/qa-t082/shots
node docs/qa-t082/audit.mjs --base http://localhost:5199 --nologin --out docs/qa-t082/shots/public
# 4. (T082b) Làm đầy báo cáo bằng API thật, rồi đo 5 view sau cổng PIN
node docs/qa-t082/seed-report.mjs --base http://127.0.0.1:4310 \
  --email qa.a11y.4310@example.com --password Matkhau12345
node docs/qa-t082/audit.mjs --base http://localhost:5199 \
  --email qa.a11y.4310@example.com --password Matkhau12345 \
  --out docs/qa-t082/shots-parent-filled --parent-views
```

---

# 7. Lượt mở rộng T082b — khu vực SAU CỔNG PIN (5 view × 3 viewport)

## 7.1 Vì sao phải làm thêm

`/parent` **không có route riêng** cho báo cáo và cài đặt. Chúng chỉ là `view` trong state của
`ParentGatePage` (`view: 'gate' | 'forgot' | 'report' | 'settings'`, `ParentGatePage.tsx:96`), nên lượt
audit đầu chỉ chụp được **màn nhập PIN**. Ba màn hình thật sự nằm sau cổng — và đây đúng là chỗ dễ giấu
lỗi a11y nhất (công tắc, thanh trượt, biểu đồ, danh sách) — **chưa từng được đo**.

**Cách đo (không đoán):**
1. `/parent` **không** có URL riêng ⇒ bộ đo phải *mở cổng thật rồi bấm nút*: `docs/qa-t082/audit.mjs`
   chế độ `--parent-views` (bấm nút theo **chữ hiện trên màn**, lấy từ `src/i18n/vi.ts`).
2. **Mở cổng:** tài khoản mới **chưa đặt PIN** thì `openGate` chấp nhận **bất kỳ** PIN 4 số hợp lệ
   (`server/services/parentService.ts:24`) ⇒ `POST /api/parent/gate {"pin":"1111"}` mở cổng cho phiên.
3. **Làm đầy báo cáo:** `ParentReport` chỉ vẽ biểu đồ khi `dailyStats` có dữ liệu. `seed-report.mjs`
   gọi **API thật** `POST /api/children/:id/game-result` 4 lượt (4 ngày khác nhau) — server tự chấm điểm,
   không INSERT thẳng vào DB. Kết quả đọc lại từ `GET .../report`:
   `dailyStats=[04/10:1, 06/10:1, 08/10:2, 09/10:1]`, `struggling=[hippo, snake]`, `mastered=[elephant]`.

## 7.2 Bảng lỗi (bổ sung)

| # | Mô tả | Mức độ | Bằng chứng (ảnh + số đo thật) | Xử lý |
|---|---|---|---|---|
| L5 | **Thanh trượt "Tốc độ đọc" có vùng chạm cao 16px**: `<input type="range" className="w-full">` (`ParentSettingsPage.tsx:262-272`). Hộp của chính `<input>` là vùng chạm ⇒ **292×16** (360px) và **384×16** (820/1280px). Dưới cả ngưỡng **24×24 của WCAG 2.5.8 (AA)** lẫn quy ước **56/64px** của dự án. **Không** phải lỗi bàn phím (Tab tới được, có vòng focus) — chỉ là vùng chạm ngón tay | **Khó chịu** (màn của **bố mẹ**, không phải của trẻ; kéo bằng chuột ổn, bằng ngón tay thì phải chạm chính xác) | `docs/qa-t082/shots-parent-filled/phone-360x640__parent-settings.png`. Selector `section > label.flex.min-h-touch.flex-col > input.w-full`. `results.json` → `sliders[]`: `{w:292,h:16}` / `{w:384,h:16}` | ⚠️ **CHỈ BÁO CÁO** (khi phát hiện) → ✅ **ĐÃ VÁ & ĐÃ XÁC MINH LẠI** — engineer-web đổi sang `min-h-touch`; xem **§8** |

## 7.3 Số đo thật — 5 view × 3 viewport (15 lượt, tất cả `clicked=true`)

| View (`/parent#…`) | Nội dung thật đo được | Tràn ngang | Tương phản | Tên đọc | `alt` | `switch`+`aria-checked` | Heading | Chạm < ngưỡng | Chữ <16px |
|---|---|---|---|---|---|---|---|---|---|
| `parent-gate` | "Nhập mã PIN 4 số · Mở khoá · Quên mã PIN?" | 0px ✅ | 0 lỗi ✅ | 0 thiếu ✅ | 0 ✅ | 0 ✅ | 0 ✅ | 1 (nút 🔊 44px) | 5 (BottomNav) |
| `parent-forgot` | "Đặt lại mã PIN · Bố mẹ nhập mật khẩu tài khoản và mã PIN mới" | 0px ✅ | 0 lỗi ✅ | 0 thiếu ✅ | 0 ✅ | 0 ✅ | 0 ✅ | 1 (nút 🔊 44px) | 5 |
| `parent-open` | "✅ Khu vực phụ huynh đã mở" + 2 nút + form Đặt PIN | 0px ✅ | 0 lỗi ✅ | 0 thiếu ✅ | 0 ✅ | 0 ✅ | 0 ✅ | 1 (nút 🔊 44px) | 5 |
| `parent-report` | "Báo cáo học tập Bin · 03/10→09/10" + 4 thẻ số + biểu đồ 4 cột + 2 danh sách từ | 0px ✅ | 0 lỗi ✅ | 0 thiếu ✅ | 0 ✅ | 0 ✅ | 0 ✅ | 1 (nút 🔊 44px) | 5 |
| `parent-settings` | "Cài đặt của bé" + 3 công tắc + thanh trượt + quản trị hồ sơ | 0px ✅ | 0 lỗi ✅ | 0 thiếu ✅ | 0 ✅ | 0 ✅ | 0 ✅ | 2 → **1** sau vá (🔊 44px; ~~thanh trượt 16px~~ nay **56/64px** — L5 đã khép, xem §8) | 5 |

**Biểu đồ cột đọc được bằng trình đọc màn hình** — mỗi cột là `role="img"` + `aria-label`, đo trực tiếp
trên DOM: `["Ngày 04/10: 1 từ", "Ngày 06/10: 1 từ", "Ngày 08/10: 2 từ", "Ngày 09/10: 1 từ"]`
(khớp đúng `dailyStats`). Nhãn ngày dưới cột đặt `aria-hidden` để không bị đọc lặp — đúng thiết kế.

**Bàn phím (Tab 24 lần × 5 view × 3 viewport):** **0** phần tử nhận focus thiếu dấu hiệu focus — mọi
phần tử đều `outline: solid 3px`. 3 công tắc đo được **328×56 / 328×56 / 328×58** và đều có `aria-checked`.
Nút gửi (`Mở khoá`, `Lưu`, `Đặt lại mã PIN`) **không** xuất hiện trong chuỗi Tab vì đang `disabled` —
đúng hành vi, không phải lỗi.

## 7.4 Vì sao KHÔNG tự sửa L5

Vá `className="w-full"` → `"h-14 w-full"` (56px) là **một dòng**, nhưng tôi đã **thử ngay trong DOM**
(không sửa tệp) để biết cái giá:

| Viewport | `<input>` trước → sau | **Hàng `label` trước → sau** |
|---|---|---|
| 360×640 | 16 → 56px | **80 → 120px (+40px)** |
| 820×1180 | 16 → 56px | **84 → 124px (+40px)** |
| 1280×720 | 16 → 56px | **84 → 124px (+40px)** |

⇒ Vá này **làm đổi bố cục** màn Cài đặt (hàng cao thêm 40px), tức là **quyết định thiết kế**, không phải
lỗi a11y thuần. Thêm nữa `ParentSettingsPage.tsx` thuộc **task #30 (engineer-web) đang làm dở** — sửa vào
đó là đụng việc của người khác. ⇒ **Báo cáo + giao đúng người** (đã gửi engineer-web), không tự sửa.

*Đề xuất:* `className="h-14 w-full"` — hàng cao thêm 40px nhưng vùng chạm đạt 56px = đúng quy ước dự án.
Nếu muốn **giữ nguyên bố cục**, cách khác là bọc một lớp `::before` trong suốt cao 56px phủ lên thanh trượt
(giữ hình dáng, nới vùng chạm) — nhiều CSS hơn, cần design xác nhận.

## 7.5 Điều KHÔNG kiểm được ở T082b

1. **Tương phản thanh cột biểu đồ** (`bg-brand` trên nền `bg-line`): đây là **đồ hoạ phi văn bản**
   (WCAG 1.4.11, cần 3:1), mà bộ đo chỉ đo **chữ** ⇒ **không đo được**. Chỉ đo được rằng mỗi cột **có**
   nhãn đọc cho trình đọc màn hình.
2. **Báo cáo có nhiều dữ liệu hơn** (5 từ "hay nhầm", 5 từ "nhớ chắc" — trần `REPORT_WORD_LIST_LIMIT = 5`,
   nhiều tuần cuộn dài): mới seed 2 từ nhầm + 1 từ nhớ chắc ⇒ danh sách dài chưa đo.
3. **`ChildSwitcherDialog`** vẫn chưa đo (cần tài khoản ≥2 bé).
4. **`Xoá hồ sơ` / `Sửa hồ sơ` / `+ Thêm bé`**: đo được kích thước (≥56px) và focus, **chưa** mở hộp thoại
   để đo nội dung bên trong.

---

# 8. Xác minh sau khi vá L5 — **L5 ĐÃ KHÉP** ✅

**Bản vá (engineer-web, task #30):** `ParentSettingsPage.tsx` — `className="w-full"` →
**`className="min-h-touch w-full"`**. Chọn `min-h-touch` thay vì `h-14`: đây đúng lớp mọi nút/công tắc
trên trang đang dùng, nên lấy theo token (`--sp-touch`) thay vì ghim cứng px.

**Đo lại trên DOM thật** (`docs/qa-t082/shots-parent-l5fixed/results.json`, 15 lượt):

| Viewport | `<input>` trước → sau | Hàng `label` trước → sau | `--sp-touch` đo được | `small[]` (view settings) |
|---|---|---|---|---|
| 360×640 | 292×**16** → 292×**56** ✅ | 328×80 → 328×120 (+40px) | 56px | **2 → 1** |
| 820×1180 | 384×**16** → 384×**64** ✅ | 420×84 → 420×132 (+48px) | 64px | **2 → 1** |
| 1280×720 | 384×**16** → 384×**64** ✅ | 420×84 → 420×132 (+48px) | 64px | **2 → 1** |

- Vùng chạm nay **56px** ở 360px và **64px** ở màn rộng — **đúng bằng `--sp-touch`**, tức khớp các ô
  còn lại trên trang. Số này **khớp chính xác** dự đoán của engineer-web.
- Phần tử vi phạm duy nhất còn lại ở màn Cài đặt là nút âm thanh **44×44** — ngoại lệ đã ghi chú
  (`SoundButton`), vẫn đạt WCAG 2.5.5 AAA.
- Ảnh: `shots-parent-l5fixed/phone-360x640__parent-settings.png` (hàng "Tốc độ đọc" cao hơn, thanh
  trượt nằm giữa ô, tay nắm rõ ràng — trông khớp với các thẻ còn lại).

**Quét hồi quy toàn bộ 15 lượt sau vá: `0/15` lượt có vấn đề** — 0 tràn ngang, 0 lỗi tương phản,
0 thiếu tên đọc, 0 `img` thiếu `alt`, 0 `role="switch"` thiếu `aria-checked`, 0 lỗi thứ tự heading,
0 phần tử focus thiếu vòng focus, mọi nút đều bấm được. Báo cáo tuần vẫn còn nguyên dữ liệu
(biểu đồ 4 cột: `["Ngày 04/10: 1 từ", "Ngày 06/10: 1 từ", "Ngày 08/10: 2 từ", "Ngày 09/10: 1 từ"]`).

⇒ **Không phát sinh lỗi mới. L5 khép lại.**

**Bàn về phương án "lớp phủ trong suốt" (engineer-web hỏi):** engineer-web **đúng** — `<input>` là
phần tử *thay thế (replaced element)* nên trình duyệt không dựng `::before`/`::after` trên nó, và một
lớp phủ thật sự nhận sự kiện sẽ chặn chính thao tác kéo. Với `input[type=range]`, **hộp của phần tử
chính là vùng chạm** — chạm ở bất kỳ đâu trong hộp đều kéo được tay nắm — nên **cách duy nhất đúng là
nâng chiều cao hộp** (`min-h-touch` hoặc `padding-block`, hai cách tương đương về kết quả). Một tinh
chỉnh tuỳ chọn (không bắt buộc): nới thêm `::-webkit-slider-thumb` để tay nắm trông to hơn cho khớp
vùng chạm — nhưng đó thuần là hình thức, vùng chạm đã đạt chuẩn từ bản vá này.

