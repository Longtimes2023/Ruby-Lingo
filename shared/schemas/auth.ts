/**
 * RubyLingo — Zod schema cho xác thực & hồ sơ bé.
 *
 * Dùng CHUNG client và server:
 *   • client: react-hook-form + `zodResolver` ⇒ thông báo lỗi hiện ngay dưới ô nhập,
 *     bằng tiếng Việt, TRƯỚC khi gửi request.
 *   • server: kiểm lại lần nữa ở tầng route.
 *
 * ⚠️ VÌ SAO PHẢI KIỂM Ở CẢ HAI NƠI: kiểm ở client chỉ là trải nghiệm người dùng. Kẻ tấn
 * công gọi thẳng API bằng curl, bỏ qua toàn bộ form. Server PHẢI tự kiểm.
 *
 * ⚠️ VÌ SAO DÙNG CÙNG MỘT SCHEMA: nếu client và server viết luật riêng thì sớm muộn lệch
 * nhau — client cho qua, server từ chối, và phụ huynh nhận lỗi 400 không rõ nguyên nhân.
 */

import { z } from 'zod';

import {
  CHILD_AGE_MAX,
  CHILD_AGE_MIN,
  CHILD_NICKNAME_MAX,
  CHILD_NICKNAME_MIN,
  PARENT_DISPLAY_NAME_MAX,
  PARENT_PIN_LENGTH,
  PRIVACY_POLICY_VERSION,
} from '../constants.js';

// =============================================================================
// Trường dùng lại
// =============================================================================

/**
 * Email: cắt khoảng trắng hai đầu rồi đưa về chữ thường.
 *
 * `.transform()` nằm trong schema nên giá trị ĐÃ CHUẨN HOÁ được truyền xuống service —
 * không phải nhớ chuẩn hoá ở từng chỗ dùng. Nếu chỉ kiểm `.email()` mà không chuẩn hoá thì
 * "Bo@Gmail.com " và "bo@gmail.com" sẽ thành hai tài khoản khác nhau.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Bố mẹ nhập email giúp bé nhé')
  .max(254, 'Email quá dài')
  .email('Email chưa đúng định dạng');

/**
 * Mật khẩu: KHÔNG cắt khoảng trắng, KHÔNG đưa về chữ thường.
 *
 * Khoảng trắng ở đầu/cuối là ký tự hợp lệ trong mật khẩu. Cắt nó đi sẽ khiến mật khẩu
 * người dùng đặt và mật khẩu hệ thống băm khác nhau ⇒ đăng nhập sai dù gõ đúng.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu cần dài ít nhất 8 ký tự')
  .max(128, 'Mật khẩu không được dài quá 128 ký tự');

/** Biệt danh của bé — chỉ cần biệt danh, KHÔNG cần tên thật (COPPA/GDPR-K). */
export const nicknameSchema = z
  .string()
  .trim()
  .min(CHILD_NICKNAME_MIN, 'Bố mẹ đặt biệt danh cho bé nhé')
  .max(CHILD_NICKNAME_MAX, `Biệt danh không dài quá ${CHILD_NICKNAME_MAX} ký tự`);

/** Tuổi của bé — PHẢI khớp `CHECK (age >= 5 AND age <= 12)` trong migration 002. */
export const childAgeSchema = z
  .number({ invalid_type_error: 'Bố mẹ chọn tuổi của bé nhé' })
  .int('Tuổi phải là số nguyên')
  .min(CHILD_AGE_MIN, `RubyLingo dành cho bé từ ${CHILD_AGE_MIN} tuổi`)
  .max(CHILD_AGE_MAX, `RubyLingo dành cho bé tới ${CHILD_AGE_MAX} tuổi`);

/** id avatar chọn sẵn. Việc kiểm "có tồn tại trong avatars.json không" do service làm. */
export const avatarIdSchema = z.string().trim().min(1, 'Bố mẹ chọn một bạn đồng hành cho bé nhé');

// =============================================================================
// Đăng ký
// =============================================================================

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().max(PARENT_DISPLAY_NAME_MAX).optional(),
  /**
   * BẮT BUỘC phải là `true` — không thể bỏ qua bằng cách không gửi trường.
   *
   * COPPA/GDPR-K yêu cầu có sự đồng ý CÓ GHI NHẬN của phụ huynh trước khi thu thập bất kỳ
   * dữ liệu nào của trẻ. Thiếu trường ⇒ lỗi (`boolean()` không chấp nhận `undefined`),
   * gửi `false` ⇒ lỗi (`refine`). Cả hai đường đều bị chặn.
   *
   * ⚙️ VÌ SAO DÙNG `z.boolean().refine()` CHỨ KHÔNG DÙNG `z.literal(true)`:
   *   `z.literal(true)` cho kiểu đầu vào là ĐÚNG `true`, nên một ô tick trong form (vốn sinh
   *   ra `boolean`) không gán được vào đó — buộc phải ép kiểu, và ép kiểu ở đúng chỗ kiểm
   *   tra an toàn là điều tệ nhất có thể làm. `refine` giữ nguyên mức bảo đảm (false và thiếu
   *   đều bị từ chối) mà kiểu vẫn là `boolean`, dùng thẳng được với form.
   */
  parentalConsent: z.boolean().refine((v) => v === true, {
    message: 'Bố mẹ cần đồng ý cho con sử dụng RubyLingo',
  }),
});

export type SignupInput = z.infer<typeof signupSchema>;

// =============================================================================
// Đăng nhập
// =============================================================================

