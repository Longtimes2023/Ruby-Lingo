/**
 * RubyLingo — `ThemePage`: một chủ đề (đường dẫn `/theme/:themeId`).
 *
 * ⭐ NHIỆM VỤ: từ "chủ đề" đi xuống "bài học". Đây là màn hình trung gian duy nhất giữa bản đồ
 *   và nội dung học, nên nó phải trả lời được đúng hai câu: *chủ đề này có những bài gì* và
 *   *bé vào bài bằng cách nào*.
 *
 * ⚠️⚠️ MÀN HÌNH NÀY PHẢI TỰ KIỂM TRA QUYỀN VÀO, KHÔNG ĐƯỢC TIN RẰNG BÉ CHỈ TỚI ĐƯỢC TỪ BẢN ĐỒ.
 *   Thẻ chủ đề khoá trên bản đồ không phải là `<Link>`, nên đường đi bình thường không tới được
 *   đây. Nhưng URL là thứ ai cũng gõ được, và tệ hơn: một chủ đề đang MỞ có thể trở thành KHOÁ
 *   ngay trong lúc bé đang ở trong đó (bố mẹ xoá tiến độ ở thiết bị khác rồi đồng bộ về). Nếu
 *   không kiểm tra, bé sẽ thấy danh sách bài của một chủ đề mà bấm vào bài nào cũng hỏng.
 *
 * ⭐⭐ VÌ SAO TRÒ CHƠI NẰM TRONG TỪNG DÒNG BÀI HỌC, KHÔNG PHẢI MỘT MỤC RIÊNG Ở CẤP CHỦ ĐỀ:
 *   Trước đây trang này có một mục "Trò chơi" liệt kê các LOẠI trò chơi của cả chủ đề, kèm nhãn
 *   "Sắp mở" cho mọi loại vì chưa có game nào được làm. Nay `listen_tap` đã chơi được, và mục
 *   đó lộ ra hai vấn đề:
 *     1. Nó liệt kê LOẠI trò chơi, nhưng URL lại cần một BÀI TẬP cụ thể
 *        (`/lesson/:lessonId/game/:exerciseSlug`). "Nghe & Chạm" của chủ đề này tồn tại 3 lần
 *        (mỗi bài một lần) — một chip ở cấp chủ đề không nói được là bài nào.
 *     2. Chủ đề `at-the-zoo` có 15 bài tập. Trải phẳng thành 15 chip ở cấp chủ đề thì bé phải
 *        đọc "Nghe & Chạm" ba lần và tự đoán cái nào thuộc bài nào.
 *   Đặt chip vào đúng dòng bài học giải cả hai: mỗi chip nằm ngay dưới bài của nó, và bài đó
 *   chính là thứ URL cần.
 *
 * ⚠️ CHỈ HIỆN CHIP CHO TRÒ ĐÃ CHƠI ĐƯỢC (`isGamePlayable`), KHÔNG hiện chip xám cho 4 trò còn
 *   lại. Bé 7 tuổi không đọc được một rừng chip xám; bé chỉ bấm được cái gì thì bé học được cái
 *   đó. Số trò còn đang làm được gộp thành MỘT DÒNG CHỮ nói thật ("2 trò chơi khác đang được
 *   làm") — đủ để không có khoảng trắng gây hiểu là "hỏng rồi", mà không tạo ra nút bấm dẫn tới
 *   hư không.
 *
 * ⚠️⚠️ HAI ĐIỀU KIỆN KHÁC NHAU, PHẢI KIỂM CẢ HAI:
 *     • `isGamePlayable(gameType)`  — trò này đã có component chưa (tình trạng MÃ NGUỒN).
 *     • `isExercisePlayable(exercise, runtime)` — MÁY NÀY có chơi được không (VD `say_it` cần
 *        micro, Safari/iOS không có). `getThemeBundle` KHÔNG lọc giúp: nó trả về ĐỦ bài tập của
 *        chủ đề. `GamePage` có kiểm tra lại, nhưng nếu chỉ dựa vào đó thì bé vẫn thấy một chip
 *        bấm vào rồi mới biết là không chơi được — đúng thứ cần tránh.
 */

