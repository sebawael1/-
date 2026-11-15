import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { processN8nAutomationWorkflow, triggerN8nRegistrationWorkflow } from "../src/services/n8nService.js";
import { SupabaseRegistrationError, saveRegistrationToSupabase } from "../src/services/supabaseService.js";
import type { RegistrationApiResponse, RegistrationRecord } from "../src/types/supabase.js";
import { validateRegistrationInput } from "../src/utils/validation.js";

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(process.cwd(), "public")));

/**
 * إتاحة إعدادات الاتصال العامة فقط (URL + Publishable/Anon Key) للواجهة الأمامية
 * مع عدم إرسال أي مفاتيح سرية (SUPABASE_SECRET_KEY) إلى المتصفح نهائياً
 */
app.get("/api/public-config", (_req: Request, res: Response) => {
  const supabaseUrl = (process.env.SUPABASE_URL ?? "").trim();
  const supabasePublishableKey = (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  ).trim();

  if (!supabaseUrl || !supabasePublishableKey) {
    res.status(500).json({
      error: "إعدادات SUPABASE_URL أو SUPABASE_PUBLISHABLE_KEY غير متوفرة في ملف .env",
    });
    return;
  }

  res.json({
    supabaseUrl,
    supabasePublishableKey,
  });
});

/**
 * فحص جاهزية الخادم الخلفي والاتصال بـ Supabase و n8n و Email API
 */
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    supabaseConfigured: Boolean(
      process.env.SUPABASE_URL &&
        (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY)
    ),
    n8nWebhookConfigured: Boolean(process.env.N8N_WEBHOOK_URL || process.env.EXTERNAL_N8N_WEBHOOK_URL),
    emailProvider: process.env.RESEND_API_KEY
      ? "resend"
      : process.env.SENDGRID_API_KEY
        ? "sendgrid"
        : process.env.SMTP_HOST
          ? "smtp-custom"
          : "supabase-auth",
  });
});

/**
 * توجيه مسارات لوحة التحكم وتأكيد البريد الإلكتروني
 */
app.get(["/dashboard", "/auth/callback"], (_req: Request, res: Response) => {
  res.sendFile(path.resolve(process.cwd(), "public", "dashboard.html"));
});

/**
 * نقطة نهاية Webhook الخاصة بأتمتة n8n
 */
app.post("/api/webhooks/n8n-registration", async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      registration?: RegistrationRecord;
      record?: RegistrationRecord;
    };
    const registration = body.registration || body.record;

    if (!registration || !registration.id || !registration.email) {
      res.status(400).json({
        success: false,
        message: "بيانات حدث التسجيل غير مكتملة لتشغيل Workflow الأتمتة.",
      });
      return;
    }

    const automation = await processN8nAutomationWorkflow(
      registration,
      `http://localhost:${PORT}/api/webhooks/n8n-registration`
    );

    res.status(200).json({
      success: true,
      message: "تم تنفيذ Workflow أتمتة n8n بنجاح.",
      automation,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : "فشل تنفيذ Workflow الأتمتة.",
    });
  }
});

/**
 * معاينة رسالة البريد الإلكتروني التأكيدية المحفوظة
 */
app.get("/api/emails/:id", async (req: Request, res: Response) => {
  try {
    const safeId = String(req.params.id || "").replace(/[^a-zA-Z0-9-]/g, "");
    const filePath = path.resolve(process.cwd(), "logs", "sent-emails", `confirmation-${safeId}.html`);
    const html = await fs.readFile(filePath, "utf8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (_err) {
    res.status(404).send("لم يتم العثور على رسالة التأكيد المطلوبة.");
  }
});

/**
 * نقطة النهاية لحفظ بيانات المسجل في جدول registrations وتشغيل أتمتة n8n
 */
app.post("/api/register", async (req: Request, res: Response<RegistrationApiResponse>) => {
  const validation = validateRegistrationInput(req.body ?? {});

  if (!validation.isValid) {
    res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "يرجى مراجعة الحقول المدخلة والتأكد من صحتها.",
      fieldErrors: validation.errors,
    });
    return;
  }

  try {
    const savedRecord = await saveRegistrationToSupabase(validation.sanitized);
    const automationResult = await triggerN8nRegistrationWorkflow(savedRecord, PORT);

    res.status(201).json({
      success: true,
      message: `تم حفظ بيانات التسجيل في قاعدة البيانات بنجاح.`,
      registration: savedRecord,
      automation: automationResult,
    });
  } catch (err) {
    if (err instanceof SupabaseRegistrationError) {
      res.status(err.statusCode).json({
        success: false,
        code: err.code,
        message: err.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: "حدث خطأ أثناء الاتصال بالخادم أو حفظ البيانات. يرجى المحاولة مرة أخرى.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 خادم منصة مدينتكم يعمل على الرابط: http://localhost:${PORT}`);
});
