# RubyLingo — THIẾT KẾ BÀI THI CUỐI KHOÁ (Starters Final Assessment)

> **Loại tài liệu:** THIẾT KẾ + KẾ HOẠCH TRIỂN KHAI (không chứa mã triển khai, chỉ đặc tả).
> **Người viết:** general-purpose-15 (teammate) · **Ngày:** 2026-10-10.
> **Nguồn dữ kiện:** đọc trực tiếp mã nguồn (đường dẫn + số dòng ghi kèm), cộng với cấu trúc bài thi
> Cambridge Pre A1 Starters do team-lead cung cấp (đã xác minh từ cambridgeenglish.org — dùng nguyên
> số liệu, KHÔNG sửa).
> **Phạm vi:** chỉ thiết kế. KHÔNG sửa code, KHÔNG sửa JSON nội dung, KHÔNG tạo migration thật.

---

## 0. Bất biến phải giữ (mọi phương án dưới đây phải tuân thủ)

Trích từ chính mã nguồn — đây là ràng buộc, không phải gợi ý:

| # | Bất biến | Nguồn chân lý trong code |
|---|---|---|
| B1 | **KHÔNG BAO GIỜ 0 sao / 0 khiên.** Hoàn thành là đã có thưởng. | `shared/game-scoring.ts:11-21`, `starsForRun` (`:178`), `clampStarsBest` (`:163`) |
| B2 | **KHÔNG trừ điểm khi sai.** Sai chỉ là "chưa tìm ra", không phạt. | `shared/game-scoring.ts:15`, `pointsForRound` (`:219`) |
| B3 | **KHÔNG có đồng hồ.** Điểm chỉ theo độ đúng, không theo tốc độ. | `shared/game-scoring.ts:17` |
| B4 | **Server là trọng tài cuối.** Client gửi SỰ THẬT THÔ, server tự chấm. Client KHÔNG có trường `score`/`stars`/`shields` trong hợp đồng. | `shared/types/progress.ts:143-159`, `GameResultService.submit` (`:320`) |
| B5 | **Không mắng trẻ, không xếp hạng, không đỗ/trượt.** | `docs/ux-20261009/THIET-KE.md` §0 |
| B6 | **XP chỉ qua `XpService.addXpInTx`.** | `server/services/XpService.ts`, `GameResultService.ts:57-59` |
| B7 | **Âm thanh chỉ đọc tiếng Anh (`en-GB`); tiếng Việt chỉ hiển thị.** Tắt tiếng KHÔNG được tắt trình đọc màn hình (screen reader vẫn hoạt động). | `docs/ux-20261009/THIET-KE.md` §0; `src/pages/ThemePage.tsx` dùng `aria-label` |
| B8 | **Màu/cỡ chữ/bo góc/vùng chạm chỉ lấy từ `src/styles/tokens.css`.** Chữ ≥ 16px, vùng chạm ≥ 64px. | `src/styles/tokens.css`; `src/pages/ThemePage.tsx:98,340` |
| B9 | **Mọi thay đổi phải KIỂM CHỨNG** (`npm run ci`). | `package.json:30` |
| B10 | **Migration là BẤT BIẾN** — chỉ thêm file mới, đánh số tiếp. Hiện có `001`–`012`. | `server/db/migrate.ts`; `server/db/migrations/` |

---

## 1. Điều kiện mở khoá bài thi cuối khoá

### 1.1 Định nghĩa chính xác "học hết + chơi hết 11 chủ đề"

Chủ dự án yêu cầu: *sau khi bé đã **học HẾT** và **chơi HẾT game** của 11 chủ đề Starters thì mới mở
bài thi cuối khoá*. Cần định nghĩa hai vế này bằng **dữ liệu hiện có**, không phát minh trạng thái mới:

**Vế A — HỌC HẾT** (đọc `ProgressSnapshot.lessons`, KHÔNG đọc `snapshot.themes[].lessonsCompleted`):

> Với **mọi** chủ đề trong `level.themeIds` (`src/data/levels/starters/level.json:8-20`), **mọi** bài
> trong `theme.lessonIds` phải có `LessonProgress.completed === true`.

- `LessonProgress.completed` (`shared/types/progress.ts:42`) là cờ DUY NHẤT nghĩa "bé học xong bài",
  được đặt bởi `ProgressService.applyLessonCompleted` (`server/services/ProgressService.ts:444`) — đúng
  định nghĩa mà `QuestService`/`BadgeService` đã dùng cho `complete_lesson`/`complete_theme`
  (`BadgeService.ts:23-43,161-166`). **Dùng chung định nghĩa, không tạo định nghĩa thứ hai.**
- Lý do đọc từ `snapshot.lessons` (bản ghi TỪNG bài) chứ không từ số tổng hợp
  `ThemeProgress.lessonsCompleted`: bản ghi từng bài client có NGAY kể cả khi offline — cùng lý do đã
  ghi ở đầu `shared/theme-access.ts:36-43`.

**Vế B — CHƠI HẾT GAME** (đọc `GameResultSummary` theo từng `exerciseId`):

> Với **mọi** exercise **đang tồn tại và chơi được** của level đó, phải có một
> `GameResultSummary` với `bestStars >= 1`.

- `GameResultSummary` (`shared/types/progress.ts:264`) gộp theo `exerciseId`, do server trả qua
  `GET /api/children/:id/game-results` (`server/routes/progress.ts:130`, `GameResultService.listGameSummaries`
  `:540`). Hàng có thật KHÔNG BAO GIỜ `0 ★`, nên `bestStars >= 1` ⟺ "đã chơi" (xem `ThemePage.tsx:366-373`).
- **"chơi được"** = `gameType` có component: `isGamePlayable()` (`src/components/games/shared/registry.ts:52`).
  Hiện tại cả 73 exercise dùng `memory_match` + 4 loại của `at-the-zoo`, **tất cả đều có component**.

Con số hiện tại (từ `docs/ke-hoach/hien-trang-game-theo-chu-de.md`): **11 chủ đề · 43 bài · 275 từ · 73 exercise**.
⇒ Điều kiện thoả được NGAY hôm nay (mọi chủ đề đều đã có ít nhất `memory_match`).

### 1.2 Hàm thuần dùng chung client + server

Đặt tại **`shared/final-test-access.ts`** (giống khuôn mẫu `shared/theme-access.ts`: hàm thuần, không
React, không `fetch`, không `Date.now`). Lý do ở `shared/`: **luật nghiệp vụ** này server cũng phải
đọc để tự kiểm điều kiện trước khi chấm (chống gian lận — xem §6.4), và để client/server không lệch.

**Kiểu dữ liệu:**

```ts
// shared/final-test-access.ts
import type { ProgressSnapshot } from './types/progress.js';
import type { GameResultSummary } from './types/progress.js';

/** Nội dung tĩnh mà luật cần — client lấy từ LevelBundle, server lấy từ content-index (xem §6.4). */
export interface FinalTestThemeRequirement {
  themeId: string;
  themeName_vi: string;
  /** Mọi bài của chủ đề (thứ tự = thứ tự bản đồ). */
  lessonIds: readonly string[];
  /** Các exercise đang tồn tại VÀ chơi được của chủ đề. */
  playableExerciseIds: readonly string[];
}

export type FinalTestAccessKind =
  | 'locked'      // chưa đủ điều kiện
  | 'ready';      // đủ điều kiện, bé chưa làm (hoặc đã làm, được làm lại vô hạn)

export type FinalTestRequirement =
  | { type: 'lessons_incomplete'; themeCount: number; completedCount: number;
      missingThemeIds: readonly string[] }
  | { type: 'games_unplayed'; exerciseCount: number; playedCount: number;
      missingExerciseIds: readonly string[] };

export interface FinalTestAccess {
  kind: FinalTestAccessKind;
  enterable: boolean;                 // = (kind === 'ready')
  requirement: FinalTestRequirement | null;   // còn thiếu gì
  lessonsCompleted: number;
  lessonsTotal: number;
  exercisesPlayed: number;
  exercisesTotal: number;
}

/** Chữ ký hàm — HÀM THUẦN, kiểm thử được trực tiếp. */
export function resolveFinalTestAccess(
  themes: readonly FinalTestThemeRequirement[],
  snapshot: ProgressSnapshot,
  playedExerciseIds: ReadonlySet<string>,
): FinalTestAccess;
```

**Ngữ nghĩa trả về:**
- `kind = 'locked'`: thiếu bài HOẶC thiếu game. `requirement` chọn **cái thiếu ĐẦU TIÊN theo thứ tự
  ưu tiên: bài trước, game sau** (để câu hướng dẫn cho bé không nhảy lung tung).
