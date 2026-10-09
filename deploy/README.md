# RubyLingo — Deploy & Phục hồi (Nhóm 12)

Tài liệu này là **quy trình vận hành**, không phải tài liệu kiến trúc. Phần "vì sao" nằm trong
chú thích ở `Dockerfile`, `docker-compose.yml`, `scripts/deploy.sh`, `scripts/update.sh`,
`scripts/backup-db.sh`, `scripts/push-to-github.sh`.
Tài liệu kiến trúc đầy đủ ở `../deliverables/english-starters/ARCHITECTURE.md` (mục Nhóm 12) —
**nằm ngoài repo**, không cần cho deploy.

**Luồng chuẩn:** GitHub (repo private) → VPS `git clone` **một lần** → mỗi lần cập nhật chạy
`./scripts/update.sh` (pull + build lại container).

---

## 0. ĐƯA MÃ NGUỒN LÊN VPS — `git clone`

> ⭐ **VÌ SAO LÀ GIT, KHÔNG PHẢI NÉN `.tar.gz` RỒI `scp`:**
> `scripts/deploy.sh` chạy `docker compose up -d --build` với **thư mục hiện tại** làm build
> context ⇒ mã nguồn phải có mặt trên VPS. Cách nén/scp làm được điều đó, nhưng mỗi lần sửa một
> dòng lại phải đóng gói → chuyển → giải nén **bằng tay**, và **không có lịch sử**: không biết VPS
> đang chạy bản nào, không soát lại được đã đổi những gì.
> Với git: sửa ở máy dev → `git push` → trên VPS `./scripts/update.sh`. VPS tự biết mình đang ở
> commit nào, và `git pull` chỉ mang về phần thay đổi.

### 0.0. Đẩy mã nguồn lên GitHub — TRÊN MÁY DEV (làm trước 0.1)

```bash
# Tạo repo trên GitHub ở trạng thái TRỐNG (KHÔNG README, KHÔNG .gitignore, KHÔNG license)
# rồi, từ gốc repo trên máy dev:
./scripts/push-to-github.sh git@github.com:<user>/rubylingo.git
```

Script làm 9 bước và **dừng ở bước đỏ** thay vì đẩy hỏng: kiểm tra repo có commit → cho biết
tệp nào **chưa** commit sẽ không lên → **hỏi thẳng git** xem `data/`/`.env`/`backups/` có bị theo
dõi không (`.gitignore` chỉ là ý định; `git add -f` đủ để vô hiệu hoá nó) → gắn `origin` → thử
đọc remote → **chặn nếu repo không rỗng** (tạo kèm README ⇒ push bị từ chối, và "sửa" bằng
`--force` là xoá mất commit của chính mình) → push → **đọc lại remote và so hash**.

> ⚠️ `data/` chứa DB SQLite với **dữ liệu trẻ em thật**, `backups/` chứa bản sao DB đó, `.env`
> chứa `SESSION_SECRET`. Push là thao tác **không hoàn tác được rẻ tiền** — xoá commit trên
> GitHub không xoá bản sao đã bị fetch. Đó là lý do có chốt ở bước 3.

Có PAT (scope tạo repo) thì tạo repo trống + đẩy trong một lệnh:

```bash
GITHUB_TOKEN=ghp_xxx ./scripts/push-to-github.sh --create rubylingo
```

Kiểm tra trước khi đẩy thật (không đẩy gì): `DRY_RUN=1 ./scripts/push-to-github.sh <url>`

### 0.1. `git clone` — CHỈ MỘT LẦN

```bash
# Repo PUBLIC ⇒ HTTPS, KHÔNG cần khoá, KHÔNG cần deploy key.
sudo mkdir -p /srv && sudo chown "$USER:$USER" /srv
cd /srv
git clone https://github.com/Longtimes2023/Ruby-Lingo.git rubylingo   # ⚠️ KHÔNG sudo
cd rubylingo
```

