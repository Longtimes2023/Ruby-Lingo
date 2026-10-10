/**
 * RubyLingo — `ParentReport`: BÁO CÁO TUẦN cho phụ huynh (T073), hiển thị như một VIEW trong `/parent`.
 *
 * ⭐ VÌ SAO LÀ VIEW, KHÔNG PHẢI ROUTE RIÊNG: xem `ParentGatePage.tsx` — một route mới nằm NGOÀI
 *   cổng PIN (vì mục đích của nó là khi chưa qua được cổng) và như vậy là một chỗ mới để quên bảo
 *   vệ. View thì nằm sau cổng về mặt CẤU TRÚC: cổng đóng thì không có cách nào chạm tới nó.
 *
 * ⭐ SERVER LÀ TRỌNG TÀI — CLIENT KHÔNG TỰ TÍNH GÌ:
 *   `summary_vi` và MỌI con số (từ đã học / đã nhớ / bài xong / sao) lấy NGUYÊN từ `ReportResponse`.
 *   Component này **không** cộng `dailyStats`, **không** đếm lại từ, **không** suy `wordsMastered`.
 *   Nếu client tự tính, màn hình sẽ có HAI con số khác nhau cho cùng một thứ ngay khi bé vừa học
 *   xong mà chưa đồng bộ — đúng lỗi im lặng mà dự án cấm.
 *   ⚠️ Hệ quả: `dailyStats` chỉ dùng để VẼ BIỂU ĐỒ, không dùng để kiểm chứng các con số tổng.
 *
 * ⚠️ TÔNG GIỌNG: người đọc là PHỤ HUYNH, nhưng luật ngôn ngữ vẫn áp cho MỌI chuỗi (kể cả
 *    `aria-label`) — không phán xét, không "kém/chưa đạt". Ở đây còn nặng hơn: câu chữ quyết định
 *    cách phụ huynh NHÌN CON. Tuần học ít ⇒ câu phải trung tính, hướng tới việc cùng con ôn.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { DailyStat, ReportResponse, WordAccuracyDto } from '@shared/types/api.js';

import { isApiClientError } from '../../api/client.js';
import { reportApi } from '../../api/endpoints.js';
import { BigButton } from '../../components/common/BigButton.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { ResponsiveGrid } from '../../components/common/ResponsiveGrid.js';
import { sectionTitleKey } from '../../components/final-test/praise.js';
import { formatDateVi } from '../../lib/time.js';

export interface ParentReportProps {
  /** Bé cần lập báo cáo (bé ĐANG chọn). */
  childId: string;
  /**
   * Gọi khi server nói CỔNG ĐÃ ĐÓNG (403 `PARENT_GATE_REQUIRED` / 401) — chủ trang phải quay về
   * màn nhập PIN. Đây KHÔNG phải lỗi kỹ thuật: cổng chỉ mở 10 phút rồi tự đóng.
   */
  onGateClosed: () => void;
}

/** Trạng thái tải báo cáo. `ready` mới có dữ liệu để vẽ. */
type LoadState = 'loading' | 'ready' | 'error';

/**
 * `YYYY-MM-DD` → `DD/MM` để hiển thị.
 *
 * ⚠️ CẮT CHUỖI, KHÔNG dùng `new Date(...)`: `new Date('2026-10-07')` được hiểu là NỬA ĐÊM UTC, nên
 *    ở múi giờ âm (Mỹ) nó lùi về ngày 06/10 — lịch tuần của gia đình sẽ lệch một ngày so với ngày
 *    server ghi. Cắt chuỗi thì không có múi giờ nào xen vào.
 */
function shortDate(isoDate: string): string {
  const [, month = '', day = ''] = isoDate.split('-');
  return `${day}/${month}`;
}

/** Khối thống kê một từ bé hay nhầm / đã nhớ chắc. */
function WordRow({ word }: { word: WordAccuracyDto }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-kid border-2 border-line bg-surface px-3 py-2">
      <span className="min-w-0">
        <span className="block text-kid-md font-bold text-ink">{word.en}</span>
        <span className="block text-kid-xs text-ink-soft">{word.vi}</span>
      </span>
      {/* Nhãn đọc: bé đúng bao nhiêu lần là thông tin phụ huynh cần, và emoji/số trần không đọc lên được. */}
      <span className="shrink-0 text-kid-sm font-bold tabular-nums text-ink-soft">
        {word.correctCount}
      </span>
    </li>
  );
}

