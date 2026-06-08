-- ═══════════════════════════════════════════════════════════════
-- ConversionCRM — Full Database Migration (run once)
-- Paste this entire file into:
-- https://supabase.com/dashboard/project/gjihgmjzpwewcaqnbbtf/sql/new
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- workspaces
-- ─────────────────────────────────────────────
create table if not exists workspaces (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  owner_id            uuid not null references auth.users(id) on delete cascade,
  api_key             text not null unique,
  product_name        text,
  key_feature_name    text,
  key_feature_event   text,
  trial_length_days   int not null default 14,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- end_users
-- ─────────────────────────────────────────────
create table if not exists end_users (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  external_id         text not null,
  email               text not null,
  name                text,
  stage               text not null default 'signup'
                        check (stage in ('signup','onboarding','active','going_quiet','conversion_ready','paid','churned')),
  engagement_score    int not null default 0 check (engagement_score between 0 and 100),
  trial_started_at    timestamptz,
  trial_ends_at       timestamptz,
  converted_at        timestamptz,
  last_seen_at        timestamptz,
  metadata            jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (workspace_id, external_id),
  unique (workspace_id, email)
);

create index if not exists end_users_workspace_stage
  on end_users (workspace_id, stage);

create index if not exists end_users_workspace_score
  on end_users (workspace_id, engagement_score desc);

-- ─────────────────────────────────────────────
-- events
-- ─────────────────────────────────────────────
create table if not exists events (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  end_user_id     uuid not null references end_users(id) on delete cascade,
  event_type      text not null
                    check (event_type in ('login','feature_click','page_view','pricing_page_visit',
                                          'key_feature_used','file_uploaded','task_completed',
                                          'upgrade_clicked','custom')),
  event_name      text not null,
  properties      jsonb not null default '{}',
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists events_end_user_occurred
  on events (end_user_id, occurred_at desc);

create index if not exists events_workspace_occurred
  on events (workspace_id, occurred_at desc);

-- ─────────────────────────────────────────────
-- engagement_scores
-- ─────────────────────────────────────────────
create table if not exists engagement_scores (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  end_user_id       uuid not null references end_users(id) on delete cascade,
  score             int not null check (score between 0 and 100),
  score_breakdown   jsonb not null default '{}',
  computed_at       timestamptz not null default now()
);

create index if not exists engagement_scores_end_user_computed
  on engagement_scores (end_user_id, computed_at desc);

-- ─────────────────────────────────────────────
-- email_logs
-- ─────────────────────────────────────────────
create table if not exists email_logs (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references workspaces(id) on delete cascade,
  end_user_id           uuid not null references end_users(id) on delete cascade,
  trigger               text not null
                          check (trigger in ('welcome','feature_nudge','value_demo','check_in',
                                             'upgrade_offer','urgency','churn_prevention','daily_summary')),
  resend_message_id     text,
  subject               text not null,
  status                text not null default 'sent'
                          check (status in ('sent','failed','skipped')),
  sent_at               timestamptz not null default now(),
  metadata              jsonb not null default '{}'
);

create index if not exists email_logs_end_user_trigger
  on email_logs (end_user_id, trigger, sent_at desc);

-- ─────────────────────────────────────────────
-- subscriptions
-- ─────────────────────────────────────────────
create table if not exists subscriptions (
  id                              uuid primary key default gen_random_uuid(),
  workspace_id                    uuid not null references workspaces(id) on delete cascade,
  end_user_id                     uuid not null references end_users(id) on delete cascade,
  lemonsqueezy_subscription_id    text unique,
  lemonsqueezy_order_id           text,
  status                          text not null default 'trialing'
                                    check (status in ('trialing','active','past_due','cancelled','expired')),
  plan_name                       text,
  variant_id                      text,
  renews_at                       timestamptz,
  ends_at                         timestamptz,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),

  unique (workspace_id, end_user_id)
);

-- ─────────────────────────────────────────────
-- Row-Level Security
-- ─────────────────────────────────────────────
alter table workspaces         enable row level security;
alter table end_users          enable row level security;
alter table events             enable row level security;
alter table engagement_scores  enable row level security;
alter table email_logs         enable row level security;
alter table subscriptions      enable row level security;

create policy "workspace_owner_access" on workspaces
  for all using (owner_id = auth.uid());

create policy "end_users_workspace_owner" on end_users
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

create policy "events_workspace_owner" on events
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

create policy "engagement_scores_workspace_owner" on engagement_scores
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

create policy "email_logs_workspace_owner" on email_logs
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

create policy "subscriptions_workspace_owner" on subscriptions
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- updated_at auto-trigger
-- ─────────────────────────────────────────────
create or replace function handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_workspaces
  before update on workspaces
  for each row execute function handle_updated_at();

create trigger set_updated_at_end_users
  before update on end_users
  for each row execute function handle_updated_at();

create trigger set_updated_at_subscriptions
  before update on subscriptions
  for each row execute function handle_updated_at();