> ⚠️⚠️ **TUYỆT ĐỐI KHÔNG `sudo git clone`.** `sudo` tạo thư mục **và mọi tệp bên trong** thuộc
> `root:root` ⇒ tài khoản thường chỉ ĐỌC được, không tạo được tệp. Lỗi hiện ra ở bước SAU, trông
> chẳng liên quan gì tới clone, nên rất dễ đi tìm sai chỗ:
>
> ```text
> $ cp .env.example .env
> cp: cannot create regular file '.env': Permission denied
> ```
>
> Chưa hết: `git pull` của `./scripts/update.sh` cũng sẽ hỏng, vì nó không ghi được vào `.git/`.
> Nếu đã lỡ clone bằng `sudo`, chữa bằng **một** lệnh:
>
> ```bash
> sudo chown -R "$USER:$USER" ~/Ruby-Lingo      # đổi thành đường dẫn repo của bạn
> ls -ld ~/Ruby-Lingo                            # phải thấy '<bạn> <bạn>', không còn 'root root'
> ```

> ⚠️ **Trạng thái repo (public/private) quyết định cách clone — kiểm trước khi gõ lệnh.**
> Trong repo có mã nguồn nhưng **không** có dữ liệu trẻ em và **không** có `.env` (xem 0.5),
> nên để **public** là chấp nhận được. Nếu để **private** thì VPS phải có deploy key hoặc PAT
> (mục 5) — và khi đó phải nhớ `sudo` làm git dùng khoá SSH của **root**, không phải của bạn.

### 0.1b. Docker: tài khoản của bạn có cần `sudo` không?

Trả lời câu này **trước** khi chạy deploy, vì nó quyết định bạn gõ `./scripts/deploy.sh` hay
`sudo ./scripts/deploy.sh`:

```bash
docker info >/dev/null 2>&1 && echo "OK — không cần sudo" || echo "CẦN sudo (hoặc chưa vào nhóm docker)"
```

- **Không cần sudo** ⇒ gõ `./scripts/deploy.sh` như mọi lệnh khác. Gọn nhất.
- **Cần sudo** ⇒ hai lựa chọn:
  - `sudo ./scripts/deploy.sh` — nhanh, nhưng container chạy bằng `root` nên `./data` và
    `./backups` sẽ thuộc `root` (xem mục 4). Chấp nhận được cho MVP.
  - Thêm mình vào nhóm `docker`, rồi **đăng xuất và đăng nhập lại** — nhóm chỉ có hiệu lực ở
    phiên mới, nên nếu thấy "vẫn phải sudo" thì thường là chưa thoát phiên:
    `sudo usermod -aG docker "$USER"`



Kiểm nhanh (đều phải xanh):

```bash
git log -1 --oneline                                                  # có lịch sử
ls -l Dockerfile docker-compose.yml .env.example scripts/deploy.sh    # deploy.sh phải có 'x'
find public/assets/words -name '*.webp' | wc -l                       # 201
ls -1 server/db/migrations/*.sql | wc -l                              # 10
```

### 0.2. Tạo `.env` **TRÊN VPS** (không lấy từ repo)

```bash
cp .env.example .env
# điền ĐÚNG 4 biến: SUBDOMAIN · DOMAIN_NAME · TRAEFIK_CERTRESOLVER · SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # SESSION_SECRET
```

⚠️ `TRAEFIK_CERTRESOLVER` là **chỗ dễ sai nhất của cả quá trình deploy** — xem mục 1.
Các biến còn lại (`NODE_ENV`, `COOKIE_SECURE`, `PUBLIC_ORIGIN`, `LOG_LEVEL`, `HOST`, `PORT`,
`DB_PATH`) **không** cần khai cho production: `docker-compose.yml` ghi đè hết (khối `environment`).

Chi tiết từng biến: mục 1.

### 0.3. Deploy lần đầu

```bash
./scripts/deploy.sh
```

### 0.4. Cập nhật về sau — `./scripts/update.sh`

```bash
./scripts/update.sh                 # fetch → xem có gì mới → pull --ff-only → deploy (5 bước kiểm)
FORCE=1 ./scripts/update.sh         # build lại DÙ không có commit mới
```

Script **dừng lại** (chứ không tự "xử lý") trong ba trường hợp, vì cả ba đều là việc của con người:

