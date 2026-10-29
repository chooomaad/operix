-- Reproduction minimale de ce que Supabase fournit avant nos migrations,
-- pour tester sur un PostgreSQL nu (aucune image Docker Supabase requise).
-- Les colonnes reprennent celles des tables réelles qu'utilisent nos migrations.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  instance_id             uuid,
  id                      uuid primary key,
  aud                     varchar(255),
  role                    varchar(255),
  email                   varchar(255),
  encrypted_password      varchar(255),
  email_confirmed_at      timestamptz,
  raw_app_meta_data       jsonb,
  raw_user_meta_data      jsonb,
  created_at              timestamptz,
  updated_at              timestamptz,
  confirmation_token      varchar(255),
  recovery_token          varchar(255),
  email_change            varchar(255),
  email_change_token_new  varchar(255)
);

create table if not exists auth.identities (
  id               uuid primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  provider_id      text not null,
  identity_data    jsonb not null,
  provider         text not null,
  last_sign_in_at  timestamptz,
  created_at       timestamptz,
  updated_at       timestamptz
);

create table if not exists storage.buckets (
  id                  text primary key,
  name                text not null,
  public              boolean default false,
  file_size_limit     bigint,
  allowed_mime_types  text[]
);
