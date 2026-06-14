-- Migration 019: monthly email rollover
--
-- Unused emails roll into the next month: effective quota for a month =
-- plan quota + rollover_emails (carried leftover, capped at one month's
-- plan quota). `usage_period` marks the month we last reconciled for.

alter table workspaces
  add column if not exists rollover_emails integer not null default 0,
  add column if not exists usage_period date;
