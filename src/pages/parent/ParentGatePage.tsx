/**
 * RubyLingo — `ParentGatePage`: CỔNG PIN cho khu vực phụ huynh (T072, Nhóm 11), ở route `/parent`.
 *
 * ⭐ NHIỆM VỤ: hỏi mã PIN trước khi cho vào khu vực phụ huynh, rồi (khi đã vào) cho ĐẶT / ĐỔI mã
 *   PIN. Khu vực phụ huynh đầy đủ (báo cáo, cài đặt) thuộc T073/T074 — trang này chỉ dựng cái cổng.
 *
 * -----------------------------------------------------------------------------
 * HAI ĐIỀU KHÔNG ĐƯỢC BỎ
 * -----------------------------------------------------------------------------
 *
 * ⚠️ 1. TRANG KHÔNG ĐƯỢC TIẾT LỘ "TÀI KHOẢN ĐÃ ĐẶT PIN HAY CHƯA".
 *    `parent_account.pin_hash` là nullable. Nếu màn hình nói "Bố mẹ chưa đặt PIN" thì người đang
 *    dò biết ngay tài khoản nào chưa được bảo vệ. Vì vậy CÙNG một màn hình cho mọi tài khoản:
 *    luôn có ô nhập PIN khi cổng đóng, và phần "Đặt mã PIN" khi cổng mở (dùng cho CẢ đặt lẫn đổi —
 *    câu chữ trung tính). KHÔNG có nhánh nào tự nhận "chưa có PIN".
 *    Phía server cũng phối hợp: `ParentGateResponse` chỉ phản ánh trạng thái PHIÊN, không phụ
 *    thuộc việc có PIN hay không — xem `server/services/ParentService.ts`.
 *
 * ⚠️ 2. LỖI ĐỌC TRẠNG THÁI CỔNG ⇒ HIỆN CỔNG (ĐÓNG), KHÔNG mở.
 *    Nếu gọi `GET /parent/gate` thất bại mà ta mặc định "đã mở" thì một sự cố mạng sẽ cho vào
 *    khu vực phụ huynh mà không cần PIN. Mặc định ĐÓNG là hướng an toàn.
 *
 * ⭐ NGÔN NGỮ: đây là màn hình cho NGƯỜI LỚN, nhưng luật của dự án áp cho MỌI chuỗi — không phán
 *   xét, không mắng. Sai PIN ⇒ "Mã PIN chưa đúng. Bố mẹ thử lại nhé." (xem `parent.pinWrong`).
 */

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { PARENT_PIN_LENGTH } from '@shared/constants.js';

import { isApiClientError } from '../../api/client.js';
import { parentApi } from '../../api/endpoints.js';
import { apiErrorMessage } from '../../api/errorMessage.js';
import { BigButton } from '../../components/common/BigButton.js';
import { useActiveChild } from '../../store/sessionStore.js';
import { ParentReport } from './ParentReport.js';
import { ParentSettingsPage } from './ParentSettingsPage.js';

/** Trạng thái cổng của phiên: đang kiểm tra / đang đóng (phải nhập PIN) / đã mở. */
type GateState = 'loading' | 'closed' | 'open';

/** Ô nhập PIN — dùng chung cho cả cổng lẫn phần "Đặt mã PIN". Độ dài lấy từ `PARENT_PIN_LENGTH`. */
function PinField({
  value,
  onChange,
  disabled,
  autoFocus,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
  autoFocus?: boolean;
  label: string;
}) {
  return (
    <input
      // `inputMode="numeric"`: bàn phím số trên điện thoại. `pattern` để iOS chắc chắn hiện bàn số.
      // Chỉ giữ CHỮ SỐ khi nhập — dán/kéo cũng không lọt ký tự khác vào ô.
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, PARENT_PIN_LENGTH))}
      /*
        ⚠️ `type="password"`: CHE số đã gõ. Đây là máy dùng CHUNG trong nhà — bố mẹ mở khu vực phụ
        huynh ngay trước mặt bé. Nếu PIN hiện rõ, bé chỉ cần liếc một lần là biết mã và tự mở được
        khu vực phụ huynh — tức là vô hiệu hoá đúng thứ cổng này sinh ra để chặn.
        ⚠️ `autoComplete="off"`: KHÔNG để trình duyệt lưu/điền lại PIN.
      */
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      autoFocus={autoFocus}
      disabled={disabled}
      aria-label={label}
      maxLength={PARENT_PIN_LENGTH}
      // `min-h-touch` (64px): vùng chạm tối thiểu cho tay trẻ — xem `tokens.css`.
      className="min-h-touch w-full rounded-kid border-2 border-line bg-surface px-4 py-3 text-center text-kid-lg tracking-[0.5em] text-ink"
    />
  );
}

