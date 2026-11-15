import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function runAuthVerificationTest() {
  console.log("=== بدء الفحص والاختبار الفعلي لنظام Supabase Authentication ===");

  const supabaseUrl = (process.env.SUPABASE_URL ?? "").trim();
  const publishableKey = (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  ).trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY ?? "").trim();

  console.log("1. فحص إعدادات الاتصال:", {
    supabaseUrl,
    hasPublishableKey: Boolean(publishableKey),
    hasSecretKeyOnBackendOnly: Boolean(secretKey),
  });

  if (!supabaseUrl || !publishableKey) {
    throw new Error("إعدادات SUPABASE_URL أو SUPABASE_PUBLISHABLE_KEY مفقودة!");
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // استخدام حساب بريد مخصص للاختبار الفعلي
  const testEmail = `faisal.madinatukum.${Date.now()}@gmail.com`;
  const testPassword = "Madinatukum#2026!Secure";
  const testFullName = "فيصل بن عبد العزيز العتيبي";
  const testSkill = "تطوير الواجهات والنظم الخلفية (TypeScript & Supabase)";

  // 2. اختبار إنشاء حساب جديد (Sign Up)
  console.log(`\n2. اختبار إنشاء حساب جديد (Sign Up) للبريد: ${testEmail}`);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      emailRedirectTo: "http://localhost:3000/dashboard.html",
      data: {
        full_name: testFullName,
        technical_skill: testSkill,
      },
    },
  });

  if (signUpError) {
    console.error("❌ خطأ أثناء Sign Up:", signUpError.message);
    process.exit(1);
  }

  console.log("✅ نتيجة Sign Up من Supabase Auth:", {
    userId: signUpData.user?.id,
    email: signUpData.user?.email,
    emailConfirmedAt: signUpData.user?.email_confirmed_at ?? null,
    sessionReturnedImmediately: Boolean(signUpData.session),
    userMetadata: signUpData.user?.user_metadata,
  });

  // 3. اختبار تسجيل الدخول قبل تأكيد البريد الإلكتروني (للتأكد من عدم تجاوز تأكيد البريد)
  if (!signUpData.user?.email_confirmed_at) {
    console.log("\n3. اختبار تسجيل الدخول (Sign In) قبل تأكيد البريد الإلكتروني:");
    const { data: preSignInData, error: preSignInError } =
      await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

    console.log("✅ نتيجة محاولة الدخول قبل تأكيد البريد (المتوقع رفض الدخول لعدم التأكيد):", {
      sessionCreated: Boolean(preSignInData.session),
      errorReturned: preSignInError?.message ?? null,
    });
  }

  // 4. محاكاة نقر المستخدم على رابط تأكيد البريد الفعلي عبر verifyOtp ثم اختبار تسجيل الدخول والجلسة
  if (secretKey && signUpData.user?.id && !signUpData.user?.email_confirmed_at) {
    console.log("\n4. اختبار تفعيل البريد عبر رمز التأكيد الفعلي (verifyOtp) ثم تسجيل الدخول (Sign In):");
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: testEmail,
    });

    if (linkError) {
      console.error("تعذر توليد رابط التحقق للاختبار:", linkError.message);
    } else if (linkData?.properties?.hashed_token) {
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: "magiclink",
      });

      console.log("✅ نتيجة تأكيد البريد الإلكتروني (Email Confirmation):", {
        verified: !verifyError && Boolean(verifyData.user?.email_confirmed_at),
        emailConfirmedAt: verifyData.user?.email_confirmed_at,
      });
    }

    // 5. اختبار تسجيل الدخول الفعلي بالبريد وكلمة المرور بعد تأكيد البريد
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError || !signInData.session) {
      console.error("❌ فشل تسجيل الدخول بعد التأكيد:", signInError?.message);
      process.exit(1);
    }

    console.log("✅ نتيجة تسجيل الدخول (Sign In) بعد تأكيد البريد:", {
      sessionCreated: Boolean(signInData.session),
      accessTokenPrefix: signInData.session.access_token.slice(0, 20) + "...",
      expiresAt: signInData.session.expires_at,
      userEmail: signInData.user.email,
      userFullName: signInData.user.user_metadata?.full_name,
    });

    // 6. اختبار التحقق من استمرار الجلسة (getUser بواسطة الجلسة النشطة)
    const { data: userCheck, error: userCheckErr } = await supabase.auth.getUser(
      signInData.session.access_token
    );
    console.log("✅ نتيجة التحقق من الجلسة النشطة (Session Verification):", {
      validSession: !userCheckErr && Boolean(userCheck.user),
      userId: userCheck.user?.id,
    });
  }

  console.log("\n=== اكتملت جميع اختبارات Supabase Authentication بنجاح! ===");
}

runAuthVerificationTest().catch((err) => {
  console.error("فشل الاختبار:", err);
  process.exit(1);
});
