/**
 * RubyLingo — Trang đăng nhập (`/login`).
 *
 * Kiểm dữ liệu bằng `loginSchema` DÙNG CHUNG với server, nên thông báo lỗi hiện ngay dưới ô
 * nhập và giống hệt câu server sẽ trả về — phụ huynh không gặp cảnh "form cho qua rồi server
 * từ chối" mà không hiểu vì sao.
 *
 * ⚠️ Server CỐ TÌNH trả cùng một lỗi cho "email không tồn tại" và "mật khẩu sai"
 *    (`INVALID_CREDENTIALS`) để không ai dò được email nào có trong hệ thống. Trang này chỉ
 *    hiển thị đúng câu đó, KHÔNG cố đoán thêm — đoán thêm là phá chính cơ chế bảo vệ đó.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { loginSchema, type LoginInput } from '@shared/schemas/auth.js';
import { apiErrorMessage, apiFieldErrors } from '../../api/errorMessage.js';
import { useSignIn } from '../../hooks/useSession.js';
import { AuthCard, FormAlert, SubmitButton, TextField } from './AuthLayout.js';

/** Nơi cần quay lại sau khi đăng nhập (do `RequireParent` ghi vào `state`). */
function useRedirectTarget(): string | null {
  const location = useLocation();
  const state = location.state as { from?: unknown } | null;
  return typeof state?.from === 'string' ? state.from : null;
}

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const redirectTo = useRedirectTarget();
  const signIn = useSignIn();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const fieldErrors = apiFieldErrors(signIn.error);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const session = await signIn.mutateAsync(values);
      const fallback = session.children.length > 0 ? '/' : '/children/new';
      navigate(redirectTo ?? fallback, { replace: true });
    } catch {
      // Lỗi đã nằm trong `signIn.error` và được hiển thị bên dưới. Bắt ở đây chỉ để tránh
      // một promise bị từ chối mà không ai xử lý.
    }
  });

  return (
    <AuthCard title={t('auth.login')} subtitle="Bố mẹ đăng nhập để mở Nhà Vườn Thú của bé.">
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        {signIn.isError && <FormAlert>{apiErrorMessage(signIn.error, t)}</FormAlert>}

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
          autoComplete="current-password"
          error={form.formState.errors.password?.message ?? fieldErrors?.['password']}
          {...form.register('password')}
        />

        <SubmitButton pending={signIn.isPending}>{t('auth.login')}</SubmitButton>

        <div className="flex flex-col items-center gap-2 text-kid-xs">
          <Link to="/reset" className="font-bold text-brand underline">
            {t('auth.forgotPassword')}
          </Link>
          <p className="text-ink-soft">
            Chưa có tài khoản?{' '}
            <Link to="/signup" className="font-bold text-brand underline">
              {t('auth.signup')}
            </Link>
          </p>
        </div>
      </form>
    </AuthCard>
  );
}
