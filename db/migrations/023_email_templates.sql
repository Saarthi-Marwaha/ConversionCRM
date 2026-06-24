-- Migration 023: per-workspace custom email templates
--
-- Paid plans (Basic and above) can override the subject + HTML body of any of
-- the 8 lifecycle emails. One row per (workspace, trigger). When a row exists
-- the sender uses it instead of the built-in React Email template, with
-- {{userName}}, {{productName}}, {{ctaUrl}}, etc. substituted at send time.

create table if not exists email_templates (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  trigger      text not null,
  subject      text not null,
  html_body    text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, trigger)
);

create index if not exists email_templates_workspace_idx
  on email_templates (workspace_id);
