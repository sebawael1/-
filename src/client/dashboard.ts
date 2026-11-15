import { createClient, type EmailOtpType, type SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

async function getSupabaseClient(): Promise<SupabaseClient> {
  if (supabaseClient) return supabaseClient;

  const res = await fetch("/api/public-config");
  if (!res.ok) {
    throw new Error("تعذر تحميل إعدادات الاتصال بـ Supabase.");
  }
  const { supabaseUrl, supabasePublishableKey } = (await res.json()) as {
    supabaseUrl: string;
    supabasePublishableKey: string;
  };

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

async function initDashboard(): Promise<void> {
  const loadingEl = document.getElementById("dashboard-loading");
  const contentEl = document.getElementById("dashboard-content");
  const bannerEl = document.getElementById("dashboard-banner");
  const logoutBtn = document.getElementById("logout-btn");

  try {
    const supabase = await getSupabaseClient();

    // معالجة رابط تأكيد البريد الإلكتروني إذا حضر في عنوان الصفحة (?token_hash=...&type=...)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenHash = urlParams.get("token_hash");
    const otpType = urlParams.get("type") as EmailOtpType | null;
    const authCode = urlParams.get("code");

    if (tokenHash && otpType) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType,
      });
      if (!error && bannerEl) {
        bannerEl.textContent = "تم تأكيد بريدك الإلكتروني وتفعيل حسابك بنجاح!";
        bannerEl.classList.remove("hidden");
        window.history.replaceState({}, document.title, "/dashboard.html");
      }
    } else if (authCode) {
      const { error } = await supabase.auth.exchangeCodeForSession(authCode);
      if (!error && bannerEl) {
        bannerEl.textContent = "تم تأكيد حسابك وتسجيل دخولك بنجاح!";
        bannerEl.classList.remove("hidden");
        window.history.replaceState({}, document.title, "/dashboard.html");
      }
    }

    // التحقق من الجلسة المحفوظة (Session Persistence)
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      window.location.replace("/");
      return;
    }

    // التحقق الفعلي من المستخدم في خادم Supabase Auth
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      await supabase.auth.signOut();
      window.location.replace("/");
      return;
    }

    const fullName =
      (user.user_metadata?.full_name as string | undefined) ||
      user.email?.split("@")[0] ||
      "مستخدم مدينتكم";
    const technicalSkill =
      (user.user_metadata?.technical_skill as string | undefined) || "غير محدد";

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
  } catch (_err) {
    window.location.replace("/");
  }
}

initDashboard();