- `kind = 'ready'`: `enterable = true`. **KHÔNG có trạng thái "đã thi rồi thì khoá"** — bé được làm
  lại **không giới hạn** (xem §4.3).

### 1.3 Ca biên và cách xử lý

| Ca biên | Cách xử lý | Căn cứ |
|---|---|---|
| **Chủ đề chưa có game** (`playableExerciseIds` rỗng) | Chủ đề đó **không đóng góp** gì vào vế B (yêu cầu rỗng ⇒ thoả hiển nhiên). Không hiện "0/0 game" cho bé; UI ghi *"Trò chơi của chủ đề này đang được bổ sung"* (câu trấn an, không phải lời chê). | `shared/theme-access.ts:153-159` (chủ đề 0 nội dung ⇒ bỏ qua, không khoá) |
| **Chủ đề chưa có bài** (`lessonIds` rỗng) | Bỏ qua y hệt — không thể "hoàn thành" thứ không tồn tại. | `theme-access.ts:198` |
| **Bài chưa có exercise** | Vế B không tính bài đó; vế A vẫn tính. | — |
| **Bé chơi offline rồi bật mạng** | Vế A đọc `snapshot.lessons` (client áp sự kiện tại chỗ khi offline — `progress-merge.ts`); vế B đọc từ kênh `game-results` chỉ-đọc (react-query). Khi **chưa có mạng**, `useGameResults` trả `Map` rỗng ⇒ có thể trông "chưa chơi hết". Xử lý: khi `gameResults` chưa hydrate, cổng ở trạng thái **trung tính** ("Đang tải…"), KHÔNG báo "còn thiếu" — tránh mắng oan. | `ThemePage.tsx:74-84` (`isHydrated`), `useGameResults` (`src/hooks/useGameResults.ts`) |
| **Bé mở máy thứ hai** (tiến độ còn ở máy 1) | Cả hai vế đều là **thành tựu chỉ-tăng** và server là nguồn cuối; máy 2 sau khi đồng bộ sẽ thấy đúng. Cổng không bao giờ tự mở dựa trên dữ liệu chỉ có ở máy này. | `shared/progress-merge.ts` (luật LWW + sticky) |
| **Bài chưa có exercise -> exercise mới được thêm sau** | Ngưỡng tự **nâng lên** khi nội dung lớn thêm. Đây là hành vi ĐÚNG (bé cần chơi game mới), nhưng phải ghi rõ là **quyết định** — xem câu hỏi Q1 ở §9. |
| **Game `say_it` cần micro (P1)** | Chỉ tính exercise mà `gameType` có component **và** máy này chơi được (`isExercisePlayable`). Nhưng để nhất quán **liên-máy-bay**, ngưỡng dùng tập **playable theo mã nguồn** (`isGamePlayable`), KHÔNG dùng tập theo thiết bị. | `ThemePage.tsx:289-293` |

### 1.4 Lựa chọn khác đã cân nhắc (và bác bỏ)

- **Chỉ cần "học hết" (bỏ vế B).** Bác bỏ: chủ dự án yêu cầu rõ "học hết **và** chơi hết", và chơi
  game là cách duy nhất bé luyện phản xạ nghe/đọc mà flashcard không có.
- **Yêu cầu đạt N sao ở mỗi chủ đề.** Bác bỏ: sao là KỶ LỤC có thể đạt muộn; ép ngưỡng sao biến cổng
  mở khoá thành áp lực điểm số — trái B5 và tinh thần "không tạo áp lực".
- **Đếm theo `ThemeProgress` tổng hợp.** Bác bỏ: xem lý do offline ở §1.1 (và `theme-access.ts:36-43`).

---

## 2. Mô hình dữ liệu bài thi

### 2.1 So sánh hai phương án

| Tiêu chí | **Phương án A — mở rộng `Exercise`/`GameType`** | **Phương án B — nội dung tĩnh JSON mới `final-test/`** |
|---|---|---|
| Có tái dùng được 5 component game? | Có, nhưng phải nhồi dạng "nối tên / đánh tick-cross / viết yes-no / xếp chữ / điền khuyết / kể chuyện" vào 12 `GameType` hiện có — phần lớn KHÔNG khớp bản chất (ví dụ Part 3 Listening "chọn 1 trong 3 tranh" không phải game nào trong 12 loại). | Có — tái dùng 3–4/5 component (xem §3); dạng không khớp thì thêm component MỚI có chủ đích. |
| Rủi ro nghiệp vụ | Rất cao: `Exercise` gắn chặt với `LessonProgress.starsBest`, `game_result` (điểm/sao/xp), huy hiệu `win_game`, nhiệm vụ `play_games`, chip trò chơi ở `ThemePage`. Nhồi bài thi vào đây sẽ **làm bẩn sổ của bé** và đếm sai nhiệm vụ/huy hiệu. | Thấp: bài thi là **miền dữ liệu riêng**, không chạm `game_result`/`lesson_progress`. |
| Ảnh hưởng `validate-content.ts` | Phải nới nhiều luật (V7 4–8 từ/bài, V20 phủ từ, V11 picturable…) — nới luật nội dung học để lọt bài thi là mở đường cho dữ liệu hỏng. | Thêm luật MỚI V21+ **tách riêng** cho bài thi; không đụng luật cũ. |
| Ảnh hưởng `gen:content-index` | Phải chép `exercises` (hiện CỐ Ý bỏ — "không ai đọc"). | Chỉ thêm **khối tóm tắt nhỏ** (đếm part/item) + danh sách `requiredExerciseIds` cho cổng (thứ server THẬT SỰ đọc). |
| Đúng kiến trúc sẵn có | Lệch: "thêm cấp Movers/Flyers = thêm JSON khớp kiểu, KHÔNG sửa code" (`content.ts:4-5`). Bài thi là thực thể mới, khác `Exercise`. | Đúng: cùng tinh thần "nội dung là dữ liệu, code thuần". |
| Idempotency / chống gian lận | Phải nhét bài thi qua `game-result` (gắn `clientEventId`) nhưng sai ngữ nghĩa `exerciseId`/`gameType`. | Bảng riêng + `clientEventId` riêng — sạch. |

### 2.2 Quyết định: **chọn Phương án B** — nội dung tĩnh mới

**Lý do cốt lõi:** bài thi là **một thực thể nghiệp vụ khác** (có "khiên", có phần Speaking không chấm
tự động, có 3 section độc lập), không phải một "bài tập game" thứ 13. Nhồi nó vào `Exercise` sẽ buộc
`lesson_progress`, `game_result`, huy hiệu, nhiệm vụ, chip trò chơi phải "hiểu" một khái niệm mà chúng
không có — đúng loại lỗi im lặng mà dự án đang chống (một `stars_best` bị ghi đè, một nhiệm vụ bị đếm
nhầm). Tách riêng giữ được **B1–B4** và giữ `game-scoring.ts` là nguồn chân lý DUY NHẤT cho điểm game.

### 2.3 Cấu trúc file đề xuất

```
src/data/levels/starters/final-test/
  manifest.json          # metadata: id, levelId, 3 section, số part/item, version, source: "original"
  listening.json         # 4 part · 20 câu
  reading-writing.json   # 5 part · 25 câu
  speaking.json          # 4 part (không chấm tự động — xem §3.4)
```

**Quy ước id** (theo đúng `content.ts:7-17`):
- Section: `starters.final-test.listening` · `…reading-writing` · `…speaking`
- Part:    `starters.final-test.listening.p1`
- Item:    `starters.final-test.listening.p1.q1`

### 2.4 Schema Zod mới (đặt tại `shared/schemas/content.ts`)

