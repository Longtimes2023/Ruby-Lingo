/**
 * RubyLingo — `GamePage`: màn hình chơi game (`/lesson/:lessonId/game/:exerciseSlug`).
 *
 * ⭐ NHIỆM VỤ DUY NHẤT: dựng đúng game theo `exercise.gameType`, rồi bọc nó trong `GameShell`
 *   và `ResultOverlay`. Trang này KHÔNG biết luật của bất kỳ game nào.
 *
 * ⭐ THÊM GAME THỨ 13 = BA BƯỚC, KHÔNG SỬA FILE NÀY:
 *     1. thêm giá trị vào `GameType` (`shared/types/content.ts`)
 *     2. viết component nhận `GameComponentProps`
 *     3. thêm một dòng vào `GAME_COMPONENTS` ở `components/games/shared/registry.ts`
 *   Trang này đọc bảng đó — không có `if/else` theo tên game, và không có bảng sao chép nào
 *   trong file này để lệch với bảng thật.
 *
 * ⚠️⚠️ VÌ SAO URL DÙNG `exerciseSlug` CHỨ KHÔNG DÙNG CẢ `exercise.id`:
 *   `exercise.id` là `"at-the-zoo/z1/listen-tap"` — chứa cả `lessonId` ở trong. Nếu đưa nguyên
 *   vào URL thì đường dẫn thành `/lesson/at-the-zoo%2Fz1/game/at-the-zoo%2Fz1%2Flisten-tap`:
 *   lessonId bị lặp hai lần, và URL dài gấp đôi với hàng loạt `%2F` không ai đọc được.
 *   Nên URL chỉ mang phần cuối (`listen-tap`), còn `exercise.id` được GHÉP LẠI từ
 *   `lessonId + '/' + slug`. Đổi lại: phải kiểm tra bài tập ghép ra có thật hay không.
 *
 * ⚠️ TRANG NÀY TỰ KIỂM TRA QUYỀN VÀO — cùng lý do như `ThemePage`: URL là thứ ai cũng gõ được,
 *   và một chủ đề đang mở có thể bị khoá lại giữa phiên (bố mẹ xoá tiến độ ở máy khác).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { GAME_HEARTS, GAME_ROUND_POINTS } from '@shared/game-scoring.js';

import { GameShell } from '../components/games/shared/GameShell.js';
import { GAME_COMPONENTS } from '../components/games/shared/registry.js';
import { ResultOverlay } from '../components/games/shared/ResultOverlay.js';
import { LevelUpOverlay } from '../components/effects/LevelUpOverlay.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { useExercise, useGameRuntime, useLesson, useWordsByIds } from '../hooks/useContent.js';
import { useGameEngine } from '../hooks/useGameEngine.js';
import { useLessonBestScore, useLessonStars, useProgress } from '../hooks/useProgress.js';
import { useGameAward } from '../hooks/useRewards.js';
import { useThemeAccess } from '../hooks/useThemeAccess.js';
import { roundsOf } from '../lib/gameRounds.js';
import { themePath } from '../lib/paths.js';
import { isExercisePlayable } from '../services/ContentRepository.js';
import { gameResultQueue } from '../services/GameResultService.js';

export function GamePage() {
  const { lessonId = '', exerciseSlug = '' } = useParams<{
    lessonId: string;
    exerciseSlug: string;
  }>();
  const { t } = useTranslation();

  // Ghép lại id đầy đủ — xem ghi chú đầu file về việc URL chỉ mang phần cuối.
  const exerciseId = `${lessonId}/${exerciseSlug}`;

  const lesson = useLesson(lessonId);
  const exercise = useExercise(exerciseId);
  const runtime = useGameRuntime();
  const { byThemeId, isHydrated } = useThemeAccess();
  const { childId, isHydrated: progressReady } = useProgress();

  const words = useWordsByIds(exercise?.wordIds ?? []);
  const previousBestScore = useLessonBestScore(lessonId);
  const previousBestStars = useLessonStars(lessonId);

  /**
   * ⭐ PHẦN THƯỞNG CỦA LƯỢT CHƠI NÀY, TRA THEO `clientEventId`.
   *
   *   `gameResultQueue.enqueue()` trả về đúng mục vừa xếp, trong đó có `submission.clientEventId`
   *   — cũng chính là cổng chống ghi trùng ở server, và là khoá DUY NHẤT cho mỗi lượt chơi. Giữ
   *   nó trong state để màn kết quả tra được ĐÚNG phần thưởng của lượt nó đang hiện (thay vì một
   *   ô "phần thưởng gần nhất", thứ sẽ hiện nhầm phần thưởng của lượt khác khi mạng chậm).
   *
   * ⚠️ HAI HOOK NÀY PHẢI NẰM Ở ĐÂY — TRƯỚC MỌI `return` SỚM BÊN DƯỚI.
   *   Màn kết quả được render trong nhánh `if (engine.result)`. Gọi hook trong nhánh đó sẽ làm
   *   số lượng hook đổi giữa các lượt render (lúc chơi thì ít hơn lúc kết thúc) — React ném lỗi
   *   ngay, không phải hỏng im lặng, nhưng vẫn là hỏng.
   */
  const [submittedEventId, setSubmittedEventId] = useState<string | null>(null);
  const serverAward = useGameAward(submittedEventId);

  /**
   * Bé đã bấm "Chạm để tiếp tục" ở màn lên cấp chưa (T056).
   *
   * ⚠️ VÌ SAO PHẢI LÀ STATE, KHÔNG SUY RA TỪ `serverAward.levelUp`:
   *   Không có state thì màn lên cấp sẽ bật lại sau MỖI lần component render lại — mà nó render
   *   lại mỗi khi `rewardStore` thay đổi (nạp xong ảnh chụp ví, một lượt chơi khác gửi thành
   *   công...). Bé bấm tiếp tục, màn hình đóng, rồi tự mở lại ngay lập tức. Trạng thái "đã xem"
   *   này là của RIÊNG lượt chơi đó, nên nó thuộc về component.
   */
  const [levelUpDismissed, setLevelUpDismissed] = useState(false);

  const totalRounds = useMemo(() => roundsOf(exercise?.config), [exercise]);
  const gameType = exercise?.gameType;

  const engine = useGameEngine({
    totalRounds,
    maxHearts: gameType ? GAME_HEARTS[gameType] : 0,
    roundPoints: gameType ? GAME_ROUND_POINTS[gameType] : 0,
  });

  /**
   * Gửi kết quả lượt chơi lên server khi ván kết thúc (T049).
   *
   * ⭐ ĐÂY LÀ CHỖ DUY NHẤT GHI THÀNH TÍCH CỦA MỘT LƯỢT CHƠI. Server chấm lại điểm/sao từ
   *   `engine.state.answers` (nhật ký thật của từng câu) — client không gửi điểm, không gửi
   *   sao, nên không có đường nào để "tự phong" cho mình.
   *
   * ⚠️⚠️ ĐÃ XOÁ ĐOẠN GHI TẠM CŨ (`recordWordAnswer(word.id, true)` CHO MỌI TỪ).
   *   Đoạn đó ghi cả bài là ĐÚNG hết, vì lúc ấy chưa có chỗ nào giữ chi tiết từng câu. Nó là
   *   một lời nói dối trong sổ của bé: một bé sai 5 từ vẫn được ghi "đúng cả 5". Giờ engine
   *   giữ nhật ký thật (`state.answers`), nên không cần — và KHÔNG ĐƯỢC — ghi theo cách đó
   *   nữa: ghi song song sẽ làm `word_progress` cộng đúp (một lần theo sự kiện đồng bộ, một
   *   lần theo kết quả lượt chơi).
   *
   * ⚠️ PHẢI NẰM TRONG `useEffect`, KHÔNG ĐƯỢC NẰM TRONG THÂN RENDER.
   *   Ghi vào store (một `setState` của store khác) ngay trong thân render là lỗi React — nó
   *   có thể làm component render lại vô hạn, và React có thể VỨT BỎ kết quả của một lượt
   *   render bị gián đoạn, để lại store đã bị ghi mà UI không bao giờ hiện.
   *
   * ⚠️ `submittedFor` là REF chứ không phải state, và khoá theo `exercise.id`:
   *   Trong `StrictMode` (dự án CÓ bật), React chạy hiệu ứng HAI LẦN. Một cờ dạng state sẽ
   *   chưa kịp đổi giữa hai lần chạy đó (cả hai đọc cùng một closure) ⇒ xếp hai lượt chơi.
   *   Ref đổi giá trị NGAY trong lần chạy đầu nên chặn được. Cùng cách đã dùng ở
   *   `FlashcardPage` cho `completeLesson`.
   */
  const submittedFor = useRef<string | null>(null);
  /** Thời điểm ván bắt đầu — để tính `durationSeconds` (chỉ dùng cho thống kê). */
  const startedAt = useRef<number>(Date.now());
  const finished = engine.result !== null;

  useEffect(() => {
    if (!finished || !exercise || !progressReady || !childId) return;
    if (submittedFor.current === exercise.id) return;

    submittedFor.current = exercise.id;

    // Xếp vào hàng đợi TRƯỚC (hàng đợi tự lưu xuống máy), rồi mới thử gửi. Bé chơi lúc mất
    // mạng, hoặc bố mẹ đóng app ngay sau đó, vẫn không mất thành tích — xem `GameResultService`.
    const item = gameResultQueue.enqueue({
      childId,
      exerciseId: exercise.id,
      lessonId: exercise.lessonId,
      gameType: exercise.gameType,
      totalRounds,
      durationSeconds: (Date.now() - startedAt.current) / 1000,
      answers: engine.state.answers,
    });

    /**
     * ⭐ GHI NHỚ `clientEventId` CỦA LƯỢT NÀY (T055).
     *
     *   Lần gửi có thể tới server NGAY (bé đang có mạng) hoặc MUỘN HƠN nhiều (mạng trở lại, hàng
     *   đợi gửi bù). Ở cả hai trường hợp, khi phần thưởng về, `rewardStore` lưu nó dưới đúng khoá
     *   này. Màn kết quả nhờ vậy tìm được phần thưởng của CHÍNH NÓ — kể cả khi bé đã chơi thêm
     *   mấy ván nữa trong lúc chờ.
     */
    setSubmittedEventId(item.submission.clientEventId);

    void gameResultQueue.flush();
  }, [finished, exercise, progressReady, childId, totalRounds, engine.state.answers]);

  const playAgain = useCallback(() => {
    // Cho phép ghi lại ở lượt sau — nếu không, lượt thứ hai sẽ không ghi gì.
    submittedFor.current = null;
    startedAt.current = Date.now();
    // Quên phần thưởng của lượt CŨ: giữ lại thì ván mới sẽ hiện khối thưởng của ván trước
    // trong tích tắc đầu, trước khi server kịp trả lời cho ván này.
    setSubmittedEventId(null);
    // Và quên luôn "đã xem màn lên cấp": lượt sau có thể lên cấp tiếp (bình thường khi bé chơi
    // liên tục). Giữ cờ cũ thì màn ăn mừng của cấp MỚI sẽ không bao giờ hiện.
    setLevelUpDismissed(false);
    engine.restart();
  }, [engine]);

  // --- Các trạng thái không chơi được -------------------------------------
  const exitTo = lesson ? themePath(lesson.themeId) : '/';

  const backLink = (
    <Link
      to={exitTo}
      className="flex min-h-touch-lg w-full items-center justify-center rounded-kid border-2 border-brand bg-surface px-6 text-kid-md font-bold text-brand"
    >
      {t('flashcard.backToTheme')}
    </Link>
  );

  if (!lesson || !exercise) {
    return (
      <EmptyState
        icon="🎮"
        title={t('game.notFoundTitle')}
        description={t('game.notFoundHint')}
        action={backLink}
      />
    );
  }

  // Chủ đề bị khoá giữa phiên, hoặc URL được gõ tay vào chủ đề chưa mở.
  const access = byThemeId.get(lesson.themeId);
  if (isHydrated && (!access || !access.enterable)) {
    return (
      <EmptyState icon="🔒" title={t('map.locked')} description={t('map.notFoundHint')} action={backLink} />
    );
  }

  /**
   * ⚠️ Game cần micro (`say_it`) không chạy được trên Safari/iOS.
   *   `useExercisesForLesson` đã lọc nó khỏi danh sách, nên bé không bao giờ bấm vào được —
   *   nhưng URL thì gõ được. Nói thật lý do, đừng nói "không tìm thấy".
   */
  if (!isExercisePlayable(exercise, runtime)) {
    return (
      <EmptyState
        icon="🎤"
        title={t('game.unsupportedTitle')}
        description={t('game.unsupportedHint')}
        action={backLink}
      />
    );
  }

  const GameComponent = GAME_COMPONENTS[exercise.gameType];
  if (!GameComponent) {
    return (
      <EmptyState
        icon="🚧"
        title={t('game.soonTitle')}
        description={t('theme.gamesSoon')}
        action={backLink}
      />
    );
  }

  if (words.length === 0 || totalRounds <= 0) {
    return (
      <EmptyState icon="📖" title={t('game.noWords')} description={t('game.notFoundHint')} action={backLink} />
    );
  }

  /**
   * ⚠️ CHẶN KHI TIẾN ĐỘ CHƯA NẠP XONG — cùng lý do như `FlashcardPage`:
   *   `progressStore.record()` từ chối ghi khi chưa `hydrated`. Nếu màn hình vẫn chạy, bé chơi
   *   xong cả ván mà không có gì được ghi lại — im lặng hoàn toàn.
   */
  if (!progressReady) {
    return <EmptyState icon="🐵" title={t('app.loading')} description={lesson.name_vi} />;
  }

  // --- Kết quả ------------------------------------------------------------
  //
  // Việc ghi tiến độ đã được xử lý trong `useEffect` ở trên — xem ghi chú ở đó về lý do
  // không được gọi hàm ghi của store trong thân render.
  if (engine.result) {
    return (
      <>
        {/*
          ⭐ MÀN LÊN CẤP NẰM TRÊN MÀN KẾT QUẢ (T056), không thay thế nó.

          Thứ tự này là chủ ý: bé vừa chơi xong, điều đầu tiên bé cần là ăn mừng cột mốc dài
          hơi (lên cấp), RỒI mới xem lại chi tiết lượt chơi. Đảo lại — hiện kết quả trước, bắt
          bé bấm "Chơi lại" mới thấy màn lên cấp — thì lời chúc mừng đến sau khi bé đã rời khỏi
          khoảnh khắc đó.

          `LevelUpOverlay` là hộp thoại Radix có bẫy tiêu điểm, nên khi nó mở, hai nút của màn
          kết quả bên dưới tạm thời không bấm được — đúng như mong muốn. Bé bấm "Chạm để tiếp
          tục" thì màn kết quả hiện ra nguyên vẹn.
        */}
        <LevelUpOverlay
          // `null` khi lượt này không lên cấp, HOẶC khi bé đã xem màn ăn mừng rồi.
          levelUp={levelUpDismissed ? null : (serverAward?.levelUp ?? null)}
          onClose={() => setLevelUpDismissed(true)}
        />

        <ResultOverlay
          result={engine.result}
          lessonName={lesson.name_vi}
          previousBestScore={previousBestScore}
          previousBestStars={previousBestStars}
          // `null` khi lượt chơi chưa tới được server (đang mất mạng, hoặc đang trong hàng đợi).
          // Overlay hiểu đó là "chưa biết" và KHÔNG hiện khối thưởng — xem ghi chú ở đó.
          serverAward={serverAward}
          onPlayAgain={playAgain}
          exitTo={exitTo}
        />
      </>
    );
  }

  // --- Chơi ---------------------------------------------------------------
  return (
    <GameShell
      gameType={exercise.gameType}
      lessonName={lesson.name_vi}
      exitTo={exitTo}
      state={engine.state}
      roundNumber={engine.roundNumber}
    >
      <GameComponent exercise={exercise} words={words} engine={engine} />
    </GameShell>
  );
}
