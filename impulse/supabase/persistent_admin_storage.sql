create table if not exists public.admin_content (
  key text primary key check (key in (
    'admin-state.json',
    'engine-questions.json',
    'series.json',
    'tests.json'
  )),
  content jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.admin_content enable row level security;
revoke all on public.admin_content from public, anon, authenticated;
grant all on public.admin_content to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'admin-uploads',
  'admin-uploads',
  true,
  5242880,
  array['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