```ts
// --- Bài thi cuối khoá (Phương án B) ---
const finalTestSectionId = z.enum(['listening', 'reading-writing', 'speaking']);

/** Item có đáp án CHẤM ĐƯỢC tự động. */
const finalTestItemSchema = z.discriminatedUnion('interaction', [
  // Listening P1 (nối tên↔người), P2 (điền tên/số), Reading P1 (tick/cross), P2 (yes/no)
  z.object({
    id: idString, interaction: z.enum(['pick_name', 'write_word', 'tick_cross', 'yes_no']),
    audioTextEn: z.string().min(1).optional(),   // CHỈ tiếng Anh; TTS en-GB (B7)
    imageKey: z.string().min(1).optional(),
    promptEn: z.string().min(1).optional(),
    options: z.array(z.string().min(1)).min(2).max(6).optional(),
    answer: z.string().min(1),
  }),
  // Listening P3 (chọn 1 trong 3 tranh A/B/C), Reading P3 (xếp chữ)
  z.object({
    id: idString, interaction: z.enum(['choose_picture', 'arrange_letters']),
    audioTextEn: z.string().min(1).optional(),
    promptEn: z.string().min(1),
    options: z.array(z.string().min(1)).min(3).max(3).optional(),
    imageKeys: z.array(z.string().min(1)).length(3).optional(),
    answer: z.string().min(1),
    hintMask: z.string().min(1).optional(),      // gạch gợi ý số chữ cho em bé
  }),
  // Reading P4 (đoạn có chỗ trống + khung từ), P5 (kể chuyện, viết 1 từ)
  z.object({
    id: idString, interaction: z.enum(['gap_fill', 'story_answer']),
    promptEn: z.string().min(1),
    wordBox: z.array(z.string().min(1)).min(2).optional(),   // khung từ cho P4
    answer: z.string().min(1),
  }),
]);

const finalTestPartSchema = z.object({
  id: idString,
  index: z.number().int().min(1),
  title_vi: z.string().min(1),
  instruction_vi: z.string().min(1),      // tiếng Việt: CHỈ hiển thị (B7)
  items: z.array(finalTestItemSchema).min(1),
});

const finalTestSectionFileSchema = z.object({
  section: finalTestSectionId,
  title_vi: z.string().min(1),
  /** Listening/Reading & Writing chấm tự động; Speaking thì KHÔNG (xem §3.4). */
  autoScored: z.boolean(),
  /** Trần khiên của phần này — luôn = 5 (mô hình Cambridge), nền khiên = 1 (B1). */
  maxShields: z.literal(5),
  parts: z.array(finalTestPartSchema).min(1),
});

export const finalTestManifestSchema = z.object({
  id: idString,                 // "starters.final-test"
  levelId: idString,            // "starters"
  version: z.string().min(1),   // đổi khi sửa đề -> dùng cho cache-busting + thống kê
  /** BẮT BUỘC: khẳng định đề là nội dung TỰ SOẠN (bản quyền — xem §10). */
  source: z.literal('original'),
  sections: z.array(z.object({
    section: finalTestSectionId,
    partCount: z.number().int().min(1),
    itemCount: z.number().int().min(1),
    autoScored: z.boolean(),
  })).length(3),
});
export type FinalTestManifest = z.infer<typeof finalTestManifestSchema>;
```

> **Lưu ý schema:** `z.discriminatedUnion` đòi thành viên là `ZodObject` thuần; mọi `.refine()` phải
> gắn SAU union bằng `.superRefine()` — đúng cái bẫy đã ghi ở `shared/schemas/content.ts:150-158`.
> Các quy tắc ngữ nghĩa (đáp án nằm trong `options`, `hintMask` khớp `answer`, …) để ở validator, không
> nhét vào union.

### 2.5 `gen:content-index` phải cập nhật gì

`scripts/gen-content-index.ts` hiện quét `src/data/levels/*/themes/*.json`. Bổ sung **hai việc**:

1. **`requiredExerciseIds` cho mỗi level** — danh sách id exercise có `gameType` ∈ tập playable.
   *"Ai đọc nó?"* — **server**, để tự kiểm điều kiện mở khoá trước khi chấm (§6.4). Đây là lý do chính
   đáng để nới content-index (đúng luật "chỉ chép thứ server ĐỌC" ở `gen-content-index.ts:24-28`).
2. **Khối `finalTest` cho mỗi level** — `{ id, version, sections:[{section, partCount, itemCount, autoScored}] }`
   đọc từ `final-test/manifest.json`. Server cần nó để biết "bài thi gồm mấy phần, mỗi phần mấy câu,
   phần nào chấm tự động" khi chấm. **KHÔNG chép toàn bộ đề vào index** (đề nặng, không cần).

Cả `contentIndexFileSchema` (`shared/schemas/content.ts:639`) và test đối chiếu
`tests/unit/content/content-index.test.ts` phải cập nhật theo (đọc lại `src/data/`, so TỪNG trường).

### 2.6 `validate-content.ts` — luật V21..V27 mới

Thêm một hàm `validateFinalTest()` (chạy cạnh `validateLevels()`), KHÔNG sửa luật V1–V20:

| Luật | Nội dung | Vì sao là LỖI (không phải cảnh báo) |
|---|---|---|
| **V21** | `manifest.sections` khớp đúng 3 section `listening/reading-writing/speaking`, và khớp số part/item trong từng file. | Lệch ⇒ server chấm thiếu/thừa câu, khiên sai. |
| **V22** | Id item **duy nhất toàn level** (`starters.final-test.*`). | Trùng id ⇒ két/lưu tiến độ đè nhau (giống V4). |
| **V23** | Mọi item có `answer` **nằm trong `options`** (nếu có `options`). `gap_fill`/`write_word`/`story_answer`: `answer` là **1 từ** (không khoảng trắng), chữ thường-tiếng-Anh. | Bé không có cách nào chọn ra đáp án "đúng" ⇒ câu hỏi vô nghĩa (giống tinh thần V9 `prepositions` ở `schemas/content.ts:255-273`). |
| **V24** | `arrange_letters`: cho `answer` = `"elephant"`, `hintMask` phải cùng độ dài và hiện ≥ 1 chữ cái đầu; tập chữ cái xáo trộn phải bằng tập chữ của `answer`. | Nếu không ⇒ bé xếp mãi không ra, hoặc ra từ không có trong đáp án (oán). |
| **V25** | Mọi `audioTextEn` **chỉ chứa ký tự tiếng Anh** (không dấu tiếng Việt) — regex chặn dải dấu Unicode. | B7: máy chỉ đọc `en-GB`; lọt tiếng Việt vào đây sẽ đọc sai/không đọc. |
| **V26** | `maxShields === 5` cho mọi section; manifest khai đủ 3 section. | Trần khiên là hợp đồng với UI/thang điểm (§4). |
| **V27** | `manifest.source === 'original'`, và **không trường nào** trong đề chứa chuỗi nhận dạng đề Cambridge (danh sách đen các cụm như `"Cambridge"`, `"Pre A1 Starters sample"`, tên riêng nhân vật mẫu) — chặn copy ở tầng build (xem §10). | Bản quyền là ràng buộc cứng của chủ dự án; cổng build bắt được sớm hơn review tay. |

`scripts/validate-content.ts` đang in ra kết luận `0 lỗi, 0 cảnh báo` (`:745-751`) — V21..V27 nối vào
cùng `issues` stream, `process.exit(1)` nếu có lỗi.

---

## 3. Ánh xạ bài thi thật → bài thi trong app

Cấu trúc Cambridge Pre A1 Starters (số liệu team-lead cung cấp, giữ nguyên):

### 3.1 Listening — 4 part / 20 câu / ~20 phút / tối đa 5 khiên

| Part | Dạng đề Cambridge | Item kind (§2.4) | Component |
|---|---|---|---|
| Listening P1 | Tranh lớn + hội thoại, **nối tên với người** (5 câu) | `pick_name` | 🆕 **MỚI** `FinalDragConnect` (nối) — *hoặc* tái dùng tư duy `word_picture` (nối). |
| Listening P2 | Hội thoại ngắn + **ghi 1 tên hoặc 1 số** (5 câu) | `write_word` | ♻️ **`missing_letter`** (biến thể gõ chữ; hoặc `word_builder` khi lên P1). |
| Listening P3 | 5 hội thoại ngắn, **chọn 1 trong 3 tranh A/B/C** (5 câu) | `choose_picture` | 🆕 **MỚI** `ChoosePictureGame` (nghe → chọn 1/3 hình). |
| Listening P4 | Tranh lớn **7 đồ vật cùng loại**, nghe và **tô màu** (5 câu) | — | ⛔ **Không làm ở giai đoạn 1** (xem §3.5): chuyển thành `choose_picture` (nghe màu → chọn đồ vật đúng màu) để né tô-màu tự do. |

### 3.2 Reading and Writing — 5 part / 25 câu / 20 phút / tối đa 5 khiên

| Part | Dạng đề Cambridge | Item kind | Component |
|---|---|---|---|
| R&W P1 | 5 tranh + câu "This is a…", **đánh tick hoặc cross** (5 câu) | `tick_cross` | 🆕 **MỚI** `TickCrossGame` (đơn giản: 2 nút ✓ / ✗, hình lớn). |
| R&W P2 | Tranh lớn + câu, **viết yes/no** (5 câu) | `yes_no` | 🆕 **MỚI** `YesNoGame` (2 nút to "yes"/"no"). |
| R&W P3 | 5 tranh, **xếp chữ cái xáo trộn thành từ** (5 câu) | `arrange_letters` | ♻️ **`missing_letter`** mở rộng, *hoặc* `word_builder` (P1) khi xếp chữ. |
| R&W P4 | Đoạn văn có chỗ trống, **chọn từ ở khung** (5 câu) | `gap_fill` | 🆕 **MỚI** `GapFillGame` (khung từ + chỗ trống). |
| R&W P5 | 3 tranh kể chuyện + câu hỏi, **viết 1 từ** (5 câu) | `story_answer` | ♻️ **`missing_letter`**/gõ 1 từ ngắn. |

