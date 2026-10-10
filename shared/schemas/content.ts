/**
 * RubyLingo — Zod schema cho NỘI DUNG HỌC + hệ thống thưởng.
 *
 * Dùng chung client & server:
 *   - client: kiểm tra dữ liệu khi nạp (dev)
 *   - script `validate-content.ts`: chặn dữ liệu lỗi trước khi build
 *
 * Các quy tắc ở đây phản ánh những lỗi THẬT đã từng xảy ra trong quá trình sinh nội dung:
 *   - thiếu `picturable`  ⇒ game Nghe & Chạm không có hình để chạm
 *   - trùng emoji trong 1 chủ đề ⇒ bé chạm đúng mà app báo sai
 *   - trùng `word.id` giữa 2 chủ đề ⇒ tiến độ 2 nghĩa khác nhau bị gộp
 *   - bài > 8 từ ⇒ lưới từ tràn màn hình điện thoại
 *   - chủ đề đầu tiên để `previous_theme` ⇒ bản đồ hành động chết, không mở được gì
 */

import { z } from 'zod';
import { ACCESSORY_SLOTS, DECORATION_SLOTS } from '../pet-slots.js';
import { MVP_GAME_TYPES } from '../types/content.js';
import { finalTestIndexEntrySchema } from './final-test.js';

// =============================================================================
// Nội dung học
// =============================================================================

/** Slug id: chữ thường, số, gạch ngang; cho phép '.' và '/' vì id có tiền tố level. */
const idString = z
  .string()
  .min(2)
  .regex(/^[a-z0-9][a-z0-9._/-]*$/, 'id chỉ được chứa a-z 0-9 . _ - /');

const posTypeSchema = z.enum([
  'n',
  'v',
  'adj',
  'adv',
  'prep',
  'conj',
  'pron',
  'det',
  'excl',
  'num',
  // Kính ngữ Mr/Mrs/Miss — có thật trong word list Starters (my-friends-birthday).
  'title',
]);

export const gameTypeSchema = z.enum([
  'listen_tap',
  'missing_letter',
  'prepositions',
  'memory_match',
  'word_picture',
  'word_search',
  'number_match',
  'say_it',
  'word_builder',
  'sort_basket',
  'count_tap',
  'colour_learn',
]);

export const wordFormsSchema = z.object({
  plural: z.string().min(1).optional(),
  alt: z.array(z.string().min(1)).min(1).optional(),
});

export const wordSchema = z.object({
  id: idString,
  levelId: idString,
  primaryThemeId: idString,
  primaryLessonId: idString,
  en: z.string().min(1),
  vi: z.string().min(1),
  type: posTypeSchema,
  icon: z.string().min(1),
  phonetic: z.string().min(1).optional(),
  forms: wordFormsSchema.optional(),
  /** BẮT BUỘC — thiếu trường này là lỗi chặn (xem ghi chú đầu file). */
  picturable: z.boolean(),
});

export const lessonSchema = z
  .object({
    id: idString,
    themeId: idString,
    name_vi: z.string().min(1),
    // KHÔNG có trường `order`. Thứ tự bài do THỨ TỰ phần tử trong `theme.lessonIds`
    // quyết định. Trước đây có `order` và nó đã lệch với `lessonIds` — hai nguồn chân
    // lý cho cùng một thứ luôn lệch nhau. Một danh sách, một thứ tự.
    wordIds: z.array(idString),
    exerciseIds: z.array(idString),
  })
  .refine((l) => l.wordIds.length >= 4 && l.wordIds.length <= 8, {
    message: 'Mỗi bài phải có 4–8 từ (1 bài = 1 phiên chơi; lưới từ thiết kế cho <= 8)',
    path: ['wordIds'],
  });

export const unlockConditionSchema = z.object({
  type: z.enum(['always', 'previous_theme', 'stars_required', 'coming_soon']),
  stars: z.number().int().min(1).optional(),
});