/**
 * Đăng nhập: kiểm RẤT LỎNG ở tầng schema.
 *
 * Vì sao không dùng `passwordSchema` (min 8) ở đây: nếu mật khẩu cũ của ai đó ngắn hơn 8 ký
 * tự (đặt trước khi siết chính sách), schema sẽ từ chối với lỗi "cần ít nhất 8 ký tự" —
 * vừa lộ thông tin về chính sách, vừa khiến người dùng tưởng mật khẩu của mình sai định
 * dạng. Đăng nhập chỉ cần: có gửi lên, và không rỗng.
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Bố mẹ nhập mật khẩu nhé'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// =============================================================================
// Đặt lại mật khẩu bằng mã khôi phục
// =============================================================================

export const resetPasswordSchema = z.object({
  email: emailSchema,
  /**
   * Trần 64 ký tự. Mã thật dài 23 ký tự (`XXXXX-XXXXX-XXXXX-XXXXX`) nên 64 là quá rộng rãi.
   *
   * ⚠️ Trần này KHÔNG chỉ để gọn: `verifyPassword` bỏ qua luôn phép băm khi đầu vào vượt
   * 128 ký tự (để chống DoS). Nếu mã khôi phục không bị chặn độ dài, một chuỗi 200 ký tự sẽ
   * làm `verifyAgainstDummy` trả về NGAY ⇒ nhánh đó nhanh hơn hẳn ⇒ phá cơ chế chống rò rỉ
   * thông tin qua thời gian ở `AuthService.resetPassword`.
   */
  recoveryCode: z.string().trim().min(1, 'Bố mẹ nhập mã khôi phục nhé').max(64, 'Mã khôi phục không hợp lệ'),
  newPassword: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// =============================================================================
// Đổi mật khẩu (đã đăng nhập)
// =============================================================================

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Bố mẹ nhập mật khẩu hiện tại nhé'),
  newPassword: passwordSchema,
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// =============================================================================
// Hồ sơ bé
// =============================================================================

export const createChildSchema = z.object({
  nickname: nicknameSchema,
  age: childAgeSchema,
  avatarId: avatarIdSchema,
});

export type CreateChildInput = z.infer<typeof createChildSchema>;

/**
 * Cập nhật hồ sơ bé: mọi trường tuỳ chọn, nhưng object rỗng bị từ chối.
 *
 * Vì sao chặn object rỗng: `PATCH` không có gì để sửa thường là lỗi lập trình ở client
 * (gửi nhầm state chưa khởi tạo). Báo lỗi rõ ràng tốt hơn là trả 200 rồi không làm gì —
 * kiểu "thành công giả" khiến người ta mất hàng giờ để tìm nguyên nhân.
 */
export const updateChildSchema = z
  .object({
    nickname: nicknameSchema.optional(),
    age: childAgeSchema.optional(),
    avatarId: avatarIdSchema.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Không có thay đổi nào để lưu',
  });

export type UpdateChildInput = z.infer<typeof updateChildSchema>;

// =============================================================================
// PIN phụ huynh
// =============================================================================

/**
 * Một mã PIN phụ huynh hợp lệ — đúng `PARENT_PIN_LENGTH` chữ số.
 *
 * ⭐ TÁCH RA MỘT CHỖ vì nay có HAI route dùng cùng luật này (đặt PIN, và đặt LẠI PIN khi quên —
 *   T072.1). Hai bản `.regex()` chép tay sẽ lệch nhau ngay lần đầu ai đó đổi độ dài PIN.
 */
export const parentPinSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${PARENT_PIN_LENGTH}}$`), `Mã PIN gồm đúng ${PARENT_PIN_LENGTH} chữ số`);

export const setPinSchema = z.object({
  pin: parentPinSchema,
});

export type SetPinInput = z.infer<typeof setPinSchema>;

/**
 * ĐẶT LẠI PIN khi phụ huynh QUÊN — phải kèm MẬT KHẨU tài khoản (T072.1).
 *
 * ⭐ VÌ SAO CẦN MẬT KHẨU Ở ĐÂY: cổng PIN chắn cả việc ĐỔI PIN (xem `requireParentGate`), nên
 *   phụ huynh quên PIN sẽ bị kẹt vĩnh viễn — đăng nhập lại bằng mật khẩu cũng vẫn bị cổng chắn.
 *   Mật khẩu tài khoản là RANH GIỚI THẬT (PIN chỉ là rào UX — xem `migrations/001_account.sql`),
 *   nên nó là thứ đúng để mở đường lùi mà không hạ thấp bảo mật.
 *
 * ⚠️ `password` KIỂM LỎNG như `loginSchema` (chỉ cần KHÔNG RỖNG), KHÔNG dùng `passwordSchema`
 *   (min 8): nếu dùng, một tài khoản có mật khẩu cũ ngắn hơn 8 sẽ bị từ chối với câu "cần ít nhất
 *   8 ký tự" — vừa LỘ CHÍNH SÁCH mật khẩu, vừa khiến phụ huynh tưởng mật khẩu của mình sai định
 *   dạng. Kiểm "đúng hay sai" là việc của `verifyPassword`, không phải của schema.
 */
export const resetPinSchema = z.object({
  password: z.string().min(1, 'Bố mẹ nhập mật khẩu nhé'),
  pin: parentPinSchema,
});

export type ResetPinInput = z.infer<typeof resetPinSchema>;

// =============================================================================
// Hằng số xuất lại cho client
// =============================================================================

export { PRIVACY_POLICY_VERSION };