### 3.3 Speaking — 4 part / 3–5 phút / tối đa 5 khiên

| Part | Dạng đề | Trong app |
|---|---|---|
| Part 1 | Làm theo chỉ dẫn của giám khảo | App phát chỉ dẫn (en-GB) + hình; bé làm theo. |
| Part 2 | Hỏi về tranh | App hỏi + hình; bé trả lời. |
| Part 3 | Hỏi về đồ vật | App hỏi + hình đồ vật; bé trả lời. |
| Part 4 | Hỏi về bản thân bé | App hỏi; bé trả lời (không có đáp án "đúng/sai"). |

### 3.4 Phần Speaking KHÔNG THỂ chấm tự động — xử lý thế nào

Bắt buộc tránh hai thứ: **(a) chấm sai** (nói đúng mà bị đánh trượt), **(b) làm bé thất vọng**.
Vì `say_it` (game có micro, dùng `SpeechRecognition`) là game P1, chưa có component, và ngay cả khi có
thì **nhận dạng giọng trẻ em rất kém chính xác** ⇒ không dùng để chấm.

**Đề xuất (mặc định):** Speaking là **"phần bé tự tin nói"** — không có đáp án đúng/sai, không AI chấm:
1. App lần lượt trình bày 4 part; mỗi câu hỏi: hiện hình/chỉ dẫn, **phát mẫu en-GB** (nút 🔊 phát lại tự
   do, B7 — tắt tiếng app thì vẫn hiện chữ cho screen reader).
2. Bé bấm **"🎤 Nói rồi!"** khi đã nói to theo mẫu. App KHÔNG ghi âm (COPPA/GDPR-K: không lưu hình/tiếng
   của bé — `002_child.sql` §quyền riêng tư).
3. Cuối phần: màn trấn an — *"Bé đã nói hết rồi! Bé giỏi lắm!"* — **mặc định 5 khiên** cho phần đã hoàn
   thành (đây là phần "đã bỏ công", không phải "đã đúng"). Nếu bé bỏ dở, phần KHÔNG bị tính vào khiên và
   **không hiện 0** — hiện *"Bé chưa thử phần Nói — thử nhé khi nào bé sẵn sàng!"*.
4. **Tuỳ chọn có thể bật** (cần chủ dự án duyệt — Q3): phụ huynh xác nhận "Con tôi đã nói đủ 4 phần"
   ở khu vực phụ huynh (sau cổng PIN — `src/router.tsx:159-167`), biến khiên Nói thành "do phụ huynh
   xác nhận". Đây là **lựa chọn**, không phải mặc định, vì luồng bình thường phải cho bé tự làm một mình.

5. **Không bao giờ** dùng `shieldsForSection` (thang theo độ đúng) cho Speaking. Dùng hàm riêng
   `shieldsForSpeaking(completedParts)` = 5 nếu đủ 4 part, `null` (không tính) nếu chưa. Đây là điểm
   chống "chấm sai" mạnh nhất.

### 3.5 Ghi chú phạm vi component

- **Giai đoạn 1 (MVP bài thi):** chỉ dùng item kind mà **1 trong 5 component hiện có** phục vụ được, cộng
  tối đa 4 component MỚI đơn giản (`TickCrossGame`, `YesNoGame`, `GapFillGame`, `ChoosePictureGame`).
  Listening P4 (tô màu) và mọi dạng "tự luận tự do" **bị hoãn** — thay bằng biến thể chấm-được để không
  dựng cảm giác "bé viết sai chính tả thì bị trừ".
- **Nguyên tắc component mới:** theo đúng `registry.ts:22-24` — làm xong một dạng = thêm 1 dòng vào
  `GAME_COMPONENTS`; các dạng bài thi KHÔNG thêm vào `GameType` (vì đó là union game, đã chốt 12 giá
  trị ở `content.ts:37-52`), mà dùng **registry riêng** `src/components/final-test/registry.tsx` khóa
  theo `FinalTestItem['interaction']`.
- Dạng nào chưa có component ⇒ `validate:content` báo lỗi (V21 mở rộng) hoặc manifest đánh dấu phần đó
  là "chưa chơi được" để UI nói thật (giống "trò đang làm" ở `ThemePage.tsx:437-441`).

---

## 4. Thang điểm & phản hồi

### 4.1 Khiên (shields) 1–5 mỗi phần — KHÔNG BAO GIỜ 0

Đặt hàm thuần tại **`shared/final-test-scoring.ts`** (song song `shared/game-scoring.ts`), để client
hiện ngay và server chấm lại — **một luật, hai nơi gọi** (đúng nguyên tắc `game-scoring.ts:4-9`).

```ts
/** Khiên của một section CHẤM TỰ ĐỘNG. Trần 5, SÀN 1 (B1: hoàn thành là đã có thưởng). */
export function shieldsForSection(correctFirstTry: number, total: number): 1 | 2 | 3 | 4 | 5 {
  if (total <= 0) return 1;                       // không bao giờ 0
  const correct = Math.max(0, Math.min(correctFirstTry, total));
  const errors = total - correct;
  const ratio = correct / total;
  // Nhánh theo SỐ LỖI để thang "mượt" (cùng lý do STAR_MAX_ERRORS ở game-scoring.ts:128-147).
  if (ratio >= 0.90 || errors <= 1) return 5;
  if (ratio >= 0.75 || errors <= 3) return 4;
  if (ratio >= 0.60 || errors <= 5) return 3;
  if (ratio >= 0.40 || errors <= 8) return 2;
  return 1;
}

/** Speaking: theo ĐỘ THAM GIA, không theo độ đúng. null = chưa làm (KHÔNG tính là 0). */
export function shieldsForSpeaking(completedParts: number, totalParts: number): 5 | null {
  return completedParts >= totalParts && totalParts > 0 ? 5 : null;
}
```

- **Bảng bản đồ thật:** `shieldsForSection` dùng **"đúng ngay lần đầu"** (`firstTry`) làm tử số — cùng
  lý do `starsForRun` (`game-scoring.ts:171-175`): tính cả câu phải sửa thì ai cũng tối đa, khiên mất ý nghĩa.
- **Ngưỡng là mặc định, sẽ tinh chỉnh bằng dữ liệu chơi thật** — ghi vào `BALANCE_TODO` cùng chỗ với
  ngưỡng sao (`economy.ts:243-248`). Không chốt cứng trên giấy.
- **Sàn = 1 tuyệt đối.** Không có nhánh nào trả 0 (B1). Nếu dữ liệu bẩn cho ra ngoài 1–5, kẹp lại
  (một `clampShields` song song `clampStarsBest`, `game-scoring.ts:163`).

### 4.2 Hiển thị kết quả

**Cho bé (7+):**
- Khiên vẽ bằng **hình** 🛡️ (không chỉ số) + con số đọc to cho screen reader: *"Con được 4 khiên ở phần Nghe"*.
- Màu/vùng chạm lấy từ token (`src/styles/tokens.css`), chữ ≥ 16px, nút ≥ 88px (B8).
- Câu khen theo mức (KHÔNG có từ chê): 5→*"Siêu sao!"*, 4→*"Giỏi lắm!"*, 3→*"Bé làm tốt lắm!"*,
  2→*"Bé cố lên nào, mình thử lại nhé!"*, 1→*"Bé đã hoàn thành! Mình thử lại vui hơn nhé!"* — tuyệt đối
  không dùng "sai/kém/chưa đạt" (B5).
- **Không hiện % đúng, không hiện "số câu sai"** cho bé (dễ đọc thành lời chê). Chỉ hiện khiên + câu khen.

**Cho phụ huynh (sau cổng PIN, khu vực `/parent` — `src/router.tsx:159-167`):**
- Thêm khối vào `ReportResponse` (`shared/types/api.ts:411`): `finalTest?: { sections: Array<{ section,
  bestShields, attempts, lastAttemptAt }>, takenAt }`. Report tự mô tả bằng `summary_vi` như hiện có.
- Phụ huynh thấy số câu đúng/tổng theo từng part, khiên, và gợi ý ôn từ hay sai (tái dùng
  `strugglingWords` đã có — `ReportService`).

### 4.3 Quy tắc "KHÔNG đỗ/trượt, không xếp hạng, làm lại vô hạn"

