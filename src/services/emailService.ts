import fs from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import type { EmailDispatchResult, RegistrationRecord } from "../types/supabase.js";

export interface PreparedConfirmationEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * تجهيز وتخصيص رسالة التأكيد باسم المسجل وبياناته المحفوظة في Supabase
 */
export function buildPersonalizedConfirmationEmail(record: RegistrationRecord): PreparedConfirmationEmail {
  const formattedDate = new Date(record.created_at).toLocaleString("ar-SA", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const subject = `مرحبًا بك في مدينتكم يا ${record.full_name} — تأكيد تسجيلك الإلكتروني`;

  const text = [
    `مرحبًا ${record.full_name}،`,
    ``,
    `يسعدنا تأكيد استلام وحفظ بيانات تسجيلك بنجاح في منصة مدينتكم.`,
    ``,
    `تفاصيل التسجيل:`,
    `- رقم التسجيل: ${record.id}`,
    `- الاسم الكامل: ${record.full_name}`,
    `- البريد الإلكتروني: ${record.email}`,
    `- المهارة التقنية: ${record.technical_skill}`,
    `- تاريخ التسجيل: ${formattedDate}`,
    ``,
    `شكرًا لانضمامك إلينا — حياتك في المدينة، أكثر اتصالاً.`,
    `فريق مدينتكم`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:32px 16px;background-color:#f3f4f6;font-family:'Cairo','Segoe UI',Tahoma,Arial,sans-serif;color:#111827;direction:rtl;text-align:right;">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e5e7eb;">
    <div style="background:#28664F;padding:28px 32px;color:#ffffff;">
      <div style="font-size:13px;opacity:0.9;margin-bottom:6px;">منصة مدينتكم • الرياض، كما تحبها</div>
      <h1 style="margin:0;font-size:22px;font-weight:700;">تأكيد التسجيل الإلكتروني</h1>
    </div>
    <div style="padding:32px;">
      <p style="font-size:17px;margin-top:0;margin-bottom:12px;">أهلاً بك يا <strong>${record.full_name}</strong>،</p>
      <p style="font-size:15px;line-height:1.8;color:#374151;margin-bottom:24px;">
        نشكرك على التسجيل في <strong>مدينتكم</strong>. نؤكد لك أنه قد تم حفظ بياناتك بنجاح في قاعدة البيانات وتفعيل ملفك التقني.
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;">
        <h3 style="margin:0 0 14px 0;font-size:15px;color:#28664F;">ملخص بيانات التسجيل المحفوظة:</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#1f2937;">
          <tr>
            <td style="padding:7px 0;color:#6b7280;width:38%;">الاسم الكامل:</td>
            <td style="padding:7px 0;font-weight:600;">${record.full_name}</td>
          </tr>
          <tr>
            <td style="padding:7px 0;color:#6b7280;">البريد الإلكتروني:</td>
            <td style="padding:7px 0;font-weight:600;direction:ltr;text-align:right;">${record.email}</td>
          </tr>
          <tr>
            <td style="padding:7px 0;color:#6b7280;">المهارة التقنية:</td>
            <td style="padding:7px 0;font-weight:600;">${record.technical_skill}</td>
          </tr>
          <tr>
            <td style="padding:7px 0;color:#6b7280;">تاريخ التسجيل:</td>
            <td style="padding:7px 0;font-weight:600;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding:7px 0;color:#6b7280;">رقم المعرّف (ID):</td>
            <td style="padding:7px 0;font-family:monospace;font-size:12px;color:#4b5563;">${record.id}</td>
          </tr>
        </table>
      </div>
      <p style="font-size:14px;line-height:1.7;color:#6b7280;margin-bottom:0;">
        حياتك في المدينة، أكثر اتصالاً.<br />
        مع تحيات <strong>فريق مدينتكم</strong>
      </p>
    </div>
  </div>
</body>
</html>`;

  return {
    to: record.email,
    subject,
    html,
    text,
  };
}

/**
 * إرسال رسالة التأكيد عبر Email API الفعلي (Resend / SendGrid / SMTP) فقط عند ضبط المزود
 * لا يُرجع sent: true بشكل وهمي إذا لم يكن هناك مزود بريد فعلي مضبوط
 */
export async function sendConfirmationEmail(record: RegistrationRecord): Promise<EmailDispatchResult> {
  const prepared = buildPersonalizedConfirmationEmail(record);
  const fromAddress = process.env.EMAIL_FROM || "منصة مدينتكم <no-reply@madinatukum.sa>";

  const baseLogsDir = process.env.VERCEL
    ? path.join("/tmp", "logs")
    : path.resolve(process.cwd(), "logs");
  const logsDir = path.join(baseLogsDir, "sent-emails");
  try {
    await fs.mkdir(logsDir, { recursive: true });
    const emailFileName = `confirmation-${record.id}.html`;
    await fs.writeFile(path.join(logsDir, emailFileName), prepared.html, "utf8");
  } catch (_err) {
    // تجاهل خطأ الكتابة في البيئات السحابية المقيدة
  }
  const localPreviewPath = `/api/emails/${record.id}`;

  // 1. إذا كان مفتاح Resend API متوفراً
  const resendApiKey = (process.env.RESEND_API_KEY ?? "").trim();
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [prepared.to],
          subject: prepared.subject,
          html: prepared.html,
          text: prepared.text,
        }),
      });

      if (response.ok) {
        const result = (await response.json()) as { id?: string };
        return {
          sent: true,
          provider: "resend",
          messageId: result.id ?? `resend-${record.id}`,
          localPreviewPath,
          recipient: prepared.to,
          subject: prepared.subject,
        };
      }
      const errText = await response.text();
      return {
        sent: false,
        provider: "resend",
        localPreviewPath,
        recipient: prepared.to,
        subject: prepared.subject,
        error: `فشل الإرسال عبر Resend: ${errText}`,
      };
    } catch (err) {
      return {
        sent: false,
        provider: "resend",
        localPreviewPath,
        recipient: prepared.to,
        subject: prepared.subject,
        error: err instanceof Error ? err.message : "خطأ في الاتصال بخدمة Resend",
      };
    }
  }

  // 2. إذا كان مفتاح SendGrid API متوفراً
  const sendgridApiKey = (process.env.SENDGRID_API_KEY ?? "").trim();
  if (sendgridApiKey) {
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sendgridApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: prepared.to, name: record.full_name }] }],
          from: { email: "no-reply@madinatukum.sa", name: "منصة مدينتكم" },
          subject: prepared.subject,
          content: [
            { type: "text/plain", value: prepared.text },
            { type: "text/html", value: prepared.html },
          ],
        }),
      });

      if (response.ok) {
        return {
          sent: true,
          provider: "sendgrid",
          messageId: response.headers.get("x-message-id") ?? `sendgrid-${record.id}`,
          localPreviewPath,
          recipient: prepared.to,
          subject: prepared.subject,
        };
      }
      const errText = await response.text();
      return {
        sent: false,
        provider: "sendgrid",
        localPreviewPath,
        recipient: prepared.to,
        subject: prepared.subject,
        error: `فشل الإرسال عبر SendGrid: ${errText}`,
      };
    } catch (err) {
      return {
        sent: false,
        provider: "sendgrid",
        localPreviewPath,
        recipient: prepared.to,
        subject: prepared.subject,
        error: err instanceof Error ? err.message : "خطأ في الاتصال بخدمة SendGrid",
      };
    }
  }

  // 3. إذا كانت إعدادات SMTP الفعلية مضبوطة في متغيرات البيئة
  const smtpHost = (process.env.SMTP_HOST ?? "").trim();
  if (smtpHost) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const info = await transporter.sendMail({
        from: fromAddress,
        to: `"${record.full_name}" <${prepared.to}>`,
        subject: prepared.subject,
        text: prepared.text,
        html: prepared.html,
      });

      return {
        sent: true,
        provider: "smtp-custom",
        messageId: info.messageId,
        localPreviewPath,
        recipient: prepared.to,
        subject: prepared.subject,
      };
    } catch (err) {
      return {
        sent: false,
        provider: "smtp-custom",
        localPreviewPath,
        recipient: prepared.to,
        subject: prepared.subject,
        error: err instanceof Error ? err.message : "فشل الإرسال عبر خادم SMTP",
      };
    }
  }

  // لم يتم ضبط مزود بريد خارجي في .env (يعتمد إرسال بريد التفعيل على Supabase Auth)
  return {
    sent: false,
    provider: "local-mail",
    localPreviewPath,
    recipient: prepared.to,
    subject: prepared.subject,
    error: "لم يتم ضبط SMTP_HOST أو RESEND_API_KEY في .env؛ يتم إرسال رابط تفعيل الحساب عبر Supabase Authentication.",
  };
}
