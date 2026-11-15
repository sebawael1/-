import type { RegistrationFormInput, ValidationErrors } from "../types/supabase.js";

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function validateRegistrationInput(input: Partial<RegistrationFormInput>): {
  isValid: boolean;
  sanitized: RegistrationFormInput;
  errors: ValidationErrors;
} {
  const full_name = (input.full_name ?? "").trim().replace(/\s+/g, " ");
  const email = (input.email ?? "").trim().toLowerCase();
  const technical_skill = (input.technical_skill ?? "").trim();

  const errors: ValidationErrors = {};

  if (!full_name) {
    errors.full_name = "يرجى إدخال الاسم الكامل.";
  } else if (full_name.length < 3) {
    errors.full_name = "يجب أن يتكون الاسم الكامل من 3 أحرف على الأقل.";
  } else if (full_name.length > 100) {
    errors.full_name = "الاسم الكامل طويل جدًا (الحد الأقصى 100 حرف).";
  }

  if (!email) {
    errors.email = "يرجى إدخال البريد الإلكتروني.";
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = "يرجى إدخال بريد إلكتروني صحيح (مثال: name@example.com).";
  }

  if (!technical_skill) {
    errors.technical_skill = "يرجى إدخال أو اختيار المهارة التقنية.";
  } else if (technical_skill.length < 2) {
    errors.technical_skill = "يرجى كتابة مهارة تقنية واضحة (حرفين على الأقل).";
  } else if (technical_skill.length > 120) {
    errors.technical_skill = "المهارة التقنية تتجاوز الحد المسموح (120 حرفًا).";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    sanitized: { full_name, email, technical_skill },
    errors,
  };
}