- **Không có ngưỡng đỗ.** Không nhãn "đỗ/trượt". Tổng kết chỉ nói *"Bé đã hoàn thành bài thi Starters!"*
  bất kể khiên — vì đã bỏ công làm hết là một thành tựu (B5).
- **Không xếp hạng**, không so với bé khác, không bảng xếp hạng (`LIMITS`/thiết kế không có khái niệm này).
- **Làm lại không giới hạn.** Mỗi lần làm lại là một lượt mới; **khiên lưu theo `MAX` (kỷ lục), không
  bao giờ giảm** — cùng luật `bestStars` ở `shared/types/progress.ts:188-191,264-271`. Chơi lại kém hơn
  không làm mất khiên (B1 tinh thần "thành tựu không bao giờ mất").
- **Không hẹn giờ gây áp lực** (B3). Thời lượng mỗi phần chỉ để thống kê `activeSeconds`, KHÔNG ảnh
  hưởng khiên — y hệt `durationSeconds` ở `GameResultSubmission` (`progress.ts:176`).

---

## 5. Luồng UX

### 5.1 Route mới (thêm vào Tầng 3 `RequireChild` + `AppShell` — `src/router.tsx:85-168`)

| Route | Màn hình | Vai trò |
|---|---|---|
| `/final-test` | `FinalTestHomePage` | Cổng vào: trạng thái đủ/thiếu điều kiện (§1) + 3 section + nút bắt đầu. |
| `/final-test/:section` | `FinalTestSectionPage` | Chạy MỘT section (`listening` \| `reading-writing` \| `speaking`). |
| `/final-test/certificate` | `FinalTestCertificatePage` | "Chứng nhận" trong app + tổng khiên 3 phần. |

> ⚠️ **KHÔNG thêm mục vào `BottomNav`.** Đây là trần 5 mục của dự án (ghi rõ ở `src/router.tsx:145-146`).
> **Điểm vào** đặt ở **`JourneyMapPage`** (một thẻ "🎓 Khu vực thi" ở cuối bản đồ, khoá/xám khi chưa đủ
> điều kiện, giống thẻ chủ đề chưa mở) và một link phụ ở `ExplorerProfilePage`.

### 5.2 Màn `/final-test` — trạng thái "chưa đủ điều kiện"

Dùng **đúng khuôn `ThemeRequirement`** (`shared/theme-access.ts:64-66`) — hiện RÕ còn thiếu gì, không
chê:

- `kind='locked'` + `requirement.type='lessons_incomplete'`:
  > *"Bé ơi, còn **3 bài** nữa để học hết nhé! (đã xong 40/43 bài)"* + nút dẫn về bản đồ.
- `kind='locked'` + `requirement.type='games_unplayed'`:
  > *"Còn **5 trò chơi** bé chưa thử! Chơi cho vui rồi mình thi nhé."*
- `kind='ready'`: thẻ "🎓 Bài thi Starters" sáng, 3 nút section + trạng thái khiên tốt nhất từng phần.
- **Chưa hydrate dữ liệu** (mạng lỗi/đang tải): hiện *"Đang kiểm tra…"* — KHÔNG báo còn thiếu (tránh mắng oan).

`requirementText` ở `ThemePage.tsx:452-465` là **mẫu tham khảo trực tiếp** cho hàm
`finalTestRequirementText()` mới (song song, không sửa hàm cũ).

### 5.3 Màn `/final-test/:section` — chạy + lưu tiến độ từng phần