import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import type { ThemeAccess } from '@shared/theme-access.js';
import type { Exercise, Lesson } from '@shared/types/content.js';
import { GAME_LABELS } from '@shared/types/content.js';

import { EmptyState } from '../components/common/EmptyState.js';
import { ProgressBar } from '../components/common/ProgressBar.js';
import { isGamePlayable } from '../components/games/shared/registry.js';
import { SceneImage } from '../components/journey/SceneImage.js';
import { sceneAssetUrlOrNull } from '../data/index.js';
import { useGameRuntime, useThemeBundle } from '../hooks/useContent.js';
import { useCompletedLessonIds, useLearnedWordIds } from '../hooks/useProgress.js';
import { useThemeAccess } from '../hooks/useThemeAccess.js';
import { cn } from '../lib/cn.js';
import { exerciseSlug, flashcardsPath, gamePath } from '../lib/paths.js';
import { themeAccentStyle } from '../lib/themeAccent.js';
import { isExercisePlayable } from '../services/ContentRepository.js';
import type { GameRuntime } from '../services/ContentRepository.js';

export function ThemePage() {
  const { themeId = '' } = useParams<{ themeId: string }>();
  const { t } = useTranslation();
  const bundle = useThemeBundle(themeId);
  const { byThemeId, isHydrated } = useThemeAccess();
  const learned = useLearnedWordIds();
  const completedLessons = useCompletedLessonIds();
  // Cần để biết MÁY NÀY chơi được trò nào — xem ghi chú "HAI ĐIỀU KIỆN" ở đầu file.
  const runtime = useGameRuntime();

  const access = byThemeId.get(themeId);

  // --- Không có chủ đề này -------------------------------------------------
  if (!bundle) {
    return (
      <EmptyState
        icon="🗺️"
        title={t('map.notFoundTitle')}
        description={t('map.notFoundHint')}
        action={
          <Link
            to="/"
            className="flex min-h-touch-lg w-full items-center justify-center rounded-kid border-2 border-brand bg-surface px-6 text-kid-md font-bold text-brand"
          >
            {t('map.title')}
          </Link>
        }
      />
    );
  }

  // --- Có chủ đề nhưng chưa mở --------------------------------------------
  if (!access || !access.enterable) {
    return (
      <EmptyState
        icon={access?.kind === 'coming_soon' ? '⏳' : '🔒'}
        title={access?.kind === 'coming_soon' ? t('map.comingSoon') : t('map.locked')}
        description={requirementText(access, t)}
        action={
          <Link
            to="/"
            className="flex min-h-touch-lg w-full items-center justify-center rounded-kid border-2 border-brand bg-surface px-6 text-kid-md font-bold text-brand"
          >
            {t('map.title')}
          </Link>
        }
      />
    );
  }

  const { theme, lessons, exercises } = bundle;
  const allDone = access.lessonCount > 0 && access.lessonsCompleted >= access.lessonCount;

  return (
    /**
     * ⭐ 4 biến TÔNG MÀU CHỦ ĐỀ đặt ở phần tử GỐC của cả trang, không phải riêng ở header.
     *   Nhờ vậy các dòng bài học (`LessonRow`) cũng thừa hưởng mà không phải truyền prop xuống —
     *   và một chủ đề mới chỉ cần thêm 4 token vào `tokens.css`, không phải sửa component nào.
     */
    <div className="flex flex-col gap-5" style={themeAccentStyle(theme.id)}>
      {/* --- Đầu trang: quay lại + nhận diện chủ đề ------------------------- */}
      <Link
        to="/"
        className="inline-flex w-fit min-h-[48px] items-center gap-2 rounded-kid border-2 border-line bg-surface px-4 text-kid-xs font-bold text-ink-soft"
      >
        <span aria-hidden="true">←</span>
        {t('map.title')}
      </Link>

      {/* Cùng ngôn ngữ thị giác với thẻ chào ở bản đồ: gradient rất nhạt đổ xuống trắng,
          bo góc lớn, và tranh được đóng khung thay vì dán trần lên nền. Nhờ vậy màn "chủ đề"
          đọc ra là CÙNG MỘT ỨNG DỤNG với màn bản đồ, chứ không phải hai màn của hai người khác nhau.
          Gradient lấy TÔNG CỦA CHỦ ĐỀ chứ không lấy hồng thương hiệu — đây là cách bé nhận ra
          mình đang ở chặng nào mà không phải đọc tên chủ đề. */}
      <header className="relative overflow-hidden rounded-card border-2 border-line bg-gradient-to-b from-th-soft via-th-tint to-surface p-4 shadow-kid">
        <div className="relative flex items-center gap-4">
          <SceneImage
            // Dùng chung một hàm dựng URL với bản đồ (`sceneAssetUrlOrNull`) — nếu tự ghép chuỗi
            // ở đây, đổi cách phục vụ asset sẽ phải sửa hai chỗ và một chỗ sẽ bị quên.
            src={sceneAssetUrlOrNull(theme.sceneImage)}
            fallbackIcon={theme.icon}
            iconClassName="text-kid-2xl"
            className="size-24 shrink-0 rounded-kid border-2 border-th-soft bg-surface shadow-kid"
          />

          <div className="min-w-0 flex-1">
            <h1 className="text-kid-xl leading-tight text-ink">{theme.name_vi}</h1>
            <p className="text-kid-sm text-ink-faint">{theme.name_en}</p>
            <p className="mt-1 text-kid-xs text-ink-soft">
              {t('map.wordAndLessonCount', {
                words: access.wordCount,
                lessons: access.lessonCount,
              })}
            </p>
            {access.hasGames && (
              <p className="mt-0.5 text-kid-xs font-bold tabular-nums text-star-ink">
                {isHydrated
                  ? t('map.starsOfMax', { stars: access.starsEarned, max: access.starsMax })
                  : '—'}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* --- Danh sách bài học --------------------------------------------- */}
      <section>
        <h2 className="mb-3 text-kid-lg text-ink">{t('theme.lessonsTitle')}</h2>

        <ul className="flex flex-col gap-3">
          {lessons.map((lesson, position) => (
            <li key={lesson.id}>
              <LessonRow
                lesson={lesson}
                position={position + 1}
                learnedCount={lesson.wordIds.reduce(
                  (count, id) => count + (learned.has(id) ? 1 : 0),
                  0,
                )}
                completed={completedLessons.has(lesson.id)}
                exercises={exercises.filter((exercise) => exercise.lessonId === lesson.id)}
                runtime={runtime}
              />
            </li>
          ))}
        </ul>

        {allDone && (
          <p className="mt-3 rounded-card border-2 border-success bg-surface-raised px-4 py-3 text-kid-sm font-bold text-success">
            🎉 {t('theme.allLessonsDone')}
          </p>
        )}
      </section>

      {/*
        --- Trò chơi ------------------------------------------------------
        ⚠️ MỤC NÀY CHỈ HIỆN KHI CHỦ ĐỀ CHƯA CÓ BÀI TẬP NÀO.
          Khi đã có bài tập, chip trò chơi nằm NGAY TRONG từng dòng bài học ở trên — xem ghi chú
          đầu file. Dựng thêm một mục ở đây chỉ để nói "đang được làm" là lặp lại thông tin cấp
          chủ đề mà vẫn không cho biết trò nào thuộc bài nào.

        ⭐ Nói rõ ĐANG LÀM, không nói "không có" — bé vừa học xong mà đọc "không có gì" thì giống
          như bị từ chối.
      */}
      {exercises.length === 0 && (
        <section>
          <h2 className="mb-3 text-kid-lg text-ink">{t('theme.gamesTitle')}</h2>
          <p className="rounded-kid border-2 border-dashed border-line bg-surface-raised px-4 py-3 text-kid-sm text-ink-soft">
            🐵 {t('theme.gamesSoon')}
          </p>
        </section>
      )}
    </div>
  );
}

// =============================================================================
// Một dòng bài học
// =============================================================================

interface LessonRowProps {
  lesson: Lesson;
  /** Số thứ tự hiển thị, bắt đầu từ 1. */
  position: number;
  learnedCount: number;
  /**
   * Bài đã HOÀN THÀNH chưa — lấy từ `LessonProgress.completed`, KHÔNG suy ra từ `learnedCount`.
   *
   * ⚠️ Hai đại lượng này KHÁC NHAU và đã từng gây ra mâu thuẫn nhìn thấy được: bé vuốt hết 7
   *   thẻ nhưng chưa bấm "🎉 Xong rồi!" thì màn này ghi "✓ Bé đã học xong bài này!" trong khi
   *   thẻ chủ đề trên bản đồ vẫn ghi "0/3 bài". Xem `completedLessonIds()` trong
   *   `shared/progress-merge.ts`.
   */
  completed: boolean;
  /**
   * Mọi bài tập của bài này — ĐÃ lọc theo `lessonId`, nhưng CHƯA lọc theo khả năng chơi.
   *
   * ⚠️ Cố ý truyền cả danh sách chứ không truyền sẵn "danh sách chơi được": dòng này cần biết
   *   cả số trò CÒN ĐANG LÀM để nói thật với bé. Truyền sẵn danh sách đã lọc thì con số đó
   *   không tính được ở đây, và nơi gọi lại phải tự đếm — hai chỗ cùng tính một thứ, sớm muộn
   *   cũng lệch.
   */
  exercises: Exercise[];
  /** Khả năng trình duyệt — để biết máy này chơi được trò nào. */
  runtime: GameRuntime;
}

function LessonRow({
  lesson,
  position,
  learnedCount,
  completed,
  exercises,
  runtime,
}: LessonRowProps) {
  const { t } = useTranslation();
  const total = lesson.wordIds.length;

  /**
   * Trò CHƠI ĐƯỢC NGAY: có component VÀ máy này chạy được.
   * Hai điều kiện khác nhau — xem ghi chú "HAI ĐIỀU KIỆN" ở đầu file.
   */
  const playable = exercises.filter(
    (exercise) => isGamePlayable(exercise.gameType) && isExercisePlayable(exercise, runtime),
  );
  /** Trò chưa chơi được: gộp thành một dòng chữ, KHÔNG thành chip xám. */
  const pendingCount = exercises.length - playable.length;

  return (
    <article className="flex flex-col gap-3 rounded-card border-2 border-line bg-surface p-4 shadow-kid">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full text-kid-sm font-bold tabular-nums',
            completed ? 'bg-success text-ink-inverse' : 'bg-th-soft text-th-ink',
          )}
        >
          {completed ? '✓' : position}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="text-kid-md leading-tight text-ink">{lesson.name_vi}</h3>
          <p className="mt-0.5 text-kid-xs text-ink-soft">
            {t('lesson.wordsInLesson', { count: total })}
            {' · '}
            {t('theme.wordsLearnedOf', { done: learnedCount, total })}
          </p>
        </div>
      </div>

      <ProgressBar
        value={learnedCount}
        total={total}
        tone="accent"
        label={t('theme.wordsLearnedOf', { done: learnedCount, total })}
      />

      {completed && <p className="text-kid-xs font-bold text-success">{t('lesson.completed')}</p>}

      {/*
        ⚠️ NÚT NÀY CỐ Ý GIỮ HỒNG THƯƠNG HIỆU, KHÔNG LẤY TÔNG CHỦ ĐỀ — đừng "sửa" cho đồng bộ.
          Hai lý do, cả hai đều đo được:
          ① TƯƠNG PHẢN: `--c-th-*` được chốt ở CIE L*≈56 để làm VIỀN và dải màu. Đặt chữ trắng
             lên đó chỉ được **3,62–3,67:1**, dưới ngưỡng AA 4,5:1 cho chữ thường. (Nếu lấy
             `bg-th-ink` thì đạt 5,37:1, nhưng xem lý do ②.)
          ② NHẤT QUÁN: nút này là HÀNH ĐỘNG CHÍNH của cả app (vào học), dùng ở mọi chủ đề. Nếu
             mỗi chủ đề một màu nút thì bé phải học lại "nút to nhất để làm gì" ở từng chặng —
             trong khi tông chủ đề sinh ra là để chỉ *bé đang ở đâu*, không phải *bấm cái gì*.
          Tông chủ đề vẫn hiện rõ ở: dải đầu trang, nhãn số bài, chip trò chơi, thanh tiến độ.
      */}
      <Link
        to={flashcardsPath(lesson.id)}
        className={cn(
          'inline-flex min-h-touch items-center justify-center gap-3 rounded-kid border-2',
          'border-brand bg-brand px-6 text-kid-md font-bold text-ink-inverse',
          'shadow-brand transition duration-kid active:translate-y-[1px] active:shadow-none',
          'select-none hoverable:brightness-110',
        )}
      >
        <span aria-hidden="true" className="text-[1.2em] leading-none">
          📖
        </span>
        <span>{t('lesson.flashcards')}</span>
      </Link>

      {/*
        --- Trò chơi của RIÊNG bài này -------------------------------------
        Chỉ dựng khối này khi có gì đó để nói — bài không có bài tập nào thì không hiện một cái
        khung rỗng (khung rỗng đọc là "hỏng rồi").
      */}
      {(playable.length > 0 || pendingCount > 0) && (
        <div className="flex flex-col gap-2 border-t-2 border-line pt-3">
          <p className="text-kid-xs font-bold text-ink-soft">{t('theme.gamesInLesson')}</p>

          {playable.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {playable.map((exercise) => (
                <li key={exercise.id}>
                  <Link
                    to={gamePath(exercise.lessonId, exerciseSlug(exercise))}
                    // Nhãn đọc nói rõ đây là một hành động ("Chơi trò ..."), vì trước mắt bé
                    // chỉ có tên trò chơi — screen reader đọc trơ ra sẽ thành một danh từ.
                    aria-label={t('theme.playGame', {
                      game: GAME_LABELS[exercise.gameType].name_vi,
                    })}
                    className={cn(
                      'inline-flex min-h-touch items-center gap-2 rounded-pill border-2',
                      'border-th bg-th-soft px-4 text-kid-xs font-bold text-th-ink',
                      'shadow-kid transition duration-kid active:translate-y-[1px] active:shadow-none',
                      'select-none hoverable:brightness-105',
                    )}
                  >
                    <span aria-hidden="true" className="text-[20px] leading-none">
                      {GAME_LABELS[exercise.gameType].icon}
                    </span>
                    {/*
                      ⚠️ `whitespace-nowrap` LÀ BẮT BUỘC — đã từng thấy lỗi này trên ảnh render
                        của bản trước: không có nó, tên trò chơi dài ("Điền chữ cái còn thiếu")
                        bị ngắt giữa viên thuốc và viên đó cao gấp đôi các viên khác. Bề rộng
                        viên do NỘI DUNG quyết định; chỗ hết chỗ là ở HÀNG (`flex-wrap` của `ul`).
                    */}
                    <span className="whitespace-nowrap">{GAME_LABELS[exercise.gameType].name_vi}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {pendingCount > 0 && (
            <p className="text-kid-xs text-ink-faint">
              🎮 {t('theme.gamesPending', { count: pendingCount })}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

// =============================================================================
// Nội bộ
// =============================================================================

function requirementText(
  access: ThemeAccess | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (!access) return t('map.notFoundHint');
  if (access.kind === 'coming_soon') return t('map.noContent');

  const requirement = access.requirement;
  if (!requirement) return t('map.locked');
  if (requirement.type === 'previous_theme') {
    return t('map.lockedByPrevious', { theme: requirement.themeName_vi });
  }
  return t('map.lockedByStars', { stars: requirement.stars, have: requirement.have });
}
