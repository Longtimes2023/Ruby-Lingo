/**
 * RubyLingo — `ParentSettingsPage`: CÀI ĐẶT của khu vực phụ huynh (T074), hiển thị như một VIEW
 * trong `/parent` (không có route riêng — cùng lý do như `ParentReport`, xem `ParentGatePage`).
 *
 * ⭐ MÀN NÀY LÀ "MỘT CHỖ DUY NHẤT CHO THAO TÁC QUẢN TRỊ" (quyết định của chủ dự án, task #28):
 *   • ĐỔI hồ sơ bé (`switch`) = việc BÌNH THƯỜNG, không cần cổng — bé tự chọn hồ sơ của mình, và
 *     việc đó vẫn nằm ở `ChildSwitcherDialog` trên thanh trên cùng.
 *   • SỬA / XOÁ hồ sơ = việc QUẢN TRỊ ⇒ nằm ở ĐÂY, tức là luôn ở SAU cổng PIN. Trước đây không có
 *     chỗ nào cho hai việc này; đặt chúng ở hộp thoại đổi bé sẽ buộc phải dựng một UI cổng PIN thứ
 *     hai — hai UI cổng là hai chỗ để lệch nhau.
 *
 * ⚠️⚠️ `false` LÀ GIÁ TRỊ HỢP LỆ — DÙNG `??` CHỨ KHÔNG `||`:
 *   `soundEnabled: false` / `musicEnabled: false` / `reducedMotion: false` đều là ý định THẬT của
 *   phụ huynh. Viết `value || true` (hay `patch.soundEnabled || ...`) sẽ biến `false` thành `true`
 *   — phụ huynh tắt tiếng mà app vẫn kêu, và không có lỗi nào được ném ra. Bản server cũng vừa
 *   trúng đúng cái bẫy này.
 *
 * ⚠️ LỖI MẠNG KHÔNG ĐƯỢC LÀM MẤT GIÁ TRỊ ĐANG HIỆN: khi PATCH hỏng, ta KHÔNG hoàn tác về giá trị
 *    cũ (làm vậy thì công tắc tự bật ngược lại trước mắt phụ huynh và họ phải làm lại từ đầu).
 *    Ta giữ nguyên thứ họ vừa chọn và nói thật rằng chưa lưu được.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { ChildProfileDto, SettingsDto, UpdateSettingsRequest } from '@shared/types/api.js';

import { isApiClientError } from '../../api/client.js';
import { settingsApi } from '../../api/endpoints.js';
import { BigButton } from '../../components/common/BigButton.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { getAvatar } from '../../data/avatars.js';
import { useDeleteChild, useSignOut, useUpdateChild } from '../../hooks/useSession.js';
import { cn } from '../../lib/cn.js';
import { SPEECH_RATE_MAX, SPEECH_RATE_MIN, useSettingsStore } from '../../store/settingsStore.js';
import { useSessionStore } from '../../store/sessionStore.js';

export interface ParentSettingsPageProps {
  /**
   * Gọi khi server nói CỔNG ĐÃ ĐÓNG (403 `PARENT_GATE_REQUIRED` / 401) — chủ trang quay về màn
   * nhập PIN. Đây không phải lỗi kỹ thuật: cổng chỉ mở 10 phút rồi tự đóng.
   * ⚠️ Phải ỔN ĐỊNH (`useCallback` ở chủ trang) vì nó nằm trong deps của hiệu ứng nạp.
   */
  onGateClosed: () => void;
}

/** Công tắc bật/tắt cỡ lớn. `role="switch"` để trình đọc màn hình nói được "đang bật/đang tắt". */
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        // `min-h-touch` (64px): vùng chạm tối thiểu — người dùng là phụ huynh nhưng luật vùng chạm
        // của dự án không đổi.
        'flex min-h-touch w-full items-center justify-between gap-3 rounded-kid border-2 px-4 text-left',
        checked
          ? 'border-brand bg-brand-soft text-brand'
          : 'border-line bg-surface text-ink-soft',
      )}
    >
      <span className="min-w-0 text-kid-md font-bold">{label}</span>
      {/* Chữ Bật/Tắt là tầng phân biệt thứ hai ngoài màu — cần cho người không phân biệt được màu. */}
      <span aria-hidden="true" className="shrink-0 text-kid-sm font-bold">
        {checked ? t('parent.settingsOn') : t('parent.settingsOff')}
      </span>
    </button>
  );
}

