/**
 * RubyLingo — `FinalTestSectionPage`: CHƠI MỘT PHẦN bài thi (`/final-test/:section`).
 *
 * ⭐ NHIỆM VỤ: chạy lần lượt các câu của MỘT phần, lưu tiến độ sau MỖI câu, và khi hết phần thì
 *   nộp lên server để lấy khiên chính thức. Đây là tầng "điều phối": component câu (G5) chỉ báo
 *   lên `onAnswered`, còn chuyện chuyển câu / lưu tiến độ / nộp bài là ở đây.
 *
 * ⚠️⚠️ SERVER LÀ TRỌNG TÀI CUỐI. Client chỉ HIỆN kết quả server trả về (`result.shields`). Khi
 *   mạng lỗi lúc nộp, client được phép hiện một kết quả TẠM tính bằng ĐÚNG hàm dùng chung
 *   (`shieldsForSection` / `shieldsForSpeaking`) — nhưng KHÔNG gọi đó là kết quả chính thức, và
 *   giữ nguyên dữ liệu trong máy để gửi lại (cùng `clientEventId` ⇒ lũy đẳng).
 *
 * ⚠️ GÕ THẲNG URL khi cổng chưa mở vẫn bị chặn ở đây (khuôn tự-kiểm-quyền của `ThemePage`).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { finalTestSectionIdSchema } from '@shared/schemas/final-test.js';
import type { FinalTestItem, FinalTestPart, FinalTestSectionFile } from '@shared/schemas/final-test.js';
import type { FinalTestSectionId } from '@shared/schemas/final-test.js';
import type { FinalTestSectionStatus, FinalTestSubmitResult } from '@shared/types/final-test.js';
import { shieldsForSection, shieldsForSpeaking } from '@shared/final-test-scoring.js';

import { BigButton } from '../../components/common/BigButton.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { finalTestRequirementText } from '../../components/final-test/gate.js';
import { buildWordsByEn } from '../../components/final-test/optionWords.js';
import { ShieldRow } from '../../components/final-test/ShieldRow.js';
import { praiseKeyForShields, sectionTitleKey } from '../../components/final-test/praise.js';
import { getFinalTestComponent } from '../../components/final-test/registry.js';
import { finalTestApi } from '../../api/endpoints.js';
import { useFinalTestGate, useFinalTestSection } from '../../hooks/useFinalTest.js';
import { useLevel } from '../../hooks/useContent.js';
import { finalTestQueryKey } from '../../lib/queryKeys.js';
import { finalTestHomePath } from '../../lib/paths.js';
import { createClientEventId } from '../../services/ProgressService.js';
import {
  cancelFinalTestProgress,
  clearFinalTestDraft,
  loadFinalTestDraft,
  useFinalTestSessionStore,
} from '../../store/finalTestSession.js';
import type { FinalTestDraft, FinalTestDraftAnswer } from '../../store/finalTestSession.js';
import { useActiveChild } from '../../store/sessionStore.js';
import { useRewardStore } from '../../store/rewardStore.js';

/** Mọi item của một phần, theo ĐÚNG thứ tự part → item. */
function flattenItems(section: FinalTestSectionFile): FinalTestItem[] {
  return section.parts.flatMap((part: FinalTestPart) => part.items);
}

/**
 * Tiến độ ban đầu của phiên: ưu tiên bản TRONG MÁY (giàu thông tin — có cả `firstTry`), nếu trống
 * thì dựng lại từ tiến độ SERVER trả về (đổi máy làm tiếp). `value` khớp đáp án ⇒ coi như đúng
 * ngay lần đầu; không khớp ⇒ `false` (thận trọng, không bao giờ thổi phồng kết quả của bé).
 */
function computeSeed(
  childId: string,
  section: FinalTestSectionId,
  status: FinalTestSectionStatus | undefined,
  items: readonly FinalTestItem[],
): FinalTestDraft {
  const local = loadFinalTestDraft(childId, section);
  if (local.answers.length > 0) return local;

  const serverAnswers = status?.progress?.answers ?? [];
  if (serverAnswers.length === 0) return { answers: [], clientEventId: null };

  const answerById = new Map(items.map((item) => [item.id, item]));
  const answers: FinalTestDraftAnswer[] = [];
  for (const entry of serverAnswers) {
    const item = answerById.get(entry.itemId);
    if (!item) continue;
    const expected = 'answer' in item ? item.answer : undefined;
    const firstTry =
      expected === undefined
        ? true // phần Nói không có đáp án — "đã làm" là đủ.
        : entry.value.trim().toLowerCase() === expected.trim().toLowerCase();
    answers.push({ itemId: entry.itemId, value: entry.value, firstTry, wrongAttempts: 0 });
  }
  return { answers, clientEventId: null };
}

