-- Migration 015: geo capture on events (country / region / city from edge headers)

alter table events
  add column if not exists country text,
  add column if not exists region text,
  add column if not exists city text;

comment on column events.country is
  'ISO 3166-1 alpha-2 country code resolved at the edge (x-vercel-ip-country)';