export const themeSchema = z.object({
  id: idString,
  levelId: idString,
  name_en: z.string().min(1),
  name_vi: z.string().min(1),
  icon: z.string().min(1),
  /** Khoá asset, KHÔNG phải đường dẫn. "" = chưa có tranh (hợp lệ). */
  sceneImage: z.string(),
  sceneAlt: z.string(),
  // KHÔNG có trường `order`. Thứ tự chủ đề trên bản đồ hành trình do THỨ TỰ phần tử
  // trong `level.themeIds` quyết định (validator V10 dựa vào đó để kiểm luật mở khoá).
  // Trước đây có `order` và nó đã lệch với `themeIds` khi đổi thứ tự hành trình.
  unlockCondition: unlockConditionSchema,
  lessonIds: z.array(idString),
});

export const levelSchema = z.object({
  id: idString,
  code: idString,
  name_en: z.string().min(1),
  name_vi: z.string().min(1),
  /** Thứ tự cấp học — Starters=1, Movers=2, Flyers=3. Dùng để sắp menu chọn cấp. */
  order: z.number().int().min(1),
  themeIds: z.array(idString).min(1),
});

// --- Exercise config: discriminated union theo `kind` -----------------------

const listenTapConfigSchema = z.object({
  kind: z.literal('listen_tap'),
  rounds: z.number().int().min(1).max(30),
  optionCount: z.number().int().min(2).max(6),
  /**
   * ⚠️ PHẢI KHỚP `DistractorMode` trong `shared/types/content.ts` — cùng một nguồn sự thật.
   *    Thiếu `'same_lesson'` ở đây thì dữ liệu `at-the-zoo` (đã chuyển sang chế độ đó ở T02) sẽ
   *    bị `validate:content` TỪ CHỐI ngay, dù mã game đã hiểu chế độ mới.
   */
  distractorMode: z.enum(['same_theme', 'cross_theme', 'similar_sound', 'same_lesson']),
  speechRate: z.number().min(0.5).max(1.2),
});

const missingLetterConfigSchema = z.object({
  kind: z.literal('missing_letter'),
  rounds: z.number().int().min(1).max(30),
  hideCount: z.number().int().min(1).max(4),
  hidePosition: z.enum(['any', 'start', 'middle', 'end']),
  showImageHint: z.boolean(),
});

/**
 * LƯU Ý KỸ THUẬT: schema này cố tình KHÔNG có `.refine()`.
 *
 * `z.discriminatedUnion()` chỉ chấp nhận các thành viên là `ZodObject` thuần. Gọi
 * `.refine()` sẽ bọc schema thành `ZodEffects` và làm `discriminatedUnion` ném lỗi
 * `Cannot read properties of undefined (reading 'kind')` ngay lúc import module.
 *
 * Vì vậy 2 quy tắc của prepositions được kiểm ở `.superRefine()` gắn SAU union
 * (xem `exerciseConfigSchema` bên dưới).
 */
const prepositionsConfigSchema = z.object({
  kind: z.literal('prepositions'),
  rounds: z.number().int().min(1).max(20),
  slots: z
    .array(
      z.object({
        sentenceEn: z.string().min(3),
        preposition: z.string().min(1),
        correctSlot: z.string().min(1),
        slots: z.array(z.string().min(1)).min(2),
      }),
    )
    .min(1),
});

const memoryMatchConfigSchema = z.object({
  kind: z.literal('memory_match'),
  pairMode: z.enum(['en_icon', 'en_vi']),
  pairs: z.number().int().min(3).max(10),
  targetFlips: z.number().int().min(3).optional(),
});

const wordPictureConfigSchema = z.object({
  kind: z.literal('word_picture'),
  pairs: z.number().int().min(3).max(8),
  rightColumn: z.enum(['word', 'audio']),
});

const wordSearchConfigSchema = z.object({
  kind: z.literal('word_search'),
  gridSize: z.number().int().min(5).max(12),
  wordCount: z.number().int().min(2).max(10),
  directions: z.array(z.enum(['horizontal', 'vertical', 'diagonal', 'reverse'])).min(1),
});

const numberMatchConfigSchema = z.object({
  kind: z.literal('number_match'),
  pairs: z.number().int().min(2).max(10),
  range: z.tuple([z.number().int(), z.number().int()]),
  audioOnly: z.boolean(),
});

