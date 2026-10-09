/**
 * RubyLingo — Kiểu dữ liệu NỘI DUNG HỌC (dùng chung client + server).
 *
 * Nguồn chân lý: `src/data/levels/<levelId>/` (JSON tĩnh).
 * Thêm cấp Movers/Flyers = thêm JSON khớp kiểu này, KHÔNG sửa code.
 *
 * Quy ước id (xem ARCHITECTURE §10.6):
 *   Theme     : kebab-case tên tiếng Anh            → "at-the-zoo"
 *   Lesson    : "{themeId}/{code}"                  → "at-the-zoo/z1"
 *   Exercise  : "{lessonId}/{game-slug}"            → "at-the-zoo/z1/listen-tap"
 *   Word      : "{levelCode}.{slug(en)}"            → "starters.elephant"
 *               - cùng `en` khác POS        → hậu tố POS   : "starters.orange-n" / "starters.orange-adj"
 *               - cùng `en` cùng POS khác nghĩa → hậu tố nghĩa: "starters.chicken-meat"
 *               - cùng `en` cùng nghĩa ở 2 theme → MỘT định nghĩa duy nhất trong theme
 *                 xuất hiện TRƯỚC trong level.json.themeIds; theme kia chỉ tham chiếu
 *                 id trong Lesson.wordIds ⇒ ContentRepository PHẢI dựng index ở cấp LEVEL.
 */

/** Từ loại (nhãn trong Word List gốc của Cambridge). */
export type PosType =
  | 'n' // danh từ
  | 'v' // động từ
  | 'adj' // tính từ
  | 'adv' // trạng từ
  | 'prep' // giới từ
  | 'conj' // liên từ
  | 'pron' // đại từ
  | 'det' // hạn định từ
  | 'excl' // thán từ
  | 'num' // số từ
  | 'title'; // kính ngữ: Mr, Mrs, Miss (không phải danh từ — không có số nhiều)

/**
 * 12 kiểu game. Chỉ 5 kiểu là MVP; phần còn lại thuộc P1/P2.
 * Thêm game mới = thêm giá trị ở đây + 1 component, KHÔNG sửa GamePage.
 */
export type GameType =
  // --- MVP ---
  | 'listen_tap' // G5  Nghe & Chạm
  | 'missing_letter' // G3  Điền chữ cái còn thiếu
  | 'prepositions' // G4  Thú cưng trốn ở đâu?
  | 'memory_match' // G7  Lật thẻ ghi nhớ
  | 'word_picture' // G9  Nối từ với hình
  // --- P1 ---
  | 'word_search' // G1  Tìm từ trong ô chữ
  | 'number_match' // G2  Nối số & chữ
  | 'say_it' // G6  Bé nói theo (ẩn nếu trình duyệt không hỗ trợ)
  | 'word_builder' // G8  Xếp chữ thành từ
  | 'sort_basket' // G10 Giỏ đồ của bé
  // --- P2 ---
  | 'count_tap' // G11 Đếm & chạm theo thứ tự
  | 'colour_learn'; // G12 Tô màu theo từ

/** Game chơi được ở MVP (dùng để lọc khi runtime chưa có component). */
export const MVP_GAME_TYPES: readonly GameType[] = [
  'listen_tap',
  'missing_letter',
  'prepositions',
  'memory_match',
  'word_picture',
] as const;

/**
 * Game có yêu cầu từ phải VẼ ĐƯỢC HÌNH (`Word.picturable === true`).
 * Validator phải chặn: game thuộc nhóm này cần >= 4 từ picturable.
 */
export const PICTURE_GAME_TYPES: readonly GameType[] = [
  'listen_tap',
  'word_picture',
  'memory_match',
  'word_search',
  'number_match',
  'count_tap',
  'colour_learn',
  'sort_basket',
] as const;

/** Game cần micro (chỉ chạy trên trình duyệt hỗ trợ SpeechRecognition). */
export const SPEECH_INPUT_GAME_TYPES: readonly GameType[] = ['say_it'] as const;

/**
 * Điều kiện mở khoá một chủ đề trên bản đồ hành trình.
 *
 * ⚠️⚠️ `coming_soon` NGHĨA LÀ **"CHƯA CÓ GAME"**, KHÔNG PHẢI "CHƯA CÓ NỘI DUNG".
 *
 *   Từ vựng và bài học của cả 11 chủ đề Starters đều đã có (275 từ / 43 bài); chỉ `at-the-zoo`
 *   là đã có bài tập game. Nên `coming_soon` KHÔNG được dùng để chặn bé vào màn hình chủ đề —
 *   học thẻ từ không cần game, và chặn lại thì bé chỉ học được 21/275 từ dù 254 từ kia đã nằm
 *   sẵn trong ứng dụng.
 *
 *   Luật đầy đủ nằm ở `shared/theme-access.ts`. Trạng thái "sắp mở" thật sự (không bấm vào
 *   được) chỉ đến từ DỮ LIỆU: chủ đề có `lessonCount === 0` hoặc `wordCount === 0`.
 */
