/**
 * RubyLingo — `FlashcardPage`: học thẻ từ vựng của một bài (đường dẫn `/lesson/:id/flashcards`).
 *
 * ⭐ ĐÂY LÀ HOẠT ĐỘNG HỌC CHÍNH CỦA GIAI ĐOẠN NÀY.
 *   Các game (Nhóm 5) mới là phần chơi; nhưng thẻ từ mới là chỗ bé GẶP từ mới lần đầu, nghe
 *   đúng phát âm, và hiểu nghĩa. Nó cũng là hoạt động duy nhất chạy được ở CẢ 11 chủ đề, vì 10
 *   chủ đề kia chưa có bài tập game nào.
 *
 * ⭐ THẺ HIỆN CẢ TIẾNG ANH LẪN TIẾNG VIỆT CÙNG LÚC — KHÔNG LẬT MẶT.
 *   Bản thiết kế ban đầu ghi "lật thẻ" (mặt trước tiếng Anh, mặt sau nghĩa). Đổi thành hiện cả
 *   hai vì ba lý do cụ thể, không phải vì cho nhanh:
 *
 *     1. **Không lồng được nút.** Thẻ vừa phải bấm-để-nghe, vừa phải vuốt-để-đổi-thẻ. Một nút
 *        lật nằm BÊN TRONG vùng vuốt sẽ bị `setPointerCapture` của vùng vuốt nuốt mất cú `click`
 *        trên thiết bị cảm ứng (sự kiện chuột đi theo sự kiện con trỏ). Tách nút ra ngoài thẻ
 *        thì mất chính cái hay của lật thẻ.
 *     2. **`<button>` lồng trong `<button>` là HTML không hợp lệ** và làm trình đọc màn hình đọc
 *        hai lần. Không có cách nào vừa lật vừa có nút loa riêng trên cùng một tấm thẻ.
 *     3. **Với bé 7 tuổi đang học từ MỚI, giấu nghĩa không giúp gì.** Lật thẻ là để KIỂM TRA
 *        trí nhớ — việc đó thuộc về các game (Nhóm 5), nơi có chấm điểm và có phần thưởng. Còn
 *        thẻ từ là chỗ để HỌC: bé cần thấy nghĩa ngay.
 *
 * ⭐ ÂM THANH CHỈ ĐỌC TIẾNG ANH — ràng buộc cứng, xem đầu `SpeechService.ts`.
 *   Nghĩa tiếng Việt hiện trên màn hình nhưng KHÔNG bao giờ được đọc lên. `speak()` tự chặn
 *   (và `warnIfNotEnglish` báo ra console) nếu ai đó lỡ truyền tiếng Việt vào.
 *
 * ⚠️ KHÔNG TỰ PHÁT ÂM KHI VÀO MÀN HÌNH (bẫy 4 ở `SpeechService.ts`).
 *   iOS/Safari chỉ cho phát âm sau một thao tác thật của người dùng; tự đọc lúc tải trang sẽ bị
 *   chặn và **im lặng vĩnh viễn** cho tới khi tải lại. Mọi lời gọi `speak()` ở đây đều xuất phát
 *   từ cú chạm của bé.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { StarBurst } from '../components/effects/StarBurst.js';
import { BigButton } from '../components/common/BigButton.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { ProgressDots } from '../components/common/ProgressDots.js';
import { WordIcon } from '../components/common/WordIcon.js';
import { useLesson, useWordsForLesson } from '../hooks/useContent.js';
import { useLearnedWordIds, useLessonCompleted, useProgress } from '../hooks/useProgress.js';
import { usePointer } from '../hooks/usePointer.js';
import { useSfx } from '../hooks/useSfx.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { cn } from '../lib/cn.js';

/** Số px ngang tối thiểu để một lần vuốt được tính là "đổi thẻ". */
const SWIPE_MIN_PX = 60;

