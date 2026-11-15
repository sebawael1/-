import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { N8nWorkflowResult, RegistrationRecord } from "../types/supabase.js";
import { buildPersonalizedConfirmationEmail, sendConfirmationEmail } from "./emailService.js";

export interface N8nWebhookPayload {
  event: "registration.created";
  source: "supabase";
  timestamp: string;
  registration: RegistrationRecord;
}

/**
 * تنفيذ خطوات Workflow الأتمتة الخاص بـ n8n:
 * 1. استلام حدث تسجيل مستخدم جديد من Supabase.
 * 2. التحقق من نجاح حفظ السجل في قاعدة البيانات (وجود id وتاريخ التسجيل).
 * 3. معالجة بيانات المسجل وتخصيص قالب البريد الإلكتروني باسمه ومهارته التقنية.
 * 4. إرسال رسالة التأكيد عبر Email API.
 */
export async function processN8nAutomationWorkflow(
  record: RegistrationRecord,
  webhookUrlUsed: string
): Promise<N8nWorkflowResult> {
  if (!record || !record.id || !record.email) {
    throw new Error("لا يمكن تشغيل Workflow الأتمتة قبل التأكد من حفظ بيانات التسجيل في Supabase.");
  }

  const workflowExecutionId = `n8n-exec-${crypto.randomUUID().slice(0, 8)}`;
  const processedAt = new Date().toISOString();

  // تجهيز البيانات المخصصة للرسالة
  const preparedEmail = buildPersonalizedConfirmationEmail(record);

  // إشعار خادم n8n خارجي إن كان مضافاً في متغيرات البيئة
  const externalWebhook = (process.env.EXTERNAL_N8N_WEBHOOK_URL ?? "").trim();
  if (externalWebhook) {
    try {
      await fetch(externalWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowExecutionId,
          event: "registration.created",
          registration: record,
          preparedEmail,
        }),
      });
    } catch (_err) {
      // استمرار التنفيذ عبر عقدة البريد المباشرة لضمان عدم ضياع رسالة التأكيد
    }
  }

  // إرسال رسالة التأكيد المخصصة عبر Email API
  const emailResult = await sendConfirmationEmail(record);

  const result: N8nWorkflowResult = {
    triggered: true,
    webhookUrl: externalWebhook || webhookUrlUsed,
    workflowExecutionId,
    processedAt,
    emailResult,
  };

  // تدوين سجل تنفيذ الأتمتة (Audit Log)
  const logsDir = path.resolve(process.cwd(), "logs");
  await fs.mkdir(logsDir, { recursive: true });
  await fs.appendFile(
    path.join(logsDir, "n8n-executions.jsonl"),
    JSON.stringify({
      workflowExecutionId,
      processedAt,
      registrationId: record.id,
      fullName: record.full_name,
      email: record.email,
      technicalSkill: record.technical_skill,
      emailSent: emailResult.sent,
      emailProvider: emailResult.provider,
      previewUrl: emailResult.previewUrl,
    }) + "\n",
    "utf8"
  );

  return result;
}

/**
 * استدعاء Webhook الأتمتة الخاص بـ n8n عند تسجيل مستخدم جديد
 */
export async function triggerN8nRegistrationWorkflow(
  record: RegistrationRecord,
  port: number
): Promise<N8nWorkflowResult> {
  const configuredWebhookUrl =
    (process.env.N8N_WEBHOOK_URL ?? "").trim() ||
    `http://localhost:${port}/api/webhooks/n8n-registration`;

  try {
    const response = await fetch(configuredWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "registration.created",
        source: "supabase",
        timestamp: new Date().toISOString(),
        registration: record,
      } satisfies N8nWebhookPayload),
    });

    if (response.ok) {
      const data = (await response.json()) as { automation?: N8nWorkflowResult };
      if (data.automation) {
        return data.automation;
      }
    }
  } catch (_err) {
    // في حال تعذر الوصول عبر HTTP المحلي، يتم تشغيل خط أنابيب الأتمتة مباشرةً
  }

  return processN8nAutomationWorkflow(record, configuredWebhookUrl);
}