**Vì sao tách 3 phần:** bé 7+ không nên ngồi liền ~45 phút (Listening 20' + R&W 20' + Speaking 5').
Đề xuất: **mỗi lần làm MỘT section**, nghỉ giữa 2 section; bé quay lại làm tiếp. Mỗi section là một
"phiên" có điểm dừng tự nhiên.

**Lưu tiến độ giữa chừng (quan trọng — bé có thể thoát giữa phần):**
- **Client (bắt buộc):** store zustand + `localStorage`, khoá `rubylingo:finaltest:{childId}:{section}`,
  lưu `{ partIndex, itemIndex, answers: [{itemId, firstTry, wrongAttempts}], updatedAt }` sau MỖI item.
  (Cùng khuôn mẫu offline queue đã có ở `src/store` + `SyncService`.)
- **Server (khuyến nghị — cần quyết định Q2):** `PUT /api/children/:id/final-test/:section/progress`
  để bé đổi máy vẫn làm tiếp. Bảng `final_test_progress` (migration 013, §6.3).
- **Vào lại section đã làm dở** ⇒ hỏi nhẹ nhàng: *"Mình làm tiếp nhé?"* (mặc định) hay *"Làm lại từ đầu?"*.

**Luồng một item (đồng nhất cho mọi interaction):**
1. Hiện hình/câu hỏi (chữ tiếng Anh nếu có, tiếng Việt hiển thị nếu là chỉ dẫn).
2. Nếu có `audioTextEn`: nút 🔊 phát `en-GB` (`SpeechService`, tốc độ chậm 0.8). **Bé nghe lại tự do,
   không giới hạn** (B3). Tắt tiếng app ⇒ nút 🔊 vẫn còn + screen reader vẫn đọc chữ (B7).
3. Bé trả lời. Sai: **không mất gì**, hiện gợi ý động viên, cho thử lại — tối đa `MAX_WRONG_PER_ROUND`
   (2, `game-scoring.ts:47`) rồi **làm nổi bật đáp án** và vẫn cho bé bấm (giống game, không bỏ câu).
4. Ghi nhận `{itemId, firstTry, wrongAttempts}` — **đây là dữ liệu THÔ gửi server** (§6.1).
5. Sang item kế; lưu tiến độ.

**Kết thúc section:** client tính khiên bằng `shieldsForSection` để HIỆN NGAY, đồng thời POST kết quả
lên server; server chấm lại và trả khiên chính thức (client chỉ hiển thị, không tự quyết — B4).
Màn kết thúc section: khiên + câu khen + nút "Làm phần tiếp" / "Về khu vực thi".

### 5.4 Sơ đồ luồng

```
JourneyMapPage ──(thẻ "🎓 Khu vực thi")──► /final-test
   │                                          │  resolveFinalTestAccess()
   │  locked  ◄── chưa đủ (hiện còn thiếu gì) │
   │                                          ▼ ready
   │                            ┌── /final-test/listening ────┐
   │                            ├── /final-test/reading-writing┤ → mỗi phần:
   │                            └── /final-test/speaking ──────┘   item→item→…→kết phần
   │                                          │ (lưu từng item vào localStorage + server)
   │                                          ▼
   │                              POST /final-test/:section/submit  (server chấm lại)
   │                                          ▼
   │                              /final-test/certificate  (tổng 3 khiên + chứng nhận in-app)
```

---

## 6. Server

### 6.1 API mới (đề xuất)

**① `GET /api/children/:id/final-test`** — trạng thái điều kiện + kết quả tốt nhất từng phần.

```jsonc
// 200
{ "data": {
  "eligible": true,
  "requirement": null,                       // hoặc { type, ... } khi chưa đủ (§1.2)
  "lessonsCompleted": 43, "lessonsTotal": 43,
  "exercisesPlayed": 73,   "exercisesTotal": 73,
  "sections": [
    { "section": "listening", "bestShields": 4, "attempts": 2, "lastAttemptAt": "2026-10-10T…Z", "inProgress": false },
    { "section": "reading-writing", "bestShields": 5, "attempts": 1, "lastAttemptAt": "…Z", "inProgress": false },
    { "section": "speaking", "bestShields": 5, "attempts": 1, "lastAttemptAt": "…Z", "inProgress": false }
  ]
}}
```

**② `POST /api/children/:id/final-test/:section/submit`** — nộp MỘT section đã xong.

```jsonc
// request — CHỈ SỰ THẬT THÔ, KHÔNG có shields/score/stars
{ "clientEventId": "ft_9f3a…", "section": "listening",
  "totalItems": 20, "occurredAt": "2026-10-10T09:12:00.000Z", "durationSeconds": 741,
  "answers": [ { "itemId": "starters.final-test.listening.p1.q1", "firstTry": true, "wrongAttempts": 0 }, … ] }

// 200 — kết quả đã chấm
{ "data": { "section": "listening", "shields": 4, "bestShields": 4, "isNewRecord": true,
  "duplicate": false, "xpGained": 120, "starsGained": 60, "acornsGained": 2,
  "levelUp": null, "questsCompleted": [], "badgesEarned": ["badge-starters-graduate"],
  "stickerEarned": "sticker-certificate" } }
```

**③ (khuyến nghị, Q2)** `PUT /api/children/:id/final-test/:section/progress` — lưu phần đang làm dở
(xem §5.3/§6.3).

**④ (tuỳ chọn)** `POST /api/children/:id/final-test/speaking/confirm` — phụ huynh xác nhận (nếu chọn Q3).

### 6.2 Tái dùng gì, viết mới gì

| Thành phần | Tái dùng nguyên trạng | Ghi chú |
|---|---|---|
| `XpService.addXpInTx` | ✅ | Đường DUY NHẤT cộng XP (B6, `GameResultService.ts:57-59`). |
| `RewardService.applyGrantsInTx` / `grantBadgeInTx` / `grantStickerInTx` | ✅ | Trao ⭐/🌰/huy hiệu/sticker, idempotent theo khoá chính. |
| `BadgeService.evaluate` | ✅ (sau khi thêm criteria mới) | Xem §7. |
| `QuestService.applyEventInTx` | ✅ | Bắn event `game_played`/`correct_answers` để nhiệm vụ đếm. |
| `ProgressService.applyDailyStatInTx` | ✅ | Thống kê ngày khớp báo cáo phụ huynh. |
| `GameResultService` | ⚠️ **KHÔNG tái dùng `submit`** | Vì nó ghi `game_result` gắn `exerciseId`/`gameType` — nhồi bài thi vào sẽ làm bẩn chip/nhiệm vụ/huy hiệu. Chỉ **tái dùng triết lý** (chấm lại từ dữ liệu thô) và các service con ở trên. |
| `shieldsForSection` (mới) | ✅ | Hàm thuần `shared/` — client hiện, server chấm lại. |

**⇒ Tạo service mới `server/services/FinalTestService.ts`**, phụ thuộc `{ children, rewards, xp, quests,
badges, progress }` (cùng khuôn 6 phụ thuộc của `GameResultService.ts:299-306`), toàn bộ trong MỘT
`transaction()`.

### 6.3 Migration mới: **`013_final_test.sql`** (số tiếp theo sau `012_room_placement.sql`)

```sql
-- 013 — BÀI THI CUỐI KHOÁ (Starters)
CREATE TABLE IF NOT EXISTS final_test_attempt (
  id               TEXT PRIMARY KEY,
  child_id         TEXT NOT NULL REFERENCES child_profile (id) ON DELETE CASCADE,
  client_event_id  TEXT NOT NULL,                 -- UNIQUE: chống ghi trùng (B4)
  section          TEXT NOT NULL,                 -- 'listening' | 'reading-writing' | 'speaking'
  total_items      INTEGER NOT NULL CHECK (total_items >= 0),
  correct_first_try INTEGER NOT NULL CHECK (correct_first_try >= 0),
  answered         INTEGER NOT NULL CHECK (answered >= 0),
  wrong_attempts   INTEGER NOT NULL CHECK (wrong_attempts >= 0),
  shields          INTEGER NOT NULL CHECK (shields BETWEEN 1 AND 5),  -- SÀN 1 (B1)
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  created_at       TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_final_test_event ON final_test_attempt (client_event_id);
CREATE INDEX IF NOT EXISTS idx_final_test_child ON final_test_attempt (child_id, section, created_at DESC);

-- (khuyến nghị, Q2) lưu phần đang làm dở để đổi máy vẫn tiếp tục được
CREATE TABLE IF NOT EXISTS final_test_progress (
  child_id     TEXT NOT NULL REFERENCES child_profile (id) ON DELETE CASCADE,
  section      TEXT NOT NULL,
  answers_json TEXT NOT NULL,        -- mảng [{itemId, firstTry, wrongAttempts}] — dữ liệu THÔ
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (child_id, section)
);
```

⚠️ `CHECK (shields BETWEEN 1 AND 5)` cố ý **KHÔNG cho 0** — biến B1 thành ràng buộc DB, giống tinh thần
`stars_best BETWEEN 0 AND 3` + luật "một lượt chơi không bao giờ 0 sao" (`GameResultService.ts:269-281`).
`ALTER TABLE ADD COLUMN` không có `IF NOT EXISTS` trong SQLite nhưng không cần (runner chỉ chạy file
chưa áp dụng — `server/db/migrate.ts`).

### 6.4 Chống gian lận

1. **Client KHÔNG có trường `shields`/`score` trong hợp đồng.** Schema request chỉ có `itemId`,
   `firstTry`, `wrongAttempts`, `totalItems` (đúng khuôn `gameResultSubmissionSchema`,
   `shared/schemas/progress.ts:197-233`). Sửa JSON thêm `"shields": 5` vô tác dụng — schema Zod cắt bỏ.
2. **Server chấm lại** bằng `shieldsForSection` trên chính `answers` — cùng hàm client dùng để hiện.
3. **Server tự kiểm điều kiện** trước khi nhận: nếu chưa đủ (chưa học hết / chưa chơi hết), trả lỗi
   (đề xuất thêm mã `FINAL_TEST_LOCKED` vào `API_ERROR_CODES`, `shared/types/api.ts:38`) — vì client chỉ
   là rào UX, gõ thẳng API phải bị chặn. Server lấy `requiredExerciseIds` + danh sách theme từ
   `content-index` (§2.5) và `lesson_progress`/`game_result` để chạy **cùng** `resolveFinalTestAccess`.
4. **`totalItems` phải khớp manifest** (số item của section đó trong `content-index.finalTest`) — chặn
   client khai thiếu câu để "đúng 100%" trên ít câu.
5. **Idempotency `clientEventId`:** `INSERT OR IGNORE`; `changes === 0` thì **đọc lại hàng** rồi mới kết
   luận "trùng" — đúng cái bẫy `INSERT OR IGNORE` nuốt cả lỗi CHECK (`GameResultService.ts:37-42,593-636`).
   Trả `duplicate: true`, mọi trường thưởng = 0.

### 6.5 Thứ tự ghi trong transaction (bắt buộc)

Theo đúng thứ tự đã chứng minh ở `GameResultService.submit`:
`insert final_test_attempt` → `XpService.addXpInTx` → `RewardService.applyGrantsInTx` →
`ProgressService.applyDailyStatInTx` → `QuestService.applyEventInTx` → `BadgeService.evaluate` →
`grantStickerInTx`. **Badge đi CUỐI** vì nó ĐỌC lại sổ trong DB (xem `GameResultService.ts:440-447`).

---

## 7. Phần thưởng & huy hiệu

Nguyên tắc: **KHÔNG trừ gì của bé** (B1/B5); thưởng phải là **thành tựu sưu tầm** + **khoảnh khắc ăn mừng**.

| Phần thưởng | Định nghĩa ở đâu | Ghi chú |
|---|---|---|
| **Huy chương (medal)** | `shared/content/badges.json` — thêm mục `badge-starters-graduate` | Huy hiệu là SƯU TẦM vĩnh viễn (không tiêu được) — `005_collect.sql`. Dùng emoji KHÁC mọi huy hiệu/sticker/tiền tệ hiện có (luật V15). |
| **Sticker** | `shared/content/stickers.json` — thêm `sticker-certificate` | Phần thưởng biến thiên; overlay "Bé mở được sticker mới!" (khuôn `stickerEarned`, `GameResultService.ts:449-467`). |
| **Nhiệm vụ mốc** | `shared/content/quests.json` — thêm `qm-07` (tier `milestone`) | Milestone không bao giờ reset. Loại "chơi xong = 1 lần, không lặp" — đúng khuôn `qm-01`/`qm-02`. |
| **Thưởng ⭐/🌰/XP 1 lần** | Qua `RewardService.applyGrantsInTx` + `XpService` (share constants `economy.ts`) | **Chỉ trao ở lần ĐẦU đạt khiên** (idempotent). Làm lại KHÔNG cho tiền lại — tránh "farm" vô hạn. ⚠️ Cần Q4 (SV thêm điều kiện "first completion" — hoặc để badge/sticker làm dấu hiệu "đã rồi"). |
| **"Chứng nhận" trong app** | `FinalTestCertificatePage` (render, KHÔNG sinh file) | Hiện tên bé + ngày + 3 khiên + linh vật. **Không** xuất PDF tải về ở giai đoạn 1 (né rủi ro bản quyền/nhãn hiệu — §10). |
| **Overlay ăn mừng** | Tái dùng `levelUp`/`badgesEarned`/`stickerEarned` trong response | Cùng ngôn ngữ thị giác với game (`GameResultAward`). |

**Cần mở rộng `BadgeCriteria`** (union ở `shared/types/reward.ts:244-251` + `badgeCriteriaSchema` ở
`shared/schemas/content.ts:503-515` + nhánh trong `BadgeService.meets`, `:110`):

```ts
| { kind: 'complete_final_test' }        // dùng: badge-starters-graduate
```

`BadgeService.meets` nhánh mới: `EXISTS(final_test_attempt WHERE child_id=? AND shields>=1)` (có ít
nhất 1 lần hoàn thành bài thi). Thêm nhánh hợp lệ vì mọi đường sinh huy hiệu nằm sau cổng chống trùng.

> ⚠️ **Thêm icon mới PHẢI khác** icon tiền tệ (⭐ 🌰) và mọi badge/sticker — validator V15 chặn
> (`validate-content.ts:437-461`). Đề xuất: huy chương 🎓, sticker 🏅.

---

## 8. Kế hoạch theo giai đoạn

> Mỗi giai đoạn độc lập kiểm chứng được. Lệnh bắt buộc chạy cuối mỗi giai đoạn: `npm run ci`
> (`package.json:30` — typecheck + lint + validate:content + gen:content-index + gen:theme-colors + test:ci).

### Giai đoạn 1 — Nội dung + Schema + Validator (không UI, không server)

**Việc cần làm**
- Tạo `src/data/levels/starters/final-test/{manifest,listening,reading-writing,speaking}.json` (đề TỰ SOẠN, §10).
- Thêm schema `finalTestSectionFileSchema`/`finalTestManifestSchema` vào `shared/schemas/content.ts`.
- Thêm luật V21..V27 vào `scripts/validate-content.ts`; thêm đọc `final-test/` vào `gen-content-index.ts`
  (`finalTest` + `requiredExerciseIds`).
- Sửa `contentIndexFileSchema` + `tests/unit/content/content-index.test.ts` + thêm
  `tests/unit/content/final-test-schema.test.ts`.

**File tạo:** `src/data/levels/starters/final-test/*.json`, `tests/unit/content/final-test-schema.test.ts`.
**File sửa:** `shared/schemas/content.ts`, `scripts/validate-content.ts`, `scripts/gen-content-index.ts`,
`tests/unit/content/content-index.test.ts`.

**Tiêu chí nghiệm thu (kiểm chứng được)**
- `npm run validate:content` in ra khối "🎓 Bài thi Starters: 3 phần · 45 câu" và **0 lỗi**.
- `npm run gen:content-index -- --apply` chạy sạch; `content-index.json` chứa `finalTest` + `requiredExerciseIds`; chạy lại (chế độ kiểm) khớp.
- Test schema: (a) đáp án không nằm trong `options` ⇒ bị từ chối; (b) `hintMask` lệch độ dài ⇒ từ chối;
  (c) `audioTextEn` chứa dấu tiếng Việt ⇒ từ chối; (d) file hợp lệ ⇒ pass.

**Lệnh:** `npm run validate:content && npm run gen:content-index && npx vitest run tests/unit/content`

### Giai đoạn 2 — Luật mở khoá dùng chung + thang khiên

**Việc cần làm**
- Tạo `shared/final-test-access.ts` (§1.2) và `shared/final-test-scoring.ts` (§4.1).
- Test đơn vị đầy đủ mọi nhánh (kể cả ca biên §1.3): 0 chủ đề, chủ đề 0 game, offline, làm dở.

**File tạo:** 2 file `shared/`, `tests/unit/shared/final-test-access.test.ts`,
`tests/unit/shared/final-test-scoring.test.ts`.

**Tiêu chí nghiệm thu**
- `resolveFinalTestAccess` trả `locked` với đúng `missingThemeIds`/`missingExerciseIds`; trả `ready` khi
  đủ; **không** trả `ready` khi mới hydrate một nửa dữ liệu.
- `shieldsForSection` LUÔN ∈ [1,5] với mọi cặp `(correct,total)` kể cả `total=0`, `correct>total`,
  `NaN`; `shieldsForSpeaking` trả `null` khi chưa làm, `5` khi đủ part.

**Lệnh:** `npx vitest run tests/unit/shared/final-test-access.test.ts tests/unit/shared/final-test-scoring.test.ts`

### Giai đoạn 3 — Component tương tác mới

**Việc cần làm**
- Viết 4 component (§3.5): `TickCrossGame`, `YesNoGame`, `GapFillGame`, `ChoosePictureGame` (+ tái dùng
  `missing_letter` cho `write_word`/`arrange_letters`/`story_answer`).
- `src/components/final-test/registry.tsx` map `interaction → component` (khuôn `registry.ts:41-54`).
- Test component (a11y: `aria-label` hành động, nút ≥ 64px, không phụ thuộc màu để phân biệt).

**File tạo:** `src/components/final-test/*` + `tests/unit/client/final-test-*.test.tsx`.

**Tiêu chí nghiệm thu**
- Mọi `interaction` trong đề có component, hoặc bị liệt kê "chưa chơi được" (không có nút dẫn tới hư không).
- Tắt tiếng: nút 🔊 ẩn nhưng nội dung chữ + `aria-label` vẫn còn (B7) — test kiểm bằng cách set `soundEnabled=false`.

**Lệnh:** `npx vitest run tests/unit/client`

### Giai đoạn 4 — Server API + migration 013 + thưởng

**Việc cần làm**
- Migration `server/db/migrations/013_final_test.sql` (§6.3).
- `server/services/FinalTestService.ts` (§6.2, §6.5) + `server/routes/final-test.ts` + đăng ký ở
  `server/app.ts:72-74`; mở rộng `BadgeCriteria` + `BadgeService.meets` (§7); thêm huy chương/sticker/quest
  vào JSON; thêm DTO vào `shared/types/api.ts` + schema request vào `shared/schemas/`.

**File tạo:** `server/services/FinalTestService.ts`, `server/routes/final-test.ts`,
`server/db/migrations/013_final_test.sql`, `tests/unit/server/final-test-service.test.ts`.
**File sửa:** `server/app.ts`, `server/services/BadgeService.ts`, `shared/types/reward.ts`,
`shared/schemas/content.ts`, `shared/types/api.ts`, `shared/content/badges.json`, `stickers.json`, `quests.json`.

**Tiêu chí nghiệm thu**
- Gửi lại cùng `clientEventId` ⇒ `duplicate: true`, **không** cộng thêm ⭐/XP/huy hiệu (test).
- Gửi payload có `"shields": 5` ⇒ bị Zod cắt; server vẫn chấm theo `answers` (test).
- Bé chưa đủ điều kiện gọi thẳng API ⇒ lỗi `FINAL_TEST_LOCKED`, không ghi gì (test).
- Khiên lưu theo MAX: làm lại kém hơn ⇒ `bestShields` KHÔNG giảm (test).
- Huy hiệu `badge-starters-graduate` chỉ trao 1 lần; `badge_earned` có đúng 1 hàng (test).

**Lệnh:** `npm run migrate && npx vitest run tests/unit/server/final-test-service.test.ts`

### Giai đoạn 5 — Client UX (route + 4 màn hình)

**Việc cần làm**
- 4 màn hình + route (§5.1); thẻ "🎓 Khu vực thi" ở `JourneyMapPage` (hiện đúng trạng thái đủ/thiếu);
  lưu tiến độ từng item (§5.3); hook `useFinalTest()` (react-query) + `useFinalTestSession()` (zustand).
- Thêm i18n key vào `src/i18n/vi.ts` (mẫu `requirementText` ở `ThemePage.tsx:452-465`).
- Khối kết quả ở báo cáo phụ huynh (§4.2) sau cổng PIN.

**File tạo:** `src/pages/final-test/{FinalTestHomePage,FinalTestSectionPage,FinalTestCertificatePage}.tsx`,
`src/hooks/useFinalTest.ts`, `src/store/finalTestSession.ts`, `src/final-test/*`.
**File sửa:** `src/router.tsx`, `src/pages/JourneyMapPage.tsx`, `src/i18n/vi.ts`, `src/pages/parent/*`.

**Tiêu chí nghiệm thu**
- Chưa đủ điều kiện: thẻ ở bản đồ khoá + hiện đúng "còn thiếu gì"; gõ URL tay vào `/final-test` cũng bị
  chặn (khuôn tự-kiểm-quyền của `ThemePage.tsx:8-12`).
- Làm dở 3/20 câu rồi thoát, mở lại ⇒ làm tiếp đúng câu 4.
- Toàn bộ chữ ≥ 16px, nút chính ≥ 88px, màu lấy từ token (không hardcode hex trong `.tsx`).

**Lệnh:** `npm run ci && npx playwright test tests/e2e/final-test*`

### Giai đoạn 6 — Kiểm chứng đầu-cuối + tài liệu

**Việc cần làm**
- E2E: seed tiến độ đủ điều kiện → mở cổng → làm phần Listening → nhận khiên → chứng nhận → làm lại →
  khiên không giảm. Chụp màn hình 320×640 / 768 / 1366 (khuôn `playwright.config.ts` + `docs/qa-t082/`).
- Cập nhật `docs/ke-hoach/` + ghi `BALANCE_TODO` cho ngưỡng khiên.

**Tiêu chí nghiệm thu**
- `npm run ci` xanh, số test tăng (đếm thật — `scripts/verify-test-count.ts`).
- Không có màn hình nào hiện "0 khiên", "sai", "kém", "trượt".
- Khiên hiển thị đúng ở mọi viewport; screenshot lưu làm bằng chứng.

**Lệnh:** `npm run ci && npm run test:e2e`

---

## 9. Rủi ro & câu hỏi cần chủ dự án quyết định

| # | Câu hỏi | Khuyến nghị mặc định |
|---|---|---|
| **Q1** | Khi nội dung lớn thêm (thêm game cho 10 chủ đề còn lại — xem `hien-trang-game-theo-chu-de.md` §3), điều kiện "chơi hết" **nâng ngưỡng** và bé đã "thi rồi" có thể thấy cổng khoá lại. Chấp nhận? | **Có** — đúng nghĩa "chơi hết game hiện có". Nhưng nếu bé ĐÃ có kết quả bài thi, `/final-test` luôn `enterable` (đã thi rồi thì không khoá lại), chỉ ẩn gợi ý "còn game mới nên thử". |
| **Q2** | Có lưu tiến độ đang làm dở LÊN SERVER (bảng `final_test_progress`, đổi máy làm tiếp được) không? | **Có** — bé dùng iPad nhà + máy khác là kịch bản thật. Chấp nhận thêm 1 bảng nhỏ. Nếu chưa muốn: chỉ lưu `localStorage` (đơn giản hơn, mất khi đổi máy). |
| **Q3** | Speaking: cho bé tự nói + "🎤 Nói rồi!" (mặc định 5 khiên khi hoàn thành), hay để PHỤ HUYNH xác nhận ở khu vực PIN? | **Mặc định: bé tự nói, 5 khiên khi hoàn thành.** Phụ huynh-xác-nhận là **tuỳ chọn bật**. Mục tiêu: bé tự làm một mình được, không cảm giác "bị kiểm tra". |
| **Q4** | Thưởng ⭐/🌰/XP một lần duy nhất ở lần hoàn thành ĐẦU, hay mỗi lần làm lại đều thưởng? | **Chỉ lần đầu** — tránh "farm" vô hạn, và khớp nguyên tắc "thành tựu không lặp". Làm lại vẫn được khiên cao hơn + câu khen. |
| **Q5** | Listening P4 (tô màu) — làm component tô-màu (P2 `colour_learn` chưa có) hay thay bằng `choose_picture` (nghe màu → chọn đồ vật)? | **Thay bằng `choose_picture`** ở giai đoạn 1 (chấm được, không cần engine tô màu). Làm tô-màu thật ở P2 sau. |
| **Q6** | Ngưỡng khiên (§4.1) có cần chủ dự án chốt cứng trước khi code? | **Không** — đưa bộ ngưỡng mặc định, tinh chỉnh bằng dữ liệu chơi thật (đưa vào `BALANCE_TODO`). |
| **Q7** | Có xuất "Chứng nhận" PDF tải về? | **Chưa** ở giai đoạn 1 — render trong app. PDF tải về cần review bản quyền/nhãn hiệu riêng (§10). |

**Rủi ro kỹ thuật:**
- **R1** Nới `content-index` (thêm `finalTest` + `requiredExerciseIds`) — phải giữ luật "chỉ chép thứ
  server ĐỌC"; test đối chiếu từng trường ở `tests/unit/content/content-index.test.ts` phải cập nhật, nếu
  không CI đỏ (đây là lợi ích: cổng bắt lệch).
- **R2** Thêm nhánh `BadgeCriteria` mới → phải cập nhật **cả** union TS, schema Zod, và `BadgeService.meets`;
  thiếu một chỗ ⇒ huy chương không bao giờ trao (hoặc lỗi typecheck).
- **R3** `shieldsForSection` phải là hàm THUẦN — không đọc giờ/mạng (khuôn `game-scoring.ts:286`).
- **R4** Đề bài thi phải TỰ SOẠN — không lấy đề mẫu Cambridge (§10); nếu lỡ dán, V27 phải chặn.

---

## 10. Bản quyền (ràng buộc cứng)

- **TUYỆT ĐỐI KHÔNG** copy đề thi, transcript hội thoại, hay wordlist có bản quyền của Cambridge vào repo.
  Đề mẫu/chủ đề "Pre A1 Starters" là tài sản của Cambridge University Press & Assessment.
- Bài thi trong app là **nội dung TỰ SOẠN, lấy cảm hứng DẠNG BÀI** (format Listening 4 part / Reading &
  Writing 5 part / Speaking 4 part) — **không** sao chép nội dung cụ thể nào. Từ vựng dùng lại từ chính
  `src/data/levels/starters/themes/*.json` (đã có sẵn trong dự án), không nhập thêm wordlist ngoài.
- **Ghi rõ trong tài liệu này** (mục này) + **trong schema/comment code** khi triển khai:
  - `finalTestManifestSchema.source = z.literal('original')` bắt buộc ở mọi file `manifest.json`.
  - Thêm comment đầu mỗi file `final-test/*.json` và đầu `shared/schemas/content.ts` (khối bài thi):
    *"⚠️ NỘI DUNG TỰ SOẠN. KHÔNG dán đề/wordlist Cambridge vào đây — xem docs/ke-hoach/thiet-ke-bai-thi-cuoi-khoa.md §10."*
  - Validator **V27** chặn chuỗi nhận dạng đề Cambridge ở tầng build (danh sách đen + bắt buộc `source: 'original'`).
- Trang "Chứng nhận" trong app (`FinalTestCertificatePage`) **không** dùng logo/nhãn hiệu Cambridge; chỉ
  ghi *"Bài thi cuối khoá RubyLingo — Starters"*. Nếu sau này muốn xuất PDF/nhãn hiệu chính thức, phải là
  quyết định riêng có review pháp lý (Q7).

---

## Phụ lục A — Danh sách file sẽ tạo / sửa (tổng hợp)

**Tạo mới**
- Nội dung: `src/data/levels/starters/final-test/{manifest,listening,reading-writing,speaking}.json`
- Shared: `shared/final-test-access.ts`, `shared/final-test-scoring.ts`
- Server: `server/services/FinalTestService.ts`, `server/routes/final-test.ts`,
  `server/db/migrations/013_final_test.sql`
- Client: `src/pages/final-test/{FinalTestHomePage,FinalTestSectionPage,FinalTestCertificatePage}.tsx`,
  `src/components/final-test/*`, `src/hooks/useFinalTest.ts`, `src/store/finalTestSession.ts`
- Test: `tests/unit/shared/final-test-*.test.ts`, `tests/unit/content/final-test-schema.test.ts`,
  `tests/unit/server/final-test-service.test.ts`, `tests/unit/client/final-test-*.test.tsx`,
  `tests/e2e/final-test*.spec.ts`

**Sửa**
- `shared/schemas/content.ts` (+schema bài thi, +`complete_final_test`), `shared/types/reward.ts` (+nhánh
  `BadgeCriteria`), `shared/types/api.ts` (+DTO, +mã lỗi `FINAL_TEST_LOCKED`), `shared/schemas/progress.ts`
  (nếu gộp schema submit), `shared/content/{badges,quests,stickers}.json`, `shared/content/content-index.json` (sinh),
  `scripts/validate-content.ts` (V21..V27), `scripts/gen-content-index.ts`, `server/app.ts`,
  `server/services/BadgeService.ts`, `server/services/ReportService.ts` (+khối bài thi),
  `src/router.tsx`, `src/pages/JourneyMapPage.tsx`, `src/i18n/vi.ts`, `tests/unit/content/content-index.test.ts`.

## Phụ lục B — Danh mục kiểm chứng bắt buộc (chốt)

```
npm run ci            # typecheck + lint + validate:content + gen:content-index + gen:theme-colors + test:ci
npm run validate:content   # phải in "🎓 Bài thi Starters: 3 phần · 45 câu", 0 lỗi
npm run gen:content-index  # chế độ kiểm: content-index.json khớp src/data/
npm run migrate            # áp 013 (chỉ khi Giai đoạn 4 — KHÔNG chạy trong tài liệu này)
npm run test:e2e           # kịch bản bài thi end-to-end
```

> **Trạng thái tài liệu:** ĐÃ XONG (thiết kế). Chưa có dòng mã nào được viết/sửa bởi tài liệu này.