const sayItConfigSchema = z.object({
  kind: z.literal('say_it'),
  rounds: z.number().int().min(1).max(20),
  matchThreshold: z.number().min(0).max(1),
});

const wordBuilderConfigSchema = z.object({
  kind: z.literal('word_builder'),
  rounds: z.number().int().min(1).max(20),
  showImageHint: z.boolean(),
});

const sortBasketConfigSchema = z.object({
  kind: z.literal('sort_basket'),
  baskets: z
    .array(
      z.object({
        label_vi: z.string().min(1),
        icon: z.string().min(1),
        wordIds: z.array(idString).min(1),
      }),
    )
    .min(2),
});

const countTapConfigSchema = z.object({
  kind: z.literal('count_tap'),
  rounds: z.number().int().min(1).max(20),
  maxCount: z.number().int().min(3).max(20),
});

const colourLearnConfigSchema = z.object({
  kind: z.literal('colour_learn'),
  rounds: z.number().int().min(1).max(20),
  colourWordIds: z.array(idString).min(2),
});

export const exerciseConfigSchema = z
  .discriminatedUnion('kind', [
    listenTapConfigSchema,
    missingLetterConfigSchema,
    prepositionsConfigSchema,
    memoryMatchConfigSchema,
    wordPictureConfigSchema,
    wordSearchConfigSchema,
    numberMatchConfigSchema,
    sayItConfigSchema,
    wordBuilderConfigSchema,
    sortBasketConfigSchema,
    countTapConfigSchema,
    colourLearnConfigSchema,
  ])
  // Quy tắc riêng của prepositions phải nằm SAU union (xem ghi chú ở prepositionsConfigSchema).
  .superRefine((cfg, ctx) => {
    if (cfg.kind !== 'prepositions') return;
    cfg.slots.forEach((slot, i) => {
      if (!slot.slots.includes(slot.correctSlot)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['slots', i, 'correctSlot'],
          message: `correctSlot "${slot.correctSlot}" không nằm trong slots [${slot.slots.join(', ')}] — bé không thể chọn đúng`,
        });
      }
      if (!slot.sentenceEn.includes(slot.preposition)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['slots', i, 'sentenceEn'],
          message: `sentenceEn "${slot.sentenceEn}" không chứa preposition "${slot.preposition}" — câu đọc lên không khớp đáp án`,
        });
      }
    });
  });

export const exerciseSchema = z.object({
  id: idString,
  lessonId: idString,
  gameType: gameTypeSchema,
  wordIds: z.array(idString).min(1),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  config: exerciseConfigSchema,
});

/** Schema của MỘT file theme (đúng cấu trúc JSON đang có trên đĩa). */
export const themeFileSchema = z.object({
  theme: themeSchema,
  lessons: z.array(lessonSchema),
  words: z.array(wordSchema),
  exercises: z.array(exerciseSchema),
});

export type ThemeFile = z.infer<typeof themeFileSchema>;

// =============================================================================
// Tranh cảnh toàn cục (asset KHÔNG thuộc Theme nào)
// =============================================================================

export const globalScenesFileSchema = z.object({
  note: z.string().optional(),
  scenes: z
    .array(
      z.object({
        id: idString,
        /** Khoá tra cứu trong code: "homeSceneImage". */
        key: z.string().min(1),
        /** Khoá asset (KHÔNG phải đường dẫn): "home-scene". */
        image: z.string().min(1),
        description: z.string().min(1),
        usedInScreen: z.string().min(1),
      }),
    )
    .min(1),
});

// =============================================================================
// Avatar dựng sẵn cho bé
// =============================================================================

/**
 * Bộ avatar bé chọn khi tạo hồ sơ.
 *
 * Server dùng danh sách này để kiểm `avatarId` gửi lên (V18 kiểm id/icon không trùng).
 * KHÔNG có trường nào cho ảnh do người dùng tải lên — ràng buộc COPPA/GDPR-K.
 */
export const avatarsFileSchema = z.object({
  note: z.string().optional(),
  avatars: z
    .array(
      z.object({
        id: idString,
        name_vi: z.string().min(1),
        icon: z.string().min(1),
      }),
    )
    .min(4),
});