| Bước | Dừng khi | Vì sao không tự xử lý |
|---|---|---|
| 2 | `data/` · `backups/` · `.env` **đang bị git theo dõi** | dữ liệu trẻ em / bí mật đã lọt — pull sẽ càng làm nặng |
| 4 | cây có thay đổi với tệp **được theo dõi** | ai đó sửa tay trên VPS ⇒ pull sẽ xung đột |
| 5 | `git pull --ff-only` thất bại (lịch sử phân kỳ) | **không bao giờ** tạo merge commit trên server |

> ⚠️ Script **không** chép lại logic kiểm chứng của `deploy.sh` — nó `exec ./scripts/deploy.sh` ở
> bước cuối. Hai bản sao thì bản này sẽ lệch, và lệch theo hướng tệ nhất: *"tưởng là đã kiểm"*.

### 0.5. ⚠️ Những gì **KHÔNG** nằm trong repo — và vì sao `git pull` không bao giờ đụng vào

| Không commit | Chứa gì | Nếu lọt lên GitHub |
|---|---|---|
| `data/` | DB SQLite: biệt danh, tuổi, avatar, tiến độ học của **trẻ em** | rò rỉ dữ liệu trẻ em (vi phạm COPPA/GDPR-K) |
| `backups/` | bản sao của chính DB đó | như trên |
| `.env` | `SESSION_SECRET` | giả mạo được phiên đăng nhập |

⚠️ **Git giữ lịch sử VĨNH VIỄN**: xoá ở commit sau **không** xoá khỏi commit trước. Nếu những thứ
này đã từng được commit thì phải **viết lại lịch sử** (lọc repo) và **đổi `SESSION_SECRET`** —
`scripts/update.sh` bước 2 chặn đúng tình huống này trước khi pull.

`asset-src/words/source/` (291 MB ảnh PNG thô) cũng bị loại: thành phẩm đã ở
`public/assets/words/*.webp`, và giữ ảnh thô trong git nghĩa là **mọi lần `git clone`/`pull`** đều
phải kéo hàng trăm MB không dùng tới. Tệp vẫn nằm trên máy dev và sinh lại được từ `plan.json` +
`subjects.py` (đều **được** commit).

### 0.6. Đường DỰ PHÒNG — khi không dùng được GitHub

```bash
./scripts/pack-for-vps.sh                     # → ../rubylingo-src-<ISO-UTC>.tar.gz (~9 MB)
scp ../rubylingo-src-*.tar.gz user@vps:/tmp/
# trên VPS: tar -xzf … -C /srv/rubylingo   (rồi tự đối chiếu với commit đang chạy)
```

Dùng khi: GitHub không truy cập được, hoặc cần dựng lại đúng một bản cũ mà không muốn `git pull`.
Script dùng **whitelist** (chỉ đưa những gì đã liệt kê) và tự kiểm 7 chốt trước khi báo xong —
trong đó chốt đáng giá nhất là **mọi nguồn `COPY` của `Dockerfile` phải có trong gói**, tức là
"gói này build được", không chỉ "gói này có `src/`".

> ⚠️ Gói tar **không có lịch sử commit** ⇒ sau khi giải nén, `git status` sẽ cho thấy một cây hỗn
> độn so với bản clone. Đây là đường thoát hiểm, không phải luồng thường ngày.

---

## 1. Deploy

### Chuẩn bị `.env` (cùng thư mục với `docker-compose.yml`)

```
SUBDOMAIN=rubylingo                    # dùng cho Host(...) của Traefik
DOMAIN_NAME=example.com                # tên miền GỐC, KHÔNG kèm subdomain
TRAEFIK_CERTRESOLVER=<tên THẬT>        # ⚠️⚠️ xem khối ngay dưới — KHÔNG phải 'mytlschallenge'
SESSION_SECRET=<chuỗi ngẫu nhiên ≥32 ký tự>
```

