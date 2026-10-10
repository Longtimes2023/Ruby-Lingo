/**
 * RubyLingo — `ParentSpeakingChecklist`: PHỤ HUYNH XÁC NHẬN PHẦN NÓI (TẦNG 4).
 *
 * ⭐ ĐÂY LÀ CÁCH "CHẤM GIỌNG CHUẨN HAY KHÔNG" ĐÁNG TIN NHẤT Ở GIAI ĐOẠN NÀY.
 *   Máy không chấm phát âm (xem `docs/ke-hoach/phan-noi-bai-thi.md`). Người nghe tốt nhất — và
 *   duy nhất đáng tin — là phụ huynh/giáo viên ngồi cạnh bé. Màn này cho họ một RUBRIC HÀNH VI
 *   (quan sát được), không phải thang điểm: mỗi mục chỉ hỏi "con có làm được việc này không".
 *
 * ⚠️⚠️ KHÔNG PHẢI ĐIỂM SỐ, KHÔNG "ĐẠT/TRƯỢT". Hai lựa chọn là "Bé đã làm được" và "Mình ôn thêm
 *   nhé" — vế sau là LỜI MỜI ôn cùng con, không phải lời chê. Cùng luật ngôn ngữ của cả app.
 *
 * ⚠️⚠️ LƯU CỤC BỘ (localStorage) — CHƯA ĐỒNG BỘ SERVER.
 *   Việc đồng bộ cần thêm bảng/route phía server (ngoài phạm vi giai đoạn này). Ta ghi cục bộ và
 *   NÓI THẬT điều đó với phụ huynh (`parent.speakingLocalNote`) — ẩn đi là nói dối họ.
 *   Khoá lưu TÁCH THEO TỪNG BÉ: anh/chị/em trong nhà không ghi đè kết quả của nhau.
 *   Logic lưu/đọc nằm ở `src/lib/parentSpeakingMarks.ts` (thuần, có test riêng).
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/cn.js';
import {
  loadSpeakingMarks,
  saveSpeakingMarks,
  SPEAKING_PARTS,
  type SpeakingMarks,
  type SpeakingMark,
} from '../../lib/parentSpeakingMarks.js';

export interface ParentSpeakingChecklistProps {
  /** Bé đang chọn — rubric là CỦA BÉ NÀY. */
  childId: string;
}

export function ParentSpeakingChecklist({ childId }: ParentSpeakingChecklistProps) {
  const { t } = useTranslation();
  // Nạp theo bé: đổi bé thì đọc lại rubric của bé đó (khoá lưu tách theo `childId`).
  const [marks, setMarks] = useState<SpeakingMarks>(() => loadSpeakingMarks(childId));

  useEffect(() => {
    setMarks(loadSpeakingMarks(childId));
  }, [childId]);

  const choose = useCallback(
    (part: number, mark: SpeakingMark) => {
      setMarks((current) => {
        // Bấm lại lựa chọn cũ ⇒ BỎ đánh dấu (về "chưa xác nhận") — để phụ huynh sửa được ý mình.
        const next: SpeakingMarks = { ...current };
        if (next[part] === mark) delete next[part];
        else next[part] = mark;
        saveSpeakingMarks(childId, next);
        return next;
      });
    },
    [childId],
  );

  return (
    <section aria-labelledby="parent-speaking-title" className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 id="parent-speaking-title" className="text-kid-lg text-ink">
          {t('parent.speakingTitle')}
        </h2>
        <p className="text-kid-sm text-ink-soft">{t('parent.speakingIntro')}</p>
      </header>

      <ul className="flex flex-col gap-3">
        {SPEAKING_PARTS.map((part) => {
          const mark = marks[part];
          const label = t(`parent.speakingItem${part}` as const);
          return (
            <li key={part} className="flex flex-col gap-2 rounded-kid border-2 border-line bg-surface p-3">
              <p className="text-kid-md font-bold text-ink">{label}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={mark === 'done'}
                  onClick={() => choose(part, 'done')}
                  className={cn(
                    // `min-h-touch` (64px): vùng chạm tối thiểu — xem `tokens.css`.
                    'min-h-touch rounded-kid border-2 px-4 text-kid-sm font-bold',
                    mark === 'done'
                      ? 'border-success bg-success text-ink-inverse'
                      : 'border-line bg-surface text-ink-soft',
                  )}
                >
                  ✅ {t('parent.speakingDone')}
                </button>
                <button
                  type="button"
                  aria-pressed={mark === 'not-yet'}
                  onClick={() => choose(part, 'not-yet')}
                  className={cn(
                    'min-h-touch rounded-kid border-2 px-4 text-kid-sm font-bold',
                    mark === 'not-yet'
                      ? 'border-brand bg-brand-soft text-brand'
                      : 'border-line bg-surface text-ink-soft',
                  )}
                >
                  🔁 {t('parent.speakingNotYet')}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Nói THẬT về giới hạn hiện tại — không được ẩn. */}
      <p className="rounded-kid border-2 border-line bg-surface-raised px-4 py-3 text-kid-xs text-ink-soft">
        {t('parent.speakingLocalNote')}
      </p>
    </section>
  );
}