export type AvatarsFile = z.infer<typeof avatarsFileSchema>;

/** Một avatar trong bộ chọn. Dùng chung cho lưới chọn avatar (client) và kiểm `avatarId` (server). */
export type AvatarOption = AvatarsFile['avatars'][number];

// =============================================================================
// Hệ thống thưởng
// =============================================================================

export const rewardGrantSchema = z.object({
  kind: z.enum(['stars', 'acorns', 'xp', 'badge', 'sticker', 'item']),
  refId: z.string().min(1).optional(),
  amount: z.number().int().min(0).optional(),
});

export const xpLevelsFileSchema = z.object({
  note: z.string().optional(),
  levels: z
    .array(
      z.object({
        level: z.number().int().min(1),
        title_vi: z.string().min(1),
        icon: z.string().min(1),
        xpRequired: z.number().int().min(0),
        rewards: z.array(rewardGrantSchema),
      }),
    )
    .min(2),
  /**
   * Ba giai đoạn tiến hoá của linh vật — theo TỔNG SỐ TỪ ĐÃ HỌC.
   *
   * ⚠️⚠️ ĐÃ BỎ BẬC `'egg'` (T04) — TRƯỚC ĐÂY CÓ 4 BẬC `egg/baby/adult/super`.
   *   VÌ SAO: một quả trứng 🥚 không phải "con thú cưng" — nó là một trạng thái CHỜ. Nhưng DB cũ
   *   (`003_progress.sql`) ghi `evolution_stage = 'egg'` cho MỌI bé, và `PetAvatar` vẽ quả trứng
   *   cho tới khi bé học đủ từ. Kết hợp với T04 (bé CHỌN con mình muốn ngay từ đầu), giữ `egg`
   *   nghĩa là bé vừa chọn "Rồng" xong lại thấy một quả trứng 🥚 vô danh — chọn con mà không thấy
   *   con. Nên bậc đầu tiên nay là `'baby'` (bé mới chọn ra một con non).
   *
   * ⚠️ PHẢI KHỚP `EvolutionStage` trong `shared/types/reward.ts` — cùng một nguồn sự thật.
   *    Để lệch (ví dụ giữ `'egg'` ở đây) thì `xp-levels.json` cũ sẽ bị `validate:content` TỪ CHỐI
   *    ngay, dù mã đã hiểu bộ bậc mới.
   *
   * ⚠️ `.min(2)` vẫn giữ: cần ít nhất 2 bậc để có một ngưỡng tiến hoá. Luật "bậc sau đòi nhiều
   *    từ hơn bậc trước" (V15) nằm ở `scripts/validate-content.ts`, không lặp lại ở đây.
   */
  evolutionStages: z
    .array(
      z.object({
        stage: z.enum(['baby', 'adult', 'super']),
        name_vi: z.string().min(1),
        icon: z.string().min(1),
        wordsRequired: z.number().int().min(0),
      }),
    )
    .min(2),
});

export const questCriteriaSchema = z.union([
  z.object({ kind: z.literal('complete_lessons'), count: z.number().int().min(1) }),
  z.object({ kind: z.literal('complete_lesson'), lessonId: z.string().min(1) }),
  z.object({ kind: z.literal('play_games'), count: z.number().int().min(1) }),
  z.object({ kind: z.literal('correct_answers'), count: z.number().int().min(1) }),
  z.object({ kind: z.literal('learn_days'), count: z.number().int().min(1) }),
  z.object({ kind: z.literal('unlock_theme'), count: z.number().int().min(1) }),
  z.object({ kind: z.literal('complete_theme'), themeId: z.string().min(1) }),
  z.object({ kind: z.literal('collect_stickers'), count: z.number().int().min(1) }),
  z.object({ kind: z.literal('reach_level'), level: z.number().int().min(1) }),
  /** Hoàn thành cả bài thi cuối khoá — không tham số (xem `QuestCriteria`). */
  z.object({ kind: z.literal('complete_final_test') }),
]);

