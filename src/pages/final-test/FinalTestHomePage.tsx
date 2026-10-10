/**
 * RubyLingo — `FinalTestHomePage`: KHU VỰC THI (`/final-test`).
 *
 * ⭐ NHIỆM VỤ: nói cho bé biết mình đang ở đâu và chọn MỘT phần để làm. Bé 7+ KHÔNG nên ngồi
 *   liền ~45 phút, nên ba phần (Nghe / Đọc–Viết / Nói) là ba phiên riêng, mỗi phiên có điểm dừng
 *   tự nhiên. Trang này là "cửa vào" của cả ba.
 *
 * ⚠️⚠️ CỔNG DO SERVER QUYẾT (`gate.kind`). Trang này KHÔNG tự tính lại điều kiện — chỉ dịch
 *   trạng thái server trả về thành chữ cho bé:
 *     · `locked`  — hiện RÕ còn thiếu gì.
 *     · `ready` / `done` — hiện ba phần.
 *     · chưa đọc được (đang tải / MẠNG LỖI) — "Đang kiểm tra...", TUYỆT ĐỐI không nói còn thiếu.
 *
 * ⚠️ GÕ THẲNG URL KHI CHƯA ĐỦ ĐIỀU KIỆN CŨNG PHẢI BỊ CHẶN Ở ĐÂY — không tin rằng bé chỉ tới được
 *    từ bản đồ (cùng lối tự-kiểm-quyền như `ThemePage`). Server còn chặn lần nữa khi nộp; đây chỉ
 *    là rào UX.
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { FinalTestSectionStatus } from '@shared/types/final-test.js';

import { EmptyState } from '../../components/common/EmptyState.js';
import { BigButton } from '../../components/common/BigButton.js';
import { finalTestRequirementText } from '../../components/final-test/gate.js';
import { ShieldRow } from '../../components/final-test/ShieldRow.js';
import { sectionTitleKey } from '../../components/final-test/praise.js';
import { useFinalTestGate } from '../../hooks/useFinalTest.js';
import { cn } from '../../lib/cn.js';
import { finalTestCertificatePath, finalTestSectionPath } from '../../lib/paths.js';
import { useActiveChild } from '../../store/sessionStore.js';

export function FinalTestHomePage() {
  const { t } = useTranslation();
  const child = useActiveChild();
  const { state, isLoading, isError, refetch } = useFinalTestGate();

  if (!child) return null;

  if (isLoading) {
    return <EmptyState icon="🎓" title={t('app.loading')} />;
  }

  if (isError && state === null) {
    // ⚠️ KHÔNG lộ lỗi kỹ thuật, KHÔNG nói "còn thiếu". Mất mạng không phải là chưa học hết.
    return (
      <EmptyState
        icon="🎓"
        title={t('finalTest.loadErrorTitle')}
        description={t('finalTest.loadErrorHint')}
        action={<BigButton onClick={refetch}>{t('app.retry')}</BigButton>}
      />
    );
  }

  if (state === null) return null;

  const { gate, sections } = state;

  // --- Chưa đồng bộ xong (trạng thái trung tính) -------------------------
  if (gate.kind === 'pending') {
    return (
      <EmptyState
        icon="🎓"
        title={t('finalTest.checking')}
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

  // --- Chưa đủ điều kiện ------------------------------------------------
  if (!gate.enterable) {
    return (
      <EmptyState
        icon="🔒"
        title={t('finalTest.lockedTitle')}
        description={finalTestRequirementText(gate, t)}
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

  const allCompleted = sections.length > 0 && sections.every((section) => section.completed);
  const totalShields = sections.reduce((sum, section) => sum + (section.bestShields ?? 0), 0);

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/"
        className="inline-flex w-fit min-h-[48px] items-center gap-2 rounded-kid border-2 border-line bg-surface px-4 text-kid-xs font-bold text-ink-soft"
      >
        <span aria-hidden="true">←</span>
        {t('map.title')}
      </Link>

      <header className="rounded-card border-2 border-line bg-gradient-to-b from-brand-tint to-surface p-4 shadow-kid">
        <h1 className="text-kid-xl leading-tight text-ink">🎓 {t('finalTest.homeTitle')}</h1>
        <p className="mt-2 text-kid-sm text-ink-soft">{t('finalTest.intro')}</p>
        {allCompleted && (
          <p className="mt-2 text-kid-sm font-bold text-brand">
            {t('finalTest.certificateTotal', { count: totalShields })}
          </p>
        )}
      </header>

      <ul className="flex flex-col gap-3">
        {sections.map((section) => (
          <li key={section.section}>
            <SectionRow section={section} />
          </li>
        ))}
      </ul>

      {allCompleted && (
        <Link
          to={finalTestCertificatePath()}
          className="inline-flex min-h-touch-lg w-full items-center justify-center gap-3 rounded-kid border-2 border-success bg-success-soft px-6 text-kid-lg font-bold text-ink"
        >
          <span aria-hidden="true">🏅</span>
          {t('finalTest.seeCertificate')}
        </Link>
      )}

      {/* Ràng buộc pháp lý + trung thực với phụ huynh — hiện ở mọi màn của khu vực thi. */}
      <p className="rounded-card border-2 border-line bg-surface-raised px-4 py-3 text-kid-xs text-ink-soft">
        {t('finalTest.speakDisclaimer')}
      </p>
    </div>
  );
}

/** Một phần thi trên màn khu vực thi. */
function SectionRow({ section }: { section: FinalTestSectionStatus }) {
  const { t } = useTranslation();
  const title = t(sectionTitleKey(section.section));

  const answered = section.progress?.answered ?? 0;
  const inProgress = !section.completed && answered > 0 && answered < section.totalItems;

  const actionLabel = section.completed
    ? t('finalTest.redoSection')
    : inProgress
      ? t('finalTest.continueSection')
      : t('finalTest.startSection');

  return (
    <article className="flex flex-col gap-3 rounded-card border-2 border-line bg-surface p-4 shadow-kid">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-kid-md leading-tight text-ink">{title}</h2>
          <p className="mt-0.5 text-kid-xs text-ink-soft">
            {t('finalTest.itemCount', { count: section.totalItems })}
          </p>
        </div>

        {section.completed && section.bestShields !== null && (
          <div className="shrink-0 text-center">
            <ShieldRow
              shields={section.bestShields}
              label={t('finalTest.shieldsEarnedLabel', { section: title, count: section.bestShields })}
            />
          </div>
        )}
      </div>

      <Link
        to={finalTestSectionPath(section.section)}
        className={cn(
          'inline-flex min-h-touch items-center justify-center gap-3 rounded-kid border-2 px-6 text-kid-md font-bold',
          'transition duration-kid active:translate-y-[1px] active:shadow-none',
          section.completed
            ? 'border-success bg-success-soft text-ink'
            : 'border-brand bg-brand text-ink-inverse shadow-brand hoverable:brightness-110',
        )}
      >
        {actionLabel}
      </Link>
    </article>
  );
}
