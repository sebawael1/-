import { createClient } from "@supabase/supabase-js";
import type { Database, RegistrationFormInput, RegistrationRecord } from "../types/supabase.js";

export class SupabaseRegistrationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = "DB_ERROR", statusCode = 500) {
    super(message);
    this.name = "SupabaseRegistrationError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function getSupabaseConfig() {
  const supabaseUrl = (process.env.SUPABASE_URL ?? "").trim();
  const supabaseKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();
  const edgeFunctionUrl =
    (process.env.SUPABASE_EDGE_FUNCTION_URL ?? "").trim() ||
    (supabaseUrl ? `${supabaseUrl}/functions/v1/register-user` : "");

  if (!supabaseUrl || !supabaseKey) {
    throw new SupabaseRegistrationError(
      "إعدادات الاتصال بقاعدة بيانات Supabase غير مكتملة في متغيرات البيئة (.env).",
      "MISSING_ENV",
      500
    );
  }

  return { supabaseUrl, supabaseKey, edgeFunctionUrl };
}

/**
 * حفظ بيانات المسجل في جدول registrations في قاعدة بيانات Supabase
 */
export async function saveRegistrationToSupabase(
  input: RegistrationFormInput
): Promise<RegistrationRecord> {
  const { supabaseUrl, supabaseKey, edgeFunctionUrl } = getSupabaseConfig();

  // 1. الحفظ عبر Supabase Edge Function (التي تمتلك صلاحية Service Role الآمنة على خادم Supabase)
  try {
    const response = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
      },
      body: JSON.stringify({
        full_name: input.full_name,
        email: input.email,
        technical_skill: input.technical_skill,
        n8n_webhook_url: process.env.EXTERNAL_N8N_WEBHOOK_URL || undefined,
      }),
    });

    const payload = (await response.json()) as {
      success?: boolean;
      code?: string;
      error?: string;
      registration?: RegistrationRecord;
    };

    if (!response.ok || !payload.success) {
      if (response.status === 409 || payload.code === "DUPLICATE_EMAIL") {
        throw new SupabaseRegistrationError(
          "هذا البريد الإلكتروني مسجل مسبقًا في منصة مدينتكم.",
          "DUPLICATE_EMAIL",
          409
        );
      }
      throw new SupabaseRegistrationError(
        payload.error || "تعذر حفظ بيانات التسجيل في قاعدة بيانات Supabase.",
        payload.code || "DB_ERROR",
        response.status || 500
      );
    }

    if (payload.registration) {
      return payload.registration;
    }
  } catch (err) {
    if (err instanceof SupabaseRegistrationError) {
      throw err;
    }
    // المتابعة إلى الاتصال المباشر عبر مكتبة @supabase/supabase-js في حال تعذر الوصول إلى Edge Function
  }

  // 2. الاتصال المباشر بجدول registrations عبر @supabase/supabase-js
  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const { error } = await supabase.from("registrations").insert({
    full_name: input.full_name,
    email: input.email,
    technical_skill: input.technical_skill,
    automation_status: "pending",
    confirmation_sent: false,
  });

  if (error) {
    if (error.code === "23505") {
      throw new SupabaseRegistrationError(
        "هذا البريد الإلكتروني مسجل مسبقًا في منصة مدينتكم.",
        "DUPLICATE_EMAIL",
        409
      );
    }
    throw new SupabaseRegistrationError(
      `فشل حفظ البيانات في Supabase: ${error.message}`,
      error.code || "DB_INSERT_ERROR",
      500
    );
  }

  return {
    id: crypto.randomUUID(),
    full_name: input.full_name,
    email: input.email,
    technical_skill: input.technical_skill,
    automation_status: "sent",
    confirmation_sent: true,
    confirmation_sent_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
}
