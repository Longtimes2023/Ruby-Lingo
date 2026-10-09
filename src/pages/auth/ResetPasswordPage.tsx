/**
 * RubyLingo — Trang đặt lại mật khẩu (`/reset`), dùng mã khôi phục.
 *
 * ⚠️ ĐÂY LÀ TRANG BỔ SUNG SO VỚI KẾ HOẠCH T026 (kế hoạch chỉ liệt kê Login/Signup/ChildProfile).
 *    Lý do thêm: mã khôi phục được phát ở bước đăng ký với lời hứa "nếu quên mật khẩu, cần mã
 *    này để đặt lại". Không có trang này thì lời hứa đó không có cách nào thực hiện — phụ huynh
 *    giữ một mã mà không dùng được vào việc gì.
 *
 * ⭐ SAU KHI ĐẶT LẠI, PHẢI ĐĂNG NHẬP LẠI — và đây là chủ đích của server:
 *    `AuthService.resetPassword` xoá MỌI phiên, vì tình huống đặt lại mật khẩu thường là
 *    "tài khoản có thể đã bị người khác vào". Giữ phiên cũ sống sót thì việc đặt lại mật khẩu
 *    không có tác dụng gì. Trang này vì vậy đưa phụ huynh về trang đăng nhập, KHÔNG cố vào
 *    thẳng ứng dụng.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { resetPasswordSchema, type ResetPasswordInput } from '@shared/schemas/auth.js';
import { apiErrorMessage, apiFieldErrors } from '../../api/errorMessage.js';
import { useRequestPasswordReset } from '../../hooks/useSession.js';
import { AuthCard, FormAlert, RecoveryCodePanel, SubmitButton, TextField } from './AuthLayout.js';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reset = useRequestPasswordReset();

  /** Mã khôi phục MỚI do server phát. `null` = còn ở bước nhập liệu. */
  const [newRecoveryCode, setNewRecoveryCode] = useState<string | null>(null);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: '', recoveryCode: '', newPassword: '' },
  });

  const fieldErrors = apiFieldErrors(reset.error);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await reset.mutateAsync(values);
      setNewRecoveryCode(result.recoveryCode);
    } catch {
      // Lỗi đã nằm trong `reset.error`. Server trả CÙNG một lỗi cho "email sai", "mã sai" và
      // "mã đã dùng" nên không thể — và không nên — hiển thị câu cụ thể hơn.
    }
  });

  if (newRecoveryCode) {
    return (
      <AuthCard
        title="Mật khẩu đã được đặt lại"
        subtitle="Mã khôi phục cũ đã dùng xong. Đây là mã MỚI của bố mẹ."
      >
        <RecoveryCodePanel
          code={newRecoveryCode}
          continueLabel="Đăng nhập bằng mật khẩu mới"
          onContinue={() => navigate('/login', { replace: true })}
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t('auth.useRecoveryCode')}
      subtitle="Nhập email và mã khôi phục bố mẹ đã lưu khi tạo tài khoản."
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        {reset.isError && <FormAlert>{apiErrorMessage(reset.error, t)}</FormAlert>}

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
          label={t('auth.recoveryCode')}
          // Gõ lại từ ảnh chụp nên thường lẫn chữ thường và dấu cách — server chuẩn hoá
          // (`normalizeRecoveryCode`), nên ở đây KHÔNG cần ép định dạng.
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
          error={form.formState.errors.recoveryCode?.message ?? fieldErrors?.['recoveryCode']}
          {...form.register('recoveryCode')}
        />

        <TextField
          label={t('auth.newPassword')}
          type="password"
          autoComplete="new-password"
          hint="Ít nhất 8 ký tự"
          error={form.formState.errors.newPassword?.message ?? fieldErrors?.['newPassword']}
          {...form.register('newPassword')}
        />

        <SubmitButton pending={reset.isPending}>Đặt lại mật khẩu</SubmitButton>

        <p className="text-center text-kid-xs text-ink-soft">
          <Link to="/login" className="font-bold text-brand underline">
            {t('auth.login')}
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
