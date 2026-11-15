export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      registrations: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          technical_skill: string;
          automation_status: "pending" | "triggered" | "sent" | "failed";
          confirmation_sent: boolean;
          confirmation_sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          email: string;
          technical_skill: string;
          automation_status?: "pending" | "triggered" | "sent" | "failed";
          confirmation_sent?: boolean;
          confirmation_sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          technical_skill?: string;
          automation_status?: "pending" | "triggered" | "sent" | "failed";
          confirmation_sent?: boolean;
          confirmation_sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type RegistrationRecord = Database["public"]["Tables"]["registrations"]["Row"];

export interface RegistrationFormInput {
  full_name: string;
  email: string;
  technical_skill: string;
}

export interface ValidationErrors {
  full_name?: string;
  email?: string;
  technical_skill?: string;
}

export interface EmailDispatchResult {
  sent: boolean;
  provider: "resend" | "sendgrid" | "smtp-ethereal" | "smtp-custom" | "local-mail";
  messageId?: string;
  previewUrl?: string;
  localPreviewPath?: string;
  recipient: string;
  subject: string;
  error?: string;
}

export interface N8nWorkflowResult {
  triggered: boolean;
  webhookUrl: string;
  workflowExecutionId: string;
  processedAt: string;
  emailResult: EmailDispatchResult;
}

export interface RegistrationApiResponse {
  success: boolean;
  message: string;
  code?: string;
  fieldErrors?: ValidationErrors;
  registration?: RegistrationRecord;
  automation?: N8nWorkflowResult;
}