export type UnlockConditionType =
  /** Mở ngay từ đầu (chỉ dùng cho chủ đề ĐẦU TIÊN của level). */
  | 'always'
  /** Mở khi đã hoàn thành chủ đề đứng ngay trước trong level.json.themeIds. */
  | 'previous_theme'
  /** Mở khi bé đạt đủ số sao. */
  | 'stars_required'
  /** Chưa có GAME (vẫn có thể có từ vựng để học thẻ từ) — xem ghi chú trên. */
  | 'coming_soon';

export interface UnlockCondition {
  type: UnlockConditionType;
  /** Chỉ dùng khi type = 'stars_required'. */
  stars?: number;
}

/** Biến thể số ít / số nhiều bất quy tắc: mouse/mice, child/children, foot/feet. */
export interface WordForms {
  plural?: string;
  /** Biến thể viết khác của CÙNG một từ (Anh–Mỹ): grey/gray, chips/fries. */
  alt?: string[];
}

export interface Word {
  /** "{levelCode}.{slug(en)}" — duy nhất TRONG TOÀN level. Xem quy ước ở đầu file. */
  id: string;
  levelId: string;
  /** Chủ đề mà từ này xuất hiện chính (nơi định nghĩa nó). */
  primaryThemeId: string;
  primaryLessonId: string;
  /** Từ tiếng Anh, đã chuẩn hoá về headword A–Z. */
  en: string;
  /** Nghĩa tiếng Việt hiển thị cho bé. */
  vi: string;
  type: PosType;
  /** Emoji đại diện. Phải DUY NHẤT trong phạm vi một chủ đề. Cho phép ghép 1–3 emoji. */
  icon: string;
  /** Phiên âm IPA (tuỳ chọn). */
  phonetic?: string;
  forms?: WordForms;
  /**
   * Có thể vẽ thành hình không.
   * `false` cho từ trừu tượng (breakfast, morning, class...).
   * Game dạng hình PHẢI lọc theo cờ này, nếu không bé sẽ không có gì để chạm.
   */
  picturable: boolean;
}

export interface Lesson {
  /** "{themeId}/{code}" */
  id: string;
  themeId: string;
  name_vi: string;
  /**
   * 4–8 từ (1 bài = 1 phiên chơi; lưới từ được thiết kế cho <= 8).
   *
   * KHÔNG có trường `order`: thứ tự bài do thứ tự phần tử trong `Theme.lessonIds`.
   */
  wordIds: string[];
  exerciseIds: string[];
}

export interface Theme {
  id: string;
  levelId: string;
  name_en: string;
  name_vi: string;
  icon: string;
  /**
   * Khoá asset tranh cảnh (KHÔNG phải đường dẫn): "at-the-zoo".
   * Chuỗi rỗng "" = chủ đề chưa có tranh (hợp lệ — validator bỏ qua).
   */
  sceneImage: string;
  sceneAlt: string;
  /**
   * KHÔNG có trường `order`: thứ tự trên bản đồ hành trình do thứ tự phần tử trong
   * `Level.themeIds`. Đây cũng là thứ tự dùng để xét luật mở khoá (previous_theme).
   */
  unlockCondition: UnlockCondition;
  lessonIds: string[];
}

export interface Level {
  id: string;
  code: string;
  name_en: string;
  name_vi: string;
  /** Thứ tự cấp học — Starters=1, Movers=2, Flyers=3. */
  order: number;
  /** Thứ tự chủ đề trên bản đồ — cũng là thứ tự xét mở khoá. */
  themeIds: string[];
}

/**
 * Tranh cảnh TOÀN CỤC — **KHÔNG thuộc `Theme` nào**.
 *
 * Ví dụ: nền màn hình M6 "Nhà thú cưng" (nơi 5 linh vật sống cùng nhau).
 *
 * Vì sao tách khỏi `Theme.sceneImage`: nếu nhét tranh nhà vào một Theme nào đó thì
 * màn hình M6 vô tình phụ thuộc vào chủ đề đó — đổi/xoá chủ đề là vỡ màn hình.
 * Để riêng ở registry này thì thêm màn hình mới (sân chơi, lớp học riêng...) chỉ
 * cần thêm asset, KHÔNG phải sửa cấu trúc `Theme`.
 */