export function FinalTestSectionPage() {
  const { section } = useParams<{ section: string }>();
  const parsed = finalTestSectionIdSchema.safeParse(section);
  const sectionId: FinalTestSectionId | null = parsed.success ? parsed.data : null;

  const { t } = useTranslation();
  const child = useActiveChild();
  const gate = useFinalTestGate();
  const content = useFinalTestSection(sectionId);

  if (!child) return null;

  if (sectionId === null) {
    return (
      <EmptyState
        icon="🧭"
        title={t('finalTest.notFoundTitle')}
        description={t('finalTest.notFoundHint')}
        action={<BackHomeLink />}
      />
    );
  }

  if (gate.isLoading) {
    return <EmptyState icon="🎓" title={t('app.loading')} />;
  }

  if (gate.isError && gate.state === null) {
    return (
      <EmptyState
        icon="🎓"
        title={t('finalTest.loadErrorTitle')}
        description={t('finalTest.loadErrorHint')}
        action={<BigButton onClick={gate.refetch}>{t('app.retry')}</BigButton>}
      />
    );
  }

  if (gate.state !== null && !gate.state.gate.enterable) {
    return (
      <EmptyState
        icon="🔒"
        title={t('finalTest.lockedTitle')}
        description={finalTestRequirementText(gate.state.gate, t)}
        action={<BackHomeLink />}
      />
    );
  }

  if (!content) {
    return (
      <EmptyState
        icon="🧭"
        title={t('finalTest.notFoundTitle')}
        description={t('finalTest.notFoundHint')}
        action={<BackHomeLink />}
      />
    );
  }

  const status = gate.state?.sections.find((entry) => entry.section === sectionId);
  return <SectionRunner section={content} status={status} />;
}

function BackHomeLink() {
  const { t } = useTranslation();
  return (
    <Link
      to={finalTestHomePath()}
      className="flex min-h-touch-lg w-full items-center justify-center rounded-kid border-2 border-brand bg-surface px-6 text-kid-md font-bold text-brand"
    >
      {t('finalTest.backToHome')}
    </Link>
  );
}

