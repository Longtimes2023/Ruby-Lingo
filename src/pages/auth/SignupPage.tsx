/**
 * RubyLingo — Trang đăng ký (`/signup`).
 *
 * ⭐ HAI BƯỚC, KHÔNG PHẢI MỘT — và đây là quyết định thiết kế, không phải chi tiết trình bày:
 *
 *   Server chỉ trả `recoveryCode` ĐÚNG MỘT LẦN trong response đăng ký (DB chỉ giữ SHA-256,
 *   không thể hiện lại). Nếu đăng ký xong là tự động chuyển sang màn hình tạo hồ sơ bé thì
 *   mã đó trôi qua trước mắt phụ huynh trong tích tắc và biến mất — họ mất đường lùi duy
 *   nhất khi quên mật khẩu, và KHÔNG CÓ CÁCH NÀO lấy lại.
 *
 *   Vì vậy bước 2 chặn lại cho tới khi phụ huynh bấm "Tôi đã lưu rồi". Đây là trường hợp
 *   hiếm hoi mà việc bắt người dùng dừng lại là hành vi tử tế.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { signupSchema, type SignupInput } from '@shared/schemas/auth.js';
import type { SignupResponse } from '@shared/types/api.js';
import { apiErrorMessage, apiFieldErrors } from '../../api/errorMessage.js';
import { useSignUp } from '../../hooks/useSession.js';
import { useSessionStore } from '../../store/sessionStore.js';
import { AuthCard, FormAlert, RecoveryCodePanel, SubmitButton, TextField } from './AuthLayout.js';

export function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const signUp = useSignUp();
  const applySession = useSessionStore((s) => s.applySession);

  /**
   * Kết quả đăng ký, GIỮ LẠI cho tới khi phụ huynh xác nhận đã lưu mã khôi phục.
   *
   * ⚠️ VÌ SAO KHÔNG NẠP PHIÊN NGAY (xem ghi chú dài ở `useSignUp`):
   *   `applySession` ngay sau khi đăng ký sẽ làm `status` thành `authenticated`, và
   *   `RedirectIfAuthenticated` đang bọc route này sẽ chuyển trang NGAY — màn hình mã khôi
   *   phục bị đá đi trước khi phụ huynh đọc được. Mã chỉ hiện một lần ⇒ mất là mất vĩnh viễn.
   */
  const [created, setCreated] = useState<SignupResponse | null>(null);

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', displayName: '', parentalConsent: false },
  });

  const fieldErrors = apiFieldErrors(signUp.error);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      setCreated(await signUp.mutateAsync(values));
    } catch {
      // Lỗi đã nằm trong `signUp.error`.
    }
  });

  // --- Bước 2: hiện mã khôi phục, chặn cho tới khi phụ huynh xác nhận đã lưu ---
  if (created) {
    return (
      <AuthCard title={t('auth.recoveryCodeTitle')}>
        <RecoveryCodePanel
          code={created.recoveryCode}
          continueLabel={t('auth.savedIt')}
          onContinue={() => {
            // Giờ mới nạp phiên: phụ huynh đã có mã trong tay.
            applySession({ parent: created.parent, children: created.children });
            navigate('/children/new', { replace: true });
          }}
        />
      </AuthCard>
    );
  }

  // --- Bước 1: nhập thông tin ---
  return (
    <AuthCard title={t('auth.signup')} subtitle="Tài khoản này là của bố mẹ, dùng để quản lý hồ sơ của các bé.">
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        {signUp.isError && <FormAlert>{apiErrorMessage(signUp.error, t)}</FormAlert>}

        <TextField
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          autoFocus
          error={form.formState.errors.email?.message ?? fieldErrors?.['email']}
          {...form.register('email')}
        />

        <TextField
          label={t('auth.password')}
          type="password"
          autoComplete="new-password"
          hint="Ít nhất 8 ký tự"
          error={form.formState.errors.password?.message ?? fieldErrors?.['password']}
          {...form.register('password')}
        />

        <TextField
          label={t('auth.displayName')}
          autoComplete="nickname"
          error={form.formState.errors.displayName?.message ?? fieldErrors?.['displayName']}
          {...form.register('displayName')}
        />

        {/* --- Đồng ý của phụ huynh: BẮT BUỘC, và được GHI NHẬN ở server (COPPA/GDPR-K) --- */}
        <div className="flex flex-col gap-1">
          <label className="flex items-start gap-3 rounded-kid bg-surface-raised p-3">
            <input
              type="checkbox"
              className="mt-1 h-6 w-6 shrink-0 accent-[var(--c-brand)]"
              aria-invalid={form.formState.errors.parentalConsent ? true : undefined}
              {...form.register('parentalConsent')}
            />
            <span className="text-kid-xs text-ink-soft">{t('auth.parentalConsent')}</span>
          </label>
          {form.formState.errors.parentalConsent && (
            <p className="text-kid-xs font-bold text-danger" role="alert">
              {form.formState.errors.parentalConsent.message}
            </p>
          )}
        </div>

        <SubmitButton pending={signUp.isPending}>{t('auth.signup')}</SubmitButton>

        <p className="text-center text-kid-xs text-ink-soft">
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-bold text-brand underline">
            {t('auth.login')}
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
