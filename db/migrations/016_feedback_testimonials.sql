-- Migration 016: in-app feedback portal + permanent product testimonials

create table if not exists feedback (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  author_email  text,
  kind          text not null check (kind in ('feature', 'issue')),
  message       text not null,
  created_at    timestamptz not null default now()
);

create index if not exists feedback_workspace_created
  on feedback (workspace_id, created_at desc);

alter table feedback enable row level security;

create policy "feedback_workspace_owner" on feedback
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

-- Testimonials are praise for the product itself: shared across all
-- workspaces, write-once, never deleted.
create table if not exists testimonials (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references workspaces(id) on delete set null,
  author_name   text not null,
  rating        int not null check (rating between 1 and 5),
  content       text not null,
  created_at    timestamptz not null default now()
);

create index if not exists testimonials_created
  on testimonials (created_at desc);

alter table testimonials enable row level security;

create policy "testimonials_read_all" on testimonials
  for select using (true);