/** Điều phối một phiên làm bài: câu nào, lưu gì, nộp khi nào. */
function SectionRunner({
  section,
  status,
}: {
  section: FinalTestSectionFile;
  status: FinalTestSectionStatus | undefined;
}) {
  const { t } = useTranslation();
  const child = useActiveChild();
  const childId = child?.id ?? '';
  const level = useLevel();
  const queryClient = useQueryClient();

  const items = useMemo(() => flattenItems(section), [section]);

  // Bảng tra `en` → `Word` để các LỰA CHỌN dạng tranh (`choose_picture`) vẽ được HÌNH của chính
  // từ đó — lựa chọn trong đề chỉ là CHUỖI tiếng Anh, không phải `wordId` (xem `optionWords.ts`).
  const wordsByEn = useMemo(() => buildWordsByEn(level), [level]);

  const start = useFinalTestSessionStore((s) => s.start);
  const record = useFinalTestSessionStore((s) => s.record);
  const answers = useFinalTestSessionStore((s) => s.answers);

  // Tiến độ ban đầu tính MỘT lần (useState initial): không tính lại khi gate refetch.
  const [seed] = useState<FinalTestDraft>(() => computeSeed(childId, section.section, status, items));

  useEffect(() => {
    start(childId, section.section, seed);
  }, [childId, section.section, seed, start]);

  const [result, setResult] = useState<FinalTestSubmitResult | null>(null);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'error'>('idle');
  const sendingRef = useRef(false);

  const answeredIds = useMemo(() => new Set(answers.map((answer) => answer.itemId)), [answers]);
  const currentItem = items.find((item) => !answeredIds.has(item.id)) ?? null;
  const total = items.length;
  const allAnswered = total > 0 && answers.length >= total;

  const doSubmit = useMemo(
    () => async (): Promise<void> => {
      if (sendingRef.current) return;
      sendingRef.current = true;
      setPhase('sending');
      try {
        const state = useFinalTestSessionStore.getState();
        const byId = new Map(state.answers.map((answer) => [answer.itemId, answer]));
        const payload = items.map((item) => {
          const answer = byId.get(item.id);
          return {
            itemId: item.id,
            firstTry: answer?.firstTry ?? false,
            wrongAttempts: answer?.wrongAttempts ?? 0,
          };
        });

        const response = await finalTestApi.submit(childId, section.section, {
          // Giữ nguyên mã giữa các lần gửi lại — lần gửi sau LŨY ĐẲNG (xem `finalTestSession`).
          clientEventId: state.clientEventId ?? createClientEventId(),
          occurredAt: new Date().toISOString(),
          answers: payload,
        });

        clearFinalTestDraft(childId, section.section);
        cancelFinalTestProgress();
        setResult(response);
        setPhase('idle');

        // Khiên cao nhất vừa đổi ⇒ đọc lại trạng thái khu vực thi. Hoàn thành cả bài ⇒ nạp lại ví
        // (dùng `reload`, không phải `load`: `load` bỏ qua khi đã có dữ liệu — xem `rewardStore`).
        void queryClient.invalidateQueries({ queryKey: finalTestQueryKey(childId) });
        if (response.firstCompletion) useRewardStore.getState().reload(childId);
      } catch {
        // ⚠️ KHÔNG lộ lỗi kỹ thuật. Giữ kết quả tạm trong máy, cho bé thử lại.
        setPhase('error');
      } finally {
        sendingRef.current = false;
      }
    },
    [childId, items, queryClient, section.section],
  );

  /**
   * Tự nộp khi đã trả lời đủ câu. Chạy cả khi VÀO LẠI một phiên đã làm hết mà chưa gửi được
   * (tiến độ nằm trong máy) — dùng lại `clientEventId` cũ nên không ghi trùng.
   *
   * ⚠️ CỐ Ý KHÔNG phụ thuộc `phase`: nộp hỏng thì để bé bấm "Thử lại", KHÔNG tự nộp lại vòng lặp
   *    (tự nộp lại sẽ nuốt luôn màn "chưa gửi được" và có thể ghi thêm một lần thi).
   */
  useEffect(() => {
    if (result !== null) return;
    if (!allAnswered) return;
    void doSubmit();
  }, [allAnswered, result, doSubmit]);

  const handleAnswered = (itemId: string, firstTry: boolean, wrongAttempts: number): void => {
    const item = items.find((entry) => entry.id === itemId);
    const value = firstTry && item !== undefined && 'answer' in item ? item.answer : '';
    record({ itemId, value, firstTry, wrongAttempts });
  };

  // --- Màn kết quả -------------------------------------------------------
  if (result !== null) {
    return <ResultScreen section={section} result={result} />;
  }

  if (phase === 'error') {
    const provisional = provisionalShields(section, items, answers);
    return (
      <ResultScreen section={section} result={null} provisionalShields={provisional} onRetry={doSubmit} />
    );
  }

  if (currentItem === null) {
    // Đã trả lời đủ ⇒ đang trên đường nộp. Tránh nháy màn trắng.
    return <EmptyState icon="📮" title={t('finalTest.sending')} />;
  }

  const item = currentItem;
  const ItemComponent = getFinalTestComponent(item.interaction);
  const word = 'wordId' in item && item.wordId ? (level.wordById.get(item.wordId) ?? null) : null;
  const position = answers.length + 1;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={finalTestHomePath()}
          className="inline-flex w-fit min-h-[48px] items-center gap-2 rounded-kid border-2 border-line bg-surface px-4 text-kid-xs font-bold text-ink-soft"
        >
          <span aria-hidden="true">←</span>
          {t('finalTest.backToHome')}
        </Link>
        <span
          role="status"
          aria-live="polite"
          className="rounded-pill border-2 border-line bg-surface-raised px-3 py-1 text-kid-xs font-bold tabular-nums text-ink-soft"
        >
          {t('finalTest.itemProgress', { current: position, total })}
        </span>
      </div>

      <h1 className="text-kid-lg leading-tight text-ink">
        {t(sectionTitleKey(section.section))}
      </h1>

      {seed.answers.length > 0 && position === seed.answers.length + 1 && (
        <p className="text-kid-sm text-ink-soft">{t('finalTest.resumeNote')}</p>
      )}

      {section.autoScored === false && (
        <p className="rounded-kid border-2 border-line bg-surface-raised px-4 py-3 text-kid-xs text-ink-soft">
          {t('finalTest.speakingIntro')}
        </p>
      )}

      <ItemComponent
        key={item.id}
        item={item}
        word={word}
        wordsByEn={wordsByEn}
        onAnswered={(answered) =>
          handleAnswered(answered.itemId, answered.firstTry, answered.wrongAttempts)
        }
      />
    </div>
  );
}

