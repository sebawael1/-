import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

interface WebhookUser {
  id: string;
  email: string;
  new_email?: string;
  created_at?: string;
  user_metadata?: {
    full_name?: string;
    technical_skill?: string;
    [key: string]: unknown;
  };
}

interface WebhookEmailData {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type:
    | "signup"
    | "invite"
    | "magiclink"
    | "recovery"
    | "email_change"
    | "email"
    | string;
  site_url: string;
  token_new?: string;
  token_hash_new?: string;
}

interface SendEmailHookPayload {
  user: WebhookUser;
  email_data: WebhookEmailData;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * إنشاء رابط تأكيد البريد الإلكتروني بالطريقة الرسمية باستخدام token_hash و email_action_type
 * لتوجيه المستخدم مباشرة إلى /dashboard.html وتنفيذ verifyOtp({ token_hash, type })
 */
function buildConfirmationUrl(
  emailData: WebhookEmailData,
  tokenHashToUse: string
): string {
  const rawRedirect = (
    emailData.redirect_to ||
    emailData.site_url ||
    "https://yourcity-tau.vercel.app/dashboard.html"
  ).trim();

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawRedirect);
    if (targetUrl.port === "9999") {
      targetUrl = new URL("https://yourcity-tau.vercel.app/dashboard.html");
    } else if (targetUrl.pathname === "/" || targetUrl.pathname === "") {
      targetUrl.pathname = "/dashboard.html";
    }
  } catch (_err) {
    targetUrl = new URL("https://yourcity-tau.vercel.app/dashboard.html");
  }

  targetUrl.searchParams.set("token_hash", tokenHashToUse);
  targetUrl.searchParams.set("type", emailData.email_action_type);

  return targetUrl.toString();
}

/**
 * بناء رسالة البريد الإلكتروني بالاعتماد على القالب المعتمد في logs/sent-emails/
 * مع تعبئة بيانات المستخدم ديناميكياً ودعم تأكيد التسجيل واستعادة كلمة المرور
 */
