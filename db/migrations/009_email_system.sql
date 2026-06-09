-- Migration 009: automated email system (reply-to + widget user_id logs)

alter table workspaces
  add column if not exists reply_to_email text;

comment on column workspaces.reply_to_email is
  'Workspace owner Gmail for REPLY-TO on automated end-user emails';

alter table email_logs
  add column if not exists user_id text;

alter table email_logs
  alter column end_user_id drop not null;

create index if not exists email_logs_workspace_user_trigger
  on email_logs (workspace_id, user_id, trigger, sent_at desc)
  where user_id is not null;
