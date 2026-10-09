/**
 * RubyLingo — Trang tạo hồ sơ bé (`/children/new`).
 *
 * ⭐ MỘT MÀN HÌNH, KHÔNG CHIA BƯỚC:
 *   Kế hoạch cho phép "≤4 bước", nhưng ở đây chỉ có 3 thông tin và chúng liên quan trực tiếp
 *   tới nhau (biệt danh → tuổi → bạn đồng hành). Chia thành nhiều bước chỉ làm phụ huynh phải
 *   bấm thêm 3 lần mà không được lợi gì. Phần chọn avatar để NỔI BẬT vì đó là lúc bé hào hứng
 *   nhất — và là thứ duy nhất bé thật sự quan tâm ở màn hình này.
 *
 * ⚠️ CHỈ THU BIỆT DANH, KHÔNG THU TÊN THẬT / NGÀY SINH / ẢNH (COPPA/GDPR-K).
 *    Tuổi lưu dạng số nguyên (5–12), không lưu ngày sinh. Avatar chọn từ bộ dựng sẵn, không
 *    có đường tải ảnh lên. Câu nhắc này hiện ngay trên màn hình để phụ huynh yên tâm.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { createChildSchema, type CreateChildInput } from '@shared/schemas/auth.js';
import { CHILD_AGE_MAX, CHILD_AGE_MIN } from '@shared/constants.js';
import { apiErrorMessage, apiFieldErrors } from '../../api/errorMessage.js';
import { AVATARS, DEFAULT_AVATAR_ID, getAvatar } from '../../data/avatars.js';
import { useCreateChild } from '../../hooks/useSession.js';
import { useSessionStore } from '../../store/sessionStore.js';
import { AuthCard, FormAlert, SubmitButton, TextField } from './AuthLayout.js';

/** Danh sách tuổi cho bé chọn — nút to, dễ chạm hơn nhiều so với ô nhập số. */
const AGES: number[] = Array.from(
  { length: CHILD_AGE_MAX - CHILD_AGE_MIN + 1 },
  (_, i) => CHILD_AGE_MIN + i,
);

export function ChildProfileSetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createChild = useCreateChild();

  const existingCount = useSessionStore((s) => s.children.length);
  const isFirstChild = existingCount === 0;

  const form = useForm<CreateChildInput>({
    resolver: zodResolver(createChildSchema),
    defaultValues: { nickname: '', age: 7, avatarId: DEFAULT_AVATAR_ID },
  });

  const selectedAvatarId = form.watch('avatarId');
  const selectedAge = form.watch('age');
  const fieldErrors = apiFieldErrors(createChild.error);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createChild.mutateAsync(values);
      // Bé đầu tiên đã được `addChild` tự chọn làm bé đang hoạt động ⇒ vào thẳng trang chủ.
      navigate('/', { replace: true });
    } catch {
      // Lỗi đã nằm trong `createChild.error`.
    }
  });

  return (
    <AuthCard
      title={isFirstChild ? t('child.setup') : t('child.addChild')}
      subtitle={t('child.privacyNote')}
    >
      <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
        {createChild.isError && <FormAlert>{apiErrorMessage(createChild.error, t)}</FormAlert>}

        <TextField
          label={t('child.nickname')}
          hint={t('child.nicknameHint')}
          autoComplete="off"
          autoFocus
          maxLength={20}
          error={form.formState.errors.nickname?.message ?? fieldErrors?.['nickname']}
          {...form.register('nickname')}
        />

        {/* --- Tuổi: nút to thay vì ô nhập số (bé tay còn nhỏ, gõ số hay sai) --- */}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-kid-xs font-bold text-ink-soft">{t('child.age')}</legend>
          <div className="flex flex-wrap gap-2">
            {AGES.map((age) => {
              const active = selectedAge === age;
              return (
                <button
                  key={age}
                  type="button"
                  // `aria-pressed` cho trình đọc màn hình biết nút nào đang được chọn — nếu
                  // chỉ đổi màu thì thông tin đó hoàn toàn biến mất với người khiếm thị.
                  aria-pressed={active}
                  onClick={() => form.setValue('age', age, { shouldValidate: true })}
                  className={[
                    'min-h-touch min-w-touch rounded-kid border-2 text-kid-md font-bold',
                    'transition-colors duration-kid',
                    active
                      ? 'border-brand bg-brand text-ink-inverse'
                      : 'border-line bg-surface-raised text-ink',
                  ].join(' ')}
                >
                  {age}
                </button>
              );
            })}
          </div>
          {form.formState.errors.age && (
            <p role="alert" className="text-kid-xs font-bold text-danger">
              {form.formState.errors.age.message}
            </p>
          )}
        </fieldset>

        {/* --- Chọn bạn đồng hành: phần bé thích nhất, nên để to và rõ --- */}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-kid-xs font-bold text-ink-soft">{t('child.avatar')}</legend>
          <div className="grid grid-cols-4 gap-2">
            {AVATARS.map((avatar) => {
              const active = selectedAvatarId === avatar.id;
              return (
                <button
                  key={avatar.id}
                  type="button"
                  aria-pressed={active}
                  aria-label={avatar.name_vi}
                  onClick={() => form.setValue('avatarId', avatar.id, { shouldValidate: true })}
                  className={[
                    'flex flex-col items-center gap-1 rounded-kid border-2 p-2',
                    'transition-colors duration-kid',
                    active ? 'border-brand bg-brand-soft' : 'border-line bg-surface-raised',
                  ].join(' ')}
                >
                  {/* Emoji thay ảnh: không tốn request tải, và không có ảnh thật của bé. */}
                  <span className="text-[34px] leading-none" aria-hidden="true">
                    {avatar.icon}
                  </span>
                  <span className="text-[13px] leading-tight text-ink-soft">{avatar.name_vi}</span>
                </button>
              );
            })}
          </div>
          <p className="text-kid-xs text-ink-faint" aria-live="polite">
            Đã chọn: {getAvatar(selectedAvatarId)?.name_vi ?? '—'}
          </p>
        </fieldset>

        <SubmitButton pending={createChild.isPending}>
          {isFirstChild ? 'Vào Nhà Vườn Thú!' : 'Lưu bé mới'}
        </SubmitButton>

        {!isFirstChild && (
          <p className="text-center text-kid-xs text-ink-soft">
            <Link to="/" className="font-bold text-brand underline">
              Quay lại
            </Link>
          </p>
        )}
      </form>
    </AuthCard>
  );
}
