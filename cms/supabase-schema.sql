-- Kerehama Labs CMS schema. Paste into Supabase SQL editor (project ewlufiwgnnnfwdjoafcu).
-- Safe to re-run: everything is IF NOT EXISTS / OR REPLACE.

create table if not exists public.sites (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  is_admin boolean not null default false
);

create table if not exists public.site_members (
  user_id uuid not null references auth.users (id) on delete cascade,
  site_slug text not null references public.sites (slug) on delete cascade,
  role text not null default 'client' check (role in ('client')),
  primary key (user_id, site_slug)
);

create table if not exists public.drafts (
  site_slug text primary key references public.sites (slug) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  site_slug text not null,
  path text not null,
  referrer text,
  visitor_hash text,
  ts timestamptz not null default now()
);
create index if not exists page_views_site_ts on public.page_views (site_slug, ts desc);

-- security definer so RLS policies can check admin without recursing into profiles' own policies
create or replace function public.cms_is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select is_admin from public.profiles where user_id = auth.uid()), false) $$;

create or replace function public.cms_is_member(slug text) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.site_members where user_id = auth.uid() and site_slug = slug) $$;

alter table public.sites enable row level security;
alter table public.profiles enable row level security;
alter table public.site_members enable row level security;
alter table public.drafts enable row level security;
alter table public.page_views enable row level security;

drop policy if exists sites_select on public.sites;
create policy sites_select on public.sites for select
  using (public.cms_is_admin() or public.cms_is_member(slug));

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select
  using (user_id = auth.uid() or public.cms_is_admin());

drop policy if exists members_select on public.site_members;
create policy members_select on public.site_members for select
  using (user_id = auth.uid() or public.cms_is_admin());

drop policy if exists drafts_select on public.drafts;
create policy drafts_select on public.drafts for select
  using (public.cms_is_admin() or public.cms_is_member(site_slug));
drop policy if exists drafts_insert on public.drafts;
create policy drafts_insert on public.drafts for insert
  with check (public.cms_is_admin() or public.cms_is_member(site_slug));
drop policy if exists drafts_update on public.drafts;
create policy drafts_update on public.drafts for update
  using (public.cms_is_admin() or public.cms_is_member(site_slug));

-- admins can manage sites and memberships from the dashboard
drop policy if exists sites_admin_insert on public.sites;
create policy sites_admin_insert on public.sites for insert with check (public.cms_is_admin());
drop policy if exists sites_admin_update on public.sites;
create policy sites_admin_update on public.sites for update using (public.cms_is_admin());
drop policy if exists members_admin_insert on public.site_members;
create policy members_admin_insert on public.site_members for insert with check (public.cms_is_admin());
drop policy if exists members_admin_delete on public.site_members;
create policy members_admin_delete on public.site_members for delete using (public.cms_is_admin());

-- clients can read their own traffic; inserts happen only via the service role (cms-track function)
drop policy if exists views_select on public.page_views;
create policy views_select on public.page_views for select
  using (public.cms_is_admin() or public.cms_is_member(site_slug));

-- seed sites
insert into public.sites (slug, name) values
  ('myspeech', 'MySpeech'),
  ('example', 'Example (testing)')
on conflict (slug) do nothing;

-- ONE-TIME: after creating your own user (Supabase dashboard -> Authentication -> Add user),
-- run this to make yourself admin:
insert into public.profiles (user_id, email, is_admin)
select id, email, true from auth.users where email = 'kerehama@andrewstribe.co.nz'
on conflict (user_id) do update set is_admin = true;