export interface GlobalSceneAsset {
  id: string;
  /** Khoá tra cứu trong code: "homeSceneImage". */
  key: string;
  /** Khoá asset tranh (KHÔNG phải đường dẫn): "home-scene" ⇒ assets/scenes/home-scene.webp */
  image: string;
  /** Mô tả tiếng Việt — dùng cho screen reader. */
  description: string;
  /** Màn hình dùng tranh này: "M6". */
  usedInScreen: string;
}

/**
 * Một thẻ chủ đề trên bản đồ hành trình (M4).
 *
 * CHỈ chứa dữ liệu NỘI DUNG. Trạng thái mở khoá (`unlocked`) và số sao KHÔNG nằm ở
 * đây vì chúng là dữ liệu TIẾN ĐỘ của từng bé — do `ProgressService` cung cấp và UI
 * ghép lại. Giữ `ContentRepository` thuần nội dung thì nó mới test được và cache được.
 */
export interface ThemeMapItem {
  theme: Theme;
  /** Vị trí trên bản đồ hành trình, bắt đầu từ 1 (theo thứ tự `level.themeIds`). */
  index: number;
  wordCount: number;
  lessonCount: number;
  exerciseCount: number;
  /** URL tranh cảnh, hoặc `null` nếu chủ đề chưa có tranh. */
  sceneUrl: string | null;
}

// =============================================================================
// Exercise config — discriminated union theo `kind`
// =============================================================================

/** Vị trí ô trống trong game Điền chữ cái. */
export type HidePosition = 'any' | 'start' | 'middle' | 'end';

/**
 * Nguồn chọn từ gây nhiễu (distractor) trong game Nghe & Chạm.
 *
 * ⭐ `'same_lesson'` là chế độ MỚI (T02): nhiễu lấy từ CÙNG BÀI HỌC với đáp án
 *   (`word.primaryLessonId === target.primaryLessonId`), thay vì từ cả chủ đề hay từ chủ đề khác.
 *   Lý do: trong một chủ đề có nhiều BÀI; lấy nhiễu ở cấp chủ đề (`same_theme`) vẫn lẫn sang bài
 *   bé CHƯA học (vd `at-the-zoo` có `z1` động vật lớn, `z2` vật nuôi, `z3` bò sát), và lấy từ
 *   chủ đề khác (`cross_theme`) thì ra hẳn thứ không liên quan — đúng thứ chủ dự án đã chê
 *   ("nhiễu phải lấy từ cùng bài học").
 *
 * ⚠️ `'cross_theme'` ĐƯỢC GIỮ LẠI trong union dù hiện chưa bài nào dùng (sau T02, chỉ còn
 *    `at-the-zoo` có bài `listen_tap`, và cả 3 bài đều chuyển sang `same_lesson`). Giữ để chủ đề
 *    khác về sau có thể chọn độ khó "nhiễu đến từ chủ đề khác". Xoá đi là tự bịt một lựa chọn.
 */
export type DistractorMode = 'same_theme' | 'cross_theme' | 'similar_sound' | 'same_lesson';

export interface ListenTapConfig {
  kind: 'listen_tap';
  rounds: number;
  /** Số lựa chọn mỗi câu (2×2 ở điện thoại). */
  optionCount: number;
  distractorMode: DistractorMode;
  /** Tốc độ đọc, 0.5–1.2. Trẻ nhỏ cần chậm. */
  speechRate: number;
}

export interface MissingLetterConfig {
  kind: 'missing_letter';
  rounds: number;
  /** Số chữ cái bị ẩn. */
  hideCount: number;
  hidePosition: HidePosition;
  /** Có hiện hình gợi ý không (tắt dần khi độ khó tăng). */
  showImageHint: boolean;
}

export interface PrepositionSlot {
  sentenceEn: string;
  preposition: string;
  correctSlot: string;
  slots: string[];
}

export interface PrepositionsConfig {
  kind: 'prepositions';
  rounds: number;
  slots: PrepositionSlot[];
}

export interface MemoryMatchConfig {
  kind: 'memory_match';
  /** 'en_icon' = ghép từ ↔ hình; 'en_vi' = ghép tiếng Anh ↔ tiếng Việt. */
  pairMode: 'en_icon' | 'en_vi';
  /** Số cặp thẻ (6 thẻ = 3 cặp, 12 thẻ = 6 cặp...). */
  pairs: number;
  /** Số lượt lật mục tiêu để được thưởng thêm. */
  targetFlips?: number;
}

export interface WordPictureConfig {
  kind: 'word_picture';
  pairs: number;
  /** Cột phải hiện chữ hay chỉ hiện nút nghe. */
  rightColumn: 'word' | 'audio';
}

export interface WordSearchConfig {
  kind: 'word_search';
  gridSize: number;
  wordCount: number;
  directions: Array<'horizontal' | 'vertical' | 'diagonal' | 'reverse'>;
}

