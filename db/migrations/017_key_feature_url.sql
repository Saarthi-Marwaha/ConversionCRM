-- Migration 017: aha moment as a concrete button link
-- The customer pastes the URL their main-feature button opens; any tracked
-- click on that link (or landing on it) counts as the aha moment.

alter table workspaces
  add column if not exists key_feature_url text;