/** `true` nếu lỗi nghĩa là "cổng PIN đã đóng" — chuyện BÌNH THƯỜNG, không phải sự cố. */
function isGateClosed(err: unknown): boolean {
  return (
    isApiClientError(err) &&
    (err.code === 'PARENT_GATE_REQUIRED' || err.code === 'UNAUTHENTICATED')
  );
}

export function ParentSettingsPage({ onGateClosed }: ParentSettingsPageProps) {
  const { t } = useTranslation();

  const children = useSessionStore((s) => s.children);
  const activeChildId = useSessionStore((s) => s.activeChildId);
  const setActiveChild = useSessionStore((s) => s.setActiveChild);

  const setSoundEnabled = useSettingsStore((s) => s.setSoundEnabled);
  const setMusicEnabled = useSettingsStore((s) => s.setMusicEnabled);
  const setSpeechRate = useSettingsStore((s) => s.setSpeechRate);
  const setReducedMotion = useSettingsStore((s) => s.setReducedMotion);

  const signOut = useSignOut();
  const updateChild = useUpdateChild();
  const deleteChild = useDeleteChild();

  const [settings, setSettings] = useState<SettingsDto | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  /** Câu phản hồi gần nhất (đã lưu / chưa lưu được) — `null` = không nói gì. */
  const [notice, setNotice] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const childId = activeChildId;

  /** Dịch một lỗi thành hành vi: cổng đóng ⇒ về cổng; còn lại ⇒ câu trung tính. */
  const handleActionError = useCallback(
    (err: unknown, fallback: string): void => {
      if (isGateClosed(err)) {
        onGateClosed();
        return;
      }
      setNotice(fallback);
    },
    [onGateClosed],
  );

  // --- Nạp cài đặt từ server ------------------------------------------------
  useEffect(() => {
    // Chưa có bé đang chọn (bị xoá hết?) ⇒ không có gì để đọc.
    if (childId === null) {
      setState('error');
      return;
    }

    let alive = true;
    setState('loading');
    settingsApi
      .get(childId)
      .then((data) => {
        if (!alive) return;
        setSettings(data);
        setState('ready');
        /*
          ⭐ Áp xuống `settingsStore` (bản trong máy) để phần còn lại của app — `SoundButton`,
             `SpeechService`, hiệu ứng — dùng ngay cùng một sự thật. Truyền thẳng giá trị của
             server, KHÔNG `?? true`: `false` là ý định thật của phụ huynh.
        */
        setSoundEnabled(data.soundEnabled);
        setMusicEnabled(data.musicEnabled);
        setSpeechRate(data.speechRate);
        setReducedMotion(data.reducedMotion);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (isGateClosed(err)) {
          onGateClosed();
          return;
        }
        setState('error');
      });

    return () => {
      alive = false;
    };
  }, [
    childId,
    attempt,
    onGateClosed,
    setSoundEnabled,
    setMusicEnabled,
    setSpeechRate,
    setReducedMotion,
  ]);

  /**
   * Lưu MỘT trường vừa đổi.
   *
   * ⚠️ Gửi CHỈ trường vừa đổi (`patch`), không gửi cả cụm: gửi cả cụm thì hai thiết bị đang mở
   *    cùng lúc sẽ ghi đè lẫn nhau, và thay đổi của người này âm thầm nuốt thay đổi của người kia.
   */
  const saveSetting = (patch: UpdateSettingsRequest): void => {
    if (settings === null || childId === null) return;
    // Phản hồi TỨC THÌ: cập nhật màn hình + bản trong máy trước khi chờ mạng.
    setSettings({ ...settings, ...patch });
    if (patch.soundEnabled !== undefined) setSoundEnabled(patch.soundEnabled);
    if (patch.musicEnabled !== undefined) setMusicEnabled(patch.musicEnabled);
    if (patch.speechRate !== undefined) setSpeechRate(patch.speechRate);
    if (patch.reducedMotion !== undefined) setReducedMotion(patch.reducedMotion);
    setNotice(null);

    settingsApi
      .update(childId, patch)
      .then((saved) => {
        // Server là trọng tài — lấy đúng những gì nó trả về.
        setSettings(saved);
        setNotice(t('parent.settingsSaved'));
      })
      .catch((err: unknown) => {
        // ⚠️ KHÔNG hoàn tác: giá trị phụ huynh vừa chọn không được biến mất khỏi màn hình.
        handleActionError(err, t('parent.settingsSaveFailed'));
      });
  };

  if (state === 'loading') {
    return <EmptyState icon="⚙️" title={t('app.loading')} />;
  }

  if (state === 'error' || settings === null) {
    return (
      <EmptyState
        icon="⚙️"
        title={t('parent.settingsLoadError')}
        action={<BigButton onClick={() => setAttempt((n) => n + 1)}>{t('app.retry')}</BigButton>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-kid-lg text-ink">{t('parent.settingsTitle')}</h2>

      {/* Thông báo gần nhất — `role="status"` để trình đọc màn hình cũng biết đã lưu hay chưa. */}
      {notice !== null && (
        <p role="status" className="rounded-card border-2 border-line bg-surface-raised px-4 py-3 text-kid-sm font-bold text-ink-soft">
          {notice}
        </p>
      )}

      {/* --- Bốn cài đặt ---------------------------------------------------- */}
      <section aria-labelledby="parent-settings-title" className="flex flex-col gap-2">
        <h3 id="parent-settings-title" className="text-kid-md font-bold text-ink">
          {t('parent.settings')}
        </h3>

        <Toggle
          label={t('parent.sound')}
          checked={settings.soundEnabled}
          onChange={(next) => saveSetting({ soundEnabled: next })}
        />
        <Toggle
          label={t('parent.music')}
          checked={settings.musicEnabled}
          onChange={(next) => saveSetting({ musicEnabled: next })}
        />
        <Toggle
          label={t('parent.reducedMotion')}
          checked={settings.reducedMotion}
          onChange={(next) => saveSetting({ reducedMotion: next })}
        />

        <label className="flex min-h-touch flex-col gap-2 rounded-kid border-2 border-line bg-surface px-4 py-3">
          <span className="flex items-center justify-between gap-3">
            <span className="text-kid-md font-bold text-ink">{t('parent.speechRate')}</span>
            <span className="text-kid-sm font-bold text-ink-soft">
              {t('parent.speechRateValue', { rate: settings.speechRate })}
            </span>
          </span>
          <input
            type="range"
            // Khoảng lấy từ HẰNG SỐ của `settingsStore` — không ghim cứng 0.5/1.2 ở hai chỗ.
            min={SPEECH_RATE_MIN}
            max={SPEECH_RATE_MAX}
            step={0.1}
            value={settings.speechRate}
            onChange={(e) => saveSetting({ speechRate: Number(e.target.value) })}
            aria-label={t('parent.speechRate')}
            className="w-full"
          />
        </label>
      </section>

      {/* --- Hồ sơ các bé: đổi · sửa · xoá ---------------------------------- */}
      <section aria-labelledby="parent-children-title" className="flex flex-col gap-2">
        <h3 id="parent-children-title" className="text-kid-md font-bold text-ink">
          {t('parent.childrenTitle')}
        </h3>

        <ul className="flex flex-col gap-2">
          {children.map((child: ChildProfileDto) => {
            const avatar = getAvatar(child.avatarId);
            const active = child.id === activeChildId;
            const editing = editingId === child.id;
            const confirming = confirmDeleteId === child.id;
            return (
              <li
                key={child.id}
                className={cn(
                  'flex flex-col gap-3 rounded-kid border-2 p-3',
                  active ? 'border-brand bg-brand-soft' : 'border-line bg-surface',
                )}
              >
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="text-[28px] leading-none">
                    {avatar?.icon ?? '🐾'}
                  </span>
                  {editing ? (
                    <input
                      type="text"
                      value={editNickname}
                      onChange={(e) => setEditNickname(e.target.value)}
                      aria-label={t('child.nickname')}
                      maxLength={20}
                      className="min-h-touch min-w-0 flex-1 rounded-kid border-2 border-line bg-surface px-3 text-kid-md text-ink"
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-kid-md font-bold text-ink">
                      {child.nickname}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {!active && (
                    <button
                      type="button"
                      onClick={() => setActiveChild(child.id)}
                      className="min-h-touch rounded-kid border-2 border-line bg-surface px-4 text-kid-sm font-bold text-brand"
                    >
                      {t('child.switchChild')}
                    </button>
                  )}

                  {editing ? (
                    <>
                      <button
                        type="button"
                        disabled={editNickname.trim().length === 0 || updateChild.isPending}
                        onClick={() =>
                          updateChild.mutate(
                            { childId: child.id, input: { nickname: editNickname.trim() } },
                            {
                              onSuccess: () => {
                                setEditingId(null);
                                setNotice(t('parent.childSaved'));
                              },
                              onError: (err) => handleActionError(err, t('parent.childSaveFailed')),
                            },
                          )
                        }
                        className="min-h-touch rounded-kid border-2 border-brand bg-surface px-4 text-kid-sm font-bold text-brand disabled:opacity-50"
                      >
                        {t('app.save')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="min-h-touch rounded-kid border-2 border-line bg-surface px-4 text-kid-sm font-bold text-ink-soft"
                      >
                        {t('app.cancel')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(child.id);
                        setEditNickname(child.nickname);
                        setConfirmDeleteId(null);
                        setNotice(null);
                      }}
                      className="min-h-touch rounded-kid border-2 border-line bg-surface px-4 text-kid-sm font-bold text-ink-soft"
                    >
                      {t('parent.editChild')}
                    </button>
                  )}

                  {/* Xoá là việc KHÔNG hoàn tác được ⇒ hai bước, và bước 1 NÓI RÕ TÊN bé. */}
                  {confirming ? (
                    <>
                      <span className="flex min-h-touch items-center px-1 text-kid-sm font-bold text-danger">
                        {t('parent.deleteChildConfirm', { name: child.nickname })}
                      </span>
                      <button
                        type="button"
                        disabled={deleteChild.isPending}
                        onClick={() =>
                          deleteChild.mutate(child.id, {
                            onSuccess: () => setConfirmDeleteId(null),
                            onError: (err) => handleActionError(err, t('parent.deleteChildFailed')),
                          })
                        }
                        className="min-h-touch rounded-kid border-2 border-danger bg-surface px-4 text-kid-sm font-bold text-danger disabled:opacity-50"
                      >
                        {t('parent.deleteChildYes')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="min-h-touch rounded-kid border-2 border-line bg-surface px-4 text-kid-sm font-bold text-ink-soft"
                      >
                        {t('app.cancel')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeleteId(child.id);
                        setEditingId(null);
                        setNotice(null);
                      }}
                      className="min-h-touch rounded-kid border-2 border-line bg-surface px-4 text-kid-sm font-bold text-ink-soft"
                    >
                      {t('parent.deleteChild')}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {/*
          ⭐ THÊM BÉ NẰM Ở ĐÂY, KHÔNG Ở HỘP THOẠI ĐỔI BÉ — cùng lý do như sửa/xoá (xem ghi chú
          đầu tệp): mọi thao tác QUẢN TRỊ hồ sơ nằm ở MỘT chỗ, và chỗ đó luôn ở sau cổng PIN.

          ⚠️ Đây là lối vào `/children/new` DUY NHẤT trong app. Trước đây, để luồng đăng nhập
          kiểm chứng được đầu-cuối, `JourneyMapPage` có một khối TẠM chứa đúng liên kết này; khối
          đó đã được GỠ khi màn này có chức năng thêm bé (không được gỡ trước, kẻo mất lối vào).

          ⚠️ VÌ SAO `/children/new` KHÔNG CÓ CỔNG PIN (khác với `PATCH`/`DELETE /api/children/:id`):
          đó cũng là trang của LUỒNG ĐĂNG KÝ (đăng ký → tạo hồ sơ bé đầu tiên), lúc đó phụ huynh
          CHƯA đặt PIN ⇒ không có cổng nào để mở. Thêm một bé là việc không mất dữ liệu.
        */}
        <Link
          to="/children/new"
          className="flex min-h-touch items-center justify-center rounded-kid border-2 border-brand bg-surface px-4 text-kid-sm font-bold text-brand"
        >
          + {t('child.addChild')}
        </Link>
      </section>

      {/* --- Đăng xuất ------------------------------------------------------- */}
      <BigButton variant="ghost" icon="🚪" loading={signOut.isPending} onClick={() => signOut.mutate()}>
        {t('auth.logout')}
      </BigButton>
    </div>
  );
}
