
import {
  createClient,
  type EmailOtpType,
  type SupabaseClient,
} from "@supabase/supabase-js";

const CONFIRMATION_SUCCESS_MESSAGE =
  "تم تأكيد حسابك بنجاح! سعيدين بانضمامك إلى منصتنا مدينتكم 💜";

let supabaseClient: SupabaseClient | null = null;

async function getSupabaseClient(): Promise<SupabaseClient> {
  if (supabaseClient) return supabaseClient;

  let supabaseUrl = "https://kcowkymogqzwhbhlazux.supabase.co";
  let supabasePublishableKey =
    "sb_publishable_Z36TCxRMO11Lr_QkKBDudg_SUVstlDD";

  try {
    const res = await fetch("/api/public-config");

    if (res.ok) {
      const cfg = (await res.json()) as {
        supabaseUrl?: string;
        supabasePublishableKey?: string;
      };

      if (cfg.supabaseUrl) supabaseUrl = cfg.supabaseUrl;
      if (cfg.supabasePublishableKey) {
        supabasePublishableKey = cfg.supabasePublishableKey;
      }
    }
  } catch (_err) {
    // استخدام إعدادات المشروع العامة عند تعذر جلب الإعدادات
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

function showConfirmationSuccess(bannerEl: HTMLElement | null): void {
  if (!bannerEl) return;

  bannerEl.classList.remove(
    "hidden",
    "bg-red-50",
    "border-red-200",
    "text-red-800"
  );

  bannerEl.classList.add(
    "bg-emerald-50",
    "border-emerald-200",
    "text-emerald-900"
  );

  bannerEl.textContent = CONFIRMATION_SUCCESS_MESSAGE;
}

function showConfirmationError(
  bannerEl: HTMLElement | null,
  loadingEl: HTMLElement | null,
  rawError?: string | null,
  errorCode?: string | null
): void {
  loadingEl?.classList.add("hidden");

  if (!bannerEl) return;

  bannerEl.classList.remove(
    "hidden",
    "bg-emerald-50",
    "border-emerald-200",
    "text-emerald-900"
  );

  bannerEl.classList.add(
    "bg-red-50",
    "border-red-200",
    "text-red-800"
  );

  const lower = `${rawError ?? ""} ${errorCode ?? ""}`.toLowerCase();

  const errorText =
    lower.includes("expired") || lower.includes("otp_expired")
      ? "فشل تأكيد الحساب: انتهت صلاحية رابط التأكيد أو تم استخدامه مسبقاً. يرجى طلب رابط تأكيد جديد."
      : "فشل تأكيد الحساب: رابط التأكيد غير صالح أو منتهي الصلاحية. يرجى المحاولة مرة أخرى.";

  bannerEl.innerHTML = "";

  const p = document.createElement("p");
  p.className = "font-bold text-sm";
  p.textContent = errorText;
  bannerEl.appendChild(p);

  const backLink = document.createElement("a");
  backLink.href = "/";
  backLink.className =
    "inline-block mt-2 text-xs font-bold text-[#28664F] underline";
  backLink.textContent = "العودة إلى صفحة تسجيل الدخول";

  bannerEl.appendChild(backLink);
}

async function initDashboard(): Promise<void> {
  const loadingEl = document.getElementById("dashboard-loading");
  const contentEl = document.getElementById("dashboard-content");
  const bannerEl = document.getElementById("dashboard-banner");
  const logoutBtn = document.getElementById("logout-btn");

  const initialHashParams = new URLSearchParams(
    window.location.hash.replace(/^#/, "")
  );

  const urlParams = new URLSearchParams(window.location.search);

  const hashError =
    initialHashParams.get("error") || urlParams.get("error");

  const hashErrorCode =
    initialHashParams.get("error_code") ||
    urlParams.get("error_code");

  const hashErrorDescription =
    initialHashParams.get("error_description") ||
    urlParams.get("error_description");

  const hashType = initialHashParams.get("type");
  const hasHashAccessToken = initialHashParams.has("access_token");
  const isConfirmedFlag = urlParams.get("confirmed") === "true";

  if (hashError || hashErrorCode || hashErrorDescription) {
    showConfirmationError(
      bannerEl,
      loadingEl,
      hashErrorDescription || hashError,
      hashErrorCode
    );

    window.history.replaceState(
      {},
      document.title,
      "/dashboard.html"
    );

    return;
  }

  try {
    const supabase = await getSupabaseClient();

    const tokenHash = urlParams.get("token_hash");
    const otpType = urlParams.get("type") as EmailOtpType | null;
    const authCode = urlParams.get("code");

    let confirmedJustNow = false;

    if (tokenHash && otpType) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType,
      });

      if (error) {
        showConfirmationError(
          bannerEl,
          loadingEl,
          error.message,
          error.code
        );

        window.history.replaceState(
          {},
          document.title,
          "/dashboard.html"
        );

        return;
      }

      confirmedJustNow = true;
    } else if (authCode) {
      const { error } =
        await supabase.auth.exchangeCodeForSession(authCode);

      if (error) {
        showConfirmationError(
          bannerEl,
          loadingEl,
          error.message,
          error.code
        );

        window.history.replaceState(
          {},
          document.title,
          "/dashboard.html"
        );

        return;
      }

      confirmedJustNow = true;
    } else if (
      (hasHashAccessToken &&
        (hashType === "signup" ||
          hashType === "email" ||
          hashType === "invite")) ||
      isConfirmedFlag
    ) {
      confirmedJustNow = true;
    }

    // التحقق من الجلسة
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    // تعديل مؤقت: عرض لوحة التحكم والبطاقات حتى عند عدم وجود جلسة
    if (sessionError || !session) {
      loadingEl?.classList.add("hidden");
      contentEl?.classList.remove("hidden");

      if (confirmedJustNow) {
        showConfirmationSuccess(bannerEl);
      }

      return;
    }

    // التحقق من المستخدم
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      loadingEl?.classList.add("hidden");
      contentEl?.classList.remove("hidden");
      return;
    }

    if (confirmedJustNow && user.email_confirmed_at) {
      showConfirmationSuccess(bannerEl);

      window.history.replaceState(
        {},
        document.title,
        "/dashboard.html"
      );
    }

    const fullName =
      (user.user_metadata?.full_name as string | undefined) ||
      user.email?.split("@")[0] ||
      "مستخدم مدينتكم";

    const technicalSkill =
      (user.user_metadata?.technical_skill as string | undefined) ||
      "غير محدد";

    const setElText = (id: string, text: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setElText("user-fullname", fullName);
    setElText("detail-fullname", fullName);
    setElText("detail-email", user.email || "-");
    setElText("detail-skill", technicalSkill);
    setElText("detail-uid", user.id);

    setElText(
      "user-confirmed-badge",
      user.email_confirmed_at ? "مؤكَّد ✓" : "بانتظار التأكيد"
    );

    setElText(
      "detail-confirmed-at",
      user.email_confirmed_at
        ? new Date(user.email_confirmed_at).toLocaleString("ar-SA")
        : "غير مؤكَّد"
    );

    setElText(
      "detail-last-signin",
      user.last_sign_in_at
        ? new Date(user.last_sign_in_at).toLocaleString("ar-SA")
        : "الآن"
    );

    setElText(
      "detail-expires-at",
      session.expires_at
        ? new Date(session.expires_at * 1000).toLocaleString("ar-SA")
        : "-"
    );

    loadingEl?.classList.add("hidden");
    contentEl?.classList.remove("hidden");

    logoutBtn?.addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.replace("/");
    });

  } catch (err) {
    console.error("Dashboard error:", err);

    loadingEl?.classList.add("hidden");
    contentEl?.classList.remove("hidden");
  }
}

initDashboard();