/**
 * Khiên TẠM tính bằng ĐÚNG hàm dùng chung, chỉ dùng khi mạng lỗi lúc nộp (không có phản hồi
 * server). KHÔNG phải kết quả chính thức — màn hình nói rõ đang chờ gửi.
 */
function provisionalShields(
  section: FinalTestSectionFile,
  items: readonly FinalTestItem[],
  answers: readonly FinalTestDraftAnswer[],
): number | null {
  const total = items.length;
  if (total <= 0 || answers.length < total) return null;
  if (section.autoScored) {
    const correct = answers.filter((answer) => answer.firstTry).length;
    return shieldsForSection(correct, total);
  }
  // Phần Nói: đủ câu ⇒ 5 khiên theo độ tham gia (không chấm đúng/sai).
  return shieldsForSpeaking(answers.length, total) ?? null;
}

/** Màn kết thúc một phần — dùng chung cho cả khi đã có kết quả server lẫn khi còn chờ gửi. */
function ResultScreen({
  section,
  result,
  provisionalShields: provisional,
  onRetry,
}: {
  section: FinalTestSectionFile;
  result: FinalTestSubmitResult | null;
  provisionalShields?: number | null;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const title = t(sectionTitleKey(section.section));
  const shields = result?.shields ?? provisional ?? null;
  const pending = result === null;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col items-center gap-2 rounded-card border-2 border-line bg-gradient-to-b from-brand-tint to-surface p-5 text-center shadow-kid">
        <span aria-hidden="true" className="text-[48px] leading-none">
          🎉
        </span>
        <h1 className="text-kid-lg leading-tight text-ink">{t('finalTest.sectionDoneTitle')}</h1>
        <p className="text-kid-sm text-ink-soft">{title}</p>

        {shields !== null && (
          <ShieldRow
            shields={shields}
            label={t('finalTest.shieldsEarnedLabel', { section: title, count: shields })}
          />
        )}

        {shields !== null && (
          <p className="text-kid-md font-bold text-brand">{t(praiseKeyForShields(shields))}</p>
        )}

        {result?.isNewRecord === true && (
          <p className="text-kid-sm font-bold text-star-ink">{t('game.newRecord')}</p>
        )}

        {result?.firstCompletion === true && (
          <p className="text-kid-sm font-bold text-success">{t('finalTest.certificateIntro')}</p>
        )}
      </header>

      {pending && (
        <p className="rounded-card border-2 border-dashed border-warn bg-warn-soft px-4 py-3 text-kid-sm text-warn-ink">
          {t('finalTest.sendFailed')}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {pending && onRetry !== undefined && (
          <BigButton size="lg" onClick={onRetry}>
            {t('finalTest.sendRetry')}
          </BigButton>
        )}

        {/* Ràng buộc pháp lý — hiện ở mọi màn kết quả của khu vực thi. */}
        <p className="rounded-card border-2 border-line bg-surface-raised px-4 py-3 text-kid-xs text-ink-soft">
          {t('finalTest.speakDisclaimer')}
        </p>

        <Link
          to={finalTestHomePath()}
          className="inline-flex min-h-touch-lg w-full items-center justify-center gap-3 rounded-kid border-2 border-brand bg-brand px-6 text-kid-lg font-bold text-ink-inverse"
        >
          {t('finalTest.backToHome')}
        </Link>
      </div>
    </div>
  );
}