export const questsFileSchema = z.object({
  note: z.string().optional(),
  quests: z.array(
    z.object({
      id: z.string().min(2),
      tier: z.enum(['daily', 'weekly', 'milestone']),
      description_vi: z.string().min(1),
      icon: z.string().min(1),
      criteria: questCriteriaSchema,
      rewards: z.array(rewardGrantSchema).min(1),
      phase: z.enum(['mvp', 'p1', 'p2']),
    }),
  ),
});

/**
 * Vị trí hợp lệ cho từng nhóm vật phẩm — **KHÔNG khai lại ở đây**, đọc từ `shared/pet-slots.ts`.
 *
 * ⚠️ `shop.ts` (lớp tra cứu) cũng đọc đúng hai mảng này. Nếu mỗi bên có một bản, ngày ai đó thêm
 *    vị trí `'tail'` vào một bản thì schema cho qua còn `PetAvatar` coi là không hợp lệ ⇒ món đồ
 *    biến mất khỏi Momo mà cả hai cổng đều xanh.
 */
const accessorySlots = ACCESSORY_SLOTS;
const decorationSlots = DECORATION_SLOTS;

/**
 * ⚠️ `z.enum(ACCESSORY_SLOTS).or(z.enum(DECORATION_SLOTS))` chứ KHÔNG phải `z.enum([...A, ...D])`:
 *    trải hai bộ `as const` vào một mảng literal làm TypeScript suy ra `string[]`, mà `z.enum`
 *    đòi một TUPLE (`[string, ...string[]]`) ⇒ lỗi biên dịch. Hai `z.enum` nối bằng `.or()` cho ra
 *    đúng kiểu `AccessorySlot | DecorationSlot`, và vẫn giữ nguyên một nguồn dữ liệu.
 */
const petSlotSchema = z.enum(ACCESSORY_SLOTS).or(z.enum(DECORATION_SLOTS));

/**
 * Một vật phẩm trong cửa hàng.
 *
 * ⚠️⚠️ VÌ SAO CÓ `superRefine` Ở ĐÂY, KHÔNG CHỈ KHAI `slot` LÀ `optional()`:
 *   `PetAvatar` (T065) vẽ Momo dựa HOÀN TOÀN vào `slot`. Một phụ kiện thiếu `slot` vẫn biên dịch
 *   được, `validate:content` vẫn xanh, server vẫn chạy — và món đồ bé vừa trả ⭐ để mua sẽ
 *   **biến mất khỏi người Momo** mà không có một dòng lỗi nào. Đó là loại hỏng tệ nhất.
 *   `superRefine` biến "món mới phải có vị trí" từ một quy ước trong đầu thành một phép kiểm
 *   CHẠY ĐƯỢC, ngay lúc nạp JSON (⇒ danh mục sai làm server không khởi động được).
 *
 *   Và nó kiểm cả CHIỀU NGƯỢC: đồ ăn KHÔNG được có `slot`. Một quả chuối ghi `slot: 'head'` là
 *   một câu vô nghĩa nằm trong dữ liệu — để đó thì sớm muộn cũng có người đọc nó như sự thật.
 */
const shopItemSchema = z
  .object({
    id: z.string().min(2),
    name_vi: z.string().min(1),
    icon: z.string().min(1),
    category: z.enum(['food', 'accessory', 'decoration']),
    price: z.number().int().min(1),
    currency: z.enum(['stars', 'acorns']),
    description_vi: z.string().min(1),
    slot: petSlotSchema.optional(),
    happinessGain: z.number().int().min(1).max(5).optional(),
    effect: z.enum(['sparkle', 'big_animation', 'rainbow']).optional(),
    phase: z.enum(['mvp', 'p1', 'p2']),
  })
  .superRefine((item, ctx) => {
    if (item.category === 'food') {
      if (item.slot !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['slot'],
          message: 'Đồ ăn không được có "slot" — chỉ phụ kiện và trang trí mới chiếm một vị trí',
        });
      }
      return;
    }
    if (item.slot === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['slot'],
        message: `"${item.category}" phải có "slot" — thiếu thì món này không bao giờ hiện trên Momo`,
      });
      return;
    }
    const allowed: readonly string[] =
      item.category === 'accessory' ? accessorySlots : decorationSlots;
    if (!allowed.includes(item.slot)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['slot'],
        message: `"${item.slot}" không phải vị trí hợp lệ cho "${item.category}" (chỉ nhận: ${allowed.join(', ')})`,
      });
    }
  });