export function FlashcardPage() {
  const { lessonId = '' } = useParams<{ lessonId: string }>();
  const { t } = useTranslation();

  const lesson = useLesson(lessonId);
  const words = useWordsForLesson(lessonId);
  const learned = useLearnedWordIds();
  const lessonCompleted = useLessonCompleted(lessonId);
  const { markWordLearned, completeLesson, isHydrated } = useProgress();
  const { speak } = useSpeech({ stopOnUnmount: true });
  const { play } = useSfx();

  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  const word = words[index];
  const isLast = index >= words.length - 1;
  const isFirst = index === 0;

  // --- Ghi nhận "bé đã gặp từ này" ----------------------------------------
  //
  // ⭐ Đánh dấu `learned` khi thẻ được MỞ RA, không phải khi bé bấm loa: bé có thể đọc chữ mà
  //   không cần nghe (lớn tiếng đọc theo), và "đã gặp từ này" là đúng nghĩa của cờ `learned`
  //   (xem `WordProgress.learned` trong `shared/types/progress.ts`).
  //
  // ⚠️ Kiểm tra "đã học chưa" TRƯỚC khi ghi: bé vuốt qua rồi vuốt lại sẽ đi qua cùng một thẻ
  //   nhiều lần, và mỗi lần ghi là một sự kiện nữa phải gửi lên server. `learned` cập nhật ngay
  //   sau lần ghi đầu (store ghi đồng bộ), nên lần thứ hai trở đi không tạo sự kiện nào.
  useEffect(() => {
    if (!isHydrated || !word) return;
    if (learned.has(word.id)) return;
    markWordLearned(word.id);
  }, [isHydrated, word, learned, markWordLearned]);

  /**
   * ⭐ HỌC HẾT SỐ TỪ CỦA BÀI ⇒ BÀI ĐÃ XONG. KHÔNG BẮT BÉ BẤM THÊM MỘT NÚT.
   *
   * ⚠️ VÌ SAO CẦN ĐIỀU NÀY, KHÔNG CHỈ DỰA VÀO NÚT "🎉 Xong rồi!":
   *   `LessonProgress.completed` là nguồn chân lý duy nhất cho "bài đã xong" — nó quyết định
   *   dấu ✓ trên màn chủ đề, số "1/3 bài" trên thẻ chủ đề, và các điều kiện mở khoá chủ đề sau.
   *   Nếu chỉ nút cuối mới ghi nhận, một bé vuốt hết 7 thẻ rồi đóng app (rất hay xảy ra — bé
   *   7 tuổi, và bố mẹ gọi đi ăn cơm) sẽ mãi ở trạng thái "đã học 7/7 từ" nhưng bài KHÔNG xong.
   *   Trước đây hai màn hình còn nói ngược nhau: màn chủ đề ghi "✓ Bé đã học xong bài này!"
   *   (vì nó tự định nghĩa "xong" bằng số từ đã học) trong khi bản đồ ghi "0/3 bài".
   *
   *   Nay cả hai màn hình cùng đọc `completed`, và cờ đó được ghi ngay khi bé học hết từ.
   *   Nút "🎉 Xong rồi!" vẫn còn, nhưng nó chỉ còn là ăn mừng + màn hình chúc mừng.
   *
   * ⚠️ CHỐNG GHI LẶP — `completeLesson()` KHÔNG idempotent (mỗi lần gọi là một sự kiện nữa
   *   phải gửi lên server). Cần chốt chặn thật, không chỉ dựa vào cờ `lessonCompleted`:
   *   trong `StrictMode`, React chạy hiệu ứng HAI LẦN, và cả hai lần đều đọc `lessonCompleted`
   *   từ cùng một closure (vẫn là `false`) — cờ đó chưa kịp đổi. Ref theo `lessonId` mới chặn
   *   được, vì nó đổi giá trị NGAY trong lần gọi đầu.
   */
  const completionRequestedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isHydrated || words.length === 0 || lessonCompleted) return;
    if (!words.every((item) => learned.has(item.id))) return;
    if (completionRequestedFor.current === lessonId) return;

    completionRequestedFor.current = lessonId;
    completeLesson(lessonId);
  }, [isHydrated, words, learned, lessonCompleted, completeLesson, lessonId]);

  const goPrev = useCallback(() => {
    setIndex((current) => Math.max(0, current - 1));
    play('swipe');
  }, [play]);

  const finish = useCallback(() => {
    if (!isHydrated) return;
    play('levelUp');
    setFinished(true);
  }, [isHydrated, play]);

  const goNext = useCallback(() => {
    if (isLast) {
      finish();
      return;
    }
    setIndex((current) => current + 1);
    play('swipe');
  }, [isLast, finish, play]);

  const hearCurrent = useCallback(() => {
    if (!word) return;
    // Chỉ TIẾNG ANH. Không bao giờ truyền `word.vi` vào đây — xem ghi chú đầu file.
    void speak(word.en);
  }, [word, speak]);

  // --- Vuốt ngang để đổi thẻ ----------------------------------------------
  //
  // ⚠️ VÌ SAO KHÔNG DÙNG `onTap` ĐỂ ĐỔI THẺ, VÀ VÌ SAO `onDragEnd` MỚI ĐÚNG:
  //   `usePointer` chỉ phát `onTap` khi ngón tay KHÔNG vượt ngưỡng kéo, và phát `onDragEnd` khi
  //   có vượt. Hai callback loại trừ nhau, nên một cú chạm (để nghe) không bao giờ bị hiểu nhầm
  //   thành một lần vuốt (để đổi thẻ). Đây chính là lý do `dragThreshold` tồn tại.
  const startXRef = useRef<number | null>(null);
  const pointer = usePointer({
    dragThreshold: 14,
    disabled: finished,
    onDragStart: (point) => {
      startXRef.current = point.x;
    },
    onDragEnd: (point) => {
      const startX = startXRef.current;
      startXRef.current = null;
      if (startX === null) return;

      const deltaX = point.x - startX;
      if (Math.abs(deltaX) < SWIPE_MIN_PX) return;

      if (deltaX < 0) goNext();
      else if (!isFirst) goPrev();
    },
    onTap: () => {
      hearCurrent();
    },
  });

  // --- Trạng thái chưa sẵn sàng -------------------------------------------
  if (!lesson) {
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

  if (words.length === 0) {
    return (
      <EmptyState
        icon="📖"
        title={t('flashcard.noWords')}
        description={t('map.notFoundHint')}
        action={
          <Link
            to={`/theme/${encodeURIComponent(lesson.themeId)}`}
            className="flex min-h-touch-lg w-full items-center justify-center rounded-kid border-2 border-brand bg-surface px-6 text-kid-md font-bold text-brand"
          >
            {t('flashcard.backToTheme')}
          </Link>
        }
      />
    );
  }

  /**
   * ⚠️ CHẶN GHI KHI CHƯA NẠP XONG TIẾN ĐỘ.
   *   `progressStore.record()` từ chối ghi khi `hydrated === false` (xem ghi chú ở đó). Nếu màn
   *   hình này vẫn chạy, bé học hết bài mà không có gì được ghi — im lặng hoàn toàn. Chờ vài
   *   chục mili giây còn hơn để bé mất một bài học.
   */
  if (!isHydrated) {
    return <EmptyState icon="🐵" title={t('app.loading')} description={lesson.name_vi} />;
  }

  // Không thể xảy ra (`index` luôn nằm trong khoảng của `words`), nhưng TypeScript cần một nhánh
  // tường minh — và một `EmptyState` vẫn hơn một màn hình trắng nếu sau này có ai đó sửa `index`
  // sai. Đây là cùng một cách phòng thủ đã dùng ở `AppShell` cho trường hợp thiếu bé.
  if (!word) {
    return <EmptyState icon="📖" title={t('flashcard.noWords')} />;
  }

  // --- Màn hình chúc mừng khi học xong bài --------------------------------
  if (finished) {
    return (
      <div className="relative mx-auto flex max-w-[520px] flex-col items-center gap-4 rounded-kid border-4 border-star bg-surface p-6 text-center shadow-pop">
        <StarBurst burstKey="lesson-done" count={16} />

        <span aria-hidden="true" className="text-[88px] leading-none">
          🐰
        </span>

        <h1 className="text-kid-xl text-brand">{t('flashcard.doneTitle')}</h1>
        <p className="text-kid-sm text-ink-soft">{t('flashcard.doneHint')}</p>
        <p className="text-kid-md font-bold text-star-ink">{lesson.name_vi}</p>

        <div className="mt-2 flex w-full flex-col gap-3">
          <Link
            to={`/theme/${encodeURIComponent(lesson.themeId)}`}
            className={cn(
              'inline-flex min-h-touch-lg w-full items-center justify-center gap-3 rounded-kid',
              'border-2 border-brand bg-brand px-8 text-kid-lg font-bold text-ink-inverse',
              'shadow-kid transition-transform duration-kid active:translate-y-[2px] active:shadow-none',
              'select-none hoverable:brightness-105',
            )}
          >
            {t('flashcard.backToTheme')}
          </Link>
          <BigButton
            variant="secondary"
            onClick={() => {
              setIndex(0);
              setFinished(false);
            }}
          >
            {t('kid.playAgain')}
          </BigButton>
        </div>
      </div>
    );
  }

  // --- Thẻ từ vựng --------------------------------------------------------
  return (
    <div className="flex flex-col gap-4">
      {/*
        ⚠️ TIÊU ĐỀ NẰM RIÊNG MỘT DÒNG, KHÔNG ĐẶT CẠNH NÚT QUAY LẠI.
          Bản đầu để hai thứ trên cùng một hàng với `flex-1 truncate` cho tiêu đề. Trên khung
          360px, nút quay lại chiếm ~130px nên tiêu đề còn ~190px và bị CẮT CỤT: "Động vật hoang
          ..." — đúng cái tên bài học mà bé cần đọc để biết mình đang học gì. Cho tiêu đề cả dòng
          thì tên dài nhất ("Bò sát, côn trùng & từ chung") vẫn hiện đủ.
      */}
      <header className="flex flex-col gap-2">
        <Link
          to={`/theme/${encodeURIComponent(lesson.themeId)}`}
          className="inline-flex w-fit min-h-[48px] items-center gap-2 rounded-kid border-2 border-line bg-surface px-4 text-kid-xs font-bold text-ink-soft"
        >
          <span aria-hidden="true">←</span>
          {t('flashcard.backToTheme')}
        </Link>

        <h1 className="text-kid-lg leading-tight text-ink">{lesson.name_vi}</h1>
      </header>

      <ProgressDots
        value={index}
        total={words.length}
        label={t('flashcard.progressLabel', { current: index + 1, total: words.length })}
      />

      {/*
        ⭐ THẺ VỪA BẤM-ĐỂ-NGHE VỪA VUỐT-ĐỂ-ĐỔI, VÀ CHỈ CÓ MỘT PHẦN TỬ TƯƠNG TÁC.
          `role="button"` + `tabIndex={0}` để bàn phím dùng được; `onKeyDown` xử lý Enter/Space
          vì `usePointer` chỉ nghe sự kiện con trỏ. Không có `<button>` nào bên trong, nên không
          có chuyện `setPointerCapture` nuốt mất cú `click`.

        ⚠️ `touchAction: 'pan-y'` — BẮT BUỘC, không phải trang trí:
          Trình duyệt quyết định "cuộn trang hay gửi sự kiện cho web" NGAY khi ngón tay chạm
          xuống, TRƯỚC khi JavaScript chạy; gọi `preventDefault()` lúc đó là quá muộn. `pan-y`
          nói trước rằng: chiều dọc để trình duyệt cuộn, chiều ngang giao cho ta. Nhờ vậy bé vẫn
          cuộn được trang khi vuốt dọc trên thẻ — dùng `'none'` sẽ làm bé KẸT trên màn hình nhỏ.
      */}
      <div
        {...pointer.handlers}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          // `preventDefault` để phím Space không cuộn trang — hành vi mặc định của trình duyệt.
          event.preventDefault();
          hearCurrent();
        }}
        style={{ touchAction: 'pan-y' }}
        className={cn(
          'relative flex min-h-[300px] select-none flex-col items-center justify-center gap-3',
          'rounded-kid border-4 border-brand bg-surface p-6 text-center shadow-kid',
          // Vòng tiêu điểm rõ ràng cho người dùng bàn phím. Không có nó thì không biết mình
          // đang ở đâu khi Tab vào thẻ.
          'focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-brand-strong',
        )}
      >
        {/* Biểu tượng loa — TRANG TRÍ, không phải nút. Cả tấm thẻ mới là nút. */}
        <span
          aria-hidden="true"
          className="absolute right-4 top-4 rounded-pill bg-brand-soft px-3 py-1 text-[24px] leading-none"
        >
          🔊
        </span>

        <span aria-hidden="true" className="text-[80px] leading-none">
          <WordIcon wordId={word.id} fallback={word.icon} />
        </span>

        {/* Từ tiếng Anh — to nhất trên màn hình, đây là thứ bé cần nhớ. */}
        <p className="text-kid-3xl font-bold leading-tight text-ink">{word.en}</p>

        {word.phonetic && <p className="text-kid-sm text-ink-faint">{word.phonetic}</p>}

        <p className="text-kid-lg text-ink-soft">{word.vi}</p>
      </div>

      <p className="text-center text-kid-xs text-ink-faint">{t('flashcard.hint')}</p>

      <div className="flex gap-3">
        <BigButton variant="secondary" icon="←" disabled={isFirst} onClick={goPrev}>
          {t('flashcard.prev')}
        </BigButton>

        <BigButton
          variant={isLast ? 'success' : 'primary'}
          icon={isLast ? '🎉' : '→'}
          onClick={goNext}
        >
          {isLast ? t('flashcard.finish') : t('flashcard.next')}
        </BigButton>
      </div>
    </div>
  );
}
