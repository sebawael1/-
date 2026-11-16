import { createClient, type EmailOtpType, type SupabaseClient } from "@supabase/supabase-js";
import { validateRegistrationInput } from "../utils/validation.js";

type AuthMode = "signin" | "signup";

interface AuthFieldErrors {
  full_name?: string;
  email?: string;
  password?: string;
  technical_skill?: string;
}

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

let currentMode: AuthMode = "signin";
let supabaseClient: SupabaseClient | null = null;

const form = document.getElementById("auth-form") as HTMLFormElement | null;
const formTitle = document.getElementById("form-title") as HTMLElement | null;
const formSubtitle = document.getElementById("form-subtitle") as HTMLElement | null;

const fullNameWrapper = document.getElementById("field-wrapper-full_name") as HTMLElement | null;
const skillWrapper = document.getElementById("field-wrapper-technical_skill") as HTMLElement | null;

const fullNameInput = document.getElementById("full_name") as HTMLInputElement | null;
const emailInput = document.getElementById("email") as HTMLInputElement | null;
const passwordInput = document.getElementById("password") as HTMLInputElement | null;
const skillInput = document.getElementById("technical_skill") as HTMLInputElement | null;

const submitBtn = document.getElementById("submit-btn") as HTMLButtonElement | null;
const submitBtnText = document.getElementById("submit-btn-text") as HTMLSpanElement | null;
const submitSpinner = document.getElementById("submit-spinner") as SVGElement | null;
const statusBanner = document.getElementById("status-banner") as HTMLDivElement | null;

const modeSwitchLabel = document.getElementById("mode-switch-label") as HTMLElement | null;
const modeSwitchBtn = document.getElementById("mode-switch-btn") as HTMLButtonElement | null;
const forgotPasswordBtn = document.getElementById("forgot-password-btn") as HTMLButtonElement | null;
const googleBtn = document.getElementById("google-btn") as HTMLButtonElement | null;

const fieldErrorElements: Record<keyof AuthFieldErrors, HTMLElement | null> = {
  full_name: document.getElementById("error-full_name"),
  email: document.getElementById("error-email"),
  password: document.getElementById("error-password"),
  technical_skill: document.getElementById("error-technical_skill"),
};

const fieldInputElements: Record<keyof AuthFieldErrors, HTMLInputElement | null> = {
  full_name: fullNameInput,
  email: emailInput,
  password: passwordInput,
  technical_skill: skillInput,
};

async function getSupabase(): Promise<SupabaseClient> {
  if (supabaseClient) return supabaseClient;

  let supabaseUrl = "https://kcowkymogqzwhbhlazux.supabase.co";
  let supabasePublishableKey = "sb_publishable_Z36TCxRMO11Lr_QkKBDudg_SUVstlDD";

  try {
    const response = await fetch("/api/public-config");
    if (response.ok) {
      const cfg = (await response.json()) as {
        supabaseUrl?: string;
        supabasePublishableKey?: string;
      };
      if (cfg.supabaseUrl) supabaseUrl = cfg.supabaseUrl;
      if (cfg.supabasePublishableKey) supabasePublishableKey = cfg.supabasePublishableKey;
    }
  } catch (_err) {
    // استخدام إعدادات المشروع العامة (Publishable) عند النشر الثابت
  }

  supabaseClient = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "madinatukum-supabase-auth",
    },
  });

  return supabaseClient;
}

function clearFieldErrors(): void {
  (Object.keys(fieldErrorElements) as Array<keyof AuthFieldErrors>).forEach((field) => {
    const errEl = fieldErrorElements[field];
    const inputEl = fieldInputElements[field];
    if (errEl) {
      errEl.textContent = "";
      errEl.classList.add("hidden");
    }
    if (inputEl) {
      inputEl.classList.remove("border-red-500", "focus:border-red-500", "focus:ring-red-500/15");
      inputEl.classList.add("border-slate-200");
    }
  });
}

