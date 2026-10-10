/**
 * RubyLingo — `FinalTestCertificatePage`: "CHỨNG NHẬN" TRONG APP (`/final-test/certificate`).
 *
 * ⭐ NHIỆM VỤ: tổng kết ba phần thi — tổng khiên + huy chương tốt nghiệp + lời khen. Bé đã bỏ
 *   công làm hết ba phần, nên đây là KHOẢNH KHẮC ĂN MỪNG, không phải một bảng điểm.
 *
 * ⚠️⚠️ KHÔNG XUẤT PDF, KHÔNG DÙNG NHÃN HIỆU CAMBRIDGE.
 *   Đây là trang render TRONG APP. Xuất tệp tải về cần review bản quyền/nhãn hiệu riêng (Q7) —
 *   chưa được duyệt nên KHÔNG làm. Trang chỉ ghi "Bài thi cuối khoá RubyLingo — Starters".
 *
 * ⚠️ KHÔNG "ĐỖ/TRƯỢT". Tổng kết nói "Bé đã hoàn thành bài thi Starters!" bất kể khiên — đã bỏ
 *   công làm hết đã là một thành tựu (B5). Khiên lấy từ SERVER, không tự tính lại (B4).
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { BigButton } from '../../components/common/BigButton.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { ShieldRow } from '../../components/final-test/ShieldRow.js';
import { sectionTitleKey } from '../../components/final-test/praise.js';
import { useFinalTestGate } from '../../hooks/useFinalTest.js';
import { finalTestHomePath } from '../../lib/paths.js';
import { useActiveChild } from '../../store/sessionStore.js';

export function FinalTestCertificatePage() {
  const { t } = useTranslation();
  const child = useActiveChild();
  const { state, isLoading, isError, refetch } = useFinalTestGate();

  if (!child) return null;

  if (isLoading) {
    return <EmptyState icon="🏅" title={t('app.loading')} />;
  }

  if (isError && state === null) {
    return (
      <EmptyState
        icon="🏅"
        title={t('finalTest.loadErrorTitle')}
        description={t('finalTest.loadErrorHint')}
        action={<BigButton onClick={refetch}>{t('app.retry')}</BigButton>}
      />
    );
  }

  if (state === null) return null;

  const { sections } = state;
  const allCompleted = sections.length > 0 && sections.every((section) => section.completed);
  const totalShields = sections.reduce((sum, section) => sum + (section.bestShields ?? 0), 0);

  // --- Chưa xong cả ba phần: LỜI MỜI làm nốt, không phải lời chê ----------
  if (!allCompleted) {
    const remaining = sections.filter((section) => !section.completed);
    const names = remaining.map((section) => t(sectionTitleKey(section.section))).join(', ');
    return (
      <EmptyState
        icon="🏅"
        title={t('finalTest.certificateTitle')}
        description={t('finalTest.certificateIncomplete', { sections: names })}
        action={<BackHomeLink />}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <BackHomeLink />

      <section
        aria-labelledby="final-test-certificate-title"
        className="flex flex-col items-center gap-3 rounded-card border-2 border-brand bg-gradient-to-b from-brand-tint to-surface p-6 text-center shadow-kid"
      >
        <span
          role="img"
          aria-label={t('finalTest.certificateMedalLabel')}
          className="text-[72px] leading-none"
        >
          🏅
        </span>

        <h1 id="final-test-certificate-title" className="text-kid-xl leading-tight text-ink">
          {t('finalTest.certificateTitle')}
        </h1>

        <p className="text-kid-lg font-bold text-brand">{child.nickname}</p>
        <p className="text-kid-sm text-ink-soft">{t('finalTest.certificateIntro')}</p>

        <p className="text-kid-md font-bold text-ink">
          {t('finalTest.certificateTotal', { count: totalShields })}
        </p>
      </section>

      {/* Khiên TỪNG phần — lấy từ server, không tự tính lại. */}
      <ul className="flex flex-col gap-3">
        {sections.map((section) => {
          const title = t(sectionTitleKey(section.section));
          const shields = section.bestShields;
          return (
            <li
              key={section.section}
              className="flex items-center justify-between gap-3 rounded-card border-2 border-line bg-surface p-4"
            >
              <span className="text-kid-md font-bold text-ink">{title}</span>
              {shields !== null && (
                <ShieldRow
                  shields={shields}
                  label={t('finalTest.shieldsEarnedLabel', { section: title, count: shields })}
                />
              )}
            </li>
          );
        })}
      </ul>

      {/* Ràng buộc pháp lý — bắt buộc hiện. */}
      <p className="rounded-card border-2 border-line bg-surface-raised px-4 py-3 text-kid-xs text-ink-soft">
        {t('finalTest.speakDisclaimer')}
      </p>
    </div>
  );
}

function BackHomeLink() {
  const { t } = useTranslation();
  return (
    <Link
      to={finalTestHomePath()}
      className="inline-flex w-fit min-h-[48px] items-center gap-2 rounded-kid border-2 border-line bg-surface px-4 text-kid-xs font-bold text-ink-soft"
    >
      <span aria-hidden="true">←</span>
      {t('finalTest.backToHome')}
    </Link>
  );
}