> ⚠️ `COOKIE_SECURE`, `PUBLIC_ORIGIN`, `NODE_ENV`, `LOG_LEVEL` **không** cần điền: `docker-compose.yml`
> ghim chúng trong khối `environment`, và `environment` thắng `env_file`. `PUBLIC_ORIGIN` được compose
> tự dựng từ `SUBDOMAIN` + `DOMAIN_NAME` (nên nó luôn khớp `Host(...)` — lệch một ký tự là mọi request
> GHI trả 403, lỗi S5).

### ⚠️⚠️ `TRAEFIK_CERTRESOLVER` — chỗ dễ sai nhất, và nó hỏng IM LẶNG

Đây **không** phải biến của RubyLingo. Nó là **khoá** trong `certificatesResolvers.<TÊN>` của cấu
hình **TĨNH** Traefik đã có sẵn trên VPS bạn. Giá trị mẫu `mytlschallenge` là tên **ví dụ trong tài
liệu Traefik**, gần như chắc chắn không phải tên của bạn.

**Tìm tên thật trên VPS:**

```bash
docker inspect traefik --format '{{json .Config.Cmd}}' | tr ',' '\n' | grep -i certresolvers
# hoặc mở traefik.yml / command: của service traefik, tìm --certificatesresolvers.<TÊN>.
```

**Vì sao điền sai lại nguy hiểm:** một tên SAI vẫn tạo ra router **HỢP LỆ** — `docker compose config`
xanh, container chạy, `/api/health` trả `ok`. Traefik chỉ **lặng lẽ không xin được chứng chỉ**. Hệ quả:

| Triệu chứng người dùng thấy | Thực tế |
|---|---|
| Trình duyệt báo lỗi chứng chỉ | Traefik không có cert để phục vụ |
| Site coi như chết (kể cả `http://`) | router HTTP đá sang HTTPS — mà HTTPS không dựng được |
| `deploy.sh` bước 5 đỏ: *"Traefik không tới được app"* | **chỉ sai chỗ cần sửa** — người trực sẽ đi kiểm cổng 3000, mạng `traefik_network`, nhãn `loadbalancer.server.port`… trong khi lỗi nằm ở tên resolver |

Vì vậy `docker-compose.yml` dùng `${TRAEFIK_CERTRESOLVER:?…}`: **trống hay thiếu đều làm
`docker compose up` dừng ngay** kèm đúng tên biến cần điền — biến lỗi im lặng thành lỗi ở bước 1.

Sinh `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> ⚠️ **KHÔNG commit `.env`.** `.dockerignore` đã loại nó khỏi image (lỗi S6), nhưng nó vẫn không
> được vào git.

### Chạy deploy

```bash
./scripts/deploy.sh          # thêm 'sudo' nếu docker đòi — kiểm bằng §0.1b
```

Script **build → up → 5 bước kiểm** và **chỉ báo thành công khi cả 5 bước xanh**:

| Bước | Kiểm gì | Chặn lỗi |
|---|---|---|
| 1 | `docker compose config` + soi giá trị đã thay thế + **in tên `certresolver`** | biến rỗng ⇒ `Host(.)` 404 / `https://.` 403 (A) · tên resolver sai ⇒ HTTPS chết mà không dấu vết |
| 2 | chờ app sẵn sàng, rồi số migration trong image == nguồn | image thiếu `.sql` ⇒ schema rỗng (S3/C) |
| 3 | `./data/rubylingo.db` có thật trên host | DB ghi ngoài volume ⇒ mất khi thay container (S1) |
| 4 | `/api/health`: `migrationsApplied` == số tệp migration | DB chưa migrate mà health vẫn "ok" (S3) |
| 5 | poll `https://<tên miền>/api/health` tới 200 | crash-loop ⇒ 502 vĩnh viễn (B) · chứng chỉ sai tên resolver |

> ⚠️ **Bước 5 đỏ thì kiểm CHỨNG CHỈ TRƯỚC TIÊN** — `curl -vI https://<tên miền>/`. Lỗi chứng chỉ ⇒
> `TRAEFIK_CERTRESOLVER` sai tên (xem §1). Nó không để lại dấu vết nào trong log app, và thông báo
> đỏ *"Traefik không tới được app"* sẽ khiến bạn đi kiểm cổng/mạng — tức **sai chỗ cần sửa**.