function buildDynamicEmailTemplate(params: {
  user: WebhookUser;
  targetEmail: string;
  confirmationUrl: string;
  token: string;
  actionType: string;
}): { subject: string; html: string; text: string } {
  const { user, targetEmail, confirmationUrl, token, actionType } = params;

  const rawFullName =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
    targetEmail.split("@")[0] ||
    "مستخدم مدينتكم";
  const rawSkill =
    (typeof user.user_metadata?.technical_skill === "string" &&
      user.user_metadata.technical_skill.trim()) ||
    "غير محدد";

  const fullName = escapeHtml(rawFullName);
  const safeEmail = escapeHtml(targetEmail);
  const technicalSkill = escapeHtml(rawSkill);
  const userId = escapeHtml(user.id || "-");

  const createdDate = user.created_at ? new Date(user.created_at) : new Date();
  const formattedDate = createdDate.toLocaleString("ar-SA", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const isRecovery = actionType === "recovery";

  const subject = isRecovery
    ? `استعادة كلمة المرور لحسابك في مدينتكم يا ${rawFullName}`
    : `مرحبًا بك في مدينتكم يا ${rawFullName} — تأكيد تسجيلك الإلكتروني`;

  const headerTitle = isRecovery ? "استعادة كلمة المرور" : "تأكيد التسجيل الإلكتروني";
  const introParagraph = isRecovery
    ? `تلقينا طلبًا لإعادة تعيين كلمة المرور الخاصة بحسابك في <strong>مدينتكم</strong>. اضغط على الزر أدناه لتأكيد الطلب ومتابعة الدخول إلى حسابك.`
    : `نشكرك على التسجيل في <strong>مدينتكم</strong>. نؤكد لك أنه قد تم حفظ بياناتك بنجاح في قاعدة البيانات، ولإتمام تفعيل حسابك يرجى الضغط على زر تأكيد البريد الإلكتروني أدناه.`;
  const buttonLabel = isRecovery ? "تأكيد استعادة كلمة المرور" : "تأكيد حسابي وتفعيل البريد الإلكتروني";

  const text = [
    `مرحبًا ${rawFullName}،`,
    "",
    isRecovery
      ? "تلقينا طلبًا لاستعادة كلمة المرور الخاصة بحسابك في منصة مدينتكم."
      : "يسعدنا تأكيد استلام وحفظ بيانات تسجيلك بنجاح في منصة مدينتكم.",
    "",
    `لتأكيد حسابك اضغط على الرابط التالي:`,
    confirmationUrl,
    "",
    token ? `رمز التحقق (OTP): ${token}` : "",
    "",
    `ملخص بيانات التسجيل المحفوظة:`,
    `- الاسم الكامل: ${rawFullName}`,
    `- البريد الإلكتروني: ${targetEmail}`,
    `- المهارة التقنية: ${rawSkill}`,
    `- تاريخ التسجيل: ${formattedDate}`,
    `- رقم المعرّف (ID): ${user.id}`,
    "",
    "حياتك في المدينة، أكثر اتصالاً.",
    "مع تحيات فريق مدينتكم",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:32px 16px;background-color:#f3f4f6;font-family:'Cairo','Segoe UI',Tahoma,Arial,sans-serif;color:#111827;direction:rtl;text-align:right;">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e5e7eb;">
    <div style="background:#28664F;padding:28px 32px;color:#ffffff;">
      <div style="font-size:13px;opacity:0.9;margin-bottom:6px;">منصة مدينتكم • الرياض، كما تحبها</div>
      <h1 style="margin:0;font-size:22px;font-weight:700;">${headerTitle}</h1>
    </div>
    <div style="padding:32px;">
      <p style="font-size:17px;margin-top:0;margin-bottom:12px;">أهلاً بك يا <strong>${fullName}</strong>،</p>
      <p style="font-size:15px;line-height:1.8;color:#374151;margin-bottom:24px;">
        ${introParagraph}
      </p>

      <div style="text-align:center;margin:28px 0;">
        <a href="${confirmationUrl}" style="display:inline-block;background:#28664F;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;">
          ${buttonLabel}
        </a>
      </div>

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;">
        <h3 style="margin:0 0 14px 0;font-size:15px;color:#28664F;">ملخص بيانات التسجيل المحفوظة:</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#1f2937;">
          <tr>
            <td style="padding:7px 0;color:#6b7280;width:38%;">الاسم الكامل:</td>
            <td style="padding:7px 0;font-weight:600;">${fullName}</td>
          </tr>
          <tr>
            <td style="padding:7px 0;color:#6b7280;">البريد الإلكتروني:</td>
            <td style="padding:7px 0;font-weight:600;direction:ltr;text-align:right;">${safeEmail}</td>
          </tr>
          <tr>
            <td style="padding:7px 0;color:#6b7280;">المهارة التقنية:</td>
            <td style="padding:7px 0;font-weight:600;">${technicalSkill}</td>
          </tr>
          <tr>
            <td style="padding:7px 0;color:#6b7280;">تاريخ التسجيل:</td>
            <td style="padding:7px 0;font-weight:600;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding:7px 0;color:#6b7280;">رقم المعرّف (ID):</td>
            <td style="padding:7px 0;font-family:monospace;font-size:12px;color:#4b5563;">${userId}</td>
          </tr>
        </table>
      </div>

      <p style="font-size:12.5px;line-height:1.7;color:#6b7280;margin-top:16px;margin-bottom:6px;">
        إذا لم يعمل الزر أعلاه، يمكنك نسخ رابط التأكيد التالي ولصقه في المتصفح:
      </p>
      <p dir="ltr" style="font-size:11.5px;word-break:break-all;background:#f9fafb;padding:10px 12px;border-radius:8px;border:1px solid #e5e7eb;color:#28664F;text-align:left;margin-top:0;margin-bottom:24px;">
        ${confirmationUrl}
      </p>

      <p style="font-size:14px;line-height:1.7;color:#6b7280;margin-bottom:0;">
        حياتك في المدينة، أكثر اتصالاً.<br />
        مع تحيات <strong>فريق مدينتكم</strong>
      </p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * إرسال الرسالة عبر Sendliberty API باستخدام SENDLIBERTY_API_KEY المحفوظ في Supabase Secrets
 */
async function sendViaSendliberty(params: {
  apiKey: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const endpoint = (
    Deno.env.get("SENDLIBERTY_API_URL") || "https://sendliberty.com/api/send"
  ).trim();
  const fromEmail = (Deno.env.get("SENDLIBERTY_FROM") || "").trim();

  const payload: Record<string, string> = {
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  };

  if (fromEmail) {
    payload.from = fromEmail;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "X-API-Key": params.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Sendliberty API error (${response.status}): ${errorBody}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "ok",
        function: "send-email",
        hasSendlibertyApiKey: Boolean((Deno.env.get("SENDLIBERTY_API_KEY") ?? "").trim()),
        hasSendEmailHookSecret: Boolean((Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "").trim()),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sendlibertyApiKey = (Deno.env.get("SENDLIBERTY_API_KEY") ?? "").trim();
  if (!sendlibertyApiKey) {
    return new Response(
      JSON.stringify({
        error: {
          http_code: 500,
          message: "Missing SENDLIBERTY_API_KEY in Supabase Edge Function secrets.",
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const rawHookSecret = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "").trim();
  const payloadText = await req.text();
  const headers = Object.fromEntries(req.headers);

  let verifiedData: SendEmailHookPayload;

  if (rawHookSecret) {
    const hookSecret = rawHookSecret
      .replace(/^["']|["']$/g, "")
      .replace(/^v1,whsec_/, "")
      .replace(/^whsec_/, "")
      .trim();

    try {
      const wh = new Webhook(hookSecret);
      verifiedData = wh.verify(payloadText, headers) as SendEmailHookPayload;
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: {
            http_code: 401,
            message: `Webhook signature verification failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
  } else {
    // في حال استدعاء الدالة عبر Postgres Send Email Hook أو قبل نسخ SEND_EMAIL_HOOK_SECRET،
    // نتحقق من وجود ترويسات Standard Webhooks أو مفتاح الخدمة الداخلي وصحة بنية الحدث
    const hasStandardWebhookHeaders = Boolean(
      headers["webhook-id"] && headers["webhook-timestamp"] && headers["webhook-signature"]
    );
    const isInternalPostgresHook = headers["x-supabase-hook-source"] === "postgres";

    if (!hasStandardWebhookHeaders && !isInternalPostgresHook) {
      return new Response(
        JSON.stringify({
          error: {
            http_code: 401,
            message: "Unauthorized request: missing Standard Webhooks signature headers.",
          },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      verifiedData = JSON.parse(payloadText) as SendEmailHookPayload;
      if (!verifiedData?.user?.email || !verifiedData?.email_data?.token_hash) {
        throw new Error("Invalid Send Email Hook payload structure");
      }
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: {
            http_code: 400,
            message: err instanceof Error ? err.message : "Invalid JSON payload",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  try {
    const { user, email_data } = verifiedData;

    if (
      email_data.email_action_type === "email_change" &&
      user.new_email &&
      email_data.token_hash_new
    ) {
      const currentEmailUrl = buildConfirmationUrl(
        email_data,
        email_data.token_hash_new
      );
      const currentEmailContent = buildDynamicEmailTemplate({
        user,
        targetEmail: user.email,
        confirmationUrl: currentEmailUrl,
        token: email_data.token,
        actionType: email_data.email_action_type,
      });
      await sendViaSendliberty({
        apiKey: sendlibertyApiKey,
        to: user.email,
        ...currentEmailContent,
      });

      if (email_data.token_hash) {
        const newEmailUrl = buildConfirmationUrl(
          email_data,
          email_data.token_hash
        );
        const newEmailContent = buildDynamicEmailTemplate({
          user,
          targetEmail: user.new_email,
          confirmationUrl: newEmailUrl,
          token: email_data.token_new || "",
          actionType: email_data.email_action_type,
        });
        await sendViaSendliberty({
          apiKey: sendlibertyApiKey,
          to: user.new_email,
          ...newEmailContent,
        });
      }
    } else {
      const targetEmail =
        email_data.email_action_type === "email_change" && user.new_email
          ? user.new_email
          : user.email;
      const confirmationUrl = buildConfirmationUrl(
        email_data,
        email_data.token_hash
      );
      const emailContent = buildDynamicEmailTemplate({
        user,
        targetEmail,
        confirmationUrl,
        token: email_data.token,
        actionType: email_data.email_action_type,
      });

      await sendViaSendliberty({
        apiKey: sendlibertyApiKey,
        to: targetEmail,
        ...emailContent,
      });
    }

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: {
          http_code: 500,
          message:
            err instanceof Error
              ? err.message
              : "Failed to send confirmation email via Sendliberty",
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