export const shopItemsFileSchema = z.object({
  note: z.string().optional(),
  currencies: z.record(z.enum(['stars', 'acorns']), z.object({ name_vi: z.string(), icon: z.string() })),
  items: z.array(shopItemSchema).min(1),
});

export const badgeCriteriaSchema = z.union([
  z.object({ kind: z.literal('complete_lesson'), lessonId: z.string().min(1) }),
  z.object({ kind: z.literal('complete_theme'), themeId: z.string().min(1) }),
  z.object({ kind: z.literal('perfect_lessons'), count: z.number().int().min(1) }),
  z.object({ kind: z.literal('streak_days'), days: z.number().int().min(1) }),
  z.object({ kind: z.literal('reach_level'), level: z.number().int().min(1) }),
  z.object({
    kind: z.literal('earn_currency'),
    currency: z.enum(['stars', 'acorns']),
    amount: z.number().int().min(1),
  }),
  z.object({ kind: z.literal('win_game'), gameType: z.string().min(1), count: z.number().int().min(1) }),
  /** Hoàn thành cả bài thi cuối khoá (mọi phần đều có ≥1 lần nộp) — xem `BadgeCriteria`. */
  z.object({ kind: z.literal('complete_final_test') }),
]);

export const badgesFileSchema = z.object({
  note: z.string().optional(),
  badges: z.array(
    z.object({
      id: z.string().min(2),
      name_vi: z.string().min(1),
      icon: z.string().min(1),
      description_vi: z.string().min(1),
      criteria: badgeCriteriaSchema,
      phase: z.enum(['mvp', 'p1', 'p2']),
    }),
  ),
});

export const stickersFileSchema = z.object({
  note: z.string().optional(),
  stickers: z.array(
    z.object({
      id: z.string().min(2),
      name_vi: z.string().min(1),
      icon: z.string().min(1),
      lessonId: z.string().min(1).optional(),
      phase: z.enum(['mvp', 'p1', 'p2']),
    }),
  ),
});

/**
 * Một thú cưng bé có thể chọn làm bạn đồng hành (T04).
 *
 * ⚠️ BA TRƯỜNG EMOJI, KHÔNG PHẢI MỘT: mỗi con phải có hình RIÊNG cho từng giai đoạn tiến hoá
 *   (`baby`/`adult`/`super`). Nếu chỉ có một emoji, mọi con sẽ "lớn lên" y hệt nhau và việc bé
 *   chọn con gì trở nên vô nghĩa — hình dáng linh vật đổi theo TỔNG SỐ TỪ ĐÃ HỌC, và đó là toàn
 *   bộ phần thưởng thị giác của tiến trình học.
 *
 * ⚠️ KHÔNG có trường `slot`/`price`/`currency`: thú cưng KHÔNG mua bằng tiền và KHÔNG chiếm vị
 *   trí phụ kiện. Đổi bạn đồng hành là MIỄN PHÍ (xem `choosePetRequestSchema`).
 *
 * ⚠️ `phase` giống mọi danh mục khác: cho phép ra mắt theo từng giai đoạn mà không phải xoá dữ
 *   liệu. MVP chỉ có các con `'mvp'`; `'p1'`/`'p2'` là chỗ đã dành sẵn cho các con sau này.
 */
const petSchema = z.object({
  id: z.string().min(2),
  name_vi: z.string().min(1),
  name_en: z.string().min(1),
  /** Emoji giai đoạn `baby` — con non bé vừa chọn. */
  iconBaby: z.string().min(1),
  /** Emoji giai đoạn `adult` — trưởng thành. */
  iconAdult: z.string().min(1),
  /** Emoji giai đoạn `super` — siêu cấp (đỉnh tiến hoá). */
  iconSuper: z.string().min(1),
  phase: z.enum(['mvp', 'p1', 'p2']),
});

