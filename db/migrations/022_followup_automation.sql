-- Migration 022: persistent follow-up automation settings
--
-- The lifecycle engine keeps re-sending the next nudge while a user stays in a
-- non-converted stage. These columns make the cadence configurable and cap the
-- total sends so it never spams.

alter table workspaces
  add column if not exists followup_enabled boolean not null default true,
  add column if not exists followup_interval_days integer not null default 7,
  add column if not exists followup_max_sends integer not null default 4;