function renderFieldErrors(errors: AuthFieldErrors): void {
  clearFieldErrors();
  (Object.keys(errors) as Array<keyof AuthFieldErrors>).forEach((field) => {
    const message = errors[field];
    const errEl = fieldErrorElements[field];
    const inputEl = fieldInputElements[field];
    if (message && errEl) {
      errEl.textContent = message;
      errEl.classList.remove("hidden");
    }
    if (message && inputEl) {
      inputEl.classList.remove("border-slate-200");
      inputEl.classList.add("border-red-500", "focus:border-red-500", "focus:ring-red-500/15");
    }
  });
}

function hideBanner(): void {
  if (!statusBanner) return;
  statusBanner.classList.add("hidden");
  statusBanner.innerHTML = "";
}

function showBanner(
  type: "loading" | "success" | "error" | "info",
  message: string,
  options?: { resendEmailAddress?: string }
): void {
  if (!statusBanner) return;
  statusBanner.classList.remove(
    "hidden",
    "bg-emerald-50",
    "border-emerald-200",
    "text-emerald-900",
    "bg-red-50",
    "border-red-200",
    "text-red-800",
    "bg-amber-50",
    "border-amber-200",
    "text-amber-900",
    "bg-slate-50",
    "border-slate-200",
    "text-slate-700"
  );

  if (type === "loading") {
    statusBanner.classList.add("bg-slate-50", "border-slate-200", "text-slate-700");
  } else if (type === "error") {
    statusBanner.classList.add("bg-red-50", "border-red-200", "text-red-800");
  } else if (type === "info") {
    statusBanner.classList.add("bg-amber-50", "border-amber-200", "text-amber-900");
  } else {
    statusBanner.classList.add("bg-emerald-50", "border-emerald-200", "text-emerald-900");
  }

  statusBanner.innerHTML = "";
  const msgParagraph = document.createElement("p");
  msgParagraph.className = "font-semibold";
  msgParagraph.textContent = message;
  statusBanner.appendChild(msgParagraph);

  if (options?.resendEmailAddress) {
    const actionRow = document.createElement("div");
    actionRow.className = "mt-2.5 flex items-center gap-3";

    const resendBtn = document.createElement("button");
    resendBtn.type = "button";
    resendBtn.className =
      "text-[11.5px] font-bold text-[#28664F] underline hover:text-[#194233] focus:outline-none";
    resendBtn.textContent = "🔄 إعادة إرسال رابط تأكيد البريد الإلكتروني";

    resendBtn.addEventListener("click", async () => {
      resendBtn.disabled = true;
      resendBtn.textContent = "جاري طلب إعادة إرسال رابط التأكيد من Supabase...";
      try {
        const supabase = await getSupabase();
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: options.resendEmailAddress!,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard.html`,
          },
        });
        if (error) {
          showBanner("error", translateSupabaseAuthError(error.message));
        } else {
          showBanner(
            "info",
            `تم إرسال طلب تأكيد جديد إلى (${options.resendEmailAddress}) عبر Supabase Auth. يرجى فحص صندوق الوارد أو مجلد الرسائل غير المرغوب فيها (Spam).`
          );
        }
      } catch (_err) {
        showBanner("error", "تعذر إعادة إرسال رسالة التأكيد حالياً.");
      }
    });

    actionRow.appendChild(resendBtn);
    statusBanner.appendChild(actionRow);
  }
}

function translateSupabaseAuthError(rawMessage: string): string {
  const msg = rawMessage.toLowerCase();
  if (msg.includes("email not confirmed")) {
    return "لم يتم تأكيد بريدك الإلكتروني بعد. يرجى فتح رسالة التأكيد في بريدك الإلكتروني والضغط على رابط التفعيل قبل تسجيل الدخول.";
  }
  if (msg.includes("invalid login credentials")) {
    return "البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى التأكد من البيانات والمحاولة مرة أخرى.";
  }
  if (msg.includes("user already registered") || msg.includes("already been registered")) {
    return "هذا البريد الإلكتروني مسجل مسبقاً. يرجى تسجيل الدخول بدلاً من إنشاء حساب جديد.";
  }
  if (msg.includes("password should be at least")) {
    return "يجب أن تتكون كلمة المرور من 6 أحرف أو أرقام على الأقل.";
  }
  if (msg.includes("rate limit") || msg.includes("over_email_send_rate_limit") || msg.includes("for security purposes")) {
    return "تم تجاوز الحد المسموح لإرسال رسائل البريد المؤقتة في Supabase Auth. يرجى الانتظار قليلاً أو ضبط إعدادات Custom SMTP في لوحة تحكم Supabase.";
  }
  if (msg.includes("error sending confirmation email")) {
    return "تعذر على خادم Supabase إرسال بريد التأكيد. يرجى التحقق من إعدادات SMTP في Supabase Dashboard.";
  }
  return `خطأ في المصادقة: ${rawMessage}`;
}

function setMode(mode: AuthMode, keepBanner = false): void {
  currentMode = mode;
  clearFieldErrors();
  if (!keepBanner) {
    hideBanner();
  }

  if (mode === "signin") {
    fullNameWrapper?.classList.add("hidden");
    skillWrapper?.classList.add("hidden");
    if (formTitle) formTitle.textContent = "مدينتك بانتظارك.";
    if (formSubtitle) formSubtitle.textContent = "سجّل دخولك، وخلّ يومك أسهل.";
    if (submitBtnText) submitBtnText.textContent = "تسجيل الدخول";
    if (modeSwitchLabel) modeSwitchLabel.textContent = "ليس لديك حساب في مدينتكم؟";
    if (modeSwitchBtn) modeSwitchBtn.textContent = "إنشاء حساب جديد";
    if (passwordInput) passwordInput.autocomplete = "current-password";
  } else {
    fullNameWrapper?.classList.remove("hidden");
    skillWrapper?.classList.remove("hidden");
    if (formTitle) formTitle.textContent = "انضم إلى مدينتكم.";
    if (formSubtitle) formSubtitle.textContent = "أنشئ حسابك الجديد في خطوات بسيطة.";
    if (submitBtnText) submitBtnText.textContent = "إنشاء حساب جديد";
    if (modeSwitchLabel) modeSwitchLabel.textContent = "لديك حساب بالفعل؟";
    if (modeSwitchBtn) modeSwitchBtn.textContent = "تسجيل الدخول";
    if (passwordInput) passwordInput.autocomplete = "new-password";
  }
}

function setLoadingState(isLoading: boolean): void {
  if (!submitBtn || !submitBtnText || !submitSpinner) return;
  submitBtn.disabled = isLoading;
  if (isLoading) {
    submitBtnText.textContent =
      currentMode === "signin" ? "جاري تسجيل الدخول..." : "جاري إنشاء الحساب...";
    submitSpinner.classList.remove("hidden");
  } else {
    submitBtnText.textContent = currentMode === "signin" ? "تسجيل الدخول" : "إنشاء حساب جديد";
    submitSpinner.classList.add("hidden");
  }
}

/**
 * فحص استمرار الجلسة (Session Persistence) أو عودة المستخدم من رابط تأكيد البريد الإلكتروني
 */
async function checkExistingSessionAndUrlTokens(): Promise<void> {
  try {
    const supabase = await getSupabase();

    // 1. فحص وجود خطأ في الرابط العائد من Supabase Auth (مثل انتهاء صلاحية رابط التأكيد)
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const queryParams = new URLSearchParams(window.location.search);
    const errorDescription =
      hashParams.get("error_description") || queryParams.get("error_description");
    if (errorDescription) {
      showBanner("error", translateSupabaseAuthError(errorDescription));
      window.history.replaceState({}, document.title, "/");
      return;
    }

    // 2. معالجة رموز تأكيد البريد (?token_hash=...&type=... أو ?code=...)
    const tokenHash = queryParams.get("token_hash");
    const otpType = queryParams.get("type") as EmailOtpType | null;
    const authCode = queryParams.get("code");

    if (tokenHash && otpType) {
      showBanner("loading", "جاري تأكيد بريدك الإلكتروني وتفعيل الحساب...");
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType,
      });
      if (error) {
        showBanner("error", translateSupabaseAuthError(error.message));
        return;
      }
      if (data.session) {
        window.location.replace("/dashboard.html");
        return;
      }
      showBanner("success", "تم تأكيد بريدك الإلكتروني بنجاح! يمكنك الآن تسجيل الدخول.");
      window.history.replaceState({}, document.title, "/");
      return;
    }

    if (authCode) {
      showBanner("loading", "جاري التحقق من رمز المصادقة...");
      const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);
      if (error) {
        showBanner("error", translateSupabaseAuthError(error.message));
        return;
      }
      if (data.session) {
        window.location.replace("/dashboard.html");
        return;
      }
    }

    // 3. التحقق من الجلسة المحفوظة (Session Persistence) عند فتح أو تحديث الصفحة
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (!userErr && user) {
        window.location.replace("/dashboard.html");
      }
    }
  } catch (_err) {
    // انتظار تفاعل المستخدم في حال عدم وجود جلسة
  }
}

modeSwitchBtn?.addEventListener("click", () => {
  setMode(currentMode === "signin" ? "signup" : "signin");
});

forgotPasswordBtn?.addEventListener("click", async () => {
  clearFieldErrors();
  const email = (emailInput?.value ?? "").trim().toLowerCase();
  if (!email || !EMAIL_REGEX.test(email)) {
    renderFieldErrors({ email: "يرجى إدخال بريدك الإلكتروني أولاً لإرسال رابط استعادة كلمة المرور." });
    showBanner("error", "أدخل بريدك الإلكتروني في الحقل المخصص ثم اضغط على نسيت كلمة المرور.");
    return;
  }

  showBanner("loading", "جاري إرسال رابط استعادة كلمة المرور عبر Supabase Auth...");
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/dashboard.html`,
    });
    if (error) {
      showBanner("error", translateSupabaseAuthError(error.message));
      return;
    }
    showBanner(
      "info",
      `تم إرسال طلب استعادة كلمة المرور إلى (${email}). يرجى التحقق من بريدك الإلكتروني.`
    );
  } catch (_err) {
    showBanner("error", "تعذر إرسال طلب استعادة كلمة المرور.");
  }
});