export function ParentGatePage() {
  const { t } = useTranslation();

  /** Bé ĐANG chọn — báo cáo là báo cáo CỦA BÉ NÀY (server kiểm quyền qua `parent_id`). */
  const child = useActiveChild();
  const childId = child?.id ?? null;

  const [gate, setGate] = useState<GateState>('loading');
  /** Đọc trạng thái cổng THẤT BẠI ⇒ hiện một câu trung tính (vẫn giữ cổng ĐÓNG — xem quyết định 2). */
  const [gateLoadFailed, setGateLoadFailed] = useState(false);
  /** Màn đang hiện trong `/parent`: nhập PIN · quên PIN · báo cáo · cài đặt (KHÔNG route riêng). */
  const [view, setView] = useState<'gate' | 'forgot' | 'report' | 'settings'>('gate');
  /**
   * Câu trung tính hiện Ở MÀN NHẬP PIN khi ta vừa bị đẩy về đây vì cổng hết hạn (403).
   * Không có nó thì phụ huynh đột nhiên thấy màn nhập PIN mà không hiểu vì sao.
   */
  const [gateNotice, setGateNotice] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [gateError, setGateError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [openingGate, setOpeningGate] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [pinSaved, setPinSaved] = useState(false);

  // --- Form "Quên mã PIN" (đặt lại bằng MẬT KHẨU tài khoản) -----------------
  const [password, setPassword] = useState('');
  const [resetPin, setResetPin] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  // Kiểm tra cổng của PHIÊN hiện tại một lần khi mở trang. Lỗi ⇒ mặc định ĐÓNG (xem quyết định 2).
  useEffect(() => {
    let alive = true;
    parentApi
      .gateStatus()
      .then((status) => {
        if (alive) setGate(status.opened ? 'open' : 'closed');
      })
      .catch(() => {
        if (!alive) return;
        // ⚠️ VẪN mặc định ĐÓNG (fail-secure) — nhưng NÓI RA rằng ta chưa kiểm tra được cổng.
        //    Im lặng thì người lớn thấy màn "nhập PIN" mà không hiểu vì sao mã đúng vẫn không vào.
        setGate('closed');
        setGateLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const onOpenGate = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (pin.length !== PARENT_PIN_LENGTH) return;
    setOpeningGate(true);
    setGateError(null);
    try {
      const status = await parentApi.openGate({ pin });
      setPin('');
      // Vào được cổng ⇒ câu "cần nhập mã PIN" hết việc, xoá đi kẻo nó nằm lại gây nhầm.
      setGateNotice(null);
      setGate(status.opened ? 'open' : 'closed');
      // `opened: false` là "PIN đúng nhưng cổng vẫn đóng" — không xảy ra với hợp đồng hiện tại,
      // nhưng nếu có thì phải nói ra thay vì im lặng đứng ở cổng.
      if (!status.opened) setGateError(t('parent.pinWrong'));
    } catch (err) {
      setGateError(apiErrorMessage(err, t));
    } finally {
      setOpeningGate(false);
    }
  };

  const onSavePin = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (newPin.length !== PARENT_PIN_LENGTH) return;
    setSavingPin(true);
    setPinError(null);
    setPinSaved(false);
    try {
      await parentApi.setPin({ pin: newPin });
      setNewPin('');
      setPinSaved(true);
    } catch (err) {
      setPinError(apiErrorMessage(err, t));
    } finally {
      setSavingPin(false);
    }
  };

  /**
   * ĐẶT LẠI mã PIN bằng MẬT KHẨU tài khoản (đường lùi khi quên PIN).
   *
   * ⚠️ Thành công KHÔNG mở cổng: server trả `{ ok: true }`, không trả trạng thái cổng. Bé/phụ
   *    huynh vẫn phải nhập lại mã PIN mới ở cổng. Mở cổng ở đây là tự cho qua cổng bằng một hành
   *    động khác — trái ý nghĩa của cổng.
   */
  const onResetPin = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (resetPin.length !== PARENT_PIN_LENGTH || password.length === 0) return;
    setResetting(true);
    setResetError(null);
    setResetDone(false);
    try {
      await parentApi.resetPin({ password, pin: resetPin });
      // Xoá cả hai ô sau khi gửi: không giữ mật khẩu (hay PIN) trong bộ nhớ lâu hơn cần thiết.
      setPassword('');
      setResetPin('');
      setResetDone(true);
    } catch (err) {
      setPassword('');
      /*
        ⚠️ SAI MẬT KHẨU ⇒ câu TRUNG TÍNH RIÊNG, KHÔNG dùng `apiErrorMessage`.
        `apiErrorMessage` map `INVALID_CREDENTIALS` → câu của màn ĐĂNG NHẬP
        ('Email hoặc mật khẩu không đúng') — sai cả nội dung (ở đây không có ô email) lẫn giọng.
        Và đây là lý do KHÔNG sửa map toàn cục: câu đó là ĐÚNG cho đăng nhập; đổi nó sẽ làm hỏng
        màn đăng nhập. Nên xử lý tại chỗ, đúng chỗ có ngữ cảnh.
      */
      if (isApiClientError(err) && err.code === 'INVALID_CREDENTIALS') {
        setResetError(t('parent.passwordWrong'));
      } else {
        setResetError(apiErrorMessage(err, t));
      }
    } finally {
      setResetting(false);
    }
  };

  /**
   * Cổng đã ĐÓNG phía server (403 `PARENT_GATE_REQUIRED` khi báo cáo 403, hoặc 401) ⇒ quay về màn
   * nhập PIN và coi cổng là đóng tại client.
   *
   * ⚠️ `useCallback` là BẮT BUỘC, không phải cho đẹp: `ParentReport` nhận hàm này và đưa vào deps
   *    của hiệu ứng nạp. Một hàm mới mỗi lần render ⇒ hiệu ứng chạy lại ⇒ gọi mạng vô hạn.
   */
  const handleGateClosed = useCallback(() => {
    setGate('closed');
    setView('gate');
    setGateError(null);
    // Nói RA lý do: cổng chỉ mở 10 phút rồi tự đóng, nên bị đẩy về đây là chuyện thường.
    setGateNotice(t('parent.gateRequiredHint'));
  }, [t]);

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col gap-6 pt-4">
      <h1 className="text-center text-kid-lg text-ink">{t('parent.gate')}</h1>

      {gate === 'loading' && (
        <p className="text-center text-kid-sm text-ink-soft">{t('app.loading')}</p>
      )}

      {/* --- Cổng đóng: nhập PIN ------------------------------------------- */}
      {gate === 'closed' && view === 'gate' && (
        <form
          className="flex flex-col gap-4 rounded-kid border-2 border-line bg-surface-raised p-6"
          onSubmit={(e) => void onOpenGate(e)}
          noValidate
        >
          {/*
            ⚠️ Chưa KIỂM TRA được cổng (mất mạng) ⇒ nói ra, nhưng VẪN ở trạng thái ĐÓNG.
            Không rò rỉ gì về việc tài khoản có PIN hay chưa — đây chỉ là trạng thái của LẦN ĐỌC.
          */}
          {gateLoadFailed && (
            <p className="text-center text-kid-sm text-ink-soft" role="status">
              {t('parent.gateLoadFailed')}
            </p>
          )}

          {gateNotice !== null && (
            <p className="text-center text-kid-sm font-bold text-ink-soft" role="status">
              {gateNotice}
            </p>
          )}

          <label className="flex flex-col gap-2">
            {/* Độ dài nội suy từ HẰNG SỐ dùng chung — không ghim cứng số vào câu. */}
            <span className="text-center text-kid-sm text-ink-soft">
              {t('parent.gateHint', { count: PARENT_PIN_LENGTH })}
            </span>
            <PinField
              label={t('parent.enterPin')}
              value={pin}
              onChange={setPin}
              disabled={openingGate}
              autoFocus
            />
          </label>

          {gateError && (
            <p className="text-center text-kid-sm text-danger" role="alert">
              {gateError}
            </p>
          )}

          {/* `size="lg"` (88px): đây là nút CHÍNH của màn hình — xem `tokens.css`. */}
          <BigButton
            type="submit"
            size="lg"
            loading={openingGate}
            disabled={pin.length !== PARENT_PIN_LENGTH}
          >
            {t('parent.openGate')}
          </BigButton>

          {/*
            Đường LÙI khi quên PIN. `type="button"` để KHÔNG gửi form nhập PIN.
            `min-h-touch` (64px): vùng chạm tối thiểu, dù đây là liên kết chữ chứ không phải nút lớn.
          */}
          <button
            type="button"
            onClick={() => {
              setView('forgot');
              setGateError(null);
              setGateNotice(null);
            }}
            className="min-h-touch rounded-kid px-4 text-center text-kid-sm font-bold text-brand underline"
          >
            {t('parent.forgotPin')}
          </button>
        </form>
      )}

      {/* --- Cổng đóng: QUÊN mã PIN ⇒ đặt lại bằng MẬT KHẨU tài khoản -------- */}
      {gate === 'closed' && view === 'forgot' && (
        <form
          className="flex flex-col gap-4 rounded-kid border-2 border-line bg-surface-raised p-6"
          onSubmit={(e) => void onResetPin(e)}
          noValidate
        >
          <h2 className="text-center text-kid-md text-ink">{t('parent.forgotPinTitle')}</h2>
          <p className="text-center text-kid-sm text-ink-soft">{t('parent.forgotPinHint')}</p>

          <label className="flex flex-col gap-2">
            <span className="text-center text-kid-sm text-ink-soft">{t('parent.accountPassword')}</span>
            {/* Mật khẩu: `type="password"` + `autoComplete="off"` — cùng lý do như mã PIN. */}
            <input
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={resetting}
              aria-label={t('parent.accountPassword')}
              className="min-h-touch w-full rounded-kid border-2 border-line bg-surface px-4 py-3 text-center text-kid-lg text-ink"
            />
          </label>

          <label className="flex flex-col gap-2">
            {/* ⚠️ Độ dài nội suy từ HẰNG SỐ — cùng luật như câu hướng dẫn ở cổng. */}
            <span className="text-center text-kid-sm text-ink-soft">
              {t('parent.newPinLabel', { count: PARENT_PIN_LENGTH })}
            </span>
            <PinField
              label={t('parent.newPin')}
              value={resetPin}
              onChange={setResetPin}
              disabled={resetting}
            />
          </label>

          {resetError && (
            <p className="text-center text-kid-sm text-danger" role="alert">
              {resetError}
            </p>
          )}
          {resetDone && (
            <p className="text-center text-kid-sm text-success" role="status">
              {t('parent.pinResetDone')}
            </p>
          )}

          <BigButton
            type="submit"
            size="lg"
            loading={resetting}
            disabled={resetPin.length !== PARENT_PIN_LENGTH || password.length === 0}
          >
            {t('parent.resetPinSubmit')}
          </BigButton>

          <button
            type="button"
            onClick={() => {
              setView('gate');
              setResetError(null);
              setResetDone(false);
              setPassword('');
              setResetPin('');
            }}
            className="min-h-touch rounded-kid px-4 text-center text-kid-sm font-bold text-brand underline"
          >
            {t('parent.backToGate')}
          </button>
        </form>
      )}

      {/* --- Cổng đã mở: BÁO CÁO TUẦN (T073) ------------------------------- */}
      {gate === 'open' && view === 'report' && childId !== null && (
        <>
          <ParentReport childId={childId} onGateClosed={handleGateClosed} />
          <BigButton variant="secondary" icon="↩️" onClick={() => setView('gate')}>
            {t('parent.backToParentArea')}
          </BigButton>
        </>
      )}

      {/* --- Cổng đã mở: CÀI ĐẶT (T074 + phần client #28) -------------------- */}
      {gate === 'open' && view === 'settings' && (
        <>
          <ParentSettingsPage onGateClosed={handleGateClosed} />
          <BigButton variant="secondary" icon="↩️" onClick={() => setView('gate')}>
            {t('parent.backToParentArea')}
          </BigButton>
        </>
      )}

      {/* --- Cổng đã mở: khu vực phụ huynh (đặt PIN + lối vào báo cáo/cài đặt) */}
      {gate === 'open' && view !== 'report' && view !== 'settings' && (
        <>
          <section className="rounded-kid border-2 border-line bg-surface-raised p-6 text-center">
            <p className="text-kid-md text-ink">✅ {t('parent.openTitle')}</p>
            <p className="mt-2 text-kid-sm text-ink-soft">{t('parent.openHint')}</p>
          </section>

          {/*
            Lối vào BÁO CÁO TUẦN và CÀI ĐẶT. Cả hai là VIEW trong `/parent` (không phải route
            riêng) nên cổng đóng là không chạm tới được — đúng luật "cổng chắn mọi thứ sau nó".
          */}
          <BigButton icon="📊" onClick={() => setView('report')}>
            {t('parent.openReport')}
          </BigButton>
          <BigButton icon="⚙️" onClick={() => setView('settings')}>
            {t('parent.openSettings')}
          </BigButton>

          <form
            className="flex flex-col gap-4 rounded-kid border-2 border-line bg-surface-raised p-6"
            onSubmit={(e) => void onSavePin(e)}
            noValidate
          >
            <h2 className="text-center text-kid-md text-ink">{t('parent.setPin')}</h2>
            <p className="text-center text-kid-sm text-ink-soft">
              {t('parent.setPinHint', { count: PARENT_PIN_LENGTH })}
            </p>

            <PinField
              label={t('parent.setPin')}
              value={newPin}
              onChange={setNewPin}
              disabled={savingPin}
            />

            {pinError && (
              <p className="text-center text-kid-sm text-danger" role="alert">
                {pinError}
              </p>
            )}
            {pinSaved && (
              <p className="text-center text-kid-sm text-success" role="status">
                {t('parent.pinSaved')}
              </p>
            )}

            <BigButton
              type="submit"
              variant="secondary"
              size="lg"
              loading={savingPin}
              disabled={newPin.length !== PARENT_PIN_LENGTH}
            >
              {t('app.save')}
            </BigButton>
          </form>
        </>
      )}

      <Link to="/" className="w-full">
        <BigButton variant="ghost" icon="🗺️">
          {t('nav.backToLearn')}
        </BigButton>
      </Link>
    </div>
  );
}