export function ParentReport({ childId, onGateClosed }: ParentReportProps) {
  const { t } = useTranslation();

  const [report, setReport] = useState<ReportResponse | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  /** Bấm "Thử lại" ⇒ tăng số này để chạy lại hiệu ứng nạp. */
  const [attempt, setAttempt] = useState(0);

  /**
   * ⚠️ `onGateClosed` PHẢI ỔN ĐỊNH (chủ trang bọc `useCallback`) — nếu không, nó đổi mỗi lần render
   *    ⇒ hiệu ứng chạy lại ⇒ gọi mạng vô hạn.
   */
  const handleGateClosed = useCallback(() => {
    onGateClosed();
  }, [onGateClosed]);

  useEffect(() => {
    let alive = true;
    setState('loading');
    reportApi
      .get(childId)
      .then((data) => {
        if (alive) {
          setReport(data);
          setState('ready');
        }
      })
      .catch((err: unknown) => {
        if (!alive) return;
        // ⚠️ Cổng đã đóng (hết hạn 10 phút) ⇒ QUAY VỀ màn nhập PIN, không hiện như lỗi kỹ thuật.
        if (
          isApiClientError(err) &&
          (err.code === 'PARENT_GATE_REQUIRED' || err.code === 'UNAUTHENTICATED')
        ) {
          handleGateClosed();
          return;
        }
        setState('error');
      });
    return () => {
      alive = false;
    };
  }, [childId, attempt, handleGateClosed]);

  if (state === 'loading') {
    return <EmptyState icon="📊" title={t('app.loading')} />;
  }

  if (state === 'error' || report === null) {
    // ⚠️ KHÔNG lộ `error` kỹ thuật. Phụ huynh không làm gì sai; chỉ cần một lời thật + thử lại.
    return (
      <EmptyState
        icon="📊"
        title={t('parent.reportLoadError')}
        action={<BigButton onClick={() => setAttempt((n) => n + 1)}>{t('app.retry')}</BigButton>}
      />
    );
  }

  const hasDays = report.dailyStats.length > 0;
  // Trần của biểu đồ = ngày nhiều nhất. `Math.max(1)` để không chia cho 0 khi tuần chưa có gì.
  const maxWords = Math.max(1, ...report.dailyStats.map((day: DailyStat) => day.wordsLearned));

  /**
   * Bé đã nộp dù chỉ MỘT phần thi cuối khoá chưa. Dùng để chọn giữa hai trạng thái của khối:
   * CHƯA thi ⇒ một câu trung tính (KHÔNG dãy khiên rỗng); đã thi ⇒ liệt kê từng phần.
   * ⚠️ `attempts > 0` (không phải `bestShields !== null`) vì đó là sự thật thô của server.
   */
  const hasFinalTestAttempt = report.finalTest.some((section) => section.attempts > 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-kid-lg text-ink">{t('parent.report')}</h2>
        <p className="text-kid-sm text-ink-soft">
          {/* `child.nickname` + khoảng thời gian, để phụ huynh biết báo cáo là CỦA AI và CỦA KHI NÀO. */}
          {report.child.nickname} ·{' '}
          {t('parent.reportRange', {
            from: shortDate(report.range.from),
            to: shortDate(report.range.to),
          })}
        </p>
      </header>

      {/*
        ⭐ CÂU TÓM TẮT DO SERVER VIẾT — hiển thị NGUYÊN VĂN, không ghép thêm số của client.
        (Tông giọng của câu này do server bảo đảm; client không tự viết lại.)
      */}
      <p className="rounded-card border-2 border-brand bg-brand-tint px-4 py-3 text-kid-md text-ink">
        {report.summary_vi}
      </p>

      {/* --- Bốn con số NGUYÊN từ server ------------------------------------ */}
      <ResponsiveGrid as="ul" minItemWidth={150} gap={12}>
        {(
          [
            { icon: '📖', label: t('parent.wordsLearned'), value: report.wordsLearned },
            { icon: '🧠', label: t('parent.wordsMastered'), value: report.wordsMastered },
            { icon: '📘', label: t('parent.lessonsCompleted'), value: report.lessonsCompleted },
            { icon: '⭐', label: t('parent.starsEarned'), value: report.starsEarned },
          ] as const
        ).map((stat) => (
          <li
            key={stat.label}
            className="flex flex-col items-center gap-1 rounded-card border-2 border-line bg-surface p-3 text-center"
          >
            <span aria-hidden="true" className="text-[32px] leading-none">
              {stat.icon}
            </span>
            <span className="text-kid-lg font-bold tabular-nums text-ink">{stat.value}</span>
            <span className="text-kid-xs text-ink-soft">{stat.label}</span>
          </li>
        ))}
      </ResponsiveGrid>

      {/* --- Biểu đồ cột: số từ mỗi ngày ------------------------------------ */}
      <section aria-labelledby="parent-report-chart" className="flex flex-col gap-2">
        <h3 id="parent-report-chart" className="text-kid-md font-bold text-ink">
          {t('parent.reportDailyTitle')}
        </h3>

        {!hasDays ? (
          // Tuần chưa có dữ liệu ⇒ câu trung tính, KHÔNG màn hình trắng, KHÔNG giá trị bịa.
          <p className="rounded-card border-2 border-line bg-surface-raised px-4 py-3 text-kid-sm text-ink-soft">
            {t('parent.reportEmptyDays')}
          </p>
        ) : (
          <ol className="flex items-end justify-between gap-2">
            {report.dailyStats.map((day) => (
              <li key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                {/*
                  ⚠️ MỖI CỘT MANG NHÃN ĐỌC ĐƯỢC (`role="img"` + `aria-label`), vì biểu đồ là THỊ
                  GIÁC: không có nhãn thì phụ huynh khiếm thị nhận được ZERO con số từ khối này.
                  Con của `role="img"` bị coi là trang trí, nên nhãn ngày hiện dưới cột đặt
                  `aria-hidden` để không bị đọc lặp.
                */}
                <div
                  role="img"
                  aria-label={t('parent.reportBarLabel', {
                    day: shortDate(day.date),
                    count: day.wordsLearned,
                  })}
                  className="flex h-28 w-full items-end justify-center overflow-hidden rounded-kid bg-line"
                >
                  <div
                    className="w-full rounded-kid bg-brand"
                    // Chiều cao TỈ LỆ với ngày nhiều nhất. `maxWords ≥ 1` ⇒ không bao giờ NaN%.
                    style={{ height: `${(day.wordsLearned / maxWords) * 100}%` }}
                  />
                </div>
                <span aria-hidden="true" className="text-kid-xs text-ink-faint">
                  {shortDate(day.date)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* --- Từ bé còn hay nhầm -------------------------------------------- */}
      <section aria-labelledby="parent-report-struggling" className="flex flex-col gap-2">
        <h3 id="parent-report-struggling" className="text-kid-md font-bold text-ink">
          {t('parent.strugglingWords')}
        </h3>
        {report.strugglingWords.length === 0 ? (
          <p className="rounded-card border-2 border-line bg-surface-raised px-4 py-3 text-kid-sm text-ink-soft">
            {t('parent.noStruggling')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {report.strugglingWords.map((word) => (
              <WordRow key={word.wordId} word={word} />
            ))}
          </ul>
        )}
      </section>

      {/* --- Từ bé đã nhớ chắc --------------------------------------------- */}
      <section aria-labelledby="parent-report-mastered" className="flex flex-col gap-2">
        <h3 id="parent-report-mastered" className="text-kid-md font-bold text-ink">
          {t('parent.masteredWords')}
        </h3>
        {report.masteredWords.length === 0 ? (
          <p className="rounded-card border-2 border-line bg-surface-raised px-4 py-3 text-kid-sm text-ink-soft">
            {t('parent.noMastered')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {report.masteredWords.map((word) => (
              <WordRow key={word.wordId} word={word} />
            ))}
          </ul>
        )}
      </section>

      {/* --- Bài thi cuối khoá --------------------------------------------- */}
      {/*
        ⭐ KHỐI CỘT MỐC, KHÔNG PHẢI SỐ CỦA TUẦN: bài thi cuối khoá làm MỘT lần cho cả lộ trình,
        nên khiên/ngày ở đây KHÔNG lọc theo khoảng ngày của báo cáo (server đã trả đúng như vậy).

        ⚠️ BÉ CHƯA THI ⇒ câu trung tính, KHÔNG hiện khiên. "0 khiên" đọc lên như một lời chê —
          server trả `null` chứ không bịa 0, và client không tự suy ra con số nào.
        ⚠️ Dòng miễn trừ Cambridge giữ NGUYÊN VĂN và DÙNG CHUNG chuỗi với màn thi (`finalTest.*`):
          một nguồn duy nhất cho câu ràng buộc pháp lý, không chép lại để rồi lệch.
      */}
      <section aria-labelledby="parent-report-final-test" className="flex flex-col gap-2">
        <h3 id="parent-report-final-test" className="text-kid-md font-bold text-ink">
          {t('parent.finalTestTitle')}
        </h3>

        {!hasFinalTestAttempt ? (
          <p className="rounded-card border-2 border-line bg-surface-raised px-4 py-3 text-kid-sm text-ink-soft">
            {t('parent.finalTestNotTaken')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {report.finalTest.map((section) => {
              const title = t(sectionTitleKey(section.section));
              const shields = section.bestShields;
              return (
                <li
                  key={section.section}
                  className="flex items-center justify-between gap-3 rounded-kid border-2 border-line bg-surface px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block text-kid-md font-bold text-ink">{title}</span>
                    <span className="block text-kid-xs text-ink-soft">
                      {section.lastAttemptAt !== null
                        ? t('parent.finalTestLastAttempt', {
                            date: formatDateVi(section.lastAttemptAt),
                          })
                        : t('parent.finalTestNoAttempt')}
                    </span>
                  </span>
                  {shields !== null && (
                    <span
                      role="img"
                      aria-label={t('finalTest.shieldsEarnedLabel', { section: title, count: shields })}
                      className="shrink-0 text-kid-md font-bold tabular-nums text-ink"
                    >
                      <span aria-hidden="true">🛡️</span> {shields}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p className="rounded-card border-2 border-line bg-surface-raised px-4 py-3 text-kid-xs text-ink-soft">
          {t('finalTest.speakDisclaimer')}
        </p>
      </section>
    </div>
  );
}