/**
 * Danh mục thú cưng — `shared/content/pets.json`.
 *
 * ⚠️⚠️ `.superRefine` CHẶN TRÙNG `id` — VÀ ĐÂY LÀ CHỐT CHẶN QUAN TRỌNG NHẤT CỦA CẢ DANH MỤC.
 *   `id` là khoá tra cứu: `pet_state.pet_type` (DB) và `RewardService.choosePet` đều so với nó.
 *   Hai mục cùng `id` sẽ khiến bảng tra (`shared/content/pets.ts`) im lặng giữ mục SAU — nghĩa là
 *   con nào hiện ra phụ thuộc THỨ TỰ DÒNG trong file JSON, và chỉ đổi hành vi khi ai đó sắp xếp
 *   lại file. Kiểm ở đây biến lỗi đó thành một lần nạp module THẤT BẠI, ồn ào — thay vì một con
 *   thú cưng biến mất trong im lặng.
 */
export const petsFileSchema = z
  .object({
    note: z.string().optional(),
    pets: z.array(petSchema).min(1),
  })
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    file.pets.forEach((pet, i) => {
      if (seen.has(pet.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['pets', i, 'id'],
          message: `Trùng id thú cưng "${pet.id}" — id là khoá tra cứu, hai mục cùng id thì con nào hiện ra tuỳ thứ tự dòng trong file`,
        });
      }
      seen.add(pet.id);
    });
  });

// =============================================================================
// Chỉ mục nội dung (sinh tự động — KHÔNG sửa tay)
// =============================================================================

/**
 * Cấu trúc của các cấp học, do `scripts/gen-content-index.ts` quét `src/data/` rồi sinh ra.
 *
 * ⚠️⚠️ VÌ SAO CẦN MỘT TỆP THỨ HAI CHO CÙNG MỘT CÂY NỘI DUNG — ĐỌC TRƯỚC KHI "GỘP LẠI CHO GỌN":
 *
 *   Cây nội dung thật (`src/data/levels/*`) chỉ đọc được bằng hai cách:
 *     • `src/data/index.ts` — dùng `import.meta.glob`, là API của VITE. `tsconfig.server.json`
 *       không gom `src/`, và `import.meta.glob` không tồn tại khi chạy `node`/`tsx`.
 *     • `readFileSync` trực tiếp — chạy được ở dev (cwd = gốc repo) nhưng `npm start` chạy
 *       `dist-server/index.js`, nơi `src/data/` không được bảo đảm có mặt.
 *
 *   Nhưng SERVER **BẮT BUỘC** phải biết cây này, vì hai nhiệm vụ không thể chấm bằng sự kiện:
 *     • `complete_theme` — "hoàn thành CẢ chủ đề" cần biết chủ đề có MẤY bài và bài nào.
 *     • `unlock_theme`   — cần biết chủ đề nào có game, và điều kiện mở khoá của nó.
 *   Không có cây nội dung thì server chỉ còn hai lựa chọn: tin lời client ("con học xong rồi")
 *   — đúng thứ mà cả hệ thống này được dựng lên để chặn — hoặc để nhiệm vụ không bao giờ xong.
 *
 *   Nên: một tệp JSON SINH TỰ ĐỘNG nằm trong `shared/`, đi kèm cổng kiểm. Nó không phải
 *   "nguồn chân lý thứ hai" mà là một BẢN CHIẾU có cổng kiểm: `tests/unit/content/content-index.test.ts`
 *   đọc lại `src/data/` từ đĩa và đối chiếu TỪNG trường ⇒ lệch là CI đỏ. Cùng mô hình với
 *   `tokens.css` ↔ `gen-theme-colors.ts` và `word-assets.json` ↔ `convert_words.py`.
 *
 * ⚠️ Tệp này chứa thứ server cần — VÀ DANH SÁCH ĐÓ ĐÃ ĐƯỢC NỚI MỘT LẦN, CÓ LÝ DO (T073):
 *    Ban đầu nó CỐ Ý không chép `words`/`exercises`, vì "mỗi trường thừa là một trường có thể
 *    lệch, mà không ai dùng". Điều đó đúng cho tới khi BÁO CÁO PHỤ HUYNH ra đời: báo cáo phải
 *    hiện "từ con hay nhầm: *elephant* (con voi)" — mà chữ của từ CHỈ nằm ở `src/data/`, thứ
 *    server KHÔNG đọc được. Nên `words` (id + en + vi) nay được sinh vào đây.
 *
 *    ⚠️ Vì vậy luật "chỉ chép thứ server cần" KHÔNG bị bỏ — nó được ÁP LẠI đúng nghĩa: chỉ
 *    `words` được thêm (thứ báo cáo thật sự ĐỌC), còn `exercises` vẫn KHÔNG (không ai đọc).
 *    Thêm một trường nữa về sau thì phải trả lời được câu "ai đọc nó?".
 *
 *    ⚠️ Và `words` phải ĐỐI CHIẾU TỪNG TỪ với `src/data/` (cả `id` lẫn `en`/`vi`) —
 *    `tests/unit/content/content-index.test.ts` làm việc đó, không chỉ đếm số lượng.
 */