> ⚠️ Đừng "sửa" lỗi 502 bằng cách thêm `ports:` vào compose — cổng 3000 **không** được lộ ra
> Internet; Traefik là cửa duy nhất.

---

## 2. Backup

```bash
./scripts/backup-db.sh                  # giữ 7 ngày (mặc định)
RETENTION_DAYS=14 ./scripts/backup-db.sh
```

- Bản sao ghi vào `./backups/` (**ngoài** volume `./data`; script **từ chối** chạy nếu `BACKUP_DIR`
  nằm trong `./data`).
- Dùng **SQLite Online Backup API** qua `better-sqlite3` (không `cp` tệp đang mở, không cần CLI
  `sqlite3` — image runtime không có nó).
- Mỗi bản được kiểm **ngay**: `PRAGMA integrity_check` + `PRAGMA foreign_key_check`; hỏng ⇒ script
  thoát khác 0.
- Cron: xem `deploy/backup-cron.example`.

### ⚠️ Hai việc bắt buộc để backup có ý nghĩa

1. **Thử phục hồi MỘT LẦN** vào DB tạm (mục 3 dưới). Bản sao chưa từng mở lại thì chưa được gọi là
   backup.
2. **Đẩy bản sao ra khỏi máy** (rsync/scp máy khác, hoặc `rclone` lên object storage). `./backups`
   cùng ổ đĩa với `./data` thì hỏng ổ là mất cả hai. *Việc theo dõi — chưa làm ở T078.*

---

## 3. QUY TRÌNH PHỤC HỒI

> ⚠️ **KHÔNG phục hồi khi app đang chạy.** SQLite đang mở DB; ghi đè tệp dưới chân nó có thể để lại
> trạng thái hỗn hợp giữa `.db` mới và `-wal` cũ.

### Bước 0 — Chọn bản sao

```bash
ls -lh backups/            # tên theo ISO UTC ⇒ sắp xếp theo tên = theo thời gian
```

### Bước 1 — Kiểm bản sao TRƯỚC khi động vào DB thật

```bash
# copy bản sao vào container rồi integrity_check trên chính byte sẽ phục hồi
docker compose cp backups/<tệp>.db rubylingo:/tmp/restore-test.db
docker compose exec -T rubylingo node -e '
import("better-sqlite3").then((m) => {
  const db = new m.default("/tmp/restore-test.db", { readonly: true });
  console.log(JSON.stringify(db.pragma("integrity_check")));
  db.close();
});'
docker compose exec -T rubylingo rm -f /tmp/restore-test.db
```

Phải in ra `[{"integrity_check":"ok"}]`. **Nếu không phải `ok` ⇒ DỪNG**, chọn bản sao khác.

### Bước 2 — Dừng app

```bash
docker compose down
```

> ⚠️⚠️ **TUYỆT ĐỐI KHÔNG `docker compose down -v`.** `-v` **XOÁ VOLUME** ⇒ xoá luôn DB và cả
> `./data`. Một chữ `-v` là mất sạch dữ liệu học của các bé.

### Bước 3 — Giữ lại bản đang có (đường lùi)

```bash
cp data/rubylingo.db "data/rubylingo.db.before-restore-$(date -u +%Y%m%dT%H%M%SZ)"
```

> Nghe thừa, nhưng đây là đường lùi khi bản backup bạn chọn hoá ra cũng không ổn. Sau khi mọi thứ
> xác nhận tốt thì xoá tệp này.

### Bước 4 — Thay DB **và xoá WAL/SHM cũ**

```bash
cp backups/<tệp>.db data/rubylingo.db
rm -f data/rubylingo.db-wal data/rubylingo.db-shm
```

> ⚠️ **Phải xoá `-wal` và `-shm`.** Chúng thuộc DB CŨ; để lại thì SQLite có thể áp WAL cũ lên DB
> mới ⇒ trạng thái trộn giữa hai bản, và không có thông báo nào.

### Bước 5 — Khởi động lại và kiểm