googleBtn?.addEventListener("click", async () => {
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard.html`,
      },
    });
    if (error) {
      showBanner("error", translateSupabaseAuthError(error.message));
    }
  } catch (_err) {
    showBanner("error", "تعذر بدء تسجيل الدخول عبر Google.");
  }
});

[fullNameInput, emailInput, passwordInput, skillInput].forEach((inputEl) => {
  inputEl?.addEventListener("input", () => {
    clearFieldErrors();
  });
});

form?.addEventListener("submit", async (event: SubmitEvent) => {
  event.preventDefault();
  clearFieldErrors();

  const email = (emailInput?.value ?? "").trim().toLowerCase();
  const password = passwordInput?.value ?? "";

  if (currentMode === "signin") {
    // التحقق من حقول تسجيل الدخول (Sign In Validation)
    const errors: AuthFieldErrors = {};
    if (!email) {
      errors.email = "يرجى إدخال البريد الإلكتروني.";
    } else if (!EMAIL_REGEX.test(email)) {
      errors.email = "يرجى إدخال بريد إلكتروني صحيح.";
    }

    if (!password) {
      errors.password = "يرجى إدخال كلمة المرور.";
    }

    if (Object.keys(errors).length > 0) {
      renderFieldErrors(errors);
      showBanner("error", "يرجى إدخال البريد الإلكتروني وكلمة المرور بشكل صحيح.");
      return;
    }

    setLoadingState(true);
    showBanner("loading", "جاري التحقق من بيانات الدخول عبر Supabase Authentication...");

    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      setLoadingState(false);

      if (error) {
        const isUnconfirmed = error.message.toLowerCase().includes("email not confirmed");
        showBanner(
          "error",
          translateSupabaseAuthError(error.message),
          isUnconfirmed ? { resendEmailAddress: email } : undefined
        );
        return;
      }

      if (!data.session || !data.user) {
        showBanner("error", "تعذر إنشاء جلسة المستخدم. يرجى تأكيد البريد الإلكتروني أولاً.");
        return;
      }

      showBanner("success", "تم تسجيل الدخول بنجاح! جاري توجيهك إلى لوحة التحكم...");
      window.location.replace("/dashboard.html");
    } catch (_err) {
      setLoadingState(false);
      showBanner("error", "تعذر الاتصال بخادم المصادقة. يرجى المحاولة مرة أخرى.");
    }
    return;
  }

  // وضع إنشاء حساب جديد (Sign Up Mode)
  const rawSignup = {
    full_name: fullNameInput?.value ?? "",
    email,
    technical_skill: skillInput?.value ?? "",
  };

  const validation = validateRegistrationInput(rawSignup);
  const signupErrors: AuthFieldErrors = { ...validation.errors };

  if (!password) {
    signupErrors.password = "يرجى إدخال كلمة مرور للحساب.";
  } else if (password.length < 6) {
    signupErrors.password = "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.";
  }

  if (Object.keys(signupErrors).length > 0) {
    renderFieldErrors(signupErrors);
    showBanner("error", "يرجى استكمال جميع حقول إنشاء الحساب بشكل صحيح.");
    return;
  }

  setLoadingState(true);
  showBanner("loading", "جاري إنشاء حسابك في Supabase Authentication...");

  try {
    const supabase = await getSupabase();

    // 1. إنشاء حساب فعلي في Supabase Authentication (auth.users)
    const { data, error } = await supabase.auth.signUp({
      email: validation.sanitized.email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard.html`,
        data: {
          full_name: validation.sanitized.full_name,
          technical_skill: validation.sanitized.technical_skill,
        },
      },
    });

    if (error) {
      setLoadingState(false);
      showBanner("error", translateSupabaseAuthError(error.message));
      return;
    }

    if (!data.user) {
      setLoadingState(false);
      showBanner("error", "لم يتم إنشاء المستخدم في Supabase. يرجى المحاولة مرة أخرى.");
      return;
    }

    // التحقق من حالة الحساب المسجل مسبقاً في Supabase Auth (identities فارغة)
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setLoadingState(false);
      setMode("signin", true);
      if (emailInput) emailInput.value = validation.sanitized.email;
      showBanner(
        "error",
        "هذا البريد الإلكتروني مسجل بالفعل في النظام. يرجى تسجيل الدخول بكلمة المرور الخاصة بك."
      );
      return;
    }

    // 2. حفظ سجل المهارة التقنية في جدول public.registrations وتشغيل أتمتة n8n دون تعطيل المصادقة
    fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validation.sanitized),
    }).catch(() => {
      // يتم تجاهل خطأ التكرار في الجدول الثانوي لأن الحساب الرئيسي في auth.users
    });

    setLoadingState(false);

    // 3. إذا كان تأكيد البريد غير مطلوب وعادت الجلسة مباشرة، يتم التوجيه إلى Dashboard
    if (data.session) {
      showBanner("success", "تم إنشاء حسابك وتسجيل دخولك بنجاح! جاري التوجيه إلى لوحة التحكم...");
      window.location.replace("/dashboard.html");
      return;
    }

    // 4. إذا كان تأكيد البريد الإلكتروني مفعّلاً في Supabase (session === null)
    form.reset();
    setMode("signin", true);
    if (emailInput) emailInput.value = validation.sanitized.email;

    showBanner(
      "info",
      `تم إنشاء حسابك في Supabase بنجاح! نظراً لأن تأكيد البريد الإلكتروني (Confirm Email) مفعّل في مشروع Supabase، يجب الضغط على رابط التأكيد المرسل إلى (${validation.sanitized.email}) قبل تسجيل الدخول.`,
      { resendEmailAddress: validation.sanitized.email }
    );
  } catch (_err) {
    setLoadingState(false);
    showBanner("error", "حدث خطأ أثناء الاتصال بـ Supabase Authentication.");
  }
});

checkExistingSessionAndUrlTokens();