export const contentIndexFileSchema = z.object({
  note: z.string().optional(),
  /** Các cấp học, theo thứ tự `order` trong `level.json`. */
  levels: z.array(
    z.object({
      id: idString,
      /** Thứ tự chủ đề trên bản đồ — nguồn chân lý cho luật `previous_theme`. */
      themeIds: z.array(idString),
      /**
       * Id MỌI exercise "chơi được" của cấp (gameType ∈ `PLAYABLE_GAME_TYPES`) — DÙNG BỞI SERVER để
       * tự kiểm điều kiện mở khoá bài thi cuối khoá trước khi chấm (client chỉ là rào UX, gõ thẳng
       * API phải bị chặn). Trường này tồn tại vì server KHÔNG đọc được `src/data/` (xem khối comment
       * đầu `contentIndexFileSchema`), mà luật mở khoá lại cần biết bài nào chơi được.
       */
      requiredExerciseIds: z.array(idString),
      /**
       * Tóm tắt bài thi cuối khoá của cấp (đọc từ `final-test/manifest.json`) — hoặc `null` nếu cấp
       * chưa có đề. Server đọc để biết bài thi gồm mấy phần, mỗi phần mấy câu, phần nào chấm tự động.
       * ⚠️ KHÔNG chép toàn bộ đề vào đây (đề nặng, server không cần từng item).
       */
      finalTest: finalTestIndexEntrySchema.nullable(),
    }),
  ),
  themes: z.array(
    z.object({
      id: idString,
      levelId: idString,
      /** Vị trí trên bản đồ, bắt đầu từ 1 (khớp `ThemeMapItem.index`). */
      index: z.number().int().min(1),
      lessonIds: z.array(idString),
      /** Số từ của chủ đề (hợp `lesson.wordIds`) — điều kiện `coming_soon` đọc trường này. */
      wordCount: z.number().int().min(0),
      /** Chủ đề ĐÃ có bài tập game chưa. Quyết định thẻ hiện ⭐ hay tiến độ từ. */
      hasGames: z.boolean(),
      unlock: unlockConditionSchema,
    }),
  ),
  /**
   * CHỮ CỦA TỪ, tra theo `id` — nguồn duy nhất để server gọi tên một từ (T073).
   *
   * ⚠️ Mỗi `id` xuất hiện ĐÚNG MỘT LẦN, và bộ sinh NÉM LỖI nếu hai nơi định nghĩa cùng `id` với
   *    `en`/`vi` KHÁC nhau (không lặng lẽ lấy cái đầu — xem `gen-content-index.ts`). Lấy bừa một
   *    trong hai nghĩa là báo cáo phụ huynh sẽ hiện một từ mà bé chưa từng được dạy.
   */
  words: z.array(
    z.object({
      id: idString,
      en: z.string().min(1),
      vi: z.string().min(1),
    }),
  ),
});

export type ContentIndexFile = z.infer<typeof contentIndexFileSchema>;

// =============================================================================
// Tiện ích
// =============================================================================

/** Game nào có component ở MVP — dùng để lọc exercise khi runtime chưa có game đó. */
export const mvpGameTypesSchema = z.enum(MVP_GAME_TYPES as unknown as [string, ...string[]]);