export interface NumberMatchConfig {
  kind: 'number_match';
  pairs: number;
  range: [number, number];
  /** Chế độ chỉ nghe: không hiện chữ số, chỉ đọc. */
  audioOnly: boolean;
}

export interface SayItConfig {
  kind: 'say_it';
  rounds: number;
  /** Mức khớp tối thiểu 0–1; trẻ nhỏ nên để thấp. */
  matchThreshold: number;
}

export interface WordBuilderConfig {
  kind: 'word_builder';
  rounds: number;
  showImageHint: boolean;
}

export interface SortBasketConfig {
  kind: 'sort_basket';
  /** Nhóm và các từ thuộc nhóm đó. */
  baskets: Array<{ label_vi: string; icon: string; wordIds: string[] }>;
}

export interface CountTapConfig {
  kind: 'count_tap';
  rounds: number;
  maxCount: number;
}

export interface ColourLearnConfig {
  kind: 'colour_learn';
  rounds: number;
  colourWordIds: string[];
}

export type ExerciseConfig =
  | ListenTapConfig
  | MissingLetterConfig
  | PrepositionsConfig
  | MemoryMatchConfig
  | WordPictureConfig
  | WordSearchConfig
  | NumberMatchConfig
  | SayItConfig
  | WordBuilderConfig
  | SortBasketConfig
  | CountTapConfig
  | ColourLearnConfig;

/** Độ khó 1–3; tăng dần trong cùng một chủ đề. */
export type Difficulty = 1 | 2 | 3;

export interface Exercise {
  /** "{lessonId}/{game-slug}" */
  id: string;
  lessonId: string;
  gameType: GameType;
  /** Từ tham gia exercise. Game dạng hình phải có >= 4 từ `picturable`. */
  wordIds: string[];
  difficulty: Difficulty;
  config: ExerciseConfig;
}

/** Một chủ đề đã nạp đầy đủ (theme + lessons + words + exercises). */
export interface ThemeBundle {
  theme: Theme;
  lessons: Lesson[];
  words: Word[];
  exercises: Exercise[];
}

/** Nội dung một level đã nạp và lập chỉ mục (index dựng ở cấp LEVEL). */
export interface LevelBundle {
  level: Level;
  themes: Theme[];
  lessons: Lesson[];
  words: Word[];
  exercises: Exercise[];
  /** Tra cứu nhanh — dựng một lần khi nạp. */
  wordById: Map<string, Word>;
  lessonById: Map<string, Lesson>;
  themeById: Map<string, Theme>;
  exerciseById: Map<string, Exercise>;
  /** Từ đã học/đang học ở nhiều chủ đề vẫn chỉ có MỘT id. */
  wordIdsByTheme: Map<string, string[]>;
}

/** Kiểu tương tác — dùng để hiển thị nhãn và chọn input handler. */
export type InteractionKind =
  | 'tap' // chạm
  | 'type' // gõ chữ
  | 'flip' // lật thẻ
  | 'connect' // nối
  | 'drag' // kéo-thả
  | 'speak' // nói
  | 'paint'; // tô màu

/** Nhãn hiển thị của từng game (tiếng Việt, dùng cho UI). */
export const GAME_LABELS: Record<GameType, { name_vi: string; icon: string; interaction: InteractionKind }> = {
  listen_tap: { name_vi: 'Nghe & Chạm', icon: '👂', interaction: 'tap' },
  missing_letter: { name_vi: 'Điền chữ cái còn thiếu', icon: '✏️', interaction: 'type' },
  prepositions: { name_vi: 'Thú cưng trốn ở đâu?', icon: '🙈', interaction: 'tap' },
  memory_match: { name_vi: 'Lật thẻ ghi nhớ', icon: '🃏', interaction: 'flip' },
  word_picture: { name_vi: 'Nối từ với hình', icon: '🔗', interaction: 'connect' },
  word_search: { name_vi: 'Tìm từ trong ô chữ', icon: '🔍', interaction: 'connect' },
  number_match: { name_vi: 'Nối số & chữ', icon: '🔢', interaction: 'connect' },
  say_it: { name_vi: 'Bé nói theo', icon: '🗣️', interaction: 'speak' },
  word_builder: { name_vi: 'Xếp chữ thành từ', icon: '🧩', interaction: 'drag' },
  sort_basket: { name_vi: 'Giỏ đồ của bé', icon: '🧺', interaction: 'drag' },
  count_tap: { name_vi: 'Đếm & chạm theo thứ tự', icon: '🔢', interaction: 'tap' },
  colour_learn: { name_vi: 'Tô màu theo từ', icon: '🎨', interaction: 'paint' },
};
