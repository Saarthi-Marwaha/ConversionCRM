-- Migration 020: scheduled plan changes (upgrade now, starts next cycle)
--
-- When a subscribed customer upgrades, the new plan is scheduled at the
-- Razorpay cycle end. `pending_plan` + `pending_plan_starts_at` track the
-- change so the dashboard can show it and apply it when the month rolls over.

alter table workspaces
  add column if not exists pending_plan text
    check (pending_plan in ('free','basic','pro','premium','enterprise')),
  add column if not exists pending_plan_starts_at timestamptz;