```bash
docker compose up -d
# đợi app sẵn sàng rồi kiểm:
docker compose exec -T rubylingo node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.text()).then(t=>console.log(t))"
```

`migrationsApplied` phải bằng số tệp trong `server/db/migrations/` (**hiện 10**). Nếu nhỏ hơn ⇒
bản sao thuộc phiên bản cũ; app vẫn chạy được vì `runMigrations()` chạy lúc khởi động, nhưng hãy
xác nhận số đó đã đúng **sau khi** app lên.

### Bước 6 — Kiểm bằng mắt (quan trọng nhất)

Mở `https://<tên miền>`, đăng nhập, và kiểm: danh sách bé, một hồ sơ bé, ví ⭐/🌰, tiến độ một
chủ đề. Bước 5 chỉ nói "DB mở được"; chỉ bước 6 mới nói "dữ liệu của bé còn đúng".

---

## 4. Ghi chú

- **Quyền ghi**: container chạy bằng `root` (chấp nhận cho MVP). `./data` là bind mount từ host ⇒
  tệp do app tạo thuộc `root`. Nếu hạ quyền chạy container, phải `chown` lại `./data` **và**
  `./backups` — nếu không, app không ghi được DB và backup không ghi được tệp (cùng họ lỗi S1).
- **Nhật ký**: `docker compose logs --tail=200 rubylingo`.
- **`HTTP` bị đá sang `HTTPS`** bởi router phụ của Traefik — PWA và Web Speech chỉ chạy trên HTTPS.
- **`.gitattributes`** ghim `*.sh`/`*.sql`/`Dockerfile` về **LF**. Máy dev là Windows, VPS là Linux;
  một tệp `.sh` có CRLF khi chạy trên Linux sẽ chết ngay dòng đầu với
  `bad interpreter: No such file or directory` — nhìn như "script hỏng" chứ không như "sai xuống
  dòng". Tệp này khiến quy tắc đúng trên **mọi máy**, không phụ thuộc `core.autocrlf` cục bộ.
- **CI có BA job, không phải một** (`.github/workflows/ci.yml`) — biết để đọc đúng tab **Actions**:
  | Job | Kiểm gì | Vì sao cần riêng |
  |---|---|---|
  | `ci` | y hệt `npm run ci` ở máy: typecheck · lint · validate:content · sinh tệp · **1384 unit test** — cộng ba chốt hạ tầng (bit thực thi · tệp bắt buộc · biến bắt buộc trong `.env.example`) và **cổng kiểm tệp workflow** | tầng rẻ nhất, bắt lỗi nhanh nhất |
  | `e2e` | Playwright trên **Chromium thật**, 3 viewport (360/820/1280): đăng ký → tạo bé → bản đồ, thanh điều hướng dưới, một bài học thẻ từ | tầng DUY NHẤT chứng minh app chạy được đầu-cuối — unit test chạy trên jsdom nên **không** render CSS, **không** có cookie thật, **không** đi qua HTTP |
  | `docker-image` | `docker build` | bắt `COPY failed: file not found` **trước** khi lên VPS |

  `e2e` khai `needs: ci` ⇒ chỉ chạy khi tầng unit đã xanh (không đốt 5 phút để kết luận lại điều cũ).
  ⚠️ **Chỉ deploy khi cả ba xanh.** `./scripts/update.sh` kéo mã mới về nhưng **KHÔNG** tự kiểm CI —
  hãy nhìn tab **Actions** trước khi chạy nó.

- **Cổng kiểm tệp workflow** (bước 2 của job `ci`): `.github/workflows/*.yml` là tệp **duy nhất**
  trong repo mà `npm run ci` không đọc tới, nên trước đây nó không có cổng nào phủ. Ba loại lỗi lọt
  qua `js-yaml` (chỉ bắt YAML hỏng cú pháp) đều khiến GitHub **không chạy job nào**: khoá sai chính tả
  trong step (`withh:` thay vì `with:`), `needs:` trỏ job không tồn tại, biểu thức `${{ }}` sai.
  Bước này tải **actionlint 1.7.12** bản ghim, **đối chiếu sha256** với bản phát hành chính thức rồi
  chạy không kèm đường dẫn ⇒ tự quét **mọi** workflow, kể cả tệp thêm sau này. `shellcheck` 0.9.0
  đã có sẵn trong runner nên các khối `run:` cũng được lint luôn.
  Muốn chạy ở máy: tải `actionlint_1.7.12_windows_amd64.zip` từ trang phát hành của actionlint, giải
  nén, rồi chạy `actionlint` **từ gốc repo** (không truyền đường dẫn tệp).

