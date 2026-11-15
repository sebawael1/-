-- تفعيل إضافة pg_net لإرسال Webhooks مباشرة من قاعدة بيانات Supabase إلى n8n
create extension if not exists pg_net with schema extensions;

-- إنشاء جدول المسجلين (registrations)
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) >= 2),
  email text not null unique check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  technical_skill text not null check (char_length(trim(technical_skill)) >= 2),
  automation_status text not null default 'pending' check (automation_status in ('pending', 'triggered', 'sent', 'failed')),
  confirmation_sent boolean not null default false,
  confirmation_sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- فهرس لتحسين الأداء عند الترتيب حسب تاريخ التسجيل
create index if not exists idx_registrations_created_at on public.registrations (created_at desc);

-- تفعيل أمن مستوى الصفوف (Row Level Security)
alter table public.registrations enable row level security;

-- منح الصلاحيات المناسبة
grant insert on table public.registrations to anon, authenticated;
grant all on table public.registrations to service_role;

-- سياسة RLS للسماح بإدراج تسجيل جديد مع التحقق الصارم من الحقول
create policy "Allow public registration insert"
  on public.registrations
  for insert
  to anon, authenticated
  with check (
    char_length(trim(full_name)) >= 2
    and char_length(trim(technical_skill)) >= 2
    and email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    and confirmation_sent = false
    and automation_status = 'pending'
  );
