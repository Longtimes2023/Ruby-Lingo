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
 * ⭐ ĐÃ ĐỒNG BỘ SERVER (Giai đoạn 11): lựa chọn được lưu lên hồ sơ bé qua
 *   `/api/children/:id/parent-speaking`, nên đổi máy vẫn thấy và báo cáo phụ huynh đọc được.
 *   Khi mất mạng, bản cục bộ được giữ và sẽ TỰ GỬI BÙ khi có mạng (xem `parentSpeakingStore`).
 *   ⚠️ Vì thế KHÔNG còn câu "chỉ lưu trên thiết bị này" — UI không được nói sai sự thật.
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import {
  PARENT_SPEAKING_ITEM_IDS,
  type ParentSpeakingItem,
} from '@shared/schemas/parent-speaking.js';

import { cn } from '../../lib/cn.js';
import { useParentSpeaking } from '../../hooks/useParentSpeaking.js';

export interface ParentSpeakingChecklistProps {
  /** Bé đang chọn — rubric là CỦA BÉ NÀY. */
  childId: string;
}

/** Sắp theo ĐÚNG thứ tự danh mục để payload gửi lên ổn định (dễ đối chiếu khi debug). */
function inCatalogOrder(items: ParentSpeakingItem[]): ParentSpeakingItem[] {
  return PARENT_SPEAKING_ITEM_IDS.flatMap((id) => items.filter((item) => item.id === id));
}

export function ParentSpeakingChecklist({ childId }: ParentSpeakingChecklistProps) {
  const { t } = useTranslation();
  const { items, loading, pending, offline, save } = useParentSpeaking(childId);

  /**
   * Bấm một lựa chọn cho một mục.
   *
   * ⚠️ Bấm lại lựa chọn cũ ⇒ BỎ đánh dấu (về "chưa xác nhận") — để phụ huynh sửa được ý mình.
   *    Đây là lý do mục VẮNG MẶT phải khác với `done: false` (xem `shared/schemas/parent-speaking.ts`).
   */
  const choose = useCallback(
    (id: ParentSpeakingItem['id'], done: boolean) => {
      const current = items.find((item) => item.id === id);
      const without = items.filter((item) => item.id !== id);
      const next = current && current.done === done ? without : [...without, { id, done }];
      void save(childId, inCatalogOrder(next));
    },
    [childId, items, save],
  );

  const markOf = (id: ParentSpeakingItem['id']): boolean | undefined =>
    items.find((item) => item.id === id)?.done;

  if (loading) {
    return <p className="text-center text-kid-sm text-ink-soft">{t('app.loading')}</p>;
  }

  return (
    <section aria-labelledby="parent-speaking-title" className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 id="parent-speaking-title" className="text-kid-lg text-ink">
          {t('parent.speakingTitle')}
        </h2>
        <p className="text-kid-sm text-ink-soft">{t('parent.speakingIntro')}</p>
      </header>

      <ul className="flex flex-col gap-3">
        {PARENT_SPEAKING_ITEM_IDS.map((id, index) => {
          const mark = markOf(id);
          const label = t(`parent.speakingItem${index + 1}` as const);
          return (
            <li key={id} className="flex flex-col gap-2 rounded-kid border-2 border-line bg-surface p-3">
              <p className="text-kid-md font-bold text-ink">{label}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={mark === true}
                  onClick={() => choose(id, true)}
                  className={cn(
                    // `min-h-touch` (64px): vùng chạm tối thiểu — xem `tokens.css`.
                    'min-h-touch rounded-kid border-2 px-4 text-kid-sm font-bold',
                    mark === true
                      ? 'border-success bg-success text-ink-inverse'
                      : 'border-line bg-surface text-ink-soft',
                  )}
                >
                  ✅ {t('parent.speakingDone')}
                </button>
                <button
                  type="button"
                  aria-pressed={mark === false}
                  onClick={() => choose(id, false)}
                  className={cn(
                    'min-h-touch rounded-kid border-2 px-4 text-kid-sm font-bold',
                    mark === false
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

      {/*
        ⚠️ Mất mạng/KHÔNG đồng bộ được ⇒ NÓI THẬT bằng câu TRUNG TÍNH, KHÔNG lộ mã lỗi kỹ thuật.
        Lựa chọn vẫn được giữ trên máy này và sẽ tự gửi lại khi có mạng.
      */}
      {(offline || pending) && (
        <p className="rounded-kid border-2 border-line bg-surface-raised px-4 py-3 text-kid-xs text-ink-soft" role="status">
          {t('parent.speakingSyncPending')}
        </p>
      )}
    </section>
  );
}