---

## 5. Cho VPS quyền đọc repo PRIVATE

> ⚠️ **Repo đang để PUBLIC ⇒ BỎ QUA CẢ MỤC NÀY.** Trên repo public, `git clone`/`git pull` qua
> **HTTPS** không cần danh tính gì cả:
> ```bash
> sudo git clone https://github.com/<user>/<repo>.git /srv/rubylingo
> ```
> Chỉ đọc tiếp khi repo là **PRIVATE**.

VPS phải chứng minh danh tính với GitHub mỗi lần `git fetch`/`pull`. Hai cách, **đều không cần
nhúng mật khẩu tài khoản vào VPS**:

### ⚠️⚠️ TRƯỚC KHI LÀM GÌ: `sudo` làm git dùng khoá SSH của **root**, KHÔNG phải của bạn

Mục 0.1 hướng dẫn `sudo git clone …`. `sudo` chạy git với tư cách **root** ⇒ git đọc
`/root/.ssh/config` và `/root/.ssh/id_*`, **KHÔNG** đọc `~/.ssh/` của tài khoản thường. Nếu bạn tạo
deploy key bằng tài khoản thường rồi `sudo git clone`, kết quả là:

```text
git@github.com: Permission denied (publickey).
```

⇒ Hoặc tạo khoá **bằng `sudo`** (khoá nằm ở `/root/.ssh/` — mọi lệnh `ssh-keygen`/`cat` dưới đây
phải thêm `sudo`), hoặc **bỏ `sudo`** ở bước clone rồi `sudo chown -R "$USER" /srv/rubylingo`.
Cách gọn nhất khi repo là **public**: dùng HTTPS và quên hẳn chuyện khoá.

### Cách A — Deploy key (khuyến nghị: quyền hẹp nhất, thu hồi được riêng)

```bash
# TRÊN VPS
ssh-keygen -t ed25519 -C "rubylingo-vps" -f ~/.ssh/rubylingo_deploy -N ""
cat ~/.ssh/rubylingo_deploy.pub          # dán vào GitHub → repo → Settings → Deploy keys
```

Trên GitHub: **Settings → Deploy keys → Add deploy key**, dán khoá công khai, **KHÔNG** tick
*Allow write access* (VPS chỉ cần đọc).

```bash
# TRÊN VPS — nói cho git dùng khoá này cho đúng host GitHub
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/rubylingo_deploy
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
ssh -T git@github.com        # phải thấy "successfully authenticated"
```

⚠️ Dùng URL dạng **SSH** khi clone: `git clone git@github.com:<user>/<repo>.git`.
⚠️ Khoá bị lộ ⇒ chỉ thu hồi được **một repo** (đó là ưu điểm so với PAT).

### Cách B — Fine-grained PAT

Tạo token ở GitHub → **Settings → Developer settings → Fine-grained tokens**, cấp quyền
**Contents: Read-only** cho **đúng một repo**. Dùng URL HTTPS:

```bash
git clone https://<TOKEN>@github.com/<user>/<repo>.git
```

> ⚠️ Token nằm trong `.git/config` ⇒ **lộ theo mọi bản sao của thư mục repo**, và `git remote -v`
> in nó ra. Ưu điểm duy nhất so với cách A là không phải tạo khoá SSH. **Ưu tiên cách A.**

⚠️ **Không bao giờ** đặt token trong `.env` của app hay trong `docker-compose.yml` — đó là bí mật
của **git**, không phải của ứng dụng, và `docker-compose.yml` nằm trong repo.
